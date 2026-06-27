import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  Plus, 
  Minus, 
  CreditCard, 
  User, 
  Clock, 
  DollarSign,
  CheckCircle,
  XCircle,
  Search,
  Filter
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const EmergencyBilling = () => {
  const navigate = useNavigate();
  const [emergencyPatients, setEmergencyPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Add service form
  const [selectedService, setSelectedService] = useState('');
  const [serviceQuantity, setServiceQuantity] = useState(1);
  const [serviceNotes, setServiceNotes] = useState('');

  // Payment form
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentType, setPaymentType] = useState('CASH');
  const [bankName, setBankName] = useState('');
  const [transNumber, setTransNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  useEffect(() => {
    fetchEmergencyPatients();
    fetchServices();
  }, []);

  const fetchEmergencyPatients = async () => {
    try {
      setLoading(true);
      const response = await api.get('/emergency-billing/patients');
      setEmergencyPatients(response.data.emergencyPatients || []);
    } catch (error) {
      console.error('Error fetching emergency patients:', error);
      toast.error('Failed to fetch emergency patients');
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      const response = await api.get('/emergency-billing/services');
      setServices(response.data.services || []);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to fetch services');
    }
  };

  const handleAddService = async () => {
    if (!selectedPatient || !selectedService) {
      toast.error('Please select a patient and service');
      return;
    }

    try {
      const response = await api.post('/emergency-billing/add-service', {
        billingId: selectedPatient.billing?.id,
        serviceId: selectedService,
        quantity: serviceQuantity,
        notes: serviceNotes
      });

      toast.success(response.data.message);
      setShowAddServiceModal(false);
      setSelectedService('');
      setServiceQuantity(1);
      setServiceNotes('');
      fetchEmergencyPatients(); // Refresh data
    } catch (error) {
      console.error('Error adding service:', error);
      const errorMessage = error.response?.data?.message || 'Failed to add service';
      toast.error(errorMessage);
    }
  };

  const handleRemoveService = async (billingServiceId) => {
    if (!window.confirm('Are you sure you want to remove this service?')) {
      return;
    }

    try {
      const response = await api.delete(`/emergency-billing/remove-service/${billingServiceId}`);
      toast.success(response.data.message);
      fetchEmergencyPatients(); // Refresh data
    } catch (error) {
      console.error('Error removing service:', error);
      toast.error('Failed to remove service');
    }
  };

  const handleProcessPayment = async () => {
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }

    try {
      const response = await api.post('/emergency-billing/process-payment', {
        billingId: selectedPatient.billing?.id,
        amount: paymentAmount,
        type: paymentType,
        bankName: bankName || undefined,
        transNumber: transNumber || undefined,
        notes: paymentNotes || undefined
      });

      toast.success(response.data.message);
      setShowPaymentModal(false);
      setPaymentAmount(0);
      setPaymentType('CASH');
      setBankName('');
      setTransNumber('');
      setPaymentNotes('');
      setSelectedPatient(null);
      fetchEmergencyPatients(); // Refresh data
    } catch (error) {
      console.error('Error processing payment:', error);
      const errorMessage = error.response?.data?.error || 'Failed to process payment';
      toast.error(errorMessage);
    }
  };

  const filteredPatients = emergencyPatients.filter(patient => {
    const matchesSearch = !searchQuery || 
      (patient.patient?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (patient.visitUid || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(patient.patient?.id || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === 'ALL' || patient.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'IN_DOCTOR_QUEUE': return 'bg-red-100 text-red-800';
      case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800';
      case 'WAITING_FOR_DOCTOR': return 'bg-blue-100 text-blue-800';
      case 'UNDER_DOCTOR_REVIEW': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'IN_DOCTOR_QUEUE': return 'Emergency Queue';
      case 'IN_PROGRESS': return 'In Progress';
      case 'WAITING_FOR_DOCTOR': return 'Waiting for Doctor';
      case 'UNDER_DOCTOR_REVIEW': return 'Under Doctor Review';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600 mr-3" />
            Emergency Billing
          </h1>
          <p className="text-gray-600 mt-2">
            Manage emergency patients and their running billing totals
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-red-600">
            {emergencyPatients.length}
          </div>
          <div className="text-sm text-gray-500">Active Emergencies</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by patient name, visit ID, or patient ID..."
                className="input pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              className="input"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ALL">All Status</option>
              <option value="EMERGENCY_PENDING">Pending Payment</option>
              <option value="PAID">Payment Acknowledged</option>
            </select>
          </div>
        </div>
      </div>

      {/* Emergency Patients List */}
      <div className="grid gap-6">
        {filteredPatients.length === 0 ? (
          <div className="card text-center py-12">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Emergency Patients</h3>
            <p className="text-gray-600">
              {searchQuery || filterStatus !== 'ALL' 
                ? 'No patients match your search criteria.' 
                : 'No emergency patients are currently active.'}
            </p>
          </div>
        ) : (
          filteredPatients.map((patient) => (
            <div key={patient.visitId} className={`card ${patient.billing?.status === 'PAID' ? 'border-green-200 bg-green-50' : ''}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-full ${patient.billing?.status === 'PAID' ? 'bg-green-100' : 'bg-red-100'}`}>
                    {patient.billing?.status === 'PAID' ? (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : (
                      <User className="h-6 w-6 text-red-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {patient.patient.name}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>ID: {patient.patient.id}</span>
                      <span>Visit: {patient.visitUid}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(patient.status)}`}>
                        {getStatusText(patient.status)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${patient.billing?.status === 'PAID' ? 'text-green-600' : 'text-red-600'}`}>
                    ETB {patient.billing?.totalAmount || 0}
                  </div>
                  <div className="text-sm text-gray-500">
                    {patient.billing?.status === 'PAID' ? 'Amount Collected' : 'Total Due'}
                  </div>
                </div>
              </div>

              {/* Services List */}
              {patient.billing?.services && patient.billing.services.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Services Provided:</h4>
                  <div className="space-y-2">
                    {patient.billing.services.map((service) => (
                      <div key={service.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div>
                            <div className="font-medium text-gray-900">
                              {service.service.name} ({service.service.code})
                            </div>
                            <div className="text-sm text-gray-600">
                              {service.quantity}x ETB {service.unitPrice} = ETB {service.totalPrice}
                            </div>
                          </div>
                        </div>
                        {patient.billing?.status !== 'PAID' && (
                          <button
                            onClick={() => handleRemoveService(service.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                            title="Remove service"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-gray-600">
                  <Clock className="h-4 w-4 inline mr-1" />
                  Started: {new Date(patient.createdAt).toLocaleString()}
                </div>
                <div className="flex space-x-2">
                  {patient.billing?.status === 'PAID' ? (
                    <div className="flex items-center space-x-2">
                      <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium flex items-center">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Paid
                      </div>
                      <div className="text-sm text-gray-600">
                        ETB {patient.billing.totalAmount} collected
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setSelectedPatient(patient);
                          setShowAddServiceModal(true);
                        }}
                        className="btn btn-outline btn-sm flex items-center"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Service
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPatient(patient);
                          setPaymentAmount(patient.billing?.totalAmount || 0);
                          setShowPaymentModal(true);
                        }}
                        disabled={!patient.billing || patient.billing.totalAmount === 0}
                        className="btn btn-primary btn-sm flex items-center"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Process Payment
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Service Modal */}
      {showAddServiceModal && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add Service</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Service</label>
                <select
                  className="input"
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                >
                  <option value="">Select a service...</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} ({service.code}) - ETB {service.price}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Quantity</label>
                <input
                  type="number"
                  min="1"
                  className="input"
                  value={serviceQuantity}
                  onChange={(e) => setServiceQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
              <div>
                <label className="label">Notes (Optional)</label>
                <textarea
                  className="input"
                  rows="3"
                  value={serviceNotes}
                  onChange={(e) => setServiceNotes(e.target.value)}
                  placeholder="Additional notes..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowAddServiceModal(false)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={handleAddService}
                className="btn btn-primary"
              >
                Add Service
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Acknowledgment Modal */}
      {showPaymentModal && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Process Emergency Payment</h3>
            
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800 font-medium">Payment Details</p>
                <p className="text-sm text-blue-600">Patient: {selectedPatient.patient.name}</p>
                <p className="text-sm text-blue-600">Visit: {selectedPatient.visitUid}</p>
                <p className="text-lg font-semibold text-blue-900 mt-2">
                  Total Amount: ETB {selectedPatient.billing?.totalAmount || 0}
                </p>
              </div>

              <div>
                <label className="label">Payment Amount</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  placeholder={String(selectedPatient.billing?.totalAmount || 0)}
                />
              </div>

              <div>
                <label className="label">Payment Type</label>
                <select
                  className="input"
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank Transfer</option>
                  <option value="INSURANCE">Insurance</option>
                  <option value="CHARITY">Charity</option>
                </select>
              </div>

              {paymentType === 'BANK' && (
                <div className="space-y-3">
                  <div>
                    <label className="label">Bank Name</label>
                    <input
                      type="text"
                      className="input"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. Commercial Bank of Ethiopia"
                    />
                  </div>
                  <div>
                    <label className="label">Transaction Number</label>
                    <input
                      type="text"
                      className="input"
                      value={transNumber}
                      onChange={(e) => setTransNumber(e.target.value)}
                      placeholder="Transaction reference number"
                    />
                  </div>
                </div>
              )}
              
              <div>
                <label className="label">Notes (Optional)</label>
                <textarea
                  className="input"
                  rows="3"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Add any notes about this payment..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={handleProcessPayment}
                className="btn btn-primary flex items-center"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Process Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyBilling;
