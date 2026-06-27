import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const GrowthChartTab = ({ visit, visitId, patientId, onUpdated }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    recordDate: new Date().toISOString().split('T')[0], weight: '', height: '',
    headCircumference: '', bmi: '', notes: ''
  });

  const fetchRecords = async () => {
    try {
      const res = await api.get(`/specialty/growth/${patientId}`);
      if (res.data.success) setRecords(res.data.records);
    } catch (err) {
      console.error('Error fetching growth records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (patientId) fetchRecords(); }, [patientId]);

  const calculateBMI = (weight, height) => {
    if (!weight || !height) return '';
    const h = parseFloat(height) / 100;
    return (parseFloat(weight) / (h * h)).toFixed(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const bmi = form.bmi || calculateBMI(form.weight, form.height);
      const res = await api.post('/specialty/growth', { ...form, bmi, patientId, visitId });
      if (res.data.success) {
        toast.success('Growth measurement saved');
        setShowForm(false);
        setForm({ recordDate: new Date().toISOString().split('T')[0], weight: '', height: '', headCircumference: '', bmi: '', notes: '' });
        fetchRecords();
        if (onUpdated) onUpdated();
      }
    } catch (err) {
      toast.error('Failed to save growth measurement');
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading growth records...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Growth Measurements</h3>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: '#2e13d1' }}>
          {showForm ? 'Cancel' : 'Add Measurement'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="border rounded-lg p-4 mb-6 space-y-4" style={{ borderColor: '#E5E7EB' }}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input type="date" value={form.recordDate} onChange={(e) => setForm({ ...form, recordDate: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Weight (kg)</label>
              <input type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value, bmi: calculateBMI(e.target.value, form.height) })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Height (cm)</label>
              <input type="number" step="0.1" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value, bmi: calculateBMI(form.weight, e.target.value) })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Head Circumference (cm)</label>
              <input type="number" step="0.1" value={form.headCircumference} onChange={(e) => setForm({ ...form, headCircumference: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">BMI (auto-calculated)</label>
              <input type="text" value={form.bmi} readOnly className="w-full px-3 py-2 border rounded-md text-sm bg-gray-50" style={{ borderColor: '#D1D5DB' }} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
          </div>
          <button type="submit" className="px-6 py-2 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: '#2e13d1' }}>Save Measurement</button>
        </form>
      )}

      {records.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No growth measurements recorded.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Weight (kg)</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Height (cm)</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Head Circ. (cm)</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">BMI</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Notes</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-t" style={{ borderColor: '#E5E7EB' }}>
                  <td className="px-3 py-2">{new Date(r.recordDate).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{r.weight || '-'}</td>
                  <td className="px-3 py-2">{r.height || '-'}</td>
                  <td className="px-3 py-2">{r.headCircumference || '-'}</td>
                  <td className="px-3 py-2">{r.bmi ? r.bmi.toFixed(1) : '-'}</td>
                  <td className="px-3 py-2">{r.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default GrowthChartTab;
