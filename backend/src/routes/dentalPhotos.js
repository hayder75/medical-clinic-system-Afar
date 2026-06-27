const express = require('express');
const dentalPhotoController = require('../controllers/dentalPhotoController');
const auth = require('../middleware/auth');

const router = express.Router();

// Upload dental photo
router.post('/upload', auth, dentalPhotoController.uploadDentalPhoto);

// Get dental photos for a visit
router.get('/visit/:visitId', auth, dentalPhotoController.getDentalPhotos);

// Delete dental photo
router.delete('/:photoId', auth, dentalPhotoController.deleteDentalPhoto);

module.exports = router;







