import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const INTENSITY_OPTIONS = ['LOW', 'MODERATE', 'HIGH'];
const STATUS_OPTIONS = ['ACTIVE', 'COMPLETED', 'DISCONTINUED'];
const EXERCISE_CATEGORIES = [
  'Stretching', 'Strengthening', 'Range of Motion', 'Balance', 'Aerobic',
  'Postural', 'Breathing', 'Manual Therapy', 'Functional Training'
];

const ExerciseRxTab = ({ visit, visitId, patientId, onUpdated }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    exerciseName: '', description: '', category: '', sets: '', reps: '',
    duration: '', frequency: '', intensity: 'MODERATE', instructions: '',
    precautions: '', status: 'ACTIVE', startDate: '', endDate: '', notes: ''
  });

  const fetchRecords = async () => {
    try {
      const res = await api.get(`/specialty/exercise/${patientId}`);
      if (res.data.success) setRecords(res.data.records);
    } catch (err) {
      console.error('Error fetching exercise prescriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (patientId) fetchRecords(); }, [patientId]);

  const resetForm = () => {
    setForm({ exerciseName: '', description: '', category: '', sets: '', reps: '', duration: '', frequency: '', intensity: 'MODERATE', instructions: '', precautions: '', status: 'ACTIVE', startDate: '', endDate: '', notes: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, patientId, visitId };
      if (editingId) {
        await api.put(`/specialty/exercise/${editingId}`, form);
        toast.success('Exercise prescription updated');
      } else {
        await api.post('/specialty/exercise', payload);
        toast.success('Exercise prescription saved');
      }
      resetForm();
      fetchRecords();
      if (onUpdated) onUpdated();
    } catch (err) {
      toast.error('Failed to save exercise prescription');
    }
  };

  const handleEdit = (record) => {
    setForm({
      exerciseName: record.exerciseName, description: record.description || '', category: record.category || '',
      sets: record.sets || '', reps: record.reps || '', duration: record.duration || '',
      frequency: record.frequency || '', intensity: record.intensity || 'MODERATE',
      instructions: record.instructions || '', precautions: record.precautions || '',
      status: record.status, startDate: record.startDate ? record.startDate.split('T')[0] : '',
      endDate: record.endDate ? record.endDate.split('T')[0] : '', notes: record.notes || ''
    });
    setEditingId(record.id);
    setShowForm(true);
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading exercise prescriptions...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Exercise Prescriptions</h3>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="px-4 py-2 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: '#2e13d1' }}>
          {showForm ? 'Cancel' : 'New Prescription'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="border rounded-lg p-4 mb-6 space-y-4" style={{ borderColor: '#E5E7EB' }}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Exercise Name *</label>
              <input type="text" value={form.exerciseName} onChange={(e) => setForm({ ...form, exerciseName: e.target.value })} required className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }}>
                <option value="">Select...</option>
                {EXERCISE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sets</label>
              <input type="number" value={form.sets} onChange={(e) => setForm({ ...form, sets: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Reps</label>
              <input type="number" value={form.reps} onChange={(e) => setForm({ ...form, reps: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Duration (min)</label>
              <input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Frequency</label>
              <input type="text" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} placeholder="e.g. 3x/week" className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Intensity</label>
              <select value={form.intensity} onChange={(e) => setForm({ ...form, intensity: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }}>
                {INTENSITY_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Instructions</label>
            <textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Precautions</label>
            <textarea value={form.precautions} onChange={(e) => setForm({ ...form, precautions: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
          </div>
          <button type="submit" className="px-6 py-2 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: '#2e13d1' }}>
            {editingId ? 'Update' : 'Save'} Prescription
          </button>
        </form>
      )}

      {records.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No exercise prescriptions found.</div>
      ) : (
        <div className="space-y-3">
          {records.map((r) => (
            <div key={r.id} className="border rounded-lg p-4" style={{ borderColor: '#E5E7EB' }}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.exerciseName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      r.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                      r.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>{r.status}</span>
                    {r.intensity && <span className={`text-xs px-2 py-0.5 rounded ${
                      r.intensity === 'HIGH' ? 'bg-red-50 text-red-600' :
                      r.intensity === 'MODERATE' ? 'bg-yellow-50 text-yellow-600' :
                      'bg-green-50 text-green-600'
                    }`}>{r.intensity}</span>}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {r.sets && r.reps && <span>{r.sets} sets x {r.reps} reps</span>}
                    {r.duration && <span className="ml-3">{r.duration} min</span>}
                    {r.frequency && <span className="ml-3">{r.frequency}</span>}
                  </div>
                  {r.description && <div className="text-sm mt-1 text-gray-600">{r.description}</div>}
                  {r.instructions && <div className="text-sm mt-1"><span className="font-medium text-gray-600">Instructions:</span> {r.instructions}</div>}
                  {r.precautions && <div className="text-sm mt-1"><span className="font-medium text-gray-600">Precautions:</span> {r.precautions}</div>}
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

export default ExerciseRxTab;
