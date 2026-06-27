import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { CheckCircle, Clock, User, DollarSign } from 'lucide-react';

const LoanSettlement = () => {
  const [settledLoans, setSettledLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(null);

  useEffect(() => {
    fetchSettledLoans();
    // Refresh every 30 seconds
    const interval = setInterval(fetchSettledLoans, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchSettledLoans = async () => {
    try {
      setLoading(true);
      const response = await api.get('/loans/settled');
      setSettledLoans(response.data.settledLoans || []);
    } catch (error) {
      console.error('Error fetching settled loans:', error);
      toast.error('Failed to fetch settled loans');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptSettlement = async (loanId, staffName, amount) => {
    if (!confirm(`Confirm that you have received ${amount.toLocaleString()} ETB from ${staffName}?`)) {
      return;
    }

    try {
      setAccepting(loanId);
      await api.post(`/loans/accept-settlement/${loanId}`);
      toast.success('Settlement accepted successfully');
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

  const getBalance = (loan) => {
    return loan.approvedAmount || loan.requestedAmount;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading settled loans...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Loan Settlements</h1>
            <p className="text-gray-600 mt-1">Accept payments from staff who have settled their loans</p>
          </div>
          <button
            onClick={fetchSettledLoans}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>

        {settledLoans.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-400 mb-4" />
            <p className="text-gray-600 text-lg">No settled loans awaiting acceptance</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {settledLoans.map((loan) => {
              const balance = getBalance(loan);
              return (
                <div key={loan.id} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-500">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <User className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{loan.staff.fullname}</h3>
                          <p className="text-sm text-gray-500">{loan.staff.role}</p>
                        </div>
                        <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                          Awaiting Acceptance
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-500">Amount Owed</p>
                          <p className="text-xl font-bold text-gray-900">{formatCurrency(balance)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Requested Amount</p>
                          <p className="text-lg font-semibold text-gray-700">{formatCurrency(loan.requestedAmount)}</p>
                        </div>
                        {loan.approvedAmount && loan.approvedAmount !== loan.requestedAmount && (
                          <div>
                            <p className="text-sm text-gray-500">Approved Amount</p>
                            <p className="text-lg font-semibold text-blue-600">{formatCurrency(loan.approvedAmount)}</p>
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
                        onClick={() => handleAcceptSettlement(loan.id, loan.staff.fullname, balance)}
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
      </div>
    </div>
  );
};

export default LoanSettlement;

