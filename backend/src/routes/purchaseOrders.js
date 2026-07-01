const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');

router.use(auth, roleGuard(['INVENTORY_MANAGER', 'ADMIN']));

router.get('/', purchaseOrderController.getAll);
router.post('/', purchaseOrderController.create);
router.put('/:id/receive', purchaseOrderController.receive);

module.exports = router;
