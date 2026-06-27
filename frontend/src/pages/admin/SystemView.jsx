import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Save, Check, X, ChevronDown } from 'lucide-react';
import api from '../../services/api';
import { reloadClinicSettings } from '../../services/clinicSettings';
import {
  DOCTOR_WORKSPACE_PROFILES,
  DOCTOR_WORKSPACE_PROFILE_LABELS,
  ACTIVE_DOCTOR_TAB_OPTIONS,
  COMPLETED_DOCTOR_TAB_OPTIONS,
  TRIAGE_DOCTOR_TAB_OPTIONS,
  parseDoctorWorkspaceConfig,
} from '../../utils/doctorWorkspace';

const ROLES = ['ADMIN', 'DOCTOR', 'NURSE', 'BILLING_OFFICER', 'RECEPTIONIST', 'PHARMACY_BILLING_OFFICER', 'PHARMACIST', 'LAB_TECHNICIAN', 'RADIOLOGIST', 'REPORT'];

const ROLE_SIDEBAR_ITEMS = {
  ADMIN: [
    { key: 'dashboard', label: 'Dashboard', href: '/' },
    { key: 'staffManagement', label: 'Staff Management', href: '/admin/staff' },
    { key: 'patientManagement', label: 'Patient Management', href: '/admin/patients' },
    { key: 'serviceManagement', label: 'Service Management', href: '/admin/services' },
    { key: 'reports', label: 'Report (Medical Clinic, Doctor, Billing)', href: '/admin/reports' },
    { key: 'labReports', label: 'Lab Reports', href: '/admin/lab-reports' },
    { key: 'nurseReport', label: 'Nurse Report', href: '/admin/nurse-performance' },
    { key: 'diseaseManagement', label: 'Disease Management', href: '/admin/disease-management' },
    { key: 'diseaseReports', label: 'Disease Reports', href: '/admin/disease-reports' },
    { key: 'ageGenderDisease', label: 'Age-Gender Distribution', href: '/admin/age-gender-disease-distribution' },
    { key: 'doctorPerformance', label: 'Doctor Performance', href: '/admin/doctor-performance' },
    { key: 'patientAccounts', label: 'Patient Accounts', href: '/admin/patient-accounts' },
    { key: 'bedManagement', label: 'Bed Management', href: '/admin/beds' },
    { key: 'cardProducts', label: 'Card Products', href: '/admin/card-products' },
    { key: 'auditLogs', label: 'Audit Logs', href: '/admin/audit' },
    { key: 'loanApproval', label: 'Loan Approval', href: '/admin/loan-approval' },
    { key: 'systemView', label: 'System View', href: '/admin/system-view' },
  ],
  DOCTOR: [
    { key: 'dashboard', label: 'Dashboard', href: '/' },
    { key: 'patientQueue', label: 'Patient Queue', href: '/doctor/queue' },
    { key: 'dailyWork', label: 'Daily Work', href: '/doctor/daily-work' },
    { key: 'admissions', label: 'Bed & Admissions', href: '/doctor/admissions' },
    { key: 'patientHistory', label: 'Patient History', href: '/doctor/history' },
    { key: 'medicalCertificate', label: 'Medical Certificate', href: '/doctor/medical-certificates' },
    { key: 'internationalCertificate', label: 'International Certificate', href: '/doctor/international-certificates' },
    { key: 'referPatient', label: 'Refer Patient', href: '/doctor/referrals' },
    { key: 'abortionCare', label: 'Abortion Care', href: '/doctor/abortion-care' },
    { key: 'familyPlanning', label: 'Family Planning', href: '/nurse/family-planning' },
    { key: 'appointments', label: 'Appointments', href: '/appointments' },
    { key: 'loans', label: 'Loans', href: '/loans' },
  ],
  NURSE: [
    { key: 'dashboard', label: 'Dashboard', href: '/' },
    { key: 'triageQueue', label: 'Triage Queue', href: '/nurse/queue' },
    { key: 'admissions', label: 'Bed & Admissions', href: '/nurse/admissions' },
    { key: 'dailyTasks', label: 'Daily Tasks', href: '/nurse/tasks' },
    { key: 'walkInServices', label: 'Walk-in Services', href: '/nurse/walk-in-services' },
    { key: 'walkInOrders', label: 'Walk-in Orders', href: '/nurse/walk-in-orders' },
    { key: 'continuousVitals', label: 'Continuous Vitals', href: '/nurse/continuous-vitals' },
    { key: 'familyPlanning', label: 'Family Planning', href: '/nurse/family-planning' },
    { key: 'gallery', label: 'Patient Gallery', href: '/nurse/gallery' },
    { key: 'appointments', label: 'Appointments', href: '/nurse/appointments' },
    { key: 'loans', label: 'Loans', href: '/loans' },
  ],
  RECEPTIONIST: [
    { key: 'dashboard', label: 'Dashboard', href: '/' },
    { key: 'patientRegistration', label: 'Patient Registration', href: '/reception/register' },
    { key: 'patientManagement', label: 'Patient Management', href: '/reception/patients' },
    { key: 'patientAccounts', label: 'Patient Accounts', href: '/reception/patient-accounts' },
    { key: 'prints', label: 'Prints', href: '/reception/prints' },
    { key: 'appointments', label: 'Appointments', href: '/reception/appointments' },
    { key: 'preRegistration', label: 'Pre-Registration', href: '/reception/pre-registration' },
    { key: 'doctorQueueManagement', label: 'Doctor Queue Management', href: '/reception/doctor-queue' },
    { key: 'gallery', label: 'Patient Gallery', href: '/reception/gallery' },
    { key: 'loans', label: 'Loans', href: '/loans' },
  ],
  BILLING_OFFICER: [
    { key: 'dashboard', label: 'Dashboard', href: '/' },
    { key: 'billingQueue', label: 'Billing Queue', href: '/billing/queue' },
    { key: 'emergencyBilling', label: 'Emergency Billing', href: '/emergency-billing' },
    { key: 'advanceDeposits', label: 'Advance Deposits', href: '/billing/advance-deposits' },
    { key: 'patientAccounts', label: 'Patient Accounts', href: '/billing/patient-accounts' },
    { key: 'creditInstallments', label: 'Credit Installments', href: '/billing/credit-accounts' },
    { key: 'cashManagement', label: 'Cash Management', href: '/cash-management' },
    { key: 'loans', label: 'Loans', href: '/loans' },
    { key: 'patientRegistration', label: 'Patient Registration', href: '/billing/register' },
    { key: 'patientManagement', label: 'Patient Management', href: '/billing/patients' },
    { key: 'preRegistration', label: 'Pre-Registration', href: '/billing/pre-registration' },
    { key: 'appointments', label: 'Appointments', href: '/billing/appointments' },
    { key: 'doctorQueue', label: 'Doctor Queue', href: '/doctor-queue' },
    { key: 'prints', label: 'Prints', href: '/billing/prints' },
    { key: 'walkInLabRadiology', label: 'Walk-In Lab/Radiology', href: '/billing/walk-in-orders' },
    { key: 'gallery', label: 'Patient Gallery', href: '/billing/gallery' },
  ],
  PHARMACY_BILLING_OFFICER: [
    { key: 'dashboard', label: 'Dashboard', href: '/' },
    { key: 'pharmacyBilling', label: 'Pharmacy Billing', href: '/pharmacy-billing/invoices' },
    { key: 'prescriptionQueue', label: 'Prescription Queue', href: '/pharmacy/queue' },
    { key: 'inventory', label: 'Inventory', href: '/pharmacy/inventory' },
    { key: 'pharmacyWalkInSales', label: 'Walk-in Sales', href: '/pharmacy/walk-in-sales' },
    { key: 'loans', label: 'Loans', href: '/loans' },
  ],
  PHARMACIST: [
    { key: 'dashboard', label: 'Dashboard', href: '/' },
    { key: 'pharmacyBilling', label: 'Pharmacy Billing', href: '/pharmacy-billing/invoices' },
    { key: 'prescriptionQueue', label: 'Prescription Queue', href: '/pharmacy/queue' },
    { key: 'inventory', label: 'Inventory', href: '/pharmacy/inventory' },
    { key: 'pharmacyWalkInSales', label: 'Walk-in Sales', href: '/pharmacy/walk-in-sales' },
    { key: 'loans', label: 'Loans', href: '/loans' },
  ],
  LAB_TECHNICIAN: [
    { key: 'dashboard', label: 'Dashboard', href: '/' },
    { key: 'labOrders', label: 'Lab Orders', href: '/lab/orders' },
    { key: 'labWalkIn', label: 'Walk-In Orders', href: '/lab/walk-in' },
    { key: 'labReports_tech', label: 'Lab Reports', href: '/lab/reports' },
    { key: 'loans', label: 'Loans', href: '/loans' },
  ],
  RADIOLOGIST: [
    { key: 'dashboard', label: 'Dashboard', href: '/' },
    { key: 'radiologyOrders', label: 'Radiology Orders', href: '/radiology/orders' },
    { key: 'radiologyWalkIn', label: 'Walk-In Orders', href: '/radiology/walk-in' },
    { key: 'loans', label: 'Loans', href: '/loans' },
  ],
  REPORT: [
    { key: 'dashboard', label: 'Dashboard', href: '/' },
    { key: 'reports', label: 'Reports', href: '/report' },
    { key: 'patientManagement', label: 'Patient Management', href: '/admin/patients' },
    { key: 'labReports', label: 'Lab Reports', href: '/admin/lab-reports' },
    { key: 'diseaseReports', label: 'Disease Reports', href: '/admin/disease-reports' },
    { key: 'ageGenderDisease', label: 'Age-Gender Distribution', href: '/admin/age-gender-disease-distribution' },
    { key: 'doctorPerformance', label: 'Doctor Performance', href: '/admin/doctor-performance' },
    { key: 'loans', label: 'Loans', href: '/loans' },
  ],
};

