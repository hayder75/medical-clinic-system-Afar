const prisma = require('../config/database');

// Get medication catalog (all medications)
exports.getMedicationCatalog = async (req, res) => {
  try {
    const { limit = 100, offset = 0, includeRetailOnly = true } = req.query;
    
    // Check if user is a doctor - if so, exclude retail-only items
    const user = req.user;
    const isDoctor = user && (user.role === 'DOCTOR');
    
    const whereClause = isDoctor && includeRetailOnly !== 'true' 
      ? { isRetailOnly: false } 
      : {};
    
    const medications = await prisma.medicationCatalog.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        genericName: true,
        dosageForm: true,
        strength: true,
        category: true,
        unitPrice: true,
        availableQuantity: true,
        minimumStock: true,
        manufacturer: true,
        isRetailOnly: true,
        description: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [
        { name: 'asc' },
        { availableQuantity: 'desc' }
      ],
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    const total = await prisma.medicationCatalog.count({ where: whereClause });

    res.json({
      success: true,
      medications,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching medication catalog:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch medication catalog',
      details: error.message
    });
  }
};

// Search medications in catalog
exports.searchMedications = async (req, res) => {
  try {
    const { query, category, type, limit = 50, includeRetailOnly = false } = req.query;
    
    // Check if user is a doctor - if so, exclude retail-only items
    const user = req.user;
    const isDoctor = user && (user.role === 'DOCTOR');
    
    const whereClause = {
      ...(query && {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { genericName: { contains: query, mode: 'insensitive' } },
          { manufacturer: { contains: query, mode: 'insensitive' } }
        ]
      }),
      ...(category && { category }),
      ...(type && { type }),
      // Exclude retail-only items for doctors unless explicitly requested
      ...(isDoctor && includeRetailOnly !== 'true' ? { isRetailOnly: false } : {})
    };

    const medications = await prisma.medicationCatalog.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        genericName: true,
        dosageForm: true,
        strength: true,
        category: true,
        unitPrice: true,
        availableQuantity: true,
        minimumStock: true,
        manufacturer: true,
        isRetailOnly: true,
        description: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [
        { name: 'asc' },
        { availableQuantity: 'desc' }
      ],
      take: parseInt(limit)
    });

    res.json({
      success: true,
      medications,
      total: medications.length
    });
  } catch (error) {
    console.error('Error searching medications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to search medications',
      details: error.message 
    });
  }
};

// Get medication by ID
exports.getMedicationById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const medication = await prisma.medicationCatalog.findUnique({
      where: { id },
      include: {
        medicationOrders: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            patient: {
              select: { id: true, name: true }
            },
            doctor: {
              select: { id: true, fullname: true }
            }
          }
        }
      }
    });

    if (!medication) {
      return res.status(404).json({
        success: false,
        error: 'Medication not found'
      });
    }

    res.json({
      success: true,
      medication
    });
  } catch (error) {
    console.error('Error getting medication:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get medication',
      details: error.message 
    });
  }
};

// Create new medication in catalog
exports.createMedication = async (req, res) => {
  try {
    const {
      name,
      genericName,
      dosageForm,
      strength,
      type = 'Prescription',
      unitPrice,
      availableQuantity = 0,
      minimumStock = 10,
      category,
      manufacturer,
      description,
      isRetailOnly = false,
      sideEffects,
      contraindications
    } = req.body;

    // Validate required fields
    if (!name || !dosageForm || !strength || !unitPrice) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, dosageForm, strength, unitPrice'
      });
    }

    const medication = await prisma.medicationCatalog.create({
      data: {
        name,
        genericName,
        dosageForm,
        strength,
        type,
        unitPrice: parseFloat(unitPrice),
        availableQuantity: parseInt(availableQuantity),
        minimumStock: parseInt(minimumStock),
        category,
        manufacturer,
        description,
        isRetailOnly: isRetailOnly === true || isRetailOnly === 'true',
        sideEffects,
        contraindications
      }
    });

    res.status(201).json({
      success: true,
      medication,
      message: 'Medication added to catalog successfully'
    });
  } catch (error) {
    console.error('Error creating medication:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create medication',
      details: error.message 
    });
  }
};

// Update medication in catalog
exports.updateMedication = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const medication = await prisma.medicationCatalog.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      medication,
      message: 'Medication updated successfully'
    });
  } catch (error) {
    console.error('Error updating medication:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update medication',
      details: error.message 
    });
  }
};

// Update medication stock
exports.updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, operation = 'set' } = req.body; // operation: 'set', 'add', 'subtract'

    const medication = await prisma.medicationCatalog.findUnique({
      where: { id }
    });

    if (!medication) {
      return res.status(404).json({
        success: false,
        error: 'Medication not found'
      });
    }

    let newQuantity;
    switch (operation) {
      case 'add':
        newQuantity = medication.availableQuantity + parseInt(quantity);
        break;
      case 'subtract':
        newQuantity = Math.max(0, medication.availableQuantity - parseInt(quantity));
        break;
      case 'set':
      default:
        newQuantity = parseInt(quantity);
        break;
    }

    const updatedMedication = await prisma.medicationCatalog.update({
      where: { id },
      data: { availableQuantity: newQuantity }
    });

    res.json({
      success: true,
      medication: updatedMedication,
      message: `Stock updated to ${newQuantity} units`
    });
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update stock',
      details: error.message 
    });
  }
};

// Get low stock medications
exports.getLowStockMedications = async (req, res) => {
  try {
    const medications = await prisma.medicationCatalog.findMany({
      where: {
        availableQuantity: {
          lte: prisma.medicationCatalog.fields.minimumStock
        }
      },
      orderBy: { availableQuantity: 'asc' }
    });

    res.json({
      success: true,
      medications,
      total: medications.length
    });
  } catch (error) {
    console.error('Error getting low stock medications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get low stock medications',
      details: error.message 
    });
  }
};

// Get medication categories
exports.getMedicationCategories = async (req, res) => {
  try {
    const categories = await prisma.medicationCatalog.findMany({
      select: { category: true },
      distinct: ['category']
    });

    const categoryList = categories
      .map(c => c.category)
      .filter(Boolean)
      .sort();

    res.json({
      success: true,
      categories: categoryList
    });
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get categories',
      details: error.message 
    });
  }
};
