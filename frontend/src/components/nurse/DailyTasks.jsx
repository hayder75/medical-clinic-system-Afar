import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  Pill,
  User,
  Stethoscope,
  FileText,
  ChevronRight,
  Eye,
  MessageSquare,
  Printer
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import ContinuousInfusionProgress from './ContinuousInfusionProgress';

const DailyTasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completedOrderData, setCompletedOrderData] = useState(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);

      // Fetch regular tasks from the unified endpoint
      const tasksResponse = await api.get('/nurses/today-tasks');
      const regularTasks = tasksResponse.data.tasks || [];

      // Fetch walk-in nurse orders
      try {
        const walkInResponse = await api.get('/nurses/walk-in-orders');
        const walkInOrders = walkInResponse.data.orders || [];

        // Convert walk-in orders to task format (matching regular task structure)
        const walkInTasks = walkInOrders.map(order => ({
          id: `walkin-${order.id}`,
          type: 'walkIn',
          patientId: order.patient.id,
          patientName: order.patient.name,
          visitId: null,
          visitUid: 'WALK-IN',
          totalAmount: order.service.price,
          totalPayments: order.status === 'PAID' ? order.service.price : 0,
          isFullyPaid: order.status === 'PAID',
          services: [{
            id: order.id,
            serviceId: order.service.id,
            serviceName: order.service.name,
            status: order.status,
            price: order.service.price
          }],
          orderType: 'WALK_IN',
          assignedBy: 'Walk-in Order',
          assignedByRole: 'NURSE',
          notes: order.notes || order.instructions,
          createdAt: order.createdAt,
          isWalkIn: true
        }));

        // Combine regular tasks and walk-in orders
        setTasks([...regularTasks, ...walkInTasks]);
      } catch (walkInError) {
        console.error('Error fetching walk-in orders:', walkInError);
        // If walk-in orders fail, just use regular tasks
        setTasks(regularTasks);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      console.error('Error details:', error.response?.data);
      console.error('Error status:', error.response?.status);
      toast.error('Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  const getOrderTypeBadge = (orderType, assignedByRole) => {
    if (orderType === 'DOCTOR_ORDERED' || assignedByRole === 'DOCTOR') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <Stethoscope className="h-3 w-3 mr-1" />
          Doctor Ordered
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <User className="h-3 w-3 mr-1" />
        Triage Ordered
      </span>
    );
  };

  const handleCompleteService = async () => {
    if (!selectedTask) return;

    try {
      // Check if this is a walk-in order
      if (selectedTask.isWalkIn) {
        const response = await api.post('/nurses/walk-in-orders/complete', {
          orderId: selectedTask.id.replace('walkin-', ''),
          notes: completionNotes
        });
        toast.success('Walk-in service order completed successfully!');
        // Store completed order data for printing
        setCompletedOrderData({
          ...response.data.order,
          completionNotes: completionNotes
        });
        // Don't close modal yet - allow printing
        setCompletionNotes('');
        fetchTasks(); // Refresh the list
        return;
      }

      // Check if this is a continuous infusion task
      if (selectedTask.type === 'continuousInfusion') {
        // For continuous infusions, show info message
        toast.success('Continuous infusion services remain active for daily tracking. Use the daily progress tracker to mark individual doses.');
        setShowTaskDetails(false);
        setSelectedTask(null);
        setCompletionNotes('');
        return;
      }

      // For regular nurse services, complete all pending services
      const pendingServices = selectedTask.services.filter(service => service.status === 'PENDING');

      if (pendingServices.length === 0) {
        toast.success('No pending services to complete');
        return;
      }

      // Complete each regular service
      for (const service of pendingServices) {
        await api.post('/nurses/complete-service', {
          assignmentId: service.id,
          notes: completionNotes
        });
      }

      toast.success(`${pendingServices.length} service(s) completed successfully!`);
      setShowTaskDetails(false);
      setSelectedTask(null);
      setCompletionNotes('');
      fetchTasks(); // Refresh the list
    } catch (error) {
      console.error('Error completing service:', error);
      toast.error('Failed to complete service');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING': return 'text-yellow-600 bg-yellow-100';
      case 'IN_PROGRESS': return 'text-blue-600 bg-blue-100';
      case 'COMPLETED': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'PENDING': return <Clock className="h-4 w-4" />;
      case 'IN_PROGRESS': return <AlertTriangle className="h-4 w-4" />;
      case 'COMPLETED': return <CheckCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handlePrintWalkInOrder = (orderData) => {
    if (!orderData) return;

    const printWindow = window.open('', '_blank');
    const currentDate = new Date();
    const formatDateForPrint = (date) => {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };
    const formatDateTime = (date) => {
      return date.toLocaleString('en-US');
    };

    // Get nurse name from current user
    const nurseName = user?.fullname || 'Nurse';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Nurse Report - ${orderData.patient?.name || 'Patient'}</title>
          <style>
            @media print {
              @page { 
                size: A4;
                margin: 10mm;
              }
              body { margin: 0; padding: 0; }
              .no-print { display: none; }
            }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 0; 
              padding: 10px;
              color: #333;
              line-height: 1.4;
            }
            .header { 
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding-bottom: 10px; 
              margin-bottom: 15px; 
              border-bottom: 2px solid #2563eb;
            }
            .header-left {
              display: flex;
              align-items: center;
              gap: 15px;
            }
            .logo {
              width: 60px;
              height: 60px;
              object-fit: contain;
            }
            .clinic-info {
              text-align: left;
            }
            .clinic-name { 
              font-size: 22px; 
              font-weight: 800; 
              margin: 0;
              color: #1e40af;
              letter-spacing: -0.5px;
            }
            .clinic-tagline {
              font-size: 11px;
              color: #64748b;
              margin: 0;
              font-style: italic;
            }
            .header-right {
              text-align: right;
            }
            .report-title { 
              font-size: 18px; 
              font-weight: 700; 
              margin: 0;
              color: #0f172a;
              text-transform: uppercase;
            }
            .report-info {
              font-size: 11px;
              color: #64748b;
              margin-top: 2px;
            }
            .patient-section {
              margin-bottom: 20px;
              padding: 12px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
            }
            .patient-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 15px;
            }
            .info-item {
              display: flex;
              flex-direction: column;
            }
            .info-label {
              font-size: 10px;
              font-weight: 600;
              color: #64748b;
              text-transform: uppercase;
            }
            .info-value {
              font-size: 12px;
              font-weight: 700;
              color: #1e293b;
            }
            .section-title {
              font-size: 14px;
              font-weight: 700;
              color: #1e40af;
              margin-bottom: 10px;
              padding-bottom: 5px;
              border-bottom: 1px solid #e2e8f0;
              text-transform: uppercase;
            }
            .service-details {
              margin-bottom: 20px;
            }
            .service-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
            }
            .service-table th, .service-table td {
              padding: 10px;
              border: 1px solid #e2e8f0;
              text-align: left;
            }
            .service-table th {
              background: #f1f5f9;
              font-size: 11px;
              font-weight: 700;
              color: #475569;
              text-transform: uppercase;
            }
            .service-table td {
              font-size: 12px;
            }
            .notes-section {
              margin-top: 15px;
              padding: 12px;
              background: #fffbeb;
              border: 1px solid #fef3c7;
              border-radius: 6px;
            }
            .notes-title {
              font-size: 11px;
              font-weight: 700;
              color: #92400e;
              margin-bottom: 5px;
              text-transform: uppercase;
            }
            .notes-content {
              font-size: 12px;
              color: #78350f;
              white-space: pre-wrap;
            }
            .footer {
              margin-top: 40px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .nurse-info {
              font-size: 12px;
            }
            .nurse-name {
              font-weight: 700;
              color: #1e293b;
            }
            .signature-area {
              text-align: center;
            }
            .signature-line {
              width: 200px;
              border-top: 1px solid #334155;
              margin-bottom: 5px;
            }
            .signature-label {
              font-size: 10px;
              color: #64748b;
              font-weight: 600;
            }
            .print-footer {
              text-align: center;
              font-size: 9px;
              color: #94a3b8;
              margin-top: 30px;
              border-top: 1px solid #f1f5f9;
              padding-top: 10px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-left">
              <img src="${window.__CS__?.logoUrl || '/clinic-logo.jpg'}" alt="Clinic Logo" class="logo" onerror="this.style.display='none'">
              <div class="clinic-info">
                <h1 class="clinic-name">${window.__CS__?.name || 'Clinic'}</h1>
                <p class="clinic-tagline">${window.__CS__?.tagline || 'Quality Healthcare You Can Trust'}</p>
              </div>
            </div>
            <div class="header-right">
              <h2 class="report-title">Nurse Service Report</h2>
              <div class="report-info">
                Date: ${formatDateForPrint(currentDate)}<br>
                Time: ${currentDate.toLocaleTimeString()}
              </div>
            </div>
          </div>

          <div class="patient-section">
            <div class="patient-grid">
              <div class="info-item">
                <span class="info-label">Patient Name</span>
                <span class="info-value">${orderData.patient?.name || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Phone Number</span>
                <span class="info-value">${orderData.patient?.mobile || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Order ID</span>
                <span class="info-value">#${orderData.id || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Status</span>
                <span class="info-value">${orderData.status || 'COMPLETED'}</span>
              </div>
            </div>
          </div>

          <div class="section-title">Service Details</div>
          <div class="service-details">
            <table class="service-table">
              <thead>
                <tr>
                  <th>Service Name</th>
                  <th>Description</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${orderData.service?.name || 'N/A'}</td>
                  <td>${orderData.service?.description || 'N/A'}</td>
                  <td>${orderData.service?.price?.toFixed(2) || '0.00'} ETB</td>
                </tr>
              </tbody>
            </table>

            ${orderData.notes ? `
              <div class="notes-section">
                <div class="notes-title">Instructions/Notes</div>
                <div class="notes-content">${orderData.notes}</div>
              </div>
            ` : ''}

            ${orderData.completionNotes ? `
              <div class="notes-section" style="margin-top: 10px; background: #f0fdf4; border-color: #dcfce7;">
                <div class="notes-title" style="color: #166534;">Completion Notes</div>
                <div class="notes-content" style="color: #14532d;">${orderData.completionNotes}</div>
              </div>
            ` : ''}
          </div>

          <div class="footer">
            <div class="nurse-info">
              Performed by:<br>
              <span class="nurse-name">${nurseName}</span><br>
              Nurse
            </div>
            <div class="signature-area">
              <div class="signature-line"></div>
              <div class="signature-label">Nurse's Signature & Stamp</div>
            </div>
          </div>

          <div class="print-footer">
            ${window.__CS__?.name || 'Clinic'} - Generated on ${new Date().toLocaleString()}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
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
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Daily Tasks</h1>
            <p className="text-gray-600 mt-1">Manage your assigned nurse services</p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Calendar className="h-4 w-4" />
            <span>{new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Tasks Grid */}
      {tasks.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Stethoscope className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks assigned</h3>
          <p className="text-gray-500">You don't have any nurse service tasks assigned for today.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasks.map((task) => (
            <div
              key={`${task.patientId}-${task.visitId}`}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => {
                setSelectedTask(task);
                setShowTaskDetails(true);
              }}
            >
              <div className="p-6">
                {/* Task Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Stethoscope className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{task.patientName}</h3>
                      <p className="text-sm text-gray-500">${task.totalAmount}</p>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${task.isFullyPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                    <CheckCircle className="h-3 w-3 inline mr-1" />
                    {task.isFullyPaid ? 'PAID' : 'PARTIAL'}
                  </div>
                </div>

                {/* Services List */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <FileText className="h-4 w-4" />
                    <span className="font-medium">{task.services.length} service(s)</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {task.services.map(service => service.serviceName).join(', ')}
                  </div>
                </div>

                {/* Patient Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <User className="h-4 w-4" />
                      <span className="font-medium">{task.patientName}</span>
                    </div>
                    {getOrderTypeBadge(task.orderType, task.assignedByRole)}
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>Visit: {task.visitUid}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <User className="h-4 w-4" />
                    <span>Assigned by: {task.assignedBy}</span>
                  </div>
                </div>

                {/* Notes */}
                {task.notes && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="flex items-start space-x-2">
                      <MessageSquare className="h-4 w-4 text-gray-400 mt-0.5" />
                      <p className="text-sm text-gray-700">{task.notes}</p>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <span className="text-xs text-gray-500">
                    {formatDate(task.createdAt)}
                  </span>
                  <div className="flex items-center space-x-1 text-blue-600 text-sm font-medium">
                    <span>View Details</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Task Details Modal */}
      {showTaskDetails && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Stethoscope className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedTask.patientName}</h2>
                    <p className="text-gray-600">${selectedTask.totalAmount} - {selectedTask.services.length} service(s)</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTaskDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Patient Information */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Patient Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <span className="ml-2 font-medium">{selectedTask.patientName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">{selectedTask.isWalkIn ? 'Order Type:' : 'Visit ID:'}</span>
                    <span className="ml-2 font-medium">{selectedTask.visitUid}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Assigned by:</span>
                    <span className="ml-2 font-medium">{selectedTask.assignedBy}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${selectedTask.isFullyPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                      {selectedTask.isFullyPaid ? 'PAID' : 'PARTIAL'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Payments:</span>
                    <span className="ml-2 font-medium">${selectedTask.totalPayments} / ${selectedTask.totalAmount}</span>
                  </div>
                  {selectedTask.isWalkIn && (
                    <div className="col-span-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Walk-in Order
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Service Details */}
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Service Details</h3>
                <div className="space-y-3">
                  {selectedTask.services.map((service, index) => (
                    <div key={service.id} className="bg-white rounded-lg p-3 border border-blue-200">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-gray-900">{service.serviceName}</h4>
                            {service.serviceCategory === 'DENTAL' && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                Dental
                              </span>
                            )}
                            {service.serviceCategory === 'NURSE' && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Nurse Service
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-medium text-blue-600">${service.servicePrice}</span>
                      </div>
                      <p className="text-sm text-gray-600">{service.serviceDescription}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${service.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                          {service.status}
                        </span>
                        {service.notes && (
                          <span className="text-xs text-gray-500">Notes: {service.notes}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Continuous Infusion Progress */}
              {selectedTask.type === 'continuousInfusion' && selectedTask.services.some(service =>
                service.serviceName.includes('Continuous Infusion')
              ) && (
                  <div className="mb-6">
                    <ContinuousInfusionProgress
                      infusion={selectedTask.services.find(service =>
                        service.serviceName.includes('Continuous Infusion')
                      )?.medicationOrder?.continuousInfusion}
                      onUpdate={fetchTasks}
                      visitId={selectedTask.visitId}
                      patientId={selectedTask.patientId}
                    />
                  </div>
                )}

              {/* Assignment Notes */}
              {selectedTask.notes && (
                <div className="bg-yellow-50 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Assignment Notes</h3>
                  <p className="text-sm text-gray-700">{selectedTask.notes}</p>
                </div>
              )}

              {/* Completion Form */}
              {selectedTask.services.some(service => service.status === 'PENDING') && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Complete Services</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Completion Notes
                    </label>
                    <textarea
                      value={completionNotes}
                      onChange={(e) => setCompletionNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={4}
                      placeholder="Add notes about the service completion..."
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setShowTaskDetails(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCompleteService}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>
                        {selectedTask?.type === 'continuousInfusion'
                          ? 'View Daily Tracker'
                          : 'Complete All Services'
                        }
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* Completed Status */}
              {(selectedTask.services.every(service => service.status === 'COMPLETED') || completedOrderData) && (
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2 text-green-800">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-semibold">All Services Completed</span>
                    </div>
                    {(selectedTask.isWalkIn && completedOrderData) && (
                      <button
                        onClick={() => handlePrintWalkInOrder(completedOrderData)}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Printer className="h-4 w-4" />
                        <span>Print</span>
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-green-700 mt-2">
                    All nurse services for this patient have been completed successfully.
                  </p>
                  {completedOrderData?.completionNotes && (
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <p className="text-sm font-medium text-green-900 mb-1">Completion Notes:</p>
                      <p className="text-sm text-green-800">{completedOrderData.completionNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyTasks;