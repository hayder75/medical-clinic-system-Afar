import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const SCORE_TYPES = [
  { id: 'PAIN_SCORE', label: 'Pain Score', defaultMax: 10 },
  { id: 'FUNCTIONAL_STATUS', label: 'Functional Status', defaultMax: 100 },
  { id: 'QUALITY_OF_LIFE', label: 'Quality of Life', defaultMax: 100 },
  { id: 'RANGE_OF_MOTION', label: 'Range of Motion', defaultMax: 100 },
  { id: 'MUSCLE_STRENGTH', label: 'Muscle Strength', defaultMax: 5 },
  { id: 'BALANCE_SCORE', label: 'Balance Score', defaultMax: 100 },
  { id: 'GAIT_SCORE', label: 'Gait Score', defaultMax: 100 },
  { id: 'CUSTOM', label: 'Custom', defaultMax: 100 }
];

const OutcomeScoresTab = ({ visit, visitId, patientId, onUpdated }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    scoreType: '', scoreName: '', scoreValue: '', maxScore: '', notes: '', recordedAt: new Date().toISOString().split('T')[0]
  });

  const fetchRecords = async () => {
    try {
      const res = await api.get(`/specialty/outcome-scores/${patientId}`);
      if (res.data.success) setRecords(res.data.records);
    } catch (err) {
      console.error('Error fetching outcome scores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (patientId) fetchRecords(); }, [patientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/specialty/outcome-scores', { ...form, patientId, visitId });
      if (res.data.success) {
        toast.success('Outcome score saved');
        setShowForm(false);
        setForm({ scoreType: '', scoreName: '', scoreValue: '', maxScore: '', notes: '', recordedAt: new Date().toISOString().split('T')[0] });
        fetchRecords();
        if (onUpdated) onUpdated();
      }
    } catch (err) {
      toast.error('Failed to save outcome score');
    }
  };

  const handleScoreTypeChange = (typeId) => {
    const selected = SCORE_TYPES.find((s) => s.id === typeId);
    setForm({
      ...form, scoreType: typeId,
      scoreName: selected?.id === 'CUSTOM' ? '' : selected?.label,
      maxScore: selected?.defaultMax?.toString() || '',
      scoreValue: ''
    });
  };

  const percentage = form.maxScore && parseFloat(form.maxScore) > 0
    ? ((parseFloat(form.scoreValue || 0) / parseFloat(form.maxScore)) * 100).toFixed(0)
    : null;

  if (loading) return <div className="text-center py-8 text-gray-500">Loading outcome scores...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Outcome Scores</h3>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: '#2e13d1' }}>
          {showForm ? 'Cancel' : 'Add Score'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="border rounded-lg p-4 mb-6 space-y-4" style={{ borderColor: '#E5E7EB' }}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Score Type *</label>
              <select value={form.scoreType} onChange={(e) => handleScoreTypeChange(e.target.value)} required className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }}>
                <option value="">Select type...</option>
                {SCORE_TYPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            {form.scoreType === 'CUSTOM' && (
              <div>
                <label className="block text-sm font-medium mb-1">Score Name *</label>
                <input type="text" value={form.scoreName} onChange={(e) => setForm({ ...form, scoreName: e.target.value })} required className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Score Value *</label>
              <input type="number" step="0.1" value={form.scoreValue} onChange={(e) => setForm({ ...form, scoreValue: e.target.value })} required className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Score</label>
              <input type="number" step="0.1" value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
              {percentage !== null && (
                <div className="mt-1">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="h-2 rounded-full" style={{ width: `${percentage}%`, backgroundColor: percentage > 75 ? '#10B981' : percentage > 50 ? '#F59E0B' : '#EF4444' }} />
                  </div>
                  <span className="text-xs font-medium" style={{ color: percentage > 75 ? '#059669' : percentage > 50 ? '#D97706' : '#DC2626' }}>{percentage}%</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input type="date" value={form.recordedAt} onChange={(e) => setForm({ ...form, recordedAt: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
          </div>
          <button type="submit" className="px-6 py-2 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: '#2e13d1' }}>Save Score</button>
        </form>
      )}

      {records.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No outcome scores recorded.</div>
      ) : (
        <div className="space-y-3">
          {records.map((r) => (
            <div key={r.id} className="border rounded-lg p-4" style={{ borderColor: '#E5E7EB' }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.scoreName || r.scoreType}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{r.scoreType}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-lg font-bold" style={{ color: '#2e13d1' }}>{r.scoreValue}{r.maxScore ? ` / ${r.maxScore}` : ''}</span>
                    {r.percentage !== null && r.percentage !== undefined && (
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div className="h-2 rounded-full" style={{ width: `${r.percentage}%`, backgroundColor: r.percentage > 75 ? '#10B981' : r.percentage > 50 ? '#F59E0B' : '#EF4444' }} />
                        </div>
                        <span className="text-xs font-medium">{r.percentage?.toFixed(0)}%</span>
                      </div>
                    )}
                  </div>
                  {r.notes && <div className="text-sm text-gray-600 mt-1">{r.notes}</div>}
                  <div className="text-xs text-gray-400 mt-1">{new Date(r.recordedAt).toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OutcomeScoresTab;
