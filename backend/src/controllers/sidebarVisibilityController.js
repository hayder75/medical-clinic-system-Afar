const prisma = require('../config/database');

const SIDEBAR_VISIBILITY_KEY = 'sidebarVisibilityConfig';

const createDefaultSidebarConfig = () => ({
  ADMIN: ['dashboard', 'staffManagement', 'patientManagement', 'serviceManagement', 'reports', 'medicalClinic', 'doctorPerformance', 'billingReport', 'labReports', 'radiologyReports', 'nurseReport', 'pharmacyReport', 'diseaseReports', 'diseaseTally', 'ageGenderDisease', 'diseaseManagement', 'abortionCare', 'familyPlanning', 'centralRegister', 'patientAccounts', 'bedManagement', 'cardProducts', 'doctorCommissions', 'dailyExpenses', 'auditLogs', 'loanApproval', 'systemView', 'patientRegistration', 'admissions'],
  DOCTOR: ['dashboard', 'patientQueue', 'dailyWork', 'abortionCare', 'familyPlanning', 'admissions', 'patientHistory', 'medicalCertificate', 'internationalCertificate', 'pathology', 'referPatient', 'appointments', 'loans', 'patientRegistration'],
  NURSE: ['dashboard', 'patientRegistration', 'patientManagement', 'triageQueue', 'patientAssignments', 'familyPlanning', 'abortionCare', 'admissions', 'dailyTasks', 'walkInServices', 'walkInOrders', 'continuousVitals', 'gallery', 'appointments', 'loans'],
  RECEPTIONIST: ['dashboard', 'patientRegistration', 'patientManagement', 'patientAccounts', 'prints', 'appointments', 'preRegistration', 'doctorQueueManagement', 'gallery', 'loans'],
  BILLING_OFFICER: ['dashboard', 'billingQueue', 'emergencyBilling', 'advanceDeposits', 'patientAccounts', 'creditInstallments', 'cashManagement', 'loans', 'patientRegistration', 'patientManagement', 'preRegistration', 'appointments', 'doctorQueue', 'prints', 'walkInLabRadiology', 'gallery'],
  PHARMACY_BILLING_OFFICER: ['dashboard', 'pharmacy', 'prescriptionQueue', 'inventory', 'pharmacyWalkInSales', 'salesReport', 'loans'],
  PHARMACIST: ['dashboard', 'pharmacy', 'prescriptionQueue', 'inventory', 'pharmacyWalkInSales', 'salesReport', 'loans'],
  LAB_TECHNICIAN: ['dashboard', 'labOrders', 'labWalkIn', 'labReports_tech', 'loans'],
  RADIOLOGIST: ['dashboard', 'radiologyOrders', 'radiologyWalkIn', 'loans'],
  REPORT: ['reportDashboard', 'centralRegister', 'diseaseTally', 'diseaseReports', 'ageGenderDisease', 'labReports', 'familyPlanning', 'abortionCare'],
});

exports.getSidebarVisibility = async (req, res) => {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key: SIDEBAR_VISIBILITY_KEY },
      include: { updatedBy: { select: { id: true, fullname: true, username: true } } }
    });

    const defaultConfig = createDefaultSidebarConfig();

    if (!setting) {
      await prisma.systemSettings.create({
        data: {
          key: SIDEBAR_VISIBILITY_KEY,
          value: JSON.stringify(defaultConfig),
          description: 'Controls which sidebar items each role can see'
        }
      });
      return res.json({ config: defaultConfig });
    }

    try {
      const config = JSON.parse(setting.value);
      return res.json({ config, updatedBy: setting.updatedBy, updatedAt: setting.updatedAt });
    } catch {
      return res.json({ config: defaultConfig });
    }
  } catch (error) {
    console.error('Error getting sidebar visibility:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateSidebarVisibility = async (req, res) => {
  try {
    const { config } = req.body;
    const userId = req.user.id;

    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'config object is required' });
    }

    const defaultConfig = createDefaultSidebarConfig();
    const validConfig = {};
    Object.keys(defaultConfig).forEach(role => {
      if (Array.isArray(config[role])) {
        validConfig[role] = config[role];
      } else {
        validConfig[role] = defaultConfig[role];
      }
    });
    Object.keys(config).forEach(role => {
      if (!validConfig[role]) {
        validConfig[role] = Array.isArray(config[role]) ? config[role] : [];
      }
    });

    const setting = await prisma.systemSettings.upsert({
      where: { key: SIDEBAR_VISIBILITY_KEY },
      update: {
        value: JSON.stringify(validConfig),
        description: 'Controls which sidebar items each role can see',
        updatedById: userId,
        updatedAt: new Date()
      },
      create: {
        key: SIDEBAR_VISIBILITY_KEY,
        value: JSON.stringify(validConfig),
        description: 'Controls which sidebar items each role can see',
        updatedById: userId
      },
      include: { updatedBy: { select: { id: true, fullname: true, username: true } } }
    });

    res.json({ message: 'Sidebar visibility updated successfully', config: validConfig, updatedBy: setting.updatedBy });
  } catch (error) {
    console.error('Error updating sidebar visibility:', error);
    res.status(400).json({ error: error.message });
  }
};

exports.getSidebarRoles = async (req, res) => {
  const defaultConfig = createDefaultSidebarConfig();
  res.json({ roles: Object.keys(defaultConfig) });
};

