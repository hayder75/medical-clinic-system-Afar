import React, { useEffect, useState } from 'react';
import { Building2, Plus, Search, ChevronRight, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';

const INSTITUTION_TYPES = [
  { value: 'CORPORATE', label: 'Corporate' },
  { value: 'NGO', label: 'NGO' },
  { value: 'CHARITY', label: 'Charity' },
  { value: 'GOVERNMENT', label: 'Government' },
];

const InstitutionManagement = () => {
  const navigate = useNavigate();
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'CORPORATE', tinNumber: '', contactPerson: '', phone: '', email: '', address: '' });
  const [saving, setSaving] = useState(false);

  const fetchInstitutions = async () => {
    try {
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (filterType) params.type = filterType;
      const res = await api.get('/admin/institutions', { params });
      setInstitutions(res.data);
    } catch (err) {
      toast.error('Failed to load institutions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInstitutions(); }, []);

  useEffect(() => { fetchInstitutions(); }, [filterType]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchInstitutions();
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', type: 'CORPORATE', tinNumber: '', contactPerson: '', phone: '', email: '', address: '' });
    setShowModal(true);
  };

  const openEdit = (inst) => {
    setEditing(inst);
    setForm({
      name: inst.name,
      type: inst.type,
      tinNumber: inst.tinNumber || '',
      contactPerson: inst.contactPerson || '',
      phone: inst.phone || '',
      email: inst.email || '',
      address: inst.address || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.type) {
      toast.error('Name and type are required');
      return;
    }
    try {
      setSaving(true);
      if (editing) {
        await api.put(`/admin/institutions/${editing.id}`, form);
        toast.success('Institution updated');
      } else {
        await api.post('/admin/institutions', form);
        toast.success('Institution created');
      }
      setShowModal(false);
      fetchInstitutions();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id) => {
    if (!confirm('Deactivate this institution?')) return;
    try {
      await api.delete(`/admin/institutions/${id}`);
      toast.success('Institution deactivated');
      fetchInstitutions();
    } catch (err) {
      toast.error('Failed to deactivate');
    }
  };

  const typeColors = {
    CORPORATE: 'bg-blue-100 text-blue-700',
    NGO: 'bg-green-100 text-green-700',
    CHARITY: 'bg-purple-100 text-purple-700',
    GOVERNMENT: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-white rounded-xl shadow-md">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Institution Management</h1>
              <p className="text-sm text-gray-500">Manage corporate, NGO, charity, and government accounts</p>
            </div>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition">
            <Plus className="h-4 w-4" /> Add Institution
          </button>
        </div>

        <div className="px-6 py-4 border-b bg-gray-50 flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name..." className="pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <button type="submit" className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition">Search</button>
          </form>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
            <option value="">All Types</option>
            {INSTITUTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button onClick={fetchInstitutions} className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : institutions.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium">No institutions found</p>
              <p className="text-xs mt-1">Click "Add Institution" to create one</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {institutions.map((inst) => (
                <div key={inst.id} onClick={() => navigate(`/admin/institutions/${inst.id}`)} className="border rounded-xl p-4 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all bg-white group">
                  <div className="flex items-start justify-between mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${typeColors[inst.type] || 'bg-gray-100 text-gray-600'}`}>{inst.type}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${inst.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{inst.status}</span>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">{inst.name}</h3>
                  {inst.tinNumber && <p className="text-xs text-gray-500 mt-0.5">TIN: {inst.tinNumber}</p>}
                  {inst.contactPerson && <p className="text-xs text-gray-500">{inst.contactPerson}</p>}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{inst.patientCount} patients</span>
                      <span className="font-semibold text-gray-700">{inst.totalBilled > 0 ? `ETB ${inst.totalBilled.toLocaleString()}` : 'No billing'}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(inst); }} className="text-xs text-blue-600 hover:underline">Edit</button>
                    {inst.status === 'ACTIVE' && (
                      <button onClick={(e) => { e.stopPropagation(); handleDeactivate(inst.id); }} className="text-xs text-red-500 hover:underline">Deactivate</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editing ? 'Edit Institution' : 'Add Institution'}</h2>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input w-full" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Type *</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input w-full">
                    {INSTITUTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">TIN Number</label>
                  <input value={form.tinNumber} onChange={(e) => setForm({ ...form, tinNumber: e.target.value })} className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Contact Person</label>
                  <input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className="input w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input w-full" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                  <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input w-full" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Address</label>
                  <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input w-full" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstitutionManagement;
