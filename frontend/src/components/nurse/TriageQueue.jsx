import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QueueSkeleton } from '../common/Skeleton';
import useSocket from '../../hooks/useSocket';
import { calculateAge } from '../../utils/ageUtils';
import {
  Stethoscope,
  User,
  Clock,
  AlertTriangle,
  CheckCircle,
  UserPlus,
  ChevronDown,
  ChevronRight,
  Heart,
  Thermometer,
  Activity,
  Eye,
  FileText,
  ClipboardList,
  Search,
  Package
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import MaterialNeedsOrdering from './MaterialNeedsOrdering';

const createInitialVitalsData = () => ({
  // Basic Vitals
  bloodPressure: '',
  temperature: '',
  heartRate: '',
  height: '',
  weight: '',
  oxygenSaturation: '',
  bloodType: '',
  condition: '',
  notes: '',

  // Chief Complaint & History (Optional)
  chiefComplaint: '',
  historyOfPresentIllness: '',
  onsetOfSymptoms: '',
  durationOfSymptoms: '',
  severityOfSymptoms: '',
  associatedSymptoms: '',
  relievingFactors: '',
  aggravatingFactors: '',

  // Physical Examination (legacy fields persisted to API)
  generalAppearance: '',
  headAndNeck: '',
  cardiovascularExam: '',
  respiratoryExam: '',
  abdominalExam: '',
  extremities: '',
  neurologicalExam: '',

  // Structured physical assessment UI fields
  generalAppearanceStatus: 'NOT_ASSESSED',
  skinStatus: 'NOT_ASSESSED',
  skinBodyRegions: [],
  skinFindings: '',
  headAndNeckStatus: 'NOT_ASSESSED',
  cardiovascularStatus: 'NOT_ASSESSED',
  respiratoryStatus: 'NOT_ASSESSED',
  abdominalStatus: 'NOT_ASSESSED',
  extremitiesStatus: 'NOT_ASSESSED',
  neurologicalStatus: 'NOT_ASSESSED',
  doctorAlertFlag: false,
  doctorAlertSummary: ''
});

const formatAssessmentText = (status, value, extras = []) => {
  const cleanValue = (value || '').trim();
  const cleanExtras = extras.map((item) => String(item || '').trim()).filter(Boolean);
  const hasAnyContent = cleanValue || cleanExtras.length > 0;

  if (!hasAnyContent && (!status || status === 'NOT_ASSESSED')) return '';

  const lines = [];
  if (status && status !== 'NOT_ASSESSED') {
    lines.push(`Status: ${status}`);
  }
  cleanExtras.forEach((item) => lines.push(item));
  if (cleanValue) {
    lines.push(cleanValue);
  }

  return lines.join('\n');
};

const TriageQueue = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedPatient, setSelectedPatient] = useState(null);

  useSocket({
    onVisitUpdate: () => setRefreshKey(k => k + 1),
    onNewVisit: () => setRefreshKey(k => k + 1),
  });
  const [triageSectionVisibility, setTriageSectionVisibility] = useState(null);
  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [qualificationFilter, setQualificationFilter] = useState('ALL');

  // Nurse service states
  const [nurseServices, setNurseServices] = useState([]);
  const [dentalServices, setDentalServices] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [selectedNurseServices, setSelectedNurseServices] = useState([]); // Changed to array
  const [selectedDentalServices, setSelectedDentalServices] = useState([]); // Array of {serviceId, quantity}
  const [waivedNurseServices, setWaivedNurseServices] = useState(new Set()); // Track waived nurse services
  const [waivedDentalServices, setWaivedDentalServices] = useState(new Set()); // Track waived dental services
  const [selectedNurse, setSelectedNurse] = useState('');
  const [nurseServiceNotes, setNurseServiceNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nurseServiceSearchQuery, setNurseServiceSearchQuery] = useState('');
  const [nurseServiceSearchType, setNurseServiceSearchType] = useState('name'); // 'name' or 'code'
  const [dentalServiceSearchQuery, setDentalServiceSearchQuery] = useState('');
  const [dentalServiceSearchType, setDentalServiceSearchType] = useState('name'); // 'name' or 'code'

  // Section states for button-based interface
  const [activeSection, setActiveSection] = useState('vitals');

  // Section completion tracking
  const [sectionCompletion, setSectionCompletion] = useState({
    vitals: false,
    complaint: false,
    examination: false,
    nurseService: false,
    dentalService: false,
    materialNeeds: false,
    familyPlanning: false,
    assignment: false
  });

  const [vitalsData, setVitalsData] = useState(createInitialVitalsData);

  const isSectionVisible = (sectionKey) => {
    if (!triageSectionVisibility) return true;
    return triageSectionVisibility[sectionKey] !== false;
  };

  const qualifications = [
    { value: 'ALL', label: 'All Qualifications' },
    { value: 'General Doctor', label: 'General Doctor' },
    { value: 'Health Officer', label: 'Health Officer (HO)' },
    { value: 'Dentist', label: 'Dentist' },
    { value: 'Dermatology', label: 'Dermatology' },
    { value: 'Ophthalmologist', label: 'Ophthalmologist' },
    { value: 'Radiologist', label: 'Radiologist' },
    { value: 'Orthodontist', label: 'Orthodontist' },
    { value: 'Periodontist', label: 'Periodontist' },
    { value: 'Endodontist', label: 'Endodontist' },
    { value: 'Cardiologist', label: 'Cardiologist' }
  ];

  useEffect(() => {
    fetchPatients();
    fetchDoctors();
    fetchNurseServices();
    fetchDentalServices();
    fetchNurses();
    fetchTriageVisibility();
  }, [refreshKey]);

  useEffect(() => {
    const handler = (e) => setTriageSectionVisibility(e.detail.config);
    window.addEventListener('nurse-triage-visibility-updated', handler);
    return () => window.removeEventListener('nurse-triage-visibility-updated', handler);
  }, []);

  const fetchTriageVisibility = async () => {
    try {
      const res = await api.get('/admin/system-settings/nurseTriageVisibilityConfig').catch(() => null);
      if (res?.data?.setting?.value) {
        setTriageSectionVisibility(JSON.parse(res.data.setting.value));
      }
    } catch {}
  };

  // Initialize blood type when patient is selected
  useEffect(() => {
    if (selectedPatient?.bloodType && selectedPatient.bloodType !== 'UNKNOWN') {
      setVitalsData(prev => ({
        ...prev,
        bloodType: selectedPatient.bloodType
      }));
    } else {
      setVitalsData(prev => ({
        ...prev,
        bloodType: ''
      }));
    }
  }, [selectedPatient]);

  // Check section completion whenever vitalsData changes
  useEffect(() => {
    checkSectionCompletion();
  }, [vitalsData, selectedDoctor, selectedNurseServices, selectedDentalServices, selectedNurse]);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const response = await api.get('/nurses/queue');
      setPatients(response.data.queue || []);
    } catch (error) {
      toast.error('Failed to fetch patients');
      console.error('Error fetching patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await api.get('/doctors/queue-status');
      const doctorsData = response.data.doctors || [];
      setDoctors(doctorsData);
      // Removed auto-selection - user must manually select a doctor
    } catch (error) {
      toast.error('Failed to fetch doctors');
      console.error('Error fetching doctors:', error);
    }
  };

  const fetchNurseServices = async () => {
    try {
      const response = await api.get('/nurses/services');
      setNurseServices(response.data.services || []);
    } catch (error) {
      toast.error('Failed to fetch nurse services');
      console.error('Error fetching nurse services:', error);
    }
  };

  const fetchDentalServices = async () => {
    try {
      const response = await api.get('/nurses/dental-services');
      setDentalServices(response.data.services || []);
    } catch (error) {
      console.error('Error fetching dental services:', error);
      toast.error('Failed to fetch dental services');
    }
  };

  // Vital signs normal ranges
  const vitalRanges = {
    temperature: { min: 36.1, max: 37.2, unit: '°C', label: 'Temperature' },
    heartRate: { min: 60, max: 100, unit: 'bpm', label: 'Heart Rate' },
    oxygenSaturation: { min: 95, max: 100, unit: '%', label: 'Oxygen Saturation' },
    bloodPressure: { 
      systolic: { min: 90, max: 120 }, 
      diastolic: { min: 60, max: 80 },
      label: 'Blood Pressure' 
    },
    respiratoryRate: { min: 12, max: 20, unit: '/min', label: 'Respiratory Rate' },
    weight: { min: 0, max: 300, unit: 'kg', label: 'Weight' },
    height: { min: 50, max: 220, unit: 'cm', label: 'Height' }
  };

  // Check if a vital sign is abnormal
  const getVitalStatus = (type, value) => {
    const range = vitalRanges[type];
    if (!range || !value) return 'normal';

    const numValue = parseFloat(value);

    switch(type) {
      case 'bloodPressure':
        // Format: "120/80"
        const parts = value.split('/');
        if (parts.length === 2) {
          const systolic = parseFloat(parts[0]);
          const diastolic = parseFloat(parts[1]);
          if (systolic < range.systolic.min || systolic > range.systolic.max || 
              diastolic < range.diastolic.min || diastolic > range.diastolic.max) {
            return 'abnormal';
          }
        }
        return 'normal';
      case 'oxygenSaturation':
        if (numValue < range.min) return 'critical';
        if (numValue < range.min + 2) return 'warning';
        return 'normal';
      case 'temperature':
        if (numValue < range.min || numValue > range.max) return 'abnormal';
        return 'normal';
      case 'heartRate':
      case 'respiratoryRate':
        if (numValue < range.min || numValue > range.max) return 'abnormal';
        return 'normal';
      default:
        return 'normal';
    }
  };

  // Get warning message for abnormal vital
  const getVitalWarning = (type, value) => {
    const range = vitalRanges[type];
    if (!range || !value) return null;
    
    const status = getVitalStatus(type, value);
    if (status === 'normal') return null;

    if (type === 'bloodPressure') {
      return `${range.label}: ${value} is outside normal range (${range.systolic.min}-${range.systolic.max}/${range.diastolic.min}-${range.diastolic.max})`;
    }
    
    const numValue = parseFloat(value);
    let direction = numValue < range.min ? 'low' : 'high';
    return `${range.label}: ${value}${range.unit} is ${direction} (normal: ${range.min}-${range.max}${range.unit})`;
  };

  const fetchNurses = async () => {
    try {
      const response = await api.get('/nurses/nurses');
      setNurses(response.data.nurses || []);
    } catch (error) {
      toast.error('Failed to fetch nurses');
      console.error('Error fetching nurses:', error);
    }
  };

  const checkSectionCompletion = () => {
    // Check if vitals have at least some data filled
    const hasVitalsData = !!(
      vitalsData.bloodPressure ||
      vitalsData.temperature ||
      vitalsData.heartRate ||
      vitalsData.height ||
      vitalsData.weight ||
      vitalsData.oxygenSaturation ||
      vitalsData.condition ||
      vitalsData.notes ||
      vitalsData.bloodType
    );

    // Mandatory vitals: temperature, heart rate, oxygen saturation
    const tempOk = parseFloat(vitalsData.temperature) > 0;
    const hrOk = parseInt(vitalsData.heartRate) > 0;
    const o2Ok = parseInt(vitalsData.oxygenSaturation) > 0;
    const mandatoryVitalsOk = tempOk && hrOk && o2Ok;

    const completion = {
      vitals: hasVitalsData && mandatoryVitalsOk, // Only true if mandatory vitals are filled
      complaint: !!(vitalsData.chiefComplaint || vitalsData.historyOfPresentIllness),
      examination: !!(
        vitalsData.generalAppearance ||
        vitalsData.skinFindings ||
        vitalsData.headAndNeck ||
        vitalsData.cardiovascularExam ||
        vitalsData.respiratoryExam ||
        vitalsData.abdominalExam ||
        vitalsData.extremities ||
        vitalsData.neurologicalExam ||
        vitalsData.doctorAlertSummary ||
        vitalsData.generalAppearanceStatus !== 'NOT_ASSESSED' ||
        vitalsData.skinStatus !== 'NOT_ASSESSED' ||
        vitalsData.headAndNeckStatus !== 'NOT_ASSESSED' ||
        vitalsData.cardiovascularStatus !== 'NOT_ASSESSED' ||
        vitalsData.respiratoryStatus !== 'NOT_ASSESSED' ||
        vitalsData.abdominalStatus !== 'NOT_ASSESSED' ||
        vitalsData.extremitiesStatus !== 'NOT_ASSESSED' ||
        vitalsData.neurologicalStatus !== 'NOT_ASSESSED'
      ),
      nurseService: selectedNurseServices.length > 0 || selectedDentalServices.length > 0, // Check both nurse and dental services
      assignment: !!selectedDoctor && selectedDoctor !== '' // Only true if doctor is actually selected
    };
    setSectionCompletion(completion);
  };

  const toggleSection = (section) => {
    setActiveSection(section);
  };

  const calculateBMI = (height, weight) => {
    if (!height || !weight) return 'N/A';
    const heightInMeters = height / 100;
    const bmi = weight / (heightInMeters * heightInMeters);
    return bmi.toFixed(1);
  };

  const handleServiceToggle = (serviceId) => {
    setSelectedNurseServices(prev => {
      if (prev.includes(serviceId)) {
        return prev.filter(id => id !== serviceId);
      } else {
        return [...prev, serviceId];
      }
    });
  };

  const handleWaiveNurseService = (serviceId, e) => {
    e.stopPropagation(); // Prevent checkbox toggle
    setWaivedNurseServices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId);
      } else {
        newSet.add(serviceId);
      }
      return newSet;
    });
  };

  const handleDentalServiceToggle = (serviceId, service) => {
    setSelectedDentalServices(prev => {
      const existing = prev.find(s => s.serviceId === serviceId);
      if (existing) {
        return prev.filter(s => s.serviceId !== serviceId);
      } else {
        // Add with default quantity of 1
        return [...prev, { serviceId, quantity: 1, service }];
      }
    });
  };

  const updateDentalServiceQuantity = (serviceId, quantity) => {
    setSelectedDentalServices(prev =>
      prev.map(s =>
        s.serviceId === serviceId
          ? { ...s, quantity: Math.max(1, parseInt(quantity) || 1) }
          : s
      )
    );
  };

  const handleWaiveDentalService = (serviceId, e) => {
    e.stopPropagation(); // Prevent checkbox toggle
    setWaivedDentalServices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId);
      } else {
        newSet.add(serviceId);
      }
      return newSet;
    });
  };

  const handleVitalsSubmit = async (e) => {
    e.preventDefault();

    // Check if either doctor assignment or nurse/dental service is completed
    if (!sectionCompletion.assignment && !sectionCompletion.nurseService) {
      toast.error('Please either assign a doctor or select a nurse/dental service');
      return;
    }

    // Prevent multiple submissions
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);

    try {
      // Build vitals payload with only fields that have values
      const vitalsPayload = {
        visitId: selectedPatient.id,
        patientId: selectedPatient.patient.id
      };

      // Only add vitals fields if they have values
      if (vitalsData.bloodPressure) vitalsPayload.bloodPressure = vitalsData.bloodPressure;
      if (vitalsData.temperature) vitalsPayload.temperature = parseFloat(vitalsData.temperature);
      if (vitalsData.heartRate) vitalsPayload.heartRate = parseInt(vitalsData.heartRate);
      if (vitalsData.height) vitalsPayload.height = parseFloat(vitalsData.height);
      if (vitalsData.weight) vitalsPayload.weight = parseFloat(vitalsData.weight);
      if (vitalsData.oxygenSaturation) vitalsPayload.oxygenSaturation = parseInt(vitalsData.oxygenSaturation);
      if (vitalsData.condition) vitalsPayload.condition = vitalsData.condition;
      if (vitalsData.notes) vitalsPayload.notes = vitalsData.notes;

      // Optional complaint fields
      if (vitalsData.chiefComplaint) vitalsPayload.chiefComplaint = vitalsData.chiefComplaint;
      if (vitalsData.historyOfPresentIllness) vitalsPayload.historyOfPresentIllness = vitalsData.historyOfPresentIllness;
      if (vitalsData.onsetOfSymptoms) vitalsPayload.onsetOfSymptoms = vitalsData.onsetOfSymptoms;
      if (vitalsData.durationOfSymptoms) vitalsPayload.durationOfSymptoms = vitalsData.durationOfSymptoms;
      if (vitalsData.severityOfSymptoms) vitalsPayload.severityOfSymptoms = vitalsData.severityOfSymptoms;
      if (vitalsData.associatedSymptoms) vitalsPayload.associatedSymptoms = vitalsData.associatedSymptoms;
      if (vitalsData.relievingFactors) vitalsPayload.relievingFactors = vitalsData.relievingFactors;
      if (vitalsData.aggravatingFactors) vitalsPayload.aggravatingFactors = vitalsData.aggravatingFactors;

      // Optional examination fields (store structured status + notes in existing text columns)
      const generalAppearanceText = formatAssessmentText(
        vitalsData.generalAppearanceStatus,
        vitalsData.generalAppearance
      );
      const skinAndExtremitiesText = formatAssessmentText(
        vitalsData.skinStatus,
        vitalsData.skinFindings,
        [
          vitalsData.skinBodyRegions?.length
            ? `Body Regions: ${vitalsData.skinBodyRegions.join(', ')}`
            : '',
          formatAssessmentText(vitalsData.extremitiesStatus, vitalsData.extremities)
        ]
      );
      const headAndNeckText = formatAssessmentText(
        vitalsData.headAndNeckStatus,
        vitalsData.headAndNeck
      );
      const cardiovascularText = formatAssessmentText(
        vitalsData.cardiovascularStatus,
        vitalsData.cardiovascularExam
      );
      const respiratoryText = formatAssessmentText(
        vitalsData.respiratoryStatus,
        vitalsData.respiratoryExam
      );
      const abdominalText = formatAssessmentText(
        vitalsData.abdominalStatus,
        vitalsData.abdominalExam
      );
      const neuroText = formatAssessmentText(
        vitalsData.neurologicalStatus,
        vitalsData.neurologicalExam
      );

      if (generalAppearanceText) vitalsPayload.generalAppearance = generalAppearanceText;
      if (headAndNeckText) vitalsPayload.headAndNeck = headAndNeckText;
      if (cardiovascularText) vitalsPayload.cardiovascularExam = cardiovascularText;
      if (respiratoryText) vitalsPayload.respiratoryExam = respiratoryText;
      if (abdominalText) vitalsPayload.abdominalExam = abdominalText;
      if (skinAndExtremitiesText) vitalsPayload.extremities = skinAndExtremitiesText;
      if (neuroText) vitalsPayload.neurologicalExam = neuroText;

      if (vitalsData.doctorAlertFlag || vitalsData.doctorAlertSummary?.trim()) {
        const existingNotes = vitalsPayload.notes ? `${vitalsPayload.notes}\n\n` : '';
        const doctorAlertBlock = [
          '[Doctor Alert]',
          `Flagged: ${vitalsData.doctorAlertFlag ? 'YES' : 'NO'}`,
          `Summary: ${(vitalsData.doctorAlertSummary || '').trim() || 'Not provided'}`
        ].join('\n');
        vitalsPayload.notes = `${existingNotes}${doctorAlertBlock}`;
      }

      // Always record vitals to trigger triaging (even with minimal data)
      // This ensures the visit status becomes TRIAGED
      await api.post('/nurses/vitals', vitalsPayload);

      // Handle assignment based on what was selected
      // Auto-select current nurse if nurse services are selected but no nurse is chosen
      let assignedNurseId = selectedNurse;
      if (sectionCompletion.nurseService && (!selectedNurse || selectedNurse === '')) {
        // Get current user info and use their ID as the assigned nurse
        const currentUser = JSON.parse(localStorage.getItem('user'));
        assignedNurseId = currentUser?.id;
        if (assignedNurseId) {
          setSelectedNurse(assignedNurseId);
        }
      }

      // Combine all service IDs (nurse + dental) for submission
      const allServiceIds = [...selectedNurseServices, ...selectedDentalServices.map(s => s.serviceId)];

      // Prepare service quantities array for ALL dental services (always send quantities)
      const serviceQuantities = selectedDentalServices.map(s => ({
        serviceId: s.serviceId,
        quantity: s.quantity || 1
      }));

      // Prepare waived services arrays
      const waivedServiceIds = [
        ...Array.from(waivedNurseServices),
        ...Array.from(waivedDentalServices)
      ];

      // Helper: handle card billing response
      const handleCardBilling = (resp) => {
        if (resp?.cardBilling) {
          toast(
            (t) => (
              <div className="text-left">
                <p className="font-semibold text-orange-600">⚠️ Card Payment Required</p>
                <p className="text-sm mt-1">{resp.message}</p>
                <p className="text-xs mt-2 text-gray-500">Patient must pay {resp.cardBilling.totalAmount} ETB at billing counter.</p>
                <button className="btn btn-sm btn-primary mt-2" onClick={() => toast.dismiss(t.id)}>OK</button>
              </div>
            ),
            { duration: 10000 }
          );
          return true;
        }
        return false;
      };

      // Use combined endpoint if both services and doctor are selected
      if (sectionCompletion.nurseService && sectionCompletion.assignment) {
        const payload = {
          visitId: selectedPatient.id,
          patientId: selectedPatient.patient.id,
          serviceIds: allServiceIds,
          serviceQuantities: serviceQuantities,
          waivedServiceIds: waivedServiceIds,
          doctorId: selectedDoctor,
          notes: nurseServiceNotes
        };

        if (assignedNurseId && assignedNurseId !== '') {
          payload.assignedNurseId = assignedNurseId;
        }

        const resp = (await api.post('/nurses/assign-combined', payload)).data;
        if (!handleCardBilling(resp)) {
          toast.success('Patient processed with services and doctor assignment');
        }
      } else if (sectionCompletion.nurseService) {
        const payload = {
          visitId: selectedPatient.id,
          patientId: selectedPatient.patient.id,
          serviceIds: allServiceIds,
          serviceQuantities: serviceQuantities,
          waivedServiceIds: waivedServiceIds,
          notes: nurseServiceNotes
        };

        if (assignedNurseId && assignedNurseId !== '') {
          payload.assignedNurseId = assignedNurseId;
        }

        await api.post('/nurses/assign-nurse-services', payload);
        const totalServices = selectedNurseServices.length + selectedDentalServices.length;
        toast.success(`${totalServices} service(s) assigned successfully`);
      } else if (sectionCompletion.assignment) {
        const resp = (await api.post('/nurses/assignments', {
          visitId: selectedPatient.id,
          patientId: selectedPatient.patient.id,
          doctorId: selectedDoctor
        })).data;
        if (!handleCardBilling(resp)) {
          toast.success('Doctor assigned successfully');
        }
      }
      setShowVitalsForm(false);
      setSelectedPatient(null);
      setSelectedDoctor('');
      setSelectedNurseServices([]);
      setSelectedDentalServices([]);
      setWaivedNurseServices(new Set());
      setWaivedDentalServices(new Set());
      setSelectedNurse('');
      setNurseServiceNotes('');
      setNurseServiceSearchQuery('');
      setDentalServiceSearchQuery('');

      // Reset form
      setVitalsData(createInitialVitalsData());

      // Reset to first section
      setActiveSection('vitals');

      fetchPatients();
    } catch (error) {
      console.error('Error in triage process:', error);
      toast.error(`Triage failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <QueueSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Triage Queue</h2>
          <p className="text-gray-600">Record patient vitals (optional) and assign doctors</p>
        </div>
        <div className="text-sm text-gray-500">
          {patients.length} patients waiting
        </div>
      </div>

      {/* Patients List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {patients.length > 0 ? (
          patients.map((visit) => (
            <div key={visit.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-primary-600" />
                  </div>
                  <div className="ml-3">
                    <h3 className="font-medium text-gray-900">{visit.patient.name}</h3>
                    <p className="text-sm text-gray-500">ID: {visit.patient.id}</p>
                  </div>
                </div>
                <span className="badge badge-warning">Waiting</span>
              </div>

              <div className="space-y-2 mb-4">
                {visit.patient.dob && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Age:</span>
                    <span className="font-medium">{calculateAge(visit.patient.dob) || 'N/A'}</span>
                  </div>
                )}
                {visit.patient.gender && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Gender:</span>
                    <span className="font-medium capitalize">{visit.patient.gender.toLowerCase()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Type:</span>
                  <span className="font-medium capitalize">{visit.patient.type?.toLowerCase() || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Phone:</span>
                  <span className="font-medium">{visit.patient.mobile || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Arrival Time:</span>
                  <span className="font-medium">
                    {new Date(visit.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setSelectedPatient(visit);
                    setShowVitalsForm(true);
                  }}
                  className="btn btn-primary btn-sm flex items-center"
                >
                  <Stethoscope className="h-4 w-4 mr-1" />
                  Record Vitals
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2">
            <div className="card text-center py-12">
              <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No patients waiting</h3>
              <p className="text-gray-500">All patients have been triaged or there are no new arrivals.</p>
            </div>
          </div>
        )}
      </div>

      {/* Improved Sectioned Vitals Form Modal */}
      {showVitalsForm && selectedPatient && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-start justify-center pt-4">
          <div className="relative mx-auto border w-full max-w-7xl shadow-lg rounded-md bg-white flex flex-col max-h-[90vh]">
            <div className="flex flex-col min-h-0">
              <div className="flex justify-between items-center px-5 py-3 border-b shrink-0">
                <h3 className="text-xl font-semibold text-gray-900">
                  Patient Assessment - {selectedPatient.patient.name}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowVitalsForm(false);
                    // Reset form data when closing
                    setVitalsData({
                      bloodPressure: '',
                      temperature: '',
                      heartRate: '',
                      height: '',
                      weight: '',
                      oxygenSaturation: '',
                      bloodType: '',
                      condition: '',
                      notes: '',
                      chiefComplaint: '',
                      historyOfPresentIllness: '',
                      onsetOfSymptoms: '',
                      durationOfSymptoms: '',
                      severityOfSymptoms: '',
                      associatedSymptoms: '',
                      relievingFactors: '',
                      aggravatingFactors: '',
                      generalAppearance: '',
                      headAndNeck: '',
                      cardiovascularExam: '',
                      respiratoryExam: '',
                      abdominalExam: '',
                      extremities: '',
                      neurologicalExam: '',
                      generalAppearanceStatus: 'NOT_ASSESSED',
                      skinStatus: 'NOT_ASSESSED',
                      skinBodyRegions: [],
                      skinFindings: '',
                      headAndNeckStatus: 'NOT_ASSESSED',
                      cardiovascularStatus: 'NOT_ASSESSED',
                      respiratoryStatus: 'NOT_ASSESSED',
                      abdominalStatus: 'NOT_ASSESSED',
                      extremitiesStatus: 'NOT_ASSESSED',
                      neurologicalStatus: 'NOT_ASSESSED',
                      doctorAlertFlag: false,
                      doctorAlertSummary: ''
                    });
                    setSelectedDoctor('');
                    setSelectedNurseServices([]);
                    setSelectedDentalServices([]);
                    setSelectedNurse('');
                    setNurseServiceNotes('');
                    setNurseServiceSearchQuery('');
                    setDentalServiceSearchQuery('');
                    setActiveSection('vitals');
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl px-2"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleVitalsSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="overflow-y-auto flex-1 p-4">
                {/* Button Tabs for Sections */}
                <div className="sticky top-0 z-10 bg-white pb-1 flex flex-wrap gap-1.5 mb-3">
                  {isSectionVisible('vitals') && (
                    <button type="button" onClick={() => setActiveSection('vitals')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border flex items-center ${activeSection === 'vitals'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : sectionCompletion.vitals ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                    >
                      <Stethoscope className="h-4 w-4 mr-2" /> Vitals
                      {sectionCompletion.vitals && <CheckCircle className="h-4 w-4 ml-2" />}
                    </button>
                  )}
                  {isSectionVisible('complaint') && (
                    <button type="button" onClick={() => setActiveSection('complaint')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border flex items-center ${activeSection === 'complaint'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : sectionCompletion.complaint ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                    >
                      <ClipboardList className="h-4 w-4 mr-2" /> Complaint
                      {sectionCompletion.complaint && <CheckCircle className="h-4 w-4 ml-2" />}
                    </button>
                  )}
                  {isSectionVisible('examination') && (
                    <button type="button" onClick={() => setActiveSection('examination')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border flex items-center ${activeSection === 'examination'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : sectionCompletion.examination ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                    >
                      <Activity className="h-4 w-4 mr-2" /> Examination
                      {sectionCompletion.examination && <CheckCircle className="h-4 w-4 ml-2" />}
                    </button>
                  )}
                  {isSectionVisible('nurseService') && (
                    <button type="button" onClick={() => setActiveSection('nurseService')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border flex items-center ${activeSection === 'nurseService'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : sectionCompletion.nurseService ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                    >
                      <Stethoscope className="h-4 w-4 mr-2" /> Nurse Services
                      {sectionCompletion.nurseService && <CheckCircle className="h-4 w-4 ml-2" />}
                    </button>
                  )}
                  {isSectionVisible('dentalService') && (
                    <button type="button" onClick={() => setActiveSection('dentalService')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border flex items-center ${activeSection === 'dentalService'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : sectionCompletion.dentalService ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                    >
                      <Stethoscope className="h-4 w-4 mr-2" /> Dental Services
                      {sectionCompletion.dentalService && <CheckCircle className="h-4 w-4 ml-2" />}
                    </button>
                  )}
                  {isSectionVisible('materialNeeds') && (
                    <button type="button" onClick={() => setActiveSection('materialNeeds')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border flex items-center ${activeSection === 'materialNeeds'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                    >
                      <Package className="h-4 w-4 mr-2" /> Material Needs
                    </button>
                  )}
                  {isSectionVisible('familyPlanning') && (
                    <button type="button" onClick={() => setActiveSection('familyPlanning')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border flex items-center ${activeSection === 'familyPlanning'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : sectionCompletion.familyPlanning ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                    >
                      <Heart className="h-4 w-4 mr-2" /> Family Planning
                      {sectionCompletion.familyPlanning && <CheckCircle className="h-4 w-4 ml-2" />}
                    </button>
                  )}
                  {isSectionVisible('assignment') && (
                    <button type="button" onClick={() => {
                      const tempOk = parseFloat(vitalsData.temperature) > 0;
                      const hrOk = parseInt(vitalsData.heartRate) > 0;
                      const o2Ok = parseInt(vitalsData.oxygenSaturation) > 0;
                      if (!tempOk || !hrOk || !o2Ok) {
                        const missing = [];
                        if (!tempOk) missing.push('Temperature');
                        if (!hrOk) missing.push('Heart Rate');
                        if (!o2Ok) missing.push('Oxygen Saturation');
                        toast.error(`Please fill mandatory vitals first: ${missing.join(', ')}`);
                        setActiveSection('vitals');
                        return;
                      }
                      setActiveSection('assignment');
                    }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border flex items-center ${activeSection === 'assignment'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : sectionCompletion.assignment ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                    >
                      <User className="h-4 w-4 mr-2" /> Doctor Assignment
                      {sectionCompletion.assignment && <CheckCircle className="h-4 w-4 ml-2" />}
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {/* 1. Record Vitals Section */}
                  {activeSection === 'vitals' && isSectionVisible('vitals') && (
                    <div className="border border-gray-200 rounded-lg p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="label">Blood Pressure</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="120/80"
                            value={vitalsData.bloodPressure}
                            onChange={(e) => setVitalsData({ ...vitalsData, bloodPressure: e.target.value })}
                            required
                          />
                        </div>

                        <div>
                          <label className="label">Temperature (°C) *</label>
                          <input
                            type="number"
                            step="0.1"
                            className="input"
                            placeholder="36.5"
                            value={vitalsData.temperature}
                            onChange={(e) => setVitalsData({ ...vitalsData, temperature: e.target.value })}
                            required
                          />
                          {getVitalWarning('temperature', vitalsData.temperature) && (
                            <p className="text-xs text-red-600 mt-1 font-medium">
                              ⚠️ {getVitalWarning('temperature', vitalsData.temperature)}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="label">Heart Rate (bpm) *</label>
                          <input
                            type="number"
                            className="input"
                            placeholder="72"
                            value={vitalsData.heartRate}
                            onChange={(e) => setVitalsData({ ...vitalsData, heartRate: e.target.value })}
                            required
                          />
                          {getVitalWarning('heartRate', vitalsData.heartRate) && (
                            <p className="text-xs text-red-600 mt-1 font-medium">
                              ⚠️ {getVitalWarning('heartRate', vitalsData.heartRate)}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="label">Height (cm)</label>
                          <input
                            type="number"
                            className="input"
                            placeholder="175"
                            value={vitalsData.height}
                            onChange={(e) => setVitalsData({ ...vitalsData, height: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="label">Weight (kg)</label>
                          <input
                            type="number"
                            step="0.1"
                            className="input"
                            placeholder="70"
                            value={vitalsData.weight}
                            onChange={(e) => setVitalsData({ ...vitalsData, weight: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="label">Oxygen Saturation (%) *</label>
                          <input
                            type="number"
                            className="input"
                            placeholder="98"
                            value={vitalsData.oxygenSaturation}
                            onChange={(e) => setVitalsData({ ...vitalsData, oxygenSaturation: e.target.value })}
                            required
                          />
                          {getVitalWarning('oxygenSaturation', vitalsData.oxygenSaturation) && (
                            <p className="text-xs text-red-600 mt-1 font-medium">
                              ⚠️ {getVitalWarning('oxygenSaturation', vitalsData.oxygenSaturation)}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="label">Blood Type *</label>
                          <select
                            className="input"
                            value={vitalsData.bloodType}
                            onChange={(e) => setVitalsData({ ...vitalsData, bloodType: e.target.value })}
                            required={!selectedPatient?.bloodType || selectedPatient.bloodType === 'UNKNOWN'}
                            disabled={selectedPatient?.bloodType && selectedPatient.bloodType !== 'UNKNOWN'}
                          >
                            <option value="">Select Blood Type</option>
                            <option value="A_PLUS">A+</option>
                            <option value="A_MINUS">A-</option>
                            <option value="B_PLUS">B+</option>
                            <option value="B_MINUS">B-</option>
                            <option value="AB_PLUS">AB+</option>
                            <option value="AB_MINUS">AB-</option>
                            <option value="O_PLUS">O+</option>
                            <option value="O_MINUS">O-</option>
                            <option value="UNKNOWN">Unknown</option>
                          </select>
                          <p className="text-xs text-gray-500 mt-1">
                            💡 Check the patient's ID card for blood type. This information will be permanently saved to the patient's record and will persist across all future visits.
                          </p>
                          {selectedPatient?.bloodType && selectedPatient.bloodType !== 'UNKNOWN' && (
                            <p className="text-xs text-green-600 mt-1 font-medium">
                              ✅ Patient's blood type is already recorded: {selectedPatient.bloodType.replace('_', '+').replace('PLUS', '+').replace('MINUS', '-')}
                            </p>
                          )}
                          {selectedPatient?.bloodType === 'UNKNOWN' && (
                            <p className="text-xs text-yellow-600 mt-1 font-medium">
                              ⚠️ Patient's blood type is marked as UNKNOWN. You can update it now.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="label">Condition *</label>
                        <select
                          className="input"
                          value={vitalsData.condition}
                          onChange={(e) => setVitalsData({ ...vitalsData, condition: e.target.value })}
                          required
                        >
                          <option value="">Select Condition</option>
                          <option value="Critical">Critical</option>
                          <option value="Urgent">Urgent</option>
                          <option value="Stable">Stable</option>
                          <option value="Good">Good</option>
                        </select>
                      </div>

                      <div className="mt-4">
                        <label className="label">Notes</label>
                        <textarea
                          className="input"
                          rows="3"
                          placeholder="Additional observations..."
                          value={vitalsData.notes}
                          onChange={(e) => setVitalsData({ ...vitalsData, notes: e.target.value })}
                        />
                      </div>

                      {vitalsData.height && vitalsData.weight && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-800">
                            <strong>BMI:</strong> {calculateBMI(vitalsData.height, vitalsData.weight)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2. Chief Complaint & History Section */}
                  {activeSection === 'complaint' && isSectionVisible('complaint') && (
                    <div className="border border-gray-200 rounded-lg p-6">
                      <div className="space-y-4">
                        <div>
                          <label className="label">Chief Complaint</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="Primary reason for visit (e.g., chest pain, headache, fever)"
                            value={vitalsData.chiefComplaint}
                            onChange={(e) => setVitalsData({ ...vitalsData, chiefComplaint: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="label">History of Present Illness</label>
                          <textarea
                            className="input"
                            rows="3"
                            placeholder="Detailed description of current symptoms, when they started, how they've progressed"
                            value={vitalsData.historyOfPresentIllness}
                            onChange={(e) => setVitalsData({ ...vitalsData, historyOfPresentIllness: e.target.value })}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="label">Onset of Symptoms</label>
                            <input
                              type="text"
                              className="input"
                              placeholder="e.g., Sudden, Gradual, After trauma"
                              value={vitalsData.onsetOfSymptoms}
                              onChange={(e) => setVitalsData({ ...vitalsData, onsetOfSymptoms: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="label">Duration</label>
                            <input
                              type="text"
                              className="input"
                              placeholder="e.g., 2 hours, 3 days, 1 week"
                              value={vitalsData.durationOfSymptoms}
                              onChange={(e) => setVitalsData({ ...vitalsData, durationOfSymptoms: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="label">Severity (1-10 scale)</label>
                            <input
                              type="text"
                              className="input"
                              placeholder="e.g., 7/10, Moderate, Severe"
                              value={vitalsData.severityOfSymptoms}
                              onChange={(e) => setVitalsData({ ...vitalsData, severityOfSymptoms: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="label">Associated Symptoms</label>
                            <input
                              type="text"
                              className="input"
                              placeholder="e.g., nausea, dizziness, shortness of breath"
                              value={vitalsData.associatedSymptoms}
                              onChange={(e) => setVitalsData({ ...vitalsData, associatedSymptoms: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="label">Relieving Factors</label>
                            <input
                              type="text"
                              className="input"
                              placeholder="e.g., rest, medication, position"
                              value={vitalsData.relievingFactors}
                              onChange={(e) => setVitalsData({ ...vitalsData, relievingFactors: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="label">Aggravating Factors</label>
                            <input
                              type="text"
                              className="input"
                              placeholder="e.g., movement, stress, certain foods"
                              value={vitalsData.aggravatingFactors}
                              onChange={(e) => setVitalsData({ ...vitalsData, aggravatingFactors: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. Physical Examination Section */}
                  {activeSection === 'examination' && isSectionVisible('examination') && (
                    <div className="border border-gray-200 rounded-lg p-6">
                      <div className="space-y-4">
                        <div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="label">General Appearance Status</label>
                              <select
                                className="input"
                                value={vitalsData.generalAppearanceStatus}
                                onChange={(e) => setVitalsData({ ...vitalsData, generalAppearanceStatus: e.target.value })}
                              >
                                <option value="NOT_ASSESSED">Not Assessed</option>
                                <option value="NORMAL">Normal</option>
                                <option value="ABNORMAL">Abnormal</option>
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className="label">General Appearance Notes</label>
                              <input
                                type="text"
                                className="input"
                                placeholder="Distress level, alertness, cooperation"
                                value={vitalsData.generalAppearance}
                                onChange={(e) => setVitalsData({ ...vitalsData, generalAppearance: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="label">Skin Status</label>
                            <select
                              className="input"
                              value={vitalsData.skinStatus}
                              onChange={(e) => setVitalsData({ ...vitalsData, skinStatus: e.target.value })}
                            >
                              <option value="NOT_ASSESSED">Not Assessed</option>
                              <option value="NORMAL">Normal</option>
                              <option value="ABNORMAL">Abnormal</option>
                            </select>
                          </div>
                          <div>
                            <label className="label">Skin Body Regions</label>
                            <div className="grid grid-cols-2 gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50">
                              {['Head/Face', 'Neck', 'Chest', 'Back', 'Abdomen', 'Upper Limbs', 'Lower Limbs', 'Generalized'].map((region) => (
                                <label key={region} className="flex items-center space-x-2 text-sm text-gray-700">
                                  <input
                                    type="checkbox"
                                    checked={vitalsData.skinBodyRegions.includes(region)}
                                    onChange={(e) => {
                                      const nextRegions = e.target.checked
                                        ? [...vitalsData.skinBodyRegions, region]
                                        : vitalsData.skinBodyRegions.filter((item) => item !== region);
                                      setVitalsData({ ...vitalsData, skinBodyRegions: nextRegions });
                                    }}
                                  />
                                  <span>{region}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="label">Skin Findings</label>
                          <textarea
                            className="input"
                            rows="2"
                            placeholder="Rash, lesions, wounds, edema, discoloration"
                            value={vitalsData.skinFindings}
                            onChange={(e) => setVitalsData({ ...vitalsData, skinFindings: e.target.value })}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="label">Head & Neck Status</label>
                            <select
                              className="input"
                              value={vitalsData.headAndNeckStatus}
                              onChange={(e) => setVitalsData({ ...vitalsData, headAndNeckStatus: e.target.value })}
                            >
                              <option value="NOT_ASSESSED">Not Assessed</option>
                              <option value="NORMAL">Normal</option>
                              <option value="ABNORMAL">Abnormal</option>
                            </select>
                          </div>
                          <div>
                            <label className="label">Head & Neck Notes</label>
                            <textarea
                              className="input"
                              rows="2"
                              placeholder="Eyes, ears, nose, throat, lymph nodes"
                              value={vitalsData.headAndNeck}
                              onChange={(e) => setVitalsData({ ...vitalsData, headAndNeck: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="label">Cardiovascular Status</label>
                            <select
                              className="input"
                              value={vitalsData.cardiovascularStatus}
                              onChange={(e) => setVitalsData({ ...vitalsData, cardiovascularStatus: e.target.value })}
                            >
                              <option value="NOT_ASSESSED">Not Assessed</option>
                              <option value="NORMAL">Normal</option>
                              <option value="ABNORMAL">Abnormal</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="label">Cardiovascular Notes</label>
                            <textarea
                              className="input"
                              rows="2"
                              placeholder="Heart sounds, murmurs, pulses, JVD"
                              value={vitalsData.cardiovascularExam}
                              onChange={(e) => setVitalsData({ ...vitalsData, cardiovascularExam: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="label">Respiratory Status</label>
                            <select
                              className="input"
                              value={vitalsData.respiratoryStatus}
                              onChange={(e) => setVitalsData({ ...vitalsData, respiratoryStatus: e.target.value })}
                            >
                              <option value="NOT_ASSESSED">Not Assessed</option>
                              <option value="NORMAL">Normal</option>
                              <option value="ABNORMAL">Abnormal</option>
                            </select>
                          </div>
                          <div>
                            <label className="label">Abdominal Status</label>
                            <select
                              className="input"
                              value={vitalsData.abdominalStatus}
                              onChange={(e) => setVitalsData({ ...vitalsData, abdominalStatus: e.target.value })}
                            >
                              <option value="NOT_ASSESSED">Not Assessed</option>
                              <option value="NORMAL">Normal</option>
                              <option value="ABNORMAL">Abnormal</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="label">Respiratory Notes</label>
                            <textarea
                              className="input"
                              rows="2"
                              placeholder="Lung sounds, chest expansion, percussion"
                              value={vitalsData.respiratoryExam}
                              onChange={(e) => setVitalsData({ ...vitalsData, respiratoryExam: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="label">Abdominal Notes</label>
                            <textarea
                              className="input"
                              rows="2"
                              placeholder="Inspection, palpation, percussion, auscultation"
                              value={vitalsData.abdominalExam}
                              onChange={(e) => setVitalsData({ ...vitalsData, abdominalExam: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="label">Extremities Status</label>
                            <select
                              className="input"
                              value={vitalsData.extremitiesStatus}
                              onChange={(e) => setVitalsData({ ...vitalsData, extremitiesStatus: e.target.value })}
                            >
                              <option value="NOT_ASSESSED">Not Assessed</option>
                              <option value="NORMAL">Normal</option>
                              <option value="ABNORMAL">Abnormal</option>
                            </select>
                          </div>
                          <div>
                            <label className="label">Neurological Status</label>
                            <select
                              className="input"
                              value={vitalsData.neurologicalStatus}
                              onChange={(e) => setVitalsData({ ...vitalsData, neurologicalStatus: e.target.value })}
                            >
                              <option value="NOT_ASSESSED">Not Assessed</option>
                              <option value="NORMAL">Normal</option>
                              <option value="ABNORMAL">Abnormal</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="label">Extremities Notes</label>
                            <textarea
                              className="input"
                              rows="2"
                              placeholder="Edema, pulses, range of motion, deformities"
                              value={vitalsData.extremities}
                              onChange={(e) => setVitalsData({ ...vitalsData, extremities: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="label">Neurological Notes</label>
                            <textarea
                              className="input"
                              rows="2"
                              placeholder="Mental status, cranial nerves, motor, sensory, reflexes"
                              value={vitalsData.neurologicalExam}
                              onChange={(e) => setVitalsData({ ...vitalsData, neurologicalExam: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="border border-amber-200 rounded-lg bg-amber-50 p-4">
                          <label className="flex items-center space-x-2 mb-2">
                            <input
                              type="checkbox"
                              checked={vitalsData.doctorAlertFlag}
                              onChange={(e) => setVitalsData({ ...vitalsData, doctorAlertFlag: e.target.checked })}
                            />
                            <span className="text-sm font-medium text-amber-900">Flag important finding for doctor review</span>
                          </label>
                          <textarea
                            className="input"
                            rows="2"
                            placeholder="What should the doctor pay immediate attention to?"
                            value={vitalsData.doctorAlertSummary}
                            onChange={(e) => setVitalsData({ ...vitalsData, doctorAlertSummary: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4. Nurse Service Section */}
                  {activeSection === 'nurseService' && isSectionVisible('nurseService') && (
                    <div className="border border-gray-200 rounded-lg p-6">
                      <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <p className="text-sm text-blue-800">
                            <strong>Note:</strong> Select a nurse service if the patient needs a service that can be provided by a nurse without requiring a doctor consultation.
                          </p>
                        </div>

                        {/* Nurse Service Search */}
                        <div>
                          <label className="label">Search Nurse Services</label>
                          <div className="flex space-x-2 mb-3">
                            <div className="flex-1 relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                              <input
                                type="text"
                                className="input pl-10"
                                placeholder={`Search by ${nurseServiceSearchType === 'name' ? 'service name' : 'service code'}...`}
                                value={nurseServiceSearchQuery}
                                onChange={(e) => setNurseServiceSearchQuery(e.target.value)}
                              />
                            </div>
                            <select
                              className="input w-32"
                              value={nurseServiceSearchType}
                              onChange={(e) => setNurseServiceSearchType(e.target.value)}
                            >
                              <option value="name">By Name</option>
                              <option value="code">By Code</option>
                            </select>
                          </div>
                        </div>

                        {/* Nurse Services List */}
                        <div>
                          <label className="label">Select Nurse Services</label>
                          <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
                            {nurseServices
                              .filter(service => {
                                if (!nurseServiceSearchQuery) return true;
                                const query = nurseServiceSearchQuery.toLowerCase();
                                if (nurseServiceSearchType === 'name') {
                                  return service.name.toLowerCase().includes(query);
                                } else {
                                  return service.code.toLowerCase().includes(query);
                                }
                              })
                              .map(service => {
                                const isSelected = selectedNurseServices.includes(service.id);
                                const isWaived = waivedNurseServices.has(service.id);
                                const isFree = service.price === 0 || service.price === null;
                                const displayPrice = isWaived ? 0 : (service.price || 0);

                                return (
                                  <div key={service.id} className={`flex items-start space-x-3 hover:bg-gray-50 p-2 rounded border ${isSelected ? 'border-blue-300 bg-blue-50' : 'border-transparent'}`}>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => handleServiceToggle(service.id)}
                                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <div className={`text-sm font-medium ${isWaived ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                          {service.name}
                                        </div>
                                        {isWaived && (
                                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            WAIVED
                                          </span>
                                        )}
                                        {isFree && !isWaived && (
                                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                            FREE
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {service.code} {service.description ? `- ${service.description}` : ''}
                                      </div>
                                      <div className={`text-sm font-semibold mt-1 ${isWaived ? 'text-green-600' : 'text-gray-900'}`}>
                                        ETB {displayPrice.toLocaleString()}
                                      </div>
                                    </div>
                                    {isSelected && !isFree && (
                                      <button
                                        type="button"
                                        onClick={(e) => handleWaiveNurseService(service.id, e)}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${isWaived
                                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                          : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                          }`}
                                      >
                                        {isWaived ? 'Unwaive' : 'Waive'}
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            {nurseServices.filter(service => {
                              if (!nurseServiceSearchQuery) return true;
                              const query = nurseServiceSearchQuery.toLowerCase();
                              if (nurseServiceSearchType === 'name') {
                                return service.name.toLowerCase().includes(query);
                              } else {
                                return service.code.toLowerCase().includes(query);
                              }
                            }).length === 0 && (
                                <p className="text-sm text-gray-500 text-center py-2">No nurse services found</p>
                              )}
                          </div>
                          {selectedNurseServices.length > 0 && (
                            <p className="text-sm text-gray-600 mt-2">
                              Selected {selectedNurseServices.length} nurse service(s)
                            </p>
                          )}
                        </div>

                        {selectedNurseServices.length > 0 && (
                          <div>
                            <label className="label">Assign to Nurse</label>
                            <select
                              className="input"
                              value={selectedNurse}
                              onChange={(e) => setSelectedNurse(e.target.value)}
                            >
                              <option value="">Auto-assign to current nurse</option>
                              {nurses.map(nurse => (
                                <option key={nurse.id} value={nurse.id}>
                                  {nurse.fullname} ({nurse.username})
                                </option>
                              ))}
                            </select>
                            {!selectedNurse && (
                              <p className="text-sm text-gray-600 mt-1">
                                If no nurse is selected, the current nurse will be automatically assigned
                              </p>
                            )}
                          </div>
                        )}

                        {selectedNurseServices.length > 0 && selectedNurse && (
                          <div>
                            <label className="label">Service Notes (Optional)</label>
                            <textarea
                              className="input"
                              rows={3}
                              value={nurseServiceNotes}
                              onChange={(e) => setNurseServiceNotes(e.target.value)}
                              placeholder="Any specific instructions or notes for this service..."
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 5. Dental Service Section */}
                  {activeSection === 'dentalService' && isSectionVisible('dentalService') && (
                    <div className="border border-gray-200 rounded-lg p-6">
                      <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <p className="text-sm text-blue-800">
                            <strong>Note:</strong> Select a dental service if the patient needs dental treatment.
                          </p>
                        </div>

                        {/* Dental Service Search */}
                        <div>
                          <label className="label">Search Dental Services</label>
                          <div className="flex space-x-2 mb-3">
                            <div className="flex-1 relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                              <input
                                type="text"
                                className="input pl-10"
                                placeholder={`Search by ${dentalServiceSearchType === 'name' ? 'service name' : 'service code'}...`}
                                value={dentalServiceSearchQuery}
                                onChange={(e) => setDentalServiceSearchQuery(e.target.value)}
                              />
                            </div>
                            <select
                              className="input w-32"
                              value={dentalServiceSearchType}
                              onChange={(e) => setDentalServiceSearchType(e.target.value)}
                            >
                              <option value="name">By Name</option>
                              <option value="code">By Code</option>
                            </select>
                          </div>
                        </div>

                        {/* Dental Services List */}
                        <div>
                          <label className="label">Select Dental Services</label>
                          <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
                            {dentalServices
                              .filter(service => {
                                if (!dentalServiceSearchQuery) return true;
                                const query = dentalServiceSearchQuery.toLowerCase();
                                if (dentalServiceSearchType === 'name') {
                                  return service.name.toLowerCase().includes(query);
                                } else {
                                  return service.code.toLowerCase().includes(query);
                                }
                              })
                              .map(service => {
                                const isSelected = selectedDentalServices.some(s => s.serviceId === service.id);
                                const isWaived = waivedDentalServices.has(service.id);
                                const isFree = service.price === 0 || service.price === null;
                                const displayPrice = isWaived ? 0 : (service.price || 0);

                                return (
                                  <div key={service.id} className={`flex items-start space-x-3 hover:bg-gray-50 p-2 rounded border ${isSelected ? 'border-blue-300 bg-blue-50' : 'border-transparent'}`}>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => handleDentalServiceToggle(service.id, service)}
                                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <div className={`text-sm font-medium ${isWaived ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                          {service.name}
                                        </div>
                                        {isWaived && (
                                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            WAIVED
                                          </span>
                                        )}
                                        {isFree && !isWaived && (
                                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                            FREE
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {service.code} {service.description ? `- ${service.description}` : ''}
                                      </div>
                                      <div className={`text-sm font-semibold mt-1 ${isWaived ? 'text-green-600' : 'text-gray-900'}`}>
                                        ETB {displayPrice.toLocaleString()}
                                      </div>
                                    </div>
                                    {isSelected && !isFree && (
                                      <button
                                        type="button"
                                        onClick={(e) => handleWaiveDentalService(service.id, e)}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${isWaived
                                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                          : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                          }`}
                                      >
                                        {isWaived ? 'Unwaive' : 'Waive'}
                                      </button>
                                    )}
                                    {isSelected && (
                                      <div className="flex items-center gap-1">
                                        <label className="text-xs text-gray-500">Qty:</label>
                                        <input
                                          type="number"
                                          min="1"
                                          className="w-14 px-2 py-1 text-xs border border-gray-300 rounded"
                                          value={(selectedDentalServices.find(s => s.serviceId === service.id)?.quantity) || 1}
                                          onChange={(e) => updateDentalServiceQuantity(service.id, e.target.value)}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            {dentalServices.filter(service => {
                              if (!dentalServiceSearchQuery) return true;
                              const query = dentalServiceSearchQuery.toLowerCase();
                              if (dentalServiceSearchType === 'name') {
                                return service.name.toLowerCase().includes(query);
                              } else {
                                return service.code.toLowerCase().includes(query);
                              }
                            }).length === 0 && (
                                <p className="text-sm text-gray-500 text-center py-2">No dental services found</p>
                              )}
                          </div>
                          {selectedDentalServices.length > 0 && (
                            <p className="text-sm text-gray-600 mt-2">
                              Selected {selectedDentalServices.length} dental service(s)
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 6. Material Needs Section */}
                  {selectedPatient && activeSection === 'materialNeeds' && isSectionVisible('materialNeeds') && (
                    <div className="border border-gray-200 rounded-lg p-6">
                      <MaterialNeedsOrdering
                        visit={selectedPatient}
                        onOrdersPlaced={() => {
                          toast.success('Material needs order created');
                        }}
                      />
                    </div>
                  )}

                  {/* 7. Family Planning Section */}
                  {selectedPatient && activeSection === 'familyPlanning' && isSectionVisible('familyPlanning') && (
                    <div className="border border-pink-200 rounded-lg p-6 bg-pink-50">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Heart className="h-5 w-5 text-pink-600" />
                          <span className="text-base font-semibold text-pink-800">Family Planning</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/nurse/family-planning?patientId=${selectedPatient.patient.id}&visitId=${selectedPatient.id}`)}
                          className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium"
                        >
                          <Heart className="h-4 w-4" />
                          Fill Family Planning Form
                        </button>
                      </div>
                      <p className="text-sm text-pink-700">
                        Click the button above to open the Family Planning form. Patient data will be auto-filled.
                        After saving, return here to continue.
                      </p>
                    </div>
                  )}

                  {/* 8. Doctor Assignment Section */}
                  {activeSection === 'assignment' && isSectionVisible('assignment') && (
                    <div className="border border-gray-200 rounded-lg p-6">
                      <div className="space-y-4">
                        <div>
                          <label className="label">Filter by Qualification</label>
                          <div className="flex flex-wrap gap-2">
                            {qualifications.map(qual => (
                              <button
                                key={qual.value}
                                type="button"
                                onClick={() => setQualificationFilter(qual.value)}
                                className={`btn btn-sm ${qualificationFilter === qual.value ? 'btn-primary' : 'btn-outline'}`}
                              >
                                {qual.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Doctor Workload Overview */}
                        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
                            <Activity className="h-4 w-4 mr-1" />
                            Doctor Workload Status - {qualificationFilter === 'ALL' ? 'All Qualifications' : qualificationFilter}
                          </h4>
                          <div className="grid grid-cols-1 gap-2 text-xs max-h-32 overflow-y-auto">
                            {doctors
                              .filter(doctor =>
                                qualificationFilter === 'ALL' ||
                                doctor.qualifications?.some(qual => qual.includes(qualificationFilter)) ||
                                doctor.specialty === qualificationFilter.toLowerCase().replace(/ /g, '')
                              )
                              .map(doctor => (
                                <div key={doctor.id} className="flex items-center justify-between p-1 hover:bg-blue-100 rounded">
                                  <div className="flex items-center">
                                    <span className="text-blue-700 truncate font-medium">{doctor.fullname}</span>
                                    {doctor.qualifications && doctor.qualifications.length > 0 && (
                                      <span className="ml-2 text-blue-600 text-xs">
                                        ({doctor.qualifications.join(', ')})
                                      </span>
                                    )}
                                  </div>
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${doctor.totalWorkload === 0
                                    ? 'bg-green-100 text-green-700'
                                    : doctor.totalWorkload <= 2
                                      ? 'bg-blue-100 text-blue-700'
                                      : doctor.totalWorkload <= 5
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-red-100 text-red-700'
                                    }`}>
                                    {doctor.totalWorkload} patients
                                  </span>
                                </div>
                              ))}
                            {doctors.filter(doctor =>
                              qualificationFilter === 'ALL' ||
                              doctor.qualifications?.some(qual => qual.includes(qualificationFilter)) ||
                              doctor.specialty === qualificationFilter.toLowerCase().replace(/ /g, '')
                            ).length === 0 && (
                                <div className="text-center text-blue-600 py-2">
                                  No doctors found for {qualificationFilter}
                                </div>
                              )}
                          </div>
                        </div>

                        {/* Card Status Info */}
                        {selectedPatient && selectedPatient.patient && (
                          <div className="p-3 rounded-lg border text-sm mb-3"
                            style={{ backgroundColor: selectedPatient.patient.cardStatus === 'ACTIVE' ? '#f0fdf4' : '#fef2f2', borderColor: selectedPatient.patient.cardStatus === 'ACTIVE' ? '#86efac' : '#fca5a5' }}>
                            <div className="flex items-center justify-between">
                              <span className="font-medium">Patient Card: <span className={selectedPatient.patient.cardStatus === 'ACTIVE' ? 'text-green-700' : 'text-red-700'}>{selectedPatient.patient.cardStatus}</span></span>
                              <span className="text-xs text-gray-500">{selectedPatient.patient.cardType || 'GENERAL'}</span>
                            </div>
                            {selectedDoctor && (() => {
                              const doc = doctors.find(d => d.id === selectedDoctor);
                              if (!doc || !doc.requiredCardType) return null;
                              const needsUpgrade = selectedPatient.patient.cardStatus !== 'ACTIVE' || doc.requiredCardType !== (selectedPatient.patient.cardType || 'GENERAL');
                              return (
                                <div className="mt-1 text-xs">
                                  <span>Doctor requires: <strong>{doc.requiredCardType}</strong></span>
                                  {needsUpgrade && <span className="ml-2 text-orange-600 font-medium">⚠️ Card action needed</span>}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        <div>
                          <label className="label">Select Doctor</label>
                          <select
                            className="input"
                            value={selectedDoctor}
                            onChange={(e) => setSelectedDoctor(e.target.value)}
                          >
                            <option value="">Choose a doctor (Optional)</option>
                            {doctors
                              .filter(doctor =>
                                qualificationFilter === 'ALL' ||
                                doctor.qualifications?.some(qual => qual.includes(qualificationFilter)) ||
                                doctor.specialty === qualificationFilter.toLowerCase().replace(/ /g, '')
                              )
                              .map(doctor => (
                                <option key={doctor.id} value={doctor.id}>
                                  {doctor.fullname} - {doctor.qualifications?.join(', ') || 'General'}
                                  {doctor.requiredCardType ? ` [${doctor.requiredCardType}]` : ''}
                                  {doctor.totalWorkload > 0 ? ` (${doctor.totalWorkload})` : ' (Avail)'}
                                </option>
                              ))
                            }
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
                </div>{/* end overflow-y-auto content */}

                {/* Fixed Bottom Bar */}
                <div className="shrink-0 border-t bg-white px-4 py-2">
                <div className="flex items-center justify-between">
                  {/* Progress Summary */}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                    {isSectionVisible('vitals') && (
                      <span className={`flex items-center ${sectionCompletion.vitals ? 'text-green-600' : 'text-gray-400'}`}>
                        <CheckCircle className={`h-3 w-3 mr-1 ${sectionCompletion.vitals ? 'text-green-600' : 'text-gray-300'}`} /> Vitals
                      </span>
                    )}
                    {isSectionVisible('complaint') && (
                      <span className={`flex items-center ${sectionCompletion.complaint ? 'text-green-600' : 'text-gray-400'}`}>
                        <CheckCircle className={`h-3 w-3 mr-1 ${sectionCompletion.complaint ? 'text-green-600' : 'text-gray-300'}`} /> Complaint
                      </span>
                    )}
                    {isSectionVisible('examination') && (
                      <span className={`flex items-center ${sectionCompletion.examination ? 'text-green-600' : 'text-gray-400'}`}>
                        <CheckCircle className={`h-3 w-3 mr-1 ${sectionCompletion.examination ? 'text-green-600' : 'text-gray-300'}`} /> Exam
                      </span>
                    )}
                    {isSectionVisible('nurseService') && (
                      <span className={`flex items-center ${sectionCompletion.nurseService ? 'text-green-600' : 'text-gray-400'}`}>
                        <CheckCircle className={`h-3 w-3 mr-1 ${sectionCompletion.nurseService ? 'text-green-600' : 'text-gray-300'}`} /> Nurse
                      </span>
                    )}
                    {isSectionVisible('dentalService') && (
                      <span className={`flex items-center ${sectionCompletion.dentalService ? 'text-green-600' : 'text-gray-400'}`}>
                        <CheckCircle className={`h-3 w-3 mr-1 ${sectionCompletion.dentalService ? 'text-green-600' : 'text-gray-300'}`} /> Dental
                      </span>
                    )}
                    {isSectionVisible('familyPlanning') && (
                      <span className={`flex items-center ${sectionCompletion.familyPlanning ? 'text-green-600' : 'text-gray-400'}`}>
                        <CheckCircle className={`h-3 w-3 mr-1 ${sectionCompletion.familyPlanning ? 'text-green-600' : 'text-gray-300'}`} /> FP
                      </span>
                    )}
                    {isSectionVisible('assignment') && (
                      <span className={`flex items-center ${sectionCompletion.assignment ? 'text-green-600' : 'text-gray-400'}`}>
                        <CheckCircle className={`h-3 w-3 mr-1 ${sectionCompletion.assignment ? 'text-green-600' : 'text-gray-300'}`} /> Doctor
                      </span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowVitalsForm(false);
                        setVitalsData(createInitialVitalsData());
                        setSelectedDoctor('');
                        setSelectedNurseServices([]);
                        setSelectedDentalServices([]);
                        setSelectedNurse('');
                        setNurseServiceNotes('');
                        setNurseServiceSearchQuery('');
                        setDentalServiceSearchQuery('');
                        setActiveSection('vitals');
                      }}
                      className="btn btn-outline btn-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={`btn btn-sm ${(sectionCompletion.assignment || sectionCompletion.nurseService) && !isSubmitting
                        ? 'btn-primary'
                        : 'btn-disabled'
                        }`}
                      disabled={(!sectionCompletion.assignment && !sectionCompletion.nurseService) || isSubmitting}
                    >
                      {isSubmitting ? 'Processing...' : 'Finish'}
                    </button>
                  </div>
                </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TriageQueue;