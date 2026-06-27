const express = require('express');
const patientController = require('../controllers/patientController');

const router = express.Router();

router.get('/search', patientController.searchPatients);
router.get('/:patientId/for-visit', patientController.getPatientForVisit);
router.get('/', patientController.getPatients);
router.get('/:id', patientController.getPatient);

module.exports = router;