import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Trash2, Printer, Pill, AlertCircle, CheckCircle, Clock, X, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatMedicationName, formatMedicationInstruction } from '../../utils/medicalStandards';

const DOSAGE_FORM_CATEGORIES = {
  ORAL_SOLID: 'Oral - Solid',
  ORAL_LIQUID: 'Oral - Liquid',
  INJECTABLE: 'Injectable',
  TOPICAL: 'Topical',
  OPHTHALMIC: 'Ophthalmic',
  OTIC: 'Otic',
  NASAL: 'Nasal',
  RESPIRATORY: 'Respiratory',
  RECTAL: 'Rectal',
  VAGINAL: 'Vaginal',
  TRANSDERMAL: 'Transdermal',
  IMPLANTABLE_SPECIAL: 'Implantable/Special'
};

const DOSAGE_FORMS = {
  ORAL_SOLID: ['Tablet', 'Tablet – Film Coated', 'Tablet – Enteric Coated', 'Tablet – Extended Release', 'Capsule – Hard Gelatin', 'Capsule – Soft Gel', 'Powder – Oral', 'Sachet', 'Lozenge'],
  ORAL_LIQUID: ['Oral Solution', 'Oral Suspension', 'Syrup', 'Elixir', 'Oral Drops'],
  INJECTABLE: ['Injection – IV', 'Injection – IM', 'Injection – SC', 'Injection – ID', 'IV Infusion', 'Ampoule', 'Vial', 'Prefilled Syringe', 'Powder for Injection'],
  TOPICAL: ['Cream', 'Ointment', 'Gel', 'Lotion', 'Foam', 'Topical Spray', 'Medicated Shampoo'],
  OPHTHALMIC: ['Eye Drops – Solution', 'Eye Drops – Suspension', 'Eye Ointment'],
  OTIC: ['Ear Drops – Solution', 'Ear Drops – Suspension'],
  NASAL: ['Nasal Spray', 'Nasal Drops', 'Nasal Gel'],
  RESPIRATORY: ['Metered Dose Inhaler', 'Dry Powder Inhaler', 'Nebulizer Solution'],
  RECTAL: ['Suppository – Rectal', 'Rectal Cream', 'Enema'],
  VAGINAL: ['Vaginal Tablet', 'Vaginal Suppository', 'Vaginal Cream', 'Vaginal Gel', 'Vaginal Foam'],
  TRANSDERMAL: ['Transdermal Patch'],
  IMPLANTABLE_SPECIAL: ['Implant', 'IUD', 'Depot Injection', 'Dialysis Solution', 'Irrigation Solution', 'Mouthwash']
};

const ROUTES = {
  ORAL: 'Oral (PO)',
  INTRAVENOUS: 'Intravenous (IV)',
  INTRAMUSCULAR: 'Intramuscular (IM)',
  SUBCUTANEOUS: 'Subcutaneous (SC)',
  INTRADERMAL: 'Intradermal (ID)',
  TOPICAL: 'Topical',
  INHALATION: 'Inhalation',
  RECTAL: 'Rectal',
  VAGINAL: 'Vaginal',
  OPHTHALMIC: 'Ophthalmic',
  OTIC: 'Otic',
  NASAL: 'Nasal',
  TRANSDERMAL: 'Transdermal',
  EPIDURAL: 'Epidural',
  INTRATHECAL: 'Intrathecal'
};

const ROUTE_VALIDATION = {
  ORAL_SOLID: ['ORAL'],
  ORAL_LIQUID: ['ORAL'],
  INJECTABLE: ['INTRAVENOUS', 'INTRAMUSCULAR', 'SUBCUTANEOUS', 'INTRADERMAL', 'EPIDURAL', 'INTRATHECAL'],
  TOPICAL: ['TOPICAL'],
  OPHTHALMIC: ['OPHTHALMIC'],
  OTIC: ['OTIC'],
  NASAL: ['NASAL'],
  RESPIRATORY: ['INHALATION'],
  RECTAL: ['RECTAL'],
  VAGINAL: ['VAGINAL'],
  TRANSDERMAL: ['TRANSDERMAL'],
  IMPLANTABLE_SPECIAL: ['INTRAVENOUS', 'INTRAMUSCULAR', 'SUBCUTANEOUS']
};

