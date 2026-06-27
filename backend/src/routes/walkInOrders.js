const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const {
  createWalkInLabOrder,
  createWalkInRadiologyOrder,
  createWalkInNurseOrder,
  createWalkInDoctorOrder
} = require('../controllers/doctorWalkInOrdersController');

// Create walk-in lab order
router.post(
  '/lab',
  authMiddleware,
  roleGuard(['LAB_TECHNICIAN', 'ADMIN', 'BILLING_OFFICER']),
  createWalkInLabOrder
);

// Create walk-in radiology order
router.post(
  '/radiology',
  authMiddleware,
  roleGuard(['RADIOLOGIST', 'ADMIN', 'BILLING_OFFICER']),
  createWalkInRadiologyOrder
);

// Create walk-in nurse service order
router.post(
  '/nurse',
  authMiddleware,
  roleGuard(['NURSE', 'ADMIN']),
  createWalkInNurseOrder
);

// Create walk-in doctor service order
router.post(
  '/doctor',
  authMiddleware,
  roleGuard(['DOCTOR', 'ADMIN', 'RECEPTIONIST']),
  createWalkInDoctorOrder
);

module.exports = router;

