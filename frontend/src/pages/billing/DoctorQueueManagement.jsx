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
            <Users className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <div className="text-2xl font-bold text-gray-900">{stats.totalPatients}</div>
              <div className="text-sm text-gray-600">Total Patients</div>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <Stethoscope className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <div className="text-2xl font-bold text-gray-900">{stats.availableDoctors}</div>
              <div className="text-sm text-gray-600">Available Doctors</div>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-yellow-600" />
            <div className="ml-3">
              <div className="text-2xl font-bold text-gray-900">{stats.averageWorkload}</div>
              <div className="text-sm text-gray-600">Avg Workload</div>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-purple-600" />
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
              Patient Search
            </h3>

            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    onClick={() => setSelectedDoctor(assignedDoctor)}
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
                        {assignedDoctor && (
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
                          </>
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
                      ? 'border-blue-500 bg-blue-50'
                      : getWorkloadColor(doctor.totalWorkload)
                    }`}
                  onClick={() => setSelectedDoctor(doctor)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${doctor.totalWorkload === 0
                          ? 'bg-green-100 text-green-600'
                          : doctor.totalWorkload <= 2
                            ? 'bg-blue-100 text-blue-600'
                            : doctor.totalWorkload <= 5
                              ? 'bg-yellow-100 text-yellow-600'
                              : 'bg-red-100 text-red-600'
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
                            className={`h-2 rounded-full transition-all duration-300 ${doctor.totalWorkload === 0
                                ? 'bg-green-500'
                                : doctor.totalWorkload <= 2
                                  ? 'bg-blue-500'
                                  : doctor.totalWorkload <= 5
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                              }`}
                            style={{ width: `${Math.min((doctor.totalWorkload / 10) * 100, 100)}%` }}
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

      {/* Selected Doctor Details */}
      {selectedDoctor && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Eye className="h-5 w-5 mr-2" />
            Doctor Details - {selectedDoctor.fullname}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Contact Information</h4>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center">
                  <Phone className="h-4 w-4 mr-2" />
                  <span>Contact: Available on request</span>
                </div>
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 mr-2" />
                  <span>Location: Clinic Floor 2</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Qualifications</h4>
              <div className="flex flex-wrap gap-2">
                {selectedDoctor.qualifications?.map((qualification, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                  >
                    {qualification}
                  </span>
                )) || (
                    <span className="text-gray-500 text-sm">General Medicine</span>
                  )}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Current Status</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Patients:</span>
                  <span className="font-semibold">{selectedDoctor.totalWorkload}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">New Patients:</span>
                  <span className="font-semibold">{selectedDoctor.newPatientsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Awaiting Results:</span>
                  <span className="font-semibold">{selectedDoctor.resultsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className={`font-semibold ${getWorkloadColor(selectedDoctor.totalWorkload).split(' ')[0]}`}>
                    {getWorkloadStatus(selectedDoctor.totalWorkload)}
                  </span>
                </div>
              </div>
            </div>
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