const FREQUENCY_TYPES = {
  ONCE_DAILY: 'Once Daily',
  TWICE_DAILY: 'Twice Daily',
  THREE_TIMES_DAILY: 'Three Times Daily',
  EVERY_6_HOURS: 'Every 6 Hours',
  EVERY_8_HOURS: 'Every 8 Hours',
  EVERY_12_HOURS: 'Every 12 Hours',
  STAT: 'STAT (Immediate)',
  PRN: 'PRN (As Needed)',
  CUSTOM: 'Custom'
};

const FREQUENCY_MAP = {
  ONCE_DAILY: { value: 1, unit: 'times', perUnit: 'day' },
  TWICE_DAILY: { value: 2, unit: 'times', perUnit: 'day' },
  THREE_TIMES_DAILY: { value: 3, unit: 'times', perUnit: 'day' },
  EVERY_6_HOURS: { value: 4, unit: 'times', perUnit: 'day' },
  EVERY_8_HOURS: { value: 3, unit: 'times', perUnit: 'day' },
  EVERY_12_HOURS: { value: 2, unit: 'times', perUnit: 'day' },
  STAT: { value: 1, unit: 'time', perUnit: 'day' },
  PRN: { value: 0, unit: 'times', perUnit: 'day' }
};

const DURATION_UNITS = {
  DAYS: 'Days',
  WEEKS: 'Weeks',
  MONTHS: 'Months'
};

const NON_CLINICAL_CUSTOM_NOTE = 'Custom medication - not in inventory';

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

const Card = ({ children, className = '' }) => (
  <div className={'bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden self-start ' + className}>{children}</div>
);
const CardHeader = ({ children }) => (
  <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">{children}</div>
);
const CardBody = ({ children }) => <div className="p-4 space-y-3">{children}</div>;

