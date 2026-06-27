import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Plus, Phone, CreditCard, Filter, X, Edit2, Trash2, Check } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import ScheduleAppointmentModal from '../../components/appointments/ScheduleAppointmentModal';
import Layout from '../../components/common/Layout';

const DoctorAppointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [showTodayOnly, setShowTodayOnly] = useState(true);

  useEffect(() => {
    fetchAppointments();
  }, []);

  useEffect(() => {
    filterAppointments();
  }, [appointments, statusFilter, dateFilter, typeFilter, showTodayOnly]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/appointments/doctor');
      setAppointments(response.data.appointments || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast.error('Failed to fetch appointments');
    } finally {
      setLoading(false);
    }
  };

  const filterAppointments = () => {
    let filtered = [...appointments];

    // Today only filter (default)
    if (showTodayOnly) {
      const today = new Date().toDateString();
      filtered = filtered.filter((apt) => {
        const aptDate = new Date(apt.appointmentDate).toDateString();
        return aptDate === today;
      });
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(apt => apt.status === statusFilter);
    }

    // Date filter
    if (dateFilter) {
      const filterDate = new Date(dateFilter).toDateString();
      filtered = filtered.filter(apt => {
        const aptDate = new Date(apt.appointmentDate).toDateString();
        return aptDate === filterDate;
      });
    }

    // Type filter
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter(apt => apt.type === typeFilter);
    }

    setFilteredAppointments(filtered);
  };

  const getStatusColor = (status) => {
    const colors = {
      SCHEDULED: 'bg-blue-100 text-blue-800 border-blue-200',
      ARRIVED: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      IN_PROGRESS: 'bg-purple-100 text-purple-800 border-purple-200',
      COMPLETED: 'bg-green-100 text-green-800 border-green-200',
      CANCELLED: 'bg-red-100 text-red-800 border-red-200',
      NO_SHOW: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getCardStatusColor = (cardStatus) => {
    if (cardStatus === 'ACTIVE') return 'text-green-600';
    if (cardStatus === 'EXPIRED') return 'text-red-600';
    return 'text-gray-600';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const updateAppointmentStatus = async (appointmentId, newStatus) => {
    try {
      await api.patch(`/appointments/${appointmentId}`, { status: newStatus });
      toast.success('Appointment status updated');
      fetchAppointments();
    } catch (error) {
      console.error('Error updating appointment status:', error);
      toast.error('Failed to update appointment status');
    }
  };

  const deleteAppointment = async (appointmentId) => {
    if (!confirm('Are you sure you want to delete this appointment?')) return;
    
    try {
      await api.delete(`/appointments/${appointmentId}`);
      toast.success('Appointment deleted successfully');
      fetchAppointments();
    } catch (error) {
      console.error('Error deleting appointment:', error);
      toast.error(error.response?.data?.message || 'Failed to delete appointment');
    }
  };

  const clearFilters = () => {
    setStatusFilter('ALL');
    setDateFilter('');
    setTypeFilter('ALL');
    setShowTodayOnly(true);
  };

  const activeFilterCount = () => {
    let count = 0;
    if (statusFilter !== 'ALL') count++;
    if (dateFilter) count++;
    if (typeFilter !== 'ALL') count++;
    return count;
  };

  return (
    <Layout title="Appointments" subtitle="Manage and schedule patient appointments">
    <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex space-x-3">
            <button
              onClick={() => setShowFilterModal(true)}
              className="px-4 py-2 rounded-lg border transition flex items-center space-x-2"
              style={{ 
                backgroundColor: 'white',
                borderColor: '#E5E7EB',
                color: '#0C0E0B'
              }}
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
              {activeFilterCount() > 0 && (
                <span 
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: '#2e13d1', color: 'white' }}
                >
                  {activeFilterCount()}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowScheduleModal(true)}
              className="px-6 py-2 rounded-lg text-white font-medium transition flex items-center space-x-2"
              style={{ backgroundColor: '#2e13d1' }}
            >
              <Plus className="h-5 w-5" />
              <span>Schedule Appointment</span>
            </button>
          </div>
        </div>

        {/* Today Filter */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex items-center space-x-2 bg-white rounded-lg border p-3 w-fit" style={{ borderColor: '#E5E7EB' }}>
            <input
              type="checkbox"
              id="doctorTodayOnly"
              checked={showTodayOnly}
              onChange={(e) => {
                const checked = e.target.checked;
                setShowTodayOnly(checked);
                if (checked) {
                  setDateFilter('');
                }
              }}
              className="h-4 w-4"
              style={{ accentColor: '#2e13d1' }}
            />
            <label htmlFor="doctorTodayOnly" className="text-sm font-medium" style={{ color: '#0C0E0B' }}>
              Show Today Only
            </label>
          </div>
        </div>

        {/* Appointments List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#2e13d1' }}></div>
          </div>
        ) : filteredAppointments.length > 0 ? (
          <div className="space-y-4">
            {filteredAppointments.map((appointment) => (
              <div 
                key={appointment.id}
                className="bg-white rounded-lg border shadow-sm p-6 hover:shadow-md transition"
                style={{ borderColor: '#E5E7EB' }}
              >
                <div className="flex items-start justify-between">
                  {/* Left Section - Patient Info */}
                  <div className="flex items-start space-x-4 flex-1">
                    <div 
                      className="h-12 w-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: '#EEF2FF' }}
                    >
                      <User className="h-6 w-6" style={{ color: '#2e13d1' }} />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold" style={{ color: '#0C0E0B' }}>
                          {appointment.patient?.name}
                        </h3>
                        <span className="text-sm" style={{ color: '#6B7280' }}>
                          {appointment.patient?.id}
                        </span>
                        <CreditCard 
                          className={`h-4 w-4 ${getCardStatusColor(appointment.patient?.cardStatus)}`}
                          title={`Card ${appointment.patient?.cardStatus}`}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div className="flex items-center space-x-2 text-sm" style={{ color: '#6B7280' }}>
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(appointment.appointmentDate)}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm" style={{ color: '#6B7280' }}>
                          <Clock className="h-4 w-4" />
                          <span>{appointment.appointmentTime}</span>
                        </div>
                        {appointment.patient?.mobile && (
                          <div className="flex items-center space-x-2 text-sm" style={{ color: '#6B7280' }}>
                            <Phone className="h-4 w-4" />
                            <span>{appointment.patient.mobile}</span>
                          </div>
                        )}
                        <div className="flex items-center space-x-2 text-sm" style={{ color: '#6B7280' }}>
                          <span className="font-medium">Type:</span>
                          <span>{appointment.type}</span>
                        </div>
                      </div>

                      {appointment.reason && (
                        <div className="mb-3">
                          <p className="text-sm font-medium" style={{ color: '#6B7280' }}>Reason:</p>
                          <p className="text-sm" style={{ color: '#0C0E0B' }}>{appointment.reason}</p>
                        </div>
                      )}

                      {appointment.notes && (
                        <div className="mb-3">
                          <p className="text-sm font-medium" style={{ color: '#6B7280' }}>Notes:</p>
                          <p className="text-sm" style={{ color: '#0C0E0B' }}>{appointment.notes}</p>
                        </div>
                      )}

                      {appointment.lastDiagnosedByName && (
                        <div className="text-xs" style={{ color: '#6B7280' }}>
                          Last diagnosed by: <span className="font-medium">{appointment.lastDiagnosedByName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Section - Status & Actions */}
                  <div className="flex flex-col items-end space-y-3">
                    <span 
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(appointment.status)}`}
                    >
                      {appointment.status}
                    </span>

                    <div className="flex space-x-2">
                      {appointment.status === 'SCHEDULED' && (
                        <button
                          onClick={() => updateAppointmentStatus(appointment.id, 'ARRIVED')}
                          className="p-2 rounded hover:bg-gray-100 transition"
                          title="Mark as Arrived"
                        >
                          <Check className="h-4 w-4" style={{ color: '#2e13d1' }} />
                        </button>
                      )}
                      
                      {(appointment.status === 'SCHEDULED' || appointment.status === 'ARRIVED') && (
                        <>
                          <button
                            onClick={() => updateAppointmentStatus(appointment.id, 'CANCELLED')}
                            className="p-2 rounded hover:bg-gray-100 transition"
                            title="Cancel"
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </button>
                          <button
                            onClick={() => deleteAppointment(appointment.id)}
                            className="p-2 rounded hover:bg-gray-100 transition"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </button>
                        </>
                      )}
                    </div>

                    <div className="text-xs" style={{ color: '#9CA3AF' }}>
                      Created by {appointment.createdBy?.fullname || 'Unknown'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border shadow-sm p-12 text-center" style={{ borderColor: '#E5E7EB' }}>
            <Calendar className="h-16 w-16 mx-auto mb-4" style={{ color: '#9CA3AF' }} />
            <h3 className="text-lg font-medium mb-2" style={{ color: '#0C0E0B' }}>
              No appointments found
            </h3>
            <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
              {activeFilterCount() > 0 
                ? 'Try adjusting your filters or schedule a new appointment'
                : 'Schedule your first appointment to get started'
              }
            </p>
            {activeFilterCount() > 0 && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 rounded-lg border transition"
                style={{ 
                  backgroundColor: 'white',
                  borderColor: '#E5E7EB',
                  color: '#0C0E0B'
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Filter Modal */}
        {showFilterModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold" style={{ color: '#0C0E0B' }}>Filter Appointments</h2>
                <button onClick={() => setShowFilterModal(false)}>
                  <X className="h-6 w-6" style={{ color: '#6B7280' }} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#0C0E0B' }}>
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                    style={{ borderColor: '#E5E7EB' }}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="ARRIVED">Arrived</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="NO_SHOW">No Show</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#0C0E0B' }}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    disabled={showTodayOnly}
                    className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100 disabled:text-gray-400"
                    style={{ borderColor: '#E5E7EB' }}
                  />
                  {showTodayOnly && (
                    <p className="mt-2 text-xs" style={{ color: '#6B7280' }}>
                      Disable “Show Today Only” to filter by a custom date.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#0C0E0B' }}>
                    Type
                  </label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                    style={{ borderColor: '#E5E7EB' }}
                  >
                    <option value="ALL">All Types</option>
                    <option value="CONSULTATION">Consultation</option>
                    <option value="FOLLOW_UP">Follow-up</option>
                  </select>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={clearFilters}
                  className="flex-1 px-4 py-2 border rounded-lg transition"
                  style={{ borderColor: '#E5E7EB', color: '#0C0E0B' }}
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-white transition"
                  style={{ backgroundColor: '#2e13d1' }}
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Schedule Modal */}
        <ScheduleAppointmentModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          onSuccess={fetchAppointments}
        />
    </div>
    </Layout>
  );
};

export default DoctorAppointments;

