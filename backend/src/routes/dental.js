const express = require('express');
const dentalController = require('../controllers/dentalController');
const authMiddleware = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

const router = express.Router();

const DOCTOR_ROLES = ['DOCTOR', 'HEALTH_OFFICER', 'DERMATOLOGY'];

// Get all dentists (available to nurses and admins)
router.get('/dentists', authMiddleware, roleGuard(['NURSE', 'ADMIN']), dentalController.getDentists);

// Get dental record for a patient (available to doctors and admins)
router.get('/records/:patientId/:visitId?', authMiddleware, roleGuard([...DOCTOR_ROLES, 'ADMIN']), dentalController.getDentalRecord);

// Save dental record (available to doctors and admins)
router.post('/records', authMiddleware, roleGuard([...DOCTOR_ROLES, 'ADMIN']), dentalController.saveDentalRecord);

// Get dental history for a patient (available to doctors and admins)
router.get('/history/:patientId', authMiddleware, roleGuard([...DOCTOR_ROLES, 'ADMIN']), dentalController.getDentalHistory);

// Get tooth information (available to doctors and admins)
router.get('/tooth/:toothNumber', authMiddleware, roleGuard([...DOCTOR_ROLES, 'ADMIN']), dentalController.getToothInfo);

// Create dental lab/radiology order (available to doctors and admins)
router.post('/orders', authMiddleware, roleGuard([...DOCTOR_ROLES, 'ADMIN']), dentalController.createDentalOrder);

// Dental procedure completion routes
router.post('/procedures/complete', authMiddleware, roleGuard([...DOCTOR_ROLES, 'ADMIN']), dentalController.completeDentalProcedure);
router.get('/procedures/visit/:visitId', authMiddleware, roleGuard([...DOCTOR_ROLES, 'ADMIN']), dentalController.getDentalProcedureCompletions);

module.exports = router;
