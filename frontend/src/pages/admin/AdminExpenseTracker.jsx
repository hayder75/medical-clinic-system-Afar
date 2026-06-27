import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  Calendar, DollarSign, Landmark, TrendingUp, TrendingDown,
  User, FileText, RefreshCw, AlertTriangle, ArrowUpRight,
  Package, Wrench, HeartPulse, Receipt, Layers
} from 'lucide-react';
import api from '../../services/api';

const CATEGORY_ICONS = {
  OFFICE_SUPPLIES: FileText,
  MEDICAL_SUPPLIES: Package,
  MAINTENANCE: Wrench,
  UTILITIES: Receipt,
  FOOD_BEVERAGE: HeartPulse,
  TRANSPORTATION: TrendingUp,
  STAFF_LOAN: User,
  RETURNED_TO_PATIENT: ArrowUpRight,
  WRONG_TRANSACTION: AlertTriangle,
  OTHER: Layers
};

const CATEGORY_COLORS = {
  OFFICE_SUPPLIES: 'bg-blue-100 text-blue-800',
  MEDICAL_SUPPLIES: 'bg-green-100 text-green-800',
  MAINTENANCE: 'bg-yellow-100 text-yellow-800',
  UTILITIES: 'bg-purple-100 text-purple-800',
  FOOD_BEVERAGE: 'bg-pink-100 text-pink-800',
  TRANSPORTATION: 'bg-indigo-100 text-indigo-800',
  STAFF_LOAN: 'bg-orange-100 text-orange-800',
  RETURNED_TO_PATIENT: 'bg-red-100 text-red-800',
  WRONG_TRANSACTION: 'bg-rose-100 text-rose-800',
  OTHER: 'bg-gray-100 text-gray-800'
};

const DEPOSIT_STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  VERIFIED: 'bg-green-100 text-green-800'
};

const formatCurrency = (amount) => `ETB ${Number(amount || 0).toLocaleString()}`;

const getLocalDateString = (date) => {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' });
};

const AdminExpenseTracker = () => {
  const getLocalDate = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  };
  const [selectedDate, setSelectedDate] = useState(getLocalDate());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expenseFilter, setExpenseFilter] = useState('ALL');
  const [depositFilter, setDepositFilter] = useState('ALL');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/cash-management/daily-expenses', {
        params: { date: selectedDate }
      });
      setData(res.data);
    } catch (e) {
      console.error(e);
      toast.error('Failed to fetch expense data');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const today = getLocalDate();

  const filteredExpenses = data?.expenses?.filter(e =>
    expenseFilter === 'ALL' || e.category === expenseFilter
  ) || [];

  const filteredDeposits = data?.bankDeposits?.filter(d =>
    depositFilter === 'ALL' || d.status === depositFilter
  ) || [];

  return (
    <div className="space-y-6">
      {/* Header with Date Picker */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expense & Bank Deposit Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor daily cash outflows and bank deposits</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={e => setSelectedDate(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <button onClick={fetchData} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition">
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Expenses</p>
                <p className="text-2xl font-bold text-rose-600 mt-1">{formatCurrency(data.totals.totalExpenses)}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-rose-100 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-rose-600" />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">{data.expenses.length} transactions on {getLocalDateString(selectedDate)}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Bank Deposits</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(data.totals.totalDeposits)}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Landmark className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">{data.bankDeposits.length} deposits on {getLocalDateString(selectedDate)}</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Net Position</p>
                <p className={`text-2xl font-bold mt-1 ${data.totals.net >= 0 ? 'text-green-600' : 'text-rose-600'}`}>
                  {formatCurrency(Math.abs(data.totals.net))}
                  <span className="text-sm ml-1">{data.totals.net >= 0 ? 'surplus' : 'deficit'}</span>
                </p>
              </div>
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${data.totals.net >= 0 ? 'bg-green-100' : 'bg-rose-100'}`}>
                {data.totals.net >= 0
                  ? <TrendingUp className="h-6 w-6 text-green-600" />
                  : <TrendingDown className="h-6 w-6 text-rose-600" />
                }
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expenses Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Expenses</h2>
              <p className="text-xs text-gray-400">{filteredExpenses.length} records</p>
            </div>
            <select
              value={expenseFilter}
              onChange={e => setExpenseFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:ring-2 focus:ring-indigo-400"
            >
              <option value="ALL">All Categories</option>
              {Object.keys(CATEGORY_ICONS).map(key => (
                <option key={key} value={key}>{key.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading...</div>
            ) : filteredExpenses.length === 0 ? (
              <div className="p-8 text-center">
                <DollarSign className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">No expenses recorded for this date</p>
              </div>
            ) : (
              filteredExpenses.map(expense => {
                const Icon = CATEGORY_ICONS[expense.category] || Layers;
                const colorClass = CATEGORY_COLORS[expense.category] || 'bg-gray-100 text-gray-800';
                return (
                  <div key={expense.id} className="px-5 py-3.5 hover:bg-gray-50 transition">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${colorClass}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{expense.description}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
                              {expense.category.replace(/_/g, ' ')}
                            </span>

                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {expense.recordedBy}
                            </span>
                            <span>{new Date(expense.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                            {expense.vendor && <span className="text-gray-300">| {expense.vendor}</span>}
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-rose-600 whitespace-nowrap ml-3">
                        {formatCurrency(expense.amount)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Bank Deposits Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Bank Deposits</h2>
              <p className="text-xs text-gray-400">{filteredDeposits.length} records</p>
            </div>
            <select
              value={depositFilter}
              onChange={e => setDepositFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:ring-2 focus:ring-indigo-400"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="VERIFIED">Verified</option>
            </select>
          </div>

          <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading...</div>
            ) : filteredDeposits.length === 0 ? (
              <div className="p-8 text-center">
                <Landmark className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">No bank deposits recorded for this date</p>
              </div>
            ) : (
              filteredDeposits.map(deposit => (
                <div key={deposit.id} className="px-5 py-3.5 hover:bg-gray-50 transition">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Landmark className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{deposit.bankName}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {deposit.accountNumber && (
                              <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                                Acct: {deposit.accountNumber}
                              </span>
                            )}
                            {deposit.transactionNumber && (
                              <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                                Ref: {deposit.transactionNumber}
                              </span>
                            )}
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${DEPOSIT_STATUS_COLORS[deposit.status] || 'bg-gray-100 text-gray-800'}`}>
                              {deposit.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {deposit.recordedBy}
                            </span>
                            <span>{new Date(deposit.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                            {deposit.notes && <span className="text-gray-300">| {deposit.notes}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <span className="text-sm font-semibold text-blue-600 whitespace-nowrap">
                          {formatCurrency(deposit.amount)}
                        </span>
                        {deposit.status === 'PENDING' && (
                          <button
                            onClick={async () => {
                              try {
                                await api.put(`/cash-management/deposit/${deposit.id}/status`, { status: 'CONFIRMED' });
                                toast.success('Deposit accepted');
                                fetchData();
                              } catch (e) {
                                toast.error(e.response?.data?.error || 'Failed to accept deposit');
                              }
                            }}
                            className="px-3 py-1 text-xs font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                          >
                            Accept
                          </button>
                        )}
                      </div>
                    </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminExpenseTracker;
