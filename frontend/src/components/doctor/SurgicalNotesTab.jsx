import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const SurgicalNotesTab = ({ visit, visitId, patientId, onUpdated }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    surgeryName: '', surgeryDate: '', preoperativeDiagnosis: '', postoperativeDiagnosis: '',
    procedureDescription: '', findings: '', complications: '', estimatedBloodLoss: '',
    anesthesiaType: '', antibiotics: '', followUpInstructions: '', notes: ''
  });

  const fetchRecords = async () => {
    try {
      const res = await api.get(`/specialty/surgical-notes/${patientId}`);
      if (res.data.success) setRecords(res.data.records);
    } catch (err) {
      console.error('Error fetching surgical notes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (patientId) fetchRecords(); }, [patientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/specialty/surgical-notes', { ...form, patientId, visitId });
      if (res.data.success) {
        toast.success('Surgical note saved');
        setShowForm(false);
        setForm({ surgeryName: '', surgeryDate: '', preoperativeDiagnosis: '', postoperativeDiagnosis: '', procedureDescription: '', findings: '', complications: '', estimatedBloodLoss: '', anesthesiaType: '', antibiotics: '', followUpInstructions: '', notes: '' });
        fetchRecords();
        if (onUpdated) onUpdated();
      }
    } catch (err) {
      toast.error('Failed to save surgical note');
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading surgical notes...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Surgical Notes</h3>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: '#2e13d1' }}>
          {showForm ? 'Cancel' : 'Add Note'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="border rounded-lg p-4 mb-6 space-y-4" style={{ borderColor: '#E5E7EB' }}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Surgery Name</label>
              <input type="text" value={form.surgeryName} onChange={(e) => setForm({ ...form, surgeryName: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Surgery Date</label>
              <input type="date" value={form.surgeryDate} onChange={(e) => setForm({ ...form, surgeryDate: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Anesthesia Type</label>
              <select value={form.anesthesiaType} onChange={(e) => setForm({ ...form, anesthesiaType: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }}>
                <option value="">Select...</option>
                <option value="General">General</option>
                <option value="Spinal">Spinal</option>
                <option value="Epidural">Epidural</option>
                <option value="Regional">Regional</option>
                <option value="Local">Local</option>
                <option value="Sedation">Sedation</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Estimated Blood Loss</label>
              <input type="text" value={form.estimatedBloodLoss} onChange={(e) => setForm({ ...form, estimatedBloodLoss: e.target.value })} placeholder="e.g. 200ml" className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Antibiotics Given</label>
              <input type="text" value={form.antibiotics} onChange={(e) => setForm({ ...form, antibiotics: e.target.value })} placeholder="e.g. Ceftriaxone 1g" className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Preoperative Diagnosis</label>
              <textarea value={form.preoperativeDiagnosis} onChange={(e) => setForm({ ...form, preoperativeDiagnosis: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Postoperative Diagnosis</label>
              <textarea value={form.postoperativeDiagnosis} onChange={(e) => setForm({ ...form, postoperativeDiagnosis: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Procedure Description</label>
            <textarea value={form.procedureDescription} onChange={(e) => setForm({ ...form, procedureDescription: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Findings</label>
            <textarea value={form.findings} onChange={(e) => setForm({ ...form, findings: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Complications</label>
            <textarea value={form.complications} onChange={(e) => setForm({ ...form, complications: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Follow-up Instructions</label>
            <textarea value={form.followUpInstructions} onChange={(e) => setForm({ ...form, followUpInstructions: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Additional Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
          </div>
          <button type="submit" className="px-6 py-2 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: '#2e13d1' }}>Save Surgical Note</button>
        </form>
      )}

      {records.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No surgical notes found.</div>
      ) : (
        <div className="space-y-4">
          {records.map((record) => (
            <div key={record.id} className="border rounded-lg p-4" style={{ borderColor: '#E5E7EB' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-base">{record.surgeryName || 'Surgical Note'}</span>
                {record.surgeryDate && <span className="text-sm text-gray-500">- {new Date(record.surgeryDate).toLocaleDateString()}</span>}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {record.preoperativeDiagnosis && <div><span className="font-medium text-gray-600">Pre-op Dx:</span> {record.preoperativeDiagnosis}</div>}
                {record.postoperativeDiagnosis && <div><span className="font-medium text-gray-600">Post-op Dx:</span> {record.postoperativeDiagnosis}</div>}
                {record.anesthesiaType && <div><span className="font-medium text-gray-600">Anesthesia:</span> {record.anesthesiaType}</div>}
                {record.estimatedBloodLoss && <div><span className="font-medium text-gray-600">EBL:</span> {record.estimatedBloodLoss}</div>}
                {record.antibiotics && <div><span className="font-medium text-gray-600">Antibiotics:</span> {record.antibiotics}</div>}
              </div>
              {record.procedureDescription && <div className="mt-2 text-sm"><span className="font-medium text-gray-600">Procedure:</span> {record.procedureDescription}</div>}
              {record.findings && <div className="mt-1 text-sm"><span className="font-medium text-gray-600">Findings:</span> {record.findings}</div>}
              {record.complications && <div className="mt-1 text-sm"><span className="font-medium text-gray-600">Complications:</span> {record.complications}</div>}
              {record.followUpInstructions && <div className="mt-1 text-sm"><span className="font-medium text-gray-600">Follow-up:</span> {record.followUpInstructions}</div>}
              {record.notes && <div className="mt-1 text-sm"><span className="font-medium text-gray-600">Notes:</span> {record.notes}</div>}
              <div className="mt-2 text-xs text-gray-400">Recorded: {new Date(record.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SurgicalNotesTab;
