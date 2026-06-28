import React, { useState, useEffect } from 'react';
import { Download, Calendar, TrendingUp, Users, CreditCard, ChevronLeft, ChevronRight, BarChart3, PieChart as PieChartIcon, DollarSign, Activity, Stethoscope } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { getServerUrl } from '../../utils/imageUrl';

const Reports = ({ revenueTypeOverride }) => {
  const navigate = useNavigate();
  const [revenueStats, setRevenueStats] = useState(null);
  const [dailyBreakdown, setDailyBreakdown] = useState([]);
  const [doctorStats, setDoctorStats] = useState(null);
  const [doctorOptions, setDoctorOptions] = useState([]);
  const [doctorDailyBreakdown, setDoctorDailyBreakdown] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedDoctorDay, setSelectedDoctorDay] = useState(null);
  const [selectedDoctorDayDetails, setSelectedDoctorDayDetails] = useState(null);
  const [doctorDayDetailsLoading, setDoctorDayDetailsLoading] = useState(false);
  const [billingStats, setBillingStats] = useState(null);
  const [billingDailyBreakdown, setBillingDailyBreakdown] = useState([]);
  const [selectedBillingUserId, setSelectedBillingUserId] = useState('');
  const [selectedBillingDay, setSelectedBillingDay] = useState(null);
  const [selectedBillingDayDetails, setSelectedBillingDayDetails] = useState(null);
  const [billingDayDetailsLoading, setBillingDayDetailsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('daily');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`);
  const [revenueType, setRevenueType] = useState(revenueTypeOverride || 'billing'); // medical, pharmacy, doctors, billing
  const [showDayPopup, setShowDayPopup] = useState(false);
  const [popupDayData, setPopupDayData] = useState(null);
  const [cardProducts, setCardProducts] = useState([]);

  useEffect(() => {
    api.get('/admin/card-products')
      .then(res => setCardProducts(res.data?.cardProducts || []))
      .catch(() => {});
  }, []);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const BUCKET_LABEL_OVERRIDES = {
    CONSULTATION_GENERAL: 'Consultation (Medical)'
  };
  (cardProducts || []).forEach(cp => {
    const slug = (cp.slug || '').toUpperCase();
    BUCKET_LABEL_OVERRIDES[`CARD_CREATED_${slug}`] = `${cp.name} Card Created`;
    BUCKET_LABEL_OVERRIDES[`CARD_REACTIVATION_${slug}`] = `${cp.name} Card Reactivation`;
  });

  const getDoctorPriority = (doctor) => {
    const specialty = doctor?.specialty;
    const qualifications = Array.isArray(doctor?.qualifications)
      ? doctor.qualifications.map((q) => String(q || '').toUpperCase())
      : [];
    const role = String(doctor?.role || '').toUpperCase();

    const hasDerm = specialty === 'dermatology' || role.includes('DERM') || qualifications.some((q) => q.includes('DERM'));
    const hasGeneral = specialty === 'general' || role === 'DOCTOR' || qualifications.some((q) => q.includes('GENERAL') || q.includes('GP') || q.includes('MEDICAL'));
    const hasHealthOfficer = specialty === 'healthOfficer' || qualifications.some((q) => q.includes('HEALTH OFFICER') || q.includes('HEALTH_OFFICER') || q === 'HO');

    if (hasDerm && !hasGeneral && !hasHealthOfficer) return 1;
    if (hasGeneral && !hasDerm && !hasHealthOfficer) return 2;
    if (hasDerm && hasGeneral && !hasHealthOfficer) return 3;
    if (hasHealthOfficer) return 4;
    return 5;
  };

  const sortDoctorsByPriority = (doctors) => {
    return [...(doctors || [])].sort((a, b) => {
      const priorityA = getDoctorPriority(a);
      const priorityB = getDoctorPriority(b);
      if (priorityA !== priorityB) return priorityA - priorityB;
      return String(a.doctorName || '').localeCompare(String(b.doctorName || ''));
    });
  };

  useEffect(() => {
    if (revenueType === 'doctors') {
      fetchDoctorStats();
      return;
    }

    if (revenueType === 'billing') {
      fetchBillingStats();
      return;
    }

    fetchRevenueStats();
    fetchDailyBreakdown();
  }, [selectedPeriod, selectedYear, selectedMonth, revenueType]);

  useEffect(() => {
    if (revenueType === 'doctors' && selectedDoctorId) {
      fetchSelectedDoctorStats(selectedDoctorId);
      fetchDoctorDailyBreakdown(selectedDoctorId);
    }
  }, [revenueType, selectedDoctorId, selectedMonth, selectedYear]);

  useEffect(() => {
    if (revenueType === 'billing' && selectedBillingUserId) {
      fetchBillingDailyBreakdown(selectedBillingUserId);
    }
  }, [revenueType, selectedBillingUserId, selectedMonth, selectedYear]);

  const fetchRevenueStats = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/reports/revenue-stats?period=${selectedPeriod}`);
      setRevenueStats(response.data);
    } catch (error) {
      console.error('Error fetching revenue stats:', error);
      toast.error('Failed to fetch revenue statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyBreakdown = async () => {
    try {
      const response = await api.get(`/admin/reports/daily-breakdown?year=${selectedYear}&month=${selectedMonth}`);
      setDailyBreakdown(response.data.dailyData || []);
    } catch (error) {
      console.error('Error fetching daily breakdown:', error);
    }
  };

  const fetchSelectedDoctorStats = async (doctorId) => {
    if (!doctorId) return;

    try {
      const response = await api.get(`/admin/reports/doctor-performance?period=${selectedPeriod}&doctorId=${doctorId}`);
      setDoctorStats(response.data || null);
    } catch (error) {
      console.error('Error fetching selected doctor performance:', error);
      toast.error('Failed to fetch selected doctor data');
    }
  };

  const fetchDoctorStats = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/reports/doctor-performance?period=${selectedPeriod}`);
      const data = response.data || {};

      const doctors = sortDoctorsByPriority(data.doctors || []);
      setDoctorOptions(doctors);

      if (doctors.length === 0) {
        setSelectedDoctorId('');
        setDoctorStats(null);
        setDoctorOptions([]);
        setDoctorDailyBreakdown([]);
        setSelectedDoctorDay(null);
        setSelectedDoctorDayDetails(null);
        return;
      }

      const selectedStillExists = doctors.some((d) => d.doctorId === selectedDoctorId);
      const defaultDoctorId = selectedStillExists ? selectedDoctorId : doctors[0].doctorId;
      setSelectedDoctorId(defaultDoctorId);
      await fetchSelectedDoctorStats(defaultDoctorId);
      await fetchDoctorDailyBreakdown(defaultDoctorId);
    } catch (error) {
      console.error('Error fetching doctor performance:', error);
      toast.error('Failed to fetch doctor performance data');
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctorDailyBreakdown = async (doctorId) => {
    if (!doctorId) return;

    try {
      const response = await api.get(`/admin/reports/doctor-daily-breakdown?doctorId=${doctorId}&year=${selectedYear}&month=${selectedMonth}`);
      const dailyData = response.data.dailyData || [];
      setDoctorDailyBreakdown(dailyData);

      const today = new Date();
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const selectedDateInMonth = selectedDate?.startsWith(`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-`)
        ? selectedDate
        : null;

      const initialDay =
        dailyData.find((d) => d.date === selectedDateInMonth) ||
        dailyData.find((d) => d.date === todayKey) ||
        dailyData.find((d) => (d.totalOrders || d.procedureOrders || 0) > 0 || (d.totalRevenue || d.revenue || 0) > 0 || (d.patients || 0) > 0) ||
        null;

      setSelectedDoctorDay(initialDay);
      setSelectedDoctorDayDetails(null);

      if (initialDay?.date) {
        setSelectedDate(initialDay.date);
        fetchDoctorDayDetails(doctorId, initialDay.date);
      }
    } catch (error) {
      console.error('Error fetching doctor daily breakdown:', error);
      toast.error('Failed to fetch doctor daily details');
    }
  };

  const fetchDoctorDayDetails = async (doctorId, date) => {
    if (!doctorId || !date) return;

    try {
      setDoctorDayDetailsLoading(true);
      const response = await api.get(`/admin/reports/doctor-day-details?doctorId=${doctorId}&date=${date}`);
      setSelectedDoctorDayDetails(response.data || null);
    } catch (error) {
      console.error('Error fetching doctor day details:', error);
      toast.error('Failed to load procedure list for selected day');
      setSelectedDoctorDayDetails(null);
    } finally {
      setDoctorDayDetailsLoading(false);
    }
  };

  const fetchBillingStats = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/reports/billing-performance?period=${selectedPeriod}`);
      const data = response.data || {};
      setBillingStats(data);

      const users = data.users || [];
      if (users.length === 0) {
        setSelectedBillingUserId('');
        setBillingDailyBreakdown([]);
        setSelectedBillingDay(null);
        setSelectedBillingDayDetails(null);
        return;
      }

      const defaultUserId = selectedBillingUserId || users[0].userId;
      setSelectedBillingUserId(defaultUserId);
      await fetchBillingDailyBreakdown(defaultUserId);
    } catch (error) {
      console.error('Error fetching billing performance stats:', error);
      toast.error('Failed to fetch billing performance data');
    } finally {
      setLoading(false);
    }
  };

  const fetchBillingDailyBreakdown = async (userId) => {
    if (!userId) return;

    try {
      const response = await api.get(`/admin/reports/billing-daily-breakdown?userId=${userId}&year=${selectedYear}&month=${selectedMonth}`);
      setBillingDailyBreakdown(response.data.dailyData || []);
      setSelectedBillingDay(null);
      setSelectedBillingDayDetails(null);
    } catch (error) {
      console.error('Error fetching billing daily breakdown:', error);
      toast.error('Failed to fetch billing daily breakdown');
    }
  };

  const fetchBillingDayDetails = async (userId, date) => {
    if (!userId || !date) return;

    try {
      setBillingDayDetailsLoading(true);
      const response = await api.get(`/admin/reports/billing-day-details?userId=${userId}&date=${date}`);
      setSelectedBillingDayDetails(response.data || null);
    } catch (error) {
      console.error('Error fetching billing day details:', error);
      toast.error('Failed to load billing day details');
      setSelectedBillingDayDetails(null);
    } finally {
      setBillingDayDetailsLoading(false);
    }
  };

  const getMonthName = (monthIndex) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[monthIndex];
  };

  const handleDayClick = (day) => {
    setSelectedDate(day.date);

    if (revenueType === 'doctors') {
      const dayData = doctorDailyBreakdown.find((d) => d.date === day.date);
      setSelectedDoctorDay(dayData || null);
      setSelectedDoctorDayDetails(null);
      fetchDoctorDayDetails(selectedDoctorId, day.date);
      return;
    }

    if (revenueType === 'billing') {
      const dayData = billingDailyBreakdown.find((d) => d.date === day.date);
      setSelectedBillingDay(dayData || null);
      setSelectedBillingDayDetails(null);
      fetchBillingDayDetails(selectedBillingUserId, day.date);
      return;
    }

    const dayData = dailyBreakdown.find(d => d.date === day.date);
    setPopupDayData({ ...day, dayData });
    setShowDayPopup(true);
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

  // Generate calendar days for the selected month
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
      let revenue = 0;
      let patients = 0;
      let procedureOrders = 0;

      if (revenueType === 'doctors') {
        const dayData = doctorDailyBreakdown.find((d) => d.date === dateStr);
        revenue = dayData?.totalRevenue || dayData?.revenue || dayData?.procedureRevenue || 0;
        patients = dayData?.patients || 0;
        procedureOrders = dayData?.totalOrders || dayData?.procedureOrders || 0;
      } else if (revenueType === 'billing') {
        const dayData = billingDailyBreakdown.find((d) => d.date === dateStr);
        revenue = dayData?.revenue || 0;
        patients = dayData?.transactions || 0;
      } else {
        const dayData = dailyBreakdown.find(d => d.date === dateStr);
        if (dayData) {
          revenue = dayData[revenueType]?.revenue || 0;
        }
      }

      days.push({
        key: `day-${day}`,
        day,
        date: dateStr,
        revenue,
        patients,
        procedureOrders,
        isEmpty: false
      });
    }

    return days;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB'
    }).format(amount);
  };

  const formatBucketLabel = (key) => {
    if (BUCKET_LABEL_OVERRIDES[key]) {
      return BUCKET_LABEL_OVERRIDES[key];
    }

    return String(key || '')
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const renderDoctorSectionTable = (section, title, emptyLabel, accentClasses = 'bg-indigo-50 text-indigo-700 border-indigo-100') => {
    if (!section) return null;

    return (
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h5 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{title}</h5>
          <div className="text-right">
            <p className="text-xs text-gray-500">Revenue</p>
            <p className="text-base font-semibold text-gray-900">{formatCurrency(section.revenue || 0)}</p>
          </div>
        </div>

        {section.details?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500 uppercase">
                  <th className="py-2 pr-2">Patient</th>
                  <th className="py-2 pr-2">Visit</th>
                  <th className="py-2 pr-2">Orders</th>
                  <th className="py-2 pr-2">Items</th>
                  <th className="py-2 pr-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {section.details.map((row, idx) => (
                  <tr key={`${title}-${row.visitId}-${idx}`} className="border-b last:border-b-0">
                    <td className="py-3 pr-2 text-sm text-gray-800">{row.patientName}</td>
                    <td className="py-3 pr-2 text-sm text-gray-600">{row.visitId}</td>
                    <td className="py-3 pr-2 text-sm text-gray-700">{row.ordersCount || row.items?.length || 0}</td>
                    <td className="py-3 pr-2 text-sm text-gray-700">
                      <div className="space-y-1">
                        {(row.items || []).map((item, itemIdx) => (
                          <div key={`${title}-${row.visitId}-item-${itemIdx}`} className="text-xs text-gray-600">
                            {item.serviceName} ({formatCurrency(item.amount || 0)})
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pr-2 text-sm font-semibold text-emerald-700">{formatCurrency(row.amount || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-gray-500">{emptyLabel}</div>
        )}

        {section.topItems?.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Top Items (Selected Day)</p>
            <div className="flex flex-wrap gap-2">
              {section.topItems.map((item, idx) => (
                <span key={`${title}-top-${idx}`} className={`px-2 py-1 rounded-full text-xs border ${accentClasses}`}>
                  {item.serviceName} - {item.count} ({formatCurrency(item.revenue || 0)})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const getDoctorDayRevenue = () => selectedDoctorDay?.totalRevenue || selectedDoctorDay?.revenue || 0;

  const getDoctorDayOrders = () => selectedDoctorDay?.totalOrders || selectedDoctorDay?.procedureOrders || 0;

  const getDoctorDayLabel = () => {
    if (!selectedDoctorDay?.date) return 'Doctor Ordered Revenue';

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (selectedDoctorDay.date === todayKey) {
      return "Today's Doctor Ordered Revenue";
    }

    return `Doctor Ordered Revenue (${new Date(selectedDoctorDay.date).toLocaleDateString()})`;
  };

  const getDoctorOrdersLabel = () => {
    if (!selectedDoctorDay?.date) return 'Doctor Orders';

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return selectedDoctorDay.date === todayKey ? "Today's Doctor Orders" : 'Doctor Orders (Selected Day)';
  };

  // Get revenue data based on selected type
  const getRevenueData = () => {
    if (revenueType === 'doctors') {
      return {
        revenue: getDoctorDayRevenue(),
        transactions: getDoctorDayOrders(),
        label: 'Doctors'
      };
    }

    if (revenueType === 'billing') {
      return {
        revenue: billingStats?.summary?.totalProcessedAmount || 0,
        transactions: billingStats?.summary?.totalTransactions || 0,
        label: 'Billing'
      };
    }

    if (!revenueStats) return { revenue: 0, transactions: 0 };

    switch (revenueType) {
      case 'medical':
        return {
          revenue: revenueStats.completed.medical.revenue,
          transactions: revenueStats.completed.medical.transactions,
          consultations: revenueStats.completed.medical.consultations,
          labTests: revenueStats.completed.medical.labTests,
          radiologyScans: revenueStats.completed.medical.radiologyScans,
          label: 'Medical'
        };
      case 'pharmacy':
        return {
          revenue: revenueStats.completed.pharmacy.revenue,
          transactions: revenueStats.completed.pharmacy.transactions,
          prescriptions: revenueStats.completed.pharmacy.prescriptions,
          medications: revenueStats.completed.pharmacy.medications,
          label: 'Pharmacy'
        };
      default:
        return {
          revenue: 0,
          transactions: 0,
          label: 'Medical'
        };
    }
  };

  // Export to Excel
  const handleExportExcel = async () => {
    try {
      const response = await api.post('/admin/reports/export-excel', {
        period: selectedPeriod,
        revenueType,
        year: selectedYear,
        month: selectedMonth,
        dailyBreakdown
      });

      const link = document.createElement('a');
      link.href = `${getServerUrl()}${response.data.filePath}`;
      link.download = response.data.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Report exported to Excel');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast.error('Failed to export Excel');
    }
  };

  // Export to PDF
  const handleExportPDF = async () => {
    try {
      const response = await api.post('/admin/reports/export-pdf', {
        period: selectedPeriod,
        revenueType,
        year: selectedYear,
        month: selectedMonth,
        dailyBreakdown,
        revenueStats
      });

      const link = document.createElement('a');
      link.href = `${getServerUrl()}${response.data.filePath}`;
      link.download = response.data.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Report exported to PDF');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF');
    }
  };

  // Print report
  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    const revenueData = getRevenueData();

    // Filter out days with no data
    const daysWithData = dailyBreakdown.filter(day => {
      const medical = day.medical?.revenue || 0;
      const pharmacy = day.pharmacy?.revenue || 0;
      const combined = day.combined?.revenue || 0;
      return medical > 0 || pharmacy > 0 || combined > 0;
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Financial Report - ${revenueType.toUpperCase()}</title>
          <style>
            @media print {
              @page { 
                size: A4;
                margin: 15mm 20mm;
              }
              body { margin: 0; padding: 0; }
              .no-print { display: none; }
            }
            body { 
              font-family: 'Times New Roman', Times, serif; 
              margin: 0; 
              padding: 0;
              color: #1a1a1a;
              line-height: 1.5;
              background: white;
              font-size: 11pt;
            }
            .container {
              padding: 0;
            }
            .header { 
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding-bottom: 12pt; 
              margin-bottom: 18pt; 
              border-bottom: 2pt solid #1e3a5f;
            }
            .header-left {
              display: flex;
              align-items: center;
              gap: 12pt;
            }
            .logo {
              width: 70pt;
              height: 70pt;
              object-fit: contain;
            }
            .clinic-info {
              text-align: left;
            }
            .clinic-name { 
              font-size: 22pt; 
              font-weight: 800; 
              margin: 0;
              color: #1e3a5f;
              font-family: 'Segoe UI', Arial, sans-serif;
            }
            .clinic-tagline {
              font-size: 10pt;
              color: #555;
              margin: 0;
              font-style: italic;
              font-family: 'Segoe UI', Arial, sans-serif;
            }
            .header-right {
              text-align: right;
            }
            .report-title { 
              font-size: 16pt; 
              font-weight: 700; 
              margin: 0;
              color: #1a1a1a;
              text-transform: uppercase;
              font-family: 'Segoe UI', Arial, sans-serif;
            }
            .report-info {
              font-size: 9pt;
              color: #666;
              margin-top: 4pt;
              font-family: 'Segoe UI', Arial, sans-serif;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 14pt;
              margin-bottom: 20pt;
            }
            .summary-card {
              padding: 12pt;
              background: #f5f7fa;
              border: 1pt solid #d0d5dd;
              border-radius: 4pt;
              text-align: center;
            }
            .summary-label {
              font-size: 8pt;
              font-weight: 600;
              color: #555;
              text-transform: uppercase;
              letter-spacing: 0.3pt;
              margin-bottom: 4pt;
            }
            .summary-value {
              font-size: 16pt;
              font-weight: 800;
              color: #1a1a1a;
            }
            .section-title {
              font-size: 12pt;
              font-weight: 700;
              color: #1e3a5f;
              margin-bottom: 12pt;
              padding-bottom: 6pt;
              border-bottom: 1pt solid #c0c5cc;
              text-transform: uppercase;
              letter-spacing: 0.5pt;
            }
            .data-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20pt;
            }
            .data-table th, .data-table td {
              padding: 8pt 10pt;
              border: 1pt solid #d0d5dd;
              text-align: left;
            }
            .data-table th {
              background: #f1f3f6;
              font-size: 8pt;
              font-weight: 700;
              color: #555;
              text-transform: uppercase;
              letter-spacing: 0.3pt;
            }
            .data-table td {
              font-size: 10pt;
            }
            .data-table tr:nth-child(even) {
              background: #f8f9fb;
            }
            .footer {
              margin-top: 30pt;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .signature-box {
              text-align: center;
            }
            .sign-line {
              width: 200pt;
              border-top: 1.5pt solid #1a1a1a;
              margin-bottom: 6pt;
            }
            .sign-label {
              font-size: 9pt;
              font-weight: 700;
              color: #555;
            }
            .print-footer {
              text-align: center;
              font-size: 8pt;
              color: #888;
              margin-top: 30pt;
              border-top: 1pt solid #d0d5dd;
              padding-top: 8pt;
            }
            .no-data {
              text-align: center;
              padding: 40pt;
              background: #f5f7fa;
              border: 1.5pt dashed #d0d5dd;
              border-radius: 4pt;
              color: #888;
              font-style: italic;
            }
          </style>
        </head>
        <body>
          <div class="container">
          <div class="header">
            <div class="header-left">
              <img src="${window.__CS__?.logoUrl || '/clinic-logo.jpg'}" alt="Clinic Logo" class="logo" onerror="this.style.display='none'">
              <div class="clinic-info">
                <h1 class="clinic-name">${window.__CS__?.name || 'Clinic'}</h1>
                <p class="clinic-tagline">${window.__CS__?.tagline || 'Quality Healthcare You Can Trust'}</p>
              </div>
            </div>
            <div class="header-right">
              <h2 class="report-title">${revenueType === 'medical' ? 'Medical Clinic Report' : 'Financial Report'}</h2>
              <div class="report-info">
                Type: ${revenueType.toUpperCase()}<br>
                Period: ${selectedPeriod === 'daily' ? selectedDate : `${getMonthName(selectedMonth)} ${selectedYear}`}
              </div>
            </div>
          </div>

          <div class="section-title">Executive Summary</div>
          <div class="summary-grid">
            <div class="summary-card">
              <div class="summary-label">Total Revenue</div>
              <div class="summary-value">${formatCurrency(revenueData.revenue)}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Total Transactions</div>
              <div class="summary-value">${revenueData.transactions}</div>
            </div>
          </div>

          <div class="section-title">Detailed Breakdown</div>
          ${daysWithData.length > 0 ? `
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Medical Revenue</th>
                  <th>Pharmacy Revenue</th>
                  <th>Total Daily Revenue</th>
                </tr>
              </thead>
              <tbody>
                ${daysWithData.map(day => `
                  <tr>
                    <td>${new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td>${formatCurrency(day.medical?.revenue || 0)}</td>
                    <td>${formatCurrency(day.pharmacy?.revenue || 0)}</td>
                    <td style="font-weight: 700;">${formatCurrency(day.combined?.revenue || 0)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <div class="no-data">
              <p>No financial data available for the selected period.</p>
              <p>This may be because patient data was cleared or there are no transactions in this time range.</p>
            </div>
          `}

          <div class="footer">
            <div class="signature-box">
              <div class="sign-line"></div>
              <div class="sign-label">Prepared By (Admin)</div>
            </div>
            <div class="signature-box">
              <div class="sign-line"></div>
              <div class="sign-label">Authorized Signature & Stamp</div>
            </div>
          </div>

          <div class="print-footer">
            ${window.__CS__?.name || 'Clinic'} - ${revenueType === 'medical' ? 'Medical Clinic Report' : 'Financial Analytics Report'} - Generated on ${new Date().toLocaleString()}
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const activeDateRange = revenueType === 'doctors'
    ? doctorStats?.dateRange
    : revenueType === 'billing'
      ? billingStats?.dateRange
      : revenueStats?.dateRange;

  if (
    (revenueType === 'doctors' && !doctorStats) ||
    (revenueType === 'billing' && !billingStats) ||
    ((revenueType === 'medical' || revenueType === 'pharmacy') && !revenueStats)
  ) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-16 w-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Data Available</h3>
        <p className="text-gray-500">Unable to load revenue statistics.</p>
      </div>
    );
  }

  const revenueData = getRevenueData();
  const selectedDoctor = (doctorStats?.doctors || []).find((d) => d.doctorId === selectedDoctorId) || null;
  const selectedBillingUser = (billingStats?.users || []).find((u) => u.userId === selectedBillingUserId) || null;
  const selectedBillingBreakdown = selectedBillingUser?.categoryBreakdown || {};
  const isBillingCalendar = revenueType === 'billing';
  const medicalCategoryBreakdown = revenueStats?.completed?.medical?.categoryBreakdown || {};
  const doctorCardUsage = doctorStats?.summary?.cardUsage || {
    opened: {},
    activation: {},
    total: 0
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">{revenueTypeOverride === 'medical' ? 'Medical Clinic Report' : 'Financial Analytics Dashboard'}</h2>
          <p className="text-gray-600">{revenueTypeOverride === 'medical' ? 'Comprehensive medical service revenue analysis and reporting' : 'Comprehensive financial insights and revenue tracking'}</p>
        </div>
        <div className="flex items-center rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
          <Calendar className="h-4 w-4 text-blue-700 mr-2" />
          <span className="text-sm font-medium text-blue-800">Calendar View</span>
        </div>
      </div>

      {/* Revenue Type Toggle — hidden when locked to one type */}
      {!revenueTypeOverride && (
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setRevenueType('billing')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${revenueType === 'billing' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          Billing
        </button>
        <button
          onClick={() => setRevenueType('doctors')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${revenueType === 'doctors' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          Doctors
        </button>
        <button
          onClick={() => setRevenueType('medical')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${revenueType === 'medical' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          Full Medical Report
        </button>
        <button
          onClick={() => setRevenueType('pharmacy')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${revenueType === 'pharmacy' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          Pharmacy
        </button>
        </div>
        {revenueType !== 'doctors' && (
          <div className="flex flex-wrap justify-start lg:justify-end gap-2 lg:ml-auto">
            <button onClick={handleExportExcel} className="btn btn-secondary flex items-center">
              <Download className="h-5 w-5 mr-2" />
              Export Excel
            </button>
            <button onClick={handleExportPDF} className="btn btn-secondary flex items-center">
              <Download className="h-5 w-5 mr-2" />
              Export PDF
            </button>
            <button onClick={handlePrintReport} className="btn btn-secondary flex items-center">
              <Download className="h-5 w-5 mr-2" />
              Print
            </button>
          </div>
        )}
      </div>
      )}

      {/* Financial Overview */}
      <div className={`grid ${revenueType === 'billing' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'} gap-6`}>
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-green-100">
              <CreditCard className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                {revenueType === 'doctors'
                  ? getDoctorDayLabel()
                  : revenueType === 'billing'
                    ? 'Processed Revenue'
                  : revenueType === 'combined'
                    ? 'Total Revenue'
                    : revenueType === 'medical'
                      ? 'Medical Revenue'
                      : 'Pharmacy Revenue'}
              </p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(revenueData.revenue)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {revenueType === 'doctors'
                  ? `${revenueData.transactions} doctor orders`
                  : revenueType === 'billing'
                    ? `${revenueData.transactions} processed transactions`
                  : `${revenueData.transactions} transactions`}
              </p>
            </div>
          </div>
        </div>

        {revenueType === 'doctors' && (
          <>
            <div className="card">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-indigo-100">
                  <Stethoscope className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Doctors</p>
                  <p className="text-2xl font-semibold text-gray-900">{doctorOptions.length || 0}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-blue-100">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Patients Treated</p>
                  <p className="text-2xl font-semibold text-gray-900">{selectedDoctorDay?.patients || 0}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-emerald-100">
                  <Activity className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{getDoctorOrdersLabel()}</p>
                  <p className="text-2xl font-semibold text-gray-900">{getDoctorDayOrders()}</p>
                </div>
              </div>
            </div>

            {cardProducts.map((cp, idx) => {
              const slug = (cp.slug || '').toUpperCase();
              const gradients = ['bg-blue-100', 'bg-cyan-100', 'bg-violet-100', 'bg-fuchsia-100', 'bg-teal-100', 'bg-rose-100', 'bg-amber-100', 'bg-lime-100'];
              const iconColors = ['text-blue-700', 'text-cyan-700', 'text-violet-700', 'text-fuchsia-700', 'text-teal-700', 'text-rose-700', 'text-amber-700', 'text-lime-700'];
              const gIdx = idx % gradients.length;
              return (
                <React.Fragment key={slug}>
                  <div className="card">
                    <div className="flex items-center">
                      <div className={`p-3 rounded-lg ${gradients[gIdx]}`}>
                        <CreditCard className={`h-6 w-6 ${iconColors[gIdx]}`} />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">{cp.name} Cards Opened</p>
                        <p className="text-3xl font-bold text-gray-900">{doctorCardUsage.opened[slug] || 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="flex items-center">
                      <div className={`p-3 rounded-lg ${gradients[(gIdx + 1) % gradients.length]}`}>
                        <CreditCard className={`h-6 w-6 ${iconColors[(gIdx + 1) % iconColors.length]}`} />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">{cp.name} Card Activations</p>
                        <p className="text-3xl font-bold text-gray-900">{doctorCardUsage.activation[slug] || 0}</p>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}

            <div className="card">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-teal-100">
                  <Users className="h-6 w-6 text-teal-700" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Medical Treated (Dermatology)</p>
                  <p className="text-3xl font-bold text-gray-900">{doctorStats?.summary?.medicalTreatedByDermatology || 0}</p>
                </div>
              </div>
            </div>
          </>
        )}

        {revenueType === 'medical' && (
          <>
            <div className="card">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-blue-100">
                  <Activity className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Lab Revenue</p>
                  <p className="text-2xl font-semibold text-gray-900">{formatCurrency(medicalCategoryBreakdown.LAB || 0)}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-purple-100">
                  <BarChart3 className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Radiology Revenue</p>
                  <p className="text-2xl font-semibold text-gray-900">{formatCurrency(medicalCategoryBreakdown.RADIOLOGY || 0)}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-orange-100">
                  <Stethoscope className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Nurse Services</p>
                  <p className="text-2xl font-semibold text-gray-900">{formatCurrency(medicalCategoryBreakdown.NURSE_SERVICES || 0)}</p>
                </div>
              </div>
            </div>
          </>
        )}

        {revenueType === 'pharmacy' && (
          <>
            <div className="card">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-blue-100">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Prescriptions</p>
                  <p className="text-2xl font-semibold text-gray-900">{revenueData.prescriptions || 0}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-purple-100">
                  <Activity className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Medications</p>
                  <p className="text-2xl font-semibold text-gray-900">{revenueData.medications || 0}</p>
                </div>
              </div>
            </div>
          </>
        )}

        {revenueType === 'billing' && (
          <>
            <div className="card">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-blue-100">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Billing Users</p>
                  <p className="text-lg md:text-2xl font-semibold text-gray-900 break-words leading-tight">{billingStats?.summary?.totalUsers || 0}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-cyan-100">
                  <DollarSign className="h-6 w-6 text-cyan-700" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Lab Walk-in</p>
                  <p className="text-lg md:text-2xl font-semibold text-gray-900 break-words leading-tight">
                    {formatCurrency(selectedBillingBreakdown.LAB_WALKIN || 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-cyan-100">
                  <DollarSign className="h-6 w-6 text-cyan-700" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Radiology Walk-in</p>
                  <p className="text-lg md:text-2xl font-semibold text-gray-900 break-words leading-tight">
                    {formatCurrency(selectedBillingBreakdown.RADIOLOGY_WALKIN || 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-cyan-100">
                  <DollarSign className="h-6 w-6 text-cyan-700" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Nurse Walk-in</p>
                  <p className="text-lg md:text-2xl font-semibold text-gray-900 break-words leading-tight">
                    {formatCurrency(selectedBillingBreakdown.NURSE_WALKIN || 0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center">
                <div className="p-3 rounded-lg bg-amber-100">
                  <CreditCard className="h-6 w-6 text-amber-700" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Card Revenue</p>
                  <p className="text-lg md:text-2xl font-semibold text-gray-900 break-words leading-tight">
                    {formatCurrency(
                      cardProducts.reduce((sum, cp) => {
                        const slug = (cp.slug || '').toUpperCase();
                        return sum + (selectedBillingBreakdown[`CARD_CREATED_${slug}`] || 0)
                             + (selectedBillingBreakdown[`CARD_REACTIVATION_${slug}`] || 0);
                      }, 0)
                    )}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {revenueType === 'medical' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Medical Service Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Object.entries(medicalCategoryBreakdown).map(([key, value]) => {
              const catColors = {
                CONSULTATION: 'bg-blue-50 border-blue-200 text-blue-800',
                CONSULTATION_GENERAL: 'bg-blue-50 border-blue-200 text-blue-800',
                LAB: 'bg-purple-50 border-purple-200 text-purple-800',
                RADIOLOGY: 'bg-indigo-50 border-indigo-200 text-indigo-800',
                PROCEDURE: 'bg-emerald-50 border-emerald-200 text-emerald-800',
                DENTAL: 'bg-cyan-50 border-cyan-200 text-cyan-800',
                TREATMENT: 'bg-teal-50 border-teal-200 text-teal-800',
                EMERGENCY_DRUG: 'bg-rose-50 border-rose-200 text-rose-800',
                NURSE_SERVICES: 'bg-orange-50 border-orange-200 text-orange-800',
              };
              const baseCat = Object.keys(catColors).find(c => key.startsWith(c)) || 'bg-gray-50 border-gray-200 text-gray-800';
              const colorClass = catColors[baseCat] || 'bg-gray-50 border-gray-200 text-gray-800';
              return (
                <div key={key} className={`p-3 rounded-lg border ${colorClass} transition-shadow hover:shadow-sm`}>
                  <p className="text-sm font-semibold leading-tight mb-1">{formatBucketLabel(key)}</p>
                  <p className="text-lg font-bold">{formatCurrency(value || 0)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Calendar View */}
      <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h3 className={`${isBillingCalendar ? 'text-lg' : 'text-xl'} font-semibold text-gray-900`}>
                  {getMonthName(selectedMonth)} {selectedYear}
                </h3>
                <button
                  onClick={() => navigateMonth('next')}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">
                  {revenueType === 'doctors'
                    ? getDoctorDayLabel()
                    : revenueType === 'billing'
                      ? `Selected Billing User Processed Revenue (${getMonthName(selectedMonth)})`
                    : `Monthly ${revenueType === 'combined' ? 'Total' : revenueType} Revenue`}
                </p>
                <p className={`${isBillingCalendar ? 'text-xl' : 'text-2xl'} font-bold text-green-600`}>
                  {formatCurrency(
                    revenueType === 'doctors'
                      ? getDoctorDayRevenue()
                      : revenueType === 'billing'
                        ? (selectedBillingUser?.totalAmount || 0)
                        : revenueData.revenue
                  )}
                </p>
              </div>
            </div>

            {revenueType === 'doctors' && (
              <div className="mb-6">
                <p className="text-sm font-medium text-gray-700 mb-3">Doctors</p>
                <div className="flex flex-wrap gap-2">
                  {(doctorOptions || []).map((doctor) => (
                    <button
                      key={doctor.doctorId}
                      onClick={() => {
                        setSelectedDoctorId(doctor.doctorId);
                        setSelectedDoctorDay(null);
                        setSelectedDoctorDayDetails(null);
                      }}
                      className={`px-5 py-3 rounded-xl border text-base font-semibold transition-colors ${selectedDoctorId === doctor.doctorId
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:text-indigo-700'
                        }`}
                    >
                      {doctor.doctorName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {revenueType === 'billing' && (
              <div className="mb-6">
                <p className="text-sm font-medium text-gray-700 mb-3">Billing Users</p>
                <div className="flex flex-wrap gap-2">
                  {(billingStats?.users || []).map((user) => (
                    <button
                      key={user.userId}
                      onClick={() => setSelectedBillingUserId(user.userId)}
                      className={`px-5 py-3 rounded-xl border text-base font-semibold transition-colors ${selectedBillingUserId === user.userId
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300 hover:text-amber-700'
                        }`}
                    >
                      {user.userName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Calendar Grid */}
            <div className={`grid grid-cols-7 ${isBillingCalendar ? 'gap-0.5' : 'gap-1'}`}>
              {/* Day Headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className={`${isBillingCalendar ? 'p-2 text-xs' : 'p-3 text-sm'} text-center font-medium text-gray-500 bg-gray-50 rounded-lg`}>
                  {day}
                </div>
              ))}

              {/* Calendar Days */}
              {generateCalendarDays().map((day) => {
                if (day.isEmpty) {
                  return <div key={day.key} className={isBillingCalendar ? 'p-2' : 'p-3'}></div>;
                }

                // Get today's date in local timezone (YYYY-MM-DD format)
                const today = new Date();
                const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

                const isToday = day.date === todayStr;
                const isSelected = day.date === selectedDate;
                const isWeekend = new Date(day.date).getDay() === 0 || new Date(day.date).getDay() === 6;

                // Professional subtle revenue styling
                const getRevenueStyle = () => {
                  if (day.revenue === 0) return { text: 'text-gray-400', border: 'border-gray-200' };
                  if (day.revenue > 5000) return { text: 'text-green-700 font-semibold', border: 'border-green-400' };
                  if (day.revenue > 2000) return { text: 'text-green-600 font-medium', border: 'border-green-300' };
                  return { text: 'text-green-600', border: 'border-green-200' };
                };

                const revenueStyle = getRevenueStyle();

                return (
                  <div key={day.key} className="relative group">
                    <div
                      onClick={() => handleDayClick(day)}
                      className={`relative ${isBillingCalendar ? 'p-2' : 'p-3'} rounded-lg cursor-pointer transition-all duration-200 border-2 ${isSelected
                          ? 'bg-blue-50 border-blue-400 shadow-md ring-2 ring-blue-100'
                          : isToday
                            ? 'bg-blue-50 border-blue-300 shadow-sm'
                            : isWeekend
                              ? 'bg-gray-50 border-gray-200'
                              : day.revenue > 0
                                ? `bg-white border-green-200 hover:border-green-300 hover:shadow-sm ${revenueStyle.border}`
                                : 'bg-white border-gray-100 hover:border-gray-200'
                        }`}
                    >
                      {/* Date number */}
                      <div className={`${isBillingCalendar ? 'text-xs' : 'text-sm'} font-semibold mb-1 ${isSelected ? 'text-blue-900' : isToday ? 'text-blue-700' : 'text-gray-800'
                        }`}>
                        {day.day}
                      </div>

                      {/* Revenue amount */}
                      <div className={`${isBillingCalendar ? 'text-[10px]' : 'text-xs'} ${revenueStyle.text} ${day.revenue > 0 ? '' : ''
                        }`}>
                        {day.revenue > 0 ? (
                          <span className="inline-flex items-center">
                            ETB {day.revenue.toLocaleString()}
                          </span>
                        ) : isToday ? (
                          <span className="text-blue-600 text-[10px] font-medium">Today</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </div>

                      {revenueType === 'doctors' && day.patients > 0 && (
                        <div className="text-[10px] text-gray-500 mt-1">{day.patients} pts</div>
                      )}

                      {revenueType === 'billing' && day.patients > 0 && (
                        <div className={`${isBillingCalendar ? 'text-[9px]' : 'text-[10px]'} text-gray-500 mt-1`}>{day.patients} tx</div>
                      )}

                      {/* Subtle bottom border for revenue days */}
                      {day.revenue > 0 && !isSelected && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-400 opacity-50"></div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {revenueType === 'doctors' && selectedDoctorDay && (
            <div className="card mt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">
                    {selectedDoctor?.doctorName || 'Doctor'} - {new Date(selectedDoctorDay.date).toLocaleDateString()}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Treated Patients: {selectedDoctorDay.patients || 0} | Total Orders: {selectedDoctorDay.totalOrders || selectedDoctorDay.procedureOrders || 0}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total Revenue</p>
                  <p className="text-xl font-bold text-emerald-600">{formatCurrency(selectedDoctorDay.totalRevenue || selectedDoctorDay.revenue || 0)}</p>
                </div>
              </div>

              {doctorDayDetailsLoading ? (
                <div className="text-sm text-gray-500">Loading doctor orders for selected day...</div>
              ) : selectedDoctorDayDetails ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg border bg-indigo-50">
                      <p className="text-sm text-indigo-700">Procedures</p>
                      <p className="text-lg font-semibold text-indigo-900">
                        {formatCurrency(selectedDoctorDayDetails.summary?.procedureRevenue || 0)}
                      </p>
                      <p className="text-xs text-indigo-700 mt-1">{selectedDoctorDayDetails.summary?.procedureOrders || 0} orders</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-cyan-50">
                      <p className="text-sm text-cyan-700">Lab Ordered</p>
                      <p className="text-lg font-semibold text-cyan-900">
                        {formatCurrency(selectedDoctorDayDetails.summary?.labRevenue || 0)}
                      </p>
                      <p className="text-xs text-cyan-700 mt-1">{selectedDoctorDayDetails.summary?.labOrders || 0} orders</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-rose-50">
                      <p className="text-sm text-rose-700">Emergency Medication</p>
                      <p className="text-lg font-semibold text-rose-900">
                        {formatCurrency(selectedDoctorDayDetails.summary?.emergencyMedicationRevenue || 0)}
                      </p>
                      <p className="text-xs text-rose-700 mt-1">{selectedDoctorDayDetails.summary?.emergencyMedicationOrders || 0} orders</p>
                    </div>
                    <div className="p-3 rounded-lg border bg-teal-50">
                      <p className="text-sm text-teal-700">Medical Treated (Dermatology)</p>
                      <p className="text-lg font-semibold text-teal-900">
                        {selectedDoctorDayDetails.summary?.medicalTreatedByDermatology || 0}
                      </p>
                      <p className="text-xs text-teal-700 mt-1">marked completions</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {renderDoctorSectionTable(
                      selectedDoctorDayDetails.sections?.procedures,
                      'Procedure Orders',
                      'No procedure orders for this doctor on this day.',
                      'bg-indigo-50 text-indigo-700 border-indigo-100'
                    )}
                    {renderDoctorSectionTable(
                      selectedDoctorDayDetails.sections?.labs,
                      'Lab Orders',
                      'No lab orders for this doctor on this day.',
                      'bg-cyan-50 text-cyan-700 border-cyan-100'
                    )}
                    {renderDoctorSectionTable(
                      selectedDoctorDayDetails.sections?.emergencyMedications,
                      'Emergency Medication Orders',
                      'No emergency medication orders for this doctor on this day.',
                      'bg-rose-50 text-rose-700 border-rose-100'
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">No doctor orders found for this day.</div>
              )}
            </div>
          )}

          {revenueType === 'billing' && selectedBillingDay && (
            <div className="card mt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">
                    {selectedBillingUser?.userName || 'Billing User'} - {new Date(selectedBillingDay.date).toLocaleDateString()}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Transactions: {selectedBillingDay.transactions || 0}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Processed Amount</p>
                  <p className="text-xl font-bold text-amber-700">{formatCurrency(selectedBillingDay.revenue || 0)}</p>
                </div>
              </div>

              {billingDayDetailsLoading ? (
                <div className="text-sm text-gray-500">Loading billing details...</div>
              ) : selectedBillingDayDetails ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg border bg-cyan-50">
                      <p className="text-sm text-cyan-700">Lab Walk-in</p>
                      <p className="text-lg font-semibold text-cyan-800">
                        {formatCurrency(selectedBillingDayDetails.summary?.categoryBreakdown?.LAB_WALKIN || 0)}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg border bg-cyan-50">
                      <p className="text-sm text-cyan-700">Radiology Walk-in</p>
                      <p className="text-lg font-semibold text-cyan-800">
                        {formatCurrency(selectedBillingDayDetails.summary?.categoryBreakdown?.RADIOLOGY_WALKIN || 0)}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg border bg-cyan-50">
                      <p className="text-sm text-cyan-700">Nurse Walk-in</p>
                      <p className="text-lg font-semibold text-cyan-800">
                        {formatCurrency(selectedBillingDayDetails.summary?.categoryBreakdown?.NURSE_WALKIN || 0)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(selectedBillingDayDetails.summary?.categoryBreakdown || {}).map(([key, value]) => (
                      <div key={`billing-sum-${key}`} className="p-3 rounded-lg border bg-gray-50">
                        <p className="text-base font-semibold text-gray-800 leading-tight">{formatBucketLabel(key)}</p>
                        <p className="text-lg font-semibold text-gray-900">{formatCurrency(value || 0)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b text-left text-xs text-gray-500 uppercase">
                          <th className="py-2 pr-2">Patient</th>
                          <th className="py-2 pr-2">Billing ID</th>
                          <th className="py-2 pr-2">Method</th>
                          <th className="py-2 pr-2">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedBillingDayDetails.details || []).map((row, idx) => (
                          <tr key={`${row.transactionId}-${idx}`} className="border-b last:border-b-0">
                            <td className="py-3 pr-2 text-sm text-gray-800">{row.patientName}</td>
                            <td className="py-3 pr-2 text-sm text-gray-600">{row.billingId || '-'}</td>
                            <td className="py-3 pr-2 text-sm text-gray-600">{row.paymentMethod}</td>
                            <td className="py-3 pr-2 text-sm font-semibold text-amber-700">{formatCurrency(row.amount || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">No billing transactions found for this day.</div>
              )}
            </div>
          )}
        </div>
      

      {/* Period Selection and Summary */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Period Summary</h3>
        <div className="flex gap-2 mb-4">
          {['daily', 'weekly', 'monthly', 'yearly'].map(period => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${selectedPeriod === period ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {period}
            </button>
          ))}
        </div>
        <div className="text-center text-gray-600">
          <p>Period: {selectedPeriod}</p>
          <p className="text-sm mt-1">
            {(activeDateRange?.startDate || activeDateRange?.start) && new Date(activeDateRange?.startDate || activeDateRange?.start).toLocaleDateString()} - {' '}
            {(activeDateRange?.endDate || activeDateRange?.end) && new Date(activeDateRange?.endDate || activeDateRange?.end).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Day Details Popup */}
      {showDayPopup && popupDayData && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50" onClick={() => setShowDayPopup(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {new Date(popupDayData.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </h3>
              <button
                onClick={() => setShowDayPopup(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            {popupDayData.dayData ? (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">{revenueType === 'medical' ? 'Medical Revenue' : 'Total Revenue'}</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(revenueType === 'medical' ? popupDayData.dayData.medical.revenue : popupDayData.dayData.combined.revenue)}
                  </p>
                </div>

                {revenueType === 'medical' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                    {Object.entries(popupDayData.dayData.medical.categoryBreakdown || {}).map(([key, value]) => (
                      <div key={`medical-day-${key}`} className="p-2 bg-blue-50 rounded-lg">
                        <p className="text-sm font-semibold text-gray-800 mb-1 leading-tight">{formatBucketLabel(key)}</p>
                        <p className="text-base font-semibold text-blue-700">{formatCurrency(value || 0)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Medical</p>
                      <p className="text-lg font-semibold text-blue-600">
                        {formatCurrency(popupDayData.dayData.medical.revenue)}
                      </p>
                      <p className="text-xs text-gray-500">{popupDayData.dayData.medical.transactions} transactions</p>
                    </div>

                    <div className="p-3 bg-purple-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Pharmacy</p>
                      <p className="text-lg font-semibold text-purple-600">
                        {formatCurrency(popupDayData.dayData.pharmacy.revenue)}
                      </p>
                      <p className="text-xs text-gray-500">{popupDayData.dayData.pharmacy.transactions} transactions</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-500">No transactions recorded for this day</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;