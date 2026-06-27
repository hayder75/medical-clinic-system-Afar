import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const PregnancyTab = ({ visit, visitId, patientId, onUpdated }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    lmp: '', edd: '', gravida: '', para: '', gestationalAgeWeeks: '',
    bloodPressure: '', weight: '', fundalHeight: '', fetalHeartRate: '',
    presentation: '', ultrasoundFindings: '', complications: '', notes: ''
  });

  const fetchRecords = async () => {
    try {
      const res = await api.get(`/specialty/pregnancy/${patientId}`);
      if (res.data.success) setRecords(res.data.records);
    } catch (err) {
      console.error('Error fetching pregnancy records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (patientId) fetchRecords(); }, [patientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/specialty/pregnancy', { ...form, patientId, visitId });
      if (res.data.success) {
        toast.success('Pregnancy record saved');
        setShowForm(false);
        setForm({ lmp: '', edd: '', gravida: '', para: '', gestationalAgeWeeks: '', bloodPressure: '', weight: '', fundalHeight: '', fetalHeartRate: '', presentation: '', ultrasoundFindings: '', complications: '', notes: '' });
        fetchRecords();
        if (onUpdated) onUpdated();
      }
    } catch (err) {
      toast.error('Failed to save pregnancy record');
    }
  };

  const calculateEDD = (lmp) => {
    if (!lmp) return '';
    const date = new Date(lmp);
    date.setDate(date.getDate() + 280);
    return date.toISOString().split('T')[0];
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading pregnancy records...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Pregnancy Records</h3>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: '#2e13d1' }}>
          {showForm ? 'Cancel' : 'Add Record'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="border rounded-lg p-4 mb-6 space-y-4" style={{ borderColor: '#E5E7EB' }}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">LMP</label>
              <input type="date" value={form.lmp} onChange={(e) => {
                const lmp = e.target.value;
                const edd = lmp ? calculateEDD(lmp) : '';
                setForm({ ...form, lmp, edd });
              }} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">EDD</label>
              <input type="date" value={form.edd} onChange={(e) => setForm({ ...form, edd: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Gestational Age (weeks)</label>
              <input type="number" value={form.gestationalAgeWeeks} onChange={(e) => setForm({ ...form, gestationalAgeWeeks: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Gravida</label>
              <input type="number" value={form.gravida} onChange={(e) => setForm({ ...form, gravida: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Para</label>
              <input type="number" value={form.para} onChange={(e) => setForm({ ...form, para: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Blood Pressure</label>
              <input type="text" value={form.bloodPressure} onChange={(e) => setForm({ ...form, bloodPressure: e.target.value })} placeholder="e.g. 120/80" className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Weight (kg)</label>
              <input type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fundal Height (cm)</label>
              <input type="number" step="0.1" value={form.fundalHeight} onChange={(e) => setForm({ ...form, fundalHeight: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fetal Heart Rate</label>
              <input type="number" value={form.fetalHeartRate} onChange={(e) => setForm({ ...form, fetalHeartRate: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Presentation</label>
              <select value={form.presentation} onChange={(e) => setForm({ ...form, presentation: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }}>
                <option value="">Select...</option>
                <option value="Cephalic">Cephalic</option>
                <option value="Breech">Breech</option>
                <option value="Transverse">Transverse</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Ultrasound Findings</label>
              <textarea value={form.ultrasoundFindings} onChange={(e) => setForm({ ...form, ultrasoundFindings: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Complications</label>
            <textarea value={form.complications} onChange={(e) => setForm({ ...form, complications: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
          </div>
          <button type="submit" className="px-6 py-2 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: '#2e13d1' }}>Save Record</button>
        </form>
      )}

      {records.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No pregnancy records found. Add a new record above.</div>
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <div key={record.id} className="border rounded-lg p-4" style={{ borderColor: '#E5E7EB' }}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {record.lmp && <div><span className="font-medium text-gray-600">LMP:</span> {new Date(record.lmp).toLocaleDateString()}</div>}
                {record.edd && <div><span className="font-medium text-gray-600">EDD:</span> {new Date(record.edd).toLocaleDateString()}</div>}
                {record.gestationalAgeWeeks && <div><span className="font-medium text-gray-600">Gestational Age:</span> {record.gestationalAgeWeeks} wks</div>}
                {record.gravida && <div><span className="font-medium text-gray-600">Gravida:</span> {record.gravida}</div>}
                {record.para && <div><span className="font-medium text-gray-600">Para:</span> {record.para}</div>}
                {record.bloodPressure && <div><span className="font-medium text-gray-600">BP:</span> {record.bloodPressure}</div>}
                {record.weight && <div><span className="font-medium text-gray-600">Weight:</span> {record.weight} kg</div>}
                {record.fundalHeight && <div><span className="font-medium text-gray-600">Fundal Height:</span> {record.fundalHeight} cm</div>}
                {record.fetalHeartRate && <div><span className="font-medium text-gray-600">FHR:</span> {record.fetalHeartRate} bpm</div>}
                {record.presentation && <div><span className="font-medium text-gray-600">Presentation:</span> {record.presentation}</div>}
              </div>
              {record.ultrasoundFindings && <div className="mt-2 text-sm"><span className="font-medium text-gray-600">US Findings:</span> {record.ultrasoundFindings}</div>}
              {record.complications && <div className="mt-1 text-sm"><span className="font-medium text-gray-600">Complications:</span> {record.complications}</div>}
              {record.notes && <div className="mt-1 text-sm"><span className="font-medium text-gray-600">Notes:</span> {record.notes}</div>}
              <div className="mt-2 text-xs text-gray-400">Recorded: {new Date(record.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PregnancyTab;
