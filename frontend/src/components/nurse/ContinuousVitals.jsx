import React, { useState, useEffect } from 'react';
import { 
  Search, 
  User, 
  Heart, 
  Thermometer, 
  Scale, 
  Eye, 
  Clock, 
  Plus,
  Calendar,
  Activity,
  AlertTriangle,
  CheckCircle,
  Bed
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { getVitalSignsWarnings } from '../../utils/medicalStandards';

const ContinuousVitals = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientVisits, setPatientVisits] = useState([]);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [patientVitals, setPatientVitals] = useState([]);
  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Vitals form state
  const [vitalsForm, setVitalsForm] = useState({
    bloodPressure: '',
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    temperature: '',
    tempUnit: 'C',
    heartRate: '',
    respirationRate: '',
    height: '',
    weight: '',
    oxygenSaturation: '',
    condition: '',
    notes: '',
    painScoreRest: '',
    painScoreMovement: '',
    sedationScore: '',
    gcsEyes: '',
    gcsVerbal: '',
    gcsMotor: ''
  });

  const [formErrors, setFormErrors] = useState({});

  // Admitted patients for quick access
  const [admittedPatients, setAdmittedPatients] = useState([]);
  const [allPatientVitals, setAllPatientVitals] = useState({});

  useEffect(() => {
    fetchAdmittedPatients();
    const interval = setInterval(fetchAdmittedPatients, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchAdmittedPatients = async () => {
    try {
      const res = await api.get('/accommodation/admissions?status=ADMITTED');
      if (res.data.success) {
        const unique = [];
        const seen = new Set();
        const patientIds = [];
        res.data.admissions.forEach(adm => {
          if (adm.patient && !seen.has(adm.patient.id)) {
            seen.add(adm.patient.id);
            unique.push({ ...adm.patient, bed: adm.bed, admissionId: adm.id });
            patientIds.push(adm.patient.id);
          }
        });
        setAdmittedPatients(unique);
        // Fetch vitals for all admitted patients
        const vitalsMap = {};
        await Promise.all(patientIds.map(async (pid) => {
          try {
            const vr = await api.get(`/nurses/patient-vitals/${pid}`);
            const vitals = vr.data?.vitals || [];
            if (vitals.length > 0) vitalsMap[pid] = vitals.slice(0, 3); // newest 3 records
          } catch (e) { console.warn('Failed to fetch vitals for', pid, e); }
        }));
        setAllPatientVitals(vitalsMap);
      }
    } catch (e) { console.warn('Failed to fetch admitted patients', e); }
  };

  const age = (dob) => dob ? new Date().getFullYear() - new Date(dob).getFullYear() : 'N/A';

  // Search for patients
  const searchPatients = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const response = await api.get(`/patients/search?query=${encodeURIComponent(searchQuery)}`);
      setSearchResults(response.data.patients || []);
    } catch (error) {
      console.error('Error searching patients:', error);
      toast.error('Failed to search patients');
    } finally {
      setSearchLoading(false);
    }
  };

  // Select a patient
  const selectPatient = async (patient) => {
    setSelectedPatient(patient);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedVisit(null);
    setPatientVitals([]);
    await fetchPatientVisits(patient.id);
  };

  // Fetch all visits for the selected patient
  const fetchPatientVisits = async (patientId) => {
    try {
      setLoading(true);
      const response = await api.get(`/visits/patient/${patientId}`);
      setPatientVisits(response.data.visits || []);
    } catch (error) {
      console.error('Error fetching patient visits:', error);
      toast.error('Failed to fetch patient visits');
    } finally {
      setLoading(false);
    }
  };

  // Select a visit and fetch its vitals
  const selectVisit = async (visit) => {
    setSelectedVisit(visit);
    await fetchVisitVitals(visit.id);
  };

  // Fetch vitals history for selected visit
  const fetchVisitVitals = async (visitId) => {
    try {
      setLoading(true);
      // First check if we can get visit by ID directly
      const response = await api.get(`/nurses/patient-vitals/${selectedPatient.id}`);
      // Filter vitals for this specific visit
      const visitVitals = response.data.vitals?.filter(v => v.visitId === visitId) || [];
      setPatientVitals(visitVitals);
    } catch (error) {
      console.error('Error fetching visit vitals:', error);
      toast.error('Failed to fetch vitals history');
    } finally {
      setLoading(false);
    }
  };

  // Record new vitals
  const recordVitals = async () => {
    try {
      setLoading(true);
      
      // All fields are now optional - no required validation needed
      // Just clear any previous errors
      setFormErrors({});

      const isContinuous = !selectedVisit;
      const vitalsData = {
        patientId: selectedPatient.id,
        ...(selectedVisit ? { visitId: selectedVisit.id } : {}),
        ...vitalsForm,
        // Convert string values to numbers where needed, but only if they have valid values
        temperature: vitalsForm.temperature ? parseFloat(vitalsForm.temperature) : undefined,
        heartRate: vitalsForm.heartRate ? parseInt(vitalsForm.heartRate) : undefined,
        respirationRate: vitalsForm.respirationRate ? parseInt(vitalsForm.respirationRate) : undefined,
        height: vitalsForm.height ? parseFloat(vitalsForm.height) : undefined,
        weight: vitalsForm.weight ? parseFloat(vitalsForm.weight) : undefined,
        oxygenSaturation: vitalsForm.oxygenSaturation ? parseInt(vitalsForm.oxygenSaturation) : undefined,
        painScoreRest: vitalsForm.painScoreRest ? parseInt(vitalsForm.painScoreRest) : undefined,
        painScoreMovement: vitalsForm.painScoreMovement ? parseInt(vitalsForm.painScoreMovement) : undefined,
        sedationScore: vitalsForm.sedationScore ? parseInt(vitalsForm.sedationScore) : undefined,
        gcsEyes: vitalsForm.gcsEyes ? parseInt(vitalsForm.gcsEyes) : undefined,
        gcsVerbal: vitalsForm.gcsVerbal ? parseInt(vitalsForm.gcsVerbal) : undefined,
        gcsMotor: vitalsForm.gcsMotor ? parseInt(vitalsForm.gcsMotor) : undefined,
        bloodPressureSystolic: vitalsForm.bloodPressureSystolic ? parseInt(vitalsForm.bloodPressureSystolic) : undefined,
        bloodPressureDiastolic: vitalsForm.bloodPressureDiastolic ? parseInt(vitalsForm.bloodPressureDiastolic) : undefined
      };

      // Remove null/empty values to avoid validation issues
      Object.keys(vitalsData).forEach(key => {
        if (vitalsData[key] === null || vitalsData[key] === '' || vitalsData[key] === undefined) {
          delete vitalsData[key];
        }
      });

      console.log('Sending vitals data:', vitalsData);
      const endpoint = isContinuous ? '/nurses/continuous-vitals' : '/nurses/vitals';
      await api.post(endpoint, vitalsData);
      
      toast.success('Vitals recorded successfully');
      setShowVitalsForm(false);
      resetVitalsForm();
      // Navigate back to main list
      setSelectedPatient(null);
      setPatientVisits([]);
      setSelectedVisit(null);
      setPatientVitals([]);
      fetchAdmittedPatients();
    } catch (error) {
      console.error('Error recording vitals:', error);
      console.error('Error response:', error.response?.data);
      toast.error(error.response?.data?.error || 'Failed to record vitals');
    } finally {
      setLoading(false);
    }
  };

  const resetVitalsForm = () => {
    setVitalsForm({
      bloodPressure: '',
      bloodPressureSystolic: '',
      bloodPressureDiastolic: '',
      temperature: '',
      tempUnit: 'C',
      heartRate: '',
      respirationRate: '',
      height: '',
      weight: '',
      oxygenSaturation: '',
      condition: '',
      notes: '',
      painScoreRest: '',
      painScoreMovement: '',
      sedationScore: '',
      gcsEyes: '',
      gcsVerbal: '',
      gcsMotor: ''
    });
    setFormErrors({});
  };

  const getVitalStatus = (vital, value) => {
    if (!value) return 'normal';
    
    switch (vital) {
      case 'heartRate':
        return value < 60 || value > 100 ? 'warning' : 'normal';
      case 'temperature':
        return value < 36.1 || value > 37.2 ? 'warning' : 'normal';
      case 'oxygenSaturation':
        return value < 95 ? 'danger' : 'normal';
      case 'bloodPressureSystolic':
        return value < 90 || value > 140 ? 'warning' : 'normal';
      case 'bloodPressureDiastolic':
        return value < 60 || value > 90 ? 'warning' : 'normal';
      default:
        return 'normal';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'normal': return 'text-green-600 bg-green-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'danger': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchPatients();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const getVitalColor = (vital, value) => {
    if (!value) return 'text-gray-600 bg-gray-50';
    switch (vital) {
      case 'heartRate': return value < 60 || value > 100 ? 'text-red-700 bg-red-50' : 'text-green-700 bg-green-50';
      case 'temperature': return value < 36.1 || value > 37.2 ? 'text-red-700 bg-red-50' : 'text-green-700 bg-green-50';
      case 'oxygenSaturation': return value < 95 ? 'text-red-700 bg-red-50 font-bold' : 'text-green-700 bg-green-50';
      case 'bloodPressureSystolic': return value < 90 || value > 140 ? 'text-red-700 bg-red-50' : 'text-green-700 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Continuous Vitals Monitoring</h2>
          <p className="text-sm text-gray-500">Click any admitted patient to record vitals</p>
        </div>
      </div>

      {/* Search bar - always visible at top */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search patients by name or ID..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Search results dropdown */}
      {searchResults.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg divide-y divide-gray-100 max-h-60 overflow-y-auto">
          {searchResults.map((patient) => (
            <div key={patient.id} onClick={() => selectPatient(patient)}
              className="flex items-center gap-3 p-2.5 hover:bg-blue-50 cursor-pointer transition-colors">
              <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-gray-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{patient.name}</p>
                <p className="text-xs text-gray-500">#{patient.id} · {patient.gender} · {age(patient.dob)}y</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main content: admitted patients or selected patient */}
      {selectedPatient ? (
        /* Selected patient detail + back button */
        <div>
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => { setSelectedPatient(null); setSelectedVisit(null); setPatientVitals([]); setShowVitalsForm(false); }}
              className="text-sm text-blue-600 hover:underline">&larr; Back to all patients</button>
          </div>

          {/* Visit cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
            {loading ? (
              <div className="col-span-full text-center py-4 text-sm text-gray-500">Loading visits...</div>
            ) : patientVisits.length > 0 ? (
              patientVisits.map((visit) => (
                <div key={visit.id} onClick={() => selectVisit(visit)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all text-sm ${
                    selectedVisit?.id === visit.id
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-600">{visit.visitUid}</span>
                    {visit.isEmergency && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Emergency</span>}
                  </div>
                  <p className="text-xs text-gray-500">{new Date(visit.date).toLocaleDateString()}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded mt-1 inline-block ${
                    visit.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>{visit.status.replace(/_/g, ' ')}</span>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-4 text-sm text-gray-400">No visits found</div>
            )}
          </div>

          {/* Vitals history */}
          {selectedVisit && patientVitals.length > 0 && (
            <div className="space-y-2 mb-4">
              <h4 className="text-xs font-bold text-gray-500 uppercase">Vitals History ({patientVitals.length})</h4>
              {patientVitals.map((vital, i) => (
                <div key={vital.id} className="border border-gray-100 rounded-lg p-2.5 text-sm">
                  <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
                    <Clock className="h-3 w-3" />
                    {new Date(vital.createdAt).toLocaleString()} · #{patientVitals.length - i}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {vital.heartRate && <span className={`px-2 py-0.5 rounded ${getStatusColor(getVitalStatus('heartRate', vital.heartRate))}`}>HR {vital.heartRate}</span>}
                    {vital.temperature && <span className={`px-2 py-0.5 rounded ${getStatusColor(getVitalStatus('temperature', vital.temperature))}`}>Temp {vital.temperature}°{vital.tempUnit||'C'}</span>}
                    {(vital.bloodPressure || vital.bloodPressureSystolic) && <span className={`px-2 py-0.5 rounded ${getStatusColor(getVitalStatus('bloodPressureSystolic', vital.bloodPressureSystolic))}`}>BP {vital.bloodPressure || `${vital.bloodPressureSystolic}/${vital.bloodPressureDiastolic}`}</span>}
                    {vital.oxygenSaturation && <span className={`px-2 py-0.5 rounded ${getStatusColor(getVitalStatus('oxygenSaturation', vital.oxygenSaturation))}`}>SpO2 {vital.oxygenSaturation}%</span>}
                  </div>
                  {vital.notes && <p className="text-xs text-gray-500 mt-1">{vital.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Admitted patients grid */
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <Bed className="h-4 w-4 text-blue-500" />
              Currently Admitted
            </h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{admittedPatients.length}</span>
          </div>
          {admittedPatients.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {admittedPatients.map((patient) => {
                const lastVitals = allPatientVitals[patient.id];
                const cardActive = patient.cardStatus === 'ACTIVE';
                return (
                <div key={patient.id}
                  onClick={async () => {
                    setSelectedPatient(patient);
                    setSearchQuery('');
                    setSearchResults([]);
                    setSelectedVisit(null);
                    setPatientVitals([]);
                    try { setLoading(true); const res = await api.get(`/nurses/patient-vitals/${patient.id}`); setPatientVitals(res.data?.vitals || []); } catch (e) {}
                    setLoading(false);
                    setShowVitalsForm(true);
                  }}
                  className="relative w-full min-w-0 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md group">
                  <div className={`h-1 rounded-t-xl ${cardActive ? 'bg-blue-500' : 'bg-yellow-500'}`} />
                  <div className={`bg-white rounded-b-xl border border-t-0 shadow-sm p-4 bg-gradient-to-br from-white to-gray-50 ${cardActive ? 'border-gray-200' : 'border-yellow-200'}`}>
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${cardActive ? 'bg-blue-100' : 'bg-yellow-100'}`}>
                          <User className={`h-4 w-4 ${cardActive ? 'text-blue-600' : 'text-yellow-600'}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold text-gray-900 truncate">{patient.name}</p>
                            {!cardActive && <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">NO CARD</span>}
                          </div>
                          <p className="text-[11px] text-gray-500">
                            #{patient.id?.slice(0,12)} · {patient.gender} · {age(patient.dob)}y{patient.bloodType ? ` · ${patient.bloodType}` : ''}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 ${cardActive ? 'bg-blue-50 text-blue-700' : 'bg-yellow-50 text-yellow-700'}`}>
                        {patient.bed?.name}
                      </span>
                    </div>

                    {/* Vitals - flat clean rows, no nested cards, no scroll */}
                    {lastVitals && lastVitals.length > 0 && (
                      <div className="border-t border-gray-100 pt-1.5 mt-1">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Vitals</p>
                        <div>
                          {lastVitals.map((v, idx) => (
                            <div key={v.id || idx} className={`flex items-center gap-1.5 py-1 flex-wrap ${idx > 0 ? 'border-t border-gray-50' : ''}`}>
                              <span className="text-xs font-bold text-gray-400 w-4">#{lastVitals.length - idx}</span>
                              {v.heartRate && <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${getVitalColor('heartRate', v.heartRate)}`}>HR{v.heartRate}</span>}
                              {v.temperature && <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${getVitalColor('temperature', v.temperature)}`}>{v.temperature}°</span>}
                              {v.bloodPressure && <span className="text-xs font-bold px-1.5 py-0.5 rounded text-gray-700 bg-gray-100">BP{v.bloodPressure}</span>}
                              {v.oxygenSaturation && <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${getVitalColor('oxygenSaturation', v.oxygenSaturation)}`}>SpO2{v.oxygenSaturation}</span>}
                              {(v.respirationRate) && <span className="text-xs font-bold px-1.5 py-0.5 rounded text-gray-600 bg-gray-50">RR{v.respirationRate}</span>}
                              {v.condition && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${v.condition === 'Critical' ? 'bg-red-100 text-red-700' : v.condition === 'Deteriorating' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                                  {v.condition}
                                </span>
                              )}
                              <span className="text-[10px] text-gray-400 ml-auto">{new Date(v.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Hover prompt */}
                    <p className="text-[10px] text-blue-500 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity font-medium text-center">
                      Click to record vitals →
                    </p>
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm">
              <Bed className="h-8 w-8 mx-auto mb-2 text-gray-200" />
              No patients currently admitted
            </div>
          )}
        </div>
      )}

      {/* Vitals Form Modal */}
      {showVitalsForm && selectedPatient && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Record Vitals — {selectedPatient.name}</h3>
                  <p className="text-xs text-gray-500">
                    {selectedVisit ? `Visit: ${selectedVisit.visitUid}` : 'Continuous monitoring (no visit)'}
                    · #{selectedPatient.id}
                  </p>
                </div>
                <button onClick={() => { setShowVitalsForm(false); resetVitalsForm(); setSelectedPatient(null); setSelectedVisit(null); setPatientVitals([]); }}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); recordVitals(); }} className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Blood Pressure</label>
                    <input type="text" placeholder="120/80"
                      className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      value={vitalsForm.bloodPressure} onChange={(e) => setVitalsForm({...vitalsForm, bloodPressure: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Temperature</label>
                    <div className="flex gap-1">
                      <input type="number" step="0.1" placeholder="36.5"
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        value={vitalsForm.temperature} onChange={(e) => setVitalsForm({...vitalsForm, temperature: e.target.value})} />
                      <select className="w-14 px-2 py-1.5 text-sm border border-gray-200 rounded-lg outline-none"
                        value={vitalsForm.tempUnit} onChange={(e) => setVitalsForm({...vitalsForm, tempUnit: e.target.value})}>
                        <option value="C">°C</option><option value="F">°F</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Heart Rate</label>
                    <input type="number" placeholder="72"
                      className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={vitalsForm.heartRate} onChange={(e) => setVitalsForm({...vitalsForm, heartRate: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Respiration Rate</label>
                    <input type="number" placeholder="16"
                      className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={vitalsForm.respirationRate} onChange={(e) => setVitalsForm({...vitalsForm, respirationRate: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Oxygen Saturation</label>
                    <input type="number" placeholder="98"
                      className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={vitalsForm.oxygenSaturation} onChange={(e) => setVitalsForm({...vitalsForm, oxygenSaturation: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Condition</label>
                    <select className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none"
                      value={vitalsForm.condition} onChange={(e) => setVitalsForm({...vitalsForm, condition: e.target.value})}>
                      <option value="">Select</option>
                      <option value="Stable">Stable</option>
                      <option value="Critical">Critical</option>
                      <option value="Improving">Improving</option>
                      <option value="Deteriorating">Deteriorating</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <textarea placeholder="Additional observations..."
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" rows="2"
                    value={vitalsForm.notes} onChange={(e) => setVitalsForm({...vitalsForm, notes: e.target.value})} />
                </div>

                {/* Vital warnings */}
                {(() => {
                  const warnings = getVitalSignsWarnings(vitalsForm);
                  return warnings.length > 0 ? (
                    <div className="space-y-1">
                      {warnings.map((w, i) => (
                        <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-sm ${
                          w.status === 'critical' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
                        }`}>
                          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{w.message}</span>
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => { setShowVitalsForm(false); resetVitalsForm(); setSelectedPatient(null); setSelectedVisit(null); setPatientVitals([]); }}
                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
                  <button type="submit" disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {loading ? 'Saving...' : 'Save Vitals'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContinuousVitals;
