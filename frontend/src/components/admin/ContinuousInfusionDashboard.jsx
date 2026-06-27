import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  User, 
  Calendar, 
  Activity, 
  CheckCircle, 
  AlertCircle, 
  Play, 
  Pause, 
  Square,
  Users,
  TrendingUp,
  Eye,
  Edit
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ContinuousInfusionDashboard = () => {
  const [infusions, setInfusions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInfusion, setSelectedInfusion] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [nurses, setNurses] = useState([]);
  const [assigningNurse, setAssigningNurse] = useState(null);

  useEffect(() => {
    fetchInfusions();
    fetchNurses();
  }, []);

  const fetchInfusions = async () => {
    try {
      const response = await api.get('/continuous-infusions/active');
      setInfusions(response.data.infusions);
    } catch (error) {
      console.error('Error fetching infusions:', error);
      toast.error('Failed to fetch continuous infusions');
    } finally {
      setLoading(false);
    }
  };

  const fetchNurses = async () => {
    try {
      const response = await api.get('/continuous-infusions/nurses/available');
      setNurses(response.data.nurses);
    } catch (error) {
      console.error('Error fetching nurses:', error);
    }
  };

  const fetchInfusionDetails = async (infusionId) => {
    try {
      const response = await api.get(`/continuous-infusions/${infusionId}`);
      setSelectedInfusion(response.data.infusion);
      setShowDetails(true);
    } catch (error) {
      console.error('Error fetching infusion details:', error);
      toast.error('Failed to fetch infusion details');
    }
  };

  const updateInfusionStatus = async (infusionId, status) => {
    try {
      await api.put(`/continuous-infusions/${infusionId}/status`, { status });
      toast.success(`Infusion status updated to ${status}`);
      fetchInfusions();
      if (selectedInfusion && selectedInfusion.id === infusionId) {
        fetchInfusionDetails(infusionId);
      }
    } catch (error) {
      console.error('Error updating infusion status:', error);
      toast.error('Failed to update infusion status');
    }
  };

  const assignNurse = async (infusionId, nurseId) => {
    try {
      await api.put(`/continuous-infusions/${infusionId}/assign-nurse`, { nurseId });
      toast.success('Nurse assigned successfully');
      fetchInfusions();
      if (selectedInfusion && selectedInfusion.id === infusionId) {
        fetchInfusionDetails(infusionId);
      }
    } catch (error) {
      console.error('Error assigning nurse:', error);
      toast.error('Failed to assign nurse');
    } finally {
      setAssigningNurse(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'UNPAID': return 'text-red-600 bg-red-100';
      case 'PAID': return 'text-green-600 bg-green-100';
      case 'IN_PROGRESS': return 'text-blue-600 bg-blue-100';
      case 'COMPLETED': return 'text-gray-600 bg-gray-100';
      case 'CANCELLED': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'UNPAID': return AlertCircle;
      case 'PAID': return CheckCircle;
      case 'IN_PROGRESS': return Play;
      case 'COMPLETED': return CheckCircle;
      case 'CANCELLED': return Square;
      default: return Clock;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Continuous Infusion Management</h1>
          <p className="text-gray-600">Monitor and manage ongoing continuous infusions</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            Total Active: {infusions.length}
          </div>
          <button
            onClick={fetchInfusions}
            className="btn btn-outline btn-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Infusions</p>
              <p className="text-2xl font-bold text-gray-900">{infusions.length}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-gray-900">
                {infusions.filter(i => i.status === 'IN_PROGRESS').length}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">
                {infusions.filter(i => i.status === 'UNPAID').length}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Available Nurses</p>
              <p className="text-2xl font-bold text-gray-900">{nurses.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Infusions List */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Infusions</h3>
        
        {infusions.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No active continuous infusions</p>
          </div>
        ) : (
          <div className="space-y-4">
            {infusions.map((infusion) => {
              const StatusIcon = getStatusIcon(infusion.status);
              const completionPercentage = infusion.progress.totalTasks > 0 
                ? Math.round((infusion.progress.completedTasks / infusion.progress.totalTasks) * 100)
                : 0;

              return (
                <div key={infusion.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="font-medium text-gray-900">{infusion.patient.name}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(infusion.status)}`}>
                          <StatusIcon className="h-3 w-3 inline mr-1" />
                          {infusion.status}
                        </span>
                        {infusion.medication.name && (
                          <span className="text-sm text-gray-600">
                            {infusion.medication.name}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Medication:</span>
                          <div>{infusion.medication.name}</div>
                          <div className="text-xs">{infusion.medication.dailyDose}</div>
                        </div>
                        <div>
                          <span className="font-medium">Duration:</span>
                          <div>{infusion.schedule.days} days</div>
                          <div className="text-xs">
                            {formatDate(infusion.schedule.startDate)} - {formatDate(infusion.schedule.endDate)}
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Progress:</span>
                          <div className="flex items-center space-x-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${completionPercentage}%` }}
                              ></div>
                            </div>
                            <span className="text-xs">{completionPercentage}%</span>
                          </div>
                          <div className="text-xs">
                            {infusion.progress.completedTasks}/{infusion.progress.totalTasks} tasks
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Visit:</span>
                          <div>{infusion.visit.visitUid}</div>
                          <div className="text-xs">{formatDate(infusion.visit.date)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => fetchInfusionDetails(infusion.id)}
                        className="btn btn-outline btn-sm"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </button>

                      {infusion.status === 'UNPAID' && (
                        <button
                          onClick={() => updateInfusionStatus(infusion.id, 'PAID')}
                          className="btn btn-success btn-sm"
                        >
                          Mark Paid
                        </button>
                      )}

                      {infusion.status === 'PAID' && (
                        <button
                          onClick={() => updateInfusionStatus(infusion.id, 'IN_PROGRESS')}
                          className="btn btn-primary btn-sm"
                        >
                          Start
                        </button>
                      )}

                      {infusion.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => updateInfusionStatus(infusion.id, 'COMPLETED')}
                          className="btn btn-success btn-sm"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Infusion Details Modal */}
      {showDetails && selectedInfusion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Infusion Details - {selectedInfusion.patient.name}
              </h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Square className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Patient & Medication Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card">
                  <h4 className="font-medium text-gray-900 mb-3">Patient Information</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Name:</span> {selectedInfusion.patient.name}</div>
                    <div><span className="font-medium">Mobile:</span> {selectedInfusion.patient.mobile}</div>
                    <div><span className="font-medium">Gender:</span> {selectedInfusion.patient.gender}</div>
                    <div><span className="font-medium">DOB:</span> {formatDate(selectedInfusion.patient.dob)}</div>
                  </div>
                </div>

                <div className="card">
                  <h4 className="font-medium text-gray-900 mb-3">Medication Details</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Name:</span> {selectedInfusion.medication.name}</div>
                    <div><span className="font-medium">Dosage:</span> {selectedInfusion.medication.dosage}</div>
                    <div><span className="font-medium">Daily Dose:</span> {selectedInfusion.medication.dailyDose}</div>
                    <div><span className="font-medium">Frequency:</span> {selectedInfusion.medication.frequency}</div>
                  </div>
                </div>
              </div>

              {/* Schedule & Progress */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card">
                  <h4 className="font-medium text-gray-900 mb-3">Schedule</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">Start Date:</span> {formatDate(selectedInfusion.schedule.startDate)}</div>
                    <div><span className="font-medium">End Date:</span> {formatDate(selectedInfusion.schedule.endDate)}</div>
                    <div><span className="font-medium">Duration:</span> {selectedInfusion.schedule.days} days</div>
                    <div><span className="font-medium">Status:</span> 
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedInfusion.status)}`}>
                        {selectedInfusion.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h4 className="font-medium text-gray-900 mb-3">Progress</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Completion</span>
                      <span className="text-sm text-gray-600">{selectedInfusion.progress.completionPercentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${selectedInfusion.progress.completionPercentage}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-600">
                      {selectedInfusion.progress.completedTasks} of {selectedInfusion.progress.totalTasks} tasks completed
                    </div>
                  </div>
                </div>
              </div>

              {/* Nurse Tasks */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900">Nurse Administration Tasks</h4>
                  {nurses.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          assignNurse(selectedInfusion.id, e.target.value);
                        }
                      }}
                      className="input input-sm"
                      defaultValue=""
                    >
                      <option value="">Assign Nurse</option>
                      {nurses.map(nurse => (
                        <option key={nurse.id} value={nurse.id}>
                          {nurse.fullname}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-2">
                  {selectedInfusion.nurseTasks.map((task, index) => (
                    <div key={task.id} className={`p-3 rounded-lg border ${
                      task.completed ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${
                            task.completed ? 'bg-green-500' : 'bg-gray-300'
                          }`}></div>
                          <div>
                            <div className="font-medium text-sm">
                              Day {index + 1} - {formatDate(task.scheduledFor)}
                            </div>
                            <div className="text-xs text-gray-600">
                              Scheduled: {formatTime(task.scheduledFor)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {task.completed ? (
                            <div className="text-xs text-green-600">
                              Completed by {task.administeredBy?.fullname}
                              <br />
                              {formatTime(task.administeredAt)}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">Pending</div>
                          )}
                        </div>
                      </div>
                      {task.notes && (
                        <div className="mt-2 text-xs text-gray-600 bg-white p-2 rounded border">
                          <span className="font-medium">Notes:</span> {task.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDetails(false)}
                  className="btn btn-outline"
                >
                  Close
                </button>
                {selectedInfusion.status === 'UNPAID' && (
                  <button
                    onClick={() => {
                      updateInfusionStatus(selectedInfusion.id, 'PAID');
                      setShowDetails(false);
                    }}
                    className="btn btn-success"
                  >
                    Mark as Paid
                  </button>
                )}
                {selectedInfusion.status === 'PAID' && (
                  <button
                    onClick={() => {
                      updateInfusionStatus(selectedInfusion.id, 'IN_PROGRESS');
                      setShowDetails(false);
                    }}
                    className="btn btn-primary"
                  >
                    Start Infusion
                  </button>
                )}
                {selectedInfusion.status === 'IN_PROGRESS' && (
                  <button
                    onClick={() => {
                      updateInfusionStatus(selectedInfusion.id, 'COMPLETED');
                      setShowDetails(false);
                    }}
                    className="btn btn-success"
                  >
                    Complete Infusion
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContinuousInfusionDashboard;




