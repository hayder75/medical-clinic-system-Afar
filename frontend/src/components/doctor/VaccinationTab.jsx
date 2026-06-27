import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const VACCINE_OPTIONS = [
  'BCG', 'Hepatitis B', 'Pentavalent', 'Polio (OPV)', 'IPV', 'PCV',
  'Rotavirus', 'Measles', 'Rubella', 'MMR', 'HPV', 'Td/Tdap',
  'Yellow Fever', 'Meningococcal', 'Cholera', 'Typhoid', 'Rabies',
  'COVID-19', 'Influenza', 'Varicella', 'Hepatitis A'
];

const VaccinationTab = ({ visit, visitId, patientId, onUpdated }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    vaccineName: '', doseNumber: '', administrationDate: new Date().toISOString().split('T')[0],
    batchNumber: '', manufacturer: '', route: '', site: '', nextDueDate: '', notes: ''
  });

  const fetchRecords = async () => {
    try {
      const res = await api.get(`/specialty/vaccinations/${patientId}`);
      if (res.data.success) setRecords(res.data.records);
    } catch (err) {
      console.error('Error fetching vaccinations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (patientId) fetchRecords(); }, [patientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/specialty/vaccinations', { ...form, patientId, visitId });
      if (res.data.success) {
        toast.success('Vaccination recorded');
        setShowForm(false);
        setForm({ vaccineName: '', doseNumber: '', administrationDate: new Date().toISOString().split('T')[0], batchNumber: '', manufacturer: '', route: '', site: '', nextDueDate: '', notes: '' });
        fetchRecords();
        if (onUpdated) onUpdated();
      }
    } catch (err) {
      toast.error('Failed to record vaccination');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this vaccination record?')) return;
    try {
      await api.delete(`/specialty/vaccinations/${id}`);
      toast.success('Vaccination record deleted');
      fetchRecords();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading vaccination records...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Vaccination Records</h3>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: '#2e13d1' }}>
          {showForm ? 'Cancel' : 'Add Vaccination'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="border rounded-lg p-4 mb-6 space-y-4" style={{ borderColor: '#E5E7EB' }}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Vaccine *</label>
              <select value={form.vaccineName} onChange={(e) => setForm({ ...form, vaccineName: e.target.value })} required className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }}>
                <option value="">Select vaccine...</option>
                {VACCINE_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                <option value="OTHER">Other</option>
              </select>
              {form.vaccineName === 'OTHER' && (
                <input type="text" placeholder="Specify vaccine name" value={form.customVaccine || ''} onChange={(e) => setForm({ ...form, customVaccine: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm mt-1" style={{ borderColor: '#D1D5DB' }} />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Dose #</label>
              <input type="number" value={form.doseNumber} onChange={(e) => setForm({ ...form, doseNumber: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date Administered</label>
              <input type="date" value={form.administrationDate} onChange={(e) => setForm({ ...form, administrationDate: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Batch Number</label>
              <input type="text" value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Manufacturer</label>
              <input type="text" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Route</label>
              <select value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }}>
                <option value="">Select...</option>
                <option value="IM">IM</option>
                <option value="SC">SC</option>
                <option value="ID">ID</option>
                <option value="Oral">Oral</option>
                <option value="Intranasal">Intranasal</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Site</label>
              <select value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }}>
                <option value="">Select...</option>
                <option value="Left Deltoid">Left Deltoid</option>
                <option value="Right Deltoid">Right Deltoid</option>
                <option value="Left Thigh">Left Thigh</option>
                <option value="Right Thigh">Right Thigh</option>
                <option value="Left Gluteal">Left Gluteal</option>
                <option value="Right Gluteal">Right Gluteal</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Next Due Date</label>
              <input type="date" value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
          </div>
          <button type="submit" className="px-6 py-2 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: '#2e13d1' }}>Save Vaccination</button>
        </form>
      )}

      {records.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No vaccination records found.</div>
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id} className="flex items-center justify-between border rounded-lg p-3" style={{ borderColor: '#E5E7EB' }}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.vaccineName}</span>
                  {r.doseNumber && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Dose {r.doseNumber}</span>}
                  <span className="text-sm text-gray-500">{new Date(r.administrationDate).toLocaleDateString()}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {r.batchNumber && <span className="mr-3">Batch: {r.batchNumber}</span>}
                  {r.route && <span className="mr-3">Route: {r.route}</span>}
                  {r.site && <span>Site: {r.site}</span>}
                  {r.nextDueDate && <span className="ml-3">Next: {new Date(r.nextDueDate).toLocaleDateString()}</span>}
                </div>
                {r.notes && <div className="text-xs text-gray-500 mt-1">{r.notes}</div>}
              </div>
              <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700 text-sm ml-2">Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VaccinationTab;
