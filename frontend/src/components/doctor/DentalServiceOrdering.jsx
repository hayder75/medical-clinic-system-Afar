import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, X, CheckCircle, Clock, DollarSign, AlertCircle, ShoppingCart, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const DentalServiceOrdering = ({ visitId, patientId, onOrdersPlaced, existingOrders = [] }) => {
  const [dentalServices, setDentalServices] = useState([]);

  // Credit info state
  const [creditInfo, setCreditInfo] = useState(null);

  // Use sessionStorage key to persist selected services across refetches
  const [isDeferred, setIsDeferred] = useState(false);
  const storageKey = `dental-services-${visitId}`;

  // Load selected services from sessionStorage on mount
  const loadStoredServices = () => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed;
      }
    } catch (error) {
      console.error('Error loading stored services:', error);
    }
    return { selectedServices: [], serviceQuantities: {}, instructions: '' };
  };

  const storedData = loadStoredServices();
  const [selectedServices, setSelectedServices] = useState(storedData.selectedServices || []);
  const [serviceQuantities, setServiceQuantities] = useState(storedData.serviceQuantities || {});
  const [serviceNotes, setServiceNotes] = useState(storedData.serviceNotes || {});
  const [customPrices, setCustomPrices] = useState(storedData.customPrices || {});
  const [instructions, setInstructions] = useState(storedData.instructions || '');
  const [loading, setLoading] = useState(false);
  const [fetchingServices, setFetchingServices] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Save to sessionStorage whenever selections change
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({
        selectedServices,
        serviceQuantities,
        serviceNotes,
        customPrices,
        instructions
      }));
    } catch (error) {
      console.error('Error saving to sessionStorage:', error);
    }
  }, [selectedServices, serviceQuantities, serviceNotes, instructions, storageKey]);

  useEffect(() => {
    fetchDentalServices();
    // Load stored selections from sessionStorage
    const stored = loadStoredServices();
    if (stored.selectedServices.length > 0) {
      setSelectedServices(stored.selectedServices);
      setServiceQuantities(stored.serviceQuantities);
      setServiceNotes(stored.serviceNotes || {});
      setCustomPrices(stored.customPrices || {});
      setInstructions(stored.instructions);
    }

    const handleDentalOrder = () => {
      if (onOrdersPlaced) onOrdersPlaced();
    };
    window.addEventListener('dental-order-placed', handleDentalOrder);
    return () => window.removeEventListener('dental-order-placed', handleDentalOrder);
  }, []);

  // Fetch patient credit info
  useEffect(() => {
    const fetchCreditInfo = async () => {
      if (!patientId) return;
      try {
        const response = await api.get(`/accounts/patient/${patientId}/credit-summary`);
        setCreditInfo(response.data);
      } catch (error) {
        console.error('Error fetching credit info:', error);
      }
    };
    fetchCreditInfo();
  }, [patientId]);

  const fetchDentalServices = async () => {
    try {
      setFetchingServices(true);
      const response = await api.get('/doctors/services?category=DENTAL');
      setDentalServices(response.data.services || []);
    } catch (error) {
      console.error('Error fetching dental services:', error);
      toast.error('Failed to fetch dental services');
    } finally {
      setFetchingServices(false);
    }
  };

  const handleServiceSelect = (service) => {
    // Allow ordering same service multiple times - doctor's discretion
    setSelectedServices(prev => {
      const exists = prev.find(s => s.id === service.id);
      if (exists) {
        // Remove service and its quantity and notes
        const newQuantities = { ...serviceQuantities };
        const newNotes = { ...serviceNotes };
        const newPrices = { ...customPrices };
        delete newQuantities[service.id];
        delete newNotes[service.id];
        delete newPrices[service.id];
        setServiceQuantities(newQuantities);
        setServiceNotes(newNotes);
        setCustomPrices(newPrices);
        return prev.filter(s => s.id !== service.id);
      } else {
        // Add service with default quantity 1 and default price if variable
        if (service.isVariablePrice) {
          setCustomPrices(prev => ({
            ...prev,
            [service.id]: service.minPrice || 0
          }));
        }
        setServiceQuantities(prev => ({
          ...prev,
          [service.id]: 1
        }));
        return [...prev, service];
      }
    });
  };

  const updateQuantity = (serviceId, quantity) => {
    const qty = Math.max(1, parseInt(quantity) || 1);
    setServiceQuantities(prev => ({
      ...prev,
      [serviceId]: qty
    }));
  };

  const calculateTotal = () => {
    return selectedServices.reduce((total, service) => {
      const quantity = serviceQuantities[service.id] || 1;
      const price = service.isVariablePrice ? (customPrices[service.id] || 0) : service.price;
      return total + (price * quantity);
    }, 0);
  };

  const handleSubmit = async () => {
    if (selectedServices.length === 0) {
      toast.error('Please select at least one dental service');
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

    // Show confirmation modal only for deferred services
    if (isDeferred) {
      setShowConfirmModal(true);
    } else {
      // For non-deferred, submit directly
      confirmOrder();
    }
  };

  const confirmOrder = async () => {
    try {
      setLoading(true);
      setShowConfirmModal(false);

      // Prepare services - expand quantities into multiple entries
      const services = [];
      selectedServices.forEach(service => {
        const quantity = serviceQuantities[service.id] || 1;
        const serviceNote = serviceNotes[service.id] || '';
        const customPrice = service.isVariablePrice ? parseFloat(customPrices[service.id]) : null;
        // Create one entry per unit
        for (let i = 0; i < quantity; i++) {
          services.push({
            serviceId: service.id,
            instructions: serviceNote || instructions || undefined,
            customPrice: customPrice
          });
        }
      });

      // Prepare request payload
      const payload = {
        visitId: parseInt(visitId),
        patientId: String(patientId),
        type: 'DENTAL',
        services: services,
        isDeferred: isDeferred
      };

      // Add instructions only if provided
      if (instructions && instructions.trim()) {
        payload.instructions = instructions.trim();
      }

      console.log('🔍 Sending batch order request:', JSON.stringify(payload, null, 2));

      // Create batch order
      const response = await api.post('/batch-orders/create', payload);

      toast.success('Dental services ordered successfully! Patient sent to billing.');

      // Reset form and clear sessionStorage
      setSelectedServices([]);
      setIsDeferred(false);
      setServiceQuantities({});
      setServiceNotes({});
      setCustomPrices({});
      setInstructions('');
      setSearchQuery('');
      try {
        sessionStorage.removeItem(storageKey);
      } catch (error) {
        console.error('Error clearing sessionStorage:', error);
      }

      // Notify parent
      if (onOrdersPlaced) {
        await onOrdersPlaced();
      }
    } catch (error) {
      console.error('Error ordering dental services:', error);
      toast.error(error.response?.data?.error || 'Failed to order dental services');
    } finally {
      setLoading(false);
    }
  };

  const filteredServices = dentalServices.filter(service => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      service.name.toLowerCase().includes(query) ||
      service.code.toLowerCase().includes(query) ||
      (service.description && service.description.toLowerCase().includes(query))
    );
  });

  // Get ordered services for this visit
  const orderedServices = existingOrders
    .filter(order => order.type === 'DENTAL')
    .flatMap(order => order.services || [])
    .map(service => service.serviceId);

  return (
    <div className="space-y-6">
      {/* Credit Warning Section */}
      {creditInfo && creditInfo.hasAccount && creditInfo.isVerified && (
        <div className={`p-4 rounded-lg border ${creditInfo.debtOwed > 0
          ? 'bg-red-50 border-red-200'
          : creditInfo.creditAvailable > 0
            ? 'bg-green-50 border-green-200'
            : 'bg-gray-50 border-gray-200'
          }`}>
          <div className="flex items-center gap-3">
            {creditInfo.debtOwed > 0 ? (
              <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
            ) : creditInfo.creditAvailable > 0 ? (
              <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-green-600" />
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
              {creditInfo.debtOwed > 0 && (
                <p className="text-sm text-red-700 font-bold">
                  💰 Patient Owes: <span className="text-lg">{creditInfo.debtOwed.toLocaleString()} ETB</span>
                </p>
              )}
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
              {creditInfo.debtOwed === 0 && creditInfo.creditAvailable === 0 && (
                <p className="text-sm text-gray-600">
                  Account cleared - No pending balance
                </p>
              )}
              {creditInfo.totalDebtPaid > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Total debt paid so far: ETB {creditInfo.totalDebtPaid.toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: '#0C0E0B' }}>Dental Services</h3>
          <p className="text-sm" style={{ color: '#6B7280' }}>Select dental procedures to perform</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: '#9CA3AF' }} />
        <input
          type="text"
          placeholder="Search dental services by name or code..."
          className="input pl-10 w-full"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Selected Services */}
      {selectedServices.length > 0 && (
        <div className="p-4 rounded-lg border" style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}>
          <h4 className="font-medium mb-3" style={{ color: '#0C0E0B' }}>Selected Services</h4>
          <div className="space-y-3">
            {selectedServices.map(service => {
              const quantity = serviceQuantities[service.id] || 1;
              const unitPrice = service.isVariablePrice ? (parseFloat(customPrices[service.id]) || 0) : service.price;
              const totalPrice = unitPrice * quantity;

              return (
                <div key={service.id} className="flex flex-col p-3 rounded-lg bg-white border" style={{ borderColor: '#E5E7EB' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium" style={{ color: '#0C0E0B' }}>{service.name}</span>
                        <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#DBEAFE', color: '#1E40AF' }}>
                          {service.code}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <label className="text-sm" style={{ color: '#6B7280' }}>Qty:</label>
                        <input
                          type="number"
                          min="1"
                          value={quantity}
                          onChange={(e) => updateQuantity(service.id, e.target.value)}
                          className="w-16 px-2 py-1 border rounded text-sm text-center"
                          style={{ borderColor: '#D1D5DB' }}
                        />
                      </div>
                      <button
                        onClick={() => handleServiceSelect(service)}
                        className="p-1 rounded hover:bg-red-50 text-red-500"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      {service.isVariablePrice && (
                        <div className="mb-2 bg-indigo-50 p-2 rounded border border-indigo-100">
                          <label className="text-[10px] font-bold block mb-1 text-indigo-700 uppercase">
                            Custom Price ({service.minPrice} - {service.maxPrice} ETB)
                          </label>
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-indigo-500" />
                            <input
                              type="number"
                              step="0.01"
                              min={service.minPrice}
                              max={service.maxPrice}
                              value={customPrices[service.id] || ''}
                              onChange={(e) => setCustomPrices(prev => ({ ...prev, [service.id]: e.target.value }))}
                              className="w-full px-2 py-1 border border-indigo-300 rounded text-sm"
                              placeholder="Enter price..."
                            />
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="text-[10px] font-bold block mb-1 text-gray-500 uppercase">Service Notes:</label>
                        <textarea
                          value={serviceNotes[service.id] || ''}
                          onChange={(e) => setServiceNotes(prev => ({ ...prev, [service.id]: e.target.value }))}
                          placeholder="Instructions for this procedure..."
                          className="w-full px-2 py-1 border rounded text-sm"
                          style={{ borderColor: '#D1D5DB' }}
                          rows={2}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col justify-end items-end text-right">
                      <p className="text-xs text-gray-500">
                        {unitPrice.toFixed(2)} × {quantity}
                      </p>
                      <p className="text-lg font-bold text-indigo-600">
                        {totalPrice.toFixed(2)} ETB
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-6 border-t" style={{ borderColor: '#E5E7EB' }}>
            <div className="flex justify-between items-center mb-6">
              <span className="text-lg font-bold text-gray-700">Total Order Amount:</span>
              <span className="text-2xl font-black text-indigo-600">
                {calculateTotal().toFixed(2)} ETB
              </span>
            </div>

            {/* Deferred Payment Option */}
            <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 shadow-sm">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDeferred}
                  onChange={(e) => setIsDeferred(e.target.checked)}
                  className="h-6 w-6 mt-1 text-orange-600 focus:ring-orange-500 border-orange-300 rounded-md"
                />
                <div className="flex flex-col">
                  <span className="font-bold text-orange-900 text-lg">
                    🔗 Deferred / Connected Payment (Follow-up Visit)
                  </span>
                  <p className="text-sm text-orange-700 leading-relaxed">
                    Check this if this is a <strong>follow-up visit</strong> for an existing treatment plan (e.g., brace adjustment).
                    The patient already paid or has a credit agreement for this service.
                    <strong> The patient will NOT be charged again</strong> — billing will show the service as pre-paid.
                  </p>
                  {isDeferred && creditInfo && creditInfo.hasAccount && (
                    <div className="mt-2 p-2 bg-white rounded-lg border border-orange-200 text-sm">
                      <span className="text-red-700 font-bold">
                        💰 Patient currently owes: ETB {(creditInfo.debtOwed || 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </label>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="btn px-8 py-3 rounded-xl font-bold text-lg flex items-center gap-3 shadow-lg hover:shadow-xl transition-all"
                style={{ backgroundColor: '#2e13d1', color: '#FFFFFF' }}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-5 w-5" />
                    Order {selectedServices.length} Service{selectedServices.length !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Available Services */}
      <div>
        <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5 text-indigo-600" />
          Select Available Procedures
        </h4>

        {fetchingServices ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3"></div>
            <p className="text-gray-500 font-medium">Loading dental procedures...</p>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <Search className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No dental services found matching your search</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredServices.map(service => {
              const isSelected = selectedServices.some(s => s.id === service.id);
              const isOrdered = orderedServices.includes(service.id);

              return (
                <div
                  key={service.id}
                  onClick={() => !isOrdered && handleServiceSelect(service)}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden group ${isOrdered
                    ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                    : isSelected
                      ? 'border-indigo-600 bg-indigo-50 shadow-md ring-1 ring-indigo-200'
                      : 'border-gray-100 bg-white hover:border-indigo-300 hover:shadow-md'
                    }`}
                >
                  {isOrdered && (
                    <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase">
                      Ordered
                    </div>
                  )}
                  {isSelected && !isOrdered && (
                    <div className="absolute top-0 right-0 bg-indigo-600 text-white p-1 rounded-bl-lg shadow-sm">
                      <CheckCircle className="h-4 w-4" />
                    </div>
                  )}

                  <div className="flex flex-col h-full">
                    <div className="mb-2">
                      <h5 className={`font-bold text-sm leading-tight mb-1 ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                        {service.name}
                      </h5>
                      <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">{service.code}</p>
                    </div>

                    {service.description && (
                      <p className="text-xs text-gray-500 line-clamp-2 mb-3 flex-grow">
                        {service.description}
                      </p>
                    )}

                    <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="font-bold text-indigo-600">
                        {service.isVariablePrice
                          ? `${service.minPrice} - ${service.maxPrice}`
                          : service.price.toFixed(2)}
                        <span className="text-[10px] ml-1 text-gray-400">ETB</span>
                      </span>
                      {service.isVariablePrice && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold uppercase tracking-tighter">
                          Variable
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Global Instructions */}
      {selectedServices.length > 0 && (
        <div className="mt-8 pt-8 border-t border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
            General Order Instructions
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            className="w-full p-4 rounded-xl border-2 border-gray-100 focus:border-indigo-500 focus:ring-0 transition-all bg-gray-50"
            placeholder="Add any overarching notes for the billing or dental department..."
          />
        </div>
      )}

      {/* Confirmation Modal - Only for deferred services */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Confirm Deferred Dental Order</h3>

            <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
              {selectedServices.map(service => {
                const quantity = serviceQuantities[service.id] || 1;
                const unitPrice = service.isVariablePrice ? (parseFloat(customPrices[service.id]) || 0) : service.price;
                return (
                  <div key={service.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{service.name}</p>
                      <p className="text-xs text-gray-500">Qty: {quantity} × {unitPrice.toFixed(2)} ETB</p>
                    </div>
                    <span className="font-bold text-gray-900">{(unitPrice * quantity).toFixed(2)} ETB</span>
                  </div>
                );
              })}
            </div>

            <div className="bg-blue-600 rounded p-3 mb-4 text-white">
              <div className="flex justify-between items-center">
                <span className="text-blue-100">Total</span>
                <span className="text-xl font-bold">{calculateTotal().toFixed(2)} ETB</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmOrder}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                {loading ? 'Submitting...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DentalServiceOrdering;

