import React, { useState, useEffect } from 'react';
import { User, Stethoscope, DollarSign, Search, Filter } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const DoctorAssignment = () => {
  const [triagedPatients, setTriagedPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedQualification, setSelectedQualification] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const qualifications = [
    { value: 'ALL', label: 'All Qualifications' },
    { value: 'General Doctor', label: 'General Doctor' },
    { value: 'Dentist', label: 'Dentist' },
    { value: 'Ophthalmologist', label: 'Ophthalmologist' },
    { value: 'Radiologist', label: 'Radiologist' },
    { value: 'Orthodontist', label: 'Orthodontist' },
    { value: 'Periodontist', label: 'Periodontist' },
    { value: 'Endodontist', label: 'Endodontist' },
    { value: 'Cardiologist', label: 'Cardiologist' }
  ];

  useEffect(() => {
    fetchTriagedPatients();
    fetchDoctors();
  }, []);

  const fetchTriagedPatients = async () => {
    try {
      setLoading(true);
      const response = await api.get('/nurses/queue');
      // Filter for triaged patients only
      const triaged = response.data.filter(visit => visit.status === 'TRIAGED');
      setTriagedPatients(triaged);
    } catch (error) {
      toast.error('Failed to fetch triaged patients');
      console.error('Error fetching patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await api.get('/admin/users?role=DOCTOR');
      setDoctors(response.data.users || []);
    } catch (error) {
      toast.error('Failed to fetch doctors');
      console.error('Error fetching doctors:', error);
    }
  };

  const handleAssignDoctor = async (doctorId) => {
    try {
      await api.post('/nurses/assignments', {
        patientId: selectedPatient.patient.id,
        visitId: selectedPatient.id,
        doctorId: doctorId
      });

      toast.success('Doctor assigned successfully!');
      setShowAssignmentModal(false);
      setSelectedPatient(null);
      fetchTriagedPatients();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to assign doctor');
    }
  };

  const filteredDoctors = doctors.filter(doctor => {
    const matchesSearch = doctor.fullname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doctor.username.toLowerCase().includes(searchTerm.toLowerCase());
    const qualValue = selectedQualification.toLowerCase().replace(/ /g, '');
    const matchesQualification = selectedQualification === 'ALL' ||
      doctor.qualifications?.includes(selectedQualification) ||
      doctor.specialty === qualValue;
    return matchesSearch && matchesQualification && doctor.availability;
  });

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
          <h2 className="text-2xl font-bold text-gray-900">Doctor Assignment</h2>
          <p className="text-gray-600">Assign doctors to triaged patients</p>
        </div>
        <div className="text-sm text-gray-500">
          {triagedPatients.length} patients waiting for assignment
        </div>
      </div>

      {/* Triaged Patients List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {triagedPatients.map((visit) => (
          <div key={visit.id} className="card">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-green-600" />
                </div>
                <div className="ml-3">
                  <h3 className="font-medium text-gray-900">{visit.patient.name}</h3>
                  <p className="text-sm text-gray-500">ID: {visit.patient.id}</p>
                </div>
              </div>
              <span className="badge badge-success">Triaged</span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Age:</span>
                <span className="font-medium">
                  {new Date().getFullYear() - new Date(visit.patient.dob).getFullYear()} years
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Gender:</span>
                <span className="font-medium capitalize">{visit.patient.gender?.toLowerCase()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Type:</span>
                <span className="font-medium capitalize">{visit.patient.type?.toLowerCase()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Triaged At:</span>
                <span className="font-medium">
                  {new Date(visit.updatedAt).toLocaleTimeString()}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setSelectedPatient(visit);
                setShowAssignmentModal(true);
              }}
              className="btn btn-primary btn-sm w-full flex items-center justify-center"
            >
              <Stethoscope className="h-4 w-4 mr-1" />
              Assign Doctor
            </button>
          </div>
        ))}
      </div>

      {/* Doctor Assignment Modal */}
      {showAssignmentModal && selectedPatient && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Assign Doctor - {selectedPatient.patient.name}
              </h3>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search doctors..."
                      className="input pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="sm:w-48">
                  <select
                    className="input"
                    value={selectedQualification}
                    onChange={(e) => setSelectedQualification(e.target.value)}
                  >
                    {qualifications.map(qualification => (
                      <option key={qualification.value} value={qualification.value}>
                        {qualification.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Doctors Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                {filteredDoctors.map((doctor) => (
                  <div key={doctor.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center">
                        <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Stethoscope className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="ml-3">
                          <h4 className="font-medium text-gray-900">{doctor.fullname}</h4>
                          <p className="text-sm text-gray-500">@{doctor.username}</p>
                        </div>
                      </div>
                      {doctor.consultationFee && (
                        <div className="flex items-center text-green-600">
                          <DollarSign className="h-4 w-4 mr-1" />
                          <span className="text-sm font-medium">{doctor.consultationFee}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex flex-wrap gap-1">
                        {doctor.qualifications?.map((qualification, index) => (
                          <span key={index} className="badge badge-secondary text-xs">
                            {qualification}
                          </span>
                        )) || <span className="text-xs text-gray-500">No qualifications</span>}
                      </div>
                      {doctor.licenseNumber && (
                        <p className="text-xs text-gray-500">
                          License: {doctor.licenseNumber}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleAssignDoctor(doctor.id)}
                      className="btn btn-primary btn-sm w-full"
                    >
                      Assign Doctor
                    </button>
                  </div>
                ))}
              </div>

              {filteredDoctors.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Stethoscope className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No doctors found matching your criteria</p>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 mt-6 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignmentModal(false);
                    setSelectedPatient(null);
                    setSearchTerm('');
                    setSelectedQualification('ALL');
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorAssignment;
