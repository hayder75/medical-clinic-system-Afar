import React, { useState, useEffect } from 'react';
import { X, Search, AlertCircle, Calendar as CalendarIcon, Clock } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const ScheduleAppointmentModal = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1: Search Patient, 2: Appointment Details
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    appointmentDate: '',
    appointmentTime: '09:00',
    type: 'CONSULTATION',
    reason: '',
    notes: '',
    duration: '30 minutes'
  });

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setStep(1);
      setSearchQuery('');
      setPatients([]);
      setSelectedPatient(null);
      setFormData({
        appointmentDate: '',
        appointmentTime: '09:00',
        type: 'CONSULTATION',
        reason: '',
        notes: '',
        duration: '30 minutes'
      });
    }
  }, [isOpen]);

  const searchPatients = async () => {
    if (searchQuery.trim().length < 2) {
      return;
    }

    try {
      setSearching(true);
      const response = await api.get(`/patients/search?query=${searchQuery}`);
      console.log('Search response:', response.data);
      // API returns { patients: [...], count: N }
      const patientsList = response.data.patients || response.data || [];
      setPatients(patientsList);
    } catch (error) {
      console.error('Error searching patients:', error);
      console.error('Error details:', error.response?.data);
      toast.error(error.response?.data?.message || error.response?.data?.error || 'Failed to search patients');
      setPatients([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchPatients();
      } else {
        setPatients([]);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  const selectPatient = (patient) => {
    setSelectedPatient(patient);
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }

    if (selectedPatient.cardStatus !== 'ACTIVE') {
      if (!confirm(`Patient's card is ${selectedPatient.cardStatus}. Continue anyway?`)) {
        return;
      }
    }

    try {
      setLoading(true);
      
      const response = await api.post('/appointments', {
        patientId: selectedPatient.id,
        doctorId: user.id, // Current doctor from auth context
        ...formData
      });

      toast.success('Appointment scheduled successfully');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error scheduling appointment:', error);
      toast.error(error.response?.data?.message || 'Failed to schedule appointment');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center" style={{ borderColor: '#E5E7EB' }}>
          <div>
            <h2 className="text-2xl font-bold" style={{ color: '#0C0E0B' }}>Schedule Appointment</h2>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
              {step === 1 ? 'Search and select a patient' : 'Enter appointment details'}
            </p>
          </div>
          <button onClick={onClose}>
            <X className="h-6 w-6" style={{ color: '#6B7280' }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 ? (
            // Step 1: Patient Search
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: '#0C0E0B' }}>
                  Search Patient
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: '#6B7280' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, ID, or phone number..."
                    className="w-full pl-10 pr-4 py-3 border rounded-lg"
                    style={{ borderColor: '#E5E7EB' }}
                    autoFocus
                  />
                </div>
              </div>

              {/* Search Results */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {searching ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#2e13d1' }}></div>
                  </div>
                ) : patients.length > 0 ? (
                  patients.map((patient) => (
                    <div
                      key={patient.id}
                      onClick={() => selectPatient(patient)}
                      className="p-4 border rounded-lg cursor-pointer hover:shadow-md transition"
                      style={{ borderColor: '#E5E7EB' }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-1">
                            <h3 className="font-semibold" style={{ color: '#0C0E0B' }}>
                              {patient.name}
                            </h3>
                            <span className="text-sm" style={{ color: '#6B7280' }}>
                              {patient.id}
                            </span>
                          </div>
                          {patient.mobile && (
                            <p className="text-sm" style={{ color: '#6B7280' }}>
                              {patient.mobile}
                            </p>
                          )}
                          {patient.gender && patient.dob && (
                            <p className="text-sm" style={{ color: '#6B7280' }}>
                              {patient.gender} • {new Date().getFullYear() - new Date(patient.dob).getFullYear()} years
                            </p>
                          )}
                        </div>
                        <span 
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            patient.cardStatus === 'ACTIVE' 
                              ? 'bg-green-100 text-green-800'
                              : patient.cardStatus === 'EXPIRED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {patient.cardStatus}
                        </span>
                      </div>
                    </div>
                  ))
                ) : searchQuery.trim().length >= 2 ? (
                  <div className="text-center py-8" style={{ color: '#6B7280' }}>
                    <p>No patients found</p>
                  </div>
                ) : (
                  <div className="text-center py-8" style={{ color: '#6B7280' }}>
                    <Search className="h-12 w-12 mx-auto mb-2" style={{ color: '#9CA3AF' }} />
                    <p>Type to search for a patient</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Step 2: Appointment Details
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Selected Patient Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold" style={{ color: '#0C0E0B' }}>
                      {selectedPatient.name}
                    </h3>
                    <p className="text-sm" style={{ color: '#6B7280' }}>
                      {selectedPatient.id} • {selectedPatient.mobile}
                    </p>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        selectedPatient.cardStatus === 'ACTIVE' 
                          ? 'bg-green-100 text-green-800'
                          : selectedPatient.cardStatus === 'EXPIRED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        Card: {selectedPatient.cardStatus || 'INACTIVE'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-sm"
                    style={{ color: '#2e13d1' }}
                  >
                    Change
                  </button>
                </div>
                {selectedPatient.cardStatus && selectedPatient.cardStatus !== 'ACTIVE' && (
                  <div className="mt-3 flex items-center space-x-2 text-sm text-yellow-700 bg-yellow-50 p-2 rounded">
                    <AlertCircle className="h-4 w-4" />
                    <span>Patient's card is {selectedPatient.cardStatus}. Please activate before appointment.</span>
                  </div>
                )}
              </div>

              {/* Appointment Date */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#0C0E0B' }}>
                  Appointment Date *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={formData.appointmentDate}
                    onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border rounded-lg"
                    style={{ borderColor: '#E5E7EB' }}
                  />
                </div>
              </div>

              {/* Appointment Time */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#0C0E0B' }}>
                  Appointment Time *
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: '#6B7280' }} />
                  <input
                    type="time"
                    required
                    value={formData.appointmentTime}
                    onChange={(e) => setFormData({ ...formData, appointmentTime: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border rounded-lg"
                    style={{ borderColor: '#E5E7EB' }}
                  />
                </div>
              </div>

              {/* Appointment Type */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#0C0E0B' }}>
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-3 border rounded-lg"
                  style={{ borderColor: '#E5E7EB' }}
                >
                  <option value="CONSULTATION">Consultation</option>
                  <option value="FOLLOW_UP">Follow-up</option>
                </select>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#0C0E0B' }}>
                  Duration
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  className="w-full px-4 py-3 border rounded-lg"
                  style={{ borderColor: '#E5E7EB' }}
                >
                  <option value="15 minutes">15 minutes</option>
                  <option value="30 minutes">30 minutes</option>
                  <option value="45 minutes">45 minutes</option>
                  <option value="1 hour">1 hour</option>
                </select>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#0C0E0B' }}>
                  Reason for Visit
                </label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="e.g., Follow-up checkup, Lab result review"
                  className="w-full px-4 py-3 border rounded-lg"
                  style={{ borderColor: '#E5E7EB' }}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#0C0E0B' }}>
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes or instructions"
                  rows={3}
                  className="w-full px-4 py-3 border rounded-lg"
                  style={{ borderColor: '#E5E7EB' }}
                />
              </div>

              {/* Last Diagnosed By (if available) */}
              {selectedPatient.lastDiagnosedBy && (
                <div className="bg-blue-50 p-3 rounded-lg text-sm">
                  <p style={{ color: '#1E40AF' }}>
                    <span className="font-medium">Last diagnosed by:</span> {selectedPatient.lastDiagnosedBy}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 px-4 py-3 border rounded-lg transition"
                  style={{ borderColor: '#E5E7EB', color: '#0C0E0B' }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 rounded-lg text-white font-medium transition disabled:opacity-50"
                  style={{ backgroundColor: '#2e13d1' }}
                >
                  {loading ? 'Scheduling...' : 'Schedule Appointment'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleAppointmentModal;