exports.getSidebarItems = async (req, res) => {
  const items = {
    dashboard: { label: 'Dashboard', category: 'Dashboard' },
    staffManagement: { label: 'Staff Management', category: 'Admin' },
    patientManagement: { label: 'Patient Management', category: 'Admin' },
    serviceManagement: { label: 'Service Management', category: 'Admin' },
    reports: { label: 'Report (Medical Clinic, Doctor, Billing)', category: 'Admin' },
    labReports: { label: 'Lab Reports', category: 'Admin' },
    radiologyReports: { label: 'Radiology Report', category: 'Admin' },
    nurseReport: { label: 'Nurse Report', category: 'Admin' },
    diseaseReports: { label: 'Disease Reports', category: 'Admin' },
    ageGenderDisease: { label: 'Age-Gender Distribution', category: 'Admin' },
    doctorPerformance: { label: 'Doctor Performance', category: 'Admin' },
    doctorCommissions: { label: 'Doctor Commissions', category: 'Admin' },
    patientAccounts: { label: 'Patient Accounts', category: 'Admin' },
    bedManagement: { label: 'Bed Management', category: 'Admin' },
    auditLogs: { label: 'Audit Logs', category: 'Admin' },
    loanApproval: { label: 'Loan Approval', category: 'Admin' },
    systemView: { label: 'System View', category: 'Admin' },
    patientQueue: { label: 'Patient Queue', category: 'Doctor' },
    dailyWork: { label: 'Daily Work', category: 'Doctor' },
    admissions: { label: 'Bed & Admissions', category: 'Doctor' },
    patientHistory: { label: 'Patient History', category: 'Doctor' },
    medicalCertificate: { label: 'Medical Certificate', category: 'Doctor' },
    internationalCertificate: { label: 'International Certificate', category: 'Doctor' },
    referPatient: { label: 'Refer Patient', category: 'Doctor' },

    familyPlanning: { label: 'Family Planning', category: 'Nurse' },
    abortionCare: { label: 'Abortion Care', category: 'Doctor' },
    centralRegister: { label: 'Central Register', category: 'Admin' },
    diseaseTally: { label: 'Disease Tally Sheet', category: 'Admin' },
    diseaseManagement: { label: 'Disease Management', category: 'Admin' },
    triageQueue: { label: 'Triage Queue', category: 'Nurse' },
    patientAssignments: { label: 'Patient Assignments', category: 'Nurse' },
    dailyTasks: { label: 'Daily Tasks', category: 'Nurse' },
    walkInServices: { label: 'Walk-in Services', category: 'Nurse' },
    walkInOrders: { label: 'Walk-in Orders', category: 'Nurse' },
    continuousVitals: { label: 'Continuous Vitals', category: 'Nurse' },
    patientRegistration: { label: 'Patient Registration', category: 'Shared' },
    gallery: { label: 'Patient Gallery', category: 'Shared' },
    appointments: { label: 'Appointments', category: 'Shared' },
    billingQueue: { label: 'Billing Queue', category: 'Billing' },
    emergencyBilling: { label: 'Emergency Billing', category: 'Billing' },
    advanceDeposits: { label: 'Advance Deposits', category: 'Billing' },
    creditInstallments: { label: 'Credit Installments', category: 'Billing' },
    cashManagement: { label: 'Cash Management', category: 'Billing' },
    doctorQueue: { label: 'Doctor Queue', category: 'Billing' },
    prints: { label: 'Prints', category: 'Billing' },
    walkInLabRadiology: { label: 'Walk-In Lab/Radiology', category: 'Billing' },
    preRegistration: { label: 'Pre-Registration', category: 'Reception' },
    doctorQueueManagement: { label: 'Doctor Queue Management', category: 'Reception' },
    pharmacyBilling: { label: 'Pharmacy Billing', category: 'Pharmacy' },
    prescriptionQueue: { label: 'Prescription Queue', category: 'Pharmacy' },
    inventory: { label: 'Inventory', category: 'Pharmacy' },
    pharmacyWalkInSales: { label: 'Walk-in Sales', category: 'Pharmacy' },
    salesReport: { label: 'Sales Report', category: 'Pharmacy' },
    pathology: { label: 'Pathology Report', category: 'Doctor' },
    radiologyOrders: { label: 'Radiology Orders', category: 'Radiology' },
    radiologyWalkIn: { label: 'Walk-In Orders', category: 'Radiology' },
    labOrders: { label: 'Lab Orders', category: 'Lab' },
    labWalkIn: { label: 'Walk-In Orders', category: 'Lab' },
    labReports_tech: { label: 'Lab Reports', category: 'Lab' },
    loans: { label: 'Loans', category: 'Shared' },
    reportDashboard: { label: 'Report Dashboard', category: 'Report' },
  };
  res.json({ items });
};

exports.getSidebarConfig = async () => {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key: SIDEBAR_VISIBILITY_KEY }
    });
    if (!setting) return createDefaultSidebarConfig();
    try {
      return JSON.parse(setting.value);
    } catch {
      return createDefaultSidebarConfig();
    }
  } catch {
    return createDefaultSidebarConfig();
  }
};

exports.createDefaultSidebarConfig = createDefaultSidebarConfig;