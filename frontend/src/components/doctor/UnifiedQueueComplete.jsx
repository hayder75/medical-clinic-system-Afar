import React, { useState, useEffect, useRef } from 'react';
import { Stethoscope, User, Clock, FileText, TestTube, Scan, Pill, CheckCircle, Eye, Printer, History, ChevronDown, ChevronRight, Plus, Circle, Camera, Upload, AlertTriangle } from 'lucide-react';
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
  const [showCompleteConfirmModal, setShowCompleteConfirmModal] = useState(false);
  const [countAsMedicalTreated, setCountAsMedicalTreated] = useState(false);
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
      const response = await api.get('/doctors/queue');
      setVisits(response.data.queue || []);
    } catch (error) {
      toast.error('Failed to fetch patient queue');
      console.error('Error fetching visits:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePatientSelect = async (visit) => {
    setSelectedVisit(visit);
    setShowPatientForm(true);

    // Fetch dental record if current user is a dentist
    if (currentUser?.specialty === 'dentist' || currentUser?.qualifications?.includes('Dentist')) {

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
            </div>
          </form>
        </div>
      )}


      {/* Complete Visit Confirmation Modal */}
      {showCompleteConfirmModal && selectedVisit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowCompleteConfirmModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-shrink-0">
                  <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
                    <AlertTriangle className="h-6 w-6" style={{ color: '#F59E0B' }} />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold" style={{ color: '#0C0E0B' }}>Complete Visit</h3>
                  <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
                    Are you sure you want to complete this visit, <span className="font-semibold" style={{ color: '#2e13d1' }}>Dr. {currentUser?.fullname || currentUser?.username || 'Doctor'}</span>?
                  </p>
                </div>
              </div>

              {selectedVisit?.patient && (
                <div className="bg-gray-50 border rounded-lg p-4 mb-4" style={{ borderColor: '#E5E7EB' }}>
                  <p className="text-sm font-medium mb-2" style={{ color: '#0C0E0B' }}>Patient Information:</p>
                  <div className="space-y-1 text-sm">
                    <p style={{ color: '#6B7280' }}>
                      <span className="font-medium">Name:</span> <span style={{ color: '#0C0E0B' }}>{selectedVisit.patient.name}</span>
                    </p>
                    <p style={{ color: '#6B7280' }}>
                      <span className="font-medium">Visit ID:</span> <span style={{ color: '#0C0E0B' }}>{selectedVisit.visitUid}</span>
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium" style={{ color: '#92400E' }}>
                  ⚠️ This action cannot be undone. Once completed, the visit will be finalized.
                </p>
              </div>

              {isDermatologyDoctor && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={countAsMedicalTreated}
                      onChange={(e) => setCountAsMedicalTreated(e.target.checked)}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-semibold text-blue-900">Count this patient as Medical treated?</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Include this completed visit under Medical treated in Admin Doctor reports.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowCompleteConfirmModal(false)}
                  className="px-4 py-2 border rounded-lg font-medium transition-colors hover:bg-gray-50"
                  style={{ borderColor: '#E5E7EB', color: '#6B7280' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmCompleteVisit}
                  className="px-4 py-2 rounded-lg font-medium text-white transition-colors hover:opacity-90"
                  style={{ backgroundColor: '#2e13d1' }}
                >
                  Yes, Complete Visit
                </button>
              </div>
            </div>
          </div>
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
