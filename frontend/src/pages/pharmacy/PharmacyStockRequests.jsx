import React, { useEffect, useState } from 'react';
import { Package, Plus, RefreshCw, X, Search } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  PARTIALLY_DELIVERED: 'bg-orange-100 text-orange-700',
};

const PharmacyStockRequests = () => {
  const [requests, setRequests] = useState([]);
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formItems, setFormItems] = useState([{ medicationCatalogId: '', quantity: 1 }]);
  const [notes, setNotes] = useState('');
  const [activeTab, setActiveTab] = useState('PENDING');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [reqRes, medRes] = await Promise.all([
        api.get('/warehouse/requests', { params: activeTab === 'ALL' ? {} : { status: activeTab } }),
        api.get('/medications/catalog'),
      ]);
      setRequests(reqRes.data.requests || []);
      setMedications(medRes.data.medications || []);
    } catch (e) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [activeTab]);

  const addItem = () => setFormItems([...formItems, { medicationCatalogId: '', quantity: 1 }]);
  const removeItem = (i) => setFormItems(formItems.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) => {
    const items = [...formItems];
    items[i] = { ...items[i], [field]: value };
    setFormItems(items);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const validItems = formItems.filter(i => i.medicationCatalogId && i.quantity > 0);
    if (validItems.length === 0) { toast.error('Add at least one item'); return; }
    try {
      await api.post('/warehouse/requests', {
        items: validItems.map(i => ({ medicationCatalogId: i.medicationCatalogId, quantity: parseInt(i.quantity) })),
        notes,
      });
      toast.success('Stock request submitted');
      setShowModal(false);
      setFormItems([{ medicationCatalogId: '', quantity: 1 }]);
      setNotes('');
      fetchData();
    } catch (e) {
      toast.error('Failed to create request');
    }
  };

  const TABS = ['PENDING', 'APPROVED', 'DELIVERED', 'ALL'];

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
        <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Request Stock
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Package className="h-10 w-10 mx-auto mb-2 text-gray-200" />
            <p className="text-sm">No requests found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {requests.map(req => (
              <div key={req.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${STATUS_COLORS[req.status]}`}>{req.status.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-gray-500">{new Date(req.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="space-y-0.5">
                      {req.items?.map(item => (
                        <p key={item.id} className="text-sm text-gray-700">
                          {item.medicationCatalog?.name} — <strong>{item.quantityDelivered || 0}/{item.quantityRequested}</strong>
                        </p>
                      ))}
                    </div>
                    {req.notes && <p className="text-xs text-gray-500 mt-1">{req.notes}</p>}
                    {req.rejectReason && <p className="text-xs text-red-600 mt-1">Reason: {req.rejectReason}</p>}
                    {req.approvedBy && <p className="text-xs text-gray-400 mt-0.5">Processed by: {req.approvedBy?.fullname}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" /> Request Stock
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="label">Medications</label>
                <div className="space-y-2">
                  {formItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select value={item.medicationCatalogId} onChange={e => updateItem(idx, 'medicationCatalogId', e.target.value)} className="input text-sm flex-1" required>
                        <option value="">Select medication</option>
                        {medications.map(m => <option key={m.id} value={m.id}>{m.name} ({m.dosageForm} · {m.strength})</option>)}
                      </select>
                      <input type="number" min="1" placeholder="Qty" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="input text-sm w-20" required />
                      <button type="button" onClick={() => removeItem(idx)} className="p-1.5 text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={addItem} className="text-sm text-blue-600 hover:text-blue-700 font-medium">+ Add Item</button>
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input" rows="2" placeholder="Reason for request, urgency, etc." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PharmacyStockRequests;
