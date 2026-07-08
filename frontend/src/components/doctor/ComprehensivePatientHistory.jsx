import React, { useState, useEffect } from 'react';
import {
  User, Search, FileText, Calendar, TestTube, Scan, Pill, Heart, Clock,
  CheckCircle, AlertTriangle, Download, Eye, Circle, Stethoscope,
  Activity, Image, Receipt, Users, ChevronDown, ChevronRight,
  MapPin, Phone, Mail, Calendar as CalendarIcon, UserCheck, X, ArrowLeft, Printer, Smile, UserCog, Package, Edit2, Check, Beaker
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import DentalChartDisplay from '../common/DentalChartDisplay';
import ImageViewer from '../common/ImageViewer';
import { getImageUrl } from '../../utils/imageUrl';
import { checkValueInNormalRange } from '../../utils/normalRangeParser';
import { formatMedicationName, formatMedicationInstruction, formatEmergencyInstruction } from '../../utils/medicalStandards';

const NON_CLINICAL_CUSTOM_NOTE = 'Custom medication - not in inventory';


  const normalizeResultKey = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

  const parseStructuredResultObject = (value) => {
    if (!value) return null;
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    if (typeof value !== 'string') return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch { return null; }
  };

  const getResultValue = (resultObject, field) => {
    const source = parseStructuredResultObject(resultObject);
    if (!source) return undefined;
    const keys = [field?.fieldName, field?.label,
      String(field?.label || '').replace(/\s+/g, '_').toLowerCase(),
      String(field?.label || '').replace(/\s+/g, '')].filter(Boolean);
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
    }
    const normalized = keys.map(normalizeResultKey).filter(Boolean);
    if (!normalized.length) return undefined;
    const entry = Object.entries(source).find(([k]) => normalized.includes(normalizeResultKey(k)));
    return entry ? entry[1] : undefined;
  };

  const extractLabRows = (result) => {
    // 1. Try detailedResults (already processed by backend)
    const dr = result.detailedResults?.filter(d => d.result !== null && d.result !== undefined && d.result !== '') || [];
    if (dr.length > 0) return dr;

    // 2. Build from raw results JSON + resultFields
    const testType = result.testType || result.labTest || {};
    const resultFields = testType.resultFields || result.labTest?.resultFields || [];
    const rawObj = (() => {
      if (result.results && Array.isArray(result.results)) return result.results[0]?.results || result.results[0] || {};
      if (result.results && typeof result.results === 'object') return result.results;
      return null;
    })();
    if (!rawObj) return [];

    // Try matching resultFields against the JSON keys
    if (resultFields.length > 0) {
      const rows = resultFields.map(f => {
        const val = getResultValue(rawObj, f);
        return val !== undefined && val !== null && val !== '' ? {
          testName: f.label || f.fieldName,
          result: String(val),
          unit: f.unit || '',
          referenceRange: f.referenceRange || ''
        } : null;
      }).filter(Boolean);
      if (rows.length > 0) return rows;
    }

    // 3. Last resort: just show all JSON keys as rows
    return Object.entries(rawObj)
      .filter(([k]) => k !== '_images')
      .map(([k, v]) => ({
        testName: k.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase()),
        result: typeof v === 'object' ? JSON.stringify(v) : String(v),
        unit: '',
        referenceRange: ''
      }))
      .filter(r => r.result && r.result !== '');
  };

  const extractLabImages = (result) => {
    const images = [];
    // From attachments relation
    if (result.attachments) {
      result.attachments.forEach(a => { if (a && !images.some(i => i.fileUrl === (a.fileUrl || a.url))) images.push(a); });
    }
    // From raw results[0].attachments
    if (Array.isArray(result.results)) {
      result.results.forEach(r => {
        if (r.attachments) {
          r.attachments.forEach(a => { if (a && !images.some(i => i.fileUrl === (a.fileUrl || a.url))) images.push(a); });
        }
        if (r.results?._images) {
          (Array.isArray(r.results._images) ? r.results._images : [r.results._images]).forEach(img => {
            const url = img.fileUrl || img.url || img;
            if (url && !images.some(i => i.fileUrl === url)) images.push(typeof img === 'string' ? { fileUrl: img } : img);
          });
        }
      });
    }
    // From results._images (processed format)
    if (result.results?._images && !Array.isArray(result.results)) {
      (Array.isArray(result.results._images) ? result.results._images : [result.results._images]).forEach(img => {
        const url = img.fileUrl || img.url || img;
        if (url && !images.some(i => i.fileUrl === url)) images.push(typeof img === 'string' ? { fileUrl: img } : img);
      });
    }
    return images;
  };

