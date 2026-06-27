const express = require('express');
const controller = require('../controllers/specialtyController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

const router = express.Router();
const DOCTOR_ROLES = ['DOCTOR', 'HEALTH_OFFICER', 'DERMATOLOGY'];

// Pregnancy
router.get('/pregnancy/:patientId', auth, roleGuard(DOCTOR_ROLES), controller.getPregnancyRecords);
router.post('/pregnancy', auth, roleGuard(DOCTOR_ROLES), controller.savePregnancyRecord);

// Growth Measurements
router.get('/growth/:patientId', auth, roleGuard(DOCTOR_ROLES), controller.getGrowthMeasurements);
router.post('/growth', auth, roleGuard(DOCTOR_ROLES), controller.saveGrowthMeasurement);

// Vaccinations
router.get('/vaccinations/:patientId', auth, roleGuard(DOCTOR_ROLES), controller.getVaccinations);
router.post('/vaccinations', auth, roleGuard(DOCTOR_ROLES), controller.saveVaccination);
router.delete('/vaccinations/:id', auth, roleGuard(DOCTOR_ROLES), controller.deleteVaccination);

// Development Milestones
router.get('/development/:patientId', auth, roleGuard(DOCTOR_ROLES), controller.getDevelopmentMilestones);
router.post('/development', auth, roleGuard(DOCTOR_ROLES), controller.saveDevelopmentMilestone);
router.delete('/development/:id', auth, roleGuard(DOCTOR_ROLES), controller.deleteDevelopmentMilestone);

// Chronic Disease
router.get('/chronic-disease/:patientId', auth, roleGuard(DOCTOR_ROLES), controller.getChronicDiseases);
router.post('/chronic-disease', auth, roleGuard(DOCTOR_ROLES), controller.saveChronicDisease);
router.put('/chronic-disease/:id', auth, roleGuard(DOCTOR_ROLES), controller.updateChronicDisease);

// Surgical Notes
router.get('/surgical-notes/:patientId', auth, roleGuard(DOCTOR_ROLES), controller.getSurgicalNotes);
router.post('/surgical-notes', auth, roleGuard(DOCTOR_ROLES), controller.saveSurgicalNote);

// Body Chart
router.get('/body-chart/:patientId', auth, roleGuard(DOCTOR_ROLES), controller.getBodyChartRecords);
router.post('/body-chart', auth, roleGuard(DOCTOR_ROLES), controller.saveBodyChartRecord);

// Exercise Prescriptions
router.get('/exercise/:patientId', auth, roleGuard(DOCTOR_ROLES), controller.getExercisePrescriptions);
router.post('/exercise', auth, roleGuard(DOCTOR_ROLES), controller.saveExercisePrescription);
router.put('/exercise/:id', auth, roleGuard(DOCTOR_ROLES), controller.updateExercisePrescription);

// Outcome Scores
router.get('/outcome-scores/:patientId', auth, roleGuard(DOCTOR_ROLES), controller.getOutcomeScores);
router.post('/outcome-scores', auth, roleGuard(DOCTOR_ROLES), controller.saveOutcomeScore);

// Imaging
router.get('/images/:patientId', auth, roleGuard(DOCTOR_ROLES), controller.getPatientImages);

module.exports = router;
