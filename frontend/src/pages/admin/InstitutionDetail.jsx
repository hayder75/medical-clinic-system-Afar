import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, UserPlus, Search, Trash2, RefreshCw, FileText, Users, DollarSign, X } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const TABS = ['patients', 'report', 'info'];
const TAB_LABELS = { info: 'Institution Info', patients: 'Linked Patients', report: 'Report' };

const InstitutionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [institution, setInstitution] = useState(null);
  const [activeTab, setActiveTab] = useState('patients');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  // Linked patients
  const [linkedPatients, setLinkedPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [createNewOpen, setCreateNewOpen] = useState(false);
  const [newPatientForm, setNewPatientForm] = useState({ name: '', dob: '', gender: 'MALE', mobile: '' });

  // Report
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
  const [reportMode, setReportMode] = useState('summary');
  const [expandedPatient, setExpandedPatient] = useState(null);

  const fetchInstitution = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/admin/institutions/${id}`);
      setInstitution(res.data);
      setForm({
        name: res.data.name,
        type: res.data.type,
        tinNumber: res.data.tinNumber || '',
        contactPerson: res.data.contactPerson || '',
        phone: res.data.phone || '',
        email: res.data.email || '',
        address: res.data.address || '',
        status: res.data.status,
      });
    } catch (err) {
      toast.error('Failed to load institution');
      navigate('/admin/institutions');
    } finally {
      setLoading(false);
    }
  };

  const fetchLinkedPatients = async () => {
    try {
      setPatientsLoading(true);
      const res = await api.get(`/admin/institutions/${id}/patients`);
      setLinkedPatients(res.data);
    } catch (err) {
      toast.error('Failed to load linked patients');
    } finally {
      setPatientsLoading(false);
    }
  };

  const fetchReport = async () => {
    try {
      setReportLoading(true);
      const params = {};
      if (reportFrom) params.from = reportFrom;
      if (reportTo) params.to = reportTo;
      const res = await api.get(`/admin/institutions/${id}/report`, { params });
      setReport(res.data);
    } catch (err) {
      toast.error('Failed to load report');
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => { fetchInstitution(); }, [id]);

  useEffect(() => {
    if (activeTab === 'patients') fetchLinkedPatients();
    if (activeTab === 'report') fetchReport();
  }, [activeTab, id]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.put(`/admin/institutions/${id}`, form);
      toast.success('Institution updated');
      fetchInstitution();
    } catch (err) {
      toast.error('Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const searchPatients = async (q) => {
    if (!q || q.length < 1) return setPatientResults([]);
    try {
      const res = await api.get('/admin/patients', { params: { search: q, limit: 10 } });
      const patients = Array.isArray(res.data) ? res.data : res.data.patients || [];
      setPatientResults(patients);
    } catch (err) {
      setPatientResults([]);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => searchPatients(patientSearch), 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  const handleLinkPatient = async (patientId) => {
    try {
      await api.post(`/admin/institutions/${id}/patients/link`, { patientId });
      toast.success('Patient linked');
      setShowLinkModal(false);
      setPatientSearch('');
      setPatientResults([]);
      fetchLinkedPatients();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to link');
    }
  };

  const handleUnlink = async (linkId) => {
    if (!confirm('Unlink this patient from the institution?')) return;
    try {
      await api.delete(`/admin/institutions/${id}/patients/${linkId}`);
      toast.success('Patient unlinked');
      fetchLinkedPatients();
    } catch (err) {
      toast.error('Failed to unlink');
    }
  };

  const handleCreateAndLink = async (e) => {
    e.preventDefault();
    if (!newPatientForm.name) { toast.error('Name is required'); return; }
    try {
      await api.post(`/admin/institutions/${id}/patients/create-and-link`, newPatientForm);
      toast.success('Patient created and linked');
      setCreateNewOpen(false);
      setNewPatientForm({ name: '', dob: '', gender: 'MALE', mobile: '' });
      fetchLinkedPatients();
    } catch (err) {
      toast.error('Failed to create patient');
    }
  };

  const typeColors = {
    CORPORATE: 'bg-blue-100 text-blue-700',
    NGO: 'bg-green-100 text-green-700',
    CHARITY: 'bg-purple-100 text-purple-700',
    GOVERNMENT: 'bg-amber-100 text-amber-700',
  };

  const formatCurrency = (v) => `ETB ${Number(v || 0).toLocaleString()}`;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <button onClick={() => navigate('/admin/institutions')} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-800 mb-4 shadow-sm">
        <ArrowLeft className="h-5 w-5" /> Back to Institutions
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${typeColors[institution.type] || 'bg-gray-100'}`}>
          <Building2 className="h-7 w-7" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{institution.name}</h1>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${typeColors[institution.type] || 'bg-gray-100 text-gray-600'}`}>{institution.type}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${institution.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{institution.status}</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{institution.patientCount} patients · TIN: {institution.tinNumber || 'N/A'}</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-3 text-sm font-medium transition border-b-2 -mb-px ${activeTab === tab ? 'text-blue-600 border-blue-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {activeTab === 'info' && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Institution Details</h2>
          <form onSubmit={handleSave} className="max-w-2xl space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input w-full" required />
              </div>
              <div>
                <label className="label">Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input w-full">
                  <option value="CORPORATE">Corporate</option>
                  <option value="NGO">NGO</option>
                  <option value="CHARITY">Charity</option>
                  <option value="GOVERNMENT">Government</option>
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input w-full">
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              <div>
                <label className="label">TIN Number</label>
                <input value={form.tinNumber} onChange={(e) => setForm({ ...form, tinNumber: e.target.value })} className="input w-full" />
              </div>
              <div>
                <label className="label">Contact Person</label>
                <input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className="input w-full" />
              </div>
              <div>
                <label className="label">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input w-full" />
              </div>
              <div className="col-span-2">
                <label className="label">Email</label>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input w-full" />
              </div>
              <div className="col-span-2">
                <label className="label">Address</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input w-full" />
              </div>
            </div>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'patients' && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Linked Patients ({linkedPatients.length})</h2>
            <div className="flex gap-2">
              <button onClick={() => setShowLinkModal(true)} className="btn btn-primary btn-sm flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5" /> Link Existing
              </button>
              <button onClick={() => setCreateNewOpen(true)} className="btn btn-outline btn-sm flex items-center gap-1.5">
                <UserPlus className="h-3.5 w-3.5" /> Create & Link
              </button>
              <button onClick={fetchLinkedPatients} className="btn btn-outline btn-sm p-2">
                <RefreshCw className={`h-4 w-4 ${patientsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {patientsLoading ? (
            <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>
          ) : linkedPatients.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users className="h-10 w-10 mx-auto mb-2 text-gray-200" />
              <p className="text-sm">No linked patients</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Patient</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600">ID</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Gender</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Phone</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Linked By</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Linked At</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {linkedPatients.map((link) => (
                    <tr key={link.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{link.patient?.name || 'Unknown'}</td>
                      <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">{link.patientId}</td>
                      <td className="px-4 py-2.5 text-gray-600">{link.patient?.gender || '-'}</td>
                      <td className="px-4 py-2.5 text-gray-600">{link.patient?.mobile || '-'}</td>
                      <td className="px-4 py-2.5 text-gray-600">{link.linkedBy?.fullname || 'System'}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{new Date(link.linkedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => handleUnlink(link.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showLinkModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => { setShowLinkModal(false); setPatientSearch(''); setPatientResults([]); }}>
              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
                  <h3 className="text-lg font-bold text-gray-900">Link Existing Patient</h3>
                  <button onClick={() => { setShowLinkModal(false); setPatientSearch(''); setPatientResults([]); }} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="h-5 w-5" /></button>
                </div>
                <div className="p-6">
                  <input value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} placeholder="Search patient by name, ID, or phone..." className="input w-full mb-3" autoFocus />
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {patientResults.map((p) => (
                      <div key={p.id} onClick={() => handleLinkPatient(p.id)} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-blue-50 cursor-pointer border border-gray-100">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.id} · {p.gender || 'N/A'}</p>
                        </div>
                        <button className="text-xs text-blue-600 font-medium">Link</button>
                      </div>
                    ))}
                    {patientSearch && patientResults.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No patients found</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {createNewOpen && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setCreateNewOpen(false)}>
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b">
                  <h3 className="text-lg font-bold text-gray-900">Create & Link Patient</h3>
                  <button onClick={() => setCreateNewOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="h-5 w-5" /></button>
                </div>
                <form onSubmit={handleCreateAndLink} className="p-6 space-y-4">
                  <div>
                    <label className="label">Name *</label>
                    <input value={newPatientForm.name} onChange={(e) => setNewPatientForm({ ...newPatientForm, name: e.target.value })} className="input w-full" required />
                  </div>
                  <div>
                    <label className="label">Date of Birth</label>
                    <input type="date" value={newPatientForm.dob} onChange={(e) => setNewPatientForm({ ...newPatientForm, dob: e.target.value })} className="input w-full" />
                  </div>
                  <div>
                    <label className="label">Gender</label>
                    <select value={newPatientForm.gender} onChange={(e) => setNewPatientForm({ ...newPatientForm, gender: e.target.value })} className="input w-full">
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Phone</label>
                    <input value={newPatientForm.mobile} onChange={(e) => setNewPatientForm({ ...newPatientForm, mobile: e.target.value })} className="input w-full" />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setCreateNewOpen(false)} className="btn btn-outline">Cancel</button>
                    <button type="submit" className="btn btn-primary">Create & Link</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'report' && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Billing Report</h2>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="label">From</label>
              <input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} className="input" />
            </div>
            <button onClick={fetchReport} className="btn btn-primary flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Load Report
            </button>
          </div>

          <div className="flex gap-2 mb-4">
            <button onClick={() => setReportMode('detail')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${reportMode === 'detail' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Detailed</button>
            <button onClick={() => setReportMode('summary')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${reportMode === 'summary' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Summary</button>
          </div>

          {reportLoading ? (
            <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>
          ) : report ? (
            <div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="rounded-xl border bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Patients</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{report.summary.totalPatients}</p>
                </div>
                <div className="rounded-xl border bg-green-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-green-600">Total Billed</p>
                  <p className="mt-1 text-2xl font-bold text-green-700">{formatCurrency(report.summary.totalBilled)}</p>
                </div>
              </div>

              {reportMode === 'detail' ? (
                <div className="space-y-3">
                  {report.patientDetails.map((entry, i) => (
                    <div key={i} className="border rounded-xl overflow-hidden">
                      <div onClick={() => setExpandedPatient(expandedPatient === i ? null : i)} className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{entry.patient.name}</p>
                          <p className="text-xs text-gray-500">{entry.patient.id} · {entry.patient.phone || 'No phone'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-green-700">{formatCurrency(entry.totalAmount)}</span>
                          <span className="text-gray-400">{expandedPatient === i ? '▲' : '▼'}</span>
                        </div>
                      </div>
                      {expandedPatient === i && (
                        <div className="p-4 border-t">
                          {entry.bills.map((bill, bi) => (
                            <div key={bi} className="mb-3 last:mb-0">
                              <p className="text-xs text-gray-500 mb-1">{new Date(bill.date).toLocaleDateString()} · Bill #{bill.billId.slice(0, 8)}</p>
                              <table className="w-full text-xs mb-1">
                                <tbody>
                                  {bill.services.map((svc, si) => (
                                    <tr key={si}>
                                      <td className="py-0.5 text-gray-700">{svc.name}</td>
                                      <td className="py-0.5 text-gray-500 text-right">{svc.quantity}x</td>
                                      <td className="py-0.5 text-gray-900 font-medium text-right">{formatCurrency(svc.price)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <p className="text-xs font-bold text-gray-700 text-right border-t border-gray-100 pt-1">Total: {formatCurrency(bill.billTotal)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {report.patientDetails.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No data for this period</p>}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-2.5 text-left font-semibold text-gray-600">#</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Patient Name</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Patient ID</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Phone</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {report.patientDetails.map((entry, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-gray-500">{i + 1}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-900">{entry.patient.name}</td>
                          <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">{entry.patient.id}</td>
                          <td className="px-4 py-2.5 text-gray-600">{entry.patient.phone || '-'}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-green-700">{formatCurrency(entry.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td colSpan="4" className="px-4 py-2.5 font-bold text-gray-700">Grand Total</td>
                        <td className="px-4 py-2.5 text-right font-bold text-green-700">{formatCurrency(report.summary.totalBilled)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <FileText className="h-10 w-10 mx-auto mb-2 text-gray-200" />
              <p className="text-sm">Select a date range and click "Load Report"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InstitutionDetail;
