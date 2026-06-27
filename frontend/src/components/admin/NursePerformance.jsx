import React, { useEffect, useState } from 'react';
import { Activity, ChevronLeft, ChevronRight, CreditCard, Stethoscope, UserCheck, Users } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const NursePerformance = () => {
  const [stats, setStats] = useState(null);
  const [dailyBreakdown, setDailyBreakdown] = useState([]);
  const [selectedNurseId, setSelectedNurseId] = useState('');
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedDayDetails, setSelectedDayDetails] = useState(null);
  const [dayDetailsLoading, setDayDetailsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('daily');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchNurseStats();
  }, [selectedPeriod]);

  useEffect(() => {
    if (selectedNurseId) {
      fetchNurseDailyBreakdown(selectedNurseId);
    }
  }, [selectedNurseId, selectedMonth, selectedYear]);

  const fetchNurseStats = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/reports/nurse-performance?period=${selectedPeriod}`);
      const data = response.data || {};
      setStats(data);

      const nurses = data.nurses || [];
      if (nurses.length === 0) {
        setSelectedNurseId('');
        setDailyBreakdown([]);
        setSelectedDay(null);
        setSelectedDayDetails(null);
        return;
      }

      const existingSelectedId = nurses.find((nurse) => nurse.nurseId === selectedNurseId)?.nurseId;
      const defaultNurseId = existingSelectedId || nurses[0].nurseId;
      setSelectedNurseId(defaultNurseId);
      await fetchNurseDailyBreakdown(defaultNurseId);
    } catch (error) {
      console.error('Error fetching nurse performance:', error);
      toast.error('Failed to fetch nurse performance data');
    } finally {
      setLoading(false);
    }
  };

  const fetchNurseDailyBreakdown = async (nurseId) => {
    if (!nurseId) return;

    try {
      const response = await api.get(`/admin/reports/nurse-daily-breakdown?nurseId=${nurseId}&year=${selectedYear}&month=${selectedMonth}`);
      setDailyBreakdown(response.data.dailyData || []);
      setSelectedDay(null);
      setSelectedDayDetails(null);
    } catch (error) {
      console.error('Error fetching nurse daily breakdown:', error);
      toast.error('Failed to fetch nurse daily breakdown');
    }
  };

  const fetchNurseDayDetails = async (nurseId, date) => {
    if (!nurseId || !date) return;

    try {
      setDayDetailsLoading(true);
      const response = await api.get(`/admin/reports/nurse-day-details?nurseId=${nurseId}&date=${date}`);
      setSelectedDayDetails(response.data || null);
    } catch (error) {
      console.error('Error fetching nurse day details:', error);
      toast.error('Failed to load nurse day details');
      setSelectedDayDetails(null);
    } finally {
      setDayDetailsLoading(false);
    }
  };

  const handleDayClick = (day) => {
    const dayData = dailyBreakdown.find((d) => d.date === day.date);
    setSelectedDay(dayData || null);
    setSelectedDayDetails(null);
    fetchNurseDayDetails(selectedNurseId, day.date);
  };

  const getMonthName = (monthIndex) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[monthIndex];
  };

  const navigateMonth = (direction) => {
    if (direction === 'prev') {
      if (selectedMonth === 0) {
        setSelectedMonth(11);
        setSelectedYear((prev) => prev - 1);
      } else {
        setSelectedMonth((prev) => prev - 1);
      }
      return;
    }

    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB'
    }).format(amount || 0);
  };

  const formatBucketLabel = (key) => {
    return String(key || '')
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const generateCalendarDays = () => {
    const year = selectedYear;
    const month = selectedMonth;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ key: `empty-${i}`, isEmpty: true });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayData = dailyBreakdown.find((d) => d.date === dateStr);

      days.push({
        key: `day-${day}`,
        day,
        date: dateStr,
        triageCount: dayData?.triageCount || 0,
        regularServices: dayData?.regularServices || 0,
        regularRevenue: dayData?.regularRevenue || 0,
        walkInServices: dayData?.walkInServices || 0,
        walkInRevenue: dayData?.walkInRevenue || 0,
        paidServices: dayData?.paidServices || dayData?.servicesOrdered || 0,
        revenue: dayData?.revenue || 0,
        patients: dayData?.patients || 0,
        isEmpty: false
      });
    }

    return days;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <Stethoscope className="h-16 w-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Data Available</h3>
        <p className="text-gray-500">Unable to load nurse performance statistics.</p>
      </div>
    );
  }

  const selectedNurse = (stats.nurses || []).find((nurse) => nurse.nurseId === selectedNurseId) || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Nurse Performance Dashboard</h2>
          <p className="text-gray-600">Paid nurse services, triage activity, and daily money tracking</p>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Period Summary</h3>
        <div className="flex gap-2 mb-4">
          {['daily', 'weekly', 'monthly', 'yearly'].map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
                selectedPeriod === period ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
        <div className="text-center text-gray-600">
          <p>Period: {selectedPeriod}</p>
          <p className="text-sm mt-1">
            {(stats?.dateRange?.startDate || stats?.dateRange?.start) && new Date(stats?.dateRange?.startDate || stats?.dateRange?.start).toLocaleDateString()} -{' '}
            {(stats?.dateRange?.endDate || stats?.dateRange?.end) && new Date(stats?.dateRange?.endDate || stats?.dateRange?.end).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-emerald-100">
              <CreditCard className="h-6 w-6 text-emerald-700" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Paid Revenue</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(stats?.summary?.totalPaidRevenue || stats?.summary?.totalRevenue || 0)}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-blue-100">
              <UserCheck className="h-6 w-6 text-blue-700" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Paid Services</p>
              <p className="text-2xl font-semibold text-gray-900">{stats?.summary?.totalPaidServices || stats?.summary?.totalServicesOrdered || 0}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-cyan-100">
              <CreditCard className="h-6 w-6 text-cyan-700" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Walk-in Revenue</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(stats?.summary?.walkInRevenue || 0)}</p>
              <p className="text-xs text-gray-500 mt-1">{stats?.summary?.walkInServicesCount || 0} services</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-indigo-100">
              <Activity className="h-6 w-6 text-indigo-700" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Triages Done</p>
              <p className="text-2xl font-semibold text-gray-900">{stats?.summary?.totalTriages || 0}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-amber-100">
              <Users className="h-6 w-6 text-amber-700" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Nurses</p>
              <p className="text-2xl font-semibold text-gray-900">{stats?.nurses?.length || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Nurse Revenue List</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-xs text-gray-500 uppercase">
              <th className="py-2 pr-2">Nurse</th>
              <th className="py-2 pr-2">Triages</th>
              <th className="py-2 pr-2">Regular</th>
              <th className="py-2 pr-2">Walk-in</th>
              <th className="py-2 pr-2">Paid Services</th>
              <th className="py-2 pr-2">Patients</th>
              <th className="py-2 pr-2">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {(stats.nurses || []).map((nurse) => (
              <tr
                key={`nurse-row-${nurse.nurseId}`}
                className={`border-b last:border-b-0 cursor-pointer ${selectedNurseId === nurse.nurseId ? 'bg-teal-50' : 'hover:bg-gray-50'}`}
                onClick={() => setSelectedNurseId(nurse.nurseId)}
              >
                <td className="py-3 pr-2 text-sm font-medium text-gray-900">{nurse.nurseName}</td>
                <td className="py-3 pr-2 text-sm text-gray-700">{nurse.triageCount || 0}</td>
                <td className="py-3 pr-2 text-sm text-gray-700">{nurse.regularServicesCount || 0}</td>
                <td className="py-3 pr-2 text-sm text-cyan-700 font-semibold">{nurse.walkInServicesCount || 0}</td>
                <td className="py-3 pr-2 text-sm text-gray-700">{nurse.totalPaidServices || nurse.totalServicesOrdered || 0}</td>
                <td className="py-3 pr-2 text-sm text-gray-700">{nurse.totalPatients || 0}</td>
                <td className="py-3 pr-2 text-sm font-semibold text-emerald-700">{formatCurrency(nurse.totalPaidRevenue || nurse.totalRevenue || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button onClick={() => navigateMonth('prev')} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h3 className="text-xl font-semibold text-gray-900">
              {getMonthName(selectedMonth)} {selectedYear}
            </h3>
            <button onClick={() => navigateMonth('next')} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Selected Nurse Paid Revenue ({getMonthName(selectedMonth)})</p>
            <p className="text-2xl font-bold text-emerald-700">{formatCurrency(selectedNurse?.totalPaidRevenue || selectedNurse?.totalRevenue || 0)}</p>
            <p className="text-xs text-cyan-700 mt-1">Walk-in: {formatCurrency(selectedNurse?.walkInRevenue || 0)}</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">Nurses</p>
          <div className="flex flex-wrap gap-2">
            {(stats.nurses || []).map((nurse) => (
              <button
                key={nurse.nurseId}
                onClick={() => setSelectedNurseId(nurse.nurseId)}
                className={`px-5 py-3 rounded-xl border text-base font-semibold transition-colors ${
                  selectedNurseId === nurse.nurseId
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-teal-300 hover:text-teal-700'
                }`}
              >
                {nurse.nurseName}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-500 bg-gray-50 rounded-lg">
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
            const isActive = selectedDay?.date === day.date;

            return (
              <div key={day.key} className="relative group">
                <div
                  onClick={() => handleDayClick(day)}
                  className={`relative p-3 rounded-lg cursor-pointer transition-all duration-200 border-2 ${
                    isActive
                      ? 'bg-teal-50 border-teal-500 shadow-md ring-2 ring-teal-100'
                      : isToday
                        ? 'bg-blue-50 border-blue-300 shadow-sm'
                        : day.revenue > 0 || day.triageCount > 0 || day.paidServices > 0
                          ? 'bg-white border-teal-200 hover:border-teal-300 hover:shadow-sm'
                          : 'bg-white border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className={`text-sm font-semibold mb-1 ${isToday ? 'text-blue-700' : 'text-gray-800'}`}>
                    {day.day}
                  </div>

                  <div className="text-xs text-emerald-700 font-medium">
                    {day.revenue > 0 ? `ETB ${day.revenue.toLocaleString()}` : '-'}
                  </div>

                  {day.paidServices > 0 && <div className="text-[10px] text-gray-600 mt-1">{day.paidServices} paid</div>}
                  {day.walkInServices > 0 && <div className="text-[10px] text-cyan-700 mt-1">{day.walkInServices} walk-in</div>}
                  {day.triageCount > 0 && <div className="text-[10px] text-blue-600 mt-1">{day.triageCount} triage</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-lg font-semibold text-gray-900">
                {selectedNurse?.nurseName || 'Nurse'} - {new Date(selectedDay.date).toLocaleDateString()}
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                Triages: {selectedDay.triageCount || 0} | Regular: {selectedDay.regularServices || 0} | Walk-in: {selectedDay.walkInServices || 0} | Paid Services: {selectedDay.paidServices || selectedDay.servicesOrdered || 0} | Patients: {selectedDay.patients || 0}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Paid Revenue</p>
              <p className="text-xl font-bold text-emerald-700">{formatCurrency(selectedDay.revenue || 0)}</p>
              <p className="text-xs text-cyan-700 mt-1">Walk-in: {formatCurrency(selectedDay.walkInRevenue || 0)}</p>
            </div>
          </div>

          {dayDetailsLoading ? (
            <div className="text-sm text-gray-500">Loading nurse day details...</div>
          ) : selectedDayDetails ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border bg-gray-50">
                  <p className="text-sm text-gray-600">Triaged Visits</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedDayDetails?.summary?.triageCount || 0}</p>
                </div>
                <div className="p-3 rounded-lg border bg-gray-50">
                  <p className="text-sm text-gray-600">Regular Services</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedDayDetails?.summary?.regularPaidServices || 0}</p>
                </div>
                <div className="p-3 rounded-lg border bg-gray-50">
                  <p className="text-sm text-gray-600">Walk-in Services</p>
                  <p className="text-lg font-semibold text-cyan-700">{selectedDayDetails?.summary?.walkInPaidServices || 0}</p>
                </div>
                <div className="p-3 rounded-lg border bg-gray-50">
                  <p className="text-sm text-gray-600">Patients</p>
                  <p className="text-lg font-semibold text-gray-900">{selectedDayDetails?.summary?.patients || 0}</p>
                </div>
                <div className="p-3 rounded-lg border bg-gray-50">
                  <p className="text-sm text-gray-600">Revenue</p>
                  <p className="text-lg font-semibold text-emerald-700">{formatCurrency(selectedDayDetails?.summary?.revenue || 0)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border bg-emerald-50">
                  <p className="text-sm text-emerald-700">Regular Revenue</p>
                  <p className="text-lg font-semibold text-emerald-800">{formatCurrency(selectedDayDetails?.summary?.regularRevenue || 0)}</p>
                </div>
                <div className="p-3 rounded-lg border bg-cyan-50">
                  <p className="text-sm text-cyan-700">Walk-in Revenue</p>
                  <p className="text-lg font-semibold text-cyan-800">{formatCurrency(selectedDayDetails?.summary?.walkInRevenue || 0)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(selectedDayDetails?.summary?.categoryBreakdown || {}).map(([key, value]) => (
                  <div key={`nurse-cat-${key}`} className="p-3 rounded-lg border bg-gray-50">
                    <p className="text-base font-semibold text-gray-800 leading-tight">{formatBucketLabel(key)}</p>
                    <p className="text-lg font-semibold text-gray-900">{formatCurrency(value || 0)}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-xs text-gray-500 uppercase">
                      <th className="py-2 pr-2">Type</th>
                      <th className="py-2 pr-2">Patient</th>
                      <th className="py-2 pr-2">Visit</th>
                      <th className="py-2 pr-2">Service</th>
                      <th className="py-2 pr-2">Category</th>
                      <th className="py-2 pr-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedDayDetails.details || []).map((row, idx) => (
                      <tr key={`${row.billingId}-${row.serviceId}-${idx}`} className="border-b last:border-b-0">
                        <td className="py-3 pr-2 text-xs">
                          <span className={`px-2 py-1 rounded-full font-semibold ${row.sourceType === 'WALK_IN' ? 'bg-cyan-100 text-cyan-800' : 'bg-gray-100 text-gray-700'}`}>
                            {row.sourceType === 'WALK_IN' ? 'Walk-in' : 'Regular'}
                          </span>
                        </td>
                        <td className="py-3 pr-2 text-sm text-gray-800">{row.patientName}</td>
                        <td className="py-3 pr-2 text-sm text-gray-600">{row.visitId || '-'}</td>
                        <td className="py-3 pr-2 text-sm text-gray-700">{row.serviceName}</td>
                        <td className="py-3 pr-2 text-sm text-gray-600">{formatBucketLabel(row.serviceCategory)}</td>
                        <td className="py-3 pr-2 text-sm font-semibold text-emerald-700">{formatCurrency(row.amount || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">No paid nurse services found for this day.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default NursePerformance;
