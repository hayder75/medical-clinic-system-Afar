import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Printer, Save, Beaker, AlertCircle, Bold, Italic, Underline, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

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

const CompoundPrescriptionBuilder = ({ visit, onSaved, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingPrescriptions, setExistingPrescriptions] = useState([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingPrescription, setEditingPrescription] = useState(null);

  const [formData, setFormData] = useState({
    prescriptionText: ''
  });

  useEffect(() => {
    if (visit?.id) {
      fetchExistingPrescriptions();
    }
  }, [visit]);

  const fetchExistingPrescriptions = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/compound-prescriptions/visit/${visit.id}`);
      setExistingPrescriptions(response.data.compoundPrescriptions || []);
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    if (!formData.prescriptionText.trim()) {
      toast.error('Please enter prescription details');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSaving(true);

      const payload = {
        visitId: visit.id,
        patientId: visit.patient.id,
        prescriptionText: formData.prescriptionText,
        rawText: formData.prescriptionText
      };

      if (editingPrescription) {
        await api.put(`/compound-prescriptions/${editingPrescription.id}`, payload);
        toast.success('Prescription updated successfully');
      } else {
        await api.post('/compound-prescriptions', payload);
        toast.success('Compound prescription created successfully');
      }

      setShowNewForm(false);
      setEditingPrescription(null);
      setFormData({ prescriptionText: '' });
      fetchExistingPrescriptions();
      if (onSaved) onSaved();
    } catch (error) {
      console.error('Error saving prescription:', error);
      toast.error(error.response?.data?.error || 'Failed to save prescription');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (prescription) => {
    setFormData({
      prescriptionText: prescription.prescriptionText || prescription.rawText || ''
    });
    setEditingPrescription(prescription);
    setShowNewForm(true);
  };

  const handleDelete = async (prescriptionId) => {
    if (!window.confirm('Are you sure you want to delete this prescription?')) return;
    try {
      await api.delete(`/compound-prescriptions/${prescriptionId}`);
      toast.success('Prescription deleted successfully');
      fetchExistingPrescriptions();
      if (onSaved) onSaved();
    } catch (error) {
      console.error('Error deleting prescription:', error);
      toast.error(error.response?.data?.error || 'Failed to delete prescription');
    }
  };

  const insertFormatting = (format) => {
    const textarea = document.getElementById('prescription-textarea');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.prescriptionText;
    const selectedText = text.substring(start, end);

    let formattedText = '';
    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        break;
      case 'underline':
        formattedText = `__${selectedText}__`;
        break;
      default:
        formattedText = selectedText;
    }

    const newText = text.substring(0, start) + formattedText + text.substring(end);
    setFormData({ ...formData, prescriptionText: newText });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 1, end + 1);
    }, 0);
  };

  const parseFormatting = (text) => {
    if (!text) return '';
    let parsed = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/__(.*?)__/g, '<u>$1</u>')
      .replace(/\n/g, '<br>');
    return parsed;
  };

  const toPrintablePatientName = (name) => {
    const normalized = String(name || '').trim();
    return normalized ? normalized.toUpperCase() : 'N/A';
  };

  const printAllPrescriptions = async () => {
    if (existingPrescriptions.length === 0) return;

    try {
      const firstPrescription = existingPrescriptions[0] || {};
      let patientData = firstPrescription.patient || visit?.patient;
      let doctorData = firstPrescription.doctor || visit?.doctor;

      const patientName = toPrintablePatientName(patientData?.name);
      const patientCardNumber = patientData?.id || 'N/A';
      const patientGender = (patientData?.gender?.charAt(0) || 'N/A').toUpperCase();
      const patientAge = patientData?.dob ? Math.floor((new Date() - new Date(patientData.dob)) / (365.25 * 24 * 60 * 60 * 1000)) : 'N/A';
      const fallbackDoctor = existingPrescriptions.find((p) => p?.doctor?.fullname)?.doctor;
      doctorData = doctorData || fallbackDoctor;
      const doctorName = getPrintableDoctorName(doctorData, visit?.doctor);
      const doctorQualification = getDoctorQualificationLabel(doctorData, visit?.doctor);

      const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Popup blocked! Please allow popups for this site.');
        return;
      }

      const prescriptionsHtml = existingPrescriptions.map((prescription, idx) => {
        const text = prescription.prescriptionText || prescription.rawText || '';
        const parsedText = parseFormatting(text);

        return `
          <div class="medication-item" style="page-break-inside: avoid;">
            <div class="medication-name">
              #${idx + 1}
            </div>
            <div class="medication-details">
              ${parsedText}
            </div>
          </div>
        `;
      }).join('');

      const content = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Compound Prescriptions</title>
            <style>
              @media print {
                @page { size: A6; margin: 0 !important; }
                html, body { margin: 0 !important; padding: 0 !important; background: white !important; visibility: visible !important; display: flex !important; flex-direction: column !important; align-items: center !important; overflow: visible !important; }
                * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color: black !important; }
                .no-print { display: none !important; }
                .prescription-container { width: 105mm !important; min-height: 148mm !important; margin: 0 auto !important; padding: 8mm !important; border: none !important; box-shadow: none !important; background: white !important; display: block !important; position: relative !important; overflow: hidden !important; box-sizing: border-box !important; visibility: visible !important; }
              }
              body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 20px; color: #333; line-height: 1.3; background: #f3f4f6; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
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
              .patient-info { margin-bottom: 12px; padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; }
              .patient-info span { font-weight: 700; color: #64748b; }
              .external-warning { background: #fee2e2; border: 1px solid #fecaca; color: #991b1b; padding: 6px 10px; border-radius: 4px; font-size: 10px; font-weight: bold; text-align: center; margin-bottom: 10px; }
              .medication-item { margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed #e2e8f0; width: 100%; }
              .medication-name { font-weight: 700; font-size: 12px; color: #0f172a; margin-bottom: 2px; }
              .medication-details { font-size: 11px; color: #334155; font-weight: 500; line-height: 1.6; }
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
                  <div class="report-info">Date: ${currentDate}<br>Time: ${currentTime}</div>
                </div>
              </div>

              <div class="patient-info">
                <div><span>Patient:</span> ${patientName}</div>
                <div><span>Card No:</span> #${patientCardNumber}</div>
                <div><span>Age/Sex:</span> ${typeof patientAge === 'number' ? patientAge + 'Y' : patientAge} / ${patientGender}</div>
                <div><span>Prescriptions:</span> ${existingPrescriptions.length}</div>
              </div>

              <div class="medications-section">
                <h3 style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">
                  Compound Prescription
                </h3>
              </div>

              ${prescriptionsHtml}

              <div class="footer">
                <div>
                  Prescribed by: <span class="doctor-name">${doctorName}</span>
                  <div style="font-size: 9px; color: #64748b;">${doctorQualification}</div>
                </div>
                <div class="signature-box">Doctor's Signature</div>
              </div>
            </div>
          </body>
        </html>`;

      printWindow.document.write(content);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Failed to print prescriptions');
    }
  };

  const printPrescription = async (prescription) => {
    try {
      let patientData = prescription.patient;
      let doctorData = prescription.doctor;

      if (!patientData && visit?.patient) {
        patientData = visit.patient;
        doctorData = visit.doctor;
      }

      const patientName = toPrintablePatientName(patientData?.name);
      const patientCardNumber = patientData?.id || 'N/A';
      const patientGender = (patientData?.gender?.charAt(0) || 'N/A').toUpperCase();
      const patientAge = patientData?.dob ? Math.floor((new Date() - new Date(patientData.dob)) / (365.25 * 24 * 60 * 60 * 1000)) : 'N/A';
      const doctorName = getPrintableDoctorName(doctorData, prescription.doctor || visit?.doctor);
      const doctorQualification = getDoctorQualificationLabel(doctorData, prescription.doctor || visit?.doctor);

      const currentDate = new Date(prescription.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const currentTime = new Date(prescription.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Popup blocked! Please allow popups for this site.');
        return;
      }

      const text = prescription.prescriptionText || prescription.rawText || '';
      const parsedText = parseFormatting(text);

      const content = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Prescription - ${patientName}</title>
            <style>
              @media print {
                @page { size: A6; margin: 0 !important; }
                html, body { margin: 0 !important; padding: 0 !important; background: white !important; visibility: visible !important; display: flex !important; flex-direction: column !important; align-items: center !important; overflow: visible !important; }
                * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color: black !important; }
                .no-print { display: none !important; }
                .prescription-container { width: 105mm !important; min-height: 148mm !important; margin: 0 auto !important; padding: 8mm !important; border: none !important; box-shadow: none !important; background: white !important; display: block !important; position: relative !important; overflow: hidden !important; box-sizing: border-box !important; visibility: visible !important; }
              }
              body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 20px; color: #333; line-height: 1.3; background: #f3f4f6; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
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
              .medication-details { font-size: 11px; color: #334155; font-weight: 500; line-height: 1.6; }
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
                <div><span class="info-label">Patient:</span> ${patientName}</div>
                <div><span class="info-label">Card No:</span> #${patientCardNumber}</div>
                <div><span class="info-label">Age/Sex:</span> ${typeof patientAge === 'number' ? patientAge + 'Y' : patientAge} / ${patientGender}</div>
                <div style="text-align: right;"><span class="info-label">Rx No:</span> ${prescription.referenceNumber}</div>
              </div>

              <div class="medications-section">
                <h3>Compound Prescription</h3>
                <div class="medication-item">
                  <div class="medication-details">${parsedText}</div>
                </div>
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
        </html>`;

      printWindow.document.write(content);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Failed to print prescription');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: '#0C0E0B' }}>
            Compound Prescriptions
          </h3>
          <p className="text-sm text-gray-600">
            Write compound prescription details
          </p>
        </div>
        {!showNewForm && (
          <button
            onClick={() => setShowNewForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>New Compound Prescription</span>
          </button>
        )}
      </div>

      {showNewForm && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="card p-4">
            <h4 className="font-semibold mb-4 flex items-center">
              <Beaker className="h-5 w-5 mr-2 text-blue-600" />
              Compound Prescription Details
            </h4>
            
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => insertFormatting('bold')}
                className="p-2 border border-gray-300 rounded hover:bg-gray-100"
                title="Bold"
              >
                <Bold className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('italic')}
                className="p-2 border border-gray-300 rounded hover:bg-gray-100"
                title="Italic"
              >
                <Italic className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => insertFormatting('underline')}
                className="p-2 border border-gray-300 rounded hover:bg-gray-100"
                title="Underline"
              >
                <Underline className="h-4 w-4" />
              </button>
              <span className="text-xs text-gray-500 ml-2">
                Use **text** for bold, *text* for italic, __text__ for underline
              </span>
            </div>

            <textarea
              id="prescription-textarea"
              value={formData.prescriptionText}
              onChange={(e) => setFormData({ ...formData, prescriptionText: e.target.value })}
              placeholder={`#1. Cream - 30g
Ingredients: Hydrocortisone 1%, Salicylic acid 3%
Base: Cream base
Directions: Apply thin layer to affected area twice daily for 2 weeks
Store at room temperature

#2. Ointment - 15g
Ingredients: Mometasone furoate 0.1%
Base: Petrolatum
Directions: Apply once daily at night
Keep container tightly closed`}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              rows={15}
            />

            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold">Formatting Tips:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Start each prescription with <strong>#1.</strong>, <strong>#2.</strong>, etc.</li>
                    <li>Press Enter for new lines (they will be preserved when printing)</li>
                    <li>Use <strong>**text**</strong> for <strong>bold</strong></li>
                    <li>Use <strong>*text*</strong> for <em>italic</em></li>
                    <li>Use <strong>__text__</strong> for <u>underline</u></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => {
                setShowNewForm(false);
                setEditingPrescription(null);
                setFormData({ prescriptionText: '' });
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Prescription</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {!showNewForm && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading prescriptions...</p>
            </div>
          ) : existingPrescriptions.length === 0 ? (
            <div className="card p-8 text-center">
              <Beaker className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No compound prescriptions for this visit</p>
              <p className="text-sm text-gray-500 mt-1">Click "New Compound Prescription" to create one</p>
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <button
                  onClick={printAllPrescriptions}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print All ({existingPrescriptions.length})</span>
                </button>
              </div>
              {existingPrescriptions.map((prescription, idx) => (
                <div key={prescription.id} className="border border-gray-200 rounded-lg p-3 mb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-blue-700">#{idx + 1}</span>
                        <span className="text-xs text-gray-400">({prescription.referenceNumber})</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1 whitespace-pre-wrap font-mono">
                        {prescription.prescriptionText || prescription.rawText}
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleEdit(prescription)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(prescription.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => printPrescription(prescription)}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                        title="Print"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CompoundPrescriptionBuilder;
