import React, { useState, useEffect } from 'react';
import { Pill, Clock, CheckCircle, AlertTriangle, Package, ShoppingCart, Users, Calendar } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const PrescriptionQueue = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showBulkDispenseForm, setShowBulkDispenseForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('QUEUED'); // Default to QUEUED
  const [dispenseData, setDispenseData] = useState({
    medications: []
  });
  const [dispensing, setDispensing] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/pharmacies/orders');
      setOrders(response.data.orders || []);
    } catch (error) {
      toast.error('Failed to fetch prescription orders');
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group orders by patient and filter by status
  const groupedOrders = orders
    .filter(order => order.status === statusFilter)
    .reduce((acc, order) => {
      const key = `${order.patientId}-${order.visitId}`;
      if (!acc[key]) {
        acc[key] = {
          patient: order.patient,
          visit: order.visit,
          orders: []
        };
      }
      acc[key].orders.push(order);
      return acc;
    }, {});

  const handleBulkDispense = async (e) => {
    e.preventDefault();
    setDispensing(true);
    try {
      const medications = dispenseData.medications.map(med => ({
        medicationOrderId: med.medicationOrderId,
        pharmacyInvoiceId: med.pharmacyInvoiceId,
        status: med.status,
        quantity: med.quantity,
        notes: med.notes
      }));

      await api.post('/pharmacies/bulk-dispense', {
        patientId: selectedPatient.patient.id,
        visitId: selectedPatient.visit.id,
        medications
      });

      toast.success(`Successfully dispensed ${medications.length} medications!`);
      setShowBulkDispenseForm(false);
      setSelectedPatient(null);
      setDispenseData({ medications: [] });
      
      // Refresh orders to update the queue
      await fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to dispense medications');
    } finally {
      setDispensing(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'UNPAID':
        return 'badge-warning';
      case 'QUEUED':
        return 'badge-info';
      case 'COMPLETED':
        return 'badge-success';
      default:
        return 'badge-gray';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'UNPAID':
        return <Clock className="h-4 w-4" />;
      case 'QUEUED':
        return <Pill className="h-4 w-4" />;
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Prescription Queue</h2>
          <p className="text-gray-600">Process medication prescriptions and dispense</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Filter by Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input text-sm"
            >
              <option value="QUEUED">Queued</option>
              <option value="COMPLETED">Dispensed</option>
            </select>
          </div>
          <div className="text-sm text-gray-500">
            {Object.keys(groupedOrders).length} patients with {statusFilter.toLowerCase()} orders
          </div>
        </div>
      </div>

      {/* Patient Groups */}
      <div className="space-y-6">
        {Object.keys(groupedOrders).length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No {statusFilter.toLowerCase()} medications
            </h3>
            <p className="text-gray-500">
              {statusFilter === 'QUEUED' 
                ? 'No medications are currently queued for dispensing.'
                : 'No medications have been dispensed yet.'
              }
            </p>
          </div>
        ) : (
          Object.entries(groupedOrders).map(([key, patientGroup]) => {
          const currentOrders = patientGroup.orders; // Already filtered by status
          
          return (
            <div key={key} className="card">
              {/* Patient Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-gray-900">{patientGroup.patient.name}</h3>
                    <p className="text-sm text-gray-500">ID: {patientGroup.patient.id}</p>
                    <p className="text-sm text-gray-500">Visit: {patientGroup.visit.visitUid}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-sm text-gray-500">
                      {currentOrders.length} {statusFilter.toLowerCase()}
                    </span>
                  </div>
                  {statusFilter === 'QUEUED' && currentOrders.length > 0 && (
                    <button
                      onClick={() => {
                        setSelectedPatient(patientGroup);
                        setDispenseData({
                          medications: currentOrders.map(order => ({
                            medicationOrderId: order.id,
                            pharmacyInvoiceId: null, // Will be filled from invoice
                            status: 'DISPENSED',
                            quantity: order.quantity,
                            notes: '',
                            name: order.name,
                            strength: order.strength,
                            dosageForm: order.dosageForm
                          }))
                        });
                        setShowBulkDispenseForm(true);
                      }}
                      className="btn btn-primary btn-sm flex items-center"
                    >
                      <Package className="h-4 w-4 mr-1" />
                      Dispense All ({currentOrders.length})
                    </button>
                  )}
                </div>
              </div>

              {/* Medications List */}
              <div className="space-y-3">
                {currentOrders.map((order) => (
                  <div key={order.id} className={`p-4 rounded-lg border ${
                    order.status === 'COMPLETED' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-medium text-gray-900">{order.name}</h4>
                          <span className={`badge ${getStatusColor(order.status)} flex items-center text-xs`}>
                            {getStatusIcon(order.status)}
                            <span className="ml-1">{order.status}</span>
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Dosage</p>
                            <p className="font-medium">{order.strength} - {order.dosageForm}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Quantity</p>
                            <p className="font-medium">{order.quantity}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Frequency</p>
                            <p className="font-medium">{order.frequency || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Duration</p>
                            <p className="font-medium">{order.duration || 'N/A'}</p>
                          </div>
                        </div>

                        {order.instructions && (
                          <div className="mt-2 p-2 bg-white rounded border">
                            <p className="text-xs text-gray-500">Instructions</p>
                            <p className="text-sm">{order.instructions}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
        )}
      </div>

      {/* Bulk Dispense Form Modal */}
      {showBulkDispenseForm && selectedPatient && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Bulk Dispense Medications - {selectedPatient.patient.name}
              </h3>
              
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Patient:</strong> {selectedPatient.patient.name} ({selectedPatient.patient.id})
                </p>
                <p className="text-sm text-blue-800">
                  <strong>Visit:</strong> {selectedPatient.visit.visitUid}
                </p>
                <p className="text-sm text-blue-800">
                  <strong>Total Medications:</strong> {dispenseData.medications.length}
                </p>
              </div>

              <form onSubmit={handleBulkDispense} className="space-y-4">
                <div className="max-h-96 overflow-y-auto">
                  <h4 className="font-medium text-gray-900 mb-3">Medications to Dispense</h4>
                  <div className="space-y-3">
                    {dispenseData.medications.map((med, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h5 className="font-medium text-gray-900">{med.name}</h5>
                            <p className="text-sm text-gray-500">{med.strength} - {med.dosageForm}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={med.status === 'DISPENSED'}
                              onChange={(e) => {
                                const newMeds = [...dispenseData.medications];
                                newMeds[index].status = e.target.checked ? 'DISPENSED' : 'NOT_AVAILABLE';
                                setDispenseData({...dispenseData, medications: newMeds});
                              }}
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-500">Dispense</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="label text-xs">Quantity to Dispense</label>
                            <input
                              type="number"
                              className="input text-sm"
                              value={med.quantity || ''}
                              onChange={(e) => {
                                const newMeds = [...dispenseData.medications];
                                newMeds[index].quantity = parseInt(e.target.value) || 0;
                                setDispenseData({...dispenseData, medications: newMeds});
                              }}
                              min="0"
                              disabled={med.status !== 'DISPENSED'}
                            />
                          </div>
                          <div>
                            <label className="label text-xs">Notes</label>
                            <input
                              type="text"
                              className="input text-sm"
                              placeholder="Optional notes..."
                              value={med.notes || ''}
                              onChange={(e) => {
                                const newMeds = [...dispenseData.medications];
                                newMeds[index].notes = e.target.value;
                                setDispenseData({...dispenseData, medications: newMeds});
                              }}
                              disabled={med.status !== 'DISPENSED'}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBulkDispenseForm(false);
                      setSelectedPatient(null);
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={dispensing || dispenseData.medications.filter(m => m.status === 'DISPENSED').length === 0}
                  >
                    {dispensing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                        Dispensing...
                      </>
                    ) : (
                      <>
                        <Package className="h-4 w-4 mr-1" />
                        Dispense Selected ({dispenseData.medications.filter(m => m.status === 'DISPENSED').length})
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrescriptionQueue;