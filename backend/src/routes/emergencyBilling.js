const express = require('express');
const emergencyBillingController = require('../controllers/emergencyBillingController');
const authMiddleware = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

const router = express.Router();

// Get all emergency patients with billing info (BILLING_OFFICER, ADMIN)
router.get('/patients', authMiddleware, roleGuard(['BILLING_OFFICER', 'ADMIN']), emergencyBillingController.getEmergencyPatients);

// Get available services for emergency billing (BILLING_OFFICER, ADMIN)
router.get('/services', authMiddleware, roleGuard(['BILLING_OFFICER', 'ADMIN']), emergencyBillingController.getEmergencyServices);

// Add service to emergency billing (BILLING_OFFICER, ADMIN)
router.post('/add-service', authMiddleware, roleGuard(['BILLING_OFFICER', 'ADMIN']), emergencyBillingController.addServiceToEmergency);

// Remove service from emergency billing (BILLING_OFFICER, ADMIN)
router.delete('/remove-service/:billingServiceId', authMiddleware, roleGuard(['BILLING_OFFICER', 'ADMIN']), emergencyBillingController.removeServiceFromEmergency);

// Process emergency payment (BILLING_OFFICER, ADMIN)
router.post('/process-payment', authMiddleware, roleGuard(['BILLING_OFFICER', 'ADMIN']), emergencyBillingController.processEmergencyPayment);

module.exports = router;
