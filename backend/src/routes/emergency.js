const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const emergencyController = require('../controllers/emergencyController');

const DOCTOR_ROLES = ['DOCTOR', 'HEALTH_OFFICER', 'DERMATOLOGY'];

// Emergency Drug Orders (Doctor side)
router.post(
  '/drugs',
  authMiddleware,
  roleGuard([...DOCTOR_ROLES, 'ADMIN']),
  emergencyController.createEmergencyDrugOrder
);

router.get(
  '/drugs',
  authMiddleware,
  roleGuard([...DOCTOR_ROLES, 'ADMIN']),
  emergencyController.getEmergencyDrugOrders
);

router.post(
  '/drugs/complete',
  authMiddleware,
  roleGuard([...DOCTOR_ROLES, 'ADMIN']),
  emergencyController.completeEmergencyDrugOrder
);

// Material Needs Orders (Nurse and Doctor side)
router.post(
  '/materials',
  authMiddleware,
  roleGuard(['NURSE', ...DOCTOR_ROLES, 'ADMIN']),
  emergencyController.createMaterialNeedsOrder
);

router.get(
  '/materials',
  authMiddleware,
  roleGuard(['NURSE', ...DOCTOR_ROLES, 'ADMIN']),
  emergencyController.getMaterialNeedsOrders
);

router.post(
  '/materials/complete',
  authMiddleware,
  roleGuard(['NURSE', 'ADMIN']),
  emergencyController.completeMaterialNeedsOrder
);

router.patch('/drug-order/:id', authMiddleware, roleGuard([...DOCTOR_ROLES, 'ADMIN']), emergencyController.updateEmergencyDrugOrder);
router.delete('/drug-order/:id', authMiddleware, roleGuard([...DOCTOR_ROLES, 'ADMIN']), emergencyController.deleteEmergencyDrugOrder);

module.exports = router;
