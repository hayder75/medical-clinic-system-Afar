const express = require('express');
const router = express.Router();
const pathologyController = require('../controllers/pathologyController');
const authMiddleware = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

router.post('/', authMiddleware, roleGuard(['DOCTOR', 'NURSE', 'ADMIN']), pathologyController.createReport);
router.put('/:id', authMiddleware, pathologyController.updateReport);
router.get('/:id', authMiddleware, pathologyController.getReport);
router.get('/patient/:patientId', authMiddleware, pathologyController.getPatientReports);
router.get('/', authMiddleware, pathologyController.listReports);
router.patch('/:id/status', authMiddleware, pathologyController.updateStatus);
router.delete('/:id', authMiddleware, pathologyController.deleteReport);

module.exports = router;
