const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouseController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

const INV_MGR = ['INVENTORY_MANAGER', 'ADMIN'];
const PHARMACY = ['PHARMACIST', 'PHARMACY_BILLING_OFFICER'];
const ALLOWED = [...INV_MGR, ...PHARMACY];

router.get('/stock', auth, roleGuard(INV_MGR), warehouseController.getStock);
router.post('/stock', auth, roleGuard(INV_MGR), warehouseController.createMedication);
router.put('/stock/:medicationCatalogId', auth, roleGuard(INV_MGR), warehouseController.updateStock);

router.get('/requests', auth, roleGuard(ALLOWED), warehouseController.getRequests);
router.post('/requests', auth, roleGuard(PHARMACY), warehouseController.createRequest);
router.put('/requests/:id/approve', auth, roleGuard(INV_MGR), warehouseController.approveRequest);
router.put('/requests/:id/reject', auth, roleGuard(INV_MGR), warehouseController.rejectRequest);
router.put('/requests/:id/deliver', auth, roleGuard(INV_MGR), warehouseController.deliverRequest);

router.get('/movements', auth, roleGuard(INV_MGR), warehouseController.getMovements);

module.exports = router;
