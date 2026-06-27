const prisma = require('../config/database');
const { z } = require('zod');

const compoundPrescriptionSchema = z.object({
  visitId: z.number().int().positive(),
  patientId: z.string().min(1),
  prescriptionText: z.string().optional(),
  rawText: z.string().optional(),
  formulationType: z.string().optional(),
  baseType: z.string().optional(),
  customBase: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  quantityUnit: z.string().optional(),
  frequencyType: z.string().optional(),
  frequencyValue: z.string().optional(),
  durationValue: z.number().optional(),
  durationUnit: z.string().optional(),
  instructions: z.string().optional(),
  storageInstructions: z.string().optional(),
  warnings: z.string().optional(),
  pharmacyNotes: z.string().optional(),
  totalCost: z.number().optional(),
  ingredients: z.array(z.object({
    ingredientName: z.string().min(1),
    strength: z.number(),
    unit: z.string().min(1),
    isManualEntry: z.boolean().optional(),
    cost: z.number().optional(),
    sortOrder: z.number().optional()
  })).optional()
});

const compoundIngredientSchema = z.object({
  ingredientName: z.string().min(1),
  strength: z.number(),
  unit: z.string().min(1),
  isManualEntry: z.boolean().optional(),
  cost: z.number().optional(),
  sortOrder: z.number().optional()
});

function generateReferenceNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CPD-${timestamp}-${random}`;
}

exports.createCompoundPrescription = async (req, res) => {
  try {
    const data = compoundPrescriptionSchema.parse(req.body);
    const doctorId = req.user.id;

    const referenceNumber = generateReferenceNumber();

    const compoundPrescription = await prisma.compoundPrescription.create({
      data: {
        visitId: data.visitId,
        patientId: data.patientId,
        doctorId: doctorId,
        prescriptionText: data.prescriptionText || null,
        rawText: data.rawText || data.prescriptionText || null,
        formulationType: data.formulationType || 'CUSTOM',
        baseType: data.baseType || null,
        customBase: data.customBase || null,
        quantity: data.quantity || null,
        quantityUnit: data.quantityUnit || null,
        frequencyType: data.frequencyType || null,
        frequencyValue: data.frequencyValue || null,
        durationValue: data.durationValue || null,
        durationUnit: data.durationUnit || null,
        instructions: data.instructions || null,
        storageInstructions: data.storageInstructions || null,
        warnings: data.warnings || null,
        pharmacyNotes: data.pharmacyNotes || null,
        totalCost: data.totalCost || null,
        referenceNumber: referenceNumber,
        ingredients: data.ingredients ? {
          create: data.ingredients.map((ing, index) => ({
            ingredientName: ing.ingredientName,
            strength: ing.strength,
            unit: ing.unit,
            isManualEntry: ing.isManualEntry || false,
            cost: ing.cost || null,
            sortOrder: ing.sortOrder || index
          }))
        } : undefined
      },
      include: {
        ingredients: {
          orderBy: { sortOrder: 'asc' }
        },
        patient: {
          select: {
            id: true,
            name: true,
            mobile: true,
            dob: true,
            gender: true
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
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: doctorId,
        action: 'CREATE_COMPOUND_PRESCRIPTION',
        entity: 'CompoundPrescription',
        entityId: compoundPrescription.id,
        details: JSON.stringify({
          patientId: data.patientId,
          visitId: data.visitId,
          referenceNumber: referenceNumber,
          formulationType: data.formulationType,
          ingredientCount: data.ingredients ? data.ingredients.length : 0
        }),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.status(201).json({
      message: 'Compound prescription created successfully',
      compoundPrescription
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating compound prescription:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getCompoundPrescriptionsByVisit = async (req, res) => {
  try {
    const { visitId } = req.params;

    const compoundPrescriptions = await prisma.compoundPrescription.findMany({
      where: {
        visitId: parseInt(visitId)
      },
      include: {
        ingredients: {
          orderBy: { sortOrder: 'asc' }
        },
        patient: {
          select: {
            id: true,
            name: true,
            mobile: true,
            dob: true,
            gender: true
          }
        },
        doctor: {
          select: {
            id: true,
            fullname: true,
            qualifications: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ compoundPrescriptions });
  } catch (error) {
    console.error('Error fetching compound prescriptions:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getCompoundPrescriptionById = async (req, res) => {
  try {
    const { id } = req.params;

    const compoundPrescription = await prisma.compoundPrescription.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        ingredients: {
          orderBy: { sortOrder: 'asc' }
        },
        patient: {
          select: {
            id: true,
            name: true,
            mobile: true,
            dob: true,
            gender: true
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
        }
      }
    });

    if (!compoundPrescription) {
      return res.status(404).json({ error: 'Compound prescription not found' });
    }

    res.json({ compoundPrescription });
  } catch (error) {
    console.error('Error fetching compound prescription:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateCompoundPrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const data = compoundPrescriptionSchema.partial().parse(req.body);
    const doctorId = req.user.id;

    const existing = await prisma.compoundPrescription.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Compound prescription not found' });
    }

    if (existing.doctorId !== doctorId) {
      return res.status(403).json({ error: 'Not authorized to update this prescription' });
    }

    const updateData = {};
    if (data.formulationType) updateData.formulationType = data.formulationType;
    if (data.baseType !== undefined) updateData.baseType = data.baseType;
    if (data.customBase !== undefined) updateData.customBase = data.customBase;
    if (data.quantity) updateData.quantity = data.quantity;
    if (data.quantityUnit) updateData.quantityUnit = data.quantityUnit;
    if (data.frequencyType !== undefined) updateData.frequencyType = data.frequencyType;
    if (data.frequencyValue !== undefined) updateData.frequencyValue = data.frequencyValue;
    if (data.durationValue !== undefined) updateData.durationValue = data.durationValue;
    if (data.durationUnit !== undefined) updateData.durationUnit = data.durationUnit;
    if (data.instructions !== undefined) updateData.instructions = data.instructions;
    if (data.storageInstructions !== undefined) updateData.storageInstructions = data.storageInstructions;
    if (data.warnings !== undefined) updateData.warnings = data.warnings;
    if (data.pharmacyNotes !== undefined) updateData.pharmacyNotes = data.pharmacyNotes;
    if (data.totalCost !== undefined) updateData.totalCost = data.totalCost;

    if (data.ingredients) {
      await prisma.compoundIngredient.deleteMany({
        where: { compoundPrescriptionId: parseInt(id) }
      });

      await prisma.compoundIngredient.createMany({
        data: data.ingredients.map((ing, index) => ({
          compoundPrescriptionId: parseInt(id),
          ingredientName: ing.ingredientName,
          strength: ing.strength,
          unit: ing.unit,
          isManualEntry: ing.isManualEntry || false,
          cost: ing.cost || null,
          sortOrder: ing.sortOrder || index
        }))
      });
    }

    const compoundPrescription = await prisma.compoundPrescription.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        ingredients: {
          orderBy: { sortOrder: 'asc' }
        },
        patient: {
          select: {
            id: true,
            name: true,
            mobile: true,
            dob: true,
            gender: true
          }
        },
        doctor: {
          select: {
            id: true,
            fullname: true,
            qualifications: true
          }
        }
      }
    });

    res.json({
      message: 'Compound prescription updated successfully',
      compoundPrescription
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating compound prescription:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteCompoundPrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const doctorId = req.user.id;

    const existing = await prisma.compoundPrescription.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Compound prescription not found' });
    }

    if (existing.doctorId !== doctorId) {
      return res.status(403).json({ error: 'Not authorized to delete this prescription' });
    }

    await prisma.compoundPrescription.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Compound prescription deleted successfully' });
  } catch (error) {
    console.error('Error deleting compound prescription:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.markAsPrepared = async (req, res) => {
  try {
    const { id } = req.params;
    const { preparedBy, expiryDays } = req.body;

    const updateData = {
      preparedBy: preparedBy || null,
      preparedAt: new Date()
    };

    if (expiryDays) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + expiryDays);
      updateData.expiryDate = expiryDate;
    }

    const compoundPrescription = await prisma.compoundPrescription.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        ingredients: {
          orderBy: { sortOrder: 'asc' }
        },
        patient: true,
        doctor: true
      }
    });

    res.json({
      message: 'Compound prescription marked as prepared',
      compoundPrescription
    });
  } catch (error) {
    console.error('Error marking compound prescription as prepared:', error);
    res.status(500).json({ error: error.message });
  }
};
