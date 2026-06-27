import React, { useState, useEffect } from 'react';
import { User, Search, FileText, Calendar, TestTube, Scan, Pill, Heart, Clock, CheckCircle, AlertTriangle, Download, Eye, Circle, Printer, Package } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import DentalChartDisplay from '../common/DentalChartDisplay';
import { getImageUrl } from '../../utils/imageUrl';
import { formatMedicationName, formatMedicationInstruction } from '../../utils/medicalStandards';

const PatientHistory = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('visits');
  const [selectedVisitId, setSelectedVisitId] = useState(null);

  const searchPatients = async () => {
    if (!searchTerm.trim()) return;

    try {
      setLoading(true);
      // Search by patient name, ID, or visit ID
      const response = await api.get(`/patients/search?query=${searchTerm}`);
      setPatients(response.data.patients || []);
    } catch (error) {
      toast.error('Failed to search patients');
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientHistory = async (patientId) => {
    try {
      setLoading(true);
      const response = await api.get(`/doctors/patient-history/${patientId}`);
      setPatientHistory(response.data);
    } catch (error) {
      toast.error('Failed to fetch patient history');
    } finally {
      setLoading(false);
    }
  };

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    setSelectedVisitId(null); // Reset selected visit when switching patients
    fetchPatientHistory(patient.id);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedVisitId(null); // Reset selected visit when switching tabs
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED':
      case 'DISPENSED':
        return 'badge-success';
      case 'PENDING':
      case 'QUEUED':
        return 'badge-warning';
      case 'CANCELLED':
        return 'badge-danger';
      default:
        return 'badge-info';
    }
  };

  const getVisitStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED':
        return 'badge-success';
      case 'UNDER_DOCTOR_REVIEW':
      case 'AWAITING_RESULTS_REVIEW':
        return 'badge-warning';
      case 'CANCELLED':
        return 'badge-danger';
      default:
        return 'badge-info';
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  const formatDateOnly = (date) => {
    return new Date(date).toLocaleDateString();
  };

  const handlePrintVisit = () => {
    if (!selectedVisitId || !patientHistory) return;
    const visit = patientHistory.visits.find(v => v.id === selectedVisitId);
    if (!visit) return;

    const printWindow = window.open('', '_blank');
    const printContent = generatePrintHTML(visit, patientHistory);

    printWindow.document.write(printContent);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleDownloadPDF = async () => {
    if (!selectedVisitId || !patientHistory) return;
    const visit = patientHistory.visits.find(v => v.id === selectedVisitId);
    if (!visit) return;

    try {
      const response = await api.get(`/doctors/patient-history/${patientHistory.patient.id}/visit/${visit.id}/pdf`);
      const link = document.createElement('a');
      link.href = getImageUrl(response.data.filePath);
      link.download = response.data.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF');
    }
  };

  const generatePrintHTML = (visit, history) => {
    const patient = history.patient;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Patient History - ${visit.visitUid}</title>
          <style>
            @page {
              margin: 0.5in;
              size: A4;
            }
            body {
              font-family: Arial, sans-serif;
              font-size: 11px;
              line-height: 1.4;
              color: #000;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
              margin-bottom: 15px;
            }
            .clinic-name {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .section {
              margin-bottom: 15px;
              page-break-inside: avoid;
            }
            .section-title {
              font-size: 14px;
              font-weight: bold;
              border-bottom: 1px solid #ccc;
              padding-bottom: 5px;
              margin-bottom: 10px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
              margin-bottom: 10px;
            }
            .info-item {
              margin-bottom: 5px;
            }
            .label {
              font-weight: bold;
              display: inline-block;
              min-width: 120px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 10px;
            }
            th, td {
              border: 1px solid #ccc;
              padding: 6px;
              text-align: left;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            .text-content {
              margin-top: 5px;
              padding: 8px;
              background-color: #f9f9f9;
              border-left: 3px solid #2e13d1;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="clinic-name">${window.__CS__?.name || 'Clinic'}</div>
            <div>Patient Medical History Report</div>
          </div>

          <div class="section">
            <div class="section-title">Patient Information</div>
            <div class="info-grid">
              <div class="info-item"><span class="label">Name:</span> ${patient.name}</div>
              <div class="info-item"><span class="label">Patient ID:</span> ${patient.id}</div>
              <div class="info-item"><span class="label">DOB:</span> ${formatDateOnly(patient.dob)}</div>
              <div class="info-item"><span class="label">Gender:</span> ${patient.gender || 'N/A'}</div>
              <div class="info-item"><span class="label">Blood Type:</span> ${patient.bloodType || 'N/A'}</div>
              <div class="info-item"><span class="label">Mobile:</span> ${patient.mobile || 'N/A'}</div>
              <div class="info-item"><span class="label">Visit ID:</span> ${visit.visitUid}</div>
              <div class="info-item"><span class="label">Visit Date:</span> ${formatDate(visit.createdAt)}</div>
              <div class="info-item"><span class="label">Status:</span> ${visit.status.replace(/_/g, ' ')}</div>
            </div>
          </div>

          ${visit.diagnosis ? `
          <div class="section">
            <div class="section-title">Final Diagnosis</div>
            <div class="text-content">
              <strong>Diagnosis:</strong> ${visit.diagnosis}
              ${visit.diagnosisDetails ? `<br><br><strong>Details:</strong> ${visit.diagnosisDetails}` : ''}
            </div>
          </div>
          ` : ''}

          ${visit.instructions ? `
          <div class="section">
            <div class="section-title">Patient Instructions</div>
            <div class="text-content">${visit.instructions}</div>
          </div>
          ` : ''}

          ${visit.vitals && visit.vitals.length > 0 ? `
          <div class="section">
            <div class="section-title">Vital Signs</div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>BP</th>
                  <th>Temp</th>
                  <th>HR</th>
                  <th>O2 Sat</th>
                  <th>BMI</th>
                </tr>
              </thead>
              <tbody>
                ${visit.vitals.map(v => `
                  <tr>
                    <td>${formatDateOnly(v.createdAt)}</td>
                    <td>${v.bloodPressure || 'N/A'}</td>
                    <td>${v.temperature ? v.temperature + '°C' : 'N/A'}</td>
                    <td>${v.heartRate ? v.heartRate + ' bpm' : 'N/A'}</td>
                    <td>${v.oxygenSaturation ? v.oxygenSaturation + '%' : 'N/A'}</td>
                    <td>${v.bmi || 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${visit.medicationOrders && visit.medicationOrders.length > 0 ? `
          <div class="section">
            <div class="section-title">Medications</div>
            <table>
              <thead>
                <tr>
                  <th>Medication</th>
                  <th>Strength</th>
                  <th>Quantity</th>
                  <th>Frequency</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                ${visit.medicationOrders.map(order => `
                  <tr>
                    <td>${formatMedicationName(order.name)}</td>
                    <td>${order.strength || 'N/A'}</td>
                    <td>${order.quantity || 'N/A'}</td>
                    <td colspan="2">${formatMedicationInstruction(order)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${visit.labResults && visit.labResults.length > 0 ? `
          <div class="section">
            <div class="section-title">Lab Results</div>
            ${visit.labResults.map(result => `
              <div style="margin-bottom: 10px; padding: 8px; border: 1px solid #ccc;">
                <strong>${result.testType?.name || 'Lab Test'}</strong> - ${result.status}
                ${result.resultText ? `<div class="text-content">${result.resultText}</div>` : ''}
                ${result.additionalNotes ? `<div class="text-content"><strong>Notes:</strong> ${result.additionalNotes}</div>` : ''}
              </div>
            `).join('')}
          </div>
          ` : ''}

          ${visit.radiologyResults && visit.radiologyResults.length > 0 ? `
          <div class="section">
            <div class="section-title">Radiology Results</div>
            ${visit.radiologyResults.map(result => `
              <div style="margin-bottom: 10px; padding: 8px; border: 1px solid #ccc;">
                <strong>${result.testType?.name || 'Radiology Test'}</strong> - ${result.status}
                ${result.resultText ? `<div class="text-content">${result.resultText}</div>` : ''}
                ${result.additionalNotes ? `<div class="text-content"><strong>Notes:</strong> ${result.additionalNotes}</div>` : ''}
              </div>
            `).join('')}
          </div>
          ` : ''}

          <div style="margin-top: 30px; padding-top: 15px; border-top: 2px solid #000;">
            <div style="margin-bottom: 20px;">
              <div style="border-top: 1px solid #000; width: 200px; margin-bottom: 5px;"></div>
              <div style="font-size: 11px; margin-bottom: 5px;">Signature: _________________________</div>
              <div style="font-size: 11px;">Date: _________________________</div>
            </div>
            <div style="text-align: center; font-size: 10px; color: #666; margin-top: 20px;">
              <div>${window.__CS__?.name || 'Clinic'}</div>
              <div>Generated on: ${formatDate(new Date())}</div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Patient History</h2>
          <p className="text-gray-600">View complete patient medical history</p>
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <div className="flex space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by patient name, ID, or visit ID..."
                className="input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchPatients()}
              />
            </div>
          </div>
          <button
            onClick={searchPatients}
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Search Results */}
      {patients.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Search Results</h3>
          <div className="space-y-2">
            {patients.map((patient) => (
              <div
                key={patient.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => handlePatientSelect(patient)}
              >
                <div className="flex items-center">
                  <User className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="font-medium">{patient.name}</p>
                    <p className="text-sm text-gray-500">ID: {patient.id}</p>
                  </div>
                </div>
                <button className="btn btn-primary btn-sm">
                  View History
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Patient History */}
      {selectedPatient && patientHistory && (
        <div className="space-y-6">
          {/* Action Buttons */}
          <div className="card">
            <div className="flex space-x-4">
              <button
                onClick={() => handleTabChange('patient-info')}
                className={`btn ${activeTab === 'patient-info' ? 'btn-primary' : 'btn-outline'}`}
              >
                <User className="h-4 w-4 mr-2" />
                Patient Information
              </button>
              <button
                onClick={() => handleTabChange('visits')}
                className={`btn ${activeTab === 'visits' ? 'btn-primary' : 'btn-outline'}`}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Visit Details
              </button>
              <button
                onClick={() => handleTabChange('dental')}
                className={`btn ${activeTab === 'dental' ? 'btn-primary' : 'btn-outline'}`}
              >
                <Circle className="h-4 w-4 mr-2" />
                Dental History
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="card">
            {/* Patient Information Tab */}
            {activeTab === 'patient-info' && (
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Patient Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-medium">{patientHistory.patient.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Patient ID</p>
                    <p className="font-medium font-mono">{patientHistory.patient.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Date of Birth</p>
                    <p className="font-medium">{formatDateOnly(patientHistory.patient.dob)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Gender</p>
                    <p className="font-medium capitalize">{patientHistory.patient.gender.toLowerCase()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Blood Type</p>
                    <p className="font-medium">{patientHistory.patient.bloodType || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Mobile</p>
                    <p className="font-medium">{patientHistory.patient.mobile}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Visit Details Tab */}
            {activeTab === 'visits' && (
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Visit Details</h3>

                {/* Visit Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Visit
                  </label>
                  <select
                    value={selectedVisitId || ''}
                    onChange={(e) => setSelectedVisitId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Choose a visit...</option>
                    {patientHistory.visits?.map((visit) => (
                      <option key={visit.id} value={visit.id}>
                        {visit.visitUid} - {formatDate(visit.createdAt)} ({visit.status.replace(/_/g, ' ')}){visit.cardProduct ? ` [${visit.cardProduct.name}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Visit Details */}
                {selectedVisitId && patientHistory.visits ? (
                  <div className="space-y-6">
                    {(() => {
                      const visit = patientHistory.visits.find(v => v.id === selectedVisitId);
                      if (!visit) return null;

                      return (
                        <div className="border border-gray-200 rounded-lg p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h4 className="text-lg font-semibold text-gray-900">Visit #{visit.visitUid}</h4>
                              <p className="text-sm text-gray-500">{formatDate(visit.createdAt)}</p>
                              <p className="text-sm text-gray-500">Created by: {visit.createdBy?.fullname || 'System'}</p>
                              {visit.cardProduct && (
                                <p className="text-xs font-medium text-indigo-600 mt-1">💳 Card: {visit.cardProduct.name}</p>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`badge ${getVisitStatusColor(visit.status)}`}>
                                {visit.status.replace(/_/g, ' ')}
                              </span>
                              <button
                                onClick={handlePrintVisit}
                                className="btn btn-outline btn-sm flex items-center space-x-1"
                                title="Print Visit History"
                              >
                                <Printer className="h-4 w-4" />
                                <span>Print</span>
                              </button>
                              <button
                                onClick={handleDownloadPDF}
                                className="btn btn-primary btn-sm flex items-center space-x-1"
                                title="Download PDF with Images"
                              >
                                <Download className="h-4 w-4" />
                                <span>PDF</span>
                              </button>
                            </div>
                          </div>

                          {/* Final Diagnosis Section */}
                          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <h5 className="text-md font-semibold text-blue-900 mb-2 flex items-center">
                              <FileText className="h-4 w-4 mr-2" />
                              Final Diagnosis
                            </h5>
                            {visit.diagnosis ? (
                              <>
                                <p className="text-blue-800 font-medium">{visit.diagnosis}</p>
                                {visit.diagnosisDetails && (
                                  <div className="mt-3">
                                    <p className="text-sm font-medium text-blue-700 mb-1">Diagnosis Details</p>
                                    <p className="text-sm text-blue-600">{visit.diagnosisDetails}</p>
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="text-blue-600 italic">No diagnosis recorded for this visit</p>
                            )}
                          </div>

                          {/* Visit Details */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            {visit.instructions && (
                              <div>
                                <p className="text-sm font-medium text-gray-500">Patient Instructions</p>
                                <p className="text-sm text-gray-900">{visit.instructions}</p>
                              </div>
                            )}
                            {visit.finalNotes && (
                              <div>
                                <p className="text-sm font-medium text-gray-500">Final Notes</p>
                                <p className="text-sm text-gray-900">{visit.finalNotes}</p>
                              </div>
                            )}
                          </div>

                          {/* Medications Section */}
                          {visit.medicationOrders && visit.medicationOrders.length > 0 && (
                            <div className="mb-6">
                              <h5 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                                <Pill className="h-4 w-4 mr-2 text-green-600" />
                                Medications ({visit.medicationOrders.length})
                              </h5>
                              <div className="space-y-3">
                                {visit.medicationOrders.map((order) => (
                                  <div key={order.id} className="bg-green-50 rounded-lg p-4">
                                    <div className="flex justify-between items-start mb-2">
                                      <div>
                                        <p className="font-medium text-gray-900">{order.name}</p>
                                        <p className="text-sm text-gray-500">
                                          {order.strength} - {order.dosageForm}
                                        </p>
                                        {order.doctor && (
                                          <p className="text-xs text-green-700 mt-1">
                                            Prescribed by: Dr. {order.doctor.fullname}
                                          </p>
                                        )}
                                      </div>
                                      <span className={`badge ${getStatusColor(order.status)}`}>
                                        {order.status}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                      <div>
                                        <p className="text-gray-500">Quantity</p>
                                        <p className="font-medium">{order.quantity}</p>
                                      </div>
                                      <div>
                                        <p className="text-gray-500">Frequency</p>
                                        <p className="font-medium">{order.frequency || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <p className="text-gray-500">Duration</p>
                                        <p className="font-medium">{order.duration || 'N/A'}</p>
                                      </div>
                                      <div>
                                        <p className="text-gray-500">Instructions</p>
                                        <p className="font-medium">{order.instructionText || order.instructions || 'N/A'}</p>
                                      </div>
                                    </div>
                                    {order.additionalNotes && (
                                      <div className="mt-2">
                                        <p className="text-sm text-gray-500">Additional Notes</p>
                                        <p className="text-sm text-gray-900">{order.additionalNotes}</p>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Lab Results Section */}
                          {visit.labResults && visit.labResults.length > 0 && (
                            <div className="mb-6">
                              <h5 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                                <TestTube className="h-4 w-4 mr-2 text-blue-600" />
                                Lab Results ({visit.labResults.length})
                              </h5>
                              <div className="space-y-3">
                                {visit.labResults.map((result) => (
                                  <div key={result.id} className="bg-blue-50 rounded-lg p-4">
                                    <div className="flex justify-between items-start mb-2">
                                      <div>
                                        <p className="font-medium text-gray-900">{result.testType?.name}</p>
                                        <p className="text-sm text-gray-500">{formatDate(result.createdAt)}</p>
                                      </div>
                                      <span className="badge badge-success">Completed</span>
                                    </div>

                                    {/* Show detailed results if available */}
                                    {result.detailedResults ? (
                                      <div className="mt-3">
                                        <p className="text-sm font-medium text-gray-500 mb-2">Detailed Results:</p>
                                        <div className="bg-white rounded-lg p-3">
                                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                            {Object.entries(result.detailedResults).map(([key, value]) => (
                                              <div key={key} className="flex justify-between">
                                                <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                                                <span className="text-gray-900 font-medium">{value}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="mt-2">
                                        <p className="text-sm text-gray-500">Result</p>
                                        <p className="text-sm text-gray-900">{result.resultText}</p>
                                      </div>
                                    )}

                                    {result.additionalNotes && (
                                      <div className="mt-2">
                                        <p className="text-sm text-gray-500">Notes</p>
                                        <p className="text-sm text-gray-900">{result.additionalNotes}</p>
                                      </div>
                                    )}

                                    {result.processedByUser && (
                                      <div className="mt-1 text-xs text-blue-700">
                                        Processed by: {result.processedByUser.fullname} ({result.processedByUser.role})
                                      </div>
                                    )}
                                    {result.verifiedByUser && (
                                      <div className="mt-2 text-xs text-blue-600">
                                        Verified by: {result.verifiedByUser.fullname} | {formatDate(result.verifiedAt)}
                                      </div>
                                    )}
                                    {!result.verifiedByUser && result.verifiedBy && (
                                      <div className="mt-2 text-xs text-gray-500">
                                        Verified by: {result.verifiedBy} | {formatDate(result.verifiedAt)}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Radiology Results Section */}
                          {visit.radiologyResults && visit.radiologyResults.length > 0 && (
                            <div className="mb-6">
                              <h5 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                                <Scan className="h-4 w-4 mr-2 text-purple-600" />
                                Radiology Results ({visit.radiologyResults.length})
                              </h5>
                              <div className="space-y-3">
                                {visit.radiologyResults.map((result) => (
                                  <div key={result.id} className="bg-purple-50 rounded-lg p-4">
                                    <div className="flex justify-between items-start mb-2">
                                      <div>
                                        <p className="font-medium text-gray-900">{result.testType?.name}</p>
                                        <p className="text-sm text-gray-500">{formatDate(result.createdAt)}</p>
                                      </div>
                                      <span className="badge badge-success">Completed</span>
                                    </div>
                                    <div className="mt-2">
                                      <p className="text-sm text-gray-500">Report</p>
                                      <p className="text-sm text-gray-900">{result.resultText}</p>
                                    </div>
                                    {result.additionalNotes && (
                                      <div className="mt-2">
                                        <p className="text-sm text-gray-500">Notes</p>
                                        <p className="text-sm text-gray-900">{result.additionalNotes}</p>
                                      </div>
                                    )}
                                    {result.radiologist && (
                                      <div className="mt-1 text-xs text-purple-600">
                                        Reported by: Dr. {result.radiologist}
                                      </div>
                                    )}
                                    {result.attachments && result.attachments.length > 0 && (
                                      <div className="mt-2">
                                        <p className="text-sm text-gray-500">Attachments</p>
                                        <div className="flex space-x-2 mt-1">
                                          {result.attachments.map((attachment) => (
                                            <button
                                              key={attachment.id}
                                              className="btn btn-sm btn-outline"
                                              onClick={() => window.open(attachment.url, '_blank')}
                                            >
                                              <Download className="h-4 w-4 mr-1" />
                                              {attachment.filename}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Nurse Services Section */}
                          {visit.nurseServices && visit.nurseServices.length > 0 && (
                            <div className="mb-6">
                              <h5 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                                <Heart className="h-4 w-4 mr-2 text-pink-600" />
                                Nurse Services ({visit.nurseServices.length})
                              </h5>
                              <div className="space-y-2">
                                {visit.nurseServices.map((svc) => (
                                  <div key={svc.id} className="bg-pink-50 rounded-lg p-3">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <p className="font-medium text-gray-900">{svc.serviceName}</p>
                                        <p className="text-xs text-gray-500">{formatDate(svc.completedAt)}</p>
                                      </div>
                                    </div>
                                    <div className="mt-1 text-xs text-pink-700">
                                      Performed by: {svc.assignedNurse || 'Unknown'}
                                      {svc.assignedBy && <span> (assigned by {svc.assignedBy})</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Dental Services Section */}
                          {visit.dentalServices && visit.dentalServices.length > 0 && (
                            <div className="mb-6">
                              <h5 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                                <Circle className="h-4 w-4 mr-2 text-indigo-600" />
                                Dental Services ({visit.dentalServices.length})
                              </h5>
                              <div className="space-y-2">
                                {visit.dentalServices.map((svc) => (
                                  <div key={svc.id} className="bg-indigo-50 rounded-lg p-3">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <p className="font-medium text-gray-900">{svc.serviceName}</p>
                                        <p className="text-xs text-gray-500">{formatDate(svc.completedAt)}</p>
                                      </div>
                                    </div>
                                    <p className="mt-1 text-xs text-indigo-700">
                                      Performed by: Dr. {svc.doctor || 'Unknown'}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Emergency Drug Orders Section */}
                          {visit.emergencyOrders && visit.emergencyOrders.length > 0 && (
                            <div className="mb-6">
                              <h5 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                                <AlertTriangle className="h-4 w-4 mr-2 text-orange-600" />
                                Emergency Drug Orders ({visit.emergencyOrders.length})
                              </h5>
                              <div className="space-y-2">
                                {visit.emergencyOrders.map((order) => (
                                  <div key={order.id} className="bg-orange-50 rounded-lg p-3">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <p className="font-medium text-gray-900">{order.serviceName}</p>
                                        <p className="text-xs text-gray-500">{formatDate(order.createdAt)}</p>
                                      </div>
                                    </div>
                                    <p className="mt-1 text-xs text-orange-700">
                                      Ordered by: Dr. {order.doctor || 'Unknown'}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Material Needs Section */}
                          {visit.materialNeeds && visit.materialNeeds.length > 0 && (
                            <div className="mb-6">
                              <h5 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                                <Package className="h-4 w-4 mr-2 text-teal-600" />
                                Material Needs ({visit.materialNeeds.length})
                              </h5>
                              <div className="space-y-2">
                                {visit.materialNeeds.map((order) => (
                                  <div key={order.id} className="bg-teal-50 rounded-lg p-3">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <p className="font-medium text-gray-900">{order.serviceName}</p>
                                        <p className="text-xs text-gray-500">{formatDate(order.createdAt)}</p>
                                      </div>
                                    </div>
                                    <p className="mt-1 text-xs text-teal-700">
                                      Ordered by: {order.nurse || 'Unknown'}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Dental Chart Section */}
                          <div className="mb-6">
                            <h5 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                              <Circle className="h-4 w-4 mr-2 text-blue-600" />
                              Dental Chart
                            </h5>
                            <DentalChartDisplay
                              patientId={selectedPatient.id}
                              visitId={visit.id}
                              showHistory={false}
                            />
                          </div>

                          {/* Vitals for this visit */}
                          {visit.vitals && visit.vitals.length > 0 && (
                            <div className="mb-4">
                              <h5 className="text-sm font-medium text-gray-900 mb-2">Vitals</h5>
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-3 py-2 text-left">Date</th>
                                      <th className="px-3 py-2 text-left">BP</th>
                                      <th className="px-3 py-2 text-left">Temp</th>
                                      <th className="px-3 py-2 text-left">HR</th>
                                      <th className="px-3 py-2 text-left">BMI</th>
                                      <th className="px-3 py-2 text-left">O2 Sat</th>
                                      <th className="px-3 py-2 text-left">Recorded By</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {visit.vitals.map((vital) => (
                                      <tr key={vital.id} className="border-t">
                                        <td className="px-3 py-2">{formatDateOnly(vital.createdAt)}</td>
                                        <td className="px-3 py-2">{vital.bloodPressure}</td>
                                        <td className="px-3 py-2">{vital.temperature}°C</td>
                                        <td className="px-3 py-2">{vital.heartRate} bpm</td>
                                        <td className="px-3 py-2">{vital.bmi}</td>
                                        <td className="px-3 py-2">{vital.oxygenSaturation}%</td>
                                        <td className="px-3 py-2 text-xs text-gray-500">{vital.recordedBy?.fullname || vital.recordedByRole || "N/A"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Please select a visit to view its details</p>
                  </div>
                )}
              </div>
            )}

            {/* Dental History Tab */}
            {activeTab === 'dental' && (
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Dental History</h3>
                <DentalChartDisplay
                  patientId={selectedPatient.id}
                  visitId={null}
                  showHistory={true}
                />
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default PatientHistory;