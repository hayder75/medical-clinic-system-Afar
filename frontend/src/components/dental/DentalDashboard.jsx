import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import DentalChart from './DentalChart';
import DoctorSelectionModal from './DoctorSelectionModal';
import DentalOrderModal from './DentalOrderModal';
import { 
  User, 
  Calendar, 
  TestTube, 
  Scan, 
  FileText, 
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';

const DentalDashboard = ({ patientId, visitId, onComplete }) => {
  const [patient, setPatient] = useState(null);
  const [visit, setVisit] = useState(null);
  const [dentalRecord, setDentalRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedTeethForOrder, setSelectedTeethForOrder] = useState([]);
  const [activeTab, setActiveTab] = useState('chart');

  useEffect(() => {
    fetchPatientData();
  }, [patientId, visitId]);

  const fetchPatientData = async () => {
    setLoading(true);
    try {
      // Fetch patient information
      const patientResponse = await api.get(`/patients/${patientId}`);
      setPatient(patientResponse.data);

      // Fetch visit information
      if (visitId) {
        const visitResponse = await api.get(`/visits/${visitId}`);
        setVisit(visitResponse.data);

        // Fetch existing dental record
        try {
          const dentalResponse = await api.get(`/dental/records/${patientId}/${visitId}`);
          setDentalRecord(dentalResponse.data.dentalRecord);
        } catch (error) {
          // No existing dental record, that's okay
          if (error.response?.status !== 404) {
            console.error('Error fetching dental record:', error);
          }
          setDentalRecord(null);
        }
      }
    } catch (error) {
      console.error('Error fetching patient data:', error);
      toast.error('Failed to load patient data');
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorSelect = async (doctor) => {
    try {
      // Assign the selected doctor to the visit
      await api.post('/nurses/assignments', {
        patientId,
        visitId,
        doctorId: doctor.id
      });

      toast.success(`Patient assigned to Dr. ${doctor.fullname}`);
      setShowDoctorModal(false);
      
      // Refresh visit data
      fetchPatientData();
    } catch (error) {
      console.error('Error assigning doctor:', error);
      toast.error('Failed to assign doctor');
    }
  };

  const handleDentalChartSave = (savedRecord) => {
    setDentalRecord(savedRecord);
    toast.success('Dental chart saved successfully');
  };

  const handleCreateOrder = (selectedTeeth) => {
    setSelectedTeethForOrder(selectedTeeth);
    setShowOrderModal(true);
  };

  const handleOrderCreated = (orderData) => {
    toast.success('Order created successfully');
    setShowOrderModal(false);
    setSelectedTeethForOrder([]);
    
    // Refresh visit data to show new orders
    fetchPatientData();
  };

  const handleCompleteVisit = async () => {
    try {
      if (visitId) {
        await api.post(`/doctors/complete`, { visitId });
        toast.success('Visit completed successfully');
        if (onComplete) onComplete();
      }
    } catch (error) {
      console.error('Error completing visit:', error);
      toast.error('Failed to complete visit');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading patient data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Patient Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{patient?.name}</h2>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>ID: {patient?.id}</span>
                <span>•</span>
                <span>Type: {patient?.type}</span>
                {patient?.dob && (
                  <>
                    <span>•</span>
                    <span>DOB: {new Date(patient.dob).toLocaleDateString()}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {visit?.status && (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                visit.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                visit.status === 'AWAITING_RESULTS_REVIEW' ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {visit.status.replace(/_/g, ' ')}
              </span>
            )}
            <span className="text-sm text-gray-500">
              {visit?.visitUid}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('chart')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'chart'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Dental Chart
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'orders'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <TestTube className="w-4 h-4 inline mr-2" />
              Orders & Results
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Clock className="w-4 h-4 inline mr-2" />
              Dental History
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Dental Chart Tab */}
          {activeTab === 'chart' && (
            <div className="space-y-4">
              <DentalChart
                patientId={patientId}
                visitId={visitId}
                patientAge={patient?.age}
                onSave={handleDentalChartSave}
                initialData={dentalRecord}
                onCreateOrder={handleCreateOrder}
              />
            </div>
          )}

          {/* Orders & Results Tab */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Dental Orders & Results</h3>
                <button
                  onClick={() => setShowOrderModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Order
                </button>
              </div>
              
              {/* Orders will be displayed here */}
              <div className="text-center py-8 text-gray-500">
                <TestTube className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No orders created yet</p>
                <p className="text-sm">Create orders from the dental chart or use the button above</p>
              </div>
            </div>
          )}

          {/* Dental History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Dental History</h3>
              
              {/* History will be displayed here */}
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No dental history available</p>
                <p className="text-sm">Previous dental records will appear here</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center bg-white rounded-lg shadow-sm p-4">
        <div className="flex space-x-3">
          <button
            onClick={() => setShowDoctorModal(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Assign Doctor
          </button>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={handleCompleteVisit}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Complete Visit
          </button>
        </div>
      </div>

      {/* Modals */}
      <DoctorSelectionModal
        isOpen={showDoctorModal}
        onClose={() => setShowDoctorModal(false)}
        onSelectDoctor={handleDoctorSelect}
        patientId={patientId}
        visitId={visitId}
      />

      <DentalOrderModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        selectedTeeth={selectedTeethForOrder}
        patientId={patientId}
        visitId={visitId}
        onOrderCreated={handleOrderCreated}
      />
    </div>
  );
};

export default DentalDashboard;
