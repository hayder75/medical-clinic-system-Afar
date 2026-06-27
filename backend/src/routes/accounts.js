const express = require('express');
const accountController = require('../controllers/accountController');
const roleGuard = require('../middleware/roleGuard');

const router = express.Router();

// Get all accounts (Admin, Billing Officers, and Reception)
router.get('/', (req, res, next) => {
  console.log('===== ACCOUNTS ROUTE DEBUG =====');
  console.log('User:', req.user);
  console.log('User role:', req.user?.role);
  console.log('Allowed roles: ADMIN, BILLING_OFFICER, RECEPTION');
  next();
}, roleGuard(['ADMIN', 'BILLING_OFFICER', 'RECEPTION']), accountController.getAccounts);

// Get detailed account history with full billing/service breakdown
router.get('/:accountId/detailed-history', roleGuard(['ADMIN', 'BILLING_OFFICER']), accountController.getAccountDetailedHistory);

// Get account by patient ID (All authenticated users)
router.get('/patient/:patientId', accountController.getAccountByPatientId);

// Get patient credit summary for doctor ordering (for showing credit warning)
router.get('/patient/:patientId/credit-summary', accountController.getPatientCreditSummary);

// Create or update account (Admin and Billing Officers - auto-approved)
router.post('/', roleGuard(['ADMIN', 'BILLING_OFFICER']), accountController.createAccount);

// Add deposit (Admin and Billing Officers)
router.post('/deposit', roleGuard(['ADMIN', 'BILLING_OFFICER']), accountController.addDeposit);

// Accept payment (Admin, Billing Officers, and Reception)
router.post('/payment', roleGuard(['ADMIN', 'BILLING_OFFICER', 'RECEPTION']), accountController.acceptPayment);

// Adjust balance (Admin only)
router.post('/adjust', roleGuard(['ADMIN']), accountController.adjustBalance);

// Delete account (Admin only)
router.delete('/:accountId', roleGuard(['ADMIN']), accountController.deleteAccount);

// Verify account (Admin only)
router.post('/verify/:accountId', roleGuard(['ADMIN']), accountController.verifyAccount);

// Reject account (Admin only)
router.post('/reject/:accountId', roleGuard(['ADMIN']), accountController.rejectAccount);

// Account Requests (Deprecated - Admin creates accounts directly now)
// Create request (Admin only - for backward compatibility, but admin should use direct creation)
router.post('/requests', roleGuard(['ADMIN']), accountController.createAccountRequest);

// Get requests by status (Admin and Billing for pending advance deposits)
router.get('/requests', roleGuard(['ADMIN', 'BILLING_OFFICER']), accountController.getPendingRequests);

// Approve request (Admin and Billing for pending advance deposits)
router.post('/requests/:requestId/approve', roleGuard(['ADMIN', 'BILLING_OFFICER']), accountController.approveRequest);

// Reject request (Admin and Billing for pending advance deposits)
router.post('/requests/:requestId/reject', roleGuard(['ADMIN', 'BILLING_OFFICER']), accountController.rejectRequest);

module.exports = router;

