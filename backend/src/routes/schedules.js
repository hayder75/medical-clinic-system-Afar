const express = require('express');
const scheduleController = require('../controllers/scheduleController');

const router = express.Router();

router.put('/availability', scheduleController.toggleAvailability);
router.get('/appointments', scheduleController.getAppointments);
router.post('/', scheduleController.createAppointment);
router.put('/:id', scheduleController.updateAppointment);
router.delete('/:id', scheduleController.deleteAppointment);

module.exports = router;