const prisma = require('../config/database');
const { z } = require('zod');
const { calculateGCS, calculateMEWS, calculateQSOFA } = require('../utils/triageScoring');
const { getIO } = require('../config/socket');

// ── Card helper ──────────────────────────────────────────────
const getOrCreateCardService = async (cardTypeSlug, billingType) => {
  const slug = String(cardTypeSlug || 'GENERAL').trim().toUpperCase();
  const cardProduct = await prisma.cardProduct.findUnique({ where: { slug } });
  if (!cardProduct) throw new Error(`Unknown card type: ${slug}`);
  const isRegistration = billingType === 'CARD_REGISTRATION';
  const code = isRegistration ? `CARD-REG-${slug}` : `CARD-ACT-${slug}`;
  const price = isRegistration ? cardProduct.regPrice : cardProduct.actPrice;
  const name = isRegistration ? `${cardProduct.name} Card Registration` : `${cardProduct.name} Card Activation`;
  const existing = await prisma.service.findUnique({ where: { code } });
  if (existing) {
    if (existing.price !== price || !existing.isActive) {
      return prisma.service.update({ where: { id: existing.id }, data: { price, isActive: true } });
    }
    return existing;
  }
  return prisma.service.create({
    data: { code, name, category: 'CONSULTATION', price, isActive: true },
  });
};

const checkCardRequirement = async (patientId, doctorId) => {
  const [patient, doctor] = await Promise.all([
    prisma.patient.findUnique({ where: { id: patientId } }),
    prisma.user.findUnique({ where: { id: doctorId }, select: { id: true, requiredCardType: true } }),
  ]);
  if (!patient || !doctor) return { needsCardBilling: false, reason: 'NOT_FOUND' };

  const requiredSlug = (doctor.requiredCardType || 'GENERAL').trim().toUpperCase();
  const currentSlug = (patient.cardType || 'GENERAL').trim().toUpperCase();

  // Same card type + active → no billing needed
  if (requiredSlug === currentSlug && patient.cardStatus === 'ACTIVE') {
    return { needsCardBilling: false, reason: 'SAME_CARD_ACTIVE' };
  }

  const [requiredCard, currentCard] = await Promise.all([
    prisma.cardProduct.findUnique({ where: { slug: requiredSlug } }),
    currentSlug !== requiredSlug ? prisma.cardProduct.findUnique({ where: { slug: currentSlug } }) : null,
  ]);

  if (!requiredCard) return { needsCardBilling: false, reason: 'REQUIRED_CARD_NOT_FOUND' };

  // No active card → determine if registration (first time) or activation (renewal)
  if (patient.cardStatus !== 'ACTIVE') {
    const isFirstTime = !patient.cardActivatedAt;
    return {
      needsCardBilling: true,
      billingAmount: isFirstTime ? requiredCard.regPrice : requiredCard.actPrice,
      cardProductId: requiredCard.id,
      cardProductSlug: requiredSlug,
      billingType: isFirstTime ? 'CARD_REGISTRATION' : 'CARD_ACTIVATION',
      reason: isFirstTime ? 'REGISTRATION' : 'ACTIVATION',
    };
  }

  // Active but different card → compare prices
  const currentActPrice = currentCard?.actPrice ?? 0;
  if (currentActPrice >= requiredCard.actPrice) {
    return { needsCardBilling: false, reason: 'CURRENT_CARD_SUFFICIENT' };
  }

  // Upgrade needed
  return {
    needsCardBilling: true,
    billingAmount: requiredCard.actPrice - currentActPrice,
    cardProductId: requiredCard.id,
    cardProductSlug: requiredSlug,
    billingType: 'CARD_ACTIVATION',
    reason: 'UPGRADE',
  };
};

// Validation schemas
const vitalsSchema = z.object({
  patientId: z.string(),
  visitId: z.number(),
  bloodPressure: z.string().optional(),
  temperature: z.number().optional(),
  tempUnit: z.enum(['C', 'F']).default('C'),
  heartRate: z.number().optional(),
  respirationRate: z.number().optional(),
  height: z.number().optional(),
  weight: z.number().optional(),
  oxygenSaturation: z.number().optional(),
  bloodType: z.string().optional(),
  condition: z.string().optional(),
  notes: z.string().optional(),
  painScoreRest: z.number().optional(),
  painScoreMovement: z.number().optional(),
  sedationScore: z.number().optional(),
  gcsEyes: z.number().optional(),
  gcsVerbal: z.number().optional(),
  gcsMotor: z.number().optional(),
  bloodPressureSystolic: z.number().optional(),
  bloodPressureDiastolic: z.number().optional(),
  // Additional fields from frontend
  chiefComplaint: z.string().optional(),
  historyOfPresentIllness: z.string().optional(),
  onsetOfSymptoms: z.string().optional(),
  durationOfSymptoms: z.string().optional(),
  severityOfSymptoms: z.string().optional(),
  associatedSymptoms: z.string().optional(),
  relievingFactors: z.string().optional(),
  aggravatingFactors: z.string().optional(),
  generalAppearance: z.string().optional(),
  headAndNeck: z.string().optional(),
  cardiovascularExam: z.string().optional(),
  respiratoryExam: z.string().optional(),
  abdominalExam: z.string().optional(),
  extremities: z.string().optional(),
  neurologicalExam: z.string().optional()
});

// Schema for continuous vitals (visitId is optional)
const continuousVitalsSchema = z.object({
  patientId: z.string(),
  visitId: z.number().optional(),
  bloodPressure: z.string().optional(),
  temperature: z.number().optional(),
  tempUnit: z.enum(['C', 'F']).default('C'),
  heartRate: z.number().optional(),
  respirationRate: z.number().optional(),
  height: z.number().optional(),
  weight: z.number().optional(),
  oxygenSaturation: z.number().optional(),
  bloodType: z.string().optional(),
  condition: z.string().optional(),
  notes: z.string().optional(),
  painScoreRest: z.number().optional(),
  painScoreMovement: z.number().optional(),
  sedationScore: z.number().optional(),
  gcsEyes: z.number().optional(),
  gcsVerbal: z.number().optional(),
  gcsMotor: z.number().optional(),
  bloodPressureSystolic: z.number().optional(),
  bloodPressureDiastolic: z.number().optional(),

  // Chief Complaint & History (Optional)
  chiefComplaint: z.string().optional(),
  historyOfPresentIllness: z.string().optional(),
  onsetOfSymptoms: z.string().optional(),
  durationOfSymptoms: z.string().optional(),
  severityOfSymptoms: z.string().optional(),
  associatedSymptoms: z.string().optional(),
  relievingFactors: z.string().optional(),
  aggravatingFactors: z.string().optional(),

  // Physical Examination (Optional)
  generalAppearance: z.string().optional(),
  headAndNeck: z.string().optional(),
  cardiovascularExam: z.string().optional(),
  respiratoryExam: z.string().optional(),
  abdominalExam: z.string().optional(),
  extremities: z.string().optional(),
  neurologicalExam: z.string().optional(),
});

const assignmentSchema = z.object({
  patientId: z.string(),
  visitId: z.number(),
  doctorId: z.string(),
});

const administerTaskSchema = z.object({
  taskId: z.number(),
  notes: z.string().optional(),
});

