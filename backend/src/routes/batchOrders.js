const express = require('express');
const multer = require('multer');
const path = require('path');
const batchOrderController = require('../controllers/batchOrderController');
const authMiddleware = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

const router = express.Router();

const DOCTOR_ROLES = ['DOCTOR', 'HEALTH_OFFICER', 'DERMATOLOGY'];

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'));
    }
  }
});

// Doctor routes - create batch orders
router.post('/create', authMiddleware, roleGuard([...DOCTOR_ROLES, 'ADMIN']), batchOrderController.createBatchOrder);
router.post('/procedures/complete', authMiddleware, roleGuard([...DOCTOR_ROLES, 'ADMIN']), batchOrderController.completeProcedure);

// New lab test orders (new system)
router.post('/lab-tests', authMiddleware, roleGuard([...DOCTOR_ROLES, 'ADMIN']), batchOrderController.createLabTestOrders);

// Lab department routes
router.get('/lab', authMiddleware, roleGuard(['LAB_TECHNICIAN', 'ADMIN']), batchOrderController.getLabBatchOrders);

// Radiology department routes
router.get('/radiology', authMiddleware, roleGuard(['RADIOLOGY_TECHNICIAN', 'ADMIN']), batchOrderController.getRadiologyBatchOrders);

// Shared routes for both lab and radiology (combined role guard to prevent shadowing)
router.put('/:batchOrderId/results', authMiddleware, roleGuard(['LAB_TECHNICIAN', 'RADIOLOGY_TECHNICIAN', 'RADIOLOGIST', 'ADMIN']), batchOrderController.updateBatchOrderResults);
router.post('/:batchOrderId/attachment', authMiddleware, roleGuard(['LAB_TECHNICIAN', 'RADIOLOGY_TECHNICIAN', 'RADIOLOGIST', 'ADMIN']), fileUpload.single('file'), batchOrderController.uploadBatchOrderAttachment);

module.exports = router;
