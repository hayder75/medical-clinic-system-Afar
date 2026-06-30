const express = require('express');
const radiologyController = require('../controllers/radiologyController');
const authMiddleware = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const fileUpload = require('../middleware/fileUpload');

const router = express.Router();

router.get('/orders', radiologyController.getOrders);
router.post('/orders/:orderId/report', radiologyController.fillReport);
router.post('/batch-orders/:batchOrderId/attachment', fileUpload.single('file'), radiologyController.uploadBatchAttachment);
router.get('/investigation-types', radiologyController.getInvestigationTypes);
router.get('/investigation-types/organized', radiologyController.getOrganizedInvestigationTypes);

// New per-test result routes
router.post('/results', radiologyController.createRadiologyResult);
router.post('/results/:resultId/file', fileUpload.single('file'), radiologyController.uploadRadiologyResultFile);
router.get('/orders/:orderId/results', radiologyController.getRadiologyResults);

// New per-test result routes for batch orders
router.post('/batch-orders/:batchOrderId/results', radiologyController.createBatchRadiologyResult);
router.post('/batch-orders/:batchOrderId/results/:resultId/file', fileUpload.single('file'), radiologyController.uploadBatchRadiologyResultFile);
router.get('/batch-orders/:batchOrderId/results', radiologyController.getBatchRadiologyResults);
router.put('/batch-orders/:batchOrderId/results', radiologyController.completeBatchRadiologyOrder);

// Template routes
router.get('/templates/:investigationTypeId', radiologyController.getTemplate);
router.get('/templates', radiologyController.getAllTemplates);

// Radiology Reports
router.get('/reports', authMiddleware, roleGuard(['RADIOLOGIST', 'ADMIN', 'REPORT']), radiologyController.getRadiologyReports);

// PDF generation
router.get('/batch-orders/:batchOrderId/pdf', radiologyController.generateRadiologyResultsPDF);

// Radiologist Daily Work
router.get('/daily-work/monthly', authMiddleware, roleGuard(['RADIOLOGIST', 'ADMIN']), radiologyController.getDailyWorkMonthly);
router.get('/daily-work/day-details', authMiddleware, roleGuard(['RADIOLOGIST', 'ADMIN']), radiologyController.getDailyWorkDayDetails);

module.exports = router;