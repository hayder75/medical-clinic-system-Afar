import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import PharmacyInvoices from '../../components/billing/PharmacyInvoices';
import { 
  Pill, 
  CreditCard, 
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Calendar,
  RefreshCw,
  Package,
  AlertCircle
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const PharmacyBillingDashboard = () => {
  const [stats, setStats] = useState({
    totalCollected: 0,
    totalTransactions: 0,
    pendingBillings: 0,
    pendingAmount: 0,
    byType: {
      CASH: { count: 0, amount: 0 },
      BANK: { count: 0, amount: 0 },
      INSURANCE: { count: 0, amount: 0 },
      CHARITY: { count: 0, amount: 0 }
    }
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [lowStockMedications, setLowStockMedications] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('daily');
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ start: null, end: null });

  useEffect(() => {
    fetchDashboardStats();
  }, [selectedPeriod]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/pharmacy-billing/dashboard?period=${selectedPeriod}`);
      const data = response.data;
      
      setStats(data.stats);
      setRecentTransactions(data.recentTransactions || []);
      setLowStockMedications(data.lowStockMedications || []);
      setDateRange(data.dateRange);
    } catch (error) {
      console.error('Error fetching pharmacy dashboard stats:', error);
      toast.error('Failed to fetch pharmacy dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `ETB ${amount.toLocaleString()}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getPaymentTypeColor = (type) => {
    const colors = {
      CASH: 'text-green-600 bg-green-100',
      BANK: 'text-blue-600 bg-blue-100',
      INSURANCE: 'text-purple-600 bg-purple-100',
      CHARITY: 'text-pink-600 bg-pink-100'
    };
    return colors[type] || 'text-gray-600 bg-gray-100';
  };

  const getPaymentTypeIcon = (type) => {
    const icons = {
      CASH: '💰',
      BANK: '🏦',
      INSURANCE: '🛡️',
      CHARITY: '❤️'
    };
    return icons[type] || '💳';
  };

  const getPeriodLabel = (period) => {
    const labels = {
      daily: 'Today',
      weekly: 'This Week',
      monthly: 'This Month',
      yearly: 'This Year'
    };
    return labels[period] || 'Today';
  };

  const statCards = [
    {
      title: 'Total Collected',
      value: formatCurrency(stats.totalCollected),
      icon: DollarSign,
      color: 'bg-green-500',
      description: `${stats.totalTransactions} payments ${getPeriodLabel(selectedPeriod).toLowerCase()}`
    },
    {
      title: 'Pending Billings',
      value: stats.pendingBillings,
      icon: Clock,
      color: 'bg-yellow-500',
      description: 'Unpaid invoices'
    },
    {
      title: 'Pending Amount',
      value: formatCurrency(stats.pendingAmount),
      icon: AlertTriangle,
      color: 'bg-red-500',
      description: 'Outstanding amount'
    },
    {
      title: 'Low Stock Items',
      value: lowStockMedications.length,
      icon: AlertCircle,
      color: 'bg-orange-500',
      description: 'Medications needing restock'
    }
  ];

  const DashboardOverview = () => (
    <div className="space-y-6">
      {/* Header with Period Selection */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pharmacy Billing Dashboard</h1>
          <p className="text-gray-600">
            {dateRange.start && dateRange.end ? (
              <>
                {new Date(dateRange.start).toLocaleDateString()} - {new Date(dateRange.end).toLocaleDateString()}
              </>
            ) : (
              getPeriodLabel(selectedPeriod)
            )}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <button
            onClick={fetchDashboardStats}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className={`p-3 rounded-full ${card.color}`}>
                <card.icon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="text-2xl font-semibold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500">{card.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Payment Breakdown */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Breakdown</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(stats.byType).map(([type, data]) => {
            const percentage = stats.totalCollected > 0 ? (data.amount / stats.totalCollected * 100).toFixed(1) : 0;
            return (
              <div key={type} className="text-center p-4 border border-gray-200 rounded-lg">
                <div className="text-2xl mb-2">{getPaymentTypeIcon(type)}</div>
                <div className="text-sm font-medium text-gray-600">{type}</div>
                <div className="text-lg font-semibold text-gray-900">{data.count} transactions</div>
                <div className="text-sm text-gray-500">{formatCurrency(data.amount)}</div>
                <div className="text-xs text-gray-400">{percentage}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h2>
        {recentTransactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {transaction.patientName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(transaction.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentTypeColor(transaction.paymentType)}`}>
                        {transaction.paymentType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(transaction.processedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No recent transactions found</p>
          </div>
        )}
      </div>

      {/* Low Stock Medications */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Low Stock Medications</h2>
        {lowStockMedications.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medication</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Available</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Minimum</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {lowStockMedications.map((medication) => (
                  <tr key={medication.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{medication.name}</div>
                      <div className="text-sm text-gray-500">{medication.genericName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {medication.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {medication.availableQuantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {medication.minimumStock}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        medication.availableQuantity <= 0 
                          ? 'text-red-800 bg-red-100' 
                          : medication.availableQuantity <= medication.minimumStock 
                            ? 'text-orange-800 bg-orange-100' 
                            : 'text-green-800 bg-green-100'
                      }`}>
                        {medication.availableQuantity <= 0 ? 'Out of Stock' : 'Low Stock'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>All medications are well stocked</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Routes>
      <Route path="/" element={<DashboardOverview />} />
      <Route path="/invoices" element={<PharmacyInvoices />} />
    </Routes>
  );
};

export default PharmacyBillingDashboard;
