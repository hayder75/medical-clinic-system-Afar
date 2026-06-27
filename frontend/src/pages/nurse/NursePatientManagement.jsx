import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search, User, Stethoscope, Calendar, RefreshCw, AlertTriangle,
  ArrowLeftRight, X, Check, Loader
} from 'lucide-react';

const STATUS_LABELS = {
  TRIAGED: 'Triaged',
  WAITING_FOR_DOCTOR: 'Waiting for Doctor',
  IN_DOCTOR_QUEUE: 'In Doctor Queue',
  UNDER_DOCTOR_REVIEW: 'Under Review',
  AWAITING_CARD_BILLING: 'Awaiting Card Payment',
};

const STATUS_COLORS = {
  TRIAGED: 'bg-gray-100 text-gray-700',
  WAITING_FOR_DOCTOR: 'bg-blue-100 text-blue-700',
  IN_DOCTOR_QUEUE: 'bg-yellow-100 text-yellow-700',
  UNDER_DOCTOR_REVIEW: 'bg-purple-100 text-purple-700',
  AWAITING_CARD_BILLING: 'bg-red-100 text-red-700',
};

const calculateAge = (dob) => {
  if (!dob) return 'N/A';
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const NursePatientManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [cardWarning, setCardWarning] = useState(null);

  const fetchPatients = useCallback(async () => {
    try {
      const res = await api.get('/nurses/assigned-patients');
      setPatients(res.data.patients || []);
    } catch (err) {
      toast.error('Failed to load assigned patients');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPatients();
  };

  const openReassignModal = async (patient) => {
    setSelectedPatient(patient);
    setSelectedDoctorId('');
    setReassignReason('');
    setDoctorSearch('');
    setCardWarning(null);
    setShowReassignModal(true);

    try {
      const res = await api.get('/admin/users?role=DOCTOR');
      setDoctors(res.data.users || res.data || []);
    } catch (err) {
      toast.error('Failed to load doctors');
    }
  };

  const handleDoctorSelect = (doctorId) => {
    setSelectedDoctorId(doctorId);
    if (!doctorId || !selectedPatient) {
      setCardWarning(null);
      return;
    }

    const doctor = doctors.find(d => d.id === doctorId);
    if (!doctor) { setCardWarning(null); return; }

    const patientCardType = (selectedPatient.patient?.cardType || 'GENERAL').trim().toUpperCase();
    const newCardType = (doctor.requiredCardType || 'GENERAL').trim().toUpperCase();

    if (newCardType !== patientCardType) {
      setCardWarning({
        message: `Dr. ${doctor.fullname} requires a ${newCardType} card. The patient currently has a ${patientCardType} card. If the prices differ, the patient will need to pay the difference at the billing counter.`,
        type: 'upgrade'
      });
    } else {
      setCardWarning(null);
    }
  };

  const handleReassign = async () => {
    if (!selectedDoctorId) {
      toast.error('Please select a doctor');
      return;
    }

    try {
      setReassigning(true);
      const res = await api.post('/nurses/reassign-doctor', {
        visitId: selectedPatient.id,
        patientId: selectedPatient.patientId,
        toDoctorId: selectedDoctorId,
        reason: reassignReason.trim() || undefined,
      });

      toast.success(res.data.message || 'Patient reassigned successfully');

      if (res.data.cardBilling) {
        toast(`Card billing created: ETB ${res.data.cardBilling.totalAmount}`, { icon: '💰' });
      }

      setShowReassignModal(false);
      fetchPatients();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reassign patient');
    } finally {
      setReassigning(false);
    }
  };

  const filteredPatients = patients.filter(p => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (p.patient?.name || '').toLowerCase().includes(q) ||
      String(p.patient?.id || '').includes(q) ||
      (p.patient?.mobile || '').includes(q) ||
      (p.doctor?.fullname || '').toLowerCase().includes(q)
    );
  });

  const filteredDoctors = doctors.filter(d => {
    if (!doctorSearch) return true;
    const q = doctorSearch.toLowerCase();
    return (d.fullname || '').toLowerCase().includes(q) ||
      (d.requiredCardType || '').toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader className="h-8 w-8 animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full max-w-full overflow-x-hidden">
      {/* Search & Refresh */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by patient name, ID, phone or doctor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Patient count */}
      <p className="text-sm text-gray-500">
        {filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''} assigned
        {searchTerm && ` matching "${searchTerm}"`}
      </p>

      {/* Patient list */}
      {filteredPatients.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <User className="h-12 w-12 mx-auto mb-3" />
          <p>{searchTerm ? 'No patients match your search' : 'No assigned patients found'}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredPatients.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--primary)' }}>
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                        {p.patient?.name || 'Unknown'}
                      </h3>
                      <span className="text-xs text-gray-400">
                        #{p.patient?.id || 'N/A'}
                      </span>
                      {p.patient?.gender && (
                        <span className="text-xs text-gray-500">
                          {calculateAge(p.patient.dob)}y / {p.patient.gender}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Stethoscope className="h-3 w-3" />
                        {p.doctor?.fullname || 'No doctor'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(p.createdAt).toLocaleDateString()}
                      </span>
                      {p.patient?.mobile && (
                        <span>{p.patient.mobile}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-auto">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[p.status] || p.status?.replace(/_/g, ' ')}
                  </span>
                  {p.hasOrders && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                      Orders placed
                    </span>
                  )}
                  <button
                    onClick={() => openReassignModal(p)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ backgroundColor: '#EEF2FF', color: 'var(--primary)' }}
                    title="Reassign to another doctor"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Reassign</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reassign Modal */}
      {showReassignModal && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => !reassigning && setShowReassignModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-auto max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Reassign Doctor</h3>
              <button onClick={() => !reassigning && setShowReassignModal(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Current patient info */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="font-medium text-gray-900">{selectedPatient.patient?.name || 'Unknown Patient'}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Current doctor: <span className="font-medium">{selectedPatient.doctor?.fullname || 'None'}</span>
                  &nbsp;|&nbsp; Status: {STATUS_LABELS[selectedPatient.status] || selectedPatient.status}
                </p>
                {selectedPatient.patient?.cardType && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Patient card: <span className="font-medium">{selectedPatient.patient.cardType}</span>
                  </p>
                )}
              </div>

              {/* Doctor search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Select new doctor *</label>
                <input
                  type="text"
                  placeholder="Search doctors..."
                  value={doctorSearch}
                  onChange={(e) => setDoctorSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                />
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {filteredDoctors.length === 0 ? (
                    <p className="text-sm text-gray-400 p-3 text-center">No doctors found</p>
                  ) : filteredDoctors.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => handleDoctorSelect(doc.id)}
                      className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center justify-between ${
                        selectedDoctorId === doc.id ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Stethoscope className="h-4 w-4 flex-shrink-0 text-gray-400" />
                        <span className="truncate">{doc.fullname}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-400">{doc.requiredCardType || 'GENERAL'}</span>
                        {selectedDoctorId === doc.id && <Check className="h-4 w-4 text-blue-600" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Card price warning */}
              {cardWarning && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">{cardWarning.message}</p>
                  </div>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason (optional)</label>
                <textarea
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="Why is this patient being reassigned?"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowReassignModal(false)}
                disabled={reassigning}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReassign}
                disabled={reassigning || !selectedDoctorId}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors flex items-center gap-2"
                style={{
                  backgroundColor: (reassigning || !selectedDoctorId) ? '#9CA3AF' : 'var(--primary)',
                  cursor: (reassigning || !selectedDoctorId) ? 'not-allowed' : 'pointer'
                }}
              >
                {reassigning ? (
                  <><Loader className="h-4 w-4 animate-spin" /> Reassigning...</>
                ) : (
                  <><ArrowLeftRight className="h-4 w-4" /> Reassign</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NursePatientManagement;