const MedicationOrdering = ({ visitId, patientId, patient, doctor, onOrdersPlaced, existingOrders = [] }) => {
  const { user: currentUser } = useAuth();
  const [medicationSearch, setMedicationSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedMedications, setSelectedMedications] = useState([]);
  const [prescribedMedications, setPrescribedMedications] = useState([]);
  const [loadingPrescribed, setLoadingPrescribed] = useState(false);

  const pharmacyMeds = selectedMedications.filter(m => !m.isCustomRx);

  const [customMedication, setCustomMedication] = useState({
    name: '',
    genericName: '',
    strength: '',
    strengthText: '',
    dosageFormCategory: '',
    dosageForm: '',
    routeCode: '',
    quantity: '',
    frequencyType: '',
    frequencyValue: '',
    frequencyUnit: 'times',
    frequencyUnitPer: 'day',
    durationValue: '',
    durationUnit: 'DAYS',
    instructions: ''
  });

  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customMedSearchQuery, setCustomMedSearchQuery] = useState('');
  const [customMedSearchResults, setCustomMedSearchResults] = useState([]);
  const [isSearchingCustomMeds, setIsSearchingCustomMeds] = useState(false);
  const [showCustomMedSuggestions, setShowCustomMedSuggestions] = useState(false);
  const [isSavingCustomMed, setIsSavingCustomMed] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [completedExternalOrders, setCompletedExternalOrders] = useState([]);

  const availableDosageForms = useMemo(() => {
    if (!customMedication.dosageFormCategory) return [];
    return DOSAGE_FORMS[customMedication.dosageFormCategory] || [];
  }, [customMedication.dosageFormCategory]);

  const availableRoutes = useMemo(() => {
    if (!customMedication.dosageFormCategory) return ROUTES;
    const allowedRoutes = ROUTE_VALIDATION[customMedication.dosageFormCategory] || [];
    const filtered = {};
    allowedRoutes.forEach(route => {
      if (ROUTES[route]) filtered[route] = ROUTES[route];
    });
    return filtered;
  }, [customMedication.dosageFormCategory]);

  const calculatedQuantity = useMemo(() => {
    const freqType = customMedication.frequencyType;
    const freqValue = parseFloat(customMedication.frequencyValue) || FREQUENCY_MAP[freqType]?.value || 0;
    const durationValue = parseFloat(customMedication.durationValue) || 0;
    const durationUnit = customMedication.durationUnit;

    if (freqValue === 0 || durationValue === 0) return null;

    let days = durationValue;
    if (durationUnit === 'WEEKS') days = durationValue * 7;
    if (durationUnit === 'MONTHS') days = durationValue * 30;

    return Math.ceil(freqValue * days);
  }, [customMedication.frequencyType, customMedication.frequencyValue, customMedication.durationValue, customMedication.durationUnit]);

  useEffect(() => {
    fetchPrescribedMedications();
  }, [visitId]);

  const fetchPrescribedMedications = async () => {
    if (!visitId) return;
    try {
      setLoadingPrescribed(true);
      const response = await api.get(`/doctors/visits/${visitId}`);
      const visitData = response.data;
      const orders = visitData.medicationOrders || [];
      setPrescribedMedications(orders.filter(o => o.type !== 'EXTERNAL'));
      setCompletedExternalOrders(orders.filter(o => o.type === 'EXTERNAL'));
    } catch (error) {
      console.error('Error fetching prescribed medications:', error);
    } finally {
      setLoadingPrescribed(false);
    }
  };

  const searchMedications = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      setIsSearching(true);
      const [inventoryResponse, customResponse] = await Promise.all([
        api.get(`/medications/search?query=${encodeURIComponent(query)}&limit=20`),
        api.get(`/doctors/custom-medications/search?query=${encodeURIComponent(query)}`)
      ]);

      const inventoryMedications = (inventoryResponse.data.medications || []).map((medication) => ({
        ...medication,
        isCustomSuggestion: false
      }));

      const customMedications = (customResponse.data.customMedications || []).map((medication) => ({
        ...medication,
        id: `custom-${medication.id}`,
        isCustomSuggestion: true,
        availableQuantity: null,
        category: medication.category || ''
      }));

      const mergedMedicationMap = new Map();
      [...inventoryMedications, ...customMedications].forEach((medication) => {
        const key = `${String(medication.name || '').toLowerCase()}|${String(medication.strength || '').toLowerCase()}`;
        const existing = mergedMedicationMap.get(key);
        if (!existing || (existing.isCustomSuggestion && !medication.isCustomSuggestion)) {
          mergedMedicationMap.set(key, medication);
        }
      });

      setSearchResults(Array.from(mergedMedicationMap.values()).slice(0, 25));
    } catch (error) {
      console.error('Error searching medications:', error);
      toast.error('Failed to search medications');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setMedicationSearch(query);
    if (window.medsearchTimeout) clearTimeout(window.medsearchTimeout);
    window.medsearchTimeout = setTimeout(() => {
      searchMedications(query);
    }, 300);
  };

  const addMedicationFromSearch = (medication) => {
    const isCustomSuggestion = Boolean(medication.isCustomSuggestion);
    const isOutOfStock = !isCustomSuggestion && (medication.availableQuantity === 0 || medication.availableQuantity === null);
    if (isOutOfStock) {
      toast.error(`${medication.name} ${medication.strength || ''} is out of stock. Use "Custom Rx" instead.`);
      return;
    }
    const newMedication = {
      id: isCustomSuggestion ? `custom-picked-${Date.now()}` : medication.id,
      name: medication.name,
      genericName: medication.genericName,
      dosageForm: medication.dosageForm,
      strength: medication.strength,
      manufacturer: medication.manufacturer,
      availableQuantity: medication.availableQuantity ?? 0,
      unitPrice: medication.unitPrice ?? 0,
      category: medication.category || '',
      instructionText: medication.instructions || '',
      isCustom: isCustomSuggestion,
      isCustomRx: false
    };
    setSelectedMedications([...selectedMedications, newMedication]);
    setMedicationSearch('');
    setSearchResults([]);
    toast.success(`${medication.name} added to prescription`);
  };

  const useOutOfStockAsCustom = (medication) => {
    setShowCustomForm(true);
    setCustomMedication({
      name: medication.name || '',
      genericName: medication.genericName || medication.name || '',
      strength: medication.strength || '',
      strengthText: medication.strengthText || '',
      dosageFormCategory: medication.dosageFormCategory || '',
      dosageForm: medication.dosageForm || '',
      routeCode: medication.routeCode || '',
      quantity: '',
      frequencyType: '',
      frequencyValue: '',
      frequencyUnit: 'times',
      frequencyUnitPer: 'day',
      durationValue: '',
      durationUnit: 'DAYS',
      instructions: ''
    });
    setMedicationSearch('');
    setSearchResults([]);
    toast.success(`Set "${medication.name}" as custom medication — add instructions and save`);
  };

  const searchCustomMedications = async (query) => {
    if (!query.trim() || query.trim().length < 2) {
      setCustomMedSearchResults([]);
      setShowCustomMedSuggestions(false);
      return;
    }
    try {
      setIsSearchingCustomMeds(true);
      const response = await api.get(`/doctors/custom-medications/search?query=${encodeURIComponent(query)}`);
      setCustomMedSearchResults(response.data.customMedications || []);
      setShowCustomMedSuggestions(response.data.customMedications?.length > 0);
    } catch (error) {
      console.error('Error searching custom medications:', error);
      setCustomMedSearchResults([]);
      setShowCustomMedSuggestions(false);
    } finally {
      setIsSearchingCustomMeds(false);
    }
  };

  const handleCustomMedSearchChange = (e) => {
    const query = e.target.value;
    setCustomMedication(prev => ({ ...prev, name: query, genericName: query }));
    setCustomMedSearchQuery(query);
    if (window.customSearchTimeout) clearTimeout(window.customSearchTimeout);
    window.customSearchTimeout = setTimeout(() => {
      searchCustomMedications(query);
    }, 300);
  };

  const selectCustomMedication = (customMed) => {
    setCustomMedication({
      ...customMedication,
      name: customMed.name,
      genericName: customMed.genericName || customMed.name,
      dosageFormCategory: customMed.dosageFormCategory || '',
      dosageForm: customMed.dosageForm || '',
      routeCode: customMed.routeCode || customMed.route || '',
      strength: customMed.strength || '',
      strengthText: customMed.strengthText || '',
      quantity: customMed.quantity || '',
      frequencyType: customMed.frequencyType || '',
      frequencyValue: customMed.frequencyValue || '',
      frequencyUnit: customMed.frequencyUnit || 'times',
      durationValue: customMed.durationValue || '',
      durationUnit: customMed.durationUnit || 'DAYS',
      instructions: customMed.instructions || ''
    });
    setCustomMedSearchQuery('');
    setCustomMedSearchResults([]);
    setShowCustomMedSuggestions(false);
  };

  const handleCustomFieldChange = (field, value) => {
    if (field === 'dosageFormCategory') {
      setCustomMedication({
        ...customMedication,
        [field]: value,
        dosageForm: '',
        routeCode: ''
      });
    } else {
      setCustomMedication({
        ...customMedication,
        [field]: value
      });
    }
  };

  const addCustomMedication = async () => {
    if (!customMedication.name.trim()) {
      toast.error('Please enter medication name');
      return;
    }

    setIsSavingCustomMed(true);
    try {
      const normalizedName = customMedication.name.trim().toLowerCase();
      const normalizedStrength = String(customMedication.strength || '').trim().toLowerCase();
      const wasSelectedFromSearch = customMedSearchResults.some(
        med => String(med.name || '').trim().toLowerCase() === normalizedName &&
          String(med.strength || '').trim().toLowerCase() === normalizedStrength
      );

      if (!wasSelectedFromSearch && customMedication.name.trim() && customMedication.strength?.trim()) {
        await api.post('/doctors/custom-medications', {
          name: customMedication.name,
          genericName: customMedication.genericName || customMedication.name,
          dosageFormCategory: customMedication.dosageFormCategory || null,
          dosageForm: customMedication.dosageForm || 'Tablet',
          strength: customMedication.strength?.trim() || '',
          strengthText: customMedication.strengthText || null,
          routeCode: customMedication.routeCode || null,
          quantity: customMedication.quantity || null,
          frequencyType: customMedication.frequencyType || null,
          frequencyValue: customMedication.frequencyValue ? parseFloat(customMedication.frequencyValue) : null,
          frequencyUnit: customMedication.frequencyUnit || null,
          frequencyText: customMedication.frequencyType ? FREQUENCY_TYPES[customMedication.frequencyType] : null,
          durationValue: customMedication.durationValue ? parseFloat(customMedication.durationValue) : null,
          durationUnit: customMedication.durationUnit || null,
          durationText: customMedication.durationValue ? `${customMedication.durationValue} ${DURATION_UNITS[customMedication.durationUnit]}` : null,
          instructions: customMedication.instructions || null
        });
        toast.success('Custom medication saved for future use');
      }

      const response = await api.post('/doctors/external-prescriptions', {
        visitId,
        patientId,
        name: customMedication.name,
        strength: customMedication.strength || 'N/A',
        instructionText: customMedication.instructions || null
      });
      const savedOrder = response.data.order;
      setCompletedExternalOrders(prev => [savedOrder, ...prev]);
      setCustomMedication({
        name: '', genericName: '', strength: '', strengthText: '', dosageFormCategory: '',
        dosageForm: '', routeCode: '', quantity: '', frequencyType: '', frequencyValue: '',
        frequencyUnit: 'times', frequencyUnitPer: 'day', durationValue: '', durationUnit: 'DAYS', instructions: ''
      });
      setCustomMedSearchQuery('');
      setCustomMedSearchResults([]);
      setShowCustomMedSuggestions(false);
      setShowCustomForm(false);
      toast.success('External prescription saved');
    } catch (error) {
      console.error('Error saving external prescription:', error);
      toast.error('Failed to save external prescription');
    } finally {
      setIsSavingCustomMed(false);
    }
  };

  const updateMedication = (index, field, value) => {
    const updated = [...selectedMedications];
    updated[index][field] = value;
    setSelectedMedications(updated);
  };

  const removeMedication = (index) => {
    const updated = selectedMedications.filter((_, i) => i !== index);
    setSelectedMedications(updated);
  };

  const submitMedicationOrders = async () => {
    if (selectedMedications.length === 0) {
      toast.error('Please add at least one medication');
      return;
    }

    const parsedVisitId = parseInt(visitId);
    if (isNaN(parsedVisitId)) {
      toast.error('Invalid visit ID');
      return;
    }

    if (!patientId) {
      toast.error('Invalid patient ID');
      return;
    }

    try {
      const pharmacyOrders = selectedMedications.filter(m => !m.isCustomRx).map(med => ({
        visitId: parsedVisitId,
        patientId: String(patientId),
        name: med.name || '',
        genericName: med.genericName || null,
        normalizedName: (med.name || '').toLowerCase(),
        dosageFormCategory: med.dosageFormCategory || null,
        dosageForm: med.dosageForm || 'Tablet',
        strength: med.strength || 'N/A',
        strengthText: med.strengthText || null,
        instructionText: med.instructions || med.instructionText || null,
        instructions: med.instructions || med.instructionText || null,
        additionalNotes: null,
        category: med.category || null
      }));

      if (pharmacyOrders.length === 0) {
        toast.error('No pharmacy medications to submit. External Rx items are printed only.');
        return;
      }

      for (const order of pharmacyOrders) {
        await api.post('/doctors/medication-orders', order);
      }
      toast.success(`${pharmacyOrders.length} medication(s) prescribed successfully`);
      setSelectedMedications([]);
      await fetchPrescribedMedications();
      if (onOrdersPlaced) onOrdersPlaced();
    } catch (error) {
      console.error('Error prescribing medications:', error);
      console.error('Error response data:', error.response?.data);
      toast.error(error.response?.data?.error || error.response?.data?.details || JSON.stringify(error.response?.data) || 'Failed to prescribe medications');
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

  const printPrescription = async (filterType = 'all') => {
    let medicationsToPrint = prescribedMedications.length > 0 ? prescribedMedications : selectedMedications;
    if (filterType === 'pharmacy') {
      medicationsToPrint = medicationsToPrint.filter(m => !m.isCustomRx);
    } else if (filterType === 'external') {
      medicationsToPrint = completedExternalOrders;
    }
    if (medicationsToPrint.length === 0) {
      toast.error('No medications to print.');
      return;
    }

    medicationsToPrint = medicationsToPrint.reduce((acc, current) => {
      const key = current.id
        ? `id:${current.id}`
        : [
            current.name || '',
            current.strength || '',
            current.instructions || current.instructionText || ''
          ].join('|');

      const isDuplicate = acc.some(item => {
        const itemKey = item.id
          ? `id:${item.id}`
          : [
              item.name || '',
              item.strength || '',
              item.instructions || item.instructionText || ''
            ].join('|');
        return itemKey === key;
      });

      if (!isDuplicate) acc.push(current);
      return acc;
    }, []);

    try {
      let patientData = patient;
      let doctorData = doctor;
      let visitUid = visitId?.toString().substring(0, 8);

      try {
        const visitResponse = await api.get(`/doctors/visits/${visitId}`);
        const visitData = visitResponse.data;
        if (!patientData) patientData = visitData.patient;
        if (!doctorData) doctorData = visitData.doctor || currentUser;
        if (visitData.visitUid) visitUid = visitData.visitUid;
      } catch (error) {
        console.error('Error fetching visit details:', error);
      }

      if (!patientData) {
        toast.error('Failed to get patient data');
        return;
      }

      const patientAge = patientData?.dob ? calculateAge(patientData.dob) : 'N/A';
      const patientGender = (patientData?.gender || 'N/A').charAt(0).toUpperCase();
      const patientCardNumber = patientData?.id || 'N/A';
      const patientName = patientData?.name || 'N/A';

      const firstMed = medicationsToPrint[0];
      const prescribingDoctor = firstMed?.doctor || firstMed?.medicationOrder?.doctor || doctorData || currentUser;
      const doctorName = getPrintableDoctorName(prescribingDoctor, currentUser);
      const doctorQualification = getDoctorQualificationLabel(prescribingDoctor, currentUser);

      const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Popup blocked! Please allow popups for this site.');
        return;
      }
      const prescriptionContent = `
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
            .logo { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
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
              <div style="text-align: right;"><span class="info-label">Visit ID:</span> #${visitUid}</div>
            </div>
            <div class="medications-section">
              <h3>Prescribed Medications</h3>
              ${medicationsToPrint.map((med, idx) => {
              const displayName = String(med.name || '').trim() || 'Unknown Medication';
              const rawStrength = String(med.strength || '').trim();
              const strengthSuffix = rawStrength && !displayName.toLowerCase().includes(rawStrength.toLowerCase()) ? ` ${rawStrength}` : '';
        const instructionText = resolveMedicationInstruction(med);

        return `
                <div class="medication-item">
                  <div class="medication-name"># ${idx + 1}. ${displayName}${strengthSuffix}</div>
                  ${instructionText ? `<div class="medication-details" style="padding-left: 25px; margin-top: 4px;">${instructionText}</div>` : ''}
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
      printWindow.document.write(prescriptionContent);
      printWindow.document.close();
      setTimeout(() => { printWindow.print(); }, 800);
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Failed to print prescription');
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to delete this medication order?')) return;
    try {
      setDeleteLoading(orderId);
      await api.delete(`/doctors/medication-order/${orderId}`);
      toast.success('Medication order deleted');
      await fetchPrescribedMedications();
      if (onOrdersPlaced) onOrdersPlaced();
    } catch (error) {
      console.error('Error deleting medication order:', error);
      toast.error(error.response?.data?.error || 'Failed to delete order');
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleUpdateOrder = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/doctors/medication-order/${editingOrder.id}`, editingOrder);
      toast.success('Medication order updated');
      setEditingOrder(null);
      await fetchPrescribedMedications();
      if (onOrdersPlaced) onOrdersPlaced();
    } catch (error) {
      console.error('Error updating medication order:', error);
      toast.error(error.response?.data?.error || 'Failed to update order');
    }
  };

  const inputClass = 'w-full px-3 py-2 border rounded-lg focus:ring-2 text-sm bg-white text-slate-900 border-slate-300 focus:ring-slate-400 placeholder-slate-400';
  const textareaClass = 'w-full px-2.5 py-1.5 border rounded text-sm focus:ring-2 bg-white text-slate-900 border-slate-300 focus:ring-slate-400 placeholder-slate-400';

  return (
    <div className="space-y-6">
      {/* ====== TOP SECTION: Current Selections ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── LEFT: Pharmacy Medications ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <h3 className="font-bold text-slate-800 text-base">Pharmacy Medications</h3>
              {pharmacyMeds.length > 0 && (
                <span className="text-xs font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">{pharmacyMeds.length}</span>
              )}
            </div>
            <button onClick={() => printPrescription('pharmacy')}
              disabled={pharmacyMeds.length === 0}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition disabled:opacity-40 disabled:cursor-not-allowed">
              <Printer className="h-3.5 w-3.5" /> Print Order
            </button>
          </CardHeader>
          <CardBody>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Search inventory medications..."
                value={medicationSearch} onChange={handleSearchChange}
                className={inputClass + ' pl-10'} />
              {isSearching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-500" />
                </div>
              )}
            </div>

            {searchResults.filter(m => !m.isCustomSuggestion).length > 0 && (
              <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto bg-white shadow-sm">
                {searchResults.filter(m => !m.isCustomSuggestion).map((medication) => {
                  const isOOS = medication.availableQuantity === 0 || medication.availableQuantity === null;
                  const isLowStock = !isOOS && medication.availableQuantity <= 5;
                  return (
                  <div key={medication.id} className={`border-b border-slate-100 last:border-b-0 ${isOOS ? 'opacity-60' : ''}`}>
                    <div className={`p-3 flex items-center justify-between ${isOOS ? '' : 'hover:bg-slate-50 cursor-pointer'}`}
                      onClick={() => !isOOS && addMedicationFromSearch(medication)}>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900 text-sm">
                          {medication.name}{medication.strength ? ` - ${medication.strength}` : ''}
                        </p>
                      </div>
                      {isOOS ? (
                        <span className="text-xs font-semibold text-red-500 flex-shrink-0 ml-2">Out of Stock</span>
                      ) : isLowStock ? (
                        <span className="text-xs font-semibold text-amber-600 flex-shrink-0 ml-2">Low: {medication.availableQuantity}</span>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-600 flex-shrink-0 ml-2">{medication.availableQuantity} in stock</span>
                      )}
                    </div>
                    {isOOS && (
                      <div className="px-3 pb-2 flex justify-end">
                        <button onClick={() => useOutOfStockAsCustom(medication)}
                          className="text-xs font-bold text-white bg-red-600 px-3 py-1.5 rounded-lg hover:bg-red-700 transition shadow-sm">
                          Use as Custom Rx →
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}

            {pharmacyMeds.length > 0 && (
              <div className="space-y-2">
                {pharmacyMeds.map((medication, index) => {
                  const origIdx = selectedMedications.indexOf(medication);
                  return (
                <div key={medication.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-1.5">
                    <p className="font-bold text-slate-900 text-sm">{index + 1}. {medication.name}</p>
                    <button onClick={() => removeMedication(origIdx)}
                      className="text-red-500 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-colors flex-shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea value={medication.instructionText} onChange={(e) => updateMedication(origIdx, 'instructionText', e.target.value)}
                    className={textareaClass}
                    placeholder="Instructions (e.g. 1 tablet twice daily for 7 days)" rows={2} />
                </div>
                  );
                })}
              </div>
            )}

            {pharmacyMeds.length > 0 && (
              <button onClick={submitMedicationOrders}
                className="w-full font-bold py-3 rounded-xl shadow-sm transition-all hover:shadow flex items-center justify-center gap-2 bg-slate-800 text-white hover:bg-slate-700">
                <CheckCircle className="h-5 w-5" />
                <span>Submit to Pharmacy</span>
              </button>
            )}
          </CardBody>
        </Card>

        {/* ── RIGHT: Patient Prescription (External) ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <h3 className="font-bold text-slate-800 text-base">Patient Prescription (External)</h3>
            </div>
          </CardHeader>
          <CardBody>
            <p className="text-xs text-slate-500 italic">Not available at our pharmacy — patient will purchase externally</p>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 block">Add Custom Medication</span>
              <div className="space-y-2">
                <div className="relative">
                  <input type="text" value={customMedication.name}
                    onChange={handleCustomMedSearchChange}
                    className={inputClass}
                    placeholder="Medication name *" />
                  {showCustomMedSuggestions && customMedSearchResults.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded shadow-lg max-h-36 overflow-y-auto">
                      {customMedSearchResults.map((med) => (
                        <div key={med.id} onClick={() => selectCustomMedication(med)}
                          className="px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs text-slate-700">
                          <span className="font-semibold text-slate-900">{med.name}</span> - {med.strength}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <input type="text" value={customMedication.strength}
                  onChange={(e) => handleCustomFieldChange('strength', e.target.value)}
                  className={inputClass}
                  placeholder="Strength (e.g. 500mg)" />
                <textarea value={customMedication.instructions}
                  onChange={(e) => handleCustomFieldChange('instructions', e.target.value)}
                  className={textareaClass} rows={3}
                  placeholder="Instructions (e.g. 1 tablet twice daily for 7 days after meals)" />
                <button onClick={addCustomMedication} disabled={isSavingCustomMed}
                  className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-sm font-bold bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition disabled:opacity-50">
                  {isSavingCustomMed ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Add to Rx
                </button>
              </div>
            </div>

            <p className="text-center text-slate-400 text-sm py-2">External prescriptions appear in the bottom card once saved</p>
          </CardBody>
        </Card>
      </div>

      {/* ====== BOTTOM SECTION: Prescribed Records ====== */}
      {(prescribedMedications.length > 0 || completedExternalOrders.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2">

          {/* ── LEFT: Sent to Pharmacy ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                <h3 className="font-bold text-slate-800 text-base">Sent to Pharmacy</h3>
                {prescribedMedications.length > 0 && (
                  <span className="text-xs font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">{prescribedMedications.length}</span>
                )}
              </div>
              <button onClick={printPrescription}
                disabled={prescribedMedications.length === 0}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition disabled:opacity-40 disabled:cursor-not-allowed">
                <Printer className="h-3.5 w-3.5" /> Reprint Order
              </button>
            </CardHeader>
            <CardBody>
              {prescribedMedications.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-4">No pharmacy items submitted yet</p>
              ) : (
                <div className="space-y-2">
                  {prescribedMedications.map((order, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 text-sm">{idx + 1}. {formatMedicationName(order.name)}</p>
                          {resolveMedicationInstruction(order) && (
                            <p className="text-xs text-slate-500 mt-0.5">{resolveMedicationInstruction(order)}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${
                            order.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                            order.status === 'UNPAID' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>{order.status}</span>
                          {order.status === 'UNPAID' && (
                            <div className="flex gap-1">
                              <button onClick={() => setEditingOrder(order)}
                                className="text-blue-500 hover:text-blue-600 p-1 hover:bg-blue-50 rounded" title="Edit Order">
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-5M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" />
                                </svg>
                              </button>
                              <button onClick={() => handleDeleteOrder(order.id)} disabled={deleteLoading === order.id}
                                className="text-red-500 hover:text-red-600 p-1 hover:bg-red-50 rounded disabled:opacity-50" title="Delete Order">
                                {deleteLoading === order.id ? (
                                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-xs mt-1.5 text-slate-400 italic">Sent to pharmacy for dispensing</p>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* ── RIGHT: Patient's External Prescription ── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                <h3 className="font-bold text-slate-800 text-base">Patient's External Prescription</h3>
                {completedExternalOrders.length > 0 && (
                  <span className="text-xs font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">{completedExternalOrders.length}</span>
                )}
              </div>
              <button onClick={() => printPrescription('external')}
                disabled={completedExternalOrders.length === 0}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition disabled:opacity-40 disabled:cursor-not-allowed">
                <Printer className="h-3.5 w-3.5" /> Reprint Rx
              </button>
            </CardHeader>
            <CardBody>
              {completedExternalOrders.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-slate-500 text-sm">No external prescriptions on record</p>
                  <p className="text-slate-400 text-xs mt-1">External prescriptions are given to the patient as a printed slip</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 italic mb-2">Prescription provided — patient will collect from external pharmacy</p>
                  {completedExternalOrders.map((med, idx) => (
                    <div key={med.id || idx} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <p className="font-bold text-slate-900 text-sm">{idx + 1}. {med.name}</p>
                      {resolveMedicationInstruction(med) && (
                        <p className="text-xs text-slate-500 mt-0.5">{resolveMedicationInstruction(med)}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* ────────── EDIT ORDER MODAL ────────── */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Edit Medication Order</h3>
              <button onClick={() => setEditingOrder(null)} className="text-slate-400 hover:text-slate-600">
                <Plus className="h-6 w-6 transform rotate-45" />
              </button>
            </div>
            <form onSubmit={handleUpdateOrder} className="p-6">
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Medication Name</label>
                  <input type="text" value={editingOrder.name}
                    onChange={(e) => setEditingOrder({ ...editingOrder, name: e.target.value })}
                    className={inputClass} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Instructions (Quantity, Frequency, Duration, Route)</label>
                  <textarea value={editingOrder.instructions || editingOrder.instructionText || ''}
                    onChange={(e) => setEditingOrder({ ...editingOrder, instructionText: e.target.value, instructions: e.target.value })}
                    className={textareaClass} rows={4}
                    placeholder="e.g. 1 tablet twice daily for 5 days after meals" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button type="submit"
                  className="px-6 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700">Update Order</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicationOrdering;
