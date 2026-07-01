const prisma = require('../config/database');

const getAll = async (req, res) => {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      include: {
        supplier: { select: { id: true, name: true } },
        orderedBy: { select: { id: true, fullname: true } },
        receivedBy: { select: { id: true, fullname: true } },
        items: {
          include: { medicationCatalog: { select: { id: true, name: true, dosageForm: true, strength: true, category: true } } }
        }
      },
      orderBy: { orderedAt: 'desc' }
    });
    res.json({ success: true, orders });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch purchase orders' });
  }
};

const create = async (req, res) => {
  try {
    const { supplierId, items, notes } = req.body;
    if (!supplierId) return res.status(400).json({ success: false, error: 'Supplier is required' });
    if (!items || items.length === 0) return res.status(400).json({ success: false, error: 'At least one item is required' });
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) return res.status(404).json({ success: false, error: 'Supplier not found' });
    const totalAmount = items.reduce((sum, i) => sum + (i.unitPrice || 0) * i.quantity, 0);
    const order = await prisma.purchaseOrder.create({
      data: {
        supplierId, orderedById: req.user.id, totalAmount, notes,
        items: { create: items.map(item => ({ medicationCatalogId: item.medicationCatalogId, quantityOrdered: item.quantity, unitPrice: item.unitPrice || null })) }
      },
      include: {
        supplier: { select: { id: true, name: true } },
        orderedBy: { select: { id: true, fullname: true } },
        items: { include: { medicationCatalog: { select: { id: true, name: true } } } }
      }
    });
    res.json({ success: true, order });
  } catch (error) {
    console.error('Error creating purchase order:', error);
    res.status(500).json({ success: false, error: 'Failed to create purchase order' });
  }
};

const receive = async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;
    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: { include: { medicationCatalog: true } } }
    });
    if (!order) return res.status(404).json({ success: false, error: 'Purchase order not found' });
    if (order.status === 'RECEIVED' || order.status === 'CANCELLED') return res.status(400).json({ success: false, error: `Order is already ${order.status.toLowerCase()}` });
    if (!items || items.length === 0) return res.status(400).json({ success: false, error: 'Receive items are required' });

    for (const item of items) {
      const poItem = order.items.find(i => i.id === item.purchaseOrderItemId);
      if (!poItem) continue;
      const receiveQty = item.quantityReceived || poItem.quantityOrdered - poItem.quantityReceived;
      if (receiveQty <= 0) continue;
      const newReceived = poItem.quantityReceived + receiveQty;
      await prisma.purchaseOrderItem.update({ where: { id: poItem.id }, data: { quantityReceived: newReceived } });
      const ws = await prisma.warehouseStock.findUnique({ where: { medicationCatalogId: poItem.medicationCatalogId } });
      if (ws) {
        await prisma.warehouseStock.update({ where: { medicationCatalogId: poItem.medicationCatalogId }, data: { quantity: { increment: receiveQty }, unitCost: item.unitPrice || poItem.unitPrice || undefined } });
      } else {
        await prisma.warehouseStock.create({ data: { medicationCatalogId: poItem.medicationCatalogId, quantity: receiveQty, unitCost: item.unitPrice || poItem.unitPrice || null } });
      }
      await prisma.stockMovement.create({
        data: { medicationCatalogId: poItem.medicationCatalogId, quantity: receiveQty, type: 'PURCHASE_IN', referenceType: 'PURCHASE_ORDER', referenceId: id, userId: req.user.id, notes: `Received from ${order.supplierId}` }
      });
    }

    const allReceived = order.items.every(i => {
      const rcvd = items.find(d => d.purchaseOrderItemId === i.id)?.quantityReceived || 0;
      return (i.quantityReceived + rcvd) >= i.quantityOrdered;
    });
    await prisma.purchaseOrder.update({
      where: { id },
      data: { status: allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED', receivedById: req.user.id, receivedAt: new Date() }
    });
    res.json({ success: true, message: 'Purchase order received' });
  } catch (error) {
    console.error('Error receiving purchase order:', error);
    res.status(500).json({ success: false, error: 'Failed to receive purchase order' });
  }
};

module.exports = { getAll, create, receive };
