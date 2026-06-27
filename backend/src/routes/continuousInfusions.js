const express = require('express');
const router = express.Router();
const continuousInfusionController = require('../controllers/continuousInfusionController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

// Get all active continuous infusions
router.get('/active', auth, roleGuard(['ADMIN', 'NURSE', 'DOCTOR', 'BILLING_OFFICER']), continuousInfusionController.getActiveInfusions);

// Get continuous infusion details
router.get('/:infusionId', auth, roleGuard(['ADMIN', 'NURSE', 'DOCTOR', 'BILLING_OFFICER']), continuousInfusionController.getInfusionDetails);

// Update infusion status
router.put('/:infusionId/status', auth, roleGuard(['ADMIN', 'NURSE', 'BILLING_OFFICER']), continuousInfusionController.updateInfusionStatus);

// Assign nurse to infusion
router.put('/:infusionId/assign-nurse', auth, roleGuard(['ADMIN', 'NURSE']), continuousInfusionController.assignNurseToInfusion);

// Get available nurses for assignment
router.get('/nurses/available', auth, roleGuard(['ADMIN', 'NURSE']), continuousInfusionController.getAvailableNurses);

// Get daily tasks for a specific continuous infusion
router.get('/:infusionId/tasks', auth, roleGuard(['ADMIN', 'NURSE', 'DOCTOR']), continuousInfusionController.getInfusionTasks);

// Complete a daily task
router.put('/tasks/:taskId/complete', auth, roleGuard(['ADMIN', 'NURSE']), continuousInfusionController.completeInfusionTask);

module.exports = router;
