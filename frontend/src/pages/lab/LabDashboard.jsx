import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TestTube, Clock, CheckCircle, AlertTriangle, FileText, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const LabDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    inProgress: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/labs/orders', { params: { status: 'ALL' } });
      
      // Get all lab orders from different sources
      const batchOrders = response.data.batchOrders || [];
      const walkInOrders = response.data.walkInOrders || [];
      const labTestOrders = response.data.labTestOrders || [];
      
      // Count batch orders and walk-ins as 1 order each
      // For lab tests, only count orphans without a parent batchOrder (they are standalone orders)
      // Lab tests linked to a batchOrder are sub-items, not separate orders
      const orphanTests = labTestOrders.filter(o => !o.batchOrderId);
      const allOrders = [
        ...batchOrders,
        ...walkInOrders,
        ...orphanTests
      ];
      
      const stats = {
        total: allOrders.length,
        pending: allOrders.filter(order => order.status === 'QUEUED' || order.status === 'UNPAID' || order.status === 'PAID').length,
        completed: allOrders.filter(order => order.status === 'COMPLETED' || order.status === 'VERIFIED').length,
        inProgress: allOrders.filter(order => order.status === 'IN_PROGRESS').length
      };
      
      setStats(stats);
    } catch (error) {
      console.error('Error fetching lab stats:', error);
      toast.error('Failed to fetch lab statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchStats();
    toast.success('Lab statistics refreshed');
  };

  const handleNavigateToOrders = () => {
    navigate('/lab/orders');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Lab Dashboard</h1>
            <p className="text-gray-600 mt-2">Laboratory test processing and result management</p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <TestTube className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
              <Clock className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-orange-100 text-orange-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleNavigateToOrders}
            className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <FileText className="w-5 h-5" />
            View Lab Orders
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-700">{stats.pending}</p>
            <p className="text-sm text-blue-600">Awaiting Processing</p>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <p className="text-2xl font-bold text-orange-700">{stats.inProgress}</p>
            <p className="text-sm text-orange-600">In Progress</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-700">{stats.completed}</p>
            <p className="text-sm text-green-600">Completed</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LabDashboard;




