import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, Clock, Plus, Trash2, ShieldCheck, AlertCircle, CreditCard, DollarSign, User } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ProcedureOrdering = ({ visit, onOrdersPlaced }) => {
    const [services, setServices] = useState([]);
    const [selectedServices, setSelectedServices] = useState([]);
    const [instructions, setInstructions] = useState({});
    const [customPrices, setCustomPrices] = useState({});
    const [quantities, setQuantities] = useState({});
    const [selectedNurse, setSelectedNurse] = useState('');
    const [nurses, setNurses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchingData, setFetchingData] = useState(true);
    const [existingOrders, setExistingOrders] = useState([]);
    const [completingId, setCompletingId] = useState(null);
    const [creditInfo, setCreditInfo] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchServices();
        fetchExistingOrders();
        fetchNurses();
    }, [visit?.id]);

    const fetchNurses = async () => {
        try {
            const response = await api.get('/nurses/nurses');
            setNurses(response.data.nurses || []);
        } catch (error) {
            console.error('Error fetching nurses:', error);
        }
    };

    // Fetch patient credit info
    useEffect(() => {
        const fetchCreditInfo = async () => {
            if (!visit?.patient?.id) return;
            try {
                const response = await api.get(`/accounts/patient/${visit.patient.id}/credit-summary`);
                setCreditInfo(response.data);
            } catch (error) {
                console.error('Error fetching credit info:', error);
            }
        };
        fetchCreditInfo();
    }, [visit?.patient?.id]);

    const fetchServices = async () => {
        try {
            setFetchingData(true);
            const response = await api.get('/doctors/services?category=PROCEDURE');
            const procedures = (response.data.services || []).filter(
                service => service.category === 'PROCEDURE' && service.isActive
            );
            setServices(procedures);
        } catch (error) {
            console.error('Error fetching procedures:', error);
            toast.error('Failed to fetch procedure list');
        } finally {
            setFetchingData(false);
        }
    };

    const fetchExistingOrders = async () => {
        if (!visit?.id) return;
        try {
            // Find batch orders of type PROCEDURE for this visit
            const response = await api.get(`/doctors/visits/${visit.id}`);
            const visitData = response.data;

            const procedureOrders = (visitData.batchOrders || [])
                .filter(order => order.type === 'PROCEDURE')
                .flatMap(bo => bo.services?.map(s => ({
                    id: s.id,
                    batchOrderId: bo.id,
                    serviceId: s.serviceId,
                    name: s.service?.name || 'Procedure',
                    status: s.status || bo.status,
                    createdAt: s.createdAt || bo.createdAt,
                    instructions: s.instructions || bo.instructions,
                    isBatch: true,
                    assignedNurseName: null,
                    assignedByName: bo.doctor?.fullname || null
                })) || []);

            const nurseProcedures = (visitData.nurseServiceAssignments || [])
                .filter(ns => ns.service?.category === 'PROCEDURE')
                .map(ns => ({
                    id: ns.id,
                    serviceId: ns.serviceId,
                    name: ns.service?.name || 'Procedure',
                    status: ns.status,
                    createdAt: ns.createdAt,
                    instructions: ns.notes,
                    isNurseService: true,
                    assignedNurseName: ns.assignedNurse?.fullname || null,
                    assignedByName: ns.assignedBy?.fullname || null
                }));

            const merged = [...procedureOrders, ...nurseProcedures].sort(
                (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
            );
            setExistingOrders(merged);
        } catch (error) {
            console.error('Error fetching existing procedure orders:', error);
        }
    };

    const toggleService = (service) => {
        setSelectedServices(prev => {
            const exists = prev.find(s => s.id === service.id);
            if (exists) {
                const newPrices = { ...customPrices };
                const newQuantities = { ...quantities };
                delete newPrices[service.id];
                delete newQuantities[service.id];
                setCustomPrices(newPrices);
                setQuantities(newQuantities);
                return prev.filter(s => s.id !== service.id);
            } else {
                if (service.isVariablePrice) {
                    setCustomPrices(prev => ({
                        ...prev,
                        [service.id]: service.minPrice || 0
                    }));
                }
                setQuantities(prev => ({
                    ...prev,
                    [service.id]: 1
                }));
                return [...prev, service];
            }
        });
    };

    const updateQuantity = (serviceId, qty) => {
        const qtyNum = parseInt(qty) || 1;
        if (qtyNum < 1) return;
        setQuantities({ ...quantities, [serviceId]: qtyNum });
    };

    const calculateTotal = () => {
        return selectedServices.reduce((sum, service) => {
            const price = service.isVariablePrice ? (parseFloat(customPrices[service.id]) || 0) : service.price;
            const qty = parseInt(quantities[service.id]) || 1;
            return sum + (price * qty);
        }, 0);
    };

    const updateInstruction = (serviceId, text) => {
        setInstructions({ ...instructions, [serviceId]: text });
    };

    const handleSubmitOrder = async () => {
        if (selectedServices.length === 0) {
            toast.error('Please select at least one procedure');
            return;
        }

        // Validate variable prices range
        for (const service of selectedServices) {
            if (service.isVariablePrice) {
                const price = parseFloat(customPrices[service.id]);
                if (isNaN(price)) {
                    toast.error(`Please set a price for ${service.name}`);
                    return;
                }
                if (service.minPrice !== null && price < service.minPrice) {
                    toast.error(`${service.name} price must be at least ${service.minPrice} ETB`);
                    return;
                }
                if (service.maxPrice !== null && price > service.maxPrice) {
                    toast.error(`${service.name} price cannot exceed ${service.maxPrice} ETB`);
                    return;
                }
            }
        }

        setLoading(true);
        try {
            // Build services array with quantity support
            const servicesData = [];
            for (const s of selectedServices) {
                const qty = parseInt(quantities[s.id]) || 1;
                const price = s.isVariablePrice ? (parseFloat(customPrices[s.id]) || 0) : s.price;
                // Add each service quantity times
                for (let i = 0; i < qty; i++) {
                    servicesData.push({
                        serviceId: s.id,
                        instructions: instructions[s.id] || '',
                        customPrice: s.isVariablePrice ? price : null
                    });
                }
            }

            const orderData = {
                visitId: visit.id,
                patientId: visit.patient.id,
                type: 'PROCEDURE',
                assignedNurseId: selectedNurse || undefined,
                services: servicesData
            };

            await api.post('/batch-orders/create', orderData);
            toast.success('Procedures ordered and sent to billing successfully!');
            setSelectedServices([]);
            setInstructions({});
            setCustomPrices({});
            setQuantities({});
            setSelectedNurse('');
            await fetchExistingOrders();
            if (onOrdersPlaced) onOrdersPlaced();
        } catch (error) {
            console.error('Error creating procedure orders:', error);
            toast.error(error.response?.data?.error || 'Failed to create procedure orders');
        } finally {
            setLoading(false);
        }
    };

    const handleCompleteProcedure = async (batchOrderId, serviceId) => {
        setCompletingId(`${batchOrderId}-${serviceId}`);
        try {
            await api.post('/batch-orders/procedures/complete', {
                batchOrderId,
                serviceId
            });
            toast.success('Procedure marked as completed!');
            await fetchExistingOrders();
            if (onOrdersPlaced) onOrdersPlaced();
        } catch (error) {
            console.error('Error completing procedure:', error);
            toast.error(error.response?.data?.error || 'Failed to mark as completed. Is it paid?');
        } finally {
            setCompletingId(null);
        }
    };

    if (fetchingData) {
        return (
            <div className="flex items-center justify-center py-12 bg-white rounded-xl border border-gray-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3"></div>
                    <p className="text-gray-500 text-sm font-medium">Loading procedures...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Credit Warning Section */}
            {creditInfo && creditInfo.hasAccount && creditInfo.isVerified && (
                <div className={`p-4 rounded-lg border ${creditInfo.creditAvailable > 0
                    ? 'bg-green-50 border-green-200'
                    : creditInfo.creditAvailable < 0
                        ? 'bg-red-50 border-red-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                    <div className="flex items-center gap-3">
                        {creditInfo.creditAvailable > 0 ? (
                            <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                                <CreditCard className="h-5 w-5 text-green-600" />
                            </div>
                        ) : creditInfo.creditAvailable < 0 ? (
                            <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                                <AlertCircle className="h-5 w-5 text-red-600" />
                            </div>
                        ) : (
                            <div className="h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
                                <DollarSign className="h-5 w-5 text-gray-600" />
                            </div>
                        )}
                        <div>
                            <p className="text-sm font-semibold text-gray-900">
                                {creditInfo.accountType === 'BOTH' ? 'Standard (Advance + Credit)' : creditInfo.accountType} Account
                            </p>
                            {creditInfo.creditAvailable > 0 && (
                                <p className="text-sm text-green-700">
                                    Available Credit: <span className="font-bold">{creditInfo.creditAvailable.toFixed(2)} ETB</span>
                                </p>
                            )}
                            {creditInfo.creditAvailable < 0 && (
                                <p className="text-sm text-red-700">
                                    Outstanding Balance: <span className="font-bold">{Math.abs(creditInfo.creditAvailable).toFixed(2)} ETB</span>
                                </p>
                            )}
                            {creditInfo.creditAvailable === 0 && (
                                <p className="text-sm text-gray-600">
                                    Account cleared - No pending balance
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Active/Recent Orders - MATCHING EMERGENCY DRUG STYLE */}
            {existingOrders.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Clock className="h-4 w-4 text-indigo-500" />
                            Current Procedure Orders ({existingOrders.length})
                        </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {existingOrders.map((order) => (
                            <div key={`${order.isBatch ? 'batch' : 'nurse'}-${order.id}`} className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex justify-between items-center transition-all hover:border-indigo-200">
                                <div className="flex flex-col">
                                    <span className="font-medium text-sm text-gray-900">{order.name}</span>
                                    {order.instructions && (
                                        <span className="text-[11px] text-gray-500 mt-1 italic">
                                            Note: {order.instructions}
                                        </span>
                                    )}
                                    <span className="text-[10px] text-gray-400 mt-0.5">
                                        {order.isBatch ? `Order #${order.batchOrderId}` : 'Nurse Assignment'} • {new Date(order.createdAt).toLocaleDateString()}
                                    </span>
                                    {order.assignedNurseName && (
                                        <span className="text-[10px] text-gray-500 mt-0.5">Assigned Nurse: {order.assignedNurseName}</span>
                                    )}
                                    {order.assignedByName && (
                                        <span className="text-[10px] text-gray-500 mt-0.5">Assigned By: {order.assignedByName}</span>
                                    )}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${order.status === 'PAID' ? 'bg-green-100 text-green-700' :
                                        order.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' :
                                            order.status === 'QUEUED' ? 'bg-yellow-100 text-yellow-700' :
                                                order.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-orange-100 text-orange-700'
                                        }`}>
                                        {order.status === 'UNPAID' ? 'Awaiting Payment' : order.status}
                                    </span>

                                    {order.isBatch && order.status !== 'COMPLETED' && (
                                        <button
                                            onClick={() => handleCompleteProcedure(order.batchOrderId, order.serviceId)}
                                            disabled={completingId === `${order.batchOrderId}-${order.serviceId}`}
                                            className="bg-green-600 hover:bg-green-700 text-white text-[10px] font-semibold px-4 py-1.5 rounded-md transition-all whitespace-nowrap"
                                        >
                                            {completingId === `${order.batchOrderId}-${order.serviceId}` ? (
                                                <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
                                            ) : (
                                                'Complete Procedure'
                                            )}
                                        </button>
                                    )}

                                    {order.status === 'COMPLETED' && (
                                        <span className="flex items-center gap-1 text-blue-600 font-bold text-[10px] bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                            <CheckCircle className="h-3 w-3" />
                                            DONE
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Selection Area */}
            <div className="bg-white p-4 border border-gray-200 rounded-xl">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h4 className="font-semibold text-gray-900">Available Procedures</h4>
                        <p className="text-sm text-gray-500">Select procedures to send to billing</p>
                    </div>
                    <div className="relative flex-1 max-w-md">
                        <input
                            type="text"
                            placeholder="Search procedures..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                        <svg className="absolute left-3 top-3 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 7 0 0114 00 7 z" />
                        </svg>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {(searchTerm ? services.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())) : services).length === 0 ? (
                        <div className="col-span-full py-10 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <Activity className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-500 text-sm">No procedures available.</p>
                        </div>
                    ) : (
                        (searchTerm ? services.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())) : services).map((service) => {
                            const isSelected = selectedServices.some(s => s.id === service.id);
                            return (
                                <div
                                    key={service.id}
                                    onClick={() => toggleService(service)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 flex flex-col justify-between active:scale-95 ${isSelected
                                        ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-100'
                                        : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="mb-2">
                                        <div className={`text-[10px] uppercase mb-0.5 tracking-wider ${isSelected ? 'text-indigo-600' : 'text-gray-400'}`}>
                                            {service.code || 'PROC'}
                                        </div>
                                        <h5 className={`font-medium text-sm leading-tight ${isSelected ? 'text-indigo-800' : 'text-gray-700'}`}>
                                            {service.name}
                                        </h5>
                                    </div>

                                    <div className="flex justify-between items-center pt-2 border-t border-gray-100 mt-auto">
                                        <span className={`text-xs font-medium ${isSelected ? 'text-indigo-600' : 'text-gray-500'}`}>
                                            {service.isVariablePrice ? (
                                                <span className="flex flex-col">
                                                    <span>{service.minPrice} - {service.maxPrice}</span>
                                                    <span className="text-[9px] font-bold text-indigo-500 uppercase">Variable</span>
                                                </span>
                                            ) : (
                                                `${service.price?.toFixed(2)} ETB`
                                            )}
                                        </span>
                                        {isSelected ? (
                                            <CheckCircle className="h-4 w-4 text-indigo-600" />
                                        ) : (
                                            <Plus className="h-4 w-4 text-gray-300 group-hover:text-indigo-500" />
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Selected List - Clean confirmation */}
            {selectedServices.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-gray-100">
                        <h4 className="font-semibold text-gray-900">Confirm Selection ({selectedServices.length})</h4>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {/* Nurse Assignment Section */}
                        <div className="p-4 bg-indigo-50 border-b border-indigo-100">
                            <div className="flex items-center gap-3">
                                <User className="h-5 w-5 text-indigo-600" />
                                <div className="flex-1">
                                    <label className="text-sm font-semibold text-indigo-900 block mb-1">
                                        Assign Nurse (Optional)
                                    </label>
                                    <select
                                        value={selectedNurse}
                                        onChange={(e) => setSelectedNurse(e.target.value)}
                                        className="w-full text-sm border border-indigo-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">Select a nurse to perform procedures...</option>
                                        {nurses.map(nurse => (
                                            <option key={nurse.id} value={nurse.id}>
                                                {nurse.fullname}
                                            </option>
                                        ))}
                                    </select>
                                    {selectedNurse && (
                                        <p className="text-xs text-indigo-600 mt-1">
                                            Procedures will appear in the selected nurse's daily tasks
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {selectedServices.map((service) => (
                            <div key={service.id} className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex-1">
                                    <h5 className="font-medium text-sm text-gray-900">{service.name}</h5>
                                    <input
                                        type="text"
                                        className="w-full mt-2 text-xs px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                                        placeholder="Special instructions for this procedure..."
                                        value={instructions[service.id] || ''}
                                        onChange={(e) => updateInstruction(service.id, e.target.value)}
                                    />
                                    {service.isVariablePrice && (
                                        <div className="mt-3 bg-indigo-50 p-3.5 rounded-lg border border-indigo-200 flex flex-col items-stretch gap-2">
                                            <label className="text-sm font-bold text-indigo-800">Set Assessment Price ({service.minPrice} - {service.maxPrice}):</label>
                                            <div className="relative w-full md:max-w-sm">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600 text-sm font-bold">ETB</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min={service.minPrice}
                                                    max={service.maxPrice}
                                                    className="w-full pl-12 pr-3 py-3 text-base border-2 border-indigo-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-900 bg-white"
                                                    placeholder="Enter assessment price..."
                                                    value={customPrices[service.id] || ''}
                                                    onChange={(e) => setCustomPrices({ ...customPrices, [service.id]: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-4">
                                    {/* Quantity Input */}
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs font-semibold text-gray-600">Qty:</label>
                                        <input
                                            type="number"
                                            min="1"
                                            className="w-20 text-sm border-2 border-indigo-300 rounded-lg px-2 py-2 text-center outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-indigo-900 bg-white"
                                            value={quantities[service.id] || 1}
                                            onChange={(e) => updateQuantity(service.id, e.target.value)}
                                        />
                                    </div>
                                    <span className="text-sm font-semibold text-gray-700">
                                        {((service.isVariablePrice ? (parseFloat(customPrices[service.id]) || 0) : service.price) * (quantities[service.id] || 1)).toFixed(2)} ETB
                                    </span>
                                    <button
                                        onClick={() => toggleService(service)}
                                        className="text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-4 bg-gray-50 border-t flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="text-lg font-bold text-gray-900">
                            Total: <span className="text-indigo-600">{calculateTotal().toFixed(2)} ETB</span>
                        </div>
                        <button
                            onClick={handleSubmitOrder}
                            disabled={loading}
                            className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-8 rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                            ) : (
                                <>
                                    <ShieldCheck className="h-4 w-4" />
                                    Confirm & Send to Billing
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProcedureOrdering;
