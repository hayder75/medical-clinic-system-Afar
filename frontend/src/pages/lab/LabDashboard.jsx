import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TestTube, Clock, CheckCircle, AlertTriangle, FileText, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const SkeletonCard = () => (
  <div className="bg-white rounded-lg shadow p-6 animate-pulse">
    <div className="flex items-center">
      <div className="w-12 h-12 rounded-full bg-slate-200" />
      <div className="ml-4 flex-1 space-y-2">
        <div className="h-3 bg-slate-200 rounded w-20" />
        <div className="h-6 bg-slate-200 rounded w-12" />
      </div>
    </div>
  </div>
);

const StatCard = ({ icon: Icon, bgColor, iconColor, label, value }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <div className="flex items-center">
      <div className={`p-3 rounded-full ${bgColor} ${iconColor}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="ml-4">
        <p className="text-sm font-medium text-gray-600">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  </div>
);

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
      const response = await api.get('/labs/stats');
      setStats(response.data);
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
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard icon={TestTube} bgColor="bg-blue-100" iconColor="text-blue-600" label="Total Orders" value={stats.total} />
            <StatCard icon={Clock} bgColor="bg-yellow-100" iconColor="text-yellow-600" label="Pending" value={stats.pending} />
            <StatCard icon={AlertTriangle} bgColor="bg-orange-100" iconColor="text-orange-600" label="In Progress" value={stats.inProgress} />
            <StatCard icon={CheckCircle} bgColor="bg-green-100" iconColor="text-green-600" label="Completed" value={stats.completed} />
          </>
        )}
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
            <p className="text-2xl font-bold text-blue-700">{loading ? '-' : stats.pending}</p>
            <p className="text-sm text-blue-600">Awaiting Processing</p>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <p className="text-2xl font-bold text-orange-700">{loading ? '-' : stats.inProgress}</p>
            <p className="text-sm text-orange-600">In Progress</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-700">{loading ? '-' : stats.completed}</p>
            <p className="text-sm text-green-600">Completed</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LabDashboard;




