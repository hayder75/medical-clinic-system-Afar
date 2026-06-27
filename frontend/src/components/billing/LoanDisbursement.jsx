import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { DollarSign, CheckCircle, Clock, AlertCircle } from 'lucide-react';

const LoanDisbursement = () => {
  const [approvedLoans, setApprovedLoans] = useState([]);
  const [settledLoans, setSettledLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSettled, setLoadingSettled] = useState(true);
  const [disbursing, setDisbursing] = useState(null);
  const [accepting, setAccepting] = useState(null);
  const [activeTab, setActiveTab] = useState('disbursement');
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [acceptAmount, setAcceptAmount] = useState('');

  useEffect(() => {
    fetchApprovedLoans();
    fetchSettledLoans();
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchApprovedLoans();
      fetchSettledLoans();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchApprovedLoans = async () => {
    try {
      setLoading(true);
      const response = await api.get('/loans/approved');
      setApprovedLoans(response.data.approvedLoans || []);
    } catch (error) {
      console.error('Error fetching approved loans:', error);
      toast.error('Failed to fetch approved loans');
    } finally {
      setLoading(false);
    }
  };

  const fetchSettledLoans = async () => {
    try {
      setLoadingSettled(true);
      const response = await api.get('/loans/settled');
      setSettledLoans(response.data.settledLoans || []);
    } catch (error) {
      console.error('Error fetching settled loans:', error);
      toast.error('Failed to fetch settled loans');
    } finally {
      setLoadingSettled(false);
    }
  };

  const openDisburseModal = (loan) => {
    setSelectedLoan(loan);
    setShowDisburseModal(true);
  };

  const handleDisburse = async () => {
    if (!selectedLoan) return;

    try {
      setDisbursing(selectedLoan.id);
      await api.post(`/loans/disburse/${selectedLoan.id}`);
      toast.success('Loan disbursed successfully');
      setShowDisburseModal(false);
      setSelectedLoan(null);
      fetchApprovedLoans();
    } catch (error) {
      console.error('Error disbursing loan:', error);
      toast.error(error.response?.data?.error || 'Failed to disburse loan');
    } finally {
      setDisbursing(null);
    }
  };

  const openAcceptModal = (loan) => {
    setSelectedLoan(loan);
    const settled = loan.settledAmount || (loan.approvedAmount || loan.requestedAmount);
    setAcceptAmount(settled.toString());
    setShowAcceptModal(true);
  };

  const handleAcceptSettlement = async () => {
    if (!selectedLoan) return;

    const amount = parseFloat(acceptAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const settled = selectedLoan.settledAmount || (selectedLoan.approvedAmount || selectedLoan.requestedAmount);
    if (amount > settled) {
      toast.error(`Accepted amount cannot exceed settled amount of ${settled.toFixed(2)} ETB`);
      return;
    }

    try {
      setAccepting(selectedLoan.id);
      await api.post(`/loans/accept-settlement/${selectedLoan.id}`, {
        acceptedAmount: amount
      });
      toast.success(`Settlement of ${amount.toFixed(2)} ETB accepted. Money added to cash session.`);
      setShowAcceptModal(false);
      setSelectedLoan(null);
      setAcceptAmount('');
      fetchSettledLoans();
    } catch (error) {
      console.error('Error accepting settlement:', error);
      toast.error(error.response?.data?.error || 'Failed to accept settlement');
    } finally {
      setAccepting(null);
    }
  };

  const getBalance = (loan) => {
    return loan.approvedAmount || loan.requestedAmount;
  };

  const getSettledAmount = (loan) => {
    return loan.settledAmount || 0;
  };

  const getRemainingAfterSettlement = (loan) => {
    const balance = getBalance(loan);
    const settled = getSettledAmount(loan);
    return balance - settled;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Loan Management</h1>

        {/* Tabs */}
        <div className="flex gap-2 border-b mb-6">
          <button
            onClick={() => setActiveTab('disbursement')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'disbursement'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <DollarSign className="inline h-4 w-4 mr-2" />
            Disbursement
          </button>
          <button
            onClick={() => setActiveTab('settlements')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'settlements'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <CheckCircle className="inline h-4 w-4 mr-2" />
            Settlements ({settledLoans.length})
          </button>
        </div>

        {/* Disbursement Tab */}
        {activeTab === 'disbursement' && (
          <>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            ) : approvedLoans.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <CheckCircle className="h-16 w-16 mx-auto text-green-400 mb-4" />
                <p className="text-gray-600 text-lg">No loans awaiting disbursement</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {approvedLoans.map((loan) => (
                  <div key={loan.id} className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{loan.staff.fullname}</h3>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                            {loan.staff.role}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-gray-500">Requested Amount</p>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(loan.requestedAmount)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Approved Amount</p>
                            <p className="text-lg font-semibold text-green-600">{formatCurrency(loan.approvedAmount)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Approved On</p>
                            <p className="text-sm text-gray-900">{formatDate(loan.approvedAt)}</p>
                            <p className="text-xs text-gray-500">By {loan.reviewedBy?.fullname}</p>
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => openDisburseModal(loan)}
                        disabled={disbursing === loan.id}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-semibold"
                      >
                        <DollarSign className="h-5 w-5" />
                        {disbursing === loan.id ? 'Disbursing...' : 'Disburse'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Settlements Tab */}
        {activeTab === 'settlements' && (
          <>
            {loadingSettled ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            ) : settledLoans.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <CheckCircle className="h-16 w-16 mx-auto text-green-400 mb-4" />
                <p className="text-gray-600 text-lg">No settled loans awaiting acceptance</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {settledLoans.map((loan) => {
                  const balance = getBalance(loan);
                  const settled = getSettledAmount(loan);
                  const remaining = getRemainingAfterSettlement(loan);
                  return (
                    <div key={loan.id} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">{loan.staff.fullname}</h3>
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                              {loan.staff.role}
                            </span>
                            <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                              Awaiting Acceptance
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div>
                              <p className="text-sm text-gray-500">Full Balance</p>
                              <p className="text-lg font-semibold text-gray-900">{formatCurrency(balance)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Settled Amount</p>
                              <p className="text-xl font-bold text-blue-600">{formatCurrency(settled)}</p>
                              {remaining > 0 && (
                                <p className="text-xs text-gray-500 mt-1">Remaining: {formatCurrency(remaining)}</p>
                              )}
                            </div>
                            {loan.settlementAcceptedAmount > 0 && (
                              <div>
                                <p className="text-sm text-gray-500">Previously Accepted</p>
                                <p className="text-lg font-semibold text-green-600">{formatCurrency(loan.settlementAcceptedAmount)}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-sm text-gray-500">Settled On</p>
                              <p className="text-sm text-gray-900">{formatDate(loan.settledAt)}</p>
                              {loan.settledBy && (
                                <p className="text-xs text-gray-500">By {loan.settledBy.fullname}</p>
                              )}
                            </div>
                          </div>
                          {loan.reason && (
                            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Reason:</span> {loan.reason}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="ml-6">
                          <button
                            onClick={() => openAcceptModal(loan)}
                            disabled={accepting === loan.id}
                            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-semibold"
                          >
                            <CheckCircle className="h-5 w-5" />
                            {accepting === loan.id ? 'Accepting...' : 'Accept Payment'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Disburse Modal */}
        {showDisburseModal && selectedLoan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Confirm Disbursement</h2>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Staff Member:</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedLoan.staff.fullname}</p>
                  <p className="text-sm text-gray-500">{selectedLoan.staff.role}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Amount to Disburse:</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(selectedLoan.approvedAmount)}</p>
                </div>
                <p className="text-sm text-gray-600">
                  This will mark the loan as disbursed and record it as an expense in your cash session.
                </p>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowDisburseModal(false);
                    setSelectedLoan(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDisburse}
                  disabled={disbursing === selectedLoan.id}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {disbursing === selectedLoan.id ? 'Disbursing...' : 'Confirm Disburse'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Accept Settlement Modal */}
        {showAcceptModal && selectedLoan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Accept Settlement</h2>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Staff Member:</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedLoan.staff.fullname}</p>
                  <p className="text-sm text-gray-500">{selectedLoan.staff.role}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Settled Amount:</p>
                  <p className="text-lg font-semibold text-blue-600">{formatCurrency(getSettledAmount(selectedLoan))}</p>
                  {selectedLoan.settlementAcceptedAmount > 0 && (
                    <>
                      <p className="text-sm text-gray-600 mt-2 mb-1">Previously Accepted:</p>
                      <p className="text-sm font-semibold text-green-600">{formatCurrency(selectedLoan.settlementAcceptedAmount)}</p>
                    </>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount Received (ETB)
                  </label>
                  <input
                    type="number"
                    value={acceptAmount}
                    onChange={(e) => setAcceptAmount(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder={getSettledAmount(selectedLoan).toString()}
                    min="0"
                    max={getSettledAmount(selectedLoan)}
                    step="0.01"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the amount you actually received. Maximum: {formatCurrency(getSettledAmount(selectedLoan))}
                  </p>
                </div>
                <p className="text-sm text-gray-600">
                  This will add the money to your daily cash session and mark the settlement as accepted.
                </p>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAcceptModal(false);
                    setSelectedLoan(null);
                    setAcceptAmount('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAcceptSettlement}
                  disabled={accepting === selectedLoan.id || !acceptAmount || parseFloat(acceptAmount) <= 0}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {accepting === selectedLoan.id ? 'Accepting...' : 'Accept Payment'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoanDisbursement;

