const express = require('express');
const adminController = require('../controllers/adminController');
const systemSettingsController = require('../controllers/systemSettingsController');
const sidebarVisibilityController = require('../controllers/sidebarVisibilityController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const fileUpload = require('../middleware/fileUpload');
const reportDataTransform = require('../middleware/reportDataTransform');

const router = express.Router();

router.use(auth);

// User Management
router.post('/users', roleGuard(['ADMIN']), adminController.createUser);
router.get('/users', roleGuard(['ADMIN']), adminController.getUsers);
router.put('/users/:id', roleGuard(['ADMIN']), adminController.updateUser);
router.delete('/users/:id', roleGuard(['ADMIN']), adminController.deleteUser);
router.put('/users/:id/password', roleGuard(['ADMIN']), adminController.updateUserPassword);

// Service Management
router.post('/services', roleGuard(['ADMIN']), adminController.createService);
router.get('/services', roleGuard(['ADMIN']), adminController.getServices);
router.put('/services/:id', roleGuard(['ADMIN']), adminController.updateService);
router.delete('/services/:id', roleGuard(['ADMIN']), adminController.deleteService);

// Nurse Management
router.get('/nurses', roleGuard(['ADMIN']), adminController.getNurses);

// Insurance Management
router.post('/insurances', roleGuard(['ADMIN']), adminController.createInsurance);
router.get('/insurances', roleGuard(['ADMIN']), adminController.getInsurances);
router.put('/insurances/:id', roleGuard(['ADMIN']), adminController.updateInsurance);
router.delete('/insurances/:id', roleGuard(['ADMIN']), adminController.deleteInsurance);

// Investigation Types Management
router.post('/investigation-types', roleGuard(['ADMIN']), adminController.createInvestigationType);
router.get('/investigation-types', roleGuard(['ADMIN']), adminController.getInvestigationTypes);

// Lab Test Management (New System)
router.get('/lab-test-categories', roleGuard(['ADMIN']), adminController.getLabTestCategories);
router.post('/lab-test-groups', roleGuard(['ADMIN']), adminController.createLabTestGroup);
router.get('/lab-test-groups', roleGuard(['ADMIN']), adminController.getLabTestGroups);
router.put('/lab-test-groups/:id', roleGuard(['ADMIN']), adminController.updateLabTestGroup);
router.delete('/lab-test-groups/:id', roleGuard(['ADMIN']), adminController.deleteLabTestGroup);

router.post('/lab-tests', roleGuard(['ADMIN']), adminController.createLabTest);
router.get('/lab-tests', roleGuard(['ADMIN']), adminController.getLabTests);
router.get('/lab-tests/for-ordering', roleGuard(['ADMIN']), adminController.getLabTestsForOrdering);
router.get('/lab-pricing', roleGuard(['ADMIN']), adminController.getLabPricing);
router.get('/lab-tests/:id', roleGuard(['ADMIN']), adminController.getLabTest);
router.put('/lab-tests/:id', roleGuard(['ADMIN']), adminController.updateLabTest);
router.delete('/lab-tests/:id', roleGuard(['ADMIN']), adminController.deleteLabTest);

// Inventory Management
router.post('/inventory', roleGuard(['ADMIN']), adminController.createInventoryItem);
router.get('/inventory', roleGuard(['ADMIN']), adminController.getInventory);
router.put('/inventory/:id', roleGuard(['ADMIN']), adminController.updateInventoryItem);

// Billing Overview
router.get('/billing-overview', roleGuard(['ADMIN', 'REPORT']), reportDataTransform, adminController.getBillingOverview);

// Audit Logs
router.get('/audit-logs', roleGuard(['ADMIN']), adminController.getAuditLogs);

// Dashboard Stats
router.get('/dashboard-stats', roleGuard(['ADMIN', 'REPORT']), reportDataTransform, adminController.getDashboardStats);

// Reports
router.get('/reports/daily', roleGuard(['ADMIN', 'REPORT']), reportDataTransform, adminController.getDailyReport);
router.get('/reports/weekly', roleGuard(['ADMIN', 'REPORT']), reportDataTransform, adminController.getWeeklyReport);
router.get('/reports/revenue', roleGuard(['ADMIN', 'REPORT']), reportDataTransform, adminController.getRevenueReport);
router.get('/reports/revenue-stats', roleGuard(['ADMIN', 'REPORT']), reportDataTransform, adminController.getRevenueStats);
router.get('/reports/daily-breakdown', roleGuard(['ADMIN', 'REPORT']), reportDataTransform, adminController.getDailyBreakdown);
router.post('/reports/export-excel', roleGuard(['ADMIN', 'REPORT']), adminController.exportFinancialReportExcel);
router.post('/reports/export-pdf', roleGuard(['ADMIN', 'REPORT']), adminController.exportFinancialReportPDF);

// Doctor Performance
router.get('/reports/doctor-performance', roleGuard(['ADMIN', 'REPORT']), reportDataTransform, adminController.getDoctorPerformanceStats);
router.get('/reports/doctor-daily-breakdown', roleGuard(['ADMIN', 'REPORT']), reportDataTransform, adminController.getDoctorDailyBreakdown);
router.get('/reports/doctor-day-details', roleGuard(['ADMIN', 'REPORT']), reportDataTransform, adminController.getDoctorDayProcedureDetails);

// Billing Performance
router.get('/reports/billing-performance', roleGuard(['ADMIN', 'REPORT']), reportDataTransform, adminController.getBillingPerformanceStats);
router.get('/reports/billing-daily-breakdown', roleGuard(['ADMIN', 'REPORT']), reportDataTransform, adminController.getBillingUserDailyBreakdown);
router.get('/reports/billing-day-details', roleGuard(['ADMIN', 'REPORT']), reportDataTransform, adminController.getBillingUserDayDetails);

// Nurse Performance
router.get('/reports/nurse-performance', roleGuard(['ADMIN', 'REPORT']), reportDataTransform, adminController.getNursePerformanceStats);
router.get('/reports/nurse-daily-breakdown', roleGuard(['ADMIN', 'REPORT']), reportDataTransform, adminController.getNurseDailyBreakdown);
router.get('/reports/nurse-day-details', roleGuard(['ADMIN', 'REPORT']), reportDataTransform, adminController.getNurseDayDetails);

// System Settings
router.get('/system-settings', systemSettingsController.getSystemSettings);
router.get('/system-settings/:key', systemSettingsController.getSetting);
router.put('/system-settings/:key', roleGuard(['ADMIN']), systemSettingsController.updateSetting);

// Sidebar Visibility
router.get('/sidebar-visibility', sidebarVisibilityController.getSidebarVisibility);
router.put('/sidebar-visibility', roleGuard(['ADMIN']), sidebarVisibilityController.updateSidebarVisibility);
router.get('/sidebar-roles', sidebarVisibilityController.getSidebarRoles);
router.get('/sidebar-items', sidebarVisibilityController.getSidebarItems);

// Departments
router.get('/departments', adminController.getDepartments);

// Card Products Management
router.get('/card-products', adminController.getCardProducts);
router.post('/card-products', roleGuard(['ADMIN']), adminController.createCardProduct);
router.put('/card-products/:id', roleGuard(['ADMIN']), adminController.updateCardProduct);
router.delete('/card-products/:id', roleGuard(['ADMIN']), adminController.deleteCardProduct);

// Clinic Settings
router.get('/clinic-settings', adminController.getClinicSettings);
router.put('/clinic-settings', roleGuard(['ADMIN']), adminController.updateClinicSettings);
router.post('/clinic-settings/logo', roleGuard(['ADMIN']), fileUpload.single('logo'), adminController.uploadClinicLogo);

// Reports
router.get('/reports/central-register', roleGuard(['ADMIN', 'REPORT']), reportDataTransform, adminController.getCentralRegister);
router.get('/reports/disease-tally', roleGuard(['ADMIN', 'REPORT']), reportDataTransform, adminController.getDiseaseTallySheet);

// Patient Management
router.get('/patients', roleGuard(['ADMIN', 'REPORT']), reportDataTransform, adminController.getAllPatients);
router.post('/patients/:patientId/complete-visit', roleGuard(['ADMIN']), adminController.completePatientVisit);
router.delete('/patients/bulk', roleGuard(['ADMIN']), adminController.deleteMultiplePatients);
router.delete('/patients/:patientId', roleGuard(['ADMIN']), adminController.deletePatient);

// Doctor Commissions
router.get('/doctor-commissions', roleGuard(['ADMIN']), adminController.getDoctorCommissions);
router.get('/doctor-commissions/:doctorId', roleGuard(['ADMIN']), adminController.getSingleDoctorCommissions);
router.put('/doctor-commissions/:doctorId', roleGuard(['ADMIN']), adminController.updateDoctorCommissions);

// Radiologist Commissions
router.get('/radiologist-commissions', roleGuard(['ADMIN']), adminController.getRadiologistCommissions);
router.put('/radiologist-commissions/:radiologistId', roleGuard(['ADMIN']), adminController.updateRadiologistCommission);

// Institution Management
const institutionController = require('../controllers/institutionController');

router.get('/institutions/patient/:patientId', roleGuard(['ADMIN', 'BILLING_OFFICER']), institutionController.getPatientInstitutions);
router.get('/institutions', roleGuard(['ADMIN', 'BILLING_OFFICER']), institutionController.getInstitutions);
router.get('/institutions/:id', roleGuard(['ADMIN', 'BILLING_OFFICER']), institutionController.getInstitution);
router.post('/institutions', roleGuard(['ADMIN']), institutionController.createInstitution);
router.put('/institutions/:id', roleGuard(['ADMIN']), institutionController.updateInstitution);
router.delete('/institutions/:id', roleGuard(['ADMIN']), institutionController.deleteInstitution);
router.get('/institutions/:id/patients', roleGuard(['ADMIN']), institutionController.getLinkedPatients);
router.post('/institutions/:id/patients/link', roleGuard(['ADMIN']), institutionController.linkPatient);
router.delete('/institutions/:id/patients/:linkId', roleGuard(['ADMIN']), institutionController.unlinkPatient);
router.post('/institutions/:id/patients/create-and-link', roleGuard(['ADMIN']), institutionController.createAndLinkPatient);
router.get('/institutions/:id/report', roleGuard(['ADMIN', 'REPORT']), institutionController.getInstitutionReport);

module.exports = router;
