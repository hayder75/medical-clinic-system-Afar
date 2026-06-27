import React, { useState, useEffect } from 'react';
import { FileText, TestTube, Scan, CheckCircle, Clock, User, Calendar, Eye, AlertTriangle, Image, Download } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import EnhancedPrescription from './EnhancedPrescription';
import ImageViewer from '../common/ImageViewer';
import DentalChartDisplay from '../common/DentalChartDisplay';
import { getImageUrl } from '../../utils/imageUrl';

// Component to display detailed lab results
const LabResultsDisplay = ({ batchOrder }) => {
  const [detailedResults, setDetailedResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDetailedResults();
  }, [batchOrder.id]);

  const fetchDetailedResults = async () => {
    try {
      const response = await api.get(`/labs/orders/${batchOrder.id}/detailed-results`);
      console.log('Lab results response:', response.data);
      setDetailedResults(response.data.detailedResults || []);
    } catch (error) {
      console.error('Error fetching detailed lab results:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (detailedResults.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <TestTube className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Lab Results</h3>
              <p className="text-sm text-gray-600">No detailed results available</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="text-center py-8">
            <TestTube className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Detailed lab results are not available for this test.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TestTube className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Laboratory Results</h3>
              <p className="text-sm text-gray-600">
                {detailedResults.length} test{detailedResults.length > 1 ? 's' : ''} completed
              </p>
            </div>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-4 w-4 mr-1" />
            Completed
          </span>
        </div>
      </div>

      {/* Individual Test Results */}
      <div className="p-6 space-y-6">
        {detailedResults.map((result, index) => (
          <div key={result.id} className="border border-gray-200 rounded-lg p-5 bg-gray-50">
            {/* Test Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <h4 className="text-lg font-semibold text-gray-900">
                  {result.template?.name || 'Laboratory Test'}
                </h4>
              </div>
              <span className="text-sm text-gray-500">
                Test #{index + 1}
              </span>
            </div>

            {/* Test Results */}
            <div className="space-y-4">
              {/* Detailed Results */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                  <FileText className="h-4 w-4 mr-2 text-gray-500" />
                  Test Results
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(result.results)
                    .filter(([key, value]) => {
                      // CBC: Hide additional fields (MCV, MCH, MCHC) if none are filled
                      const isCBCAdditional = ['mcv', 'mch', 'mchc'].includes(key.toLowerCase());
                      if (isCBCAdditional) {
                        // Check if any additional field has a value
                        const hasAdditional = result.results?.mcv || result.results?.mch || result.results?.mchc;
                        return hasAdditional;
                      }
                      return true;
                    })
                    .map(([key, value]) => {
                      // Show dash for blank/empty values
                      const displayValue = (value === null || value === undefined || value === '' || String(value).trim() === '') 
                        ? '-' 
                        : value;
                      
                      return (
                        <div key={key} className="flex flex-col space-y-1 p-3 bg-gray-50 rounded-lg">
                          <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          <span className={`text-sm font-semibold ${displayValue === '-' ? 'text-gray-400' : 'text-gray-900'}`}>
                            {displayValue}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
              
              {/* Additional Notes */}
              {result.additionalNotes && (
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-gray-500" />
                    Additional Notes
                  </h5>
                  <p className="text-gray-700 leading-relaxed">
                    {result.additionalNotes}
                  </p>
                </div>
              )}

              {/* Verification Info */}
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="flex items-center space-x-2 text-sm text-blue-700">
                  <CheckCircle className="h-4 w-4" />
                  <span>Verified by: Lab Technician</span>
                  <span>•</span>
                  <span>{new Date(result.verifiedAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Component to display per-test radiology results
const RadiologyResultsDisplay = ({ batchOrder, onImageClick }) => {
  const [radiologyResults, setRadiologyResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRadiologyResults();
  }, [batchOrder.id]);

  const fetchRadiologyResults = async () => {
    try {
      const response = await api.get(`/radiologies/batch-orders/${batchOrder.id}/results`);
      console.log('Radiology results response:', response.data);
      setRadiologyResults(response.data.radiologyResults || []);
      
      // Debug: Check if any results have attachments
      const results = response.data.radiologyResults || [];
      console.log('🔍 All radiology results:', results);
      results.forEach((result, index) => {
        console.log(`🔍 Result ${index}:`, {
          testType: result.testType?.name,
          attachments: result.attachments,
          attachmentsLength: result.attachments?.length,
          hasAttachments: !!result.attachments && result.attachments.length > 0
        });
      });
    } catch (error) {
      console.error('Error fetching radiology results:', error);
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  // If we have individual results, show them in a professional format
  if (radiologyResults.length > 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Scan className="h-6 w-6 text-blue-600" />
        </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Radiology Results</h3>
                <p className="text-sm text-gray-600">
                  {radiologyResults.length} test{radiologyResults.length > 1 ? 's' : ''} completed
                </p>
          </div>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              <CheckCircle className="h-4 w-4 mr-1" />
              Completed
            </span>
          </div>
        </div>

        {/* Individual Test Results */}
        <div className="p-6 space-y-6">
          {radiologyResults.map((result, index) => (
            <div key={result.id} className="border border-gray-200 rounded-lg p-5 bg-gray-50">
              {/* Test Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <h4 className="text-lg font-semibold text-gray-900">
                    {result.testType?.name || 'Radiology Test'}
                  </h4>
                </div>
                <span className="text-sm text-gray-500">
                  Test #{index + 1}
                    </span>
                  </div>

              {/* Test Results */}
              <div className="space-y-4">
                {/* Clinical Indication Section */}
                {result.clinicalIndication && (
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-gray-500" />
                      Clinical Indication
                    </h5>
                    <p className="text-gray-900 leading-relaxed text-base whitespace-pre-wrap">
                      {result.clinicalIndication}
                    </p>
                  </div>
                )}

                {/* Technique Section */}
                {result.technique && (
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-gray-500" />
                      Technique
                    </h5>
                    <p className="text-gray-900 leading-relaxed text-base whitespace-pre-wrap">
                      {result.technique}
                    </p>
                  </div>
                )}

                {/* Comparison Section */}
                {result.comparison && (
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-gray-500" />
                      Comparison
                    </h5>
                    <p className="text-gray-900 leading-relaxed text-base whitespace-pre-wrap">
                      {result.comparison}
                    </p>
                  </div>
                )}

                {/* Findings Section */}
                {result.findings && (
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-gray-500" />
                      Findings
                    </h5>
                    <p className="text-gray-900 leading-relaxed text-base whitespace-pre-wrap">
                      {result.findings}
                    </p>
                  </div>
                )}

                {/* Conclusion Section */}
                {result.conclusion && (
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-gray-500" />
                      Conclusion
                    </h5>
                    <p className="text-gray-900 leading-relaxed text-base whitespace-pre-wrap">
                      {result.conclusion}
                    </p>
                  </div>
                )}

                {/* Recommendations Section */}
                {result.recommendations && (
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-gray-500" />
                      Recommendations
                    </h5>
                    <p className="text-gray-900 leading-relaxed text-base whitespace-pre-wrap">
                      {result.recommendations}
                    </p>
                  </div>
                )}

                {/* Result Text (for backward compatibility) */}
                {result.resultText && (
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-gray-500" />
                      Test Result
                    </h5>
                    <p className="text-gray-900 leading-relaxed text-base">
                      {result.resultText}
                    </p>
                  </div>
                )}

                {/* Attached Images */}
                {console.log('🔍 Checking attachments for result:', result.testType?.name, 'attachments:', result.attachments)}
                {result.attachments && result.attachments.length > 0 ? (
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <h5 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                      <Image className="h-4 w-4 mr-2 text-gray-500" />
                      Attached Images ({result.attachments.length})
                    </h5>
                    {console.log('🖼️ Rendering images for result:', result.testType?.name, 'with', result.attachments.length, 'attachments')}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {result.attachments.map((file, fileIndex) => (
                    <div key={fileIndex} className="relative group">
                          <div className="bg-gray-100 rounded-lg overflow-hidden">
                      <img 
                        src={getImageUrl(file.fileUrl)} 
                              alt={file.fileName || 'Radiology image'} 
                              className="w-full h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('🖼️ Image clicked directly!', { 
                                  attachments: result.attachments, 
                                  fileIndex,
                                  hasAttachments: !!result.attachments,
                                  attachmentsLength: result.attachments?.length
                                });
                                onImageClick(file, result.attachments, fileIndex);
                              }}
                            />
                          </div>
                          
                          {/* Clickable Eye Icon Button */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log('👁️ Eye button clicked!', { 
                                attachments: result.attachments, 
                                fileIndex,
                                hasAttachments: !!result.attachments,
                                attachmentsLength: result.attachments?.length
                              });
                              onImageClick(file, result.attachments, fileIndex);
                            }}
                            className="absolute top-2 right-2 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full p-2 shadow-lg transition-all duration-200 opacity-0 group-hover:opacity-100 hover:scale-110"
                            title="View full screen"
                          >
                            <Eye className="h-5 w-5 text-gray-700" />
                          </button>
                          <div className="mt-3">
                            <p className="text-sm text-gray-700 font-medium truncate">
                              {file.fileName || 'Radiology Image'}
                            </p>
                            
                            {/* View Full Screen Button */}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('🔍 View button clicked!', { 
                                  attachments: result.attachments, 
                                  fileIndex,
                                  hasAttachments: !!result.attachments,
                                  attachmentsLength: result.attachments?.length
                                });
                                onImageClick(file, result.attachments, fileIndex);
                              }}
                              className="mt-2 w-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-1"
                            >
                              <Eye className="h-4 w-4" />
                              <span>View Full Screen</span>
                            </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 text-sm">
                  No images attached to this result
                </p>
                <p className="text-yellow-600 text-xs mt-1">
                  Attachments: {JSON.stringify(result.attachments)}
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
        </div>
      </div>
    );
  }

  // Fallback for old format (should not happen with new system)
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Scan className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Radiology Tests</h3>
              <p className="text-sm text-gray-600">Legacy format - results pending</p>
            </div>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            Processing
          </span>
        </div>
      </div>
      
      <div className="p-6">
        <div className="text-center py-8">
          <Scan className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Individual test results are being processed...</p>
        </div>
      </div>
    </div>
  );
};

const ResultsQueue = () => {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [showResultsForm, setShowResultsForm] = useState(false);
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentImages, setCurrentImages] = useState([]);

  // Debug: Monitor state changes
  useEffect(() => {
    console.log('🔄 ImageViewer state changed:', { imageViewerOpen, currentImages: currentImages.length, currentImageIndex });
  }, [imageViewerOpen, currentImages, currentImageIndex]);
  const [formData, setFormData] = useState({
    diagnosis: '',
    diagnosisDetails: '',
    instructions: '',
    medications: []
  });
  const [newMedicationOrder, setNewMedicationOrder] = useState({
    name: '',
    dosageForm: '',
    strength: '',
    quantity: '',
    frequency: '',
    duration: '',
    instructions: ''
  });

  useEffect(() => {
    fetchResultsQueue();
  }, []);

  const fetchResultsQueue = async () => {
    try {
      setLoading(true);
      const response = await api.get('/doctors/results-queue');
      setVisits(response.data.queue || []);
    } catch (error) {
      toast.error('Failed to fetch results queue');
      console.error('Error fetching results queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVisitSelect = (visit) => {
    setSelectedVisit(visit);
    setShowResultsForm(true);
    setFormData({
      diagnosis: visit.diagnosis || '',
      diagnosisDetails: visit.diagnosisDetails || '',
      instructions: visit.instructions || '',
      medications: visit.medicationOrders || []
    });
  };

  const handleMedicationOrder = async (e) => {
    e.preventDefault();
    
    if (!newMedicationOrder.name || !newMedicationOrder.dosageForm || !newMedicationOrder.strength) {
      toast.error('Please fill in all required medication fields');
      return;
    }

    try {
      const orderPayload = {
        visitId: selectedVisit.id,
        patientId: selectedVisit.patient.id,
        name: newMedicationOrder.name,
        dosageForm: newMedicationOrder.dosageForm,
        strength: newMedicationOrder.strength,
        quantity: parseInt(newMedicationOrder.quantity) || 0,
        frequency: newMedicationOrder.frequency,
        duration: newMedicationOrder.duration,
        instructions: newMedicationOrder.instructions
      };

      await api.post('/doctors/medication-orders', orderPayload);
      toast.success('Medication order added successfully');
      
      setNewMedicationOrder({
        name: '',
        dosageForm: '',
        strength: '',
        quantity: '',
        frequency: '',
        duration: '',
        instructions: ''
      });
      
      fetchResultsQueue();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create medication order');
    }
  };

  const handlePrescriptionSubmit = () => {
    setShowPrescriptionForm(false);
    fetchResultsQueue();
  };

  const handleImageClick = (image, allImages, index) => {
    console.log('🖼️ Image clicked!', { image, allImages, index });
    console.log('🖼️ Single image:', image);
    console.log('🖼️ All images array:', allImages);
    console.log('🖼️ Current index:', index);
    
    console.log('🖼️ Setting state...');
    setCurrentImages(allImages); // Pass all images for navigation
    setCurrentImageIndex(index); // Set the clicked image index
    setImageViewerOpen(true);
    
    console.log('🖼️ State set - should trigger useEffect');
    
    // Force a re-render by updating state again
    setTimeout(() => {
      console.log('🖼️ Delayed state check:', { imageViewerOpen, currentImages: currentImages.length, currentImageIndex });
    }, 100);
  };


  const handleCompleteVisit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/doctors/complete', {
        visitId: selectedVisit.id,
        diagnosis: formData.diagnosis,
        diagnosisDetails: formData.diagnosisDetails,
        instructions: formData.instructions
      });

      toast.success('Visit completed successfully!');
      setShowResultsForm(false);
      setSelectedVisit(null);
      fetchResultsQueue();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to complete visit');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!showResultsForm ? (
        <>
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Results Queue</h2>
              <p className="text-gray-600">Patients with completed investigations ready for review</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                {visits.length} patients with results ready
              </div>
            </div>
          </div>

          {/* Results List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visits.map((visit) => (
              <div 
                key={visit.id} 
                className="card cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-green-500"
                onClick={() => handleVisitSelect(visit)}
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
                    <div className="flex flex-col space-y-1">
                      {visit.resultLabels?.map((label, index) => (
                        <span key={index} className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                          {label}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(visit.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                {/* Results Summary */}
                <div className="mb-3 p-2 bg-green-50 rounded">
                  <div className="text-sm text-green-800">
                    <span className="font-medium">Results Available:</span>
                    <div className="mt-1 space-y-1">
                      {visit.batchOrders?.some(order => order.type === 'LAB' && order.status === 'COMPLETED') && (
                        <div className="flex items-center text-xs">
                          <TestTube className="h-3 w-3 mr-1" />
                          Lab Results ({visit.batchOrders.filter(o => o.type === 'LAB' && o.status === 'COMPLETED').length})
                        </div>
                      )}
                      {visit.batchOrders?.some(order => order.type === 'RADIOLOGY' && order.status === 'COMPLETED') && (
                        <div className="flex items-center text-xs">
                          <Scan className="h-3 w-3 mr-1" />
                          Radiology Results ({visit.batchOrders.filter(o => o.type === 'RADIOLOGY' && o.status === 'COMPLETED').length})
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex justify-end">
                  <button className="btn btn-primary btn-sm flex items-center">
                    <Eye className="h-4 w-4 mr-1" />
                    Review Results
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* Results Review Form */
        <div className="space-y-6">
          {/* Form Header */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Review Results - {selectedVisit.patient.name}
              </h2>
              <p className="text-gray-600">ID: {selectedVisit.patient.id} | Visit: {selectedVisit.visitUid}</p>
            </div>
            <button
              onClick={() => setShowResultsForm(false)}
              className="btn btn-outline btn-sm"
            >
              Back to Queue
            </button>
          </div>

          {/* Results Display */}
          <div className="space-y-8">
            {/* Lab Results */}
            {selectedVisit.batchOrders?.some(order => order.type === 'LAB' && order.status === 'COMPLETED') && (
              <div>
                <div className="space-y-4">
                  {selectedVisit.batchOrders
                    .filter(order => order.type === 'LAB' && order.status === 'COMPLETED')
                    .map((order, index) => (
                      <LabResultsDisplay key={index} batchOrder={order} />
                    ))}
                </div>
              </div>
            )}

            {/* Radiology Results */}
            {selectedVisit.batchOrders?.some(order => order.type === 'RADIOLOGY' && order.status === 'COMPLETED') && (
              <div>
                <div className="space-y-4">
                  {selectedVisit.batchOrders
                    .filter(order => order.type === 'RADIOLOGY' && order.status === 'COMPLETED')
                    .map((order, index) => (
                      <RadiologyResultsDisplay key={index} batchOrder={order} onImageClick={handleImageClick} />
                    ))}
                </div>
              </div>
            )}

            {/* Dental Chart */}
            <DentalChartDisplay 
              patientId={selectedVisit.patient.id}
              visitId={selectedVisit.id}
              showHistory={false}
            />
          </div>

          {/* Diagnosis and Treatment Form */}
          <form onSubmit={handleCompleteVisit} className="space-y-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Final Diagnosis & Treatment
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="label">Primary Diagnosis</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.diagnosis}
                    onChange={(e) => setFormData({...formData, diagnosis: e.target.value})}
                    placeholder="Enter primary diagnosis"
                  />
                </div>
                <div>
                  <label className="label">Diagnosis Details</label>
                  <textarea
                    className="input"
                    rows="4"
                    value={formData.diagnosisDetails}
                    onChange={(e) => setFormData({...formData, diagnosisDetails: e.target.value})}
                    placeholder="Detailed diagnosis notes..."
                  />
                </div>
                <div>
                  <label className="label">Patient Instructions</label>
                  <textarea
                    className="input"
                    rows="3"
                    value={formData.instructions}
                    onChange={(e) => setFormData({...formData, instructions: e.target.value})}
                    placeholder="Instructions for patient..."
                  />
                </div>
              </div>
            </div>

            {/* Enhanced Prescription */}
            {!showPrescriptionForm ? (
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <TestTube className="h-5 w-5 mr-2" />
                  Prescribe Medications
                </h3>
                
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Use the enhanced prescription system to search from the medication catalog or add custom medications.
                  </p>
                  
                  <button
                    type="button"
                    onClick={() => setShowPrescriptionForm(true)}
                    className="btn btn-primary"
                  >
                    Open Prescription System
                  </button>
                </div>

                {/* Existing Medication Orders */}
                {formData.medications && formData.medications.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="font-medium text-gray-900">Current Prescriptions:</h4>
                    {formData.medications.map((order, index) => (
                      <div key={index} className="p-2 bg-purple-50 rounded text-sm flex justify-between items-center">
                        <span className="font-medium">{order.name} - {order.dosageForm} {order.strength}</span>
                        <span className="text-gray-500">{order.frequency}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <EnhancedPrescription
                visitId={selectedVisit.id}
                patientId={selectedVisit.patient.id}
                onPrescriptionSubmit={handlePrescriptionSubmit}
                onCancel={() => setShowPrescriptionForm(false)}
              />
            )}

            {/* Save Button */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowResultsForm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
              >
                Complete Visit
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

export default ResultsQueue;
