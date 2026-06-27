import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  FileText, 
  CheckCircle, 
  Clock, 
  XCircle, 
  DollarSign,
  User,
  Calendar,
  Filter,
  Download,
  Eye
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { getServerUrl } from '../../utils/imageUrl';

const InsuranceDetail = () => {
  const { insuranceId } = useParams();
  const navigate = useNavigate();
  const [insurance, setInsurance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totals, setTotals] = useState({});

  useEffect(() => {
    if (insuranceId) {
      fetchInsuranceDetails();
      fetchTransactions();
    }
  }, [insuranceId, statusFilter, currentPage]);

  const fetchInsuranceDetails = async () => {
    try {
      // Try to get detailed data first
      try {
        const response = await api.get(`/insurance/companies/${insuranceId}/transactions?page=1&limit=1`);
        setInsurance(response.data.insurance);
        setTotals(response.data.totals);
      } catch (detailedError) {
        console.log('Detailed API not available, using basic insurance data');
        // Fallback to basic insurance data
        const basicResponse = await api.get('/admin/insurances');
        const basicInsurance = basicResponse.data.insurances.find(i => i.id === insuranceId);
        if (basicInsurance) {
          setInsurance(basicInsurance);
          setTotals({
            totalAmount: 0,
            pendingAmount: 0,
            collectedAmount: 0,
            totalTransactions: 0
          });
        }
      }
    } catch (error) {
      toast.error('Failed to fetch insurance details');
      console.error('Error fetching insurance details:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      try {
        const response = await api.get(`/insurance/companies/${insuranceId}/transactions?status=${statusFilter}&page=${currentPage}&limit=20`);
        setTransactions(response.data.transactions);
        setTotalPages(response.data.pagination.totalPages);
      } catch (detailedError) {
        console.log('Detailed transactions API not available');
        // Show empty transactions for now
        setTransactions([]);
        setTotalPages(1);
      }
    } catch (error) {
      toast.error('Failed to fetch transactions');
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTransactionStatus = async (transactionId, newStatus, claimNumber = null, transactionNumber = null) => {
    try {
      await api.put(`/insurance/transactions/${transactionId}/status`, {
        status: newStatus,
        claimNumber,
        transactionNumber
      });
      toast.success('Transaction status updated successfully');
      fetchTransactions();
    } catch (error) {
      toast.error('Failed to update transaction status');
      console.error('Error updating transaction status:', error);
    }
  };

  const generateReport = async (format = 'excel') => {
    try {
      const response = await api.get(`/insurance/companies/${insuranceId}/report`);
      const report = response.data.report;
      
      if (format === 'excel') {
        // Export to Excel (CSV)
        const headers = ['Patient Name', 'Patient ID', 'Visit ID', 'Service Type', 'Service Name', 'Service Code', 'Quantity', 'Unit Price (ETB)', 'Total Amount (ETB)', 'Status', 'Service Date', 'Claim Number'];
        const rows = report.transactions.map(t => [
          t.patientName || '-',
          t.patientId || '-',
          t.visitUid || '-',
          t.serviceType || '-',
          t.serviceName || '-',
          t.serviceCode || '-',
          t.quantity || 1,
          (t.unitPrice || 0).toFixed(2),
          (t.totalAmount || 0).toFixed(2),
          t.status || '-',
          new Date(t.serviceDate).toLocaleDateString(),
          t.claimNumber || '-'
        ]);

        const csvContent = [
          `Insurance Report for ${report.insurance.name}`,
          `Report Period: ${report.reportPeriod.startDate} to ${report.reportPeriod.endDate}`,
          `Generated: ${new Date(report.reportPeriod.generatedAt).toLocaleString()}`,
          `Total Transactions: ${report.summary.totalTransactions}`,
          `Total Amount: ETB ${report.summary.totalAmount.toFixed(2)}`,
          '',
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report.insurance.name}_Report_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success('Report exported to Excel');
      } else if (format === 'pdf') {
        // Export to PDF via backend
        const pdfResponse = await api.post(`/insurance/companies/${insuranceId}/export-pdf`, {
          report: report
        });
        
        const link = document.createElement('a');
        link.href = `${getServerUrl()}${pdfResponse.data.filePath}`;
        link.download = pdfResponse.data.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Report exported to PDF');
      } else {
        // Print
        handlePrintInsuranceReport(report);
      }
    } catch (error) {
      toast.error('Failed to generate report');
      console.error('Error generating report:', error);
    }
  };

  const handlePrintInsuranceReport = (report) => {
    const printWindow = window.open('', '_blank');
    const totalAmount = report.transactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Insurance Report - ${report.insurance.name}</title>
          <style>
            @media print {
              @page { margin: 20mm; }
            }
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              font-size: 11px;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            .clinic-name {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .report-title {
              font-size: 14px;
              color: #666;
              margin-bottom: 10px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
              font-size: 9px;
            }
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            .summary {
              margin-top: 20px;
              padding: 15px;
              background-color: #f9f9f9;
              border-radius: 5px;
            }
            .total-row {
              font-weight: bold;
              background-color: #f0f0f0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="clinic-name">${window.__CS__?.name || 'Clinic'}</div>
            <div class="report-title">Insurance Report - ${report.insurance.name}</div>
            <div>Period: ${report.reportPeriod.startDate} to ${report.reportPeriod.endDate}</div>
            <div>Generated: ${new Date(report.reportPeriod.generatedAt).toLocaleString()}</div>
          </div>
          <div class="summary">
            <h3>Summary</h3>
            <p><strong>Total Transactions:</strong> ${report.summary.totalTransactions}</p>
            <p><strong>Total Amount Owed:</strong> ETB ${totalAmount.toFixed(2)}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Patient Name</th>
                <th>Patient ID</th>
                <th>Visit ID</th>
                <th>Service</th>
                <th>Service Code</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${report.transactions.map(t => `
                <tr>
                  <td>${t.patientName || '-'}</td>
                  <td>${t.patientId || '-'}</td>
                  <td>${t.visitUid || '-'}</td>
                  <td>${t.serviceName || '-'}</td>
                  <td>${t.serviceCode || '-'}</td>
                  <td>${t.quantity || 1}</td>
                  <td>${(t.unitPrice || 0).toFixed(2)}</td>
                  <td>${(t.totalAmount || 0).toFixed(2)}</td>
                  <td>${t.status || '-'}</td>
                  <td>${new Date(t.serviceDate).toLocaleDateString()}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="7" style="text-align: right;">Total Amount Owed:</td>
                <td colspan="3">ETB ${totalAmount.toFixed(2)}</td>
              </tr>
              </tfoot>
          </table>
          <div style="margin-top: 30px; padding-top: 15px; border-top: 2px solid #000;">
            <div style="margin-bottom: 20px;">
              <div style="border-top: 1px solid #000; width: 200px; margin-bottom: 5px;"></div>
              <div style="font-size: 11px; margin-bottom: 5px;">Signature: _________________________</div>
              <div style="font-size: 11px;">Date: _________________________</div>
            </div>
            <div style="text-align: center; font-size: 10px; color: #666; margin-top: 20px;">
              <div>${window.__CS__?.name || 'Clinic'}</div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING': return 'text-yellow-600 bg-yellow-100';
      case 'SUBMITTED': return 'text-blue-600 bg-blue-100';
      case 'APPROVED': return 'text-green-600 bg-green-100';
      case 'COLLECTED': return 'text-green-700 bg-green-200';
      case 'REJECTED': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'PENDING': return <Clock className="h-4 w-4" />;
      case 'SUBMITTED': return <FileText className="h-4 w-4" />;
      case 'APPROVED': return <CheckCircle className="h-4 w-4" />;
      case 'COLLECTED': return <DollarSign className="h-4 w-4" />;
      case 'REJECTED': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (loading && !insurance) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!insurance) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Insurance company not found</p>
        <button onClick={() => navigate('/admin/insurances')} className="btn btn-primary mt-4">
          Back to Insurance Management
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/admin/insurances')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{insurance.name}</h2>
            <p className="text-gray-600">Code: {insurance.code}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => generateReport('excel')}
            className="btn btn-primary flex items-center"
          >
            <Download className="h-5 w-5 mr-2" />
            Export Excel
          </button>
          <button
            onClick={() => generateReport('pdf')}
            className="btn btn-primary flex items-center"
          >
            <Download className="h-5 w-5 mr-2" />
            Export PDF
          </button>
          <button
            onClick={() => generateReport('print')}
            className="btn btn-primary flex items-center"
          >
            <Download className="h-5 w-5 mr-2" />
            Print
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-full">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900">ETB {totals.totalAmount || 0}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-full">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-gray-900">ETB {totals.pendingAmount || 0}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Collected</p>
              <p className="text-2xl font-bold text-gray-900">ETB {totals.collectedAmount || 0}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-full">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Total Transactions</p>
              <p className="text-2xl font-bold text-gray-900">{totals.totalTransactions || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-500">Filter by status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input"
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
            <option value="COLLECTED">Collected</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {transaction.patient.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {transaction.patient.id}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {transaction.serviceName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {transaction.serviceCode} • {transaction.serviceType}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      ETB {transaction.totalAmount}
                    </div>
                    <div className="text-sm text-gray-500">
                      {transaction.quantity}x ETB {transaction.unitPrice}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                      {getStatusIcon(transaction.status)}
                      <span className="ml-1">{transaction.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(transaction.serviceDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      {transaction.status === 'PENDING' && (
                        <button
                          onClick={() => updateTransactionStatus(transaction.id, 'SUBMITTED')}
                          className="text-blue-600 hover:text-blue-800"
                          title="Mark as Submitted"
                        >
                          Submit
                        </button>
                      )}
                      {transaction.status === 'SUBMITTED' && (
                        <button
                          onClick={() => updateTransactionStatus(transaction.id, 'APPROVED')}
                          className="text-green-600 hover:text-green-800"
                          title="Mark as Approved"
                        >
                          Approve
                        </button>
                      )}
                      {transaction.status === 'APPROVED' && (
                        <button
                          onClick={() => updateTransactionStatus(transaction.id, 'COLLECTED')}
                          className="text-green-700 hover:text-green-900"
                          title="Mark as Collected"
                        >
                          Collect
                        </button>
                      )}
                      {transaction.status !== 'COLLECTED' && transaction.status !== 'REJECTED' && (
                        <button
                          onClick={() => updateTransactionStatus(transaction.id, 'REJECTED')}
                          className="text-red-600 hover:text-red-800"
                          title="Mark as Rejected"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="btn btn-outline btn-sm"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="btn btn-outline btn-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {transactions.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No transactions found</p>
        </div>
      )}
    </div>
  );
};

export default InsuranceDetail;