exports.recordVitals = async (req, res) => {
  try {
    const data = vitalsSchema.parse(req.body);

    // Auto-calculate BMI if height and weight are provided
    if (data.weight && data.height) {
      data.bmi = data.weight / (data.height ** 2);
    }

    // Track who recorded the vitals (NURSE or DOCTOR)
    const userRole = req.user?.role || 'NURSE';
    const recordedByRole = userRole === 'DOCTOR' ? 'DOCTOR' : 'NURSE';

    // Check if visit exists
    const visit = await prisma.visit.findUnique({
      where: { id: data.visitId }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Allow recording vitals for any visit status (including completed visits for monitoring purposes)

    // Calculate triage scores
    const gcsTotal = calculateGCS(data.gcsEyes, data.gcsVerbal, data.gcsMotor);
    const mewsScore = calculateMEWS({ ...data, gcsTotal });
    const qsofaScore = calculateQSOFA({ ...data, gcsTotal });

    // Add recordedByRole and scores to vital data
    const vitalData = {
      ...data,
      recordedByRole,
      gcsTotal,
      mewsScore,
      qsofaScore
    };

    const vital = await prisma.vitalSign.create({
      data: vitalData,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            type: true
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

    // Update patient's blood type permanently if provided
    // IMPORTANT: Only update if patient doesn't already have a blood type recorded
    // This prevents overwriting existing blood type data
    if (data.bloodType) {
      const patient = await prisma.patient.findUnique({
        where: { id: data.patientId },
        select: { bloodType: true }
      });

      // Only update if patient doesn't have a blood type or it's UNKNOWN
      if (!patient?.bloodType || patient.bloodType === 'UNKNOWN') {
        await prisma.patient.update({
          where: { id: data.patientId },
          data: { bloodType: data.bloodType }
        });
        console.log(`✅ Updated blood type for patient ${data.patientId} to ${data.bloodType}`);
      } else {
        console.log(`⚠️ Patient ${data.patientId} already has blood type ${patient.bloodType} - not overwriting`);
      }
    }

    // Create audit log (optional - don't fail if user ID is invalid)
    try {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'RECORD_VITALS',
          entity: 'VitalSign',
          entityId: vital.id,
          details: JSON.stringify({
            patientId: data.patientId,
            visitId: data.visitId,
            bloodPressure: data.bloodPressure,
            temperature: data.temperature,
            heartRate: data.heartRate,
            bloodType: data.bloodType,
            bmi: data.bmi
          }),
          ip: req.ip,
          userAgent: req.get('User-Agent')
        }
      });
    } catch (auditError) {
      console.warn('Failed to create audit log:', auditError.message);
      // Continue without failing the main operation
    }

    // Update visit status if it's WAITING_FOR_TRIAGE or TRIAGED - move to TRIAGED after vitals are recorded
    // IMPORTANT: Doctor assignment is now handled by NURSES only - doctors cannot assign themselves
    // When a doctor records vitals, the patient stays in TRIAGED status (not auto-assigned)
    if (visit.status === 'WAITING_FOR_TRIAGE' || visit.status === 'TRIAGED') {
      // Move patient to TRIAGED status - doctor assignment is done by nurses only
      await prisma.visit.update({
        where: { id: data.visitId },
        data: { status: 'TRIAGED' }
      });
      console.log('🔍 recordVitals: Updated visit status from', visit.status, 'to TRIAGED for visitId:', data.visitId);
    } else {
      console.log('🔍 recordVitals: Keeping visit status as', visit.status, 'for visitId:', data.visitId);
    }

    res.json({
      message: 'Vitals recorded successfully',
      vital
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

// Get doctors by qualification
exports.getDoctorsByQualification = async (req, res) => {
  try {
    const { qualification } = req.query;

    let whereClause = {
      role: 'DOCTOR',
      availability: true
    };

    // If qualification is specified, filter by it
    if (qualification && qualification !== 'General') {
      whereClause.qualifications = {
        has: qualification
      };
    }

    const doctors = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        fullname: true,
        username: true,
        email: true,
        qualifications: true,
        consultationFee: true
      },
      orderBy: { fullname: 'asc' }
    });

    res.json({ doctors });
  } catch (error) {
    console.error('Error fetching doctors by qualification:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.assignDoctor = async (req, res) => {
  try {
    // Assignment request
    // const { patientId, visitId, doctorId } = assignmentSchema.parse(req.body);
    const { patientId, visitId, doctorId } = req.body;

    // Check if visit exists
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: { patient: true }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // All patients must be triaged before assigning doctor
    // Allow TRIAGED, WAITING_FOR_TRIAGE, and WAITING_FOR_NURSE_SERVICE status
    // WAITING_FOR_NURSE_SERVICE is allowed because doctor can be assigned after services
    if (visit.status !== 'TRIAGED' && visit.status !== 'WAITING_FOR_TRIAGE' && visit.status !== 'WAITING_FOR_NURSE_SERVICE') {
      return res.status(400).json({ error: 'Visit must be triaged before assigning doctor' });
    }

    // Check if doctor exists and is available
    const doctor = await prisma.user.findUnique({
      where: { id: doctorId, role: 'DOCTOR', availability: true },
      select: {
        id: true,
        fullname: true,
        username: true,
        qualifications: true,
        consultationFee: true,
        waiveConsultationFee: true // Include waiver flag
      }
    });

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found or not available' });
    }

    // Check if assignment already exists
    let assignment = await prisma.assignment.findFirst({
      where: {
        patientId,
        doctorId,
        status: { in: ['Pending', 'Active'] }
      }
    });

    // Create assignment if it doesn't exist
    if (!assignment) {
      assignment = await prisma.assignment.create({
        data: {
          patientId,
          doctorId,
          status: 'Pending'
        }
      });
    } else {
      // Update existing assignment to Pending if it was completed
      assignment = await prisma.assignment.update({
        where: { id: assignment.id },
        data: { status: 'Pending' }
      });
    }

    // ─── Card check ────────────────────────────────────────────
    const cardReq = await checkCardRequirement(patientId, doctorId);

    if (cardReq.needsCardBilling) {
      // Card billing needed — create one combined billing for card + consultation
      const cardBillingType = cardReq.billingType || 'CARD_ACTIVATION';
      const cardService = await getOrCreateCardService(cardReq.cardProductSlug, cardBillingType);
      const billingServices = [{ serviceId: cardService.id, quantity: 1, unitPrice: cardReq.billingAmount, totalPrice: cardReq.billingAmount }];
      let totalAmount = cardReq.billingAmount;

      // Add consultation to same billing if not waived
      if (!doctor.waiveConsultationFee) {
        const consultationService = await prisma.service.findFirst({
          where: { category: 'CONSULTATION', name: { contains: 'Consultation', mode: 'insensitive' } },
        });
        if (consultationService) {
          const consultationPrice = doctor.consultationFee || consultationService.price;
          billingServices.push({ serviceId: consultationService.id, quantity: 1, unitPrice: consultationPrice, totalPrice: consultationPrice });
          totalAmount += consultationPrice;
        }
      }

      const cardBillingLabel = cardReq.reason === 'REGISTRATION' ? 'registration' : cardReq.reason === 'UPGRADE' ? 'upgrade' : 'activation';

      const cardBilling = await prisma.billing.create({
        data: {
          patientId, visitId,
          totalAmount, status: 'PENDING', billingType: cardBillingType,
          notes: `Card ${cardBillingLabel} — ${cardReq.cardProductSlug}`,
          services: { create: billingServices },
        },
      });

      // Update visit
      await prisma.visit.update({
        where: { id: visitId },
        data: { assignmentId: assignment.id, suggestedDoctorId: doctorId, cardProductId: cardReq.cardProductId, status: 'AWAITING_CARD_BILLING' },
      });

      console.log(`🔍 assignDoctor: Card billing needed — ${cardReq.reason}, visit ${visitId} → AWAITING_CARD_BILLING`);

      const messageMap = {
        REGISTRATION: `Patient needs a new ${cardReq.cardProductSlug} card. Card registration billing created (${cardReq.billingAmount} ETB). Patient must pay at billing counter.`,
        UPGRADE: `Doctor requires a ${cardReq.cardProductSlug} card. Upgrade billing created (${cardReq.billingAmount} ETB diff). Patient must pay at billing counter.`,
        ACTIVATION: `Patient has no active card. Card activation billing created (${cardReq.billingAmount} ETB). Patient must pay at billing counter.`,
      };

      return res.json({
        message: messageMap[cardReq.reason] || `Card billing created (${cardReq.billingAmount} ETB). Patient must pay at billing counter.`,
        assignment, billing: null,
        cardBilling: { id: cardBilling.id, totalAmount: cardBilling.totalAmount, status: cardBilling.status },
        visitStatus: 'AWAITING_CARD_BILLING',
      });
    }

    // ─── No card billing needed — normal flow ─────────────────
    console.log('🔍 assignDoctor: No card billing needed, linking assignment for visitId:', visitId);

    await prisma.visit.update({
      where: { id: visitId },
      data: { assignmentId: assignment.id, suggestedDoctorId: doctorId }
    });

    // Find consultation service
    const consultationService = await prisma.service.findFirst({
      where: { category: 'CONSULTATION', name: { contains: 'Consultation', mode: 'insensitive' } }
    });
    if (!consultationService) {
      return res.status(404).json({ error: 'Consultation service not found. Please add consultation service to the catalog.' });
    }

    // Only create billing if doctor's consultation is NOT waived
    let billing = null;
    if (!doctor.waiveConsultationFee) {
      const consultationPrice = doctor.consultationFee || consultationService.price;
      const emergencyVisit = await prisma.visit.findUnique({ where: { id: visitId } });

      if (emergencyVisit.isEmergency) {
        const { getOrCreateEmergencyBilling } = require('./emergencyController');
        const emergencyBilling = await getOrCreateEmergencyBilling(visitId);
        await prisma.billingService.create({
          data: { billingId: emergencyBilling.id, serviceId: consultationService.id, quantity: 1, unitPrice: consultationPrice, totalPrice: consultationPrice }
        });
        await prisma.billing.update({ where: { id: emergencyBilling.id }, data: { totalAmount: { increment: consultationPrice } } });
        billing = emergencyBilling;
      } else {
        billing = await prisma.billing.create({
          data: { patientId, visitId, totalAmount: consultationPrice, status: 'PENDING', notes: 'Doctor consultation fee' }
        });
        await prisma.billingService.create({
          data: { billingId: billing.id, serviceId: consultationService.id, quantity: 1, unitPrice: consultationPrice, totalPrice: consultationPrice }
        });
      }
    } else {
      console.log('🔍 assignDoctor: Doctor has waived consultation fee - skipping billing');
    }

    // Update visit status based on waived consultation
    let finalStatus = visit.status;
    if (doctor.waiveConsultationFee) {
      // Doctor waived consultation → send directly to doctor queue
      // If patient was in WAITING_FOR_NURSE_SERVICE, they can still go to doctor
      finalStatus = 'WAITING_FOR_DOCTOR';
      console.log('🔍 assignDoctor: Doctor waived consultation → WAITING_FOR_DOCTOR (from status:', visit.status, ')');
      console.log('🔍 assignDoctor: Patient will appear in doctor queue immediately');
    } else {
      // Doctor NOT waived → need billing
      // If patient was in WAITING_FOR_NURSE_SERVICE, keep them there until billing is done
      if (visit.status === 'WAITING_FOR_NURSE_SERVICE') {
        finalStatus = 'WAITING_FOR_NURSE_SERVICE'; // Keep in nurse service until billing
        console.log('🔍 assignDoctor: Doctor NOT waived, patient in WAITING_FOR_NURSE_SERVICE → keeping status');
        console.log('🔍 assignDoctor: Patient needs to pay consultation fee before appearing in doctor queue');
      } else {
        finalStatus = 'TRIAGED'; // For billing
        console.log('🔍 assignDoctor: Doctor NOT waived → TRIAGED (for billing)');
        console.log('🔍 assignDoctor: Patient needs to pay consultation fee before appearing in doctor queue');
      }
    }

    await prisma.visit.update({
      where: { id: visitId },
      data: {
        status: finalStatus,
        assignmentId: assignment.id,
        suggestedDoctorId: doctorId
      }
    });

    console.log('✅ assignDoctor: Visit updated - Status:', finalStatus, 'AssignmentId:', assignment.id, 'DoctorId:', doctorId, 'Waiver:', doctor.waiveConsultationFee);

    try {
      getIO().to('role:DOCTOR').emit('queue:new-visit', {
        visitId,
        patientId: visit.patientId,
        patientName: visit.patient?.name,
        doctorId,
        doctorName: doctor.fullname,
        status: finalStatus,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error('[WS] Failed to emit assignDoctor event:', e.message);
    }

    res.json({
      message: 'Doctor assigned successfully',
      assignment,
      billing: billing ? {
        id: billing.id,
        totalAmount: billing.totalAmount,
        status: billing.status
      } : null,
      skippedBilling: billing === null
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.getPatientQueue = async (req, res) => {
  try {
    // Include both WAITING_FOR_TRIAGE and TRIAGED patients
    // This allows patients to stay in queue even after vitals are recorded
    const queue = await prisma.visit.findMany({
      where: {
        status: { in: ['WAITING_FOR_TRIAGE', 'TRIAGED'] }
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            type: true,
            mobile: true,
            email: true,
            gender: true,
            dob: true,
            bloodType: true,
            address: true
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
      orderBy: [
        { createdAt: 'asc' } // First come, first served
      ]
    });

    res.json({ queue });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all patients currently assigned to doctors (for nurse reassignment view)
exports.getAssignedPatients = async (req, res) => {
  try {
    const visits = await prisma.visit.findMany({
      where: {
        status: { in: ['WAITING_FOR_DOCTOR', 'IN_DOCTOR_QUEUE', 'UNDER_DOCTOR_REVIEW', 'TRIAGED'] },
        suggestedDoctorId: { not: null }
      },
      include: {
        patient: {
          select: { id: true, name: true, gender: true, dob: true, type: true, mobile: true }
        },
        _count: {
          select: {
            labOrders: true,
            radiologyOrders: true,
            medicationOrders: true,
            batchOrders: true,
            labTestOrders: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get doctor names for each visit
    const doctorIds = [...new Set(visits.map(v => v.suggestedDoctorId).filter(Boolean))];
    const doctors = await prisma.user.findMany({
      where: { id: { in: doctorIds } },
      select: { id: true, fullname: true, qualifications: true }
    });
    const doctorMap = {};
    doctors.forEach(d => { doctorMap[d.id] = d; });

    const result = visits.map(v => ({
      ...v,
      doctor: doctorMap[v.suggestedDoctorId] || null,
      hasOrders: v._count.labOrders > 0 || v._count.radiologyOrders > 0 ||
        v._count.medicationOrders > 0 || v._count.batchOrders > 0 || v._count.labTestOrders > 0,
    }));

    res.json({ patients: result });
  } catch (error) {
    console.error('Error fetching assigned patients:', error);
    res.status(500).json({ error: error.message });
  }
};

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
        qualifications: true,
        consultationFee: true,
        waiveConsultationFee: true,
        requiredCardType: true
      },
      orderBy: {
        fullname: 'asc'
      }
    });

    res.json({ doctors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.markAdministered = async (req, res) => {
  try {
    const { taskId, notes } = req.body;
    const administeredById = req.user.id;

    const task = await prisma.nurseAdministration.findUnique({
      where: { id: taskId },
      include: {
        continuousInfusion: {
          include: {
            medicationOrder: {
              include: {
                patient: true
              }
            }
          }
        }
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.completed) {
      return res.status(400).json({ error: 'Task already completed' });
    }

    // Update task
    const updatedTask = await prisma.nurseAdministration.update({
      where: { id: taskId },
      data: {
        administeredById,
        administeredAt: new Date(),
        notes,
        completed: true
      },
      include: {
        administeredBy: {
          select: {
            id: true,
            fullname: true
          }
        }
      }
    });

    // Create medical history entry
    await prisma.medicalHistory.create({
      data: {
        patientId: task.continuousInfusion.medicationOrder.patientId,
        details: JSON.stringify({
          type: 'CSI_ADMINISTRATION',
          taskId: task.id,
          medication: task.continuousInfusion.medicationOrder.name,
          administeredAt: new Date(),
          administeredBy: req.user.fullname,
          notes: notes
        })
      }
    });

    res.json({
      message: 'Administration marked as completed',
      task: updatedTask
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get nurse services (for triage and walk-in)
exports.getNurseServices = async (req, res) => {
  try {
    // Get category from query parameter if provided, otherwise default to both NURSE and NURSE_WALKIN
    const categoryFilter = req.query.category;

    let categories = ['NURSE', 'NURSE_WALKIN'];
    if (categoryFilter === 'NURSE') {
      categories = ['NURSE'];
    } else if (categoryFilter === 'NURSE_WALKIN') {
      categories = ['NURSE_WALKIN'];
    }

    const services = await prisma.service.findMany({
      where: {
        category: { in: categories },
        isActive: true
      },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        price: true,
        description: true,
        isActive: true,
        isVariablePrice: true,
        minPrice: true,
        maxPrice: true
      },
      orderBy: { name: 'asc' }
    });

    res.json({ services });
  } catch (error) {
    console.error('Error fetching nurse services:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get dental services (for triage)
exports.getDentalServices = async (req, res) => {
  try {
    const services = await prisma.service.findMany({
      where: {
        category: 'DENTAL',
        isActive: true
      },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        price: true,
        unit: true,
        description: true,
        isActive: true,
        isVariablePrice: true,
        minPrice: true,
        maxPrice: true
      },
      orderBy: { name: 'asc' }
    });

    res.json({ services });
  } catch (error) {
    console.error('Error fetching dental services:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get all nurses (for triage assignment)
exports.getNurses = async (req, res) => {
  try {
    const nurses = await prisma.user.findMany({
      where: {
        role: 'NURSE',
        availability: true
      },
      select: {
        id: true,
        fullname: true,
        username: true,
        email: true,
        phone: true,
        qualifications: true,
        availability: true
      },
      orderBy: { fullname: 'asc' }
    });

    res.json({ nurses });
  } catch (error) {
    console.error('Error fetching nurses:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get daily tasks for continuous infusions
exports.getTodayTasks = async (req, res) => {
  try {
    const nurseId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch nurse service assignments with billing information (both triage and doctor ordered)
    const nurseServiceTasks = await prisma.nurseServiceAssignment.findMany({
      where: {
        assignedNurseId: nurseId,
        status: { in: ['PENDING', 'IN_PROGRESS'] }
      },
      include: {
        visit: {
          select: {
            id: true,
            visitUid: true,
            patient: {
              select: { id: true, name: true }
            }
          }
        },
        service: {
          select: { id: true, name: true, price: true, description: true, category: true }
        },
        assignedBy: {
          select: { id: true, fullname: true, role: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Group tasks by patient; keep payment visibility in the payload,
    // but do not hide assigned tasks when billing is pending/partial.
    const groupedTasks = {};

    for (const task of nurseServiceTasks) {
      const patientId = task.visit.patient.id;
      const patientName = task.visit.patient.name;

      // Check if the billing for this visit is paid
      // Find the specific billing record for nurse/dental services (not consultation or entry fees)
      const billing = await prisma.billing.findFirst({
        where: {
          visitId: task.visitId,
          services: {
            some: {
              service: {
                category: { in: ['NURSE', 'NURSE_WALKIN', 'DENTAL', 'PROCEDURE', 'OTHER'] }
              }
            }
          }
        },
        include: {
          payments: true,
          services: {
            include: {
              service: true
            }
          }
        }
      });

      const totalPayments = billing?.payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0;
      const totalAmount = billing?.totalAmount || 0;
      const isFullyPaid = billing ? (billing.status === 'PAID' || totalPayments >= totalAmount) : false;

      if (!isFullyPaid) continue;

      if (!groupedTasks[patientId]) {
        groupedTasks[patientId] = {
          patientId,
          patientName,
          visitId: task.visitId,
          visitUid: task.visit.visitUid,
          services: [],
          totalAmount: 0,
          assignedBy: task.assignedBy.fullname,
          assignedByRole: task.assignedBy.role,
          orderType: task.orderType || 'TRIAGE_ORDERED',
          createdAt: task.createdAt,
          type: 'nurseService',
          billingStatus: billing?.status || 'PENDING',
          totalPayments,
          isFullyPaid
        };
      }

      const servicePrice = task.isWaived ? 0 : (task.customPrice || task.service.price || 0);
      groupedTasks[patientId].services.push({
        id: task.id,
        serviceId: task.service.id,
        serviceName: task.service.name,
        servicePrice: servicePrice, // Show $0 if waived
        originalPrice: task.customPrice || task.service.price || 0, // Keep custom/original price for reference
        serviceDescription: task.service.description,
        serviceCategory: task.service.category, // Add category to distinguish nurse vs dental
        isWaived: task.isWaived || false, // Include waived status
        status: task.status,
        notes: task.notes,
        orderType: task.orderType || 'TRIAGE_ORDERED',
        assignedBy: task.assignedBy.fullname,
        assignedByRole: task.assignedBy.role
      });

      groupedTasks[patientId].totalAmount += servicePrice;
    }

    // Fetch continuous infusion tasks for today (any nurse can handle these)
    const continuousInfusionTasks = await prisma.nurseAdministration.findMany({
      where: {
        scheduledFor: {
          gte: today,
          lt: tomorrow
        },
        completed: false
      },
      include: {
        continuousInfusion: {
          include: {
            medicationOrder: {
              include: {
                patient: true,
                visit: {
                  select: {
                    id: true,
                    visitUid: true,
                    patient: {
                      select: { id: true, name: true }
                    }
                  }
                },
                continuousInfusion: true
              }
            }
          }
        }
      },
      orderBy: { scheduledFor: 'asc' }
    });

    // Add continuous infusion tasks to grouped tasks
    for (const task of continuousInfusionTasks) {
      const patientId = task.continuousInfusion.medicationOrder.patientId;
      const patientName = task.continuousInfusion.medicationOrder.patient.name;
      const visitId = task.continuousInfusion.medicationOrder.visitId;
      const visitUid = task.continuousInfusion.medicationOrder.visit?.visitUid;

      if (!groupedTasks[patientId]) {
        groupedTasks[patientId] = {
          patientId,
          patientName,
          visitId,
          visitUid,
          services: [],
          totalAmount: 0,
          assignedBy: 'Doctor',
          createdAt: task.continuousInfusion.createdAt,
          type: 'continuousInfusion',
          billingStatus: 'PAID', // Continuous infusions are already paid when created
          totalPayments: 0,
          isFullyPaid: true
        };
      }

      // Add continuous infusion data to medication order
      const medicationOrderWithInfusion = {
        ...task.continuousInfusion.medicationOrder,
        continuousInfusion: task.continuousInfusion
      };

      groupedTasks[patientId].services.push({
        id: task.id,
        serviceId: task.continuousInfusion.id,
        serviceName: `Continuous Infusion: ${task.continuousInfusion.medicationOrder.name}`,
        servicePrice: 0, // No additional cost for administration
        serviceDescription: `${task.continuousInfusion.dailyDose} - ${task.continuousInfusion.frequency}`,
        status: task.completed ? 'COMPLETED' : 'PENDING',
        notes: task.notes,
        scheduledFor: task.scheduledFor,
        medicationOrder: medicationOrderWithInfusion
      });
    }

    // Convert grouped tasks to array
    const allTasks = Object.values(groupedTasks);

    res.json({ tasks: allTasks });
  } catch (error) {
    console.error('Error fetching today tasks:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get nurse dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Waiting Patients - patients waiting for triage
    const waitingPatients = await prisma.visit.count({
      where: {
        status: 'WAITING_FOR_TRIAGE'
      }
    });

    // Triaged Today - visits that were triaged today
    const triagedToday = await prisma.visit.count({
      where: {
        status: {
          in: ['TRIAGED', 'WAITING_FOR_DOCTOR', 'IN_DOCTOR_QUEUE', 'UNDER_DOCTOR_REVIEW', 'NURSE_SERVICES_COMPLETED', 'AWAITING_RESULTS_REVIEW', 'COMPLETED']
        },
        updatedAt: {
          gte: today,
          lt: tomorrow
        },
        // Check if vitals were recorded today (indicating triage)
        vitals: {
          some: {
            createdAt: {
              gte: today,
              lt: tomorrow
            }
          }
        }
      }
    });

    // Pending Tasks - nurse service assignments that are pending or in progress for today
    const pendingTasks = await prisma.nurseServiceAssignment.count({
      where: {
        status: {
          in: ['PENDING', 'IN_PROGRESS']
        },
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    // Also count continuous infusion tasks that are pending
    const pendingContinuousInfusions = await prisma.nurseAdministration.count({
      where: {
        scheduledFor: {
          gte: today,
          lt: tomorrow
        },
        completed: false
      }
    });

    const totalPendingTasks = pendingTasks + pendingContinuousInfusions;

    // Completed Tasks - nurse service assignments completed today
    const completedTasks = await prisma.nurseServiceAssignment.count({
      where: {
        status: 'COMPLETED',
        updatedAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    // Also count completed continuous infusion administrations today
    const completedContinuousInfusions = await prisma.nurseAdministration.count({
      where: {
        completed: true,
        updatedAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    const totalCompletedTasks = completedTasks + completedContinuousInfusions;

    res.json({
      waitingPatients,
      triagedToday,
      pendingTasks: totalPendingTasks,
      completedTasks: totalCompletedTasks
    });
  } catch (error) {
    console.error('Error fetching nurse dashboard stats:', error);
    res.status(500).json({ error: error.message });
  }
};

// Administer medication task
exports.administerTask = async (req, res) => {
  try {
    const { taskId, notes } = administerTaskSchema.parse(req.body);
    const nurseId = req.user.id;

    const task = await prisma.nurseTask.findUnique({
      where: { id: taskId },
      include: {
        continuousInfusion: {
          include: {
            medicationOrder: {
              include: {
                visit: {
                  include: {
                    patient: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.status !== 'PENDING') {
      return res.status(400).json({ error: 'Task already completed or cancelled' });
    }

    // Update task status
    const updatedTask = await prisma.nurseTask.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        administeredBy: nurseId,
        administeredAt: new Date(),
        notes
      },
      include: {
        continuousInfusion: {
          include: {
            medicationOrder: {
              include: {
                visit: {
                  include: {
                    patient: true
                  }
                }
              }
            }
          }
        },
        administeredBy: {
          select: {
            id: true,
            fullname: true
          }
        }
      }
    });

    // Create medical history entry
    await prisma.medicalHistory.create({
      data: {
        patientId: task.continuousInfusion.medicationOrder.visit.patientId,
        details: JSON.stringify({
          type: 'MEDICATION_ADMINISTRATION',
          taskId: task.id,
          medication: task.continuousInfusion.medicationOrder.name,
          dosage: task.continuousInfusion.dailyDose,
          scheduledDate: task.scheduledDate,
          administeredAt: new Date(),
          administeredBy: req.user.fullname,
          notes
        })
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: nurseId,
        action: 'ADMINISTER_MEDICATION',
        entity: 'NurseTask',
        entityId: taskId,
        details: JSON.stringify({
          taskId,
          medication: task.continuousInfusion.medicationOrder.name,
          dosage: task.continuousInfusion.dailyDose,
          patientId: task.continuousInfusion.medicationOrder.visit.patientId,
          notes
        }),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({
      message: 'Medication administered successfully',
      task: updatedTask
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

// Record continuous vitals (not tied to a specific visit)
exports.recordContinuousVitals = async (req, res) => {
  try {
    const data = continuousVitalsSchema.parse(req.body);

    // Auto-calculate BMI if height and weight are provided
    if (data.weight && data.height) {
      data.bmi = data.weight / (data.height ** 2);
    }

    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: data.patientId }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Set visitId to null for continuous vitals
    data.visitId = null;

    const vital = await prisma.vitalSign.create({
      data,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            type: true
          }
        }
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'RECORD_CONTINUOUS_VITALS',
        entity: 'VitalSign',
        entityId: vital.id,
        details: JSON.stringify({
          patientId: data.patientId,
          bloodPressure: data.bloodPressure,
          temperature: data.temperature,
          heartRate: data.heartRate,
          bmi: data.bmi,
          type: 'continuous'
        }),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({
      message: 'Continuous vitals recorded successfully',
      vital
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

// Get all vitals for a patient (including continuous vitals)
exports.getPatientVitals = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        name: true,
        type: true,
        mobile: true,
        email: true,
        dob: true,
        gender: true
      }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Get all vitals for this patient (both visit-based and continuous)
    const vitals = await prisma.vitalSign.findMany({
      where: {
        patientId: patientId
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        visit: {
          select: {
            id: true,
            visitUid: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    res.json({
      patient,
      vitals: vitals.map(vital => ({
        id: vital.id,
        bloodPressure: vital.bloodPressure,
        bloodPressureSystolic: vital.bloodPressureSystolic,
        bloodPressureDiastolic: vital.bloodPressureDiastolic,
        temperature: vital.temperature,
        tempUnit: vital.tempUnit,
        heartRate: vital.heartRate,
        respirationRate: vital.respirationRate,
        height: vital.height,
        weight: vital.weight,
        bmi: vital.bmi,
        oxygenSaturation: vital.oxygenSaturation,
        condition: vital.condition,
        notes: vital.notes,
        painScoreRest: vital.painScoreRest,
        painScoreMovement: vital.painScoreMovement,
        sedationScore: vital.sedationScore,
        gcsEyes: vital.gcsEyes,
        gcsVerbal: vital.gcsVerbal,
        gcsMotor: vital.gcsMotor,
        chiefComplaint: vital.chiefComplaint,
        historyOfPresentIllness: vital.historyOfPresentIllness,
        onsetOfSymptoms: vital.onsetOfSymptoms,
        durationOfSymptoms: vital.durationOfSymptoms,
        severityOfSymptoms: vital.severityOfSymptoms,
        associatedSymptoms: vital.associatedSymptoms,
        relievingFactors: vital.relievingFactors,
        aggravatingFactors: vital.aggravatingFactors,
        generalAppearance: vital.generalAppearance,
        headAndNeck: vital.headAndNeck,
        cardiovascularExam: vital.cardiovascularExam,
        respiratoryExam: vital.respiratoryExam,
        abdominalExam: vital.abdominalExam,
        extremities: vital.extremities,
        neurologicalExam: vital.neurologicalExam,
        createdAt: vital.createdAt,
        updatedAt: vital.updatedAt,
        visitId: vital.visitId,
        visit: vital.visit,
        isContinuous: vital.visitId === null
      }))
    });
  } catch (error) {
    console.error('Error fetching patient vitals:', error);
    res.status(500).json({ error: error.message });
  }
};

// Assign single nurse service to a patient (legacy function)
exports.assignNurseService = async (req, res) => {
  try {
    // Nurse service assignment request
    const { patientId, visitId, serviceId, assignedNurseId, notes } = req.body;

    // Check if visit exists
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: { patient: true }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    if (visit.status !== 'TRIAGED' && visit.status !== 'WAITING_FOR_NURSE_SERVICE' && visit.status !== 'WAITING_FOR_TRIAGE') {
      return res.status(400).json({ error: 'Visit must be triaged before assigning nurse service' });
    }

    // Check if service exists, is active, and is a nurse service
    const service = await prisma.service.findUnique({
      where: { id: serviceId }
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    if (!service.isActive) {
      return res.status(400).json({ error: 'Service is not active' });
    }

    if (service.category !== 'NURSE') {
      return res.status(400).json({ error: 'Service must be a nurse service' });
    }

    // Check if assigned nurse exists and is available
    const assignedNurse = await prisma.user.findUnique({
      where: { id: assignedNurseId, role: 'NURSE', availability: true }
    });

    if (!assignedNurse) {
      return res.status(404).json({ error: 'Nurse not found or not available' });
    }

    // Create nurse service assignment
    const nurseAssignment = await prisma.nurseServiceAssignment.create({
      data: {
        visitId,
        serviceId,
        assignedNurseId,
        assignedById: req.user.id, // Current nurse who is assigning
        status: 'PENDING',
        notes
      },
      include: {
        service: true,
        assignedNurse: {
          select: {
            id: true,
            fullname: true,
            username: true
          }
        },
        assignedBy: {
          select: {
            id: true,
            fullname: true,
            username: true
          }
        }
      }
    });

    // Don't update visit status here - keep patient in triage queue
    // Status will be updated when nurse explicitly completes triage
    console.log('🔍 assignNurseService: Keeping visit status as', visit.status, 'for visitId:', visitId);

    // Create billing for nurse service
    const billing = await prisma.billing.create({
      data: {
        patientId,
        visitId,
        totalAmount: service.price,
        status: 'PENDING',
        notes: `Nurse service: ${service.name}`
      }
    });

    // Add nurse service to billing
    await prisma.billingService.create({
      data: {
        billingId: billing.id,
        serviceId: service.id,
        quantity: 1,
        unitPrice: service.price,
        totalPrice: service.price
      }
    });

    res.json({
      message: 'Nurse service assigned successfully',
      assignment: nurseAssignment,
      billing: {
        id: billing.id,
        totalAmount: billing.totalAmount,
        status: billing.status
      }
    });

  } catch (error) {
    console.error('Error assigning nurse service:', error);
    res.status(500).json({ error: error.message });
  }
};

// Assign multiple nurse services to a patient (new approach)
// Also supports dental services with quantities
exports.assignNurseServices = async (req, res) => {
  try {
    // Nurse/Dental services assignment request
    const { patientId, visitId, serviceIds, serviceQuantities, waivedServiceIds, notes } = req.body;
    let { assignedNurseId } = req.body;

    // Convert waivedServiceIds to Set for easy lookup
    const waivedServicesSet = new Set(waivedServiceIds || []);

    // Check if visit exists
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: { patient: true }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    if (visit.status !== 'TRIAGED' && visit.status !== 'WAITING_FOR_NURSE_SERVICE' && visit.status !== 'WAITING_FOR_TRIAGE') {
      return res.status(400).json({ error: 'Visit must be triaged before assigning services' });
    }

    // Check if all services exist, are active, and are either NURSE or DENTAL services
    const services = await prisma.service.findMany({
      where: {
        id: { in: serviceIds },
        category: { in: ['NURSE', 'DENTAL'] },
        isActive: true
      }
    });

    if (services.length !== serviceIds.length) {
      return res.status(404).json({ error: 'One or more services not found, inactive, or not valid (must be NURSE or DENTAL category)' });
    }

    // Create a map of serviceId -> quantity (default to 1 if not provided)
    const quantityMap = {};
    if (serviceQuantities && Array.isArray(serviceQuantities)) {
      serviceQuantities.forEach(({ serviceId, quantity }) => {
        quantityMap[serviceId] = Math.max(1, parseInt(quantity) || 1);
      });
    }
    // Default quantity to 1 for services without quantity specified
    serviceIds.forEach(serviceId => {
      if (!quantityMap[serviceId]) {
        quantityMap[serviceId] = 1;
      }
    });

    // Auto-assign current nurse if no nurse is specified
    if (!assignedNurseId) {
      assignedNurseId = req.user.id; // Use current logged-in nurse
    }

    // Check if assigned nurse exists and is available
    const assignedNurse = await prisma.user.findUnique({
      where: { id: assignedNurseId, role: 'NURSE', availability: true }
    });

    if (!assignedNurse) {
      return res.status(404).json({ error: 'Nurse not found or not available' });
    }

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Create nurse service assignments for each service
      const nurseAssignments = [];
      for (const serviceId of serviceIds) {
        const isWaived = waivedServicesSet.has(serviceId);
        const service = services.find(s => s.id === serviceId);
        const assignment = await tx.nurseServiceAssignment.create({
          data: {
            visitId,
            serviceId,
            assignedNurseId,
            assignedById: req.user.id, // Current nurse who is assigning
            status: 'PENDING',
            notes,
            isWaived: isWaived,
            waivedBy: isWaived ? req.user.id : null,
            waivedAt: isWaived ? new Date() : null
          },
          include: {
            service: true,
            assignedNurse: {
              select: {
                id: true,
                fullname: true,
                username: true
              }
            },
            assignedBy: {
              select: {
                id: true,
                fullname: true,
                username: true
              }
            }
          }
        });
        nurseAssignments.push(assignment);

        // Create audit log for waived services
        if (isWaived && service) {
          try {
            await tx.auditLog.create({
              data: {
                userId: req.user.id,
                action: 'WAIVE_SERVICE',
                entity: 'NurseServiceAssignment',
                entityId: assignment.id,
                details: JSON.stringify({
                  visitId,
                  patientId,
                  serviceId: service.id,
                  serviceName: service.name,
                  servicePrice: service.price,
                  waivedPrice: 0,
                  waivedBy: req.user.id,
                  waivedAt: new Date().toISOString()
                }),
                ip: req.ip,
                userAgent: req.get('User-Agent')
              }
            });
          } catch (auditError) {
            console.warn('Failed to create audit log for waived service:', auditError.message);
          }
        }
      }

      // Calculate total amount for all services (with quantities)
      // Waived services have price = 0
      const totalAmount = services.reduce((sum, service) => {
        const quantity = quantityMap[service.id] || 1;
        const isWaived = waivedServicesSet.has(service.id);
        const servicePrice = isWaived ? 0 : (service.price || 0);
        return sum + (servicePrice * quantity);
      }, 0);

      // Check if this is an emergency visit
      const visit = await tx.visit.findUnique({
        where: { id: visitId }
      });

      let billing = null;
      const billingServices = [];

      // Prepare billing services array (with waived services = 0)
      for (const service of services) {
        const quantity = quantityMap[service.id] || 1;
        const isWaived = waivedServicesSet.has(service.id);
        const servicePrice = isWaived ? 0 : (service.price || 0);
        billingServices.push({
          serviceId: service.id,
          quantity: quantity,
          unitPrice: servicePrice,
          totalPrice: servicePrice * quantity
        });
      }

      // Don't update visit status here - keep patient in triage queue
      // Status will be updated when nurse completes triage (on submit)
      // This allows nurse to continue adding services, dental services, or assigning doctor
      if (visit.isEmergency) {
        // For emergency patients, add nurse services to emergency billing
        // Emergency patient - Adding nurse services to emergency billing

        // Import emergency controller function
        const { getOrCreateEmergencyBilling } = require('./emergencyController');

        // Get or create emergency billing
        const emergencyBilling = await getOrCreateEmergencyBilling(visitId);

        // Add all services to emergency billing (with quantities)
        for (const serviceData of billingServices) {
          await tx.billingService.create({
            data: {
              billingId: emergencyBilling.id,
              ...serviceData
            }
          });
        }

        // Update emergency billing total
        await tx.billing.update({
          where: { id: emergencyBilling.id },
          data: {
            totalAmount: {
              increment: totalAmount
            }
          }
        });

        billing = emergencyBilling;
        // Nurse services added to emergency billing
      } else {
        // Check for existing PENDING billing for this visit
        const existingBilling = await tx.billing.findFirst({
          where: {
            visitId: visitId,
            status: 'PENDING'
          },
          include: {
            services: {
              include: {
                service: true
              }
            }
          }
        });

        if (existingBilling) {
          // Merge with existing billing
          // Merging services into existing billing

          // Add new services to existing billing
          for (const serviceData of billingServices) {
            // Check if service already exists in billing
            const existingService = existingBilling.services.find(
              bs => bs.serviceId === serviceData.serviceId
            );

            if (existingService) {
              // Update quantity and total for existing service
              await tx.billingService.update({
                where: {
                  billingId_serviceId: {
                    billingId: existingBilling.id,
                    serviceId: serviceData.serviceId
                  }
                },
                data: {
                  quantity: existingService.quantity + serviceData.quantity,
                  totalPrice: existingService.totalPrice + serviceData.totalPrice
                }
              });
            } else {
              // Create new billing service
              await tx.billingService.create({
                data: {
                  billingId: existingBilling.id,
                  ...serviceData
                }
              });
            }
          }

          // Update billing total and notes
          const serviceNames = services.map(s => {
            const qty = quantityMap[s.id] || 1;
            return qty > 1 ? `${s.name} (×${qty})` : s.name;
          }).join(', ');

          const updatedNotes = existingBilling.notes
            ? `${existingBilling.notes} + ${serviceNames}`
            : `Services: ${serviceNames}`;

          billing = await tx.billing.update({
            where: { id: existingBilling.id },
            data: {
              totalAmount: {
                increment: totalAmount
              },
              notes: updatedNotes
            }
          });

          // Services merged into existing billing
        } else {
          // No existing billing - create new one
          billing = await tx.billing.create({
            data: {
              patientId,
              visitId,
              totalAmount,
              status: 'PENDING',
              notes: `Services: ${services.map(s => {
                const qty = quantityMap[s.id] || 1;
                return qty > 1 ? `${s.name} (×${qty})` : s.name;
              }).join(', ')}`
            }
          });

          // Add all services to the single billing entry (with quantities)
          for (const serviceData of billingServices) {
            await tx.billingService.create({
              data: {
                billingId: billing.id,
                ...serviceData
              }
            });
          }
        }
      }

      // Determine final visit status based on waived services
      // If all services are waived, send to nurse daily tasks
      // Otherwise, keep in TRIAGED for billing
      let finalStatus = visit.status;

      if (totalAmount === 0) {
        // All services waived → send to nurse daily tasks
        finalStatus = 'WAITING_FOR_NURSE_SERVICE';
        console.log('🔍 assignNurseServices: All services waived → WAITING_FOR_NURSE_SERVICE');
      } else {
        // Some services NOT waived → keep in TRIAGED for billing
        finalStatus = 'TRIAGED';
        console.log('🔍 assignNurseServices: Some services NOT waived → TRIAGED (for billing)');
      }

      // Update visit status
      await tx.visit.update({
        where: { id: visitId },
        data: { status: finalStatus }
      });

      console.log('🔍 assignNurseServices: Updated visit status to', finalStatus, 'for visitId:', visitId);

      return { nurseAssignments, billing };
    });

    res.json({
      message: `${serviceIds.length} nurse service(s) assigned successfully`,
      assignments: result.nurseAssignments,
      billing: result.billing ? {
        id: result.billing.id,
        totalAmount: result.billing.totalAmount,
        status: result.billing.status
      } : null,
      skippedBilling: !result.billing
    });

  } catch (error) {
    console.error('Error assigning nurse service:', error);
    res.status(500).json({ error: error.message });
  }
};

// Combined assignment: nurse services + doctor assignment in one transaction
// Also supports dental services with quantities
exports.assignCombined = async (req, res) => {
  try {
    // Combined assignment request
    const { patientId, visitId, serviceIds, serviceQuantities, waivedServiceIds, doctorId, notes } = req.body;
    let { assignedNurseId } = req.body;

    // Convert waivedServiceIds to Set for easy lookup
    const waivedServicesSet = new Set(waivedServiceIds || []);

    // Check if visit exists
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: { patient: true }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    if (visit.status !== 'TRIAGED' && visit.status !== 'WAITING_FOR_NURSE_SERVICE' && visit.status !== 'WAITING_FOR_TRIAGE') {
      return res.status(400).json({ error: `Visit must be triaged before assignment. Current status: ${visit.status}` });
    }

    // ─── Card check (runs before transaction) ─────────────────
    if (doctorId) {
      const cardReq = await checkCardRequirement(patientId, doctorId);
      if (cardReq.needsCardBilling) {
      const cardBillingType = cardReq.billingType || 'CARD_ACTIVATION';
        const cardService = await getOrCreateCardService(cardReq.cardProductSlug, cardBillingType);
        const billingServices = [{ serviceId: cardService.id, quantity: 1, unitPrice: cardReq.billingAmount, totalPrice: cardReq.billingAmount }];
        let totalAmount = cardReq.billingAmount;

        // Check if doctor charges consultation — include in same billing
        const doctor = await prisma.user.findUnique({ where: { id: doctorId } });
        if (doctor && !doctor.waiveConsultationFee) {
          const consultationService = await prisma.service.findFirst({
            where: { category: 'CONSULTATION', name: { contains: 'Consultation', mode: 'insensitive' } },
          });
          if (consultationService) {
            const consultationPrice = doctor.consultationFee || consultationService.price;
            billingServices.push({ serviceId: consultationService.id, quantity: 1, unitPrice: consultationPrice, totalPrice: consultationPrice });
            totalAmount += consultationPrice;
          }
        }

        const cardBillingLabel = cardReq.reason === 'REGISTRATION' ? 'registration' : cardReq.reason === 'UPGRADE' ? 'upgrade' : 'activation';

        const cardBilling = await prisma.billing.create({
          data: {
            patientId, visitId,
            totalAmount, status: 'PENDING', billingType: cardBillingType,
            notes: `Card ${cardBillingLabel} — ${cardReq.cardProductSlug}`,
            services: { create: billingServices },
          },
        });

        const bareAssignment = await prisma.assignment.create({ data: { patientId, doctorId, status: 'Pending' } });

        await prisma.visit.update({
          where: { id: visitId },
          data: { assignmentId: bareAssignment.id, suggestedDoctorId: doctorId, cardProductId: cardReq.cardProductId, status: 'AWAITING_CARD_BILLING' },
        });

        console.log(`🔍 assignCombined: Card billing needed — ${cardReq.reason}, visit ${visitId} → AWAITING_CARD_BILLING`);

        const messageMap = {
          REGISTRATION: `Patient needs a new ${cardReq.cardProductSlug} card. Card registration billing created (${cardReq.billingAmount} ETB).`,
          UPGRADE: `Doctor requires a ${cardReq.cardProductSlug} card. Upgrade billing created (${cardReq.billingAmount} ETB diff).`,
          ACTIVATION: `Patient has no active card. Card activation billing created (${cardReq.billingAmount} ETB).`,
        };

        return res.json({
          message: messageMap[cardReq.reason] || `Card billing created (${cardReq.billingAmount} ETB).`,
          assignments: [bareAssignment], billing: null,
          cardBilling: { id: cardBilling.id, totalAmount: cardBilling.totalAmount, status: cardBilling.status },
          visitStatus: 'AWAITING_CARD_BILLING',
        });
      }
    }

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      const assignments = [];
      const billingServices = [];
      let totalAmount = 0;

      // Handle nurse services if provided
      if (serviceIds && serviceIds.length > 0) {
        // Auto-assign current nurse if no nurse is specified
        if (!assignedNurseId) {
          assignedNurseId = req.user.id; // Use current logged-in nurse
        }

        // Check if all services exist and are either NURSE or DENTAL services
        const services = await tx.service.findMany({
          where: {
            id: { in: serviceIds },
            category: { in: ['NURSE', 'DENTAL'] }
          }
        });

        if (services.length !== serviceIds.length) {
          throw new Error('One or more services not found or not valid (must be NURSE or DENTAL category)');
        }

        // Create a map of serviceId -> quantity (default to 1 if not provided)
        const quantityMap = {};
        if (serviceQuantities && Array.isArray(serviceQuantities)) {
          serviceQuantities.forEach(({ serviceId, quantity }) => {
            quantityMap[serviceId] = Math.max(1, parseInt(quantity) || 1);
          });
        }
        // Default quantity to 1 for services without quantity specified
        serviceIds.forEach(serviceId => {
          if (!quantityMap[serviceId]) {
            quantityMap[serviceId] = 1;
          }
        });

        // Check if assigned nurse exists and is available
        const assignedNurse = await tx.user.findUnique({
          where: { id: assignedNurseId, role: 'NURSE', availability: true }
        });

        if (!assignedNurse) {
          throw new Error('Nurse not found or not available');
        }

        // Create nurse service assignments for each service
        for (const serviceId of serviceIds) {
          const isWaived = waivedServicesSet.has(serviceId);
          const service = services.find(s => s.id === serviceId);
          const assignment = await tx.nurseServiceAssignment.create({
            data: {
              visitId,
              serviceId,
              assignedNurseId,
              assignedById: req.user.id, // Current nurse who is assigning
              status: 'PENDING',
              notes,
              isWaived: isWaived,
              waivedBy: isWaived ? req.user.id : null,
              waivedAt: isWaived ? new Date() : null
            },
            include: {
              service: true,
              assignedNurse: {
                select: {
                  id: true,
                  fullname: true,
                  username: true
                }
              },
              assignedBy: {
                select: {
                  id: true,
                  fullname: true,
                  username: true
                }
              }
            }
          });
          assignments.push(assignment);

          // Create audit log for waived services
          if (isWaived && service) {
            try {
              await tx.auditLog.create({
                data: {
                  userId: req.user.id,
                  action: 'WAIVE_SERVICE',
                  entity: 'NurseServiceAssignment',
                  entityId: assignment.id,
                  details: JSON.stringify({
                    visitId,
                    patientId,
                    serviceId: service.id,
                    serviceName: service.name,
                    servicePrice: service.price,
                    waivedPrice: 0,
                    waivedBy: req.user.id,
                    waivedAt: new Date().toISOString()
                  }),
                  ip: req.ip,
                  userAgent: req.get('User-Agent')
                }
              });
            } catch (auditError) {
              console.warn('Failed to create audit log for waived service:', auditError.message);
            }
          }

          // Add to billing services (with quantities)
          // If waived, price is 0
          const quantity = quantityMap[serviceId] || 1;
          const servicePrice = isWaived ? 0 : (service.price || 0);
          billingServices.push({
            serviceId: service.id,
            quantity: quantity,
            unitPrice: servicePrice,
            totalPrice: servicePrice * quantity
          });
          totalAmount += servicePrice * quantity;
        }
      }

      // Handle doctor assignment if provided
      if (doctorId) {
        // Check if doctor exists and is available
        const doctor = await tx.user.findUnique({
          where: { id: doctorId, role: 'DOCTOR', availability: true }
        });

        if (!doctor) {
          throw new Error('Doctor not found or not available');
        }

        // Create doctor assignment
        const doctorAssignment = await tx.assignment.create({
          data: {
            patientId,
            doctorId,
            status: 'Pending'
          },
          include: {
            doctor: {
              select: {
                id: true,
                fullname: true,
                username: true,
                qualifications: true,
                consultationFee: true,
                waiveConsultationFee: true // Include waiver flag
              }
            },
            patient: {
              select: {
                id: true,
                name: true,
                dob: true,
                gender: true,
                mobile: true
              }
            }
          }
        });
        assignments.push(doctorAssignment);

        // Only add consultation fee if doctor's consultation is NOT waived
        if (!doctor.waiveConsultationFee) {
          // Find consultation service
          const consultationService = await tx.service.findFirst({
            where: {
              category: 'CONSULTATION',
              name: { contains: 'Consultation', mode: 'insensitive' }
            }
          });

          if (!consultationService) {
            throw new Error('Consultation service not found. Please add consultation service to the catalog.');
          }

          // Add consultation to billing services
          const consultationPrice = doctor.consultationFee || consultationService.price;
          billingServices.push({
            serviceId: consultationService.id,
            quantity: 1,
            unitPrice: consultationPrice,
            totalPrice: consultationPrice
          });
          totalAmount += consultationPrice;
        } else {
          // Doctor has waived consultation fee - skipping billing
        }
      }

      // Check if this is an emergency visit
      const visit = await tx.visit.findUnique({
        where: { id: visitId }
      });

      let billing = null;

      // Create billing only if there's an amount to bill
      if (totalAmount > 0) {

        // Create billing for non-waived services
        if (visit.isEmergency) {
          // For emergency patients, add all services to emergency billing
          // Emergency patient - Adding combined services to emergency billing

          // Import emergency controller function
          const { getOrCreateEmergencyBilling } = require('./emergencyController');

          // Get or create emergency billing
          const emergencyBilling = await getOrCreateEmergencyBilling(visitId);

          // Add all services to emergency billing
          for (const serviceData of billingServices) {
            await tx.billingService.create({
              data: {
                billingId: emergencyBilling.id,
                ...serviceData
              }
            });
          }

          // Update emergency billing total
          await tx.billing.update({
            where: { id: emergencyBilling.id },
            data: {
              totalAmount: {
                increment: totalAmount
              }
            }
          });

          billing = emergencyBilling;
          // Combined services added to emergency billing
        } else {
          // Check for existing PENDING billing for this visit
          const existingBilling = await tx.billing.findFirst({
            where: {
              visitId: visitId,
              status: 'PENDING'
            },
            include: {
              services: {
                include: {
                  service: true
                }
              }
            }
          });

          if (existingBilling) {
            // Merge with existing billing
            // Merging combined services into existing billing

            // Add new services to existing billing
            for (const serviceData of billingServices) {
              // Check if service already exists in billing
              const existingService = existingBilling.services.find(
                bs => bs.serviceId === serviceData.serviceId
              );

              if (existingService) {
                // Update quantity and total for existing service
                await tx.billingService.update({
                  where: {
                    billingId_serviceId: {
                      billingId: existingBilling.id,
                      serviceId: serviceData.serviceId
                    }
                  },
                  data: {
                    quantity: existingService.quantity + serviceData.quantity,
                    totalPrice: existingService.totalPrice + serviceData.totalPrice
                  }
                });
              } else {
                // Create new billing service
                await tx.billingService.create({
                  data: {
                    billingId: existingBilling.id,
                    ...serviceData
                  }
                });
              }
            }

            // Update billing total and notes
            const serviceNotes = `Combined assignment: ${serviceIds?.length ? `${serviceIds.length} service(s)` : ''}${serviceIds?.length && doctorId ? ' + ' : ''}${doctorId ? 'doctor consultation' : ''}`;
            const updatedNotes = existingBilling.notes
              ? `${existingBilling.notes} + ${serviceNotes}`
              : serviceNotes;

            billing = await tx.billing.update({
              where: { id: existingBilling.id },
              data: {
                totalAmount: {
                  increment: totalAmount
                },
                notes: updatedNotes
              }
            });

            // Combined services merged into existing billing
          } else {
            // No existing billing - create new one
            billing = await tx.billing.create({
              data: {
                patientId,
                visitId,
                totalAmount,
                status: 'PENDING',
                notes: `Combined assignment: ${serviceIds?.length ? `${serviceIds.length} service(s)` : ''}${serviceIds?.length && doctorId ? ' + ' : ''}${doctorId ? 'doctor consultation' : ''}`
              }
            });

            // Add all services to the single billing entry
            for (const serviceData of billingServices) {
              await tx.billingService.create({
                data: {
                  billingId: billing.id,
                  ...serviceData
                }
              });
            }
          }
        }
      }

      // Determine final visit status based on waived services and doctor waiver
      let finalStatus = visit.status; // Default: keep current status

      // Check if all services are waived
      const allServicesWaived = totalAmount === 0;

      // Get doctor info if assigned
      const doctorAssignment = assignments.find(a => a.doctor);
      const doctorHasWaiver = doctorAssignment?.doctor?.waiveConsultationFee || false;

      console.log('🔍 assignCombined: Determining final status - totalAmount:', totalAmount, 'allServicesWaived:', allServicesWaived, 'doctorId:', doctorId, 'doctorHasWaiver:', doctorHasWaiver);

      if (allServicesWaived && !doctorId) {
        // All services waived + no doctor → send to nurse daily tasks
        finalStatus = 'WAITING_FOR_NURSE_SERVICE';
        console.log('🔍 assignCombined: Scenario 1 - All services waived, no doctor → WAITING_FOR_NURSE_SERVICE');
      } else if (allServicesWaived && doctorId && doctorHasWaiver) {
        // All services waived + doctor assigned + doctor waived → send to doctor queue AND nurse daily tasks
        finalStatus = 'WAITING_FOR_DOCTOR';
        console.log('🔍 assignCombined: Scenario 2A - All services waived + doctor waived → WAITING_FOR_DOCTOR');
        console.log('🔍 assignCombined: Patient will appear in doctor queue AND nurse daily tasks');
      } else if (allServicesWaived && doctorId && !doctorHasWaiver) {
        // All services waived + doctor assigned + doctor NOT waived → need billing for consultation
        finalStatus = 'TRIAGED';
        console.log('🔍 assignCombined: Scenario 2B - All services waived + doctor NOT waived → TRIAGED (for billing)');
      } else {
        // Some services NOT waived → need billing
        finalStatus = 'TRIAGED';
        console.log('🔍 assignCombined: Scenario 3 - Some services NOT waived → TRIAGED (for billing)');
      }

      // Update visit status and link doctor assignment
      const updateData = {
        status: finalStatus,
        ...(doctorId && doctorAssignment ? {
          suggestedDoctorId: doctorId,
          assignmentId: doctorAssignment.id
        } : {})
      };

      await tx.visit.update({
        where: { id: visitId },
        data: updateData
      });

      console.log('🔍 assignCombined: Updated visit status to', finalStatus, 'for visitId:', visitId);

      return { assignments, billing };
    });

    res.json({
      message: 'Combined assignment completed successfully',
      assignments: result.assignments,
      billing: result.billing ? {
        id: result.billing.id,
        totalAmount: result.billing.totalAmount,
        status: result.billing.status
      } : null,
      skippedBilling: result.billing === null
    });

  } catch (error) {
    console.error('Error in combined assignment:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get nurse daily tasks (nurse service assignments)
exports.getNurseDailyTasks = async (req, res) => {
  try {
    const nurseId = req.user.id;

    const tasks = await prisma.nurseServiceAssignment.findMany({
      where: {
        assignedNurseId: nurseId,
        status: { in: ['PENDING', 'IN_PROGRESS'] }
      },
      include: {
        visit: {
          include: {
            patient: {
              select: {
                id: true,
                name: true,
                dob: true,
                gender: true,
                mobile: true
              }
            }
          }
        },
        service: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            code: true
          }
        },
        assignedBy: {
          select: {
            id: true,
            fullname: true,
            username: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({ tasks });
  } catch (error) {
    console.error('Error fetching nurse daily tasks:', error);
    res.status(500).json({ error: error.message });
  }
};

// Complete nurse service
exports.completeNurseService = async (req, res) => {
  try {
    const { assignmentId, notes } = req.body;
    const nurseId = req.user.id;

    console.log('🔍 completeNurseService: Starting completion for assignmentId:', assignmentId, 'nurseId:', nurseId);

    // Get current user data
    const currentUser = await prisma.user.findUnique({
      where: { id: nurseId },
      select: { id: true, fullname: true, role: true, username: true }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if assignment exists
    const assignment = await prisma.nurseServiceAssignment.findUnique({
      where: {
        id: assignmentId
      },
      include: {
        visit: {
          include: {
            patient: true
          }
        },
        service: true
      }
    });

    if (!assignment) {
      console.log('❌ completeNurseService: Assignment not found:', assignmentId);
      return res.status(404).json({ error: 'Assignment not found' });
    }

    console.log('🔍 completeNurseService: Assignment found, visitId:', assignment.visitId, 'current status:', assignment.status);

    // Verify assignment belongs to current nurse
    if (assignment.assignedNurseId !== nurseId) {
      console.log('❌ completeNurseService: Assignment does not belong to nurse. assignedNurseId:', assignment.assignedNurseId, 'current nurseId:', nurseId);
      return res.status(403).json({ error: 'You are not assigned to this service' });
    }

    // Verify assignment is in correct status
    if (!['PENDING', 'IN_PROGRESS'].includes(assignment.status)) {
      console.log('❌ completeNurseService: Assignment already completed. Status:', assignment.status);
      return res.status(400).json({ error: 'Assignment is already completed or cancelled' });
    }

    // Update assignment status
    await prisma.nurseServiceAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        notes: notes || assignment.notes
      }
    });

    // Check if all nurse services for this visit are completed
    const remainingServices = await prisma.nurseServiceAssignment.count({
      where: {
        visitId: assignment.visitId,
        status: { in: ['PENDING', 'IN_PROGRESS'] }
      }
    });

    // Check if there's a doctor assigned to this visit
    // First check if visit has assignmentId, then find assignment by patientId
    const visit = await prisma.visit.findUnique({
      where: { id: assignment.visitId },
      select: {
        id: true,
        patientId: true,
        assignmentId: true,
        suggestedDoctorId: true
      }
    });

    let doctorAssignment = null;
    if (visit?.assignmentId) {
      // Visit has an assignment linked
      doctorAssignment = await prisma.assignment.findUnique({
        where: { id: visit.assignmentId },
        include: {
          doctor: {
            select: {
              id: true,
              waiveConsultationFee: true
            }
          }
        }
      });
    } else if (visit?.suggestedDoctorId) {
      // Visit has suggested doctor but no assignment yet - find or create assignment
      doctorAssignment = await prisma.assignment.findFirst({
        where: {
          patientId: visit.patientId,
          doctorId: visit.suggestedDoctorId,
          status: { in: ['Pending', 'Active'] }
        },
        include: {
          doctor: {
            select: {
              id: true,
              waiveConsultationFee: true
            }
          }
        }
      });
    }

    // Get visit to check current status and assignmentId
    const visitWithAssignment = await prisma.visit.findUnique({
      where: { id: assignment.visitId },
      select: {
        id: true,
        status: true,
        assignmentId: true
      }
    });

    let newVisitStatus;
    if (remainingServices === 0) {
      // All nurse/dental services completed
      if (doctorAssignment) {
        // Doctor is assigned - send patient to doctor's queue
        newVisitStatus = 'WAITING_FOR_DOCTOR';
      } else {
        // No doctor assigned - complete the visit
        newVisitStatus = 'COMPLETED';
      }
    } else {
      // Some nurse/dental services still pending - keep current status
      newVisitStatus = visitWithAssignment?.status || 'WAITING_FOR_NURSE_SERVICE';
    }

    // Update visit status (link assignment if sending to doctor)
    const updateData = {
      status: newVisitStatus,
      ...(newVisitStatus === 'COMPLETED' && { completedAt: new Date() })
    };

    // If sending to doctor and assignmentId not set, link it
    if (newVisitStatus === 'WAITING_FOR_DOCTOR' && doctorAssignment && !visitWithAssignment?.assignmentId) {
      updateData.assignmentId = doctorAssignment.id;
    }

    console.log('🔍 completeNurseService: Updating visit status from', visitWithAssignment?.status, 'to', newVisitStatus, 'for visitId:', assignment.visitId);

    await prisma.visit.update({
      where: { id: assignment.visitId },
      data: updateData
    });

    console.log('✅ completeNurseService: Visit status updated successfully');

    // Add to patient history
    try {
      await prisma.medicalHistory.create({
        data: {
          patientId: assignment.visit.patientId,
          visitId: assignment.visitId,
          doctorId: null, // Don't set doctorId for nurse services
          visitUid: assignment.visit.visitUid,
          visitDate: assignment.visit.date,
          completedDate: new Date(),
          details: JSON.stringify({
            serviceType: 'NURSE_SERVICE',
            serviceName: assignment.service.name,
            serviceCode: assignment.service.code,
            servicePrice: assignment.service.price,
            serviceDescription: assignment.service.description,
            completedBy: currentUser.fullname || currentUser.username,
            completedByRole: currentUser.role,
            notes: notes || assignment.notes,
            completedAt: new Date()
          }),
          diagnosis: `Nurse Service: ${assignment.service.name}`,
          diagnosisDetails: assignment.service.description,
          instructions: notes || assignment.notes
        }
      });
      console.log('✅ completeNurseService: Medical history created successfully');
    } catch (historyError) {
      console.error('⚠️ completeNurseService: Error creating medical history:', historyError.message);
      // Don't fail the whole operation if history creation fails
    }

    res.json({
      message: 'Nurse service completed successfully',
      assignment: {
        id: assignment.id,
        serviceName: assignment.service.name,
        patientName: assignment.visit.patient.name,
        completedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error completing nurse service:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get walk-in nurse service orders (paid orders for nurse queue)
exports.getWalkInNurseOrders = async (req, res) => {
  try {
    const nurseId = req.user?.id;
    const statusFilter = String(req.query?.status || 'PAID').toUpperCase();
    const allowedStatuses = ['PAID', 'COMPLETED', 'ALL'];
    const effectiveStatus = allowedStatuses.includes(statusFilter) ? statusFilter : 'PAID';

    const where = {};

    if (effectiveStatus === 'PAID') {
      where.status = 'PAID';
      where.OR = [
        { nurseId: null },
        ...(nurseId ? [{ nurseId }] : [])
      ];
    } else if (effectiveStatus === 'COMPLETED') {
      where.status = 'COMPLETED';
      // Completed list should show the current nurse's completed work.
      where.nurseId = nurseId || '__NO_USER__';
    } else {
      where.OR = [
        {
          status: 'PAID',
          OR: [
            { nurseId: null },
            ...(nurseId ? [{ nurseId }] : [])
          ]
        },
        {
          status: 'COMPLETED',
          nurseId: nurseId || '__NO_USER__'
        }
      ];
    }

    const orders = await prisma.nurseWalkInOrder.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            mobile: true,
            type: true
          }
        },
        service: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            code: true
          }
        },
        nurse: {
          select: {
            id: true,
            fullname: true,
            username: true
          }
        }
      },
      orderBy: [
        { completedAt: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.json({ orders, status: effectiveStatus });
  } catch (error) {
    console.error('Error fetching walk-in nurse orders:', error);
    res.status(500).json({ error: error.message });
  }
};

// Complete walk-in nurse service order
exports.completeWalkInNurseOrder = async (req, res) => {
  try {
    const { orderId, notes } = req.body;
    const nurseId = req.user.id;

    // Get the order
    const order = await prisma.nurseWalkInOrder.findUnique({
      where: { id: orderId },
      include: {
        patient: true,
        service: true
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Walk-in order not found' });
    }

    if (order.status !== 'PAID') {
      return res.status(400).json({ error: 'Order must be paid before completion' });
    }

    // Attribute completion to the nurse who actually completed the work.
    const updatedOrder = await prisma.nurseWalkInOrder.update({
      where: { id: orderId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        nurseId,
        notes: notes || order.notes
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            mobile: true
          }
        },
        service: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true
          }
        },
        nurse: {
          select: {
            id: true,
            fullname: true,
            username: true
          }
        }
      }
    });

    res.json({
      message: 'Walk-in nurse service order completed successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Error completing walk-in nurse order:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete a nurse service assignment (only if PENDING and not paid)
exports.deleteServiceAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    // Convert to integer (handle string IDs from frontend)
    const assignmentId = parseInt(id, 10);
    if (isNaN(assignmentId)) {
      return res.status(400).json({ error: 'Invalid assignment ID' });
    }

    // Find the assignment
    const assignment = await prisma.nurseServiceAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        service: true
      }
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Only allow deletion of PENDING assignments
    if (assignment.status !== 'PENDING') {
      return res.status(400).json({ error: 'Can only delete pending assignments' });
    }

    // Delete the assignment
    await prisma.nurseServiceAssignment.delete({
      where: { id }
    });

    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Error deleting service assignment:', error);
    res.status(500).json({ error: error.message });
  }
};

// ── Nurse reassigns patient to another doctor (only if no orders placed) ──
exports.reassignDoctor = async (req, res) => {
  try {
    const { visitId, patientId, toDoctorId, reason } = req.body;
    const nurseId = req.user.id;

    if (!visitId || !patientId || !toDoctorId) {
      return res.status(400).json({ error: 'visitId, patientId, and toDoctorId are required' });
    }

    // Fetch visit, new doctor, and nurse
    const [visit, toDoctor, nurse] = await Promise.all([
      prisma.visit.findUnique({
        where: { id: visitId },
        include: { patient: true }
      }),
      prisma.user.findUnique({ where: { id: toDoctorId } }),
      prisma.user.findUnique({ where: { id: nurseId } }),
    ]);

    if (!visit) return res.status(404).json({ error: 'Visit not found' });
    if (!toDoctor) return res.status(404).json({ error: 'Target doctor not found' });

    const currentDoctorId = visit.suggestedDoctorId;

    // Get current doctor name for messaging
    let currentDoctorName = 'Unknown';
    if (currentDoctorId) {
      const currentDoctor = await prisma.user.findUnique({ where: { id: currentDoctorId } });
      if (currentDoctor) currentDoctorName = currentDoctor.fullname;
    }

    // Check for existing orders placed by the current doctor on this visit
    const [
      medicationCount,
      labOrderCount,
      radiologyOrderCount,
      batchOrderCount,
      compoundCount,
      pathologyCount,
      labTestOrderCount
    ] = await Promise.all([
      prisma.medicationOrder.count({ where: { visitId } }),
      prisma.labOrder.count({ where: { visitId } }),
      prisma.radiologyOrder.count({ where: { visitId } }),
      prisma.batchOrder.count({ where: { visitId } }),
      prisma.compoundPrescription.count({ where: { visitId } }),
      prisma.pathologyReport.count({ where: { visitId } }),
      prisma.labTestOrder.count({ where: { visitId } }),
    ]);

    const hasOrders = medicationCount > 0 || labOrderCount > 0 || radiologyOrderCount > 0 ||
      batchOrderCount > 0 || compoundCount > 0 || pathologyCount > 0 || labTestOrderCount > 0;

    if (hasOrders) {
      return res.status(400).json({
        error: `Orders have already been placed by Dr. ${currentDoctorName}. Cannot reassign.`
      });
    }

    // No orders — safe to reassign
    // Create a PatientTransfer record for audit
    const transfer = await prisma.patientTransfer.create({
      data: {
        patientId,
        fromDoctorId: currentDoctorId || 'unknown',
        toDoctorId,
        visitId,
        reason: reason ? `Reassigned by nurse ${nurse?.fullname || nurseId}: ${reason}` : `Reassigned by nurse ${nurse?.fullname || nurseId}`,
        paymentRequired: false,
        paymentAmount: 0,
        status: 'ACCEPTED',
      }
    });

    // Update the visit's suggestedDoctorId
    await prisma.visit.update({
      where: { id: visitId },
      data: {
        suggestedDoctorId: toDoctorId,
        status: 'WAITING_FOR_DOCTOR',
      }
    });

    // Check if an Assignment record exists for this patient+visit, update or create
    const existingAssignment = await prisma.assignment.findFirst({
      where: { patientId, doctorId: currentDoctorId || undefined }
    });

    if (existingAssignment) {
      await prisma.assignment.update({
        where: { id: existingAssignment.id },
        data: { doctorId: toDoctorId }
      });
    }

    // Notify doctors via socket
    try {
      const io = getIO();
      if (io) {
        // Notify old doctor (patient removed from their queue)
        if (currentDoctorId) {
          io.to(`doctor:${currentDoctorId}`).emit('queue:visit-removed', { visitId, patientId });
        }
        // Notify new doctor
        io.to(`doctor:${toDoctorId}`).emit('queue:new-visit', {
          visitId,
          patientId,
          patientName: visit.patient?.name,
          doctorId: toDoctorId,
          doctorName: toDoctor.fullname,
          status: 'WAITING_FOR_DOCTOR',
          timestamp: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error('Socket notification error (non-fatal):', e.message);
    }

    res.json({
      message: `Patient reassigned to Dr. ${toDoctor.fullname}`,
      transfer,
      visitId,
    });
  } catch (error) {
    console.error('Error reassigning doctor:', error);
    res.status(500).json({ error: error.message });
  }
};
