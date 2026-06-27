const express = require('express');
const visitController = require('../controllers/visitController');

const router = express.Router();

// Visit management routes
router.post('/', visitController.createVisit);
router.put('/:visitId', visitController.updateVisit);
router.get('/uid/:visitUid', visitController.getVisitByUid);
router.post('/complete', visitController.completeVisit);
router.get('/patient/:patientId', visitController.getPatientVisits);
router.get('/status/:status', visitController.getVisitsByStatus);

module.exports = router;
