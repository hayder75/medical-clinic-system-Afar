import React, { useState, useEffect } from 'react';
import { Scan, Clock, CheckCircle, AlertTriangle, FileText, Upload, Image, User, Calendar, Stethoscope, X, Plus, Eye, Printer, Pencil } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import ImageViewer from '../common/ImageViewer';
import { getImageUrl } from '../../utils/imageUrl';

const getDateToken = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '00000000';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
};

const toSmallSequence = (raw) => {
  const input = String(raw ?? '');
  if (!input) return '000';
  if (/^\d+$/.test(input)) {
    return String(parseInt(input, 10) % 1000 || parseInt(input, 10)).padStart(3, '0').slice(-3);
  }
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash + input.charCodeAt(i) * (i + 1)) % 1000;
  }
  return String(hash || 1).padStart(3, '0');
};

const formatDisplayOrderId = (order) => `${getDateToken(order?.createdAt)}-${toSmallSequence(order?.id)}`;

const RadiologyOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [testResults, setTestResults] = useState({});
  const [uploadingFiles, setUploadingFiles] = useState({});
  const [expandedTests, setExpandedTests] = useState({});
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageViewerImages, setImageViewerImages] = useState([]);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);

  const openImageViewer = (images, startIndex = 0) => {
    if (!images || images.length === 0) return;
    const mapped = images.map(img => ({
      filePath: getImageUrl(img.fileUrl || img.path || img.filePath),
      fileName: img.fileName || img.originalName || 'Image'
    }));
    setImageViewerImages(mapped);
    setImageViewerIndex(startIndex);
    setImageViewerOpen(true);
  };

  const closeImageViewer = () => {
    setImageViewerOpen(false);
    setImageViewerImages([]);
    setImageViewerIndex(0);
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/radiologies/orders', {
        params: { status: statusFilter }
      });
      // Combine batch orders with walk-in orders; tag each with a kind to avoid key collisions
      const batchOrders = (response.data.batchOrders || []).map(o => ({ ...o, __kind: 'batch' }));

      // For walk-in orders, the backend already groups them with services array
      // Only create services array if it doesn't exist (for backward compatibility)
      const walkInOrders = (response.data.walkInOrders || []).map(o => {
        const order = { ...o, __kind: 'walkin' };

        // If backend didn't provide services array, create one from type (backward compatibility)
        if (!order.services || !Array.isArray(order.services) || order.services.length === 0) {
          if (order.type) {
            order.services = [{
              service: order.type,
              investigationType: order.type,
              id: order.id
            }];
          } else {
            order.services = [];
          }
        }

        return order;
      });
      const allOrders = [...batchOrders, ...walkInOrders].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setOrders(allOrders);
    } catch (error) {
      toast.error('Failed to fetch radiology orders');
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredOrders = () => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return orders.filter((order) => {
      // Backend filters by status already. Keep this guard for consistency.
      const statusMatches = statusFilter === 'ALL'
        ? true
        : statusFilter === 'PENDING'
          ? order.status !== 'COMPLETED'
          : order.status === 'COMPLETED';

      const patientName = order?.patient?.name?.toLowerCase() || '';
      const patientId = String(order?.patient?.id || '').toLowerCase();
      const orderDisplayId = formatDisplayOrderId(order).toLowerCase();

      const searchMatches = !normalizedQuery
        || patientName.includes(normalizedQuery)
        || patientId.includes(normalizedQuery)
        || orderDisplayId.includes(normalizedQuery);

      return statusMatches && searchMatches;
    });
  };

  const fetchExistingResults = async (batchOrderId) => {
    try {
      const response = await api.get(`/radiologies/batch-orders/${batchOrderId}/results`);
      const existingResults = {};

      if (response.data && response.data.radiologyResults) {
        response.data.radiologyResults.forEach(result => {
          existingResults[result.testTypeId] = {
            resultText: result.resultText || '',
            findings: result.findings || '',
            conclusion: result.conclusion || '',
            files: result.attachments || [],
            completed: true,
            resultId: result.id
          };
        });
      }

      return existingResults;
    } catch (error) {
      console.error('Error fetching existing results:', error);
      return {};
    }
  };

  const handleOrderClick = async (order) => {
    setSelectedOrder(order);
    setShowReportForm(true);
    // Completed reports open in read-only mode until user chooses Edit.
    setIsEditMode(order.status !== 'COMPLETED');

    // Initialize test results for each radiology test
    const initialResults = {};

    // Handle both batch orders and walk-in orders
    let services = [];

    if (order.services && Array.isArray(order.services) && order.services.length > 0) {
      // Batch order or grouped walk-in order
      services = order.services;
    } else if (order.type && order.isWalkIn) {
      // Single walk-in order
      services = [{ investigationType: order.type, id: order.id }];
    } else if (order.type) {
      // Legacy single order
      services = [{ investigationType: order.type, id: order.id }];
    }

    console.log(`🔍 [handleOrderClick] Order type: ${order.isWalkIn ? 'WALK-IN' : 'BATCH'}, Services count: ${services.length}`);

    // Fetch templates for each test type and pre-fill
    for (const service of services) {
      const testType = service.investigationType || service.type || order.type;

      if (!testType) {
        console.warn(`⚠️  No test type found for service:`, service);
        continue;
      }

      const testTypeId = testType.id || testType.typeId;

      if (!testTypeId) {
        console.warn(`⚠️  No test type ID found for:`, testType);
        continue;
      }

      if (testType.category === 'RADIOLOGY') {
        // Debug: Log what we're trying to fetch
        console.log(`🔍 Fetching template for: ${testType.name} (ID: ${testTypeId})`);

        try {
          // Fetch template for this test type
          const templateRes = await api.get(`/radiologies/templates/${testTypeId}`);
          const template = templateRes.data.template;

          if (template) {
            console.log(`✅ Template found for ${testType.name}:`, {
              hasClinicalIndication: !!template.clinicalIndicationTemplate,
              hasTechnique: !!template.techniqueTemplate,
              hasFindings: !!template.findingsTemplate,
              findingsLength: template.findingsTemplate?.length || 0,
              hasConclusion: !!template.conclusionTemplate,
              conclusionLength: template.conclusionTemplate?.length || 0
            });
          } else {
            console.warn(`⚠️  Template is null for ${testType.name} (ID: ${testTypeId})`);
          }

          initialResults[testTypeId] = {
            resultText: '',
            clinicalIndication: template?.clinicalIndicationTemplate || '',
            technique: template?.techniqueTemplate || '',
            comparison: '',
            findings: template?.findingsTemplate || '',
            conclusion: template?.conclusionTemplate || '',
            recommendations: '',
            files: [],
            completed: false,
            resultId: null
          };
        } catch (error) {
          // If no template exists, start with empty fields
          console.error(`❌ Error fetching template for ${testType.name} (ID: ${testTypeId}):`, error.message);
          if (error.response) {
            console.error('   Response status:', error.response.status);
            console.error('   Response data:', error.response.data);
          }
          initialResults[testTypeId] = {
            resultText: '',
            clinicalIndication: '',
            technique: '',
            comparison: '',
            findings: '',
            conclusion: '',
            recommendations: '',
            files: [],
            completed: false,
            resultId: null
          };
        }
      } else {
        console.warn(`⚠️  Skipping non-radiology test type:`, testType?.name || 'unknown');
      }
    }

    // Fetch existing results and merge with initial results (only for batch orders)
    if (!order.isWalkIn) {
      const existingResults = await fetchExistingResults(order.id);
      const mergedResults = { ...initialResults, ...existingResults };
      setTestResults(mergedResults);
    } else {
      // For walk-in orders, check if they have results in radiologyResults
      if (order.radiologyResults && order.radiologyResults.length > 0) {
        order.radiologyResults.forEach(result => {
          if (result.testType) {
            initialResults[result.testType.id] = {
              resultText: result.resultText || '',
              clinicalIndication: result.clinicalIndication || '',
              technique: result.technique || '',
              comparison: result.comparison || '',
              findings: result.findings || '',
              conclusion: result.conclusion || '',
              recommendations: result.recommendations || '',
              files: result.attachments || [],
              completed: true,
              resultId: result.id
            };
          }
        });
      }
      setTestResults(initialResults);
    }
  };

  const updateTestResult = (testId, field, value) => {
    setTestResults(prev => ({
      ...prev,
      [testId]: {
        ...prev[testId],
        [field]: value
      }
    }));
  };

  const handleFileUpload = async (testId, file) => {
    try {
      setUploadingFiles(prev => ({ ...prev, [testId]: true }));

      const testResult = testResults[testId];
      if (!testResult) {
        toast.error('Test result not found');
        return;
      }

      if (!selectedOrder) {
        toast.error('No order selected');
        return;
      }

      // Upload the file immediately
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await api.post(
        `/radiologies/batch-orders/${selectedOrder.id}/attachment`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      // Store the uploaded file info
      const fileData = {
        id: `temp_${Date.now()}_${Math.random()}`,
        originalName: file.name,
        fileType: file.type,
        size: file.size,
        uploaded: true,
        path: uploadResponse.data.file.path,
        filePath: uploadResponse.data.file.path
      };

      updateTestResult(testId, 'files', [...(testResult.files || []), fileData]);
      toast.success('File uploaded successfully');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(error.response?.data?.error || 'Failed to upload file');
    } finally {
      setUploadingFiles(prev => ({ ...prev, [testId]: false }));
    }
  };

  // Individual submit function removed - only batch submission allowed

  const handleCompleteBatchOrder = async () => {
    try {
      // Collect already uploaded file paths
      const uploadedFiles = {};

      for (const [testId, result] of Object.entries(testResults)) {
        if (result.files && result.files.length > 0) {
          const testUploadedFiles = [];

          for (const fileData of result.files) {
            // Files are already uploaded, just use their paths
            if (fileData.path || fileData.filePath) {
              testUploadedFiles.push({
                path: fileData.path || fileData.filePath,
                type: fileData.fileType,
                originalName: fileData.originalName
              });
            }
          }

          uploadedFiles[testId] = testUploadedFiles;
        }
      }

      // Prepare test results for batch submission
      const testResultsArray = Object.entries(testResults).map(([testId, result]) => ({
        testTypeId: parseInt(testId),
        clinicalIndication: result.clinicalIndication || '',
        technique: result.technique || '',
        comparison: result.comparison || '',
        findings: result.findings || '',
        conclusion: result.conclusion || '',
        recommendations: result.recommendations || '',
        attachments: uploadedFiles[testId] || []
      }));

      // Submit all test results at once
      console.log(`🔄 [handleCompleteBatchOrder] Submitting order ${selectedOrder.id} (${selectedOrder.isWalkIn ? 'WALK-IN' : 'BATCH'}) with ${testResultsArray.length} test results`);
      const response = await api.post(`/radiologies/orders/${selectedOrder.id}/report`, {
        orderId: selectedOrder.id,
        isWalkIn: !!selectedOrder.isWalkIn,
        testResults: testResultsArray
      });

      console.log(`✅ [handleCompleteBatchOrder] Response:`, response.data);

      toast.success(selectedOrder?.status === 'COMPLETED'
        ? 'Radiology results updated successfully'
        : 'All radiology tests completed successfully');

      // Close the form first
      setShowReportForm(false);
      setSelectedOrder(null);
      setTestResults({});
      setExpandedTests({});
      setIsEditMode(false);

      // Wait a moment before refreshing to ensure backend has updated
      setTimeout(() => {
        console.log(`🔄 [handleCompleteBatchOrder] Refreshing orders...`);
        fetchOrders();
      }, 500);
    } catch (error) {
      console.error('Error completing batch order:', error);
      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error('Failed to complete batch order');
      }
    }
  };

  const toggleTestExpansion = (testId) => {
    setExpandedTests(prev => ({
      ...prev,
      [testId]: !prev[testId]
    }));
  };

  const handlePrintResults = async (e, order) => {
    e.stopPropagation(); // Prevent triggering the order click

    try {
      // Fetch results from API
      let allResults = [];

      if (order.__kind === 'batch' || !order.isWalkIn) {
        // Batch order - fetch results from API
        const response = await api.get(`/radiologies/batch-orders/${order.id}/results`);
        allResults = response.data?.radiologyResults || [];
      } else {
        // Walk-in order - check if results are in order or fetch them
        if (order.radiologyResults && order.radiologyResults.length > 0) {
          allResults = order.radiologyResults;
        } else {
          // Try to fetch from API (walk-in orders might have results linked)
          try {
            const response = await api.get(`/radiologies/orders/${order.id}/results`);
            allResults = response.data?.radiologyResults || [];
          } catch (fetchError) {
            // If that doesn't work, results might not be available yet
            console.warn('Could not fetch results for walk-in order:', fetchError);
            allResults = [];
          }
        }
      }

      if (allResults.length === 0) {
        toast.error('No radiology results found for this order. Please complete the tests first.');
        return;
      }

      const printWindow = window.open('', '_blank');
      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const currentTime = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });

      const patient = order.patient || {};

      // Get radiologist from first result's radiologistUser
      const firstResult = allResults[0];
      const radiologistName = firstResult?.radiologistUser?.fullname || firstResult?.radiologistUser || 'Radiologist';

      // Calculate age from date of birth
      const calculateAge = (dob) => {
        if (!dob) return 'N/A';
        const birthDate = new Date(dob);
        if (Number.isNaN(birthDate.getTime())) return 'N/A';
        const today = new Date();
        let years = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) years--;
        if (years < 0) return 'N/A';
        if (years === 0) {
          let months = today.getMonth() - birthDate.getMonth();
          let days = today.getDate() - birthDate.getDate();
          if (days < 0) {
            months--;
            const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            days += prevMonth.getDate();
          }
          if (months < 0) months = 0;
          return months === 0 ? `${days}d` : `${months}m ${days}d`;
        }
        return years;
      };

      const patientAge = patient.dob ? calculateAge(patient.dob) : (patient.age || 'N/A');
      const patientBloodType = patient.bloodType || 'N/A';
      const displayOrderId = formatDisplayOrderId(order);

      const receiptContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Radiology Report - ${patient.name || 'Patient'}</title>
        <style>
          @media print {
            @page { 
              size: A4;
              margin: 5mm;
            }
            body { margin: 0; padding: 0; background: white !important; visibility: visible !important; display: block !important; zoom: 90%; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color: black !important; }
            .header { border-bottom: 2px solid black !important; margin-bottom: 10px !important; padding-bottom: 5px !important; }
            .test-header { border-left: 4px solid black !important; color: black !important; margin-bottom: 8px !important; font-size: 12pt !important; }
            .test-group { margin-bottom: 15px !important; padding-bottom: 10px !important; page-break-inside: avoid; }
            .footer { margin-top: 15px !important; }
            .no-print { display: none !important; }
          }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 10px;
            color: #333;
            line-height: 1.3;
            font-size: 10pt;
          }
          .no-print {
            text-align: center;
            padding: 15px;
            background: #f8f9fa;
            margin-bottom: 15px;
            border-bottom: 1px solid #dee2e6;
          }
          .no-print button {
            background: #2563eb;
            color: white;
            border: none;
            padding: 8px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
          }
          .header { 
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 10px; 
            margin-bottom: 15px; 
            border-bottom: 3px solid #2563eb;
          }
          .header-left {
            display: flex;
            align-items: center;
            gap: 15px;
          }
          .logo {
            width: 70px;
            height: 70px;
            object-fit: contain;
          }
          .clinic-info {
            text-align: left;
          }
          .clinic-name { 
            font-size: 24px; 
            font-weight: 800; 
            margin: 0;
            color: #1e40af;
            letter-spacing: -0.5px;
          }
          .clinic-tagline {
            font-size: 12px;
            color: #64748b;
            margin: 0;
            font-style: italic;
          }
          .header-right {
            text-align: right;
          }
          .report-title { 
            font-size: 20px; 
            font-weight: 700; 
            margin: 0;
            color: #0f172a;
            text-transform: uppercase;
          }
          .report-info {
            font-size: 12px;
            color: #64748b;
            margin-top: 2px;
          }

          .patient-section {
            margin-bottom: 15px;
            padding: 10px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            font-size: 10pt;
          }
          .section-header {
            font-size: 12px;
            font-weight: 700;
            margin-bottom: 8px;
            color: #1e293b;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 3px;
            text-transform: uppercase;
          }
          .patient-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
          }
          .info-item {
            display: flex;
            flex-direction: column;
          }
          .info-label {
            font-weight: 600;
            color: #64748b;
            font-size: 10px;
            text-transform: uppercase;
          }
          .info-value {
            color: #1e293b;
            font-weight: 500;
            font-size: 11px;
          }

          .report-content {
            margin-top: 15px;
          }
          .test-group {
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid #e2e8f0;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .test-group:last-child {
            border-bottom: none;
          }
          .test-header {
            font-size: 13pt;
            font-weight: 700;
            color: #1e40af;
            margin-bottom: 8px;
            text-transform: uppercase;
            border-left: 4px solid #1e40af;
            padding-left: 10px;
            break-after: avoid;
          }
          .result-section {
            margin-top: 12px;
            margin-left: 14px;
            break-inside: avoid;
          }
          .section-label {
            font-weight: 700;
            color: #475569;
            font-size: 11pt;
            text-transform: uppercase;
            display: block;
            margin-bottom: 5px;
            break-after: avoid;
          }
          .section-value {
            color: #1e293b;
            font-size: 10.5pt;
            line-height: 1.4;
            white-space: pre-wrap;
            display: block;
            text-align: justify;
          }
          .notes-box {
            margin-top: 8px;
            padding: 6px 10px;
            background-color: #fffbeb;
            border-left: 3px solid #f59e0b;
            font-size: 9.5pt;
            font-style: italic;
            color: #92400e;
          }

          .footer {
            margin-top: 20px;
            padding-top: 15px;
            border-top: 2px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            font-size: 10pt;
          }
          .signature-box {
            text-align: center;
            min-width: 180px;
          }
          .signature-line {
            border-top: 1px solid #334155;
            margin-top: 45px;
            padding-top: 5px;
            font-size: 11px;
            font-weight: 600;
            color: #475569;
          }
          .print-footer {
            text-align: center;
            font-size: 9px;
            color: #94a3b8;
            margin-top: 30px;
            border-top: 1px dashed #e2e8f0;
            padding-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button onclick="window.print()">Print Report</button>
        </div>

        <div class="header">
          <div class="header-left">
            <img src="${window.__CS__?.logoUrl || '/clinic-logo.jpg'}" alt="Clinic Logo" class="logo" onerror="this.style.display='none'">
            <div class="clinic-info">
              <h1 class="clinic-name">${window.__CS__?.name || 'Clinic'}</h1>
              <p class="clinic-tagline">${window.__CS__?.tagline || 'Quality Healthcare You Can Trust'}</p>
            </div>
          </div>
          <div class="header-right">
            <h2 class="report-title">Radiology Report</h2>
            <div class="report-info">
              Date: ${currentDate} | Time: ${currentTime}
            </div>
          </div>
        </div>

        <div class="patient-section">
          <div class="section-header">Patient Information</div>
          <div class="patient-grid">
            <div class="info-item">
              <span class="info-label">Full Name</span>
              <span class="info-value">${patient.name || 'N/A'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Patient ID</span>
              <span class="info-value">#${patient.id || 'N/A'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Gender</span>
              <span class="info-value">${patient.gender || 'N/A'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Age</span>
              <span class="info-value">${patientAge}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Blood Type</span>
              <span class="info-value">${patientBloodType}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Contact</span>
              <span class="info-value">${patient.mobile || 'N/A'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Order ID</span>
              <span class="info-value">${displayOrderId}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Ref. Doctor</span>
              <span class="info-value">${order.doctor?.fullname || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div class="report-content">
          ${allResults.map(result => `
            <div class="test-group">
              <div class="test-header">${result.testType?.name || 'Radiology Test'}</div>
              
              ${result.clinicalIndication ? `
                <div class="result-section">
                  <span class="section-label">Clinical Indication:</span>
                  <span class="section-value">${result.clinicalIndication}</span>
                </div>
              ` : ''}
              
              ${result.technique ? `
                <div class="result-section">
                  <span class="section-label">Technique:</span>
                  <span class="section-value">${result.technique}</span>
                </div>
              ` : ''}
              
              ${result.comparison ? `
                <div class="result-section">
                  <span class="section-label">Comparison:</span>
                  <span class="section-value">${result.comparison}</span>
                </div>
              ` : ''}
              
              ${result.findings ? `
                <div class="result-section">
                  <span class="section-label">Findings:</span>
                  <span class="section-value">${result.findings}</span>
                </div>
              ` : ''}
              
              ${result.conclusion ? `
                <div class="result-section">
                  <span class="section-label">Conclusion:</span>
                  <span class="section-value">${result.conclusion}</span>
                </div>
              ` : ''}
              
              ${result.recommendations ? `
                <div class="result-section">
                  <span class="section-label">Recommendations:</span>
                  <span class="section-value">${result.recommendations}</span>
                </div>
              ` : ''}
              
              ${result.additionalNotes ? `
                <div class="notes-box">
                  <strong>Notes:</strong> ${result.additionalNotes}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <div class="footer">
          <div class="signature-box">
            <div class="signature-line">Radiologist Signature</div>
            <div style="font-weight: bold; font-size: 10pt;">${radiologistName}</div>
          </div>
          <div class="signature-box">
            <div style="height: 40px;"></div> <!-- Stamp Placeholder -->
          </div>
          <div class="signature-box">
            <div class="signature-line">Authorized Signature</div>
          </div>
        </div>

        <div class="print-footer">
          Computer Generated Report • ${window.__CS__?.name || 'Clinic'} • ${currentDate} ${currentTime}
        </div>
      </body>
    </html>
    `;

      printWindow.document.write(receiptContent);
      printWindow.document.close();

      setTimeout(() => {
        printWindow.print();
      }, 800);

      toast.success('Opening print preview...');
    } catch (error) {
      console.error('Error printing radiology results:', error);
      toast.error('Failed to load radiology results for printing');
    }
  };


  const getStatusIcon = (status) => {
    switch (status) {
      case 'QUEUED':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'IN_PROGRESS':
        return <AlertTriangle className="h-4 w-4 text-blue-500" />;
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'QUEUED':
        return 'bg-yellow-100 text-yellow-800';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isDentalOrder = (order) => {
    return order.services?.some(service =>
      service.service?.code?.startsWith('DENTAL_') ||
      service.investigationType?.name?.toLowerCase().includes('dental')
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Scan className="h-6 w-6 mr-2" />
          Radiology Orders
        </h1>
        <button
          onClick={fetchOrders}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Status Filter */}
      <div className="mb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Filter by Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="PENDING">Pending Orders</option>
            <option value="COMPLETED">Completed Orders</option>
            <option value="ALL">All Orders</option>
          </select>
          <span className="text-sm text-gray-500">
            Showing {getFilteredOrders().length} of {orders.length} orders
          </span>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patient name, patient ID, or order ID"
            className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {getFilteredOrders().length === 0 ? (
        <div className="text-center py-12">
          <Scan className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {statusFilter === 'PENDING' ? 'No pending radiology orders found' :
              statusFilter === 'COMPLETED' ? 'No completed radiology orders found' :
                'No radiology orders found'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {getFilteredOrders().map((order) => (
            <div
              key={`${order.__kind || (order.isWalkIn ? 'walkin' : 'batch')}-${order.id}`}
              className={`bg-white rounded-lg shadow-md border p-6 cursor-pointer hover:shadow-lg transition-shadow duration-200 ${order.status === 'QUEUED' ? 'border-yellow-200' :
                order.status === 'COMPLETED' ? 'border-green-200' : 'border-gray-200'
                }`}
              onClick={() => handleOrderClick(order)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(order.status)}
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Order {formatDisplayOrderId(order)} - {order.patient.name}
                      </h3>
                      {isDentalOrder(order) && (
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                          🦷 Dental
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {order.services
                        ?.filter(service => service.investigationType?.category === 'RADIOLOGY')
                        .map(service => service.investigationType?.name)
                        .join(', ') || order.type?.name || 'Radiology Test'}
                      {order.isWalkIn && <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded">WALK-IN</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {order.status === 'COMPLETED' && (
                    <button
                      onClick={(e) => handlePrintResults(e, order)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
                      title="Print results (findings and conclusion only, no images)"
                    >
                      <Printer className="h-4 w-4" />
                      Print
                    </button>
                  )}
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <User className="h-4 w-4 mr-2" />
                  <span>{order.patient.name}</span>
                </div>
                {order.doctor && (
                  <div className="flex items-center">
                    <Stethoscope className="h-4 w-4 mr-2" />
                    <span>{order.doctor.fullname}</span>
                  </div>
                )}
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {(order.status === 'QUEUED' || order.status === 'COMPLETED') && (
                <div className={`mt-4 p-3 rounded-lg ${order.status === 'QUEUED' ? 'bg-yellow-50' : 'bg-green-50'
                  }`}>
                  <p className={`text-sm font-medium ${order.status === 'QUEUED' ? 'text-yellow-800' : 'text-green-800'
                    }`}>
                    {order.status === 'QUEUED' ? 'Click to process tests' : 'Click to view results'}
                  </p>
                </div>
              )}

              {order.instructions && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Instructions:</strong> {order.instructions}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Report Form Modal - Larger size */}
      {showReportForm && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Radiology Results - Order {formatDisplayOrderId(selectedOrder)}
              </h2>
              <button
                onClick={() => {
                  setShowReportForm(false);
                  setSelectedOrder(null);
                  setTestResults({});
                  setExpandedTests({});
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Patient Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>Name:</strong> {selectedOrder.patient.name}</div>
                  <div><strong>Type:</strong> {selectedOrder.patient.type}</div>
                  <div><strong>Mobile:</strong> {selectedOrder.patient.mobile}</div>
                  <div><strong>Email:</strong> {selectedOrder.patient.email}</div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Radiology Tests</h3>
                {(() => {
                  // Build services array - handle both batch and walk-in orders
                  let services = [];

                  // First, try to use services array (for batch orders and grouped walk-in orders)
                  if (selectedOrder.services && Array.isArray(selectedOrder.services) && selectedOrder.services.length > 0) {
                    services = selectedOrder.services;
                    console.log(`✅ [Modal] Using services array (${services.length} services)`);
                  }
                  // If no services array, try to build from type (for single walk-in orders)
                  else if (selectedOrder.type) {
                    console.log(`⚠️  [Modal] No services array found, building from type:`, selectedOrder.type);
                    services = [{
                      investigationType: selectedOrder.type,
                      id: selectedOrder.id,
                      type: selectedOrder.type  // Also add as 'type' for compatibility
                    }];
                  }
                  // Last resort: if order has a __kind marker, try to reconstruct
                  else if (selectedOrder.__kind === 'walkin') {
                    console.log(`⚠️  [Modal] Walk-in order detected but no services/type found`);
                    services = [];
                  }

                  console.log(`🔍 [Modal] Rendering services for order ${selectedOrder.id}:`, {
                    isWalkIn: selectedOrder.isWalkIn,
                    hasServices: !!selectedOrder.services,
                    servicesArrayLength: selectedOrder.services?.length || 0,
                    servicesCount: services.length,
                    selectedOrderStructure: {
                      id: selectedOrder.id,
                      services: selectedOrder.services,
                      type: selectedOrder.type,
                      isWalkIn: selectedOrder.isWalkIn
                    },
                    services: services.map(s => ({
                      id: s.id,
                      investigationType: s.investigationType?.name || 'N/A',
                      testTypeId: s.investigationType?.id || s.type?.id || 'N/A',
                      category: s.investigationType?.category || s.type?.category || 'N/A'
                    })),
                    testResultsKeys: Object.keys(testResults)
                  });

                  if (services.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500 border rounded-lg p-4">
                        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                        <p className="font-medium">No radiology tests found in this order.</p>
                        <p className="text-sm mt-2">Order ID: {formatDisplayOrderId(selectedOrder)}</p>
                        <p className="text-sm">Is Walk-In: {selectedOrder.isWalkIn ? 'Yes' : 'No'}</p>
                        <p className="text-sm">Has Services Array: {selectedOrder.services ? 'Yes' : 'No'}</p>
                        <p className="text-sm">Services Count: {selectedOrder.services?.length || 0}</p>
                        <p className="text-sm">Has Type: {selectedOrder.type ? 'Yes' : 'No'}</p>
                        <p className="text-xs text-gray-400 mt-2">Check browser console for more details.</p>
                      </div>
                    );
                  }

                  const filteredServices = services.filter(service => {
                    const testType = service.investigationType || service.type || selectedOrder.type;
                    const isRadiology = testType && testType.category === 'RADIOLOGY';
                    if (!isRadiology) {
                      console.warn(`⚠️  Filtering out non-radiology service:`, {
                        serviceId: service.id,
                        testTypeName: testType?.name,
                        category: testType?.category
                      });
                    }
                    return isRadiology;
                  });

                  if (filteredServices.length === 0) {
                    return (
                      <div className="text-center py-8 text-yellow-500 border border-yellow-300 rounded-lg p-4 bg-yellow-50">
                        <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                        <p className="font-medium">No radiology tests found (all filtered out).</p>
                        <p className="text-sm mt-2">Total services: {services.length}</p>
                        <p className="text-xs text-gray-500 mt-2">Check console for details about each service.</p>
                      </div>
                    );
                  }

                  return filteredServices.map((service, index) => {
                    const testType = service.investigationType || service.type || selectedOrder.type;
                    const testId = testType?.id || testType?.typeId;

                    if (!testId) {
                      console.warn(`⚠️  No test ID found for service:`, service);
                      return null;
                    }

                    const testResult = testResults[testId] || {};
                    const isExpanded = expandedTests[testId];
                    const isCompleted = testResult.completed;
                    const isReadOnly = isCompleted && !isEditMode;

                    return (
                      <div key={`${testId}-${index}`} className="border rounded-lg p-4">
                        <div
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => toggleTestExpansion(testId)}
                        >
                          <div className="flex items-center space-x-3">
                            <div>
                              <h4 className="font-medium text-gray-900">
                                {testType?.name || 'Radiology Test'}
                              </h4>
                              <p className="text-sm text-gray-600">
                                {testType?.price?.toFixed(2) || '0.00'} ETB
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {isCompleted && (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            )}
                            <span className="text-sm text-gray-500">
                              {isExpanded ? 'Collapse' : 'Expand'}
                            </span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-4 space-y-6">
                            {/* Clinical Indication Section */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Clinical Indication
                              </label>
                              <textarea
                                value={testResult.clinicalIndication || ''}
                                onChange={(e) => updateTestResult(testId, 'clinicalIndication', e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                rows={3}
                                placeholder="Reason for the examination..."
                                disabled={isReadOnly}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Reason for the examination. Pre-filled from template, edit as needed.
                              </p>
                            </div>

                            {/* Technique Section */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Technique
                              </label>
                              <textarea
                                value={testResult.technique || ''}
                                onChange={(e) => updateTestResult(testId, 'technique', e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                rows={3}
                                placeholder="Procedure description, views obtained, contrast used..."
                                disabled={isReadOnly}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Description of the imaging procedure performed. Pre-filled from template, edit as needed.
                              </p>
                            </div>

                            {/* Comparison Section */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Comparison
                              </label>
                              <textarea
                                value={testResult.comparison || ''}
                                onChange={(e) => updateTestResult(testId, 'comparison', e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                rows={2}
                                placeholder="Prior studies for comparison, if any..."
                                disabled={isReadOnly}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Relevant prior imaging studies for comparison.
                              </p>
                            </div>

                            {/* Findings Section */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Findings
                              </label>
                              <textarea
                                value={testResult.findings || ''}
                                onChange={(e) => updateTestResult(testId, 'findings', e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                rows={12}
                                placeholder="Findings will be pre-filled from template. Edit as needed..."
                                disabled={isReadOnly}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Detailed radiologic observations. Template text pre-loaded. Edit as needed.
                              </p>
                            </div>

                            {/* Conclusion Section */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Conclusion / Impression
                              </label>
                              <textarea
                                value={testResult.conclusion || ''}
                                onChange={(e) => updateTestResult(testId, 'conclusion', e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                rows={6}
                                placeholder="Conclusion will be pre-filled from template. Edit as needed..."
                                disabled={isReadOnly}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Summary interpretation and diagnosis. Template text pre-loaded. Edit as needed.
                              </p>
                            </div>

                            {/* Recommendations Section */}
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Recommendations
                              </label>
                              <textarea
                                value={testResult.recommendations || ''}
                                onChange={(e) => updateTestResult(testId, 'recommendations', e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                rows={3}
                                placeholder="Follow-up recommendations, if any..."
                                disabled={isReadOnly}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Recommended follow-up studies or clinical actions.
                              </p>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Attachments
                              </label>
                              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                                <input
                                  type="file"
                                  onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                      handleFileUpload(testId, file);
                                    }
                                  }}
                                  className="hidden"
                                  id={`file-upload-${testId}`}
                                  disabled={isReadOnly}
                                />
                                <label
                                  htmlFor={`file-upload-${testId}`}
                                  className={`flex flex-col items-center justify-center py-4 cursor-pointer ${isReadOnly ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                                    }`}
                                >
                                  <Upload className="h-8 w-8 text-gray-400 mb-2" />
                                  <p className="text-sm text-gray-600">
                                    {uploadingFiles[testId] ? 'Uploading...' : 'Click to upload files'}
                                  </p>
                                </label>
                              </div>

                              {testResult.files && testResult.files.length > 0 && (
                                <div className="mt-3 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                  {testResult.files.map((file, fileIndex) => {
                                    const isImage = file.fileType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|tiff?)$/i.test(file.fileUrl || file.path || '');
                                    const src = getImageUrl(file.fileUrl || file.path || file.filePath);
                                    return (
                                      <div key={fileIndex}>
                                        {isImage ? (
                                          <div
                                            onClick={() => openImageViewer(testResult.files, fileIndex)}
                                            className="relative group cursor-pointer rounded-lg overflow-hidden border border-gray-200 hover:border-blue-400 transition-all"
                                          >
                                            <img
                                              src={src}
                                              alt={file.originalName || `Image ${fileIndex + 1}`}
                                              className="w-full h-24 object-cover"
                                              onError={(e) => {
                                                e.target.style.display = 'none';
                                                const fallback = e.target.parentElement.querySelector('.img-fallback');
                                                if (fallback) fallback.classList.remove('hidden');
                                              }}
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                              <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 bg-black/50 px-2 py-1 rounded">Click to view</span>
                                            </div>
                                            <div className="img-fallback hidden absolute inset-0 bg-gray-100 flex items-center justify-center rounded-lg">
                                              <div className="text-center text-gray-400">
                                                <Image className="h-6 w-6 mx-auto mb-1" />
                                                <span className="text-xs">Failed to load</span>
                                              </div>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-2 border border-gray-200">
                                            <FileText className="h-4 w-4 flex-shrink-0" />
                                            <span className="truncate">{file.originalName || 'File'}</span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Individual submit button removed - use batch submission only */}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowReportForm(false);
                    setSelectedOrder(null);
                    setTestResults({});
                    setExpandedTests({});
                    setIsEditMode(false);
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
                {selectedOrder.status === 'COMPLETED' ? (
                  <>
                    <button
                      onClick={(e) => handlePrintResults(e, selectedOrder)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                      <Printer className="h-4 w-4" />
                      Print
                    </button>
                    <button
                      onClick={() => setIsEditMode((prev) => !prev)}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 ${isEditMode ? 'bg-yellow-500 text-white hover:bg-yellow-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                    >
                      <Pencil className="h-4 w-4" />
                      {isEditMode ? 'Cancel Edit' : 'Edit'}
                    </button>
                    {isEditMode && (
                      <button
                        onClick={handleCompleteBatchOrder}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Update Results
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={handleCompleteBatchOrder}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Complete Batch Order
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ImageViewer
        isOpen={imageViewerOpen}
        onClose={closeImageViewer}
        images={imageViewerImages}
        currentIndex={imageViewerIndex}
      />
    </div>
  );
};

export default RadiologyOrders;