const TRIAGE_SECTIONS = [
  { key: 'vitals', label: 'Vitals' },
  { key: 'complaint', label: 'Complaint & History' },
  { key: 'examination', label: 'Physical Examination' },
  { key: 'nurseService', label: 'Nurse Services' },
  { key: 'dentalService', label: 'Dental Services' },
  { key: 'materialNeeds', label: 'Material Needs' },
  { key: 'familyPlanning', label: 'Family Planning' },
  { key: 'assignment', label: 'Doctor Assignment' },
];

const TABS = [
  { id: 'active', label: 'Active Queue Tabs' },
  { id: 'completed', label: 'Completed Queue Tabs' },
  { id: 'triage', label: 'Triage Queue Tabs' },
  { id: 'nurseTriage', label: 'Nurse Triage Form' },
  { id: 'sidebar', label: 'Sidebar Visibility' },
  { id: 'clinic', label: 'Clinic Settings' },
  { id: 'report', label: 'Report Settings' },
];

function ToggleSwitch({ enabled, onChange }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
        enabled ? 'bg-green-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function DoctorTabPanel({ sectionKey, tabOptions, config, onChange }) {
  const toggleTab = (profile, tabId) => {
    onChange(prev => {
      const currentTabs = prev[sectionKey][profile] || [];
      const nextTabs = currentTabs.includes(tabId)
        ? currentTabs.filter(t => t !== tabId)
        : [...currentTabs, tabId];
      return { ...prev, [sectionKey]: { ...prev[sectionKey], [profile]: nextTabs } };
    });
  };

  const toggleAllForProfile = (profile, enabled) => {
    onChange(prev => {
      const allIds = tabOptions.map(t => t.id);
      return { ...prev, [sectionKey]: { ...prev[sectionKey], [profile]: enabled ? allIds : [] } };
    });
  };

  const isFilteredSection = sectionKey !== 'activeTabVisibility';

  return (
    <div className="space-y-0">
      {DOCTOR_WORKSPACE_PROFILES.map(profile => {
        const selectedTabs = config[sectionKey]?.[profile] || [];
        const activeTabs = config.activeTabVisibility?.[profile] || [];

        return (
          <div key={profile} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6 last:mb-0">
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
              <div>
                <h4 className="font-semibold text-gray-900">{DOCTOR_WORKSPACE_PROFILE_LABELS[profile]}</h4>
                <p className="text-xs text-gray-500">{selectedTabs.length} / {tabOptions.length} visible</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => toggleAllForProfile(profile, true)}
                  className="px-2 py-1 rounded text-xs bg-green-100 text-green-700 hover:bg-green-200 font-medium"
                >
                  All
                </button>
                <button
                  onClick={() => toggleAllForProfile(profile, false)}
                  className="px-2 py-1 rounded text-xs bg-red-100 text-red-700 hover:bg-red-200 font-medium"
                >
                  None
                </button>
              </div>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {tabOptions.map(tab => {
                const activeEnabled = !isFilteredSection || activeTabs.includes(tab.id);
                const selected = selectedTabs.includes(tab.id);
                return (
                  <label
                    key={tab.id}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                      selected ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-white hover:border-gray-200'
                    } ${!activeEnabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <input type="checkbox" checked={selected} onChange={() => activeEnabled && toggleTab(profile, tab.id)} disabled={!activeEnabled} className="sr-only" />
                    <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${selected ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>
                      {selected && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <span className={`text-sm font-medium truncate ${selected ? 'text-green-800' : 'text-gray-600'}`}>{tab.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SidebarTab({ sidebarConfig, setSidebarConfig, saving, onSave }) {
  const [selectedRole, setSelectedRole] = useState('DOCTOR');

  const items = ROLE_SIDEBAR_ITEMS[selectedRole] || [];
  const roleItems = sidebarConfig[selectedRole] || [];
  const enabledCount = items.filter(i => roleItems.includes(i.key)).length;

  const toggleItem = (key) => {
    setSidebarConfig(prev => {
      const current = prev[selectedRole] || [];
      const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
      return { ...prev, [selectedRole]: next };
    });
  };

  const showAll = () => {
    setSidebarConfig(prev => ({ ...prev, [selectedRole]: items.map(i => i.key) }));
  };

  const hideAll = () => {
    setSidebarConfig(prev => ({ ...prev, [selectedRole]: [] }));
  };

  const roleColors = {
    ADMIN: 'bg-purple-500 text-white',
    DOCTOR: 'bg-blue-600 text-white',
    NURSE: 'bg-green-600 text-white',
    BILLING_OFFICER: 'bg-yellow-500 text-gray-900',
    RECEPTIONIST: 'bg-pink-500 text-white',
    PHARMACY_BILLING_OFFICER: 'bg-orange-500 text-white',
    PHARMACIST: 'bg-orange-600 text-white',
    LAB_TECHNICIAN: 'bg-cyan-600 text-white',
    RADIOLOGIST: 'bg-teal-600 text-white',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <label className="text-sm font-semibold text-gray-700">Select Role:</label>
        <div className="flex gap-2 flex-wrap">
          {ROLES.map(role => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedRole === role
                  ? `${roleColors[role] || 'bg-blue-500 text-white'} shadow`
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {role.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{selectedRole.replace(/_/g, ' ')}</h3>
            <p className="text-sm text-gray-600 mt-1">
              {enabledCount} of {items.length} sidebar buttons visible
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={showAll}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-500 text-white hover:bg-green-600 font-semibold transition-colors shadow-sm"
            >
              <Check className="h-4 w-4" /> Show All
            </button>
            <button
              onClick={hideAll}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-400 text-white hover:bg-gray-500 font-semibold transition-colors shadow-sm"
            >
              <X className="h-4 w-4" /> Hide All
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map(item => {
          const enabled = roleItems.includes(item.key);
          return (
            <div
              key={item.key}
              className={`flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all ${
                enabled
                  ? 'bg-green-50 border-green-200 shadow-sm'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <ToggleSwitch enabled={enabled} onChange={() => toggleItem(item.key)} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${enabled ? 'text-green-900' : 'text-gray-600'}`}>
                  {item.label}
                </p>
                <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">{item.href}</p>
              </div>
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-100">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-semibold shadow-sm transition-colors text-base"
        >
          <Save className="h-5 w-5" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

const SystemView = () => {
  const [activeTab, setActiveTab] = useState('active');
  const [loading, setLoading] = useState(true);
  const [savingTab, setSavingTab] = useState(null);
  const [sidebarConfig, setSidebarConfig] = useState({});
  const [doctorConfig, setDoctorConfig] = useState(parseDoctorWorkspaceConfig(null));
  const [clinicForm, setClinicForm] = useState({ name: '', tagline: '' });
  const [clinicLogo, setClinicLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [savingClinic, setSavingClinic] = useState(false);
  const [reportManipPercent, setReportManipPercent] = useState(50);
  const [savingReport, setSavingReport] = useState(false);
  const [nurseTriageConfig, setNurseTriageConfig] = useState(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [visRes, wsRes, clinicRes, reportRes, nurseTriageRes] = await Promise.all([
        api.get('/admin/sidebar-visibility'),
        api.get('/admin/system-settings/doctorWorkspaceConfig'),
        api.get('/admin/clinic-settings'),
        api.get('/admin/system-settings/reportManipulationPercent').catch(() => ({ data: { setting: { value: '50' } } })),
        api.get('/admin/system-settings/nurseTriageVisibilityConfig').catch(() => ({ data: { setting: null } })),
      ]);
      setSidebarConfig(visRes.data.config || {});
      setDoctorConfig(parseDoctorWorkspaceConfig(wsRes.data.setting?.value));
      setClinicForm({ name: clinicRes.data.name || '', tagline: clinicRes.data.tagline || '' });
      const reportVal = reportRes?.data?.setting?.value;
      setReportManipPercent(reportVal ? parseInt(reportVal) : 50);
      const nurseTriageVal = nurseTriageRes?.data?.setting?.value;
      setNurseTriageConfig(nurseTriageVal ? JSON.parse(nurseTriageVal) : null);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDoctorWorkspace = async () => {
    try {
      setSavingTab(activeTab);
      await api.put('/admin/system-settings/doctorWorkspaceConfig', {
        value: JSON.stringify(doctorConfig),
        description: 'Doctor workspace configuration',
      });
      toast.success('Settings saved');
      window.dispatchEvent(new CustomEvent('doctor-workspace-updated', { detail: { config: doctorConfig } }));
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save');
    } finally {
      setSavingTab(null);
    }
  };

  const handleSaveSidebar = async () => {
    try {
      setSavingTab('sidebar');
      await api.put('/admin/sidebar-visibility', { config: sidebarConfig });
      toast.success('Sidebar visibility saved');
      window.dispatchEvent(new CustomEvent('sidebar-visibility-updated', { detail: { config: sidebarConfig } }));
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save');
    } finally {
      setSavingTab(null);
    }
  };

  const handleSaveClinic = async () => {
    try {
      setSavingClinic(true);
      await api.put('/admin/clinic-settings', { name: clinicForm.name, tagline: clinicForm.tagline });
      await reloadClinicSettings();
      toast.success('Clinic settings saved');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save');
    } finally {
      setSavingClinic(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setClinicLogo(file);
    setLogoPreview(URL.createObjectURL(file));
    const formData = new FormData();
    formData.append('logo', file);
    try {
      await api.post('/admin/clinic-settings/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      await reloadClinicSettings();
      toast.success('Logo uploaded');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to upload logo');
    }
  };

  const handleSaveNurseTriage = async () => {
    try {
      setSavingTab('nurseTriage');
      const configToSave = nurseTriageConfig || TRIAGE_SECTIONS.reduce((acc, s) => ({ ...acc, [s.key]: true }), {});
      await api.put('/admin/system-settings/nurseTriageVisibilityConfig', {
        value: JSON.stringify(configToSave),
        description: 'Nurse triage form section visibility',
      });
      toast.success('Nurse triage form settings saved');
      window.dispatchEvent(new CustomEvent('nurse-triage-visibility-updated', { detail: { config: configToSave } }));
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save');
    } finally {
      setSavingTab(null);
    }
  };

  const handleSaveReportPercent = async () => {
    try {
      setSavingReport(true);
      await api.put('/admin/system-settings/reportManipulationPercent', {
        value: String(reportManipPercent),
        description: 'Percentage to reduce all report data by for REPORT role users',
      });
      toast.success(`Report data will be shown at ${reportManipPercent}% of actual values`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save');
    } finally {
      setSavingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System View Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Control which features each role can see and access</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        {activeTab === 'active' && (
          <>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
              <p className="text-sm text-blue-800">Control which consultation tabs each doctor profile sees in the Active Queue.</p>
            </div>
            <DoctorTabPanel sectionKey="activeTabVisibility" tabOptions={ACTIVE_DOCTOR_TAB_OPTIONS} config={doctorConfig} onChange={setDoctorConfig} />
            <div className="flex justify-end pt-6 border-t border-gray-100 mt-6">
              <button onClick={handleSaveDoctorWorkspace} disabled={savingTab === 'active'} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-semibold shadow-sm">
                <Save className="h-4 w-4" /> {savingTab === 'active' ? 'Saving...' : 'Save Active Queue Settings'}
              </button>
            </div>
          </>
        )}
        {activeTab === 'completed' && (
          <>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
              <p className="text-sm text-amber-800">Tabs hidden in Active Queue remain hidden here.</p>
            </div>
            <DoctorTabPanel sectionKey="completedTabVisibility" tabOptions={COMPLETED_DOCTOR_TAB_OPTIONS} config={doctorConfig} onChange={setDoctorConfig} />
            <div className="flex justify-end pt-6 border-t border-gray-100 mt-6">
              <button onClick={handleSaveDoctorWorkspace} disabled={savingTab === 'completed'} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-semibold shadow-sm">
                <Save className="h-4 w-4" /> {savingTab === 'completed' ? 'Saving...' : 'Save Completed Queue Settings'}
              </button>
            </div>
          </>
        )}
        {activeTab === 'triage' && (
          <>
            <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-3 mb-4">
              <p className="text-sm text-cyan-800">Tabs hidden in Active Queue remain hidden here.</p>
            </div>
            <DoctorTabPanel sectionKey="triageTabVisibility" tabOptions={TRIAGE_DOCTOR_TAB_OPTIONS} config={doctorConfig} onChange={setDoctorConfig} />
            <div className="flex justify-end pt-6 border-t border-gray-100 mt-6">
              <button onClick={handleSaveDoctorWorkspace} disabled={savingTab === 'triage'} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-semibold shadow-sm">
                <Save className="h-4 w-4" /> {savingTab === 'triage' ? 'Saving...' : 'Save Triage Queue Settings'}
              </button>
            </div>
          </>
        )}
        {activeTab === 'nurseTriage' && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-100 rounded-xl p-3 mb-4">
              <p className="text-sm text-green-800">Control which sections appear in the Nurse Triage form. Hidden sections are removed from the form entirely.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {TRIAGE_SECTIONS.map(section => {
                const enabled = !nurseTriageConfig || nurseTriageConfig[section.key] !== false;
                return (
                  <div
                    key={section.key}
                    className={`flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all ${
                      enabled
                        ? 'bg-green-50 border-green-200 shadow-sm'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <ToggleSwitch
                      enabled={enabled}
                      onChange={() => setNurseTriageConfig(prev => {
                        const current = prev || TRIAGE_SECTIONS.reduce((acc, s) => ({ ...acc, [s.key]: true }), {});
                        return { ...current, [section.key]: !current[section.key] };
                      })}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${enabled ? 'text-green-900' : 'text-gray-600'}`}>
                        {section.label}
                      </p>
                    </div>
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end pt-4 border-t border-gray-100">
              <button
                onClick={handleSaveNurseTriage}
                disabled={savingTab === 'nurseTriage'}
                className="flex items-center gap-2 px-8 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 font-semibold shadow-sm transition-colors text-base"
              >
                <Save className="h-5 w-5" />
                {savingTab === 'nurseTriage' ? 'Saving...' : 'Save Nurse Triage Settings'}
              </button>
            </div>
          </div>
        )}
        {activeTab === 'sidebar' && (
          <SidebarTab sidebarConfig={sidebarConfig} setSidebarConfig={setSidebarConfig} saving={savingTab === 'sidebar'} onSave={handleSaveSidebar} />
        )}
        {activeTab === 'report' && (
          <div className="space-y-6">
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 mb-4">
              <p className="text-sm text-purple-800">Control data masking for REPORT role users. All numeric values in reports will be reduced by this percentage. Actual database data is never modified.</p>
            </div>
            <div className="max-w-md space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Data Display Percentage</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={reportManipPercent}
                    onChange={e => setReportManipPercent(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                  <span className="text-2xl font-bold text-purple-700 min-w-[4rem] text-center">{reportManipPercent}%</span>
                </div>
                <p className="text-sm text-gray-500 mt-2">Set to 50% to show half the actual data. Set to 100% to show real numbers.</p>
              </div>
              <div className="flex justify-end pt-4">
                <button onClick={handleSaveReportPercent} disabled={savingReport} className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 font-semibold shadow-sm">
                  <Save className="h-4 w-4" /> {savingReport ? 'Saving...' : 'Save Report Settings'}
                </button>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'clinic' && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-100 rounded-xl p-3 mb-4">
              <p className="text-sm text-green-800">Update your clinic name, tagline, and logo. Changes appear across the entire system instantly.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Clinic Name</label>
                  <input type="text" value={clinicForm.name} onChange={e => setClinicForm({ ...clinicForm, name: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="Enter clinic name" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Tagline</label>
                  <input type="text" value={clinicForm.tagline} onChange={e => setClinicForm({ ...clinicForm, tagline: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500" placeholder="Enter tagline" />
                </div>
                <div className="flex justify-end pt-4">
                  <button onClick={handleSaveClinic} disabled={savingClinic} className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 font-semibold shadow-sm">
                    <Save className="h-4 w-4" /> {savingClinic ? 'Saving...' : 'Save Clinic Settings'}
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Clinic Logo</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-green-400 transition">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Preview" className="max-h-32 mx-auto mb-3 object-contain" />
                    ) : (
                      <div className="text-gray-400 mb-3">
                        <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                    )}
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 cursor-pointer text-sm font-medium">
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      {logoPreview ? 'Change Logo' : 'Upload Logo'}
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemView;