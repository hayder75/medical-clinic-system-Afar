import React, { useState, useEffect } from 'react';
import {
  Users,
  Stethoscope,
  Clock,
  Search,
  MapPin,
  Phone,
  Calendar,
  Activity,
  AlertTriangle,
  CheckCircle,
  UserPlus,
  Eye,
  Filter
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const DoctorQueueManagement = () => {
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDoctorQueue, setSelectedDoctorQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalPatients: 0,
    averageWorkload: 0,
    totalDoctors: 0,
    availableDoctors: 0
  });

  useEffect(() => {
    fetchDoctorQueueStatus();
    fetchAllPatients();
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDoctorQueueStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Search patients when search query changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchAllPatients(searchQuery);
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const fetchDoctorQueueStatus = async () => {
    try {
      const response = await api.get('/doctors/queue-status');
      setDoctors(response.data.doctors);
      setStats({
        totalPatients: response.data.totalPatients,
        averageWorkload: response.data.averageWorkload,
        totalDoctors: response.data.doctors.length,
        availableDoctors: response.data.doctors.filter(d => d.totalWorkload === 0).length
      });
      setError(null);
    } catch (err) {
      console.error('Error fetching doctor queue status:', err);
      setError('Failed to load doctor queue status');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllPatients = async (searchQuery = '') => {
    try {
      const response = await api.get(`/doctors/patient-assignments?search=${encodeURIComponent(searchQuery)}`);
      setPatients(response.data.patients || []);
    } catch (err) {
      console.error('Error fetching patients:', err);
      toast.error('Failed to load patient data');
    }
  };

  const fetchDoctorQueue = async (doctorId) => {
    try {
      const response = await api.get(`/doctors/unified-queue?doctorId=${doctorId}`);
      console.log('Doctor queue response:', response.data);
      setSelectedDoctorQueue(response.data.queue || []);
    } catch (err) {
      console.error('Error fetching doctor queue:', err);
      toast.error('Failed to load doctor queue');
    }
  };

  const getWorkloadColor = (workload) => {
    if (workload === 0) return 'text-green-600 bg-green-100 border-green-200';
    if (workload <= 2) return 'text-blue-600 bg-blue-100 border-blue-200';
    if (workload <= 5) return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    return 'text-red-600 bg-red-100 border-red-200';
  };

  const getWorkloadStatus = (workload) => {
    if (workload === 0) return 'Available';
    if (workload <= 2) return 'Light';
    if (workload <= 5) return 'Moderate';
    return 'Heavy';
  };

  const getWorkloadIcon = (workload) => {
    if (workload === 0) return <CheckCircle className="h-4 w-4" />;
    if (workload <= 2) return <Activity className="h-4 w-4" />;
    if (workload <= 5) return <Clock className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  const getDoctorForPatient = (patientId) => {
    // Find the patient's assigned doctor
    const patient = patients.find(p => p.id === patientId);
    return patient?.assignedDoctor || null;
  };

  const getAssignmentStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'text-yellow-600 bg-yellow-100';
      case 'In Progress': return 'text-blue-600 bg-blue-100';
      case 'Completed': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center text-red-600">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Error Loading Data</h3>
          <p className="mb-4">{error}</p>
          <button
            onClick={fetchDoctorQueueStatus}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Stethoscope className="h-6 w-6 mr-3 text-blue-600" />
            Doctor Queue Management
          </h1>
          <p className="text-gray-600 mt-1">
            Real-time doctor availability and patient guidance
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">Last updated</div>
          <div className="text-lg font-semibold text-gray-900">
            {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <Users className="h-8 w-8" style={{ color: 'var(--primary)' }} />
            <div className="ml-3">
              <div className="text-2xl font-bold text-gray-900">{stats.totalPatients}</div>
              <div className="text-sm text-gray-600">Total Patients</div>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <Stethoscope className="h-8 w-8" style={{ color: 'var(--success)' }} />
            <div className="ml-3">
              <div className="text-2xl font-bold text-gray-900">{stats.availableDoctors}</div>
              <div className="text-sm text-gray-600">Available Doctors</div>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <Activity className="h-8 w-8" style={{ color: 'var(--warning)' }} />
            <div className="ml-3">
              <div className="text-2xl font-bold text-gray-900">{stats.averageWorkload}</div>
              <div className="text-sm text-gray-600">Avg Workload</div>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <Clock className="h-8 w-8" style={{ color: 'var(--info)' }} />
            <div className="ml-3">
              <div className="text-2xl font-bold text-gray-900">{stats.totalDoctors}</div>
              <div className="text-sm text-gray-600">Total Doctors</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient Search */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Search className="h-5 w-5 mr-2" />
              Assigned Patients
            </h3>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                Search for patients assigned by nurses to guide them to the right doctor
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by patient name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-2 focus:border-transparent"
                  style={{ '--tw-ring-color': 'var(--primary)' }}
                />
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {patients.slice(0, 10).map((patient) => {
                const assignedDoctor = getDoctorForPatient(patient.id);
                return (
                  <div
                    key={patient.id}
                    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => {
                      if (assignedDoctor) {
                        setSelectedDoctor(assignedDoctor);
                        fetchDoctorQueue(assignedDoctor.id);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{patient.name}</div>
                        <div className="text-sm text-gray-600">{patient.id}</div>
                        {patient.phone && (
                          <div className="text-xs text-gray-500">{patient.phone}</div>
                        )}
                        {patient.currentVisit && (
                          <div className="text-xs text-gray-500">
                            Visit: {patient.currentVisit.visitUid} - {patient.currentVisit.status}
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-xs text-gray-500 mb-1">Status</div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getAssignmentStatusColor(patient.assignmentStatus)}`}>
                          {patient.assignmentStatus}
                        </div>
                        {assignedDoctor ? (
                          <>
                            <div className="text-xs text-gray-500 mt-2">Assigned to</div>
                            <div className="text-sm font-medium text-blue-600">
                              {assignedDoctor.fullname}
                            </div>
                            {assignedDoctor.qualifications && assignedDoctor.qualifications.length > 0 && (
                              <div className="text-xs text-gray-500">
                                {assignedDoctor.qualifications[0]}
                              </div>
                            )}
                            <div className="text-xs text-green-600 mt-1">
                              ✓ Ready to see doctor
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-red-600 mt-2">
                            ⚠ Not assigned
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {patients.length === 0 && searchQuery && (
                <div className="text-center text-gray-500 py-4">
                  <Search className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No patients found for "{searchQuery}"</p>
                </div>
              )}

              {patients.length === 0 && !searchQuery && (
                <div className="text-center text-gray-500 py-4">
                  <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No patients available</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Doctor Queue List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Stethoscope className="h-5 w-5 mr-2" />
              Doctor Queue Status
            </h3>

            <div className="space-y-4">
              {doctors.map((doctor) => (
                <div
                  key={doctor.id}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer ${selectedDoctor?.id === doctor.id
                      ? 'border-blue-400 bg-blue-50'
                      : getWorkloadColor(doctor.totalWorkload)
                    }`}
                  onClick={() => {
                    setSelectedDoctor(doctor);
                    fetchDoctorQueue(doctor.id);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${doctor.totalWorkload === 0
                          ? 'badge-success'
                          : doctor.totalWorkload <= 2
                            ? 'badge-primary'
                            : doctor.totalWorkload <= 5
                              ? 'badge-warning'
                              : 'badge-danger'
                        }`}>
                        {getWorkloadIcon(doctor.totalWorkload)}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{doctor.fullname}</h4>
                        <p className="text-sm text-gray-600">
                          {doctor.qualifications?.join(', ') || 'General Medicine'}
                        </p>
                        {doctor.consultationFee && (
                          <p className="text-xs text-gray-500">
                            Fee: ETB {doctor.consultationFee}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">{doctor.totalWorkload}</div>
                          <div className="text-xs text-gray-600">Total</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-gray-700">{doctor.newPatientsCount}</div>
                          <div className="text-xs text-gray-600">New</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold text-gray-700">{doctor.resultsCount}</div>
                          <div className="text-xs text-gray-600">Results</div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${getWorkloadColor(doctor.totalWorkload)}`}>
                          {getWorkloadStatus(doctor.totalWorkload)}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-2 w-32">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>Workload</span>
                          <span>{doctor.totalWorkload}/10</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300`}
                            style={{
                              backgroundColor: doctor.totalWorkload === 0
                                ? 'var(--success)'
                                : doctor.totalWorkload <= 2
                                  ? 'var(--primary)'
                                  : doctor.totalWorkload <= 5
                                    ? 'var(--warning)'
                                    : 'var(--danger)',
                              width: `${Math.min((doctor.totalWorkload / 10) * 100, 100)}%`
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Doctor Queue */}
      {selectedDoctor && selectedDoctorQueue.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Dr. {selectedDoctor.fullname}'s Patient Queue
          </h3>

          <div className="space-y-3">
            {selectedDoctorQueue.length > 0 ? (
              selectedDoctorQueue.map((queueItem, index) => (
                <div
                  key={queueItem.id}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 ${index === 0
                      ? 'border-green-400 bg-green-50'
                      : index === 1
                        ? 'border-yellow-400 bg-yellow-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${index === 0
                          ? 'bg-green-500'
                          : index === 1
                            ? 'bg-yellow-500'
                            : 'bg-gray-500'
                        }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{queueItem.patient?.name || 'Unknown Patient'}</div>
                        <div className="text-sm text-gray-600">ID: {queueItem.patient?.id || 'N/A'}</div>
                        <div className="text-sm text-gray-600">Visit: {queueItem.visit?.visitUid || 'N/A'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${index === 0
                          ? 'badge-success'
                          : index === 1
                            ? 'badge-warning'
                            : 'badge-gray'
                        }`}>
                        {index === 0 ? 'NEXT' : index === 1 ? 'AFTER NEXT' : 'WAITING'}
                      </div>
                      <div className="mt-2">
                        <div className={`px-2 py-1 rounded text-xs font-medium ${queueItem.visit?.status === 'WAITING_FOR_DOCTOR' ? 'badge-primary' :
                            queueItem.visit?.status === 'UNDER_DOCTOR_REVIEW' ? 'badge-info' :
                              queueItem.visit?.status === 'AWAITING_RESULTS_REVIEW' ? 'badge-warning' :
                                'badge-gray'
                          }`}>
                          {queueItem.visit?.status || 'UNKNOWN'}
                        </div>
                        {queueItem.visit?.isEmergency && (
                          <div className="mt-1 badge badge-emergency text-xs">
                            🚨 EMERGENCY
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No patients in queue</p>
                <p className="text-sm">This doctor currently has no patients waiting</p>
              </div>
            )}
          </div>

          <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'rgba(42, 91, 215, 0.05)' }}>
            <h4 className="font-semibold mb-3" style={{ color: 'var(--primary)' }}>Queue Summary</h4>
            {selectedDoctorQueue.length > 0 ? (
              <>
                <div className="flex items-center mb-2">
                  <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: 'var(--success)' }}></div>
                  <span className="text-sm text-gray-700">
                    <strong>Next:</strong> {selectedDoctorQueue[0]?.patient?.name || 'Unknown'} (ID: {selectedDoctorQueue[0]?.patient?.id || 'N/A'}) - {selectedDoctorQueue[0]?.visit?.status || 'UNKNOWN'}
                  </span>
                </div>
                {selectedDoctorQueue.length > 1 && (
                  <div className="flex items-center mb-2">
                    <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: 'var(--warning)' }}></div>
                    <span className="text-sm text-gray-700">
                      <strong>After:</strong> {selectedDoctorQueue[1]?.patient?.name || 'Unknown'} (ID: {selectedDoctorQueue[1]?.patient?.id || 'N/A'}) - {selectedDoctorQueue[1]?.visit?.status || 'UNKNOWN'}
                    </span>
                  </div>
                )}
                {selectedDoctorQueue.length > 2 && (
                  <div className="text-sm text-gray-600">
                    <strong>Total in queue:</strong> {selectedDoctorQueue.length} patients
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-gray-600">
                No patients currently in queue
              </div>
            )}
          </div>
        </div>
      )}

      {/* All Doctor's Patients */}
      {selectedDoctor && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Users className="h-5 w-5 mr-2" />
            All Patients - Dr. {selectedDoctor.fullname}
          </h3>

          <div className="space-y-3">
            {patients.filter(patient => {
              const assignedDoctor = getDoctorForPatient(patient.id);
              return assignedDoctor && assignedDoctor.id === selectedDoctor.id;
            }).map((patient, index) => (
              <div
                key={patient.id}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{patient.name}</div>
                      <div className="text-sm text-gray-600">ID: {patient.id}</div>
                      {patient.phone && (
                        <div className="text-xs text-gray-500">{patient.phone}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${patient.currentVisit?.status === 'WAITING_FOR_DOCTOR' ? 'badge-primary' :
                        patient.currentVisit?.status === 'UNDER_DOCTOR_REVIEW' ? 'badge-info' :
                          patient.currentVisit?.status === 'SENT_TO_LAB' ? 'badge-warning' :
                            patient.currentVisit?.status === 'SENT_TO_RADIOLOGY' ? 'badge-warning' :
                              patient.currentVisit?.status === 'SENT_TO_BOTH' ? 'badge-warning' :
                                patient.currentVisit?.status === 'AWAITING_RESULTS_REVIEW' ? 'badge-success' :
                                  patient.currentVisit?.status === 'SENT_TO_PHARMACY' ? 'badge-info' :
                                    patient.currentVisit?.status === 'COMPLETED' ? 'badge-gray' :
                                      'badge-gray'
                      }`}>
                      {patient.currentVisit?.status || 'UNKNOWN'}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Visit: {patient.currentVisit?.visitUid || 'N/A'}
                    </div>
                    {patient.currentVisit?.isEmergency && (
                      <div className="mt-1 badge badge-emergency text-xs">
                        🚨 EMERGENCY
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Status Information */}
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div>
                      <span className="font-medium">Assignment Status:</span> {patient.assignmentStatus}
                    </div>
                    <div>
                      <span className="font-medium">Queue Type:</span> {patient.currentVisit?.queueType || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {patients.filter(patient => {
              const assignedDoctor = getDoctorForPatient(patient.id);
              return assignedDoctor && assignedDoctor.id === selectedDoctor.id;
            }).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No patients assigned</p>
                  <p className="text-sm">This doctor currently has no patients assigned</p>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-gray-500">
        <div className="flex items-center justify-center">
          <Activity className="h-4 w-4 mr-1" />
          Auto-refreshes every 30 seconds
        </div>
      </div>
    </div>
  );
};

export default DoctorQueueManagement;
