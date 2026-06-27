import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const SEVERITY_OPTIONS = ['MILD', 'MODERATE', 'SEVERE'];
const STATUS_OPTIONS = ['ACTIVE', 'IN_REMISSION', 'RESOLVED'];
const COMMON_CHRONIC_DISEASES = [
  'Hypertension', 'Diabetes Mellitus Type 1', 'Diabetes Mellitus Type 2',
  'Asthma', 'COPD', 'Congestive Heart Failure', 'Coronary Artery Disease',
  'Chronic Kidney Disease', 'Hypothyroidism', 'Hyperthyroidism',
  'Rheumatoid Arthritis', 'Osteoarthritis', 'Gout',
  'Epilepsy', 'Parkinson\'s Disease', 'Dementia',
  'Hepatitis B', 'Hepatitis C', 'Cirrhosis',
  'HIV/AIDS', 'Tuberculosis (Latent)', 'Anemia',
  'Peptic Ulcer Disease', 'GERD', 'Irritable Bowel Syndrome',
  'Psoriasis', 'Eczema', 'Systemic Lupus Erythematosus',
  'Glaucoma', 'Cataract', 'Benign Prostatic Hyperplasia'
];

const ChronicDiseaseTab = ({ visit, visitId, patientId, onUpdated }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    diseaseName: '', diagnosisDate: '', severity: 'MILD', status: 'ACTIVE',
    medications: '', notes: ''
  });

  const fetchRecords = async () => {
    try {
      const res = await api.get(`/specialty/chronic-disease/${patientId}`);
      if (res.data.success) setRecords(res.data.records);
    } catch (err) {
      console.error('Error fetching chronic diseases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (patientId) fetchRecords(); }, [patientId]);

  const resetForm = () => {
    setForm({ diseaseName: '', diagnosisDate: '', severity: 'MILD', status: 'ACTIVE', medications: '', notes: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/specialty/chronic-disease/${editingId}`, form);
        toast.success('Chronic disease updated');
      } else {
        await api.post('/specialty/chronic-disease', { ...form, patientId, visitId });
        toast.success('Chronic disease recorded');
      }
      resetForm();
      fetchRecords();
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error('Failed to save chronic disease record');
    }
  };

  const handleEdit = (record) => {
    setForm({
      diseaseName: record.diseaseName, diagnosisDate: record.diagnosisDate ? record.diagnosisDate.split('T')[0] : '',
      severity: record.severity || 'MILD', status: record.status,
      medications: record.medications || '', notes: record.notes || ''
    });
    setEditingId(record.id);
    setShowForm(true);
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading chronic disease records...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Chronic Disease Management</h3>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="px-4 py-2 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: '#2e13d1' }}>
          {showForm ? 'Cancel' : 'Add Condition'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="border rounded-lg p-4 mb-6 space-y-4" style={{ borderColor: '#E5E7EB' }}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Disease *</label>
              <select value={form.diseaseName} onChange={(e) => setForm({ ...form, diseaseName: e.target.value })} required className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }}>
                <option value="">Select disease...</option>
                {COMMON_CHRONIC_DISEASES.map((d) => <option key={d} value={d}>{d}</option>)}
                <option value="OTHER">Other</option>
              </select>
              {form.diseaseName === 'OTHER' && (
                <input type="text" placeholder="Specify disease" value={form.customDisease || ''} onChange={(e) => setForm({ ...form, customDisease: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm mt-1" style={{ borderColor: '#D1D5DB' }} />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Diagnosis Date</label>
              <input type="date" value={form.diagnosisDate} onChange={(e) => setForm({ ...form, diagnosisDate: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Severity</label>
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }}>
                {SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Medications</label>
              <textarea value={form.medications} onChange={(e) => setForm({ ...form, medications: e.target.value })} rows={2} placeholder="Current medications for this condition" className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
          </div>
          <button type="submit" className="px-6 py-2 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: '#2e13d1' }}>
            {editingId ? 'Update' : 'Save'} Condition
          </button>
        </form>
      )}

      {records.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No chronic disease records found.</div>
      ) : (
        <div className="space-y-3">
          {records.map((r) => (
            <div key={r.id} className="border rounded-lg p-4" style={{ borderColor: '#E5E7EB' }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-base">{r.diseaseName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      r.status === 'ACTIVE' ? 'bg-red-100 text-red-800' :
                      r.status === 'IN_REMISSION' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>{r.status}</span>
                    {r.severity && (
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        r.severity === 'SEVERE' ? 'bg-red-50 text-red-600' :
                        r.severity === 'MODERATE' ? 'bg-yellow-50 text-yellow-600' :
                        'bg-green-50 text-green-600'
                      }`}>{r.severity}</span>
                    )}
                  </div>
                  {r.diagnosisDate && <div className="text-xs text-gray-500 mt-1">Diagnosed: {new Date(r.diagnosisDate).toLocaleDateString()}</div>}
                  {r.medications && <div className="text-sm mt-2"><span className="font-medium text-gray-600">Medications:</span> {r.medications}</div>}
                  {r.notes && <div className="text-sm mt-1"><span className="font-medium text-gray-600">Notes:</span> {r.notes}</div>}
                </div>
                <button onClick={() => handleEdit(r)} className="text-blue-600 hover:text-blue-800 text-sm ml-2">Edit</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChronicDiseaseTab;
