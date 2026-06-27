const express = require('express');
const walkInSalesController = require('../controllers/walkInSalesController');

const router = express.Router();

// Walk-in sales routes
router.post('/sales', walkInSalesController.createWalkInSale);
router.get('/sales', walkInSalesController.getWalkInSales);
router.post('/sales/:invoiceId/payment', walkInSalesController.processWalkInPayment);
router.post('/sales/:invoiceId/dispense', walkInSalesController.dispenseWalkInSale);
router.get('/sales/:invoiceId/pdf', walkInSalesController.generateWalkInSalePDF);

module.exports = router;


