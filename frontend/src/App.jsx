import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ClinicSettingsProvider } from './contexts/ClinicSettingsContext';
import Layout from './components/common/Layout';

// Import pages
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import DiseaseReports from './pages/admin/DiseaseReports';
import SelectedDiseaseReportPage from './pages/admin/SelectedDiseaseReportPage';
import AgeGenderDiseaseDistribution from './pages/admin/AgeGenderDiseaseDistribution';
import AdminLabReports from './pages/admin/AdminLabReports';
import PatientRegistration from './pages/patient/PatientRegistration';
import NurseDashboard from './pages/nurse/NurseDashboard';
import NurseAppointments from './pages/nurse/NurseAppointments';
import AdminAppointments from './pages/admin/AdminAppointments';
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import PatientConsultationPage from './pages/doctor/PatientConsultationPage';
import BillingDashboard from './pages/billing/BillingDashboard';
import EmergencyBilling from './pages/billing/EmergencyBilling';
import DailyCashManagement from './pages/billing/DailyCashManagement';
import DoctorQueueManagement from './pages/billing/DoctorQueueManagement';
import RadiologyDashboard from './pages/radiology/RadiologyDashboard';
import LabDashboard from './pages/lab/LabDashboard';
import LabOrders from './pages/lab/LabOrders';
import LabReports from './pages/lab/LabReports';
import WalkInOrders from './pages/lab/WalkInOrders';
import RadiologyWalkInOrders from './pages/radiology/WalkInOrders';
import PharmacyDashboard from './pages/pharmacy/PharmacyDashboard';
import SalesReport from './components/pharmacy/SalesReport';
import AppointmentsPage from './pages/appointments/AppointmentsPage';
import DoctorAppointments from './pages/doctor/DoctorAppointments';
import ReceptionDashboard from './pages/reception/ReceptionDashboard';
import ReceptionPatientRegistration from './pages/reception/ReceptionPatientRegistration';
import PatientManagement from './pages/reception/PatientManagement';
import ReceptionAppointments from './pages/reception/ReceptionAppointments';
import PreRegistration from './pages/reception/PreRegistration';
import ReceptionDoctorQueueManagement from './pages/reception/DoctorQueueManagement';
import PatientGallery from './pages/shared/PatientGallery';
import FamilyPlanningPage from './pages/nurse/FamilyPlanningPage';
import NursePatientManagement from './pages/nurse/NursePatientManagement';
import AbortionCarePage from './pages/doctor/AbortionCarePage';
import Loans from './components/shared/Loans';
import AdmissionManagement from './pages/accommodation/AdmissionManagement';
import PatientAccounts from './components/admin/PatientAccounts';
import SystemView from './pages/admin/SystemView';
import CentralRegisterPage from './pages/admin/CentralRegisterPage';
import DiseaseTallySheetPage from './pages/admin/DiseaseTallySheetPage';
import DiseaseManagement from './pages/admin/DiseaseManagement';
import ReportDashboard from './pages/report/ReportDashboard';
import BillingPatientHistory from './components/billing/BillingPatientHistory';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return children;
};

