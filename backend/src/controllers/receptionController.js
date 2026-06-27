const prisma = require('../config/database');
const { z } = require('zod');
const { safeCreatePatient } = require('../utils/prismaCompat');

// Validation schemas
const createPatientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  dob: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  mobile: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  bloodType: z.enum(['A_PLUS', 'A_MINUS', 'B_PLUS', 'B_MINUS', 'AB_PLUS', 'AB_MINUS', 'O_PLUS', 'O_MINUS', 'UNKNOWN']).optional(),
  maritalStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'UNKNOWN']).optional(),
  disabilityStatus: z.enum(['VISION_LOSS', 'HEARING_LOSS', 'MOBILITY_IMPAIRMENT', 'NO_DISABILITY', 'OTHER']).optional(),
  type: z.enum(['REGULAR', 'EMERGENCY', 'VIP']).default('REGULAR'),
  insuranceId: z.string().optional(),
  nationalId: z.string().optional(),
  region: z.string().optional(),
  zone: z.string().optional(),
  woreda: z.string().optional(),
  kebele: z.string().optional()
});

const activateCardSchema = z.object({
  patientId: z.string(),
  cardType: z.string().optional(),
  notes: z.string().optional()
});

const createVisitSchema = z.object({
  patientId: z.string(),
  suggestedDoctorId: z.string().nullable().optional(),
  notes: z.string().optional(),
  queueType: z.enum(['CONSULTATION', 'RESULTS_REVIEW']).default('CONSULTATION'),
  isEmergency: z.boolean().optional().default(false)
});

const updatePatientSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  mobile: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().nullable(),
  bloodType: z.enum(['A_PLUS', 'A_MINUS', 'B_PLUS', 'B_MINUS', 'AB_PLUS', 'AB_MINUS', 'O_PLUS', 'O_MINUS', 'UNKNOWN']).optional().nullable(),
  maritalStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'UNKNOWN']).optional().nullable(),
  type: z.enum(['REGULAR', 'EMERGENCY', 'VIP', 'INSURANCE']).optional(),
  cardType: z.string().optional()
});

const getOrCreateCardService = async (purpose, cardTypeSlug) => {
  const slug = String(cardTypeSlug || 'GENERAL').trim().toUpperCase();

  const cardProduct = await prisma.cardProduct.findUnique({ where: { slug } });
  if (!cardProduct) {
    throw new Error(`Unknown card type: ${slug}`);
  }

  const code = purpose === 'REGISTRATION' ? `CARD-REG-${slug}` : `CARD-ACT-${slug}`;
  const name = purpose === 'REGISTRATION'
    ? `${cardProduct.name} Card Registration`
    : `${cardProduct.name} Card Activation`;
  const price = purpose === 'REGISTRATION' ? cardProduct.regPrice : cardProduct.actPrice;
  const description = purpose === 'REGISTRATION'
    ? `Initial ${cardProduct.name} card registration fee (first time only)`
    : `${cardProduct.name} card activation/renewal fee`;

  const existingService = await prisma.service.findUnique({
    where: { code }
  });

  if (existingService) {
    if (existingService.price !== price || !existingService.isActive || existingService.category !== 'CONSULTATION') {
      return prisma.service.update({
        where: { id: existingService.id },
        data: { price, isActive: true, category: 'CONSULTATION', name, description }
      });
    }
    return existingService;
  }

  return prisma.service.create({
    data: { code, name, category: 'CONSULTATION', price, description, isActive: true }
  });
};

