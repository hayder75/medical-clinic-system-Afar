import React, { useState, useEffect } from 'react';
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
    Stethoscope
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Layout from '../../components/common/Layout';
import { useAuth } from '../../contexts/AuthContext';

const AdmissionManagement = () => {
    const { user } = useAuth();
    const [admissions, setAdmissions] = useState([]);
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

    const [showExtendModal, setShowExtendModal] = useState(false);
    const [extendData, setExtendData] = useState({
        expectedEndDate: ''
    });

    useEffect(() => {
        fetchData();
        fetchServices();
    }, [statusFilter]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [admRes, bedRes] = await Promise.all([
                api.get(`/accommodation/admissions?status=${statusFilter}`),
                api.get('/accommodation/beds')
            ]);

            if (admRes.data.success) setAdmissions(admRes.data.admissions);
            if (bedRes.data.success) setBeds(bedRes.data.beds);
        } catch (error) {
            toast.error('Failed to fetch admission data');
        } finally {
            setLoading(false);
        }
    };

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

    const handleAddService = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('/accommodation/admissions/services', {
                admissionId: selectedAdmission.id,
                ...serviceFormData,
                quantity: parseInt(serviceFormData.quantity)
            });

            if (response.data.success) {
                toast.success('Service added successfully');
                setShowServiceModal(false);
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
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by patient name, ID or bed..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setStatusFilter('ADMITTED')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${statusFilter === 'ADMITTED' ? 'bg-primary-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            Current Admissions
                        </button>
                        <button
                            onClick={() => setStatusFilter('PENDING_PAYMENT')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${statusFilter === 'PENDING_PAYMENT' ? 'bg-yellow-500 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            Pending Payment
                        </button>
                        <button
                            onClick={() => setStatusFilter('DISCHARGED')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${statusFilter === 'DISCHARGED' ? 'bg-primary-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            Past Admissions
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
                            <div key={adm.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                                <div className="p-6">
                                    <div className="flex flex-col lg:flex-row justify-between gap-6">
                                        {/* Patient & Bed Info */}
                                        <div className="flex-1 space-y-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-14 w-14 rounded-full bg-primary-50 flex items-center justify-center text-primary-600">
                                                        <User className="h-8 w-8" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xl font-bold text-gray-900">{adm.patient?.name}</h3>
                                                        <div className="flex items-center gap-3 text-sm text-gray-500">
                                                            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">#{adm.patient?.id}</span>
                                                            <span>•</span>
                                                            <span>{adm.patient?.gender}</span>
                                                            <span>•</span>
                                                            <span>{adm.patient?.dob ? new Date().getFullYear() - new Date(adm.patient.dob).getFullYear() : 'N/A'} years</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg font-bold">
                                                        <Bed className="h-5 w-5" />
                                                        {adm.bed?.name}
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-1 uppercase font-bold tracking-wider">{adm.bed?.type}</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-4 border-y border-gray-50">
                                                <div>
                                                    <p className="text-xs text-gray-500 font-medium">Admitted On</p>
                                                    <p className="text-sm font-semibold text-gray-900">{new Date(adm.startDate).toLocaleDateString()}</p>
                                                    <p className="text-xs text-gray-400">{new Date(adm.startDate).toLocaleTimeString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 font-medium">Expected Discharge</p>
                                                    <p className={`text-sm font-semibold ${calculateDaysRemaining(adm.expectedEndDate) <= 1 ? 'text-red-600' : 'text-gray-900'}`}>
                                                        {new Date(adm.expectedEndDate).toLocaleDateString()}
                                                    </p>
                                                    <p className="text-xs text-gray-400">({calculateDaysRemaining(adm.expectedEndDate)} days left)</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 font-medium">Admitted By</p>
                                                    <p className="text-sm font-semibold text-gray-900 truncate">{adm.admittedBy?.fullname}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 font-medium">Daily Bed Rate</p>
                                                    <p className="text-sm font-semibold text-primary-600">{adm.bed?.price?.toLocaleString()} ETB</p>
                                                </div>
                                            </div>

                                            {adm.notes && (
                                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Nursing/Doctor Notes</p>
                                                    <p className="text-sm text-gray-700 italic">"{adm.notes}"</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions Panel */}
                                        <div className="lg:w-72 space-y-3 pt-6 lg:pt-0 border-t lg:border-t-0 lg:border-l border-gray-100 lg:pl-6">
                                            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Actions</p>
                                            <button
                                                onClick={() => {
                                                    setSelectedAdmission(adm);
                                                    setShowServiceModal(true);
                                                }}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold"
                                            >
                                                <PlusCircle className="h-5 w-5" />
                                                Add Service
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setSelectedAdmission(adm);
                                                    setExtendData({ expectedEndDate: new Date(adm.expectedEndDate).toISOString().split('T')[0] });
                                                    setShowExtendModal(true);
                                                }}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
                                            >
                                                <Calendar className="h-5 w-5" />
                                                Extend Stay
                                            </button>
                                            {adm.status === 'ADMITTED' && (
                                                <button
                                                    onClick={() => handleDischarge(adm.id)}
                                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 border border-orange-200 rounded-xl hover:bg-orange-100 transition-colors font-semibold"
                                                >
                                                    <LogOut className="h-5 w-5" />
                                                    Discharge
                                                </button>
                                            )}
                                            {adm.status === 'PENDING_PAYMENT' && (
                                                <button
                                                    onClick={() => handleDischarge(adm.id)}
                                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-100 transition-colors font-semibold"
                                                >
                                                    <LogOut className="h-5 w-5" />
                                                    Cancel Booking
                                                </button>
                                            )}
                                            {adm.visitId && (
                                                <button
                                                    onClick={() => window.open(`/doctor/consultation/${adm.visitId}`, '_blank')}
                                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors font-semibold"
                                                >
                                                    <Stethoscope className="h-5 w-5" />
                                                    View Consultation
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Services Sub-list */}
                                    <div className="mt-8">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                                <Activity className="h-5 w-5 text-purple-600" />
                                                Ordered Services ({adm.services?.length || 0})
                                            </h4>
                                        </div>
                                        {adm.services && adm.services.length > 0 ? (
                                            <div className="overflow-x-auto rounded-xl border border-gray-100">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="bg-gray-50 text-gray-600 font-medium">
                                                        <tr>
                                                            <th className="px-4 py-3">Service</th>
                                                            <th className="px-4 py-3">Qty</th>
                                                            <th className="px-4 py-3">Total Cost</th>
                                                            <th className="px-4 py-3">Ordered By</th>
                                                            <th className="px-4 py-3">Date</th>
                                                            <th className="px-4 py-3">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50">
                                                        {adm.services.map((svc) => (
                                                            <tr key={svc.id} className="hover:bg-gray-25">
                                                                <td className="px-4 py-3 font-medium text-gray-900">{svc.service?.name}</td>
                                                                <td className="px-4 py-3 text-gray-600">x{svc.quantity}</td>
                                                                <td className="px-4 py-3 font-semibold text-gray-900">{svc.totalPrice?.toLocaleString()} ETB</td>
                                                                <td className="px-4 py-3">
                                                                    <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                                                                        {svc.orderedBy?.fullname} ({svc.orderedBy?.role})
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-gray-500 italic text-xs">
                                                                    {new Date(svc.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                                                                </td>
                                                                <td className="px-4 py-3 text-gray-500">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${svc.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                                        {svc.status}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                <p className="text-sm text-gray-400">No additional services ordered for this admission yet.</p>
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

            {/* Service Modal */}
            {showServiceModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-green-600 p-6 text-white">
                            <h3 className="text-2xl font-bold flex items-center gap-3">
                                <PlusCircle className="h-7 w-7" />
                                Add Admission Service
                            </h3>
                            <p className="text-green-100 mt-1">Ordering for: {selectedAdmission?.patient?.name}</p>
                        </div>
                        <form onSubmit={handleAddService} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Select Service *</label>
                                <select
                                    required
                                    className="w-full px-4 py-2.5 border-2 border-gray-100 rounded-xl focus:border-green-500 focus:ring-4 focus:ring-green-50 outline-none transition-all"
                                    value={serviceFormData.serviceId}
                                    onChange={(e) => setServiceFormData({ ...serviceFormData, serviceId: e.target.value })}
                                >
                                    <option value="">-- Choose an accommodation service --</option>
                                    {accommodationServices.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} - {s.price.toLocaleString()} ETB</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Quantity *</label>
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        className="w-full px-4 py-2.5 border-2 border-gray-100 rounded-xl focus:border-green-500 focus:ring-4 focus:ring-green-50 outline-none"
                                        value={serviceFormData.quantity}
                                        onChange={(e) => setServiceFormData({ ...serviceFormData, quantity: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Estimated Cost</label>
                                    <div className="px-4 py-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-green-700">
                                        {(accommodationServices.find(s => s.id === serviceFormData.serviceId)?.price || 0) * serviceFormData.quantity} ETB
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Instruction / Notes</label>
                                <textarea
                                    className="w-full px-4 py-2.5 border-2 border-gray-100 rounded-xl focus:border-green-500 focus:ring-4 focus:ring-green-50 outline-none"
                                    rows="3"
                                    placeholder="Additional details for this service..."
                                    value={serviceFormData.notes}
                                    onChange={(e) => setServiceFormData({ ...serviceFormData, notes: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowServiceModal(false)}
                                    className="flex-1 px-6 py-3 text-gray-600 font-bold bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-200 transition-all active:scale-95"
                                >
                                    Confirm Order
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
                                    min={new Date().toISOString().split('T')[0]}
                                    className="w-full px-4 py-2.5 border-2 border-gray-100 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none"
                                    value={extendData.expectedEndDate}
                                    onChange={(e) => setExtendData({ expectedEndDate: e.target.value })}
                                />
                                <p className="mt-2 text-xs text-gray-400">This will automatically calculate additional bed charges and send them to billing.</p>
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
        </Layout>
    );
};

export default AdmissionManagement;
