const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/internationalMedicalCertificateController');
const authMiddleware = require('../middleware/auth');

// All imc routes require authentication
router.use(authMiddleware);

router.post('/', certificateController.createCertificate);
router.put('/:id', certificateController.updateCertificate);
router.get('/my', certificateController.getMyCertificates);
router.get('/:id', certificateController.getCertificateById);
router.delete('/:id', certificateController.deleteCertificate);

module.exports = router;
