import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const BODY_REGIONS = [
  'Head', 'Neck', 'Right Shoulder', 'Left Shoulder', 'Right Arm', 'Left Arm',
  'Right Elbow', 'Left Elbow', 'Right Forearm', 'Left Forearm',
  'Right Wrist', 'Left Wrist', 'Right Hand', 'Left Hand',
  'Chest', 'Abdomen', 'Upper Back', 'Lower Back',
  'Right Hip', 'Left Hip', 'Right Thigh', 'Left Thigh',
  'Right Knee', 'Left Knee', 'Right Leg', 'Left Leg',
  'Right Ankle', 'Left Ankle', 'Right Foot', 'Left Foot'
];

const PAIN_TYPES = ['Sharp', 'Dull', 'Burning', 'Stabbing', 'Aching', 'Throbbing', 'Numbness', 'Tingling'];

const BodyChartTab = ({ visit, visitId, patientId, onUpdated }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [painPoints, setPainPoints] = useState([]);
  const [form, setForm] = useState({ region: '', painType: '', painLevel: '5', notes: '' });
  const canvasRef = useRef(null);

  const fetchRecords = async () => {
    try {
      const res = await api.get(`/specialty/body-chart/${patientId}`);
      if (res.data.success) setRecords(res.data.records);
    } catch (err) {
      console.error('Error fetching body chart records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (patientId) fetchRecords(); }, [patientId]);

  const drawBodyDiagram = (painPointsData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#f0f0f0';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.ellipse(150, 30, 40, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.rect(120, 60, 60, 60);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.rect(110, 120, 80, 120);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.rect(110, 240, 30, 80);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(160, 240, 30, 80);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.rect(100, 320, 50, 100);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(150, 320, 50, 100);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.rect(95, 420, 55, 80);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(150, 420, 55, 80);
    ctx.fill();
    ctx.stroke();

    (painPointsData || []).forEach((p, i) => {
      const colors = ['#EF4444', '#F59E0B', '#3B82F6', '#10B981', '#8B5CF6'];
      ctx.beginPath();
      ctx.arc(150, 30 + i * 50, 8, 0, Math.PI * 2);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#000';
      ctx.font = '10px sans-serif';
      ctx.fillText(`${p.region || ''} (${p.painLevel}/10)`, 165, 34 + i * 50);
    });
  };

  useEffect(() => {
    if (!showForm && records.length > 0) {
      const latest = records[0];
      if (latest.painPoints) drawBodyDiagram(latest.painPoints);
    }
  }, [showForm, records]);

  const addPainPoint = () => {
    if (!form.region) { toast.error('Select a body region'); return; }
    const newPoint = { region: form.region, painType: form.painType, painLevel: form.painLevel, id: Date.now() };
    const updated = [...painPoints, newPoint];
    setPainPoints(updated);
    drawBodyDiagram(updated);
    setForm({ region: '', painType: '', painLevel: '5', notes: form.notes });
  };

  const removePainPoint = (id) => {
    const updated = painPoints.filter((p) => p.id !== id);
    setPainPoints(updated);
    drawBodyDiagram(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/specialty/body-chart', {
        patientId, visitId, diagramData: { bodyRegions: painPoints.map((p) => p.region) },
        painPoints, notes: form.notes
      });
      if (res.data.success) {
        toast.success('Body chart saved');
        setShowForm(false);
        setPainPoints([]);
        setForm({ region: '', painType: '', painLevel: '5', notes: '' });
        fetchRecords();
        if (onUpdated) onUpdated();
      }
    } catch (err) {
      toast.error('Failed to save body chart');
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Loading body chart records...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Body Chart</h3>
        <button onClick={() => { setShowForm(!showForm); setPainPoints([]); }} className="px-4 py-2 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: '#2e13d1' }}>
          {showForm ? 'Cancel' : 'New Assessment'}
        </button>
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-6">
            <div>
              <canvas ref={canvasRef} width={300} height="520" className="border rounded-lg bg-white" style={{ borderColor: '#E5E7EB' }} />
            </div>
            <div className="flex-1 space-y-4">
              <div className="border rounded-lg p-4" style={{ borderColor: '#E5E7EB' }}>
                <h4 className="font-medium text-sm mb-3">Add Pain Point</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Body Region</label>
                    <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }}>
                      <option value="">Select...</option>
                      {BODY_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Pain Type</label>
                    <select value={form.painType} onChange={(e) => setForm({ ...form, painType: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }}>
                      <option value="">Select...</option>
                      {PAIN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Pain Level (1-10)</label>
                    <input type="range" min="1" max="10" value={form.painLevel} onChange={(e) => setForm({ ...form, painLevel: e.target.value })} className="w-full" />
                    <span className="text-sm font-bold">{form.painLevel}/10</span>
                  </div>
                  <div className="flex items-end">
                    <button type="button" onClick={addPainPoint} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Add Point</button>
                  </div>
                </div>
              </div>

              {painPoints.length > 0 && (
                <div className="border rounded-lg p-4" style={{ borderColor: '#E5E7EB' }}>
                  <h4 className="font-medium text-sm mb-2">Pain Points ({painPoints.length})</h4>
                  <div className="space-y-1">
                    {painPoints.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-sm py-1">
                        <span>{p.region} - {p.painType} ({p.painLevel}/10)</span>
                        <button type="button" onClick={() => removePainPoint(p.id)} className="text-red-500 text-xs">Remove</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-md text-sm" style={{ borderColor: '#D1D5DB' }} />
              </div>

              <button type="submit" className="px-6 py-2 rounded-lg text-white font-medium text-sm" style={{ backgroundColor: '#2e13d1' }}>Save Body Chart</button>
            </div>
          </div>
        </form>
      ) : (
        <>
          {records.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No body chart records found.</div>
          ) : (
            <div className="space-y-4">
              {records.map((record) => (
                <div key={record.id} className="border rounded-lg p-4" style={{ borderColor: '#E5E7EB' }}>
                  <h4 className="font-medium mb-2">Body Chart Assessment</h4>
                  {record.painPoints && Array.isArray(record.painPoints) && (
                    <div className="space-y-1 mb-2">
                      {record.painPoints.map((p, i) => (
                        <div key={i} className="text-sm"><span className="font-medium">{p.region}:</span> {p.painType || ''} ({p.painLevel}/10)</div>
                      ))}
                    </div>
                  )}
                  {record.notes && <div className="text-sm"><span className="font-medium text-gray-600">Notes:</span> {record.notes}</div>}
                  <div className="text-xs text-gray-400 mt-2">{new Date(record.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BodyChartTab;
