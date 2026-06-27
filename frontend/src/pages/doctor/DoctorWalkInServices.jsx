import React, { useState, useEffect } from 'react';
import {
  User,
  Phone,
  CheckCircle,
  Clock,
  Package,
  Printer,
  MessageSquare,
  Calendar,
  DollarSign,
  Stethoscope,
  ChevronRight
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const WalkInNurseOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completedOrderData, setCompletedOrderData] = useState(null);

  useEffect(() => {
    fetchOrders();
    // Refresh every 30 seconds
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/nurses/walk-in-orders');
      setOrders(response.data.orders || []);
    } catch (error) {
      console.error('Error fetching walk-in orders:', error);
      toast.error('Failed to fetch walk-in orders');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOrder = async () => {
    if (!selectedOrder) return;

    try {
      const response = await api.post('/nurses/walk-in-orders/complete', {
        orderId: selectedOrder.id,
        notes: completionNotes
      });

      toast.success('Walk-in service order completed successfully!');
      setCompletedOrderData({
        ...response.data.order,
        completionNotes: completionNotes
      });
      setCompletionNotes('');
      fetchOrders(); // Refresh the list
    } catch (error) {
      console.error('Error completing order:', error);
      toast.error(error.response?.data?.error || 'Failed to complete order');
    }
  };

  const handlePrintOrder = (orderData) => {
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
            <h1 className="text-2xl font-bold text-gray-900">Walk-in Nurse Service Orders</h1>
            <p className="text-gray-600 mt-1">Manage and complete walk-in nurse service orders</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-blue-600">{orders.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Walk-in Orders</h3>
          <p className="text-gray-600">No paid walk-in nurse service orders available at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => {
                setSelectedOrder(order);
                setShowOrderDetails(true);
                setCompletedOrderData(null);
              }}
            >
              <div className="p-6">
                {/* Order Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Package className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{order.patient?.name || 'Unknown Patient'}</h3>
                      <p className="text-sm text-gray-500">Order #{order.id}</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 inline mr-1" />
                    PAID
                  </span>
                </div>

                {/* Service Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Stethoscope className="h-4 w-4" />
                    <span className="font-medium">{order.service?.name || 'Nurse Service'}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Phone className="h-4 w-4" />
                    <span>{order.patient?.mobile || 'N/A'}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <DollarSign className="h-4 w-4" />
                    <span className="font-medium">{order.service?.price?.toFixed(2) || '0.00'} ETB</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(order.createdAt)}</span>
                  </div>
                </div>

                {/* Notes Preview */}
                {order.notes && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <div className="flex items-start space-x-2">
                      <MessageSquare className="h-4 w-4 text-gray-400 mt-0.5" />
                      <p className="text-sm text-gray-700 line-clamp-2">{order.notes}</p>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <span className="text-xs text-gray-500">
                    {order.nurse ? `Assigned to: ${order.nurse.fullname}` : 'Unassigned'}
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

      {/* Order Details Modal */}
      {showOrderDetails && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="shrink-0 p-6 pb-0 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedOrder.patient?.name || 'Unknown Patient'}</h2>
                  <p className="text-gray-600">Order #{selectedOrder.id} - {selectedOrder.service?.price?.toFixed(2) || '0.00'} ETB</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowOrderDetails(false);
                  setSelectedOrder(null);
                  setCompletedOrderData(null);
                  setCompletionNotes('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              {/* Patient Information */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Patient Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <span className="ml-2 font-medium">{selectedOrder.patient?.name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Phone:</span>
                    <span className="ml-2 font-medium">{selectedOrder.patient?.mobile || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Order ID:</span>
                    <span className="ml-2 font-medium">#{selectedOrder.id}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Date:</span>
                    <span className="ml-2 font-medium">{formatDate(selectedOrder.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {selectedOrder.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Price:</span>
                    <span className="ml-2 font-medium">{selectedOrder.service?.price?.toFixed(2) || '0.00'} ETB</span>
                  </div>
                </div>
              </div>

              {/* Service Details */}
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Service Details</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Service Name:</span>
                    <p className="text-sm text-gray-900 mt-1">{selectedOrder.service?.name || 'N/A'}</p>
                  </div>
                  {selectedOrder.service?.description && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">Description:</span>
                      <p className="text-sm text-gray-900 mt-1">{selectedOrder.service.description}</p>
                    </div>
                  )}
                  {selectedOrder.service?.code && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">Service Code:</span>
                      <p className="text-sm text-gray-900 mt-1">{selectedOrder.service.code}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Instructions/Notes */}
              {(selectedOrder.notes || selectedOrder.instructions) && (
                <div className="bg-yellow-50 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Instructions/Notes</h3>
                  <p className="text-sm text-gray-700">{selectedOrder.notes || selectedOrder.instructions}</p>
                </div>
              )}

              {/* Completion Form or Completed Status */}
              {selectedOrder.status === 'PAID' && !completedOrderData ? (
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Complete Service</h3>
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
                </div>
              ) : (selectedOrder.status === 'COMPLETED' || completedOrderData) && (
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2 text-green-800">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-semibold">Service Completed</span>
                    </div>
                    {(completedOrderData || selectedOrder.status === 'COMPLETED') && (
                      <button
                        onClick={() => handlePrintOrder(completedOrderData || selectedOrder)}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Printer className="h-4 w-4" />
                        <span>Print</span>
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-green-700 mt-2">
                    This walk-in service order has been completed successfully.
                  </p>
                  {completedOrderData?.completionNotes && (
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <p className="text-sm font-medium text-green-900 mb-1">Completion Notes:</p>
                      <p className="text-sm text-green-800">{completedOrderData.completionNotes}</p>
                    </div>
                  )}
                  {selectedOrder.completedAt && (
                    <p className="text-xs text-green-600 mt-2">
                      Completed on: {formatDate(selectedOrder.completedAt)}
                    </p>
                  )}
                </div>
              )}
            </div>{/* end scrollable content */}

            {/* Sticky footer */}
            <div className="shrink-0 border-t bg-white px-6 py-4 flex justify-end space-x-3">
              {selectedOrder.status === 'PAID' && !completedOrderData ? (
                <>
                  <button
                    onClick={() => {
                      setShowOrderDetails(false);
                      setSelectedOrder(null);
                      setCompletionNotes('');
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCompleteOrder}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Complete Service</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setShowOrderDetails(false);
                    setSelectedOrder(null);
                    setCompletedOrderData(null);
                    setCompletionNotes('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalkInNurseOrders;

