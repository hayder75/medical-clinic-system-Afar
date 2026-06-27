import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { DollarSign, Clock, CheckCircle, XCircle, AlertCircle, FileText } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const Loans = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('request');
  
  // Request form state
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [settlementMethod, setSettlementMethod] = useState('INSTANT_PAID');
  const [loading, setLoading] = useState(false);
  const [settling, setSettling] = useState(null);
  
  // My loans state
  const [myLoans, setMyLoans] = useState([]);
  const [loadingLoans, setLoadingLoans] = useState(true);
  
  // Approved loans (for billing officer)
  const [approvedLoans, setApprovedLoans] = useState([]);
  const [loadingApproved, setLoadingApproved] = useState(true);
  const [disbursing, setDisbursing] = useState(null);
  
  // Settled loans (for billing officer)
  const [settledLoans, setSettledLoans] = useState([]);
  const [loadingSettled, setLoadingSettled] = useState(true);
  const [accepting, setAccepting] = useState(null);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [selectedLoanForAccept, setSelectedLoanForAccept] = useState(null);
  const [acceptAmount, setAcceptAmount] = useState('');
  
  // Settlement modal
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedLoanForSettle, setSelectedLoanForSettle] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');

  useEffect(() => {
    fetchMyLoans();
    if (user?.role === 'BILLING_OFFICER') {
      fetchApprovedLoans();
      fetchSettledLoans();
    }
  }, [user]);

  const fetchMyLoans = async () => {
    try {
      setLoadingLoans(true);
      const response = await api.get('/loans/my-requests');
      const loans = response.data.loans || [];
      console.log('Fetched loans:', loans);
      // Log settlement methods to debug
      loans.forEach(loan => {
        console.log(`Loan ${loan.id}: settlementMethod = ${loan.settlementMethod}, status = ${loan.status}`);
      });
      setMyLoans(loans);
    } catch (error) {
      console.error('Error fetching loans:', error);
      toast.error('Failed to fetch loan requests');
    } finally {
      setLoadingLoans(false);
    }
  };

  const fetchApprovedLoans = async () => {
    try {
      setLoadingApproved(true);
      const response = await api.get('/loans/approved');
      setApprovedLoans(response.data.approvedLoans || []);
    } catch (error) {
      console.error('Error fetching approved loans:', error);
      toast.error('Failed to fetch approved loans');
    } finally {
      setLoadingApproved(false);
    }
  };

  const fetchSettledLoans = async () => {
    try {
      setLoadingSettled(true);
      const response = await api.get('/loans/settled');
      const settled = response.data.settledLoans || [];
      console.log('Fetched settled loans:', settled);
      console.log('Number of settled loans:', settled.length);
      settled.forEach(loan => {
        console.log(`Settled Loan ${loan.id}: status=${loan.status}, settledAmount=${loan.settledAmount}, staff=${loan.staff?.fullname}`);
      });
      setSettledLoans(settled);
    } catch (error) {
      console.error('Error fetching settled loans:', error);
      toast.error('Failed to fetch settled loans');
    } finally {
      setLoadingSettled(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      setLoading(true);
      const requestData = {
        amount: parseFloat(amount),
        reason: reason || null,
        settlementMethod: settlementMethod || 'INSTANT_PAID'
      };
      console.log('Submitting loan request with data:', requestData);
      console.log('Current settlementMethod state:', settlementMethod);
      await api.post('/loans/request', requestData);
      toast.success('Loan request submitted successfully');
      setAmount('');
      setReason('');
      setSettlementMethod('INSTANT_PAID');
      fetchMyLoans();
    } catch (error) {
      console.error('Error requesting loan:', error);
      toast.error(error.response?.data?.error || 'Failed to submit loan request');
    } finally {
      setLoading(false);
    }
  };

  const handleDisburse = async (loanId, staffName, amount) => {
    if (!confirm(`Confirm disbursement of ${amount.toLocaleString()} ETB to ${staffName}?`)) {
      return;
    }

    try {
      setDisbursing(loanId);
      await api.post(`/loans/disburse/${loanId}`);
      toast.success('Loan disbursed successfully');
      fetchApprovedLoans();
      fetchMyLoans(); // Refresh my loans in case the billing officer also has requests
    } catch (error) {
      console.error('Error disbursing loan:', error);
      toast.error(error.response?.data?.error || 'Failed to disburse loan');
    } finally {
      setDisbursing(null);
    }
  };

  const openSettleModal = (loan) => {
    setSelectedLoanForSettle(loan);
    const balance = getBalance(loan);
    setSettleAmount(balance.toString()); // Pre-fill with full balance
    setShowSettleModal(true);
  };

  const handleSettle = async () => {
    if (!selectedLoanForSettle) return;

    const amount = parseFloat(settleAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const balance = getBalance(selectedLoanForSettle);
    if (amount > balance) {
      toast.error(`Amount cannot exceed remaining balance of ${balance.toFixed(2)} ETB`);
      return;
    }

    try {
      setSettling(selectedLoanForSettle.id);
      await api.post(`/loans/settle/${selectedLoanForSettle.id}`, {
        settledAmount: amount
      });
      toast.success(`Settlement of ${amount.toFixed(2)} ETB recorded. Awaiting billing acceptance.`);
      setShowSettleModal(false);
      setSelectedLoanForSettle(null);
      setSettleAmount('');
      fetchMyLoans();
    } catch (error) {
      console.error('Error settling loan:', error);
      toast.error(error.response?.data?.error || 'Failed to settle loan');
    } finally {
      setSettling(null);
    }
  };

  // Calculate balance owed (approvedAmount if admin approved less, otherwise requestedAmount)
  // Subtract any settled amount
  const getBalance = (loan) => {
    const fullBalance = loan.approvedAmount || loan.requestedAmount;
    const settled = loan.settledAmount || 0;
    return fullBalance - settled;
  };

  // Get remaining balance after settlement acceptance
  const getRemainingBalance = (loan) => {
    const fullBalance = loan.approvedAmount || loan.requestedAmount;
    const accepted = loan.settlementAcceptedAmount || 0;
    return fullBalance - accepted;
  };

  const getSettledAmount = (loan) => {
    return loan.settledAmount || 0;
  };

  const openAcceptModal = (loan) => {
    setSelectedLoanForAccept(loan);
    const settled = getSettledAmount(loan);
    setAcceptAmount(settled.toString());
    setShowAcceptModal(true);
  };

  const handleAcceptSettlement = async () => {
    if (!selectedLoanForAccept) return;

    const amount = parseFloat(acceptAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const settled = getSettledAmount(selectedLoanForAccept);
    if (amount > settled) {
      toast.error(`Accepted amount cannot exceed settled amount of ${settled.toFixed(2)} ETB`);
      return;
    }

    try {
      setAccepting(selectedLoanForAccept.id);
      await api.post(`/loans/accept-settlement/${selectedLoanForAccept.id}`, {
        acceptedAmount: amount
      });
      toast.success(`Settlement of ${amount.toFixed(2)} ETB accepted. Money added to cash session.`);
      setShowAcceptModal(false);
      setSelectedLoanForAccept(null);
      setAcceptAmount('');
      fetchSettledLoans();
    } catch (error) {
      console.error('Error accepting settlement:', error);
      toast.error(error.response?.data?.error || 'Failed to accept settlement');
    } finally {
      setAccepting(null);
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

  const getStatusBadge = (status) => {
    const statusConfig = {
      PENDING: { icon: Clock, color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      APPROVED: { icon: CheckCircle, color: 'bg-blue-100 text-blue-800', label: 'Approved' },
      DENIED: { icon: XCircle, color: 'bg-red-100 text-red-800', label: 'Denied' },
      GIVEN: { icon: DollarSign, color: 'bg-green-100 text-green-800', label: 'Disbursed' },
      SETTLED: { icon: Clock, color: 'bg-orange-100 text-orange-800', label: 'Settled (Awaiting Acceptance)' },
      SETTLEMENT_ACCEPTED: { icon: CheckCircle, color: 'bg-green-100 text-green-800', label: 'Settlement Accepted' },
      REPAID: { icon: CheckCircle, color: 'bg-purple-100 text-purple-800', label: 'Repaid' }
    };

    const config = statusConfig[status] || statusConfig.PENDING;
    const Icon = config.icon;

    return (
      <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${config.color}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    );
  };

  const isBillingOfficer = user?.role === 'BILLING_OFFICER';

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Loans Management</h1>

        {/* Tabs */}
        <div className="flex gap-2 border-b mb-6">
          <button
            onClick={() => setActiveTab('request')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'request'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="inline h-4 w-4 mr-2" />
            Request Loan
          </button>
          {isBillingOfficer && (
            <>
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
            </>
          )}
        </div>

        {/* Request Loan Tab */}
        {activeTab === 'request' && (
          <div className="space-y-6">
            {/* Request Form */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Submit Loan Request</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                    Amount (ETB) *
                  </label>
                  <input
                    type="number"
                    id="amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter amount"
                    required
                    min="1"
                    step="0.01"
                  />
                </div>
                <div>
                  <label htmlFor="settlementMethod" className="block text-sm font-medium text-gray-700 mb-2">
                    Settlement Method
                  </label>
                  <select
                    id="settlementMethod"
                    name="settlementMethod"
                    value={settlementMethod || 'INSTANT_PAID'}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      console.log('Settlement method changed to:', newValue);
                      setSettlementMethod(newValue);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="INSTANT_PAID">Instant Paid (Pay directly when settling)</option>
                    <option value="FROM_PAYROLL">From Payroll (Deduct from salary)</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    {settlementMethod === 'INSTANT_PAID' 
                      ? 'You will pay the loan amount directly when you settle it'
                      : 'The loan amount will be deducted from your salary during payroll processing'}
                  </p>
                </div>
                <div>
                  <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                    Reason (Optional)
                  </label>
                  <textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Provide a reason for the loan request"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit Request'}
                </button>
              </form>
            </div>

            {/* My Loans */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">My Loan Requests</h2>
              {loadingLoans ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                </div>
              ) : myLoans.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No loan requests yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Balance Owed
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Settlement Method
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Requested
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {myLoans.map((loan) => {
                        const balance = getBalance(loan);
                        // Allow settling if: GIVEN or SETTLED status, and (INSTANT_PAID method OR no method set for legacy loans), and balance > 0
                        const canSettle = (loan.status === 'GIVEN' || loan.status === 'SETTLED') && 
                                         (loan.settlementMethod === 'INSTANT_PAID' || !loan.settlementMethod) && 
                                         balance > 0;
                        const isSettled = loan.status === 'SETTLED' || loan.status === 'SETTLEMENT_ACCEPTED';
                        return (
                          <tr 
                            key={loan.id}
                            className={`${canSettle ? 'cursor-pointer hover:bg-blue-50 transition-colors' : ''} ${isSettled ? 'opacity-75' : ''}`}
                            onClick={canSettle ? (e) => {
                              e.preventDefault();
                              openSettleModal(loan);
                            } : undefined}
                            title={canSettle ? 'Click to settle this loan' : ''}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {formatCurrency(loan.requestedAmount)}
                                </div>
                                {loan.approvedAmount && loan.approvedAmount !== loan.requestedAmount && (
                                  <div className="text-sm text-blue-600">
                                    Approved: {formatCurrency(loan.approvedAmount)}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-semibold text-gray-900">
                                {formatCurrency(balance)}
                              </div>
                              {loan.settledAmount > 0 && (
                                <div className="text-xs text-blue-600 mt-1">
                                  Settled: {formatCurrency(loan.settledAmount)}
                                </div>
                              )}
                              {loan.settlementAcceptedAmount > 0 && (
                                <div className="text-xs text-green-600 mt-1">
                                  Accepted: {formatCurrency(loan.settlementAcceptedAmount)}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                (loan.settlementMethod === 'INSTANT_PAID' || !loan.settlementMethod) 
                                  ? 'bg-blue-100 text-blue-700' 
                                  : 'bg-purple-100 text-purple-700'
                              }`}>
                                {(loan.settlementMethod === 'INSTANT_PAID' || !loan.settlementMethod) ? 'Instant Paid' : 'From Payroll'}
                              </span>
                              {!loan.settlementMethod && (
                                <span className="text-xs text-red-500 ml-1">(Legacy - no method set)</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(loan.requestedAt)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getStatusBadge(loan.status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {canSettle && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openSettleModal(loan);
                                  }}
                                  disabled={settling === loan.id}
                                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                                  title="Click to settle this loan"
                                >
                                  {settling === loan.id ? 'Settling...' : (loan.settledAmount > 0 ? 'Settle More' : 'Settle')}
                                </button>
                              )}
                              {!canSettle && loan.status === 'GIVEN' && loan.settlementMethod === 'FROM_PAYROLL' && (
                                <span className="text-xs text-gray-500">Payroll deduction</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Disbursement Tab */}
        {activeTab === 'disbursement' && isBillingOfficer && (
          <div className="bg-white rounded-lg shadow-md p-6">
            {loadingApproved ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            ) : approvedLoans.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 mx-auto text-green-400 mb-4" />
                <p className="text-gray-600 text-lg">No loans awaiting disbursement</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {approvedLoans.map((loan) => (
                  <div key={loan.id} className="border rounded-lg p-6">
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
                        onClick={() => handleDisburse(loan.id, loan.staff.fullname, loan.approvedAmount)}
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
          </div>
        )}

        {/* Settlements Tab */}
        {activeTab === 'settlements' && isBillingOfficer && (
          <div className="bg-white rounded-lg shadow-md p-4">
            {loadingSettled ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            ) : settledLoans.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle className="h-12 w-12 mx-auto text-green-400 mb-3" />
                <p className="text-gray-600">No settled loans awaiting acceptance</p>
                <p className="text-xs text-gray-500 mt-1">When staff settle their loans, they will appear here for you to accept.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {settledLoans.map((loan) => {
                  const balance = getBalance(loan);
                  const settled = getSettledAmount(loan);
                  const remaining = balance - settled;
                  return (
                    <div key={loan.id} className="border rounded-lg p-4 border-l-4 border-orange-500">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            <h3 className="text-base font-semibold text-gray-900">{loan.staff.fullname}</h3>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                              {loan.staff.role}
                            </span>
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                              Awaiting Acceptance
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Full Balance</p>
                              <p className="text-sm font-semibold text-gray-900">{formatCurrency(balance)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Settled Amount</p>
                              <p className="text-base font-bold text-blue-600">{formatCurrency(settled)}</p>
                              {remaining > 0 && (
                                <p className="text-xs text-gray-500 mt-0.5">Remaining: {formatCurrency(remaining)}</p>
                              )}
                            </div>
                            {loan.settlementAcceptedAmount > 0 && (
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Previously Accepted</p>
                                <p className="text-sm font-semibold text-green-600">{formatCurrency(loan.settlementAcceptedAmount)}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Settled On</p>
                              <p className="text-xs text-gray-900">{formatDate(loan.settledAt)}</p>
                              {loan.settledBy && (
                                <p className="text-xs text-gray-500 mt-0.5">By {loan.settledBy.fullname}</p>
                              )}
                            </div>
                          </div>
                          {loan.reason && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                              <span className="font-medium">Reason:</span> {loan.reason}
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          <button
                            onClick={() => openAcceptModal(loan)}
                            disabled={accepting === loan.id}
                            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm font-semibold whitespace-nowrap"
                          >
                            <CheckCircle className="h-4 w-4" />
                            {accepting === loan.id ? 'Accepting...' : 'Accept'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Settle Modal */}
        {showSettleModal && selectedLoanForSettle && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Settle Loan</h2>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Full Balance:</p>
                  <p className="text-lg font-semibold text-gray-900">{formatCurrency((selectedLoanForSettle.approvedAmount || selectedLoanForSettle.requestedAmount))}</p>
                  {selectedLoanForSettle.settledAmount > 0 && (
                    <>
                      <p className="text-sm text-gray-600 mt-2 mb-1">Already Settled:</p>
                      <p className="text-sm font-semibold text-blue-600">{formatCurrency(selectedLoanForSettle.settledAmount)}</p>
                    </>
                  )}
                  <p className="text-sm text-gray-600 mt-2 mb-1">Remaining Balance:</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(getBalance(selectedLoanForSettle))}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount to Settle (ETB)
                  </label>
                  <input
                    type="number"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder={getBalance(selectedLoanForSettle).toString()}
                    min="0"
                    max={getBalance(selectedLoanForSettle)}
                    step="0.01"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    You can settle the full amount or a partial amount. Maximum: {formatCurrency(getBalance(selectedLoanForSettle))}
                  </p>
                </div>
                <p className="text-sm text-gray-600">
                  This will notify the billing department that you have paid. They will verify and accept the payment.
                </p>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowSettleModal(false);
                    setSelectedLoanForSettle(null);
                    setSettleAmount('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSettle}
                  disabled={settling === selectedLoanForSettle.id || !settleAmount || parseFloat(settleAmount) <= 0}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {settling === selectedLoanForSettle.id ? 'Settling...' : 'Confirm Settle'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Accept Settlement Modal */}
        {showAcceptModal && selectedLoanForAccept && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Accept Settlement</h2>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Staff Member:</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedLoanForAccept.staff.fullname}</p>
                  <p className="text-sm text-gray-500">{selectedLoanForAccept.staff.role}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Settled Amount:</p>
                  <p className="text-lg font-semibold text-blue-600">{formatCurrency(getSettledAmount(selectedLoanForAccept))}</p>
                  {selectedLoanForAccept.settlementAcceptedAmount > 0 && (
                    <>
                      <p className="text-sm text-gray-600 mt-2 mb-1">Previously Accepted:</p>
                      <p className="text-sm font-semibold text-green-600">{formatCurrency(selectedLoanForAccept.settlementAcceptedAmount)}</p>
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
                    placeholder={getSettledAmount(selectedLoanForAccept).toString()}
                    min="0"
                    max={getSettledAmount(selectedLoanForAccept)}
                    step="0.01"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the amount you actually received. Maximum: {formatCurrency(getSettledAmount(selectedLoanForAccept))}
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
                    setSelectedLoanForAccept(null);
                    setAcceptAmount('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAcceptSettlement}
                  disabled={accepting === selectedLoanForAccept.id || !acceptAmount || parseFloat(acceptAmount) <= 0}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {accepting === selectedLoanForAccept.id ? 'Accepting...' : 'Accept Payment'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Loans;
