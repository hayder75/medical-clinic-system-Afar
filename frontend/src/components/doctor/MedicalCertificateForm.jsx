import React, { useState, useEffect, useCallback, useRef } from 'react';
import useDebouncedSearch from '../../hooks/useDebouncedSearch';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Search, Calendar, User, FileText, Save, X, History, ChevronRight } from 'lucide-react';
import api from '../../services/api';

const MedicalCertificateForm = ({ certificate, onSave, onCancel, isEditing = false }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    patientId: '',
    patientName: '',
    visitId: '',
    certificateDate: new Date().toISOString().split('T')[0],
    restStartDate: '',
    restEndDate: '',
    appointmentDate: '',
    diagnosis: '',
    treatment: '',
    recommendations: '',
  });

  const [showPatientSearch, setShowPatientSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const searchPatientApi = useCallback(async (query, signal) => {
    const response = await api.get(`/patients/search?query=${query}`, { signal });
    return response.data.patients || [];
  }, []);

  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    results: patients,
    setResults: setPatients,
    loading: searchingPatients
  } = useDebouncedSearch(searchPatientApi, { delay: 300, minChars: 2 });

  const searchInputRef = useRef(null);
  const prevSearching = useRef(false);
  useEffect(() => {
    if (prevSearching.current && !searchingPatients && searchQuery.length >= 2) {
      searchInputRef.current?.focus();
    }
    prevSearching.current = searchingPatients;
  }, [searchingPatients, searchQuery]);

  const [patientVisits, setPatientVisits] = useState([]);
  const [isLoadingVisits, setIsLoadingVisits] = useState(false);

  useEffect(() => {
    if (certificate && isEditing) {
      setFormData({
        patientId: certificate.patientId || '',
        patientName: certificate.patient?.name || '',
        visitId: certificate.visitId || '',
        certificateDate: certificate.certificateDate ? new Date(certificate.certificateDate).toISOString().split('T')[0] : '',
        restStartDate: certificate.restStartDate ? new Date(certificate.restStartDate).toISOString().split('T')[0] : '',
        restEndDate: certificate.restEndDate ? new Date(certificate.restEndDate).toISOString().split('T')[0] : '',
        appointmentDate: certificate.appointmentDate ? new Date(certificate.appointmentDate).toISOString().split('T')[0] : '',
        diagnosis: certificate.diagnosis || '',
        treatment: certificate.treatment || '',
        recommendations: certificate.recommendations || '',
      });
      fetchPatientVisits(certificate.patientId);
    }
  }, [certificate, isEditing]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const fetchPatientVisits = async (patientId) => {
    try {
      setIsLoadingVisits(true);
      const response = await api.get(`/patients/${patientId}/for-visit`);
      console.log('Fetched visits:', response.data.recentVisits);
      setPatientVisits(response.data.recentVisits || []);
    } catch (error) {
      console.error('Error fetching visits:', error);
    } finally {
      setIsLoadingVisits(false);
    }
  };

  const handlePatientSelect = (patient) => {
    setFormData(prev => ({
      ...prev,
      patientId: patient.id,
      patientName: patient.name
    }));
    setShowPatientSearch(false);
    setSearchQuery('');
    setPatients([]);
    fetchPatientVisits(patient.id);
  };

  const stripHtmlTags = (html) => {
    if (!html) return '';
    return html.replace(/<\/?p>/gi, '').trim();
  };

  const handleVisitSelect = async (visitId) => {
    if (!visitId) return;
    setFormData(prev => ({ ...prev, visitId: parseInt(visitId) }));

    console.log('Selecting visit ID:', visitId);

    try {
      // Fetch both diagnosis notes and structured diagnoses in parallel
      const [notesResponse, diagnosesResponse] = await Promise.all([
        api.get(`/doctors/visits/${visitId}/diagnosis-notes`),
        api.get(`/diseases/diagnosis/${visitId}`).catch(() => ({ data: [] }))
      ]);

      const notes = notesResponse.data?.notes;
      const diagnoses = diagnosesResponse.data || [];

      console.log('Fetched diagnosis notes:', notes);
      console.log('Fetched diagnoses:', diagnoses);

      // Format structured diagnoses
      let diagnosisText = '';
      if (diagnoses && diagnoses.length > 0) {
        diagnosisText = diagnoses.map(d => {
          let text = d.disease?.name || '';
          if (d.type) text += ` (${d.type})`;
          if (d.notes) text += ` - ${d.notes}`;
          return text;
        }).join(', ');
      }

      // Fallback: use chief complaint if no structured diagnosis
      let fallbackDiagnosis = '';
      if (!diagnosisText && notes?.chiefComplaint) {
        // Strip HTML tags from chief complaint
        fallbackDiagnosis = notes.chiefComplaint.replace(/<\/?p>/gi, '').replace(/<br\s*\/?>/gi, ', ').trim();
        if (fallbackDiagnosis.length > 100) {
          fallbackDiagnosis = fallbackDiagnosis.substring(0, 100) + '...';
        }
      }

      // Combine with assessmentAndDiagnosis if available
      const combinedDiagnosis = diagnosisText || notes?.assessmentAndDiagnosis || fallbackDiagnosis || '';

      // Strip HTML from treatmentGiven
      const cleanTreatment = stripHtmlTags(notes?.treatmentGiven);
      const cleanRecommendations = notes?.treatmentPlan || '';

      console.log('Combined diagnosis:', combinedDiagnosis);

      if (combinedDiagnosis || cleanTreatment || cleanRecommendations) {
        setFormData(prev => {
          const updated = {
            ...prev,
            diagnosis: combinedDiagnosis || prev.diagnosis,
            treatment: cleanTreatment || prev.treatment,
            recommendations: cleanRecommendations || prev.recommendations
          };
          console.log('Updated Form Data:', updated);
          return updated;
        });
        toast.success('Visit data fetched successfully');
      } else {
        console.warn('No notes found in response');
        toast.error('No diagnosis data found for this visit. Please add diagnoses in the consultation page first.');
      }
    } catch (error) {
      console.error('Error fetching visit data:', error);
      toast.error('Failed to fetch visit data');
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.patientId) {
      newErrors.patientId = 'Patient is required';
    }

    if (formData.restStartDate && !formData.restEndDate) {
      newErrors.restEndDate = 'Rest end date is required if start date is provided';
    }

    if (!formData.restStartDate && formData.restEndDate) {
      newErrors.restStartDate = 'Rest start date is required if end date is provided';
    }

    if (formData.restStartDate && formData.restEndDate) {
      const startDate = new Date(formData.restStartDate);
      const endDate = new Date(formData.restEndDate);

      if (endDate <= startDate) {
        newErrors.restEndDate = 'Rest end date must be after start date';
      }
    }

    if (!formData.diagnosis.trim()) {
      newErrors.diagnosis = 'Diagnosis is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const payload = {
        patientId: formData.patientId,
        visitId: formData.visitId ? parseInt(formData.visitId) : undefined,
        certificateDate: formData.certificateDate,
        restStartDate: formData.restStartDate || undefined,
        restEndDate: formData.restEndDate || undefined,
        appointmentDate: formData.appointmentDate || undefined,
        diagnosis: formData.diagnosis,
        treatment: formData.treatment,
        recommendations: formData.recommendations,
      };

      let response;
      if (isEditing) {
        response = await api.put(`/medical-certificates/${certificate.id}`, payload);
      } else {
        response = await api.post('/medical-certificates', payload);
      }

      toast.success(isEditing ? 'Certificate updated successfully' : 'Certificate created successfully');
      onSave(response.data.certificate);
    } catch (error) {
      console.error('Error saving certificate:', error);
      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error('Failed to save certificate');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 w-full max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold" style={{ color: '#0C0E0B' }}>
          {isEditing ? 'Edit Medical Certificate' : 'Create Medical Certificate'}
        </h2>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="h-5 w-5" style={{ color: '#2e13d1' }} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-full">
        {/* Patient Selection & Visit Fetching */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 relative">
            <label className="block text-sm font-medium" style={{ color: '#0C0E0B' }}>
              Patient *
            </label>
            <div className="relative w-full">
              <input
                type="text"
                value={formData.patientName}
                placeholder="Click to search patient..."
                className="w-full px-3 py-2 pl-3 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => setShowPatientSearch(true)}
                readOnly
                disabled={isEditing}
              />
              <Search className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
            {errors.patientId && (
              <p className="text-sm text-red-500">{errors.patientId}</p>
            )}

            {showPatientSearch && (
              <div className="absolute z-50 w-full bg-white border rounded-md shadow-lg mt-1 left-0 right-0 overflow-hidden">
                <div className="p-3 border-b">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search patients by name..."
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {patients.length > 0 ? (
                    patients.map((patient) => (
                      <div
                        key={patient.id}
                        className="p-3 hover:bg-gray-50 cursor-pointer border-b"
                        onClick={() => handlePatientSelect(patient)}
                      >
                        <div className="font-medium truncate" style={{ color: '#0C0E0B' }}>
                          {patient.name}
                        </div>
                        <div className="text-sm text-gray-600 truncate">
                          ID: {patient.id} | {patient.gender}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-gray-500 text-center text-sm">No results</div>
                  )}
                </div>
                <button onClick={() => setShowPatientSearch(false)} className="w-full p-2 text-sm text-gray-500 bg-gray-50 border-t">Close</button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: '#0C0E0B' }}>
              Fetch from Visit (Optional)
            </label>
            <select
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onChange={(e) => handleVisitSelect(e.target.value)}
              value={formData.visitId}
              disabled={!formData.patientId || isLoadingVisits}
            >
              <option value="">{isLoadingVisits ? 'Loading visits...' : 'Select a visit to populate data'}</option>
              {patientVisits.map(v => (
                <option key={v.id} value={v.id}>
                  {new Date(v.createdAt).toLocaleDateString()} - {v.visitUid}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Certificate Date */}
        <div className="space-y-2">
          <label className="block text-sm font-medium" style={{ color: '#0C0E0B' }}>
            Certificate Date
          </label>
          <input
            type="date"
            name="certificateDate"
            value={formData.certificateDate}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Rest Period */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: '#0C0E0B' }}>
              Rest Start Date (Optional)
            </label>
            <input
              type="date"
              name="restStartDate"
              value={formData.restStartDate}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.restStartDate ? 'border-red-500' : ''}`}
            />
            {errors.restStartDate && (
              <p className="text-sm text-red-500">{errors.restStartDate}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: '#0C0E0B' }}>
              Rest End Date (Optional)
            </label>
            <input
              type="date"
              name="restEndDate"
              value={formData.restEndDate}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.restEndDate ? 'border-red-500' : ''}`}
            />
            {errors.restEndDate && (
              <p className="text-sm text-red-500">{errors.restEndDate}</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: '#0C0E0B' }}>
              Appointment Date (Optional)
            </label>
            <input
              type="date"
              name="appointmentDate"
              value={formData.appointmentDate}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Medical Information */}
        <div className="space-y-3">
          <h3 className="text-lg font-medium" style={{ color: '#0C0E0B' }}>
            Medical Information
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium" style={{ color: '#0C0E0B' }}>
                Diagnosis *
              </label>
              <textarea
                name="diagnosis"
                value={formData.diagnosis}
                onChange={handleInputChange}
                rows={5}
                placeholder="Enter diagnosis..."
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.diagnosis ? 'border-red-500' : ''}`}
              />
              {errors.diagnosis && (
                <p className="text-sm text-red-500">{errors.diagnosis}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium" style={{ color: '#0C0E0B' }}>
                Treatment
              </label>
              <textarea
                name="treatment"
                value={formData.treatment}
                onChange={handleInputChange}
                rows={5}
                placeholder="Enter treatment details..."
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium" style={{ color: '#0C0E0B' }}>
                Recommendations
              </label>
              <textarea
                name="recommendations"
                value={formData.recommendations}
                onChange={handleInputChange}
                rows={5}
                placeholder="Enter recommendations..."
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 text-white rounded-md transition-colors flex items-center space-x-2"
            style={{ backgroundColor: '#2e13d1' }}
          >
            <Save className="h-4 w-4" />
            <span>{loading ? 'Saving...' : (isEditing ? 'Update' : 'Create')}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default MedicalCertificateForm;
