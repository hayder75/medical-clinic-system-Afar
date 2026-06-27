import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const MILESTONE_CATEGORIES = {
  MOTOR: ['Holds head up', 'Rolls over', 'Sits without support', 'Crawls', 'Stands with support', 'Walks alone', 'Runs', 'Climbs stairs', 'Jumps'],
  SPEECH: ['Coos', 'Babbles', 'Says first word', '2-word phrases', '3-word sentences', 'Tells a story', 'Asks questions'],
  SOCIAL: ['Smiles', 'Recognizes faces', 'Plays peek-a-boo', 'Imitates actions', 'Plays with others', 'Shares toys', 'Follows rules'],
  COGNITIVE: ['Follows objects', 'Reaches for toys', 'Object permanence', 'Sorts shapes', 'Pretend play', 'Counts', 'Knows colors', 'Solves puzzles']
};

const DevelopmentTab = ({ visit, visitId, patientId, onUpdated }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    recordDate: new Date().toISOString().split('T')[0], category: '',
    milestoneName: '', achieved: true, achievedDate: new Date().toISOString().split('T')[0],
    expectedAgeMonths: '', notes: ''
  });

  const fetchRecords = async () => {
    try {
      const res = await api.get(`/specialty/development/${patientId}`);
      if (res.data.success) setRecords(res.data.records);
    } catch (err) {
      console.error('Error fetching milestones:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (patientId) fetchRecords(); }, [patientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/specialty/development', { ...form, patientId, visitId });
      if (res.data.success) {
        toast.success('Milestone saved');
        setShowForm(false);
        setForm({ recordDate: new Date().toISOString().split('T')[0], category: '', milestoneName: '', achieved: true, achievedDate: new Date().toISOString().split('T')[0], expectedAgeMonths: '', notes: '' });
        fetchRecords();
        if (onUpdated) onUpdated();
      }
    } catch (err) {
      toast.error('Failed to save milestone');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this milestone?')) return;
    try {
      await api.delete(`/specialty/development/${id}`);
      toast.success('Milestone deleted');
      fetchRecords();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading development milestones...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Development Milestones</h3>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: '#2e13d1' }}>
          {showForm ? 'Cancel' : 'Add Milestone'}
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
              <label className="block text-sm font-medium mb-1">Category</label>
              <select value={form.category} onChange={(e) => { setForm({ ...form, category: e.target.value, milestoneName: '' }); }} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }}>
                <option value="">Select...</option>
                {Object.keys(MILESTONE_CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Milestone</label>
              {form.category ? (
                <select value={form.milestoneName} onChange={(e) => setForm({ ...form, milestoneName: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }}>
                  <option value="">Select...</option>
                  {MILESTONE_CATEGORIES[form.category]?.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input type="text" value={form.milestoneName} onChange={(e) => setForm({ ...form, milestoneName: e.target.value })} placeholder="Type milestone name" className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Achieved?</label>
              <select value={form.achieved} onChange={(e) => setForm({ ...form, achieved: e.target.value === 'true' })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Expected Age (months)</label>
              <input type="number" value={form.expectedAgeMonths} onChange={(e) => setForm({ ...form, expectedAgeMonths: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
          </div>
          <button type="submit" className="px-6 py-2 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: '#2e13d1' }}>Save Milestone</button>
        </form>
      )}

      {records.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No development milestones recorded.</div>
      ) : (
        <div className="space-y-2">
          {Object.entries(
            records.reduce((acc, r) => {
              const cat = r.category || 'OTHER';
              if (!acc[cat]) acc[cat] = [];
              acc[cat].push(r);
              return acc;
            }, {})
          ).map(([category, items]) => (
            <div key={category} className="mb-4">
              <h4 className="text-sm font-semibold text-gray-600 mb-2 uppercase">{category}</h4>
              <div className="space-y-1">
                {items.map((r) => (
                  <div key={r.id} className="flex items-center justify-between border rounded-lg p-2 pl-3" style={{ borderColor: '#E5E7EB' }}>
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${r.achieved ? 'bg-green-500' : 'bg-yellow-400'}`} />
                      <span className={r.achieved ? '' : 'text-gray-500'}>{r.milestoneName}</span>
                      {r.expectedAgeMonths && <span className="text-xs text-gray-400">({r.expectedAgeMonths} mo)</span>}
                      {!r.achieved && <span className="text-xs text-yellow-600">Not yet achieved</span>}
                    </div>
                    <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700 text-xs ml-2">Delete</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DevelopmentTab;
