import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import { User, Stethoscope, Circle } from 'lucide-react';

const DoctorSelectionModal = ({ isOpen, onClose, onSelectDoctor, patientId, visitId }) => {
  const [qualification, setQualification] = useState('General');
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  const qualifications = [
    { value: 'General', label: 'General Medicine', icon: Stethoscope },
    { value: 'Dentist', label: 'Dentist', icon: Circle },
    // Add more qualifications as needed
  ];

  useEffect(() => {
    if (isOpen) {
      fetchDoctors();
    }
  }, [isOpen, qualification]);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/nurses/doctors-by-qualification?qualification=${qualification}`);
      setDoctors(response.data.doctors || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      toast.error('Failed to fetch doctors');
    } finally {
      setLoading(false);
    }
  };

  const handleQualificationChange = (newQualification) => {
    setQualification(newQualification);
    setSelectedDoctor(null);
  };

  const handleDoctorSelect = (doctor) => {
    setSelectedDoctor(doctor);
  };

  const handleConfirm = () => {
    if (selectedDoctor) {
      onSelectDoctor(selectedDoctor);
      onClose();
    } else {
      toast.error('Please select a doctor');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Select Doctor</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Qualification Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select Doctor Qualification
          </label>
          <div className="grid grid-cols-2 gap-3">
            {qualifications.map((qual) => {
              const IconComponent = qual.icon;
              return (
                <button
                  key={qual.value}
                  onClick={() => handleQualificationChange(qual.value)}
                  className={`
                    flex items-center space-x-3 p-4 rounded-lg border-2 transition-all duration-200
                    ${qualification === qual.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }
                  `}
                >
                  <IconComponent className="w-6 h-6" />
                  <div className="text-left">
                    <div className="font-medium">{qual.label}</div>
                    <div className="text-sm opacity-75">
                      {qual.value === 'General' ? 'General medical care' : 'Dental care and procedures'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Doctor List */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Available {qualification === 'General' ? 'General Medicine' : 'Dental'} Doctors
          </label>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading doctors...</span>
            </div>
          ) : doctors.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <User className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No {qualification === 'General' ? 'general medicine' : 'dental'} doctors available</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {doctors.map((doctor) => (
                <div
                  key={doctor.id}
                  onClick={() => handleDoctorSelect(doctor)}
                  className={`
                    p-4 rounded-lg border cursor-pointer transition-all duration-200
                    ${selectedDoctor?.id === doctor.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{doctor.fullname}</h4>
                        <p className="text-sm text-gray-600">Dr. {doctor.username}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            {doctor.qualifications?.join(', ') || 'General'}
                          </span>
                          {doctor.consultationFee && (
                            <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
                              ${doctor.consultationFee}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">{doctor.email}</div>
                      <div className="text-xs text-green-600 font-medium">Available</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedDoctor}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Assign Doctor
          </button>
        </div>

        {/* Selected Doctor Summary */}
        {selectedDoctor && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                Selected: Dr. {selectedDoctor.fullname} ({selectedDoctor.qualifications?.join(', ') || 'General'})
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorSelectionModal;
