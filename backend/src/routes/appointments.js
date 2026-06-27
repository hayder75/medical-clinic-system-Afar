const express = require('express');
const router = express.Router();
const roleGuard = require('../middleware/roleGuard');
const {
  createAppointment,
  getAppointmentsByDoctor,
  getAllAppointments,
  updateAppointment,
  deleteAppointment,
  sendAppointmentToDoctor,
  getAppointmentById,
  debugAppointmentStatus
} = require('../controllers/appointmentController');

// Create appointment (Doctors, Receptionists, and Billing Officers)
router.post(
  '/',
  roleGuard(['DOCTOR', 'RECEPTIONIST', 'BILLING_OFFICER']),
  createAppointment
);

// Get appointments by doctor (Doctor can view their own, Receptionist/Billing/Admin/Nurse can view any)
router.get(
  '/doctor',
  roleGuard(['DOCTOR', 'RECEPTIONIST', 'BILLING_OFFICER', 'ADMIN', 'NURSE']),
  getAppointmentsByDoctor
);

// Get all appointments (Reception, Billing, Admin, and Nurse)
router.get(
  '/',
  roleGuard(['RECEPTIONIST', 'BILLING_OFFICER', 'ADMIN', 'NURSE']),
  getAllAppointments
);

// Get appointment by ID (Everyone can view)
router.get(
  '/:id',
  roleGuard(['DOCTOR', 'RECEPTIONIST', 'BILLING_OFFICER', 'ADMIN', 'NURSE']),
  getAppointmentById
);

// Update appointment (Doctors, Receptionists, and Billing Officers)
router.patch(
  '/:id',
  roleGuard(['DOCTOR', 'RECEPTIONIST', 'BILLING_OFFICER']),
  updateAppointment
);

// Delete appointment (Doctors, Receptionists, and Billing Officers)
router.delete(
  '/:id',
  roleGuard(['DOCTOR', 'RECEPTIONIST', 'BILLING_OFFICER']),
  deleteAppointment
);

// Send appointment to doctor (Reception, Billing, and Admin converts appointment to visit)
router.post(
  '/:id/send-to-doctor',
  roleGuard(['RECEPTIONIST', 'BILLING_OFFICER', 'ADMIN']),
  sendAppointmentToDoctor
);

// Debug appointment status
router.get(
  '/:id/debug',
  roleGuard(['RECEPTIONIST', 'BILLING_OFFICER', 'ADMIN', 'DOCTOR']),
  debugAppointmentStatus
);

module.exports = router;

