const express = require('express');
const nurseController = require('../controllers/nurseController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

const router = express.Router();

router.post('/vitals', nurseController.recordVitals);
router.post('/continuous-vitals', nurseController.recordContinuousVitals);
router.get('/patient-vitals/:patientId', nurseController.getPatientVitals);
router.post('/assignments', nurseController.assignDoctor);
router.post('/assign-nurse-service', nurseController.assignNurseService);
router.post('/assign-nurse-services', nurseController.assignNurseServices);
router.post('/assign-combined', nurseController.assignCombined);
router.get('/queue', nurseController.getPatientQueue);
router.get('/doctors', nurseController.getDoctors);
router.get('/doctors-by-qualification', nurseController.getDoctorsByQualification);
router.get('/services', nurseController.getNurseServices);
router.get('/dental-services', nurseController.getDentalServices);
router.get('/nurses', nurseController.getNurses);
router.get('/today-tasks', nurseController.getTodayTasks);
router.get('/daily-tasks', nurseController.getNurseDailyTasks);
router.get('/dashboard-stats', auth, roleGuard(['NURSE', 'ADMIN']), nurseController.getDashboardStats);
router.post('/complete-service', nurseController.completeNurseService);
router.post('/administer', nurseController.markAdministered);
router.post('/administer-task', nurseController.administerTask);
router.get('/walk-in-orders', auth, roleGuard(['NURSE', 'ADMIN']), nurseController.getWalkInNurseOrders);
router.post('/walk-in-orders/complete', auth, roleGuard(['NURSE', 'ADMIN']), nurseController.completeWalkInNurseOrder);
router.delete('/service-assignment/:id', auth, roleGuard(['DOCTOR', 'NURSE', 'ADMIN']), nurseController.deleteServiceAssignment);

// Nurse reassignment — change patient's doctor before any orders are placed
router.get('/assigned-patients', auth, roleGuard(['NURSE', 'ADMIN']), nurseController.getAssignedPatients);
router.post('/reassign-doctor', auth, roleGuard(['NURSE', 'ADMIN']), nurseController.reassignDoctor);

module.exports = router;