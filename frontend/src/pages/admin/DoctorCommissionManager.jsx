import React, { useState, useEffect } from 'react';
import { Search, Save, Percent, User, DollarSign, ChevronRight, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const CATEGORY_LABELS = {
  CONSULTATION: 'Consultation',
  LAB: 'Lab Tests',
  RADIOLOGY: 'Radiology',
  PROCEDURE: 'Procedures',
  DENTAL: 'Dental',
  TREATMENT: 'Treatments',
  EMERGENCY_DRUG: 'Emergency Drugs',
  NURSE: 'Nurse Services',
  DOCTOR_WALKIN: 'Walk-in Services',
};

const DoctorCommissionManager = () => {
  const [doctors, setDoctors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [commissions, setCommissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/doctor-commissions');
      setDoctors(res.data.doctors);
      setCategories(res.data.categories);
    } catch (err) {
      toast.error('Failed to load doctors');
    } finally {
      setLoading(false);
    }
  };

  const selectDoctor = async (doc) => {
    setSelectedDoctor(doc);
    try {
      const res = await api.get(`/admin/doctor-commissions/${doc.id}`);
      const map = {};
      res.data.commissions.forEach((c) => {
        map[c.serviceCategory] = c.percentage;
      });
      setCommissions(map);
    } catch (err) {
      toast.error('Failed to load commissions');
    }
  };

  const setPercentage = (category, value) => {
    const num = Math.min(100, Math.max(0, parseFloat(value) || 0));
    setCommissions((prev) => ({ ...prev, [category]: num }));
  };

  const saveCommissions = async () => {
    if (!selectedDoctor) return;
    setSaving(true);
    try {
      const payload = categories.map((cat) => ({
        serviceCategory: cat,
        percentage: commissions[cat] || 0,
      }));
      await api.put(`/admin/doctor-commissions/${selectedDoctor.id}`, { commissions: payload });
      toast.success('Commissions saved');
    } catch (err) {
      toast.error('Failed to save commissions');
    } finally {
      setSaving(false);
    }
  };

  const filteredDoctors = doctors.filter(
    (d) => d.fullname?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#2e13d1' }}></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0C0E0B' }}>Doctor Commissions</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
            Set percentage share for each doctor per service category. Leave at 0% to exclude.
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition"
          style={{ borderColor: '#E5E7EB', color: '#0C0E0B' }}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="flex gap-6" style={{ minHeight: '60vh' }}>
        {/* Doctor List */}
        <div className="w-72 flex-shrink-0">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#6B7280' }} />
            <input
              type="text"
              placeholder="Search doctors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border text-sm"
              style={{ borderColor: '#E5E7EB' }}
            />
          </div>
          <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
            {filteredDoctors.map((doc) => (
              <button
                key={doc.id}
                onClick={() => selectDoctor(doc)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition border-b last:border-b-0 ${
                  selectedDoctor?.id === doc.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-gray-50'
                }`}
                style={{ borderColor: '#E5E7EB' }}
              >
                <User className="h-5 w-5 flex-shrink-0" style={{ color: selectedDoctor?.id === doc.id ? '#4F46E5' : '#6B7280' }} />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{doc.fullname}</div>
                  <div className="text-xs" style={{ color: '#9CA3AF' }}>{doc.qualifications?.join(', ') || 'Doctor'}</div>
                </div>
                <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: '#9CA3AF' }} />
              </button>
            ))}
            {filteredDoctors.length === 0 && (
              <div className="px-4 py-8 text-center text-sm" style={{ color: '#6B7280' }}>No doctors found</div>
            )}
          </div>
        </div>

        {/* Commission Panel */}
        <div className="flex-1 border rounded-lg p-6" style={{ borderColor: '#E5E7EB' }}>
          {!selectedDoctor ? (
            <div className="flex flex-col items-center justify-center h-64 text-center" style={{ color: '#6B7280' }}>
              <Percent className="h-12 w-12 mb-3" />
              <p className="text-lg font-medium">Select a doctor</p>
              <p className="text-sm mt-1">Choose a doctor from the left to set their commission percentages.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6 pb-4 border-b" style={{ borderColor: '#E5E7EB' }}>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: '#0C0E0B' }}>{selectedDoctor.fullname}</h2>
                  {selectedDoctor.consultationFee > 0 && (
                    <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
                      Consultation Fee: {selectedDoctor.consultationFee} ETB
                    </p>
                  )}
                </div>
                <button
                  onClick={saveCommissions}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition disabled:opacity-50"
                  style={{ backgroundColor: '#2e13d1' }}
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

              <div className="space-y-3">
                {categories.map((cat) => {
                  const val = commissions[cat] || 0;
                  return (
                    <div
                      key={cat}
                      className="flex items-center gap-4 p-4 rounded-lg border transition"
                      style={{
                        borderColor: val > 0 ? '#C7D2FE' : '#E5E7EB',
                        backgroundColor: val > 0 ? '#EEF2FF' : '#F9FAFB',
                      }}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium" style={{ color: '#0C0E0B' }}>{CATEGORY_LABELS[cat] || cat}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={val}
                          onChange={(e) => setPercentage(cat, e.target.value)}
                          className="w-20 px-3 py-2 rounded-lg border text-right text-sm font-medium"
                          style={{ borderColor: '#E5E7EB' }}
                        />
                        <span className="text-sm font-bold" style={{ color: '#6B7280' }}>%</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <p className="text-sm font-medium flex items-center gap-2" style={{ color: '#166534' }}>
                  <DollarSign className="h-4 w-4" />
                  Summary
                </p>
                <p className="text-xs mt-1" style={{ color: '#15803D' }}>
                  Active commission categories:{' '}
                  <strong>{categories.filter((c) => (commissions[c] || 0) > 0).length}</strong> of {categories.length}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DoctorCommissionManager;
