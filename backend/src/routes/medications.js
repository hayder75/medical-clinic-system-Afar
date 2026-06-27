const express = require('express');
const router = express.Router();
const medicationController = require('../controllers/medicationController');
const auth = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(auth);

// Get medication catalog
router.get('/catalog', medicationController.getMedicationCatalog);

// Search medications
router.get('/search', medicationController.searchMedications);

// Get low stock medications
router.get('/low-stock/list', medicationController.getLowStockMedications);

// Get medication categories
router.get('/categories/list', medicationController.getMedicationCategories);

// Get medication by ID (must be last to avoid conflicts)
router.get('/:id', medicationController.getMedicationById);

// Create new medication (admin/pharmacy only)
router.post('/', medicationController.createMedication);

// Update medication (admin/pharmacy only)
router.put('/:id', medicationController.updateMedication);

// Update medication stock (pharmacy only)
router.patch('/:id/stock', medicationController.updateStock);

module.exports = router;
