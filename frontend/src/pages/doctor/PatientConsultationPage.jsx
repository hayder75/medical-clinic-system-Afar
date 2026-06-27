import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { AlertCircle, Activity, Heart, Image, Smile, Scan, Stethoscope, Pill, FileText, ArrowLeft, Save, User, TestTube, Eye, Download, Clock, CheckCircle, AlertTriangle, Package, Bed, Beaker, Printer, Trash2, Edit2, X, Check, Calendar, ChevronRight, ChevronDown, RefreshCw } from 'lucide-react';
import { getImageUrl } from '../../utils/imageUrl';
import { checkValueInNormalRange } from '../../utils/normalRangeParser';
import DentalChart from '../../components/dental/DentalChart';
import DentalChartDisplay from '../../components/common/DentalChartDisplay';
import DiagnosisNotes from '../../components/doctor/DiagnosisNotes';
import ImageViewer from '../../components/common/ImageViewer';
import DoctorServiceOrdering from '../../components/doctor/DoctorServiceOrdering';
import NurseServiceOrderingInterface from '../../components/doctor/NurseServiceOrderingInterface';
import LabOrdering from '../../components/doctor/LabOrdering';
import RadiologyOrdering from '../../components/doctor/RadiologyOrdering';
import ExternalDiagnosticOrders from '../../components/doctor/ExternalDiagnosticOrders';
import MedicationOrdering from '../../components/doctor/MedicationOrdering';
import DentalServiceOrdering from '../../components/doctor/DentalServiceOrdering';
import EmergencyDrugOrdering from '../../components/doctor/EmergencyDrugOrdering';

const NON_CLINICAL_CUSTOM_NOTE = 'Custom medication - not in inventory';

const resolveMedicationInstruction = (order) => {
  const candidates = [order?.instructions, order?.instructionText, order?.additionalNotes];
  const normalizedPlaceholder = NON_CLINICAL_CUSTOM_NOTE.toLowerCase();

  for (const candidate of candidates) {
    const text = String(candidate || '').trim();
    if (!text) continue;
    if (text.toLowerCase() === normalizedPlaceholder) continue;
    return text;
  }

  return '';
};
import ProcedureOrdering from '../../components/doctor/ProcedureOrdering';
import MaterialNeedsOrdering from '../../components/nurse/MaterialNeedsOrdering';
import AccommodationTab from '../../components/doctor/AccommodationTab';
import CompoundPrescriptionBuilder from '../../components/doctor/CompoundPrescriptionBuilder';
import PregnancyTab from '../../components/doctor/PregnancyTab';
import GrowthChartTab from '../../components/doctor/GrowthChartTab';
import VaccinationTab from '../../components/doctor/VaccinationTab';
import DevelopmentTab from '../../components/doctor/DevelopmentTab';
import ChronicDiseaseTab from '../../components/doctor/ChronicDiseaseTab';
import SurgicalNotesTab from '../../components/doctor/SurgicalNotesTab';
import ImagingViewerTab from '../../components/doctor/ImagingViewerTab';
import BodyChartTab from '../../components/doctor/BodyChartTab';
import ExerciseRxTab from '../../components/doctor/ExerciseRxTab';
import OutcomeScoresTab from '../../components/doctor/OutcomeScoresTab';
import TransferToDoctorModal from '../../components/doctor/TransferToDoctorModal';
import Layout from '../../components/common/Layout';
import {
  DEFAULT_DOCTOR_WORKSPACE_CONFIG,
  getAllowedDoctorTabs,
  getLocalDateInputValue,
  normalizeDoctorWorkspaceConfig
} from '../../utils/doctorWorkspace';

const getConsultationCacheKey = (doctorScope, visitId) => `doctor-consultation-cache:${doctorScope || 'unknown'}:${visitId || 'unknown'}`;

