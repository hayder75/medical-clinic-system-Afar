import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { DollarSign, CheckCircle, User, Clock } from 'lucide-react';

const PayrollLoanSettlement = () => {
  const [payrollLoans, setPayrollLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(null);

  useEffect(() => {
    fetchPayrollLoans();
    // Refresh every 30 seconds
    const interval = setInterval(fetchPayrollLoans, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPayrollLoans = async () => {
    try {
      setLoading(true);
      const response = await api.get('/loans/payroll');
      setPayrollLoans(response.data.payrollLoans || []);
    } catch (error) {
      console.error('Error fetching payroll loans:', error);
      toast.error('Failed to fetch payroll loans');
    } finally {
      setLoading(false);
    }
  };

  const handleSettleFromPayroll = async (loanId, staffName, amount) => {
    if (!confirm(`Confirm settlement of ${amount.toLocaleString()} ETB from ${staffName}'s payroll? This will mark the loan as settled.`)) {
      return;
    }

    try {
      setSettling(loanId);
      await api.post(`/loans/settle-payroll/${loanId}`);
      toast.success('Loan settled from payroll successfully');
      fetchPayrollLoans();
    } catch (error) {
      console.error('Error settling loan from payroll:', error);
      toast.error(error.response?.data?.error || 'Failed to settle loan from payroll');
    } finally {
      setSettling(null);
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

  // Calculate total amount owed
  const totalOwed = payrollLoans.reduce((sum, loan) => sum + getBalance(loan), 0);

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading payroll loans...</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Payroll Loan Settlement</h1>
            <p className="text-gray-600 mt-1">Settle loans that are set to be deducted from payroll</p>
          </div>
          <div className="flex items-center gap-4">
            {payrollLoans.length > 0 && (
              <div className="px-4 py-2 bg-blue-100 rounded-lg">
                <p className="text-sm text-gray-600">Total Owed</p>
                <p className="text-xl font-bold text-blue-700">{formatCurrency(totalOwed)}</p>
              </div>
            )}
            <button
              onClick={fetchPayrollLoans}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {payrollLoans.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-400 mb-4" />
            <p className="text-gray-600 text-lg">No loans set for payroll settlement</p>
            <p className="text-gray-500 text-sm mt-2">Loans with "From Payroll" settlement method will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <p className="text-sm text-blue-800">
                  <strong>{payrollLoans.length}</strong> staff member{payrollLoans.length !== 1 ? 's' : ''} have loans to be settled from payroll
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              {payrollLoans.map((loan) => {
                const balance = getBalance(loan);
                return (
                  <div key={loan.id} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <User className="h-6 w-6 text-purple-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{loan.staff.fullname}</h3>
                            <p className="text-sm text-gray-500">{loan.staff.role}</p>
                          </div>
                          <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                            From Payroll
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
                            <p className="text-sm text-gray-500">Disbursed On</p>
                            <p className="text-sm text-gray-900">{formatDate(loan.givenAt)}</p>
                            {loan.givenBy && (
                              <p className="text-xs text-gray-500">By {loan.givenBy.fullname}</p>
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
                          onClick={() => handleSettleFromPayroll(loan.id, loan.staff.fullname, balance)}
                          disabled={settling === loan.id}
                          className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 font-semibold"
                        >
                          <CheckCircle className="h-5 w-5" />
                          {settling === loan.id ? 'Settling...' : 'Mark as Settled'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PayrollLoanSettlement;

