const express = require('express');
const virtualQueueController = require('../controllers/virtualQueueController');

const router = express.Router();

// Pre-Registration Virtual Queue routes
router.post('/add', virtualQueueController.addToVirtualQueue);
router.get('/list', virtualQueueController.getVirtualQueue);
router.get('/search', virtualQueueController.searchVirtualQueue);
router.post('/process', virtualQueueController.processVirtualQueue);
router.post('/cancel', virtualQueueController.cancelVirtualQueue);
router.get('/search-patients', virtualQueueController.searchPatientsForVirtualQueue);

module.exports = router;




