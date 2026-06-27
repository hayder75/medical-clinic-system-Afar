import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { 
  Scan,
  Calendar, 
  TrendingUp, 
  Users, 
  DollarSign, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Printer,
  Filter,
  X
} from 'lucide-react';
const AdminRadiologyReports = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [dateRange, setDateRange] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 7;

  useEffect(() => {
    fetchReport();
  }, [dateRange, selectedDate]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      
      let startDate, endDate;
      const selected = new Date(selectedDate);
      
      if (dateRange === 'daily') {
        startDate = new Date(selected);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(selected);
        endDate.setHours(23, 59, 59, 999);
      } else if (dateRange === 'weekly') {
        const dayOfWeek = selected.getDay();
        startDate = new Date(selected);
        startDate.setDate(selected.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      } else if (dateRange === 'monthly') {
        startDate = new Date(selected.getFullYear(), selected.getMonth(), 1);
        endDate = new Date(selected.getFullYear(), selected.getMonth() + 1, 0, 23, 59, 59);
      }

      const response = await api.get('/radiologies/reports', {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          type: dateRange
        }
      });
      
      setReportData(response.data);
    } catch (error) {
      console.error('Error fetching radiology reports:', error);
      toast.error('Failed to fetch radiology reports');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ETB'
    }).format(amount || 0);
  };

  const navigateDate = (direction) => {
    const current = new Date(selectedDate);
    if (dateRange === 'daily') {
      current.setDate(current.getDate() + direction);
    } else if (dateRange === 'weekly') {
      current.setDate(current.getDate() + (direction * 7));
    } else {
      current.setMonth(current.getMonth() + direction);
    }
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const getDateRangeLabel = () => {
    if (dateRange === 'daily') {
      return formatDate(selectedDate);
    } else if (dateRange === 'weekly') {
      const start = new Date(selectedDate);
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${formatDate(start.toISOString().split('T')[0])} - ${formatDate(end.toISOString().split('T')[0])}`;
    } else {
      return new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };

  const handlePrintReport = () => {
    if (!reportData) return;
    
    const printWindow = window.open('', '_blank');
    
    const testSummary = {};
    reportData.tests?.forEach(test => {
      if (!testSummary[test.testName]) {
        testSummary[test.testName] = { 
          name: test.testName, 
          category: test.testCategory,
          count: 0, 
          completed: 0, 
          pending: 0 
        };
      }
      testSummary[test.testName].count++;
      if (test.status === 'COMPLETED') {
        testSummary[test.testName].completed++;
      } else {
        testSummary[test.testName].pending++;
      }
    });
    
    const summaryData = Object.values(testSummary).sort((a, b) => b.count - a.count);
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Radiology Report - ${getDateRangeLabel()}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
          .header h1 { font-size: 24px; margin-bottom: 5px; }
          .header p { font-size: 14px; color: #666; }
          .summary-grid { display: flex; justify-content: space-around; margin-bottom: 30px; }
          .summary-item { text-align: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px; min-width: 150px; }
          .summary-item .label { font-size: 12px; color: #666; text-transform: uppercase; }
          .summary-item .value { font-size: 28px; font-weight: bold; margin-top: 5px; }
          .section-title { font-size: 16px; font-weight: bold; margin: 25px 0 15px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; font-size: 13px; }
          th { background-color: #f5f5f5; font-weight: bold; }
          tr:hover { background-color: #fafafa; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }
          .total-row { font-weight: bold; background-color: #f9f9f9; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Medical Clinic Radiology Report</h1>
          <p>${dateRange.charAt(0).toUpperCase() + dateRange.slice(1)} Report: ${getDateRangeLabel()}</p>
          <p>Generated: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="summary-grid">
          <div class="summary-item">
            <div class="label">Total Orders</div>
            <div class="value">${reportData.summary?.totalTests || 0}</div>
          </div>
          <div class="summary-item">
            <div class="label">Walk-in Orders</div>
            <div class="value" style="color: #0891b2;">${reportData.summary?.walkInTests || 0}</div>
          </div>
          <div class="summary-item">
            <div class="label">Completed</div>
            <div class="value" style="color: green;">${reportData.summary?.completedTests || 0}</div>
          </div>
          <div class="summary-item">
            <div class="label">Pending</div>
            <div class="value" style="color: orange;">${reportData.summary?.pendingTests || 0}</div>
          </div>
          ${reportData.financialSummary ? `
          <div class="summary-item">
            <div class="label">Revenue</div>
            <div class="value" style="color: green;">${formatCurrency(reportData.financialSummary.totalRevenue)}</div>
          </div>
          <div class="summary-item">
            <div class="label">Walk-in Revenue</div>
            <div class="value" style="color: #0891b2;">${formatCurrency(reportData.financialSummary.walkInRevenue)}</div>
          </div>
          ` : ''}
        </div>
        
        <div class="section-title">Orders Summary (Grouped by Name)</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Order Name</th>
              <th>Category</th>
              <th style="text-align: center;">Total</th>
              <th style="text-align: center;">Completed</th>
              <th style="text-align: center;">Pending</th>
            </tr>
          </thead>
          <tbody>
            ${summaryData.map((test, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${test.name}</td>
                <td>${test.category}</td>
                <td style="text-align: center;">${test.count}</td>
                <td style="text-align: center; color: green;">${test.completed}</td>
                <td style="text-align: center; color: orange;">${test.pending}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3" style="text-align: right;"><strong>Grand Total</strong></td>
              <td style="text-align: center;"><strong>${summaryData.reduce((sum, t) => sum + t.count, 0)}</strong></td>
              <td style="text-align: center;"><strong>${summaryData.reduce((sum, t) => sum + t.completed, 0)}</strong></td>
              <td style="text-align: center;"><strong>${summaryData.reduce((sum, t) => sum + t.pending, 0)}</strong></td>
            </tr>
          </tbody>
        </table>
        
        <div class="footer">
          <p>This is a computer-generated report. Medical Clinic Management System.</p>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900">Access Denied</p>
          <p className="text-gray-500">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Scan className="h-8 w-8 text-indigo-600" />
              Radiology Reports
            </h1>
            <p className="text-gray-600 mt-1">View radiology order statistics and financial reports</p>
          </div>
          
          <button
            onClick={handlePrintReport}
            disabled={!reportData}
            className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="h-4 w-4" />
            Print Report
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex gap-2">
              {['daily', 'weekly', 'monthly'].map((type) => (
                <button
                  key={type}
                  onClick={() => setDateRange(type)}
                  className={`px-4 py-2 rounded-lg font-medium capitalize ${
                    dateRange === type
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateDate(-1)}
                className="p-2 rounded-lg hover:bg-gray-100 border"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              <div className="px-4 py-2 bg-gray-100 rounded-lg font-medium min-w-[200px] text-center">
                {getDateRangeLabel()}
              </div>
              
              <button
                onClick={() => navigateDate(1)}
                className="p-2 rounded-lg hover:bg-gray-100 border"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : reportData ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Orders</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                      {reportData.summary?.totalTests || 0}
                    </p>
                  </div>
                  <Scan className="h-10 w-10 text-indigo-500" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Walk-in Orders</p>
                    <p className="text-3xl font-bold text-cyan-600 mt-1">
                      {reportData.summary?.walkInTests || 0}
                    </p>
                  </div>
                  <Users className="h-10 w-10 text-cyan-500" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Completed</p>
                    <p className="text-3xl font-bold text-green-600 mt-1">
                      {reportData.summary?.completedTests || 0}
                    </p>
                  </div>
                  <CheckCircle className="h-10 w-10 text-green-500" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Pending</p>
                    <p className="text-3xl font-bold text-yellow-600 mt-1">
                      {reportData.summary?.pendingTests || 0}
                    </p>
                  </div>
                  <Clock className="h-10 w-10 text-yellow-500" />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Revenue Collected</p>
                    <p className="text-3xl font-bold text-green-600 mt-1">
                      {formatCurrency(reportData.financialSummary?.totalRevenue)}
                    </p>
                  </div>
                  <DollarSign className="h-10 w-10 text-green-500" />
                </div>
              </div>
            </div>

            {reportData.financialSummary && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 rounded-xl border border-green-200 p-4">
                  <p className="text-sm text-green-700 font-medium">Paid Orders</p>
                  <p className="text-2xl font-bold text-green-800 mt-1">
                    {reportData.financialSummary.paidCount}
                  </p>
                </div>
                <div className="bg-cyan-50 rounded-xl border border-cyan-200 p-4">
                  <p className="text-sm text-cyan-700 font-medium">Walk-in Revenue</p>
                  <p className="text-2xl font-bold text-cyan-800 mt-1">
                    {formatCurrency(reportData.financialSummary.walkInRevenue)}
                  </p>
                  <p className="text-xs text-cyan-700 mt-1">{reportData.financialSummary.walkInPaidCount || 0} paid</p>
                </div>
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                  <p className="text-sm text-blue-700 font-medium">Regular Revenue</p>
                  <p className="text-2xl font-bold text-blue-800 mt-1">
                    {formatCurrency(reportData.financialSummary.regularRevenue)}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">{reportData.financialSummary.regularPaidCount || 0} paid</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-600" />
                  Daily Breakdown
                </h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {reportData.byDate?.length > 0 ? (
                    reportData.byDate.map((day) => (
                      <div key={day.date} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{formatDate(day.date)}</p>
                          <p className="text-sm text-gray-500">
                            <span className="text-green-600">{day.completed} completed</span>
                            {' • '}
                            <span className="text-yellow-600">{day.pending} pending</span>
                            {' • '}
                            <span className="text-cyan-600">{day.walkIn || 0} walk-in</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-indigo-600">{day.total}</p>
                          <p className="text-xs text-gray-500">orders</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No data for this period</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-indigo-600" />
                  By Category
                </h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {reportData.byCategory?.length > 0 ? (
                    reportData.byCategory.map((cat) => (
                      <div 
                        key={cat.category} 
                        onClick={() => setSelectedCategory(cat)}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-indigo-50 cursor-pointer transition-colors"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{cat.category}</p>
                          <p className="text-sm text-gray-500">
                            {cat.completed} completed
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-indigo-600">{cat.total}</p>
                          <div className="w-20 h-2 bg-gray-200 rounded-full mt-1">
                            <div 
                              className="h-2 bg-indigo-600 rounded-full"
                              style={{ width: `${(cat.completed / cat.total) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No data for this period</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border p-6 lg:col-span-2">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  Orders Overview
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                    <p className="text-sm text-indigo-700 font-medium">Total Orders</p>
                    <p className="text-2xl font-bold text-indigo-800">{reportData.summary?.totalTests || 0}</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-700 font-medium">Completed</p>
                    <p className="text-2xl font-bold text-green-800">{reportData.summary?.completedTests || 0}</p>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-sm text-yellow-700 font-medium">Pending</p>
                    <p className="text-2xl font-bold text-yellow-800">{reportData.summary?.pendingTests || 0}</p>
                  </div>
                  <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                    <p className="text-sm text-cyan-700 font-medium">Walk-in</p>
                    <p className="text-2xl font-bold text-cyan-800">{reportData.summary?.walkInTests || 0}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6 mt-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Filter className="h-5 w-5 text-indigo-600" />
                Detailed Order List
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Patient</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Order</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Category</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Doctor</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Radiologist</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.tests?.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((test, idx) => (
                      <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          {new Date(test.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">
                          {test.patientName || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {test.testName}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs">
                            {test.testCategory}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {test.doctorName}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {test.processedBy || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            test.status === 'COMPLETED' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {test.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {reportData.tests?.length > ITEMS_PER_PAGE && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-500">
                      Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, reportData.tests.length)} of {reportData.tests.length} orders
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                      >
                        First
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      
                      {Array.from({ length: Math.ceil(reportData.tests.length / ITEMS_PER_PAGE) }, (_, i) => i + 1)
                        .filter(page => {
                          const totalPages = Math.ceil(reportData.tests.length / ITEMS_PER_PAGE);
                          return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                        })
                        .map((page, idx, arr) => (
                          <React.Fragment key={page}>
                            {idx > 0 && arr[idx - 1] !== page - 1 && (
                              <span className="px-2 text-gray-400">...</span>
                            )}
                            <button
                              onClick={() => setCurrentPage(page)}
                              className={`px-3 py-1 rounded text-sm ${
                                currentPage === page 
                                  ? 'bg-indigo-600 text-white' 
                                  : 'hover:bg-gray-100'
                              }`}
                            >
                              {page}
                            </button>
                          </React.Fragment>
                        ))}
                      
                      <button
                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(reportData.tests.length / ITEMS_PER_PAGE), p + 1))}
                        disabled={currentPage >= Math.ceil(reportData.tests.length / ITEMS_PER_PAGE)}
                        className="p-2 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setCurrentPage(Math.ceil(reportData.tests.length / ITEMS_PER_PAGE))}
                        disabled={currentPage >= Math.ceil(reportData.tests.length / ITEMS_PER_PAGE)}
                        className="px-3 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                      >
                        Last
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <Scan className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900">No Data Available</p>
            <p className="text-gray-500">Select a different date range to view reports</p>
          </div>
        )}
      </div>

      {selectedCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedCategory.category}</h3>
                  <p className="text-gray-500 mt-1">
                    {selectedCategory.total} total orders • {selectedCategory.completed} completed
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Order Name</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Count</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.tests
                    .filter(test => test.testCategory === selectedCategory.category)
                    .reduce((acc, test) => {
                      const existing = acc.find(t => t.testName === test.testName);
                      if (existing) {
                        existing.count++;
                        if (test.status === 'COMPLETED') existing.completedCount++;
                      } else {
                        acc.push({ 
                          testName: test.testName, 
                          count: 1, 
                          completedCount: test.status === 'COMPLETED' ? 1 : 0 
                        });
                      }
                      return acc;
                    }, [])
                    .sort((a, b) => b.count - a.count)
                    .map((test, idx) => (
                      <tr key={idx} className="border-t border-gray-100">
                        <td className="px-4 py-3 text-sm font-medium">{test.testName}</td>
                        <td className="px-4 py-3 text-sm text-center">{test.count}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                            {test.completedCount}/{test.count} completed
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => setSelectedCategory(null)}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminRadiologyReports;
