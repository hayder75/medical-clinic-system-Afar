const express = require('express');
const patientAttachedImageController = require('../controllers/patientAttachedImageController');
const authMiddleware = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

const router = express.Router();

// Upload patient attached image (RECEPTIONIST, BILLING_OFFICER, ADMIN)
router.post('/upload', authMiddleware, roleGuard(['RECEPTIONIST', 'BILLING_OFFICER', 'ADMIN']), patientAttachedImageController.uploadPatientAttachedImage);

// Get patient attached images for a visit (RECEPTIONIST, DOCTOR, BILLING_OFFICER, ADMIN)
router.get('/visit/:visitId', authMiddleware, roleGuard(['RECEPTIONIST', 'DOCTOR', 'BILLING_OFFICER', 'ADMIN']), patientAttachedImageController.getPatientAttachedImages);

// Delete patient attached image (RECEPTIONIST, BILLING_OFFICER, ADMIN only)
router.delete('/:imageId', authMiddleware, roleGuard(['RECEPTIONIST', 'BILLING_OFFICER', 'ADMIN']), patientAttachedImageController.deletePatientAttachedImage);

module.exports = router;







