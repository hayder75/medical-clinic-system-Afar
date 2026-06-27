import React, { useState, useEffect } from 'react';
import { Bed, Calendar, Plus, LogOut, Clock, Activity, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const AccommodationTab = ({ visit, onUpdated }) => {
    const [beds, setBeds] = useState([]);
    const [admission, setAdmission] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [services, setServices] = useState([]);

    const [showAssignForm, setShowAssignForm] = useState(false);
    const [durationDays, setDurationDays] = useState('1');
    const [selectedInitialServices, setSelectedInitialServices] = useState([]);
    const [formData, setFormData] = useState({
        bedId: '',
        expectedEndDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        notes: ''
    });

    const [showExtendForm, setShowExtendForm] = useState(false);
    const [extendData, setExtendData] = useState({
        expectedEndDate: ''
    });

    useEffect(() => {
        const days = parseInt(durationDays) || 1;
        const date = new Date();
        date.setDate(date.getDate() + days);
        setFormData(prev => ({ ...prev, expectedEndDate: date.toISOString().split('T')[0] }));
    }, [durationDays]);

    useEffect(() => {
        fetchData();
    }, [visit.patientId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [bedsRes, admRes, svcRes] = await Promise.all([
                api.get('/accommodation/beds'),
                api.get(`/accommodation/admissions?patientId=${visit.patientId}&status=ADMITTED`),
                api.get('/doctors/services?category=ACCOMMODATION')
            ]);

            if (bedsRes.data.success) setBeds(bedsRes.data.beds);
            if (admRes.data.success && admRes.data.admissions.length > 0) {
                setAdmission(admRes.data.admissions[0]);
            } else {
                setAdmission(null);
            }
            if (svcRes.data.success) setServices(svcRes.data.services);
        } catch (error) {
            console.error('Error fetching accommodation data:', error);
            toast.error('Failed to load accommodation data');
        } finally {
            setLoading(false);
        }
    };

    const handleAssignBed = async (e) => {
        e.preventDefault();
        try {
            setActionLoading(true);
            const response = await api.post('/accommodation/admissions', {
                ...formData,
                initialServices: selectedInitialServices.map(s => ({
                    serviceId: s.id,
                    quantity: s.quantity || 1,
                    notes: s.notes
                })),
                patientId: visit.patientId,
                visitId: visit.id
            });

            if (response.data.success) {
                toast.success('Patient admitted successfully');
                setShowAssignForm(false);
                fetchData();
                if (onUpdated) onUpdated();
            }
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to admit patient');
        } finally {
            setActionLoading(false);
        }
    };

    const toggleInitialService = (service) => {
        setSelectedInitialServices(prev => {
            const exists = prev.find(s => s.id === service.id);
            if (exists) {
                return prev.filter(s => s.id !== service.id);
            } else {
                return [...prev, { ...service, quantity: 1, notes: '' }];
            }
        });
    };

    const updateInitialServiceQuantity = (id, delta) => {
        setSelectedInitialServices(prev => prev.map(s =>
            s.id === id ? { ...s, quantity: Math.max(1, s.quantity + delta) } : s
        ));
    };

    const handleExtendStay = async (e) => {
        e.preventDefault();
        try {
            setActionLoading(true);
            const response = await api.put(`/accommodation/admissions/${admission.id}/extend`, extendData);
            if (response.data.success) {
                toast.success('Stay extended successfully');
                setShowExtendForm(false);
                fetchData();
            }
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to extend stay');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDischarge = async () => {
        if (!window.confirm('Are you sure you want to discharge this patient?')) return;

        try {
            setActionLoading(true);
            const response = await api.put(`/accommodation/admissions/${admission.id}/discharge`);
            if (response.data.success) {
                toast.success('Patient discharged successfully');
                fetchData();
            }
        } catch (error) {
            toast.error('Failed to discharge patient');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-12 w-12 animate-spin text-primary-600 mb-4" />
                <p className="text-gray-500 font-medium font-outfit">Loading accommodation details...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold font-outfit text-gray-900 flex items-center gap-2">
                    <Bed className="h-6 w-6 text-primary-600" />
                    Patient Accommodation
                </h3>
                {!admission && !showAssignForm && (
                    <button
                        onClick={() => setShowAssignForm(true)}
                        className="btn btn-primary flex items-center gap-2"
                    >
                        <Plus className="h-5 w-5" />
                        Admit Patient
                    </button>
                )}
            </div>

            {admission ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Current Admission Status */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-2xl p-6 border border-primary-100 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4">
                                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Currently Admitted
                                </span>
                            </div>

                            <div className="flex items-center gap-6 mb-8">
                                <div className="h-20 w-20 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-600">
                                    <Bed className="h-10 w-10" />
                                </div>
                                <div>
                                    <h4 className="text-2xl font-bold text-gray-900">{admission.bed?.name}</h4>
                                    <p className="text-primary-600 font-medium uppercase tracking-widest text-xs mt-1">{admission.bed?.type} Bed</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 bg-gray-50 rounded-xl p-4">
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Admitted On</p>
                                    <p className="font-semibold text-gray-900">{new Date(admission.startDate).toLocaleDateString()}</p>
                                    <p className="text-xs text-gray-500">{new Date(admission.startDate).toLocaleTimeString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Expected Discharge</p>
                                    <p className="font-semibold text-gray-900">{new Date(admission.expectedEndDate).toLocaleDateString()}</p>
                                    <p className="text-xs text-blue-600 font-medium">Daily Rate: {admission.bed?.price?.toLocaleString()} ETB</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Admitting Staff</p>
                                    <p className="font-semibold text-gray-900">{admission.admittedBy?.fullname}</p>
                                </div>
                            </div>

                            {admission.notes && (
                                <div className="mt-6">
                                    <p className="text-xs font-bold text-gray-400 uppercase mb-2">Admission Notes</p>
                                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-900 italic text-sm">
                                        "{admission.notes}"
                                    </div>
                                </div>
                            )}

                            <div className="mt-8 flex gap-3">
                                <button
                                    onClick={() => {
                                        setExtendData({ expectedEndDate: new Date(admission.expectedEndDate).toISOString().split('T')[0] });
                                        setShowExtendForm(true);
                                    }}
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-all font-bold"
                                >
                                    <Calendar className="h-5 w-5" />
                                    Extend Stay
                                </button>
                                <button
                                    onClick={handleDischarge}
                                    disabled={actionLoading}
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-orange-200 text-orange-600 rounded-xl hover:bg-orange-50 transition-all font-bold disabled:opacity-50"
                                >
                                    {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
                                    Discharge Patient
                                </button>
                            </div>

                            {showExtendForm && (
                                <div className="mt-6 p-6 bg-primary-50 rounded-2xl border-2 border-primary-100 animate-in fade-in slide-in-from-top-4">
                                    <h5 className="font-bold text-primary-900 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                                        <Calendar className="h-4 w-4" />
                                        Extend Expected Discharge Date
                                    </h5>
                                    <form onSubmit={handleExtendStay} className="flex gap-3">
                                        <input
                                            type="date"
                                            required
                                            min={new Date().toISOString().split('T')[0]}
                                            className="flex-1 px-4 py-2 border-2 border-primary-200 rounded-xl focus:border-primary-500 outline-none"
                                            value={extendData.expectedEndDate}
                                            onChange={(e) => setExtendData({ expectedEndDate: e.target.value })}
                                        />
                                        <button
                                            type="submit"
                                            disabled={actionLoading}
                                            className="px-6 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50"
                                        >
                                            Update Date
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowExtendForm(false)}
                                            className="px-4 py-2 bg-white text-gray-500 rounded-xl font-bold border border-gray-200"
                                        >
                                            Cancel
                                        </button>
                                    </form>
                                    <p className="mt-2 text-[10px] text-primary-600 font-medium">
                                        * Extending will automatically calculate additional bed charges.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Services List */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                                <h5 className="font-bold text-gray-900 flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-purple-600" />
                                    Additional Services
                                </h5>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {admission.services && admission.services.length > 0 ? (
                                    admission.services.map((svc) => (
                                        <div key={svc.id} className="p-4 flex justify-between items-center hover:bg-gray-25 transition-colors">
                                            <div>
                                                <p className="font-bold text-gray-800">{svc.service?.name}</p>
                                                <p className="text-xs text-gray-500">Ordered by {svc.orderedBy?.fullname} on {new Date(svc.createdAt).toLocaleDateString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-primary-700">{svc.totalPrice?.toLocaleString()} ETB</p>
                                                <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-bold uppercase tracking-wider">{svc.status}</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-12 text-center text-gray-400">
                                        <p className="text-sm">No additional services have been ordered for this stay.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats/Action Info */}
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-primary-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-white/20 rounded-lg">
                                    <Activity className="h-6 w-6" />
                                </div>
                                <h5 className="font-bold">Occupancy Intel</h5>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                                    <span className="text-white/70 text-sm">Stay Duration</span>
                                    <span className="font-bold text-lg">
                                        {Math.ceil(Math.abs(new Date(admission.expectedEndDate) - new Date(admission.startDate)) / (1000 * 60 * 60 * 24))} Days
                                    </span>
                                </div>
                                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                                    <span className="text-white/70 text-sm">Bed Cost</span>
                                    <span className="font-bold text-lg">
                                        {(admission.bed?.price * Math.ceil(Math.abs(new Date(admission.expectedEndDate) - new Date(admission.startDate)) / (1000 * 60 * 60 * 24))).toLocaleString()} ETB
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-white/70 text-sm">Services Total</span>
                                    <span className="font-bold text-lg">
                                        {admission.services?.reduce((sum, s) => sum + s.totalPrice, 0).toLocaleString()} ETB
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                                <div>
                                    <h5 className="font-bold text-amber-900 text-sm">Special Note</h5>
                                    <p className="text-amber-800 text-xs mt-1 leading-relaxed">
                                        Accommodations are linked to the patient globally. You can manage this stay even after finishing this consultation visit.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : showAssignForm ? (
                <div className="bg-white rounded-3xl p-8 border-2 border-primary-50 shadow-xl max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h4 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <Bed className="h-8 w-8 text-primary-600" />
                        Admit Patient to Ward
                    </h4>

                    <form onSubmit={handleAssignBed} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold text-gray-700 mb-2 px-1 uppercase tracking-wide">Select Available Bed *</label>
                                <select
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-primary-500 focus:bg-white rounded-2xl outline-none transition-all text-gray-900"
                                    value={formData.bedId}
                                    onChange={(e) => setFormData({ ...formData, bedId: e.target.value })}
                                >
                                    <option value="">-- Select a Bed --</option>
                                    {beds.filter(b => b.status === 'AVAILABLE').map(bed => (
                                        <option key={bed.id} value={bed.id}>
                                            {bed.name} ({bed.type}) - {bed.price.toLocaleString()} ETB/Day
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2 px-1 uppercase tracking-wide">Stay Duration (Days) *</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-primary-500 focus:bg-white rounded-2xl outline-none transition-all text-gray-900"
                                        value={durationDays}
                                        onChange={(e) => setDurationDays(e.target.value)}
                                    />
                                    <span className="text-gray-500 font-bold">Days</span>
                                </div>
                                <p className="text-[10px] text-primary-600 mt-1 font-medium italic">
                                    Ends on: {new Date(formData.expectedEndDate).toLocaleDateString()}
                                </p>
                            </div>
                        </div>

                        {/* Initial Services Selection */}
                        <div className="space-y-4">
                            <label className="block text-sm font-bold text-gray-700 px-1 uppercase tracking-wide">Select Preliminary Services</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-2 bg-gray-50 rounded-2xl border border-gray-100">
                                {services.map(svc => {
                                    const isSelected = selectedInitialServices.find(s => s.id === svc.id);
                                    return (
                                        <div
                                            key={svc.id}
                                            onClick={() => toggleInitialService(svc)}
                                            className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${isSelected ? 'border-primary-500 bg-primary-50 shadow-sm' : 'border-white bg-white hover:border-gray-200'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex-1">
                                                    <p className={`font-bold text-sm ${isSelected ? 'text-primary-900' : 'text-gray-800'}`}>{svc.name}</p>
                                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">{svc.price.toLocaleString()} ETB</p>
                                                </div>
                                                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-primary-600 border-primary-600' : 'border-gray-300'
                                                    }`}>
                                                    {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                                                </div>
                                            </div>

                                            {isSelected && (
                                                <div className="flex items-center gap-2 pt-2 border-t border-primary-100 mt-2" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateInitialServiceQuantity(svc.id, -1)}
                                                        className="h-6 w-6 rounded bg-white border border-primary-200 text-primary-600 flex items-center justify-center hover:bg-primary-100"
                                                    >-</button>
                                                    <span className="text-xs font-bold w-4 text-center">{isSelected.quantity}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateInitialServiceQuantity(svc.id, 1)}
                                                        className="h-6 w-6 rounded bg-white border border-primary-200 text-primary-600 flex items-center justify-center hover:bg-primary-100"
                                                    >+</button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2 px-1 uppercase tracking-wide">Admission Notes & Instructions</label>
                            <textarea
                                className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-primary-500 focus:bg-white rounded-2xl outline-none transition-all text-gray-900"
                                rows="4"
                                placeholder="Reason for admission, specific nursing instructions, etc..."
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            />
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button
                                type="button"
                                onClick={() => setShowAssignForm(false)}
                                className="flex-1 px-8 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all uppercase tracking-widest text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={actionLoading}
                                className="flex-1 px-8 py-4 bg-primary-600 text-white rounded-2xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 uppercase tracking-widest text-sm flex items-center justify-center gap-3"
                            >
                                {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                                Confirm Admission
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="bg-white rounded-3xl p-16 text-center border-2 border-dashed border-gray-100">
                    <div className="h-24 w-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-200">
                        <Bed className="h-12 w-12" />
                    </div>
                    <h4 className="text-2xl font-bold text-gray-900 mb-2">Patient not currently admitted</h4>
                    <p className="text-gray-500 max-w-md mx-auto mb-8">
                        This patient is not currently assigned to any bed. Do they require overnight monitoring or ward care?
                    </p>
                    <button
                        onClick={() => setShowAssignForm(true)}
                        className="px-10 py-4 bg-primary-600 text-white rounded-2xl font-bold hover:bg-primary-700 transition-all shadow-xl shadow-primary-100 uppercase tracking-widest text-sm"
                    >
                        Prepare Admission
                    </button>
                </div>
            )}
        </div>
    );
};

export default AccommodationTab;
