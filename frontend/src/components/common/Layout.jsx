import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import AccountSettings from './AccountSettings';
import SystemSettings from '../admin/SystemSettings';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  Menu,
  X,
  User,
  LogOut,
  Bell,
  Settings,
  RefreshCw,
  Home,
  Users,
  Stethoscope,
  Pill,
  FileText,
  Calendar,
  BarChart3,
  CreditCard,
  TestTube,
  Scan,
  ShoppingCart,
  CheckCircle,
  Activity,
  Phone,
  FileCheck,
  Clock,
  Image,
  DollarSign,
  UserPlus,
  UserCheck,
  Package,
  Trash2,
  Printer,
  Building2,
  Bed,
  Percent,
  CalendarRange
} from 'lucide-react';

const Layout = ({ children, title, subtitle }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showSystemSettings, setShowSystemSettings] = useState(false);
  const [oldPatientModeEnabled, setOldPatientModeEnabled] = useState(false);
  const [togglingOldPatientMode, setTogglingOldPatientMode] = useState(false);
  const [pendingAdvanceRequestCount, setPendingAdvanceRequestCount] = useState(0);
  const [pageRefreshKey, setPageRefreshKey] = useState(0);
  const [isRefreshingPage, setIsRefreshingPage] = useState(false);
  const [sidebarVisibility, setSidebarVisibility] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [openGroups, setOpenGroups] = useState({});

  const toggleGroup = (groupName) => {
    setOpenGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handlePageRefresh = () => {
    setIsRefreshingPage(true);
    window.dispatchEvent(new CustomEvent('app-soft-refresh', {
      detail: {
        path: location.pathname,
        triggeredAt: Date.now()
      }
    }));
    setPageRefreshKey((prev) => prev + 1);
    window.setTimeout(() => setIsRefreshingPage(false), 700);
  };

  const handleNavigation = (href) => {
    navigate(href);
    setSidebarOpen(false);
  };

  const isCurrentPage = (href) => {
    if (href === '/') {
      return location.pathname === '/' || location.pathname === '/admin' || location.pathname === '/nurse' || location.pathname === '/doctor';
    }
    return location.pathname.startsWith(href);
  };

  const fetchSidebarVisibility = useCallback(async () => {
    if (!user?.role) return;
    try {
      const response = await api.get('/admin/sidebar-visibility');
      setSidebarVisibility(response.data.config);
    } catch (error) {
      setSidebarVisibility(null);
    }
  }, [user?.role]);

  useEffect(() => {
    const handleVisibilityUpdate = (event) => {
      setSidebarVisibility(event.detail.config);
    };

    fetchSidebarVisibility();
    window.addEventListener('sidebar-visibility-updated', handleVisibilityUpdate);
    return () => {
      window.removeEventListener('sidebar-visibility-updated', handleVisibilityUpdate);
    };
  }, [user?.role, fetchSidebarVisibility]);

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;

    const fetchOldPatientMode = async () => {
      try {
        const response = await api.get('/admin/system-settings/oldPatientRegistrationMode');
        const value = response.data?.setting?.value;
        setOldPatientModeEnabled(String(value || 'false').toLowerCase() === 'true');
      } catch (error) {
        setOldPatientModeEnabled(false);
      }
    };

    fetchOldPatientMode();
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== 'BILLING_OFFICER') {
      setPendingAdvanceRequestCount(0);
      return;
    }

    let isMounted = true;

    const fetchPendingAdvanceRequests = async () => {
      try {
        const response = await api.get('/accounts/requests?status=PENDING');
        const pendingCount = (response.data?.requests || []).filter(
          (request) => request.requestType === 'ADD_DEPOSIT'
        ).length;

        if (isMounted) {
          setPendingAdvanceRequestCount(pendingCount);
        }
      } catch (error) {
        if (isMounted) {
          setPendingAdvanceRequestCount(0);
        }
      }
    };

    const handleAdvanceRequestUpdate = (event) => {
      if (typeof event?.detail?.count === 'number') {
        setPendingAdvanceRequestCount(event.detail.count);
        return;
      }

      fetchPendingAdvanceRequests();
    };

    fetchPendingAdvanceRequests();
    window.addEventListener('advance-requests-updated', handleAdvanceRequestUpdate);
    const intervalId = window.setInterval(fetchPendingAdvanceRequests, 30000);

    return () => {
      isMounted = false;
      window.removeEventListener('advance-requests-updated', handleAdvanceRequestUpdate);
      window.clearInterval(intervalId);
    };
  }, [user?.role, location.pathname]);

  const toggleOldPatientMode = async () => {
    if (togglingOldPatientMode) return;
    try {
      setTogglingOldPatientMode(true);
      const nextValue = !oldPatientModeEnabled;
      await api.put('/admin/system-settings/oldPatientRegistrationMode', {
        value: nextValue,
        description: 'Enable old-patient registration mode so billing can waive card registration fee during migration'
      });
      setOldPatientModeEnabled(nextValue);
      toast.success(`Old patient mode ${nextValue ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling old patient mode:', error);
      toast.error('Failed to update old patient mode');
    } finally {
      setTogglingOldPatientMode(false);
    }
  };

  const getNavigationItems = () => {
    const baseItems = [
      { name: 'Dashboard', href: '/', icon: Home, key: 'dashboard' },
    ];

    const filterByRole = (items) => {
      if (!sidebarVisibility || !user?.role) return items;
      const allowedKeys = sidebarVisibility[user.role];
      if (!allowedKeys) return items;
      return items.filter(item => !item.key || allowedKeys.includes(item.key));
    };

    switch (user?.role) {
      case 'ADMIN':
        return filterByRole([
          ...baseItems,
          { name: 'Staff Management', href: '/admin/staff', icon: Users, key: 'staffManagement' },
          { name: 'Patient Management', href: '/admin/patients', icon: Users, key: 'patientManagement' },
          { name: 'Service Management', href: '/admin/services', icon: Package, key: 'serviceManagement' },
          {
            name: 'Reports',
            icon: BarChart3,
            group: 'reports_group',
            key: 'reports',
            children: [
              { name: 'Medical Clinic Report', href: '/admin/medical-clinic-report', icon: FileText, key: 'medicalClinic' },
              { name: 'Doctor Report', href: '/admin/doctor-report', icon: Stethoscope, key: 'doctorPerformance' },
              { name: 'Billing Report', href: '/admin/billing-report', icon: DollarSign, key: 'billingReport' },
              { name: 'Lab Report', href: '/admin/lab-reports', icon: TestTube, key: 'labReports' },
              { name: 'Radiology Report', href: '/admin/radiology-reports', icon: Scan, key: 'radiologyReports' },
              { name: 'Nurse Report', href: '/admin/nurse-performance', icon: UserCheck, key: 'nurseReport' },
              { name: 'Pharmacy Report', href: '/admin/pharmacy-report', icon: Pill, key: 'pharmacyReport' },
            ]
          },
          {
            name: 'Disease Reports',
            icon: Activity,
            group: 'disease_reports',
            key: 'diseaseReports',
            children: [
              { name: 'Disease Management', href: '/admin/disease-management', icon: Activity, key: 'diseaseManagement' },
              { name: 'Disease Reports', href: '/admin/disease-reports', icon: Activity, key: 'diseaseReports' },
              { name: 'Age-Gender Distribution', href: '/admin/age-gender-disease-distribution', icon: Users, key: 'ageGenderDisease' },
              { name: 'Abortion Care Register', href: '/doctor/abortion-care', icon: Activity, key: 'abortionCare' },
              { name: 'Family Planning Register', href: '/nurse/family-planning', icon: Users, key: 'familyPlanning' },
              { name: 'Central Register', href: '/admin/central-register', icon: FileText, key: 'centralRegister' },
            ]
          },
          { name: 'Patient Accounts', href: '/admin/patient-accounts', icon: CreditCard, key: 'patientAccounts' },
          { name: 'Bed Management', href: '/admin/beds', icon: Bed, key: 'bedManagement' },
          { name: 'Card Products', href: '/admin/card-products', icon: CreditCard, key: 'cardProducts' },
          { name: 'Doctor Commissions', href: '/admin/doctor-commissions', icon: Percent, key: 'doctorCommissions' },
          { name: 'Audit Logs', href: '/admin/audit', icon: FileText, key: 'auditLogs' },
          { name: 'Loan Approval', href: '/admin/loan-approval', icon: DollarSign, key: 'loanApproval' },
          { name: 'Expense Tracker', href: '/admin/expense-tracker', icon: DollarSign, key: 'dailyExpenses' },
          { name: 'System View', href: '/admin/system-view', icon: Settings, key: 'systemView' },
        ]);

      case 'DOCTOR':
        return filterByRole([
          ...baseItems,
          { name: 'Patient Queue', href: '/doctor/queue', icon: Stethoscope, key: 'patientQueue' },
          { name: 'Daily Work', href: '/doctor/daily-work', icon: Calendar, key: 'dailyWork' },
          { name: 'Bed & Admissions', href: '/doctor/admissions', icon: Bed, key: 'admissions' },
          { name: 'Patient History', href: '/doctor/history', icon: FileText, key: 'patientHistory' },
          { name: 'Medical Certificate', href: '/doctor/medical-certificates', icon: FileCheck, key: 'medicalCertificate' },
          { name: 'International Certificate', href: '/doctor/international-certificates', icon: Activity, key: 'internationalCertificate' },

          { name: 'Refer Patient', href: '/doctor/referrals', icon: Building2, key: 'referPatient' },
          { name: 'Abortion Care', href: '/doctor/abortion-care', icon: Activity, key: 'abortionCare' },
          { name: 'Family Planning', href: '/nurse/family-planning', icon: Users, key: 'familyPlanning' },
          { name: 'Appointments', href: '/appointments', icon: Calendar, key: 'appointments' },
          { name: 'Loans', href: '/loans', icon: DollarSign, key: 'loans' },
        ]);

      case 'NURSE':
        return filterByRole([
          ...baseItems,
          { name: 'Patient Registration', href: '/nurse/register', icon: UserPlus, key: 'patientRegistration' },
          { name: 'Triage Queue', href: '/nurse/queue', icon: Stethoscope, key: 'triageQueue' },
          { name: 'Patient Management', href: '/nurse/patients', icon: Users, key: 'patientManagement' },
          { name: 'Bed & Admissions', href: '/nurse/admissions', icon: Bed, key: 'admissions' },
          { name: 'Daily Tasks', href: '/nurse/tasks', icon: Calendar, key: 'dailyTasks' },
          { name: 'Walk-in Services', href: '/nurse/walk-in-services', icon: UserPlus, key: 'walkInServices' },
          { name: 'Walk-in Orders', href: '/nurse/walk-in-orders', icon: Package, key: 'walkInOrders' },
          { name: 'Continuous Vitals', href: '/nurse/continuous-vitals', icon: Activity, key: 'continuousVitals' },
          { name: 'Family Planning', href: '/nurse/family-planning', icon: Users, key: 'familyPlanning' },
          { name: 'Patient Gallery', href: '/nurse/gallery', icon: Image, key: 'gallery' },
          { name: 'Appointments', href: '/nurse/appointments', icon: Clock, key: 'appointments' },
          { name: 'Loans', href: '/loans', icon: DollarSign, key: 'loans' },
        ]);

      case 'RECEPTIONIST':
        return filterByRole([
          ...baseItems,
          { name: 'Patient Registration', href: '/reception/register', icon: Calendar, key: 'patientRegistration' },
          { name: 'Patient Management', href: '/reception/patients', icon: Users, key: 'patientManagement' },
          { name: 'Patient Accounts', href: '/reception/patient-accounts', icon: CreditCard, key: 'patientAccounts' },
          { name: 'Prints', href: '/reception/prints', icon: Printer, key: 'prints' },
          { name: 'Appointments', href: '/reception/appointments', icon: Clock, key: 'appointments' },
          { name: 'Pre-Registration', href: '/reception/pre-registration', icon: Phone, key: 'preRegistration' },
          { name: 'Doctor Queue Management', href: '/reception/doctor-queue', icon: Stethoscope, key: 'doctorQueueManagement' },
          { name: 'Patient Gallery', href: '/reception/gallery', icon: Image, key: 'gallery' },
          { name: 'Loans', href: '/loans', icon: DollarSign, key: 'loans' },
        ]);

      case 'BILLING_OFFICER':
        return filterByRole([
          ...baseItems,
          {
            name: 'Billing & Finance',
            icon: CreditCard,
            group: 'billing_finance',
            key: 'billingQueue',
            badgeCount: pendingAdvanceRequestCount,
            children: [
              { name: 'Billing Queue', href: '/billing/queue', icon: CreditCard, key: 'billingQueue' },
              { name: 'Emergency Billing', href: '/emergency-billing', icon: Activity, key: 'emergencyBilling' },
              { name: 'Advance Deposits', href: '/billing/advance-deposits', icon: DollarSign, key: 'advanceDeposits', badgeCount: pendingAdvanceRequestCount },
              { name: 'Patient Accounts', href: '/billing/patient-accounts', icon: CreditCard, key: 'patientAccounts' },
              { name: 'Credit Installments', href: '/billing/credit-accounts', icon: CreditCard, key: 'creditInstallments' },
              { name: 'Cash Management', href: '/cash-management', icon: BarChart3, key: 'cashManagement' },
              { name: 'Loans', href: '/loans', icon: DollarSign, key: 'loans' },
            ]
          },
          {
            name: 'Patient Administration',
            icon: Users,
            group: 'patient_admin',
            key: 'patientManagement',
            children: [
              { name: 'Patient Registration', href: '/billing/register', icon: UserPlus, key: 'patientRegistration' },
              { name: 'Patient Management', href: '/billing/patients', icon: Users, key: 'patientManagement' },
              { name: 'Pre-Registration', href: '/billing/pre-registration', icon: Phone, key: 'preRegistration' },
              { name: 'Appointments', href: '/billing/appointments', icon: Calendar, key: 'appointments' },
              { name: 'Doctor Queue', href: '/doctor-queue', icon: Stethoscope, key: 'doctorQueue' },
            ]
          },
          {
            name: 'Clinical & Records',
            icon: FileText,
            group: 'clinical_records',
            key: 'prints',
            children: [
              { name: 'Prints', href: '/billing/prints', icon: Printer, key: 'prints' },
              { name: 'Walk-In Lab/Radiology', href: '/billing/walk-in-orders', icon: TestTube, key: 'walkInLabRadiology' },
            ]
          },
          { name: 'Patient Gallery', href: '/billing/gallery', icon: Image, key: 'gallery' }
        ]);

      case 'PHARMACY_BILLING_OFFICER':
      case 'PHARMACIST':
        return filterByRole([
          ...baseItems,
          { name: 'Pharmacy', href: '/pharmacy', icon: Pill, key: 'pharmacy' },
          { name: 'Sales Report', href: '/pharmacy/sales-report', icon: CalendarRange, key: 'salesReport' },
          { name: 'Loans', href: '/loans', icon: DollarSign, key: 'loans' },
        ]);


      case 'RADIOLOGIST':
        return filterByRole([
          ...baseItems,
          { name: 'Radiology Orders', href: '/radiology/orders', icon: Scan, key: 'radiologyOrders' },
          { name: 'Walk-In Orders', href: '/radiology/walk-in', icon: UserPlus, key: 'radiologyWalkIn' },
          { name: 'Loans', href: '/loans', icon: DollarSign, key: 'loans' },
        ]);

      case 'LAB_TECHNICIAN':
        return filterByRole([
          ...baseItems,
          { name: 'Lab Orders', href: '/lab/orders', icon: TestTube, key: 'labOrders' },
          { name: 'Walk-In Orders', href: '/lab/walk-in', icon: UserPlus, key: 'labWalkIn' },
          { name: 'Lab Reports', href: '/lab/reports', icon: BarChart3, key: 'labReports_tech' },
          { name: 'Loans', href: '/loans', icon: DollarSign, key: 'loans' },
        ]);

      case 'REPORT':
        return filterByRole([
          { name: 'Report Dashboard', href: '/report', icon: BarChart3, key: 'reportDashboard' },
          { name: 'Central Register', href: '/admin/central-register', icon: FileText, key: 'centralRegister' },
          { name: 'Disease Tally Sheet', href: '/admin/disease-tally', icon: Activity, key: 'diseaseTally' },
          { name: 'Disease Reports', href: '/admin/disease-reports', icon: Activity, key: 'diseaseReports' },
          { name: 'Age-Gender Distribution', href: '/admin/age-gender-disease-distribution', icon: Users, key: 'ageGenderDisease' },
          { name: 'Lab Reports', href: '/admin/lab-reports', icon: TestTube, key: 'labReports' },
          { name: 'Family Planning', href: '/nurse/family-planning', icon: Users, key: 'familyPlanning' },
          { name: 'Abortion Care', href: '/doctor/abortion-care', icon: Activity, key: 'abortionCare' },
        ]);

      default:
        return baseItems;
    }
  };

  const navigationItems = getNavigationItems();

  return (
    <div className="h-screen flex overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 shadow-xl transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`} style={{ backgroundColor: 'var(--primary)' }}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-4 border-b flex-shrink-0" style={{ borderColor: 'var(--secondary)' }}>
            <div className="flex items-center">
              <img
                src={window.__CS__?.logoUrl || '/clinic-logo.jpg'}
                alt={`${window.__CS__?.name || 'Clinic'} Logo`}
                className="h-10 w-10 rounded-full object-cover border-2 border-white"
              />
              <span className="ml-3 text-xl font-bold text-white hidden lg:inline">{window.__CS__?.name || 'Clinic'}</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-md text-white hover:bg-opacity-20 hover:bg-white transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="flex-1 px-2 space-y-1 overflow-y-auto mt-5">
            {navigationItems.map((item, index) => {
              // If item has children/group, render as dropdown
              if (item.children) {
                const hasActiveChild = item.children.some(child => isCurrentPage(child.href));
                // Keep group open if toggled OR if a child is active
                const isOpen = openGroups[item.group] || hasActiveChild;

                return (
                  <div key={item.name} className="space-y-1">
                    <button
                      onClick={() => toggleGroup(item.group)}
                      className={`group flex items-center justify-between px-3 py-3 text-sm font-medium rounded-lg w-full text-left transition-all duration-200 ${hasActiveChild ? 'bg-white bg-opacity-10 text-white' : 'text-gray-200 hover:text-white hover:bg-opacity-20 hover:bg-white'
                        }`}
                    >
                      <div className="flex items-center">
                        <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                        {item.name}
                      </div>
                      <div className="flex items-center gap-2">
                        {Number(item.badgeCount || 0) > 0 && (
                          <span className="inline-flex min-w-[20px] h-5 px-1.5 items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-bold">
                            {item.badgeCount > 99 ? '99+' : item.badgeCount}
                          </span>
                        )}
                        <svg
                          className={`ml-2 h-4 w-4 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </button>

                    {/* Dropdown Content */}
                    {isOpen && (
                      <div className="pl-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                        {item.children.map(child => (
                          <button
                            key={child.name}
                            onClick={() => handleNavigation(child.href)}
                            className={`group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg w-full text-left transition-all duration-200 ${isCurrentPage(child.href)
                              ? 'text-white bg-white bg-opacity-20'
                              : 'text-gray-300 hover:text-white hover:bg-opacity-10'
                              }`}
                          >
                            <div className="flex items-center">
                              <child.icon className={`mr-3 h-4 w-4 transition-colors ${isCurrentPage(child.href) ? 'text-white' : 'text-gray-400 group-hover:text-white'
                                }`} />
                              {child.name}
                            </div>
                            {Number(child.badgeCount || 0) > 0 && (
                              <span className="inline-flex min-w-[20px] h-5 px-1.5 items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-bold">
                                {child.badgeCount > 99 ? '99+' : child.badgeCount}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // Standard item rendering (no children)
              return (
                <button
                  key={item.name}
                  onClick={() => handleNavigation(item.href)}
                  className={`group flex items-center px-3 py-3 text-sm font-medium rounded-lg w-full text-left transition-all duration-200 ${isCurrentPage(item.href)
                    ? 'text-white shadow-lg'
                    : 'text-gray-200 hover:text-white hover:bg-opacity-20 hover:bg-white'
                    }`}
                  style={{
                    backgroundColor: isCurrentPage(item.href) ? 'var(--secondary)' : 'transparent'
                  }}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 transition-colors ${isCurrentPage(item.href) ? 'text-white' : 'text-gray-300 group-hover:text-white'
                      }`}
                  />
                  {item.name}
                </button>
              );
            })}
          </nav>

          {/* Logout button at sidebar bottom */}
          <div className="flex-shrink-0 px-2 pb-4 pt-2 border-t border-white/20">
            <button
              onClick={handleLogout}
              className="group flex items-center px-3 py-3 text-sm font-medium rounded-lg w-full text-left text-gray-200 hover:text-white hover:bg-white/20 transition-all duration-200"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top navigation */}
        <header className="shadow-lg border-b" style={{ backgroundColor: '#FFFFFF', borderColor: 'var(--primary)' }}>
          <div className="flex items-center justify-between min-h-[3.5rem] sm:h-16 px-3 sm:px-6 lg:px-8">
            <div className="flex items-center min-w-0 flex-1">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md transition-colors flex-shrink-0"
                style={{ color: 'var(--dark)' }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--primary)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
              <div className="ml-2 sm:ml-4 lg:ml-0 min-w-0">
                <h1 className="text-sm sm:text-lg lg:text-xl font-semibold truncate" style={{ color: 'var(--dark)' }}>{title}</h1>
                {subtitle && (
                  <p className="text-xs sm:text-sm truncate" style={{ color: 'var(--primary)' }}>{subtitle}</p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={handlePageRefresh}
                disabled={isRefreshingPage}
                className={`px-3 py-2 rounded-md transition-colors flex items-center gap-2 ${isRefreshingPage ? 'opacity-70 cursor-not-allowed' : ''}`}
                style={{ color: 'var(--dark)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title="Refresh current page data"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshingPage ? 'animate-spin' : ''}`} />
                <span className="hidden md:inline text-sm font-medium">Refresh</span>
              </button>

              {user?.role === 'ADMIN' && (
                <>
                  <button
                    type="button"
                    onClick={toggleOldPatientMode}
                    disabled={togglingOldPatientMode}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${oldPatientModeEnabled ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-300 text-gray-800 hover:bg-gray-400'} ${togglingOldPatientMode ? 'opacity-60 cursor-not-allowed' : ''}`}
                    title="Old Patient Registration Mode"
                  >
                    Old Patient: {oldPatientModeEnabled ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={() => setShowSystemSettings(true)}
                    className="p-2 rounded-md transition-colors"
                    style={{ color: 'var(--dark)' }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--primary)'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    title="System Settings"
                  >
                    <Bell className="h-6 w-6" />
                  </button>
                </>
              )}

              <div className="relative">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => setShowAccountSettings(true)}
                      className="h-8 w-8 rounded-full flex items-center justify-center cursor-pointer transition hover:opacity-80"
                      style={{ backgroundColor: 'var(--primary)' }}
                      title="Account Settings"
                    >
                      <User className="h-5 w-5 text-white" />
                    </button>
                  </div>
                  <div className="hidden md:block">
                    <p className="text-sm font-medium" style={{ color: 'var(--dark)' }}>{user?.fullname || user?.username}</p>
                    <p className="text-xs" style={{ color: 'var(--primary)' }}>{user?.role?.toLowerCase().replace('_', ' ')}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-md transition-colors"
                    style={{ color: 'var(--dark)' }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--danger)'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    title="Logout"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main key={`${location.pathname}-${pageRefreshKey}`} className="flex-1 overflow-y-auto overflow-x-hidden" style={{ backgroundColor: '#FFFFFF' }}>
          <div className="py-6">
            <div className={(location.pathname.startsWith('/admin') || location.pathname.includes('/doctor/consultation')) ? 'px-4 sm:px-6 lg:px-8' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}>
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Account Settings Modal */}
      <AccountSettings
        isOpen={showAccountSettings}
        onClose={() => setShowAccountSettings(false)}
        user={user}
      />

      {showSystemSettings && (
        <SystemSettings onClose={() => setShowSystemSettings(false)} />
      )}

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 opacity-75" style={{ backgroundColor: '#2e13d1' }}></div>
        </div>
      )}
    </div>
  );
};

export default Layout;
