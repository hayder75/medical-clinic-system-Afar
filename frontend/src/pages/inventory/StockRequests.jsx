import React, { useEffect, useState } from 'react';
import { FileText, RefreshCw, CheckCircle, XCircle, Truck, Search, Eye } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import DeliverModal from '../../components/inventory/DeliverModal';

const TABS = ['PENDING', 'APPROVED', 'DELIVERED', 'REJECTED', 'ALL'];
const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  PARTIALLY_DELIVERED: 'bg-orange-100 text-orange-700',
};

const StockRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [deliverRequest, setDeliverRequest] = useState(null);
  const [detailRequest, setDetailRequest] = useState(null);

  const fetchRequests = async (status) => {
    try {
      setLoading(true);
      const params = status !== 'ALL' ? { status } : {};
      const res = await api.get('/warehouse/requests', { params });
      setRequests(res.data.requests || []);
    } catch (e) {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(activeTab); }, [activeTab]);

  const handleApprove = async (id) => {
    try {
      await api.put(`/warehouse/requests/${id}/approve`);
      toast.success('Request approved');
      fetchRequests(activeTab);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to approve');
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Reason for rejection:');
    if (reason === null) return;
    try {
      await api.put(`/warehouse/requests/${id}/reject`, { rejectReason: reason || undefined });
      toast.success('Request rejected');
      fetchRequests(activeTab);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to reject');
    }
  };

  const handleDeliver = (req) => {
    setDeliverRequest(req);
  };

  const onDelivered = () => {
    setDeliverRequest(null);
    fetchRequests(activeTab);
  };

  const filtered = requests.filter(r =>
    r.requestedBy?.fullname?.toLowerCase().includes(search.toLowerCase()) ||
    r.items?.some(i => i.medicationCatalog?.name?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {tab === 'ALL' ? 'All' : tab.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="input pl-9 py-1.5 text-sm" />
          </div>
          <button onClick={() => fetchRequests(activeTab)} className="btn btn-outline btn-sm p-2"><RefreshCw className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileText className="h-10 w-10 mx-auto mb-2 text-gray-200" />
            <p className="text-sm">No requests found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((req) => (
              <div key={req.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${STATUS_COLORS[req.status] || 'bg-gray-100'}`}>
                        {req.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-gray-500">
                        by {req.requestedBy?.fullname} · {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {req.items?.map(item => (
                        <p key={item.id} className="text-sm text-gray-700">
                          {item.medicationCatalog?.name} — <strong>{item.quantityDelivered || 0}/{item.quantityRequested}</strong> delivered
                        </p>
                      ))}
                    </div>
                    {req.rejectReason && (
                      <p className="text-xs text-red-600 mt-1">Reason: {req.rejectReason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 ml-3">
                    <button onClick={() => setDetailRequest(req)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" title="View details">
                      <Eye className="h-4 w-4" />
                    </button>
                    {req.status === 'PENDING' && (
                      <>
                        <button onClick={() => handleApprove(req.id)} className="px-2.5 py-1 text-xs font-bold bg-green-100 text-green-700 rounded-lg hover:bg-green-200 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Approve
                        </button>
                        <button onClick={() => handleReject(req.id)} className="px-2.5 py-1 text-xs font-bold bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> Reject
                        </button>
                      </>
                    )}
                    {req.status === 'APPROVED' && (
                      <button onClick={() => handleDeliver(req)} className="px-2.5 py-1 text-xs font-bold bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-1">
                        <Truck className="h-3 w-3" /> Deliver
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {deliverRequest && (
        <DeliverModal request={deliverRequest} onClose={() => setDeliverRequest(null)} onDelivered={onDelivered} />
      )}

      {detailRequest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDetailRequest(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">Request Details</h3>
              <button onClick={() => setDetailRequest(null)} className="p-1 rounded-lg hover:bg-gray-100">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Requested by: {detailRequest.requestedBy?.fullname}</p>
                  <p className="text-xs text-gray-500">{new Date(detailRequest.createdAt).toLocaleString()}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${STATUS_COLORS[detailRequest.status]}`}>
                  {detailRequest.status.replace(/_/g, ' ')}
                </span>
              </div>
              {detailRequest.notes && <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">{detailRequest.notes}</div>}
              {detailRequest.rejectReason && <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700">Rejected: {detailRequest.rejectReason}</div>}
              <div className="divide-y divide-gray-100">
                {detailRequest.items?.map(item => (
                  <div key={item.id} className="flex justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.medicationCatalog?.name}</p>
                      <p className="text-xs text-gray-500">{item.medicationCatalog?.dosageForm} · {item.medicationCatalog?.strength}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">Requested: {item.quantityRequested}</p>
                      <p className="text-xs text-blue-600">Delivered: {item.quantityDelivered || 0}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockRequests;
