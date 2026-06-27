const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralController');
const authMiddleware = require('../middleware/auth');

// All referral routes require authentication
router.use(authMiddleware);

router.post('/', referralController.createReferral);
router.put('/:id', referralController.updateReferral);
router.get('/my', referralController.getMyReferrals);
router.get('/:id', referralController.getReferralById);
router.get('/:id/print', referralController.generatePDF);
router.delete('/:id', referralController.deleteReferral);

module.exports = router;
