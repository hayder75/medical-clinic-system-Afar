import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Clock, AlertTriangle, RefreshCw, ArrowRight, CheckCircle } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const MetricCard = ({ icon: Icon, bgColor, iconColor, label, value }) => (
  <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 flex items-center gap-3">
    <div className={`p-2 rounded-lg ${bgColor}`}>
      <Icon className={`w-5 h-5 ${iconColor}`} />
    </div>
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  </div>
);

const PatientCard = ({ item, onClick }) => {
  const diff = Date.now() - new Date(item.oldestCreatedAt).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  const waitDisplay = days > 0 ? `${days}d ${hours % 24}h` : hours > 0 ? `${hours}h` : `${Math.floor(diff / 60000)}m`;

  let borderColor = 'border-green-200 bg-green-50';
  let textColor = 'text-green-700';
  if (days >= 1) { borderColor = 'border-red-200 bg-red-50'; textColor = 'text-red-700'; }
  else if (hours >= 6) { borderColor = 'border-orange-200 bg-orange-50'; textColor = 'text-orange-700'; }
  else if (hours >= 2) { borderColor = 'border-yellow-200 bg-yellow-50'; textColor = 'text-yellow-700'; }

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-100 shadow-sm p-3 hover:shadow-md hover:border-gray-200 transition-all text-left w-full"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-xs font-semibold text-indigo-600">
            {item.patient.name?.charAt(0) || '?'}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">{item.patient.name}</p>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 mt-1">
            {item.tests.length} test{item.tests.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      <div className={`mt-2 px-2 py-1 rounded border text-xs font-semibold text-center ${borderColor} ${textColor}`}>
        {waitDisplay}
      </div>
    </button>
  );
};

const LabDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState({ pending: 0, inProgress: 0, overdue: 0, oldestPending: [] });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => { fetchStats(); }, []);

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lab Dashboard</h1>
          {lastUpdated && <p className="text-xs text-gray-400 mt-0.5">Updated {timeAgo(lastUpdated)}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/lab/orders')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Orders <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics row */}
      {loading ? (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map(i => <div key={i} className="bg-white rounded-lg border border-gray-100 p-4 animate-pulse"><div className="h-10 bg-gray-100 rounded" /></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <MetricCard icon={Users} bgColor="bg-blue-50" iconColor="text-blue-600" label="Pending" value={data.pending} />
          <MetricCard icon={Clock} bgColor="bg-amber-50" iconColor="text-amber-600" label="In Progress" value={data.inProgress} />
          <MetricCard icon={AlertTriangle} bgColor={data.overdue > 0 ? 'bg-red-50' : 'bg-green-50'} iconColor={data.overdue > 0 ? 'text-red-500' : 'text-green-600'} label="Overdue" value={data.overdue} />
        </div>
      )}

      {/* Oldest Pending */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
        <div className="px-4 py-3 border-b border-gray-50">
          <p className="text-sm font-semibold text-gray-900">Oldest Pending</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4">
            {[1,2,3,4,5].map(i => <div key={i} className="bg-white rounded-lg border border-gray-100 p-3 animate-pulse"><div className="h-20 bg-gray-50 rounded" /></div>)}
          </div>
        ) : data.oldestPending.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">All caught up — no pending orders</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4">
            {data.oldestPending.map(item => (
              <PatientCard
                key={item.patient.id}
                item={item}
                onClick={() => navigate(`/lab/orders?patientId=${item.patient.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LabDashboard;
