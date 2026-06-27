const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const cashManagementController = require('../controllers/cashManagementController');
const authMiddleware = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

// Configure multer for receipt uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/receipts');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Cash Management Routes
// All routes require authentication and billing officer/admin role

// Get current active session
router.get('/current-session', 
  authMiddleware, 
  roleGuard(['BILLING_OFFICER', 'ADMIN']), 
  cashManagementController.getCurrentSession
);

// Add cash transaction
router.post('/add-transaction', 
  authMiddleware, 
  roleGuard(['BILLING_OFFICER', 'ADMIN']), 
  cashManagementController.addTransaction
);

// Add bank deposit
router.post('/add-deposit', 
  authMiddleware, 
  roleGuard(['BILLING_OFFICER', 'ADMIN']), 
  cashManagementController.addBankDeposit
);

// Add expense
router.post('/add-expense', 
  authMiddleware, 
  roleGuard(['BILLING_OFFICER', 'ADMIN']), 
  cashManagementController.addExpense
);

// Reset session (Admin only)
router.post('/reset-session', 
  authMiddleware, 
  roleGuard(['ADMIN']), 
  cashManagementController.resetSession
);

// Get session history
router.get('/history', 
  authMiddleware, 
  roleGuard(['BILLING_OFFICER', 'ADMIN']), 
  cashManagementController.getSessionHistory
);

// Upload receipt for deposit or expense
router.post('/upload-receipt/:type/:id', 
  authMiddleware, 
  roleGuard(['BILLING_OFFICER', 'ADMIN']), 
  upload.single('receipt'),
  cashManagementController.uploadReceipt
);

// Export transactions to PDF
router.post('/export-transactions-pdf', 
  authMiddleware, 
  roleGuard(['BILLING_OFFICER', 'ADMIN']), 
  cashManagementController.exportTransactionsPDF
);

// Get patient transactions or search patients
router.get('/patient-transactions', 
  authMiddleware, 
  roleGuard(['BILLING_OFFICER', 'ADMIN']), 
  cashManagementController.getPatientTransactions
);

// Get all patients with their services for receipt printing
router.get('/patient-receipts', 
  authMiddleware, 
  roleGuard(['BILLING_OFFICER', 'ADMIN']), 
  cashManagementController.getPatientReceipts
);

// Get accepted services summary grouped by processor and service buckets
router.get('/accepted-services-summary',
  authMiddleware,
  roleGuard(['BILLING_OFFICER', 'ADMIN']),
  cashManagementController.getAcceptedServicesSummary
);

// Get daily expenses and bank deposits for a date
router.get('/daily-expenses',
  authMiddleware,
  roleGuard(['ADMIN', 'BILLING_OFFICER']),
  cashManagementController.getDailyExpenses
);

module.exports = router;
