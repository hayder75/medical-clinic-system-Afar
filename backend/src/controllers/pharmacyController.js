const prisma = require('../config/database');
const { z } = require('zod');

// Validation schemas
const dispenseSchema = z.object({
  orderId: z.number(),
  quantity: z.number(),
  notes: z.string().optional(),
});

const registerMedicationSchema = z.object({
  name: z.string(),
  dosageForm: z.string(),
  strength: z.string(),
  quantity: z.number().positive(),
  price: z.number().positive(),
  supplier: z.string().optional(),
  expiryDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

exports.getOrders = async (req, res) => {
  try {
    const orders = await prisma.medicationOrder.findMany({
      where: {
        status: { in: ['QUEUED', 'PAID'] }, // Only show QUEUED and PAID orders (not COMPLETED)
        // Removed visit status filter - medication orders should be available even after visit completion
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            type: true,
            mobile: true
          }
        },
        doctor: {
          select: {
            id: true,
            fullname: true,
            qualifications: true
          }
        },
        visit: {
          select: {
            id: true,
            visitUid: true,
            status: true
          }
        },
        continuousInfusion: {
          include: {
            nurseTasks: {
              where: {
                completed: false
              },
              take: 1
            }
          }
        },
        dispenseLogs: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      },
      orderBy: [
        { createdAt: 'asc' } // First come, first served
      ]
    });

    // Filter out orders that are continuous infusion and not ready for dispensing
    const filteredOrders = orders.filter(order => {
      if (order.continuousInfusion) {
        // For CSI orders, only show if they have pending nurse tasks
        return order.continuousInfusion.nurseTasks.length > 0;
      }
      return true; // Regular orders are always shown
    });

    res.json({ orders: filteredOrders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.dispense = async (req, res) => {
  try {
    const { orderId, quantity, notes } = dispenseSchema.parse(req.body);
    const pharmacyId = req.user.id;

    // Check if order exists and is in correct status
    const order = await prisma.medicationOrder.findUnique({
      where: { id: orderId },
      include: {
        patient: true,
        visit: true,
        continuousInfusion: true
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Medication order not found' });
    }

    if (!['QUEUED', 'PAID'].includes(order.status)) {
      return res.status(400).json({ error: 'Order is not ready for dispensing' });
    }

    // Check inventory availability
    const inventoryItem = await prisma.inventory.findFirst({
      where: {
        name: { contains: order.name, mode: 'insensitive' },
        service: {
          category: 'MEDICATION'
        }
      },
      include: {
        service: true
      }
    });

    if (inventoryItem) {
      // Check if sufficient quantity is available
      if (inventoryItem.quantity < quantity) {
        return res.status(400).json({
          error: 'Insufficient inventory',
          available: inventoryItem.quantity,
          requested: quantity,
          medication: order.name
        });
      }
    } else {
      // If no inventory item found, check if medication is available in general
      const generalInventory = await prisma.inventory.findFirst({
        where: {
          name: { contains: order.name, mode: 'insensitive' }
        }
      });

      if (!generalInventory) {
        return res.status(400).json({
          error: 'Medication not available in inventory',
          medication: order.name
        });
      }
    }


    // Create dispense log
    const dispenseLog = await prisma.dispenseLog.create({
      data: {
        orderId,
        patientId: order.patientId,
        quantity,
        notes,
        pharmacyId
      },
      include: {
        pharmacy: {
          select: {
            id: true,
            fullname: true
          }
        }
      }
    });

    // Update inventory if item exists
    if (inventoryItem) {
      await prisma.inventory.update({
        where: { id: inventoryItem.id },
        data: { quantity: { decrement: quantity } }
      });
    }

    // Update order status to COMPLETED
    await prisma.medicationOrder.update({
      where: { id: orderId },
      data: { status: 'COMPLETED' }
    });

    // Create medical history entry
    await prisma.medicalHistory.create({
      data: {
        patientId: order.patientId,
        details: JSON.stringify({
          type: 'MEDICATION_DISPENSE',
          orderId: order.id,
          medication: order.name,
          serviceCode: inventoryItem?.service?.code,
          serviceName: inventoryItem?.service?.name,
          quantity: quantity,
          notes: notes,
          dispensedAt: new Date(),
          dispensedBy: pharmacyId
        })
      }
    });

    res.json({
      message: 'Medication dispensed successfully',
      dispenseLog
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

// Bulk dispense all medications for a patient
exports.bulkDispense = async (req, res) => {
  try {
    const { patientId, visitId, medications } = req.body;
    const pharmacyId = req.user.id;

    if (!medications || !Array.isArray(medications) || medications.length === 0) {
      return res.status(400).json({ error: 'Medications array is required' });
    }

    const results = [];
    const errors = [];

    // Process each medication
    for (const med of medications) {
      try {
        // Check if order exists and is in correct status
        const order = await prisma.medicationOrder.findUnique({
          where: { id: med.medicationOrderId },
          include: {
            patient: true,
            visit: true
          }
        });

        if (!order) {
          errors.push({ medicationOrderId: med.medicationOrderId, error: 'Order not found' });
          continue;
        }

        if (!['QUEUED', 'PAID'].includes(order.status)) {
          errors.push({ medicationOrderId: med.medicationOrderId, error: 'Order not ready for dispensing' });
          continue;
        }

        // Get the pharmacy invoice ID from the medication order
        const pharmacyInvoice = await prisma.pharmacyInvoice.findFirst({
          where: {
            pharmacyInvoiceItems: {
              some: {
                medicationOrderId: order.id
              }
            }
          }
        });

        if (!pharmacyInvoice) {
          errors.push({ medicationOrderId: med.medicationOrderId, error: 'Pharmacy invoice not found' });
          continue;
        }

        // Create dispensed medicine record
        const dispensedMedicine = await prisma.dispensedMedicine.create({
          data: {
            pharmacyInvoiceId: pharmacyInvoice.id,
            medicationOrderId: order.id,
            status: med.status || 'DISPENSED',
            quantity: med.quantity || order.quantity,
            notes: med.notes || '',
            dispensedBy: pharmacyId
          }
        });

        // Update order status to COMPLETED
        await prisma.medicationOrder.update({
          where: { id: order.id },
          data: { status: 'COMPLETED' }
        });

        // Decrease stock in medication catalog if medicationCatalogId exists
        // This is the ONLY place where inventory is decremented (not on order creation)
        if (order.medicationCatalogId) {
          // Use quantityNumeric if available, otherwise parse from quantity string
          const dispensedQuantity = med.quantity || order.quantityNumeric || parseFloat(order.quantity) || 0;
          const numericQuantity = typeof dispensedQuantity === 'number' ? dispensedQuantity : parseFloat(dispensedQuantity) || 0;

          if (numericQuantity > 0) {
            await prisma.medicationCatalog.update({
              where: { id: order.medicationCatalogId },
              data: {
                availableQuantity: {
                  decrement: numericQuantity
                }
              }
            });
            console.log(`✅ Inventory decremented for ${order.name}: -${numericQuantity} units`);
          }
        }

        results.push({
          medicationOrderId: order.id,
          medicationName: order.name,
          status: 'DISPENSED',
          dispensedMedicineId: dispensedMedicine.id
        });

      } catch (error) {
        errors.push({
          medicationOrderId: med.medicationOrderId,
          error: error.message
        });
      }
    }

    // Check if all medications for this visit are completed
    if (results.length > 0) {
      const remainingOrders = await prisma.medicationOrder.findMany({
        where: {
          visitId: parseInt(visitId),
          status: { in: ['UNPAID', 'PAID', 'QUEUED'] }
        }
      });

      // If no remaining orders, update visit status to COMPLETED
      if (remainingOrders.length === 0) {
        await prisma.visit.update({
          where: { id: parseInt(visitId) },
          data: { status: 'COMPLETED' }
        });
      }
    }

    // Create audit log (optional - skip if user doesn't exist in database)
    try {
      await prisma.auditLog.create({
        data: {
          userId: pharmacyId,
          action: 'BULK_DISPENSE_MEDICATIONS',
          entity: 'MedicationOrder',
          entityId: 0,
          details: JSON.stringify({
            patientId,
            visitId,
            totalMedications: medications.length,
            successful: results.length,
            failed: errors.length,
            results,
            errors
          }),
          ip: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
    } catch (auditError) {
      console.log('Audit log creation failed (user may not exist in database):', auditError.message);
    }

    res.json({
      message: `Bulk dispensing completed. ${results.length} successful, ${errors.length} failed.`,
      results,
      errors
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get pharmacy dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Pending Prescriptions - medication orders with status QUEUED or PAID
    const pendingPrescriptions = await prisma.medicationOrder.count({
      where: {
        status: {
          in: ['QUEUED', 'PAID']
        }
      }
    });

    // Dispensed Today - medication orders completed today
    const dispensedToday = await prisma.medicationOrder.count({
      where: {
        status: 'COMPLETED',
        updatedAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    // Total Medications - total count in MedicationCatalog
    const totalMedications = await prisma.medicationCatalog.count();

    // Low Stock Items - medications where availableQuantity <= minimumStock
    // Use raw query to compare availableQuantity with minimumStock
    const lowStockMedications = await prisma.medicationCatalog.findMany({
      select: {
        id: true,
        availableQuantity: true,
        minimumStock: true
      }
    });

    const lowStockItems = lowStockMedications.filter(med =>
      med.availableQuantity <= med.minimumStock
    ).length;

    res.json({
      pendingPrescriptions,
      dispensedToday,
      totalMedications,
      lowStockItems
    });
  } catch (error) {
    console.error('Error fetching pharmacy dashboard stats:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getInventory = async (req, res) => {
  try {
    // Pharmacy can see all items including retail-only
    const inventory = await prisma.medicationCatalog.findMany({
      orderBy: { name: 'asc' }
    });
    res.json({ inventory });
  } catch (error) {
    console.error('❌ getInventory - Error:', error.message);

    // Fallback mock data when database is not available
    const mockInventory = [
      {
        id: '1',
        name: 'Paracetamol',
        genericName: 'Acetaminophen',
        dosageForm: 'Tablet',
        strength: '500mg',
        category: 'TABLETS',
        unitPrice: 2.50,
        availableQuantity: 1000,
        minimumStock: 100,
        manufacturer: 'Ethio Pharma'
      },
      {
        id: '2',
        name: 'Amoxicillin',
        genericName: 'Amoxicillin',
        dosageForm: 'Capsule',
        strength: '500mg',
        category: 'CAPSULES',
        unitPrice: 5.00,
        availableQuantity: 500,
        minimumStock: 50,
        manufacturer: 'Cadila Pharmaceuticals'
      },
      {
        id: '3',
        name: 'Ibuprofen',
        genericName: 'Ibuprofen',
        dosageForm: 'Tablet',
        strength: '400mg',
        category: 'TABLETS',
        unitPrice: 3.00,
        availableQuantity: 800,
        minimumStock: 80,
        manufacturer: 'Ethio Pharma'
      },
      {
        id: '4',
        name: 'Metformin',
        genericName: 'Metformin HCl',
        dosageForm: 'Tablet',
        strength: '500mg',
        category: 'TABLETS',
        unitPrice: 4.50,
        availableQuantity: 300,
        minimumStock: 30,
        manufacturer: 'Sun Pharma'
      },
      {
        id: '5',
        name: 'Insulin',
        genericName: 'Human Insulin',
        dosageForm: 'Injection',
        strength: '100 units/ml',
        category: 'INJECTIONS',
        unitPrice: 45.00,
        availableQuantity: 25,
        minimumStock: 3,
        manufacturer: 'Novo Nordisk'
      }
    ];

    res.json({ inventory: mockInventory });
  }
};

// Add new medication to inventory
exports.addInventoryItem = async (req, res) => {
  try {
    const { name, category, quantity, unit, price, supplier, expiryDate, lowStockThreshold, isRetailOnly } = req.body;

    // Validate category against MedicineCategory enum
    const validCategories = ['TABLETS', 'CAPSULES', 'INJECTIONS', 'SYRUPS', 'OINTMENTS', 'DROPS', 'INHALERS', 'PATCHES', 'INFUSIONS'];
    const validCategory = validCategories.includes(category) ? category : 'TABLETS';

    const medication = await prisma.medicationCatalog.create({
      data: {
        name,
        category: validCategory,
        dosageForm: unit || 'Tablet',
        strength: 'N/A', // Will be updated when specific strength is known
        unitPrice: parseFloat(price),
        availableQuantity: parseInt(quantity),
        minimumStock: parseInt(lowStockThreshold) || 10,
        unit: 'unit', // Default unit
        manufacturer: supplier || null,
        isRetailOnly: isRetailOnly === true || isRetailOnly === 'true' || false
      }
    });

    res.status(201).json({
      message: 'Medication added to inventory successfully',
      medication
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update inventory item
exports.updateInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, quantity, unit, price, supplier, expiryDate, lowStockThreshold, isRetailOnly } = req.body;

    // Validate category against MedicineCategory enum
    const validCategories = ['TABLETS', 'CAPSULES', 'INJECTIONS', 'SYRUPS', 'OINTMENTS', 'DROPS', 'INHALERS', 'PATCHES', 'INFUSIONS'];
    const validCategory = validCategories.includes(category) ? category : 'TABLETS';

    const medication = await prisma.medicationCatalog.update({
      where: { id },
      data: {
        name,
        category: validCategory,
        dosageForm: unit || 'Tablet',
        unitPrice: parseFloat(price),
        availableQuantity: parseInt(quantity),
        minimumStock: parseInt(lowStockThreshold) || 10,
        manufacturer: supplier || null,
        isRetailOnly: isRetailOnly === true || isRetailOnly === 'true' || false
      }
    });

    res.json({
      message: 'Inventory item updated successfully',
      medication
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete inventory item
exports.deleteInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.medicationCatalog.delete({
      where: { id }
    });

    res.json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDispenseHistory = async (req, res) => {
  try {
    const { patientId, orderId } = req.query;

    let whereClause = {};

    if (patientId) {
      whereClause.patientId = patientId;
    }

    if (orderId) {
      whereClause.orderId = parseInt(orderId);
    }

    const dispenseLogs = await prisma.dispenseLog.findMany({
      where: whereClause,
      include: {
        order: {
          select: {
            id: true,
            name: true,
            dosageForm: true,
            strength: true,
            visit: {
              select: {
                id: true,
                visitUid: true
              }
            }
          }
        },
        pharmacy: {
          select: {
            id: true,
            fullname: true
          }
        },
        patient: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ dispenseLogs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Register new medication (for pharmacy billing officers)
exports.registerMedication = async (req, res) => {
  try {
    const data = registerMedicationSchema.parse(req.body);
    const pharmacyId = req.user.id;

    // Check if medication already exists
    const existingMedication = await prisma.inventory.findFirst({
      where: {
        name: { equals: data.name, mode: 'insensitive' },
        strength: data.strength,
        dosageForm: data.dosageForm
      }
    });

    if (existingMedication) {
      return res.status(400).json({
        error: 'Medication already exists in inventory',
        existing: {
          id: existingMedication.id,
          name: existingMedication.name,
          strength: existingMedication.strength,
          quantity: existingMedication.quantity
        }
      });
    }

    // Create service for the medication
    const service = await prisma.service.create({
      data: {
        code: `MED-${Date.now()}`, // Generate unique code
        name: data.name,
        category: 'MEDICATION',
        price: data.price,
        description: `${data.name} ${data.strength} ${data.dosageForm}`
      }
    });

    // Create inventory item
    const inventoryItem = await prisma.inventory.create({
      data: {
        name: data.name,
        quantity: data.quantity,
        category: data.dosageForm,
        dosageForm: data.dosageForm,
        strength: data.strength,
        price: data.price,
        supplier: data.supplier,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        serviceId: service.id,
        notes: data.notes
      },
      include: {
        service: true
      }
    });

    // Create audit log (optional - skip if user doesn't exist in database)
    try {
      await prisma.auditLog.create({
        data: {
          userId: pharmacyId,
          action: 'REGISTER_MEDICATION',
          entity: 'Inventory',
          entityId: inventoryItem.id,
          details: JSON.stringify({
            name: data.name,
            dosageForm: data.dosageForm,
            strength: data.strength,
            quantity: data.quantity,
            price: data.price,
            serviceId: service.id
          }),
          ip: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
    } catch (auditError) {
      console.log('Audit log creation failed (user may not exist in database):', auditError.message);
    }

    res.status(201).json({
      message: 'Medication registered successfully',
      inventoryItem,
      service
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};
