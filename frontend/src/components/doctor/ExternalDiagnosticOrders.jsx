import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Edit2, FilePlus2, Printer, Save, Trash2, X } from 'lucide-react';
import api from '../../services/api';

const buildInitialForm = (requestedByName = '') => ({
  requestedByName,
  examinations: [''],
  relevantClinicalData: '',
  diagnosis: ''
});

const normalizeRequestedBy = (currentUser) => {
  return String(currentUser?.fullname || currentUser?.username || '').trim();
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

const getSpecialtyLabel = (specialty) => {
    const labels = {
      general: 'General Doctor', dentist: 'Dentist', dermatology: 'Dermato-venereologist',
      healthOfficer: 'Health Officer (HO)', obgyn: 'OB/GYN', pediatrician: 'Pediatrician',
      internist: 'Internist', surgeon: 'Surgeon', orthopedic: 'Orthopedic',
      physiotherapist: 'Physiotherapist'
    };
    return labels[specialty] || null;
  };

  const getDoctorQualificationLabel = (doctorData) => {
    const specialtyLabel = getSpecialtyLabel(doctorData?.specialty);
    if (specialtyLabel) return specialtyLabel;

    const role = String(doctorData?.role || '').toUpperCase();
    const qualifications = Array.isArray(doctorData?.qualifications)
      ? doctorData.qualifications
      : [];
    const normalizedQualifications = qualifications.map((q) => String(q || '').toUpperCase());

    if (
      role.includes('HEALTH_OFFICER') || role === 'HO' ||
      normalizedQualifications.some((q) => q.includes('HEALTH OFFICER') || q.includes('HEALTH_OFFICER') || q === 'HO')
    ) {
      return 'Health Officer (HO)';
    }

    if (role.includes('DERM') || normalizedQualifications.some((q) => q.includes('DERM'))) {
      return 'Dermato-venereologist';
    }

    return qualifications.join(', ') || 'General Practitioner';
  };

const getDoctorDisplayName = (doctorData, fallbackName = '') => {
  const rawName = String(
    doctorData?.fullname || doctorData?.fullName || doctorData?.name || fallbackName || ''
  ).trim();
  if (!rawName) return 'Attending Doctor';

  const role = String(doctorData?.role || '').toUpperCase();
  const qualifications = Array.isArray(doctorData?.qualifications)
    ? doctorData.qualifications
    : [];
  const normalizedQualifications = qualifications.map((q) => String(q || '').toUpperCase());
  const isHealthOfficer =
    role.includes('HEALTH_OFFICER') ||
    role === 'HO' ||
    normalizedQualifications.some((q) => q.includes('HEALTH OFFICER') || q.includes('HEALTH_OFFICER') || q === 'HO');

  if (/^(dr|mr)\.?\s+/i.test(rawName)) return rawName;
  return isHealthOfficer ? `Mr. ${rawName}` : `Dr. ${rawName}`;
};

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const ExternalDiagnosticOrders = ({
  type,
  visitId,
  patient,
  currentUser,
  orders,
  onUpdated,
  disabled = false,
  hideCreate = false
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(() => buildInitialForm(normalizeRequestedBy(currentUser)));

  const typeLabel = type === 'RADIOLOGY' ? 'Radiology' : 'Lab';
  const sectionTitle = `External ${typeLabel} Orders`;
  const patientAge = patient?.age || (patient?.dob ? calculateAge(patient.dob) : 'N/A');
  const currentDate = new Date().toLocaleDateString();

  const filteredOrders = useMemo(
    () => (Array.isArray(orders) ? orders.filter((item) => item.type === type) : []),
    [orders, type]
  );

  useEffect(() => {
    if (!editingOrderId) {
      setForm(buildInitialForm(normalizeRequestedBy(currentUser)));
    }
  }, [currentUser, editingOrderId]);

  const resetForm = () => {
    setEditingOrderId(null);
    setForm(buildInitialForm(normalizeRequestedBy(currentUser)));
    setIsFormOpen(false);
  };

  const openCreateForm = () => {
    setEditingOrderId(null);
    setForm(buildInitialForm(normalizeRequestedBy(currentUser)));
    setIsFormOpen(true);
  };

  const openEditForm = (order) => {
    setEditingOrderId(order.id);
    setForm({
      requestedByName: order.requestedByName || normalizeRequestedBy(currentUser),
      examinations: Array.isArray(order.examinations) && order.examinations.length > 0 ? order.examinations : [''],
      relevantClinicalData: order.relevantClinicalData || '',
      diagnosis: order.diagnosis || ''
    });
    setIsFormOpen(true);
  };

  const updateExamLine = (index, value) => {
    setForm((prev) => ({
      ...prev,
      examinations: prev.examinations.map((item, itemIndex) => (itemIndex === index ? value : item))
    }));
  };

  const addExamLine = () => {
    setForm((prev) => ({
      ...prev,
      examinations: [...prev.examinations, '']
    }));
  };

  const removeExamLine = (index) => {
    setForm((prev) => {
      const next = prev.examinations.filter((_, itemIndex) => itemIndex !== index);
      return {
        ...prev,
        examinations: next.length > 0 ? next : ['']
      };
    });
  };

  const submitForm = async (event) => {
    event.preventDefault();

    const examinations = form.examinations.map((item) => item.trim()).filter(Boolean);
    if (!examinations.length) {
      toast.error('Add at least one examination');
      return;
    }

    const payload = {
      type,
      requestedByName: form.requestedByName.trim(),
      examinations,
      relevantClinicalData: form.relevantClinicalData.trim(),
      diagnosis: form.diagnosis.trim()
    };

    if (!payload.requestedByName) {
      toast.error('Requested by is required');
      return;
    }

    try {
      setIsSaving(true);
      if (editingOrderId) {
        await api.patch(`/doctors/external-diagnostic-orders/${editingOrderId}`, payload);
        toast.success(`External ${typeLabel.toLowerCase()} order updated`);
      } else {
        await api.post(`/doctors/visits/${visitId}/external-diagnostic-orders`, payload);
        toast.success(`External ${typeLabel.toLowerCase()} order created`);
      }
      resetForm();
      await onUpdated?.();
    } catch (error) {
      console.error(`Error saving external ${typeLabel.toLowerCase()} order:`, error);
      toast.error(error.response?.data?.error || `Failed to save external ${typeLabel.toLowerCase()} order`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (order) => {
    if (!window.confirm(`Delete this external ${typeLabel.toLowerCase()} order?`)) return;

    try {
      await api.delete(`/doctors/external-diagnostic-orders/${order.id}`);
      toast.success(`External ${typeLabel.toLowerCase()} order deleted`);
      await onUpdated?.();
    } catch (error) {
      console.error(`Error deleting external ${typeLabel.toLowerCase()} order:`, error);
      toast.error(error.response?.data?.error || `Failed to delete external ${typeLabel.toLowerCase()} order`);
    }
  };

  const printOrder = (order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Unable to open print window');
      return;
    }

    const examLines = (order.examinations || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    const patientName = String(patient?.name || '').toUpperCase() || 'N/A';
    const requestedBy = escapeHtml(order.requestedByName || normalizeRequestedBy(currentUser) || 'N/A');
    const doctorData = order?.doctor || currentUser || {};
    const printableDoctorName = getDoctorDisplayName(doctorData, order.requestedByName || normalizeRequestedBy(currentUser));
    const printableDoctorQualification = getDoctorQualificationLabel(doctorData);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>External ${escapeHtml(typeLabel)} Order</title>
          <style>
            @media print { @page { size: A4; margin: 10mm; } }
            body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 20px; color: #1e293b; font-size: 12px; line-height: 1.5; }
            .logo { width: 45px; height: 45px; object-fit: contain; }
            .clinic-info { text-align: left; }
            .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; margin-bottom: 14px; border-bottom: 2px solid #2563eb; }
            .header-left { display: flex; align-items: center; gap: 10px; }
            .clinic-name { font-size: 14px; font-weight: 700; margin: 0; color: #1e40af; text-transform: uppercase; }
            .clinic-tagline { font-size: 9px; color: #64748b; margin: 0; font-style: italic; }
            .report-title { font-size: 15px; font-weight: 700; color: #0f172a; text-transform: uppercase; }
            .report-info { font-size: 9px; color: #64748b; margin-top: 2px; text-align: right; }
            .patient-section { margin-bottom: 14px; padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 11px; }
            .info-label { font-weight: 700; color: #64748b; }
            .section-title { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
            .exam-list { margin: 0; padding: 0; list-style: none; }
            .exam-list li { padding: 6px 10px; margin: 3px 0; background: #f8fafc; border-left: 3px solid #2563eb; border-radius: 2px; font-size: 11px; }
            .text-box { min-height: 50px; padding: 8px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; white-space: pre-wrap; font-size: 11px; }
            .footer { margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px; }
            .doctor-name { font-weight: 700; color: #1e293b; font-size: 11px; }
            .signature-box { width: 140px; border-top: 1px solid #334155; padding-top: 4px; text-align: center; font-size: 9px; color: #64748b; }
            .no-print { text-align: center; margin-top: 20px; }
            .no-print button { padding: 8px 20px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; margin: 0 5px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()">Print</button>
            <button onclick="window.close()">Close</button>
          </div>

          <div class="header">
            <div class="header-left">
              <img src="${window.__CS__?.logoUrl || '/clinic-logo.jpg'}" alt="Clinic Logo" class="logo" onerror="this.style.display='none'">
              <div class="clinic-info">
                <div class="clinic-name">${window.__CS__?.name || 'Clinic'}</div>
                <div class="clinic-tagline">${window.__CS__?.tagline || 'Health Facility'}</div>
              </div>
            </div>
            <div>
              <div class="report-title">External ${escapeHtml(typeLabel)} Order</div>
              <div class="report-info">${new Date(order.createdAt || Date.now()).toLocaleDateString()} ${new Date(order.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>

          <div class="patient-section">
            <div><span class="info-label">Patient:</span> ${escapeHtml(patientName)}</div>
            <div><span class="info-label">ID:</span> #${escapeHtml(patient?.id || 'N/A')}</div>
            <div><span class="info-label">Age:</span> ${escapeHtml(patientAge)}</div>
            <div><span class="info-label">Gender:</span> ${escapeHtml(patient?.gender || 'N/A')}</div>
            <div><span class="info-label">Phone:</span> ${escapeHtml(patient?.mobile || 'N/A')}</div>
            <div><span class="info-label">Doctor:</span> ${escapeHtml(printableDoctorName)}</div>
          </div>

          <div class="section-title">Examinations Required</div>
          <ul class="exam-list">${examLines || '<li style="border-left-color:#94a3b8;color:#94a3b8;">No examinations listed</li>'}</ul>

          <div style="margin-top:12px;">
            <div class="section-title">Relevant Clinical Data</div>
            <div class="text-box">${escapeHtml(order.relevantClinicalData || 'N/A')}</div>
          </div>

          <div style="margin-top:12px;">
            <div class="section-title">Diagnosis</div>
            <div class="text-box">${escapeHtml(order.diagnosis || 'N/A')}</div>
          </div>

          <div class="footer">
            <div>
              <div class="doctor-name">${escapeHtml(printableDoctorName)}</div>
              <div style="color:#64748b;">${escapeHtml(printableDoctorQualification)}</div>
            </div>
            <div class="signature-box">Signature &amp; Stamp</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="border rounded-xl p-4 bg-slate-50 mb-6" style={{ borderColor: '#E5E7EB' }}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div>
          <h4 className="text-base font-semibold" style={{ color: '#0C0E0B' }}>{sectionTitle}</h4>
          {!hideCreate && <p className="text-sm text-gray-600">Create, edit, delete, and print external {typeLabel.toLowerCase()} orders without billing.</p>}
        </div>
        {!disabled && !hideCreate && (
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium"
            style={{ backgroundColor: '#2563EB' }}
          >
            <FilePlus2 className="h-4 w-4" />
            External
          </button>
        )}
      </div>

      {!hideCreate && isFormOpen && (
        <form onSubmit={submitForm} className="border rounded-xl p-4 bg-white mb-4" style={{ borderColor: '#DBEAFE' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-4">
            <div className="p-3 rounded-lg bg-slate-50 border" style={{ borderColor: '#E5E7EB' }}>
              <span className="font-semibold text-gray-700">Patient Name:</span> <span className="font-bold">{String(patient?.name || 'N/A').toUpperCase()}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border" style={{ borderColor: '#E5E7EB' }}>
              <span className="font-semibold text-gray-700">Patient ID:</span> {patient?.id || 'N/A'}
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border" style={{ borderColor: '#E5E7EB' }}>
              <span className="font-semibold text-gray-700">Age:</span> {patientAge}
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border" style={{ borderColor: '#E5E7EB' }}>
              <span className="font-semibold text-gray-700">Sex:</span> {patient?.gender || 'N/A'}
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border md:col-span-2" style={{ borderColor: '#E5E7EB' }}>
              <span className="font-semibold text-gray-700">Date:</span> {currentDate}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Requested By</label>
            <input
              type="text"
              value={form.requestedByName}
              onChange={(event) => setForm((prev) => ({ ...prev, requestedByName: event.target.value }))}
              className="w-full px-3 py-2 border rounded-lg"
              style={{ borderColor: '#D1D5DB' }}
              placeholder="Doctor name"
            />
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Examinations Required</label>
              <button
                type="button"
                onClick={addExamLine}
                className="text-sm font-medium text-blue-700 hover:text-blue-900"
              >
                + Add line
              </button>
            </div>
            <div className="space-y-2">
              {form.examinations.map((examination, index) => (
                <div key={`${index}-${editingOrderId || 'new'}`} className="flex gap-2">
                  <input
                    type="text"
                    value={examination}
                    onChange={(event) => updateExamLine(index, event.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg"
                    style={{ borderColor: '#D1D5DB' }}
                    placeholder={`${typeLabel} examination ${index + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeExamLine(index)}
                    className="px-3 py-2 rounded-lg border text-red-700 hover:bg-red-50"
                    style={{ borderColor: '#FECACA' }}
                    disabled={form.examinations.length === 1}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Relevant Clinical Data</label>
            <textarea
              value={form.relevantClinicalData}
              onChange={(event) => setForm((prev) => ({ ...prev, relevantClinicalData: event.target.value }))}
              className="w-full px-3 py-2 border rounded-lg min-h-[100px]"
              style={{ borderColor: '#D1D5DB' }}
              placeholder="Relevant clinical data"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Diagnosis</label>
            <textarea
              value={form.diagnosis}
              onChange={(event) => setForm((prev) => ({ ...prev, diagnosis: event.target.value }))}
              className="w-full px-3 py-2 border rounded-lg min-h-[100px]"
              style={{ borderColor: '#D1D5DB' }}
              placeholder="Diagnosis"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium disabled:opacity-60"
              style={{ backgroundColor: '#059669' }}
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : editingOrderId ? 'Update External Order' : 'Save External Order'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border font-medium text-gray-700"
              style={{ borderColor: '#D1D5DB' }}
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </form>
      )}

      {filteredOrders.length === 0 ? (
        <div className="text-sm text-gray-500 italic">No external {typeLabel.toLowerCase()} orders saved for this visit.</div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <div key={order.id} className="border rounded-xl bg-white p-4" style={{ borderColor: '#E5E7EB' }}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">External {typeLabel}</span>
                    <span className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2"><span className="font-semibold">Requested By:</span> {order.requestedByName || 'N/A'}</p>
                  <div className="mb-2">
                    <p className="text-sm font-semibold text-gray-700">Examinations Required</p>
                    <ul className="mt-1 space-y-1 text-sm text-gray-700 list-disc list-inside">
                      {(order.examinations || []).map((item, index) => (
                        <li key={`${order.id}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  {order.relevantClinicalData && (
                    <p className="text-sm text-gray-700 mb-2"><span className="font-semibold">Relevant Clinical Data:</span> {order.relevantClinicalData}</p>
                  )}
                  {order.diagnosis && (
                    <p className="text-sm text-gray-700"><span className="font-semibold">Diagnosis:</span> {order.diagnosis}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => printOrder(order)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-blue-700 hover:bg-blue-50"
                    style={{ borderColor: '#BFDBFE' }}
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </button>
                  {!disabled && !hideCreate && (
                    <button
                      type="button"
                      onClick={() => openEditForm(order)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-amber-700 hover:bg-amber-50"
                      style={{ borderColor: '#FDE68A' }}
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit
                    </button>
                  )}
                  {!disabled && !hideCreate && (
                    <button
                      type="button"
                      onClick={() => handleDelete(order)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-red-700 hover:bg-red-50"
                      style={{ borderColor: '#FECACA' }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExternalDiagnosticOrders;