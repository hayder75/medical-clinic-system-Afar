import React, { useState, useEffect } from 'react';
import {
  Search,
  Users,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  X,
  Eye,
  Filter,
  RefreshCw,
  Calendar,
  Stethoscope,
  Clock,
  Edit
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const PatientManagement = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [cardStatusFilter, setCardStatusFilter] = useState('ALL');
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState(null);
  const [cardProducts, setCardProducts] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, expired: 0 });
  const [activatingCard, setActivatingCard] = useState(false);
  const [updatingPatient, setUpdatingPatient] = useState(false);

  // Card activation form
  const [activateForm, setActivateForm] = useState({
    cardType: 'GENERAL',
    notes: ''
  });

  // Patient edit form
  const [editForm, setEditForm] = useState({
    name: '',
    mobile: '',
    email: '',
    address: '',
    emergencyContact: '',
    dob: '',
    gender: '',
    bloodType: '',
    maritalStatus: ''
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchPatients();
    fetchCardProducts();
  }, [debouncedSearchQuery, cardStatusFilter]);

  const fetchCardProducts = async () => {
    try {
      const response = await api.get('/admin/card-products');
      setCardProducts(response.data.cardProducts || []);
    } catch (error) {
      console.error('Error fetching card products:', error);
    }
  };

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearchQuery) params.append('search', debouncedSearchQuery);
      if (cardStatusFilter !== 'ALL') params.append('cardStatus', cardStatusFilter);

      const response = await api.get(`/reception/patients?${params.toString()}`);

      if (response.data.patients) {
        // DEBUG: Check activeVisit data
        const withVisit = response.data.patients.filter(p => p.activeVisit);
        console.log('🟢 Patients with activeVisit:', withVisit.length);
        withVisit.forEach(p => console.log('   -', p.id, p.name, 'visit:', p.activeVisit?.status));

        setPatients(response.data.patients);

        // Calculate stats from the patients data
        const stats = {
          total: response.data.patients.length,
          active: response.data.patients.filter(p => p.cardStatus === 'ACTIVE').length,
          inactive: response.data.patients.filter(p => p.cardStatus === 'INACTIVE').length,
          expired: response.data.patients.filter(p => p.cardStatus === 'EXPIRED').length
        };
        setStats(stats);
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast.error('Failed to fetch patients');
    } finally {
      setLoading(false);
    }
  };


  const handleActivateCard = async () => {
    if (activatingCard) return; // Prevent multiple clicks

    try {
      setActivatingCard(true);

      const response = await api.post('/reception/activate-card', {
        patientId: selectedPatient.id,
        cardType: activateForm.cardType,
        notes: activateForm.notes
      });

      if (response.data.billing) {
        toast.success('Card activation bill sent to billing. Patient will be activated after payment.');
        setShowActivateModal(false);
        setActivateForm({ cardType: 'GENERAL', notes: '' });
        setSelectedPatient(null);
        fetchPatients();
      } else {
        toast.error('Failed to activate card: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error activating card:', error);
      toast.error('Failed to activate card: ' + (error.response?.data?.message || error.message));
    } finally {
      setActivatingCard(false);
    }
  };

  // Manual deactivation removed - cards now deactivate automatically based on expiry date

  const fetchPatientHistory = async (patientId) => {
    try {
      setLoadingHistory(true);
      const response = await api.get(`/reception/patients/${patientId}/history`);
      setPatientHistory(response.data);
    } catch (error) {
      console.error('Error fetching patient history:', error);
      toast.error('Failed to fetch patient history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleViewHistory = async (patient) => {
    setSelectedPatient(patient);
    setShowHistoryModal(true);
    await fetchPatientHistory(patient.id);
  };

  const handleEditPatient = (patient) => {
    setSelectedPatient(patient);
    setEditForm({
      name: patient.name || '',
      mobile: patient.mobile || '',
      email: patient.email || '',
      address: patient.address || '',
      emergencyContact: patient.emergencyContact || '',
      dob: patient.dob ? new Date(patient.dob).toISOString().split('T')[0] : '',
      gender: patient.gender || '',
      bloodType: patient.bloodType || '',
      maritalStatus: patient.maritalStatus || ''
    });
    setShowEditModal(true);
  };

  const handleUpdatePatient = async () => {
    if (!selectedPatient) return;

    try {
      setUpdatingPatient(true);

      // Prepare data: convert empty strings to null for optional fields
      const updateData = {
        name: editForm.name.trim() || undefined,
        mobile: editForm.mobile?.trim() || null,
        email: editForm.email?.trim() || null,
        address: editForm.address?.trim() || null,
        emergencyContact: editForm.emergencyContact?.trim() || null,
        dob: editForm.dob || null,
        gender: editForm.gender || null,
        bloodType: editForm.bloodType || null,
        maritalStatus: editForm.maritalStatus || null
      };

      const response = await api.put(`/reception/patients/${selectedPatient.id}`, updateData);

      if (response.data.success) {
        toast.success('Patient updated successfully');
        setShowEditModal(false);
        setSelectedPatient(null);
        fetchPatients(); // Refresh the list
      } else {
        toast.error('Failed to update patient');
      }
    } catch (error) {
      console.error('Error updating patient:', error);
      toast.error('Failed to update patient: ' + (error.response?.data?.error || error.message));
    } finally {
      setUpdatingPatient(false);
    }
  };

  const getCardStatusColor = (status) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'INACTIVE': return 'bg-gray-100 text-gray-800';
      case 'EXPIRED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCardStatusIcon = (status) => {
    switch (status) {
      case 'ACTIVE': return <CheckCircle className="h-4 w-4" />;
      case 'INACTIVE': return <X className="h-4 w-4" />;
      case 'EXPIRED': return <AlertTriangle className="h-4 w-4" />;
      default: return <X className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  // Filter patients based on search query and card status
  const filteredPatients = patients.filter(patient => {
    const matchesSearch = !searchQuery ||
      patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (patient.mobile && patient.mobile.includes(searchQuery));

    const matchesCardStatus = cardStatusFilter === 'ALL' || patient.cardStatus === cardStatusFilter;

    return matchesSearch && matchesCardStatus;
  });

  return (
    <div className="p-6">

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total Patients</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Active Cards</p>
              <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center">
            <X className="h-8 w-8 text-gray-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Inactive Cards</p>
              <p className="text-2xl font-bold text-gray-900">{stats.inactive}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Expired Cards</p>
              <p className="text-2xl font-bold text-gray-900">{stats.expired}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow border mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, ID, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>

          {/* Filter */}
          <div className="flex gap-2">
            <select
              value={cardStatusFilter}
              onChange={(e) => setCardStatusFilter(e.target.value)}
              className="input"
            >
              <option value="ALL">All Cards</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="EXPIRED">Expired</option>
            </select>

            <button
              onClick={fetchPatients}
              className="btn btn-primary btn-sm flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

        </div>
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Card Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expiry Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                    {patients.length === 0 ? 'No patients found in database' : `No patients match your search/filter criteria (${patients.length} total patients)`}
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                          {patient.name}
                          {patient.activeVisit && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-[10px] font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                              {patient.activeVisit.status?.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">ID: {patient.id}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-gray-900">{patient.mobile || 'N/A'}</div>
                        <div className="text-sm text-gray-500">{patient.email || 'N/A'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCardStatusColor(patient.cardStatus)}`}>
                        {getCardStatusIcon(patient.cardStatus)}
                        <span className="ml-1">{patient.cardStatus}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(patient.cardExpiryDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {patient.cardStatus === 'INACTIVE' && (
                          <button
                            onClick={() => {
                              setSelectedPatient(patient);
                              setActivateForm({
                                cardType: patient.cardType || 'GENERAL',
                                notes: ''
                              });
                              setShowActivateModal(true);
                            }}
                            className="text-green-600 hover:text-green-900"
                          >
                            Activate Card
                          </button>
                        )}
                        {/* Manual deactivation removed - cards now deactivate automatically based on expiry date */}
                        {patient.activeVisit && (
                          <button
                            onClick={async () => {
                              if (!confirm(`Complete active visit (${patient.activeVisit.visitUid}) for ${patient.name}?`)) return;
                              try {
                                await api.post(`/reception/patients/${patient.id}/complete-visit`);
                                toast.success('Visit completed');
                                fetchPatients();
                              } catch (err) {
                                toast.error(err.response?.data?.error || 'Failed to complete visit');
                              }
                            }}
                            className="btn btn-success btn-sm"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Complete
                          </button>
                        )}
                        <button
                          onClick={() => handleEditPatient(patient)}
                          className="text-green-600 hover:text-green-900 flex items-center gap-1"
                        >
                          <Edit className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleViewHistory(patient)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View History
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* Activate Card Modal */}
      {showActivateModal && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Activate Card</h2>
              <button
                onClick={() => setShowActivateModal(false)}
                disabled={activatingCard}
                className={`text-gray-400 hover:text-gray-600 ${activatingCard ? 'cursor-not-allowed opacity-50' : ''
                  }`}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Patient: <span className="font-medium">{selectedPatient.name}</span></p>
              <p className="text-sm text-gray-600">ID: <span className="font-medium">{selectedPatient.id}</span></p>
            </div>

            <div className="mb-4">
              <label className="label">
                Card Type For Reactivation
              </label>
              <select
                value={activateForm.cardType}
                onChange={(e) => setActivateForm({ ...activateForm, cardType: e.target.value })}
                disabled={activatingCard}
                className={`input ${activatingCard ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              >
                {cardProducts.filter(c => c.isActive).map(c => (
                  <option key={c.id} value={c.slug}>{c.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                This selected card type will be used for activation billing and future card-based billing category.
              </p>
            </div>

            <div className="mb-4">
              <label className="label">
                Notes (Optional)
              </label>
              <textarea
                value={activateForm.notes}
                onChange={(e) => setActivateForm({ ...activateForm, notes: e.target.value })}
                rows={3}
                disabled={activatingCard}
                className={`input ${activatingCard ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                placeholder="Add any notes about this activation..."
              />
            </div>

            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <strong>Note:</strong> This will create an activation bill based on selected card type. The card will be activated after payment is processed at billing.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowActivateModal(false)}
                disabled={activatingCard}
                className={`btn btn-outline ${activatingCard ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Cancel
              </button>
              <button
                onClick={handleActivateCard}
                disabled={activatingCard}
                className={`btn btn-success flex items-center gap-2 ${activatingCard ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {activatingCard ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sending...
                  </>
                ) : (
                  'Send to Billing'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient History Modal */}
      {showHistoryModal && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Patient History - {selectedPatient.name}</h2>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedPatient(null);
                  setPatientHistory(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {loadingHistory ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            ) : patientHistory ? (
              <div className="space-y-4">
                {/* Patient Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Patient Information</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><strong>ID:</strong> {patientHistory.patient.id}</div>
                    <div><strong>Phone:</strong> {patientHistory.patient.mobile || 'N/A'}</div>
                    <div><strong>Card Status:</strong> {patientHistory.patient.cardStatus}</div>
                    <div><strong>Gender:</strong> {patientHistory.patient.gender || 'N/A'}</div>
                  </div>
                </div>

                {/* Visit History */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Previous Visits & Doctors</h3>
                  {patientHistory.visits && patientHistory.visits.length > 0 ? (
                    <div className="space-y-3">
                      {patientHistory.visits.map((visit, index) => (
                        <div key={visit.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Calendar className="h-4 w-4 text-gray-500" />
                                <span className="text-sm font-medium text-gray-900">
                                  {new Date(visit.createdAt).toLocaleDateString()} at {new Date(visit.createdAt).toLocaleTimeString()}
                                </span>
                              </div>
                              {visit.assignedDoctor ? (
                                <div className="flex items-center gap-2 mb-2">
                                  <Stethoscope className="h-4 w-4 text-blue-500" />
                                  <span className="text-sm text-gray-700">
                                    <strong>Doctor:</strong> {visit.assignedDoctor.fullname}
                                    {visit.assignedDoctor.qualifications && visit.assignedDoctor.qualifications.length > 0 && (
                                      <span className="text-gray-500 ml-1">
                                        ({visit.assignedDoctor.qualifications.join(', ')})
                                      </span>
                                    )}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 mb-2">
                                  <Clock className="h-4 w-4 text-gray-400" />
                                  <span className="text-sm text-gray-500">No doctor assigned</span>
                                </div>
                              )}
                              <div className="text-xs text-gray-500">
                                <strong>Visit ID:</strong> {visit.visitUid || visit.id} |
                                <strong> Status:</strong> {visit.status.replace(/_/g, ' ')}
                              </div>
                              {index === 0 && (
                                <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-800">
                                  <strong>Most Recent Visit:</strong> Last time you had this before, you saw Dr. {visit.assignedDoctor?.fullname || 'No doctor assigned'}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>No previous visits found for this patient.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No history data available.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Patient Modal */}
      {showEditModal && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Edit Patient Details</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedPatient(null);
                }}
                disabled={updatingPatient}
                className={`text-gray-400 hover:text-gray-600 ${updatingPatient ? 'cursor-not-allowed opacity-50' : ''
                  }`}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Patient ID: <span className="font-medium">{selectedPatient.id}</span></p>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="label">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  disabled={updatingPatient}
                  className={`input ${updatingPatient ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  required
                />
              </div>

              {/* Mobile */}
              <div>
                <label className="label">
                  Mobile
                </label>
                <input
                  type="text"
                  value={editForm.mobile}
                  onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                  disabled={updatingPatient}
                  className={`input ${updatingPatient ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  placeholder="e.g., 0912345678"
                />
              </div>

              {/* Email */}
              <div>
                <label className="label">
                  Email
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  disabled={updatingPatient}
                  className={`input ${updatingPatient ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  placeholder="patient@example.com"
                />
              </div>

              {/* Address */}
              <div>
                <label className="label">
                  Address
                </label>
                <textarea
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  disabled={updatingPatient}
                  rows={2}
                  className={`input ${updatingPatient ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  placeholder="Patient address"
                />
              </div>

              {/* Emergency Contact */}
              <div>
                <label className="label">
                  Emergency Contact
                </label>
                <input
                  type="text"
                  value={editForm.emergencyContact}
                  onChange={(e) => setEditForm({ ...editForm, emergencyContact: e.target.value })}
                  disabled={updatingPatient}
                  className={`input ${updatingPatient ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  placeholder="Emergency contact name or phone"
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label className="label">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={editForm.dob}
                  onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })}
                  disabled={updatingPatient}
                  className={`input ${updatingPatient ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
              </div>

              {/* Gender */}
              <div>
                <label className="label">
                  Gender
                </label>
                <select
                  value={editForm.gender}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                  disabled={updatingPatient}
                  className={`input ${updatingPatient ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                >
                  <option value="">Select Gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {/* Blood Type */}
              <div>
                <label className="label">
                  Blood Type
                </label>
                <select
                  value={editForm.bloodType}
                  onChange={(e) => setEditForm({ ...editForm, bloodType: e.target.value })}
                  disabled={updatingPatient}
                  className={`input ${updatingPatient ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                >
                  <option value="">Select Blood Type</option>
                  <option value="A_PLUS">A+</option>
                  <option value="A_MINUS">A-</option>
                  <option value="B_PLUS">B+</option>
                  <option value="B_MINUS">B-</option>
                  <option value="AB_PLUS">AB+</option>
                  <option value="AB_MINUS">AB-</option>
                  <option value="O_PLUS">O+</option>
                  <option value="O_MINUS">O-</option>
                  <option value="UNKNOWN">Unknown</option>
                </select>
              </div>

              {/* Marital Status */}
              <div>
                <label className="label">
                  Marital Status
                </label>
                <select
                  value={editForm.maritalStatus}
                  onChange={(e) => setEditForm({ ...editForm, maritalStatus: e.target.value })}
                  disabled={updatingPatient}
                  className={`input ${updatingPatient ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                >
                  <option value="">Select Marital Status</option>
                  <option value="SINGLE">Single</option>
                  <option value="MARRIED">Married</option>
                  <option value="DIVORCED">Divorced</option>
                  <option value="WIDOWED">Widowed</option>
                  <option value="UNKNOWN">Unknown</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedPatient(null);
                }}
                disabled={updatingPatient}
                className={`btn btn-outline ${updatingPatient ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePatient}
                disabled={updatingPatient || !editForm.name.trim()}
                className={`btn btn-primary flex items-center gap-2 ${updatingPatient || !editForm.name.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {updatingPatient ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Update Patient
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientManagement;
