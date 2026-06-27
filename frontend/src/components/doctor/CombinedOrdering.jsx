import React, { useState, useEffect } from 'react';
import { TestTube, Scan, X, CheckCircle, AlertTriangle, Stethoscope, CreditCard, DollarSign } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import DoctorServiceOrdering from './DoctorServiceOrdering';

const CombinedOrdering = ({ visit, onClose, onOrdersPlaced }) => {
  const [selectedLabTests, setSelectedLabTests] = useState([]);
  const [selectedRadiologyTests, setSelectedRadiologyTests] = useState([]);
  const [selectedNurseServices, setSelectedNurseServices] = useState([]);
  const [labInstructions, setLabInstructions] = useState('');
  const [radiologyInstructions, setRadiologyInstructions] = useState('');
  const [nurseInstructions, setNurseInstructions] = useState('');
  const [selectedNurse, setSelectedNurse] = useState('');
  const [nurses, setNurses] = useState([]);
  const [nurseServices, setNurseServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showServiceOrdering, setShowServiceOrdering] = useState(false);

  // Credit/Account state
  const [creditInfo, setCreditInfo] = useState(null);
  const [creditApplied, setCreditApplied] = useState(0);

  // Lab test options
  const labTestOptions = [
    { id: 19, name: 'CBC (Complete Blood Count)', price: 150 },
    { id: 20, name: 'Blood Sugar (Fasting)', price: 100 },
    { id: 21, name: 'Lipid Profile', price: 200 },
    { id: 22, name: 'Liver Function Test', price: 180 },
    { id: 23, name: 'Kidney Function Test', price: 160 },
    { id: 24, name: 'Thyroid Function Test', price: 250 },
    { id: 25, name: 'Urinalysis', price: 80 },
    { id: 26, name: 'Stool Analysis', price: 120 }
  ];

  // Radiology test options
  const radiologyTestOptions = [
    { id: 27, name: 'Chest X-Ray', price: 200 },
    { id: 28, name: 'Abdominal X-Ray', price: 180 },
    { id: 29, name: 'CT Scan - Head', price: 800 },
    { id: 30, name: 'CT Scan - Chest', price: 1000 },
    { id: 31, name: 'MRI - Brain', price: 1200 },
    { id: 32, name: 'Ultrasound - Abdomen', price: 300 },
    { id: 33, name: 'Ultrasound - Pelvis', price: 250 },
    { id: 34, name: 'ECG', price: 150 }
  ];

  const toggleLabTest = (test) => {
    setSelectedLabTests(prev =>
      prev.find(t => t.id === test.id)
        ? prev.filter(t => t.id !== test.id)
        : [...prev, test]
    );
  };

  const toggleRadiologyTest = (test) => {
    setSelectedRadiologyTests(prev =>
      prev.find(t => t.id === test.id)
        ? prev.filter(t => t.id !== test.id)
        : [...prev, test]
    );
  };

  const toggleNurseService = (service) => {
    setSelectedNurseServices(prev =>
      prev.find(s => s.id === service.id)
        ? prev.filter(s => s.id !== service.id)
        : [...prev, service]
    );
  };

  // Fetch nurses and nurse services
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [nursesResponse, servicesResponse] = await Promise.all([
          api.get('/nurses/nurses'),
          api.get('/nurses/services')
        ]);

        setNurses(nursesResponse.data);
        setNurseServices(servicesResponse.data);

        // Auto-select the first available nurse
        if (nursesResponse.data.length > 0) {
          setSelectedNurse(nursesResponse.data[0].id);
        }
      } catch (error) {
        console.error('Error fetching nurses/services:', error);
        toast.error('Failed to fetch nurses and services');
      }
    };

    fetchData();
  }, []);

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

  const handleApplyCredit = () => {
    if (!creditInfo || creditInfo.creditAvailable <= 0) return;

    const total = calculateTotal();
    if (total <= 0) {
      toast.error('Please select services first');
      return;
    }

    // Apply credit (either full or partial based on what's available)
    const creditToApply = Math.min(creditInfo.creditAvailable, total);
    setCreditApplied(creditToApply);
    toast.success(`Applied ${creditToApply.toFixed(2)} ETB credit to this order`);
  };

  const handleRemoveCredit = () => {
    setCreditApplied(0);
  };

  const calculateTotal = () => {
    const labTotal = selectedLabTests.reduce((sum, test) => sum + test.price, 0);
    const radiologyTotal = selectedRadiologyTests.reduce((sum, test) => sum + test.price, 0);
    const nurseTotal = selectedNurseServices.reduce((sum, service) => sum + service.price, 0);
    const subtotal = labTotal + radiologyTotal + nurseTotal;
    return Math.max(0, subtotal - creditApplied);
  };

  const calculateOriginalTotal = () => {
    const labTotal = selectedLabTests.reduce((sum, test) => sum + test.price, 0);
    const radiologyTotal = selectedRadiologyTests.reduce((sum, test) => sum + test.price, 0);
    const nurseTotal = selectedNurseServices.reduce((sum, service) => sum + service.price, 0);
    return labTotal + radiologyTotal + nurseTotal;
  };

  const handleSubmit = async () => {
    if (selectedLabTests.length === 0 && selectedRadiologyTests.length === 0 && selectedNurseServices.length === 0) {
      toast.error('Please select at least one test or service');
      return;
    }

    setLoading(true);
    try {
      const promises = [];

      // Submit lab orders if any selected
      if (selectedLabTests.length > 0) {
        const labOrderData = {
          visitId: visit.id,
          patientId: visit.patient.id,
          type: 'LAB',
          instructions: labInstructions || 'Lab tests ordered by doctor',
          services: selectedLabTests.map(test => ({
            serviceId: test.id.toString(),
            instructions: labInstructions || `Lab test: ${test.name}`
          }))
        };
        promises.push(api.post('/batch-orders/create', labOrderData));
      }

      // Submit radiology orders if any selected
      if (selectedRadiologyTests.length > 0) {
        const radiologyOrderData = {
          visitId: visit.id,
          patientId: visit.patient.id,
          type: 'RADIOLOGY',
          instructions: radiologyInstructions || 'Radiology tests ordered by doctor',
          services: selectedRadiologyTests.map(test => ({
            serviceId: test.id.toString(),
            instructions: radiologyInstructions || `Radiology test: ${test.name}`
          }))
        };
        promises.push(api.post('/batch-orders/create', radiologyOrderData));
      }

      // Submit nurse service orders if any selected
      if (selectedNurseServices.length > 0) {
        if (!selectedNurse) {
          toast.error('Please select a nurse for the services');
          setLoading(false);
          return;
        }

        const nurseOrderData = {
          visitId: visit.id,
          patientId: visit.patient.id,
          type: 'NURSE',
          assignedNurseId: selectedNurse,
          instructions: nurseInstructions || 'Nurse services ordered by doctor',
          services: selectedNurseServices.map(service => ({
            serviceId: service.id,
            instructions: nurseInstructions || `Nurse service: ${service.name}`
          }))
        };
        promises.push(api.post('/batch-orders/create', nurseOrderData));
      }

      // Wait for all orders to be submitted
      await Promise.all(promises);

      toast.success('All orders placed successfully!');
      onOrdersPlaced();
      onClose();
    } catch (error) {
      console.error('Error placing orders:', error);
      toast.error('Failed to place orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="shrink-0 p-6 pb-0 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              Order Lab & Radiology Tests
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

        <div className="overflow-y-auto flex-1 p-6">
          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-600">
                    {visit.patient.name.charAt(0)}
                  </span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">
                  {visit.patient.name} - {visit.patient.id}
                </p>
                <p className="text-sm text-gray-500">
                  Visit: {visit.visitUid}
                </p>
              </div>
            </div>
          </div>

          {/* Credit Warning Section */}
          {creditInfo && creditInfo.hasAccount && creditInfo.isVerified && (
            <div className={`mb-4 p-4 rounded-lg border ${creditInfo.creditAvailable > 0
                ? 'bg-green-50 border-green-200'
                : creditInfo.creditAvailable < 0
                  ? 'bg-red-50 border-red-200'
                  : 'bg-gray-50 border-gray-200'
              }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {creditInfo.creditAvailable > 0 ? (
                    <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-green-600" />
                    </div>
                  ) : creditInfo.creditAvailable < 0 ? (
                    <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
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
                {creditInfo.creditAvailable > 0 && creditApplied === 0 && (
                  <button
                    onClick={handleApplyCredit}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2"
                  >
                    <CreditCard className="h-4 w-4" />
                    Apply Credit
                  </button>
                )}
                {creditApplied > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-green-700 bg-green-100 px-3 py-1 rounded-full">
                      Credit Applied: {creditApplied.toFixed(2)} ETB
                    </span>
                    <button
                      onClick={handleRemoveCredit}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lab Tests Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <TestTube className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Lab Tests</h3>
                <span className="text-sm text-gray-500">
                  ({selectedLabTests.length} selected)
                </span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {labTestOptions.map((test) => (
                  <label
                    key={test.id}
                    className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedLabTests.some(t => t.id === test.id)}
                      onChange={() => toggleLabTest(test)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {test.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        ETB {test.price}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lab Instructions
                </label>
                <textarea
                  value={labInstructions}
                  onChange={(e) => setLabInstructions(e.target.value)}
                  placeholder="Special instructions for lab tests..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                />
              </div>
            </div>

            {/* Radiology Tests Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Scan className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Radiology Tests</h3>
                <span className="text-sm text-gray-500">
                  ({selectedRadiologyTests.length} selected)
                </span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {radiologyTestOptions.map((test) => (
                  <label
                    key={test.id}
                    className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRadiologyTests.some(t => t.id === test.id)}
                      onChange={() => toggleRadiologyTest(test)}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {test.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        ETB {test.price}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Radiology Instructions
                </label>
                <textarea
                  value={radiologyInstructions}
                  onChange={(e) => setRadiologyInstructions(e.target.value)}
                  placeholder="Special instructions for radiology tests..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Nurse Services Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Stethoscope className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold text-gray-900">Nurse Services</h3>
              <span className="text-sm text-gray-500">
                ({selectedNurseServices.length} selected)
              </span>
            </div>

            {/* Nurse Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign to Nurse
              </label>
              <select
                value={selectedNurse}
                onChange={(e) => setSelectedNurse(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a nurse</option>
                {nurses.map((nurse) => (
                  <option key={nurse.id} value={nurse.id}>
                    {nurse.fullname}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {nurseServices.map((service) => (
                <label
                  key={service.id}
                  className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedNurseServices.some(s => s.id === service.id)}
                    onChange={() => toggleNurseService(service)}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {service.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {service.description}
                    </div>
                    <div className="text-sm text-gray-500">
                      ETB {service.price}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nurse Service Instructions
              </label>
              <textarea
                value={nurseInstructions}
                onChange={(e) => setNurseInstructions(e.target.value)}
                placeholder="Special instructions for nurse services..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                rows={3}
              />
            </div>
          </div>

          {/* Summary */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">Order Summary</h4>
                <p className="text-sm text-gray-600">
                  {selectedLabTests.length} lab test(s) • {selectedRadiologyTests.length} radiology test(s) • {selectedNurseServices.length} nurse service(s)
                </p>
              </div>
              <div className="text-right">
                {creditApplied > 0 && (
                  <div className="text-sm text-green-600 font-medium mb-1">
                    - {creditApplied.toFixed(2)} ETB credit applied
                  </div>
                )}
                <div className="text-2xl font-bold text-gray-900">
                  ETB {calculateTotal().toLocaleString()}
                </div>
                <div className="text-sm text-gray-500">
                  {creditApplied > 0 ? (
                    <span className="line-through text-gray-400">{calculateOriginalTotal().toLocaleString()} ETB</span>
                  ) : 'Total cost'}
                </div>
              </div>
            </div>
          </div>

        </div>{/* end scrollable content */}

        {/* Sticky footer */}
        <div className="shrink-0 border-t bg-white px-6 py-4 flex justify-between">
          <button
            onClick={() => setShowServiceOrdering(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center space-x-2"
          >
            <Stethoscope className="h-4 w-4" />
            <span>Order Custom Services</span>
          </button>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || (selectedLabTests.length === 0 && selectedRadiologyTests.length === 0 && selectedNurseServices.length === 0)}
              className={`px-6 py-2 text-sm font-medium text-white border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Placing Orders...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span>Place All Orders</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Service Ordering Modal */}
        {showServiceOrdering && (
          <DoctorServiceOrdering
            visit={visit}
            onClose={() => setShowServiceOrdering(false)}
            onOrdersPlaced={onOrdersPlaced}
          />
        )}
      </div>
    </div>
  );
};

export default CombinedOrdering;
