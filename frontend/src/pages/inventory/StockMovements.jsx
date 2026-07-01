import React, { useEffect, useState } from 'react';
import { Activity, RefreshCw, Filter } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const TYPE_COLORS = {
  STOCK_REQUEST_OUT: 'text-red-600 bg-red-50',
  STOCK_REQUEST_IN: 'text-green-600 bg-green-50',
  MANUAL_ADJUST: 'text-blue-600 bg-blue-50',
  PURCHASE_IN: 'text-purple-600 bg-purple-50',
};

const TYPE_LABELS = {
  STOCK_REQUEST_OUT: 'Warehouse Out',
  STOCK_REQUEST_IN: 'Pharmacy In',
  MANUAL_ADJUST: 'Manual',
  PURCHASE_IN: 'Purchase',
};

const StockMovements = () => {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const params = {};
      if (typeFilter) params.type = typeFilter;
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await api.get('/warehouse/movements', { params });
      setMovements(res.data.movements || []);
    } catch (e) {
      toast.error('Failed to load movements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMovements(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl shadow-sm border p-4">
        <Filter className="h-4 w-4 text-gray-400" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input w-auto text-sm">
          <option value="">All Types</option>
          <option value="STOCK_REQUEST_OUT">Warehouse Out</option>
          <option value="STOCK_REQUEST_IN">Pharmacy In</option>
          <option value="MANUAL_ADJUST">Manual</option>
          <option value="PURCHASE_IN">Purchase</option>
        </select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input w-auto text-sm" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input w-auto text-sm" />
        <button onClick={fetchMovements} className="btn btn-primary btn-sm flex items-center gap-1.5">
          <RefreshCw className="h-4 w-4" /> Filter
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : movements.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Activity className="h-10 w-10 mx-auto mb-2 text-gray-200" />
            <p className="text-sm">No movements found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Medication</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Quantity</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Type</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-600">By</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Reference</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {movements.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-xs text-gray-500">{new Date(m.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{m.medicationCatalog?.name}</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${TYPE_COLORS[m.type] || 'bg-gray-100 text-gray-600'}`}>
                        {TYPE_LABELS[m.type] || m.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{m.user?.fullname}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">{m.referenceId ? `${m.referenceType}:${m.referenceId.slice(0, 8)}` : '-'}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{m.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockMovements;
