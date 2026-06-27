const express = require('express');
const router = express.Router();
const accommodationController = require('../controllers/accommodationController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

const DOCTOR_ROLES = ['DOCTOR', 'HEALTH_OFFICER', 'DERMATOLOGY'];

// All routes are protected
router.use(auth);

// Bed routes
router.get('/beds', accommodationController.getBeds);
router.post('/beds', roleGuard(['ADMIN']), accommodationController.createBed);
router.put('/beds/:id', roleGuard(['ADMIN']), accommodationController.updateBed);
router.delete('/beds/:id', roleGuard(['ADMIN']), accommodationController.deleteBed);

// Admission routes
router.get('/admissions', accommodationController.getAdmissions);
router.post('/admissions', roleGuard(['ADMIN', ...DOCTOR_ROLES]), accommodationController.createAdmission);
router.post('/admissions/services', roleGuard(['ADMIN', ...DOCTOR_ROLES, 'NURSE']), accommodationController.addAdmissionService);
router.put('/admissions/:id/extend', roleGuard(['ADMIN', ...DOCTOR_ROLES]), accommodationController.extendAdmission);
router.put('/admissions/:id/discharge', roleGuard(['ADMIN', ...DOCTOR_ROLES, 'NURSE']), accommodationController.dischargeAdmission);

module.exports = router;
