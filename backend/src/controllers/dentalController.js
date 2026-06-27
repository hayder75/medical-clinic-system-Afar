const prisma = require('../config/database');
const { z } = require('zod');


// Validation schemas
const dentalRecordSchema = z.object({
  patientId: z.string(),
  visitId: z.number().optional(),
  doctorId: z.string().optional(),
  toothChart: z.record(z.string(), z.object({
    status: z.string().optional(),
    conditions: z.array(z.string()).optional(), // Legacy support
    diagnosis: z.array(z.string()).optional(),
    diagnosisNotes: z.string().optional(),
    mobilityDiagnosis: z.string().optional(),
    restoration: z.array(z.string()).optional(),
    restorationNotes: z.string().optional(),
    treatmentPlan: z.array(z.string()).optional(),
    treatmentPlanNotes: z.string().optional(),
    completedTreatments: z.array(z.object({
      treatment: z.string(),
      date: z.string(),
      dentistName: z.string().optional()
    })).optional(),
    periodontal: z.object({
      pocketDepth: z.union([z.string(), z.number()]).optional().nullable(),
      bleeding: z.boolean().optional().nullable(),
      recession: z.union([z.string(), z.number()]).optional().nullable(),
      mobility: z.string().optional().nullable(),
      furcation: z.boolean().optional().nullable(),
      notes: z.string().optional()
    }).optional(),
    generalNotes: z.array(z.object({
      text: z.string(),
      date: z.string()
    })).optional(),
    notes: z.string().optional(), // Legacy
    surfaces: z.array(z.string()).optional() // Legacy
  })).optional(),
  painFlags: z.record(z.string(), z.any()).optional(),
  gumCondition: z.string().optional(),
  oralHygiene: z.string().optional(),
  treatmentPlan: z.any().optional(),
  notes: z.string().optional()
});

// Get all dentists (doctors with dental qualification)
exports.getDentists = async (req, res) => {
  try {
    const dentists = await prisma.user.findMany({
      where: {
        role: 'DOCTOR',
        qualifications: {
          has: 'Dentist'
        },
        availability: true
      },
      select: {
        id: true,
        fullname: true,
        username: true,
        email: true,
        qualifications: true,
        consultationFee: true
      }
    });

    res.json({ dentists });
  } catch (error) {
    console.error('Error fetching dentists:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get dental record for a patient
exports.getDentalRecord = async (req, res) => {
  try {
    const { patientId, visitId } = req.params;

    const dentalRecord = await prisma.dentalRecord.findFirst({
      where: {
        patientId,
        visitId: visitId ? parseInt(visitId) : undefined
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
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
            date: true,
            status: true
          }
        }
      }
    });

    if (!dentalRecord) {
      return res.status(404).json({ error: 'Dental record not found' });
    }

    res.json({ dentalRecord });
  } catch (error) {
    console.error('Error fetching dental record:', error);
    res.status(500).json({ error: error.message });
  }
};

// Create or update dental record
exports.saveDentalRecord = async (req, res) => {
  try {
    const data = dentalRecordSchema.parse(req.body);
    const doctorId = req.user.id;

    // Check if dental record exists
    const existingRecord = await prisma.dentalRecord.findFirst({
      where: {
        patientId: data.patientId,
        visitId: data.visitId
      }
    });

    let dentalRecord;

    if (existingRecord) {
      // Update existing record
      dentalRecord = await prisma.dentalRecord.update({
        where: { id: existingRecord.id },
        data: {
          ...data,
          doctorId,
          updatedAt: new Date()
        },
        include: {
          patient: {
            select: {
              id: true,
              name: true,
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
    } else {
      // Create new record
      dentalRecord = await prisma.dentalRecord.create({
        data: {
          ...data,
          doctorId
        },
        include: {
          patient: {
            select: {
              id: true,
              name: true,
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
    }

    res.json({ dentalRecord });
  } catch (error) {
    console.error('Error saving dental record:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

// Get dental history for a patient
exports.getDentalHistory = async (req, res) => {
  try {
    const { patientId } = req.params;

    const dentalHistory = await prisma.dentalRecord.findMany({
      where: { patientId },
      include: {
        doctor: {
          select: {
            id: true,
            fullname: true
          }
        },
        visit: {
          select: {
            id: true,
            visitUid: true,
            date: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ dentalHistory });
  } catch (error) {
    console.error('Error fetching dental history:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get tooth information
exports.getToothInfo = async (req, res) => {
  try {
    const { toothNumber } = req.params;

    const tooth = await prisma.tooth.findFirst({
      where: { number: parseInt(toothNumber) }
    });

    if (!tooth) {
      return res.status(404).json({ error: 'Tooth information not found' });
    }

    res.json({ tooth });
  } catch (error) {
    console.error('Error fetching tooth info:', error);
    res.status(500).json({ error: error.message });
  }
};

// Create dental lab/radiology order from tooth selection
exports.createDentalOrder = async (req, res) => {
  try {
    const { visitId, patientId, toothNumbers, orderType, instructions } = req.body;
    const doctorId = req.user.id;

    // Validate order type
    if (!['LAB', 'RADIOLOGY'].includes(orderType)) {
      return res.status(400).json({ error: 'Invalid order type. Must be LAB or RADIOLOGY' });
    }

    // Create batch order for dental procedure
    const batchOrder = await prisma.batchOrder.create({
      data: {
        visitId: parseInt(visitId),
        patientId,
        doctorId,
        type: orderType,
        instructions: `Dental ${orderType.toLowerCase()} for teeth: ${toothNumbers.join(', ')}. ${instructions || ''}`,
        status: 'UNPAID'
      }
    });

    // Add services to the batch order
    const services = [];
    for (const toothNumber of toothNumbers) {
      // Find appropriate investigation type based on order type
      let investigationType;
      if (orderType === 'RADIOLOGY') {
        investigationType = await prisma.investigationType.findFirst({
          where: {
            name: {
              contains: 'X-Ray',
              mode: 'insensitive'
            }
          }
        });
      } else {
        investigationType = await prisma.investigationType.findFirst({
          where: {
            name: {
              contains: 'Dental',
              mode: 'insensitive'
            }
          }
        });
      }

      if (investigationType) {
        const service = await prisma.batchOrderService.create({
          data: {
            batchOrderId: batchOrder.id,
            serviceId: investigationType.serviceId,
            investigationTypeId: investigationType.id,
            result: null,
            status: 'UNPAID'
          }
        });
        services.push(service);
      }
    }

    res.json({
      batchOrder,
      services,
      message: `Dental ${orderType.toLowerCase()} order created for teeth: ${toothNumbers.join(', ')}`
    });
  } catch (error) {
    console.error('Error creating dental order:', error);
    res.status(500).json({ error: error.message });
  }
};

// Complete a dental procedure
exports.completeDentalProcedure = async (req, res) => {
  try {
    const { batchOrderServiceId, notes } = req.body;
    const doctorId = req.user.id;

    if (!batchOrderServiceId) {
      return res.status(400).json({ error: 'Batch order service ID is required' });
    }

    // Get the batch order service
    const batchOrderService = await prisma.batchOrderService.findUnique({
      where: { id: batchOrderServiceId },
      include: {
        batchOrder: {
          include: {
            visit: true,
            patient: true
          }
        },
        service: true
      }
    });

    if (!batchOrderService) {
      return res.status(404).json({ error: 'Batch order service not found' });
    }

    // Check if already completed
    const existingCompletion = await prisma.dentalProcedureCompletion.findUnique({
      where: { batchOrderServiceId }
    });

    if (existingCompletion) {
      return res.status(400).json({ error: 'This procedure is already completed' });
    }

    // Check if the batch order is paid (or deferred - which means pre-paid via credit)
    const allowedStatuses = ['PAID', 'DEFERRED'];
    if (!allowedStatuses.includes(batchOrderService.batchOrder.status) && batchOrderService.status !== 'PAID') {
      return res.status(400).json({ error: 'Procedure must be paid before completion' });
    }

    // Create completion record
    const completion = await prisma.dentalProcedureCompletion.create({
      data: {
        batchOrderId: batchOrderService.batchOrderId,
        batchOrderServiceId: batchOrderServiceId,
        visitId: batchOrderService.batchOrder.visitId,
        patientId: batchOrderService.batchOrder.patientId,
        doctorId: doctorId,
        notes: notes || null
      },
      include: {
        batchOrder: {
          include: {
            visit: true,
            patient: true
          }
        },
        batchOrderService: {
          include: {
            service: true
          }
        },
        doctor: {
          select: {
            id: true,
            fullname: true
          }
        }
      }
    });

    res.json({
      message: 'Dental procedure completed successfully',
      completion
    });
  } catch (error) {
    console.error('Error completing dental procedure:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get dental procedure completions for a visit
exports.getDentalProcedureCompletions = async (req, res) => {
  try {
    const { visitId } = req.params;

    const completions = await prisma.dentalProcedureCompletion.findMany({
      where: { visitId: parseInt(visitId) },
      include: {
        batchOrder: {
          include: {
            visit: true,
            patient: true
          }
        },
        batchOrderService: {
          include: {
            service: true
          }
        },
        doctor: {
          select: {
            id: true,
            fullname: true
          }
        }
      },
      orderBy: {
        completedAt: 'desc'
      }
    });

    res.json({ completions });
  } catch (error) {
    console.error('Error fetching dental procedure completions:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = exports;
