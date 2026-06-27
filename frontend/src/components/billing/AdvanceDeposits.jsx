import React, { useState, useEffect } from 'react';
import { DollarSign, CheckCircle, Wallet, Search, Plus, Clock, XCircle, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import BankMethodSelect from '../common/BankMethodSelect';

const AdvanceDeposits = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [acceptForm, setAcceptForm] = useState({
    amount: '',
    paymentMethod: 'CASH',
    bankName: '',
    transNumber: '',
    notes: ''
  });
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    fetchAdvanceAccounts();
  }, []);

  const fetchAdvanceAccounts = async () => {
    try {
      setLoading(true);
      const [accountsResponse, requestsResponse] = await Promise.all([
        api.get('/accounts?type=ADVANCE'),
        api.get('/accounts/requests?status=PENDING').catch(() => ({ data: { requests: [] } }))
      ]);

      // Only show verified advance accounts
      const verifiedAccounts = (accountsResponse.data.accounts || []).filter(
        acc => acc.status === 'VERIFIED' && ['ADVANCE', 'BOTH'].includes(acc.accountType)
      );
      const pendingDepositRequests = (requestsResponse.data.requests || []).filter(
        request => request.requestType === 'ADD_DEPOSIT'
      );

      setAccounts(verifiedAccounts);
      setPendingRequests(pendingDepositRequests);
      window.dispatchEvent(new CustomEvent('advance-requests-updated', {
        detail: { count: pendingDepositRequests.length }
      }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('advance-requests-updated', {
        detail: { count: 0 }
      }));
      toast.error('Failed to fetch advance accounts');
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const openAcceptModal = (account, request = null) => {
    setSelectedAccount(account);
    setSelectedRequest(request);
    setAcceptForm({
      amount: request?.amount ? String(request.amount) : '',
      paymentMethod: request?.paymentMethod || 'CASH',
      bankName: request?.bankName || '',
      transNumber: request?.transNumber || '',
      notes: request?.notes || ''
    });
    setShowAcceptModal(true);
  };

  const handleRejectPendingRequest = async (requestId) => {
    const reason = window.prompt('Enter a reason for rejecting this pending advance deposit:', 'Rejected by billing');
    if (reason === null) return;

    try {
      await api.post(`/accounts/requests/${requestId}/reject`, {
        reason: reason.trim() || 'Rejected by billing'
      });
      toast.success('Pending deposit request rejected');
      fetchAdvanceAccounts();
    } catch (error) {
      console.error('Error rejecting pending deposit:', error);
      toast.error(error.response?.data?.error || 'Failed to reject pending deposit');
    }
  };

  const handleAcceptDeposit = async (e) => {
    e.preventDefault();

    if (!selectedAccount) return;

    const amount = parseFloat(acceptForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      setAccepting(true);

      if (selectedRequest?.id) {
        const response = await api.post(`/accounts/requests/${selectedRequest.id}/approve`, {
          paymentMethod: acceptForm.paymentMethod,
          bankName: acceptForm.bankName || undefined,
          transNumber: acceptForm.transNumber || undefined,
          notes: acceptForm.notes || 'Deposit accepted by billing'
        });
        toast.success(response.data?.message || `Pending deposit of ${amount.toFixed(2)} ETB accepted. Money added to daily cash.`);
      } else {
        const response = await api.post('/accounts/payment', {
          accountId: selectedAccount.id,
          patientId: selectedAccount.patientId,
          amount: amount,
          paymentMethod: acceptForm.paymentMethod,
          bankName: acceptForm.bankName || undefined,
          transNumber: acceptForm.transNumber || undefined,
          notes: acceptForm.notes || 'Deposit accepted by billing'
        });
        toast.success(response.data?.message || `Deposit of ${amount.toFixed(2)} ETB accepted. Money added to daily cash.`);
      }

      setShowAcceptModal(false);
      setSelectedAccount(null);
      setSelectedRequest(null);
      fetchAdvanceAccounts();
    } catch (error) {
      console.error('Error accepting deposit:', error);
      toast.error(error.response?.data?.error || 'Failed to accept deposit');
    } finally {
      setAccepting(false);
    }
  };

  const filteredAccounts = accounts.filter(account =>
    account.patient?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.patient?.mobile?.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Advance Payment Deposits</h2>
          <p className="text-gray-600">Accept deposits from advance payment users</p>
        </div>
        <button
          onClick={() => navigate('/billing/patient-accounts')}
          className="px-4 py-2 rounded-lg text-white font-medium transition flex items-center gap-2"
          style={{ backgroundColor: '#2563EB' }}
        >
          <Plus className="h-4 w-4" />
          Create Advance Account
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by patient name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {pendingRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900">Pending advance deposits waiting for billing acceptance</h3>
              <p className="text-sm text-amber-800">
                These admin-set advance amounts are <strong>not usable yet</strong>. Click <strong>Accept</strong> to add them to the patient balance and daily cash.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {pendingRequests.map((request) => (
              <div key={request.id} className="bg-white border border-amber-200 rounded-lg p-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{request.patient?.name || 'Unknown patient'}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                      Pending ETB {Number(request.amount || 0).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Requested by {request.requestedBy?.fullname || request.requestedBy?.username || 'Admin'}
                    {request.createdAt ? ` • ${new Date(request.createdAt).toLocaleString()}` : ''}
                  </p>
                  {request.notes && (
                    <p className="text-sm text-amber-700 mt-1">{request.notes}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => openAcceptModal({
                      ...(request.account || {}),
                      id: request.accountId,
                      patientId: request.patientId,
                      patient: request.patient,
                      balance: request.account?.balance || 0
                    }, request)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Accept
                  </button>
                  <button
                    onClick={() => handleRejectPendingRequest(request.id)}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-2"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accounts Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Patient Name</th>
                <th>Phone</th>
                <th>Current Balance</th>
                <th>Total Deposited</th>
                <th>Total Used</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">
                    No advance payment accounts found
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((account) => (
                  <tr key={account.id}>
                    <td className="font-medium">{account.patient?.name || 'N/A'}</td>
                    <td>{account.patient?.mobile || 'N/A'}</td>
                    <td>
                      <span className="font-semibold text-green-600">
                        ETB {account.balance.toFixed(2)}
                      </span>
                    </td>
                    <td>ETB {account.totalDeposited.toFixed(2)}</td>
                    <td>ETB {account.totalUsed.toFixed(2)}</td>
                    <td>
                      <button
                        onClick={() => openAcceptModal(account)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Accept Deposit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Accept Deposit Modal */}
      {showAcceptModal && selectedAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  {selectedRequest ? 'Accept Pending Advance Deposit' : 'Accept Deposit'}
                </h3>
                <button
                  onClick={() => {
                    setShowAcceptModal(false);
                    setSelectedAccount(null);
                    setSelectedRequest(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>

              <div className={`mb-4 p-3 rounded-lg ${selectedRequest ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
                <p className="text-sm text-gray-600">Patient: {selectedAccount.patient?.name}</p>
                <p className="text-sm text-gray-600">Current Balance: ETB {selectedAccount.balance.toFixed(2)}</p>
                {selectedRequest && (
                  <>
                    <p className="text-sm font-medium text-amber-700 mt-1">
                      Pending admin-set amount: ETB {Number(selectedRequest.amount || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      This money is not usable until you accept it here and add it to daily cash.
                    </p>
                  </>
                )}
              </div>

              <form onSubmit={handleAcceptDeposit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {selectedRequest ? 'Pending Amount (ETB)' : 'Deposit Amount (ETB) *'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={acceptForm.amount}
                    onChange={(e) => setAcceptForm({ ...acceptForm, amount: e.target.value })}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 ${selectedRequest ? 'bg-gray-100 text-gray-600' : ''}`}
                    required
                    readOnly={Boolean(selectedRequest)}
                  />
                  {selectedRequest && (
                    <p className="text-xs text-amber-700 mt-1">
                      This amount came from the admin request and will be added only after acceptance.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method *
                  </label>
                  <select
                    value={acceptForm.paymentMethod}
                    onChange={(e) => setAcceptForm({ ...acceptForm, paymentMethod: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank Transfer</option>
                  </select>
                </div>

                {acceptForm.paymentMethod === 'BANK' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bank Name
                      </label>
                      <BankMethodSelect
                        value={acceptForm.bankName}
                        onChange={(e) => setAcceptForm({ ...acceptForm, bankName: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Transaction Number
                      </label>
                      <input
                        type="text"
                        value={acceptForm.transNumber}
                        onChange={(e) => setAcceptForm({ ...acceptForm, transNumber: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={acceptForm.notes}
                    onChange={(e) => setAcceptForm({ ...acceptForm, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    rows="3"
                  />
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAcceptModal(false);
                      setSelectedAccount(null);
                      setSelectedRequest(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={accepting}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {accepting ? 'Accepting...' : 'Accept Deposit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvanceDeposits;

