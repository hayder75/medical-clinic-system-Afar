import React, { useState, useEffect } from 'react';
import { Stethoscope, TrendingUp, Users, DollarSign, Eye, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';

const DoctorPerformance = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [dailyBreakdown, setDailyBreakdown] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchDoctorStats();
  }, [selectedPeriod]);

  useEffect(() => {
    if (selectedDoctor) {
      fetchDoctorDailyBreakdown(selectedDoctor.doctorId);
    }
  }, [selectedMonth, selectedYear]);

  const fetchDoctorStats = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/reports/doctor-performance?period=${selectedPeriod}`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching doctor performance stats:', error);
      toast.error('Failed to fetch doctor performance statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (doctor) => {
    setSelectedDoctor(doctor);
    setShowDetailsModal(true);
    fetchDoctorDailyBreakdown(doctor.doctorId);
  };

  const fetchDoctorDailyBreakdown = async (doctorId) => {
    try {
      const response = await api.get(`/admin/reports/doctor-daily-breakdown?doctorId=${doctorId}&year=${selectedYear}&month=${selectedMonth}`);
      setDailyBreakdown(response.data.dailyData || []);
    } catch (error) {
      console.error('Error fetching doctor daily breakdown:', error);
    }
  };

  const handleDayClick = (day) => {
    setSelectedDay(day);
    setSearchQuery(''); // Clear search when selecting a new day
  };
  
  // Filter patients based on search query
  const filteredPatients = selectedDay?.details?.filter(patient => 
    patient.patientName.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getMonthName = (monthIndex) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[monthIndex];
  };

  const navigateMonth = (direction) => {
    if (direction === 'prev') {
      if (selectedMonth === 0) {
        setSelectedMonth(11);
        setSelectedYear(selectedYear - 1);
      } else {
        setSelectedMonth(selectedMonth - 1);
      }
    } else {
      if (selectedMonth === 11) {
        setSelectedMonth(0);
        setSelectedYear(selectedYear + 1);
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    }
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = selectedYear;
    const month = selectedMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ key: `empty-${i}`, isEmpty: true });
    }
    
    // Add days of the month with revenue data
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayData = dailyBreakdown.find(d => d.date === dateStr);
      
      days.push({
        key: `day-${day}`,
        day,
        date: dateStr,
        revenue: dayData?.revenue || 0,
        patients: dayData?.patients || 0,
        details: dayData?.details || [],
        isEmpty: false
      });
    }
    
    return days;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/reports')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Doctor Performance</h1>
            <p className="text-sm text-gray-600">Track earnings and patient volumes by doctor</p>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          {['daily', 'weekly', 'monthly', 'yearly'].map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                selectedPeriod === period
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Total Earnings</h3>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.summary.totalConsultationFees)}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Avg Per Doctor</h3>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.summary.avgPerDoctor)}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-50 rounded-lg">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Total Patients</h3>
          <p className="text-2xl font-bold text-gray-900">{stats.summary.totalConsultations}</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-50 rounded-lg">
              <Stethoscope className="h-6 w-6 text-amber-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Top Performer</h3>
          <p className="text-lg font-bold text-gray-900">
            {stats.summary.topPerformer?.doctorName || 'N/A'}
          </p>
        </div>
      </div>

      {/* Doctors Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Doctor Performance Table</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Doctor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Consultation Fee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Patients
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Per Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.doctors.map((doctor, index) => (
                <tr key={doctor.doctorId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{doctor.doctorName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatCurrency(doctor.consultationFee || 0)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{doctor.totalPatients}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-green-600">{formatCurrency(doctor.totalRevenue)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatCurrency(doctor.avgPerPatient)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleViewDetails(doctor)}
                      className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedDoctor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedDoctor.doctorName} - Patient Details
              </h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4 grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Patients</p>
                  <p className="text-2xl font-bold text-blue-600">{selectedDoctor.totalPatients}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(selectedDoctor.totalRevenue)}</p>
                </div>
              </div>

              {/* Calendar View */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Daily Earnings</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigateMonth('prev')}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <span className="font-medium">{getMonthName(selectedMonth)} {selectedYear}</span>
                    <button
                      onClick={() => navigateMonth('next')}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                      {day}
                    </div>
                  ))}
                  {generateCalendarDays().map((day) => {
                    if (day.isEmpty) {
                      return <div key={day.key} className="p-3"></div>;
                    }
                    
                    const today = new Date();
                    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                    const isToday = day.date === todayStr;
                    
                    return (
                      <div
                        key={day.key}
                        onClick={() => handleDayClick(day)}
                        className={`p-3 rounded-lg transition-all border-2 relative cursor-pointer ${
                          day.revenue > 0 
                            ? 'hover:border-green-300 hover:shadow-sm'
                            : 'hover:border-gray-300 hover:shadow-sm'
                        } ${
                          isToday
                            ? 'bg-blue-50 border-blue-300 shadow-sm'
                            : day.revenue > 0
                              ? 'bg-white border-green-200'
                              : 'bg-gray-50 border-gray-100'
                        }`}
                      >
                        <div className={`text-sm font-semibold mb-1 ${isToday ? 'text-blue-700' : 'text-gray-800'}`}>
                          {day.day}
                        </div>
                        <div className="text-xs text-green-600">
                          {day.revenue > 0 ? (
                            <span>ETB {day.revenue.toLocaleString()}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </div>
                        {day.revenue > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-400 opacity-50"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Patient List for Selected Day - NO POPUP */}
              {selectedDay && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Patients on {formatDate(selectedDay.date)}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {selectedDay.revenue > 0 ? (
                          <>Total Revenue: {formatCurrency(selectedDay.revenue)} • {selectedDay.details?.length || 0} patient(s)</>
                        ) : (
                          <>No earnings for this day</>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedDay(null)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  
                  {selectedDay.details && selectedDay.details.length > 0 ? (
                    <>
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg mb-4">
                        <input
                          type="text"
                          placeholder="Search patient by name..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Patient Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Visit ID
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Amount
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredPatients.map((patient, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{patient.patientName}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500">#{patient.visitId}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-green-600">{formatCurrency(patient.amount)}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  patient.paymentStatus === 'PAID' 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {patient.paymentStatus}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredPatients.length === 0 && searchQuery && (
                        <div className="text-center py-8 text-gray-500">
                          No patients found matching "{searchQuery}"
                        </div>
                      )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
                      <Users className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-gray-600 font-medium">No patients on this day</p>
                      <p className="text-sm text-gray-500 mt-1">This doctor had no consultations on {formatDate(selectedDay.date)}</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Day Details Popup - OLD CODE TO REMOVE */}
              {false && popupDayData && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                      <h3 className="text-lg font-bold text-gray-900">
                        {formatDate(popupDayData.date)} - Patient Details
                      </h3>
                      <button
                        onClick={() => setShowDayPopup(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="p-6">
                      <div className="mb-4 bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">Total Revenue for this day</p>
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(popupDayData.revenue)}</p>
                      </div>
                      <div className="space-y-2">
                        {popupDayData.details.map((patient, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="font-medium text-gray-900">{patient.patientName}</p>
                              <p className="text-sm text-gray-500">Visit #{patient.visitId}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-green-600">{formatCurrency(patient.amount)}</p>
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                patient.paymentStatus === 'PAID' 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {patient.paymentStatus}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorPerformance;
