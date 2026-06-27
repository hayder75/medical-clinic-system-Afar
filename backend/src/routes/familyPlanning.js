const express = require('express');
const router = express.Router();
const controller = require('../controllers/familyPlanningController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const reportDataTransform = require('../middleware/reportDataTransform');

router.use(auth);

router.get('/', roleGuard(['DOCTOR', 'HEALTH_OFFICER', 'NURSE', 'ADMIN', 'REPORT']), reportDataTransform, controller.getRecords);
router.post('/', roleGuard(['DOCTOR', 'HEALTH_OFFICER', 'NURSE', 'ADMIN']), controller.createRecord);
router.put('/:id', roleGuard(['DOCTOR', 'HEALTH_OFFICER', 'NURSE', 'ADMIN']), controller.updateRecord);
router.delete('/:id', roleGuard(['DOCTOR', 'HEALTH_OFFICER', 'NURSE', 'ADMIN']), controller.deleteRecord);
router.get('/visits', roleGuard(['DOCTOR', 'HEALTH_OFFICER', 'NURSE', 'ADMIN', 'REPORT']), reportDataTransform, controller.getVisits);
router.post('/visits', roleGuard(['DOCTOR', 'HEALTH_OFFICER', 'NURSE', 'ADMIN']), controller.createVisit);
router.get('/patient/:patientId', roleGuard(['DOCTOR', 'HEALTH_OFFICER', 'NURSE', 'ADMIN', 'REPORT']), controller.getByPatient);
router.get('/visit/:visitId', roleGuard(['DOCTOR', 'HEALTH_OFFICER', 'NURSE', 'ADMIN', 'REPORT']), controller.getByVisit);
router.get('/summary', roleGuard(['DOCTOR', 'HEALTH_OFFICER', 'NURSE', 'ADMIN', 'REPORT']), reportDataTransform, controller.getSummary);

module.exports = router;
