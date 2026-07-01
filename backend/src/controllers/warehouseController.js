const prisma = require('../config/database');

const getStock = async (req, res) => {
  try {
    const stock = await prisma.warehouseStock.findMany({
      include: {
        medicationCatalog: {
          select: { id: true, name: true, dosageForm: true, strength: true, category: true, unitPrice: true, availableQuantity: true, minimumStock: true, manufacturer: true }
        }
      },
      orderBy: { medicationCatalog: { name: 'asc' } }
    });
    res.json({ success: true, stock });
  } catch (error) {
    console.error('Error fetching warehouse stock:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch warehouse stock' });
  }
};

const createMedication = async (req, res) => {
  try {
    const { name, dosageForm, strength, category, quantity, minimumStock, unitCost, manufacturer, expiryDate } = req.body;
    if (!name || !dosageForm || !strength || !category) return res.status(400).json({ success: false, error: 'Name, dosage form, strength, and category are required' });

    let catalog = await prisma.medicationCatalog.findFirst({ where: { name, dosageForm, strength } });
    if (!catalog) {
      catalog = await prisma.medicationCatalog.create({
        data: { name, dosageForm, strength, category, unitPrice: unitCost || 0, availableQuantity: 0, minimumStock: minimumStock || 10, manufacturer: manufacturer || null }
      });
    }

    const existing = await prisma.warehouseStock.findUnique({ where: { medicationCatalogId: catalog.id } });
    const qty = parseInt(quantity) || 0;
    if (existing) {
      await prisma.warehouseStock.update({
        where: { medicationCatalogId: catalog.id },
        data: { quantity: qty, minimumStock: parseInt(minimumStock) || 10, unitCost: unitCost ? parseFloat(unitCost) : null, expiryDate: expiryDate ? new Date(expiryDate) : null }
      });
    } else {
      await prisma.warehouseStock.create({
        data: { medicationCatalogId: catalog.id, quantity: qty, minimumStock: parseInt(minimumStock) || 10, unitCost: unitCost ? parseFloat(unitCost) : null, expiryDate: expiryDate ? new Date(expiryDate) : null }
      });
    }

    await prisma.stockMovement.create({
      data: { medicationCatalogId: catalog.id, quantity: qty - (existing?.quantity || 0), type: 'MANUAL_ADJUST', referenceType: 'MANUAL', userId: req.user.id, notes: req.body.notes || (existing ? 'Stock updated' : 'New medication added to warehouse') }
    });

    res.json({ success: true, medication: catalog, message: existing ? 'Stock updated' : 'Medication added to warehouse' });
  } catch (error) {
    console.error('Error creating medication:', error);
    res.status(500).json({ success: false, error: 'Failed to create medication' });
  }
};

const updateStock = async (req, res) => {
  try {
    const { medicationCatalogId } = req.params;
    const { quantity, minimumStock, unitCost } = req.body;
    const existing = await prisma.warehouseStock.findUnique({ where: { medicationCatalogId } });
    if (!existing) {
      await prisma.warehouseStock.create({ data: { medicationCatalogId, quantity: quantity || 0, minimumStock: minimumStock || 10, unitCost } });
    } else {
      await prisma.warehouseStock.update({ where: { medicationCatalogId }, data: { quantity, minimumStock, unitCost } });
    }
    await prisma.stockMovement.create({
      data: {
        medicationCatalogId, quantity: quantity - (existing?.quantity || 0), type: 'MANUAL_ADJUST', referenceType: 'MANUAL', userId: req.user.id, notes: req.body.notes || 'Manual stock update'
      }
    });
    res.json({ success: true, message: 'Stock updated' });
  } catch (error) {
    console.error('Error updating warehouse stock:', error);
    res.status(500).json({ success: false, error: 'Failed to update stock' });
  }
};

const getRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;
    const requests = await prisma.stockRequest.findMany({
      where,
      include: {
        requestedBy: { select: { id: true, fullname: true } },
        approvedBy: { select: { id: true, fullname: true } },
        items: {
          include: { medicationCatalog: { select: { id: true, name: true, dosageForm: true, strength: true, category: true, unitPrice: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, requests });
  } catch (error) {
    console.error('Error fetching stock requests:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch requests' });
  }
};

const createRequest = async (req, res) => {
  try {
    const { items, notes } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ success: false, error: 'At least one item is required' });
    const request = await prisma.stockRequest.create({
      data: {
        requestedById: req.user.id,
        notes,
        items: { create: items.map(item => ({ medicationCatalogId: item.medicationCatalogId, quantityRequested: item.quantity })) }
      },
      include: {
        items: { include: { medicationCatalog: { select: { id: true, name: true, dosageForm: true, strength: true } } } },
        requestedBy: { select: { id: true, fullname: true } }
      }
    });
    res.json({ success: true, request });
  } catch (error) {
    console.error('Error creating stock request:', error);
    res.status(500).json({ success: false, error: 'Failed to create request' });
  }
};

const approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await prisma.stockRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });
    if (request.status !== 'PENDING') return res.status(400).json({ success: false, error: 'Only pending requests can be approved' });
    await prisma.stockRequest.update({ where: { id }, data: { status: 'APPROVED', approvedById: req.user.id } });
    res.json({ success: true, message: 'Request approved' });
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({ success: false, error: 'Failed to approve request' });
  }
};

const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectReason } = req.body;
    const request = await prisma.stockRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });
    if (request.status !== 'PENDING' && request.status !== 'APPROVED') return res.status(400).json({ success: false, error: 'Request cannot be rejected in current status' });
    await prisma.stockRequest.update({ where: { id }, data: { status: 'REJECTED', approvedById: req.user.id, rejectReason: rejectReason || null } });
    res.json({ success: true, message: 'Request rejected' });
  } catch (error) {
    console.error('Error rejecting request:', error);
    res.status(500).json({ success: false, error: 'Failed to reject request' });
  }
};

const deliverRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;
    const request = await prisma.stockRequest.findUnique({
      where: { id },
      include: { items: { include: { medicationCatalog: true } } }
    });
    if (!request) return res.status(404).json({ success: false, error: 'Request not found' });
    if (request.status !== 'APPROVED') return res.status(400).json({ success: false, error: 'Only approved requests can be delivered' });
    if (!items || items.length === 0) return res.status(400).json({ success: false, error: 'Delivery items are required' });

    for (const item of items) {
      const reqItem = request.items.find(i => i.id === item.stockRequestItemId);
      if (!reqItem) continue;
      const deliverQty = item.quantityDelivered || reqItem.quantityRequested;
      if (deliverQty <= 0) continue;

      const ws = await prisma.warehouseStock.findUnique({ where: { medicationCatalogId: reqItem.medicationCatalogId } });
      if (!ws || ws.quantity < deliverQty) return res.status(400).json({
        success: false, error: `Insufficient warehouse stock for ${reqItem.medicationCatalog.name}. Available: ${ws?.quantity || 0}, requested: ${deliverQty}`
      });
      await prisma.warehouseStock.update({ where: { medicationCatalogId: reqItem.medicationCatalogId }, data: { quantity: { decrement: deliverQty } } });
      await prisma.medicationCatalog.update({ where: { id: reqItem.medicationCatalogId }, data: { availableQuantity: { increment: deliverQty } } });
      await prisma.stockRequestItem.update({ where: { id: reqItem.id }, data: { quantityDelivered: deliverQty } });
      await prisma.stockMovement.create({
        data: { medicationCatalogId: reqItem.medicationCatalogId, quantity: -deliverQty, type: 'STOCK_REQUEST_OUT', referenceType: 'STOCK_REQUEST', referenceId: id, userId: req.user.id, notes: `Delivered to pharmacy` }
      });
      await prisma.stockMovement.create({
        data: { medicationCatalogId: reqItem.medicationCatalogId, quantity: deliverQty, type: 'STOCK_REQUEST_IN', referenceType: 'STOCK_REQUEST', referenceId: id, userId: req.user.id, notes: `Received from warehouse` }
      });
    }

    const allDelivered = request.items.every(i => {
      const delivered = items.find(d => d.stockRequestItemId === i.id)?.quantityDelivered || i.quantityDelivered || 0;
      return delivered >= i.quantityRequested;
    });
    await prisma.stockRequest.update({ where: { id }, data: { status: allDelivered ? 'DELIVERED' : 'PARTIALLY_DELIVERED', approvedById: req.user.id } });
    res.json({ success: true, message: 'Request delivered' });
  } catch (error) {
    console.error('Error delivering request:', error);
    res.status(500).json({ success: false, error: 'Failed to deliver request' });
  }
};

const getMovements = async (req, res) => {
  try {
    const { type, from, to } = req.query;
    const where = {};
    if (type) where.type = type;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to + 'T23:59:59.999Z');
    }
    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        medicationCatalog: { select: { id: true, name: true, dosageForm: true, strength: true } },
        user: { select: { id: true, fullname: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    res.json({ success: true, movements });
  } catch (error) {
    console.error('Error fetching movements:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch movements' });
  }
};

module.exports = { getStock, updateStock, getRequests, createRequest, approveRequest, rejectRequest, deliverRequest, getMovements };