const NOTE_FIELDS = [
  { key: 'chiefComplaint', label: 'Chief Complaint' },
  { key: 'historyOfPresentIllness', label: 'History of Present Illness' },
  { key: 'pastMedicalHistory', label: 'Past Medical History' },
  { key: 'allergicHistory', label: 'Allergic History' },
  { key: 'physicalExamination', label: 'Physical Examination' },
  { key: 'investigationFindings', label: 'Investigation Findings' },
  { key: 'assessmentAndDiagnosis', label: 'Assessment & Diagnosis' },
  { key: 'treatmentPlan', label: 'Treatment Plan' },
  { key: 'treatmentGiven', label: 'Treatment Given' },
  { key: 'medicationIssued', label: 'Medication Issued' },
  { key: 'additional', label: 'Additional Notes' },
  { key: 'prognosis', label: 'Prognosis' }
];
const createInitialDoctorTriageForm = () => ({
  bloodPressure: '',
  temperature: '',
  heartRate: '',
  height: '',
  weight: '',
  oxygenSaturation: '',
  condition: '',
  notes: '',
  generalAppearanceStatus: 'NOT_ASSESSED',
  generalAppearance: '',
  skinStatus: 'NOT_ASSESSED',
  skinBodyRegions: [],
  skinFindings: '',
  headAndNeckStatus: 'NOT_ASSESSED',
  headAndNeck: '',
  cardiovascularStatus: 'NOT_ASSESSED',
  cardiovascularExam: '',
  respiratoryStatus: 'NOT_ASSESSED',
  respiratoryExam: '',
  abdominalStatus: 'NOT_ASSESSED',
  abdominalExam: '',
  extremitiesStatus: 'NOT_ASSESSED',
  extremities: '',
  neurologicalStatus: 'NOT_ASSESSED',
  neurologicalExam: '',
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

const NoteDisplayWithEdit = ({ note, visitId, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // utility to strip HTML tags so textareas don’t show `<p>` wrappers etc.
  const stripHtml = (html) => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  useEffect(() => {
    if (note) {
      // When we enter edit mode we don't want to show raw HTML tags such as
      // <p> that may have been stored by the rich-text editor.  Strip any
      // HTML before putting values into the controlled textarea.
      setEditData({
        chiefComplaint: stripHtml(note.chiefComplaint || ''),
        historyOfPresentIllness: stripHtml(note.historyOfPresentIllness || ''),
        pastMedicalHistory: stripHtml(note.pastMedicalHistory || ''),
        allergicHistory: stripHtml(note.allergicHistory || ''),
        physicalExamination: stripHtml(note.physicalExamination || ''),
        investigationFindings: stripHtml(note.investigationFindings || ''),
        assessmentAndDiagnosis: stripHtml(note.assessmentAndDiagnosis || ''),
        treatmentPlan: stripHtml(note.treatmentPlan || ''),
        treatmentGiven: stripHtml(note.treatmentGiven || ''),
        medicationIssued: stripHtml(note.medicationIssued || ''),
        additional: stripHtml(note.additional || ''),
        prognosis: stripHtml(note.prognosis || '')
      });
    }
  }, [note]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await api.put(`/doctors/visits/${visitId}/diagnosis-notes/${note.id}`, { notes: editData });
      toast.success('Notes updated successfully');
      setIsEditing(false);
      if (onUpdate) onUpdate(editData);
    } catch (error) {
      console.error('Error updating notes:', error);
      toast.error('Failed to update notes');
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (key, label) => {
    const value = isEditing ? editData[key] : note[key];
    const displayValue = stripHtml(value);

    if (!displayValue) return null;

    return (
      <div key={key} className="mb-2">
        <span className="font-medium text-gray-700">{label}: </span>
        {isEditing ? (
          <textarea
            value={stripHtml(editData[key])}
            onChange={(e) => setEditData(prev => ({ ...prev, [key]: e.target.value }))}
            className="w-full mt-1 p-2 border rounded text-sm"
            rows={2}
          />
        ) : (
          <span className="text-gray-600">{displayValue}</span>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 border rounded-lg shadow-sm" style={{ borderColor: '#E5E7EB', backgroundColor: '#F8FAFC' }}>
      <div className="flex justify-between items-start mb-3">
        <p className="text-xs text-gray-500 font-medium">
          Recorded by {note.doctor?.fullname || 'Unknown'} - {new Date(note.createdAt).toLocaleString()}
          {note.updatedAt && ` (Updated: ${new Date(note.updatedAt).toLocaleString()})`}
        </p>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            <Edit2 className="h-3 w-3 mr-1" /> Edit
          </button>
        ) : (
          <div className="flex space-x-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-indigo-200 disabled:opacity-50"
            >
              <Check className="h-3 w-3 mr-1" /> {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              <X className="h-3 w-3 mr-1" /> Cancel
            </button>
          </div>
        )}
      </div>

      {NOTE_FIELDS.map(field => renderField(field.key, field.label))}

      {NOTE_FIELDS.every(field => !stripHtml(note[field.key])) && (
        <p className="text-sm text-gray-500 italic">No notes recorded</p>
      )}
    </div>
  );
};

const PatientConsultationPage = () => {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user: currentUser, loading: authLoading } = useAuth();
  const modeParam = String(searchParams.get('mode') || '').toLowerCase();
  const consultationMode = modeParam === 'completed'
    ? 'completed'
    : modeParam === 'triage'
      ? 'triage'
      : 'active';
  const isCompletedMode = consultationMode === 'completed';
  const [loading, setLoading] = useState(true);
  const [isRefreshingVisit, setIsRefreshingVisit] = useState(false);
  const [visit, setVisit] = useState(null);
  const [allVitals, setAllVitals] = useState([]); // All vitals for this visit
  const [activeTab, setActiveTab] = useState('vitals');
  const [labSubTab, setLabSubTab] = useState(null);
  const labDefaultSet = useRef(false);
  const [radiologySubTab, setRadiologySubTab] = useState(null);
  const radiologyDefaultSet = useRef(false);
  const [dentalRecord, setDentalRecord] = useState(null);
  const dentalChartRef = useRef(null);
  const [workspaceConfig, setWorkspaceConfig] = useState(DEFAULT_DOCTOR_WORKSPACE_CONFIG);
  const [workspaceProfile, setWorkspaceProfile] = useState('general');

  // Get latest vitals and nurse vitals for display
  const nurseVitals = allVitals.find(v => v.recordedByRole === 'NURSE');
  const doctorVitals = allVitals.filter(v => v.recordedByRole === 'DOCTOR');
  const latestVitals = allVitals.length > 0 ? allVitals[0] : null;

  // Patient History state
  const [patientHistory, setPatientHistory] = useState(null);
  const [patientHistoryLoading, setPatientHistoryLoading] = useState(false);
  const [selectedHistoryVisitId, setSelectedHistoryVisitId] = useState(null);
  const [historyMedicationPrintDate, setHistoryMedicationPrintDate] = useState(() => getLocalDateInputValue());
  const [historyCompoundPrintDate, setHistoryCompoundPrintDate] = useState(() => getLocalDateInputValue());
  const [historyTab, setHistoryTab] = useState('visits');
  const [showPatientSummary, setShowPatientSummary] = useState(true);
  const [visitDetailTab, setVisitDetailTab] = useState('summary'); // summary, vitals, labs, radiology, medications, procedures, notes, images

  // Triage form state
  const [triageForm, setTriageForm] = useState(createInitialDoctorTriageForm);
  const [recordingTriage, setRecordingTriage] = useState(false);

  // ImageViewer state
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageViewerImages, setImageViewerImages] = useState([]);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);

  // Complete Visit state
  const diagnosisNotesRef = useRef(null);
  const [showCompleteConfirmModal, setShowCompleteConfirmModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showMissingInvestigationsModal, setShowMissingInvestigationsModal] = useState(false);
  const [completingVisit, setCompletingVisit] = useState(false);
  const [countAsMedicalTreated, setCountAsMedicalTreated] = useState(false);
  const [completeForm, setCompleteForm] = useState({
    needsAppointment: false,
    appointmentDate: '',
    appointmentTime: '',
    appointmentNotes: ''
  });

  // Debug: track component renders and hook calls
  console.debug('[Consultation] Component render - visitId:', visitId, 'currentUser:', currentUser?.username, 'authLoading:', authLoading, 'activeTab:', activeTab);

  // Show loading while authentication is being checked
  if (authLoading) {
    return (
      <Layout title="Loading..." subtitle="Please wait">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#2e13d1' }}></div>
            <p style={{ color: '#6B7280' }}>Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Redirect to login if not authenticated
  if (!currentUser) {
    navigate('/login');
    return null;
  }

  // Check if current user is a dental specialist - memoize this calculation
  const isDentalSpecialist = useMemo(() => {
    const result = currentUser?.qualifications?.includes('Dentist') || false;
    console.debug('[Consultation] isDentalSpecialist calculated:', result, 'from qualifications:', currentUser?.qualifications);
    return result;
  }, [currentUser]);

  const isDermatologyDoctor = useMemo(() => {
    const qualifications = Array.isArray(currentUser?.qualifications)
      ? currentUser.qualifications.map((q) => String(q || '').toUpperCase())
      : [];
    return currentUser?.role === 'DERMATOLOGY' || qualifications.some((q) => q.includes('DERM'));
  }, [currentUser]);

  const getDoctorQualificationLabel = (doctorData) => {
    const role = String(doctorData?.role || '').toUpperCase();
    const qualifications = Array.isArray(doctorData?.qualifications)
      ? doctorData.qualifications
      : [];
    const normalizedQualifications = qualifications.map((q) => String(q || '').toUpperCase());

    const isHealthOfficer =
      role.includes('HEALTH_OFFICER') ||
      role === 'HO' ||
      normalizedQualifications.some((q) => q.includes('HEALTH OFFICER') || q.includes('HEALTH_OFFICER') || q === 'HO');

    if (isHealthOfficer) {
      return 'Health Officer (HO)';
    }

    if (role.includes('DERM') || normalizedQualifications.some((q) => q.includes('DERM'))) {
      return 'Dermato-venereologist';
    }

    return qualifications.join(', ') || 'General Practitioner';
  };

  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    if (Number.isNaN(birthDate.getTime())) return 'N/A';
    const today = new Date();

    let years = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) years--;

    if (years < 0) return 'N/A';
    if (years === 0) {
      let months = today.getMonth() - birthDate.getMonth();
      let days = today.getDate() - birthDate.getDate();
      if (days < 0) {
        months--;
        const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        days += prevMonth.getDate();
      }
      if (months < 0) months = 0;
      return months === 0 ? `${days}d` : `${months}m ${days}d`;
    }
    return years;
  };

  const getPatientAgeLabel = (patientData) => {
    const directAge = patientData?.age ?? patientData?.patientAge;
    if (directAge !== undefined && directAge !== null && String(directAge).trim() !== '') {
      return String(directAge).trim();
    }

    const dob = patientData?.dob || patientData?.dateOfBirth || patientData?.birthDate;
    return calculateAge(dob);
  };

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const normalizeResultKey = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

  const parseStructuredResultObject = (value) => {
    if (!value) return null;
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value !== 'string') return null;

    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  const hasDisplayableResultValue = (value) => {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim() !== '';
    return true;
  };

  const stringifyResultValue = (value) => {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.filter(Boolean).join(', ');
    if (typeof value === 'object') {
      return Object.values(value).filter(hasDisplayableResultValue).join(', ');
    }
    return String(value);
  };

  const humanizeResultKey = (value) => String(value || '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());

  const getResultObjectValue = (resultObject, ...keys) => {
    const source = parseStructuredResultObject(resultObject);
    if (!source) return undefined;

    for (const key of keys.filter(Boolean)) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        return source[key];
      }
    }

    const normalizedCandidates = keys.filter(Boolean).map(normalizeResultKey).filter(Boolean);
    if (!normalizedCandidates.length) return undefined;

    const matchingEntry = Object.entries(source).find(([entryKey]) => {
      const normalizedEntryKey = normalizeResultKey(entryKey);
      return normalizedCandidates.includes(normalizedEntryKey);
    });

    return matchingEntry ? matchingEntry[1] : undefined;
  };

  const getBatchDetailedLabResults = (batchOrder) => {
    if (Array.isArray(batchOrder?.detailedResults) && batchOrder.detailedResults.length > 0) {
      return batchOrder.detailedResults;
    }

    if (Array.isArray(batchOrder?.detailedLabResults) && batchOrder.detailedLabResults.length > 0) {
      return batchOrder.detailedLabResults;
    }

    return [];
  };

  const buildDetailedLabResultEntries = (detailedResult) => {
    const resultObject = parseStructuredResultObject(detailedResult?.results)
      || parseStructuredResultObject(detailedResult?.resultText);

    if (!resultObject) return [];

    const templateFields = detailedResult?.template?.fields;
    if (templateFields && typeof templateFields === 'object' && !Array.isArray(templateFields)) {
      const mappedEntries = Object.entries(templateFields)
        .map(([fieldName, fieldConfig]) => {
          const fieldLabel = fieldConfig?.label || humanizeResultKey(fieldName);
          const rawValue = getResultObjectValue(resultObject, fieldName, fieldLabel);
          if (!hasDisplayableResultValue(rawValue)) return null;

          return {
            key: fieldName,
            label: fieldLabel,
            value: stringifyResultValue(rawValue),
            unit: fieldConfig?.unit || '',
            referenceRange: fieldConfig?.referenceRange || fieldConfig?.normalRange || ''
          };
        })
        .filter(Boolean);

      if (mappedEntries.length > 0) {
        return mappedEntries;
      }
    }

    return Object.entries(resultObject)
      .filter(([, value]) => hasDisplayableResultValue(value))
      .map(([fieldName, value]) => ({
        key: fieldName,
        label: humanizeResultKey(fieldName),
        value: stringifyResultValue(value),
        unit: '',
        referenceRange: ''
      }));
  };

  const buildLegacyLabResultEntries = (labResult) => {
    if (Array.isArray(labResult?.detailedResults) && labResult.detailedResults.length > 0) {
      return labResult.detailedResults
        .filter((item) => hasDisplayableResultValue(item?.result))
        .map((item, index) => ({
          key: item?.testName || `field-${index}`,
          label: item?.testName || `Field ${index + 1}`,
          value: stringifyResultValue(item?.result),
          unit: item?.unit || '',
          referenceRange: item?.referenceRange || ''
        }));
    }

    const parsedResultObject = parseStructuredResultObject(labResult?.resultText);
    if (!parsedResultObject) return [];

    return Object.entries(parsedResultObject)
      .filter(([, value]) => hasDisplayableResultValue(value))
      .map(([fieldName, value]) => ({
        key: fieldName,
        label: humanizeResultKey(fieldName),
        value: stringifyResultValue(value),
        unit: '',
        referenceRange: ''
      }));
  };

  const getStructuredFieldValue = (resultObject, field) => {
    const value = getResultObjectValue(
      resultObject,
      field?.fieldName,
      field?.label,
      String(field?.label || '').replace(/\s+/g, '_').toLowerCase(),
      String(field?.label || '').replace(/\s+/g, '')
    );

    return hasDisplayableResultValue(value) ? value : undefined;
  };

  const doctorCacheScope = useMemo(
    () => currentUser?.id || currentUser?.userId || currentUser?.username || 'unknown',
    [currentUser]
  );

  const consultationCacheKey = useMemo(
    () => getConsultationCacheKey(doctorCacheScope, visitId),
    [doctorCacheScope, visitId]
  );

  const allowedTabIds = useMemo(
    () => new Set(getAllowedDoctorTabs(workspaceConfig, workspaceProfile, consultationMode)),
    [consultationMode, workspaceConfig, workspaceProfile]
  );
  const canAccessDentalFeatures = useMemo(
    () => isDentalSpecialist || allowedTabIds.has('dental') || allowedTabIds.has('dental-services'),
    [allowedTabIds, isDentalSpecialist]
  );

  // Memoize tabs array to prevent recreation on every render
  // Order: triage → vitals → patient-history → images → dental chart → dental services (only for dentists) → diagnosis notes → medication → emergency drugs → material needs → lab → radiology → nurse services
  const tabs = useMemo(() => {
    const tabsArray = [
      { id: 'triage', label: 'Triage', icon: Stethoscope },
      { id: 'vitals', label: 'Vitals & History', icon: Activity },
      { id: 'patient-history', label: 'Patient History', icon: User },
      { id: 'images', label: 'Attached Images', icon: Image },
      { id: 'procedures', label: 'Procedures', icon: Activity },
      { id: 'medications', label: 'Medications', icon: Pill },
      { id: 'compound-prescription', label: 'Compound Rx', icon: Beaker },
      { id: 'emergency-drugs', label: 'Emergency Drugs', icon: AlertTriangle },
      { id: 'material-needs', label: 'Material Needs', icon: Package },
      { id: 'lab', label: 'Lab Orders', icon: TestTube },
      { id: 'radiology', label: 'Radiology Orders', icon: Scan },
      { id: 'nurse-services', label: 'Nurse Services', icon: Stethoscope },
      { id: 'notes', label: 'Diagnosis Notes', icon: FileText },
      { id: 'accommodation', label: 'Accommodation', icon: Bed },
      { id: 'dental', label: 'Dental Chart', icon: Smile },
      { id: 'dental-services', label: 'Dental Services', icon: Smile },
      { id: 'pregnancy', label: 'Pregnancy', icon: Heart },
      { id: 'growth-chart', label: 'Growth Chart', icon: Activity },
      { id: 'vaccination', label: 'Vaccination', icon: FileText },
      { id: 'development', label: 'Development', icon: Activity },
      { id: 'chronic-disease', label: 'Chronic Disease', icon: AlertTriangle },
      { id: 'surgical-notes', label: 'Surgical Notes', icon: FileText },
      { id: 'imaging-viewer', label: 'Imaging Viewer', icon: Eye },
      { id: 'body-chart', label: 'Body Chart', icon: User },
      { id: 'exercise-rx', label: 'Exercise Rx', icon: Activity },
      { id: 'outcome-scores', label: 'Outcome Scores', icon: CheckCircle }
    ];
    const visibleTabs = tabsArray.filter((tab) => allowedTabIds.has(tab.id));
    console.debug('[Consultation] tabs array created:', visibleTabs.map(t => t.id));
    return visibleTabs;
  }, [allowedTabIds]);

  // Debug: track tab changes and visit load
  useEffect(() => {
    console.debug('[Consultation] useEffect 1 - visitId:', visitId, 'activeTab:', activeTab);
  }, [visitId, activeTab]);

  useEffect(() => {
    console.debug('[Consultation] useEffect 2 - fetchVisitData called for visitId:', visitId);
    fetchVisitData();
  }, [visitId]);

  useEffect(() => {
    const fetchWorkspaceSettings = async () => {
      try {
        const response = await api.get('/doctors/workspace-settings');
        setWorkspaceConfig(normalizeDoctorWorkspaceConfig(response.data.workspaceConfig));
        setWorkspaceProfile(response.data.profile || 'general');
      } catch (error) {
        console.error('Error fetching consultation workspace settings:', error);
      }
    };

    fetchWorkspaceSettings();
  }, []);

  // Hydrate from session cache first to keep consultation data visible on browser refresh.
  useEffect(() => {
    try {
      if (!visitId) return;

      const candidateKeys = [
        consultationCacheKey,
        getConsultationCacheKey('unknown', visitId),
        getConsultationCacheKey(currentUser?.id, visitId)
      ].filter(Boolean);

      const raw = candidateKeys.map((k) => sessionStorage.getItem(k)).find(Boolean);
      if (!raw) return;

      const cached = JSON.parse(raw);
      if (!cached?.visit) return;

      setVisit(cached.visit);
      setAllVitals(Array.isArray(cached.vitals) ? cached.vitals : []);
      if (cached.dentalRecord) {
        setDentalRecord(cached.dentalRecord);
      }
      setLoading(false);
    } catch (cacheError) {
      console.warn('[Consultation] Failed to restore session cache:', cacheError);
    }
  }, [consultationCacheKey, currentUser?.id, visitId]);

  // If current activeTab is not available for this user, switch to the first available tab
  useEffect(() => {
    console.debug('[Consultation] useEffect 3 - tab validation - currentUser:', currentUser?.username, 'activeTab:', activeTab, 'tabs:', tabs.map(t => t.id));

    // Always call this effect, but only act when we have the necessary data
    if (currentUser && tabs.length > 0 && !tabs.find(tab => tab.id === activeTab)) {
      console.debug('[Consultation] Switching activeTab from', activeTab, 'to', tabs[0].id);
      setActiveTab(tabs[0].id);
    }
  }, [currentUser, activeTab, tabs]);

  // Set default lab sub-tab: show orders/results if any exist, else show ordering
  useEffect(() => {
    if (labDefaultSet.current || !visit) return;
    const labBatchOrders = visit?.batchOrders?.filter(order => order.type === 'LAB') || [];
    const labTestOrders = visit?.labTestOrders || [];
    const extOrders = visit?.externalDiagnosticOrders || [];
    const hasOrders = labBatchOrders.length > 0 || labTestOrders.length > 0 || extOrders.length > 0;
    setLabSubTab(hasOrders ? 'results' : 'order');
    labDefaultSet.current = true;
  }, [visit]);

  // Set default radiology sub-tab
  useEffect(() => {
    if (radiologyDefaultSet.current || !visit) return;
    const radBatchOrders = visit?.batchOrders?.filter(order => order.type === 'RADIOLOGY') || [];
    const radOrders = visit?.radiologyOrders || [];
    const radExtOrders = visit?.externalDiagnosticOrders?.filter(o => o.type === 'RADIOLOGY') || [];
    const hasOrders = radBatchOrders.length > 0 || radOrders.length > 0 || radExtOrders.length > 0;
    setRadiologySubTab(hasOrders ? 'results' : 'order');
    radiologyDefaultSet.current = true;
  }, [visit]);

  // Pre-fill triage form when triage tab is clicked (only then, not on page load)
  // Pre-fill with nurse vitals so doctor can see what was recorded
  useEffect(() => {
    if (activeTab === 'triage' && nurseVitals) {
      // Pre-fill form with nurse vitals for reference
      setTriageForm({
        ...createInitialDoctorTriageForm(),
        bloodPressure: nurseVitals.bloodPressure || '',
        temperature: nurseVitals.temperature ? nurseVitals.temperature.toString() : '',
        heartRate: nurseVitals.heartRate ? nurseVitals.heartRate.toString() : '',
        height: nurseVitals.height ? nurseVitals.height.toString() : '',
        weight: nurseVitals.weight ? nurseVitals.weight.toString() : '',
        oxygenSaturation: nurseVitals.oxygenSaturation || nurseVitals.spo2 ? (nurseVitals.oxygenSaturation || nurseVitals.spo2).toString() : '',
        condition: nurseVitals.condition || '',
        notes: nurseVitals.notes || '',
        generalAppearance: nurseVitals.generalAppearance || '',
        headAndNeck: nurseVitals.headAndNeck || '',
        cardiovascularExam: nurseVitals.cardiovascularExam || '',
        respiratoryExam: nurseVitals.respiratoryExam || '',
        abdominalExam: nurseVitals.abdominalExam || '',
        extremities: nurseVitals.extremities || '',
        neurologicalExam: nurseVitals.neurologicalExam || ''
      });
    } else if (activeTab === 'triage' && !nurseVitals) {
      // Reset form if no nurse vitals exist
      setTriageForm(createInitialDoctorTriageForm());
    }
  }, [activeTab, nurseVitals]);

  // Fetch patient history when patient-history tab is clicked
  useEffect(() => {
    if (activeTab === 'patient-history' && visit?.patient?.id && !patientHistory) {
      fetchPatientHistory(visit.patient.id);
    }
  }, [activeTab, visit?.patient?.id]);

  const fetchPatientHistory = async (patientId) => {
    try {
      setPatientHistoryLoading(true);
      const response = await api.get(`/doctors/patient-history/${patientId}`);
      setPatientHistory(response.data);
      // Auto-select the first visit if available
      if (response.data?.visits && response.data.visits.length > 0) {
        setSelectedHistoryVisitId(response.data.visits[0].id);
      }
    } catch (error) {
      console.error('Error fetching patient history:', error);
      toast.error('Failed to fetch patient history');
    } finally {
      setPatientHistoryLoading(false);
    }
  };

  const fetchVisitData = async (options = {}) => {
    const { silent = false } = options;
    try {
      console.debug('[Consultation] fetchVisitData called for visitId:', visitId);
      if (silent) {
        setIsRefreshingVisit(true);
      } else {
        setLoading(true);
      }

      // Fetch visit details using dedicated endpoint
      const response = await api.get(`/doctors/visits/${visitId}`);

      console.debug('[Consultation] Visit data fetched:', response.data?.id, 'Patient:', response.data?.patient?.name);

      if (!response.data) {
        toast.error('Visit not found');
        navigate('/doctor/dashboard');
        return;
      }

      const normalizedVisit = {
        ...response.data,
        // Protect against occasional partial payloads on reload where patient relation may be missing.
        patient: response.data?.patient || visit?.patient || null
      };

      // If still missing patient object, fetch patient summary and attach it before render/cache.
      if (!normalizedVisit.patient && normalizedVisit.patientId) {
        try {
          const historyRes = await api.get(`/doctors/patient-history/${normalizedVisit.patientId}`);
          if (historyRes?.data?.patient) {
            normalizedVisit.patient = {
              ...historyRes.data.patient,
              mobile: historyRes.data.patient.phone || historyRes.data.patient.mobile
            };
          }
        } catch (historyErr) {
          console.warn('[Consultation] Could not hydrate patient from history:', historyErr?.message || historyErr);
        }
      }

      setVisit(normalizedVisit);

      // Set all vitals from the visit data (already included)
      // Sort by createdAt descending to get most recent first
      if (normalizedVisit.vitals && normalizedVisit.vitals.length > 0) {
        const sortedVitals = [...normalizedVisit.vitals].sort((a, b) =>
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        setAllVitals(sortedVitals);
      } else {
        setAllVitals([]);
      }

      // Don't auto-fill triage form here - let user fill it manually when they click the triage tab
      // The form will be pre-filled when the triage tab is clicked (see useEffect for activeTab === 'triage')

      // Fetch dental record if user is a dentist
      if (currentUser?.qualifications?.includes('Dentist')) {
        try {
          const dentalResponse = await api.get(`/dental/records/${normalizedVisit.patientId}/${visitId}`);
          setDentalRecord(dentalResponse.data.dentalRecord);
        } catch (error) {
          if (error.response?.status === 404) {
            // No dental record exists yet, this is normal - don't show error
            setDentalRecord(null);
          } else {
            console.error('Error fetching dental record:', error);
            // Don't show error toast for dental records as 404 is expected
          }
        }
      }

      // Persist latest consultation snapshot per doctor+visit to survive refresh.
      try {
        const snapshot = {
          visit: normalizedVisit,
          vitals: normalizedVisit?.vitals || [],
          dentalRecord,
          savedAt: Date.now()
        };
        // Persist only meaningful snapshots to avoid overwriting good cache with patient-less payloads.
        if (snapshot.visit?.id && snapshot.visit?.patient) {
          sessionStorage.setItem(consultationCacheKey, JSON.stringify(snapshot));
        }
      } catch (cacheError) {
        console.warn('[Consultation] Failed to persist cache:', cacheError);
      }

    } catch (error) {
      console.error('Error fetching visit data:', error);
      if (error.response?.status === 401) {
        toast.error('Authentication failed. Please login again.');
        navigate('/login');
      } else if (error.response?.status === 404) {
        toast.error('Visit not found');
        navigate('/doctor/dashboard');
      } else if (error.response?.status === 403) {
        toast.error('Access denied to this visit');
        navigate('/doctor/dashboard');
      } else {
        // Keep current cached data on transient failures instead of showing blank N/A state.
        if (!visit) {
          toast.error('Failed to load patient data');
        } else {
          toast.error('Network issue: showing last loaded patient data');
        }
      }
    } finally {
      if (silent) {
        setIsRefreshingVisit(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleManualRefresh = async () => {
    await fetchVisitData({ silent: true });
  };

  const handleDentalChartSave = (savedRecord) => {
    setDentalRecord(savedRecord);
    toast.success('Dental chart saved successfully');
  };

  const handleOrdersPlaced = async () => {
    // Refresh visit data to show new orders
    await fetchVisitData();
  };

  const handleTriageSubmit = async (e) => {
    e.preventDefault();

    if (recordingTriage) return;
    setRecordingTriage(true);

    try {
      const vitalsPayload = {
        visitId: parseInt(visitId),
        patientId: visit?.patient?.id
      };

      // Only add vitals fields if they have values
      if (triageForm.bloodPressure) vitalsPayload.bloodPressure = triageForm.bloodPressure;
      if (triageForm.temperature) vitalsPayload.temperature = parseFloat(triageForm.temperature);
      if (triageForm.heartRate) vitalsPayload.heartRate = parseInt(triageForm.heartRate);
      if (triageForm.height) vitalsPayload.height = parseFloat(triageForm.height);
      if (triageForm.weight) vitalsPayload.weight = parseFloat(triageForm.weight);
      if (triageForm.oxygenSaturation) vitalsPayload.oxygenSaturation = parseInt(triageForm.oxygenSaturation);
      if (triageForm.condition) vitalsPayload.condition = triageForm.condition;
      if (triageForm.notes) vitalsPayload.notes = triageForm.notes;

      const generalAppearanceText = formatAssessmentText(
        triageForm.generalAppearanceStatus,
        triageForm.generalAppearance
      );
      const skinAndExtremitiesText = formatAssessmentText(
        triageForm.skinStatus,
        triageForm.skinFindings,
        [
          triageForm.skinBodyRegions?.length
            ? `Body Regions: ${triageForm.skinBodyRegions.join(', ')}`
            : '',
          formatAssessmentText(triageForm.extremitiesStatus, triageForm.extremities)
        ]
      );
      const headAndNeckText = formatAssessmentText(
        triageForm.headAndNeckStatus,
        triageForm.headAndNeck
      );
      const cardiovascularText = formatAssessmentText(
        triageForm.cardiovascularStatus,
        triageForm.cardiovascularExam
      );
      const respiratoryText = formatAssessmentText(
        triageForm.respiratoryStatus,
        triageForm.respiratoryExam
      );
      const abdominalText = formatAssessmentText(
        triageForm.abdominalStatus,
        triageForm.abdominalExam
      );
      const neuroText = formatAssessmentText(
        triageForm.neurologicalStatus,
        triageForm.neurologicalExam
      );

      if (generalAppearanceText) vitalsPayload.generalAppearance = generalAppearanceText;
      if (headAndNeckText) vitalsPayload.headAndNeck = headAndNeckText;
      if (cardiovascularText) vitalsPayload.cardiovascularExam = cardiovascularText;
      if (respiratoryText) vitalsPayload.respiratoryExam = respiratoryText;
      if (abdominalText) vitalsPayload.abdominalExam = abdominalText;
      if (skinAndExtremitiesText) vitalsPayload.extremities = skinAndExtremitiesText;
      if (neuroText) vitalsPayload.neurologicalExam = neuroText;

      if (triageForm.doctorAlertFlag || triageForm.doctorAlertSummary?.trim()) {
        const existingNotes = vitalsPayload.notes ? `${vitalsPayload.notes}\n\n` : '';
        const doctorAlertBlock = [
          '[Doctor Alert]',
          `Flagged: ${triageForm.doctorAlertFlag ? 'YES' : 'NO'}`,
          `Summary: ${(triageForm.doctorAlertSummary || '').trim() || 'Not provided'}`
        ].join('\n');
        vitalsPayload.notes = `${existingNotes}${doctorAlertBlock}`;
      }

      await api.post('/nurses/vitals', vitalsPayload);
      toast.success('Doctor vitals added successfully');

      // Refresh visit data to show updated vitals (this will pre-fill the form with saved values for editing)
      await fetchVisitData();

      // Switch to vitals tab to view recorded data
      setActiveTab('vitals');
    } catch (error) {
      console.error('Error recording triage vitals:', error);
      toast.error(error.response?.data?.error || 'Failed to record triage vitals');
    } finally {
      setRecordingTriage(false);
    }
  };

  // Check for pending lab/radiology orders - MUST be before any conditional returns
  // Complete button is enabled when:
  // - No orders exist at all
  // - Orders are completed/verified (have results)
  // - Orders were cancelled
  // - Visit status is IN_DOCTOR_QUEUE (patient is back in doctor's queue after results)
  // Complete button is disabled when:
  // - Orders are pending (UNPAID, PAID, QUEUED, IN_PROGRESS) AND status is NOT IN_DOCTOR_QUEUE
  // Note: Doctor can complete visit even without ordering medications
  // IMPORTANT: When status is IN_DOCTOR_QUEUE, always allow completion regardless of pending orders
  // This is because the patient is back in the doctor's queue after results came back
  const hasPendingOrders = useMemo(() => {
    if (!visit) return false;

    // If visit status indicates results are back, always allow completion
    // These statuses mean the patient has returned from lab/radiology
    const resultsReadyStatuses = [
      'IN_DOCTOR_QUEUE',
      'AWAITING_RESULTS_REVIEW',
      'RETURNED_WITH_RESULTS',
      'UNDER_DOCTOR_REVIEW'
    ];

    if (resultsReadyStatuses.includes(visit.status)) {
      return false; // Button enabled
    }

    // Check batch orders (new system) - check both order status AND individual service statuses
    // Only PAID/QUEUED/IN_PROGRESS orders block completion. UNPAID orders do not.
    const activeStatuses = ['PAID', 'QUEUED', 'IN_PROGRESS'];

    const terminalStatuses = ['COMPLETED', 'CANCELLED'];

    const isPendingBatchOrder = (order) => {
      if (!order || !['LAB', 'RADIOLOGY', 'PROCEDURE'].includes(order.type)) {
        return false;
      }

      if (terminalStatuses.includes(order.status)) {
        return false;
      }

      const hasServices = Array.isArray(order.services) && order.services.length > 0;
      const hasLinkedLabTests = Array.isArray(order.labTestOrders) && order.labTestOrders.length > 0;
      const hasDetailedLabResults = Array.isArray(order.detailedLabResults) && order.detailedLabResults.length > 0;
      const hasRadiologyResults = Array.isArray(order.radiologyResults) && order.radiologyResults.length > 0;
      const isLabPlaceholder =
        order.type === 'LAB' &&
        !hasServices &&
        /lab tests ordered by doctor/i.test(order.instructions || '');

      if (hasLinkedLabTests) {
        return order.labTestOrders.some((testOrder) => {
          const hasResult = Array.isArray(testOrder.results) && testOrder.results.length > 0;
          return activeStatuses.includes(testOrder.status) && !hasResult;
        });
      }

      if (hasDetailedLabResults || hasRadiologyResults) {
        return false;
      }

      if (hasServices) {
        return (order.services || []).some((service) => activeStatuses.includes(service.status));
      }

      if (isLabPlaceholder) {
        return false;
      }

      return activeStatuses.includes(order.status);
    };

    const pendingBatchLabOrders = (visit.batchOrders || []).filter(
      (order) => order.type === 'LAB' && isPendingBatchOrder(order)
    );

    const pendingBatchRadiologyOrders = (visit.batchOrders || []).filter(
      (order) => order.type === 'RADIOLOGY' && isPendingBatchOrder(order)
    );

    const pendingBatchProcedureOrders = (visit.batchOrders || []).filter(
      (order) => order.type === 'PROCEDURE' && isPendingBatchOrder(order)
    );

    // Check legacy lab orders - treat submitted results as completed even if status is stale.
    const pendingLabOrders = (visit.labOrders || []).filter((order) => {
      const hasResult = Array.isArray(order.labResults) && order.labResults.length > 0;
      return activeStatuses.includes(order.status) && !hasResult;
    });

    // Check legacy radiology orders - treat submitted results as completed even if status is stale.
    const pendingRadiologyOrders = (visit.radiologyOrders || []).filter((order) => {
      const hasResult = Array.isArray(order.radiologyResults) && order.radiologyResults.length > 0;
      return activeStatuses.includes(order.status) && !hasResult;
    });

    // Check new lab test orders system - results override stale status.
    const pendingLabTestOrders = (visit.labTestOrders || []).filter((order) => {
      const hasResult = Array.isArray(order.results) && order.results.length > 0;
      return activeStatuses.includes(order.status) && !hasResult;
    });

    // If any orders are actively being processed, block completion
    return pendingBatchLabOrders.length > 0 ||
      pendingBatchRadiologyOrders.length > 0 ||
      pendingBatchProcedureOrders.length > 0 ||
      pendingLabOrders.length > 0 ||
      pendingRadiologyOrders.length > 0 ||
      pendingLabTestOrders.length > 0;
  }, [visit]);

  const handleBackToQueue = () => {
    navigate('/doctor/queue');
  };

  // Complete Visit Functions
  const handleCompleteVisit = async () => {
    if (isCompletedMode) return;

    const stripHtml = (html) => {
      if (!html) return '';
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      return tmp.textContent || tmp.innerText || '';
    };

    const notesData = diagnosisNotesRef.current?.getNotes?.();
    let investigationText = '';
    if (notesData) {
      investigationText = stripHtml(notesData.investigationFindings || '');
    } else {
      try {
        const res = await api.get(`/doctors/visits/${visitId}/diagnosis-notes`);
        const serverNotes = res.data?.notes;
        if (serverNotes) {
          investigationText = stripHtml(serverNotes.investigationFindings || '');
        }
      } catch (e) {
        console.warn('Could not fetch diagnosis notes:', e);
      }
    }

    if (!investigationText) {
      setShowMissingInvestigationsModal(true);
      return;
    }

    setCountAsMedicalTreated(false);
    setShowCompleteConfirmModal(true);
  };

  const handleConfirmCompleteVisit = () => {
    setShowCompleteConfirmModal(false);
    setShowCompleteModal(true);
  };

  const handleCompleteFormChange = (field, value) => {
    setCompleteForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmitCompleteVisit = async () => {
    try {
      setCompletingVisit(true);

      const payload = {
        visitId: parseInt(visitId),
        diagnosis: '', // Will be extracted from diagnosis notes
        diagnosisDetails: '', // Will be extracted from diagnosis notes
        instructions: '', // Will be extracted from diagnosis notes
        finalNotes: '', // Will be extracted from diagnosis notes
        countAsMedicalTreated: isDermatologyDoctor ? countAsMedicalTreated : false,
        needsAppointment: completeForm.needsAppointment,
        appointmentDate: completeForm.appointmentDate,
        appointmentTime: completeForm.appointmentTime,
        appointmentNotes: completeForm.appointmentNotes
      };

      console.log('🔍 Completing visit with payload:', payload);

      const response = await api.post('/doctors/complete', payload);

      toast.success('Visit completed successfully! All data has been saved to patient history.');

      // Close modal and navigate back to queue
      setShowCompleteModal(false);
      navigate('/doctor/queue');

    } catch (error) {
      console.error('❌ Error completing visit:', error);
      toast.error(error.response?.data?.error || 'Failed to complete visit');
    } finally {
      setCompletingVisit(false);
    }
  };

  // Delete medication order
  const handleDeleteMedication = async (medicationId) => {
    if (!window.confirm('Are you sure you want to delete this medication? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/doctors/medication-order/${medicationId}`);
      toast.success('Medication deleted successfully');

      // Refresh the visit data
      const response = await api.get(`/doctors/visits/${visitId}`);
      setVisit(response.data);
    } catch (error) {
      console.error('Error deleting medication:', error);
      toast.error(error.response?.data?.error || 'Failed to delete medication');
    }
  };

  const handleDeleteLabBatchOrder = async (batchOrderId) => {
    if (!window.confirm('Delete this lab order?')) return;
    try {
      await api.delete(`/doctors/lab-batch-order/${batchOrderId}`);
      toast.success('Lab order deleted');
      await fetchVisitData();
    } catch (error) {
      console.error('Error deleting lab order:', error);
      toast.error(error.response?.data?.error || 'Failed to delete lab order');
    }
  };

  const handleDeleteLabTestOrder = async (orderId) => {
    if (!window.confirm('Delete this lab test order?')) return;
    try {
      await api.delete(`/doctors/lab-test-order/${orderId}`);
      toast.success('Lab test order deleted');
      await fetchVisitData();
    } catch (error) {
      console.error('Error deleting lab test order:', error);
      toast.error(error.response?.data?.error || 'Failed to delete lab test order');
    }
  };

  const handleDeleteRadiologyBatchOrder = async (batchOrderId) => {
    if (!window.confirm('Delete this radiology order?')) return;
    try {
      await api.delete(`/doctors/radiology-batch-order/${batchOrderId}`);
      toast.success('Radiology order deleted');
      await fetchVisitData();
    } catch (error) {
      console.error('Error deleting radiology order:', error);
      toast.error(error.response?.data?.error || 'Failed to delete radiology order');
    }
  };

  const getPrintableDoctorData = (historyVisit) => {
    return historyVisit?.doctor || visit?.doctor || currentUser || {};
  };

  const getPrintablePatientData = (batchOrder) => {
    return batchOrder?.patient || batchOrder?.visit?.patient || visit?.patient || {};
  };

  const getPrintableOrderDoctorData = (batchOrder) => {
    return batchOrder?.doctor || batchOrder?.orderedBy || batchOrder?.visit?.doctor || visit?.doctor || currentUser || {};
  };

  const getPrintableDoctorName = (doctorData) => {
    const rawName = String(
      doctorData?.fullname || doctorData?.fullName || doctorData?.name || currentUser?.fullname || currentUser?.username || ''
    ).trim();
    if (!rawName) return 'Attending Doctor';

    const role = String(doctorData?.role || '').toUpperCase();
    const qualifications = Array.isArray(doctorData?.qualifications) ? doctorData.qualifications : [];
    const normalizedQualifications = qualifications.map((q) => String(q || '').toUpperCase());
    const isHealthOfficer =
      role.includes('HEALTH_OFFICER') ||
      role === 'HO' ||
      normalizedQualifications.some((q) => q.includes('HEALTH OFFICER') || q.includes('HEALTH_OFFICER') || q === 'HO');

    if (/^(dr|mr)\.?\s+/i.test(rawName)) return rawName;
    return isHealthOfficer ? `Mr. ${rawName}` : `Dr. ${rawName}`;
  };

  const getPrintableOrderDoctorName = (batchOrder) => {
    const explicitName = String(
      batchOrder?.orderedByName || batchOrder?.orderedByDoctorName || batchOrder?.doctorName || ''
    ).trim();

    if (explicitName) {
      if (/^(dr|mr)\.?\s+/i.test(explicitName)) return explicitName;

      const doctorData = getPrintableOrderDoctorData(batchOrder);
      const role = String(doctorData?.role || '').toUpperCase();
      const qualifications = Array.isArray(doctorData?.qualifications) ? doctorData.qualifications : [];
      const normalizedQualifications = qualifications.map((q) => String(q || '').toUpperCase());
      const isHealthOfficer =
        role.includes('HEALTH_OFFICER') ||
        role === 'HO' ||
        normalizedQualifications.some((q) => q.includes('HEALTH OFFICER') || q.includes('HEALTH_OFFICER') || q === 'HO');

      return isHealthOfficer ? `Mr. ${explicitName}` : `Dr. ${explicitName}`;
    }

    return getPrintableDoctorName(getPrintableOrderDoctorData(batchOrder));
  };

  const printHistoryMedicationReprint = (historyVisit, printDate) => {
    if (!historyVisit?.medicationOrders?.length) {
      toast.error('No medications found for selected date');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Popup blocked! Please allow popups for this site.');
      return;
    }

    const patientData = patientHistory?.patient || visit?.patient || {};
  const doctorData = getPrintableDoctorData(historyVisit);
  const doctorName = getPrintableDoctorName(doctorData);
    const doctorQualification = getDoctorQualificationLabel(doctorData);
    const visitDate = new Date(historyVisit.createdAt || historyVisit.updatedAt || Date.now());
  const printedAt = printDate ? new Date(`${printDate}T12:00:00`) : new Date();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Medication Reprint - ${escapeHtml(patientData.name || 'Patient')}</title>
          <style>
            @media print { @page { size: A6; margin: 0 !important; } .no-print { display: none !important; } }
            body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 16px; color: #111827; background: #f8fafc; }
            .sheet { width: 105mm; min-height: 148mm; margin: 0 auto; background: #fff; padding: 8mm; box-sizing: border-box; box-shadow: 0 8px 18px rgba(15,23,42,0.15); }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #1d4ed8; padding-bottom: 8px; margin-bottom: 10px; }
            .title { font-size: 14px; font-weight: 700; text-transform: uppercase; color: #1e3a8a; }
            .meta { font-size: 10px; color: #475569; text-align: right; }
            .patient { font-size: 11px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px; margin-bottom: 10px; }
            .item { border-bottom: 1px dashed #cbd5e1; padding: 6px 0; }
            .name { font-size: 12px; font-weight: 700; }
            .instruction { font-size: 11px; color: #334155; margin-top: 3px; }
            .footer { margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 10px; display: flex; justify-content: space-between; }
            .no-print { text-align: center; margin-bottom: 12px; }
            .no-print button { border: none; background: #2563eb; color: white; padding: 8px 14px; border-radius: 4px; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="no-print"><button onclick="window.print()">Print Refill Copy</button></div>
          <div class="sheet">
            <div class="header">
              <div class="title">Medication Reprint</div>
              <div class="meta">Visit: ${visitDate.toLocaleDateString()}<br>Reprint: ${printedAt.toLocaleString()}</div>
            </div>
            <div class="patient">
              <div><strong>Patient:</strong> ${escapeHtml(String(patientData.name || 'N/A').toUpperCase())}</div>
              <div><strong>Card No:</strong> #${escapeHtml(patientData.id || 'N/A')}</div>
              <div><strong>Visit ID:</strong> #${escapeHtml(historyVisit.visitUid || historyVisit.id)}</div>
            </div>
            ${historyVisit.medicationOrders.map((med, idx) => {
              const name = escapeHtml(med.name || 'Medication');
              const instruction = escapeHtml((med.instructionText || med.instructions || '').trim());
              return `
                <div class="item">
                  <div class="name">${idx + 1}. ${name}</div>
                  ${instruction ? `<div class="instruction">${instruction}</div>` : ''}
                </div>
              `;
            }).join('')}
            <div class="footer">
              <div>
                Prescribed by: <strong>${escapeHtml(doctorName)}</strong><br>
                ${escapeHtml(doctorQualification)}
              </div>
              <div style="border-top: 1px solid #334155; padding-top: 4px; width: 96px; text-align: center;">Signature</div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const printHistoryCompoundReprint = (historyVisit, printDate) => {
    if (!historyVisit?.compoundPrescriptions?.length) {
      toast.error('No compound prescriptions found for selected date');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Popup blocked! Please allow popups for this site.');
      return;
    }

    const patientData = patientHistory?.patient || visit?.patient || {};
    const doctorData = getPrintableDoctorData(historyVisit);
  const doctorName = getPrintableDoctorName(doctorData);
    const doctorQualification = getDoctorQualificationLabel(doctorData);
    const visitDate = new Date(historyVisit.createdAt || historyVisit.updatedAt || Date.now());
  const printedAt = printDate ? new Date(`${printDate}T12:00:00`) : new Date();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Compound Reprint - ${escapeHtml(patientData.name || 'Patient')}</title>
          <style>
            @media print { @page { size: A6; margin: 0 !important; } .no-print { display: none !important; } }
            body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 16px; color: #111827; background: #f8fafc; }
            .sheet { width: 105mm; min-height: 148mm; margin: 0 auto; background: #fff; padding: 8mm; box-sizing: border-box; box-shadow: 0 8px 18px rgba(15,23,42,0.15); }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #1d4ed8; padding-bottom: 8px; margin-bottom: 10px; }
            .title { font-size: 14px; font-weight: 700; text-transform: uppercase; color: #1e3a8a; }
            .meta { font-size: 10px; color: #475569; text-align: right; }
            .patient { font-size: 11px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px; margin-bottom: 10px; }
            .item { border-bottom: 1px dashed #cbd5e1; padding: 6px 0; }
            .name { font-size: 12px; font-weight: 700; }
            .detail { font-size: 11px; color: #334155; margin-top: 3px; white-space: pre-wrap; }
            .footer { margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 10px; display: flex; justify-content: space-between; }
            .no-print { text-align: center; margin-bottom: 12px; }
            .no-print button { border: none; background: #2563eb; color: white; padding: 8px 14px; border-radius: 4px; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="no-print"><button onclick="window.print()">Print Refill Copy</button></div>
          <div class="sheet">
            <div class="header">
              <div class="title">Compound Rx Reprint</div>
              <div class="meta">Visit: ${visitDate.toLocaleDateString()}<br>Reprint: ${printedAt.toLocaleString()}</div>
            </div>
            <div class="patient">
              <div><strong>Patient:</strong> ${escapeHtml(String(patientData.name || 'N/A').toUpperCase())}</div>
              <div><strong>Card No:</strong> #${escapeHtml(patientData.id || 'N/A')}</div>
              <div><strong>Visit ID:</strong> #${escapeHtml(historyVisit.visitUid || historyVisit.id)}</div>
            </div>
            ${historyVisit.compoundPrescriptions.map((cp, idx) => {
              const note = escapeHtml(cp.prescriptionText || cp.rawText || cp.instructions || '');
              return `
                <div class="item">
                  <div class="name">${idx + 1}. ${escapeHtml(cp.referenceNumber || `Compound ${idx + 1}`)}</div>
                  ${note ? `<div class="detail">${note}</div>` : ''}
                </div>
              `;
            }).join('')}
            <div class="footer">
              <div>
                Prescribed by: <strong>${escapeHtml(doctorName)}</strong><br>
                ${escapeHtml(doctorQualification)}
              </div>
              <div style="border-top: 1px solid #334155; padding-top: 4px; width: 96px; text-align: center;">Signature</div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Print Lab Orders (with or without results)
  const printLabOrders = (batchOrder) => {
    const printWindow = window.open('', '_blank');
    const patient = getPrintablePatientData(batchOrder);
    const currentDate = new Date().toLocaleDateString();
    const patientAge = getPatientAgeLabel(patient);
    const orderingDoctorData = getPrintableOrderDoctorData(batchOrder);
    const orderingDoctor = getPrintableOrderDoctorName(batchOrder);
    const orderingDoctorQualification = getDoctorQualificationLabel(orderingDoctorData);

    // Get results if available
    const hasResults = (batchOrder.detailedResults && batchOrder.detailedResults.length > 0) ||
      (batchOrder.labResults && batchOrder.labResults.length > 0);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Lab Order - ${escapeHtml(patient.name || 'Patient')}</title>
          <style>
            @media print { @page { size: A4; margin: 10mm; } }
            body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 15px; color: #333; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
            .clinic-name { font-size: 20px; font-weight: bold; color: #1e40af; }
            .section { margin-bottom: 15px; }
            .section-title { font-size: 14px; font-weight: bold; margin-bottom: 8px; color: #1e40af; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
            .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 12px; }
            .info-label { font-weight: 600; color: #666; }
            .test-list { list-style: none; padding: 0; margin: 0; }
            .test-item { padding: 8px; margin: 4px 0; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #2563eb; }
            .results-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            .results-table th, .results-table td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            .results-table th { background: #f1f5f9; }
            .no-print { text-align: center; margin-top: 20px; }
            .no-print button { padding: 8px 20px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="clinic-name">${window.__CS__?.name || 'Clinic'}</div>
            <div>Laboratory Order Form</div>
          </div>
          
          <div class="section">
            <div class="section-title">Patient Information</div>
            <div class="info-grid">
              <div><span class="info-label">Name:</span> ${escapeHtml(patient.name || 'N/A')}</div>
              <div><span class="info-label">ID:</span> ${escapeHtml(patient.id || 'N/A')}</div>
              <div><span class="info-label">Age:</span> ${escapeHtml(patientAge)}</div>
              <div><span class="info-label">Gender:</span> ${escapeHtml(patient.gender || 'N/A')}</div>
              <div><span class="info-label">Ordered By:</span> ${escapeHtml(orderingDoctor)}</div>
              <div><span class="info-label">Role:</span> ${escapeHtml(orderingDoctorQualification)}</div>
              <div><span class="info-label">Phone:</span> ${escapeHtml(patient.mobile || 'N/A')}</div>
              <div><span class="info-label">Date:</span> ${escapeHtml(currentDate)}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Order Details</div>
            <div class="info-grid">
              <div><span class="info-label">Order ID:</span> #${batchOrder.id}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Laboratory Test Orders</div>
            <ul class="test-list">
              ${batchOrder.services?.map(service => `<li class="test-item">${service.investigationType?.name || service.service?.name || 'Lab Test'}</li>`).join('') || '<li>No tests ordered</li>'}
            </ul>
          </div>

          ${hasResults ? `
          <div class="section">
            <div class="section-title">Test Results</div>
            <table class="results-table">
              <thead>
                <tr><th>Test</th><th>Parameter</th><th>Result</th></tr>
              </thead>
              <tbody>
                ${batchOrder.detailedResults?.map(dr => {
      const testName = dr.template?.name || 'Lab Test';
      const results = dr.results || {};
      return Object.entries(results).map(([key, value]) =>
        `<tr><td>${testName}</td><td>${key}</td><td>${value || '-'}</td></tr>`
      ).join('');
    }).join('') || ''}
                ${batchOrder.labResults?.map(lr =>
      `<tr><td>${lr.testType?.name || 'Lab Test'}</td><td>Result</td><td>${lr.resultText || '-'}</td></tr>`
    ).join('') || ''}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${batchOrder.instructions ? `
          <div class="section">
            <div class="section-title">Instructions</div>
            <p>${batchOrder.instructions}</p>
          </div>
          ` : ''}

          <div class="no-print">
            <button onclick="window.print()">Print</button>
            <button onclick="window.close()" style="margin-left: 10px; background: #666;">Close</button>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Print Radiology Orders (with or without results)
  const printRadiologyOrders = (batchOrder) => {
    const printWindow = window.open('', '_blank');
    const patient = getPrintablePatientData(batchOrder);
    const currentDate = new Date().toLocaleDateString();
    const patientAge = getPatientAgeLabel(patient);
    const orderingDoctorData = getPrintableOrderDoctorData(batchOrder);
    const orderingDoctor = getPrintableOrderDoctorName(batchOrder);
    const orderingDoctorQualification = getDoctorQualificationLabel(orderingDoctorData);

    const hasResults = batchOrder.radiologyResults && batchOrder.radiologyResults.length > 0;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Radiology Order - ${escapeHtml(patient.name || 'Patient')}</title>
          <style>
            @media print { @page { size: A4; margin: 10mm; } }
            body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 15px; color: #333; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
            .clinic-name { font-size: 20px; font-weight: bold; color: #1e40af; }
            .section { margin-bottom: 15px; }
            .section-title { font-size: 14px; font-weight: bold; margin-bottom: 8px; color: #1e40af; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
            .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 12px; }
            .info-label { font-weight: 600; color: #666; }
            .test-list { list-style: none; padding: 0; margin: 0; }
            .test-item { padding: 8px; margin: 4px 0; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #2563eb; }
            .results-box { padding: 15px; background: #f8f9fa; border-radius: 4px; margin-top: 10px; }
            .no-print { text-align: center; margin-top: 20px; }
            .no-print button { padding: 8px 20px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="clinic-name">${window.__CS__?.name || 'Clinic'}</div>
            <div>Radiology Order Form</div>
          </div>
          
          <div class="section">
            <div class="section-title">Patient Information</div>
            <div class="info-grid">
              <div><span class="info-label">Name:</span> ${escapeHtml(patient.name || 'N/A')}</div>
              <div><span class="info-label">ID:</span> ${escapeHtml(patient.id || 'N/A')}</div>
              <div><span class="info-label">Age:</span> ${escapeHtml(patientAge)}</div>
              <div><span class="info-label">Gender:</span> ${escapeHtml(patient.gender || 'N/A')}</div>
              <div><span class="info-label">Ordered By:</span> ${escapeHtml(orderingDoctor)}</div>
              <div><span class="info-label">Role:</span> ${escapeHtml(orderingDoctorQualification)}</div>
              <div><span class="info-label">Phone:</span> ${escapeHtml(patient.mobile || 'N/A')}</div>
              <div><span class="info-label">Date:</span> ${escapeHtml(currentDate)}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Order Details</div>
            <div class="info-grid">
              <div><span class="info-label">Order ID:</span> #${batchOrder.id}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Radiology Tests Ordered</div>
            <ul class="test-list">
              ${batchOrder.services?.map(service => `<li class="test-item">${service.investigationType?.name || service.service?.name || 'Radiology Test'}</li>`).join('') || '<li>No tests ordered</li>'}
            </ul>
          </div>

          ${hasResults ? `
          <div class="section">
            <div class="section-title">Test Results</div>
            ${batchOrder.radiologyResults.map(rr => `
              <div class="results-box">
                <strong>${rr.testType?.name || 'Radiology Test'}</strong>
                ${rr.clinicalIndication ? `<p><strong>Clinical Indication:</strong> ${rr.clinicalIndication}</p>` : ''}
                ${rr.technique ? `<p><strong>Technique:</strong> ${rr.technique}</p>` : ''}
                ${rr.comparison ? `<p><strong>Comparison:</strong> ${rr.comparison}</p>` : ''}
                ${rr.findings ? `<p><strong>Findings:</strong> ${rr.findings}</p>` : ''}
                ${rr.conclusion ? `<p><strong>Conclusion:</strong> ${rr.conclusion}</p>` : ''}
                ${rr.recommendations ? `<p><strong>Recommendations:</strong> ${rr.recommendations}</p>` : ''}
                ${rr.additionalNotes ? `<p><em>Notes: ${rr.additionalNotes}</em></p>` : ''}
              </div>
            `).join('')}
          </div>
          ` : ''}

          ${batchOrder.instructions ? `
          <div class="section">
            <div class="section-title">Instructions</div>
            <p>${batchOrder.instructions}</p>
          </div>
          ` : ''}

          <div class="no-print">
            <button onclick="window.print()">Print</button>
            <button onclick="window.close()" style="margin-left: 10px; background: #666;">Close</button>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Function to open ImageViewer
  const openImageViewer = (images, startIndex = 0) => {
    console.debug('[ImageViewer] Opening viewer with images:', images.length, 'startIndex:', startIndex);
    console.debug('[ImageViewer] Images data:', images);

    if (!images || images.length === 0) {
      console.warn('[ImageViewer] No images provided');
      return;
    }

    setImageViewerImages(images);
    setImageViewerIndex(startIndex);
    setImageViewerOpen(true);

    console.debug('[ImageViewer] Viewer opened successfully');
  };

  const closeImageViewer = () => {
    console.debug('[ImageViewer] Closing viewer');
    setImageViewerOpen(false);
    setImageViewerImages([]);
    setImageViewerIndex(0);
  };

  if (loading) {
    return (
      <Layout title="Loading..." subtitle="Loading patient data">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: '#2e13d1' }}></div>
            <p className="mt-4" style={{ color: '#0C0E0B' }}>Loading patient data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!visit) {
    return (
      <Layout title="Patient Consultation" subtitle="Unable to load visit">
        <div className="max-w-xl mx-auto bg-white border border-red-200 rounded-lg p-6 text-center">
          <p className="text-lg font-semibold text-red-700 mb-2">Could not load consultation data</p>
          <p className="text-sm text-gray-600 mb-4">Please return to queue and open the patient again.</p>
          <button
            onClick={() => navigate('/doctor/queue')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Queue
          </button>
        </div>
      </Layout>
    );
  }

  if (!visit) {
    return (
      <Layout title="Visit Not Found" subtitle="Visit could not be loaded">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p style={{ color: '#EA2E00' }}>Visit not found</p>
            <button
              onClick={() => navigate('/doctor/dashboard')}
              className="mt-4 px-4 py-2 rounded-lg"
              style={{ backgroundColor: '#2e13d1', color: '#FFFFFF' }}
            >
              Back to Queue
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`Patient Consultation - ${visit?.visitUid || visit?.id || 'Loading...'}`} subtitle="Diagnose and treat patient">
      <div className="space-y-3 w-full">
        {/* Patient Info Banner with Action Buttons - Horizontal Layout */}
        <div className="border-b py-3" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="flex items-center justify-center w-14 h-14 rounded-full flex-shrink-0" style={{ backgroundColor: '#2e13d1' }}>
                <User className="h-7 w-7" style={{ color: '#FFFFFF' }} />
              </div>
              <div className="flex items-center gap-6 flex-1 min-w-0 overflow-x-auto">
                <div className="flex-shrink-0">
                  <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Patient ID</p>
                  <p className="text-sm font-semibold whitespace-nowrap" style={{ color: '#0C0E0B' }}>#{visit.patient?.id || 'N/A'}</p>
                </div>
                <div className="flex-shrink-0">
                  <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Patient Name</p>
                  <p className="text-sm font-semibold whitespace-nowrap" style={{ color: '#0C0E0B' }}>{visit.patient?.name || 'N/A'}</p>
                </div>
                <div className="flex-shrink-0">
                  <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Age / Gender</p>
                  <p className="text-sm font-semibold whitespace-nowrap" style={{ color: '#0C0E0B' }}>
                    {visit.patient?.dob ? calculateAge(visit.patient.dob) : 'N/A'} /
                    {visit.patient?.gender || 'N/A'}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Blood Type</p>
                  <p className="text-sm font-semibold whitespace-nowrap" style={{ color: '#0C0E0B' }}>{visit.patient?.bloodType || 'N/A'}</p>
                </div>
                <div className="flex-shrink-0">
                  <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Mobile</p>
                  <p className="text-sm font-semibold whitespace-nowrap" style={{ color: '#0C0E0B' }}>{visit.patient?.mobile || 'N/A'}</p>
                </div>
                <div className="flex-shrink-0">
                  <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Status</p>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                      style={{
                        backgroundColor: visit.status === 'AWAITING_RESULTS_REVIEW' ? '#FEF3C7' : '#DBEAFE',
                        color: visit.status === 'AWAITING_RESULTS_REVIEW' ? '#92400E' : '#1E40AF'
                      }}
                    >
                      {visit.status?.replace(/_/g, ' ')}
                    </span>
                    {visit.status === 'IN_DOCTOR_QUEUE' && visit?.batchOrders?.some(order =>
                      order.type === 'DENTAL' && order.status === 'PAID'
                    ) && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-indigo-800 whitespace-nowrap">
                          Back from Billing
                        </span>
                      )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshingVisit}
                className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center text-base whitespace-nowrap border"
                style={{
                  backgroundColor: '#FFFFFF',
                  color: '#2e13d1',
                  borderColor: '#C7D2FE',
                  opacity: isRefreshingVisit ? 0.7 : 1
                }}
                title="Refresh visit data"
              >
                <RefreshCw className={`inline-block mr-2 h-4 w-4 ${isRefreshingVisit ? 'animate-spin' : ''}`} />
                {isRefreshingVisit ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                onClick={handleBackToQueue}
                className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center text-base whitespace-nowrap"
                style={{ backgroundColor: '#2e13d1', color: '#FFFFFF' }}
              >
                <ArrowLeft className="inline-block mr-2 h-4 w-4" />
                Back to Queue
              </button>
              {!isCompletedMode && (
                <>
                  <button
                    onClick={() => setShowTransferModal(true)}
                    className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center text-base whitespace-nowrap"
                    style={{ backgroundColor: '#7C3AED', color: '#FFFFFF' }}
                    title="Transfer patient to another doctor"
                  >
                    <ArrowLeft className="inline-block mr-2 h-4 w-4 rotate-90" />
                    Transfer
                  </button>
                  <button
                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center text-base whitespace-nowrap ${hasPendingOrders ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    style={{
                      backgroundColor: hasPendingOrders ? '#9CA3AF' : '#EA2E00',
                      color: '#FFFFFF'
                    }}
                    onClick={handleCompleteVisit}
                    disabled={hasPendingOrders}
                    title={hasPendingOrders ? 'Cannot complete visit with pending lab, radiology, or procedure orders' : 'Complete this visit'}
                  >
                    Complete Visit
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {isCompletedMode && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 mt-0.5 text-emerald-700" />
              <div>
                <p className="text-sm font-semibold text-emerald-900">Completed Visit Review Mode</p>
                <p className="text-sm text-emerald-800 mt-1">
                  This visit was opened from the completed queue. Full consultation tabs and print actions are available here for follow-up review and re-issue workflows.
                </p>
              </div>
            </div>
          </div>
        )}

        {visit.parentVisit && (
          <div className="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <ArrowLeft className="h-5 w-5 mt-0.5 text-purple-700" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-purple-900">
                  Transferred from {visit.parentVisit.createdBy?.fullname || 'Unknown'}
                </p>
                <p className="text-sm text-purple-800 mt-1">
                  {visit.parentVisit.notes}
                </p>
                {visit.parentVisit.diagnosis && (
                  <p className="text-sm text-purple-800 mt-1">
                    <strong>Diagnosis:</strong> {visit.parentVisit.diagnosis}
                  </p>
                )}
                <p className="text-xs text-purple-600 mt-2">
                  Original visit #{visit.parentVisit.id} &middot; {new Date(visit.parentVisit.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs Navigation - SMART FLEX BLOCKS */}
        <div className="border-b" style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }}>
          <div className="p-3">
            <div className="flex flex-wrap gap-3">
              {(() => {
                const group1 = ['triage', 'vitals', 'patient-history', 'images'];
                const group2 = ['procedures', 'medications', 'compound-prescription', 'emergency-drugs', 'material-needs', 'lab', 'radiology', 'nurse-services'];
                const group3 = ['notes', 'accommodation'];
                const otherTabs = tabs.filter(t => !group1.includes(t.id) && !group2.includes(t.id) && !group3.includes(t.id));
                const groups = [
                  { title: 'Triage & Patient Information', ids: group1 },
                  { title: 'Clinical Orders & Treatments', ids: group2 },
                  { title: 'Diagnosis & Admission', ids: group3 },
                ];
                if (otherTabs.length > 0) groups.push({ title: 'Other', ids: otherTabs.map(t => t.id) });
                return groups.map(group => (
                  <div key={group.title} className="w-full mb-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 mt-1 border-b border-gray-200 pb-1">{group.title}</div>
                    <div className="flex flex-wrap gap-2">
                      {group.ids.map(tabId => {
                        const tab = tabs.find(t => t.id === tabId);
                        if (!tab) return null;
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;

                        // Define distinct colors for each tab
                        const tabColors = {
                  'triage': { bg: '#FEF3C7', activeBg: '#FDE68A', text: '#92400E', border: '#F59E0B' },
                  'vitals': { bg: '#EFF6FF', activeBg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' },
                  'patient-history': { bg: '#F1F5F9', activeBg: '#E2E8F0', text: '#475569', border: '#94A3B8' },
                  'images': { bg: '#F0FDF4', activeBg: '#DCFCE7', text: '#166534', border: '#22C55E' },
                  'procedures': { bg: '#E0E7FF', activeBg: '#C7D2FE', text: '#3730A3', border: '#6366F1' },
                  'dental': { bg: '#FEF3C7', activeBg: '#FDE68A', text: '#92400E', border: '#F59E0B' },
                  'dental-services': { bg: '#FEF3C7', activeBg: '#FDE68A', text: '#92400E', border: '#F59E0B' },
                  'notes': { bg: '#F3E8FF', activeBg: '#E9D5FF', text: '#6B21A8', border: '#A855F7' },
                  'medications': { bg: '#FCE7F3', activeBg: '#FBCFE8', text: '#9F1239', border: '#EC4899' },
                  'emergency-drugs': { bg: '#FEE2E2', activeBg: '#FECACA', text: '#991B1B', border: '#EF4444' },
                  'material-needs': { bg: '#FEF3C7', activeBg: '#FDE68A', text: '#92400E', border: '#F59E0B' },
                  'lab': { bg: '#E0F2FE', activeBg: '#BAE6FD', text: '#0C4A6E', border: '#0EA5E9' },
                  'radiology': { bg: '#FFF1F2', activeBg: '#FEE2E2', text: '#991B1B', border: '#EF4444' },
                  'nurse-services': { bg: '#F0F9FF', activeBg: '#DBEAFE', text: '#1E3A8A', border: '#3B82F6' },
                  'accommodation': { bg: '#F0FDF4', activeBg: '#DCFCE7', text: '#166534', border: '#15803d' }
                };

                const colors = tabColors[tab.id] || { bg: '#F9FAFB', activeBg: '#F3F4F6', text: '#6B7280', border: '#9CA3AF' };

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-grow flex items-center justify-center gap-2 px-4 py-3 border-2 font-semibold text-[13px] transition-all rounded-xl shadow-sm min-w-[160px] max-w-full ${isActive ? 'ring-2 ring-offset-1' : 'hover:scale-[1.03] hover:shadow-md active:scale-[0.97]'
                      }`}
                    style={{
                      borderColor: isActive ? colors.border : 'transparent',
                      backgroundColor: isActive ? colors.activeBg : colors.bg,
                      color: isActive ? colors.text : colors.text,
                      boxShadow: isActive ? `0 4px 10px -2px ${colors.border}40` : 'none',
                      ringColor: isActive ? colors.border : 'transparent'
                    }}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="whitespace-nowrap">{tab.label}</span>
                  </button>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
          </div>
        </div>
      </div>

        {/* Content Area */}
        <div className="border p-4" style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }}>
          {activeTab === 'triage' && (
            <div>
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#0C0E0B' }}>Record Triage Vitals</h3>
              <form onSubmit={handleTriageSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#0C0E0B' }}>
                      Blood Pressure
                    </label>
                    <input
                      type="text"
                      value={triageForm.bloodPressure}
                      onChange={(e) => setTriageForm({ ...triageForm, bloodPressure: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 120/80"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#0C0E0B' }}>
                      Temperature (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={triageForm.temperature}
                      onChange={(e) => setTriageForm({ ...triageForm, temperature: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 36.5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#0C0E0B' }}>
                      Heart Rate (bpm)
                    </label>
                    <input
                      type="number"
                      value={triageForm.heartRate}
                      onChange={(e) => setTriageForm({ ...triageForm, heartRate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 72"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#0C0E0B' }}>
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={triageForm.weight}
                      onChange={(e) => setTriageForm({ ...triageForm, weight: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 70"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#0C0E0B' }}>
                      Height (cm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={triageForm.height}
                      onChange={(e) => setTriageForm({ ...triageForm, height: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 175"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#0C0E0B' }}>
                      Oxygen Saturation (%)
                    </label>
                    <input
                      type="number"
                      value={triageForm.oxygenSaturation}
                      onChange={(e) => setTriageForm({ ...triageForm, oxygenSaturation: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 98"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#0C0E0B' }}>
                    Condition
                  </label>
                  <input
                    type="text"
                    value={triageForm.condition}
                    onChange={(e) => setTriageForm({ ...triageForm, condition: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Stable, Critical, etc."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#0C0E0B' }}>
                    Notes
                  </label>
                  <textarea
                    value={triageForm.notes}
                    onChange={(e) => setTriageForm({ ...triageForm, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Additional notes..."
                  />
                </div>

                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <h4 className="text-sm font-semibold mb-3" style={{ color: '#0C0E0B' }}>
                    Physical Assessment (Doctor Addendum)
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">General Appearance Status</label>
                      <select
                        value={triageForm.generalAppearanceStatus}
                        onChange={(e) => setTriageForm({ ...triageForm, generalAppearanceStatus: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="NOT_ASSESSED">Not Assessed</option>
                        <option value="NORMAL">Normal</option>
                        <option value="ABNORMAL">Abnormal</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">General Appearance Notes</label>
                      <input
                        type="text"
                        value={triageForm.generalAppearance}
                        onChange={(e) => setTriageForm({ ...triageForm, generalAppearance: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Alertness, distress, cooperation"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Skin Status</label>
                      <select
                        value={triageForm.skinStatus}
                        onChange={(e) => setTriageForm({ ...triageForm, skinStatus: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="NOT_ASSESSED">Not Assessed</option>
                        <option value="NORMAL">Normal</option>
                        <option value="ABNORMAL">Abnormal</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Skin Findings</label>
                      <input
                        type="text"
                        value={triageForm.skinFindings}
                        onChange={(e) => setTriageForm({ ...triageForm, skinFindings: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Rash, lesion, edema, wound"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium mb-2">Skin Body Regions</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 border border-gray-200 rounded-md bg-white">
                      {['Head/Face', 'Neck', 'Chest', 'Back', 'Abdomen', 'Upper Limbs', 'Lower Limbs', 'Generalized'].map((region) => (
                        <label key={region} className="flex items-center space-x-2 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={triageForm.skinBodyRegions.includes(region)}
                            onChange={(e) => {
                              const nextRegions = e.target.checked
                                ? [...triageForm.skinBodyRegions, region]
                                : triageForm.skinBodyRegions.filter((item) => item !== region);
                              setTriageForm({ ...triageForm, skinBodyRegions: nextRegions });
                            }}
                          />
                          <span>{region}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Head & Neck</label>
                      <textarea
                        rows={2}
                        value={triageForm.headAndNeck}
                        onChange={(e) => setTriageForm({ ...triageForm, headAndNeck: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Head and neck exam"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Cardiovascular</label>
                      <textarea
                        rows={2}
                        value={triageForm.cardiovascularExam}
                        onChange={(e) => setTriageForm({ ...triageForm, cardiovascularExam: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Heart sounds, pulses"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Respiratory</label>
                      <textarea
                        rows={2}
                        value={triageForm.respiratoryExam}
                        onChange={(e) => setTriageForm({ ...triageForm, respiratoryExam: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Lung sounds, effort"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Abdominal</label>
                      <textarea
                        rows={2}
                        value={triageForm.abdominalExam}
                        onChange={(e) => setTriageForm({ ...triageForm, abdominalExam: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Inspection, palpation"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Extremities</label>
                      <textarea
                        rows={2}
                        value={triageForm.extremities}
                        onChange={(e) => setTriageForm({ ...triageForm, extremities: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Movement, edema, tenderness"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Neurological</label>
                      <textarea
                        rows={2}
                        value={triageForm.neurologicalExam}
                        onChange={(e) => setTriageForm({ ...triageForm, neurologicalExam: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        placeholder="Mental status, motor, sensory"
                      />
                    </div>
                  </div>

                  <div className="mt-4 p-3 rounded-md border border-amber-200 bg-amber-50">
                    <label className="flex items-center text-sm font-medium text-amber-900 mb-2">
                      <input
                        type="checkbox"
                        checked={triageForm.doctorAlertFlag}
                        onChange={(e) => setTriageForm({ ...triageForm, doctorAlertFlag: e.target.checked })}
                        className="mr-2"
                      />
                      Flag Important Finding
                    </label>
                    <textarea
                      rows={2}
                      value={triageForm.doctorAlertSummary}
                      onChange={(e) => setTriageForm({ ...triageForm, doctorAlertSummary: e.target.value })}
                      className="w-full px-3 py-2 border border-amber-300 rounded-md"
                      placeholder="Short warning or handoff note"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab('vitals')}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    disabled={recordingTriage}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={recordingTriage}
                    className="px-4 py-2 rounded-md font-medium text-white transition-colors"
                    style={{
                      backgroundColor: recordingTriage ? '#9CA3AF' : '#2e13d1',
                      cursor: recordingTriage ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {recordingTriage ? 'Recording...' : 'Add Doctor Vitals'}
                  </button>
                </div>
              </form>

              {/* Register links — Abortion Care & Family Planning */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Patient Registers</h4>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/doctor/abortion-care?patientId=${visit?.patient?.id || ''}&visitId=${visitId}`)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors text-sm font-medium"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Fill Abortion Care Form
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/nurse/family-planning?patientId=${visit?.patient?.id || ''}&visitId=${visitId}`)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-pink-50 text-pink-700 border border-pink-200 rounded-lg hover:bg-pink-100 transition-colors text-sm font-medium"
                  >
                    <Activity className="h-4 w-4" />
                    Fill Family Planning Form
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'vitals' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold" style={{ color: '#0C0E0B' }}>Vitals & History</h3>
                <button
                  onClick={() => setActiveTab('triage')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                >
                  <Stethoscope className="h-4 w-4" />
                  <span>Add Doctor Vitals</span>
                </button>
              </div>

              {allVitals.length > 0 ? (
                <>
                  {/* Nurse Vitals Section - Read Only */}
                  {nurseVitals && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold" style={{ color: '#0C0E0B' }}>
                          Nurse Recorded Vitals
                        </h4>
                        <span className="px-3 py-1 bg-green-100 text-indigo-800 text-xs font-medium rounded-full">
                          Recorded by Nurse
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                          <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Blood Pressure</p>
                          <p className="text-xl font-semibold mt-1" style={{ color: '#0C0E0B' }}>
                            {nurseVitals.bloodPressure || 'N/A'}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                          <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Temperature</p>
                          <p className="text-xl font-semibold mt-1" style={{ color: '#0C0E0B' }}>
                            {nurseVitals.temperature ? `${nurseVitals.temperature}°C` : 'N/A'}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                          <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Heart Rate</p>
                          <p className="text-xl font-semibold mt-1" style={{ color: '#0C0E0B' }}>
                            {nurseVitals.heartRate ? `${nurseVitals.heartRate} bpm` : 'N/A'}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                          <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Weight</p>
                          <p className="text-xl font-semibold mt-1" style={{ color: '#0C0E0B' }}>
                            {nurseVitals.weight ? `${nurseVitals.weight} kg` : 'N/A'}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                          <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Height</p>
                          <p className="text-xl font-semibold mt-1" style={{ color: '#0C0E0B' }}>
                            {nurseVitals.height ? `${nurseVitals.height} cm` : 'N/A'}
                          </p>
                        </div>
                        <div className="p-4 rounded-lg" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                          <p className="text-xs font-medium" style={{ color: '#6B7280' }}>SpO2</p>
                          <p className="text-xl font-semibold mt-1" style={{ color: '#0C0E0B' }}>
                            {nurseVitals.oxygenSaturation || nurseVitals.spo2 ? `${nurseVitals.oxygenSaturation || nurseVitals.spo2}%` : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Doctor Vitals Section(s) - Additional Vitals */}
                  {doctorVitals.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold" style={{ color: '#0C0E0B' }}>
                          Doctor Recorded Vitals
                        </h4>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                          {doctorVitals.length} additional reading{doctorVitals.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      {doctorVitals.map((dv, index) => (
                        <div key={dv.id} className="mb-4">
                          <p className="text-xs text-gray-500 mb-2">
                            Reading {index + 1} - {new Date(dv.createdAt).toLocaleString()}
                          </p>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                              <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Blood Pressure</p>
                              <p className="text-xl font-semibold mt-1" style={{ color: '#0C0E0B' }}>
                                {dv.bloodPressure || 'N/A'}
                              </p>
                            </div>
                            <div className="p-4 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                              <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Temperature</p>
                              <p className="text-xl font-semibold mt-1" style={{ color: '#0C0E0B' }}>
                                {dv.temperature ? `${dv.temperature}°C` : 'N/A'}
                              </p>
                            </div>
                            <div className="p-4 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                              <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Heart Rate</p>
                              <p className="text-xl font-semibold mt-1" style={{ color: '#0C0E0B' }}>
                                {dv.heartRate ? `${dv.heartRate} bpm` : 'N/A'}
                              </p>
                            </div>
                            <div className="p-4 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                              <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Weight</p>
                              <p className="text-xl font-semibold mt-1" style={{ color: '#0C0E0B' }}>
                                {dv.weight ? `${dv.weight} kg` : 'N/A'}
                              </p>
                            </div>
                            <div className="p-4 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                              <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Height</p>
                              <p className="text-xl font-semibold mt-1" style={{ color: '#0C0E0B' }}>
                                {dv.height ? `${dv.height} cm` : 'N/A'}
                              </p>
                            </div>
                            <div className="p-4 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                              <p className="text-xs font-medium" style={{ color: '#6B7280' }}>SpO2</p>
                              <p className="text-xl font-semibold mt-1" style={{ color: '#0C0E0B' }}>
                                {dv.oxygenSaturation || dv.spo2 ? `${dv.oxygenSaturation || dv.spo2}%` : 'N/A'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {nurseVitals && (
                    <div>
                      {/* Chief Complaint & History */}
                      <div className="mt-6">
                        <h4 className="font-semibold mb-2" style={{ color: '#0C0E0B' }}>Chief Complaint & History</h4>
                        <div className="space-y-3">
                          {nurseVitals.chiefComplaint && (
                            <div>
                              <p className="text-sm font-medium" style={{ color: '#6B7280' }}>Chief Complaint:</p>
                              <p className="p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB', color: '#0C0E0B' }}>
                                {nurseVitals.chiefComplaint}
                              </p>
                            </div>
                          )}
                          {nurseVitals.historyOfPresentIllness && (
                            <div>
                              <p className="text-sm font-medium" style={{ color: '#6B7280' }}>History of Present Illness:</p>
                              <p className="p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB', color: '#0C0E0B' }}>
                                {nurseVitals.historyOfPresentIllness}
                              </p>
                            </div>
                          )}
                          {nurseVitals.onsetOfSymptoms && (
                            <div>
                              <p className="text-sm font-medium" style={{ color: '#6B7280' }}>Onset of Symptoms:</p>
                              <p className="p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB', color: '#0C0E0B' }}>
                                {nurseVitals.onsetOfSymptoms}
                              </p>
                            </div>
                          )}
                          {nurseVitals.durationOfSymptoms && (
                            <div>
                              <p className="text-sm font-medium" style={{ color: '#6B7280' }}>Duration of Symptoms:</p>
                              <p className="p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB', color: '#0C0E0B' }}>
                                {nurseVitals.durationOfSymptoms}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Physical Examination */}
                      <div className="mt-6">
                        <h4 className="font-semibold mb-2" style={{ color: '#0C0E0B' }}>Physical Examination</h4>
                        <div className="space-y-3">
                          {nurseVitals.generalAppearance && (
                            <div>
                              <p className="text-sm font-medium" style={{ color: '#6B7280' }}>General Appearance:</p>
                              <p className="p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB', color: '#0C0E0B' }}>
                                {nurseVitals.generalAppearance}
                              </p>
                            </div>
                          )}
                          {nurseVitals.headAndNeck && (
                            <div>
                              <p className="text-sm font-medium" style={{ color: '#6B7280' }}>Head & Neck:</p>
                              <p className="p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB', color: '#0C0E0B' }}>
                                {nurseVitals.headAndNeck}
                              </p>
                            </div>
                          )}
                          {nurseVitals.cardiovascularExam && (
                            <div>
                              <p className="text-sm font-medium" style={{ color: '#6B7280' }}>Cardiovascular:</p>
                              <p className="p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB', color: '#0C0E0B' }}>
                                {nurseVitals.cardiovascularExam}
                              </p>
                            </div>
                          )}
                          {nurseVitals.respiratoryExam && (
                            <div>
                              <p className="text-sm font-medium" style={{ color: '#6B7280' }}>Respiratory:</p>
                              <p className="p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB', color: '#0C0E0B' }}>
                                {nurseVitals.respiratoryExam}
                              </p>
                            </div>
                          )}
                          {nurseVitals.abdominalExam && (
                            <div>
                              <p className="text-sm font-medium" style={{ color: '#6B7280' }}>Abdominal:</p>
                              <p className="p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB', color: '#0C0E0B' }}>
                                {nurseVitals.abdominalExam}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Nurse Notes */}
                      {nurseVitals.notes && (
                        <div className="mt-6">
                          <h4 className="font-semibold mb-2" style={{ color: '#0C0E0B' }}>Nurse Notes</h4>
                          <p className="p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB', color: '#0C0E0B' }}>
                            {nurseVitals.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <Stethoscope className="h-12 w-12 mx-auto mb-4" style={{ color: '#9CA3AF' }} />
                  <p style={{ color: '#6B7280' }}>No vitals recorded for this visit.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'patient-history' && (
            <div>
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#0C0E0B' }}>Patient History</h3>
              {patientHistoryLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#2e13d1' }}></div>
                    <p style={{ color: '#6B7280' }}>Loading patient history...</p>
                  </div>
                </div>
              ) : patientHistory ? (
                <div className="space-y-6">
                  {/* Patient Info */}
                  <div className="p-4 rounded-lg border" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Patient Name</p>
                        <p className="text-sm font-semibold" style={{ color: '#0C0E0B' }}>{patientHistory.patient.name}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Age / Gender</p>
                        <p className="text-sm font-semibold" style={{ color: '#0C0E0B' }}>
                          {(patientHistory.patient.age && patientHistory.patient.age !== 0 ? patientHistory.patient.age : (patientHistory.patient.dob ? calculateAge(patientHistory.patient.dob) : 'N/A'))} / {patientHistory.patient.gender || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Blood Type</p>
                        <p className="text-sm font-semibold" style={{ color: '#0C0E0B' }}>{patientHistory.patient.bloodType || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Mobile</p>
                        <p className="text-sm font-semibold" style={{ color: '#0C0E0B' }}>{patientHistory.patient.phone || patientHistory.patient.mobile || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Visit List */}

                  {/* Visit List */}
                  {patientHistory.visits && patientHistory.visits.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-md font-semibold flex items-center gap-2" style={{ color: '#0C0E0B' }}>
                          <Calendar className="h-4 w-4" />
                          Past Visits ({patientHistory.visits.length})
                        </h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {patientHistory.visits.map((visitItem) => (
                          <div
                            key={visitItem.id}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${selectedHistoryVisitId === visitItem.id ? 'border-indigo-500 bg-indigo-50 shadow-md' : 'border-gray-200 hover:border-gray-300 bg-white'
                              }`}
                            onClick={() => setSelectedHistoryVisitId(visitItem.id)}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <p className="font-bold text-lg" style={{ color: '#0C0E0B' }}>{visitItem.visitUid}</p>
                                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${visitItem.status === 'COMPLETED' ? 'bg-green-100 text-green-700 border border-indigo-200' :
                                    visitItem.status === 'CANCELLED' ? 'bg-red-100 text-red-700 border border-red-200' :
                                      'bg-yellow-100 text-yellow-700 border border-yellow-200'
                                    }`}>
                                    {visitItem.status?.replace(/_/g, ' ') || 'N/A'}
                                  </span>
                                </div>
                                <p className="text-sm flex items-center gap-1" style={{ color: '#6B7280' }}>
                                  <Calendar className="h-3 w-3" />
                                  {new Date(visitItem.date || visitItem.createdAt).toLocaleDateString()} • {new Date(visitItem.date || visitItem.createdAt).toLocaleTimeString()}
                                </p>
                                {visitItem.diagnosis && (
                                  <p className="text-sm mt-2 font-medium bg-blue-50 px-3 py-1 rounded-lg border border-blue-100" style={{ color: '#1E40AF' }}>
                                    📋 {visitItem.diagnosis}
                                  </p>
                                )}
                                {visitItem.doctor && (
                                  <p className="text-xs mt-2" style={{ color: '#6B7280' }}>
                                    👨‍⚕️ Dr. {visitItem.doctor.fullname}
                                  </p>
                                )}
                                {visitItem.cardProduct && (
                                  <p className="text-xs mt-1 font-medium text-indigo-600">
                                    💳 Card: {visitItem.cardProduct.name}
                                  </p>
                                )}
                              </div>
                              <ChevronRight className={`h-5 w-5 transition-transform ${selectedHistoryVisitId === visitItem.id ? 'text-indigo-600 rotate-90' : 'text-gray-400'}`} />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Selected Visit Details */}
                      {selectedHistoryVisitId && (() => {
                        const selectedVisit = patientHistory.visits.find(v => v.id === selectedHistoryVisitId);
                        if (!selectedVisit) return null;

                        return (
                          <div className="mt-6">
                            {/* Tab Buttons */}
                            <div className="flex flex-wrap gap-2 mb-4 p-2 bg-gray-50 rounded-lg">
                              <button
                                onClick={() => setVisitDetailTab('summary')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${visitDetailTab === 'summary' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                                  }`}
                              >
                                Summary
                              </button>
                              <button
                                onClick={() => setVisitDetailTab('vitals')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${visitDetailTab === 'vitals' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                                  }`}
                              >
                                Vitals ({selectedVisit.vitals?.length || 0})
                              </button>
                              <button
                                onClick={() => setVisitDetailTab('notes')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${visitDetailTab === 'notes' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                                  }`}
                              >
                                Diagnosis Notes
                              </button>
                              <button
                                onClick={() => setVisitDetailTab('labs')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${visitDetailTab === 'labs' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                                  }`}
                              >
                                Lab Orders ({(selectedVisit.labOrders?.length || 0) + (selectedVisit.labTestOrders?.length || 0)})
                              </button>
                              <button
                                onClick={() => setVisitDetailTab('radiology')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${visitDetailTab === 'radiology' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                                  }`}
                              >
                                Radiology ({(selectedVisit.radiologyOrders?.length || 0) + (selectedVisit.batchOrders?.filter(bo => bo.type === 'RADIOLOGY').reduce((acc, bo) => acc + (bo.services?.length || 0), 0) || 0)})
                              </button>
                              <button
                                onClick={() => setVisitDetailTab('medications')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${visitDetailTab === 'medications' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                                  }`}
                              >
                                Medications ({selectedVisit.medicationOrders?.length || 0})
                              </button>
                              <button
                                onClick={() => setVisitDetailTab('compoundRx')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${visitDetailTab === 'compoundRx' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                                  }`}
                              >
                                Compound Rx ({selectedVisit.compoundPrescriptions?.length || 0})
                              </button>
                              <button
                                onClick={() => setVisitDetailTab('procedures')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${visitDetailTab === 'procedures' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                                  }`}
                              >
                                Procedures ({selectedVisit.procedures?.length || 0})
                              </button>
                              <button
                                onClick={() => setVisitDetailTab('images')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${visitDetailTab === 'images' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                                  }`}
                              >
                                Images ({selectedVisit.files?.length || 0})
                              </button>
                              <button
                                onClick={() => setVisitDetailTab('other')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${visitDetailTab === 'other' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                                  }`}
                              >
                                Other Services
                              </button>
                            </div>

                            {/* Tab Content */}
                            <div className="bg-white border rounded-lg p-4">
                              {/* Summary Tab */}
                              {visitDetailTab === 'summary' && (
                                <div className="space-y-6">
                                  {/* Header */}
                                  <div className="flex items-center gap-2 pb-3 border-b flex-wrap">
                                    <FileText className="h-5 w-5 text-indigo-600" />
                                    <h4 className="text-lg font-bold">Visit #{selectedVisit.visitUid}</h4>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${selectedVisit.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                      {selectedVisit.status?.replace(/_/g, ' ')}
                                    </span>
                                    {selectedVisit.cardProduct && (
                                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                                        💳 {selectedVisit.cardProduct.name}
                                      </span>
                                    )}
                                    <span className="text-xs text-gray-500 ml-auto">
                                      {new Date(selectedVisit.date || selectedVisit.createdAt).toLocaleString()}
                                    </span>
                                  </div>

                                  {/* Stats Grid */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="p-3 bg-green-50 rounded-lg">
                                      <p className="text-xs text-green-700">Diagnoses</p>
                                      <p className="text-2xl font-bold text-indigo-800">{selectedVisit.diagnoses?.length || 0}</p>
                                    </div>
                                    <div className="p-3 bg-blue-50 rounded-lg">
                                      <p className="text-xs text-blue-700">Lab Orders</p>
                                      <p className="text-2xl font-bold text-blue-800">{(selectedVisit.labOrders?.length || 0) + (selectedVisit.labTestOrders?.length || 0) + (selectedVisit.batchOrders?.filter(bo => bo.type === 'LAB').reduce((acc, bo) => acc + (bo.services?.length || 0), 0) || 0)}</p>
                                    </div>
                                    <div className="p-3 bg-yellow-50 rounded-lg">
                                      <p className="text-xs text-yellow-700">Radiology</p>
                                      <p className="text-2xl font-bold text-yellow-800">{(selectedVisit.radiologyOrders?.length || 0) + (selectedVisit.batchOrders?.filter(bo => bo.type === 'RADIOLOGY').reduce((acc, bo) => acc + (bo.services?.length || 0), 0) || 0)}</p>
                                    </div>
                                    <div className="p-3 bg-purple-50 rounded-lg">
                                      <p className="text-xs text-purple-700">Medications</p>
                                      <p className="text-2xl font-bold text-purple-800">{selectedVisit.medicationOrders?.length || 0}</p>
                                    </div>
                                  </div>

                                  {/* Diagnosis Notes Section */}
                                  {selectedVisit.diagnosisNotes && selectedVisit.diagnosisNotes.length > 0 && (
                                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                                      <h5 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                                        📋 Diagnosis Notes
                                      </h5>
                                      <div className="space-y-2">
                                        {selectedVisit.diagnosisNotes.map((note, i) => (
                                          <div key={i} className="p-3 bg-white rounded-lg border border-blue-100">
                                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.notes || note.content || note.text}</p>
                                            <div className="flex gap-4 mt-2 text-xs text-blue-600">
                                              <span>Dr. {note.doctor?.fullname || 'Unknown'}</span>
                                              <span>{new Date(note.createdAt).toLocaleString()}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Confirmed Diagnoses */}
                                  {selectedVisit.diagnoses && selectedVisit.diagnoses.length > 0 && (
                                    <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
                                      <h5 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                                        🦠 Confirmed Diagnoses
                                      </h5>
                                      <div className="flex flex-wrap gap-2">
                                        {selectedVisit.diagnoses.map((diag, i) => (
                                          <span key={i} className="px-3 py-1.5 bg-white text-red-700 border border-red-200 rounded text-xs font-semibold">
                                            {diag.disease?.name} ({diag.type})
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Vitals Section */}
                                  {selectedVisit.vitals && selectedVisit.vitals.length > 0 && (
                                    <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                                      <h5 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                                        ❤️ Vital Signs
                                      </h5>
                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {selectedVisit.vitals.map((vital, i) => (
                                          <div key={i} className="p-3 bg-white rounded-lg border border-red-100 text-sm">
                                            <p className="text-xs text-red-500 mb-1">{new Date(vital.createdAt).toLocaleString()}</p>
                                            <div className="grid grid-cols-2 gap-1 text-xs">
                                              <span>BP: {vital.bloodPressure || 'N/A'}</span>
                                              <span>HR: {vital.heartRate || 'N/A'}</span>
                                              <span>Temp: {vital.temperature ? `${vital.temperature}°C` : 'N/A'}</span>
                                              <span>Weight: {vital.weight ? `${vital.weight}kg` : 'N/A'}</span>
                                              {vital.oxygenSaturation && <span>O₂: {vital.oxygenSaturation}%</span>}
                                            </div>
                                            <p className="text-xs text-red-400 mt-2">Recorded by: {vital.recordedBy?.fullname || vital.recordedByRole || 'N/A'}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Lab Results Section */}
                                  {selectedVisit.labResults && selectedVisit.labResults.length > 0 && (
                                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                                      <h5 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                                        🧪 Lab Results
                                      </h5>
                                      <div className="space-y-2">
                                        {selectedVisit.labResults.map((result, i) => (
                                          <div key={i} className="p-3 bg-white rounded-lg border border-blue-100">
                                            <div className="flex justify-between items-start">
                                              <p className="font-semibold text-blue-900 text-sm">{result.testType?.name}</p>
                                              <span className={`px-2 py-0.5 rounded-full text-xs ${result.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                {result.status}
                                              </span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">{new Date(result.createdAt).toLocaleString()}</p>
                                            {result.processedByUser && (
                                              <p className="text-xs text-blue-700 mt-1">Processed by: {result.processedByUser.fullname} ({result.processedByUser.role})</p>
                                            )}
                                            {result.verifiedByUser && (
                                              <p className="text-xs text-blue-600">Verified by: {result.verifiedByUser.fullname} | {new Date(result.verifiedAt).toLocaleString()}</p>
                                            )}
                                            {!result.verifiedByUser && result.verifiedBy && (
                                              <p className="text-xs text-gray-500">Verified by: {result.verifiedBy}</p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Radiology Section */}
                                  {(() => {
                                    const radResults = [];
                                    if (selectedVisit.batchOrders) {
                                      selectedVisit.batchOrders
                                        .filter(bo => bo.type === 'RADIOLOGY')
                                        .forEach(bo => {
                                          if (bo.radiologyResults) {
                                            bo.radiologyResults.forEach(r => radResults.push(r));
                                          }
                                        });
                                    }
                                    if (selectedVisit.radiologyResults) {
                                      selectedVisit.radiologyResults.forEach(r => {
                                        if (!radResults.find(existing => existing.id === r.id)) {
                                          radResults.push(r);
                                        }
                                      });
                                    }
                                    if (radResults.length === 0) return null;
                                    return (
                                      <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                                        <h5 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                                          🩻 Radiology Results
                                        </h5>
                                        <div className="space-y-3">
                                          {radResults.map((result, i) => {
                                            const images = result.attachments || [];
                                            return (
                                              <div key={i} className="p-3 bg-white rounded-lg border border-purple-100">
                                                <div className="flex justify-between items-start">
                                                  <div>
                                                    <p className="font-semibold text-purple-900 text-sm">{result.testType?.name}</p>
                                                    <p className="text-xs text-gray-500 mt-1">{new Date(result.createdAt).toLocaleString()}</p>
                                                  </div>
                                                  <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">COMPLETED</span>
                                                </div>
                                                {(result.clinicalIndication || result.technique || result.findings || result.conclusion) && (
                                                  <div className="mt-2 space-y-1.5 text-sm">
                                                    {result.clinicalIndication && (
                                                      <p><span className="font-medium text-purple-700">Indication:</span> {result.clinicalIndication}</p>
                                                    )}
                                                    {result.technique && (
                                                      <p><span className="font-medium text-purple-700">Technique:</span> {result.technique}</p>
                                                    )}
                                                    {(result.finding || result.resultText || result.findings) && (
                                                      <p className="whitespace-pre-wrap"><span className="font-medium text-purple-700">Findings:</span> {result.finding || result.resultText || result.findings}</p>
                                                    )}
                                                    {result.conclusion && (
                                                      <p className="whitespace-pre-wrap"><span className="font-medium text-purple-700">Conclusion:</span> {result.conclusion}</p>
                                                    )}
                                                  </div>
                                                )}
                                                {images.length > 0 && (
                                                  <div className="mt-2 grid grid-cols-3 md:grid-cols-4 gap-2">
                                                    {images.map((att, aIdx) => (
                                                      <div
                                                        key={aIdx}
                                                        onClick={() => openImageViewer(images, aIdx)}
                                                        className="relative group cursor-pointer rounded-lg overflow-hidden border border-purple-200 hover:border-blue-400 transition-all"
                                                      >
                                                        <img
                                                          src={getImageUrl(att.fileUrl)}
                                                          alt={att.fileName || `Scan ${aIdx + 1}`}
                                                          className="w-full h-20 object-cover"
                                                          onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            e.target.nextSibling.style.display = 'flex';
                                                          }}
                                                        />
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                                          <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 bg-black/50 px-2 py-1 rounded">Click to view</span>
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                                {result.radiologistUser && (
                                                  <p className="text-xs text-purple-600 mt-1">Reported by: Dr. {result.radiologistUser.fullname}</p>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {/* Medications Section */}
                                  {selectedVisit.medicationOrders && selectedVisit.medicationOrders.length > 0 && (
                                    <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                                      <h5 className="font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                                        💊 Medications
                                      </h5>
                                      <div className="space-y-2">
                                        {selectedVisit.medicationOrders.map((med, i) => (
                                          <div key={i} className="p-3 bg-white rounded-lg border border-indigo-100 text-sm">
                                            <p className="font-semibold text-gray-900">{med.name}</p>
                                            <p className="text-xs text-indigo-600">Prescribed by: Dr. {med.doctor?.fullname || 'Unknown'}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Dental Procedures */}
                                  {selectedVisit.dentalProcedureCompletions && selectedVisit.dentalProcedureCompletions.length > 0 && (
                                    <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-100">
                                      <h5 className="font-semibold text-cyan-900 mb-3 flex items-center gap-2">
                                        🦷 Dental Procedures
                                      </h5>
                                      <div className="space-y-2">
                                        {selectedVisit.dentalProcedureCompletions.map((proc, i) => (
                                          <div key={i} className="p-3 bg-white rounded-lg border border-cyan-100 text-sm">
                                            <p className="font-semibold text-cyan-900">{proc.batchOrderService?.service?.name || 'Procedure'}</p>
                                            <p className="text-xs text-cyan-600">Completed by: {proc.doctor?.fullname || 'Unknown'}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Emergency / Material Orders */}
                                  {selectedVisit.emergencyDrugOrders && selectedVisit.emergencyDrugOrders.length > 0 && (
                                    <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                                      <h5 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
                                        🚑 Emergency Orders
                                      </h5>
                                      <div className="space-y-2">
                                        {selectedVisit.emergencyDrugOrders.map((drug, i) => (
                                          <div key={i} className="p-3 bg-white rounded-lg border border-orange-100 text-sm">
                                            <p className="font-semibold text-orange-900">{drug.service?.name || 'Item'}</p>
                                            <p className="text-xs text-orange-600">Ordered by: Dr. {drug.doctor?.fullname || drug.doctor || 'Unknown'}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Nurse Services */}
                                  {selectedVisit.nurseServiceAssignments && selectedVisit.nurseServiceAssignments.length > 0 && (
                                    <div className="p-4 bg-pink-50 rounded-lg border border-pink-100">
                                      <h5 className="font-semibold text-pink-900 mb-3 flex items-center gap-2">
                                        👩‍⚕️ Nurse Services
                                      </h5>
                                      <div className="space-y-2">
                                        {selectedVisit.nurseServiceAssignments.map((svc, i) => (
                                          <div key={i} className="p-3 bg-white rounded-lg border border-pink-100 text-sm">
                                            <p className="font-semibold text-pink-900">{svc.service?.name || 'Service'}</p>
                                            <p className="text-xs text-pink-600">Handled by: {svc.assignedNurse?.fullname || 'Unknown'}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Empty state */}
                                  {(!selectedVisit.diagnosisNotes || selectedVisit.diagnosisNotes.length === 0) &&
                                    (!selectedVisit.diagnoses || selectedVisit.diagnoses.length === 0) &&
                                    (!selectedVisit.vitals || selectedVisit.vitals.length === 0) &&
                                    (!selectedVisit.labResults || selectedVisit.labResults.length === 0) &&
                                    (!selectedVisit.radiologyResults || selectedVisit.radiologyResults.length === 0) &&
                                    (!selectedVisit.medicationOrders || selectedVisit.medicationOrders.length === 0) &&
                                    (!selectedVisit.dentalProcedureCompletions || selectedVisit.dentalProcedureCompletions.length === 0) &&
                                    (!selectedVisit.emergencyDrugOrders || selectedVisit.emergencyDrugOrders.length === 0) &&
                                    (!selectedVisit.nurseServiceAssignments || selectedVisit.nurseServiceAssignments.length === 0) && (
                                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                                      <p className="text-sm text-gray-500">No data recorded for this visit.</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Vitals Tab */}
                              {visitDetailTab === 'vitals' && (
                                <div className="space-y-4">
                                  <h4 className="font-bold text-lg">Vitals Recorded</h4>
                                  {selectedVisit.vitals && selectedVisit.vitals.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {selectedVisit.vitals.map((vital) => (
                                        <div key={vital.id} className="p-4 border rounded-lg bg-red-50">
                                          <p className="text-xs text-red-600 mb-2">{new Date(vital.createdAt).toLocaleString()}</p>
                                          <div className="grid grid-cols-2 gap-2 text-sm">
                                            <p>🩺 BP: {vital.bloodPressure || 'N/A'}</p>
                                            <p>❤️ HR: {vital.heartRate || 'N/A'} bpm</p>
                                            <p>🌡️ Temp: {vital.temperature ? `${vital.temperature}°C` : 'N/A'}</p>
                                            <p>⚖️ Weight: {vital.weight ? `${vital.weight}kg` : 'N/A'}</p>
                                            {vital.oxygenSaturation && <p>🫁 O₂: {vital.oxygenSaturation}%</p>}
                                          </div>
                                          <p className="text-xs text-red-500 mt-2">Recorded by: {vital.recordedBy?.fullname || vital.recordedByRole || 'Unknown'}</p>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-gray-500">No vitals recorded for this visit</p>
                                  )}
                                </div>
                              )}

                              {/* Diagnosis Notes Tab */}
                              {visitDetailTab === 'notes' && (
                                <div className="space-y-4">
                                  <h4 className="font-bold text-lg flex items-center gap-2 text-blue-800">
                                    📋 Diagnosis Notes
                                  </h4>
                                  {selectedVisit.diagnosisNotes && selectedVisit.diagnosisNotes.length > 0 ? (
                                    <div className="space-y-3">
                                      {selectedVisit.diagnosisNotes.map((note) => (
                                        <NoteDisplayWithEdit
                                          key={note.id}
                                          note={note}
                                          visitId={selectedVisit.id}
                                          onUpdate={() => {
                                            const idx = patientHistory.visits.findIndex(v => v.id === selectedVisit.id);
                                            if (idx !== -1 && patientHistory.visits[idx].diagnosisNotes) {
                                              fetchPatientHistory(selectedVisit.patientId);
                                            }
                                          }}
                                        />
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-gray-500">No diagnosis notes for this visit</p>
                                  )}

                                  {selectedVisit.diagnoses && selectedVisit.diagnoses.length > 0 && (
                                    <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-100">
                                      <h5 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                                        🦠 Confirmed Diagnoses for this Visit
                                      </h5>
                                      <div className="flex flex-wrap gap-2">
                                        {selectedVisit.diagnoses.map((diag, i) => (
                                          <div key={i} className="px-3 py-2 bg-white text-red-800 rounded-md border border-red-200 text-sm shadow-sm">
                                            <span className="font-bold">{diag.disease?.name}</span>
                                            {diag.disease?.code && <span className="ml-1 text-red-600">({diag.disease.code})</span>}
                                            <span className="ml-2 text-xs px-2 py-0.5 bg-red-100 rounded-full">{diag.type}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Lab Orders Tab */}
                              {visitDetailTab === 'labs' && (
                                <div className="space-y-4">
                                  <h4 className="font-bold text-lg flex items-center gap-2 text-blue-800">
                                    🧪 Lab Results & Orders
                                  </h4>
                                  {selectedVisit.labResults && selectedVisit.labResults.length > 0 ? (
                                    <div className="space-y-4">
                                      {selectedVisit.labResults.map((result, idx) => (
                                        <div key={idx} className="p-4 border border-blue-100 rounded-lg shadow-sm bg-blue-50">
                                          <div className="flex justify-between items-start mb-2">
                                            <div>
                                              <p className="font-semibold text-blue-900">{result.testType?.name || 'Lab Test'}</p>
                                              <p className="text-xs text-blue-600">{new Date(result.createdAt).toLocaleString()}</p>
                                            </div>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${result.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                              {result.status}
                                            </span>
                                          </div>

                                          {result.resultText && (
                                            <div className="mt-2 text-sm bg-white p-2 rounded border border-blue-50 text-gray-700">
                                              <span className="font-medium">Note/Result:</span> {result.resultText}
                                            </div>
                                          )}

                                          {result.detailedResults && result.detailedResults.length > 0 && (
                                            <div className="mt-3 bg-white rounded-lg border border-gray-200 overflow-hidden">
                                              <table className="min-w-full divide-y divide-gray-200 text-sm">
                                                <thead className="bg-gray-50">
                                                  <tr>
                                                    <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Test</th>
                                                    <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Result</th>
                                                    <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Unit</th>
                                                    <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Ref Range</th>
                                                  </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                  {result.detailedResults.map((dr, di) => (
                                                    <tr key={di}>
                                                      <td className="px-3 py-2 text-gray-900 font-medium">{dr.testName}</td>
                                                      <td className="px-3 py-2 text-gray-700 font-bold">{dr.result}</td>
                                                      <td className="px-3 py-2 text-gray-500">{dr.unit}</td>
                                                      <td className="px-3 py-2 text-gray-500">{dr.referenceRange}</td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}
                                          {result.processedByUser && (
                                            <div className="mt-2 text-xs text-blue-700">
                                              Processed by: {result.processedByUser.fullname} ({result.processedByUser.role})
                                            </div>
                                          )}
                                          {result.verifiedByUser && (
                                            <div className="mt-1 text-xs text-blue-600">
                                              Verified by: {result.verifiedByUser.fullname} | {new Date(result.verifiedAt).toLocaleString()}
                                            </div>
                                          )}
                                          {!result.verifiedByUser && result.verifiedBy && (
                                            <div className="mt-1 text-xs text-gray-500">
                                              Verified by: {result.verifiedBy}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-gray-500">No lab results available for this visit</p>
                                  )}
                                </div>
                              )}

                              {/* Radiology Tab */}
                              {visitDetailTab === 'radiology' && (
                                <div className="space-y-4">
                                  <h4 className="font-bold text-lg flex items-center gap-2 text-indigo-800">
                                    🩻 Radiology Results & Orders
                                  </h4>
                                  
                                  {(() => {
                                    const radiologyFromBatch = selectedVisit.batchOrders?.filter(bo => bo.type === 'RADIOLOGY').flatMap(bo => 
                                      (bo.services || []).map(s => ({
                                        id: s.id,
                                        typeId: s.investigationTypeId,
                                        investigationTypeId: s.investigationTypeId,
                                        type: s.investigationType || s.service || { name: 'Radiology' },
                                        status: s.status || bo.status || 'PENDING',
                                        createdAt: s.createdAt || bo.createdAt,
                                        fromBatch: true
                                      }))
                                    ) || [];
                                    const radiologyFromOrders = selectedVisit.radiologyOrders || [];
                                    const allRadiologyOrders = [...radiologyFromBatch, ...radiologyFromOrders];

                                    const radResults = [];
                                    if (selectedVisit.batchOrders) {
                                      selectedVisit.batchOrders
                                        .filter(bo => bo.type === 'RADIOLOGY')
                                        .forEach(bo => {
                                          if (bo.radiologyResults) {
                                            bo.radiologyResults.forEach(r => radResults.push(r));
                                          }
                                        });
                                    }
                                    if (selectedVisit.radiologyResults) {
                                      selectedVisit.radiologyResults.forEach(r => {
                                        if (!radResults.find(existing => existing.id === r.id)) {
                                          radResults.push(r);
                                        }
                                      });
                                    }

                                    const completedRadiology = allRadiologyOrders.filter(rad => 
                                      radResults.some(res => 
                                        res.testType?.id === rad.typeId || res.testType?.id === rad.investigationTypeId
                                      )
                                    );
                                    const pendingRadiology = allRadiologyOrders.filter(rad => 
                                      !radResults.some(res => 
                                        res.testType?.id === rad.typeId || res.testType?.id === rad.investigationTypeId
                                      )
                                    );
                                    
                                    return (
                                      <>
                                        {radResults.length > 0 && (
                                          <div className="space-y-4 mb-6">
                                            <h5 className="font-semibold text-gray-700">Completed Reports</h5>
                                            {radResults.map((result, idx) => {
                                              const images = result.attachments || [];
                                              return (
                                                <div key={idx} className="p-4 border border-indigo-100 rounded-lg shadow-sm bg-indigo-50">
                                                  <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                      <p className="font-semibold text-indigo-900">{result.testType?.name || 'Radiology Test'}</p>
                                                      <p className="text-xs text-indigo-600">{new Date(result.createdAt).toLocaleString()}</p>
                                                    </div>
                                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                      COMPLETED
                                                    </span>
                                                  </div>

                                                  {result.clinicalIndication && (
                                                    <div className="mt-3">
                                                      <p className="text-xs font-semibold text-indigo-600 uppercase mb-1">Clinical Indication</p>
                                                      <div className="text-sm bg-white p-3 rounded-lg border border-indigo-50 text-gray-800 whitespace-pre-wrap">
                                                        {result.clinicalIndication}
                                                      </div>
                                                    </div>
                                                  )}
                                                  {result.technique && (
                                                    <div className="mt-3">
                                                      <p className="text-xs font-semibold text-indigo-600 uppercase mb-1">Technique</p>
                                                      <div className="text-sm bg-white p-3 rounded-lg border border-indigo-50 text-gray-800 whitespace-pre-wrap">
                                                        {result.technique}
                                                      </div>
                                                    </div>
                                                  )}
                                                  {result.comparison && (
                                                    <div className="mt-3">
                                                      <p className="text-xs font-semibold text-indigo-600 uppercase mb-1">Comparison</p>
                                                      <div className="text-sm bg-white p-3 rounded-lg border border-indigo-50 text-gray-800 whitespace-pre-wrap">
                                                        {result.comparison}
                                                      </div>
                                                    </div>
                                                  )}
                                                  {(result.finding || result.resultText || result.findings) && (
                                                    <div className="mt-3">
                                                      <p className="text-sm font-semibold text-indigo-800 mb-1">Findings</p>
                                                      <div className="text-sm bg-white p-3 rounded-lg border border-indigo-50 text-gray-800 whitespace-pre-wrap">
                                                        {result.finding || result.resultText || result.findings}
                                                      </div>
                                                    </div>
                                                  )}
                                                  {result.conclusion && (
                                                    <div className="mt-3">
                                                      <p className="text-sm font-semibold text-indigo-800 mb-1">Conclusion</p>
                                                      <div className="text-sm bg-white p-3 rounded-lg border border-indigo-50 text-gray-800 whitespace-pre-wrap">
                                                        {result.conclusion}
                                                      </div>
                                                    </div>
                                                  )}
                                                  {result.recommendations && (
                                                    <div className="mt-3">
                                                      <p className="text-xs font-semibold text-indigo-600 uppercase mb-1">Recommendations</p>
                                                      <div className="text-sm bg-white p-3 rounded-lg border border-indigo-50 text-gray-800 whitespace-pre-wrap">
                                                        {result.recommendations}
                                                      </div>
                                                    </div>
                                                  )}

                                                  {images.length > 0 && (
                                                    <div className="mt-3">
                                                      <p className="text-xs font-medium text-indigo-600 mb-2">Attached Scans ({images.length}):</p>
                                                      <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                                                        {images.map((att, aIdx) => (
                                                          <div
                                                            key={aIdx}
                                                            onClick={() => openImageViewer(images, aIdx)}
                                                            className="relative group cursor-pointer rounded-lg overflow-hidden border border-indigo-200 hover:border-blue-400 transition-all"
                                                          >
                                                            <img
                                                              src={getImageUrl(att.fileUrl)}
                                                              alt={att.fileName || `Scan ${aIdx + 1}`}
                                                              className="w-full h-24 object-cover"
                                                              onError={(e) => {
                                                                e.target.style.display = 'none';
                                                              }}
                                                            />
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                                              <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 bg-black/50 px-2 py-1 rounded">Click to view</span>
                                                            </div>
                                                          </div>
                                                        ))}
                                                      </div>
                                                    </div>
                                                  )}
                                                  {result.radiologistUser && (
                                                    <div className="mt-2 text-xs text-purple-600">
                                                      Reported by: Dr. {result.radiologistUser.fullname}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}

                                        {/* Pending/Ordered Scans */}
                                        {pendingRadiology.length > 0 && (
                                          <div className="space-y-2">
                                            <h5 className="font-semibold text-gray-700 mt-2">Ordered / Pending Scans</h5>
                                            {pendingRadiology.map((rad, idx) => (
                                              <div key={`order-${idx}`} className="p-3 border border-gray-200 rounded-lg flex justify-between items-center bg-white shadow-sm">
                                                <div>
                                                  <p className="font-medium text-gray-800">{rad.type?.name || rad.investigationType?.name || 'Radiology Test'}</p>
                                                  <p className="text-sm text-gray-500">{new Date(rad.createdAt).toLocaleString()}</p>
                                                </div>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${rad.status === 'COMPLETED' || rad.status === 'PAID' ? 'bg-green-100 text-green-700' : rad.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                  {rad.status === 'PAID' ? 'PAID - In Progress' : rad.status === 'IN_PROGRESS' ? 'IN PROGRESS' : rad.status || 'PENDING'}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        )}

                                        {allRadiologyOrders.length === 0 && radResults.length === 0 && (
                                          <p className="text-gray-500">No radiology orders or results for this visit</p>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              )}

                              {/* Medications Tab */}
                              {visitDetailTab === 'medications' && (
                                <div className="space-y-4">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <h4 className="font-bold text-lg">Medications</h4>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <input
                                        type="date"
                                        value={historyMedicationPrintDate}
                                        onChange={(e) => setHistoryMedicationPrintDate(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const printVisit = selectedVisit;
                                          if (!printVisit) {
                                            toast.error('Select a visit date first');
                                            return;
                                          }
                                          printHistoryMedicationReprint(printVisit, historyMedicationPrintDate);
                                        }}
                                        className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                                      >
                                        <Printer className="h-4 w-4" />
                                        Reprint
                                      </button>
                                    </div>
                                  </div>
                                  {selectedVisit.medicationOrders && selectedVisit.medicationOrders.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                       {selectedVisit.medicationOrders.map((med, idx) => {
                                        const cleanedInstruction = (med.instructionText || med.instructions || '').replace(/^\s*for\s+/i, '').trim();

                                        return (
                                        <div key={idx} className="p-4 border border-indigo-100 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
                                          <div className="flex items-start gap-3">
                                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-sm flex-shrink-0">
                                              <Pill className="h-4 w-4 text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <p className="font-bold text-gray-900 text-base leading-tight">{med.name}</p>
                                              {med.doctor && <p className="text-xs text-indigo-600 mt-0.5">Prescribed by: Dr. {med.doctor.fullname}</p>}
                                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                {med.dosageForm && (
                                                  <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded font-medium">{med.dosageForm}</span>
                                                )}
                                                {med.strength && (
                                                  <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded font-medium">{med.strength}</span>
                                                )}
                                                {med.category && (
                                                  <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{med.category}</span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
                                            {med.quantityNumeric > 0 && (
                                              <div><span className="font-medium text-gray-500">Qty:</span> {med.quantityNumeric} {med.unit || ''}</div>
                                            )}
                                            {med.frequencyType && (
                                              <div><span className="font-medium text-gray-500">Freq:</span> {med.frequencyType.replace(/_/g, ' ')}</div>
                                            )}
                                            {med.durationValue && (
                                              <div><span className="font-medium text-gray-500">Duration:</span> {med.durationValue} {med.durationUnit?.toLowerCase() || ''}</div>
                                            )}
                                            {med.route && (
                                              <div><span className="font-medium text-gray-500">Route:</span> {med.route}</div>
                                            )}
                                          </div>
                                          {cleanedInstruction && (
                                            <div className="mt-2 text-xs text-indigo-700 bg-indigo-50/80 p-2 rounded-lg border border-indigo-100">
                                              <span className="font-semibold">Instructions:</span> {cleanedInstruction}
                                            </div>
                                          )}
                                        </div>
                                      );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-gray-500">No regular medications for this visit</p>
                                  )}


                                </div>
                              )}

                              {/* Compound Prescriptions Tab */}
                              {visitDetailTab === 'compoundRx' && (
                                <div className="space-y-4">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <h4 className="font-bold text-lg flex items-center gap-2">
                                      🧪 Compound Prescriptions
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <input
                                        type="date"
                                        value={historyCompoundPrintDate}
                                        onChange={(e) => setHistoryCompoundPrintDate(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const printVisit = selectedVisit;
                                          if (!printVisit) {
                                            toast.error('Select a visit date first');
                                            return;
                                          }
                                          printHistoryCompoundReprint(printVisit, historyCompoundPrintDate);
                                        }}
                                        className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                                      >
                                        <Printer className="h-4 w-4" />
                                        Reprint
                                      </button>
                                    </div>
                                  </div>
                                  {selectedVisit.compoundPrescriptions && selectedVisit.compoundPrescriptions.length > 0 ? (
                                    <div className="space-y-4">
                                      {selectedVisit.compoundPrescriptions.map((cp, idx) => {
                                        const txt = cp.prescriptionText || cp.rawText || '';
                                        return (
                                        <div key={idx} className="p-5 border border-amber-200 rounded-xl bg-gradient-to-br from-amber-50 to-white shadow-sm">
                                          <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
                                                <span className="text-white text-xs font-bold">Rx</span>
                                              </div>
                                              <div>
                                                <p className="font-bold text-amber-900 text-base">{cp.formulationType || 'Compound'} {cp.quantity ? `${cp.quantity}${cp.quantityUnit || ''}` : ''}</p>
                                                <p className="text-xs font-mono text-amber-600">{cp.referenceNumber}</p>
                                              </div>
                                            </div>
                                            <span className="px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full text-xs font-semibold">
                                              {cp.status || 'PRESCRIBED'}
                                            </span>
                                          </div>

                                          {txt && (
                                            <div className="mb-3 p-3 bg-white rounded-lg border border-amber-200 shadow-inner">
                                              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">Prescription</p>
                                              <p className="text-sm font-medium text-gray-900 leading-relaxed whitespace-pre-wrap">{txt}</p>
                                            </div>
                                          )}

                                          {cp.ingredients?.length > 0 && (
                                            <div className="mb-3">
                                              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1.5">Active Ingredients</p>
                                              <div className="flex flex-wrap gap-1.5">
                                                {cp.ingredients.map((ing, i) => (
                                                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-md border border-amber-200 text-xs text-amber-900">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                                    {ing.ingredientName} <span className="font-mono font-semibold text-amber-700">{ing.strength}{ing.unit}</span>
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          )}

                                          {(cp.frequencyType || cp.durationValue) && (
                                            <div className="flex flex-wrap gap-2">
                                              {cp.frequencyType && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 rounded-full text-xs text-amber-800">
                                                  Sig: {cp.frequencyType.replace(/_/g, ' ')}
                                                </span>
                                              )}
                                              {cp.durationValue && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 rounded-full text-xs text-amber-800">
                                                  Duration: {cp.durationValue} {cp.durationUnit?.toLowerCase()}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-gray-500">No compound prescriptions for this visit</p>
                                  )}
                                </div>
                              )}

                              {/* Procedures Tab */}
                              {visitDetailTab === 'procedures' && (
                                <div className="space-y-4">
                                  <h4 className="font-bold text-lg">Procedures</h4>
                                  {selectedVisit.procedures && selectedVisit.procedures.length > 0 ? (
                                    <div className="space-y-2">
                                      {selectedVisit.procedures.map((proc, idx) => (
                                        <div key={idx} className="p-3 border rounded-lg">
                                          <p className="font-medium">{proc.name || 'Procedure'}</p>
                                          <div className="flex items-center gap-2 mt-1">
                                            <span className={`px-2 py-0.5 rounded-full text-xs ${proc.status === 'COMPLETED' ? 'bg-green-100 text-indigo-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                              {proc.status || 'PENDING'}
                                            </span>
                                            <p className="text-sm text-gray-500">{new Date(proc.createdAt).toLocaleString()}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-gray-500">No procedures for this visit</p>
                                  )}
                                </div>
                              )}

                              {/* Images Tab */}
                              {visitDetailTab === 'images' && (
                                <div className="space-y-4">
                                  <h4 className="font-bold text-lg">Attached Images</h4>
                                  {selectedVisit.files && selectedVisit.files.length > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      {selectedVisit.files.map((file, idx) => (
                                        <div key={idx} className="p-2 border rounded-lg">
                                          <img src={file.fileUrl} alt="Patient file" className="w-full h-24 object-cover rounded" />
                                          <p className="text-xs mt-1 truncate">{file.fileName}</p>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-gray-500">No images attached for this visit</p>
                                  )}
                                </div>
                              )}

                              {/* Other Services Tab (Dental, Emergency, Nurse) */}
                              {visitDetailTab === 'other' && (
                                <div className="space-y-6">
                                  {/* Dental Procedures */}
                                  {selectedVisit.dentalProcedureCompletions && selectedVisit.dentalProcedureCompletions.length > 0 && (
                                    <div>
                                      <h4 className="font-bold text-lg mb-3 flex items-center gap-2 text-blue-900 border-b pb-2">
                                        🦷 Dental Procedures
                                      </h4>
                                      <div className="space-y-3">
                                        {selectedVisit.dentalProcedureCompletions.map((proc) => (
                                          <div key={proc.id} className="p-4 border border-blue-100 rounded-lg shadow-sm bg-blue-50">
                                            <p className="font-semibold" style={{ color: '#1E3A8A' }}>{proc.batchOrderService?.service?.name || 'Procedure'}</p>
                                            <div className="flex space-x-4 mt-2">
                                              <p className="text-sm text-gray-700">Tooth: <span className="font-medium">{proc.toothNumber}</span></p>
                                              {proc.surfaces && proc.surfaces.length > 0 && (
                                                <p className="text-sm text-gray-700">Surfaces: <span className="font-medium">{proc.surfaces.join(', ')}</span></p>
                                              )}
                                            </div>
                                            {proc.notes && <p className="text-sm text-gray-600 mt-2 italic border-l-2 border-blue-200 pl-2">{proc.notes}</p>}
                                            <p className="text-xs text-blue-500 mt-2">Completed by {proc.doctor?.fullname || 'Unknown'}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Dental Chart History */}
                                  {selectedVisit.dentalRecords && selectedVisit.dentalRecords.length > 0 && (
                                    <div>
                                      <h4 className="font-bold text-lg mb-3 flex items-center gap-2 text-blue-900 border-b pb-2">
                                        📋 Stored Dental Chart
                                      </h4>
                                      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white p-2">
                                        <DentalChartDisplay
                                          patientId={patientHistory.patient.id}
                                          visitId={selectedVisit.id}
                                          showHistory={false}
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {/* Emergency Materials/Drugs */}
                                  {selectedVisit.emergencyDrugOrders && selectedVisit.emergencyDrugOrders.length > 0 && (
                                    <div>
                                      <h4 className="font-bold text-lg mb-3 flex items-center gap-2 text-red-900 border-b pb-2">
                                        🚑 Emergency Materials
                                      </h4>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {selectedVisit.emergencyDrugOrders.map((drug) => (
                                          <div key={drug.id} className="p-3 border rounded-lg shadow-sm" style={{ borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }}>
                                            <p className="font-medium text-red-900">{drug.service?.name || 'Emergency Item'}</p>
                                            <p className="text-sm text-red-700 mt-1">Quantity Used: <span className="font-semibold">{drug.quantity}</span></p>
                                            {drug.doctor && <p className="text-xs text-red-600 mt-1">Ordered by: Dr. {drug.doctor.fullname || drug.doctor}</p>}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Nurse Services */}
                                  {selectedVisit.nurseServiceAssignments && selectedVisit.nurseServiceAssignments.length > 0 && (
                                    <div>
                                      <h4 className="font-bold text-lg mb-3 flex items-center gap-2 text-green-900 border-b pb-2">
                                        👩‍⚕️ Nurse Services
                                      </h4>
                                      <div className="space-y-3">
                                        {selectedVisit.nurseServiceAssignments.map((nurseServ) => (
                                          <div key={nurseServ.id} className="p-4 border rounded-lg shadow-sm bg-green-50 border-indigo-200">
                                            <p className="font-semibold text-green-900">{nurseServ.service?.name || 'Nurse Service'}</p>
                                            <p className="text-sm text-green-700 mt-1">Status: <span className="font-medium">{nurseServ.status}</span></p>
                                            {nurseServ.notes && <p className="text-sm text-indigo-800 mt-2 italic">{nurseServ.notes}</p>}
                                            {nurseServ.assignedNurse && <p className="text-xs text-indigo-600 mt-2">Handled by: {nurseServ.assignedNurse.fullname}</p>}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {(!selectedVisit.dentalProcedureCompletions || selectedVisit.dentalProcedureCompletions.length === 0) &&
                                    (!selectedVisit.dentalRecords || selectedVisit.dentalRecords.length === 0) &&
                                    (!selectedVisit.emergencyDrugOrders || selectedVisit.emergencyDrugOrders.length === 0) &&
                                    (!selectedVisit.nurseServiceAssignments || selectedVisit.nurseServiceAssignments.length === 0) && (
                                      <div className="text-center py-6 bg-gray-50 rounded-lg">
                                        <p className="text-sm text-gray-500">No other services recorded for this visit.</p>
                                      </div>
                                    )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <User className="h-12 w-12 mx-auto mb-4" style={{ color: '#9CA3AF' }} />
                      <p style={{ color: '#6B7280' }}>No past history found for this patient</p>
                      <p className="text-sm mt-2" style={{ color: '#9CA3AF' }}>This appears to be the patient's first visit</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <User className="h-12 w-12 mx-auto mb-4" style={{ color: '#9CA3AF' }} />
                  <p style={{ color: '#6B7280' }}>No patient history available</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'images' && (
            <div>
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#0C0E0B' }}>Patient Attached Images</h3>
              {((visit?.attachedImages && visit.attachedImages.length > 0) || (visit?.galleryImages && visit.galleryImages.length > 0)) ? (
                <div className="space-y-8">
                  {/* --- BEFORE & AFTER IMAGES --- */}
                  {visit?.galleryImages?.filter(img => img.imageType === 'BEFORE' || img.imageType === 'AFTER').length > 0 && (
                    <div>
                      <h4 className="text-md font-semibold mb-3 text-gray-700">Before & After Images (Patient Gallery)</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {visit.galleryImages.filter(img => img.imageType === 'BEFORE' || img.imageType === 'AFTER').map((image) => {
                          const originalIndex = (visit.attachedImages?.length || 0) + visit.galleryImages.findIndex(g => g.id === image.id);
                          return (
                            <div key={image.id} className="relative group">
                              <div className="w-full h-48 bg-gray-200 rounded-lg border-2 border-gray-200 overflow-hidden">
                                <img
                                  src={getImageUrl(image.filePath)}
                                  alt={image.description || 'Gallery image'}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    console.error('Gallery image load error:', image.filePath);
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                                <div className="hidden w-full h-full flex items-center justify-center">
                                  <div className="text-center text-gray-500">
                                    <Image className="h-8 w-8 mx-auto mb-2" />
                                    <p className="text-xs">Image not available</p>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-2 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mb-1 ${image.imageType === 'BEFORE' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-indigo-800'}`}>
                                  {image.imageType} IMAGE
                                </span>
                                <p className="text-sm font-medium text-gray-800 truncate">
                                  {image.imageType} View
                                </p>
                                {image.description && (
                                  <p className="text-xs text-gray-600 truncate" title={image.description}>
                                    {image.description}
                                  </p>
                                )}
                                <p className="text-xs text-gray-400">
                                  Uploaded {new Date(image.createdAt).toLocaleDateString()}
                                </p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const allImgArr = [
                                      ...(visit.attachedImages || []),
                                      ...(visit.galleryImages || []).map(g => ({ ...g, fileName: `${g.imageType} View` }))
                                    ].map(img => ({
                                      filePath: getImageUrl(img.filePath),
                                      fileName: img.fileName,
                                      description: img.description
                                    }));
                                    openImageViewer(allImgArr, originalIndex);
                                  }}
                                  className="mt-2 w-full px-3 py-1.5 bg-pink-500 text-white text-xs rounded hover:bg-pink-600 transition-colors flex items-center justify-center"
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  View Gallery
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* --- OTHER IMAGES --- */}
                  {((visit?.attachedImages && visit.attachedImages.length > 0) || visit?.galleryImages?.filter(img => img.imageType === 'OTHER').length > 0) && (
                    <div>
                      <h4 className="text-md font-semibold mb-3 text-gray-700">Other Attached Images</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {/* 1. Normal Attached Images */}
                        {visit?.attachedImages?.map((image, index) => (
                          <div key={image.id} className="relative group">
                            <div className="w-full h-48 bg-gray-200 rounded-lg border-2 border-gray-200 overflow-hidden">
                              <img
                                src={getImageUrl(image.filePath)}
                                alt={image.description || 'Medical image'}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  console.error('Image load error:', image.filePath);
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                              <div className="hidden w-full h-full flex items-center justify-center">
                                <div className="text-center text-gray-500">
                                  <Image className="h-8 w-8 mx-auto mb-2" />
                                  <p className="text-xs">Image not available</p>
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 text-center">
                              <p className="text-sm font-medium text-gray-800 truncate" title={image.fileName}>
                                {image.fileName}
                              </p>
                              {image.description && (
                                <p className="text-xs text-gray-600 truncate" title={image.description}>
                                  {image.description}
                                </p>
                              )}
                              <p className="text-xs text-gray-400">
                                {new Date(image.uploadedAt).toLocaleDateString()}
                              </p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const allImgArr = [
                                    ...(visit.attachedImages || []),
                                    ...(visit.galleryImages || []).map(g => ({ ...g, fileName: `${g.imageType} View` }))
                                  ].map(img => ({
                                    filePath: getImageUrl(img.filePath),
                                    fileName: img.fileName,
                                    description: img.description
                                  }));
                                  openImageViewer(allImgArr, index);
                                }}
                                className="mt-2 w-full px-3 py-1.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors flex items-center justify-center"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View Image
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* 2. OTHER category from Gallery */}
                        {visit?.galleryImages?.filter(img => img.imageType === 'OTHER').map((image) => {
                          const originalIndex = (visit.attachedImages?.length || 0) + visit.galleryImages.findIndex(g => g.id === image.id);
                          return (
                            <div key={image.id} className="relative group">
                              <div className="w-full h-48 bg-gray-200 rounded-lg border-2 border-gray-200 overflow-hidden">
                                <img
                                  src={getImageUrl(image.filePath)}
                                  alt={image.description || 'Gallery image'}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    console.error('Gallery image load error:', image.filePath);
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                  }}
                                />
                                <div className="hidden w-full h-full flex items-center justify-center">
                                  <div className="text-center text-gray-500">
                                    <Image className="h-8 w-8 mx-auto mb-2" />
                                    <p className="text-xs">Image not available</p>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-2 text-center">
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mb-1 bg-blue-100 text-blue-800">
                                  OTHER IMAGE
                                </span>
                                <p className="text-sm font-medium text-gray-800 truncate">
                                  Other View
                                </p>
                                {image.description && (
                                  <p className="text-xs text-gray-600 truncate" title={image.description}>
                                    {image.description}
                                  </p>
                                )}
                                <p className="text-xs text-gray-400">
                                  Uploaded {new Date(image.createdAt).toLocaleDateString()}
                                </p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const allImgArr = [
                                      ...(visit.attachedImages || []),
                                      ...(visit.galleryImages || []).map(g => ({ ...g, fileName: `${g.imageType} View` }))
                                    ].map(img => ({
                                      filePath: getImageUrl(img.filePath),
                                      fileName: img.fileName,
                                      description: img.description
                                    }));
                                    openImageViewer(allImgArr, originalIndex);
                                  }}
                                  className="mt-2 w-full px-3 py-1.5 bg-pink-500 text-white text-xs rounded hover:bg-pink-600 transition-colors flex items-center justify-center"
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  View Gallery
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Image className="h-12 w-12 mx-auto mb-4" style={{ color: '#9CA3AF' }} />
                  <p style={{ color: '#6B7280' }}>No images attached to this visit</p>
                  <p className="text-sm" style={{ color: '#9CA3AF' }}>Images uploaded by billing staff will appear here</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'procedures' && (
            <div>
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#0C0E0B' }}>Medical Procedures</h3>
              <ProcedureOrdering
                visit={visit}
                onOrdersPlaced={handleOrdersPlaced}
              />
            </div>
          )}

          {activeTab === 'dental' && (
            <div>
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#0C0E0B' }}>Dental Chart</h3>

              {canAccessDentalFeatures ? (
                <div>
                  {dentalRecord ? (
                    <div className="mb-4 p-4 border rounded-lg" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium" style={{ color: '#0C0E0B' }}>Existing Dental Record</p>
                          <p className="text-sm" style={{ color: '#6B7280' }}>
                            Created: {new Date(dentalRecord.createdAt).toLocaleDateString()}
                          </p>
                          {dentalRecord.doctor && (
                            <p className="text-sm" style={{ color: '#6B7280' }}>
                              By: Dr. {dentalRecord.doctor.fullname}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => setDentalRecord(null)}
                          className="px-3 py-1 text-sm rounded"
                          style={{ backgroundColor: '#EA2E00', color: '#FFFFFF' }}
                        >
                          Edit Chart
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4 p-4 border-2 border-dashed rounded-lg" style={{ borderColor: '#D1D5DB' }}>
                      <div className="text-center">
                        <Smile className="h-8 w-8 mx-auto mb-2" style={{ color: '#9CA3AF' }} />
                        <p style={{ color: '#6B7280' }}>No dental chart created yet</p>
                        <p className="text-sm" style={{ color: '#9CA3AF' }}>Create a new dental chart for this visit</p>
                      </div>
                    </div>
                  )}

                  <DentalChart
                    ref={dentalChartRef}
                    patientId={visit?.patientId}
                    visitId={visitId}
                    patientAge={visit?.patient?.age}
                    onSave={handleDentalChartSave}
                    initialData={dentalRecord}
                  />
                </div>
              ) : (
                <div className="text-center py-8">
                  <Smile className="h-12 w-12 mx-auto mb-4" style={{ color: '#9CA3AF' }} />
                  <p style={{ color: '#6B7280' }}>Dental chart is not enabled for your workspace profile</p>
                  <p className="text-sm" style={{ color: '#9CA3AF' }}>
                    An administrator can allow this tab from System Settings when needed
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'dental-services' && (
            <div>
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#0C0E0B' }}>Dental Services</h3>

              {/* Show ordered dental services with completion status */}
              {(() => {
                const dentalOrders = visit?.batchOrders?.filter(order => order.type === 'DENTAL') || [];
                const hasDentalOrders = dentalOrders.length > 0;

                return hasDentalOrders ? (
                  <div className="mb-6">
                    <h4 className="font-medium mb-3" style={{ color: '#0C0E0B' }}>Ordered Dental Procedures</h4>
                    <div className="space-y-4">
                      {dentalOrders.map((order) => (
                        <div key={order.id} className={`p-4 border rounded-lg ${order.isDeferred ? 'border-green-300 bg-green-50' : ''}`} style={!order.isDeferred ? { borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' } : {}}>
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="font-medium" style={{ color: '#0C0E0B' }}>
                                Order #{order.id}
                              </p>
                              <p className="text-sm" style={{ color: '#6B7280' }}>
                                Status: <span className="font-medium">{order.isDeferred ? 'Connected (Pre-Paid)' : order.status}</span>
                              </p>
                              <p className="text-sm" style={{ color: '#6B7280' }}>
                                Created: {new Date(order.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${order.isDeferred ? 'bg-indigo-200 text-indigo-800' :
                              order.status === 'PAID' ? 'bg-green-100 text-indigo-800' :
                                order.status === 'UNPAID' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                              }`}>
                              {order.isDeferred ? '🔗 CONNECTED - PRE-PAID' : order.status}
                            </span>
                          </div>

                          {/* Info banner for deferred orders */}
                          {order.isDeferred && (
                            <div className="mb-3 p-2 bg-green-100 border border-green-300 rounded-lg text-xs text-indigo-800">
                              <strong>🔗 Follow-up Service:</strong> This order is connected to a previous payment/credit agreement.
                              No additional payment is required — billing was automatically marked as paid.
                            </div>
                          )}

                          <div className="mt-3">
                            <p className="text-sm font-medium mb-2" style={{ color: '#0C0E0B' }}>Procedures:</p>
                            <div className="space-y-2">
                              {order.services?.map((service, index) => {
                                // Check if this procedure is completed
                                const isCompleted = service.dentalProcedureCompletion !== null;

                                return (
                                  <div key={index} className={`p-3 rounded-lg border ${isCompleted ? 'bg-green-50 border-indigo-200' : 'bg-white border-gray-200'
                                    }`}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium" style={{ color: '#0C0E0B' }}>
                                            {service.service.name}
                                          </span>
                                          {isCompleted && (
                                            <CheckCircle className="h-5 w-5" style={{ color: '#059669' }} />
                                          )}
                                          {order.isDeferred && !isCompleted && (
                                            <span className="text-[10px] font-bold bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded">
                                              ✓ PRE-PAID
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
                                          {service.service.code} • {service.service.price.toFixed(2)} ETB
                                        </p>
                                        {service.instructions && (
                                          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
                                            Instructions: {service.instructions}
                                          </p>
                                        )}
                                        {isCompleted && service.dentalProcedureCompletion && (
                                          <div className="mt-2 p-2 rounded bg-green-100">
                                            <p className="text-xs font-medium" style={{ color: '#059669' }}>
                                              Completed: {new Date(service.dentalProcedureCompletion.completedAt).toLocaleString()}
                                            </p>
                                            {service.dentalProcedureCompletion.notes && (
                                              <p className="text-xs mt-1" style={{ color: '#047857' }}>
                                                Notes: {service.dentalProcedureCompletion.notes}
                                              </p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      {(order.status === 'PAID' || order.isDeferred) && !isCompleted && (
                                        <button
                                          onClick={async () => {
                                            try {
                                              await api.post('/dental/procedures/complete', {
                                                batchOrderServiceId: service.id,
                                                notes: ''
                                              });
                                              toast.success('Procedure marked as completed');
                                              await fetchVisitData();
                                            } catch (error) {
                                              console.error('Error completing procedure:', error);
                                              toast.error(error.response?.data?.error || 'Failed to complete procedure');
                                            }
                                          }}
                                          className="px-3 py-1.5 rounded-lg text-sm font-medium"
                                          style={{ backgroundColor: '#2e13d1', color: '#FFFFFF' }}
                                        >
                                          Mark Complete
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {order.instructions && (
                            <div className="mt-3">
                              <p className="text-sm font-medium mb-1" style={{ color: '#0C0E0B' }}>Order Instructions:</p>
                              <p className="text-sm" style={{ color: '#6B7280' }}>{order.instructions}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Order New Dental Services */}
              <div className={visit?.batchOrders?.some(o => o.type === 'DENTAL') ? 'border-t pt-6' : ''} style={{ borderColor: '#E5E7EB' }}>
                <DentalServiceOrdering
                  visitId={visitId}
                  patientId={visit?.patient?.id}
                  onOrdersPlaced={handleOrdersPlaced}
                  existingOrders={visit?.batchOrders?.filter(o => o.type === 'DENTAL') || []}
                />
              </div>
            </div>
          )}

          {activeTab === 'lab' && (
            <div>
              {/* Lab Sub-tabs */}
              <div className="flex justify-center items-center gap-4 mb-6">
                <button
                  onClick={() => setLabSubTab('results')}
                  className={`flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-bold transition-all shadow-sm ${
                    labSubTab === 'results'
                      ? 'bg-blue-600 text-white border-2 border-blue-600 shadow-lg shadow-blue-200 scale-105'
                      : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  <TestTube className={`h-5 w-5 ${labSubTab === 'results' ? 'text-white' : 'text-blue-500'}`} />
                  Results & Orders
                </button>
                <button
                  onClick={() => setLabSubTab('order')}
                  className={`flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-bold transition-all shadow-sm ${
                    labSubTab === 'order'
                      ? 'bg-blue-600 text-white border-2 border-blue-600 shadow-lg shadow-blue-200 scale-105'
                      : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  <Printer className={`h-5 w-5 ${labSubTab === 'order' ? 'text-white' : 'text-blue-500'}`} />
                  Order Tests
                </button>
              </div>

              {labSubTab === null && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                </div>
              )}

              {labSubTab === 'results' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl px-5 py-4">
                    <div className="bg-blue-100 p-2.5 rounded-lg">
                      <TestTube className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold" style={{ color: '#1E40AF' }}>Lab Results &amp; Orders</h3>
                      <p className="text-sm text-gray-500 mt-0.5">View completed results and pending lab orders for this visit</p>
                    </div>
                  </div>

                  {/* Lab Results Section - Show results when available */}
                  {(() => {
                    // Check old system (batchOrders)
                    const labBatchOrders = visit?.batchOrders?.filter(order => order.type === 'LAB') || [];
                    const hasOldLabOrders = labBatchOrders.length > 0;
                    const hasOldLabResults = labBatchOrders.some(order =>
                      (order.labResults && order.labResults.length > 0) ||
                      getBatchDetailedLabResults(order).length > 0
                    );

                    // Check new system (labTestOrders)
                    const labTestOrders = visit?.labTestOrders || [];
                    const hasNewLabOrders = labTestOrders.length > 0;
                    const hasNewLabResults = labTestOrders.some(order =>
                      order.results && order.results.length > 0
                    );

                    const hasLabOrders = hasOldLabOrders || hasNewLabOrders;
                    const hasLabResults = hasOldLabResults || hasNewLabResults;

                    return hasLabResults ? (
                      <div className="mb-6">
                        <h4 className="font-medium mb-3 text-indigo-600" style={{ color: '#059669' }}>
                          📊 Lab Results Available
                        </h4>
                        <div className="space-y-4">
                          {labBatchOrders.map((batchOrder) => {
                            const batchDetailedResults = getBatchDetailedLabResults(batchOrder);

                            return ((batchOrder.labResults && batchOrder.labResults.length > 0) ||
                            batchDetailedResults.length > 0) && (
                              <div key={batchOrder.id} className="p-4 border rounded-lg border-indigo-200 bg-indigo-50">
                                <div className="flex justify-between items-start mb-3">
                                  <div>
                                    <p className="font-medium text-indigo-800">
                                      Order #{batchOrder.id} - Lab Results
                                    </p>
                                    <p className="text-sm text-indigo-600">
                                      Completed: {new Date(batchOrder.updatedAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => printLabOrders(batchOrder)}
                                      className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-indigo-800 bg-green-100 hover:bg-indigo-200 rounded transition-colors"
                                      title="Print Lab Order"
                                    >
                                      <Printer className="h-4 w-4" />
                                      Print
                                    </button>
                                    <span className="px-2 py-1 text-xs font-medium text-indigo-800 bg-indigo-200 rounded-full">
                                      COMPLETED
                                    </span>
                                  </div>
                                </div>

                                {/* Show detailed lab results */}
                                {batchDetailedResults.length > 0 && (
                                  <div className="space-y-4 mb-4">
                                    {batchDetailedResults.map((detailedResult, index) => {
                                      const detailedEntries = buildDetailedLabResultEntries(detailedResult);

                                      return (
                                      <div key={detailedResult.id || index} className="p-4 bg-white rounded border">
                                        <div className="flex justify-between items-start mb-3">
                                          <h5 className="font-medium text-gray-800">
                                            {detailedResult.template?.name || `Lab Test ${index + 1}`}
                                          </h5>
                                          <div className="text-right">
                                            <span className="text-xs text-gray-500">
                                              {new Date(detailedResult.createdAt).toLocaleDateString()}
                                            </span>
                                            <div className="mt-1">
                                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${detailedResult.status === 'COMPLETED'
                                                ? 'bg-green-100 text-indigo-800'
                                                : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {detailedResult.status}
                                              </span>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Display lab values in a professional format */}
                                        {detailedEntries.length > 0 && (
                                          <div className="mb-3">
                                            <h6 className="text-sm font-medium text-gray-700 mb-2">Test Results:</h6>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                              {detailedEntries.map((entry) => (
                                                <div key={entry.key} className="p-2 bg-gray-50 rounded text-sm">
                                                  <div className="font-medium text-gray-800">{entry.label}</div>
                                                  <div className="text-gray-600">{entry.value}{entry.unit ? ` ${entry.unit}` : ''}</div>
                                                  {entry.referenceRange && (
                                                    <div className="text-xs text-gray-500 mt-1">Ref: {entry.referenceRange}</div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {detailedResult.additionalNotes && (
                                          <div className="mb-2">
                                            <p className="text-sm font-medium text-gray-700 mb-1">Additional Notes:</p>
                                            <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                              {detailedResult.additionalNotes}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    );})}
                                  </div>
                                )}

                                {/* Show regular lab results if any */}
                                {batchOrder.labResults && batchOrder.labResults.length > 0 && (
                                  <div className="space-y-3">
                                    {batchOrder.labResults.map((result, index) => {
                                      const structuredEntries = buildLegacyLabResultEntries(result);

                                      return (
                                      <div key={result.id || index} className="p-3 bg-white rounded border">
                                        <div className="flex justify-between items-start mb-2">
                                          <h5 className="font-medium text-gray-800">
                                            {result.testType?.name || `Test ${index + 1}`}
                                          </h5>
                                          <span className="text-xs text-gray-500">
                                            {new Date(result.createdAt).toLocaleDateString()}
                                          </span>
                                        </div>

                                        {structuredEntries.length > 0 ? (
                                          <div className="mb-3">
                                            <p className="text-sm font-medium text-gray-700 mb-2">Result Details:</p>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                              {structuredEntries.map((entry) => (
                                                <div key={entry.key} className="p-2 bg-gray-50 rounded text-sm">
                                                  <div className="font-medium text-gray-800">{entry.label}</div>
                                                  <div className="text-gray-600">{entry.value}{entry.unit ? ` ${entry.unit}` : ''}</div>
                                                  {entry.referenceRange && (
                                                    <div className="text-xs text-gray-500 mt-1">Ref: {entry.referenceRange}</div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ) : result.resultText && (
                                          <div className="mb-2">
                                            <p className="text-sm font-medium text-gray-700 mb-1">Result:</p>
                                            <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                              {result.resultText}
                                            </p>
                                          </div>
                                        )}

                                        {result.additionalNotes && (
                                          <div className="mb-2">
                                            <p className="text-sm font-medium text-gray-700 mb-1">Notes:</p>
                                            <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                              {result.additionalNotes}
                                            </p>
                                          </div>
                                        )}

                                        {result.attachments && result.attachments.length > 0 && (
                                          <div>
                                            <p className="text-sm font-medium text-gray-700 mb-2">Attachments:</p>
                                            <div className="grid grid-cols-2 gap-2">
                                              {result.attachments.map((attachment, attIndex) => (
                                                <div key={attIndex} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                                                  <FileText className="h-4 w-4 text-blue-500" />
                                                  <span className="text-xs text-gray-600 truncate">
                                                    {attachment.fileName || `File ${attIndex + 1}`}
                                                  </span>
                                                  <button
                                                    onClick={() => window.open(getImageUrl(attachment.fileUrl), '_blank')}
                                                    className="text-blue-500 hover:text-blue-700 text-xs"
                                                  >
                                                    View
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );})}
                                  </div>
                                )}
                              </div>
                            );})}
                        </div>

                        {/* New Lab Test Orders (New System) */}
                        {hasNewLabResults && (
                          <div className="mt-6 space-y-4">
                            {(() => {
                              const completedOrders = labTestOrders.filter(order => order.results && order.results.length > 0);
                              const panelGroups = {};
                              const standaloneOrders = [];
                              completedOrders.forEach(order => {
                                const g = order.labTest?.group;
                                if (g && g.id) {
                                  if (!panelGroups[g.id]) panelGroups[g.id] = { group: g, orders: [], allResults: [], latestDate: null, additionalNotes: '' };
                                  panelGroups[g.id].orders.push(order);
                                  const r = order.results[0];
                                  if (r) {
                                    panelGroups[g.id].allResults.push({ order, result: r });
                                    const d = new Date(r.createdAt);
                                    if (!panelGroups[g.id].latestDate || d > panelGroups[g.id].latestDate) panelGroups[g.id].latestDate = d;
                                    if (r.additionalNotes) panelGroups[g.id].additionalNotes = r.additionalNotes;
                                  }
                                } else {
                                  standaloneOrders.push(order);
                                }
                              });
                              const panelEntries = Object.values(panelGroups);
                              return (<>
                                {panelEntries.map(pg => {
                                  const seenFields = new Set();
                                  const combinedFields = [];
                                  const panelImages = [];
                                  const seenUrls = new Set();
                                  pg.allResults.forEach(({ order, result }) => {
                                    (order.labTest?.resultFields || []).forEach(field => {
                                      const key = field.fieldName || field.id;
                                      if (!seenFields.has(key)) {
                                        seenFields.add(key);
                                        const fv = getStructuredFieldValue(result.results, field);
                                        combinedFields.push({ field, value: fv, result });
                                      }
                                    });
                                    if (result.results?._images) {
                                      result.results._images.forEach(img => {
                                        const u = img.data || img.url || img;
                                        if (!seenUrls.has(u)) { seenUrls.add(u); panelImages.push(img); }
                                      });
                                    }
                                  });
                                  return (
                                    <div key={'panel-'+pg.group.id} className="p-4 border rounded-lg border-indigo-200 bg-indigo-50">
                                      <div className="flex justify-between items-start mb-3">
                                        <div>
                                          <p className="font-medium text-indigo-800">{pg.group.name} Panel</p>
                                          <p className="text-sm text-indigo-600">{pg.orders.length} tests{pg.latestDate ? ' • '+new Date(pg.latestDate).toLocaleDateString() : ''}</p>
                                        </div>
                                        <span className="px-2 py-1 text-xs font-medium text-indigo-800 bg-indigo-200 rounded-full">COMPLETED</span>
                                      </div>
                                      {combinedFields.length > 0 && (
                                        <div className="mb-3">
                                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {combinedFields.map(({ field, value }) => {
                                              if (value === undefined) return null;
                                              const rc = checkValueInNormalRange(value, field.normalRange);
                                              return (
                                                <div key={field.id} className={'p-2 rounded text-sm ' + (!rc.inRange ? 'bg-red-50 border border-red-200' : 'bg-white')}>
                                                  <div className="font-medium text-gray-800">{field.label}</div>
                                                  <div className={!rc.inRange ? 'text-red-600 font-semibold' : 'text-gray-600'}>{value} {field.unit || ''}</div>
                                                  {!rc.inRange && rc.message && <div className="text-xs text-red-500 mt-1">{rc.message}</div>}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                      {pg.additionalNotes && (
                                        <div className="mt-3">
                                          <p className="text-sm font-medium text-gray-700 mb-1">Additional Notes:</p>
                                          <p className="text-sm text-gray-600 bg-white p-2 rounded">{pg.additionalNotes}</p>
                                        </div>
                                      )}
                                      {panelImages.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-indigo-200">
                                          <p className="text-sm font-medium text-gray-700 mb-2">Attached Images:</p>
                                          <div className="grid grid-cols-3 gap-2">
                                            {panelImages.map((img, idx) => {
                                              const u = img.data || img.url || img;
                                              return (<div key={idx} className="relative"><img src={u} alt={"Lab "+(idx+1)} className="w-full h-20 object-cover rounded border cursor-pointer" onClick={() => window.open(u,"_blank")} /></div>);
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {standaloneOrders.map(order => {
                                  const latestResult = order.results[0];
                                  return (
                                    <div key={order.id} className="p-4 border rounded-lg border-indigo-200 bg-indigo-50">
                                      <div className="flex justify-between items-start mb-3">
                                        <div>
                                          <p className="font-medium text-indigo-800">{order.labTest.name}</p>
                                          <p className="text-sm text-indigo-600">Completed: {new Date(latestResult.createdAt).toLocaleDateString()}</p>
                                        </div>
                                        <span className="px-2 py-1 text-xs font-medium text-indigo-800 bg-indigo-200 rounded-full">COMPLETED</span>
                                      </div>
                                      {order.labTest.resultFields && order.labTest.resultFields.length > 0 && latestResult.results && (
                                        <div className="mb-3">
                                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {order.labTest.resultFields.map(field => {
                                              const fv = getStructuredFieldValue(latestResult.results, field);
                                              if (fv === undefined) return null;
                                              const rc = checkValueInNormalRange(fv, field.normalRange);
                                              return (
                                                <div key={field.id} className={'p-2 rounded text-sm ' + (!rc.inRange ? 'bg-red-50 border border-red-200' : 'bg-white')}>
                                                  <div className="font-medium text-gray-800">{field.label}</div>
                                                  <div className={!rc.inRange ? 'text-red-600 font-semibold' : 'text-gray-600'}>{fv} {field.unit || ''}</div>
                                                  {!rc.inRange && rc.message && <div className="text-xs text-red-500 mt-1">{rc.message}</div>}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                      {latestResult.additionalNotes && (
                                        <div className="mt-3">
                                          <p className="text-sm font-medium text-gray-700 mb-1">Additional Notes:</p>
                                          <p className="text-sm text-gray-600 bg-white p-2 rounded">{latestResult.additionalNotes}</p>
                                        </div>
                                      )}
                                      {(latestResult.results && latestResult.results._images && latestResult.results._images.length > 0) && (
                                        <div className="mt-3 pt-3 border-t border-indigo-200">
                                          <p className="text-sm font-medium text-gray-700 mb-2">Attached Images:</p>
                                          <div className="grid grid-cols-3 gap-2">
                                            {latestResult.results._images.map((img, idx) => (
                                              <div key={idx} className="relative"><img src={img.data} alt={"Lab "+(idx+1)} className="w-full h-20 object-cover rounded border cursor-pointer" onClick={() => window.open(img.data,"_blank")} /></div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </>);
                            })()}
                          </div>
                        )}
                      </div>
                    ) : hasLabOrders ? (
                      <div className="mb-6">
                        <h4 className="font-medium mb-3 text-gray-600" style={{ color: '#6B7280' }}>
                          ⏳ Lab Orders Pending Results
                        </h4>
                        <div className="space-y-3">
                          {/* Show old system BatchOrders (only if they don't have LabTestOrders linked) */}
                          {labBatchOrders
                            .filter(batchOrder => {
                              // Only show BatchOrder if it doesn't have LabTestOrders linked to it
                              // (LabTestOrders are shown separately below)
                              const hasLabTestOrders = labTestOrders.some(ltOrder => ltOrder.batchOrderId === batchOrder.id);
                              return !hasLabTestOrders;
                            })
                            .map((batchOrder) => (
                              <div key={batchOrder.id} className="p-4 border rounded-lg border-gray-200 bg-gray-50">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium text-gray-800">
                                      Order #{batchOrder.id}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      Status: <span className="font-medium">{batchOrder.status}</span>
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      Created: {new Date(batchOrder.createdAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => printLabOrders(batchOrder)}
                                      className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                                      title="Print Lab Order"
                                    >
                                      <Printer className="h-4 w-4" />
                                      Print
                                    </button>
                                    <button
                                      onClick={() => handleDeleteLabBatchOrder(batchOrder.id)}
                                      className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded transition-colors"
                                      title="Delete Lab Order"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Delete
                                    </button>
                                    <span className="px-2 py-1 text-xs font-medium text-gray-800 bg-gray-200 rounded-full">
                                      {batchOrder.status}
                                    </span>
                                  </div>
                                </div>

                                <div className="mt-3">
                                  <p className="text-sm font-medium mb-2 text-gray-800">Tests Ordered:</p>
                                  {batchOrder.services?.map((service, index) => (
                                    <div key={index} className="text-sm mb-1 text-gray-700">
                                      • {service.investigationType?.name}
                                    </div>
                                  ))}
                                </div>

                                {batchOrder.instructions && (
                                  <div className="mt-3">
                                    <p className="text-sm font-medium mb-1 text-gray-800">Instructions:</p>
                                    <p className="text-sm text-gray-700">{batchOrder.instructions}</p>
                                  </div>
                                )}
                              </div>
                            ))}

                          {/* Show pending new lab test orders (these replace BatchOrder display when using new system) */}
                          {labTestOrders
                            .filter(order => !order.results || order.results.length === 0)
                            .map((order) => (
                              <div key={order.id} className="p-4 border rounded-lg border-gray-200 bg-gray-50">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium text-gray-800">
                                      {order.labTest.name}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      Status: <span className="font-medium">{order.status}</span>
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      Created: {new Date(order.createdAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        const printContent = `
                                          <div style="padding: 20px; font-family: Arial, sans-serif;">
                                            <h2>Lab Order</h2>
                                            <p><strong>Test:</strong> ${order.labTest.name}</p>
                                            <p><strong>Category:</strong> ${order.labTest.category || 'N/A'}</p>
                                            <p><strong>Status:</strong> ${order.status}</p>
                                            <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
                                            ${order.instructions ? `<p><strong>Instructions:</strong> ${order.instructions}</p>` : ''}
                                          </div>
                                        `;
                                        const printWindow = window.open('', '_blank');
                                        printWindow.document.write(printContent);
                                        printWindow.document.close();
                                        printWindow.print();
                                      }}
                                      className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                                      title="Print Lab Order"
                                    >
                                      <Printer className="h-4 w-4" />
                                      Print
                                    </button>
                                    <button
                                      onClick={() => handleDeleteLabTestOrder(order.id)}
                                      className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded transition-colors"
                                      title="Delete Lab Test Order"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Delete
                                    </button>
                                    <span className="px-2 py-1 text-xs font-medium text-gray-800 bg-gray-200 rounded-full">
                                      {order.status}
                                    </span>
                                  </div>
                                </div>

                                {order.instructions && (
                                  <div className="mt-3">
                                    <p className="text-sm font-medium mb-1 text-gray-800">Instructions:</p>
                                    <p className="text-sm text-gray-700">{order.instructions}</p>
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-10 mb-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <div className="bg-white p-3 rounded-full w-16 h-16 mx-auto mb-4 shadow-sm flex items-center justify-center">
                          <TestTube className="h-8 w-8 text-gray-300" />
                        </div>
                        <p className="text-gray-500 font-medium">No lab results or orders yet</p>
                        <p className="text-sm text-gray-400 mt-1">Head over to <strong>Order Tests</strong> to place new lab orders</p>
                      </div>
                    );
                  })()}

                  {/* External Diagnostic Orders (read-only) */}
                  <ExternalDiagnosticOrders
                    type="LAB"
                    visitId={visitId}
                    patient={visit?.patient}
                    currentUser={currentUser}
                    orders={visit?.externalDiagnosticOrders || []}
                    onUpdated={fetchVisitData}
                    disabled={isCompletedMode || ['COMPLETED', 'CANCELLED'].includes(visit?.status)}
                    hideCreate={true}
                  />
                </div>
              )}

              {labSubTab === 'order' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-100 rounded-xl px-5 py-4">
                    <div className="bg-emerald-100 p-2.5 rounded-lg">
                      <Printer className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold" style={{ color: '#065F46' }}>Order Lab Tests</h3>
                      <p className="text-sm text-gray-500 mt-0.5">Place new lab test orders and external referral requests</p>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                      <h4 className="font-semibold text-gray-700 text-sm">External Diagnostic Orders</h4>
                    </div>
                    <div className="p-4">
                      <ExternalDiagnosticOrders
                        type="LAB"
                        visitId={visitId}
                        patient={visit?.patient}
                        currentUser={currentUser}
                        orders={visit?.externalDiagnosticOrders || []}
                        onUpdated={fetchVisitData}
                        disabled={isCompletedMode || ['COMPLETED', 'CANCELLED'].includes(visit?.status)}
                      />
                    </div>
                  </div>

                  <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                      <h4 className="font-semibold text-gray-700 text-sm">In-House Lab Tests</h4>
                    </div>
                    <div className="p-4">
                      <LabOrdering
                        visitId={visitId}
                        patientId={visit?.patient?.id}
                        patient={visit?.patient}
                        visit={visit}
                        onOrdersPlaced={handleOrdersPlaced}
                        existingOrders={[
                          ...(visit?.batchOrders?.filter(order => order.type === 'LAB') || []),
                          ...(visit?.labTestOrders || [])
                        ]}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'radiology' && (
            <div>
              {/* Radiology Sub-tabs */}
              <div className="flex justify-center items-center gap-4 mb-6">
                <button
                  onClick={() => setRadiologySubTab('results')}
                  className={`flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-bold transition-all shadow-sm ${
                    radiologySubTab === 'results'
                      ? 'bg-blue-600 text-white border-2 border-blue-600 shadow-lg shadow-blue-200 scale-105'
                      : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  <Scan className={`h-5 w-5 ${radiologySubTab === 'results' ? 'text-white' : 'text-purple-500'}`} />
                  Results & Orders
                </button>
                <button
                  onClick={() => setRadiologySubTab('order')}
                  className={`flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-bold transition-all shadow-sm ${
                    radiologySubTab === 'order'
                      ? 'bg-blue-600 text-white border-2 border-blue-600 shadow-lg shadow-blue-200 scale-105'
                      : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  <Printer className={`h-5 w-5 ${radiologySubTab === 'order' ? 'text-white' : 'text-purple-500'}`} />
                  Order Tests
                </button>
              </div>

              {radiologySubTab === null && (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
                </div>
              )}

              {radiologySubTab === 'results' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-100 rounded-xl px-5 py-4">
                    <div className="bg-purple-100 p-2.5 rounded-lg">
                      <Scan className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold" style={{ color: '#6D28D9' }}>Radiology Results &amp; Orders</h3>
                      <p className="text-sm text-gray-500 mt-0.5">View completed results and pending radiology orders for this visit</p>
                    </div>
                  </div>

                  {(() => {
                    const radBatchOrders = visit?.batchOrders?.filter(order => order.type === 'RADIOLOGY') || [];
                    const hasResults = radBatchOrders.some(order => order.radiologyResults?.length > 0);
                    const hasPending = radBatchOrders.some(order => !order.radiologyResults || order.radiologyResults.length === 0);

                    if (!hasResults && !hasPending) {
                      return (
                        <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                          <div className="bg-white p-3 rounded-full w-16 h-16 mx-auto mb-4 shadow-sm flex items-center justify-center">
                            <Scan className="h-8 w-8 text-gray-300" />
                          </div>
                          <p className="text-gray-500 font-medium">No radiology results or orders yet</p>
                          <p className="text-sm text-gray-400 mt-1">Head over to <strong>Order Tests</strong> to place new radiology orders</p>
                        </div>
                      );
                    }

                    return (
                      <>
                        {hasResults && (
                          <div>
                            <h4 className="font-medium mb-3 text-indigo-600" style={{ color: '#059669' }}>📊 Completed Results</h4>
                            <div className="space-y-3">
                              {radBatchOrders
                                .filter(order => order.radiologyResults?.length > 0)
                                .map((batchOrder) => (
                                  <RadiologyResultCard
                                    key={batchOrder.id}
                                    batchOrder={batchOrder}
                                    printRadiologyOrders={printRadiologyOrders}
                                    getImageUrl={getImageUrl}
                                    openImageViewer={openImageViewer}
                                  />
                                ))}
                            </div>
                          </div>
                        )}

                        {hasPending && (
                          <div>
                            <h4 className="font-medium mb-3 text-amber-600" style={{ color: '#D97706' }}>⏳ Pending Orders</h4>
                            <div className="space-y-3">
                              {radBatchOrders
                                .filter(order => !order.radiologyResults || order.radiologyResults.length === 0)
                                .map((batchOrder) => (
                                  <RadiologyPendingCard
                                    key={batchOrder.id}
                                    batchOrder={batchOrder}
                                    printRadiologyOrders={printRadiologyOrders}
                                    handleDeleteRadiologyBatchOrder={handleDeleteRadiologyBatchOrder}
                                  />
                                ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* External Diagnostic Orders (read-only) */}
                  <ExternalDiagnosticOrders
                    type="RADIOLOGY"
                    visitId={visitId}
                    patient={visit?.patient}
                    currentUser={currentUser}
                    orders={visit?.externalDiagnosticOrders || []}
                    onUpdated={fetchVisitData}
                    disabled={isCompletedMode || ['COMPLETED', 'CANCELLED'].includes(visit?.status)}
                    hideCreate={true}
                  />
                </div>
              )}

              {radiologySubTab === 'order' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-100 rounded-xl px-5 py-4">
                    <div className="bg-purple-100 p-2.5 rounded-lg">
                      <Printer className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold" style={{ color: '#6D28D9' }}>Order Radiology Tests</h3>
                      <p className="text-sm text-gray-500 mt-0.5">Place new radiology test orders and external referral requests</p>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                      <h4 className="font-semibold text-gray-700 text-sm">External Diagnostic Orders</h4>
                    </div>
                    <div className="p-4">
                      <ExternalDiagnosticOrders
                        type="RADIOLOGY"
                        visitId={visitId}
                        patient={visit?.patient}
                        currentUser={currentUser}
                        orders={visit?.externalDiagnosticOrders || []}
                        onUpdated={fetchVisitData}
                        disabled={isCompletedMode || ['COMPLETED', 'CANCELLED'].includes(visit?.status)}
                      />
                    </div>
                  </div>

                  <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                      <h4 className="font-semibold text-gray-700 text-sm">In-House Radiology Tests</h4>
                    </div>
                    <div className="p-4">
                      <RadiologyOrdering
                        visitId={visitId}
                        patientId={visit?.patient?.id}
                        onOrdersPlaced={handleOrdersPlaced}
                        existingOrders={visit?.batchOrders?.filter(order => order.type === 'RADIOLOGY') || []}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'nurse-services' && (
            <div>
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#0C0E0B' }}>Nurse Services</h3>

              {/* Nurse Services (Pending + Completed) */}
              {visit?.nurseServiceAssignments && visit.nurseServiceAssignments.length > 0 ? (
                <div className="mb-6">
                  <h4 className="font-medium mb-3" style={{ color: '#0C0E0B' }}>Ordered Services</h4>
                  <div className="space-y-3">
                    {visit.nurseServiceAssignments.map((assignment) => (
                      <div key={assignment.id} className="p-4 border rounded-lg" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h5 className="font-medium" style={{ color: '#0C0E0B' }}>
                              {assignment.service.name}
                            </h5>
                            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
                              {assignment.service.description}
                            </p>
                            {assignment.notes && (
                              <p className="text-sm mt-2 p-2 rounded" style={{ backgroundColor: '#E5E7EB', color: '#0C0E0B' }}>
                                <strong>Nurse Notes:</strong> {assignment.notes}
                              </p>
                            )}
                            <div className="flex items-center mt-2 text-xs" style={{ color: '#6B7280' }}>
                              <span>Assigned to: {assignment.assignedNurse.fullname}</span>
                              {assignment.status === 'COMPLETED' && assignment.completedAt && (
                                <>
                                  <span className="mx-2">•</span>
                                  <span>Completed: {new Date(assignment.completedAt).toLocaleString()}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${assignment.status === 'COMPLETED' ? 'bg-green-100 text-indigo-800' : 'bg-yellow-100 text-yellow-800'}`}
                            >
                              {assignment.status === 'COMPLETED' ? 'Completed' : 'Pending'}
                            </span>
                            <p className="text-sm font-medium mt-1" style={{ color: '#0C0E0B' }}>
                              ETB {(assignment.customPrice ?? assignment.service.price).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8" style={{ color: '#6B7280' }}>
                  <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No nurse services completed yet</p>
                </div>
              )}

              {/* Order New Nurse Services - List Interface */}
              <div className="mt-6">
                <h4 className="font-medium mb-3" style={{ color: '#0C0E0B' }}>Order New Services</h4>
                <NurseServiceOrderingInterface visit={visit} onOrdersPlaced={handleOrdersPlaced} />
              </div>
            </div>
          )}

          {activeTab === 'medications' && (
            <div>
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#0C0E0B' }}>Medications</h3>

              {/* Check if dental procedures need to be completed first */}
              {(() => {
                const dentalOrders = visit?.batchOrders?.filter(order => order.type === 'DENTAL' && order.status === 'PAID') || [];
                const unpaidDentalServices = dentalOrders.flatMap(order =>
                  order.services?.filter(service => !service.dentalProcedureCompletion) || []
                );
                const hasIncompleteDentalProcedures = unpaidDentalServices.length > 0;

                return hasIncompleteDentalProcedures ? (
                  <div className="mb-6 p-4 rounded-lg border" style={{ backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }}>
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 mt-0.5" style={{ color: '#D97706' }} />
                      <div>
                        <p className="font-medium" style={{ color: '#92400E' }}>
                          Complete Dental Procedures First
                        </p>
                        <p className="text-sm mt-1" style={{ color: '#78350F' }}>
                          Please complete all ordered dental procedures before prescribing medications.
                          {unpaidDentalServices.length} procedure{unpaidDentalServices.length > 1 ? 's' : ''} pending completion.
                        </p>
                        <button
                          onClick={() => setActiveTab('dental-services')}
                          className="mt-3 px-4 py-2 rounded-lg text-sm font-medium"
                          style={{ backgroundColor: '#2e13d1', color: '#FFFFFF' }}
                        >
                          Go to Dental Services
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Existing Medication Orders */}
              {visit?.medicationOrders && visit.medicationOrders.length > 0 ? (
                <div className="mb-6">
                  <h4 className="font-medium mb-3" style={{ color: '#0C0E0B' }}>Prescribed Medications</h4>
                  <div className="space-y-3">
                    {visit.medicationOrders.map((order) => (
                      <div key={order.id} className="p-4 border rounded-lg" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                        {(() => {
                          const medicationInstruction = resolveMedicationInstruction(order);

                          return (
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium" style={{ color: '#0C0E0B' }}>
                                  {order.name}{order.strength ? ` ${order.strength}` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleDeleteMedication(order.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete medication"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>

                            {/* Continuous Infusion Details */}
                            {order.continuousInfusion && (
                              <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                                <div className="flex items-center mb-2">
                                  <Clock className="h-4 w-4 text-purple-600 mr-2" />
                                  <span className="font-medium text-purple-800">Continuous Infusion</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="font-medium text-purple-700">Duration:</span>
                                    <span className="ml-2 text-purple-600">{order.continuousInfusion.days} days</span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-purple-700">Daily Dose:</span>
                                    <span className="ml-2 text-purple-600">{order.continuousInfusion.dailyDose}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-purple-700">Frequency:</span>
                                    <span className="ml-2 text-purple-600">{order.continuousInfusion.frequency}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-purple-700">Status:</span>
                                    <span className="ml-2 text-purple-600">{order.continuousInfusion.status}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                            {medicationInstruction && (
                              <div className="mt-3">
                                <p className="text-sm font-medium mb-1" style={{ color: '#0C0E0B' }}>Instructions:</p>
                                <p className="text-sm" style={{ color: '#6B7280' }}>{medicationInstruction}</p>
                              </div>
                            )}
                          </div>
                        </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 mb-6">
                  <Pill className="h-12 w-12 mx-auto mb-4" style={{ color: '#9CA3AF' }} />
                  <p style={{ color: '#6B7280' }}>No medications prescribed for this visit</p>
                </div>
              )}

              {/* Medication Prescription Interface */}
              <div className="border-t pt-6" style={{ borderColor: '#E5E7EB' }}>
                <MedicationOrdering
                  visitId={visitId}
                  patientId={visit?.patient?.id}
                  patient={visit?.patient}
                  doctor={currentUser}
                  onOrdersPlaced={handleOrdersPlaced}
                  existingOrders={visit?.medicationOrders || []}
                />
              </div>
            </div>
          )}

          {activeTab === 'compound-prescription' && (
            <div>
              <CompoundPrescriptionBuilder
                visit={visit}
                onSaved={handleOrdersPlaced}
              />
            </div>
          )}

          {activeTab === 'emergency-drugs' && (
            <div>
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#0C0E0B' }}>Emergency Drugs</h3>
              <EmergencyDrugOrdering
                visit={visit}
                onOrdersPlaced={handleOrdersPlaced}
              />
            </div>
          )}

          {activeTab === 'material-needs' && (
            <div>
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#0C0E0B' }}>Material Needs</h3>
              <MaterialNeedsOrdering
                visit={visit}
                onOrdersPlaced={handleOrdersPlaced}
              />
            </div>
          )}

          {activeTab === 'notes' && (
            <div>
              <DiagnosisNotes
                ref={diagnosisNotesRef}
                visitId={visitId}
                patientId={visit?.patient?.id}
                patientName={visit?.patient?.name}
                onSave={(result) => {
                  console.log('Diagnosis notes auto-saved:', result);
                }}
              />
            </div>
          )}

          {activeTab === 'accommodation' && (
            <AccommodationTab
              visit={visit}
              onUpdated={fetchVisitData}
            />
          )}

          {activeTab === 'pregnancy' && (
            <PregnancyTab
              visit={visit}
              visitId={visit?.id}
              patientId={visit?.patient?.id}
              onUpdated={fetchVisitData}
            />
          )}

          {activeTab === 'growth-chart' && (
            <GrowthChartTab
              visit={visit}
              visitId={visit?.id}
              patientId={visit?.patient?.id}
              onUpdated={fetchVisitData}
            />
          )}

          {activeTab === 'vaccination' && (
            <VaccinationTab
              visit={visit}
              visitId={visit?.id}
              patientId={visit?.patient?.id}
              onUpdated={fetchVisitData}
            />
          )}

          {activeTab === 'development' && (
            <DevelopmentTab
              visit={visit}
              visitId={visit?.id}
              patientId={visit?.patient?.id}
              onUpdated={fetchVisitData}
            />
          )}

          {activeTab === 'chronic-disease' && (
            <ChronicDiseaseTab
              visit={visit}
              visitId={visit?.id}
              patientId={visit?.patient?.id}
              onUpdated={fetchVisitData}
            />
          )}

          {activeTab === 'surgical-notes' && (
            <SurgicalNotesTab
              visit={visit}
              visitId={visit?.id}
              patientId={visit?.patient?.id}
              onUpdated={fetchVisitData}
            />
          )}

          {activeTab === 'imaging-viewer' && (
            <ImagingViewerTab
              visit={visit}
              visitId={visit?.id}
              patientId={visit?.patient?.id}
              onUpdated={fetchVisitData}
            />
          )}

          {activeTab === 'body-chart' && (
            <BodyChartTab
              visit={visit}
              visitId={visit?.id}
              patientId={visit?.patient?.id}
              onUpdated={fetchVisitData}
            />
          )}

          {activeTab === 'exercise-rx' && (
            <ExerciseRxTab
              visit={visit}
              visitId={visit?.id}
              patientId={visit?.patient?.id}
              onUpdated={fetchVisitData}
            />
          )}

          {activeTab === 'outcome-scores' && (
            <OutcomeScoresTab
              visit={visit}
              visitId={visit?.id}
              patientId={visit?.patient?.id}
              onUpdated={fetchVisitData}
            />
          )}
        </div>

        {/* ImageViewer Modal */}
        <ImageViewer
          isOpen={imageViewerOpen}
          onClose={closeImageViewer}
          images={imageViewerImages}
          currentIndex={imageViewerIndex}
        />

        {/* Missing Investigation Findings Warning Modal */}
        {showMissingInvestigationsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowMissingInvestigationsModal(false)}>
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-shrink-0">
                    <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
                      <AlertTriangle className="h-6 w-6" style={{ color: '#F59E0B' }} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold" style={{ color: '#0C0E0B' }}>Missing Investigation Findings</h3>
                    <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
                      Please fill in the Investigation Findings before completing this visit.
                    </p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <p className="text-sm" style={{ color: '#92400E' }}>
                    Investigation Findings are required to complete the visit. Please go to the Diagnosis Notes tab and fill in the Investigation Findings field.
                  </p>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowMissingInvestigationsModal(false)}
                    className="px-4 py-2 border rounded-lg font-medium transition-colors hover:bg-gray-50"
                    style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowMissingInvestigationsModal(false);
                      setActiveTab('notes');
                    }}
                    className="px-4 py-2 rounded-lg font-medium text-white transition-colors hover:opacity-90"
                    style={{ backgroundColor: '#2e13d1' }}
                  >
                    OK, I'll fill it
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Complete Visit Confirmation Modal */}
        {showCompleteConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowCompleteConfirmModal(false)}>
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-shrink-0">
                    <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
                      <AlertTriangle className="h-6 w-6" style={{ color: '#F59E0B' }} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold" style={{ color: '#0C0E0B' }}>Complete Visit</h3>
                    <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
                      Are you sure you want to complete this visit, <span className="font-semibold" style={{ color: '#2e13d1' }}>Dr. {currentUser?.fullname || currentUser?.username || 'Doctor'}</span>?
                    </p>
                  </div>
                </div>

                {visit?.patient && (
                  <div className="bg-gray-50 border rounded-lg p-4 mb-4" style={{ borderColor: '#E5E7EB' }}>
                    <p className="text-sm font-medium mb-2" style={{ color: '#0C0E0B' }}>Patient Information:</p>
                    <div className="space-y-1 text-sm">
                      <p style={{ color: '#6B7280' }}>
                        <span className="font-medium">Name:</span> <span style={{ color: '#0C0E0B' }}>{visit.patient.name}</span>
                      </p>
                      <p style={{ color: '#6B7280' }}>
                        <span className="font-medium">Visit ID:</span> <span style={{ color: '#0C0E0B' }}>{visit.visitUid}</span>
                      </p>
                    </div>
                  </div>
                )}

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium" style={{ color: '#92400E' }}>
                    ⚠️ This action cannot be undone. Once completed, the visit will be finalized.
                  </p>
                </div>

                {isDermatologyDoctor && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={countAsMedicalTreated}
                        onChange={(e) => setCountAsMedicalTreated(e.target.checked)}
                        className="mt-1"
                      />
                      <div>
                        <p className="text-sm font-semibold text-blue-900">Count this patient as Medical treated?</p>
                        <p className="text-xs text-blue-700 mt-1">
                          If checked, this completion is counted in Admin Doctor Reports under Medical Treated (Dermatology).
                        </p>
                      </div>
                    </label>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowCompleteConfirmModal(false)}
                    className="px-4 py-2 border rounded-lg font-medium transition-colors hover:bg-gray-50"
                    style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmCompleteVisit}
                    className="px-4 py-2 rounded-lg font-medium text-white transition-colors hover:opacity-90"
                    style={{ backgroundColor: '#2e13d1' }}
                  >
                    Yes, Complete Visit
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Complete Visit Modal */}
        {showCompleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
              <div className="shrink-0 p-6 pb-0 flex justify-between items-center">
                <h2 className="text-xl font-semibold" style={{ color: '#2e13d1' }}>
                  Complete Visit
                </h2>
                <button
                  onClick={() => setShowCompleteModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="overflow-y-auto flex-1 p-6 space-y-4">
                {/* Visit Completion Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-blue-800">
                        Completing Visit
                      </h3>
                      <div className="mt-2 text-sm text-blue-700">
                        <p>All diagnosis details, instructions, and notes have been captured in the Diagnosis & Notes section.</p>
                        <p className="mt-1">This will save all visit data to the patient's medical history.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Follow-up Appointment */}
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={completeForm.needsAppointment}
                      onChange={(e) => handleCompleteFormChange('needsAppointment', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm font-medium" style={{ color: '#2e13d1' }}>
                      Schedule follow-up appointment
                    </span>
                  </label>
                </div>

                {/* Appointment Details */}
                {completeForm.needsAppointment && (
                  <div className="space-y-3 pl-6 border-l-2 border-blue-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: '#2e13d1' }}>
                          Appointment Date *
                        </label>
                        <input
                          type="date"
                          value={completeForm.appointmentDate}
                          onChange={(e) => handleCompleteFormChange('appointmentDate', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min={new Date().toISOString().split('T')[0]}
                          required={completeForm.needsAppointment}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: '#2e13d1' }}>
                          Appointment Time
                        </label>
                        <input
                          type="time"
                          value={completeForm.appointmentTime}
                          onChange={(e) => handleCompleteFormChange('appointmentTime', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: '#2e13d1' }}>
                        Appointment Notes
                      </label>
                      <textarea
                        value={completeForm.appointmentNotes}
                        onChange={(e) => handleCompleteFormChange('appointmentNotes', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder="Notes for the follow-up appointment"
                      />
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Sticky footer */}
            <div className="shrink-0 border-t bg-white px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={() => setShowCompleteModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={completingVisit}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitCompleteVisit}
                disabled={completingVisit || (completeForm.needsAppointment && !completeForm.appointmentDate)}
                className="px-4 py-2 rounded-md font-medium text-white transition-colors"
                style={{
                  backgroundColor: completingVisit ? '#9CA3AF' : '#EA2E00',
                  cursor: completingVisit || (completeForm.needsAppointment && !completeForm.appointmentDate) ? 'not-allowed' : 'pointer'
                }}
              >
                {completingVisit ? 'Completing...' : 'Complete Visit'}
              </button>
            </div>
          </div>
        )}

        {/* Image Viewer */}
        <ImageViewer
          isOpen={imageViewerOpen}
          onClose={closeImageViewer}
          images={imageViewerImages}
          currentIndex={imageViewerIndex}
        />

        {showTransferModal && (
          <TransferToDoctorModal
            visit={visit}
            patient={visit.patient}
            onClose={() => setShowTransferModal(false)}
            onTransferred={() => {
              handleBackToQueue();
            }}
          />
        )}
      </div>
    </Layout>
  );
};

const RadiologyResultCard = ({ batchOrder, printRadiologyOrders, getImageUrl, openImageViewer }) => {
  const resultCount = batchOrder.radiologyResults?.length || 0;
  const batchAttachments = batchOrder.attachments || [];
  return (
    <div className="p-4 border rounded-lg border-indigo-200 bg-green-50 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="font-bold text-indigo-800">Order #{batchOrder.id}</p>
          <span className="px-2 py-0.5 text-xs font-medium text-indigo-800 bg-indigo-200 rounded-full">{resultCount} result{resultCount > 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => printRadiologyOrders(batchOrder)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-800 bg-green-100 hover:bg-indigo-200 rounded transition-colors"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <span className="px-2 py-1 text-xs font-medium text-indigo-800 bg-indigo-200 rounded-full">COMPLETED</span>
        </div>
      </div>
      <div className="space-y-3">
        {batchOrder.radiologyResults.map((result, idx) => {
          let images = result.attachments || [];
          if (images.length === 0 && batchAttachments.length > 0) {
            images = batchAttachments;
          }
          return (
            <div key={idx} className="bg-white p-4 rounded-lg border border-green-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-green-900 text-sm">{result.testType?.name || 'Scan'}</p>
                <p className="text-xs text-gray-400">{new Date(result.createdAt).toLocaleString()}</p>
              </div>
              {result.clinicalIndication && (
                <div className="mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Clinical Indication</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{result.clinicalIndication}</p>
                </div>
              )}
              {result.technique && (
                <div className="mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Technique</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{result.technique}</p>
                </div>
              )}
              {result.comparison && (
                <div className="mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Comparison</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{result.comparison}</p>
                </div>
              )}
              {(result.finding || result.resultText || result.findings) && (
                <div className="mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Findings</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{result.finding || result.resultText || result.findings}</p>
                </div>
              )}
              {result.conclusion && (
                <div className="mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Conclusion</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{result.conclusion}</p>
                </div>
              )}
              {result.recommendations && (
                <div className="mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Recommendations</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{result.recommendations}</p>
                </div>
              )}
              {images.length > 0 && (
                <div className="mt-3 grid grid-cols-3 md:grid-cols-4 gap-2">
                  {images.map((att, aIdx) => (
                    <div
                      key={aIdx}
                      onClick={() => openImageViewer(images, aIdx)}
                      className="relative group cursor-pointer rounded-lg overflow-hidden border border-indigo-200 hover:border-blue-400 transition-all"
                    >
                      <img
                        src={getImageUrl(att.fileUrl || att.path)}
                        alt={att.fileName || att.originalName || `Scan ${aIdx + 1}`}
                        className="w-full h-24 object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          const fallback = e.target.parentElement.querySelector('.img-fallback');
                          if (fallback) fallback.classList.remove('hidden');
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                        <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 bg-black/50 px-2 py-1 rounded">Click to view</span>
                      </div>
                      <div className="img-fallback hidden absolute inset-0 bg-gray-100 flex items-center justify-center rounded-lg">
                        <div className="text-center text-gray-400">
                          <Image className="h-6 w-6 mx-auto mb-1" />
                          <span className="text-xs">Failed to load</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {images.length === 0 && batchAttachments.length === 0 && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-center">
                  <p className="text-xs text-gray-400">No images attached</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const RadiologyPendingCard = ({ batchOrder, printRadiologyOrders, handleDeleteRadiologyBatchOrder }) => {
  const [collapsed, setCollapsed] = useState(true);
  const serviceCount = batchOrder.services?.length || 0;
  return (
    <div className="p-4 border rounded-lg border-amber-200 bg-amber-50 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${!collapsed ? 'rotate-90' : ''}`} />
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
          <div>
            <p className="font-bold text-amber-800">Order #{batchOrder.id}</p>
            <p className="text-xs text-amber-600">{serviceCount} test{serviceCount > 1 ? 's' : ''} — {batchOrder.status}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => printRadiologyOrders(batchOrder)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-700 bg-white border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            onClick={() => handleDeleteRadiologyBatchOrder(batchOrder.id)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            title="Delete Radiology Order"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="mt-3 space-y-2">
          {(batchOrder.services || []).map((service, idx) => (
            <div key={`${batchOrder.id}-${service.id || idx}`} className="p-3 border rounded-lg border-amber-100 bg-white/90">
              <p className="font-semibold text-amber-900">{service.investigationType?.name || service.service?.name || 'Radiology Test'}</p>
              {service.instructions && (
                <p className="text-xs text-amber-700 mt-1">{service.instructions}</p>
              )}
              <p className="text-xs text-amber-600 mt-2">
                Status: <span className="font-bold">{batchOrder.status}</span> • Created: {new Date(batchOrder.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PatientConsultationPage;

