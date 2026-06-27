import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { Clock, CheckCircle, XCircle, AlertCircle, DollarSign } from 'lucide-react';

const LoanApproval = () => {
  const [pendingLoans, setPendingLoans] = useState([]);
  const [allOwingLoans, setAllOwingLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingOwing, setLoadingOwing] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showDenyModal, setShowDenyModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [approveForm, setApproveForm] = useState({ approvedAmount: '', notes: '' });
  const [denyForm, setDenyForm] = useState({ notes: '' });
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    fetchPendingLoans();
    fetchAllOwingLoans();
  }, []);

  const fetchPendingLoans = async () => {
    try {
      setLoading(true);
      const response = await api.get('/loans/pending');
      setPendingLoans(response.data.pendingLoans || []);
    } catch (error) {
      console.error('Error fetching pending loans:', error);
      toast.error('Failed to fetch pending loans');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllOwingLoans = async () => {
    try {
      setLoadingOwing(true);
      // Get all loans that are GIVEN, SETTLED, or SETTLEMENT_ACCEPTED (comma-separated)
      const response = await api.get('/loans/all?status=GIVEN,SETTLED,SETTLEMENT_ACCEPTED');
      setAllOwingLoans(response.data.loans || []);
    } catch (error) {
      console.error('Error fetching owing loans:', error);
      toast.error('Failed to fetch loans');
    } finally {
      setLoadingOwing(false);
    }
  };

  const openApproveModal = (loan) => {
    setSelectedLoan(loan);
    setApproveForm({ approvedAmount: loan.requestedAmount.toString(), notes: '' });
    setShowApproveModal(true);
  };

  const openDenyModal = (loan) => {
    setSelectedLoan(loan);
    setDenyForm({ notes: '' });
    setShowDenyModal(true);
  };

  const handleApprove = async () => {
    if (!selectedLoan) return;
    
    const amount = parseFloat(approveForm.approvedAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Invalid amount');
      return;
    }

    try {
      setActionLoading(selectedLoan.id);
      await api.post(`/loans/review/${selectedLoan.id}`, {
        action: 'approve',
        approvedAmount: amount,
        notes: approveForm.notes || null
      });
      toast.success('Loan approved successfully');
      setShowApproveModal(false);
      setSelectedLoan(null);
      setApproveForm({ approvedAmount: '', notes: '' });
      fetchPendingLoans();
      fetchAllOwingLoans();
    } catch (error) {
      console.error('Error approving loan:', error);
      toast.error(error.response?.data?.error || 'Failed to approve loan');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeny = async () => {
    if (!selectedLoan) return;

    try {
      setActionLoading(selectedLoan.id);
      await api.post(`/loans/review/${selectedLoan.id}`, {
        action: 'deny',
        notes: denyForm.notes || null
      });
      toast.success('Loan denied');
      setShowDenyModal(false);
      setSelectedLoan(null);
      setDenyForm({ notes: '' });
      fetchPendingLoans();
      fetchAllOwingLoans();
    } catch (error) {
      console.error('Error denying loan:', error);
      toast.error(error.response?.data?.error || 'Failed to deny loan');
    } finally {
      setActionLoading(null);
    }
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

  const getBalance = (loan) => {
    return loan.approvedAmount || loan.requestedAmount;
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      GIVEN: { color: 'bg-green-100 text-green-800', label: 'Disbursed' },
      SETTLED: { color: 'bg-orange-100 text-orange-800', label: 'Settled (Awaiting Acceptance)' },
      SETTLEMENT_ACCEPTED: { color: 'bg-blue-100 text-blue-800', label: 'Settlement Accepted' }
    };
    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-800', label: status };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${config.color}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Loan Approval</h1>

        {/* Tabs */}
        <div className="flex gap-2 border-b mb-6">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'pending'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Pending Approval
          </button>
          <button
            onClick={() => setActiveTab('owing')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'owing'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Staff Owing Money ({allOwingLoans.length})
          </button>
        </div>

        {/* Pending Loans Tab */}
        {activeTab === 'pending' && (
          <>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            ) : pendingLoans.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <Clock className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 text-lg">No pending loan requests</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {pendingLoans.map((loan) => (
                  <div key={loan.id} className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{loan.staff.fullname}</h3>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                            {loan.staff.role}
                          </span>
                          {loan.settlementMethod && (
                            <span className={`px-2 py-1 text-xs font-semibold rounded ${
                              loan.settlementMethod === 'INSTANT_PAID' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {loan.settlementMethod === 'INSTANT_PAID' ? 'Instant Paid' : 'From Payroll'}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-gray-500">Requested Amount</p>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(loan.requestedAmount)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Requested On</p>
                            <p className="text-sm text-gray-900">{formatDate(loan.requestedAt)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Contact</p>
                            <p className="text-sm text-gray-900">{loan.staff.email}</p>
                            {loan.staff.phone && (
                              <p className="text-sm text-gray-500">{loan.staff.phone}</p>
                            )}
                          </div>
                        </div>
                        {loan.reason && (
                          <div className="mb-4">
                            <p className="text-sm text-gray-500">Reason</p>
                            <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded">{loan.reason}</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => openApproveModal(loan)}
                          disabled={actionLoading === loan.id}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => openDenyModal(loan)}
                          disabled={actionLoading === loan.id}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          <XCircle className="h-4 w-4" />
                          Deny
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Staff Owing Money Tab */}
        {activeTab === 'owing' && (
          <>
            {loadingOwing ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            ) : allOwingLoans.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <CheckCircle className="h-16 w-16 mx-auto text-green-400 mb-4" />
                <p className="text-gray-600 text-lg">No staff owing money</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount Owed</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Settlement Method</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Disbursed</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {allOwingLoans.map((loan) => {
                        const balance = getBalance(loan);
                        const settled = loan.settledAmount || 0;
                        const accepted = loan.settlementAcceptedAmount || 0;
                        const remaining = balance - accepted;
                        return (
                          <tr key={loan.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{loan.staff.fullname}</div>
                                <div className="text-sm text-gray-500">{loan.staff.role}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-semibold text-gray-900">{formatCurrency(balance)}</div>
                              {settled > 0 && (
                                <div className="text-xs text-blue-600 mt-1">Settled: {formatCurrency(settled)}</div>
                              )}
                              {accepted > 0 && (
                                <div className="text-xs text-green-600 mt-1">Accepted: {formatCurrency(accepted)}</div>
                              )}
                              {remaining > 0 && remaining < balance && (
                                <div className="text-xs text-orange-600 mt-1">Remaining: {formatCurrency(remaining)}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {loan.settlementMethod === 'FROM_PAYROLL' ? (
                                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded">
                                  From Payroll
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                                  Instant Paid
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getStatusBadge(loan.status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {loan.givenAt ? formatDate(loan.givenAt) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Approve Modal */}
        {showApproveModal && selectedLoan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Approve Loan</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Approved Amount (ETB)
                  </label>
                  <input
                    type="number"
                    value={approveForm.approvedAmount}
                    onChange={(e) => setApproveForm({ ...approveForm, approvedAmount: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={selectedLoan.requestedAmount.toString()}
                    min="0"
                    step="0.01"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Requested: {formatCurrency(selectedLoan.requestedAmount)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={approveForm.notes}
                    onChange={(e) => setApproveForm({ ...approveForm, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    placeholder="Add any notes..."
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowApproveModal(false);
                    setSelectedLoan(null);
                    setApproveForm({ approvedAmount: '', notes: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  disabled={actionLoading === selectedLoan.id}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {actionLoading === selectedLoan.id ? 'Approving...' : 'Approve'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Deny Modal */}
        {showDenyModal && selectedLoan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Deny Loan</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Denial (Optional)
                  </label>
                  <textarea
                    value={denyForm.notes}
                    onChange={(e) => setDenyForm({ ...denyForm, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    placeholder="Add reason for denial..."
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowDenyModal(false);
                    setSelectedLoan(null);
                    setDenyForm({ notes: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeny}
                  disabled={actionLoading === selectedLoan.id}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading === selectedLoan.id ? 'Denying...' : 'Deny'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoanApproval;
