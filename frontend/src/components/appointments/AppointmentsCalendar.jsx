import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Plus, Edit, Trash2, CheckCircle } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const AppointmentsCalendar = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [formData, setFormData] = useState({
    patientId: '',
    doctorId: '',
    date: '',
    time: '',
    notes: '',
    status: 'SCHEDULED'
  });

  const statusColors = {
    'SCHEDULED': 'badge-info',
    'CONFIRMED': 'badge-success',
    'CANCELLED': 'badge-danger',
    'COMPLETED': 'badge-success'
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/schedules/appointments');
      setAppointments(response.data);
    } catch (error) {
      toast.error('Failed to fetch appointments');
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const appointmentData = {
        ...formData,
        date: new Date(formData.date).toISOString(),
        time: new Date(`2000-01-01T${formData.time}`).toISOString()
      };

      if (editingAppointment) {
        await api.put(`/schedules/${editingAppointment.id}`, appointmentData);
        toast.success('Appointment updated successfully');
      } else {
        await api.post('/schedules', appointmentData);
        toast.success('Appointment created successfully');
      }
      setShowModal(false);
      setEditingAppointment(null);
      setFormData({
        patientId: '',
        doctorId: '',
        date: '',
        time: '',
        notes: '',
        status: 'SCHEDULED'
      });
      fetchAppointments();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save appointment');
    }
  };

  const handleEdit = (appointment) => {
    setEditingAppointment(appointment);
    setFormData({
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      date: new Date(appointment.date).toISOString().split('T')[0],
      time: new Date(appointment.time).toTimeString().slice(0, 5),
      notes: appointment.notes || '',
      status: appointment.status
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this appointment?')) {
      try {
        await api.delete(`/schedules/${id}`);
        toast.success('Appointment deleted successfully');
        fetchAppointments();
      } catch (error) {
        toast.error('Failed to delete appointment');
      }
    }
  };

  const getAppointmentsForDate = (date) => {
    return appointments.filter(apt => {
      const aptDate = new Date(apt.date);
      return aptDate.toDateString() === date.toDateString();
    });
  };

  const formatTime = (timeString) => {
    return new Date(timeString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
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
          <h2 className="text-2xl font-bold text-gray-900">Appointments Calendar</h2>
          <p className="text-gray-600">Manage patient appointments and schedules</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Schedule Appointment
        </button>
      </div>

      {/* Calendar View */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {selectedDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setSelectedDate(new Date(selectedDate.getTime() - 24 * 60 * 60 * 1000))}
              className="btn btn-secondary btn-sm"
            >
              Previous Day
            </button>
            <button
              onClick={() => setSelectedDate(new Date())}
              className="btn btn-secondary btn-sm"
            >
              Today
            </button>
            <button
              onClick={() => setSelectedDate(new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000))}
              className="btn btn-secondary btn-sm"
            >
              Next Day
            </button>
          </div>
        </div>

        {/* Appointments List */}
        <div className="space-y-3">
          {getAppointmentsForDate(selectedDate).map((appointment) => (
            <div key={appointment.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <p className="font-medium">{appointment.patient?.name || 'Unknown Patient'}</p>
                  <p className="text-sm text-gray-500">
                    <Clock className="h-4 w-4 inline mr-1" />
                    {formatTime(appointment.time)}
                  </p>
                  {appointment.notes && (
                    <p className="text-sm text-gray-600 mt-1">{appointment.notes}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`badge ${statusColors[appointment.status]}`}>
                  {appointment.status}
                </span>
                <button
                  onClick={() => handleEdit(appointment)}
                  className="text-blue-600 hover:text-blue-800"
                  title="Edit"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(appointment.id)}
                  className="text-red-600 hover:text-red-800"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          
          {getAppointmentsForDate(selectedDate).length === 0 && (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No appointments scheduled for this date</p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingAppointment ? 'Edit Appointment' : 'Schedule New Appointment'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Patient ID *</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.patientId}
                    onChange={(e) => setFormData({...formData, patientId: e.target.value})}
                    required
                    placeholder="Enter patient ID"
                  />
                </div>
                
                <div>
                  <label className="label">Doctor ID *</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.doctorId}
                    onChange={(e) => setFormData({...formData, doctorId: e.target.value})}
                    required
                    placeholder="Enter doctor ID"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Date *</label>
                    <input
                      type="date"
                      className="input"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Time *</label>
                    <input
                      type="time"
                      className="input"
                      value={formData.time}
                      onChange={(e) => setFormData({...formData, time: e.target.value})}
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="label">Status</label>
                  <select
                    className="input"
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
                
                <div>
                  <label className="label">Notes</label>
                  <textarea
                    className="input"
                    rows="3"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Any additional notes..."
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingAppointment(null);
                      setFormData({
                        patientId: '',
                        doctorId: '',
                        date: '',
                        time: '',
                        notes: '',
                        status: 'SCHEDULED'
                      });
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingAppointment ? 'Update' : 'Schedule'}
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

export default AppointmentsCalendar;
