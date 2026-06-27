const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');
const authMiddleware = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

// All staff can request loans
router.post('/request', authMiddleware, loanController.requestLoan);

// All staff can view their own loan requests
router.get('/my-requests', authMiddleware, loanController.getMyLoans);

// Admin: Get pending loan requests
router.get('/pending', authMiddleware, roleGuard(['ADMIN']), loanController.getPendingLoans);

// Admin: Approve/deny loan request
router.post('/review/:loanId', authMiddleware, roleGuard(['ADMIN']), loanController.reviewLoan);

// Billing: Get approved loans
router.get('/approved', authMiddleware, roleGuard(['BILLING_OFFICER']), loanController.getApprovedLoans);

// Billing: Disburse loan
router.post('/disburse/:loanId', authMiddleware, roleGuard(['BILLING_OFFICER']), loanController.disburseLoan);

// Admin: Get all loans with filters
router.get('/all', authMiddleware, roleGuard(['ADMIN']), loanController.getAllLoans);

// Staff: Settle a loan
router.post('/settle/:loanId', authMiddleware, loanController.settleLoan);

// Billing: Get settled loans awaiting acceptance
router.get('/settled', authMiddleware, roleGuard(['BILLING_OFFICER']), loanController.getSettledLoans);

// Billing: Accept settlement
router.post('/accept-settlement/:loanId', authMiddleware, roleGuard(['BILLING_OFFICER']), loanController.acceptSettlement);

// Admin: Get loans for payroll settlement
router.get('/payroll', authMiddleware, roleGuard(['ADMIN']), loanController.getPayrollLoans);

// Admin: Settle loan from payroll
router.post('/settle-payroll/:loanId', authMiddleware, roleGuard(['ADMIN']), loanController.settleFromPayroll);

module.exports = router;


