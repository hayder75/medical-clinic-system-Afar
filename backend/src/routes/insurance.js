const express = require('express');
const router = express.Router();
const insuranceController = require('../controllers/insuranceController');
const authMiddleware = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

// Apply authentication to all routes
router.use(authMiddleware);

// Get all insurance companies with transaction summaries
router.get('/companies', 
  roleGuard(['ADMIN', 'OWNER', 'BILLING_OFFICER']),
  insuranceController.getInsuranceCompanies
);

// Get detailed transactions for a specific insurance company
router.get('/companies/:insuranceId/transactions',
  roleGuard(['ADMIN', 'OWNER', 'BILLING_OFFICER']),
  insuranceController.getInsuranceTransactions
);

// Create a new insurance transaction
router.post('/transactions',
  roleGuard(['ADMIN', 'OWNER', 'BILLING_OFFICER', 'PHARMACY_BILLING_OFFICER']),
  insuranceController.createInsuranceTransaction
);

// Update insurance transaction status
router.put('/transactions/:transactionId/status',
  roleGuard(['ADMIN', 'OWNER', 'BILLING_OFFICER']),
  insuranceController.updateInsuranceTransactionStatus
);

// Generate report for insurance company
router.get('/companies/:insuranceId/report',
  roleGuard(['ADMIN', 'OWNER', 'BILLING_OFFICER']),
  insuranceController.generateInsuranceReport
);

// Export insurance report to PDF
router.post('/companies/:insuranceId/export-pdf',
  roleGuard(['ADMIN', 'OWNER', 'BILLING_OFFICER']),
  insuranceController.exportInsuranceReportPDF
);

// Get insurance dashboard statistics
router.get('/dashboard/stats',
  roleGuard(['ADMIN', 'OWNER', 'BILLING_OFFICER']),
  insuranceController.getInsuranceDashboardStats
);

module.exports = router;
