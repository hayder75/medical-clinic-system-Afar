import React, { useEffect, useState } from 'react';
import { Package, FileText, AlertTriangle, Building2, RefreshCw, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const statusColors = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  PARTIALLY_DELIVERED: 'bg-orange-100 text-orange-700',
};

const InventoryDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalItems: 0, pendingRequests: 0, lowStock: 0, totalSuppliers: 0 });
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [stockRes, reqRes, supRes] = await Promise.all([
        api.get('/warehouse/stock'),
        api.get('/warehouse/requests?status=PENDING'),
        api.get('/suppliers'),
      ]);
      const stock = stockRes.data.stock || [];
      const requests = reqRes.data.requests || [];
      const suppliers = supRes.data.suppliers || [];
      setStats({
        totalItems: stock.length,
        pendingRequests: requests.length,
        lowStock: stock.filter(s => s.quantity <= s.minimumStock).length,
        totalSuppliers: suppliers.length,
      });
      setRecentRequests(requests.slice(0, 5));
    } catch (e) {
      console.error('Failed to load dashboard data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <div className="flex items-center justify-center min-h-[300px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Warehouse overview and stock levels</p>
        <button onClick={fetchData} className="btn btn-outline btn-sm p-2"><RefreshCw className="h-4 w-4" /></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-lg"><Package className="h-6 w-6 text-blue-600" /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Items</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalItems}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center gap-4">
          <div className="p-3 bg-yellow-100 rounded-lg"><FileText className="h-6 w-6 text-yellow-600" /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Pending Requests</p>
            <p className="text-2xl font-bold text-gray-900">{stats.pendingRequests}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center gap-4">
          <div className="p-3 bg-red-100 rounded-lg"><AlertTriangle className="h-6 w-6 text-red-600" /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Low Stock</p>
            <p className="text-2xl font-bold text-gray-900">{stats.lowStock}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-lg"><Building2 className="h-6 w-6 text-green-600" /></div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Suppliers</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalSuppliers}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Pending Stock Requests</h3>
          <button onClick={() => navigate('/inventory/requests')} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            View All <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        {recentRequests.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <FileText className="h-8 w-8 mx-auto mb-2 text-gray-200" />
            <p className="text-sm">No pending requests</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {r.items?.map(i => i.medicationCatalog?.name).join(', ') || 'Request'}
                  </p>
                  <p className="text-xs text-gray-500">by {r.requestedBy?.fullname} · {new Date(r.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${statusColors[r.status] || 'bg-gray-100 text-gray-600'}`}>
                  {r.status.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryDashboard;
