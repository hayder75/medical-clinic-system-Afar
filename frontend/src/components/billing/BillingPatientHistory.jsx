import React, { useState } from 'react';
import {
  Search, FileText, TestTube, Scan, Pill, Printer,
  User, Phone, ArrowLeft, Calendar, Clock, AlertTriangle, DollarSign
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

import { formatMedicationName, formatMedicationInstruction, formatEmergencyInstruction } from '../../utils/medicalStandards';

const NON_CLINICAL_CUSTOM_NOTE = 'Custom medication - not in inventory';

const BillingPatientHistory = () => {
  const { user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedVisitId, setSelectedVisitId] = useState(null);
  const [activeTab, setActiveTab] = useState('medications');

  const searchPatients = async () => {
    if (!searchTerm.trim()) return;

    try {
      setLoading(true);
      const response = await api.get(`/patients/search?query=${encodeURIComponent(searchTerm)}`);
      setPatients(response.data.patients || []);
      if (response.data.patients?.length === 0) {
        toast.error('No patients found');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search patients');
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientHistory = async (patientId) => {
    try {
      setLoading(true);
      const response = await api.get(`/doctors/patient-history/${patientId}`);
      setPatientHistory(response.data);
      if (response.data?.visits && response.data.visits.length > 0) {
        setSelectedVisitId(response.data.visits[0].id);
      }
    } catch (error) {
      console.error('Fetch history error:', error);
      toast.error('Failed to fetch patient history');
    } finally {
      setLoading(false);
    }
  };

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    setSelectedVisitId(null);
    setActiveTab('medications');
    setPatients([]);
    setSearchTerm('');
    fetchPatientHistory(patient.id);
  };

  const clearPatientSelection = () => {
    setSelectedPatient(null);
    setPatientHistory(null);
    setSelectedVisitId(null);
    setActiveTab('medications');
  };

  const selectedVisit = patientHistory?.visits?.find(v => v.id === selectedVisitId);

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

  const normalizeOptionalValue = (value) => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    if (!text || text.toUpperCase() === 'N/A') return null;
    return text;
  };

  const formatBloodType = (value) => {
    const map = {
      A_PLUS: 'A+',
      A_MINUS: 'A-',
      B_PLUS: 'B+',
      B_MINUS: 'B-',
      AB_PLUS: 'AB+',
      AB_MINUS: 'AB-',
      O_PLUS: 'O+',
      O_MINUS: 'O-',
      UNKNOWN: 'Unknown'
    };
    return map[value] || normalizeOptionalValue(value);
  };

  const extractMetaFromNotes = (notes, label) => {
    if (!notes) return null;
    const match = String(notes).match(new RegExp(`${label}:\\s*([^\\n]+)`, 'i'));
    return normalizeOptionalValue(match?.[1]);
  };

  const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

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

    if (isHealthOfficer) {
      return 'Health Officer (HO)';
    }

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

  // Print Medications - Matching MedicationOrdering.jsx style
  const handlePrintMedications = () => {
    // Check both medications and medicationOrders
    const medications = selectedVisit?.medications || selectedVisit?.medicationOrders || [];
    if (!selectedVisit || !patientHistory || medications.length === 0) {
      toast.error('No medications to print');
      return;
    }

    try {
      const patient = patientHistory.patient;
      let medicationsToPrint = medications.map(med => ({
        ...med,
        name: med.medication?.name || med.medicationCatalog?.name || med.name,
        dosageForm: med.medication?.dosageForm || med.medicationCatalog?.dosageForm || med.dosageForm,
        strength: med.medication?.strength || med.medicationCatalog?.strength || med.strength,
        instructions: med.instructions || med.instructionText || med.medicationOrder?.instructions || med.medicationOrder?.instructionText || med.medication?.instructions || med.medicationCatalog?.instructions || null,
        instructionText: med.instructionText || med.instructions || med.medicationOrder?.instructionText || med.medicationOrder?.instructions || med.medication?.instructions || med.medicationCatalog?.instructions || null,
        additionalNotes: med.additionalNotes || med.medicationOrder?.additionalNotes || null,
        doctor: med.doctor || med.medicationOrder?.doctor || null,
      }));

      // Deduplicate exactly identical medication orders
      medicationsToPrint = medicationsToPrint.reduce((acc, current) => {
        const isDuplicate = acc.find(item =>
          item.name === current.name &&
          item.strength === current.strength &&
          item.frequency === current.frequency &&
          item.frequencyPeriod === current.frequencyPeriod &&
          item.route === current.route &&
          item.duration === current.duration &&
          resolveMedicationInstruction(item) === resolveMedicationInstruction(current)
        );
        if (!isDuplicate) acc.push(current);
        return acc;
      }, []);

      const patientAge = patient?.dob ? calculateAge(patient.dob) : 'N/A';
      const patientGender = (patient?.gender || 'N/A').charAt(0).toUpperCase();
      const patientCardNumber = patient?.id || 'N/A';
      const patientName = patient?.name || 'N/A';

      // Get doctor from first medication order (all should be from same doctor)
      const firstMed = medicationsToPrint[0];
      const prescribingDoctor = firstMed?.doctor || firstMed?.medicationOrder?.doctor || selectedVisit.doctor || currentUser;
      const doctorName = getPrintableDoctorName(prescribingDoctor, currentUser);
      const doctorQualification = getDoctorQualificationLabel(prescribingDoctor, currentUser);

      const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

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
                overflow: hidden !important; 
                background: white !important;
                position: relative !important;
                display: block !important;
                box-sizing: border-box !important;
                visibility: visible !important;
              }
            }
            body { 
              font-family: 'Segoe UI', Tahoma, sans-serif; 
              margin: 0; 
              padding: 20px; 
              color: #333; 
              line-height: 1.3; 
              background: #f3f4f6; 
              display: flex;
              flex-direction: column;
              align-items: center;
              min-height: 100vh;
            }
            .no-print { padding: 10px; background: #fff; margin-bottom: 20px; border-radius: 8px; width: 100%; max-width: 300px; text-align: center; }
            .no-print button { background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: 600; }
            .prescription-container { width: 105mm; min-height: 148mm; background: white; padding: 8mm; box-shadow: 0 10px 25px rgba(0,0,0,0.1); position: relative; box-sizing: border-box; display: block; margin: 0 auto; }
            .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; margin-bottom: 12px; border-bottom: 2px solid #2563eb; }
            .header-left { display: flex; align-items: center; gap: 8px; }
            .logo { width: 40px; height: 40px; object-fit: contain; }
            .clinic-name { font-size: 13px; font-weight: 700; margin: 0; color: #1e40af; text-transform: uppercase; }
            .clinic-tagline { font-size: 9px; color: #64748b; margin: 0; font-style: italic; }
            .report-title { font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; }
            .report-info { font-size: 9px; color: #64748b; margin-top: 1px; text-align: right; }
            .patient-section { margin-bottom: 12px; padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; }
            .info-label { font-weight: 700; color: #64748b; }
            .medications-section h3 { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; }
            .medication-item { margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed #e2e8f0; width: 100%; }
            .medication-name { font-weight: 700; font-size: 12px; color: #0f172a; margin-bottom: 2px; }
            .medication-details { font-size: 11px; color: #334155; font-weight: 500; }
            .footer { margin-top: auto; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px; }
            .doctor-name { font-weight: 700; color: #1e293b; font-size: 11px; }
            .signature-box { width: 100px; border-top: 1px solid #334155; padding-top: 4px; text-align: center; font-size: 8px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="no-print"><button onclick="window.print()">Print Prescription</button></div>
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
              <div><span class="info-label">Patient:</span> ${patientName?.toUpperCase()}</div>
              <div><span class="info-label">Card No:</span> #${patientCardNumber}</div>
              <div><span class="info-label">Age/Sex:</span> ${typeof patientAge === 'number' ? patientAge + 'Y' : patientAge} / ${patientGender}</div>
              <div style="text-align: right;"><span class="info-label">Visit ID:</span> #${selectedVisit?.visitUid || selectedVisit?.id?.substring(0, 8)}</div>
            </div>
            <div class="medications-section">
              <h3>Prescribed Medications</h3>
              ${medicationsToPrint.map((med, index) => {
        const displayName = String(med.name || '').trim() || 'Unknown Medication';
        const rawStrength = String(med.strength || '').trim();
        const strengthSuffix = rawStrength && !displayName.toLowerCase().includes(rawStrength.toLowerCase()) ? ` ${rawStrength}` : '';
        const instructionText = resolveMedicationInstruction(med);

        return `
                  <div class="medication-item">
                    <div class="medication-name"># ${index + 1}. ${displayName}${strengthSuffix}</div>
                    ${instructionText ? `<div class="medication-details" style="padding-left: 25px; margin-top: 4px;">${instructionText}</div>` : ''}
                  </div>
                `;
      }).join('')}
            </div>
            <div class="footer">
              <div>Prescribed by: <span class="doctor-name">${doctorName}</span><br>${doctorQualification}</div>
              <div class="signature-line">Doctor's Signature & Stamp</div>
            </div>
          </div>
        </body>
      </html>
    `;
      printWindow.document.write(prescriptionContent);
      printWindow.document.close();
      setTimeout(() => { printWindow.print(); }, 800);
      toast.success('Opening print preview...');
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Failed to print prescription');
    }
  };

  const handlePrintCompound = () => {
    const compounds = selectedVisit?.compoundPrescriptions || [];
    if (!selectedVisit || !patientHistory || compounds.length === 0) {
      toast.error('No compound prescriptions to print');
      return;
    }

    try {
      const patient = patientHistory.patient;
      const patientAge = patient?.dob ? calculateAge(patient.dob) : 'N/A';
      const patientGender = (patient?.gender || 'N/A').charAt(0).toUpperCase();
      const patientCardNumber = patient?.id || 'N/A';
      const patientName = patient?.name || 'N/A';

      const firstCompound = compounds[0];
      const prescribingDoctor = firstCompound?.doctor || selectedVisit?.doctor || currentUser;
      const doctorName = getPrintableDoctorName(prescribingDoctor, currentUser);
      const doctorQualification = getDoctorQualificationLabel(prescribingDoctor, currentUser);

      const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const printWindow = window.open('', '_blank');
      const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Compound Prescription - ${patientName}</title>
          <style>
            @media print {
              @page { size: A6; margin: 0 !important; }
              html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color: black !important; }
              .no-print { display: none !important; }
              .prescription-container { width: 105mm !important; min-height: 148mm !important; margin: 0 auto !important; padding: 8mm !important; border: none !important; box-shadow: none !important; background: white !important; box-sizing: border-box !important; }
            }
            body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 20px; color: #333; line-height: 1.3; background: #f3f4f6; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
            .no-print { padding: 10px; background: #fff; margin-bottom: 20px; border-radius: 8px; width: 100%; max-width: 300px; text-align: center; }
            .no-print button { background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: 600; }
            .prescription-container { width: 105mm; min-height: 148mm; background: white; padding: 8mm; box-shadow: 0 10px 25px rgba(0,0,0,0.1); box-sizing: border-box; margin: 0 auto; }
            .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; margin-bottom: 12px; border-bottom: 2px solid #2563eb; }
            .header-left { display: flex; align-items: center; gap: 8px; }
            .logo { width: 40px; height: 40px; object-fit: contain; }
            .clinic-name { font-size: 13px; font-weight: 700; margin: 0; color: #1e40af; text-transform: uppercase; }
            .clinic-tagline { font-size: 9px; color: #64748b; margin: 0; font-style: italic; }
            .report-title { font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; }
            .report-info { font-size: 9px; color: #64748b; margin-top: 1px; text-align: right; }
            .patient-section { margin-bottom: 12px; padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; }
            .info-label { font-weight: 700; color: #64748b; }
            .medication-item { margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed #e2e8f0; width: 100%; }
            .medication-name { font-weight: 700; font-size: 12px; color: #0f172a; margin-bottom: 2px; }
            .medication-details { font-size: 11px; color: #334155; font-weight: 500; white-space: pre-wrap; }
            .footer { margin-top: auto; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px; }
            .doctor-name { font-weight: 700; color: #1e293b; font-size: 11px; }
            .signature-box { width: 100px; border-top: 1px solid #334155; padding-top: 4px; text-align: center; font-size: 8px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="no-print"><button onclick="window.print()">Print Prescription</button></div>
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
                <h2 class="report-title">Compound Prescription</h2>
                <div class="report-info">Date: ${currentDate}<br>Time: ${currentTime}</div>
              </div>
            </div>
            <div class="patient-section">
              <div><span class="info-label">Patient:</span> ${String(patientName || '').toUpperCase()}</div>
              <div><span class="info-label">Card No:</span> #${patientCardNumber}</div>
              <div><span class="info-label">Age/Sex:</span> ${typeof patientAge === 'number' ? patientAge + 'Y' : patientAge} / ${patientGender}</div>
              <div style="text-align: right;"><span class="info-label">Visit ID:</span> #${selectedVisit?.visitUid || selectedVisit?.id?.substring(0, 8)}</div>
            </div>
            <div class="medications-section">
              <h3 style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">Compound Prescription</h3>
              ${compounds.map((cp, idx) => {
                const text = escapeHtml(cp.prescriptionText || cp.rawText || cp.instructions || '');
                return `<div class="medication-item"><div class="medication-name"># ${idx + 1}</div><div class="medication-details">${text}</div></div>`;
              }).join('')}
            </div>
            <div class="footer">
              <div>Prescribed by: <span class="doctor-name">${doctorName}</span><br>${doctorQualification}</div>
              <div class="signature-box">Doctor's Signature & Stamp</div>
            </div>
          </div>
        </body>
      </html>`;

      printWindow.document.write(content);
      printWindow.document.close();
      setTimeout(() => { printWindow.print(); }, 800);
      toast.success('Opening print preview...');
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Failed to print compound prescription');
    }
  };

  // Print Emergency Medications
  const handlePrintEmergency = () => {
    if (!selectedVisit || !patientHistory || !selectedVisit.emergencyOrders?.length) {
      toast.error('No emergency medications to print');
      return;
    }

    try {
      const patient = patientHistory.patient;
      const patientName = patient?.name?.toUpperCase() || 'Unknown';
      const patientAge = patient?.dob ? calculateAge(patient.dob) : 'N/A';
      const patientGender = (patient?.gender || 'N/A').charAt(0).toUpperCase();
      const patientCardNumber = patient?.id || 'N/A';

      const prescribingDoctor = selectedVisit.doctor || currentUser;
      const doctorName = prescribingDoctor?.fullname || currentUser?.fullname || 'Medical Practitioner';
      const doctorQualification = prescribingDoctor?.qualifications?.join(', ') || 'Medical Doctor';

      const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const printWindow = window.open('', '_blank');
      const prescriptionContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Emergency Prescription - ${patientName}</title>
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
                overflow: hidden !important; 
                background: white !important;
                position: relative !important;
                display: block !important;
                box-sizing: border-box !important;
                visibility: visible !important;
              }
            }
            body { 
              font-family: 'Segoe UI', Tahoma, sans-serif; 
              margin: 0; 
              padding: 20px; 
              color: #333; 
              line-height: 1.3; 
              background: #f3f4f6; 
              display: flex;
              flex-direction: column;
              align-items: center;
              min-height: 100vh;
            }
            .no-print { padding: 10px; background: #fff; margin-bottom: 20px; border-radius: 8px; width: 100%; max-width: 300px; text-align: center; }
            .no-print button { background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: 600; }
            .prescription-container { width: 105mm; min-height: 148mm; background: white; padding: 8mm; box-shadow: 0 10px 25px rgba(0,0,0,0.1); position: relative; box-sizing: border-box; display: block; margin: 0 auto; }
            .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; margin-bottom: 12px; border-bottom: 2px solid #2563eb; }
            .header-left { display: flex; align-items: center; gap: 8px; }
            .logo { width: 40px; height: 40px; object-fit: contain; }
            .clinic-name { font-size: 13px; font-weight: 700; margin: 0; color: #1e40af; text-transform: uppercase; }
            .clinic-tagline { font-size: 9px; color: #64748b; margin: 0; font-style: italic; }
            .report-title { font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; }
            .report-info { font-size: 9px; color: #64748b; margin-top: 1px; text-align: right; }
            .patient-section { margin-bottom: 12px; padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; }
            .info-label { font-weight: 700; color: #64748b; }
            .medications-section h3 { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; }
            .medication-item { margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed #e2e8f0; width: 100%; }
            .medication-name { font-weight: 700; font-size: 12px; color: #0f172a; margin-bottom: 2px; }
            .medication-details { font-size: 11px; color: #334155; font-weight: 500; }
            .footer { margin-top: auto; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px; }
            .doctor-name { font-weight: 700; color: #1e293b; font-size: 11px; }
            .signature-box { width: 100px; border-top: 1px solid #334155; padding-top: 4px; text-align: center; font-size: 8px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="no-print"><button onclick="window.print()">Print Prescription</button></div>
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
                <h2 class="report-title">Emergency Orders</h2>
                <div class="report-info">
                  Date: ${currentDate}<br>
                  Time: ${currentTime}
                </div>
              </div>
            </div>
            <div class="patient-section">
              <div><span class="info-label">Patient:</span> ${patientName?.toUpperCase()}</div>
              <div><span class="info-label">Card No:</span> #${patientCardNumber}</div>
              <div><span class="info-label">Age/Sex:</span> ${typeof patientAge === 'number' ? patientAge + 'Y' : patientAge} / ${patientGender}</div>
              <div><span class="info-label">Visit:</span> EMERGENCY</div>
            </div>
            <div class="medications-section">
              <h3>Drug Orders</h3>
              ${selectedVisit.emergencyOrders.map((med, index) => {
        const displayName = String(med.serviceName || med.name || '').trim() || 'Unknown Medication';
        const rawStrength = String(med.strength || '').trim();
        const strengthSuffix = rawStrength && !displayName.toLowerCase().includes(rawStrength.toLowerCase()) ? ` ${rawStrength}` : '';
        const emergencyText = formatEmergencyInstruction(med);

        return `
                  <div class="medication-item">
                    <div class="medication-name"># ${index + 1}. ${escapeHtml(displayName + strengthSuffix)}</div>
                    ${emergencyText.instruction ? `<div class="medication-details" style="padding-left: 25px; margin-top: 4px;">${escapeHtml(emergencyText.instruction)}</div>` : ''}
                    ${emergencyText.special ? `<div class="medication-details" style="padding-left: 25px; margin-top: 4px; font-style: italic;">${escapeHtml(emergencyText.special)}</div>` : ''}
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
          </div>
        </body>
      </html>
    `;
      printWindow.document.write(prescriptionContent);
      printWindow.document.close();
      setTimeout(() => { printWindow.print(); }, 800);
      toast.success('Opening print preview...');
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Failed to print emergency order');
    }
  };

  const handlePrintBilling = (billing) => {
    const printWindow = window.open("", "_blank");
    const patientName =
      billing.patient?.name?.toUpperCase() || patientHistory?.patient?.name?.toUpperCase() || "UNKNOWN PATIENT";
    const patientId = billing.patient?.id || patientHistory?.patient?.id || "N/A";
    const billingId = billing.id?.substring(0, 8) || "N/A";
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const currentTime = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const isEmergency =
      billing.status === "EMERGENCY_PENDING" || billing.isEmergency;

    const patientData = billing.patient || patientHistory?.patient || {};
    const receiptGender = normalizeOptionalValue(patientData.gender) || extractMetaFromNotes(billing.notes, 'Gender');
    const receiptAge = (normalizeOptionalValue(patientData.age) || (patientData.dob ? calculateAge(patientData.dob) : null)) || extractMetaFromNotes(billing.notes, 'Age');
    const receiptBloodType = formatBloodType(patientData.bloodType) || extractMetaFromNotes(billing.notes, 'Blood Type');
    const referringDoctor = extractMetaFromNotes(billing.notes, 'Referring Doctor');

    const optionalRows = [
      receiptGender ? `<div><span class="info-label">Gender:</span> ${escapeHtml(receiptGender)}</div>` : '',
      receiptAge ? `<div><span class="info-label">Age:</span> ${escapeHtml(receiptAge)}</div>` : '',
      receiptBloodType ? `<div><span class="info-label">Blood Type:</span> ${escapeHtml(receiptBloodType)}</div>` : '',
      referringDoctor ? `<div><span class="info-label">Referring Doctor:</span> ${escapeHtml(referringDoctor)}</div>` : ''
    ].filter(Boolean).join('');

    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Service Receipt - ${patientName}</title>
          <style>
            @media print {
              @page { size: A6; margin: 0; }
              body { margin: 0; padding: 0; }
              .no-print { display: none; }
              .receipt-container { width: 105mm; height: 148mm; margin: 0; padding: 8mm; border: none; box-shadow: none; }
            }
            body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 20px; color: #333; line-height: 1.3; background: #f3f4f6; display: flex; flex-direction: column; align-items: center; }
            .no-print { text-align: center; padding: 10px; background: #fff; margin-bottom: 20px; border-radius: 8px; width: 100%; max-width: 400px; }
            .no-print button { background: #2563eb; color: white; border: none; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; }
            .receipt-container { width: 105mm; min-height: 148mm; background: white; padding: 8mm; box-shadow: 0 4px 12px rgba(0,0,0,0.1); position: relative; box-sizing: border-box; border-radius: 4px; }
            .header { text-align: center; border-bottom: 2px solid ${isEmergency ? "#ef4444" : "#2563eb"}; padding-bottom: 8px; margin-bottom: 12px; }
            .clinic-name { font-size: 18px; font-weight: 800; margin: 0; color: ${isEmergency ? "#991b1b" : "#1e40af"}; }
            .receipt-title { font-size: 14px; font-weight: 700; margin: 4px 0; text-transform: uppercase; color: #1e293b; }
            .patient-section { margin-bottom: 10px; padding: 6px; background: ${isEmergency ? "#fef2f2" : "#f8fafc"}; border: 1px solid ${isEmergency ? "#fee2e2" : "#e2e8f0"}; border-radius: 4px; font-size: 11px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
            .info-label { font-weight: 700; color: #64748b; }
            .items-section { margin: 10px 0; }
            .item-row { display: flex; justify-content: space-between; font-size: 11px; padding: 4px 0; border-bottom: 1px dashed #e2e8f0; }
            .item-name { font-weight: 600; flex: 1; }
            .item-qty { width: 40px; text-align: center; }
            .item-price { width: 80px; text-align: right; }
            .total-section { margin-top: 15px; border-top: 2px solid ${isEmergency ? "#ef4444" : "#2563eb"}; padding-top: 8px; }
            .total-row { display: flex; justify-content: space-between; font-size: 14px; font-weight: 800; color: ${isEmergency ? "#991b1b" : "#1e3a8a"}; }
            .footer { margin-top: auto; padding-top: 12px; text-align: center; font-size: 9px; color: #64748b; }
            .status-stamp { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 40px; font-weight: 900; color: rgba(34, 197, 94, 0.15); border: 4px solid rgba(34, 197, 94, 0.15); padding: 10px 20px; border-radius: 12px; text-transform: uppercase; pointer-events: none; }
            .emergency-label { color: #ef4444; font-weight: 800; font-size: 10px; margin-bottom: 4px; display: block; }
          </style>
        </head>
        <body>
          <div class="no-print"><button onclick="window.print()">Print Receipt</button></div>
          <div class="receipt-container">
            ${billing.status === "PAID" ? `<div class="status-stamp">PAID</div>` : ""}
            <div class="header">
              <h1 class="clinic-name">${window.__CS__?.name || 'Clinic'}</h1>
              <h2 class="receipt-title">Service Receipt</h2>
              <div style="font-size: 9px; color: #64748b;">${currentDate} ${currentTime}</div>
            </div>
            
            <div class="patient-section">
              ${isEmergency ? '<span class="emergency-label">*** EMERGENCY SERVICE ***</span>' : ""}
              <div class="info-grid">
                <div><span class="info-label">Patient:</span> ${patientName}</div>
                <div><span class="info-label">ID:</span> #${patientId}</div>
                <div><span class="info-label">Billing:</span> #${billingId}</div>
                <div><span class="info-label">Status:</span> ${(billing.status || '').replace(/_/g, " ")}</div>
                ${optionalRows}
              </div>
            </div>

            <div class="items-section">
              <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 10px; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
                <span style="flex: 1;">Service Description</span>
                <span style="width: 40px; text-align: center;">Qty</span>
                <span style="width: 80px; text-align: right;">Amount</span>
              </div>
              ${(billing.services || [])
        .map((service) => {
          const quantity = service.quantity || 1;
          const totalPrice =
            service.totalPrice || (service.unitPrice || 0) * quantity;
          const serviceName = service.service?.name || service.name || "Service";
          const cleanName = formatMedicationName(serviceName);
          return `
                  <div class="item-row">
                    <span class="item-name">${cleanName}</span>
                    <span class="item-qty">${quantity}</span>
                    <span class="item-price">${totalPrice.toLocaleString()}</span>
                  </div>
                `;
        })
        .join("")}
            </div>

            <div class="total-section">
              <div class="total-row">
                <span>TOTAL AMOUNT</span>
                <span>ETB ${(billing.totalAmount || 0).toLocaleString()}</span>
              </div>
            </div>

            <div class="footer">
              Thank you for choosing ${window.__CS__?.name || 'Clinic'}<br>
              ${window.__CS__?.tagline || 'Quality Healthcare You Can Trust'}
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(content);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 800);
    toast.success('Opening print preview...');
  };

  // Print Lab Results - Matching LabOrders.jsx style
  const handlePrintLabResults = async () => {
    const labResults = selectedVisit?.labResults || selectedVisit?.labOrders || selectedVisit?.labTestOrders || [];
    if (!selectedVisit || !patientHistory || labResults.length === 0) {
      toast.error('No lab results to print');
      return;
    }

    try {
      // Filter completed results only
      let allResults = [];
      for (const result of labResults) {
        const status = result.status?.toUpperCase() || '';
        if (['QUEUED', 'PENDING', 'UNPAID'].includes(status)) continue;

        if (status === 'COMPLETED' || (result.detailedResults && result.detailedResults.length > 0) || result.resultText || result.results) {
          allResults.push({
            serviceName: result.testType?.name || result.serviceName || 'Lab Test',
            detailedResults: result.detailedResults || [],
            results: result.results || {},
            resultText: result.resultText || null,
            additionalNotes: result.additionalNotes || '',
            verifiedByUser: result.verifiedByUser || result.verifiedBy,
            orderId: result.orderId || result.id,
            doctor: result.doctor || selectedVisit.doctor
          });
        }
      }

      if (allResults.length === 0) {
        toast.error('No completed lab results to print');
        return;
      }

      const patient = patientHistory.patient;
      const currentDate = new Date();
      const formatDateTime = (date) => date.toLocaleString('en-US');

      const firstResult = allResults[0];
      const labTechnicianName = firstResult?.verifiedByUser?.fullname || firstResult?.verifiedByUser || currentUser?.fullname || 'Lab Technician';
      const patientAge = patient?.dob ? calculateAge(patient.dob) : 'N/A';
      const patientBloodType = patient?.bloodType || 'N/A';

      const printWindow = window.open('', '_blank');
      const labContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Lab Results - ${patient.name || 'Patient'}</title>
          <style>
            @media print {
              @page { 
                size: A4;
                margin: 5mm;
              }
              body { margin: 0; padding: 0; background: white !important; visibility: visible !important; display: block !important; zoom: 90%; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color: black !important; }
              .header { border-bottom: 2px solid black !important; padding-bottom: 5px !important; margin-bottom: 10px !important; }
              .test-group-header { border-bottom: 1px solid black !important; color: black !important; padding: 2px 4px !important; }
              .test-group { margin-bottom: 10px !important; padding-bottom: 5px !important; page-break-inside: avoid; }
              .footer { margin-top: 10px !important; padding-top: 5px !important; }
              .print-footer { margin-top: 10px !important; }
              .no-print { display: none !important; }
            }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 0; 
              padding: 10px;
              color: #333;
              line-height: 1.3;
              font-size: 10pt;
            }
            .no-print {
              text-align: center;
              padding: 10px;
              background: #f8f9fa;
              margin-bottom: 15px;
              border-bottom: 1px solid #dee2e6;
            }
            .no-print button {
              background: #2563eb;
              color: white;
              border: none;
              padding: 8px 20px;
              border-radius: 5px;
              cursor: pointer;
              font-size: 14px;
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
            .header-left { display: flex; align-items: center; gap: 15px; }
            .logo { width: 70px; height: 70px; object-fit: contain; }
            .clinic-info { text-align: left; }
            .clinic-name { font-size: 24px; font-weight: 800; margin: 0; color: #1e40af; letter-spacing: -0.5px; }
            .clinic-tagline { font-size: 12px; color: #64748b; margin: 0; font-style: italic; }
            .header-right { text-align: right; }
            .report-title { font-size: 20px; font-weight: 700; margin: 0; color: #0f172a; text-transform: uppercase; }
            .report-info { font-size: 12px; color: #64748b; margin-top: 2px; }

            .patient-section {
              margin-bottom: 15px;
              padding: 10px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              font-size: 10pt;
            }
            .section-header {
              font-size: 12px;
              font-weight: 700;
              margin-bottom: 8px;
              color: #1e293b;
              border-bottom: 1px solid #cbd5e1;
              padding-bottom: 3px;
              text-transform: uppercase;
            }
            .patient-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
            }
            .info-item { display: flex; flex-direction: column; }
            .info-label { font-weight: 600; color: #64748b; font-size: 10px; text-transform: uppercase; }
            .info-value { color: #1e293b; font-weight: 500; font-size: 11px; }

            .results-flex-container {
              display: flex;
              gap: 20px;
              margin-top: 10px;
              align-items: start;
            }
            .column { flex: 1; display: flex; flex-direction: column; }
            .test-group {
              break-inside: avoid;
              margin-bottom: 15px;
              border: 1px solid #e2e8f0;
              border-radius: 4px;
              overflow: hidden;
              background-color: #fff;
              width: 100%;
            }
            .test-group-header {
              background-color: #f1f5f9;
              font-weight: bold;
              color: #1e40af;
              padding: 4px 8px;
              font-size: 9pt;
              border-bottom: 1px solid #cbd5e1;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            .result-table { width: 100%; border-collapse: collapse; }
            .result-table td { padding: 2.5px 8px; font-size: 8.5pt; border-bottom: 1px solid #f1f5f9; }
            .param-name { color: #475569; font-weight: 500; width: 65%; }
            .param-value { font-weight: 700; color: #0f172a; text-align: right; }
            .notes-box {
              padding: 3px 8px;
              background-color: #fffbeb;
              font-size: 8pt;
              font-style: italic;
              color: #64748b;
              border-top: 1px solid #fef3c7;
            }
            .footer {
              margin-top: 20px;
              padding-top: 10px;
              border-top: 1px solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              font-size: 9.5pt;
            }
            .signature-box { text-align: center; min-width: 150px; }
            .signature-line {
              border-top: 1px solid #334155;
              margin-top: 35px;
              padding-top: 4px;
              font-size: 10px;
              font-weight: 600;
              color: #475569;
            }
            .print-footer {
              text-align: center;
              font-size: 8.5px;
              color: #94a3b8;
              margin-top: 20px;
              border-top: 1px dashed #e2e8f0;
              padding-top: 8px;
            }
          </style>
        </head>
        <body>
          <div class="no-print"><button onclick="window.print()">Print Report</button></div>
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
              <div class="report-info">Date: ${formatDateTime(currentDate)}</div>
            </div>
          </div>

          <div class="patient-section">
            <div class="section-header">Patient Information</div>
            <div class="patient-grid">
              <div class="info-item"><span class="info-label">Full Name</span><span class="info-value">${patient.name || 'N/A'}</span></div>
              <div class="info-item"><span class="info-label">Patient ID</span><span class="info-value">#${patient.id || 'N/A'}</span></div>
              <div class="info-item"><span class="info-label">Gender</span><span class="info-value">${patient.gender || 'N/A'}</span></div>
              <div class="info-item"><span class="info-label">Age</span><span class="info-value">${patientAge}</span></div>
              <div class="info-item"><span class="info-label">Blood Type</span><span class="info-value">${patientBloodType}</span></div>
              <div class="info-item"><span class="info-label">Visit ID</span><span class="info-value">#${selectedVisit.visitUid || 'N/A'}</span></div>
              <div class="info-item"><span class="info-label">Ref. Doctor</span><span class="info-value">${selectedVisit.doctor?.fullname || 'N/A'}</span></div>
            </div>
          </div>

          <div class="results-flex-container">
            ${(() => {
          const resultsArray = allResults.map((result) => {
            const fieldCount = (result.detailedResults && result.detailedResults.length > 0)
              ? result.detailedResults.length
              : Object.keys(result.results || {}).length;

            const weight = fieldCount + 2 + (result.additionalNotes ? 1.5 : 0);

            const rows = (() => {
              if (result.detailedResults && result.detailedResults.length > 0) {
                return result.detailedResults.map((test) => {
                  const value = test.result;
                  if (value === undefined || value === null || value === '') return '';
                  const unit = test.unit ? ` ${test.unit}` : '';
                  return `<tr><td class="param-name">${test.testName || test.label || 'N/A'}</td><td class="param-value">${value}${unit}</td></tr>`;
                }).join('');
              } else if (result.results) {
                return Object.entries(result.results).map(([field, value]) => {
                  if (value === null || value === undefined || value === '') return '';
                  const fieldLabelMap = { 'pus_cells': 'WBC', 'wbc': 'WBC' };
                  const displayFieldName = fieldLabelMap[field] || field;
                  return `<tr><td class="param-name">${displayFieldName}</td><td class="param-value">${value}</td></tr>`;
                }).join('');
              }
              return '';
            })();

            const html = `
                  <div class="test-group">
                    <div class="test-group-header">${result.serviceName}</div>
                    <table class="result-table"><tbody>${rows}</tbody></table>
                    ${result.resultText ? `<div class="notes-box"><strong>Result:</strong> ${result.resultText}</div>` : ''}
                    ${result.additionalNotes ? `<div class="notes-box"><strong>Note:</strong> ${result.additionalNotes}</div>` : ''}
                  </div>
                `;
            return { weight, html };
          });

          let col1 = [], col2 = [];
          let weight1 = 0, weight2 = 0;

          resultsArray.sort((a, b) => b.weight - a.weight).forEach(item => {
            if (weight1 <= weight2) {
              col1.push(item.html);
              weight1 += item.weight;
            } else {
              col2.push(item.html);
              weight2 += item.weight;
            }
          });

          return `<div class="column">${col1.join('')}</div><div class="column">${col2.join('')}</div>`;
        })()}
          </div>

          <div class="footer">
            <div class="signature-box"><div class="signature-line">Lab Technician</div><div style="font-weight: bold; font-size: 10pt;">${labTechnicianName}</div></div>
            <div class="signature-box"><div style="height: 40px;"></div></div>
            <div class="signature-box"><div class="signature-line">Authorized Signature</div></div>
          </div>

          <div class="print-footer">
            Computer Generated Report • ${window.__CS__?.name || 'Clinic'} • ${formatDateTime(currentDate)}
          </div>
        </body>
      </html>
    `;
      printWindow.document.write(labContent);
      printWindow.document.close();
      setTimeout(() => { printWindow.print(); }, 800);
      toast.success('Opening print preview...');
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Failed to print lab results');
    }
  };

  // Print Radiology Results - Matching RadiologyOrders.jsx style
  const handlePrintRadiologyResults = async () => {
    const radiologyResults = selectedVisit?.radiologyResults || selectedVisit?.radiologyOrders || [];
    if (!selectedVisit || !patientHistory || radiologyResults.length === 0) {
      toast.error('No radiology results to print');
      return;
    }

    try {
      const patient = patientHistory.patient;
      const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const patientAge = patient?.dob ? calculateAge(patient.dob) : 'N/A';
      const patientBloodType = patient?.bloodType || 'N/A';

      const firstResult = radiologyResults[0];
      const radiologistName = firstResult?.radiologistUser?.fullname || firstResult?.radiologistUser || 'Radiologist';

      const printWindow = window.open('', '_blank');
      const radiologyContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Radiology Report - ${patient.name || 'Patient'}</title>
          <style>
            @media print {
              @page { 
                size: A4;
                margin: 5mm;
              }
              body { margin: 0; padding: 0; background: white !important; visibility: visible !important; display: block !important; zoom: 90%; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color: black !important; }
              .header { border-bottom: 2px solid black !important; margin-bottom: 10px !important; padding-bottom: 5px !important; }
              .test-header { border-left: 4px solid black !important; color: black !important; margin-bottom: 8px !important; font-size: 12pt !important; }
              .test-group { margin-bottom: 15px !important; padding-bottom: 10px !important; page-break-inside: avoid; }
              .footer { margin-top: 15px !important; }
              .no-print { display: none !important; }
            }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 0; 
              padding: 10px;
              color: #333;
              line-height: 1.3;
              font-size: 10pt;
            }
            .no-print {
              text-align: center;
              padding: 10px;
              background: #f8f9fa;
              margin-bottom: 15px;
              border-bottom: 1px solid #dee2e6;
            }
            .no-print button {
              background: #2563eb;
              color: white;
              border: none;
              padding: 8px 20px;
              border-radius: 5px;
              cursor: pointer;
              font-size: 14px;
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
            .header-left { display: flex; align-items: center; gap: 15px; }
            .logo { width: 70px; height: 70px; object-fit: contain; }
            .clinic-info { text-align: left; }
            .clinic-name { font-size: 24px; font-weight: 800; margin: 0; color: #1e40af; letter-spacing: -0.5px; }
            .clinic-tagline { font-size: 12px; color: #64748b; margin: 0; font-style: italic; }
            .header-right { text-align: right; }
            .report-title { font-size: 20px; font-weight: 700; margin: 0; color: #0f172a; text-transform: uppercase; }
            .report-info { font-size: 12px; color: #64748b; margin-top: 2px; }

            .patient-section {
              margin-bottom: 15px;
              padding: 10px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              font-size: 10pt;
            }
            .section-header {
              font-size: 12px;
              font-weight: 700;
              margin-bottom: 8px;
              color: #1e293b;
              border-bottom: 1px solid #cbd5e1;
              padding-bottom: 3px;
              text-transform: uppercase;
            }
            .patient-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
            }
            .info-item { display: flex; flex-direction: column; }
            .info-label { font-weight: 600; color: #64748b; font-size: 10px; text-transform: uppercase; }
            .info-value { color: #1e293b; font-weight: 500; font-size: 11px; }

            .report-content { margin-top: 15px; }
            .test-group {
              margin-bottom: 35px;
              padding-bottom: 20px;
              border-bottom: 1px solid #e2e8f0;
              break-inside: avoid;
            }
            .test-group:last-child { border-bottom: none; }
            .test-header {
              font-size: 14pt;
              font-weight: 700;
              color: #1e40af;
              margin-bottom: 12px;
              text-transform: uppercase;
              border-left: 4px solid #1e40af;
              padding-left: 10px;
            }
            .result-section { margin-top: 12px; margin-left: 14px; }
            .section-label { font-weight: 700; color: #475569; font-size: 11pt; text-transform: uppercase; display: block; margin-bottom: 5px; }
            .section-value { color: #1e293b; font-size: 11pt; line-height: 1.5; white-space: pre-wrap; display: block; text-align: justify; }
            .notes-box {
              margin-top: 10px;
              padding: 8px 12px;
              background-color: #fffbeb;
              border-left: 3px solid #f59e0b;
              font-size: 10pt;
              font-style: italic;
              color: #92400e;
            }

            .footer {
              margin-top: 20px;
              padding-top: 15px;
              border-top: 2px solid #e2e8f0;
              display: flex;
              justify-content: space-between;
              font-size: 10pt;
            }
            .signature-box { text-align: center; min-width: 180px; }
            .signature-line {
              border-top: 1px solid #334155;
              margin-top: 45px;
              padding-top: 5px;
              font-size: 11px;
              font-weight: 600;
              color: #475569;
            }
            .print-footer {
              text-align: center;
              font-size: 9px;
              color: #94a3b8;
              margin-top: 30px;
              border-top: 1px dashed #e2e8f0;
              padding-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="no-print"><button onclick="window.print()">Print Report</button></div>
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
              <div class="report-info">Date: ${currentDate} | Time: ${currentTime}</div>
            </div>
          </div>

          <div class="patient-section">
            <div class="section-header">Patient Information</div>
            <div class="patient-grid">
              <div class="info-item"><span class="info-label">Full Name</span><span class="info-value">${patient.name || 'N/A'}</span></div>
              <div class="info-item"><span class="info-label">Patient ID</span><span class="info-value">#${patient.id || 'N/A'}</span></div>
              <div class="info-item"><span class="info-label">Gender</span><span class="info-value">${patient.gender || 'N/A'}</span></div>
              <div class="info-item"><span class="info-label">Age</span><span class="info-value">${patientAge}</span></div>
              <div class="info-item"><span class="info-label">Blood Type</span><span class="info-value">${patientBloodType}</span></div>
              <div class="info-item"><span class="info-label">Visit ID</span><span class="info-value">#${selectedVisit.visitUid || 'N/A'}</span></div>
              <div class="info-item"><span class="info-label">Ref. Doctor</span><span class="info-value">${selectedVisit.doctor?.fullname || 'N/A'}</span></div>
            </div>
          </div>

          <div class="report-content">
            ${radiologyResults.map(result => `
              <div class="test-group">
                <div class="test-header">${result.testType?.name || result.serviceName || 'Radiology Test'}</div>
                
                ${result.findings ? `
                  <div class="result-section">
                    <span class="section-label">Findings:</span>
                    <span class="section-value">${result.findings}</span>
                  </div>
                ` : ''}
                
                ${result.conclusion ? `
                  <div class="result-section">
                    <span class="section-label">Conclusion:</span>
                    <span class="section-value">${result.conclusion}</span>
                  </div>
                ` : ''}
                
                ${result.additionalNotes || result.notes ? `
                  <div class="notes-box">
                    <strong>Notes:</strong> ${result.additionalNotes || result.notes}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>

          <div class="footer">
            <div class="signature-box"><div class="signature-line">Radiologist Signature</div><div style="font-weight: bold; font-size: 10pt;">${radiologistName}</div></div>
            <div class="signature-box"><div style="height: 40px;"></div></div>
            <div class="signature-box"><div class="signature-line">Authorized Signature</div></div>
          </div>

          <div class="print-footer">
            Computer Generated Report • ${window.__CS__?.name || 'Clinic'} • ${currentDate} ${currentTime}
          </div>
        </body>
      </html>
    `;
      printWindow.document.write(radiologyContent);
      printWindow.document.close();
      setTimeout(() => { printWindow.print(); }, 800);
      toast.success('Opening print preview...');
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Failed to print radiology results');
    }
  };

  return (
    <div className="p-6">
      {!selectedPatient ? (
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Print Lab, Radiology & Medications</h1>

          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by name, phone, or patient ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchPatients()}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={searchPatients}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Search className="h-5 w-5" />
                Search
              </button>
            </div>
          </div>

          {patients.length > 0 && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-4 bg-gray-50 border-b">
                <h2 className="font-semibold">Search Results</h2>
              </div>
              <div className="divide-y">
                {patients.map((patient) => (
                  <div
                    key={patient.id}
                    onClick={() => handlePatientSelect(patient)}
                    className="p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{patient.name}</div>
                      <div className="text-sm text-gray-600">
                        {patient.mobile && <><Phone className="inline h-4 w-4 mr-1" />{patient.mobile}</>}
                        <span className="ml-4">ID: {patient.id}</span>
                      </div>
                    </div>
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <button
            onClick={clearPatientSelection}
            className="mb-4 flex items-center gap-2 text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Search
          </button>

          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold mb-2">{selectedPatient.name}</h2>
            <div className="text-sm text-gray-600">
              <span>ID: {selectedPatient.id}</span>
              {selectedPatient.mobile && <span className="ml-4">Phone: {selectedPatient.mobile}</span>}
            </div>
          </div>

          {patientHistory?.visits && patientHistory.visits.length > 0 ? (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="mb-4">
                <p className="text-xs font-medium mb-2 text-gray-600">SELECT VISIT</p>
                <div className="flex overflow-x-auto space-x-2 pb-2">
                  {patientHistory.visits.map((visit) => (
                    <button
                      key={visit.id}
                      onClick={() => {
                        setSelectedVisitId(visit.id);
                        setActiveTab('medications');
                      }}
                      className={`px-4 py-2 rounded-lg border transition whitespace-nowrap text-sm font-medium ${selectedVisitId === visit.id
                        ? 'text-white'
                        : 'bg-white hover:border-gray-400'
                        }`}
                      style={{
                        backgroundColor: selectedVisitId === visit.id ? '#2e13d1' : 'white',
                        borderColor: selectedVisitId === visit.id ? '#2e13d1' : '#E5E7EB',
                        color: selectedVisitId === visit.id ? 'white' : '#0C0E0B'
                      }}
                    >
                      <div>{visit.visitUid}</div>
                      <div className={`text-xs ${selectedVisitId === visit.id ? 'text-white' : 'text-gray-500'}`}>
                        {new Date(visit.createdAt || visit.date).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedVisit && (
                <div>
                  <div className="flex gap-2 mb-4 border-b">
                    <button
                      onClick={() => setActiveTab('medications')}
                      className={`px-4 py-2 ${activeTab === 'medications' ? 'border-b-2 border-blue-600 text-blue-600' : ''}`}
                    >
                      <Pill className="inline h-4 w-4 mr-2" />
                      Medications
                    </button>
                    <button
                      onClick={() => setActiveTab('lab')}
                      className={`px-4 py-2 ${activeTab === 'lab' ? 'border-b-2 border-blue-600 text-blue-600' : ''}`}
                    >
                      <TestTube className="inline h-4 w-4 mr-2" />
                      Lab Results
                    </button>
                    <button
                      onClick={() => setActiveTab('radiology')}
                      className={`px-4 py-2 ${activeTab === 'radiology' ? 'border-b-2 border-blue-600 text-blue-600' : ''}`}
                    >
                      <Scan className="inline h-4 w-4 mr-2" />
                      Radiology
                    </button>
                    <button
                      onClick={() => setActiveTab('emergency')}
                      className={`px-4 py-2 ${activeTab === 'emergency' ? 'border-b-2 border-blue-600 text-blue-600' : ''}`}
                    >
                      <AlertTriangle className="inline h-4 w-4 mr-2" />
                      Emergency Meds
                    </button>
                    <button
                      onClick={() => setActiveTab('compound')}
                      className={`px-4 py-2 ${activeTab === 'compound' ? 'border-b-2 border-blue-600 text-blue-600' : ''}`}
                    >
                      <FileText className="inline h-4 w-4 mr-2" />
                      Compound Rx
                    </button>
                    <button
                      onClick={() => setActiveTab('billings')}
                      className={`px-4 py-2 ${activeTab === 'billings' ? 'border-b-2 border-blue-600 text-blue-600' : ''}`}
                    >
                      <DollarSign className="inline h-4 w-4 mr-2" />
                      Billings
                    </button>
                  </div>

                  {activeTab === 'medications' && (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Medications</h3>
                        {((selectedVisit.medications?.length > 0) || (selectedVisit.medicationOrders?.length > 0)) && (
                          <button
                            onClick={handlePrintMedications}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            <Printer className="h-4 w-4" />
                            Print
                          </button>
                        )}
                      </div>
                      {((selectedVisit.medications || selectedVisit.medicationOrders) || []).length > 0 ? (
                        <div className="space-y-3">
                          {(selectedVisit.medications || selectedVisit.medicationOrders || []).map((med) => {
                            const name = formatMedicationName(med.medication?.name || med.medicationCatalog?.name || med.name || 'Unknown', med.strength);
                            const instruction = formatMedicationInstruction(med);
                            return (
                              <div key={med.id} className="p-4 border rounded-lg bg-gray-50 hover:bg-white transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="font-semibold text-blue-900">{name}</div>
                                  <div className="text-xs font-bold px-2 py-1 bg-blue-100 text-blue-700 rounded-full border border-blue-200 uppercase">
                                    QTY: {med.quantity}
                                  </div>
                                </div>
                                <div className="text-sm text-gray-700 bg-white p-2 border rounded border-gray-100 flex items-center gap-2">
                                  <span className="font-bold text-blue-600 uppercase text-[10px]">Sig:</span>
                                  {resolveMedicationInstruction(med) || instruction}
                                </div>
                                {resolveMedicationInstruction(med) && (
                                  <div className="text-[12px] text-gray-500 mt-2 flex items-start gap-1">
                                    <span className="font-semibold text-gray-400">Doctor Notes:</span>
                                    <span className="italic">{resolveMedicationInstruction(med)}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-gray-500">No medications for this visit</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'lab' && (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Lab Results</h3>
                        {((selectedVisit.labResults?.length > 0) || (selectedVisit.labOrders?.length > 0) || (selectedVisit.labTestOrders?.length > 0)) && (
                          <button
                            onClick={handlePrintLabResults}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            <Printer className="h-4 w-4" />
                            Print
                          </button>
                        )}
                      </div>
                      {((selectedVisit.labResults || selectedVisit.labOrders || selectedVisit.labTestOrders) || []).length > 0 ? (
                        <div className="space-y-4">
                          {(selectedVisit.labResults || selectedVisit.labOrders || selectedVisit.labTestOrders || []).map((result, index) => {
                            const testName = result.labTest?.name || result.testType?.name || result.type?.name || result.serviceName || 'Lab Test';
                            const status = result.status || 'PENDING';
                            const detailedResults = result.detailedResults || [];
                            return (
                              <div key={result.id || index} className="p-4 border rounded-lg">
                                <div className="flex justify-between items-start mb-3">
                                  <h4 className="font-medium text-lg">{testName}</h4>
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                    status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                    {status}
                                  </span>
                                </div>
                                {detailedResults.length > 0 ? (
                                  <div className="mt-3 overflow-x-auto">
                                    <table className="w-full text-sm border">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-3 py-2 text-left border">Test Name</th>
                                          <th className="px-3 py-2 text-left border">Result</th>
                                          <th className="px-3 py-2 text-left border">Unit</th>
                                          <th className="px-3 py-2 text-left border">Reference Range</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {detailedResults.map((test, idx) => (
                                          <tr key={idx}>
                                            <td className="px-3 py-2 border">{test.testName || 'N/A'}</td>
                                            <td className="px-3 py-2 font-semibold border">{test.result || 'N/A'}</td>
                                            <td className="px-3 py-2 border">{test.unit || '-'}</td>
                                            <td className="px-3 py-2 border">{test.referenceRange || 'N/A'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : result.resultText ? (
                                  <div className="mt-3 p-3 rounded bg-yellow-50">
                                    <p className="text-sm">{result.resultText}</p>
                                  </div>
                                ) : (
                                  <div className="mt-3 p-3 rounded bg-yellow-50">
                                    <p className="text-sm italic">Lab test was ordered but detailed results have not been entered yet.</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-gray-500">No lab results for this visit</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'radiology' && (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Radiology Results</h3>
                        {((selectedVisit.radiologyResults?.length > 0) || (selectedVisit.radiologyOrders?.length > 0)) && (
                          <button
                            onClick={handlePrintRadiologyResults}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            <Printer className="h-4 w-4" />
                            Print
                          </button>
                        )}
                      </div>
                      {((selectedVisit.radiologyResults || selectedVisit.radiologyOrders) || []).length > 0 ? (
                        <div className="space-y-4">
                          {(selectedVisit.radiologyResults || selectedVisit.radiologyOrders || []).map((result, index) => {
                            const testName = result.testType?.name || result.serviceName || 'Radiology Test';
                            return (
                              <div key={result.id || index} className="p-4 border rounded-lg">
                                <h4 className="font-medium text-lg mb-3">{testName}</h4>
                                {result.findings && (
                                  <div className="mt-3 p-3 rounded bg-blue-50">
                                    <p className="text-sm font-semibold mb-1">Findings:</p>
                                    <p className="text-sm">{result.findings}</p>
                                  </div>
                                )}
                                {result.conclusion && (
                                  <div className="mt-3 p-3 rounded bg-green-50">
                                    <p className="text-sm font-semibold mb-1">Conclusion:</p>
                                    <p className="text-sm">{result.conclusion}</p>
                                  </div>
                                )}
                                {result.notes && (
                                  <div className="mt-3 text-sm text-gray-600">
                                    <strong>Notes:</strong> {result.notes}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-gray-500">No radiology results for this visit</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'emergency' && (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Emergency Medications</h3>
                        {selectedVisit.emergencyOrders?.length > 0 && (
                          <button
                            onClick={handlePrintEmergency}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            <Printer className="h-4 w-4" />
                            Print
                          </button>
                        )}
                      </div>
                      {selectedVisit.emergencyOrders?.length > 0 ? (
                        <div className="space-y-3">
                          {selectedVisit.emergencyOrders.map((order) => {
                            const name = formatMedicationName(order.serviceName || order.name, order.strength);
                            const instruction = formatEmergencyInstruction(order);
                            return (
                              <div key={order.id} className="p-4 border rounded-lg bg-gray-50 hover:bg-white transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                  <div className="font-semibold text-blue-900">{name}</div>
                                  <div className="text-xs font-bold px-2 py-1 bg-blue-100 text-blue-700 rounded-full border border-blue-200 uppercase">
                                    QTY: {order.quantity}
                                  </div>
                                </div>
                                <div className="text-sm text-gray-700 bg-white p-2 border rounded border-gray-100 flex items-center gap-2">
                                  <span className="font-bold text-blue-600 uppercase text-[10px]">Sig:</span>
                                  {instruction.instruction}
                                </div>
                                {(instruction.special || order.notes) && (
                                  <div className="text-[12px] text-gray-500 mt-2 flex items-start gap-1">
                                    <span className="font-semibold text-gray-400">Notes:</span>
                                    <span className="italic">{instruction.special || order.notes}</span>
                                  </div>
                                )}
                                {order.doctor && (
                                  <div className="text-[10px] text-gray-400 mt-3 text-right">
                                    Ordered by Dr. {order.doctor}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-gray-500">No emergency medications for this visit</p>
                      )}
                    </div>
                  )}

                  {activeTab === 'billings' && (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Billings & Procedures</h3>
                      </div>
                      {selectedVisit.bills?.length > 0 ? (
                        <div className="space-y-4">
                          {selectedVisit.bills.map((billing) => (
                            <div key={billing.id} className="p-4 border rounded-lg bg-gray-50 hover:bg-white transition-colors">
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <span className="font-semibold text-gray-900 block">Billing #{billing.id.substring(0, 8)}</span>
                                  <span className="text-sm text-gray-500">{new Date(billing.createdAt).toLocaleString()}</span>
                                </div>
                                <div className="text-right flex flex-col items-end gap-2">
                                  <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${billing.status === 'PAID' ? 'bg-green-100 text-green-800' :
                                    billing.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-blue-100 text-blue-800'
                                    }`}>
                                    {billing.status}
                                  </span>
                                  <button
                                    onClick={() => handlePrintBilling(billing)}
                                    className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                  >
                                    <Printer className="h-3 w-3" />
                                    Print Receipt
                                  </button>
                                </div>
                              </div>
                              <div className="mt-3 overflow-x-auto">
                                <table className="w-full text-sm border-t border-b border-gray-200">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-xs text-gray-600 font-semibold border-b">Service Description</th>
                                      <th className="px-3 py-2 text-center text-xs text-gray-600 font-semibold border-b">Qty</th>
                                      <th className="px-3 py-2 text-right text-xs text-gray-600 font-semibold border-b">Amount (ETB)</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(billing.services || []).map((service, idx) => (
                                      <tr key={idx} className="border-b last:border-b-0">
                                        <td className="px-3 py-2 text-gray-800">{service.service?.name || service.name || 'Service'}</td>
                                        <td className="px-3 py-2 text-center text-gray-800">{service.quantity || 1}</td>
                                        <td className="px-3 py-2 text-right font-medium text-gray-900">
                                          {(service.totalPrice || (service.unitPrice * (service.quantity || 1)) || 0).toLocaleString()}
                                        </td>
                                      </tr>
                                    ))}

                                    {activeTab === 'compound' && (
                                      <div>
                                        <div className="flex justify-between items-center mb-4">
                                          <h3 className="text-lg font-semibold">Compound Prescriptions</h3>
                                          {(selectedVisit.compoundPrescriptions?.length > 0) && (
                                            <button
                                              onClick={handlePrintCompound}
                                              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                            >
                                              <Printer className="h-4 w-4" />
                                              Print
                                            </button>
                                          )}
                                        </div>
                                        {selectedVisit.compoundPrescriptions?.length > 0 ? (
                                          <div className="space-y-3">
                                            {selectedVisit.compoundPrescriptions.map((cp, idx) => (
                                              <div key={cp.id || idx} className="p-4 border rounded-lg bg-gray-50">
                                                <div className="font-semibold text-blue-900">#{idx + 1} {cp.referenceNumber ? `(${cp.referenceNumber})` : ''}</div>
                                                <div className="text-sm text-gray-700 mt-2 whitespace-pre-wrap font-mono">
                                                  {cp.prescriptionText || cp.rawText || cp.instructions || 'No details'}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-gray-500">No compound prescriptions for this visit</p>
                                        )}
                                      </div>
                                    )}
                                  </tbody>
                                  <tfoot className="bg-gray-50">
                                    <tr>
                                      <td colSpan="2" className="px-3 py-2 text-right font-bold text-gray-900">Total Amount</td>
                                      <td className="px-3 py-2 text-right font-bold text-blue-700">ETB {(billing.totalAmount || 0).toLocaleString()}</td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500">No billings found for this visit</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
              No visits found for this patient
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BillingPatientHistory;
