import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { 
  TestTube, 
  Calendar, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  ChevronLeft,
  ChevronRight,
  Printer,
  X
} from 'lucide-react';

const LabReports = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [dateRange, setDateRange] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCategory, setSelectedCategory] = useState(null);

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

      const response = await api.get('/labs/reports', {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          type: dateRange,
          technicianId: user.id // Only fetch this technician's data
        }
      });
      
      setReportData(response.data);
    } catch (error) {
      console.error('Error fetching lab reports:', error);
      toast.error('Failed to fetch lab reports');
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

  // Get only this technician's tests
  const myTests = reportData?.tests?.filter(t => t.processedBy === user.fullname) || [];

  const handlePrintReport = () => {
    if (!reportData || myTests.length === 0) return;
    
    // Group tests by name for summary
    const testSummary = {};
    myTests.forEach(test => {
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
    
    const printWindow = window.open('', '_blank');
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>My Lab Report - ${getDateRangeLabel()}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
          .header h1 { font-size: 24px; margin-bottom: 5px; }
          .header p { font-size: 14px; color: #666; }
          .summary-grid { display: flex; justify-content: space-around; margin-bottom: 30px; }
          .summary-item { text-align: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px; min-width: 120px; }
          .summary-item .label { font-size: 12px; color: #666; text-transform: uppercase; }
          .summary-item .value { font-size: 28px; font-weight: bold; margin-top: 5px; }
          .section-title { font-size: 16px; font-weight: bold; margin: 25px 0 15px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; font-size: 13px; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }
          .total-row { font-weight: bold; background-color: #f9f9f9; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>My Lab Report</h1>
          <p>${dateRange.charAt(0).toUpperCase() + dateRange.slice(1)} Report: ${getDateRangeLabel()}</p>
          <p>Technician: ${user.fullname}</p>
          <p>Generated: ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="summary-grid">
          <div class="summary-item">
            <div class="label">Total Tests</div>
            <div class="value">${myTests.length}</div>
          </div>
          <div class="summary-item">
            <div class="label">Completed</div>
            <div class="value" style="color: green;">${myTests.filter(t => t.status === 'COMPLETED').length}</div>
          </div>
          <div class="summary-item">
            <div class="label">Pending</div>
            <div class="value" style="color: orange;">${myTests.filter(t => t.status !== 'COMPLETED').length}</div>
          </div>
        </div>
        
        <div class="section-title">Tests Summary</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Test Name</th>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Lab Reports</h1>
          <p className="text-gray-600 mt-1">Your lab test statistics</p>
        </div>
        
        <button
          onClick={handlePrintReport}
          disabled={myTests.length === 0}
          className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Printer className="h-4 w-4" />
          Print Report
        </button>
      </div>

      {/* Date Controls */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* View Type */}
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

          {/* Date Navigation */}
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
          {/* Summary Cards - Only showing counts (no financial) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">My Total Tests</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {myTests.length}
                  </p>
                </div>
                <TestTube className="h-10 w-10 text-indigo-500" />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Completed</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">
                    {myTests.filter(t => t.status === 'COMPLETED').length}
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
                    {myTests.filter(t => t.status !== 'COMPLETED').length}
                  </p>
                </div>
                <Clock className="h-10 w-10 text-yellow-500" />
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              Tests By Category
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(() => {
                const byCategory = {};
                myTests.forEach(test => {
                  const cat = test.testCategory || 'Other';
                  if (!byCategory[cat]) {
                    byCategory[cat] = { category: cat, total: 0, completed: 0 };
                  }
                  byCategory[cat].total++;
                  if (test.status === 'COMPLETED') byCategory[cat].completed++;
                });
                return Object.values(byCategory).length > 0 ? (
                  Object.values(byCategory).map((cat) => (
                    <div 
                      key={cat.category} 
                      onClick={() => setSelectedCategory(cat)}
                      className="p-4 bg-gray-50 rounded-xl hover:bg-indigo-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-bold text-gray-900">{cat.category}</p>
                        <span className="text-2xl font-bold text-indigo-600">{cat.total}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full">
                        <div 
                          className="h-2 bg-green-500 rounded-full"
                          style={{ width: `${cat.total > 0 ? (cat.completed / cat.total) * 100 : 0}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{cat.completed} completed</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 col-span-3 text-center py-4">No tests processed in this period</p>
                );
              })()}
            </div>
          </div>

          {/* Daily Breakdown with Test Details */}
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-600" />
              Daily Breakdown
            </h3>
            <div className="space-y-4">
              {(() => {
                const byDate = {};
                myTests.forEach(test => {
                  const dateKey = new Date(test.createdAt).toISOString().split('T')[0];
                  if (!byDate[dateKey]) {
                    byDate[dateKey] = { date: dateKey, tests: {}, total: 0, completed: 0 };
                  }
                  const testName = test.testName || 'Unknown';
                  if (!byDate[dateKey].tests[testName]) {
                    byDate[dateKey].tests[testName] = { name: testName, count: 0, completed: 0 };
                  }
                  byDate[dateKey].tests[testName].count++;
                  byDate[dateKey].total++;
                  if (test.status === 'COMPLETED') {
                    byDate[dateKey].tests[testName].completed++;
                    byDate[dateKey].completed++;
                  }
                });
                const sortedDates = Object.values(byDate).sort((a, b) => new Date(b.date) - new Date(a.date));
                return sortedDates.length > 0 ? (
                  sortedDates.map((day) => (
                    <div key={day.date} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                        <div>
                          <p className="font-medium text-gray-900">{formatDate(day.date)}</p>
                          <p className="text-sm text-gray-500">
                            <span className="text-green-600">{day.completed} completed</span>
                            {' • '}
                            <span className="text-yellow-600">{day.total - day.completed} pending</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-indigo-600 text-xl">{day.total}</p>
                          <p className="text-xs text-gray-500">tests total</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {Object.values(day.tests).sort((a, b) => b.count - a.count).map((test) => (
                          <div key={test.name} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                            <span className="text-gray-700 truncate">{test.name}</span>
                            <span className="font-bold text-indigo-600 ml-2">{test.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No data for this period</p>
                );
              })()}
            </div>
          </div>

          {/* Test List */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              My Tests ({myTests.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Patient</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Test</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Category</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myTests.slice(0, 30).map((test, idx) => (
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
              {myTests.length > 30 && (
                <p className="text-center text-gray-500 py-4">
                  Showing 30 of {myTests.length} tests
                </p>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <TestTube className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-900">No Data Available</p>
          <p className="text-gray-500">Select a different date range to view reports</p>
        </div>
      )}

      {/* Category Drill-down Modal */}
      {selectedCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedCategory.category}</h3>
                  <p className="text-gray-500 mt-1">
                    {selectedCategory.total} total tests • {selectedCategory.completed} completed
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
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Test Name</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Count</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myTests
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
    </div>
  );
};

export default LabReports;
