const express = require('express');
const router = express.Router();
const pharmacyBillingController = require('../controllers/pharmacyBillingController');

// Get pharmacy billing dashboard
router.get('/dashboard', pharmacyBillingController.getDashboard);

// Get pharmacy invoices (billing queue)
router.get('/invoices', pharmacyBillingController.getPharmacyInvoices);

// Create pharmacy invoice from medication orders
router.post('/invoices', pharmacyBillingController.createPharmacyInvoice);

// Process pharmacy payment
router.post('/payment', pharmacyBillingController.processPharmacyPayment);

// Dispense medication
router.post('/dispense', pharmacyBillingController.dispenseMedication);

// Get dispensed medicines
router.get('/dispensed', pharmacyBillingController.getDispensedMedicines);

// Get insurance companies
router.get('/insurance', pharmacyBillingController.getInsuranceCompanies);

module.exports = router;