// Get all patients with card status
exports.getPatients = async (req, res) => {
  try {
    const { search, cardStatus, page = 1, limit = 50 } = req.query;

    const where = {};

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (cardStatus) {
      where.cardStatus = cardStatus;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          insurance: true,
          cardActivations: {
            orderBy: { activatedAt: 'desc' },
            take: 1
          },
          visits: {
            where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
            select: { id: true, visitUid: true, status: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      }),
      prisma.patient.count({ where })
    ]);

    const patientsWithVisit = patients.map((p) => ({
      ...p,
      activeVisit: p.visits?.[0] || null,
      visits: undefined
    }));

    res.json({
      patients: patientsWithVisit,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get patient history (all visits with doctor info)
exports.getPatientHistory = async (req, res) => {
  try {
    const { patientId } = req.params;

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        cardActivations: {
          orderBy: { activatedAt: 'desc' },
          take: 5,
          include: {
            activatedBy: {
              select: { fullname: true, username: true }
            }
          }
        },
        insurance: true
      }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Get visit history with assigned doctors
    const visits = await prisma.visit.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        createdBy: {
          select: { fullname: true, username: true }
        },
        vitals: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    // Get assigned doctors for each visit through Assignment table
    // Visit has assignmentId field that links to Assignment
    const visitsWithDoctors = await Promise.all(
      visits.map(async (visit) => {
        let assignedDoctor = null;

        // If visit has assignmentId, fetch the assignment
        if (visit.assignmentId) {
          const assignment = await prisma.assignment.findUnique({
            where: { id: visit.assignmentId },
            include: {
              doctor: {
                select: { id: true, fullname: true, username: true, qualifications: true }
              }
            }
          });

          if (assignment) {
            assignedDoctor = assignment.doctor;
          }
        } else {
          // Fallback: try to find assignment by patientId (for older visits without assignmentId)
          // This is less accurate but better than nothing
          const assignment = await prisma.assignment.findFirst({
            where: {
              patientId: visit.patientId,
              status: { in: ['Pending', 'Active', 'Active'] }
            },
            orderBy: { createdAt: 'desc' },
            include: {
              doctor: {
                select: { id: true, fullname: true, username: true, qualifications: true }
              }
            }
          });

          if (assignment) {
            assignedDoctor = assignment.doctor;
          }
        }

        return {
          ...visit,
          assignedDoctor: assignedDoctor
        };
      })
    );

    res.json({
      patient,
      visits: visitsWithDoctors
    });
  } catch (error) {
    console.error('Error fetching patient history:', error);
    res.status(500).json({ error: error.message });
  }
};

// Create new patient (with card registration fee)
exports.createPatient = async (req, res) => {
  try {
    const validatedData = createPatientSchema.parse(req.body);
    const receptionistId = req.user.id;

    // Generate unique patient ID with sequential numbering
    const { generateUniquePatientId } = require('../utils/patientIdGenerator');
    const isEmergency = validatedData.type === 'EMERGENCY';

    const patient = await generateUniquePatientId(async (patientId) => {
      return await safeCreatePatient(prisma, {
        id: patientId,
        name: validatedData.name,
        dob: validatedData.dob ? new Date(validatedData.dob) : null,
        gender: validatedData.gender || null,
        type: validatedData.type,
        cardType: 'GENERAL',
        mobile: validatedData.mobile || null,
        email: validatedData.email || null,
        address: validatedData.address || null,
        region: validatedData.region || null,
        zone: validatedData.zone || null,
        woreda: validatedData.woreda || null,
        kebele: validatedData.kebele || null,
        nationalId: validatedData.nationalId || null,
        emergencyContact: validatedData.emergencyContact || null,
        bloodType: validatedData.bloodType || null,
        maritalStatus: validatedData.maritalStatus || null,
        disabilityStatus: validatedData.disabilityStatus || null,
        insuranceId: validatedData.insuranceId || null
      });
    }, prisma, isEmergency);

    // Log action
    await prisma.auditLog.create({
      data: {
        action: 'PATIENT_REGISTRATION',
        entity: 'Patient',
        entityId: parseInt(patient.id.split('-').pop()) || 0,
        userId: receptionistId,
        details: `New ${validatedData.type.toLowerCase()} patient registered: ${patient.name} (${patient.id}). No card billing - assigned at triage.`
      }
    });

    res.json({
      patient,
      message: 'Patient registered successfully.'
    });
  } catch (error) {
    console.error('Error creating patient:', error);
    if (error instanceof z.ZodError && error.errors) {
      const errorMessages = error.errors.map(err => {
        const field = err.path.join('.');
        const message = err.message;
        return `${field}: ${message}`;
      });
      return res.status(400).json({
        error: 'Validation error',
        details: errorMessages,
        message: `Please fix the following errors: ${errorMessages.join(', ')}`
      });
    }
    res.status(500).json({ error: error.message });
  }
};

// Activate card (create billing for 200 Birr activation fee)
// NOTE: For development, this is manual. In production, this will be automatic based on 30-day expiry.
exports.activateCard = async (req, res) => {
  try {
    const validatedData = activateCardSchema.parse(req.body);
    const receptionistId = req.user.id;

    // Get patient
    const patient = await prisma.patient.findUnique({
      where: { id: validatedData.patientId }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const selectedCardType = validatedData.cardType || patient.cardType || 'GENERAL';

    // Persist card type choice at reactivation so future billing categorization stays consistent.
    if (selectedCardType !== patient.cardType) {
      await prisma.patient.update({
        where: { id: patient.id },
        data: { cardType: selectedCardType }
      });
      patient.cardType = selectedCardType;
    }

    const cardActService = await getOrCreateCardService('ACTIVATION', selectedCardType);

    // Create billing for card activation (100 general / 200 dermatology)
    const billing = await prisma.billing.create({
      data: {
        patientId: patient.id,
        totalAmount: cardActService.price,
        status: 'PENDING',
        notes: validatedData.notes || `Patient card activation/renewal fee (${selectedCardType})`,
        services: {
          create: {
            serviceId: cardActService.id,
            quantity: 1,
            unitPrice: cardActService.price,
            totalPrice: cardActService.price
          }
        }
      },
      include: {
        services: {
          include: {
            service: true
          }
        }
      }
    });

    // Log action
    await prisma.auditLog.create({
      data: {
        action: 'CARD_ACTIVATION_REQUEST',
        entity: 'Patient',
        entityId: parseInt(patient.id.split('-').pop()) || 0,
        userId: receptionistId,
        details: `Card activation requested for ${patient.name} (${patient.id}) with ${selectedCardType} card type. Bill created: ${billing.id}`
      }
    });

    res.json({
      billing,
      message: `Card activation billing created successfully. Please proceed to billing for payment (${cardActService.price} Birr).`
    });
  } catch (error) {
    console.error('Error activating card:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

// Note: Manual deactivation removed - cards now deactivate automatically based on expiry date
// See server.js for automatic deactivation function

// Create visit (only if card is active)
exports.createVisit = async (req, res) => {
  try {
    const validatedData = createVisitSchema.parse(req.body);
    const receptionistId = req.user.id;

    // Check if patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: validatedData.patientId }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Check if patient already has an active visit
    const activeVisit = await prisma.visit.findFirst({
      where: {
        patientId: validatedData.patientId,
        status: {
          in: [
            'WAITING_FOR_TRIAGE',
            'TRIAGED',
            'WAITING_FOR_DOCTOR',
            'IN_DOCTOR_QUEUE',
            'UNDER_DOCTOR_REVIEW',
            'SENT_TO_LAB',
            'SENT_TO_RADIOLOGY',
            'SENT_TO_BOTH',
            'RETURNED_WITH_RESULTS',
            'AWAITING_LAB_RESULTS',
            'AWAITING_RADIOLOGY_RESULTS',
            'AWAITING_RESULTS_REVIEW',
            'WAITING_FOR_NURSE_SERVICE',
            'NURSE_SERVICES_ORDERED',
            'NURSE_SERVICES_COMPLETED',
            'DENTAL_SERVICES_ORDERED',
            'PROCEDURE_SERVICES_ORDERED',
            'PROCEDURE_SERVICES_COMPLETED',
            'SENT_TO_PHARMACY',
            'AWAITING_CARD_BILLING',
            'EMERGENCY_QUEUE',
            'IN_PROGRESS'
          ]
        }
      },
      include: {
        bills: {
          where: {
            status: {
              in: ['PENDING', 'PAID']
            }
          }
        }
      }
    });

    if (activeVisit) {
      return res.status(409).json({
        error: 'Patient already has an active visit',
        existingVisit: {
          id: activeVisit.id,
          visitUid: activeVisit.visitUid,
          status: activeVisit.status,
          createdAt: activeVisit.createdAt,
          hasPendingBilling: activeVisit.bills.some(bill => bill.status === 'PENDING')
        },
        suggestion: 'Complete the current visit before creating a new one'
      });
    }

    // Generate unique visit UID with retry logic to handle race conditions
    const { generateUniqueVisitUid } = require('../utils/visitUidGenerator');

    const visit = await generateUniqueVisitUid(async (visitUid) => {
      return await prisma.visit.create({
        data: {
          visitUid,
          patientId: patient.id,
          createdById: receptionistId,
          suggestedDoctorId: validatedData.suggestedDoctorId || null,
          notes: validatedData.notes || null,
          queueType: validatedData.queueType,
          isEmergency: validatedData.isEmergency,
          status: validatedData.isEmergency ? 'WAITING_FOR_TRIAGE' : 'WAITING_FOR_TRIAGE'
        }
      });
    }, prisma);

    // For emergency visits, create emergency billing (no consultation fee upfront)
    let billing = null;
    if (validatedData.isEmergency) {
      billing = await prisma.billing.create({
        data: {
          patientId: patient.id,
          visitId: visit.id,
          totalAmount: 0,
          status: 'EMERGENCY_PENDING',
          billingType: 'EMERGENCY',
          notes: 'Emergency visit - services will be added as needed'
        }
      });
    } else {
      // For regular visits, DO NOT create any upfront billing
      // The patient has an active card, and therefore the visit is completely free.
      billing = null;
    }

    // Log action
    await prisma.auditLog.create({
      data: {
        action: 'VISIT_CREATED',
        entity: 'Visit',
        entityId: visit.id,
        userId: receptionistId,
        details: `Visit created: ${visit.visitUid} for patient ${patient.name} (${patient.id}). ${validatedData.isEmergency ? 'EMERGENCY visit - no consultation fee required' : 'Regular visit'}. ${validatedData.suggestedDoctorId ? `Suggested doctor: ${validatedData.suggestedDoctorId}` : 'No doctor suggested'}`
      }
    });

    res.json({
      visit,
      billing,
      message: validatedData.isEmergency
        ? 'Emergency visit created successfully. No consultation fee required - services will be tracked separately.'
        : 'Visit created successfully and sent to triage.'
    });
  } catch (error) {
    console.error('Error creating visit:', error);
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => {
        const field = err.path.join('.');
        const message = err.message;
        return `${field}: ${message}`;
      });
      return res.status(400).json({
        error: 'Validation error',
        details: errorMessages,
        message: `Please fix the following errors: ${errorMessages.join(', ')}`
      });
    }
    res.status(500).json({ error: error.message });
  }
};

// Get all doctors for suggestion dropdown
exports.getDoctors = async (req, res) => {
  try {
    const doctors = await prisma.user.findMany({
      where: {
        role: 'DOCTOR',
        availability: true
      },
      select: {
        id: true,
        fullname: true,
        username: true,
        qualifications: true,
        consultationFee: true
      },
      orderBy: { fullname: 'asc' }
    });

    res.json({ doctors });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update patient details (Billing Officer, Receptionist, Admin)
exports.updatePatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const updatedById = req.user.id;

    // Preprocess: convert empty strings to null for optional fields
    const preprocessedData = { ...req.body };
    if (preprocessedData.mobile === '') preprocessedData.mobile = null;
    if (preprocessedData.email === '') preprocessedData.email = null;
    if (preprocessedData.address === '') preprocessedData.address = null;
    if (preprocessedData.emergencyContact === '') preprocessedData.emergencyContact = null;
    if (preprocessedData.dob === '') preprocessedData.dob = null;
    if (preprocessedData.gender === '') preprocessedData.gender = null;
    if (preprocessedData.bloodType === '') preprocessedData.bloodType = null;
    if (preprocessedData.maritalStatus === '') preprocessedData.maritalStatus = null;

    const validatedData = updatePatientSchema.parse(preprocessedData);

    // Check if patient exists
    const existingPatient = await prisma.patient.findUnique({
      where: { id: patientId }
    });

    if (!existingPatient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Prepare update data (only include fields that are provided)
    const updateData = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.mobile !== undefined) updateData.mobile = validatedData.mobile || null;
    if (validatedData.email !== undefined) updateData.email = validatedData.email || null;
    if (validatedData.address !== undefined) updateData.address = validatedData.address || null;
    if (validatedData.emergencyContact !== undefined) updateData.emergencyContact = validatedData.emergencyContact || null;
    if (validatedData.dob !== undefined) {
      updateData.dob = validatedData.dob ? new Date(validatedData.dob) : null;
    }
    if (validatedData.gender !== undefined) updateData.gender = validatedData.gender || null;
    if (validatedData.bloodType !== undefined) updateData.bloodType = validatedData.bloodType || null;
    if (validatedData.maritalStatus !== undefined) updateData.maritalStatus = validatedData.maritalStatus || null;
    if (validatedData.type !== undefined) updateData.type = validatedData.type;
    if (validatedData.cardType !== undefined) updateData.cardType = validatedData.cardType;

    // Update patient in database
    const updatedPatient = await prisma.patient.update({
      where: { id: patientId },
      data: updateData
    });

    // Log the update action
    try {
      await prisma.auditLog.create({
        data: {
          action: 'PATIENT_UPDATE',
          entity: 'Patient',
          entityId: parseInt(patientId.split('-').pop()) || 0,
          userId: updatedById,
          details: `Patient ${patientId} updated by ${req.user.username} (${req.user.role}). Fields updated: ${Object.keys(updateData).join(', ')}`
        }
      });
    } catch (auditError) {
      console.error('Error creating audit log:', auditError);
      // Don't fail the request if audit log fails
    }

    console.log(`✅ Patient ${patientId} updated by ${req.user.username} (${req.user.role})`);

    res.json({
      success: true,
      message: 'Patient updated successfully',
      patient: updatedPatient
    });
  } catch (error) {
    console.error('Error updating patient:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
    res.status(500).json({ error: error.message });
  }
};

// Complete a patient's active visit
exports.completePatientVisit = async (req, res) => {
  try {
    const { patientId } = req.params;
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const activeVisit = await prisma.visit.findFirst({
      where: { patientId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      orderBy: { createdAt: 'desc' }
    });
    if (!activeVisit) return res.status(400).json({ error: 'No active visit found' });

    await prisma.visit.update({
      where: { id: activeVisit.id },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });

    res.json({ message: 'Visit completed', visitId: activeVisit.id, visitUid: activeVisit.visitUid });
  } catch (error) {
    console.error('Error completing visit:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get card services for admin configuration
exports.getCardServices = async (req, res) => {
  try {
    const services = await prisma.service.findMany({
      where: {
        code: {
          in: ['CARD-REG', 'CARD-REG-DERM', 'CARD-ACT', 'CARD-ACT-DERM']
        },
        isActive: true
      },
      orderBy: { code: 'asc' }
    });

    res.json({ services });
  } catch (error) {
    console.error('Error fetching card services:', error);
    res.status(500).json({ error: error.message });
  }
};

