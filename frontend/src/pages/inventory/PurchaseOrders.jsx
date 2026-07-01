import React, { useEffect, useState } from 'react';
import { ShoppingCart, Plus, RefreshCw, Truck, X, Search } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  ORDERED: 'bg-blue-100 text-blue-700',
  PARTIALLY_RECEIVED: 'bg-yellow-100 text-yellow-700',
  RECEIVED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const PurchaseOrders = () => {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [receiveModal, setReceiveModal] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ supplierId: '', notes: '', items: [] });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ordRes, supRes, medRes] = await Promise.all([
        api.get('/purchase-orders'),
        api.get('/suppliers'),
        api.get('/medications/catalog'),
      ]);
      setOrders(ordRes.data.orders || []);
      setSuppliers(supRes.data.suppliers || []);
      setMedications(medRes.data.medications || []);
    } catch (e) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setForm({ supplierId: '', notes: '', items: [] });
    setShowModal(true);
  };

  const addItem = () => {
    setForm(f => ({ ...f, items: [...f.items, { medicationCatalogId: '', quantity: 1, unitPrice: '' }] }));
  };

  const updateItem = (i, field, value) => {
    setForm(f => {
      const items = [...f.items];
      items[i] = { ...items[i], [field]: value };
      return { ...f, items };
    });
  };

  const removeItem = (i) => {
    setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.supplierId) { toast.error('Select a supplier'); return; }
    if (form.items.length === 0) { toast.error('Add at least one item'); return; }
    try {
      await api.post('/purchase-orders', {
        supplierId: form.supplierId,
        notes: form.notes,
        items: form.items.map(i => ({ medicationCatalogId: i.medicationCatalogId, quantity: parseInt(i.quantity), unitPrice: i.unitPrice ? parseFloat(i.unitPrice) : null })),
      });
      toast.success('Purchase order created');
      setShowModal(false);
      fetchData();
    } catch (e) {
      toast.error('Failed to create order');
    }
  };

  const handleReceive = async (orderId, items) => {
    try {
      await api.put(`/purchase-orders/${orderId}/receive`, { items });
      toast.success('Items received');
      setReceiveModal(null);
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to receive');
    }
  };

  const filtered = orders.filter(o =>
    o.supplier?.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.id?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center min-h-[300px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by supplier..." className="input pl-9 py-1.5 text-sm max-w-xs" />
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="btn btn-outline btn-sm p-2"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={openCreate} className="btn btn-primary btn-sm flex items-center gap-1.5"><Plus className="h-4 w-4" /> New Order</button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="divide-y divide-gray-100">
          {filtered.map(order => (
            <div key={order.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-900">{order.supplier?.name}</h3>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${STATUS_COLORS[order.status]}`}>{order.status.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-xs text-gray-500">Ordered by {order.orderedBy?.fullname} · {new Date(order.orderedAt).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{order.totalAmount?.toLocaleString()} ETB</p>
                  {(order.status === 'ORDERED' || order.status === 'PARTIALLY_RECEIVED') && (
                    <button onClick={() => setReceiveModal(order)} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 mt-1">
                      <Truck className="h-3 w-3" /> Receive
                    </button>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-600 space-y-0.5">
                {order.items?.map(item => (
                  <p key={item.id}>{item.medicationCatalog?.name} — {item.quantityReceived}/{item.quantityOrdered} received @ ETB {item.unitPrice || '?'}/unit</p>
                ))}
              </div>
              {order.notes && <p className="text-xs text-gray-500 mt-1 italic">{order.notes}</p>}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <ShoppingCart className="h-10 w-10 mx-auto mb-2 text-gray-200" />
              <p className="text-sm">No purchase orders found</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">Create Purchase Order</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="label">Supplier *</label>
                <select value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })} className="input" required>
                  <option value="">Select supplier</option>
                  {suppliers.filter(s => s.status === 'ACTIVE').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Items</label>
                <div className="space-y-2">
                  {form.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select value={item.medicationCatalogId} onChange={e => updateItem(idx, 'medicationCatalogId', e.target.value)} className="input text-sm flex-1" required>
                        <option value="">Select medication</option>
                        {medications.map(m => <option key={m.id} value={m.id}>{m.name} ({m.dosageForm} · {m.strength})</option>)}
                      </select>
                      <input type="number" min="1" placeholder="Qty" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="input text-sm w-20" required />
                      <input type="number" step="0.01" min="0" placeholder="Price" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value)} className="input text-sm w-24" />
                      <button type="button" onClick={() => removeItem(idx)} className="p-1.5 text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={addItem} className="text-sm text-blue-600 hover:text-blue-700 font-medium">+ Add Item</button>
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="input" rows="2" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Create Order</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {receiveModal && (
        <ReceiveModal order={receiveModal} onClose={() => setReceiveModal(null)} onReceive={handleReceive} />
      )}
    </div>
  );
};

const ReceiveModal = ({ order, onClose, onReceive }) => {
  const [items, setItems] = useState(
    order.items?.map(i => ({ purchaseOrderItemId: i.id, medicationCatalogId: i.medicationCatalogId, quantityReceived: i.quantityOrdered - i.quantityReceived, unitPrice: i.unitPrice || '' })) || []
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    const validItems = items.filter(i => i.quantityReceived > 0);
    if (validItems.length === 0) { toast.error('Enter at least one quantity to receive'); return; }
    onReceive(order.id, validItems);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
          <h3 className="text-lg font-bold text-gray-900">Receive: {order.supplier?.name}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{order.items?.find(i => i.id === item.purchaseOrderItemId)?.medicationCatalog?.name}</p>
                <p className="text-xs text-gray-500">Ordered: {order.items?.find(i => i.id === item.purchaseOrderItemId)?.quantityOrdered}</p>
              </div>
              <div className="w-24">
                <input type="number" min="0" value={item.quantityReceived} onChange={e => {
                  const newItems = [...items];
                  newItems[idx] = { ...newItems[idx], quantityReceived: parseInt(e.target.value) || 0 };
                  setItems(newItems);
                }} className="input text-sm text-center" placeholder="Qty" />
              </div>
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-outline flex-1">Cancel</button>
            <button type="submit" className="btn btn-primary flex-1">Receive Items</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PurchaseOrders;
