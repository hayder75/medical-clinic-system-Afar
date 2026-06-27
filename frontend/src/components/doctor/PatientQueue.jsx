import React, { useState, useEffect, useRef } from 'react';
import { Stethoscope, User, Clock, FileText, TestTube, Scan, Pill, CheckCircle, Eye, Printer, History, ChevronDown, ChevronRight, Plus, Circle, Camera, Upload, Trash2 } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import DentalChart from '../dental/DentalChart';
import DentalPhotosSection from '../dental/DentalPhotosSection';
import PatientAttachedImagesSection from '../common/PatientAttachedImagesSection';
import ImageViewer from '../common/ImageViewer';
import { useAuth } from '../../contexts/AuthContext';

const PatientQueue = () => {
  const { user: currentUser } = useAuth();
  const isDermatologyDoctor =
    currentUser?.specialty === 'dermatology' ||
    currentUser?.role === 'DERMATOLOGY' ||
    (currentUser?.qualifications || []).some((q) => String(q || '').toUpperCase().includes('DERM'));
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [dentalRecord, setDentalRecord] = useState(null);
  const dentalChartRef = useRef(null);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentImages, setCurrentImages] = useState([]);
  const [expandedSections, setExpandedSections] = useState({
    vitals: true,
    chiefComplaint: true,
    history: false,
    physicalExam: false,
    assessment: false,
    orders: false,
    dental: true, // Default to expanded for dentists
    beforePhotos: true, // Default to expanded for dentists
    attachedImages: true // Default to expanded
  });
  const [formData, setFormData] = useState({
    // Chief Complaint & History
    chiefComplaint: '',
    historyOfPresentIllness: '',
    onsetOfSymptoms: '',
    durationOfSymptoms: '',
    severityOfSymptoms: '',
    associatedSymptoms: '',
    relievingFactors: '',
    aggravatingFactors: '',

    // Past Medical History
    pastMedicalHistory: '',
    currentMedications: '',
    knownAllergies: '',
    familyHistory: '',
    socialHistory: '',


    // Physical Examination
    generalAppearance: '',
    vitalSigns: '',
    headAndNeck: '',
    cardiovascularExam: '',
    respiratoryExam: '',
    abdominalExam: '',
    extremities: '',
    neurologicalExam: '',

    // Assessment & Plan
    primaryDiagnosis: '',
    secondaryDiagnosis: '',
    differentialDiagnosis: ''
  });
  const [selectedLabTests, setSelectedLabTests] = useState([]);
  const [selectedRadiologyTests, setSelectedRadiologyTests] = useState([]);
  const [labInstructions, setLabInstructions] = useState('');
  const [radiologyInstructions, setRadiologyInstructions] = useState('');
  const [labOrdered, setLabOrdered] = useState(false);
  const [radiologyOrdered, setRadiologyOrdered] = useState(false);
  const [alreadyOrderedLabTests, setAlreadyOrderedLabTests] = useState([]);
  const [alreadyOrderedRadiologyTests, setAlreadyOrderedRadiologyTests] = useState([]);
  const [orderStatus, setOrderStatus] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all'); // Filter: 'all', 'waiting', 'in_review', 'sent_to_billing', 'awaiting_results'

  // Lab and radiology test options (will be fetched from backend)
  const [labTestOptions, setLabTestOptions] = useState([]);
  const [radiologyTestOptions, setRadiologyTestOptions] = useState([]);

  // Fetch investigation types from backend
  const fetchInvestigationTypes = async () => {
    try {
      const response = await api.get('/doctors/investigation-types');
      const types = response.data.investigationTypes || [];

      const labTypes = types.filter(type => type.category === 'LAB');
      const radiologyTypes = types.filter(type => type.category === 'RADIOLOGY');

      setLabTestOptions(labTypes);
      setRadiologyTestOptions(radiologyTypes);
    } catch (error) {
      console.error('Error fetching investigation types:', error);
      toast.error('Failed to load test options');
    }
  };

  useEffect(() => {
    fetchVisits();
    fetchInvestigationTypes();
  }, []);


  const fetchDentalRecord = async (patientId, visitId) => {
    try {
      const response = await api.get(`/dental/records/${patientId}/${visitId}`);
      setDentalRecord(response.data.dentalRecord);
    } catch (error) {
      // If no dental record exists, that's okay - we'll create one
      if (error.response?.status !== 404) {
        console.error('Error fetching dental record:', error);
      }
      setDentalRecord(null);
    }
  };

  const fetchVisits = async () => {
    try {
      setLoading(true);
      const params = statusFilter !== 'all' ? { filter: statusFilter } : {};
      const response = await api.get('/doctors/queue', { params });
      setVisits(response.data.queue || []);
    } catch (error) {
      toast.error('Failed to fetch patient queue');
      console.error('Error fetching visits:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisits();
  }, [statusFilter]);

  const handlePatientSelect = async (visit) => {
    setSelectedVisit(visit);
    setShowPatientForm(true);

    // Fetch dental record if current user is a dentist
    if (currentUser?.specialty === 'dentist' || currentUser?.qualifications?.includes('Dentist')) {
      await fetchDentalRecord(visit.patientId, visit.id);
      // Expand dental section for dentists
      setExpandedSections(prev => ({ ...prev, dental: true }));
    }

    // Reset form data for new patient
    setFormData({
      // Chief Complaint & History
      chiefComplaint: '',
      historyOfPresentIllness: '',
      onsetOfSymptoms: '',
      durationOfSymptoms: '',
      severityOfSymptoms: '',
      associatedSymptoms: '',
      relievingFactors: '',
      aggravatingFactors: '',

      // Past Medical History
      pastMedicalHistory: '',
      currentMedications: '',
      knownAllergies: '',
      familyHistory: '',
      socialHistory: '',

      // Physical Examination
      generalAppearance: '',
      vitalSigns: '',
      headAndNeck: '',
      cardiovascularExam: '',
      respiratoryExam: '',
      abdominalExam: '',
      extremities: '',
      neurologicalExam: '',

      // Assessment & Plan
      primaryDiagnosis: '',
      secondaryDiagnosis: '',
      differentialDiagnosis: ''
    });

    // Fetch vitals data from nurse
    try {
      const response = await api.get(`/doctors/vitals/${visit.id}`);
      const vitalsData = response.data.vitals;

      // Auto-populate Chief Complaint & History and Physical Examination from nurse data
      setFormData(prev => ({
        ...prev,
        // Chief Complaint & History from nurse
        chiefComplaint: vitalsData.chiefComplaint || '',
        historyOfPresentIllness: vitalsData.historyOfPresentIllness || '',
        onsetOfSymptoms: vitalsData.onsetOfSymptoms || '',
        durationOfSymptoms: vitalsData.durationOfSymptoms || '',
        severityOfSymptoms: vitalsData.severityOfSymptoms || '',
        associatedSymptoms: vitalsData.associatedSymptoms || '',
        relievingFactors: vitalsData.relievingFactors || '',
        aggravatingFactors: vitalsData.aggravatingFactors || '',

        // Physical Examination from nurse
        generalAppearance: vitalsData.generalAppearance || '',
        vitalSigns: vitalsData.bloodPressure ? `BP: ${vitalsData.bloodPressure}, HR: ${vitalsData.heartRate}, Temp: ${vitalsData.temperature}°C, O2: ${vitalsData.oxygenSaturation}%` : '',
        headAndNeck: vitalsData.headAndNeck || '',
        cardiovascularExam: vitalsData.cardiovascularExam || '',
        respiratoryExam: vitalsData.respiratoryExam || '',
        abdominalExam: vitalsData.abdominalExam || '',
        extremities: vitalsData.extremities || '',
        neurologicalExam: vitalsData.neurologicalExam || ''
      }));
    } catch (error) {
      // Don't show error for 404 - just means no vitals recorded yet
      if (error.response?.status !== 404) {
        console.error('Error fetching vitals data:', error);
      }
      // Continue with empty form if vitals fetch fails
    }

    // Reset order states
    setLabOrdered(false);
    setRadiologyOrdered(false);
    setSelectedLabTests([]);
    setSelectedRadiologyTests([]);
    setLabInstructions('');
    setRadiologyInstructions('');

    // Fetch order status for this visit
    fetchOrderStatus(visit.id);
  };

  const fetchOrderStatus = async (visitId) => {
    try {
      const response = await api.get(`/doctors/order-status/${visitId}`);
      const orderData = response.data;

      setAlreadyOrderedLabTests(orderData.orderedLabTypes || []);
      setAlreadyOrderedRadiologyTests(orderData.orderedRadiologyTypes || []);
      setOrderStatus(orderData);
    } catch (error) {
      console.error('Error fetching order status:', error);
      setAlreadyOrderedLabTests([]);
      setAlreadyOrderedRadiologyTests([]);
      setOrderStatus(null);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      // Update diagnosis and instructions
      await api.put(`/doctors/visits/${selectedVisit.id}`, {
        diagnosis: formData.primaryDiagnosis,
        diagnosisDetails: formData.differentialDiagnosis,
        instructions: formData.instructions || `${formData.secondaryDiagnosis ? `Secondary: ${formData.secondaryDiagnosis}` : ''}`
      });
      toast.success('Patient information updated successfully');
      fetchVisits();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update patient information');
    }
  };

  const handleImageClick = (images, index) => {
    setCurrentImages(images);
    setCurrentImageIndex(index);
    setImageViewerOpen(true);
  };

  const handleCompleteVisit = async () => {
    try {
      // First update the visit with current form data
      await api.put(`/doctors/visits/${selectedVisit.id}`, {
        diagnosis: formData.primaryDiagnosis,
        diagnosisDetails: formData.differentialDiagnosis,
        instructions: formData.instructions || `${formData.secondaryDiagnosis ? `Secondary: ${formData.secondaryDiagnosis}` : ''}`
      });

      // Save dental chart data if it exists and hasn't been saved yet
      if (dentalChartRef.current && dentalChartRef.current.getCurrentData) {
        try {
          const currentDentalData = dentalChartRef.current.getCurrentData();
          if (currentDentalData && Object.keys(currentDentalData.toothChart || {}).length > 0) {
            const dentalData = {
              patientId: selectedVisit.patientId,
              visitId: selectedVisit.id,
              toothChart: currentDentalData.toothChart,
              painFlags: currentDentalData.painFlags || {},
              gumCondition: currentDentalData.gumCondition || '',
              oralHygiene: currentDentalData.oralHygiene || '',
              notes: currentDentalData.notes || ''
            };

            await api.post('/dental/records', dentalData);
            console.log('Dental chart saved automatically during visit completion');
          }
        } catch (dentalError) {
          console.error('Error saving dental chart during visit completion:', dentalError);
          // Don't fail the entire visit completion if dental save fails
        }
      }

      let countAsMedicalTreated = false;
      if (isDermatologyDoctor) {
        countAsMedicalTreated = window.confirm('Count this patient as Medical treated?');
      }

      // Then set status to DIRECT_COMPLETE (for medication prescription)
      await api.post('/doctors/direct-complete', {
        visitId: selectedVisit.id,
        diagnosis: formData.primaryDiagnosis,
        diagnosisDetails: formData.differentialDiagnosis,
        instructions: formData.instructions || `${formData.secondaryDiagnosis ? `Secondary: ${formData.secondaryDiagnosis}` : ''}`,
        finalNotes: formData.notes || 'Visit completed without additional tests',
        countAsMedicalTreated
      });

      toast.success('Visit consultation completed! Patient moved to Results Queue for medication prescription.');
      setShowPatientForm(false);
      setSelectedVisit(null);
      fetchVisits();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to complete visit');
    }
  };

  const handleDeleteVisit = async () => {
    if (!selectedVisit) return;

    if (!window.confirm(`Are you sure you want to delete this visit (${selectedVisit.visitUid})? This will permanently delete the visit and all associated records (lab orders, radiology orders, medications, bills, etc.). This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/doctors/visits/${selectedVisit.id}`);
      toast.success('Visit deleted successfully!');
      setShowPatientForm(false);
      setSelectedVisit(null);
      setFormData({
        diagnosis: '',
        diagnosisDetails: '',
        instructions: ''
      });
      fetchVisits();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete visit');
    }
  };

  const handlePrint = () => {
    // TODO: Implement PDF generation
    toast.success('Print functionality coming soon');
  };

  const handleViewHistory = () => {
    // TODO: Implement history modal
    toast.success('History view coming soon');
  };

  const handleLabTestToggle = (testId) => {
    setSelectedLabTests(prev =>
      prev.includes(testId)
        ? prev.filter(id => id !== testId)
        : [...prev, testId]
    );
  };

  const handleRadiologyTestToggle = (testId) => {
    setSelectedRadiologyTests(prev =>
      prev.includes(testId)
        ? prev.filter(id => id !== testId)
        : [...prev, testId]
    );
  };

  const handleSubmitOrders = async () => {
    if (selectedLabTests.length === 0 && selectedRadiologyTests.length === 0) {
      toast.error('Please select at least one lab or radiology test.');
      return;
    }

    try {
      // Submit lab orders if any
      if (selectedLabTests.length > 0) {
        const selectedLabInvestigations = selectedLabTests
          .map((testId) => labTestOptions.find((test) => test.id === testId))
          .filter(Boolean);

        if (selectedLabInvestigations.length !== selectedLabTests.length) {
          toast.error('Some selected lab tests could not be matched to active billing services. Please refresh and try again.');
          return;
        }

        const batchOrderData = {
          visitId: selectedVisit.id,
          patientId: selectedVisit.patient.id,
          type: 'LAB',
          instructions: labInstructions || 'Lab tests ordered by doctor',
          services: selectedLabInvestigations.map((test) => ({
            serviceId: String(test.serviceId || test.service?.id || ''),
            investigationTypeId: test.id,
            instructions: labInstructions || `Lab test: ${test.name}`
          }))
        };

        await api.post('/batch-orders/create', batchOrderData);

        setLabOrdered(true);
        toast.success(`${selectedLabTests.length} lab order(s) placed successfully`);
      }

      // Submit radiology orders if any
      if (selectedRadiologyTests.length > 0) {
        const selectedRadiologyInvestigations = selectedRadiologyTests
          .map((testId) => radiologyTestOptions.find((test) => test.id === testId))
          .filter(Boolean);

        if (selectedRadiologyInvestigations.length !== selectedRadiologyTests.length) {
          toast.error('Some selected radiology tests could not be matched to active billing services. Please refresh and try again.');
          return;
        }

        const batchOrderData = {
          visitId: selectedVisit.id,
          patientId: selectedVisit.patient.id,
          type: 'RADIOLOGY',
          instructions: radiologyInstructions || 'Radiology tests ordered by doctor',
          services: selectedRadiologyInvestigations.map((test) => ({
            serviceId: String(test.serviceId || test.service?.id || ''),
            investigationTypeId: test.id,
            instructions: radiologyInstructions || `Radiology test: ${test.name}`
          }))
        };

        await api.post('/batch-orders/create', batchOrderData);

        setRadiologyOrdered(true);
        toast.success(`${selectedRadiologyTests.length} radiology order(s) placed successfully`);
      }

      // Reset selections
      setSelectedLabTests([]);
      setSelectedRadiologyTests([]);
      setLabInstructions('');
      setRadiologyInstructions('');

      // Refresh the visit data
      fetchVisits();
    } catch (error) {
      console.error('Error placing orders:', error);

      if (error.response?.data?.duplicates) {
        // Show specific error for duplicate orders
        toast.error(
          <div>
            <p className="font-medium">Some tests have already been ordered:</p>
            <ul className="list-disc list-inside mt-1">
              {error.response.data.duplicates.map((test, index) => (
                <li key={index} className="text-sm">{test}</li>
              ))}
            </ul>
            <p className="text-sm mt-1">Please remove them and try again.</p>
          </div>,
          { duration: 6000 }
        );
      } else {
        toast.error(error.response?.data?.error || 'Failed to place orders.');
      }
    }
  };

  const getPriorityColor = (condition) => {
    switch (condition) {
      case 'Critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Urgent':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Stable':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Good':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'WAITING_FOR_DOCTOR':
        return 'badge-warning';
      case 'IN_PROGRESS':
        return 'badge-primary';
      case 'COMPLETED':
        return 'badge-success';
      default:
        return 'badge-secondary';
    }
  };

  const getOrderStatusColor = (status) => {
    switch (status) {
      case 'UNPAID': return 'bg-red-100 text-red-800';
      case 'PAID': return 'bg-yellow-100 text-yellow-800';
      case 'QUEUED': return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS': return 'bg-orange-100 text-orange-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
      {!showPatientForm ? (
        <>
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Patient Queue</h2>
              <p className="text-gray-600">Select a patient to begin examination</p>
            </div>
            <div className="text-sm text-gray-500">
              {visits.length} patients in queue
            </div>
          </div>

          {/* Status Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              All Patients
            </button>
            <button
              onClick={() => setStatusFilter('waiting')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'waiting'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Waiting
            </button>
            <button
              onClick={() => setStatusFilter('in_review')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'in_review'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              In Review
            </button>
            <button
              onClick={() => setStatusFilter('sent_to_billing')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'sent_to_billing'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Sent to Billing
            </button>
            <button
              onClick={() => setStatusFilter('awaiting_results')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'awaiting_results'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Awaiting Results
            </button>
          </div>

          {/* Patients List - Minimal Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visits.map((visit) => (
              <div
                key={visit.id}
                className="card cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-primary-500"
                onClick={() => handlePatientSelect(visit)}
              >
                {/* Header with ID, Name, Type, Priority, Status */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-xs font-mono text-gray-500">#{visit.patient.id}</span>
                      <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(visit.vitals?.[0]?.condition || 'Unknown')}`}>
                        {visit.vitals?.[0]?.condition || 'Unknown'}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 text-lg">{visit.patient.name}</h3>
                    <p className="text-sm text-gray-600 capitalize">{visit.patient.type?.toLowerCase() || 'Regular'}</p>
                  </div>
                  <div className="text-right">
                    <span className={`badge ${getStatusColor(visit.status)}`}>
                      {visit.status.replace(/_/g, ' ')}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(visit.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                {/* Billing Status - Keep this as requested */}
                {visit.bills && visit.bills.length > 0 && (
                  <div className="mb-3 p-2 bg-blue-50 rounded">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-medium text-blue-800">Billing Status</span>
                      <div className="flex space-x-2">
                        {visit.bills.map((bill) => (
                          <span key={bill.id} className={`text-xs px-2 py-1 rounded ${bill.status === 'PAID' ? 'bg-green-100 text-green-800' :
                            bill.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                            {bill.status} - ETB {bill.totalAmount}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick Vitals Summary */}
                {visit.vitals && visit.vitals.length > 0 && (
                  <div className="mb-3 text-xs text-gray-600">
                    <span className="font-medium">Vitals:</span>
                    BP {visit.vitals[0].bloodPressure} |
                    Temp {visit.vitals[0].temperature}°C |
                    HR {visit.vitals[0].heartRate} bpm
                  </div>
                )}

                {/* Action Button */}
                <div className="flex justify-end">
                  <button className="btn btn-primary btn-sm flex items-center">
                    <Eye className="h-4 w-4 mr-1" />
                    View Form
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* Detailed Patient Form View */
        <div className="space-y-6">
          {/* Form Header */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Patient Examination - {selectedVisit.patient.name}
              </h2>
              <p className="text-gray-600">ID: {selectedVisit.patient.id} | Visit: {selectedVisit.visitUid}</p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handlePrint}
                className="btn btn-secondary btn-sm flex items-center"
              >
                <Printer className="h-4 w-4 mr-1" />
                Print
              </button>
              <button
                onClick={handleViewHistory}
                className="btn btn-secondary btn-sm flex items-center"
              >
                <History className="h-4 w-4 mr-1" />
                History
              </button>
              <button
                onClick={() => setShowPatientForm(false)}
                className="btn btn-outline btn-sm"
              >
                Back to Queue
              </button>
            </div>
          </div>

          {/* Patient Form */}
          <form onSubmit={handleFormSubmit} className="space-y-6">
            {/* Vitals Section */}
            <div className="card">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleSection('vitals')}
              >
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Stethoscope className="h-5 w-5 mr-2" />
                  Vitals & Assessment
                </h3>
                {expandedSections.vitals ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </div>
              {expandedSections.vitals && selectedVisit.vitals && selectedVisit.vitals.length > 0 && (
                <div className="mt-4 space-y-4">
                  {/* Primary Vitals */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <p className="text-sm text-gray-600">Blood Pressure</p>
                      <p className="font-semibold">{selectedVisit.vitals[0].bloodPressure || 'N/A'}</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <p className="text-sm text-gray-600">Temperature</p>
                      <p className="font-semibold">{selectedVisit.vitals[0].temperature ? `${selectedVisit.vitals[0].temperature}°C` : 'N/A'}</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <p className="text-sm text-gray-600">Heart Rate</p>
                      <p className="font-semibold">{selectedVisit.vitals[0].heartRate ? `${selectedVisit.vitals[0].heartRate} bpm` : 'N/A'}</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded">
                      <p className="text-sm text-gray-600">BMI</p>
                      <p className="font-semibold">{selectedVisit.vitals[0].bmi ? selectedVisit.vitals[0].bmi.toFixed(1) : 'N/A'}</p>
                    </div>
                  </div>

                  {/* Additional Vitals */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded">
                      <p className="text-sm text-gray-600">Height</p>
                      <p className="font-semibold">{selectedVisit.vitals[0].height ? `${selectedVisit.vitals[0].height} cm` : 'N/A'}</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded">
                      <p className="text-sm text-gray-600">Weight</p>
                      <p className="font-semibold">{selectedVisit.vitals[0].weight ? `${selectedVisit.vitals[0].weight} kg` : 'N/A'}</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded">
                      <p className="text-sm text-gray-600">Oxygen Saturation</p>
                      <p className="font-semibold">{selectedVisit.vitals[0].oxygenSaturation ? `${selectedVisit.vitals[0].oxygenSaturation}%` : 'N/A'}</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded">
                      <p className="text-sm text-gray-600">Respiration Rate</p>
                      <p className="font-semibold">{selectedVisit.vitals[0].respirationRate ? `${selectedVisit.vitals[0].respirationRate} bpm` : 'N/A'}</p>
                    </div>
                  </div>

                  {/* Condition and Notes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-green-50 rounded">
                      <p className="text-sm text-gray-600">Condition</p>
                      <p className="font-semibold text-green-800">{selectedVisit.vitals[0].condition || 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded">
                      <p className="text-sm text-gray-600">Notes</p>
                      <p className="font-semibold text-yellow-800">{selectedVisit.vitals[0].notes || 'No notes'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chief Complaint Section */}
            <div className="card">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleSection('chiefComplaint')}
              >
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Chief Complaint & History
                </h3>
                {expandedSections.chiefComplaint ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </div>
              {expandedSections.chiefComplaint && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="label">Chief Complaint *</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.chiefComplaint}
                      onChange={(e) => setFormData({ ...formData, chiefComplaint: e.target.value })}
                      placeholder="Primary reason for visit (e.g., chest pain, headache, fever)"
                    />
                  </div>
                  <div>
                    <label className="label">History of Present Illness *</label>
                    <textarea
                      className="input"
                      rows="4"
                      value={formData.historyOfPresentIllness}
                      onChange={(e) => setFormData({ ...formData, historyOfPresentIllness: e.target.value })}
                      placeholder="Detailed description of current symptoms, when they started, how they've progressed"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Onset of Symptoms</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.onsetOfSymptoms}
                        onChange={(e) => setFormData({ ...formData, onsetOfSymptoms: e.target.value })}
                        placeholder="e.g., Sudden, Gradual, After trauma"
                      />
                    </div>
                    <div>
                      <label className="label">Duration</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.durationOfSymptoms}
                        onChange={(e) => setFormData({ ...formData, durationOfSymptoms: e.target.value })}
                        placeholder="e.g., 2 hours, 3 days, 1 week"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Severity (1-10 scale)</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.severityOfSymptoms}
                        onChange={(e) => setFormData({ ...formData, severityOfSymptoms: e.target.value })}
                        placeholder="e.g., 7/10, Moderate, Severe"
                      />
                    </div>
                    <div>
                      <label className="label">Associated Symptoms</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.associatedSymptoms}
                        onChange={(e) => setFormData({ ...formData, associatedSymptoms: e.target.value })}
                        placeholder="e.g., nausea, dizziness, shortness of breath"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Relieving Factors</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.relievingFactors}
                        onChange={(e) => setFormData({ ...formData, relievingFactors: e.target.value })}
                        placeholder="e.g., rest, medication, position"
                      />
                    </div>
                    <div>
                      <label className="label">Aggravating Factors</label>
                      <input
                        type="text"
                        className="input"
                        value={formData.aggravatingFactors}
                        onChange={(e) => setFormData({ ...formData, aggravatingFactors: e.target.value })}
                        placeholder="e.g., movement, stress, certain foods"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Medical History Section */}
            <div className="card">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleSection('history')}
              >
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Medical History
                </h3>
                {expandedSections.history ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </div>
              {expandedSections.history && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="label">Past Medical History</label>
                    <textarea
                      className="input"
                      rows="3"
                      value={formData.pastMedicalHistory}
                      onChange={(e) => setFormData({ ...formData, pastMedicalHistory: e.target.value })}
                      placeholder="Previous illnesses, surgeries, hospitalizations, chronic conditions"
                    />
                  </div>
                  <div>
                    <label className="label">Current Medications</label>
                    <textarea
                      className="input"
                      rows="3"
                      value={formData.currentMedications}
                      onChange={(e) => setFormData({ ...formData, currentMedications: e.target.value })}
                      placeholder="List all current medications with dosages and frequency"
                    />
                  </div>
                  <div>
                    <label className="label">Known Allergies</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.knownAllergies}
                      onChange={(e) => setFormData({ ...formData, knownAllergies: e.target.value })}
                      placeholder="Drug allergies, food allergies, environmental allergies"
                    />
                  </div>
                  <div>
                    <label className="label">Family History</label>
                    <textarea
                      className="input"
                      rows="3"
                      value={formData.familyHistory}
                      onChange={(e) => setFormData({ ...formData, familyHistory: e.target.value })}
                      placeholder="Relevant family medical history (diabetes, heart disease, cancer, etc.)"
                    />
                  </div>
                  <div>
                    <label className="label">Social History</label>
                    <textarea
                      className="input"
                      rows="3"
                      value={formData.socialHistory}
                      onChange={(e) => setFormData({ ...formData, socialHistory: e.target.value })}
                      placeholder="Smoking, alcohol, drug use, occupation, exercise habits, living situation"
                    />
                  </div>
                </div>
              )}
            </div>


            {/* Physical Examination Section */}
            <div className="card">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleSection('physicalExam')}
              >
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Stethoscope className="h-5 w-5 mr-2" />
                  Physical Examination
                </h3>
                {expandedSections.physicalExam ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </div>
              {expandedSections.physicalExam && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="label">General Appearance</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.generalAppearance}
                      onChange={(e) => setFormData({ ...formData, generalAppearance: e.target.value })}
                      placeholder="Overall appearance, distress level, alertness, cooperation"
                    />
                  </div>
                  <div>
                    <label className="label">Vital Signs</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.vitalSigns}
                      onChange={(e) => setFormData({ ...formData, vitalSigns: e.target.value })}
                      placeholder="BP, HR, RR, Temp, O2 Sat (if different from recorded vitals)"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Head & Neck</label>
                      <textarea
                        className="input"
                        rows="3"
                        value={formData.headAndNeck}
                        onChange={(e) => setFormData({ ...formData, headAndNeck: e.target.value })}
                        placeholder="Eyes, ears, nose, throat, lymph nodes"
                      />
                    </div>
                    <div>
                      <label className="label">Cardiovascular</label>
                      <textarea
                        className="input"
                        rows="3"
                        value={formData.cardiovascularExam}
                        onChange={(e) => setFormData({ ...formData, cardiovascularExam: e.target.value })}
                        placeholder="Heart sounds, murmurs, pulses, JVD"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Respiratory</label>
                      <textarea
                        className="input"
                        rows="3"
                        value={formData.respiratoryExam}
                        onChange={(e) => setFormData({ ...formData, respiratoryExam: e.target.value })}
                        placeholder="Lung sounds, chest expansion, percussion"
                      />
                    </div>
                    <div>
                      <label className="label">Abdomen</label>
                      <textarea
                        className="input"
                        rows="3"
                        value={formData.abdominalExam}
                        onChange={(e) => setFormData({ ...formData, abdominalExam: e.target.value })}
                        placeholder="Inspection, palpation, percussion, auscultation"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Extremities</label>
                      <textarea
                        className="input"
                        rows="3"
                        value={formData.extremities}
                        onChange={(e) => setFormData({ ...formData, extremities: e.target.value })}
                        placeholder="Edema, pulses, range of motion, deformities"
                      />
                    </div>
                    <div>
                      <label className="label">Neurological</label>
                      <textarea
                        className="input"
                        rows="3"
                        value={formData.neurologicalExam}
                        onChange={(e) => setFormData({ ...formData, neurologicalExam: e.target.value })}
                        placeholder="Mental status, cranial nerves, motor, sensory, reflexes"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Assessment & Plan Section */}
            <div className="card">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleSection('assessment')}
              >
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Assessment & Plan
                </h3>
                {expandedSections.assessment ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </div>
              {expandedSections.assessment && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="label">Primary Diagnosis *</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.primaryDiagnosis}
                      onChange={(e) => setFormData({ ...formData, primaryDiagnosis: e.target.value })}
                      placeholder="Main diagnosis (e.g., Acute Myocardial Infarction, Hypertension)"
                    />
                  </div>
                  <div>
                    <label className="label">Secondary Diagnosis</label>
                    <input
                      type="text"
                      className="input"
                      value={formData.secondaryDiagnosis}
                      onChange={(e) => setFormData({ ...formData, secondaryDiagnosis: e.target.value })}
                      placeholder="Additional diagnoses or comorbidities"
                    />
                  </div>
                  <div>
                    <label className="label">Differential Diagnosis</label>
                    <textarea
                      className="input"
                      rows="3"
                      value={formData.differentialDiagnosis}
                      onChange={(e) => setFormData({ ...formData, differentialDiagnosis: e.target.value })}
                      placeholder="Other possible diagnoses to consider"
                    />
                  </div>
                </div>
              )}
            </div>


            {/* Dental Chart Section - Only for Dentists */}
            {(currentUser?.specialty === 'dentist' || currentUser?.qualifications?.includes('Dentist')) && (
              <div className="card">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleSection('dental')}
                >
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Circle className="h-5 w-5 mr-2" />
                    Dental Chart
                  </h3>
                  {expandedSections.dental ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </div>
                {expandedSections.dental && (
                  <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
                    <DentalChart
                      ref={dentalChartRef}
                      patientId={selectedVisit?.patientId}
                      visitId={selectedVisit?.id}
                      doctorId={currentUser?.id}
                      initialData={dentalRecord}
                      onSave={(record) => setDentalRecord(record)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Attached Images Section */}
            <div className="card">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleSection('attachedImages')}
              >
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Upload className="h-5 w-5 mr-2" />
                  Patient Attached Images
                </h3>
                {expandedSections.attachedImages ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </div>
              {expandedSections.attachedImages && selectedVisit && (
                <div className="mt-4">
                  <PatientAttachedImagesSection
                    visitId={selectedVisit.id}
                    patientId={selectedVisit.patientId}
                    title="Medical Documents from Other Hospitals"
                    canUpload={false}
                    onImageClick={handleImageClick}
                    imageViewerOpen={imageViewerOpen}
                    setImageViewerOpen={setImageViewerOpen}
                  />
                </div>
              )}
            </div>

            {/* Before Photos Section - Only for Dentists */}
            {(currentUser?.specialty === 'dentist' || currentUser?.qualifications?.includes('Dentist')) && (
              <div className="card">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleSection('beforePhotos')}
                >
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Camera className="h-5 w-5 mr-2" />
                    Before Photos
                  </h3>
                  {expandedSections.beforePhotos ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </div>
                {expandedSections.beforePhotos && selectedVisit && (
                  <div className="mt-4">
                    <DentalPhotosSection
                      visitId={selectedVisit.id}
                      patientId={selectedVisit.patientId}
                      photoType="BEFORE"
                      title="Before Treatment Photos"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Orders Section */}
            <div className="card">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleSection('orders')}
              >
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <TestTube className="h-5 w-5 mr-2" />
                  Lab & Radiology Orders
                </h3>
                {expandedSections.orders ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </div>
              {expandedSections.orders && (
                <div className="mt-4 space-y-6">
                  {/* Lab and Radiology Orders - Side by Side */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Lab Orders Section */}
                    <div className="border rounded-lg p-4">
                      <h5 className="font-medium text-gray-700 mb-3 flex items-center">
                        <TestTube className="h-4 w-4 mr-2" />
                        Lab Orders
                      </h5>

                      {/* Multiple Lab Test Selection */}
                      <div className="mb-4">
                        <label className="label">Select Lab Tests (Multiple Selection)</label>
                        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border rounded p-3">
                          {labTestOptions.map((test) => {
                            const isAlreadyOrdered = alreadyOrderedLabTests.includes(test.id);
                            const isSelected = selectedLabTests.includes(test.id);

                            return (
                              <label key={test.id} className={`flex items-center space-x-2 p-2 rounded ${isAlreadyOrdered ? 'cursor-not-allowed opacity-60 bg-gray-100' : 'cursor-pointer hover:bg-gray-50'}`}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => !isAlreadyOrdered && handleLabTestToggle(test.id)}
                                  disabled={isAlreadyOrdered}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                                />
                                <span className={`text-sm ${isAlreadyOrdered ? 'text-gray-500' : ''}`}>
                                  {test.name} - ETB {test.price}
                                  {isAlreadyOrdered && (
                                    <span className="ml-2 text-xs text-green-600 font-medium">
                                      ✓ Already Ordered
                                    </span>
                                  )}
                                </span>
                              </label>
                            );
                          })}
                        </div>

                        {selectedLabTests.length > 0 && (
                          <div className="mt-3 p-3 bg-blue-50 rounded">
                            <p className="text-sm font-medium text-blue-800">
                              Selected: {selectedLabTests.length} test(s) -
                              Total: ETB {selectedLabTests.reduce((sum, testId) => {
                                const test = labTestOptions.find(t => t.id === testId);
                                return sum + (test ? test.price : 0);
                              }, 0)}
                            </p>
                          </div>
                        )}

                        <div className="mt-3">
                          <label className="label">Instructions for all selected tests</label>
                          <textarea
                            className="input"
                            rows="2"
                            placeholder="Special instructions for all selected lab tests..."
                            value={labInstructions}
                            onChange={(e) => setLabInstructions(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Radiology Orders Section */}
                    <div className="border rounded-lg p-4">
                      <h5 className="font-medium text-gray-700 mb-3 flex items-center">
                        <Scan className="h-4 w-4 mr-2" />
                        Radiology Orders
                      </h5>

                      {/* Multiple Radiology Test Selection */}
                      <div className="mb-4">
                        <label className="label">Select Radiology Tests (Multiple Selection)</label>
                        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border rounded p-3">
                          {radiologyTestOptions.map((test) => {
                            const isAlreadyOrdered = alreadyOrderedRadiologyTests.includes(test.id);
                            const isSelected = selectedRadiologyTests.includes(test.id);

                            return (
                              <label key={test.id} className={`flex items-center space-x-2 p-2 rounded ${isAlreadyOrdered ? 'cursor-not-allowed opacity-60 bg-gray-100' : 'cursor-pointer hover:bg-gray-50'}`}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => !isAlreadyOrdered && handleRadiologyTestToggle(test.id)}
                                  disabled={isAlreadyOrdered}
                                  className="rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50"
                                />
                                <span className={`text-sm ${isAlreadyOrdered ? 'text-gray-500' : ''}`}>
                                  {test.name} - ETB {test.price}
                                  {isAlreadyOrdered && (
                                    <span className="ml-2 text-xs text-green-600 font-medium">
                                      ✓ Already Ordered
                                    </span>
                                  )}
                                </span>
                              </label>
                            );
                          })}
                        </div>

                        {selectedRadiologyTests.length > 0 && (
                          <div className="mt-3 p-3 bg-green-50 rounded">
                            <p className="text-sm font-medium text-green-800">
                              Selected: {selectedRadiologyTests.length} test(s) -
                              Total: ETB {selectedRadiologyTests.reduce((sum, testId) => {
                                const test = radiologyTestOptions.find(t => t.id === testId);
                                return sum + (test ? test.price : 0);
                              }, 0)}
                            </p>
                          </div>
                        )}

                        <div className="mt-3">
                          <label className="label">Instructions for all selected tests</label>
                          <textarea
                            className="input"
                            rows="2"
                            placeholder="Special instructions for all selected radiology tests..."
                            value={radiologyInstructions}
                            onChange={(e) => setRadiologyInstructions(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Combined Order Button */}
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleSubmitOrders}
                      disabled={selectedLabTests.length === 0 && selectedRadiologyTests.length === 0}
                      className={`btn btn-lg ${selectedLabTests.length === 0 && selectedRadiologyTests.length === 0
                        ? 'btn-secondary'
                        : 'btn-primary'
                        }`}
                    >
                      {selectedLabTests.length > 0 && selectedRadiologyTests.length > 0
                        ? 'Order Lab & Radiology Tests'
                        : selectedLabTests.length > 0
                          ? 'Order Lab Tests'
                          : selectedRadiologyTests.length > 0
                            ? 'Order Radiology Tests'
                            : 'Select Tests to Order'
                      }
                    </button>
                  </div>

                  {/* Current Order Status */}
                  {orderStatus && (orderStatus.labOrders.length > 0 || orderStatus.radiologyOrders.length > 0 || orderStatus.batchOrders.length > 0) && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center mb-3">
                        <FileText className="h-5 w-5 text-blue-500 mr-2" />
                        <span className="text-blue-800 font-medium">Current Order Status</span>
                      </div>

                      {orderStatus.labOrders.length > 0 && (
                        <div className="mb-3">
                          <h4 className="text-sm font-medium text-blue-700 mb-2">Lab Orders:</h4>
                          <div className="space-y-1">
                            {orderStatus.labOrders.map(order => (
                              <div key={order.id} className="flex justify-between items-center text-sm">
                                <span className="text-blue-600">{order.typeName}</span>
                                <span className={`px-2 py-1 rounded text-xs ${getOrderStatusColor(order.status)}`}>
                                  {order.status.replace(/_/g, ' ')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {orderStatus.radiologyOrders.length > 0 && (
                        <div className="mb-3">
                          <h4 className="text-sm font-medium text-blue-700 mb-2">Radiology Orders:</h4>
                          <div className="space-y-1">
                            {orderStatus.radiologyOrders.map(order => (
                              <div key={order.id} className="flex justify-between items-center text-sm">
                                <span className="text-blue-600">{order.typeName}</span>
                                <span className={`px-2 py-1 rounded text-xs ${getOrderStatusColor(order.status)}`}>
                                  {order.status.replace(/_/g, ' ')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {orderStatus.batchOrders.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-blue-700 mb-2">Batch Orders:</h4>
                          <div className="space-y-1">
                            {orderStatus.batchOrders.map(batchOrder => (
                              <div key={batchOrder.id} className="flex justify-between items-center text-sm">
                                <span className="text-blue-600">
                                  {batchOrder.type} ({batchOrder.services.length} services)
                                </span>
                                <span className={`px-2 py-1 rounded text-xs ${getOrderStatusColor(batchOrder.status)}`}>
                                  {batchOrder.status.replace(/_/g, ' ')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Order Status */}
                  {(labOrdered || radiologyOrdered) && (
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                        <div>
                          <p className="font-medium text-green-800">Orders Submitted Successfully</p>
                          <p className="text-sm text-green-600">
                            {labOrdered && radiologyOrdered
                              ? 'Lab and radiology orders have been sent to their respective departments.'
                              : labOrdered
                                ? 'Lab orders have been sent to the lab department.'
                                : 'Radiology orders have been sent to the radiology department.'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowPatientForm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
              >
                Save & Continue
              </button>
              <button
                type="button"
                onClick={handleCompleteVisit}
                className="btn btn-success"
              >
                Complete Visit
              </button>
              <button
                type="button"
                onClick={handleDeleteVisit}
                className="btn btn-error"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Visit
              </button>
            </div>
          </form>
        </div>
      )}


      {/* Image Viewer Modal */}
      <ImageViewer
        isOpen={imageViewerOpen}
        onClose={() => setImageViewerOpen(false)}
        images={currentImages}
        currentIndex={currentImageIndex}
      />
    </div>
  );
};

export default PatientQueue;