const ComprehensivePatientHistory = () => {
  const { user: currentUser } = useAuth();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedVisitId, setSelectedVisitId] = useState(null);
  const [activeTab, setActiveTab] = useState('vitals');
  const [imageViewerState, setImageViewerState] = useState({
    isOpen: false,
    images: [],
    currentIndex: 0
  });
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteData, setEditingNoteData] = useState({});
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [loadingVisitDetails, setLoadingVisitDetails] = useState(false);
  const [patientSummary, setPatientSummary] = useState(null);
  const [selectedHistoryVisitId, setSelectedHistoryVisitId] = useState(null);
  const [visitDetailTab, setVisitDetailTab] = useState('summary');

  const stripHtml = (html) => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const resolveMedicationInstruction = (medication) => {
    const candidates = [medication?.instructions, medication?.instructionText, medication?.additionalNotes];
    const normalizedPlaceholder = NON_CLINICAL_CUSTOM_NOTE.toLowerCase();

    for (const candidate of candidates) {
      const text = String(candidate || '').trim();
      if (!text) continue;
      if (text.toLowerCase() === normalizedPlaceholder) continue;
      return text;
    }

    return '';
  };

  const getDoctorQualificationLabel = (doctorData, fallbackDoctorData) => {
    const specialty = doctorData?.specialty || fallbackDoctorData?.specialty;
    const labels = {
      general: 'General Doctor', dentist: 'Dentist', dermatology: 'Dermato-venereologist',
      healthOfficer: 'Health Officer (HO)', obgyn: 'OB/GYN', pediatrician: 'Pediatrician',
      internist: 'Internist', surgeon: 'Surgeon', orthopedic: 'Orthopedic',
      physiotherapist: 'Physiotherapist'
    };
    if (specialty && labels[specialty]) return labels[specialty];

    const roleCandidates = [doctorData?.role, fallbackDoctorData?.role]
      .map((role) => String(role || '').toUpperCase());
    const mergedQualifications = [
      ...(doctorData?.qualifications || []),
      ...(fallbackDoctorData?.qualifications || [])
    ];
    const normalizedQualifications = mergedQualifications.map((q) => String(q || '').toUpperCase());

    const isHealthOfficer =
      roleCandidates.some((role) => role.includes('HEALTH_OFFICER') || role === 'HO') ||
      normalizedQualifications.some((q) => q.includes('HEALTH OFFICER') || q.includes('HEALTH_OFFICER') || q === 'HO');

    if (isHealthOfficer) return 'Health Officer (HO)';
    if (roleCandidates.some((role) => role.includes('DERM')) || normalizedQualifications.some((q) => q.includes('DERM'))) {
      return 'Dermato-venereologist';
    }

    return Array.from(new Set(mergedQualifications.filter(Boolean))).join(', ') || 'General Practitioner';
  };

  const getPrintableDoctorName = (doctorData, fallbackDoctorData) => {
    const rawName = String(
      doctorData?.fullname ||
      doctorData?.fullName ||
      doctorData?.name ||
      fallbackDoctorData?.fullname ||
      fallbackDoctorData?.username ||
      ''
    ).trim();

    if (!rawName) return 'Attending Clinician';
    if (/^(dr|mr)\.?\s+/i.test(rawName)) return rawName;

    const roleCandidates = [doctorData?.role, fallbackDoctorData?.role]
      .map((role) => String(role || '').toUpperCase());
    const mergedQualifications = [
      ...(doctorData?.qualifications || []),
      ...(fallbackDoctorData?.qualifications || [])
    ];
    const normalizedQualifications = mergedQualifications.map((q) => String(q || '').toUpperCase());
    const isHealthOfficer =
      roleCandidates.some((role) => role.includes('HEALTH_OFFICER') || role === 'HO') ||
      normalizedQualifications.some((q) => q.includes('HEALTH OFFICER') || q.includes('HEALTH_OFFICER') || q === 'HO');

    return isHealthOfficer ? `Mr. ${rawName}` : `Dr. ${rawName}`;
  };

  const renderNoteField = (fieldKey, label, note) => {
    const isEditing = editingNoteId === note.id;
    const value = isEditing ? editingNoteData[fieldKey] : note[fieldKey];
    const displayValue = stripHtml(value);

    if (!displayValue && !isEditing) return null;

    return (
      <div className="overflow-hidden">
        <p style={{ color: '#6B7280' }} className="text-sm font-semibold mb-1">{label}:</p>
        {isEditing ? (
          <textarea
            value={value || ''}
            onChange={(e) => setEditingNoteData(prev => ({ ...prev, [fieldKey]: e.target.value }))}
            className="w-full p-2 border rounded text-sm"
            rows={2}
            placeholder={label}
          />
        ) : (
          <div className="text-sm text-gray-900 break-words whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: value }} />
        )}
      </div>
    );
  };

  const fetchPatients = async (pageNum = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: pageNum, limit: '20' });
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      const response = await api.get(`/patients?${params}`);
      setPatients(response.data.patients || []);
      setPage(pageNum);
      setTotalPages(response.data.pagination?.totalPages || 1);
    } catch (error) {
      toast.error('Failed to fetch patients');
    } finally {
      setLoading(false);
    }
  };

  // Load patients on mount
  useEffect(() => {
    fetchPatients(1);
  }, []);

  const fetchPatientHistory = async (patientId) => {
    try {
      setLoading(true);
      const response = await api.get(`/doctors/patient-history/${patientId}`);
      setPatientHistory(response.data);
      // Auto-select the first visit if available
      if (response.data?.visits && response.data.visits.length > 0) {
        setSelectedVisitId(response.data.visits[0].id);
      }
    } catch (error) {
      toast.error('Failed to fetch patient history');
    } finally {
      setLoading(false);
    }
  };

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    setSelectedVisitId(null);
    setActiveTab('vitals');
    fetchPatientHistory(patient.id);
  };

  const clearPatientSelection = () => {
    setSelectedPatient(null);
    setPatientHistory(null);
    setSelectedVisitId(null);
    setActiveTab('vitals');
    fetchPatients(1);
  };

  const openImageViewer = (images, currentIndex = 0) => {
    setImageViewerState({
      isOpen: true,
      images: images || [],
      currentIndex
    });
  };

  const closeImageViewer = () => {
    setImageViewerState({
      isOpen: false,
      images: [],
      currentIndex: 0
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED':
      case 'DISPENSED':
      case 'PAID':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
      case 'QUEUED':
        return 'bg-yellow-100 text-yellow-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDateOnly = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getSelectedVisit = () => {
    if (!patientHistory?.visits || !selectedVisitId) return null;
    return patientHistory.visits.find(v => v.id === selectedVisitId);
  };

  const selectedVisit = getSelectedVisit();

  const handlePrintVisit = () => {
    if (!selectedVisit || !patientHistory) return;

    const printWindow = window.open('', '_blank');
    const printContent = generatePrintHTML(selectedVisit, patientHistory);

    printWindow.document.write(printContent);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleDownloadPDF = async () => {
    if (!selectedVisit || !patientHistory) return;

    try {
      const response = await api.get(`/doctors/patient-history/${patientHistory.patient.id}/visit/${selectedVisit.id}/pdf`);
      const link = document.createElement('a');
      link.href = getImageUrl(response.data.filePath);
      link.download = response.data.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF');
    }
  };

  // Calculate patient age from date of birth
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

  // Print medications from patient history
  const handlePrintMedications = () => {
    // Check both medications and medicationOrders
    const medications = selectedVisit?.medications || selectedVisit?.medicationOrders || [];
    if (!selectedVisit || !patientHistory || medications.length === 0) {
      toast.error('No medications to print');
      return;
    }

    try {
      const patient = patientHistory.patient;
      let medicationsToPrint = medications;

      // Deduplicate exactly identical medication orders
      medicationsToPrint = medicationsToPrint.reduce((acc, current) => {
        const isDuplicate = acc.find(item =>
          item.name === current.name &&
          item.strength === current.strength &&
          item.frequency === current.frequency &&
          item.frequencyPeriod === current.frequencyPeriod &&
          item.route === current.route &&
          item.duration === current.duration
        );
        if (!isDuplicate) acc.push(current);
        return acc;
      }, []);

      const patientAge = patient?.dob ? calculateAge(patient.dob) : 'N/A';
      const patientGender = patient?.gender || 'N/A';
      const patientCardNumber = patient?.id || 'N/A';
      const patientName = patient?.name || 'N/A';
      const patientAddress = patient?.address || 'N/A';
      const patientPhone = patient?.mobile || patient?.phone || 'N/A';

      // Get doctor from first medication order (all should be from same doctor)
      const firstMed = medicationsToPrint[0];
      const prescribingDoctor = firstMed?.doctor || firstMed?.medicationOrder?.doctor || selectedVisit.doctor || currentUser;
      const doctorName = getPrintableDoctorName(prescribingDoctor, currentUser);
      const doctorQualification = getDoctorQualificationLabel(prescribingDoctor, currentUser);
      const doctorLicense = prescribingDoctor?.licenseNumber || currentUser?.licenseNumber || 'N/A';

      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const currentTime = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const medCount = medicationsToPrint.length;
      let numColumns = 1;
      if (medCount >= 7) {
        numColumns = 3;
      } else if (medCount >= 4) {
        numColumns = 2;
      } else if (medCount >= 3) {
        numColumns = 2;
      } else {
        numColumns = 1;
      }

      const printWindow = window.open('', '_blank');
      const prescriptionContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Prescription - ${patientName}</title>
          <style>
            @media print {
              @page { size: A6; margin: 0 !important; }
              html, body { 
                margin: 0 !important; 
                padding: 0 !important; 
                background: white !important;
                visibility: visible !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                overflow: visible !important;
              }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color: black !important; }
              .no-print { display: none !important; }
              .prescription-container {
                width: 105mm !important;
                min-height: 148mm !important;
                margin: 0 auto !important;
                padding: 8mm !important;
                border: none !important;
                box-shadow: none !important;
                background: white !important;
                display: block !important;
                position: relative !important;
                overflow: hidden !important;
                box-sizing: border-box !important;
                visibility: visible !important;
              }
            }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 0; 
              padding: 20px;
              color: #333;
              line-height: 1.4;
              background: #f3f4f6;
              display: flex;
              flex-direction: column;
              align-items: center;
              min-height: 100vh;
            }
            .no-print {
              text-align: center;
              padding: 15px;
              background: #fff;
              margin-bottom: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              width: 100%;
              max-width: 400px;
            }
            .no-print button {
              background: #2563eb;
              color: white;
              border: none;
              padding: 10px 24px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 16px;
              font-weight: 600;
              transition: background 0.2s;
            }
            .no-print button:hover {
              background: #1d4ed8;
            }
            .prescription-container {
              width: 105mm;
              min-height: 148mm;
              background: white;
              padding: 8mm;
              box-shadow: 0 10px 25px rgba(0,0,0,0.1);
              border-radius: 2px;
              position: relative;
              box-sizing: border-box;
              display: block;
              margin: 0 auto;
            }
            .header { 
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding-bottom: 8px; 
              margin-bottom: 12px; 
              border-bottom: 2px solid #2563eb;
            }
            .header-left {
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .logo {
              width: 45px;
              height: 45px;
              border-radius: 50%; object-fit: cover;
            }
            .clinic-info {
              text-align: left;
            }
            .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; margin-bottom: 12px; border-bottom: 2px solid #2563eb; }
            .header-left { display: flex; align-items: center; gap: 8px; }
            .logo { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
            .clinic-name { font-size: 13px; font-weight: 700; margin: 0; color: #1e40af; text-transform: uppercase; }
            .clinic-tagline { font-size: 9px; color: #64748b; margin: 0; font-style: italic; }
            .report-title { font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; }
            .report-info { font-size: 9px; color: #64748b; margin-top: 1px; text-align: right; }
            .patient-section { margin-bottom: 12px; padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; }
            .info-label { font-weight: 700; color: #64748b; }
            .info-value { color: #1e293b; font-weight: 500; font-size: 11px; }
            .medications-section h3 { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; }
            .medication-item { margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed #e2e8f0; width: 100%; }
            .medication-name { font-weight: 700; font-size: 12px; color: #0f172a; margin-bottom: 2px; }
            .medication-details { font-size: 11px; color: #334155; font-weight: 500; }
            .footer { margin-top: auto; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px; }
            .doctor-name { font-weight: 700; color: #1e293b; font-size: 11px; }
            .signature-box { width: 100px; border-top: 1px solid #334155; padding-top: 4px; text-align: center; font-size: 8px; color: #64748b; }
            .signature-area {
              text-align: center;
              width: 120px;
            }
            .signature-line {
              border-top: 1px solid #334155;
              margin-top: 25px;
              padding-top: 3px;
              font-size: 10px;
              font-weight: 600;
              color: #64748b;
            }
            .print-footer {
              text-align: center;
              font-size: 9px;
              color: #94a3b8;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()">Print Prescription</button>
          </div>

          <div class="prescription-container">
            <div class="header">
              <div class="header-left">
                <img src="${window.__CS__?.logoUrl || '/clinic-logo.jpg'}" alt="Clinic Logo" class="logo" onerror="this.style.display='none'">
                <div class="clinic-info">
                  <h1 class="clinic-name">${window.__CS__?.name || 'Clinic'}</h1>
                  <p class="clinic-tagline">${window.__CS__?.tagline || 'Quality Healthcare You Can Trust'}</p>
                </div>
              </div>
              <div class="header-right">
                <h2 class="report-title">Prescription</h2>
                <div class="report-info">
                  Date: ${currentDate}<br>
                  Time: ${currentTime}
                </div>
              </div>
            </div>
            <div class="patient-section">
              <div class="info-item"><span class="info-label">Patient:</span> <span class="info-value">${patientName?.toUpperCase()}</span></div>
              <div class="info-item"><span class="info-label">Card No:</span> <span class="info-value">#${patientCardNumber}</span></div>
              <div class="info-item"><span class="info-label">Age/Sex:</span> <span class="info-value">${typeof patientAge === 'number' ? patientAge + 'Y' : patientAge} / ${patientGender}</span></div>
              <div class="info-item"><span class="info-label">Visit ID:</span> <span class="info-value">#${selectedVisit?.visitUid || selectedVisit?.id?.substring(0, 8)}</span></div>
            </div>
            <div class="medications-section">
              <h3>Prescribed Medications</h3>
              ${medicationsToPrint.map((med, index) => {
        const cleanedName = formatMedicationName(med.name);
        const strength = med.strength && med.strength !== 'N/A' ? med.strength : '';
        const instructionLine = formatMedicationInstruction(med);
        const note = resolveMedicationInstruction(med);

        return `
                <div class="medication-item">
                  <div class="medication-name"># ${index + 1}. ${cleanedName} ${strength}</div>
                  <div class="medication-details">
                    ${instructionLine}
                    ${note ? `<div style="font-size: 9px; margin-top: 2px; color: #64748b; font-style: italic;">Note: ${note}</div>` : ''}
                  </div>
                </div>
              `;
      }).join('')}
            </div>

            <div class="footer">
              <div>
                Prescribed by: <span class="doctor-name">${doctorName}</span><br>
                <div style="font-size: 8px; color: #64748b;">${doctorQualification}</div>
              </div>
              <div class="signature-box">Doctor's Signature & Stamp</div>
            </div>

            <div class="print-footer">
              ${window.__CS__?.name || 'Clinic'} - Generated on ${new Date().toLocaleString()}
            </div>
          </div>
        </body>
      </html>
    `;

      printWindow.document.write(prescriptionContent);
      printWindow.document.close();

      setTimeout(() => {
        printWindow.print();
      }, 800);

      toast.success('Opening print dialog...');
    } catch (error) {
      console.error('Error printing prescription:', error);
      toast.error('Failed to print prescription');
    }
  };

  // Print lab results from patient history
  const handlePrintLabResults = async () => {
    // Check labResults, labOrders, and labTestOrders
    const labResults = selectedVisit?.labResults || selectedVisit?.labOrders || selectedVisit?.labTestOrders || [];
    if (!selectedVisit || !patientHistory || labResults.length === 0) {
      toast.error('No lab results to print');
      return;
    }

    try {
      const patient = patientHistory.patient;

      // Filter to only show completed results (not QUEUED, PENDING, or UNPAID)
      // Only show results that have been completed and have actual result data
      let allResults = [];
      for (const result of labResults) {
        // Skip if status is QUEUED, PENDING, or UNPAID
        const status = result.status?.toUpperCase() || '';
        if (['QUEUED', 'PENDING', 'UNPAID'].includes(status)) {
          continue; // Skip pending/queued orders
        }

        // Include COMPLETED results even if they don't have detailed results yet
        // For other statuses, require detailed results or result text
        if (status === 'COMPLETED') {
          // Always include COMPLETED results, even without detailed results
          allResults.push({
            testName: result.testType?.name || result.serviceName || 'Lab Test',
            detailedResults: result.detailedResults || [],
            resultText: result.resultText || null,
            additionalNotes: result.additionalNotes || '',
            createdAt: result.createdAt,
            verifiedBy: result.verifiedBy,
            verifiedByUser: result.verifiedByUser || null,
            verifiedAt: result.verifiedAt,
            status: status
          });
        } else if (result.detailedResults && result.detailedResults.length > 0) {
          // Include if it has detailed results
          allResults.push({
            testName: result.testType?.name || result.serviceName || 'Lab Test',
            detailedResults: result.detailedResults,
            additionalNotes: result.additionalNotes || '',
            createdAt: result.createdAt,
            verifiedBy: result.verifiedBy,
            verifiedByUser: result.verifiedByUser || null,
            verifiedAt: result.verifiedAt,
            status: status
          });
        } else if (result.resultText) {
          // Include if it has result text
          allResults.push({
            testName: result.testType?.name || result.serviceName || 'Lab Test',
            detailedResults: [],
            resultText: result.resultText,
            additionalNotes: result.additionalNotes || '',
            createdAt: result.createdAt,
            verifiedBy: result.verifiedBy,
            verifiedByUser: result.verifiedByUser || null,
            verifiedAt: result.verifiedAt,
            status: status
          });
        }
      }

      if (allResults.length === 0) {
        toast.error('No completed lab results found for this visit. Only completed results with actual data can be printed.');
        return;
      }

      const printWindow = window.open('', '_blank');
      const currentDate = new Date();
      const formatDate = (date) => {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      };
      const formatDateTime = (date) => {
        return date.toLocaleString('en-US');
      };

      // Get lab technician from first result's verifiedByUser
      const firstResult = allResults[0];
      const labTechnicianName = firstResult?.verifiedByUser?.fullname || firstResult?.verifiedByUser || currentUser?.fullname || 'Lab Technician';

      printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Lab Results - ${patient.name || 'Patient'}</title>
          <style>
            @media print {
              @page { 
                size: A4;
                margin: 10mm;
              }
              body { margin: 0; padding: 0; }
              .no-print { display: none; }
            }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 0; 
              padding: 10px;
              color: #333;
              line-height: 1.5;
            }
            .no-print {
              text-align: center;
              padding: 15px;
              background: #f8f9fa;
              margin-bottom: 15px;
              border-bottom: 1px solid #dee2e6;
            }
            .no-print button {
              background: #2563eb;
              color: white;
              border: none;
              padding: 10px 24px;
              border-radius: 5px;
              cursor: pointer;
              font-size: 16px;
              font-weight: 600;
            }
            .header { 
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding-bottom: 10px; 
              margin-bottom: 15px; 
              border-bottom: 3px solid #2563eb;
            }
            .header-left {
              display: flex;
              align-items: center;
              gap: 15px;
            }
            .logo {
              width: 70px;
              height: 70px;
              border-radius: 50%; object-fit: cover;
            }
            .clinic-info {
              text-align: left;
            }
            .clinic-name { 
              font-size: 26px; 
              font-weight: 800; 
              margin: 0;
              color: #1e40af;
              letter-spacing: -0.5px;
            }
            .clinic-tagline {
              font-size: 13px;
              color: #64748b;
              margin: 0;
              font-style: italic;
            }
            .header-right {
              text-align: right;
            }
            .report-title { 
              font-size: 22px; 
              font-weight: 700; 
              margin: 0;
              color: #0f172a;
              text-transform: uppercase;
            }
            .report-info {
              font-size: 13px;
              color: #64748b;
              margin-top: 2px;
            }
            .patient-section {
              margin: 15px 0;
              padding: 12px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
            }
            .section-header {
              font-size: 15px;
              font-weight: 700;
              margin-bottom: 10px;
              color: #1e293b;
              border-bottom: 1px solid #cbd5e1;
              padding-bottom: 5px;
            }
            .patient-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              font-size: 14px;
            }
            .info-item {
              display: flex;
              flex-direction: column;
            }
            .info-label {
              font-weight: 600;
              color: #64748b;
              font-size: 12px;
              text-transform: uppercase;
            }
            .info-value {
              color: #1e293b;
              font-weight: 500;
              font-size: 14px;
            }
            .results-section {
              margin: 15px 0;
            }
            .test-card {
              margin-bottom: 20px;
              page-break-inside: avoid;
            }
            .test-header {
              font-size: 17px;
              font-weight: 700;
              margin-bottom: 10px;
              padding: 8px 12px;
              background: #f1f5f9;
              border-left: 4px solid #2563eb;
              color: #1e293b;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 5px 0;
            }
            th {
              text-align: left;
              padding: 10px 12px;
              background: #f8fafc;
              color: #475569;
              font-size: 13px;
              font-weight: 600;
              text-transform: uppercase;
              border-bottom: 2px solid #e2e8f0;
            }
            td {
              padding: 10px 12px;
              border-bottom: 1px solid #f1f5f9;
              font-size: 14px;
              color: #334155;
            }
            .field-name {
              font-weight: 600;
              color: #1e293b;
              width: 40%;
            }
            .field-value {
              font-weight: 500;
            }
            .notes-box {
              margin-top: 10px;
              padding: 8px 12px;
              background: #fffbeb;
              border-left: 4px solid #f59e0b;
              font-size: 14px;
              color: #92400e;
            }
            .footer {
              margin-top: 30px;
              padding-top: 15px;
              border-top: 1px solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .signature-box {
              text-align: center;
              width: 180px;
            }
            .signature-line {
              border-top: 1px solid #334155;
              margin-top: 30px;
              padding-top: 5px;
              font-size: 13px;
              font-weight: 600;
              color: #475569;
            }
            .print-footer {
              text-align: center;
              font-size: 11px;
              color: #94a3b8;
              margin-top: 20px;
              padding-top: 10px;
              border-top: 1px solid #e2e8f0;
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()">Print Lab Results</button>
          </div>

          <div class="header">
            <div class="header-left">
              <img src="${window.__CS__?.logoUrl || '/clinic-logo.jpg'}" alt="Clinic Logo" class="logo" onerror="this.style.display='none'">
              <div class="clinic-info">
                <h1 class="clinic-name">${window.__CS__?.name || 'Clinic'}</h1>
                <p class="clinic-tagline">${window.__CS__?.tagline || 'Quality Healthcare You Can Trust'}</p>
              </div>
            </div>
            <div class="header-right">
              <h2 class="report-title">Laboratory Report</h2>
              <div class="report-info">
                Date: ${formatDate(currentDate)}<br>
                Time: ${currentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          <div class="patient-section">
            <div class="section-header">Patient Information</div>
            <div class="patient-grid">
              <div class="info-item">
                <span class="info-label">Patient Name</span>
                <span class="info-value">${patient.name || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Patient ID</span>
                <span class="info-value">${patient.id || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Age / Gender</span>
                <span class="info-value">${patient.age || 'N/A'} / ${patient.gender || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Visit ID</span>
                <span class="info-value">${selectedVisit.visitUid || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div class="results-section">
            ${allResults.map((result, idx) => `
              <div class="test-card">
                <div class="test-header">${result.testName}</div>
                <table>
                  <thead>
                    <tr>
                      <th>Test Name</th>
                      <th>Result</th>
                      <th>Unit</th>
                      <th>Reference Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${result.detailedResults.map((test, testIdx) => `
                      <tr>
                        <td class="field-name">${test.testName || 'N/A'}</td>
                        <td class="field-value">${test.result || 'N/A'}</td>
                        <td>${test.unit || '-'}</td>
                        <td>${test.referenceRange || 'N/A'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
                ${result.additionalNotes ? `
                  <div class="notes-box">
                    <strong>Additional Notes:</strong> ${result.additionalNotes}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>

          <div class="footer">
            <div class="signature-box">
              <div class="signature-line">Lab Technician</div>
              <div style="margin-top: 5px; font-size: 12px; color: #64748b;">${labTechnicianName}</div>
            </div>
            <div class="signature-box">
              <div class="signature-line">Verified By</div>
              ${allResults[0]?.verifiedBy ? `<div style="margin-top: 5px; font-size: 12px; color: #64748b;">${allResults[0].verifiedBy}</div>` : ''}
            </div>
            <div class="signature-box">
              <div class="signature-line">Authorized Signature</div>
            </div>
          </div>

          <div class="print-footer">
            This is a computer-generated report. ${window.__CS__?.name || 'Clinic'}. Generated on ${formatDateTime(currentDate)}
          </div>
        </body>
      </html>
      `);

      printWindow.document.close();

      setTimeout(() => {
        printWindow.print();
      }, 250);

      toast.success('Opening print preview...');
    } catch (error) {
      console.error('Error printing lab results:', error);
      toast.error('Failed to print lab results');
    }
  };

  // Print radiology results from patient history
  const handlePrintRadiologyResults = async () => {
    if (!selectedVisit || !patientHistory || !selectedVisit.radiologyResults || selectedVisit.radiologyResults.length === 0) {
      toast.error('No radiology results to print');
      return;
    }

    try {
      const patient = patientHistory.patient;
      const radiologyResults = selectedVisit.radiologyResults || [];

      if (radiologyResults.length === 0) {
        toast.error('No radiology results found for this order. Please complete the tests first.');
        return;
      }

      const printWindow = window.open('', '_blank');
      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const currentTime = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });

      // Get radiologist from first result's radiologistUser
      const firstResult = radiologyResults[0];
      const radiologistName = firstResult?.radiologistUser?.fullname || firstResult?.radiologistUser || 'Radiologist';

      const receiptContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Radiology Results Report</title>
        <style>
          @media print {
            @page { 
              size: A4;
              margin: 10mm;
            }
            body { margin: 0; padding: 0; }
            .no-print { display: none; }
          }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 10px;
            color: #333;
            line-height: 1.6;
            background: white;
          }
          .no-print {
            text-align: center;
            padding: 15px;
            background: #f8f9fa;
            margin-bottom: 15px;
            border-bottom: 1px solid #dee2e6;
          }
          .no-print button {
            background: #2563eb;
            color: white;
            border: none;
            padding: 10px 24px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
          }
          .header { 
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 10px; 
            margin-bottom: 15px; 
            border-bottom: 3px solid #2563eb;
          }
          .header-left {
            display: flex;
            align-items: center;
            gap: 15px;
          }
          .logo {
            width: 70px;
            height: 70px;
            border-radius: 50%; object-fit: cover;
          }
          .clinic-info {
            text-align: left;
          }
          .clinic-name { 
            font-size: 26px; 
            font-weight: 800; 
            margin: 0;
            color: #1e40af;
            letter-spacing: -0.5px;
          }
          .clinic-tagline {
            font-size: 13px;
            color: #64748b;
            margin: 0;
            font-style: italic;
          }
          .header-right {
            text-align: right;
          }
          .report-title { 
            font-size: 22px; 
            font-weight: 700; 
            margin: 0;
            color: #0f172a;
            text-transform: uppercase;
          }
          .report-info {
            font-size: 13px;
            color: #64748b;
            margin-top: 2px;
          }
          .patient-section {
            margin: 15px 0;
            padding: 12px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
          }
          .section-header {
            font-size: 15px;
            font-weight: 700;
            margin-bottom: 10px;
            color: #1e293b;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 5px;
          }
          .patient-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            font-size: 14px;
          }
          .info-item {
            display: flex;
            flex-direction: column;
          }
          .info-label {
            font-weight: 600;
            color: #64748b;
            font-size: 12px;
            text-transform: uppercase;
          }
          .info-value {
            color: #1e293b;
            font-weight: 500;
            font-size: 14px;
          }
          .results-section {
            margin: 15px 0;
          }
          .test-result {
            margin-bottom: 20px;
            page-break-inside: avoid;
          }
          .test-title {
            font-size: 17px;
            font-weight: 700;
            margin-bottom: 10px;
            padding: 8px 12px;
            background: #f1f5f9;
            border-left: 4px solid #2563eb;
            color: #1e293b;
          }
          .findings-section, .conclusion-section {
            margin: 10px 0;
          }
          .section-label {
            font-size: 15px;
            font-weight: 700;
            margin-bottom: 5px;
            color: #1e293b;
          }
          .section-content {
            font-size: 14px;
            line-height: 1.6;
            color: #334155;
            white-space: pre-wrap;
            padding: 8px 12px;
            background: #fff;
            border-left: 3px solid #e2e8f0;
            margin-left: 5px;
          }
          .signature-section {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .signature-box {
            text-align: center;
            width: 180px;
          }
          .signature-line {
            border-top: 1px solid #334155;
            margin-top: 30px;
            padding-top: 5px;
            font-size: 13px;
            font-weight: 600;
            color: #475569;
          }
          .stamp-area {
            width: 100px;
            height: 100px;
            border: 2px dashed #cbd5e1;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            color: #94a3b8;
            margin: 0 auto;
          }
          .print-footer {
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
          }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button onclick="window.print()">Print Radiology Results</button>
        </div>

        <div class="header">
          <div class="header-left">
            <img src="${window.__CS__?.logoUrl || '/clinic-logo.jpg'}" alt="Clinic Logo" class="logo" onerror="this.style.display='none'">
            <div class="clinic-info">
              <h1 class="clinic-name">${window.__CS__?.name || 'Clinic'}</h1>
              <p class="clinic-tagline">${window.__CS__?.tagline || 'Quality Healthcare You Can Trust'}</p>
            </div>
          </div>
          <div class="header-right">
            <h2 class="report-title">Radiology Report</h2>
            <div class="report-info">
              Date: ${currentDate}<br>
              Time: ${currentTime}
            </div>
          </div>
        </div>

        <div class="patient-section">
          <div class="section-header">Patient Information</div>
          <div class="patient-grid">
            <div class="info-item">
              <span class="info-label">Patient Name</span>
              <span class="info-value">${patient.name || 'N/A'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Patient ID</span>
              <span class="info-value">${patient.id || 'N/A'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Age / Gender</span>
              <span class="info-value">${patient.age || 'N/A'} / ${patient.gender || 'N/A'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Visit ID</span>
              <span class="info-value">${selectedVisit.visitUid || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div class="results-section">
          ${radiologyResults.map(result => `
            <div class="test-result">
              <div class="test-title">${result.serviceName || result.testType?.name || 'Radiology Test'}</div>
              
              ${result.findings ? `
                <div class="findings-section">
                  <div class="section-label">Findings:</div>
                  <div class="section-content">${result.findings}</div>
                </div>
              ` : ''}
              
              ${result.conclusion ? `
                <div class="conclusion-section">
                  <div class="section-label">Conclusion:</div>
                  <div class="section-content">${result.conclusion}</div>
                </div>
              ` : ''}
              
              ${result.additionalNotes ? `
                <div class="findings-section">
                  <div class="section-label">Additional Notes:</div>
                  <div class="section-content">${result.additionalNotes}</div>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <div class="signature-section">
          <div class="signature-box">
            <div class="signature-line">Radiologist Signature</div>
            <div style="font-size: 13px; margin-top: 3px; font-weight: 600;">${radiologistName}</div>
          </div>
          <div class="stamp-area">Clinic Stamp</div>
          <div class="signature-box">
            <div class="signature-line">Authorized Signature</div>
          </div>
        </div>

        <div class="print-footer">
          This is a computer-generated report. ${window.__CS__?.name || 'Clinic'}. Generated on ${currentDate} ${currentTime}
        </div>
      </body>
    </html>
    `;

      printWindow.document.write(receiptContent);
      printWindow.document.close();

      setTimeout(() => {
        printWindow.print();
      }, 250);

      toast.success('Opening print preview...');
    } catch (error) {
      console.error('Error printing radiology results:', error);
      toast.error('Failed to print radiology results');
    }
  };

  const generatePrintHTML = (visit, history) => {
    const patient = history.patient;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Patient History - ${visit.visitUid}</title>
          <style>
            @page {
              margin: 0.5in;
              size: A4;
            }
            body {
              font-family: Arial, sans-serif;
              font-size: 11px;
              line-height: 1.4;
              color: #000;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
              margin-bottom: 15px;
            }
            .clinic-name {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .section {
              margin-bottom: 15px;
              page-break-inside: avoid;
            }
            .section-title {
              font-size: 14px;
              font-weight: bold;
              border-bottom: 1px solid #ccc;
              padding-bottom: 5px;
              margin-bottom: 10px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
              margin-bottom: 10px;
            }
            .info-item {
              margin-bottom: 5px;
            }
            .label {
              font-weight: bold;
              display: inline-block;
              min-width: 120px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 10px;
            }
            th, td {
              border: 1px solid #ccc;
              padding: 6px;
              text-align: left;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            .text-content {
              margin-top: 5px;
              padding: 8px;
              background-color: #f9f9f9;
              border-left: 3px solid #2e13d1;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="clinic-name">${window.__CS__?.name || 'Clinic'}</div>
            <div>Patient Medical History Report</div>
          </div>

          <div class="section">
            <div class="section-title">Patient Information</div>
            <div class="info-grid">
              <div class="info-item"><span class="label">Name:</span> ${patient.name}</div>
              <div class="info-item"><span class="label">Patient ID:</span> ${patient.id}</div>
              <div class="info-item"><span class="label">Age/Gender:</span> ${patient.age || 'N/A'} / ${patient.gender || 'N/A'}</div>
              <div class="info-item"><span class="label">Blood Type:</span> ${patient.bloodType || 'N/A'}</div>
              <div class="info-item"><span class="label">Phone:</span> ${patient.phone || 'N/A'}</div>
              <div class="info-item"><span class="label">Visit ID:</span> ${visit.visitUid}</div>
              <div class="info-item"><span class="label">Visit Date:</span> ${formatDateOnly(visit.date)}</div>
              <div class="info-item"><span class="label">Status:</span> ${visit.status.replace(/_/g, ' ')}</div>
            </div>
          </div>

          ${visit.vitals && visit.vitals.length > 0 ? `
          <div class="section">
            <div class="section-title">Vital Signs</div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>BP</th>
                  <th>Temp</th>
                  <th>HR</th>
                  <th>O2 Sat</th>
                  <th>BMI</th>
                </tr>
              </thead>
              <tbody>
                ${visit.vitals.map(v => `
                  <tr>
                    <td>${formatDateOnly(v.createdAt)}</td>
                    <td>${v.bloodPressure || 'N/A'}</td>
                    <td>${v.temperature ? v.temperature + '°C' : 'N/A'}</td>
                    <td>${v.heartRate ? v.heartRate + ' bpm' : 'N/A'}</td>
                    <td>${v.oxygenSaturation ? v.oxygenSaturation + '%' : 'N/A'}</td>
                    <td>${v.bmi || 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${visit.vitals[0].chiefComplaint ? `<div class="text-content"><strong>Chief Complaint:</strong> ${visit.vitals[0].chiefComplaint}</div>` : ''}
            ${visit.vitals[0].physicalExamination ? `<div class="text-content"><strong>Physical Examination:</strong> ${visit.vitals[0].physicalExamination}</div>` : ''}
            ${visit.vitals[0].notes ? `<div class="text-content"><strong>Notes:</strong> ${visit.vitals[0].notes}</div>` : ''}
          </div>
          ` : ''}

          ${visit.diagnosisNotes && visit.diagnosisNotes.length > 0 ? `
          <div class="section">
            <div class="section-title">Diagnosis & Notes</div>
            ${visit.diagnosisNotes.map(note => `
              <div style="margin-bottom: 15px; padding: 10px; border: 1px solid #ccc;">
                <div style="font-weight: bold; margin-bottom: 8px;">Dr. ${note.doctor?.fullname || 'Unknown'} - ${formatDate(note.createdAt)}</div>
                ${note.chiefComplaint ? `<div class="text-content"><strong>Chief Complaint:</strong> ${note.chiefComplaint}</div>` : ''}
                ${note.historyOfPresentIllness ? `<div class="text-content"><strong>History of Present Illness:</strong> ${note.historyOfPresentIllness}</div>` : ''}
                ${note.pastMedicalHistory ? `<div class="text-content"><strong>Past Medical History:</strong> ${note.pastMedicalHistory}</div>` : ''}
                ${note.allergicHistory ? `<div class="text-content"><strong>Allergic History:</strong> ${note.allergicHistory}</div>` : ''}
                ${note.physicalExamination ? `<div class="text-content"><strong>Physical Examination:</strong> ${note.physicalExamination}</div>` : ''}
                ${note.investigationFindings ? `<div class="text-content"><strong>Investigation Findings:</strong> ${note.investigationFindings}</div>` : ''}
                ${note.assessmentAndDiagnosis ? `<div class="text-content"><strong>Assessment & Diagnosis:</strong> ${note.assessmentAndDiagnosis}</div>` : ''}
                ${note.treatmentPlan ? `<div class="text-content"><strong>Treatment Plan:</strong> ${note.treatmentPlan}</div>` : ''}
                ${note.treatmentGiven ? `<div class="text-content"><strong>Treatment Given:</strong> ${note.treatmentGiven}</div>` : ''}
                ${note.medicationIssued ? `<div class="text-content"><strong>Medication Issued:</strong> ${note.medicationIssued}</div>` : ''}
                ${note.prognosis ? `<div class="text-content"><strong>Prognosis:</strong> ${note.prognosis}</div>` : ''}
                ${note.additional ? `<div class="text-content"><strong>Additional Notes:</strong> ${note.additional}</div>` : ''}
              </div>
            `).join('')}
          </div>
          ` : ''}

          ${visit.diagnosis ? `
          <div class="section">
            <div class="section-title">Final Diagnosis</div>
            <div class="text-content">
              <strong>Diagnosis:</strong> ${visit.diagnosis}
              ${visit.diagnosisDetails ? `<br><br><strong>Details:</strong> ${visit.diagnosisDetails}` : ''}
            </div>
          </div>
          ` : ''}

          ${visit.instructions ? `
          <div class="section">
            <div class="section-title">Patient Instructions</div>
            <div class="text-content">${visit.instructions}</div>
          </div>
          ` : ''}

          ${visit.labResults && visit.labResults.length > 0 ? `
          <div class="section">
            <div class="section-title">Lab Results</div>
            ${visit.labResults.map(result => `
              <div style="margin-bottom: 10px; padding: 8px; border: 1px solid #ccc;">
                <strong>${result.testType?.name || 'Lab Test'}</strong> - ${result.status}
                ${result.detailedResults && result.detailedResults.length > 0 ? `
                  <table style="margin-top: 8px;">
                    <thead>
                      <tr>
                        <th>Test Name</th>
                        <th>Result</th>
                        <th>Unit</th>
                        <th>Reference Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${result.detailedResults.map(test => `
                        <tr>
                          <td>${test.testName || 'N/A'}</td>
                          <td>${test.result || 'N/A'}</td>
                          <td>${test.unit || '-'}</td>
                          <td>${test.referenceRange || 'N/A'}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                ` : result.resultText ? `<div class="text-content">${result.resultText}</div>` : ''}
                ${result.additionalNotes ? `<div class="text-content"><strong>Notes:</strong> ${result.additionalNotes}</div>` : ''}
              </div>
            `).join('')}
          </div>
          ` : ''}

          ${visit.radiologyResults && visit.radiologyResults.length > 0 ? `
          <div class="section">
            <div class="section-title">Radiology Results</div>
            ${visit.radiologyResults.map(result => `
              <div style="margin-bottom: 10px; padding: 8px; border: 1px solid #ccc;">
                <strong>${result.serviceName || result.testType?.name || 'Radiology Test'}</strong> - ${result.status}
                ${result.resultText ? `<div class="text-content">${result.resultText}</div>` : ''}
                ${result.additionalNotes ? `<div class="text-content"><strong>Notes:</strong> ${result.additionalNotes}</div>` : ''}
              </div>
            `).join('')}
          </div>
          ` : ''}

          ${visit.medications && visit.medications.length > 0 ? `
          <div class="section">
            <div class="section-title">Medications</div>
            <table>
              <thead>
                <tr>
                  <th>Medication</th>
                  <th>Dosage</th>
                  <th>Frequency</th>
                  <th>Duration</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                ${visit.medications.map(med => `
                  <tr>
                    <td>${med.medication?.name || med.name || 'N/A'}</td>
                    <td>${med.dosage || 'N/A'}</td>
                    <td>${med.frequency || 'N/A'}</td>
                    <td>${med.duration || 'N/A'}</td>
                    <td>${med.quantity || 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${visit.nurseServices && visit.nurseServices.length > 0 ? `
          <div class="section">
            <div class="section-title">Nurse Services</div>
            <table>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Code</th>
                  <th>Performed By</th>
                  <th>Price</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                ${visit.nurseServices.map(service => `
                  <tr>
                    <td>${service.serviceName || 'N/A'}</td>
                    <td>${service.serviceCode || 'N/A'}</td>
                    <td>${service.assignedNurse || 'N/A'}</td>
                    <td>ETB ${service.servicePrice?.toFixed(2) || '0.00'}</td>
                    <td>${formatDateOnly(service.completedAt)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${visit.dentalServices && visit.dentalServices.length > 0 ? `
          <div class="section">
            <div class="section-title">Dental Services</div>
            <table>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Code</th>
                  <th>Performed By</th>
                  <th>Price</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                ${visit.dentalServices.map(service => `
                  <tr>
                    <td>${service.serviceName || 'N/A'}</td>
                    <td>${service.serviceCode || 'N/A'}</td>
                    <td>${service.doctor ? 'Dr. ' + service.doctor : 'N/A'}</td>
                    <td>ETB ${service.servicePrice?.toFixed(2) || '0.00'}</td>
                    <td>${formatDateOnly(service.completedAt)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          <div style="margin-top: 30px; padding-top: 15px; border-top: 2px solid #000;">
            <div style="margin-bottom: 20px;">
              <div style="border-top: 1px solid #000; width: 200px; margin-bottom: 5px;"></div>
              <div style="font-size: 11px; margin-bottom: 5px;">Signature: _________________________</div>
              <div style="font-size: 11px;">Date: _________________________</div>
            </div>
            <div style="text-align: center; font-size: 10px; color: #666; margin-top: 20px;">
              <div>${window.__CS__?.name || 'Clinic'}</div>
              <div>Generated on: ${formatDate(new Date())}</div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FFFFFF' }}>

      {/* Patient List */}
      {!selectedPatient && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border" style={{ borderColor: '#E5E7EB' }}>
            <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: '#E5E7EB' }}>
              <h2 className="text-2xl font-bold" style={{ color: '#0C0E0B' }}>
                Patient History
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchPatients(1)}
                  placeholder="Search by name, ID, or phone..."
                  className="px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 w-64"
                  style={{ borderColor: '#E5E7EB' }}
                />
                <button
                  onClick={() => fetchPatients(1)}
                  disabled={loading}
                  className="px-4 py-2 text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50 transition"
                  style={{ backgroundColor: '#2e13d1' }}
                >
                  <Search className="h-4 w-4 inline mr-1" />
                  {loading ? '...' : 'Search'}
                </button>
              </div>
            </div>

            {/* Patients Table */}
            {patients.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#6B7280' }}>Name</th>
                      <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#6B7280' }}>MRN</th>
                      <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#6B7280' }}>Gender</th>
                      <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#6B7280' }}>Age</th>
                      <th className="text-left px-6 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#6B7280' }}>Mobile</th>
                      <th className="text-right px-6 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: '#6B7280' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#E5E7EB' }}>
                    {patients.map((patient) => {
                      const patientAge = patient?.dob ? calculateAge(patient.dob) : (patient?.age || 'N/A');
                      return (
                        <tr
                          key={patient.id}
                          onClick={() => handlePatientSelect(patient)}
                          className="hover:bg-blue-50 cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EEF2FF' }}>
                                <User className="h-4 w-4" style={{ color: '#2e13d1' }} />
                              </div>
                              <span className="font-medium" style={{ color: '#0C0E0B' }}>{patient.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs" style={{ color: '#6B7280' }}>{patient.id}</td>
                          <td className="px-6 py-4" style={{ color: '#0C0E0B' }}>{patient.gender || 'N/A'}</td>
                          <td className="px-6 py-4" style={{ color: '#0C0E0B' }}>{patientAge}</td>
                          <td className="px-6 py-4" style={{ color: '#0C0E0B' }}>{patient.mobile || patient.phone || 'N/A'}</td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); handlePatientSelect(patient); }}
                              className="px-3 py-1.5 text-white rounded-lg text-xs font-medium hover:opacity-90 transition"
                              style={{ backgroundColor: '#2e13d1' }}
                            >
                              View History
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center">
                <User className="h-12 w-12 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
                <p className="text-lg font-medium" style={{ color: '#6B7280' }}>No patients found</p>
                <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>Try adjusting your search or check back later.</p>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                <p className="text-sm" style={{ color: '#6B7280' }}>
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchPatients(page - 1)}
                    disabled={page <= 1 || loading}
                    className="px-3 py-1.5 border rounded text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ borderColor: '#E5E7EB', color: '#0C0E0B' }}
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => fetchPatients(page + 1)}
                    disabled={page >= totalPages || loading}
                    className="px-3 py-1.5 border rounded text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ borderColor: '#E5E7EB', color: '#0C0E0B' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}      {/* Patient Selected View */}
      {selectedPatient && (patientSummary || patientHistory) && (
        <>
          {/* Header with Back Button */}
          <div className="border-b" style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <button
                onClick={clearPatientSelection}
                className="flex items-center space-x-2 text-sm hover:opacity-70 transition"
                style={{ color: '#6B7280' }}
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Search</span>
              </button>
            </div>
          </div>

          {/* Patient Info Banner */}
          <div className="border-b" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center space-x-6">
                <div className="flex items-center justify-center w-16 h-16 rounded-full" style={{ backgroundColor: '#2e13d1' }}>
                  <User className="h-8 w-8" style={{ color: '#FFFFFF' }} />
                </div>
                <div className="flex-1 grid grid-cols-6 gap-4">
                  <div>
                    <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Patient Name</p>
                    <p className="text-sm font-semibold" style={{ color: '#0C0E0B' }}>{(patientSummary?.patient || patientHistory?.patient)?.name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Age / Gender</p>
                    <p className="text-sm font-semibold" style={{ color: '#0C0E0B' }}>
                      {((patientSummary?.patient || patientHistory?.patient)?.age && (patientSummary?.patient || patientHistory?.patient)?.age !== 0 ? (patientSummary?.patient || patientHistory?.patient)?.age : ((patientSummary?.patient || patientHistory?.patient)?.dob ? calculateAge((patientSummary?.patient || patientHistory?.patient)?.dob) : 'N/A'))} / {(patientSummary?.patient || patientHistory?.patient)?.gender || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Blood Type</p>
                    <p className="text-sm font-semibold" style={{ color: '#0C0E0B' }}>{(patientSummary?.patient || patientHistory?.patient)?.bloodType || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: '#6B7280' }}>Mobile</p>
                    <p className="text-sm font-semibold" style={{ color: '#0C0E0B' }}>{(patientSummary?.patient || patientHistory?.patient)?.phone || (patientSummary?.patient || patientHistory?.patient)?.mobile || 'N/A'}</p>
                  </div>

                </div>
              </div>
            </div>
          </div>

          {/* Visit Cards */}
          <div className="border-b" style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
              <p className="text-xs font-medium mb-2" style={{ color: '#6B7280' }}>SELECT VISIT</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(patientSummary?.visits || patientHistory?.visits)?.map((visitItem) => (
                  <div
                    key={visitItem.id}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${selectedHistoryVisitId === visitItem.id ? 'border-indigo-500 bg-indigo-50 shadow-md' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
                    onClick={() => {
                      setSelectedHistoryVisitId(visitItem.id);
                      setSelectedVisitId(visitItem.id);
                      setVisitDetailTab("summary");
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <p className="font-bold text-lg" style={{ color: '#0C0E0B' }}>{visitItem.visitUid}</p>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${visitItem.status === 'COMPLETED' ? 'bg-green-100 text-green-700 border border-green-200' : visitItem.status === 'CANCELLED' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-yellow-100 text-yellow-700 border border-yellow-200'}`}>
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
                        {visitItem.createdBy && (
                          <p className="text-xs mt-2" style={{ color: '#6B7280' }}>
                            👨‍⚕️ Dr. {visitItem.createdBy.fullname}
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
            </div>
          </div>


          {/* Sub-tab Navigation */}
          {selectedVisit && (() => {
            const sv = getSelectedVisit();
            if (!sv) return null;
            return (
              <div className="border-b pb-4" style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {[
                      { id: 'summary', label: 'Summary' },
                      { id: 'vitals', label: 'Vitals', count: sv.vitals?.length },
                      { id: 'notes', label: 'Diagnosis Notes' },
                      { id: 'labs', label: 'Lab Orders', count: (sv.labOrders?.length || 0) + (sv.labTestOrders?.length || 0) },
                      { id: 'radiology', label: 'Radiology', count: (sv.radiologyOrders?.length || 0) + (sv.batchOrders?.filter(bo => bo.type === 'RADIOLOGY').reduce((a, b) => a + (b.services?.length || 0), 0) || 0) },
                      { id: 'medications', label: 'Medications', count: sv.medicationOrders?.length },
                      { id: 'compoundRx', label: 'Compound Rx', count: sv.compoundPrescriptions?.length },
                      { id: 'procedures', label: 'Procedures', count: sv.procedures?.length },
                      { id: 'images', label: 'Images', count: sv.files?.length || sv.attachedImages?.length },
                      { id: 'other', label: 'Other Services' },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setVisitDetailTab(tab.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${visitDetailTab === tab.id ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'}`}
                      >
                        {tab.label}{tab.count !== undefined ? ` (${tab.count})` : ''}
                      </button>
                    ))}
                  </div>

                  {/* Tab Content */}
                  <div className="bg-white border rounded-lg p-6">
                    {/* Summary Tab */}
                    {visitDetailTab === 'summary' && (
                      <div className="space-y-6">
                        {/* Header */}
                        <div className="flex items-center gap-2 pb-3 border-b flex-wrap">
                          <FileText className="h-5 w-5 text-indigo-600" />
                          <h4 className="text-lg font-bold">Visit #{sv.visitUid}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${sv.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {sv.status?.replace(/_/g, ' ')}
                          </span>
                          {sv.cardProduct && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                              💳 {sv.cardProduct.name}
                            </span>
                          )}
                          <span className="text-xs text-gray-500 ml-auto">
                            {new Date(sv.date || sv.createdAt).toLocaleString()}
                          </span>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-3 bg-green-50 rounded-lg">
                            <p className="text-xs text-green-700">Diagnoses</p>
                            <p className="text-2xl font-bold text-green-800">{sv.diagnoses?.length || 0}</p>
                          </div>
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <p className="text-xs text-blue-700">Lab Orders</p>
                            <p className="text-2xl font-bold text-blue-800">{(sv.labOrders?.length || 0) + (sv.labTestOrders?.length || 0) + (sv.batchOrders?.filter(bo => bo.type === 'LAB').reduce((a, b) => a + (b.services?.length || 0), 0) || 0)}</p>
                          </div>
                          <div className="p-3 bg-amber-50 rounded-lg">
                            <p className="text-xs text-amber-700">Radiology</p>
                            <p className="text-2xl font-bold text-amber-800">{(sv.radiologyOrders?.length || 0) + (sv.batchOrders?.filter(bo => bo.type === 'RADIOLOGY').reduce((a, b) => a + (b.services?.length || 0), 0) || 0)}</p>
                          </div>
                          <div className="p-3 bg-purple-50 rounded-lg">
                            <p className="text-xs text-purple-700">Medications</p>
                            <p className="text-2xl font-bold text-purple-800">{sv.medicationOrders?.length || 0}</p>
                          </div>
                        </div>

                        {/* Diagnosis Notes Section */}
                        {sv.diagnosisNotes && sv.diagnosisNotes.length > 0 && (
                          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                            <h5 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">📋 Diagnosis Notes</h5>
                            <div className="space-y-2">
                              {sv.diagnosisNotes.map((note, i) => (
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
                        {sv.patientDiagnoses && sv.patientDiagnoses.length > 0 && (
                          <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
                            <h5 className="font-semibold text-red-900 mb-3 flex items-center gap-2">🦠 Confirmed Diagnoses</h5>
                            <div className="flex flex-wrap gap-2">
                              {sv.patientDiagnoses.map((diag, i) => (
                                <span key={i} className="px-3 py-1.5 bg-white text-red-700 border border-red-200 rounded text-xs font-semibold">
                                  {diag.disease?.name} ({diag.type})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Vitals Section */}
                        {sv.vitals && sv.vitals.length > 0 && (
                          <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                            <h5 className="font-semibold text-red-900 mb-3 flex items-center gap-2">❤️ Vital Signs</h5>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {sv.vitals.map((vital, i) => (
                                <div key={i} className="p-3 bg-white rounded-lg border border-red-100 text-sm">
                                  <p className="text-xs text-red-500 mb-1">{new Date(vital.createdAt).toLocaleString()}</p>
                                  <div className="grid grid-cols-2 gap-1 text-xs">
                                    <span>BP: {vital.bloodPressure || 'N/A'}</span>
                                    <span>HR: {vital.heartRate || 'N/A'}</span>
                                    <span>Temp: {vital.temperature ? vital.temperature + '°C' : 'N/A'}</span>
                                    <span>Weight: {vital.weight ? vital.weight + 'kg' : 'N/A'}</span>
                                    {vital.oxygenSaturation && <span>O₂: {vital.oxygenSaturation}%</span>}
                                  </div>
                                  <p className="text-xs text-red-400 mt-2">Recorded by: {vital.recordedBy?.fullname || vital.recordedByRole || 'N/A'}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Lab Results Section */}
                        {(() => {
                          if (!sv.labTestOrders || sv.labTestOrders.length === 0) return null;
                          const completedOrders = sv.labTestOrders.filter(o => o.results && o.results.length > 0);
                          if (completedOrders.length === 0) return null;
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
                          return (
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                              <h5 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">🧪 Lab Results</h5>
                              <div className="space-y-4">
                                {panelEntries.map(pg => {
                                  const seenFields = new Set();
                                  const combinedFields = [];
                                  const panelImages = [];
                                  const seenUrls = new Set();
                                  pg.allResults.forEach(({ order, result }) => {
                                    const fields = order.labTest?.resultFields || [];
                                    if (fields.length > 0) {
                                      fields.forEach(field => {
                                        const key = field.fieldName || field.id;
                                        if (!seenFields.has(key)) {
                                          seenFields.add(key);
                                          const value = getResultValue(result.results, field);
                                          combinedFields.push({ field, value, result });
                                        }
                                      });
                                    } else if (result.results && typeof result.results === 'object' && !Array.isArray(result.results)) {
                                      const testName = order.labTest?.name || 'Unknown';
                                      if (!seenFields.has(testName)) {
                                        seenFields.add(testName);
                                        const entries = Object.entries(result.results).filter(([k]) => k !== '_images');
                                        const displayVal = entries.length > 0 ? (typeof entries[0][1] === 'object' ? JSON.stringify(entries[0][1]) : String(entries[0][1])) : '';
                                        if (displayVal) {
                                          combinedFields.push({
                                            field: { id: testName, label: testName, fieldName: testName, unit: '', referenceRange: '' },
                                            value: displayVal,
                                            result
                                          });
                                        }
                                      }
                                    }
                                    if (result.results?._images) {
                                      (Array.isArray(result.results._images) ? result.results._images : [result.results._images]).forEach(img => {
                                        const u = img.data || img.url || img;
                                        if (u && !seenUrls.has(String(u))) { seenUrls.add(String(u)); panelImages.push(img); }
                                      });
                                    }
                                  });
                                  return (
                                    <div key={'pg-'+pg.group.id} className="border border-indigo-200 rounded-lg bg-indigo-50 overflow-hidden">
                                      <div className="px-4 py-3 bg-indigo-100 border-b border-indigo-200">
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <p className="font-semibold text-indigo-800">{pg.group.name} Panel</p>
                                            <p className="text-xs text-indigo-600">{pg.orders.length} tests{pg.latestDate ? ' • '+new Date(pg.latestDate).toLocaleDateString() : ''}</p>
                                          </div>
                                          <span className="px-2 py-1 text-xs font-semibold text-indigo-800 bg-indigo-200 rounded-full">COMPLETED</span>
                                        </div>
                                      </div>
                                      {combinedFields.filter(f => f.value !== undefined).length > 0 && (
                                        <div className="p-4">
                                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {combinedFields.map(({ field, value }) => {
                                              if (value === undefined) return null;
                                              const rc = field.normalRange ? checkValueInNormalRange(value, field.normalRange) : { inRange: true };
                                              return (
                                                <div key={field.id} className={'p-3 rounded-lg text-sm border ' + (!rc.inRange ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200')}>
                                                  <div className="font-semibold text-gray-800 text-xs">{field.label}</div>
                                                  <div className={'text-base font-bold mt-0.5 ' + (!rc.inRange ? 'text-red-600' : 'text-gray-900')}>
                                                    {value} {field.unit || ''}
                                                  </div>
                                                  {!rc.inRange && rc.message && <div className="text-xs text-red-500 mt-0.5">{rc.message}</div>}
                                                  {field.referenceRange && <div className="text-xs text-gray-400 mt-0.5">Ref: {field.referenceRange}</div>}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                      {pg.additionalNotes && (
                                        <div className="px-4 pb-2">
                                          <p className="text-xs font-medium text-gray-500">Note: {pg.additionalNotes}</p>
                                        </div>
                                      )}
                                      {panelImages.length > 0 && (
                                        <div className="px-4 pb-4">
                                          <p className="text-xs font-medium text-indigo-700 mb-2">Attached Images ({panelImages.length})</p>
                                          <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                                            {panelImages.map((img, idx) => {
                                              const url = getImageUrl(img.url || img.data || img);
                                              return (
                                                <div key={idx} onClick={() => openImageViewer(panelImages.map(u => ({ fileUrl: u.url || u.fileUrl || u.filePath || (typeof u === 'string' ? u : ''), fileName: u.name || u.fileName || 'Lab Image' })), idx)} className="relative group cursor-pointer rounded-lg overflow-hidden border border-indigo-200 hover:border-indigo-400 transition-all">
                                                  <img src={url} alt="Lab" className="w-full h-16 object-cover" />
                                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                                    <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 bg-black/50 px-2 py-1 rounded">View</span>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {standaloneOrders.map(order => {
                                  const r = order.results?.[0];
                                  if (!r) return null;
                                  const orderImages = [];
                                  if (r.results?._images) {
                                    (Array.isArray(r.results._images) ? r.results._images : [r.results._images]).forEach(img => {
                                      const u = img.data || img.url || img;
                                      if (u && !orderImages.some(x => String(x.data || x.url || x) === String(u))) orderImages.push(img);
                                    });
                                  }
                                  const fieldVals = (order.labTest?.resultFields || []).map(f => ({ field: f, value: getResultValue(r.results, f) })).filter(fv => fv.value !== undefined);
                                  return (
                                    <div key={order.id || standaloneOrders.indexOf(order)} className="p-3 bg-white rounded-lg border border-blue-100">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <p className="font-semibold text-blue-900 text-sm">{order.labTest?.name || 'Lab Test'}</p>
                                          <p className="text-xs text-gray-500 mt-0.5">{new Date(order.createdAt || r.createdAt).toLocaleString()}</p>
                                        </div>
                                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{order.status || 'COMPLETED'}</span>
                                      </div>
                                      {fieldVals.length > 0 && (
                                        <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                                          {fieldVals.map(({ field, value }) => {
                                            const rc = field.normalRange ? checkValueInNormalRange(value, field.normalRange) : { inRange: true };
                                            return (
                                              <div key={field.id} className={'p-2 rounded text-xs border ' + (!rc.inRange ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200')}>
                                                <span className="font-medium text-gray-700">{field.label}: </span>
                                                <span className={'font-bold ' + (!rc.inRange ? 'text-red-600' : 'text-gray-900')}>{value} {field.unit || ''}</span>
                                                {!rc.inRange && rc.message && <span className="text-red-500 ml-1">({rc.message})</span>}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                      {r.additionalNotes && <p className="text-xs text-gray-500 mt-1">Note: {r.additionalNotes}</p>}
                                      {r.verifiedBy && <p className="text-xs text-blue-600 mt-1">Verified</p>}
                                      {orderImages.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                          <p className="text-xs font-medium text-gray-500 mb-1">Attached Images:</p>
                                          <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                                            {orderImages.map((img, idx) => {
                                              const url = getImageUrl(img.url || img.data || img);
                                              return (
                                                <div key={idx} onClick={() => openImageViewer(orderImages.map(u => ({ fileUrl: u.url || u.fileUrl || u.filePath || (typeof u === 'string' ? u : ''), fileName: u.name || u.fileName || 'Lab Image' })), idx)} className="relative group cursor-pointer rounded-lg overflow-hidden border border-blue-200 hover:border-blue-400 transition-all">
                                                  <img src={url} alt="Lab" className="w-full h-12 object-cover" />
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}                        {/* Radiology Section */}
                        {sv.batchOrders && sv.batchOrders.filter(bo => bo.type === 'RADIOLOGY').length > 0 && (
                          <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                            <h5 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">🩻 Radiology Results</h5>
                            <div className="space-y-3">
                              {sv.batchOrders.filter(bo => bo.type === 'RADIOLOGY').map((bo, i) => (
                                <div key={i}>
                                  {bo.radiologyResults?.map((result, j) => (
                                    <div key={j} className="p-3 bg-white rounded-lg border border-purple-100 mb-2">
                                      <div className="flex justify-between items-start">
                                        <p className="font-semibold text-purple-900 text-sm">{result.testType?.name || 'Radiology'}</p>
                                        <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">COMPLETED</span>
                                      </div>
                                      {(result.clinicalIndication || result.technique || result.findings || result.conclusion) && (
                                        <div className="mt-2 space-y-1.5 text-sm">
                                          {result.clinicalIndication && <p><span className="font-medium text-purple-700">Indication:</span> {result.clinicalIndication}</p>}
                                          {result.technique && <p><span className="font-medium text-purple-700">Technique:</span> {result.technique}</p>}
                                          {(result.finding || result.resultText || result.findings) && <p className="whitespace-pre-wrap"><span className="font-medium text-purple-700">Findings:</span> {result.finding || result.resultText || result.findings}</p>}
                                          {result.conclusion && <p className="whitespace-pre-wrap"><span className="font-medium text-purple-700">Conclusion:</span> {result.conclusion}</p>}
                                        </div>
                                      )}
                                      {result.attachments?.length > 0 && (
                                        <div className="mt-2 grid grid-cols-3 md:grid-cols-4 gap-2">
                                          {result.attachments.map((att, aIdx) => (
                                            <div key={aIdx} onClick={() => openImageViewer(result.attachments, aIdx)} className="relative group cursor-pointer rounded-lg overflow-hidden border border-purple-200 hover:border-blue-400 transition-all">
                                              <img src={getImageUrl(att.fileUrl)} alt={att.fileName || 'Scan'} className="w-full h-20 object-cover" />
                                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                                <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 bg-black/50 px-2 py-1 rounded">Click to view</span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {result.radiologistUser && <p className="text-xs text-purple-600 mt-1">Reported by: Dr. {result.radiologistUser.fullname}</p>}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Medications Section */}
                        {sv.medicationOrders && sv.medicationOrders.length > 0 && (
                          <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                            <h5 className="font-semibold text-indigo-900 mb-3 flex items-center gap-2">💊 Medications</h5>
                            <div className="space-y-2">
                              {sv.medicationOrders.map((med, i) => (
                                <div key={i} className="p-3 bg-white rounded-lg border border-indigo-100 text-sm">
                                  <p className="font-semibold text-gray-900">{med.medicationCatalog?.name || med.name}</p>
                                  <p className="text-xs text-indigo-600">Prescribed by: Dr. {med.doctor?.fullname || 'Unknown'}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Emergency / Material Orders */}
                        {sv.emergencyDrugOrders && sv.emergencyDrugOrders.length > 0 && (
                          <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                            <h5 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">🚑 Emergency Orders</h5>
                            <div className="space-y-2">
                              {sv.emergencyDrugOrders.map((drug, i) => (
                                <div key={i} className="p-3 bg-white rounded-lg border border-orange-100 text-sm">
                                  <p className="font-semibold text-orange-900">{drug.service?.name || 'Item'}</p>
                                  <p className="text-xs text-orange-600">Ordered by: Dr. {drug.doctor?.fullname || drug.doctor || 'Unknown'}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Nurse Services */}
                        {sv.nurseServiceAssignments && sv.nurseServiceAssignments.length > 0 && (
                          <div className="p-4 bg-pink-50 rounded-lg border border-pink-100">
                            <h5 className="font-semibold text-pink-900 mb-3 flex items-center gap-2">👩‍⚕️ Nurse Services</h5>
                            <div className="space-y-2">
                              {sv.nurseServiceAssignments.map((svc, i) => (
                                <div key={i} className="p-3 bg-white rounded-lg border border-pink-100 text-sm">
                                  <p className="font-semibold text-pink-900">{svc.service?.name || 'Service'}</p>
                                  <p className="text-xs text-pink-600">Handled by: {svc.assignedNurse?.fullname || 'Unknown'}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Empty state for summary */}
                        {(!sv.diagnosisNotes || sv.diagnosisNotes.length === 0) &&
                          (!sv.vitals || sv.vitals.length === 0) &&
                          (!sv.labTestOrders || sv.labTestOrders.length === 0) &&
                          (!sv.medicationOrders || sv.medicationOrders.length === 0) &&
                          (!sv.emergencyDrugOrders || sv.emergencyDrugOrders.length === 0) &&
                          (!sv.nurseServiceAssignments || sv.nurseServiceAssignments.length === 0) && (
                          <div className="text-center py-8 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-500">No data recorded for this visit.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Vitals Tab */}
                    {visitDetailTab === 'vitals' && (
                      <div className="bg-white p-6">
                        <h3 className="text-lg font-semibold mb-4" style={{ color: '#0C0E0B' }}>Vital Signs History</h3>
                        {sv.vitals && sv.vitals.length > 0 ? (
                          <div className="space-y-4">
                            {sv.vitals.map((vital, index) => (
                              <div key={vital.id} className="p-4 border rounded-lg" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                                <div className="flex justify-between items-start mb-3">
                                  <h4 className="font-medium" style={{ color: '#0C0E0B' }}>Record #{index + 1}</h4>
                                  <span className="text-sm" style={{ color: '#6B7280' }}>{new Date(vital.createdAt).toLocaleString()}</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div><p style={{ color: '#6B7280' }}>Heart Rate</p><p className="font-semibold" style={{ color: '#0C0E0B' }}>{vital.heartRate} bpm</p></div>
                                  <div><p style={{ color: '#6B7280' }}>Temperature</p><p className="font-semibold" style={{ color: '#0C0E0B' }}>{vital.temperature}°C</p></div>
                                  <div><p style={{ color: '#6B7280' }}>Blood Pressure</p><p className="font-semibold" style={{ color: '#0C0E0B' }}>{vital.bloodPressure} mmHg</p></div>
                                  <div><p style={{ color: '#6B7280' }}>Oxygen Sat</p><p className="font-semibold" style={{ color: '#0C0E0B' }}>{vital.oxygenSaturation}%</p></div>
                                </div>
                                {vital.chiefComplaint && (<div className="mt-3 pt-3 border-t" style={{ borderColor: '#E5E7EB' }}><p style={{ color: '#6B7280' }} className="text-sm">Chief Complaint:</p><p className="text-sm" style={{ color: '#0C0E0B' }}>{vital.chiefComplaint}</p></div>)}
                                {vital.physicalExamination && (<div className="mt-2"><p style={{ color: '#6B7280' }} className="text-sm">Physical Examination:</p><p className="text-sm" style={{ color: '#0C0E0B' }}>{vital.physicalExamination}</p></div>)}
                                {vital.notes && (<div className="mt-2"><p style={{ color: '#6B7280' }} className="text-sm">Notes:</p><p className="text-sm" style={{ color: '#0C0E0B' }}>{vital.notes}</p></div>)}
                              </div>
                            ))}
                          </div>
                        ) : (<p style={{ color: '#6B7280' }}>No vital signs recorded for this visit</p>)}
                      </div>
                    )}

                    {visitDetailTab === 'labs' && (
                      <div className="bg-white p-6">
                        <h3 className="text-lg font-semibold mb-4" style={{ color: '#0C0E0B' }}>Lab Results & Orders</h3>
                        {(() => {
                          if (!sv.labTestOrders || sv.labTestOrders.length === 0) {
                            return <div className="text-center py-12 bg-gray-50 rounded-lg"><p className="text-sm text-gray-500">No lab results or orders for this visit.</p></div>;
                          }
                          const completedOrders = sv.labTestOrders.filter(o => o.results && o.results.length > 0);
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
                          const pendingOrders = sv.labTestOrders.filter(o => !o.results || o.results.length === 0);
                          return (<div className="space-y-6">
                            {panelEntries.map(pg => {
                              const seenFields = new Set();
                              const combinedFields = [];
                              const panelImages = [];
                              const seenUrls = new Set();
                              pg.allResults.forEach(({ order, result }) => {
                                const fields = order.labTest?.resultFields || [];
                                if (fields.length > 0) {
                                  fields.forEach(field => {
                                    const key = field.fieldName || field.id;
                                    if (!seenFields.has(key)) {
                                      seenFields.add(key);
                                      const value = getResultValue(result.results, field);
                                      combinedFields.push({ field, value, result });
                                    }
                                  });
                                } else if (result.results && typeof result.results === 'object' && !Array.isArray(result.results)) {
                                  const testName = order.labTest?.name || 'Unknown';
                                  if (!seenFields.has(testName)) {
                                    seenFields.add(testName);
                                    const entries = Object.entries(result.results).filter(([k]) => k !== '_images');
                                    const displayVal = entries.length > 0 ? (typeof entries[0][1] === 'object' ? JSON.stringify(entries[0][1]) : String(entries[0][1])) : '';
                                    if (displayVal) {
                                      combinedFields.push({
                                        field: { id: testName, label: testName, fieldName: testName, unit: '', referenceRange: '' },
                                        value: displayVal,
                                        result
                                      });
                                    }
                                  }
                                }
                                if (result.results?._images) {
                                  (Array.isArray(result.results._images) ? result.results._images : [result.results._images]).forEach(img => {
                                    const u = img.data || img.url || img;
                                    if (u && !seenUrls.has(String(u))) { seenUrls.add(String(u)); panelImages.push(img); }
                                  });
                                }
                              });
                              return (
                                <div key={'pg-'+pg.group.id} className="border border-indigo-200 rounded-lg bg-indigo-50 overflow-hidden">
                                  <div className="px-4 py-3 bg-indigo-100 border-b border-indigo-200">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className="font-semibold text-indigo-800">{pg.group.name} Panel</p>
                                        <p className="text-xs text-indigo-600">{pg.orders.length} tests{pg.latestDate ? ' • '+new Date(pg.latestDate).toLocaleDateString() : ''}</p>
                                      </div>
                                      <span className="px-2 py-1 text-xs font-semibold text-indigo-800 bg-indigo-200 rounded-full">COMPLETED</span>
                                    </div>
                                  </div>
                                  {combinedFields.filter(f => f.value !== undefined).length > 0 && (
                                    <div className="p-4">
                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {combinedFields.map(({ field, value }) => {
                                          if (value === undefined) return null;
                                          const rc = field.normalRange ? checkValueInNormalRange(value, field.normalRange) : { inRange: true };
                                          return (
                                            <div key={field.id} className={'p-3 rounded-lg text-sm border ' + (!rc.inRange ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200')}>
                                              <div className="font-semibold text-gray-800 text-xs">{field.label}</div>
                                              <div className={'text-base font-bold mt-0.5 ' + (!rc.inRange ? 'text-red-600' : 'text-gray-900')}>
                                                {value} {field.unit || ''}
                                              </div>
                                              {!rc.inRange && rc.message && <div className="text-xs text-red-500 mt-0.5">{rc.message}</div>}
                                              {field.referenceRange && <div className="text-xs text-gray-400 mt-0.5">Ref: {field.referenceRange}</div>}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  {pg.additionalNotes && (
                                    <div className="px-4 pb-2">
                                      <p className="text-xs font-medium text-gray-500">Note: {pg.additionalNotes}</p>
                                    </div>
                                  )}
                                  {panelImages.length > 0 && (
                                    <div className="px-4 pb-4">
                                      <p className="text-xs font-medium text-indigo-700 mb-2">Attached Images ({panelImages.length})</p>
                                      <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                                        {panelImages.map((img, idx) => {
                                          const url = getImageUrl(img.url || img.data || img);
                                          return (
                                            <div key={idx} onClick={() => openImageViewer(panelImages.map(u => ({ fileUrl: u.url || u.fileUrl || u.filePath || (typeof u === 'string' ? u : ''), fileName: u.name || u.fileName || 'Lab Image' })), idx)} className="relative group cursor-pointer rounded-lg overflow-hidden border border-indigo-200 hover:border-indigo-400 transition-all">
                                              <img src={url} alt="Lab" className="w-full h-20 object-cover" />
                                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                                <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 bg-black/50 px-2 py-1 rounded">View</span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {standaloneOrders.length > 0 && (
                              <div className="space-y-4">
                                {standaloneOrders.map(order => {
                                  const r = order.results?.[0];
                                  if (!r) return null;
                                  const orderImages = [];
                                  if (r.results?._images) {
                                    (Array.isArray(r.results._images) ? r.results._images : [r.results._images]).forEach(img => {
                                      const u = img.data || img.url || img;
                                      if (u && !orderImages.some(x => String(x.data || x.url || x) === String(u))) orderImages.push(img);
                                    });
                                  }
                                  const fieldVals = (order.labTest?.resultFields || []).map(f => ({ field: f, value: getResultValue(r.results, f) })).filter(fv => fv.value !== undefined);
                                  return (
                                    <div key={order.id || standaloneOrders.indexOf(order)} className="p-4 border border-blue-100 rounded-lg bg-blue-50">
                                      <div className="flex justify-between items-start mb-2">
                                        <div>
                                          <p className="font-semibold text-blue-900">{order.labTest?.name || 'Lab Test'}</p>
                                          <p className="text-xs text-blue-600">{new Date(order.createdAt || r.createdAt).toLocaleString()}</p>
                                        </div>
                                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">{order.status || 'COMPLETED'}</span>
                                      </div>
                                      {fieldVals.length > 0 && (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                          {fieldVals.map(({ field, value }) => {
                                            const rc = field.normalRange ? checkValueInNormalRange(value, field.normalRange) : { inRange: true };
                                            return (
                                              <div key={field.id} className={'p-2 rounded text-xs border ' + (!rc.inRange ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200')}>
                                                <span className="font-medium text-gray-700">{field.label}: </span>
                                                <span className={'font-bold ' + (!rc.inRange ? 'text-red-600' : 'text-gray-900')}>{value} {field.unit || ''}</span>
                                                {!rc.inRange && rc.message && <span className="text-red-500 ml-1">({rc.message})</span>}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                      {r.additionalNotes && <p className="text-xs text-gray-500 mt-2">Note: {r.additionalNotes}</p>}
                                      {r.verifiedBy && <p className="text-xs text-blue-600 mt-1">Verified</p>}
                                      {orderImages.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                          <p className="text-xs font-medium text-gray-500 mb-1">Attached Images:</p>
                                          <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                                            {orderImages.map((img, idx) => {
                                              const url = getImageUrl(img.url || img.data || img);
                                              return (
                                                <div key={idx} onClick={() => openImageViewer(orderImages.map(u => ({ fileUrl: u.url || u.fileUrl || u.filePath || (typeof u === 'string' ? u : ''), fileName: u.name || u.fileName || 'Lab Image' })), idx)} className="relative group cursor-pointer rounded-lg overflow-hidden border border-blue-200 hover:border-blue-400 transition-all">
                                                  <img src={url} alt="Lab" className="w-full h-16 object-cover" />
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {pendingOrders.length > 0 && (
                              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-sm font-medium text-yellow-800">Pending Orders ({pendingOrders.length})</p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {pendingOrders.map((o, i) => (
                                    <span key={i} className="px-2 py-1 text-xs bg-white border border-yellow-200 rounded text-yellow-700">{o.labTest?.name || 'Test'}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>);
                        })()}
                      </div>
                    )}                    {/* Other tabs use getSelectedVisit() which returns visitDetails */}

                    {/* Sub-tab: Diagnosis Notes */}
                    {visitDetailTab === 'notes' && (
                      <div className="bg-white p-6">
                        <h3 className="text-lg font-semibold mb-4" style={{ color: '#0C0E0B' }}>Diagnosis Notes</h3>
                        {sv.diagnosisNotes && sv.diagnosisNotes.length > 0 ? (
                          <div className="space-y-4">
                            {sv.diagnosisNotes.map((note, i) => (
                              <div key={i} className="p-4 border rounded-lg" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                                <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.notes || note.content || note.text}</p>
                                <div className="flex gap-4 mt-2 text-xs text-blue-600">
                                  <span>Dr. {note.doctor?.fullname || 'Unknown'}</span>
                                  <span>{new Date(note.createdAt).toLocaleString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: '#6B7280' }}>No diagnosis notes for this visit.</p>
                        )}
                      </div>
                    )}

                    {/* Sub-tab: Medications */}
                    {visitDetailTab === 'medications' && (
                      <div className="bg-white p-6">
                        <h3 className="text-lg font-semibold mb-4" style={{ color: '#0C0E0B' }}>Medications</h3>
                        {sv.medicationOrders && sv.medicationOrders.length > 0 ? (
                          <div className="space-y-3">
                            {sv.medicationOrders.map((med, i) => (
                              <div key={i} className="p-4 border rounded-lg" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                                <p className="font-semibold text-gray-900">{med.medicationCatalog?.name || med.name}</p>
                                <p className="text-xs text-indigo-600">Prescribed by: Dr. {med.doctor?.fullname || 'Unknown'}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: '#6B7280' }}>No medications prescribed for this visit.</p>
                        )}
                      </div>
                    )}

                    {/* Sub-tab: Radiology */}
                    {visitDetailTab === 'radiology' && (
                      <div className="bg-white p-6">
                        <h3 className="text-lg font-semibold mb-4" style={{ color: '#0C0E0B' }}>Radiology Results</h3>
                        {sv.batchOrders?.filter(bo => bo.type === 'RADIOLOGY').length > 0 || sv.radiologyOrders?.length > 0 ? (
                          <div className="space-y-4">
                            {[...(sv.batchOrders?.filter(bo => bo.type === 'RADIOLOGY') || []), ...(sv.radiologyOrders || [])].map((order, i) => (
                              <div key={i} className="p-4 border rounded-lg" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                                <p className="font-semibold text-purple-900">{order.service?.name || order.type?.name || 'Radiology'}</p>
                                {order.radiologyResults?.map((rr, j) => (
                                  <div key={j} className="mt-2 p-3 bg-white rounded border border-purple-100">
                                    {rr.findings && <p className="text-sm"><span className="font-medium">Findings:</span> {rr.findings}</p>}
                                    {rr.conclusion && <p className="text-sm mt-1"><span className="font-medium">Conclusion:</span> {rr.conclusion}</p>}
                                    {rr.finding && <p className="text-sm"><span className="font-medium">Result:</span> {rr.finding}</p>}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: '#6B7280' }}>No radiology results for this visit.</p>
                        )}
                      </div>
                    )}

                    {/* Sub-tab: Images */}
                    {visitDetailTab === 'images' && (
                      <div className="bg-white p-6">
                        <h3 className="text-lg font-semibold mb-4" style={{ color: '#0C0E0B' }}>Visit Images</h3>
                        {sv.files?.length > 0 || sv.attachedImages?.length > 0 ? (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {(sv.files || sv.attachedImages || []).map((file, i) => (
                              <div key={i} onClick={() => openImageViewer(sv.files || sv.attachedImages, i)} className="relative group cursor-pointer rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-all">
                                <img src={getImageUrl(file.fileUrl || file.url)} alt="Visit" className="w-full h-32 object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: '#6B7280' }}>No images for this visit.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        <ImageViewer
          isOpen={imageViewerState.isOpen}
          onClose={closeImageViewer}
          images={imageViewerState.images}
          currentIndex={imageViewerState.currentIndex}
        />
        </>
      )}
    </div>
  );
};

export default ComprehensivePatientHistory;