// Main App Routes
const AppRoutes = () => {
  const { user } = useAuth();

  const getDefaultRoute = () => {
    if (!user) return '/login';

    switch (user.role) {
      case 'ADMIN':
        return '/admin';
      case 'DOCTOR':
        return '/doctor/dashboard';
      case 'NURSE':
        return '/nurse';
      case 'RECEPTIONIST':
        return '/reception';
      case 'BILLING_OFFICER':
        return '/billing';
      case 'PHARMACY_BILLING_OFFICER':
        return '/pharmacy-billing';
      case 'PHARMACIST':
        return '/pharmacy';
      case 'LAB_TECHNICIAN':
        return '/lab';
      case 'RADIOLOGIST':
        return '/radiology';
      case 'REPORT':
        return '/report';
      default:
        return '/login';
    }
  };

  // Detect if we're running under /d path
  // Only return /d if pathname starts with /d/ (with trailing slash) or is exactly /d
  // This prevents matching paths like /doctor/dashboard
  const getBasename = () => {
    const pathname = window.location.pathname;
    // Check for /d/ or exactly /d (but not /doctor, /dashboard, etc.)
    if (pathname === '/d' || pathname.startsWith('/d/')) {
      return '/d';
    }
    return '/';
  };

  return (
    <Router basename={getBasename()}>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Routes */}
        <Route
          path="/admin/appointments"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <Layout title="Appointments" subtitle="View all appointments (Read-only)">
                <AdminAppointments />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/disease-reports"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'DOCTOR', 'REPORT']}>
              <DiseaseReports />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/age-gender-disease-distribution"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'DOCTOR', 'REPORT']}>
              <AgeGenderDiseaseDistribution />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/selected-disease-report"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'DOCTOR', 'REPORT']}>
              <SelectedDiseaseReportPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/lab-reports"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'REPORT']}>
              <Layout title="Lab Reports" subtitle="Laboratory test reports">
                <AdminLabReports />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/central-register"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'REPORT']}>
              <Layout title="Central Register" subtitle="Patient registration record">
                <CentralRegisterPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/disease-tally"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'REPORT']}>
              <Layout title="Disease Tally Sheet" subtitle="Diseases information tally by age and sex">
                <DiseaseTallySheetPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/disease-management"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <Layout title="Disease Management" subtitle="Manage disease codes, names, and reporting">
                <DiseaseManagement />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/system-view"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <Layout title="System View Settings" subtitle="Control which sidebar items each role can see">
                <SystemView />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <Layout title="Admin Dashboard" subtitle="System overview and management">
                <AdminDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/patient/*"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'BILLING_OFFICER', 'RECEPTIONIST']}>
              <Layout title="Patient Registration" subtitle="Register new patients">
                <PatientRegistration />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/nurse/admissions"
          element={
            <ProtectedRoute allowedRoles={['NURSE', 'ADMIN', 'DOCTOR']}>
              <AdmissionManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/nurse/register"
          element={
            <ProtectedRoute allowedRoles={['NURSE', 'ADMIN']}>
              <Layout title="Patient Registration & Visit Creation" subtitle="Register new patients or create visits">
                <ReceptionPatientRegistration />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/nurse/patients"
          element={
            <ProtectedRoute allowedRoles={['NURSE', 'ADMIN']}>
              <Layout title="Patient Management" subtitle="View and manage assigned patients">
                <NursePatientManagement />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/nurse/*"
          element={
            <ProtectedRoute allowedRoles={['NURSE']}>
              <Layout title="Nurse Dashboard" subtitle="Patient triage and daily tasks">
                <NurseDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/nurse/family-planning"
          element={
            <ProtectedRoute allowedRoles={['NURSE', 'DOCTOR', 'ADMIN', 'REPORT']}>
              <Layout title="Family Planning" subtitle="Family planning registration and follow-up">
                <FamilyPlanningPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/nurse/gallery"
          element={
            <ProtectedRoute allowedRoles={['NURSE', 'ADMIN']}>
              <Layout title="Patient Gallery" subtitle="Upload and manage patient before/after images">
                <PatientGallery />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/nurse/appointments"
          element={
            <ProtectedRoute allowedRoles={['NURSE', 'ADMIN']}>
              <Layout title="Appointments" subtitle="View all appointments (Read-only)">
                <NurseAppointments />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Loans - All staff */}
        <Route
          path="/loans"
          element={
            <ProtectedRoute allowedRoles={['DOCTOR', 'NURSE', 'RECEPTIONIST', 'BILLING_OFFICER', 'PHARMACY_BILLING_OFFICER', 'PHARMACIST', 'RADIOLOGIST', 'LAB_TECHNICIAN']}>
              <Layout title="Loans Management" subtitle="Request and manage loans">
                <Loans />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reception"
          element={
            <ProtectedRoute allowedRoles={['RECEPTIONIST', 'ADMIN']}>
              <Layout title="Reception Dashboard" subtitle="Patient registration and card management">
                <ReceptionDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reception/register"
          element={
            <ProtectedRoute allowedRoles={['RECEPTIONIST', 'BILLING_OFFICER', 'ADMIN']}>
              <Layout title="Patient Registration & Visit Creation" subtitle="Register new patients or create visits for existing patients">
                <ReceptionPatientRegistration />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reception/patients"
          element={
            <ProtectedRoute allowedRoles={['RECEPTIONIST', 'BILLING_OFFICER', 'ADMIN']}>
              <Layout title="Patient Card Management" subtitle="Manage patient card status, activation, and billing">
                <PatientManagement />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reception/patient-accounts"
          element={
            <ProtectedRoute allowedRoles={['RECEPTIONIST', 'BILLING_OFFICER', 'ADMIN']}>
              <Layout title="Patient Accounts" subtitle="View patient balances and transactions">
                <PatientAccounts />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reception/prints"
          element={
            <ProtectedRoute allowedRoles={['RECEPTIONIST', 'BILLING_OFFICER', 'ADMIN']}>
              <Layout title="Prints" subtitle="Print bills, procedures and medical records">
                <BillingPatientHistory />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reception/appointments"
          element={
            <ProtectedRoute allowedRoles={['RECEPTIONIST', 'BILLING_OFFICER', 'ADMIN']}>
              <Layout title="Appointments Management" subtitle="View all appointments and send patients to doctor queue">
                <ReceptionAppointments />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reception/pre-registration"
          element={
            <ProtectedRoute allowedRoles={['RECEPTIONIST', 'BILLING_OFFICER', 'ADMIN']}>
              <Layout title="Pre-Registration" subtitle="Handle phone call registrations and appointments">
                <PreRegistration />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reception/doctor-queue"
          element={
            <ProtectedRoute allowedRoles={['RECEPTIONIST', 'ADMIN']}>
              <Layout title="Doctor Queue Management" subtitle="Monitor doctor availability and patient assignments">
                <ReceptionDoctorQueueManagement />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reception/gallery"
          element={
            <ProtectedRoute allowedRoles={['RECEPTIONIST', 'BILLING_OFFICER', 'ADMIN']}>
              <Layout title="Patient Gallery" subtitle="Upload and manage patient before/after images">
                <PatientGallery />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/doctor/dashboard"
          element={
            <ProtectedRoute allowedRoles={['DOCTOR']}>
              <Layout title="Doctor Dashboard" subtitle="Patient consultation and medical orders">
                <DoctorDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/doctor/consultation/:visitId"
          element={
            <ProtectedRoute allowedRoles={['DOCTOR']}>
              <PatientConsultationPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/doctor/abortion-care"
          element={
            <ProtectedRoute allowedRoles={['DOCTOR', 'NURSE', 'ADMIN', 'REPORT']}>
              <Layout title="Abortion Care" subtitle="Comprehensive abortion care services register">
                <AbortionCarePage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/doctor/admissions"
          element={
            <ProtectedRoute allowedRoles={['DOCTOR', 'ADMIN', 'NURSE']}>
              <AdmissionManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/doctor/*"
          element={
            <ProtectedRoute allowedRoles={['DOCTOR']}>
              <Layout title="Doctor Dashboard" subtitle="Patient consultation and medical orders">
                <DoctorDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/billing/register"
          element={
            <ProtectedRoute allowedRoles={['BILLING_OFFICER', 'RECEPTIONIST', 'ADMIN']}>
              <Layout title="Patient Registration & Visit Creation" subtitle="Register new patients or create visits for existing patients">
                <ReceptionPatientRegistration />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/billing/gallery"
          element={
            <ProtectedRoute allowedRoles={['BILLING_OFFICER', 'ADMIN']}>
              <Layout title="Patient Gallery" subtitle="Upload and manage patient images">
                <PatientGallery />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/billing/*"
          element={
            <ProtectedRoute allowedRoles={['BILLING_OFFICER']}>
              <Layout title="Billing Dashboard" subtitle="Payment processing and financial management">
                <BillingDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/emergency-billing"
          element={
            <ProtectedRoute allowedRoles={['BILLING_OFFICER', 'ADMIN']}>
              <Layout title="Emergency Billing" subtitle="Manage emergency patients and their running billing totals">
                <EmergencyBilling />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/cash-management"
          element={
            <ProtectedRoute allowedRoles={['BILLING_OFFICER', 'ADMIN']}>
              <Layout title="Daily Cash Management" subtitle="Track daily cash flow, expenses, and bank deposits">
                <DailyCashManagement />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/doctor-queue"
          element={
            <ProtectedRoute allowedRoles={['BILLING_OFFICER', 'RECEPTIONIST', 'ADMIN']}>
              <Layout title="Doctor Queue Management" subtitle="Real-time doctor availability and patient guidance">
                <DoctorQueueManagement />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/pharmacy-billing/*"
          element={<Navigate to="/pharmacy" replace />}
        />


        <Route
          path="/radiology/walk-in"
          element={
            <ProtectedRoute allowedRoles={['RADIOLOGIST']}>
              <Layout title="Walk-In Radiology Orders" subtitle="Create radiology orders for non-registered patients">
                <RadiologyWalkInOrders />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/radiology/*"
          element={
            <ProtectedRoute allowedRoles={['RADIOLOGIST']}>
              <Layout title="Radiology Dashboard" subtitle="Radiology scan processing and image management">
                <RadiologyDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/lab"
          element={
            <ProtectedRoute allowedRoles={['LAB_TECHNICIAN']}>
              <Layout title="Lab Dashboard" subtitle="Laboratory test processing and result management">
                <LabDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/lab/orders"
          element={
            <ProtectedRoute allowedRoles={['LAB_TECHNICIAN']}>
              <Layout title="Lab Orders" subtitle="View and manage laboratory test orders">
                <LabOrders />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/lab/walk-in"
          element={
            <ProtectedRoute allowedRoles={['LAB_TECHNICIAN']}>
              <Layout title="Walk-In Lab Orders" subtitle="Create lab orders for non-registered patients">
                <WalkInOrders />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/lab/reports"
          element={
            <ProtectedRoute allowedRoles={['LAB_TECHNICIAN']}>
              <Layout title="Lab Reports" subtitle="View lab test statistics and reports">
                <LabReports />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/pharmacy/sales-report"
          element={
            <ProtectedRoute allowedRoles={['PHARMACIST', 'PHARMACY_BILLING_OFFICER']}>
              <Layout title="Sales Report" subtitle="Pharmacy sales overview by date">
                <SalesReport />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/pharmacy/*"
          element={
            <ProtectedRoute allowedRoles={['PHARMACIST', 'PHARMACY_BILLING_OFFICER']}>
              <Layout title="Pharmacy" subtitle="Medication dispensing, billing, and inventory">
                <PharmacyDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/appointments/*"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'DOCTOR']}>
              <DoctorAppointments />
            </ProtectedRoute>
          }
        />

        <Route
          path="/report/*"
          element={
            <ProtectedRoute allowedRoles={['REPORT']}>
              <Layout title="Report Dashboard" subtitle="Health facility reports and statistics">
                <ReportDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Default Route */}
        <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />

        {/* 404 Route */}
        <Route path="*" element={
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
              <p className="text-gray-600">Page not found</p>
            </div>
          </div>
        } />
      </Routes>
    </Router>
  );
};

// Main App Component
const App = () => {
  return (
    <AuthProvider>
      <ClinicSettingsProvider>
      <div className="App">
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#22c55e',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </div>
      </ClinicSettingsProvider>
    </AuthProvider>
  );
};

export default App;
