import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Trash2, Printer, Pill, CheckCircle, X, Save } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatEmergencyInstruction, formatMedicationName } from '../../utils/medicalStandards';
import { useAuth } from '../../contexts/AuthContext';

const DEFAULT_MEDICATION = {
  serviceId: null,
  name: '',
  strength: '',
  quantity: 1,
  unitPrice: 0,
  instructions: '',
  dosageForm: 'Tablet',
  dosage: '',
  frequency: '',
  frequencyPeriod: '',
  duration: '',
  durationPeriod: 'days',
  route: '',
  isCustom: false
};

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const EmergencyDrugOrdering = ({ visit, onOrdersPlaced }) => {
  const { user: currentUser } = useAuth();
  const [services, setServices] = useState([]);
  const [existingOrders, setExistingOrders] = useState([]);
  const [selectedMedications, setSelectedMedications] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [customMedication, setCustomMedication] = useState({
    name: '',
    strength: '',
    quantity: 1,
    unitPrice: '',
    instructions: '',
    dosageForm: 'Tablet',
    dosage: '',
    frequency: '',
    frequencyPeriod: '',
    duration: '',
    durationPeriod: 'days',
    route: ''
  });

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    fetchExistingOrders();
  }, [visit?.id]);

  const fetchServices = async () => {
    try {
      setFetchingData(true);
      const response = await api.get('/doctors/services?category=EMERGENCY_DRUG');
      const emergencyDrugs = (response.data.services || []).filter(
        (service) => service.category === 'EMERGENCY_DRUG' && service.isActive
      );
      setServices(emergencyDrugs);
    } catch (error) {
      console.error('Error fetching emergency drugs:', error);
      toast.error('Failed to fetch emergency drugs');
    } finally {
      setFetchingData(false);
    }
  };

  const fetchExistingOrders = async () => {
    if (!visit?.id) return;
    try {
      const response = await api.get(`/emergency/drugs?visitId=${visit.id}`);
      setExistingOrders(response.data.orders || []);
    } catch (error) {
      console.error('Error fetching existing emergency orders:', error);
    }
  };

  const filteredServices = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const base = services
      .filter((service) => {
        if (!q) return true;
        const name = (service.name || '').toLowerCase();
        const code = (service.code || '').toLowerCase();
        const description = (service.description || '').toLowerCase();
        return name.includes(q) || code.includes(q) || description.includes(q);
      })
      .slice(0, 60);
    return base;
  }, [services, searchTerm]);

  const addMedicationFromSearch = (service) => {
    const exists = selectedMedications.some((med) => med.serviceId === service.id);
    if (exists) {
      toast.error('Medication already added');
      return;
    }

    setSelectedMedications((prev) => [
      ...prev,
      {
        ...DEFAULT_MEDICATION,
        serviceId: service.id,
        name: service.name,
        unitPrice: Number(service.price) || 0
      }
    ]);
    setSearchTerm('');
  };

  const addCustomMedication = () => {
    const name = (customMedication.name || '').trim();
    if (!name) {
      toast.error('Please enter medication name');
      return;
    }

    const quantity = Math.max(1, parseInt(customMedication.quantity, 10) || 1);
    const unitPrice = Number(customMedication.unitPrice);

    setSelectedMedications((prev) => [
      ...prev,
      {
        ...DEFAULT_MEDICATION,
        isCustom: true,
        name,
        strength: customMedication.strength || '',
        quantity,
        unitPrice: Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 5,
        instructions: customMedication.instructions || '',
        dosageForm: customMedication.dosageForm || 'Tablet',
        dosage: customMedication.dosage || '',
        frequency: customMedication.frequency || '',
        frequencyPeriod: customMedication.frequencyPeriod || '',
        duration: customMedication.duration || '',
        durationPeriod: customMedication.durationPeriod || 'days',
        route: customMedication.route || ''
      }
    ]);

    setCustomMedication({
      name: '',
      strength: '',
      quantity: 1,
      unitPrice: '',
      instructions: '',
      dosageForm: 'Tablet',
      dosage: '',
      frequency: '',
      frequencyPeriod: '',
      duration: '',
      durationPeriod: 'days',
      route: ''
    });

    setShowCustomForm(false);
    toast.success('Custom emergency medication added');
  };

  const updateMedication = (index, field, value) => {
    setSelectedMedications((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: field === 'quantity' ? Math.max(1, parseInt(value, 10) || 1) : value
      };
      return updated;
    });
  };

  const removeMedication = (index) => {
    setSelectedMedications((prev) => prev.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return selectedMedications.reduce((sum, med) => {
      return sum + ((Number(med.unitPrice) || 0) * (Number(med.quantity) || 1));
    }, 0);
  };

  const handleSubmitOrder = async () => {
    if (selectedMedications.length === 0) {
      toast.error('Please add at least one emergency medication');
      return;
    }

    setLoading(true);
    try {
      for (const med of selectedMedications) {
        const payload = {
          visitId: visit?.id || null,
          patientId: visit?.patient?.id,
          quantity: Number(med.quantity) || 1,
          instructions: med.instructions || '',
          dosageForm: med.dosageForm || null,
          dosage: med.dosage || null,
          strength: med.strength || null,
          frequency: med.frequency || null,
          frequencyPeriod: med.frequencyPeriod || null,
          duration: med.duration || null,
          durationPeriod: med.durationPeriod || null,
          route: med.route || null
        };

        if (med.isCustom) {
          payload.customName = med.name;
          payload.customStrength = med.strength || '';
          payload.customUnitPrice = Number(med.unitPrice) || 5;
        } else {
          payload.serviceId = med.serviceId;
        }

        await api.post('/emergency/drugs', payload);
      }

      toast.success(`${selectedMedications.length} emergency medication(s) ordered`);
      setSelectedMedications([]);
      await fetchExistingOrders();
      if (onOrdersPlaced) onOrdersPlaced();
    } catch (error) {
      console.error('Error creating emergency medication orders:', error);
      toast.error(error.response?.data?.error || 'Failed to create emergency medication orders');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to delete this emergency medication order?')) return;
    try {
      setDeleteLoading(orderId);
      await api.delete(`/emergency/drug-order/${orderId}`);
      toast.success('Emergency medication order deleted');
      await fetchExistingOrders();
      if (onOrdersPlaced) onOrdersPlaced();
    } catch (error) {
      console.error('Error deleting emergency medication order:', error);
      toast.error(error.response?.data?.error || 'Failed to delete order');
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleUpdateOrder = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/emergency/drug-order/${editingOrder.id}`, editingOrder);
      toast.success('Emergency medication order updated');
      setEditingOrder(null);
      await fetchExistingOrders();
      if (onOrdersPlaced) onOrdersPlaced();
    } catch (error) {
      console.error('Error updating emergency medication order:', error);
      toast.error(error.response?.data?.error || 'Failed to update order');
    }
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

  const getPrintableDoctorData = () => {
    return visit?.doctor || currentUser || {};
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

  const printPrescription = async () => {
    const medicationsToPrint = existingOrders.length > 0
      ? existingOrders.map((order) => ({
          name: order.service?.name || order.customName || 'Unknown Medication',
          instructions: order.instructions || '',
          strength: order.strength || '',
          dosage: order.dosage || '',
          frequency: order.frequency || '',
          frequencyPeriod: order.frequencyPeriod || '',
          duration: order.duration || '',
          durationPeriod: order.durationPeriod || '',
          route: order.route || ''
        }))
      : selectedMedications.map((med) => ({
          name: med.name,
          instructions: med.instructions || '',
          strength: med.strength || '',
          dosage: med.dosage || '',
          frequency: med.frequency || '',
          frequencyPeriod: med.frequencyPeriod || '',
          duration: med.duration || '',
          durationPeriod: med.durationPeriod || '',
          route: med.route || ''
        }));

    if (medicationsToPrint.length === 0) {
      toast.error('No medications to print');
      return;
    }

    try {
      setPrinting(true);
      const patientName = visit?.patient?.name || 'N/A';
      const patientAge = visit?.patient?.dob ? calculateAge(visit.patient.dob) : 'N/A';
      const patientGender = (visit?.patient?.gender || 'N/A').charAt(0).toUpperCase();
      const patientCardNumber = visit?.patient?.id || 'N/A';
      const doctorData = getPrintableDoctorData();
      const doctorName = getPrintableDoctorName(doctorData);
      const doctorQualification = getDoctorQualificationLabel(doctorData);
      const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const visitUid = visit?.visitUid || visit?.id?.toString().substring(0, 8) || 'N/A';

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Popup blocked! Please allow popups for this site.');
        setPrinting(false);
        return;
      }

      const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Prescription - ${patientName}</title>
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
            .logo { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
            .clinic-name { font-size: 13px; font-weight: 700; margin: 0; color: #1e40af; text-transform: uppercase; }
            .clinic-tagline { font-size: 9px; color: #64748b; margin: 0; font-style: italic; }
            .report-title { font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; }
            .report-info { font-size: 9px; color: #64748b; margin-top: 1px; text-align: right; }
            .patient-section { margin-bottom: 12px; padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; }
            .info-label { font-weight: 700; color: #64748b; }
            .medications-section h3 { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; }
            .medication-item { margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed #e2e8f0; }
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
                <div class="report-info">Date: ${currentDate}<br>Time: ${currentTime}</div>
              </div>
            </div>
            <div class="patient-section">
              <div><span class="info-label">Patient:</span> ${patientName?.toUpperCase()}</div>
              <div><span class="info-label">Card No:</span> #${patientCardNumber}</div>
              <div><span class="info-label">Age/Sex:</span> ${typeof patientAge === 'number' ? patientAge + 'Y' : patientAge} / ${patientGender}</div>
              <div style="text-align: right;"><span class="info-label">Visit ID:</span> #${visitUid}</div>
            </div>
            <div class="medications-section">
              <h3>Prescribed Medications</h3>
              ${medicationsToPrint.map((med, idx) => {
                const displayName = String(med.name || '').trim() || 'Unknown Medication';
                const rawStrength = String(med.strength || '').trim();
                const strengthSuffix = rawStrength && !displayName.toLowerCase().includes(rawStrength.toLowerCase()) ? ` ${rawStrength}` : '';
                const emergencyText = formatEmergencyInstruction(med);
                return `
                <div class="medication-item">
                  <div class="medication-name"># ${idx + 1}. ${escapeHtml(displayName + strengthSuffix)}</div>
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
      </html>`;

      printWindow.document.write(content);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
        setPrinting(false);
      }, 700);
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Failed to print prescription');
      setPrinting(false);
    }
  };

  if (fetchingData) {
    return (
      <div className="flex items-center justify-center py-12 bg-white rounded-xl border border-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm font-medium">Loading emergency medications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-semibold mb-3" style={{ color: '#0C0E0B' }}>Emergency Medication Catalog</h4>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, code, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {filteredServices.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredServices.map((service) => {
              const alreadySelected = selectedMedications.some((med) => med.serviceId === service.id);
              return (
                <button
                  type="button"
                  key={service.id}
                  disabled={alreadySelected}
                  className={`text-left p-3 rounded-lg border transition-all ${alreadySelected ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed' : 'border-blue-200 bg-white hover:bg-blue-50 hover:border-blue-400'}`}
                  onClick={() => addMedicationFromSearch(service)}
                >
                  <p className="font-semibold text-sm">{service.name}</p>
                  <p className="text-xs mt-1 text-gray-600">{service.description || service.code || 'Emergency medication'}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-blue-700">{service.code || 'EMERGENCY_DRUG'}</span>
                    <span className="text-sm font-bold text-blue-700">{Number(service.price || 0).toFixed(2)} ETB</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 p-4 rounded-lg border border-dashed border-gray-300 text-sm text-gray-600">
            No emergency medications matched your search.
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold" style={{ color: '#0C0E0B' }}>Custom Emergency Medication</h4>
          <button
            onClick={() => setShowCustomForm(!showCustomForm)}
            className="flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-1" />
            {showCustomForm ? 'Cancel' : 'Add Custom'}
          </button>
        </div>

        {showCustomForm && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 shadow-sm space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-indigo-900 mb-1">Medication Name *</label>
                <input
                  type="text"
                  value={customMedication.name}
                  onChange={(e) => setCustomMedication({ ...customMedication, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 bg-white"
                  placeholder="e.g. Paracetamol"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-indigo-900 mb-1">Strength</label>
                <input
                  type="text"
                  value={customMedication.strength}
                  onChange={(e) => setCustomMedication({ ...customMedication, strength: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 bg-white"
                  placeholder="e.g. 500mg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-indigo-900 mb-1">Unit Price (ETB)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={customMedication.unitPrice}
                  onChange={(e) => setCustomMedication({ ...customMedication, unitPrice: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 bg-white"
                  placeholder="Default 5.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-bold text-indigo-900 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={customMedication.quantity}
                  onChange={(e) => setCustomMedication({ ...customMedication, quantity: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-indigo-900 mb-1">Frequency</label>
                <input
                  type="text"
                  value={customMedication.frequency}
                  onChange={(e) => setCustomMedication({ ...customMedication, frequency: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 bg-white"
                  placeholder="e.g. BID"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-indigo-900 mb-1">Dosage</label>
                <input
                  type="text"
                  value={customMedication.dosage}
                  onChange={(e) => setCustomMedication({ ...customMedication, dosage: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 bg-white"
                  placeholder="e.g. 10 ml"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-indigo-900 mb-1">Duration</label>
                <input
                  type="text"
                  value={customMedication.duration}
                  onChange={(e) => setCustomMedication({ ...customMedication, duration: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 bg-white"
                  placeholder="e.g. 5 days"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-indigo-900 mb-1">Route</label>
                <input
                  type="text"
                  value={customMedication.route}
                  onChange={(e) => setCustomMedication({ ...customMedication, route: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 bg-white"
                  placeholder="e.g. IV"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-indigo-900 mb-1.5">Instructions (Quantity, Frequency, Dosage, Duration, Route)</label>
              <textarea
                value={customMedication.instructions}
                onChange={(e) => setCustomMedication({ ...customMedication, instructions: e.target.value })}
                className="w-full px-4 py-2.5 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                placeholder="e.g. 1 tablet twice daily for 5 days after meals"
                rows={3}
              />
            </div>

            <div className="pt-3 border-t border-indigo-200">
              <button
                onClick={addCustomMedication}
                className="flex items-center px-4 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors"
              >
                <Save className="h-5 w-5 mr-2" />
                Add Custom Medication
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedMedications.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-900">Current Emergency Prescription</h4>
          {selectedMedications.map((medication, index) => (
            <div key={`${medication.name}-${index}`} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm border-l-4 border-l-blue-500">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h5 className="font-bold text-gray-900 text-lg">{index + 1}. {medication.name}{medication.strength ? ` ${medication.strength}` : ''}</h5>
                  <p className="text-xs text-gray-500">{(Number(medication.unitPrice) || 0).toFixed(2)} ETB per unit</p>
                </div>
                <button
                  onClick={() => removeMedication(index)}
                  className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-full transition-colors"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={medication.quantity}
                    onChange={(e) => updateMedication(index, 'quantity', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                  <input
                    type="text"
                    value={medication.frequency}
                    onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. BID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
                  <input
                    type="text"
                    value={medication.dosage || ''}
                    onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 10 ml"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                  <input
                    type="text"
                    value={medication.duration}
                    onChange={(e) => updateMedication(index, 'duration', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 5 days"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
                  <input
                    type="text"
                    value={medication.route}
                    onChange={(e) => updateMedication(index, 'route', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. IV"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Instructions (Quantity, Frequency, Dosage, Duration, Route)</label>
                <textarea
                  value={medication.instructions}
                  onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>

              <div className="mt-2 text-sm font-semibold text-blue-700">
                Line Total: {((Number(medication.unitPrice) || 0) * (Number(medication.quantity) || 1)).toFixed(2)} ETB
              </div>
            </div>
          ))}

          <div className="flex flex-col items-end space-y-3 pt-4 border-t">
            <div className="text-lg font-bold text-gray-900">
              Total Order Value: <span className="text-blue-600">{calculateTotal().toFixed(2)} ETB</span>
            </div>
            <button
              onClick={handleSubmitOrder}
              disabled={loading}
              className="w-full font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <CheckCircle className="h-6 w-6" />
                  <span>Complete Emergency Prescription</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {existingOrders.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mt-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold text-gray-900">Prescribed Emergency Medication Record</h4>
            <button
              onClick={printPrescription}
              disabled={printing}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
            >
              <Printer className="h-4 w-4" /> {printing ? 'Preparing...' : 'Print Prescription'}
            </button>
          </div>
          <div className="space-y-3">
            {existingOrders.map((order, idx) => {
              const emergencyText = formatEmergencyInstruction(order);
              return (
              <div key={order.id} className="p-3 bg-gray-50 border rounded-lg flex justify-between items-center">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{idx + 1}. {formatMedicationName(order.service?.name || order.customName || 'Unknown Medication')}</p>
                  {emergencyText.instruction && (
                    <p className="text-xs text-blue-700 ml-4">{emergencyText.instruction}</p>
                  )}
                  {emergencyText.special && (
                    <p className="text-xs text-gray-600 ml-4 italic">{emergencyText.special}</p>
                  )}
                  <p className="text-[11px] text-gray-500 ml-4">Qty: {order.quantity} {order.service?.price ? `| ${(Number(order.service.price) * Number(order.quantity || 1)).toFixed(2)} ETB` : ''}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-blue-600 uppercase">{order.status}</span>
                  {order.status === 'UNPAID' && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditingOrder(order)}
                        className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                        title="Edit Order"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteOrder(order.id)}
                        disabled={deleteLoading === order.id}
                        className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-colors disabled:opacity-50"
                        title="Delete Order"
                      >
                        {deleteLoading === order.id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );})}
          </div>
        </div>
      )}

      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold">Edit Emergency Medication Order</h3>
              <button onClick={() => setEditingOrder(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateOrder} className="p-6">
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Medication Name</label>
                  <input
                    type="text"
                    value={editingOrder.service?.name || ''}
                    disabled
                    className="w-full px-3 py-2 border rounded-lg bg-gray-100"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={editingOrder.quantity}
                      onChange={(e) => setEditingOrder({ ...editingOrder, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Strength</label>
                    <input
                      type="text"
                      value={editingOrder.strength || ''}
                      onChange={(e) => setEditingOrder({ ...editingOrder, strength: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                    <input
                      type="text"
                      value={editingOrder.frequency || ''}
                      onChange={(e) => setEditingOrder({ ...editingOrder, frequency: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
                    <input
                      type="text"
                      value={editingOrder.dosage || ''}
                      onChange={(e) => setEditingOrder({ ...editingOrder, dosage: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                    <input
                      type="text"
                      value={editingOrder.duration || ''}
                      onChange={(e) => setEditingOrder({ ...editingOrder, duration: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
                    <input
                      type="text"
                      value={editingOrder.route || ''}
                      onChange={(e) => setEditingOrder({ ...editingOrder, route: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instructions (Quantity, Frequency, Dosage, Duration, Route)</label>
                  <textarea
                    value={editingOrder.instructions || ''}
                    onChange={(e) => setEditingOrder({ ...editingOrder, instructions: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={4}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
                >
                  Update Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedMedications.length === 0 && existingOrders.length === 0 && (
        <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg bg-gray-50">
          <Pill className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-600">Search and add emergency medications to start prescribing.</p>
        </div>
      )}
    </div>
  );
};

export default EmergencyDrugOrdering;
