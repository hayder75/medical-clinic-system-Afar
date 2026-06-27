const express = require('express');
const compoundPrescriptionController = require('../controllers/compoundPrescriptionController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

const router = express.Router();

const DOCTOR_ROLES = ['DOCTOR', 'HEALTH_OFFICER', 'DERMATOLOGY'];

router.post('/', auth, roleGuard(DOCTOR_ROLES), compoundPrescriptionController.createCompoundPrescription);
router.get('/visit/:visitId', compoundPrescriptionController.getCompoundPrescriptionsByVisit);
router.get('/:id', compoundPrescriptionController.getCompoundPrescriptionById);
router.put('/:id', auth, roleGuard(DOCTOR_ROLES), compoundPrescriptionController.updateCompoundPrescription);
router.delete('/:id', auth, roleGuard(DOCTOR_ROLES), compoundPrescriptionController.deleteCompoundPrescription);
router.patch('/:id/prepared', compoundPrescriptionController.markAsPrepared);

module.exports = router;
