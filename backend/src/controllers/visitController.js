const prisma = require('../config/database');
const { z } = require('zod');
const { generateUniqueVisitUid } = require('../utils/visitUidGenerator');

// Validation schemas
const createVisitSchema = z.object({
  patientId: z.string(),
  notes: z.string().optional(),
});

const completeVisitSchema = z.object({
  visitId: z.number(),
  diagnosis: z.string(),
  finalNotes: z.string().optional(),
});

// Create a new visit
exports.createVisit = async (req, res) => {
  try {
    const { patientId, notes } = createVisitSchema.parse(req.body);
    const createdById = req.user.id;

    // Check if patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Create visit with unique visitUid
    const visit = await generateUniqueVisitUid(async (visitUid) => {
      return await prisma.visit.create({
        data: {
          visitUid: visitUid,
          patientId,
          createdById,
          notes,
          status: 'WAITING_FOR_TRIAGE'
        },
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              type: true,
              mobile: true,
              email: true
            }
          },
          createdBy: {
            select: {
              id: true,
              fullname: true,
              role: true
            }
          }
        }
      });
    }, prisma);

    res.status(201).json({
      message: 'Visit created successfully',
      visit
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

// Get visit by UID
exports.getVisitByUid = async (req, res) => {
  try {
    const { visitUid } = req.params;

    const visit = await prisma.visit.findUnique({
      where: { visitUid },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            type: true,
            mobile: true,
            email: true,
            dob: true,
            gender: true,
            bloodType: true
          }
        },
        createdBy: {
          select: {
            id: true,
            fullname: true,
            role: true
          }
        },
        vitals: {
          orderBy: { createdAt: 'desc' }
        },
        labOrders: {
          include: {
            type: true,
            attachments: true
          },
          orderBy: { createdAt: 'desc' }
        },
        radiologyOrders: {
          include: {
            type: true,
            attachments: true
          },
          orderBy: { createdAt: 'desc' }
        },
        medicationOrders: {
          include: {
            continuousInfusion: {
              include: {
                nurseTasks: {
                  include: {
                    administeredBy: {
                      select: {
                        id: true,
                        fullname: true
                      }
                    }
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        bills: {
          include: {
            items: true,
            payments: true
          }
        }
      }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    res.json({ visit });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update visit status
exports.updateVisit = async (req, res) => {
  try {
    const { visitId } = req.params;
    const { status, notes } = req.body;

    const visit = await prisma.visit.update({
      where: { id: parseInt(visitId) },
      data: {
        ...(status && { status }),
        ...(notes && { notes })
      },
      include: {
        patient: {
          select: { id: true, name: true }
        }
      }
    });

    res.json({ visit });
  } catch (error) {
    console.error('Error updating visit:', error);
    res.status(500).json({ error: error.message });
  }
};

// Complete visit
exports.completeVisit = async (req, res) => {
  try {
    const { visitId, diagnosis, finalNotes } = completeVisitSchema.parse(req.body);

    // Get visit with all related data
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        patient: true,
        vitals: true,
        labOrders: true,
        radiologyOrders: true,
        medicationOrders: true,
        bills: true
      }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    if (visit.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Visit already completed' });
    }

    // Create medical history snapshot
    const medicalHistoryData = {
      visitId: visit.id,
      visitUid: visit.visitUid,
      patientId: visit.patientId,
      diagnosis,
      finalNotes,
      vitals: visit.vitals,
      labOrders: visit.labOrders.map(order => ({
        id: order.id,
        type: order.type,
        result: order.result,
        status: order.status
      })),
      radiologyOrders: visit.radiologyOrders.map(order => ({
        id: order.id,
        type: order.type,
        result: order.result,
        status: order.status
      })),
      medicationOrders: visit.medicationOrders.map(order => ({
        id: order.id,
        name: order.name,
        dosageForm: order.dosageForm,
        strength: order.strength,
        quantity: order.quantity,
        frequency: order.frequency,
        duration: order.duration,
        instructions: order.instructions,
        status: order.status
      })),
      bills: visit.bills.map(bill => ({
        id: bill.id,
        total: bill.total,
        status: bill.status,
        payments: bill.payments
      })),
      completedAt: new Date(),
      completedBy: req.user.id
    };

    // Update visit status and create medical history
    await prisma.$transaction(async (tx) => {
      // Update visit
      await tx.visit.update({
        where: { id: visitId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          notes: finalNotes ? `${visit.notes || ''}\n\nFinal Notes: ${finalNotes}` : visit.notes
        }
      });

      // Create medical history
      await tx.medicalHistory.create({
        data: {
          patientId: visit.patientId,
          details: JSON.stringify(medicalHistoryData)
        }
      });

      // Update medication orders to QUEUED if they're PAID
      await tx.medicationOrder.updateMany({
        where: {
          visitId: visitId,
          status: 'PAID'
        },
        data: {
          status: 'QUEUED'
        }
      });
    });

    res.json({
      message: 'Visit completed successfully',
      visitId: visit.id,
      visitUid: visit.visitUid
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

// Get all visits for a patient
exports.getPatientVisits = async (req, res) => {
  try {
    const { patientId } = req.params;

    const visits = await prisma.visit.findMany({
      where: { patientId },
      include: {
        createdBy: {
          select: {
            id: true,
            fullname: true,
            role: true
          }
        },
        vitals: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            labOrders: true,
            radiologyOrders: true,
            medicationOrders: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ visits });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get visits by status (for different department queues)
exports.getVisitsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const userRole = req.user.role;

    let whereClause = { status };

    // Filter by user role if needed
    if (userRole === 'DOCTOR') {
      whereClause.status = 'IN_DOCTOR_QUEUE';
    } else if (userRole === 'NURSE') {
      whereClause.status = 'WAITING_FOR_TRIAGE';
    }

    const visits = await prisma.visit.findMany({
      where: whereClause,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            type: true,
            mobile: true
          }
        },
        vitals: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            labOrders: true,
            radiologyOrders: true,
            medicationOrders: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({ visits });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
