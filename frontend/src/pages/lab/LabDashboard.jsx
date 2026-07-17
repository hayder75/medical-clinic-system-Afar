import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Clock, AlertTriangle, RefreshCw, ArrowRight, Calendar, CheckCircle } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const SkeletonCard = () => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
    <div className="flex items-center">
      <div className="w-14 h-14 rounded-xl bg-gray-100" />
      <div className="ml-4 flex-1 space-y-2">
        <div className="h-3 bg-gray-100 rounded w-16" />
        <div className="h-7 bg-gray-100 rounded w-10" />
        <div className="h-3 bg-gray-100 rounded w-20" />
      </div>
    </div>
  </div>
);

const MetricCard = ({ icon: Icon, bgColor, iconColor, label, value, sublabel, trend }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
    <div className="flex items-center gap-4">
      <div className={`p-3 rounded-xl ${bgColor}`}>
        <Icon className={`w-7 h-7 ${iconColor}`} />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
      </div>
    </div>
      {trend !== undefined && (
        <div className={`mt-3 text-xs font-medium ${trend >= 0 ? 'text-red-500' : 'text-green-500'}`}>
          {trend > 0 ? `+${trend}` : trend} from yesterday
        </div>
      )}
  </div>
);

const LabDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState({ pending: 0, inProgress: 0, overdue: 0, oldestPending: [] });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/labs/stats');
      setData(response.data);
      setLastUpdated(new Date());
    } catch (error) {
      toast.error('Failed to fetch lab statistics');
    } finally {
      setLoading(false);
    }
  };

  const getWaitingTime = (createdAt) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h`;
    return `${Math.floor(diff / 60000)}m`;
  };

  const getStatusBadge = (status) => {
    if (status === 'PAID') return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Paid</span>;
    if (status === 'QUEUED') return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Queued</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{status}</span>;
  };

  const timeAgo = (date) => {
    if (!date) return '';
    const diff = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diff < 1) return 'just now';
    if (diff < 60) return `${diff}m ago`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lab Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {lastUpdated ? `Updated ${timeAgo(lastUpdated)}` : 'Real-time lab overview'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/lab/orders')}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            View All Orders
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <MetricCard
              icon={Users}
              bgColor="bg-blue-50"
              iconColor="text-blue-600"
              label="Pending"
              value={data.pending}
              sublabel="patients waiting"
            />
            <MetricCard
              icon={Clock}
              bgColor="bg-amber-50"
              iconColor="text-amber-600"
              label="In Progress"
              value={data.inProgress}
              sublabel="being processed now"
            />
            <MetricCard
              icon={AlertTriangle}
              bgColor={data.overdue > 0 ? 'bg-red-50' : 'bg-green-50'}
              iconColor={data.overdue > 0 ? 'text-red-500' : 'text-green-600'}
              label="Overdue"
              value={data.overdue}
              sublabel="waiting >24h"
            />
          </>
        )}
      </div>

      {/* Oldest Pending */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Oldest Pending Patients</h2>
              <p className="text-sm text-gray-500 mt-0.5">Longest-waiting patients requiring attention</p>
            </div>
            {data.oldestPending.length > 0 && (
              <span className="text-xs text-gray-400">{data.oldestPending.length} shown</span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-32" />
                  <div className="h-3 bg-gray-100 rounded w-48" />
                </div>
                <div className="h-4 bg-gray-100 rounded w-16" />
              </div>
            ))}
          </div>
        ) : data.oldestPending.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-50 mb-4">
              <CheckCircle className="w-7 h-7 text-green-500" />
            </div>
            <p className="text-gray-900 font-medium">All caught up!</p>
            <p className="text-sm text-gray-500 mt-1">No pending lab orders</p>
            <p className="text-xs text-gray-400 mt-1">Note: shows doctor-ordered lab tests</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.oldestPending.map((item) => (
              <div key={item.patient.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-sm font-semibold text-indigo-600">
                        {item.patient.name?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.patient.name}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {item.tests.map(t => (
                          <span key={t.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-gray-50 text-gray-600 border border-gray-100">
                            {t.groupName && <span className="text-indigo-500 font-medium">{t.groupName}</span>}
                            {t.groupName && ' / '}
                            {t.name}
                          </span>
                        ))}
                      </div>
                      {item.patient.mobile && (
                        <p className="text-xs text-gray-400 mt-1">{item.patient.mobile}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">{getWaitingTime(item.oldestCreatedAt)}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(item.oldestCreatedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/lab/orders')}
          className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow text-left"
        >
          <p className="text-sm font-medium text-gray-900">Go to Lab Orders</p>
          <p className="text-xs text-gray-500 mt-1">Process and manage all lab test orders</p>
        </button>
        <button
          onClick={() => navigate('/lab/orders')}
          className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow text-left"
        >
          <p className="text-sm font-medium text-gray-900">Review Results</p>
          <p className="text-xs text-gray-500 mt-1">Review and send completed results to doctors</p>
        </button>
      </div>
    </div>
  );
};

export default LabDashboard;
