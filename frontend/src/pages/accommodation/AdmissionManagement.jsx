import React, { useState, useEffect, useCallback } from 'react';
import {
    Bed,
    User,
    Calendar,
    Plus,
    LogOut,
    ExternalLink,
    Search,
    Filter,
    Clock,
    Activity,
    CreditCard,
    PlusCircle,
    Stethoscope,
    Check,
    X,
    AlertTriangle,
    DollarSign
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Layout from '../../components/common/Layout';
import { useAuth } from '../../contexts/AuthContext';

const AdmissionManagement = () => {
    const { user } = useAuth();
    const [admissions, setAdmissions] = useState([]);
    const [completingService, setCompletingService] = useState(null);
    const [beds, setBeds] = useState([]);
    const [accommodationServices, setAccommodationServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ADMITTED');

    const [showServiceModal, setShowServiceModal] = useState(false);
    const [selectedAdmission, setSelectedAdmission] = useState(null);
    const [serviceFormData, setServiceFormData] = useState({
        serviceId: '',
        quantity: 1,
        notes: ''
    });
    const [selectedServiceIds, setSelectedServiceIds] = useState([]);
    const [serviceQuantities, setServiceQuantities] = useState({});

    const [showExtendModal, setShowExtendModal] = useState(false);
    const [extendData, setExtendData] = useState({
        expectedEndDate: ''
    });
    const [patientVitals, setPatientVitals] = useState({}); // newest vital per patient
    const [patientVitalsList, setPatientVitalsList] = useState({}); // all vitals per patient

    // Admit modal state
    const [showAdmitModal, setShowAdmitModal] = useState(false);
    const [admitSearch, setAdmitSearch] = useState('');
    const [admitSearchResults, setAdmitSearchResults] = useState([]);
    const [admitForm, setAdmitForm] = useState({
        patientId: '',
        bedId: '',
        expectedEndDate: '',
        serviceIds: [],
        notes: ''
    });
    const [admitStep, setAdmitStep] = useState(1); // 1=select patient, 2=select bed+date+services
    const [selectedPatientCard, setSelectedPatientCard] = useState(null);
    const [includeCardActivation, setIncludeCardActivation] = useState(false);

    const fetchData = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            const [admRes, bedRes] = await Promise.all([
                api.get(`/accommodation/admissions?status=${statusFilter}`),
                api.get('/accommodation/beds')
            ]);

            if (admRes.data.success) setAdmissions(admRes.data.admissions);
            if (bedRes.data.success) setBeds(bedRes.data.beds);
        } catch (error) {
            toast.error('Failed to fetch admission data');
        } finally {
            if (showLoading) setLoading(false);
        }
    }, [statusFilter]);

    const fetchServices = async () => {
        try {
            const response = await api.get('/doctors/services?category=ACCOMMODATION');
            if (response.data.success) {
                setAccommodationServices(response.data.services);
            }
        } catch (error) {
            console.error('Failed to fetch accommodation services');
        }
    };

    useEffect(() => {
        fetchData(true);
        fetchServices();
    }, [fetchData]);

    // Auto-refresh polling every 5 seconds (silent — no loading flash)
    useEffect(() => {
        const interval = setInterval(() => fetchData(false), 5000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const fetchAllVitals = useCallback(async () => {
        if (admissions.length === 0) return;
        const patientIds = [...new Set(admissions.map(a => a.patient?.id).filter(Boolean))];
        const latestMap = {};
        const allMap = {};
        await Promise.all(patientIds.map(async (pid) => {
            try {
                const res = await api.get(`/nurses/patient-vitals/${pid}`);
                const vitals = res.data?.vitals || [];
                if (vitals.length > 0) {
                    latestMap[pid] = vitals[0];
                    allMap[pid] = vitals.slice(0, 5); // recent 5
                }
            } catch (e) { console.warn('Failed to fetch vitals for', pid); }
        }));
        setPatientVitals(latestMap);
        setPatientVitalsList(allMap);
    }, [admissions]);

    useEffect(() => {
        fetchAllVitals();
        const interval = setInterval(fetchAllVitals, 15000);
        return () => clearInterval(interval);
    }, [fetchAllVitals]);

    const handleAddService = async (e) => {
        e.preventDefault();
        if (selectedServiceIds.length === 0) {
            toast.error('Select at least one service');
            return;
        }
        try {
            let successCount = 0;
            for (const serviceId of selectedServiceIds) {
                const qty = serviceQuantities[serviceId] || 1;
                const response = await api.post('/accommodation/admissions/services', {
                    admissionId: selectedAdmission.id,
                    serviceId,
                    quantity: qty,
                    notes: serviceFormData.notes
                });
                if (response.data.success) successCount++;
            }
            if (successCount > 0) {
                toast.success(`${successCount} service(s) added successfully`);
                setShowServiceModal(false);
                setSelectedServiceIds([]);
                setServiceQuantities({});
                setServiceFormData({ serviceId: '', quantity: 1, notes: '' });
                fetchData();
            }
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to add service');
        }
    };

    const handleExtendStay = async (e) => {
        e.preventDefault();
        try {
            const response = await api.put(`/accommodation/admissions/${selectedAdmission.id}/extend`, extendData);
            if (response.data.success) {
                toast.success('Admission extended successfully');
                setShowExtendModal(false);
                fetchData();
            }
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to extend stay');
        }
    };

    const searchPatientsForAdmit = useCallback(async () => {
        if (!admitSearch.trim() || admitSearch.trim().length < 1) {
            setAdmitSearchResults([]);
            return;
        }
        try {
            const res = await api.get(`/patients/search?query=${encodeURIComponent(admitSearch.trim())}`);
            setAdmitSearchResults(res.data.patients || []);
        } catch (e) {
            setAdmitSearchResults([]);
        }
    }, [admitSearch]);

    useEffect(() => {
        const t = setTimeout(searchPatientsForAdmit, 300);
        return () => clearTimeout(t);
    }, [admitSearch, searchPatientsForAdmit]);

    const handleAdmitPatient = async (e) => {
        e.preventDefault();
        if (!admitForm.patientId || !admitForm.bedId || !admitForm.expectedEndDate) {
            toast.error('Please select patient, bed, and discharge date');
            return;
        }
        try {
            // If card activation is included, create card activation billing first
            if (includeCardActivation) {
                try {
                    await api.post('/reception/activate-card', {
                        patientId: admitForm.patientId,
                        cardType: selectedPatientCard?.cardType || 'GENERAL',
                        notes: 'Card activation via admission'
                    });
                } catch (cardErr) {
                    toast.error('Failed to create card activation billing');
                    return;
                }
            }

            const payload = {
                patientId: admitForm.patientId,
                bedId: admitForm.bedId,
                expectedEndDate: admitForm.expectedEndDate,
                notes: admitForm.notes || undefined,
                initialServices: admitForm.serviceIds.length > 0 ? admitForm.serviceIds.map(sid => ({ serviceId: sid, quantity: 1 })) : undefined
            };
            const res = await api.post('/accommodation/admissions', payload);
            if (res.data.success) {
                toast.success('Patient admitted successfully');
                setShowAdmitModal(false);
                setAdmitStep(1);
                setAdmitForm({ patientId: '', bedId: '', expectedEndDate: '', serviceIds: [], notes: '' });
                setAdmitSearch('');
                setAdmitSearchResults([]);
                setSelectedPatientCard(null);
                setIncludeCardActivation(false);
                fetchData();
            }
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to admit patient');
        }
    };

    const handleCompleteService = async (serviceId) => {
        if (!window.confirm('Mark this service as completed?')) return;
        try {
            setCompletingService(serviceId);
            await api.put(`/accommodation/admissions/services/${serviceId}/complete`);
            toast.success('Service marked as completed');
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to complete service');
        } finally {
            setCompletingService(null);
        }
    };

    const handleBulkComplete = async (admissionId) => {
        const admission = admissions.find(a => a.id === admissionId);
        if (!admission) return;
        const pendingServices = admission.services?.filter(s => s.status !== 'COMPLETED') || [];
        if (pendingServices.length === 0) {
            toast('No pending services to complete');
            return;
        }
        if (!window.confirm(`Complete ${pendingServices.length} pending service(s)?`)) return;
        for (const svc of pendingServices) {
            try {
                await api.put(`/accommodation/admissions/services/${svc.id}/complete`);
            } catch (e) { /* continue */ }
        }
        toast.success(`${pendingServices.length} service(s) completed`);
        fetchData();
    };

    const toggleServiceSelection = (serviceId) => {
        setSelectedServiceIds(prev => {
            if (prev.includes(serviceId)) {
                setServiceQuantities(q => { const n = { ...q }; delete n[serviceId]; return n; });
                return prev.filter(id => id !== serviceId);
            }
            setServiceQuantities(q => ({ ...q, [serviceId]: 1 }));
            return [...prev, serviceId];
        });
    };

    const updateServiceQuantity = (serviceId, val) => {
        const q = Math.max(1, parseInt(val) || 1);
        setServiceQuantities(prev => ({ ...prev, [serviceId]: q }));
    };

    const handleBulkCompleteSelected = async (admissionId) => {
        if (selectedServiceIds.length === 0) {
            toast('Select services first');
            return;
        }
        if (!window.confirm(`Complete ${selectedServiceIds.length} selected service(s)?`)) return;
        for (const id of selectedServiceIds) {
            try {
                await api.put(`/accommodation/admissions/services/${id}/complete`);
            } catch (e) { /* continue */ }
        }
        toast.success(`${selectedServiceIds.length} service(s) completed`);
        setSelectedServiceIds([]);
        fetchData();
    };

    const handleDischarge = async (admissionId) => {
        if (window.confirm('Are you sure you want to discharge this patient? This will free up the bed.')) {
            try {
                const response = await api.put(`/accommodation/admissions/${admissionId}/discharge`);
                if (response.data.success) {
                    toast.success('Patient discharged successfully');
                    fetchData();
                }
            } catch (error) {
                toast.error('Failed to discharge patient');
            }
        }
    };

    const filteredAdmissions = admissions.filter(adm =>
        adm.patient?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        adm.patient?.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        adm.bed?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const calculateDaysRemaining = (endDate) => {
        const today = new Date();
        const end = new Date(endDate);
        const diffTime = end - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    return (
        <Layout title="Accommodation & Admissions" subtitle="Monitor and manage admitted patients">
            <div className="space-y-6">
                {/* Stats Bar */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
                            <Bed className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Available Beds</p>
                            <p className="text-2xl font-bold text-gray-900">{beds.filter(b => b.status === 'AVAILABLE').length} / {beds.length}</p>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-lg text-green-600">
                            <User className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Currently Admitted</p>
                            <p className="text-2xl font-bold text-gray-900">{admissions.filter(a => a.status === 'ADMITTED').length}</p>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="p-3 bg-red-100 rounded-lg text-red-600">
                            <Clock className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Expiring Stay</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {admissions.filter(a => a.status === 'ADMITTED' && calculateDaysRemaining(a.expectedEndDate) <= 1).length}
                            </p>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="p-3 bg-purple-100 rounded-lg text-purple-600">
                            <Activity className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 font-medium">Total Services</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {admissions.reduce((sum, a) => sum + (a.services?.length || 0), 0)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by patient name, ID or bed..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button onClick={() => setShowAdmitModal(true)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap">
                            <Plus className="h-4 w-4" /> Admit Patient
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setStatusFilter('ADMITTED')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${statusFilter === 'ADMITTED' ? 'bg-primary-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            Current
                        </button>
                        <button
                            onClick={() => setStatusFilter('PENDING_PAYMENT')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${statusFilter === 'PENDING_PAYMENT' ? 'bg-yellow-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            Pending
                        </button>
                        <button
                            onClick={() => setStatusFilter('DISCHARGED')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${statusFilter === 'DISCHARGED' ? 'bg-primary-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            Past
                        </button>
                    </div>
                </div>

                {/* Admissions List */}
                <div className="grid grid-cols-1 gap-6">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                        </div>
                    ) : filteredAdmissions.length > 0 ? (
                        filteredAdmissions.map((adm) => (
                            <div key={adm.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow transition-shadow">
                                <div className="p-3 sm:p-4">
                                    {/* Header: Patient + Status + Bed */}
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="h-9 w-9 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 flex-shrink-0">
                                                <User className="h-4.5 w-4.5" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <h3 className="text-sm font-bold text-gray-900 truncate">{adm.patient?.name}</h3>
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                                        adm.status === 'ADMITTED' ? 'bg-green-100 text-green-700' :
                                                        adm.status === 'PENDING_PAYMENT' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        {adm.status.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 flex-wrap">
                                                    <span className="font-mono">#{adm.patient?.id}</span>
                                                    <span>·</span>
                                                    <span>{adm.patient?.gender}</span>
                                                    <span>·</span>
                                                    <span>{adm.patient?.dob ? new Date().getFullYear() - new Date(adm.patient.dob).getFullYear() : 'N/A'}y</span>
                                                    {adm.patient?.bloodType && <><span>·</span><span className="font-semibold">{adm.patient.bloodType}</span></>}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold flex-shrink-0">
                                            <Bed className="h-3.5 w-3.5" />
                                            {adm.bed?.name}
                                        </span>
                                    </div>

                                    {/* Info strip */}
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600 mb-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
                                        <span>Admitted: <strong>{new Date(adm.startDate).toLocaleDateString()}</strong></span>
                                        <span>Until: <strong className={calculateDaysRemaining(adm.expectedEndDate) <= 1 ? 'text-red-600' : ''}>{new Date(adm.expectedEndDate).toLocaleDateString()}</strong></span>
                                        <span>({calculateDaysRemaining(adm.expectedEndDate)}d left)</span>
                                        <span>By: <strong>{adm.admittedBy?.fullname}</strong></span>
                                        <span>Rate: <strong className="text-primary-600">{adm.bed?.price?.toLocaleString()} ETB/d</strong></span>
                                    </div>

                                    {/* Notes */}
                                    {adm.notes && (
                                        <div className="mb-2 text-[11px] text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5 italic border-l-2 border-gray-200">
                                            "{adm.notes}"
                                        </div>
                                    )}

                                    {/* Vitals section - ALL records shown, big and bold */}
                                    {(() => {
                                        const allVitals = patientVitalsList[adm.patient?.id] || [];
                                        if (allVitals.length === 0) return null;
                                        const latest = allVitals[0];
                                        const bgClass = latest?.condition === 'Critical' ? 'from-red-50 to-orange-50 border-red-200' : 'from-green-50 to-emerald-50 border-green-100';
                                        return (
                                        <div className="mb-2 space-y-1">
                                            {allVitals.map((v, idx) => (
                                            <div key={v.id || idx} className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-3 py-2 border ${idx === 0 ? `bg-gradient-to-r ${bgClass}` : 'bg-white border-gray-100'}`}>
                                                <span className="text-sm font-bold text-gray-700 tracking-wide min-w-[20px]">#{allVitals.length - idx}</span>
                                                {v.bloodPressure && <span className="text-sm font-bold text-gray-900 bg-white px-2.5 py-1 rounded border border-gray-200 shadow-sm">BP {v.bloodPressure}</span>}
                                                {v.temperature && <span className="text-sm font-bold text-gray-900 bg-white px-2.5 py-1 rounded border border-gray-200 shadow-sm">{v.temperature}°{v.tempUnit || 'C'}</span>}
                                                {v.heartRate && <span className="text-sm font-bold text-gray-900 bg-white px-2.5 py-1 rounded border border-gray-200 shadow-sm">HR {v.heartRate}</span>}
                                                {v.respirationRate && <span className="text-sm font-bold text-gray-900 bg-white px-2.5 py-1 rounded border border-gray-200 shadow-sm">RR {v.respirationRate}</span>}
                                                {v.oxygenSaturation && <span className="text-sm font-bold text-gray-900 bg-white px-2.5 py-1 rounded border border-gray-200 shadow-sm">SpO2 {v.oxygenSaturation}%</span>}
                                                {v.gcsTotal !== null && v.gcsTotal !== undefined && <span className="text-sm font-bold text-gray-900 bg-white px-2.5 py-1 rounded border border-gray-200 shadow-sm">GCS {v.gcsTotal}</span>}
                                                {v.condition && <span className={`text-xs font-bold px-2 py-1 rounded ${v.condition === 'Critical' ? 'bg-red-100 text-red-700' : v.condition === 'Deteriorating' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>{v.condition}</span>}
                                                {(v.painScoreRest !== null && v.painScoreRest !== undefined) && <span className="text-xs font-bold text-gray-600">Pain: {v.painScoreRest}/10</span>}
                                                <span className="text-xs text-gray-400 ml-auto font-mono">{new Date(v.createdAt).toLocaleTimeString()}</span>
                                            </div>
                                            ))}
                                        </div>
                                        );
                                    })()}

                                    {/* Action buttons row */}
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        <button onClick={() => { setSelectedAdmission(adm); setShowServiceModal(true); }}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-[11px] font-semibold transition-colors">
                                            <PlusCircle className="h-3.5 w-3.5" /> Service
                                        </button>
                                        <button onClick={() => { setSelectedAdmission(adm); setExtendData({ expectedEndDate: new Date(adm.expectedEndDate).toISOString().split('T')[0] }); setShowExtendModal(true); }}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-[11px] font-semibold transition-colors">
                                            <Calendar className="h-3.5 w-3.5" /> Extend
                                        </button>
                                        {adm.status === 'ADMITTED' && (
                                            <button onClick={() => handleDischarge(adm.id)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-orange-50 text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-100 text-[11px] font-semibold transition-colors">
                                                <LogOut className="h-3.5 w-3.5" /> Discharge
                                            </button>
                                        )}
                                        {adm.status === 'PENDING_PAYMENT' && (
                                            <button onClick={() => handleDischarge(adm.id)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 text-[11px] font-semibold transition-colors">
                                                <LogOut className="h-3.5 w-3.5" /> Cancel
                                            </button>
                                        )}
                                        {adm.visitId && user?.role !== 'NURSE' && (
                                            <button onClick={() => window.open(`/doctor/consultation/${adm.visitId}`, '_blank')}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 text-[11px] font-semibold transition-colors">
                                                <Stethoscope className="h-3.5 w-3.5" /> Consult
                                            </button>
                                        )}
                                    </div>

                                    {/* Services table */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                                <Activity className="h-3 w-3 inline mr-1 text-purple-500" />
                                                Services ({adm.services?.length || 0})
                                            </h4>
                                            {adm.services?.some(s => s.status !== 'COMPLETED') && (
                                                <div className="flex gap-1">
                                                    <button onClick={() => handleBulkComplete(adm.id)}
                                                        className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full hover:bg-green-200 font-semibold">
                                                        Complete All
                                                    </button>
                                                    {selectedServiceIds.length > 0 && (
                                                        <button onClick={() => handleBulkCompleteSelected(adm.id)}
                                                            className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 font-semibold">
                                                            Complete ({selectedServiceIds.length})
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {adm.services && adm.services.length > 0 ? (
                                            <div className="overflow-x-auto rounded-lg border border-gray-100">
                                                <table className="w-full text-[11px] text-left">
                                                    <thead className="bg-gray-50 text-gray-500 font-semibold">
                                                        <tr>
                                                            <th className="px-2.5 py-1.5 w-8">
                                                                {adm.services?.some(s => s.status !== 'COMPLETED') && (
                                                                    <input type="checkbox" className="rounded"
                                                                        checked={adm.services.filter(s => s.status !== 'COMPLETED').length > 0 && adm.services.filter(s => s.status !== 'COMPLETED').every(s => selectedServiceIds.includes(s.id))}
                                                                        onChange={() => {
                                                                            const pendingIds = adm.services.filter(s => s.status !== 'COMPLETED').map(s => s.id);
                                                                            const allSelected = pendingIds.every(id => selectedServiceIds.includes(id));
                                                                            if (allSelected) setSelectedServiceIds(prev => prev.filter(id => !pendingIds.includes(id)));
                                                                            else setSelectedServiceIds(prev => [...new Set([...prev, ...pendingIds])]);
                                                                        }}
                                                                    />
                                                                )}
                                                            </th>
                                                            <th className="px-2.5 py-1.5">Service</th>
                                                            <th className="px-2.5 py-1.5">Qty</th>
                                                            <th className="px-2.5 py-1.5">Cost</th>
                                                            <th className="px-2.5 py-1.5">Ordered By</th>
                                                            <th className="px-2.5 py-1.5">Date</th>
                                                            <th className="px-2.5 py-1.5">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50">
                                                        {adm.services.map((svc) => (
                                                            <tr key={svc.id} className={`hover:bg-gray-25 ${selectedServiceIds.includes(svc.id) ? 'bg-blue-50' : ''}`}>
                                                                <td className="px-2.5 py-1.5">
                                                                    {svc.status !== 'COMPLETED' && (
                                                                        <input type="checkbox" className="rounded"
                                                                            checked={selectedServiceIds.includes(svc.id)}
                                                                            onChange={() => toggleServiceSelection(svc.id)}
                                                                        />
                                                                    )}
                                                                </td>
                                                                <td className="px-2.5 py-1.5 font-medium text-gray-900">{svc.service?.name}</td>
                                                                <td className="px-2.5 py-1.5 text-gray-600">x{svc.quantity}</td>
                                                                <td className="px-2.5 py-1.5 font-semibold text-gray-900">{svc.totalPrice?.toLocaleString()} ETB</td>
                                                                <td className="px-2.5 py-1.5 text-gray-500">{svc.orderedBy?.fullname}</td>
                                                                <td className="px-2.5 py-1.5 text-gray-400 italic">{new Date(svc.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</td>
                                                                <td className="px-2.5 py-1.5">
                                                                    {svc.status === 'COMPLETED' ? (
                                                                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700">COMPLETED</span>
                                                                    ) : (
                                                                        <span className="inline-flex gap-1 items-center">
                                                                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-yellow-100 text-yellow-700">PENDING</span>
                                                                            <button onClick={() => handleCompleteService(svc.id)} disabled={completingService === svc.id}
                                                                                className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 disabled:opacity-50">
                                                                                {completingService === svc.id ? '...' : 'Done'}
                                                                            </button>
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="text-center py-3 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                                <p className="text-xs text-gray-400">No services ordered</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-200 shadow-sm">
                            <Bed className="h-16 w-16 mx-auto mb-4 text-gray-200" />
                            <h3 className="text-xl font-bold text-gray-900">No admissions found</h3>
                            <p className="text-gray-500">Try adjusting your filters or search term.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Service Modal (multi-select) */}
            {showServiceModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="bg-green-600 p-5 text-white">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <PlusCircle className="h-5 w-5" />
                                Add Services
                            </h3>
                            <p className="text-green-100 text-sm mt-0.5">{selectedAdmission?.patient?.name}</p>
                        </div>
                        <form onSubmit={handleAddService} className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Select Services (check multiple)</label>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto border border-gray-100 rounded-lg p-2">
                                    {accommodationServices.map(s => {
                                        const isSelected = selectedServiceIds.includes(s.id);
                                        return (
                                                <label key={s.id}
                                                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                                                    <input type="checkbox" className="rounded"
                                                        checked={isSelected}
                                                        onChange={() => toggleServiceSelection(s.id)}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                                                        <p className="text-xs text-gray-500">{s.price.toLocaleString()} ETB {isSelected && `x${serviceQuantities[s.id] || 1}`}</p>
                                                    </div>
                                                    {isSelected && (
                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                            <label className="text-[10px] text-gray-400">Qty:</label>
                                                            <input type="number" min="1" value={serviceQuantities[s.id] || 1}
                                                                onClick={(e) => e.stopPropagation()}
                                                                onChange={(e) => updateServiceQuantity(s.id, e.target.value)}
                                                                className="w-14 px-1.5 py-1 text-xs border border-gray-200 rounded text-center focus:ring-1 focus:ring-green-500 outline-none"
                                                            />
                                                        </div>
                                                    )}
                                                </label>
                                        );
                                    })}
                                    {accommodationServices.length === 0 && (
                                        <p className="text-sm text-gray-400 text-center py-4">No accommodation services available</p>
                                    )}
                                </div>
                                <p className="text-xs text-gray-400 mt-1">{selectedServiceIds.length} service(s) selected</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Instruction / Notes</label>
                                <textarea
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                    rows="2"
                                    placeholder="Additional details..."
                                    value={serviceFormData.notes}
                                    onChange={(e) => setServiceFormData({ ...serviceFormData, notes: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => { setShowServiceModal(false); setSelectedServiceIds([]); }}
                                    className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
                                <button type="submit" disabled={selectedServiceIds.length === 0}
                                    className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all">
                                    Order {selectedServiceIds.length > 0 ? `(${selectedServiceIds.length})` : ''}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Extend Modal */}
            {showExtendModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-blue-600 p-6 text-white">
                            <h3 className="text-2xl font-bold flex items-center gap-3">
                                <Calendar className="h-7 w-7" />
                                Extend Stay Duration
                            </h3>
                            <p className="text-blue-100 mt-1">{selectedAdmission?.patient?.name}</p>
                        </div>
                        <form onSubmit={handleExtendStay} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5 uppercase tracking-wide">New Expected Discharge Date *</label>
                                <input
                                    type="date"
                                    required
                                    min={selectedAdmission ? new Date(new Date(selectedAdmission.expectedEndDate).getTime() + 86400000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                                    className="w-full px-4 py-2.5 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none"
                                    value={extendData.expectedEndDate}
                                    onChange={(e) => setExtendData({ expectedEndDate: e.target.value })}
                                />
                                <p className="mt-2 text-xs text-gray-400">Current end date: {selectedAdmission ? new Date(selectedAdmission.expectedEndDate).toLocaleDateString() : '-'}. Select a date after the current end date to extend.</p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowExtendModal(false)}
                                    className="flex-1 px-6 py-3 text-gray-600 font-bold bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
                                >
                                    Update & Invoice
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Admit Patient Modal */}
            {showAdmitModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="bg-blue-600 p-5 text-white">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Plus className="h-5 w-5" />
                                Admit Patient
                            </h3>
                            <p className="text-blue-100 text-sm mt-0.5">{admitStep === 1 ? 'Step 1: Find patient' : 'Step 2: Select bed & set dates'}</p>
                        </div>

                        {admitStep === 1 ? (
                            <div className="p-5 space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input type="text" placeholder="Search by patient name or ID..."
                                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={admitSearch} onChange={(e) => setAdmitSearch(e.target.value)} autoFocus />
                                </div>
                                <div className="space-y-1 max-h-60 overflow-y-auto">
                                    {admitSearchResults.map(p => (
                                        <div key={p.id} onClick={() => { setAdmitForm(f => ({ ...f, patientId: p.id })); setSelectedPatientCard(p); setIncludeCardActivation(p.cardStatus !== 'ACTIVE'); setAdmitStep(2); }}
                                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 cursor-pointer border border-transparent hover:border-blue-200 transition-all">
                                            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
                                                <User className="h-4 w-4 text-blue-600" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                                                <p className="text-xs text-gray-500">#{p.id} · {p.gender} · {p.dob ? new Date().getFullYear() - new Date(p.dob).getFullYear() : 'N/A'}y</p>
                                            </div>
                                        </div>
                                    ))}
                                    {admitSearch.trim() && admitSearchResults.length === 0 && (
                                        <p className="text-sm text-gray-400 text-center py-4">No patients found</p>
                                    )}
                                </div>
                                <button type="button" onClick={() => { setShowAdmitModal(false); setSelectedPatientCard(null); setIncludeCardActivation(false); }}
                                    className="w-full px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">Cancel</button>
                            </div>
                        ) : (
                            <form onSubmit={handleAdmitPatient} className="p-5 space-y-4">
                                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                                    <User className="h-5 w-5 text-blue-600" />
                                    <span className="text-sm font-medium text-gray-900">{admitSearchResults.find(p => p.id === admitForm.patientId)?.name || 'Selected patient'}</span>
                                    <button type="button" onClick={() => { setAdmitStep(1); setAdmitForm(f => ({ ...f, patientId: '' })); }}
                                        className="ml-auto text-xs text-blue-600 hover:underline">Change</button>
                                </div>

                                    {selectedPatientCard && selectedPatientCard.cardStatus !== 'ACTIVE' && (
                                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                                            <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="text-xs font-semibold text-yellow-800">Card Not Active</p>
                                                <p className="text-[11px] text-yellow-700 mt-0.5">This patient's medical card is not active. Include card activation in billing so they can proceed with payment.</p>
                                                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                                    <input type="checkbox" className="rounded" checked={includeCardActivation}
                                                        onChange={(e) => setIncludeCardActivation(e.target.checked)} />
                                                    <span className="text-xs font-medium text-yellow-800">Include card activation fee (200 ETB)</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Select Bed *</label>
                                        <select required className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={admitForm.bedId} onChange={(e) => setAdmitForm(f => ({ ...f, bedId: e.target.value }))}>
                                            <option value="">-- Choose available bed --</option>
                                            {beds.filter(b => b.status === 'AVAILABLE').map(b => (
                                                <option key={b.id} value={b.id}>{b.name} ({b.type}) - {b.price.toLocaleString()} ETB/d</option>
                                            ))}
                                        </select>
                                    </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Expected Discharge Date *</label>
                                    <input type="date" required
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={admitForm.expectedEndDate} onChange={(e) => setAdmitForm(f => ({ ...f, expectedEndDate: e.target.value }))} />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Initial Services (optional)</label>
                                    <div className="space-y-1 max-h-32 overflow-y-auto border border-gray-100 rounded-lg p-2">
                                        {accommodationServices.map(s => (
                                            <label key={s.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 cursor-pointer">
                                                <input type="checkbox" className="rounded" checked={admitForm.serviceIds.includes(s.id)}
                                                    onChange={() => setAdmitForm(f => ({
                                                        ...f, serviceIds: f.serviceIds.includes(s.id) ? f.serviceIds.filter(id => id !== s.id) : [...f.serviceIds, s.id]
                                                    }))} />
                                                <span className="text-sm text-gray-700">{s.name} ({s.price.toLocaleString()} ETB)</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">Notes</label>
                                    <textarea className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" rows="2"
                                        placeholder="Optional notes..." value={admitForm.notes}
                                        onChange={(e) => setAdmitForm(f => ({ ...f, notes: e.target.value }))} />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => { setShowAdmitModal(false); setSelectedPatientCard(null); setIncludeCardActivation(false); }}
                                        className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">Cancel</button>
                                    <button type="submit"
                                        className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all">
                                        Confirm Admission
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default AdmissionManagement;
