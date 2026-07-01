const prisma = require('../config/database');

const getAll = async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, suppliers });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch suppliers' });
  }
};

const getById = async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id } });
    if (!supplier) return res.status(404).json({ success: false, error: 'Supplier not found' });
    res.json({ success: true, supplier });
  } catch (error) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch supplier' });
  }
};

const create = async (req, res) => {
  try {
    const { name, contactPerson, phone, email, address, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
    const supplier = await prisma.supplier.create({ data: { name, contactPerson, phone, email, address, notes } });
    res.json({ success: true, supplier });
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ success: false, error: 'Failed to create supplier' });
  }
};

const update = async (req, res) => {
  try {
    const { name, contactPerson, phone, email, address, status, notes } = req.body;
    const supplier = await prisma.supplier.update({ where: { id: req.params.id }, data: { name, contactPerson, phone, email, address, status, notes } });
    res.json({ success: true, supplier });
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ success: false, error: 'Failed to update supplier' });
  }
};

const remove = async (req, res) => {
  try {
    await prisma.supplier.update({ where: { id: req.params.id }, data: { status: 'INACTIVE' } });
    res.json({ success: true, message: 'Supplier deactivated' });
  } catch (error) {
    console.error('Error deactivating supplier:', error);
    res.status(500).json({ success: false, error: 'Failed to deactivate supplier' });
  }
};

module.exports = { getAll, getById, create, update, remove };
