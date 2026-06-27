import React, { useState, useEffect } from 'react';
import { Search, Trash2, AlertTriangle, Users, Phone, Calendar, Edit2, CheckSquare, Square, CheckCircle } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const PatientManagement = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [showEditModal, setShowEditModal] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [selectedPatients, setSelectedPatients] = useState([]);

  const [editForm, setEditForm] = useState({
    name: '',
    mobile: '',
    email: '',
    gender: 'Male',
    dob: '',
    type: 'REGULAR',
  });

  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 0
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchPatients();
  }, [debouncedSearchTerm, pagination.page]);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm);
      params.append('page', pagination.page);
      params.append('limit', pagination.limit);

      const response = await api.get(`/admin/patients?${params.toString()}`);
      setPatients(response.data.patients || []);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination?.total || 0,
        totalPages: response.data.pagination?.totalPages || 0
      }));
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast.error('Failed to fetch patients');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const currentPageIds = patients.map(p => p.id);
      setSelectedPatients(prev => {
        const newIds = currentPageIds.filter(id => !prev.includes(id));
        return [...prev, ...newIds];
      });
    } else {
      const currentPageIds = patients.map(p => p.id);
      setSelectedPatients(prev => prev.filter(id => !currentPageIds.includes(id)));
    }
  };

  const handleSelectPatient = (id) => {
    setSelectedPatients(prev =>
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const handleDelete = async () => {
    try {
      setDeleteLoading(true);

      // Bulk delete using selected patients, or single if showDeleteModal is a patient
      const patientIds = showDeleteModal?.id ? [showDeleteModal.id] : selectedPatients;

      const response = await api.delete(`/admin/patients/bulk`, {
        data: { patientIds }
      });

      toast.success(response.data.message || 'Patients and all related records deleted successfully');
      setShowDeleteModal(null);
      setSelectedPatients([]);
      fetchPatients();
    } catch (error) {
      console.error('Error deleting patients:', error);
      toast.error(error.response?.data?.error || 'Failed to delete patients');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEditClick = (patient) => {
    setEditForm({
      name: patient.name || '',
      mobile: patient.mobile || '',
      email: patient.email || '',
      gender: patient.gender || 'Male',
      dob: patient.dob ? new Date(patient.dob).toISOString().split('T')[0] : '',
      type: patient.type || 'REGULAR',
    });
    setShowEditModal(patient);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      setEditLoading(true);
      // We'll use the reception endpoint to update the patient
      await api.put(`/reception/patients/${showEditModal.id}`, editForm);
      toast.success('Patient updated successfully');
      setShowEditModal(null);
      fetchPatients();
    } catch (error) {
      console.error('Error updating patient:', error);
      toast.error(error.response?.data?.error || 'Failed to update patient');
    } finally {
      setEditLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading && patients.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Patient Management</h2>
          <p className="text-gray-600 mt-1">Manage, edit and delete patients from the system</p>
        </div>
        <div className="text-sm text-gray-500">
          Total: {pagination.total} patients
        </div>
      </div>

      {/* Search Bar & Bulk Actions */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex-1 relative w-full md:w-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search by patient ID, name, or phone number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {selectedPatients.length > 0 && (
          <button
            onClick={() => setShowDeleteModal('bulk')}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
          >
            <Trash2 className="h-4 w-4" />
            Delete Selected ({selectedPatients.length})
          </button>
        )}
      </div>

      {/* Patient Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left w-12 text-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    onChange={handleSelectAll}
                    checked={patients.length > 0 && patients.every(p => selectedPatients.includes(p.id))}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Records</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {patients.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                    No patients found
                  </td>
                </tr>
              ) : (
                patients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        checked={selectedPatients.includes(patient.id)}
                        onChange={() => handleSelectPatient(patient.id)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {patient.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {patient.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        {patient.mobile || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${patient.type === 'EMERGENCY' ? 'bg-red-100 text-red-800' :
                        patient.type === 'VIP' ? 'bg-purple-100 text-purple-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                        {patient.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex flex-col gap-1">
                        {patient._count?.visits > 0 && <span>Visits: {patient._count.visits}</span>}
                        {patient._count?.bills > 0 && <span>Bills: {patient._count.bills}</span>}
                        {patient._count?.labTestOrders > 0 && <span>Lab: {patient._count.labTestOrders}</span>}
                        {patient._count?.radiologyOrders > 0 && <span>Radiology: {patient._count.radiologyOrders}</span>}
                        {patient._count?.medicationOrders > 0 && <span>Medications: {patient._count.medicationOrders}</span>}
                        {(patient._count?.accountDeposits > 0 || patient._count?.accountTransactions > 0) && (
                          <span className="text-blue-600 font-medium">Account: Yes</span>
                        )}
                        {patient.activeVisit && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                            {patient.activeVisit.status?.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(patient.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {patient.activeVisit && (
                          <button
                            onClick={async () => {
                              if (!confirm(`Complete active visit (${patient.activeVisit.visitUid}) for ${patient.name}?`)) return;
                              try {
                                await api.post(`/admin/patients/${patient.id}/complete-visit`);
                                toast.success('Visit completed');
                                fetchPatients();
                              } catch (err) {
                                toast.error(err.response?.data?.error || 'Failed to complete visit');
                              }
                            }}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1.5" />
                            Complete
                          </button>
                        )}
                        <button
                          onClick={() => handleEditClick(patient)}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit
                        </button>
                        <button
                          onClick={() => setShowDeleteModal(patient)}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Details omitted for brevity but remain identical basically */}
        {pagination.totalPages > 1 && (
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                disabled={pagination.page === pagination.totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{' '}
                  <span className="font-medium">{pagination.total}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Patient Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl border border-gray-100 h-auto max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Edit Patient Profile</h3>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editForm.mobile}
                    onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select
                    value={editForm.gender}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={editForm.dob}
                    onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patient Type</label>
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="REGULAR">Regular (Cash)</option>
                    <option value="VIP">VIP</option>
                    <option value="EMERGENCY">Emergency</option>
                    <option value="INSURANCE">Insurance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  disabled={editLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex flex-row items-center gap-2"
                  disabled={editLoading}
                >
                  {editLoading ? <div className="h-4 w-4 border-2 border-white rounded-full animate-spin border-t-transparent" /> : null}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl border border-red-100">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-10 w-10 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900">
                  {showDeleteModal === 'bulk' ? `Delete ${selectedPatients.length} Patients?` : 'Delete Patient?'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  This action is permanent. All related records, bills, credits, tests, and history will be completely erased from the database forever.
                </p>

                {showDeleteModal !== 'bulk' && (showDeleteModal.patientAccount?.balance > 0 || showDeleteModal.patientAccount?.debtOwed > 0) && (
                  <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-lg">
                    <h4 className="text-red-800 font-bold flex items-center gap-2 mb-1">
                      <span className="text-lg">⚠️</span> Financial Alert
                    </h4>
                    <p className="text-red-700 text-xs">
                      This patient still has active financial records:
                    </p>
                    <ul className="list-disc list-inside text-red-700 text-xs mt-1">
                      {showDeleteModal.patientAccount.balance > 0 && (
                        <li><strong>Balance:</strong> {showDeleteModal.patientAccount.balance.toLocaleString()} ETB</li>
                      )}
                      {showDeleteModal.patientAccount.debtOwed > 0 && (
                        <li><strong>Unpaid Debt:</strong> {showDeleteModal.patientAccount.debtOwed.toLocaleString()} ETB</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {showDeleteModal !== 'bulk' && showDeleteModal._count && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                <p className="text-sm font-bold text-red-800">
                  Patient: {showDeleteModal.name} ({showDeleteModal.id})
                </p>
                <div className="mt-2 text-sm text-red-700">
                  <p className="font-semibold underline tracking-tight">Records to be deleted:</p>
                  <ul className="list-disc list-inside mt-1 grid grid-cols-2 gap-y-1 text-xs">
                    {showDeleteModal._count.visits > 0 && <li>Visits: {showDeleteModal._count.visits}</li>}
                    {showDeleteModal._count.bills > 0 && <li>Bills: {showDeleteModal._count.bills}</li>}
                    {showDeleteModal._count.labTestOrders > 0 && <li>Lab Orders: {showDeleteModal._count.labTestOrders}</li>}
                    {showDeleteModal._count.radiologyOrders > 0 && <li>Radiology: {showDeleteModal._count.radiologyOrders}</li>}
                    {showDeleteModal._count.accountDeposits > 0 && <li>Account Deposits: {showDeleteModal._count.accountDeposits}</li>}
                    {showDeleteModal._count.accountTransactions > 0 && <li>Account History: {showDeleteModal._count.accountTransactions}</li>}
                    {showDeleteModal._count.accountRequests > 0 && <li>Account Requests: {showDeleteModal._count.accountRequests}</li>}
                  </ul>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center gap-2"
                disabled={deleteLoading}
              >
                {deleteLoading && <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                {deleteLoading ? 'Erasing Everything...' : 'CONFIRM ERASE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientManagement;
