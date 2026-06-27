const express = require('express');
const router = express.Router();
const diseaseController = require('../controllers/diseaseController');
const authMiddleware = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const fileUpload = require('../middleware/fileUpload');
const reportDataTransform = require('../middleware/reportDataTransform');

// Search diseases (any authenticated user)
router.get('/search', authMiddleware, diseaseController.searchDiseases);

// Admin: List all diseases (with pagination + search)
router.get('/', authMiddleware, roleGuard(['ADMIN', 'REPORT']), diseaseController.getAllDiseases);

// Create new disease (for custom diseases)
router.post('/', authMiddleware, diseaseController.createDisease);

// Admin: Update disease
router.put('/:id', authMiddleware, roleGuard(['ADMIN']), diseaseController.updateDisease);

// Admin: Delete disease
router.delete('/:id', authMiddleware, roleGuard(['ADMIN']), diseaseController.deleteDisease);

// Admin: Import diseases from Excel
router.post('/import-excel', authMiddleware, roleGuard(['ADMIN']), fileUpload.single('file'), diseaseController.importDiseasesFromExcel);

// Reports - accessible by REPORT role too, with data transform
router.get('/reports', authMiddleware, roleGuard(['ADMIN', 'REPORT']), reportDataTransform, diseaseController.getDiseaseReport);
router.get('/age-gender-distribution', authMiddleware, roleGuard(['ADMIN', 'REPORT']), reportDataTransform, diseaseController.getAgeGenderDistribution);

// Diagnosis Management
router.post('/diagnosis', authMiddleware, diseaseController.addPatientDiagnosis);
router.get('/diagnosis/:visitId', authMiddleware, diseaseController.getVisitDiagnoses);
router.delete('/diagnosis/:diagnosisId', authMiddleware, diseaseController.deletePatientDiagnosis);

module.exports = router;
