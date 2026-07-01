import React, { useEffect, useState } from 'react';
import { Building2, Plus, RefreshCw, X } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const SupplierList = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', contactPerson: '', phone: '', email: '', address: '', notes: '' });

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/suppliers');
      setSuppliers(res.data.suppliers || []);
    } catch (e) {
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSuppliers(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', contactPerson: '', phone: '', email: '', address: '', notes: '' });
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({ name: s.name, contactPerson: s.contactPerson || '', phone: s.phone || '', email: s.email || '', address: s.address || '', notes: s.notes || '' });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name) { toast.error('Name is required'); return; }
    try {
      if (editing) {
        await api.put(`/suppliers/${editing.id}`, form);
        toast.success('Supplier updated');
      } else {
        await api.post('/suppliers', form);
        toast.success('Supplier created');
      }
      setShowModal(false);
      fetchSuppliers();
    } catch (e) {
      toast.error('Failed to save supplier');
    }
  };

  const handleDeactivate = async (id) => {
    if (!confirm('Deactivate this supplier?')) return;
    try {
      await api.delete(`/suppliers/${id}`);
      toast.success('Supplier deactivated');
      fetchSuppliers();
    } catch (e) {
      toast.error('Failed to deactivate');
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[300px]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{suppliers.length} supplier(s)</p>
        <div className="flex gap-2">
          <button onClick={fetchSuppliers} className="btn btn-outline btn-sm p-2"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={openCreate} className="btn btn-primary btn-sm flex items-center gap-1.5"><Plus className="h-4 w-4" /> Add Supplier</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suppliers.map(s => (
          <div key={s.id} className="bg-white rounded-xl shadow-sm border p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg"><Building2 className="h-5 w-5 text-blue-600" /></div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{s.name}</h3>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{s.status}</span>
                </div>
              </div>
            </div>
            <div className="space-y-1 text-xs text-gray-600">
              {s.contactPerson && <p>Contact: {s.contactPerson}</p>}
              {s.phone && <p>Phone: {s.phone}</p>}
              {s.email && <p>Email: {s.email}</p>}
              {s.address && <p>Address: {s.address}</p>}
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              <button onClick={() => openEdit(s)} className="text-xs text-blue-600 hover:underline">Edit</button>
              {s.status === 'ACTIVE' && (
                <button onClick={() => handleDeactivate(s.id)} className="text-xs text-red-500 hover:underline">Deactivate</button>
              )}
            </div>
          </div>
        ))}
        {suppliers.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400">
            <Building2 className="h-10 w-10 mx-auto mb-2 text-gray-200" />
            <p className="text-sm">No suppliers found</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">{editing ? 'Edit Supplier' : 'Add Supplier'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div><label className="label">Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" required /></div>
              <div><label className="label">Contact Person</label><input value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} className="input" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input" /></div>
                <div><label className="label">Email</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input" /></div>
              </div>
              <div><label className="label">Address</label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="input" /></div>
              <div><label className="label">Notes</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="input" rows="2" /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">{editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierList;
