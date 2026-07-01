import React, { useEffect, useState } from 'react';
import { Package, Search, RefreshCw, AlertTriangle, CheckCircle, X, Plus } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const CATEGORIES = ['TABLETS', 'CAPSULES', 'INJECTIONS', 'SYRUPS', 'OINTMENTS', 'DROPS', 'INHALERS', 'PATCHES', 'INFUSIONS'];
const DOSAGE_FORMS = ['TABLETS', 'CAPSULES', 'INJECTIONS', 'SYRUPS', 'OINTMENTS', 'DROPS', 'INHALERS', 'PATCHES', 'INFUSIONS'];

const WarehouseStock = () => {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'TABLETS', dosageForm: 'TABLETS', strength: '', quantity: 0, minimumStock: 10, unitCost: '', manufacturer: '', expiryDate: '', notes: '' });
  const [editingId, setEditingId] = useState(null);

  const fetchStock = async () => {
    try {
      setLoading(true);
      const res = await api.get('/warehouse/stock');
      setStock(res.data.stock || []);
    } catch (e) {
      toast.error('Failed to load warehouse stock');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStock(); }, []);

  const openNew = () => {
    setEditingId(null);
    setForm({ name: '', category: 'TABLETS', dosageForm: 'TABLETS', strength: '', quantity: 0, minimumStock: 10, unitCost: '', manufacturer: '', expiryDate: '', notes: '' });
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingId(item.medicationCatalog.id);
    setForm({
      name: item.medicationCatalog.name,
      category: item.medicationCatalog.category,
      dosageForm: item.medicationCatalog.dosageForm,
      strength: item.medicationCatalog.strength,
      quantity: item.quantity,
      minimumStock: item.minimumStock,
      unitCost: item.unitCost || '',
      manufacturer: item.medicationCatalog.manufacturer || '',
      expiryDate: item.expiryDate ? item.expiryDate.slice(0, 10) : '',
      notes: ''
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.strength) { toast.error('Name and strength are required'); return; }
    try {
      await api.post('/warehouse/stock', {
        name: form.name,
        category: form.category,
        dosageForm: form.dosageForm,
        strength: form.strength,
        quantity: parseInt(form.quantity) || 0,
        minimumStock: parseInt(form.minimumStock) || 10,
        unitCost: form.unitCost ? parseFloat(form.unitCost) : null,
        manufacturer: form.manufacturer || null,
        expiryDate: form.expiryDate || null,
        notes: form.notes || (editingId ? 'Stock updated' : 'New medication added'),
      });
      toast.success(editingId ? 'Stock updated' : 'Medication added');
      setShowForm(false);
      fetchStock();
    } catch (e) {
      toast.error('Failed to save');
    }
  };

  const totalQty = stock.reduce((s, i) => s + i.quantity, 0);
  const lowCount = stock.filter(s => s.quantity > 0 && s.quantity <= s.minimumStock).length;

  const filtered = stock.filter(s =>
    s.medicationCatalog?.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.medicationCatalog?.category?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center min-h-[300px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search medication..." className="input pl-9" />
        </div>
        <button onClick={openNew} className="btn btn-primary btn-sm flex items-center gap-1.5"><Plus className="h-4 w-4" /> Add Medication</button>
        <button onClick={fetchStock} className="btn btn-outline btn-sm p-2"><RefreshCw className="h-4 w-4" /></button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-xs text-gray-500">Medications</p>
          <p className="text-2xl font-bold text-gray-900">{stock.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-xs text-gray-500">Total Units</p>
          <p className="text-2xl font-bold text-gray-900">{totalQty}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-xs text-gray-500">Low Stock Items</p>
          <p className="text-2xl font-bold text-yellow-600">{lowCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Medication</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Type</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Strength</th>
                <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Qty</th>
                <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Min</th>
                <th className="px-4 py-2.5 text-center font-semibold text-gray-600">Status</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Expiry</th>
                <th className="px-4 py-2.5 text-right font-semibold text-gray-600" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openEdit(s)}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-900">{s.medicationCatalog?.name}</p>
                    <p className="text-xs text-gray-500">{s.medicationCatalog?.manufacturer}</p>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">{s.medicationCatalog?.category}</td>
                  <td className="px-4 py-2.5 text-gray-700 text-xs">{s.medicationCatalog?.strength}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-gray-900">{s.quantity}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500">{s.minimumStock}</td>
                  <td className="px-4 py-2.5 text-center">
                    {s.quantity <= 0 ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-100 text-red-700">Out</span>
                    ) : s.quantity <= s.minimumStock ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 flex items-center gap-1 justify-center"><AlertTriangle className="h-3 w-3" /> Low</span>
                    ) : (
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-100 text-green-700">OK</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{s.expiryDate ? new Date(s.expiryDate).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-2.5 text-right text-blue-600 text-xs font-medium">Edit</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan="8" className="px-4 py-8 text-center text-gray-400">No medications in warehouse. Click "Add Medication" to start.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" /> {editingId ? 'Edit Medication' : 'Add Medication to Warehouse'}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Medication Name *</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" placeholder="e.g. Amoxicillin" required />
                </div>
                <div>
                  <label className="label">Category / Type *</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value, dosageForm: e.target.value })} className="input" required>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Dosage Form</label>
                  <select value={form.dosageForm} onChange={e => setForm({ ...form, dosageForm: e.target.value })} className="input">
                    {DOSAGE_FORMS.map(d => <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Strength *</label>
                  <input type="text" value={form.strength} onChange={e => setForm({ ...form, strength: e.target.value })} className="input" placeholder="e.g. 500mg" required />
                </div>
                <div>
                  <label className="label">Manufacturer</label>
                  <input type="text" value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} className="input" placeholder="Optional" />
                </div>
                <div>
                  <label className="label">Quantity *</label>
                  <input type="number" min="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} className="input" required />
                </div>
                <div>
                  <label className="label">Min Stock Level</label>
                  <input type="number" min="0" value={form.minimumStock} onChange={e => setForm({ ...form, minimumStock: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="label">Unit Cost (ETB)</label>
                  <input type="number" step="0.01" min="0" value={form.unitCost} onChange={e => setForm({ ...form, unitCost: e.target.value })} className="input" placeholder="Optional" />
                </div>
                <div>
                  <label className="label">Expiry Date</label>
                  <input type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} className="input" />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="input" rows="2" placeholder="Optional notes" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-outline flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">{editingId ? 'Save Changes' : 'Add to Warehouse'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseStock;
