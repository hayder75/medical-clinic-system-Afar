import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Activity, Plus, Edit2, Trash2, Upload, Search, X, Check } from 'lucide-react';

const REPORT_FREQUENCIES = ['IMMEDIATE', 'WEEKLY', 'MONTHLY', 'NONE'];

const DiseaseManagement = () => {
  const [diseases, setDiseases] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', category: 'Other', isReportable: false, reportFrequency: 'NONE' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  const fetchDiseases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/diseases', { params: { page, limit: 50, search } });
      setDiseases(res.data.diseases);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch (e) {
      toast.error('Failed to load diseases');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchDiseases(); }, [fetchDiseases]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', code: '', category: 'Other', isReportable: false, reportFrequency: 'NONE' });
    setShowModal(true);
  };

  const openEdit = (d) => {
    setEditing(d);
    setForm({ name: d.name, code: d.code, category: d.category || 'Other', isReportable: d.isReportable, reportFrequency: d.reportFrequency || 'NONE' });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.code) { toast.error('Name and code are required'); return; }
    try {
      if (editing) {
        await api.put(`/diseases/${editing.id}`, form);
        toast.success('Disease updated');
      } else {
        await api.post('/diseases', form);
        toast.success('Disease created');
      }
      setShowModal(false);
      fetchDiseases();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to save disease');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/diseases/${id}`);
      toast.success('Disease deleted');
      setShowDeleteConfirm(null);
      fetchDiseases();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to delete disease');
    }
  };

  const handleExcelImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/diseases/import-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const { created, updated, skipped, total: totalRows, errors } = res.data;
      toast.success(`Imported: ${created} created, ${updated} updated, ${skipped} skipped (of ${totalRows})`);
      if (errors?.length) {
        console.warn('Import errors:', errors);
        toast.error(`${errors.length} row(s) had errors - check console`);
      }
      fetchDiseases();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Import failed');
    }
    e.target.value = '';
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') { setPage(1); fetchDiseases(); }
  };

  return (
    <div className="max-w-full mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" /> Disease Management
          </h1>
          <p className="text-gray-500">{total} total diseases</p>
        </div>
        <div className="flex gap-2">
          <label className="btn btn-secondary flex items-center gap-2 cursor-pointer">
            <Upload className="h-4 w-4" /> Import Excel
            <input type="file" accept=".xlsx,.xls" onChange={handleExcelImport} className="hidden" />
          </label>
          <button onClick={openCreate} className="btn btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Disease
          </button>
        </div>
      </div>

      <div className="card p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or code..."
            className="input pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Reportable</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Report Frequency</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : diseases.length === 0 ? (
                <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">No diseases found</td></tr>
              ) : diseases.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-700">{d.code}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{d.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{d.category || '-'}</td>
                  <td className="px-4 py-3 text-center">{d.isReportable ? <Check className="h-4 w-4 text-green-500 inline" /> : <X className="h-4 w-4 text-red-400 inline" />}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{d.reportFrequency || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => openEdit(d)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => setShowDeleteConfirm(d)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t">
            <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="btn btn-secondary btn-sm">Previous</button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn btn-secondary btn-sm">Next</button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Disease' : 'Add Disease'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-4">
              <div>
                <label className="label">Code *</label>
                <input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required placeholder="e.g. ICD-10-CM A00.0" />
              </div>
              <div>
                <label className="label">Name *</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Disease name" />
              </div>
              <div>
                <label className="label">Category</label>
                <input className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Infectious, Chronic, Other" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="isReportable" checked={form.isReportable} onChange={e => setForm({ ...form, isReportable: e.target.checked })} className="h-4 w-4" />
                <label htmlFor="isReportable" className="text-sm">Reportable to health authorities</label>
              </div>
              {form.isReportable && (
                <div>
                  <label className="label">Report Frequency</label>
                  <select className="input" value={form.reportFrequency} onChange={e => setForm({ ...form, reportFrequency: e.target.value })}>
                    {REPORT_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowDeleteConfirm(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-2">Confirm Delete</h2>
            <p className="text-gray-600 mb-4">Delete disease <strong>{showDeleteConfirm.name}</strong> ({showDeleteConfirm.code})?</p>
            <p className="text-sm text-red-600 mb-4">This will fail if diagnosis records reference this disease.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteConfirm(null)} className="btn btn-secondary">Cancel</button>
              <button onClick={() => handleDelete(showDeleteConfirm.id)} className="btn btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiseaseManagement;
