import React, { useState, useEffect } from 'react';
import { Stethoscope, User, CheckCircle, Clock, DollarSign, X } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const NurseServiceOrderingInterface = ({ visit, onOrdersPlaced }) => {
  const [services, setServices] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [customPrices, setCustomPrices] = useState({});
  const [selectedNurse, setSelectedNurse] = useState('');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDeferred, setIsDeferred] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [pendingServices, setPendingServices] = useState([]);
  const [existingServices, setExistingServices] = useState([]);
  const [hasExistingOrders, setHasExistingOrders] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchServicesAndNurses();
    fetchPendingServices();
  }, [visit?.id]);

  const fetchPendingServices = async () => {
    if (!visit?.id) return;

    try {
      // Always fetch fresh data from API instead of relying on passed props
      const response = await api.get(`/doctors/visits/${visit.id}`);
      const freshVisit = response.data;
      const existingAssignments = freshVisit?.nurseServiceAssignments || [];

      // Separate completed and pending services
      const completedServices = existingAssignments.filter(assignment => assignment.status === 'COMPLETED');
      const pendingServices = existingAssignments.filter(assignment => assignment.status === 'PENDING');

      setExistingServices(completedServices);
      setPendingServices(pendingServices);
      setHasExistingOrders(existingAssignments.length > 0);

    } catch (error) {
      console.error('Error fetching nurse services:', error);
      // Fallback to passed props if API fails
      const existingAssignments = visit?.nurseServiceAssignments || [];
      const completedServices = existingAssignments.filter(assignment => assignment.status === 'COMPLETED');
      const pendingServices = existingAssignments.filter(assignment => assignment.status === 'PENDING');
      setExistingServices(completedServices);
      setPendingServices(pendingServices);
      setHasExistingOrders(existingAssignments.length > 0);
    }
  };

  const handleDeletePendingService = async (assignmentId) => {
    if (!window.confirm('Are you sure you want to delete this pending service?')) {
      return;
    }

    try {
      await api.delete(`/nurses/service-assignment/${assignmentId}`);
      toast.success('Service deleted successfully');
      // Refresh from API - this will get the latest data including any deleted from billing
      await fetchPendingServices();
      // Trigger parent refresh
      if (onOrdersPlaced) onOrdersPlaced();
    } catch (error) {
      console.error('Error deleting service:', error);
      toast.error(error.response?.data?.error || 'Failed to delete service');
    }
  };

  // Refresh data when component mounts or when told to
  useEffect(() => {
    fetchPendingServices();
  }, [visit?.id]);

  const fetchServicesAndNurses = async () => {
    try {
      setFetchingData(true);
      const [servicesResponse, nursesResponse] = await Promise.all([
        api.get('/nurses/services'),
        api.get('/nurses/nurses')
      ]);

      setServices(servicesResponse.data.services || []);
      setNurses(nursesResponse.data.nurses || []);
    } catch (error) {
      console.error('Error fetching services and nurses:', error);
      toast.error('Failed to fetch services and nurses');
    } finally {
      setFetchingData(false);
    }
  };

  const toggleService = (service) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.id === service.id);
      if (exists) {
        const nextQuantities = { ...quantities };
        delete nextQuantities[service.id];
        setQuantities(nextQuantities);
        return prev.filter(s => s.id !== service.id);
      }

      setQuantities((prevQty) => ({ ...prevQty, [service.id]: 1 }));
      return [...prev, service];
    });
    // Set default custom price for variable price services
    if (service.isVariablePrice && service.minPrice) {
      setCustomPrices(prev => ({
        ...prev,
        [service.id]: service.minPrice
      }));
    }
  };

  const handleCustomPriceChange = (serviceId, value) => {
    const price = parseFloat(value) || 0;
    setCustomPrices(prev => ({
      ...prev,
      [serviceId]: price
    }));
  };

  const getServicePrice = (service) => {
    if (service.isVariablePrice && customPrices[service.id] !== undefined) {
      return customPrices[service.id];
    }
    return service.price;
  };

  const updateQuantity = (serviceId, qtyValue) => {
    const qty = Math.max(1, parseInt(qtyValue, 10) || 1);
    setQuantities((prev) => ({ ...prev, [serviceId]: qty }));
  };

  const calculateTotal = () => {
    return selectedServices.reduce((sum, service) => {
      const qty = quantities[service.id] || 1;
      return sum + (getServicePrice(service) * qty);
    }, 0);
  };

  const handleSubmitOrder = async () => {
    if (selectedServices.length === 0) {
      toast.error('Please select at least one service');
      return;
    }

    if (!selectedNurse) {
      toast.error('Please select a nurse');
      return;
    }

    setLoading(true);
    try {
      // Build service prices map
      const servicePrices = {};
      selectedServices.forEach(s => {
        if (s.isVariablePrice && customPrices[s.id] !== undefined) {
          servicePrices[s.id] = customPrices[s.id];
        }
      });

      const expandedServiceIds = selectedServices.flatMap((service) => {
        const qty = quantities[service.id] || 1;
        return Array.from({ length: qty }, () => service.id);
      });

      const orderData = {
        visitId: visit.id,
        patientId: visit.patient.id,
        serviceIds: expandedServiceIds,
        assignedNurseId: selectedNurse,
        servicePrices: Object.keys(servicePrices).length > 0 ? servicePrices : undefined,
        isDeferred: isDeferred,
        instructions: instructions || `Doctor ordered: ${selectedServices.map(s => s.name).join(', ')}`
      };

      await api.post('/doctors/service-orders', orderData);

      toast.success(`${selectedServices.length} service(s) ordered successfully!`);

      // Refresh pending services instead of clearing selection
      await fetchPendingServices();

      // Reset form
      setSelectedServices([]);
      setQuantities({});
      setSelectedNurse('');
      setInstructions('');
      setIsDeferred(false);

      // Refresh data
      onOrdersPlaced();
    } catch (error) {
      console.error('Error ordering services:', error);
      toast.error(error.response?.data?.error || 'Failed to order services');
    } finally {
      setLoading(false);
    }
  };

  if (fetchingData) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#2e13d1' }}></div>
        <span className="ml-2" style={{ color: '#6B7280' }}>Loading services...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Existing Services */}
      {hasExistingOrders && (
        <div className="space-y-4">
          {/* Completed Services */}
          {existingServices.length > 0 && (
            <div className="p-4 border rounded-lg" style={{ borderColor: '#10B981', backgroundColor: '#ECFDF5' }}>
              <h5 className="font-medium mb-3 flex items-center" style={{ color: '#065F46' }}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Completed Services
              </h5>
              <div className="space-y-2">
                {existingServices.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between p-2 rounded" style={{ backgroundColor: '#FFFFFF' }}>
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      <span className="font-medium" style={{ color: '#0C0E0B' }}>{assignment.service.name}</span>
                      <span className="text-sm ml-2" style={{ color: '#6B7280' }}>
                        (Completed by: {assignment.assignedNurse.fullname})
                      </span>
                    </div>
                    <span className="font-medium" style={{ color: '#0C0E0B' }}>ETB {(assignment.customPrice ?? assignment.service.price).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Services */}
          {pendingServices.length > 0 && (
            <div className="p-4 border rounded-lg" style={{ borderColor: '#F59E0B', backgroundColor: '#FEF3C7' }}>
              <h5 className="font-medium mb-3 flex items-center" style={{ color: '#92400E' }}>
                <Clock className="h-4 w-4 mr-2" />
                Pending Services (Awaiting Nurse Completion)
              </h5>
              <div className="space-y-2">
                {pendingServices.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between p-2 rounded" style={{ backgroundColor: '#FFFFFF' }}>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-yellow-500 mr-2" />
                      <span className="font-medium" style={{ color: '#0C0E0B' }}>{assignment.service.name}</span>
                      <span className="text-sm ml-2" style={{ color: '#6B7280' }}>
                        (Assigned to: {assignment.assignedNurse.fullname})
                      </span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium mr-3" style={{ color: '#0C0E0B' }}>ETB {(assignment.customPrice ?? assignment.service.price).toLocaleString()}</span>
                      <button
                        onClick={() => handleDeletePendingService(assignment.id)}
                        className="p-1 rounded hover:bg-red-100 text-red-600"
                        title="Delete pending service"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t flex justify-between items-center">
                <span className="font-semibold" style={{ color: '#92400E' }}>Total Pending:</span>
                <span className="text-lg font-bold" style={{ color: '#92400E' }}>
                  ETB {pendingServices.reduce((sum, s) => sum + (s.customPrice ?? s.service.price), 0).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selected Services Summary */}
      {selectedServices.length > 0 && (
        <div className="p-4 border rounded-lg" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
          <h5 className="font-medium mb-3" style={{ color: '#0C0E0B' }}>Selected Services</h5>
          <div className="space-y-2">
            {selectedServices.map((service) => (
              <div key={service.id} className="flex items-center justify-between p-2 rounded" style={{ backgroundColor: '#FFFFFF' }}>
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span className="font-medium" style={{ color: '#0C0E0B' }}>{service.name}</span>
                  {service.isVariablePrice && (
                    <span className="ml-2 text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">Variable</span>
                  )}
                </div>
                <div className="flex items-center">
                  <div className="flex items-center mr-3 gap-2">
                    <label className="text-xs font-semibold text-gray-600">Qty:</label>
                    <input
                      type="number"
                      min="1"
                      value={quantities[service.id] || 1}
                      onChange={(e) => updateQuantity(service.id, e.target.value)}
                      className="w-16 px-2 py-1.5 text-sm border-2 border-blue-300 rounded-lg text-center outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-blue-900 bg-white"
                    />
                  </div>
                  {service.isVariablePrice ? (
                    <input
                      type="number"
                      min={service.minPrice || 0}
                      max={service.maxPrice || 999999}
                      value={customPrices[service.id] || service.minPrice || ''}
                      onChange={(e) => handleCustomPriceChange(service.id, e.target.value)}
                      className="w-24 p-1.5 text-sm border-2 border-blue-300 rounded-lg text-blue-900 font-semibold"
                      placeholder={`${service.minPrice}-${service.maxPrice}`}
                    />
                  ) : (
                    <span className="font-medium" style={{ color: '#0C0E0B' }}>ETB {(service.price * (quantities[service.id] || 1)).toLocaleString()}</span>
                  )}
          </div>

          {(searchTerm ? services.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())) : services).length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Stethoscope className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No matching services found</p>
            </div>
          )}
        </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t flex justify-between items-center">
            <span className="font-semibold" style={{ color: '#0C0E0B' }}>Total:</span>
            <span className="text-lg font-bold" style={{ color: '#2e13d1' }}>ETB {calculateTotal().toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Services List - Always show */}
      <div>
        <h5 className="font-medium mb-3" style={{ color: '#0C0E0B' }}>Available Services</h5>
        
        {/* Search Bar */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search nurse services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-green-500 transition-all"
          />
          <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(searchTerm ? services.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())) : services).map((service) => {
              const isSelected = selectedServices.find(s => s.id === service.id);
              return (
                <div
                  key={service.id}
                  onClick={() => toggleService(service)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${isSelected
                      ? 'border-green-400 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <Stethoscope className="h-4 w-4 mr-2" style={{ color: isSelected ? '#059669' : '#6B7280' }} />
                        <h6 className="font-medium" style={{ color: '#0C0E0B' }}>{service.name}</h6>
                        {service.isVariablePrice && (
                          <span className="ml-2 text-xs px-1 py-0.5 bg-blue-100 text-blue-800 rounded">Range</span>
                        )}
                      </div>
                      <p className="text-sm mt-1" style={{ color: '#6B7280' }}>{service.description}</p>
                    </div>
                    <div className="text-right ml-3">
                      {service.isVariablePrice && service.minPrice && service.maxPrice ? (
                        <p className="font-medium text-sm" style={{ color: '#059669' }}>ETB {service.minPrice} - {service.maxPrice}</p>
                      ) : (
                        <p className="font-medium" style={{ color: '#0C0E0B' }}>ETB {service.price.toLocaleString()}</p>
                      )}
                      {isSelected && (
                        <CheckCircle className="h-5 w-5 text-green-500 mt-1" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      {/* Nurse Selection */}
      <div>
        <h5 className="font-medium mb-3" style={{ color: '#0C0E0B' }}>Assign Nurse</h5>
        <select
          value={selectedNurse}
          onChange={(e) => setSelectedNurse(e.target.value)}
          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          style={{ borderColor: '#E5E7EB' }}
        >
          <option value="">Select a nurse...</option>
          {nurses.map((nurse) => (
            <option key={nurse.id} value={nurse.id}>
              {nurse.fullname} ({nurse.username})
            </option>
          ))}
        </select>
      </div>

      {/* Instructions */}
      <div>
        <h5 className="font-medium mb-3" style={{ color: '#0C0E0B' }}>Instructions (Optional)</h5>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Add specific instructions for the nurse..."
          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          style={{ borderColor: '#E5E7EB' }}
          rows={3}
        />
      </div>

      {/* Deferred Payment Option */}
      {selectedServices.length > 0 && (
        <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isDeferred}
              onChange={(e) => setIsDeferred(e.target.checked)}
              className="h-5 w-5 text-orange-600 focus:ring-orange-500 border-orange-300 rounded"
            />
            <div className="flex flex-col">
              <span className="font-bold text-orange-900">
                Paid in Period (Deferred Payment)
              </span>
              <p className="text-xs text-orange-700">
                Check this if the patient will pay for these nurse services in installments.
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Submit Button */}
      {selectedServices.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleSubmitOrder}
            disabled={loading || selectedServices.length === 0 || !selectedNurse}
            className={`px-6 py-3 rounded-lg font-medium flex items-center space-x-2 ${loading || selectedServices.length === 0 || !selectedNurse
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'text-white hover:bg-green-700'
              }`}
            style={{
              backgroundColor: loading || selectedServices.length === 0 || !selectedNurse ? '#D1D5DB' : '#059669'
            }}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Ordering...</span>
              </>
            ) : (
              <>
                <Stethoscope className="h-4 w-4" />
                <span>Order {selectedServices.length} Service{selectedServices.length !== 1 ? 's' : ''}</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default NurseServiceOrderingInterface;
