import React, { useState, useEffect } from 'react';
import { Stethoscope, Users, X, CheckCircle, AlertTriangle, DollarSign, CreditCard, Info } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const DoctorServiceOrdering = ({ visit, onClose, onOrdersPlaced }) => {
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedNurse, setSelectedNurse] = useState('');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [customPrices, setCustomPrices] = useState({});
  const [isDeferred, setIsDeferred] = useState(false);
  const [patientCreditInfo, setPatientCreditInfo] = useState(null);
  const [loadingCredit, setLoadingCredit] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchServices();
    fetchNurses();
  }, []);

  // Fetch patient credit info when deferred is toggled on
  useEffect(() => {
    if (isDeferred && visit?.patient?.id) {
      fetchPatientCreditInfo();
    }
  }, [isDeferred]);

  const fetchServices = async () => {
    try {
      const response = await api.get('/nurses/services');
      setServices(response.data.services || []);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to fetch services');
    }
  };

  const fetchNurses = async () => {
    try {
      const response = await api.get('/nurses/nurses');
      setNurses(response.data.nurses || []);
    } catch (error) {
      console.error('Error fetching nurses:', error);
      toast.error('Failed to fetch nurses');
    }
  };

  const fetchPatientCreditInfo = async () => {
    try {
      setLoadingCredit(true);
      const response = await api.get(`/accounts/patient/${visit.patient.id}/credit-summary`);
      setPatientCreditInfo(response.data);
    } catch (error) {
      console.error('Error fetching patient credit info:', error);
      setPatientCreditInfo(null);
    } finally {
      setLoadingCredit(false);
    }
  };

  const toggleService = (service) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.id === service.id);
      if (exists) {
        const newPrices = { ...customPrices };
        delete newPrices[service.id];
        setCustomPrices(newPrices);
        return prev.filter(s => s.id !== service.id);
      } else {
        if (service.isVariablePrice) {
          setCustomPrices(prevPrices => ({
            ...prevPrices,
            [service.id]: service.minPrice || 0
          }));
        }
        return [...prev, service];
      }
    });
  };

  const calculateTotal = () => {
    return selectedServices.reduce((sum, service) => {
      const price = service.isVariablePrice ? (parseFloat(customPrices[service.id]) || 0) : service.price;
      return sum + price;
    }, 0);
  };

  const handleSubmit = async () => {
    if (selectedServices.length === 0) {
      toast.error('Please select at least one service');
      return;
    }

    if (!selectedNurse) {
      toast.error('Please select a nurse');
      return;
    }

    // Validate custom prices range
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

    // Show confirmation for deferred orders
    if (isDeferred) {
      const confirmMsg = `⚠️ DEFERRED ORDER CONFIRMATION\n\nThis order is linked to the patient's existing credit/debt.\nThe patient will NOT be charged again for these services.\n\nServices: ${selectedServices.map(s => s.name).join(', ')}\nTotal: ETB ${calculateTotal().toLocaleString()}\n${patientCreditInfo ? `\nPatient currently owes: ETB ${(patientCreditInfo.debtOwed || 0).toLocaleString()}` : ''}\n\nAre you sure you want to proceed?`;

      if (!window.confirm(confirmMsg)) {
        return;
      }
    }

    setLoading(true);
    try {
      const response = await api.post('/doctors/service-orders', {
        visitId: visit.id,
        patientId: visit.patient.id,
        serviceIds: selectedServices.map(s => s.id),
        customPrices: customPrices,
        assignedNurseId: selectedNurse,
        instructions: instructions.trim() || undefined,
        isDeferred: isDeferred
      });

      if (isDeferred) {
        toast.success('Deferred service order created! Patient will not be charged again.');
      } else {
        toast.success('Nurse services ordered successfully!');
      }
      onOrdersPlaced(response.data);
      onClose();
    } catch (error) {
      console.error('Error creating service orders:', error);
      toast.error(error.response?.data?.error || 'Failed to create service orders');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="shrink-0 p-6 pb-0 flex items-center justify-between">
          <div className="flex items-center">
            <Stethoscope className="h-6 w-6 text-blue-500 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">Order Custom Services</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-6">
        {/* Patient Info */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-blue-900 mb-2">Patient Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-blue-700 font-medium">Name:</span>
              <span className="ml-2 text-blue-800">{visit.patient?.name}</span>
            </div>
            <div>
              <span className="text-blue-700 font-medium">ID:</span>
              <span className="ml-2 text-blue-800">{visit.patient?.id}</span>
            </div>
            <div>
              <span className="text-blue-700 font-medium">Visit:</span>
              <span className="ml-2 text-blue-800">{visit.visitUid}</span>
            </div>
            <div>
              <span className="text-blue-700 font-medium">Status:</span>
              <span className="ml-2 text-blue-800">{visit.status}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Services Selection */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Stethoscope className="h-5 w-5 mr-2 text-green-500" />
              Available Services
            </h3>

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

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {(searchTerm ? services.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())) : services).map((service) => (
                <div
                  key={service.id}
                  onClick={() => toggleService(service)}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedServices.find(s => s.id === service.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{service.name}</h4>
                      <p className="text-sm text-gray-500">{service.description}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-900">
                        {service.isVariablePrice ? (
                          <div className="text-right">
                            <div className="text-blue-600 font-bold">ETB {service.minPrice} - {service.maxPrice}</div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Variable Price</div>
                          </div>
                        ) : (
                          `ETB ${service.price.toLocaleString()}`
                        )}
                      </span>
                      {selectedServices.find(s => s.id === service.id) && (
                        <CheckCircle className="h-5 w-5 text-blue-500" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {services.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Stethoscope className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No services available</p>
              </div>
            )}

            {(searchTerm ? services.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())) : services).length === 0 && searchTerm && (
              <div className="text-center py-8 text-gray-500">
                <Stethoscope className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No matching services found</p>
              </div>
            )}
          </div>

          {/* Nurse Selection & Instructions */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Users className="h-5 w-5 mr-2 text-purple-500" />
              Assignment Details
            </h3>

            {/* Nurse Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign to Nurse *
              </label>
              <select
                value={selectedNurse}
                onChange={(e) => setSelectedNurse(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a nurse</option>
                {nurses.map((nurse) => (
                  <option key={nurse.id} value={nurse.id}>
                    {nurse.fullname} ({nurse.username})
                  </option>
                ))}
              </select>
            </div>

            {/* Instructions */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Instructions
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Enter specific instructions for the nurse..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Deferred Payment Option */}
            {selectedServices.length > 0 && (
              <div className={`rounded-lg p-4 mb-4 border-2 transition-all ${isDeferred ? 'bg-orange-50 border-orange-400' : 'bg-gray-50 border-gray-200'}`}>
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDeferred}
                    onChange={(e) => setIsDeferred(e.target.checked)}
                    className="h-5 w-5 mt-0.5 text-orange-600 focus:ring-orange-500 border-orange-300 rounded"
                  />
                  <div className="flex flex-col">
                    <span className={`font-bold ${isDeferred ? 'text-orange-900' : 'text-gray-700'}`}>
                      <CreditCard className="h-4 w-4 inline mr-1" />
                      Deferred / Connected Payment (Paid in Period)
                    </span>
                    <p className="text-xs text-gray-600 mt-1">
                      Check this if this service is a follow-up connected to an existing payment.
                      The patient already paid or has credit for this service from a previous visit.
                      <strong> The patient will NOT be charged again.</strong>
                    </p>
                  </div>
                </label>

                {/* Patient Credit/Debt Info - shown when deferred is checked */}
                {isDeferred && (
                  <div className="mt-3 space-y-2">
                    {loadingCredit ? (
                      <div className="flex items-center text-sm text-orange-700">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600 mr-2"></div>
                        Loading patient credit info...
                      </div>
                    ) : patientCreditInfo ? (
                      <div className="bg-white rounded-lg p-3 border border-orange-200">
                        <h5 className="text-sm font-bold text-orange-900 mb-2 flex items-center">
                          <DollarSign className="h-4 w-4 mr-1" />
                          Patient Credit / Debt Summary
                        </h5>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {patientCreditInfo.hasAccount ? (
                            <>
                              <div>
                                <span className="text-gray-500">Account Type:</span>
                                <span className={`ml-1 font-bold ${patientCreditInfo.accountType === 'CREDIT' ? 'text-blue-700' : 'text-green-700'}`}>
                                  {patientCreditInfo.accountType === 'BOTH' ? 'Standard (Advance + Credit)' : patientCreditInfo.accountType}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">Balance:</span>
                                <span className="ml-1 font-bold text-gray-800">
                                  ETB {(patientCreditInfo.balance || 0).toLocaleString()}
                                </span>
                              </div>
                              <div className="col-span-2 pt-2 border-t border-orange-100">
                                <span className="text-red-700 font-bold text-sm">
                                  💰 Patient Owes: ETB {(patientCreditInfo.debtOwed || 0).toLocaleString()}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="col-span-2 text-orange-700">
                              <AlertTriangle className="h-4 w-4 inline mr-1" />
                              No credit account found for this patient. The deferred order will still be created but no credit record exists.
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-orange-600">
                        <AlertTriangle className="h-4 w-4 inline mr-1" />
                        Could not load patient credit information.
                      </div>
                    )}

                    <div className="bg-orange-100 rounded p-2 text-xs text-orange-800 flex items-start">
                      <Info className="h-4 w-4 mr-1 mt-0.5 flex-shrink-0" />
                      <span>
                        This order will be sent to billing but marked as <strong>"Connected Deferred"</strong>.
                        The billing side will show the service but will <strong>NOT add new debt</strong> to the patient's account.
                        The service total is already covered by the existing credit agreement.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Order Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Order Summary</h4>

              {selectedServices.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {selectedServices.map((service) => (
                    <div key={service.id} className="p-2 border-b border-gray-100 last:border-0">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600 font-medium">
                          {service.name}
                          {isDeferred && (
                            <span className="ml-2 text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
                              DEFERRED
                            </span>
                          )}
                        </span>
                        <span className={`font-bold ${isDeferred ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                          ETB {(service.isVariablePrice ? (parseFloat(customPrices[service.id]) || 0) : service.price).toLocaleString()}
                        </span>
                      </div>
                      {service.isVariablePrice && (
                        <div className="flex flex-col items-stretch gap-2 mt-2 bg-white p-3 rounded-lg border border-blue-200">
                          <label className="text-xs font-bold text-blue-800 uppercase">Set Assessment Price ({service.minPrice} - {service.maxPrice}):</label>
                          <div className="relative w-full md:max-w-sm">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-blue-600 font-bold">ETB</span>
                            <input
                              type="number"
                              step="0.01"
                              min={service.minPrice}
                              max={service.maxPrice}
                              value={customPrices[service.id] || ''}
                              onChange={(e) => setCustomPrices({ ...customPrices, [service.id]: e.target.value })}
                              className="w-full pl-11 pr-3 py-2.5 text-sm border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-900 bg-white"
                              placeholder="Enter assessment price"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 mb-3">No services selected</p>
              )}

              <div className="border-t pt-3">
                <div className="flex justify-between font-medium text-lg">
                  <span>Total:</span>
                  {isDeferred ? (
                    <div className="text-right">
                      <span className="text-gray-400 line-through text-sm">ETB {calculateTotal().toLocaleString()}</span>
                      <span className="block text-orange-600 font-bold">ETB 0 (Deferred)</span>
                    </div>
                  ) : (
                    <span className="text-green-600">ETB {calculateTotal().toLocaleString()}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        </div>{/* end scrollable content */}

        {/* Sticky footer */}
        <div className="shrink-0 border-t bg-white px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={loading || selectedServices.length === 0 || !selectedNurse}
            className={`px-6 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center font-bold text-white ${isDeferred ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating Orders...
              </>
            ) : (
              <>
                {isDeferred ? <CreditCard className="h-4 w-4 mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                {isDeferred ? 'Create Deferred Order' : 'Create Service Orders'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DoctorServiceOrdering;


