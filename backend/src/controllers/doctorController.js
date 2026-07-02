const prisma = require('../config/database');
const { z } = require('zod');
const { checkMedicationOrderingAllowed } = require('../utils/investigationUtils');
const { getIO } = require('../config/socket');

// Doctor roles that have unrestricted access to patient data
const DOCTOR_ROLES = ['DOCTOR', 'HEALTH_OFFICER', 'DERMATOLOGY'];

// Get all services (for doctors to order)
exports.getAllServices = async (req, res) => {
  try {
    const { category, isActive } = req.query;

    let whereClause = {};
    if (category) {
      whereClause.category = category;
    }
    if (isActive !== undefined) {
      whereClause.isActive = isActive === 'true';
    } else {
      whereClause.isActive = true; // Default to active services only
    }

    const services = await prisma.service.findMany({
      where: whereClause,
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        price: true,
        description: true,
        unit: true,
        isActive: true,
        isVariablePrice: true,
        minPrice: true,
        maxPrice: true
      },
      orderBy: { name: 'asc' }
    });

    res.json({ success: true, services });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: error.message });
  }
};

// Validation schemas
const labOrderSchema = z.object({
  visitId: z.number(),
  patientId: z.string(),
  typeId: z.number(),
  instructions: z.string().optional(),
});

const multipleLabOrdersSchema = z.object({
  visitId: z.number(),
  patientId: z.string(),
  orders: z.array(z.object({
    typeId: z.number(),
    instructions: z.string().optional(),
  })).min(1, 'At least one order is required'),
});

const radiologyOrderSchema = z.object({
  visitId: z.number(),
  patientId: z.string(),
  typeId: z.number(),
  instructions: z.string().optional(),
});

const createMultipleRadiologyOrdersSchema = z.object({
  visitId: z.number(),
  patientId: z.string(),
  orders: z.array(z.object({
    typeId: z.number(),
    instructions: z.string().optional(),
  })).min(1, 'At least one radiology order is required'),
});


const externalDiagnosticOrderSchema = z.object({
  type: z.enum(['LAB', 'RADIOLOGY']),
  requestedByName: z.string().trim().min(1, 'Requested by is required').max(255),
  examinations: z.array(z.string().trim().min(1, 'Examination name is required').max(255)).min(1, 'At least one examination is required'),
  relevantClinicalData: z.string().trim().max(5000).nullish(),
  diagnosis: z.string().trim().max(5000).nullish()
});

const medicationOrderSchema = z.object({
  visitId: z.number(),
  patientId: z.string(),
  name: z.string(),
  genericName: z.string().nullish(),
  normalizedName: z.string().nullish(),
  dosageFormCategory: z.string().nullish(),
  dosageForm: z.string(),
  strength: z.string(),
  strengthText: z.string().nullish(),
  instructionText: z.string().nullish(),
  quantity: z.string().nullish(),
  quantityNumeric: z.number().nullish(),
  calculatedQuantity: z.number().nullish(),
  finalQuantity: z.number().nullish(),
  quantityOverridden: z.boolean().nullish(),
  unit: z.string().nullish(),
  frequencyType: z.string().nullish(),
  frequencyValue: z.number().nullish(),
  frequencyUnit: z.string().nullish(),
  frequencyText: z.string().nullish(),
  frequency: z.string().nullish(),
  frequencyPeriod: z.string().nullish(),
  duration: z.string().nullish(),
  durationValue: z.number().nullish(),
  durationUnit: z.string().nullish(),
  durationText: z.string().nullish(),
  durationPeriod: z.string().nullish(),
  routeCode: z.string().nullish(),
  route: z.string().nullish(),
  instructions: z.string().nullish(),
  additionalNotes: z.string().nullish(),
  category: z.string().nullish(),
  rxnormCode: z.string().nullish(),
  atcCode: z.string().nullish(),
  snomedCode: z.string().nullish(),
  isContinuousInfusion: z.boolean().nullish(),
  continuousInfusionDays: z.number().nullish(),
  dailyDose: z.string().nullish(),
  isDeferred: z.boolean().nullish(),
});

const selectVisitSchema = z.object({
  visitId: z.number(),
});

const updateVisitSchema = z.object({
  diagnosis: z.string().optional(),
  diagnosisDetails: z.string().optional(),
  instructions: z.string().optional(),
});

const completeVisitSchema = z.object({
  visitId: z.number(),
  diagnosis: z.string().optional(), // Will be extracted from diagnosis notes
  diagnosisDetails: z.string().optional(), // Rich text diagnosis details
  instructions: z.string().optional(), // Patient instructions
  finalNotes: z.string().optional(),
  countAsMedicalTreated: z.boolean().optional(),
  needsAppointment: z.boolean().optional(),
  appointmentDate: z.string().optional(),
  appointmentTime: z.string().optional(),
  appointmentNotes: z.string().optional(),
});


const normalizeExternalOrderText = (value) => {
  const trimmed = String(value || '').trim();
  return trimmed || null;
};

const normalizeExternalOrderExaminations = (items = []) => {
  return items
    .map((item) => String(item || '').trim())
    .filter(Boolean);
};

const serializeExternalDiagnosticOrder = (order) => ({
  ...order,
  examinations: Array.isArray(order?.examinations) ? order.examinations : []
});

const getAccessibleVisitForExternalOrder = async (visitId, doctorId) => {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: {
      id: true,
      patientId: true,
      status: true,
      suggestedDoctorId: true,
      assignmentId: true,
      batchOrders: {
        where: { doctorId },
        select: { id: true }
      },
      labTestOrders: {
        where: { doctorId },
        select: { id: true }
      }
    }
  });

  if (!visit) {
    return null;
  }

  const assignment = await prisma.assignment.findFirst({
    where: {
      patientId: visit.patientId,
      doctorId,
      status: {
        in: ['Active', 'Pending']
      }
    },
    select: { id: true }
  });

  const hasAccess = Boolean(assignment) || visit.suggestedDoctorId === doctorId || visit.batchOrders.length > 0 || visit.labTestOrders.length > 0;
  if (!hasAccess) {
    return false;
  }

  return visit;
};

const rejectReadonlyExternalOrderVisit = (visit, res) => {
  if (!visit) {
    res.status(404).json({ error: 'Visit not found' });
    return true;
  }

  if (['COMPLETED', 'CANCELLED'].includes(visit.status)) {
    res.status(400).json({ error: 'Completed or cancelled visits are read-only. Open an active visit to place new orders.' });
    return true;
  }

  return false;
};

exports.createExternalDiagnosticOrder = async (req, res) => {
  try {
    const visitId = parseInt(req.params.visitId, 10);
    if (!visitId) {
      return res.status(400).json({ error: 'Invalid visit id' });
    }

    const parsed = externalDiagnosticOrderSchema.parse(req.body);
    const visit = await getAccessibleVisitForExternalOrder(visitId, req.user.id);

    if (visit === null) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    if (!visit) {
      return res.status(403).json({ error: 'Access denied to this visit' });
    }

    if (rejectReadonlyExternalOrderVisit(visit, res)) {
      return;
    }

    const createdOrder = await prisma.externalDiagnosticOrder.create({
      data: {
        visitId,
        patientId: visit.patientId,
        doctorId: req.user.id,
        requestedByName: parsed.requestedByName,
        type: parsed.type,
        examinations: normalizeExternalOrderExaminations(parsed.examinations),
        relevantClinicalData: normalizeExternalOrderText(parsed.relevantClinicalData),
        diagnosis: normalizeExternalOrderText(parsed.diagnosis)
      },
      include: {
        doctor: {
          select: {
            id: true,
            fullname: true,
            role: true,
            qualifications: true
          }
        }
      }
    });

    return res.status(201).json({
      success: true,
      order: serializeExternalDiagnosticOrder(createdOrder)
    });
  } catch (error) {
    console.error('Error creating external diagnostic order:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors?.[0]?.message || 'Invalid external diagnostic order data' });
    }
    return res.status(500).json({ error: error.message || 'Failed to create external diagnostic order' });
  }
};

exports.updateExternalDiagnosticOrder = async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (!orderId) {
      return res.status(400).json({ error: 'Invalid external diagnostic order id' });
    }

    const parsed = externalDiagnosticOrderSchema.parse(req.body);
    const existingOrder = await prisma.externalDiagnosticOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        visitId: true
      }
    });

    if (!existingOrder) {
      return res.status(404).json({ error: 'External diagnostic order not found' });
    }

    const visit = await getAccessibleVisitForExternalOrder(existingOrder.visitId, req.user.id);
    if (visit === null) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    if (!visit) {
      return res.status(403).json({ error: 'Access denied to this visit' });
    }

    if (rejectReadonlyExternalOrderVisit(visit, res)) {
      return;
    }

    const updatedOrder = await prisma.externalDiagnosticOrder.update({
      where: { id: orderId },
      data: {
        requestedByName: parsed.requestedByName,
        examinations: normalizeExternalOrderExaminations(parsed.examinations),
        relevantClinicalData: normalizeExternalOrderText(parsed.relevantClinicalData),
        diagnosis: normalizeExternalOrderText(parsed.diagnosis)
      },
      include: {
        doctor: {
          select: {
            id: true,
            fullname: true,
            role: true,
            qualifications: true
          }
        }
      }
    });

    return res.json({
      success: true,
      order: serializeExternalDiagnosticOrder(updatedOrder)
    });
  } catch (error) {
    console.error('Error updating external diagnostic order:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors?.[0]?.message || 'Invalid external diagnostic order data' });
    }
    return res.status(500).json({ error: error.message || 'Failed to update external diagnostic order' });
  }
};

exports.deleteExternalDiagnosticOrder = async (req, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (!orderId) {
      return res.status(400).json({ error: 'Invalid external diagnostic order id' });
    }

    const existingOrder = await prisma.externalDiagnosticOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        visitId: true
      }
    });

    if (!existingOrder) {
      return res.status(404).json({ error: 'External diagnostic order not found' });
    }

    const visit = await getAccessibleVisitForExternalOrder(existingOrder.visitId, req.user.id);
    if (visit === null) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    if (!visit) {
      return res.status(403).json({ error: 'Access denied to this visit' });
    }

    if (rejectReadonlyExternalOrderVisit(visit, res)) {
      return;
    }

    await prisma.externalDiagnosticOrder.delete({
      where: { id: orderId }
    });

    return res.json({
      success: true,
      message: 'External diagnostic order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting external diagnostic order:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete external diagnostic order' });
  }
};

exports.getInvestigationTypes = async (req, res) => {
  try {
    const investigationTypes = await prisma.investigationType.findMany({
      where: {
        isActive: true,
        OR: [
          { serviceId: null },
          { service: { isActive: true } }
        ]
      },
      include: {
        service: true
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });

    res.json({ investigationTypes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getQueue = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { filter } = req.query; // Optional filter: 'all', 'waiting', 'in_review', 'sent_to_billing', etc.

    // Get visits assigned to this doctor
    // Include ALL statuses except COMPLETED and CANCELLED
    // Patient stays in queue until main "Complete Visit" button is clicked
    const statusFilter = {
      notIn: ['COMPLETED', 'CANCELLED']
    };

    // Apply specific filter if provided
    if (filter) {
      switch (filter) {
        case 'waiting':
          statusFilter.in = ['WAITING_FOR_DOCTOR', 'IN_DOCTOR_QUEUE', 'NURSE_SERVICES_COMPLETED', 'PROCEDURE_SERVICES_COMPLETED'];
          break;
        case 'in_review':
          statusFilter.in = ['UNDER_DOCTOR_REVIEW', 'AWAITING_RESULTS_REVIEW'];
          break;
        case 'sent_to_billing':
          statusFilter.in = ['DENTAL_SERVICES_ORDERED', 'PROCEDURE_SERVICES_ORDERED', 'SENT_TO_LAB', 'SENT_TO_RADIOLOGY', 'SENT_TO_BOTH', 'SENT_TO_PHARMACY', 'NURSE_SERVICES_ORDERED'];
          break;
        case 'awaiting_results':
          statusFilter.in = ['AWAITING_LAB_RESULTS', 'AWAITING_RADIOLOGY_RESULTS', 'RETURNED_WITH_RESULTS'];
          break;
        case 'all':
        default:
          // Use notIn filter (already set above)
          break;
      }
    }

    // Build the where clause - we'll filter for payment/waiver in JavaScript
    // This allows us to check for waived consultation fees properly
    const whereClause = {
      status: statusFilter,
      assignmentId: {
        not: null
      }
    };

    const queue = await prisma.visit.findMany({
      where: whereClause,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            type: true,
            age: true,
            mobile: true,
            email: true,
            dob: true,
            gender: true,
            bloodType: true
          }
        },
        vitals: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        },
        batchOrders: {
          include: {
            services: {
              include: {
                service: true,
                investigationType: true
              }
            }
          }
        },
        medicationOrders: {
          include: {
            continuousInfusion: true
          }
        },
        bills: {
          include: {
            services: {
              include: {
                service: true
              }
            }
          }
        }
      },
      orderBy: [{ createdAt: 'asc' }]
    });

    const filteredQueue = queue.filter(visit => {
      // Never show patients who haven't paid for card registration
      if (visit.status === 'AWAITING_CARD_BILLING') {
        console.log(`🔍 Visit ${visit.id} (status: AWAITING_CARD_BILLING) EXCLUDED - card not paid`);
        return false;
      }

      const isInDoctorQueue = visit.status === 'IN_DOCTOR_QUEUE';

      // Check if consultation is paid
      const hasPaidConsultation = visit.bills && visit.bills.some(bill =>
        bill.status === 'PAID' &&
        bill.services &&
        bill.services.some(bs => bs.service && bs.service.category === 'CONSULTATION')
      );

      // Check if doctor has waived consultation fee
      const doctorHasWaiver = visit.assignment?.doctor?.waiveConsultationFee || false;

      // Include if: paid consultation OR in doctor queue OR doctor has waiver
      const shouldInclude = hasPaidConsultation || isInDoctorQueue || doctorHasWaiver;

      if (!shouldInclude) {
        console.log(`🔍 Visit ${visit.id} (status: ${visit.status}, assignmentId: ${visit.assignmentId}) EXCLUDED - no paid consultation (${hasPaidConsultation}), not IN_DOCTOR_QUEUE (${isInDoctorQueue}), and no waiver (${doctorHasWaiver})`);
        if (visit.assignment) {
          console.log(`   Assignment found: doctorId=${visit.assignment.doctorId}, waiver=${visit.assignment.doctor?.waiveConsultationFee}`);
        } else {
          console.log(`   No assignment found for visit ${visit.id}`);
        }
      } else {
        console.log(`✅ Visit ${visit.id} (status: ${visit.status}) INCLUDED - paid: ${hasPaidConsultation}, IN_DOCTOR_QUEUE: ${isInDoctorQueue}, waiver: ${doctorHasWaiver}`);
      }

      return shouldInclude;
    });

    console.log(`✅ getQueue: Returning ${filteredQueue.length} visits (from ${queue.length} total) for doctor ${doctorId}`);

    res.json({ queue: filteredQueue });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getResultsQueue = async (req, res) => {
  try {
    const doctorId = req.user.id;
    console.log('🔍 getResultsQueue - Doctor ID:', doctorId);

    // Get visits assigned to this doctor that have results ready for review
    const resultsQueue = await prisma.visit.findMany({
      where: {
        status: 'AWAITING_RESULTS_REVIEW',
        queueType: 'RESULTS_REVIEW',
        OR: [
          { assignmentId: { not: null } },
          { batchOrders: { some: { doctorId: doctorId } } }
        ]
      },
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
        vitals: {
          orderBy: { createdAt: 'desc' }
        },
        labOrders: {
          include: {
            type: true,
            labResults: {
              include: {
                testType: true,
                attachments: true
              }
            }
          }
        },
        radiologyOrders: {
          include: {
            type: true,
            radiologyResults: {
              include: {
                testType: true,
                attachments: true
              }
            }
          }
        },
        batchOrders: {
          include: {
            services: {
              include: {
                service: true,
                investigationType: true
              }
            },
            attachments: true
          }
        },
        medicationOrders: {
          include: {
            continuousInfusion: true
          }
        },
        bills: {
          include: {
            services: {
              include: {
                service: true
              }
            },
            payments: true
          }
        }
      },
      orderBy: [
        { createdAt: 'asc' } // First come, first served
      ]
    });

    // Add result type labels and include radiology/lab results for each visit
    const queueWithLabels = await Promise.all(resultsQueue.map(async (visit) => {
      let resultLabels = [];

      if (visit.labOrders.some(order => order.labResults.length > 0)) {
        resultLabels.push('Lab Results Available');
      }

      if (visit.radiologyOrders.some(order => order.radiologyResults.length > 0)) {
        resultLabels.push('Radiology Results Available');
      }

      if (visit.batchOrders.some(order => order.status === 'COMPLETED')) {
        resultLabels.push('Batch Results Available');
      }

      // Add radiology and lab results to batch orders
      const batchOrdersWithResults = await Promise.all(visit.batchOrders.map(async (batchOrder) => {
        let radiologyResults = [];
        let labResults = [];

        if (batchOrder.type === 'RADIOLOGY') {
          radiologyResults = await prisma.radiologyResult.findMany({
            where: { batchOrderId: batchOrder.id },
            include: {
              testType: true,
              attachments: true
            }
          });

          // Also add batch order level results if individual results don't exist
          if (radiologyResults.length === 0 && batchOrder.result) {
            radiologyResults.push({
              id: `batch-${batchOrder.id}`,
              testType: { name: 'Radiology Tests' },
              resultText: batchOrder.result,
              additionalNotes: batchOrder.additionalNotes || '',
              status: batchOrder.status,
              attachments: batchOrder.attachments || [],
              createdAt: batchOrder.updatedAt || batchOrder.createdAt
            });
          }
        }

        if (batchOrder.type === 'LAB') {
          // Get detailed lab results from DetailedLabResult table
          const detailedLabResults = await prisma.detailedLabResult.findMany({
            where: {
              labOrderId: batchOrder.id
            },
            include: {
              template: true
            },
            orderBy: { createdAt: 'desc' }
          });

          // Group results by service for better organization
          const resultsByService = {};
          detailedLabResults.forEach(result => {
            const serviceKey = result.serviceId || 'unknown';
            if (!resultsByService[serviceKey]) {
              resultsByService[serviceKey] = [];
            }
            resultsByService[serviceKey].push(result);
          });

          // Convert detailed lab results to the expected format, grouped by service
          Object.keys(resultsByService).forEach(serviceId => {
            const serviceResults = resultsByService[serviceId];
            serviceResults.forEach(result => {
              // Get service name from batch order services
              const service = batchOrder.services.find(s => s.id === parseInt(serviceId));
              const serviceName = service ? service.service.name : 'Unknown Service';

              labResults.push({
                id: result.id,
                serviceId: result.serviceId,
                serviceName: serviceName,
                testType: {
                  name: result.template.name,
                  category: result.template.category
                },
                resultText: `Detailed results for ${result.template.name}`,
                detailedResults: result.results, // Include the actual detailed results
                additionalNotes: result.additionalNotes || '',
                status: result.status,
                attachments: [], // Detailed lab results don't have separate attachments
                createdAt: result.createdAt,
                verifiedBy: result.verifiedBy,
                verifiedAt: result.verifiedAt,
                template: result.template
              });
            });
          });

          // If no detailed results, fall back to batch order result
          if (labResults.length === 0) {
            labResults.push({
              id: `batch-${batchOrder.id}`,
              testType: { name: 'Lab Tests' },
              resultText: batchOrder.result || 'No result provided',
              additionalNotes: batchOrder.additionalNotes || '',
              status: batchOrder.status,
              attachments: batchOrder.attachments || [],
              createdAt: batchOrder.updatedAt || batchOrder.createdAt,
              services: batchOrder.services.map(service => ({
                name: service.investigationType?.name || service.service?.name || 'Test',
                result: service.result || 'No result'
              }))
            });
          }
        }

        return {
          ...batchOrder,
          radiologyResults,
          labResults
        };
      }));

      return {
        ...visit,
        batchOrders: batchOrdersWithResults,
        resultLabels
      };
    }));

    // Filter to only show visits assigned to this doctor
    const doctorAssignments = await prisma.assignment.findMany({
      where: {
        doctorId: doctorId,
        status: {
          in: ['Active', 'Pending']
        }
      },
      select: { id: true }
    });

    console.log('🔍 Doctor assignments:', doctorAssignments);
    console.log('🔍 Raw results queue count:', resultsQueue.length);

    const assignmentIds = doctorAssignments.map(a => a.id);
    const filteredQueue = queueWithLabels.filter(visit =>
      assignmentIds.includes(visit.assignmentId)
    );

    console.log('🔍 Filtered queue count:', filteredQueue.length);
    console.log('🔍 Assignment IDs:', assignmentIds);

    res.json({ queue: filteredQueue });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all doctors' queue status for load balancing
exports.getDoctorsQueueStatus = async (req, res) => {
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
        consultationFee: true
      }
    });

    const doctorsWithQueueCount = await Promise.all(
      doctors.map(async (doctor) => {
        // Get assignment IDs for this doctor
        const assignments = await prisma.assignment.findMany({
          where: {
            doctorId: doctor.id
          },
          select: {
            id: true,
            status: true
          }
        });

        const assignmentIds = assignments.map(a => a.id);
        const pendingAssignments = assignments.filter(a => a.status === 'Pending').length;

        // Count all active visits for this doctor (excluding completed and cancelled)
        const activeVisits = await prisma.visit.count({
          where: {
            assignmentId: {
              in: assignmentIds
            },
            status: {
              notIn: ['COMPLETED', 'CANCELLED']
            }
          }
        });

        // Count visits in progress for this doctor
        const inProgressVisits = await prisma.visit.count({
          where: {
            assignmentId: {
              in: assignmentIds
            },
            status: 'UNDER_DOCTOR_REVIEW'
          }
        });

        // Count visits awaiting results for this doctor
        const awaitingResultsCount = await prisma.visit.count({
          where: {
            assignmentId: {
              in: assignmentIds
            },
            status: 'AWAITING_RESULTS_REVIEW'
          }
        });

        // Count visits waiting for doctor (new patients)
        const waitingForDoctor = await prisma.visit.count({
          where: {
            assignmentId: {
              in: assignmentIds
            },
            status: {
              in: ['WAITING_FOR_DOCTOR', 'IN_DOCTOR_QUEUE', 'NURSE_SERVICES_COMPLETED']
            }
          }
        });

        return {
          ...doctor,
          queueCount: waitingForDoctor + inProgressVisits,
          newPatientsCount: waitingForDoctor,
          resultsCount: awaitingResultsCount,
          totalWorkload: activeVisits
        };
      })
    );

    // Sort by workload (ascending - least busy first)
    doctorsWithQueueCount.sort((a, b) => a.totalWorkload - b.totalWorkload);

    res.json({
      doctors: doctorsWithQueueCount,
      totalPatients: doctorsWithQueueCount.reduce((sum, doc) => sum + doc.totalWorkload, 0),
      averageWorkload: doctorsWithQueueCount.length > 0
        ? Math.round(doctorsWithQueueCount.reduce((sum, doc) => sum + doc.totalWorkload, 0) / doctorsWithQueueCount.length)
        : 0
    });
  } catch (error) {
    console.error('Error fetching doctors queue status:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get doctor dashboard stats - matches unified queue logic
exports.getDashboardStats = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get doctor assignments (same as unified queue)
    const doctorAssignments = await prisma.assignment.findMany({
      where: { doctorId },
      select: { id: true }
    });
    const assignmentIds = doctorAssignments.map(a => a.id);

    // Get all visits that would appear in main queue (excluding sent/returned statuses)
    const sentStatuses = ['SENT_TO_LAB', 'SENT_TO_RADIOLOGY', 'SENT_TO_BOTH', 'NURSE_SERVICES_ORDERED'];
    const returnedStatuses = ['RETURNED_WITH_RESULTS', 'AWAITING_RESULTS_REVIEW'];

    const mainQueueVisits = await prisma.visit.findMany({
      where: {
        status: {
          notIn: ['COMPLETED', 'CANCELLED', ...sentStatuses, ...returnedStatuses]
        },
        AND: [
          {
            OR: [
              { assignmentId: { in: assignmentIds } },
              { batchOrders: { some: { doctorId: doctorId } } },
              {
                AND: [
                  { status: 'IN_DOCTOR_QUEUE' },
                  { suggestedDoctorId: doctorId }
                ]
              }
            ]
          }
        ]
      },
      include: {
        bills: {
          include: {
            services: {
              include: {
                service: true
              }
            }
          }
        }
      }
    });

    // Fetch assignments separately and map them to visits
    const visitAssignmentIds = mainQueueVisits
      .map(v => v.assignmentId)
      .filter(id => id !== null);

    let assignmentMap = {};
    if (visitAssignmentIds.length > 0) {
      const assignments = await prisma.assignment.findMany({
        where: { id: { in: visitAssignmentIds } },
        include: {
          doctor: {
            select: {
              id: true,
              waiveConsultationFee: true
            }
          }
        }
      });

      assignments.forEach(a => {
        assignmentMap[a.id] = a;
      });
    }

    // Also fetch assignments for IN_DOCTOR_QUEUE visits that might not have assignmentId set
    const inDoctorQueueVisitsWithoutAssignment = mainQueueVisits.filter(
      v => v.status === 'IN_DOCTOR_QUEUE' && !v.assignmentId
    );
    const patientIdsForINDoctorQueue = inDoctorQueueVisitsWithoutAssignment.map(v => v.patientId);

    if (patientIdsForINDoctorQueue.length > 0) {
      const additionalAssignments = await prisma.assignment.findMany({
        where: {
          patientId: { in: patientIdsForINDoctorQueue },
          doctorId: doctorId
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

      // Map by patientId
      const patientAssignmentMap = {};
      additionalAssignments.forEach(a => {
        if (!patientAssignmentMap[a.patientId]) {
          patientAssignmentMap[a.patientId] = a;
        }
      });

      // Add to assignmentMap
      additionalAssignments.forEach(a => {
        assignmentMap[`patient_${a.patientId}`] = a;
      });
    }

    // Map assignments to visits
    const visitsWithAssignments = mainQueueVisits.map(visit => {
      let assignment = null;
      if (visit.assignmentId) {
        assignment = assignmentMap[visit.assignmentId] || null;
      } else if (visit.status === 'IN_DOCTOR_QUEUE') {
        // For IN_DOCTOR_QUEUE visits without assignmentId, check patient assignment
        assignment = assignmentMap[`patient_${visit.patientId}`] || null;
      }
      return {
        ...visit,
        assignment: assignment
      };
    });

    // Filter using same logic as unified queue
    const waitingPatients = visitsWithAssignments.filter(visit => {
      // Never show patients who haven't paid for card registration
      if (visit.status === 'AWAITING_CARD_BILLING') return false;

      // Emergency patients always included
      if (visit.isEmergency) return true;

      // IN_DOCTOR_QUEUE status always included
      if (visit.status === 'IN_DOCTOR_QUEUE') return true;

      // Check if consultation is paid
      const hasPaidConsultation = visit.bills && visit.bills.some(bill =>
        bill.status === 'PAID' &&
        bill.services &&
        bill.services.some(bs => bs.service && bs.service.category === 'CONSULTATION')
      );

      // Check if doctor has waived consultation
      const doctorHasWaiver = visit.assignment?.doctor?.waiveConsultationFee || false;

      return hasPaidConsultation || doctorHasWaiver;
    }).length;

    // Completed Today - visits completed today by this doctor
    const completedVisits = await prisma.visit.count({
      where: {
        OR: [
          { assignmentId: { in: assignmentIds } },
          { batchOrders: { some: { doctorId: doctorId } } }
        ],
        status: 'COMPLETED',
        completedAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    // Pending Orders - lab/radiology orders pending for this doctor's visits
    // Get all visits for this doctor first
    const doctorVisits = await prisma.visit.findMany({
      where: {
        OR: [
          { assignmentId: { in: assignmentIds } },
          { batchOrders: { some: { doctorId: doctorId } } }
        ]
      },
      select: { id: true }
    });
    const visitIds = doctorVisits.map(v => v.id);

    const pendingLabOrders = await prisma.labOrder.count({
      where: {
        visitId: { in: visitIds },
        status: {
          in: ['UNPAID', 'PAID', 'QUEUED', 'IN_PROGRESS']
        }
      }
    });

    const pendingRadiologyOrders = await prisma.radiologyOrder.count({
      where: {
        visitId: { in: visitIds },
        status: {
          in: ['UNPAID', 'PAID', 'QUEUED', 'IN_PROGRESS']
        }
      }
    });

    // Also count batch orders that are pending
    const pendingBatchOrders = await prisma.batchOrder.count({
      where: {
        doctorId: doctorId,
        status: {
          in: ['UNPAID', 'PAID', 'QUEUED', 'IN_PROGRESS']
        }
      }
    });

    const pendingOrders = pendingLabOrders + pendingRadiologyOrders + pendingBatchOrders;

    // Today's Appointments - appointments scheduled for today
    const todayAppointments = await prisma.appointment.count({
      where: {
        doctorId,
        appointmentDate: {
          gte: today,
          lt: tomorrow
        },
        status: {
          in: ['SCHEDULED', 'ARRIVED', 'IN_PROGRESS']
        }
      }
    });

    res.json({
      waitingPatients,
      completedVisits,
      pendingOrders,
      todayAppointments
    });
  } catch (error) {
    console.error('Error fetching doctor dashboard stats:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get recent activity for doctor
exports.getRecentActivity = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    // Get assignment IDs for this doctor
    const assignments = await prisma.assignment.findMany({
      where: { doctorId },
      select: { id: true }
    });
    const assignmentIds = assignments.map(a => a.id);

    // Get recent visits
    const recentVisits = await prisma.visit.findMany({
      where: {
        assignmentId: { in: assignmentIds }
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: limit
    });

    // Get recent appointments
    const recentAppointments = await prisma.appointment.findMany({
      where: { doctorId },
      include: {
        patient: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: limit
    });

    // Get recent lab orders
    const recentLabOrders = await prisma.labOrder.findMany({
      where: {
        visit: {
          assignmentId: { in: assignmentIds }
        }
      },
      include: {
        type: true,
        patient: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    // Combine and format activities
    const activities = [
      ...recentVisits.map(visit => ({
        type: visit.status === 'COMPLETED' ? 'visit_completed' : 'visit_updated',
        message: visit.status === 'COMPLETED'
          ? `Completed visit for ${visit.patient.name}`
          : `Updated visit for ${visit.patient.name}`,
        timestamp: visit.updatedAt,
        color: visit.status === 'COMPLETED' ? '#10B981' : '#2e13d1'
      })),
      ...recentAppointments.map(apt => ({
        type: 'appointment',
        message: apt.status === 'SCHEDULED'
          ? `Scheduled appointment for ${apt.patient.name}`
          : apt.status === 'ARRIVED'
            ? `Patient ${apt.patient.name} arrived for appointment`
            : `Appointment ${apt.status.toLowerCase()} for ${apt.patient.name}`,
        timestamp: apt.updatedAt,
        color: apt.status === 'SCHEDULED' ? '#2e13d1' : apt.status === 'ARRIVED' ? '#F59E0B' : '#EA2E00'
      })),
      ...recentLabOrders.map(order => ({
        type: 'lab_order',
        message: `Ordered ${order.type.name} for ${order.patient.name}`,
        timestamp: order.createdAt,
        color: '#2e13d1'
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);

    res.json({ activities });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get patient assignments and doctor information
exports.getPatientAssignments = async (req, res) => {
  try {
    const { search } = req.query;

    let whereClause = {};
    if (search) {
      whereClause = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { id: { contains: search, mode: 'insensitive' } }
        ]
      };
    }

    const patients = await prisma.patient.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        mobile: true,
        email: true,
        dob: true,
        gender: true,
        assignments: {
          select: {
            id: true,
            status: true,
            doctor: {
              select: {
                id: true,
                fullname: true,
                qualifications: true
              }
            }
          }
        },
        visits: {
          where: {
            status: {
              notIn: ['COMPLETED', 'CANCELLED']
            }
          },
          select: {
            id: true,
            visitUid: true,
            status: true,
            date: true,
            assignmentId: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      },
      take: 20 // Limit results for performance
    });

    // Format the response
    const formattedPatients = patients.map(patient => {
      const activeAssignment = patient.assignments.find(a =>
        a.status === 'Pending' || a.status === 'In Progress'
      );

      // Find the current visit (most recent active visit)
      const currentVisit = patient.visits.length > 0 ? patient.visits[0] : null;

      return {
        id: patient.id,
        name: patient.name,
        phone: patient.mobile,
        email: patient.email,
        dateOfBirth: patient.dob,
        gender: patient.gender,
        assignedDoctor: activeAssignment?.doctor || null,
        currentVisit: currentVisit,
        assignmentStatus: activeAssignment?.status || 'Unassigned'
      };
    });

    res.json({
      patients: formattedPatients,
      total: formattedPatients.length
    });
  } catch (error) {
    console.error('Error fetching patient assignments:', error);
    res.status(500).json({ error: error.message });
  }
};

// Unified Queue - combines patient queue and results queue with priority system
exports.getUnifiedQueue = async (req, res) => {
  try {
    // Use doctorId from query parameter if provided (for reception), otherwise use logged-in user's ID (for doctor)
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - Please log in'
      });
    }

    const doctorId = req.query.doctorId || req.user.id;
    console.log('🔍 getUnifiedQueue - Doctor ID:', doctorId);

    if (!doctorId || typeof doctorId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Doctor ID is required and must be a valid string'
      });
    }

    // Get doctor assignments
    const doctorAssignments = await prisma.assignment.findMany({
      where: { doctorId: doctorId },
      select: { id: true }
    });

    const assignmentIds = doctorAssignments.map(a => a.id);
    console.log('🔍 Assignment IDs:', assignmentIds);

    // Get filter parameter from query (main or sent)
    const queueFilter = req.query.filter || 'main'; // 'main' or 'sent'
    console.log('🔍 ========================================');
    console.log('🔍 Queue filter requested:', queueFilter);
    console.log('🔍 Query params:', JSON.stringify(req.query));
    console.log('🔍 Full request URL:', req.url);
    console.log('🔍 ========================================');

    // Define statuses that indicate patient is sent to lab/radiology/nurse
    const sentStatuses = ['SENT_TO_LAB', 'SENT_TO_RADIOLOGY', 'SENT_TO_BOTH', 'NURSE_SERVICES_ORDERED'];

    // Define statuses for patients who have returned with results
    const returnedStatuses = ['RETURNED_WITH_RESULTS', 'AWAITING_RESULTS_REVIEW'];

    console.log('🔍 Sent statuses:', sentStatuses);
    console.log('🔍 Returned statuses:', returnedStatuses);

    // Build status filter based on queue type
    let statusFilter = {
      notIn: ['COMPLETED', 'CANCELLED']
    };

    if (queueFilter === 'main') {
      // Main queue: exclude patients sent to lab/radiology/nurse AND those with results ready
      statusFilter = {
        notIn: ['COMPLETED', 'CANCELLED', ...sentStatuses, ...returnedStatuses]
      };
      console.log('🔍 Main queue filter: excluding', [...sentStatuses, ...returnedStatuses]);
    } else if (queueFilter === 'sent') {
      // Sent queue: ONLY include patients sent to lab/radiology/nurse
      statusFilter = {
        in: sentStatuses
      };
      console.log('🔍 Sent queue filter: ONLY including', sentStatuses);
    } else if (queueFilter === 'returned') {
      // Returned queue: ONLY include patients with results ready
      statusFilter = {
        in: returnedStatuses
      };
      console.log('🔍 Returned queue filter: ONLY including', returnedStatuses);
    } else if (queueFilter === 'all') {
      // All queue for searching: include all active statuses
      statusFilter = {
        notIn: ['COMPLETED', 'CANCELLED']
      };
      console.log('🔍 All queue filter: including all active statuses');
    }

    // Get all visits assigned to this doctor (both new consultations and results)
    // Include ALL statuses except COMPLETED and CANCELLED
    // Patient stays in queue until main "Complete Visit" button is clicked

    // First, get all visits with assignments to check for waived consultation
    // Handle case where assignmentIds might be empty
    let visitsWithAssignments = [];

    if (assignmentIds.length > 0) {
      console.log('🔍 Executing initial query with statusFilter:', JSON.stringify(statusFilter));
      console.log('🔍 Queue filter:', queueFilter);
      console.log('🔍 Assignment IDs:', assignmentIds);

      visitsWithAssignments = await prisma.visit.findMany({
        where: {
          status: statusFilter,
          AND: [
            {
              OR: [
                { assignmentId: { in: assignmentIds } },
                { batchOrders: { some: { doctorId: doctorId } } },
                { labTestOrders: { some: { doctorId: doctorId } } },
                // For main queue, also include IN_DOCTOR_QUEUE visits with suggestedDoctorId
                ...(queueFilter === 'main' || queueFilter === 'all' ? [{
                  AND: [
                    { status: 'IN_DOCTOR_QUEUE' },
                    { suggestedDoctorId: doctorId }
                  ]
                }] : [])
              ]
            }
          ]
        },
        include: {
          bills: {
            include: {
              services: {
                include: {
                  service: true
                }
              }
            }
          }
        }
      });

      // Fetch assignments separately for visits that have assignmentId
      const visitAssignmentIds = visitsWithAssignments
        .map(v => v.assignmentId)
        .filter(id => id !== null);

      let assignmentMap = {};
      if (visitAssignmentIds.length > 0) {
        const assignments = await prisma.assignment.findMany({
          where: { id: { in: visitAssignmentIds } },
          include: {
            doctor: {
              select: {
                id: true,
                waiveConsultationFee: true
              }
            }
          }
        });

        assignments.forEach(a => {
          assignmentMap[a.id] = a;
        });
      }

      // Map assignments to visits
      visitsWithAssignments = visitsWithAssignments.map(visit => ({
        ...visit,
        assignment: visit.assignmentId ? assignmentMap[visit.assignmentId] || null : null
      }));

      // For main queue, also fetch IN_DOCTOR_QUEUE visits that might not have assignmentId set
      // but have an assignment for this doctor (assignment might exist but not be linked to visit)
      // OR have suggestedDoctorId set to this doctor OR have batch orders from this doctor
      if (queueFilter === 'main') {
        // First get all patients with assignments for this doctor
        const patientsWithAssignments = await prisma.assignment.findMany({
          where: {
            doctorId: doctorId,
            id: { in: assignmentIds }
          },
          select: {
            patientId: true
          }
        });
        const patientIdsWithAssignments = [...new Set(patientsWithAssignments.map(a => a.patientId))];

        const additionalINDoctorQueueVisits = await prisma.visit.findMany({
          where: {
            status: 'IN_DOCTOR_QUEUE',
            assignmentId: null, // Not already linked
            OR: [
              {
                patientId: { in: patientIdsWithAssignments }
              },
              {
                suggestedDoctorId: doctorId
              },
              {
                batchOrders: {
                  some: {
                    doctorId: doctorId
                  }
                }
              }
            ]
          },
          include: {
            bills: {
              include: {
                services: {
                  include: {
                    service: true
                  }
                }
              }
            },
            patient: {
              select: {
                id: true,
                name: true
              }
            }
          }
        });

        if (additionalINDoctorQueueVisits.length > 0) {
          console.log(`🔍 Found ${additionalINDoctorQueueVisits.length} additional IN_DOCTOR_QUEUE visits with assignments but no assignmentId link`);

          // Fetch assignments for these visits
          const patientIds = additionalINDoctorQueueVisits.map(v => v.patientId);
          const additionalAssignments = await prisma.assignment.findMany({
            where: {
              patientId: { in: patientIds },
              doctorId: doctorId
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

          // Map assignments to visits
          const additionalAssignmentMap = {};
          additionalAssignments.forEach(a => {
            if (!additionalAssignmentMap[a.patientId]) {
              additionalAssignmentMap[a.patientId] = [];
            }
            additionalAssignmentMap[a.patientId].push(a);
          });

          // Add these visits with their assignments
          const visitsWithAdditionalAssignments = additionalINDoctorQueueVisits.map(visit => {
            const assignments = additionalAssignmentMap[visit.patientId] || [];
            const assignment = assignments[0] || null; // Use first assignment

            return {
              ...visit,
              assignment: assignment
            };
          });

          // Merge with existing visits (avoid duplicates)
          const existingVisitIds = new Set(visitsWithAssignments.map(v => v.id));
          const newVisits = visitsWithAdditionalAssignments.filter(v => !existingVisitIds.has(v.id));
          visitsWithAssignments = [...visitsWithAssignments, ...newVisits];
          console.log(`🔍 Added ${newVisits.length} additional IN_DOCTOR_QUEUE visits to queue`);
        }
      }
    } else {
      // If no assignments, still check for batch orders or lab test orders
      visitsWithAssignments = await prisma.visit.findMany({
        where: {
          status: statusFilter,
          OR: [
            { batchOrders: { some: { doctorId: doctorId } } },
            { labTestOrders: { some: { doctorId: doctorId } } },
            ...(queueFilter === 'main' || queueFilter === 'all' ? [{
              AND: [
                { status: 'IN_DOCTOR_QUEUE' },
                { suggestedDoctorId: doctorId }
              ]
            }] : [])
          ]
        },
        include: {
          bills: {
            include: {
              services: {
                include: {
                  service: true
                }
              }
            }
          }
        }
      });

      // Fetch assignments separately for visits that have assignmentId
      const visitIdsWithAssignments = visitsWithAssignments
        .map(v => v.assignmentId)
        .filter(id => id !== null);

      if (visitIdsWithAssignments.length > 0) {
        const assignments = await prisma.assignment.findMany({
          where: { id: { in: visitIdsWithAssignments } },
          include: {
            doctor: {
              select: {
                id: true,
                waiveConsultationFee: true
              }
            }
          }
        });

        // Map assignments to visits
        const assignmentMap = {};
        assignments.forEach(a => {
          assignmentMap[a.id] = a;
        });

        visitsWithAssignments = visitsWithAssignments.map(visit => ({
          ...visit,
          assignment: visit.assignmentId ? assignmentMap[visit.assignmentId] || null : null
        }));
      } else {
        // No assignments, set assignment to null for all visits
        visitsWithAssignments = visitsWithAssignments.map(visit => ({
          ...visit,
          assignment: null
        }));
      }
    }

    console.log('🔍 Visits with assignments found:', visitsWithAssignments.length);

    // Debug: Check for all IN_DOCTOR_QUEUE visits in database for this doctor
    if (queueFilter === 'main') {
      const allINDoctorQueueVisits = await prisma.visit.findMany({
        where: {
          status: 'IN_DOCTOR_QUEUE'
        },
        select: {
          id: true,
          visitUid: true,
          status: true,
          assignmentId: true,
          suggestedDoctorId: true,
          patientId: true,
          patient: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
      console.log(`🔍 DEBUG: Found ${allINDoctorQueueVisits.length} total IN_DOCTOR_QUEUE visits in database`);
      allINDoctorQueueVisits.forEach(v => {
        console.log(`   Visit ${v.id} (${v.visitUid}): assignmentId=${v.assignmentId}, suggestedDoctorId=${v.suggestedDoctorId}, patient=${v.patient?.name}`);
      });

      // Check which ones have assignments for this doctor
      const patientIds = allINDoctorQueueVisits.map(v => v.patientId);
      const allAssignmentsForPatients = await prisma.assignment.findMany({
        where: {
          patientId: { in: patientIds },
          doctorId: doctorId
        },
        select: {
          id: true,
          patientId: true,
          doctorId: true
        }
      });
      console.log(`🔍 DEBUG: Found ${allAssignmentsForPatients.length} assignments for this doctor for these patients`);
      allAssignmentsForPatients.forEach(a => {
        console.log(`   Assignment ${a.id}: patientId=${a.patientId}, doctorId=${a.doctorId}`);
      });
    }

    if (visitsWithAssignments.length > 0) {
      console.log('🔍 Visit statuses from initial query:', visitsWithAssignments.map(v => ({ id: v.id, status: v.status, assignmentId: v.assignmentId })));
      // CRITICAL CHECK: If queueFilter is 'sent', verify all visits have sent statuses
      if (queueFilter === 'sent') {
        const invalidVisits = visitsWithAssignments.filter(v => !sentStatuses.includes(v.status));
        if (invalidVisits.length > 0) {
          console.error(`❌ CRITICAL: Initial query returned ${invalidVisits.length} visits with wrong statuses for sent queue!`,
            invalidVisits.map(v => ({ id: v.id, status: v.status }))
          );
        }
      }
    }

    // Filter visits: emergency OR paid consultation OR doctor waived consultation
    // Also include patients with WAITING_FOR_NURSE_SERVICE status if they have a waived doctor assigned
    // IMPORTANT: For 'sent' filter, include ALL sent status visits (they're already sent, payment not required)
    // For 'main' filter, we need to ensure they're not in sent statuses (already filtered) and have payment/waiver
    const filteredVisits = visitsWithAssignments.filter(visit => {
      try {
        // For 'sent' queue, include ALL visits with sent statuses (they're already sent)
        if (queueFilter === 'sent' && sentStatuses.includes(visit.status)) {
          console.log(`🔍 Visit ${visit.id} included - is in sent queue (status: ${visit.status})`);
          return true;
        }

        // Never show patients who haven't paid for card registration
        if (visit.status === 'AWAITING_CARD_BILLING') {
          console.log(`🔍 Visit ${visit.id} EXCLUDED - AWAITING_CARD_BILLING (card not paid)`);
          return false;
        }

        // Emergency patients always included
        if (visit.isEmergency) {
          console.log(`🔍 Visit ${visit.id} included - is emergency`);
          return true;
        }

        // Check if consultation is paid
        const hasPaidConsultation = visit.bills && visit.bills.some(bill =>
          bill.status === 'PAID' &&
          bill.services &&
          bill.services.some(bs => bs.service && bs.service.category === 'CONSULTATION')
        );

        // Check if doctor has waived consultation
        // Handle case where assignment might be null
        let doctorHasWaiver = false;
        if (visit.assignment && visit.assignment.doctor) {
          doctorHasWaiver = visit.assignment.doctor.waiveConsultationFee || false;
        }

        // If patient has WAITING_FOR_NURSE_SERVICE status and doctor has waiver, include them
        // This handles the case where services were assigned first, then doctor was assigned
        if (visit.status === 'WAITING_FOR_NURSE_SERVICE' && doctorHasWaiver) {
          console.log(`🔍 Including visit ${visit.id} with WAITING_FOR_NURSE_SERVICE status - doctor has waiver`);
          return true;
        }

        // IN_DOCTOR_QUEUE status means doctor is already working on patient - always include
        // This ensures patients don't disappear from main queue when doctor is actively working
        if (visit.status === 'IN_DOCTOR_QUEUE') {
          console.log(`🔍 Including visit ${visit.id} with IN_DOCTOR_QUEUE status - doctor is working on patient`);
          return true;
        }

        const included = hasPaidConsultation || doctorHasWaiver;
        if (!included) {
          console.log(`🔍 Visit ${visit.id} (status: ${visit.status}) EXCLUDED - no paid consultation (${hasPaidConsultation}) and no waiver (${doctorHasWaiver})`);
        } else {
          console.log(`🔍 Visit ${visit.id} (status: ${visit.status}) INCLUDED - hasPaidConsultation: ${hasPaidConsultation}, doctorHasWaiver: ${doctorHasWaiver}`);
        }

        return included;
      } catch (filterError) {
        console.error('Error filtering visit:', visit.id, filterError);
        return false; // Exclude visits that cause errors
      }
    });

    // Additional safety check: For 'sent' filter, double-check that all visits have sent statuses
    // Filter out any visits that don't match the expected status
    // THIS IS CRITICAL - sent queue should ONLY contain patients with sent statuses
    let finalFilteredVisits = filteredVisits;
    if (queueFilter === 'sent') {
      const beforeCount = filteredVisits.length;
      finalFilteredVisits = filteredVisits.filter(v => {
        const isSent = sentStatuses.includes(v.status);
        if (!isSent) {
          console.warn(`⚠️ REMOVING visit ${v.id} with status "${v.status}" from sent queue - not a sent status!`);
        }
        return isSent;
      });
      if (beforeCount !== finalFilteredVisits.length) {
        console.warn(`⚠️ Filtered out ${beforeCount - finalFilteredVisits.length} visits from sent queue that don't have sent statuses`);
      }
    } else if (queueFilter === 'main') {
      // For main queue, ensure no sent statuses slip through
      const beforeCount = filteredVisits.length;
      finalFilteredVisits = filteredVisits.filter(v => {
        const isNotSent = !sentStatuses.includes(v.status);
        if (!isNotSent) {
          console.warn(`⚠️ REMOVING visit ${v.id} with status "${v.status}" from main queue - this is a sent status!`);
        }
        return isNotSent;
      });
      if (beforeCount !== finalFilteredVisits.length) {
        console.warn(`⚠️ Filtered out ${beforeCount - finalFilteredVisits.length} visits from main queue that have sent statuses`);
      }
    }

    const visitIds = finalFilteredVisits.map(v => v.id).filter(id => id != null);
    console.log(`🔍 Final filtered visit IDs for ${queueFilter} queue:`, visitIds);
    console.log('🔍 Filtered visit IDs:', visitIds);

    // Now fetch full visit data for filtered visits
    console.log('🔍 Fetching full visit data for', visitIds.length, 'visits');
    let allVisits = [];

    try {
      // Ensure visitIds is not empty and contains valid IDs
      if (!visitIds || visitIds.length === 0) {
        console.log('🔍 No valid visit IDs to fetch');
        allVisits = [];
      } else {
        // Ensure we also filter by status here to prevent any completed/cancelled visits from appearing
        // Also ensure we don't get visits with wrong statuses
        // CRITICAL: This is the final database query - must match the queue filter exactly
        console.log('🔍 Final database query - queueFilter:', queueFilter);
        console.log('🔍 Final database query - statusFilter:', JSON.stringify(statusFilter));
        console.log('🔍 Final database query - visitIds:', visitIds);
        console.log('🔍 Final database query - sentStatuses:', sentStatuses);

        // CRITICAL: For sent queue, we MUST ensure statusFilter only includes sentStatuses
        // Double-check that statusFilter is correct before querying
        if (queueFilter === 'sent') {
          if (JSON.stringify(statusFilter) !== JSON.stringify({ in: sentStatuses })) {
            console.error('❌ CRITICAL ERROR: statusFilter is incorrect for sent queue!');
            console.error('❌ Expected:', JSON.stringify({ in: sentStatuses }));
            console.error('❌ Got:', JSON.stringify(statusFilter));
            // Force correct filter
            statusFilter = { in: sentStatuses };
          }
        }

        allVisits = await prisma.visit.findMany({
          where: {
            id: { in: visitIds },
            status: statusFilter  // Apply status filter again to ensure consistency
          },
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
            vitals: {
              orderBy: { createdAt: 'desc' },
              take: 1
            },
            labOrders: {
              include: {
                type: true,
                labResults: {
                  include: {
                    testType: true,
                    attachments: true
                  }
                }
              }
            },
            radiologyOrders: {
              include: {
                type: true,
                radiologyResults: {
                  include: {
                    testType: true,
                    attachments: true
                  }
                }
              }
            },
            batchOrders: {
              include: {
                services: {
                  include: {
                    service: true,
                    investigationType: true
                  }
                },
                attachments: true
              }
            },
            medicationOrders: {
              include: {
                continuousInfusion: true
              }
            },
            labTestOrders: {
              include: {
                labTest: {
                  include: {
                    resultFields: {
                      orderBy: { displayOrder: 'asc' }
                    },
                    group: true
                  }
                },
                results: {
                  include: {
                    attachments: true
                  },
                  orderBy: { createdAt: 'desc' }
                },
                doctor: {
                  select: {
                    id: true,
                    fullname: true
                  }
                }
              },
              orderBy: { createdAt: 'asc' }
            },
            bills: {
              include: {
                services: {
                  include: {
                    service: true
                  }
                },
                payments: true
              }
            },
            dentalRecords: true,
            nurseServiceAssignments: {
              where: {
                status: 'COMPLETED'
              },
              include: {
                service: true,
                assignedNurse: {
                  select: {
                    id: true,
                    fullname: true
                  }
                }
              },
              orderBy: {
                completedAt: 'desc'
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        });
      }

      console.log('🔍 Successfully fetched', allVisits.length, 'visits');

      // Fetch assignments separately for visits that have assignmentId
      const allVisitAssignmentIds = allVisits
        .map(v => v.assignmentId)
        .filter(id => id !== null);

      let allAssignmentMap = {};
      if (allVisitAssignmentIds.length > 0) {
        const allAssignments = await prisma.assignment.findMany({
          where: { id: { in: allVisitAssignmentIds } },
          include: {
            doctor: {
              select: {
                id: true,
                waiveConsultationFee: true
              }
            }
          }
        });

        allAssignments.forEach(a => {
          allAssignmentMap[a.id] = a;
        });
      }

      // Map assignments to visits
      allVisits = allVisits.map(visit => ({
        ...visit,
        assignment: visit.assignmentId ? allAssignmentMap[visit.assignmentId] || null : null
      }));
    } catch (queryError) {
      console.error('❌ Error fetching visits:', queryError);
      console.error('Query error details:', {
        message: queryError.message,
        code: queryError.code,
        meta: queryError.meta
      });
      throw queryError; // Re-throw to be caught by outer catch
    }

    console.log('🔍 Found visits before final filter:', allVisits.length);
    console.log('🔍 Queue filter:', queueFilter);
    console.log('🔍 Sent statuses:', sentStatuses);

    // Log all visit statuses before filtering
    if (allVisits.length > 0) {
      console.log('🔍 Visit statuses before filter:', allVisits.map(v => ({ id: v.id, status: v.status })));
    }

    // Final safety check: Filter out any visits that don't match the queue filter
    // This is CRITICAL - the sent queue should ONLY show patients sent to lab/radiology/nurse
    // A patient with WAITING_FOR_DOCTOR should NEVER appear in the sent queue
    if (queueFilter === 'sent') {
      const beforeCount = allVisits.length;
      allVisits = allVisits.filter(v => {
        const isSent = sentStatuses.includes(v.status);
        if (!isSent) {
          console.error(`❌ ERROR: Visit ${v.id} with status "${v.status}" should NOT be in sent queue! Filtering out.`);
        }
        return isSent;
      });
      console.log(`🔍 After sent status filter: ${allVisits.length} visits (removed ${beforeCount - allVisits.length})`);

      // Double-check: If any visits remain that don't have sent statuses, this is a critical error
      const invalidRemaining = allVisits.filter(v => !sentStatuses.includes(v.status));
      if (invalidRemaining.length > 0) {
        console.error(`❌ CRITICAL ERROR: ${invalidRemaining.length} visits with wrong statuses still in sent queue!`,
          invalidRemaining.map(v => ({ id: v.id, status: v.status }))
        );
        // Remove them
        allVisits = allVisits.filter(v => sentStatuses.includes(v.status));
      }
    } else if (queueFilter === 'main') {
      const beforeCount = allVisits.length;
      allVisits = allVisits.filter(v => {
        const isNotSent = !sentStatuses.includes(v.status);
        if (!isNotSent) {
          console.error(`❌ ERROR: Visit ${v.id} with status "${v.status}" should NOT be in main queue! Filtering out.`);
        }
        return isNotSent;
      });
      console.log(`🔍 After main status filter: ${allVisits.length} visits (removed ${beforeCount - allVisits.length})`);
    }

    // Always exclude COMPLETED and CANCELLED
    const beforeCompletedFilter = allVisits.length;
    allVisits = allVisits.filter(v => v.status !== 'COMPLETED' && v.status !== 'CANCELLED');
    if (beforeCompletedFilter !== allVisits.length) {
      console.log(`🔍 Removed ${beforeCompletedFilter - allVisits.length} completed/cancelled visits`);
    }

    // Final verification log
    console.log('🔍 Final visit count:', allVisits.length);
    if (allVisits.length > 0) {
      console.log('🔍 Final visit statuses:', allVisits.map(v => ({ id: v.id, status: v.status })));

      // CRITICAL FINAL CHECK: If queueFilter is 'sent', verify NO visits have WAITING_FOR_DOCTOR
      if (queueFilter === 'sent') {
        const invalidStatuses = ['WAITING_FOR_DOCTOR', 'UNDER_DOCTOR_REVIEW', 'AWAITING_RESULTS_REVIEW'];
        const invalidVisits = allVisits.filter(v => invalidStatuses.includes(v.status));
        if (invalidVisits.length > 0) {
          console.error(`❌ CRITICAL ERROR: Found ${invalidVisits.length} visits with invalid statuses in sent queue!`);
          console.error('❌ Invalid visits:', invalidVisits.map(v => ({ id: v.id, status: v.status })));
          // Remove them immediately
          allVisits = allVisits.filter(v => !invalidStatuses.includes(v.status));
          console.error(`❌ Removed ${invalidVisits.length} invalid visits. Final count: ${allVisits.length}`);
        }

        // Double-check: Only sentStatuses should remain
        const stillInvalid = allVisits.filter(v => !sentStatuses.includes(v.status));
        if (stillInvalid.length > 0) {
          console.error(`❌ CRITICAL: ${stillInvalid.length} visits still have wrong statuses!`,
            stillInvalid.map(v => ({ id: v.id, status: v.status }))
          );
          allVisits = allVisits.filter(v => sentStatuses.includes(v.status));
        }
      }
    }

    allVisits.forEach(visit => {
      try {
        const doctorWaiver = visit.assignment?.doctor?.waiveConsultationFee ? 'YES' : 'NO';
        console.log(`  - Visit ${visit.id}: ${visit.patient?.name || 'Unknown'}, Status: ${visit.status}, AssignmentId: ${visit.assignmentId}, Doctor Waiver: ${doctorWaiver}`);
      } catch (logError) {
        console.error('Error logging visit:', visit.id, logError);
      }
    });

    // Additional safety check: Find visits from appointments that might not be properly linked
    // First, find appointments for this doctor that are in progress and have a visitId
    const appointmentVisits = await prisma.appointment.findMany({
      where: {
        doctorId: doctorId,
        status: 'IN_PROGRESS',
        visitId: { not: null }
      },
      include: {
        patient: true
      }
    });

    // Get the visitIds from appointments
    const appointmentVisitIds = appointmentVisits.map(apt => apt.visitId).filter(id => id !== null);

    // Get the actual visits for these appointment visitIds
    const visitsToFix = await prisma.visit.findMany({
      where: {
        id: { in: appointmentVisitIds },
        status: {
          notIn: ['COMPLETED', 'CANCELLED']
        },
        assignmentId: null // Missing assignment link
      },
      include: {
        patient: true,
        bills: {
          include: {
            services: {
              include: {
                service: true
              }
            }
          }
        }
      }
    });

    if (visitsToFix.length > 0) {
      console.log(`🔧 Found ${visitsToFix.length} appointment visits missing assignment links - fixing...`);

      for (const visit of visitsToFix) {
        // Find or create assignment
        let assignment = await prisma.assignment.findFirst({
          where: {
            patientId: visit.patientId,
            doctorId: doctorId,
            status: 'Pending'
          }
        });

        if (!assignment) {
          assignment = await prisma.assignment.create({
            data: {
              patientId: visit.patientId,
              doctorId: doctorId,
              status: 'Pending'
            }
          });
        }

        // Link the visit to the assignment
        await prisma.visit.update({
          where: { id: visit.id },
          data: { assignmentId: assignment.id }
        });

        console.log(`✅ Fixed visit ${visit.id} - linked to assignment ${assignment.id}`);
      }
    }

    // Additional fix: Update status for patients with WAITING_FOR_NURSE_SERVICE who have waived doctor assigned
    const visitsWithWrongStatus = allVisits.filter(visit => {
      try {
        return visit.status === 'WAITING_FOR_NURSE_SERVICE' &&
          visit.assignmentId &&
          visit.assignment?.doctor?.waiveConsultationFee === true;
      } catch (error) {
        console.error('Error checking visit status:', visit.id, error);
        return false;
      }
    });

    if (visitsWithWrongStatus.length > 0) {
      console.log(`🔧 Found ${visitsWithWrongStatus.length} visits with WAITING_FOR_NURSE_SERVICE status but waived doctor - fixing...`);

      try {
        for (const visit of visitsWithWrongStatus) {
          await prisma.visit.update({
            where: { id: visit.id },
            data: { status: 'WAITING_FOR_DOCTOR' }
          });
          console.log(`✅ Fixed visit ${visit.id} - updated status from WAITING_FOR_NURSE_SERVICE to WAITING_FOR_DOCTOR`);
        }

        // Update status in the allVisits array directly instead of re-fetching
        // This is more efficient and avoids potential query errors
        allVisits = allVisits.map(v => {
          if (visitsWithWrongStatus.find(vws => vws.id === v.id)) {
            return { ...v, status: 'WAITING_FOR_DOCTOR' };
          }
          return v;
        });

        console.log('🔍 Updated visit statuses in memory:', visitsWithWrongStatus.length);
      } catch (fixError) {
        console.error('Error fixing visit statuses:', fixError);
        // Continue with existing allVisits - don't fail the whole request
      }
    }

    // Add priority and queue type to each visit
    // Get appointment information for visits that have appointments
    const visitIdsForAppointments = allVisits.map(v => v.id).filter(id => id != null);

    let visitAppointments = [];
    if (visitIdsForAppointments.length > 0) {
      visitAppointments = await prisma.appointment.findMany({
        where: {
          visitId: { in: visitIdsForAppointments },
          doctorId: doctorId
        },
        select: {
          visitId: true,
          type: true,
          reason: true,
          notes: true,
          appointmentDate: true,
          appointmentTime: true
        }
      });
    }

    // Create a map of visitId to appointment for quick lookup
    const appointmentMap = {};
    visitAppointments.forEach(apt => {
      appointmentMap[apt.visitId] = apt;
    });

    const unifiedQueue = allVisits.map(visit => {
      try {
        let priority = 3; // Default: New consultation
        let queueType = 'NEW_CONSULTATION';
        let priorityReason = 'New consultation';
        let appointmentLabel = null;

        // Check if this visit is from an appointment
        const appointment = appointmentMap[visit.id];
        if (appointment) {
          appointmentLabel = {
            type: appointment.type,
            reason: appointment.reason,
            notes: appointment.notes,
            appointmentDate: appointment.appointmentDate,
            appointmentTime: appointment.appointmentTime
          };

          // Set queue type based on appointment type
          if (appointment.type === 'FOLLOW_UP') {
            queueType = 'FOLLOW_UP_APPOINTMENT';
            priorityReason = 'Follow-up appointment';
          } else if (appointment.type === 'CONSULTATION') {
            queueType = 'CONSULTATION_APPOINTMENT';
            priorityReason = 'Consultation appointment';
          }
        }

        // Determine priority based on status and urgency
        if (visit.status === 'AWAITING_RESULTS_REVIEW' || visit.status === 'RETURNED_WITH_RESULTS') {
          priority = 2;
          queueType = 'RESULTS_READY';
          priorityReason = 'Results ready for review';
        } else if (['SENT_TO_LAB', 'SENT_TO_RADIOLOGY', 'SENT_TO_BOTH'].includes(visit.status)) {
          priority = 3;
          queueType = 'AWAITING_RESULTS';
          priorityReason = 'Awaiting lab/radiology results';
        }

        // Check for urgent cases (high triage priority)
        if (visit.vitals && visit.vitals.length > 0) {
          const latestVitals = visit.vitals[0];
          if (latestVitals.triagePriority === 'High' ||
            (latestVitals.bloodPressure && latestVitals.bloodPressure.includes('High')) ||
            (latestVitals.temperature && latestVitals.temperature > 38.5) ||
            (latestVitals.heartRate && latestVitals.heartRate > 100)) {
            priority = 1;
            queueType = 'URGENT';
            priorityReason = 'Urgent case - high priority';
          }
        }

        return {
          ...visit,
          priority,
          queueType,
          priorityReason,
          appointmentLabel,
          // Add timestamp for sorting within same priority
          priorityTimestamp: visit.status === 'AWAITING_RESULTS_REVIEW'
            ? visit.updatedAt || visit.createdAt
            : visit.createdAt
        };
      } catch (mapError) {
        console.error('Error mapping visit:', visit.id, mapError);
        // Return a safe default object
        return {
          ...visit,
          priority: 3,
          queueType: 'NEW_CONSULTATION',
          priorityReason: 'New consultation',
          appointmentLabel: null,
          priorityTimestamp: visit.createdAt
        };
      }
    });

    // If filter is 'all' and includeTriage is true, add triage visits
    if (queueFilter === 'all' && req.query.includeTriage === 'true') {
      const triageVisits = await prisma.visit.findMany({
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
              bloodType: true
            }
          },
        vitals: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

      const triageQueueItems = triageVisits.map(visit => ({
        ...visit,
        priority: 4, // Lowest priority for triage in search
        queueType: 'TRIAGE',
        priorityReason: 'Triage queue',
        priorityTimestamp: visit.createdAt
      }));

      unifiedQueue.push(...triageQueueItems);
    }

    // Sort by priority (1=urgent, 2=results, 3=new, 4=triage), then by timestamp
    unifiedQueue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return new Date(a.priorityTimestamp) - new Date(b.priorityTimestamp);
    });

    // Calculate stats for ALL queues - fetch all qualifying visits (regardless of status filter)
    // This ensures counts are accurate regardless of which filter is active
    // sentStatuses is already declared at the top of this function

    // Fetch ALL visits that qualify (assignment/batch order + payment/waiver) for stats
    // This is separate from the filtered query to get accurate counts
    // Include IN_DOCTOR_QUEUE visits that are assigned to this doctor (via assignmentId or suggestedDoctorId)
    const allQualifyingVisits = await prisma.visit.findMany({
      where: {
        status: {
          notIn: ['COMPLETED', 'CANCELLED'] // Only exclude completed/cancelled
        },
        AND: [
          {
            OR: [
              { assignmentId: { in: assignmentIds } },
              { batchOrders: { some: { doctorId: doctorId } } },
              { labTestOrders: { some: { doctorId: doctorId } } },
              // Include IN_DOCTOR_QUEUE visits assigned to this doctor
              {
                AND: [
                  { status: 'IN_DOCTOR_QUEUE' },
                  {
                    OR: [
                      { assignmentId: { in: assignmentIds } },
                      { suggestedDoctorId: doctorId }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      },
      include: {
        bills: {
          include: {
            services: {
              include: {
                service: true
              }
            }
          }
        }
      }
    });

    // Fetch assignments separately and map them
    const statsVisitAssignmentIds = allQualifyingVisits
      .map(v => v.assignmentId)
      .filter(id => id !== null);

    // Also check for IN_DOCTOR_QUEUE visits that might have assignments but no assignmentId link
    const inDoctorQueueVisits = allQualifyingVisits.filter(v => v.status === 'IN_DOCTOR_QUEUE' && !v.assignmentId);
    const patientIdsForINDoctorQueue = inDoctorQueueVisits.map(v => v.patientId);

    let statsAssignmentMap = {};
    if (statsVisitAssignmentIds.length > 0) {
      const statsAssignments = await prisma.assignment.findMany({
        where: { id: { in: statsVisitAssignmentIds } },
        include: {
          doctor: {
            select: {
              id: true,
              waiveConsultationFee: true
            }
          }
        }
      });

      statsAssignments.forEach(a => {
        statsAssignmentMap[a.id] = a;
      });
    }

    // Fetch assignments for IN_DOCTOR_QUEUE visits without assignmentId
    if (patientIdsForINDoctorQueue.length > 0) {
      const additionalAssignments = await prisma.assignment.findMany({
        where: {
          patientId: { in: patientIdsForINDoctorQueue },
          doctorId: doctorId
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

      // Map by patientId for IN_DOCTOR_QUEUE visits
      const patientAssignmentMap = {};
      additionalAssignments.forEach(a => {
        if (!patientAssignmentMap[a.patientId]) {
          patientAssignmentMap[a.patientId] = a;
        }
      });

      // Add to statsAssignmentMap for visits that need it
      allQualifyingVisits.forEach(visit => {
        if (visit.status === 'IN_DOCTOR_QUEUE' && !visit.assignmentId && patientAssignmentMap[visit.patientId]) {
          const assignment = patientAssignmentMap[visit.patientId];
          statsAssignmentMap[`patient_${visit.patientId}`] = assignment;
        }
      });
    }

    // Map assignments to visits
    const allQualifyingVisitsWithAssignments = allQualifyingVisits.map(visit => {
      let assignment = null;
      if (visit.assignmentId) {
        assignment = statsAssignmentMap[visit.assignmentId] || null;
      } else if (visit.status === 'IN_DOCTOR_QUEUE') {
        // For IN_DOCTOR_QUEUE visits without assignmentId, check patient assignment
        const patientAssignment = statsAssignmentMap[`patient_${visit.patientId}`];
        if (patientAssignment) {
          assignment = patientAssignment;
        }
      }
      return {
        ...visit,
        assignment: assignment
      };
    });

    // Filter by payment/waiver (same logic as unified queue)
    const qualifyingVisits = allQualifyingVisitsWithAssignments.filter(visit => {
      // Never show patients who haven't paid for card registration
      if (visit.status === 'AWAITING_CARD_BILLING') return false;
      if (visit.isEmergency) return true;
      if (visit.status === 'IN_DOCTOR_QUEUE') return true;
      const hasPaidConsultation = visit.bills && visit.bills.some(bill =>
        bill.status === 'PAID' &&
        bill.services &&
        bill.services.some(bs => bs.service && bs.service.category === 'CONSULTATION')
      );
      const doctorHasWaiver = visit.assignment?.doctor?.waiveConsultationFee || false;
      return hasPaidConsultation || doctorHasWaiver;
    });

    // Main queue: qualifying visits NOT in sent or returned statuses
    const mainQueueVisits = qualifyingVisits.filter(v =>
      !sentStatuses.includes(v.status) && !returnedStatuses.includes(v.status)
    );

    // Sent queue: qualifying visits with sent statuses
    const sentQueueVisits = qualifyingVisits.filter(v => sentStatuses.includes(v.status));

    // Returned queue: qualifying visits with returned statuses
    const returnedQueueVisits = qualifyingVisits.filter(v => returnedStatuses.includes(v.status));

    // Get triage queue count separately
    const triageQueueCount = await prisma.visit.count({
      where: {
        status: { in: ['WAITING_FOR_TRIAGE', 'TRIAGED'] }
      }
    });

    // Compute stats from ALL qualifying visits (not filter-specific)
    const allUrgentCount = qualifyingVisits.filter(v => {
      if (returnedStatuses.includes(v.status)) return false;
      if (sentStatuses.includes(v.status)) return false;
      const latestVitals = v.vitals?.[0];
      return latestVitals?.triagePriority === 'High' ||
        (latestVitals?.temperature && latestVitals.temperature > 38.5) ||
        (latestVitals?.heartRate && latestVitals.heartRate > 100);
    }).length;
    const allResultsCount = returnedQueueVisits.length;
    const allMainCount = mainQueueVisits.length;

    console.log('🔍 Unified queue count:', unifiedQueue.length);
    console.log('🔍 Queue breakdown:', {
      main: mainQueueVisits.length,
      sent: sentQueueVisits.length,
      returned: returnedQueueVisits.length,
      triage: triageQueueCount,
      urgent: allUrgentCount,
      results: allResultsCount,
      new: allMainCount - allUrgentCount,
      awaiting: sentQueueVisits.length
    });

    res.json({
      success: true,
      queue: unifiedQueue,
      stats: {
        total: unifiedQueue.length,
        urgent: allUrgentCount,
        results: allResultsCount,
        new: allMainCount - allUrgentCount,
        awaiting: sentQueueVisits.length,
        sent: sentQueueVisits.length,
        returned: returnedQueueVisits.length,
        // Add separate counts for each queue type
        mainQueue: mainQueueVisits.length,
        sentQueue: sentQueueVisits.length,
        returnedQueue: returnedQueueVisits.length,
        triageQueue: triageQueueCount
      }
    });

  } catch (error) {
    console.error('❌ Error fetching unified queue:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    if (error.meta) {
      console.error('Prisma error meta:', JSON.stringify(error.meta, null, 2));
    }
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unified queue',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get triage queue for doctors - patients waiting for triage or already triaged
exports.getTriageQueue = async (req, res) => {
  try {
    // Get all patients in triage (WAITING_FOR_TRIAGE or TRIAGED status)
    const triageQueue = await prisma.visit.findMany({
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

    res.json({
      success: true,
      queue: triageQueue,
      stats: {
        total: triageQueue.length,
        waiting: triageQueue.filter(v => v.status === 'WAITING_FOR_TRIAGE').length,
        triaged: triageQueue.filter(v => v.status === 'TRIAGED').length
      }
    });
  } catch (error) {
    console.error('❌ Error fetching triage queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch triage queue',
      details: error.message
    });
  }
};

// Get single visit details for consultation page
exports.getVisitDetails = async (req, res) => {
  try {
    const { visitId } = req.params;
    const doctorId = req.user.id;

    // ensure the visitId is a valid integer before querying the database
    const parsedId = parseInt(visitId, 10);
    if (isNaN(parsedId)) {
      return res.status(400).json({ error: 'Invalid visit ID' });
    }

    // Build the include object in a variable so it's easier to review and prevent
    // accidental typos (previously we had an incorrect `diagnoses` field which
    // triggered a Prisma validation error).
    const parentVisitInclude = {
      select: {
        id: true, visitUid: true, status: true, notes: true, diagnosis: true, diagnosisDetails: true,
        createdAt: true,
        createdBy: { select: { id: true, fullname: true } },
        labOrders: { take: 20, orderBy: { createdAt: 'desc' }, include: { type: { select: { id: true, name: true } }, labResults: { take: 3, include: { testType: { select: { id: true, name: true } }, attachments: { select: { id: true, fileUrl: true, fileName: true } } } } } },
        radiologyOrders: { take: 20, orderBy: { createdAt: 'desc' }, include: { type: { select: { id: true, name: true } }, attachments: { select: { id: true, path: true } } } },
        medicationOrders: { take: 20, orderBy: { createdAt: 'desc' }, include: { doctor: { select: { id: true, fullname: true } }, medicationCatalog: { select: { id: true, name: true, genericName: true, unitPrice: true } } } },
        batchOrders: { take: 20, orderBy: { createdAt: 'desc' }, include: { services: { include: { investigationType: true, service: true } } } },
        diagnosisNotes: { take: 10, orderBy: { createdAt: 'desc' }, include: { doctor: { select: { id: true, fullname: true, role: true } } } },
        patientDiagnoses: { include: { disease: true } },
      }
    };

    const visitInclude = {
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
      parentVisit: parentVisitInclude,
      vitals: {
        take: 50,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, bloodPressure: true, temperature: true, heartRate: true,
          height: true, weight: true, oxygenSaturation: true,
          condition: true, notes: true, chiefComplaint: true,
          historyOfPresentIllness: true, createdAt: true,
          recordedByRole: true
        }
      },
      labOrders: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          type: { select: { id: true, name: true } },
          labResults: {
            take: 3,
            include: {
              testType: { select: { id: true, name: true } },
              attachments: { select: { id: true, fileUrl: true, fileName: true } }
            }
          }
        }
      },
      radiologyOrders: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          type: { select: { id: true, name: true } },
          radiologyResults: {
            take: 3,
            include: {
              testType: { select: { id: true, name: true } },
              attachments: { select: { id: true, fileUrl: true, fileName: true } }
            }
          }
        }
      },
      batchOrders: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          services: {
            take: 10,
            include: {
              service: { select: { id: true, name: true, code: true, price: true } },
              investigationType: { select: { id: true, name: true } },
              dentalProcedureCompletion: {
                select: { id: true, completedAt: true }
              }
            }
          },
          attachments: { select: { id: true, path: true } },
          detailedResults: {
            take: 5,
            include: {
              template: { select: { id: true, name: true } }
            }
          },
          radiologyResults: {
            take: 5,
            include: {
              testType: { select: { id: true, name: true } },
              attachments: { select: { id: true, fileUrl: true, fileName: true } }
            }
          }
        }
      },
      medicationOrders: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          medicationCatalog: {
            select: {
              id: true,
              name: true,
              genericName: true,
              dosageForm: true,
              strength: true,
              unitPrice: true
            }
          },
          doctor: {
            select: {
              id: true,
              fullname: true,
              qualifications: true,
              licenseNumber: true
            }
          },
          continuousInfusion: {
            select: {
              id: true, dailyDose: true, days: true, startDate: true, status: true
            }
          }
        }
      },
      labTestOrders: {
        include: {
          labTest: {
            include: {
              resultFields: {
                orderBy: { displayOrder: 'asc' }
              },
              group: true
            }
          },
          results: {
            include: {
              attachments: true
            },
            orderBy: { createdAt: 'desc' }
          },
          doctor: {
            select: {
              id: true,
              fullname: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      },

      externalDiagnosticOrders: {
        include: {
          doctor: {
            select: {
              id: true,
              fullname: true,
              role: true,
              qualifications: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      },
      // use the correct relation name from the schema
      patientDiagnoses: {
        include: {
          disease: true
        }
      },
      diagnosisNotes: {
        include: {
          doctor: {
            select: {
              id: true,
              fullname: true,
              role: true
            }
          }
        }
      },
      bills: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          services: {
            take: 10,
            include: {
              service: { select: { id: true, name: true, code: true, price: true, category: true } }
            }
          },
          payments: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { id: true, amount: true, type: true, createdAt: true }
          }
        }
      },
      dentalRecords: {
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: { id: true, toothId: true, conditions: true, treatmentPlan: true, notes: true, gumCondition: true, createdAt: true }
      },
      dentalPhotos: {
        take: 5,
        orderBy: { uploadedAt: 'desc' },
        select: { id: true, filePath: true, description: true, uploadedAt: true }
      },
      attachedImages: {
        take: 5,
        orderBy: { uploadedAt: 'desc' },
        select: { id: true, filePath: true, fileName: true, description: true, uploadedAt: true }
      },
      galleryImages: {
        take: 5,
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          uploadedBy: {
            select: {
              id: true,
              fullname: true,
              role: true
            }
          }
        }
      },
      nurseServiceAssignments: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          service: { select: { id: true, name: true, code: true, price: true } },
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
      }
    };

    const visit = await prisma.visit.findUnique({
      where: { id: parsedId },
      include: visitInclude
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Allow doctors to access visits in triage status (WAITING_FOR_TRIAGE or TRIAGED) for triage purposes
    const isTriageStatus = visit.status === 'WAITING_FOR_TRIAGE' || visit.status === 'TRIAGED';

    // Check if doctor is already assigned to this patient
    const assignment = await prisma.assignment.findFirst({
      where: {
        patientId: visit.patientId,
        doctorId: doctorId
      }
    });

    // Auto-assign doctor if not assigned (ensures access to notes and orders)
    let userAssignment = assignment;
    if (!userAssignment) {
      console.log(`🔍 Auto-assigning doctor ${doctorId} to patient ${visit.patientId} for visit access`);
      userAssignment = await prisma.assignment.create({
        data: {
          patientId: visit.patientId,
          doctorId: doctorId,
          status: 'Pending'
        }
      });

      // Link as primary assignment for the visit if it doesn't have one
      if (!visit.assignmentId) {
        await prisma.visit.update({
          where: { id: parseInt(visitId) },
          data: { assignmentId: userAssignment.id }
        });
      }
    }

    const hasBatchOrder = visit.batchOrders.some(order => order.doctorId === doctorId);
    const isSuggestedDoctor = visit.suggestedDoctorId === doctorId;

    // Allow access if: doctor is assigned (always true now), has batch orders, OR visit is in triage status, OR is suggested
    if (!userAssignment && !hasBatchOrder && !isTriageStatus && !isSuggestedDoctor) {
      return res.status(403).json({ error: 'Access denied to this visit' });
    }

    // Fetch detailed lab results for batch orders
    const labBatchOrderIds = visit.batchOrders
      .filter(bo => bo.type === 'LAB')
      .map(bo => bo.id);

    if (labBatchOrderIds.length > 0) {
      const detailedLabResults = await prisma.detailedLabResult.findMany({
        where: {
          labOrderId: {
            in: labBatchOrderIds
          }
        },
        include: {
          template: true
        },
        orderBy: { createdAt: 'desc' }
      });

      // Attach detailed lab results to batch orders
      visit.batchOrders.forEach(batchOrder => {
        if (batchOrder.type === 'LAB') {
          batchOrder.detailedLabResults = detailedLabResults.filter(
            result => result.labOrderId === batchOrder.id
          );
        }
      });
    }

    // Fetch radiology results for batch orders
    const radiologyBatchOrderIds = visit.batchOrders
      .filter(bo => bo.type === 'RADIOLOGY')
      .map(bo => bo.id);

    if (radiologyBatchOrderIds.length > 0) {
      const radiologyResults = await prisma.radiologyResult.findMany({
        where: {
          batchOrderId: {
            in: radiologyBatchOrderIds
          }
        },
        include: {
          testType: true,
          attachments: true
        },
        orderBy: { createdAt: 'desc' }
      });

      // Attach radiology results to batch orders
      visit.batchOrders.forEach(batchOrder => {
        if (batchOrder.type === 'RADIOLOGY') {
          batchOrder.radiologyResults = radiologyResults.filter(
            result => result.batchOrderId === batchOrder.id
          );
        }
      });
    }

    // --- SELF-HEALING: Sync Procedure Statuses with Billing ---
    // If there are UNPAID procedures but a PAID bill exists for them, sync the status
    try {
      const unpaidProcedures = visit.batchOrders.filter(bo =>
        bo.type === 'PROCEDURE' && bo.status === 'UNPAID'
      );
      const paidBills = visit.bills.filter(b => b.status === 'PAID');

      if (unpaidProcedures.length > 0 && paidBills.length > 0) {
        console.log(`🔄 [Self-Healing] Checking sync for ${unpaidProcedures.length} unpaid procedure(s) for visit ${visitId}`);
        for (const batch of unpaidProcedures) {
          let allPaid = true;
          for (const service of batch.services) {
            if (service.status === 'UNPAID') {
              const isPaidInBill = paidBills.some(bill =>
                bill.services.some(bs => bs.serviceId === service.serviceId)
              );
              if (isPaidInBill) {
                console.log(`✅ [Self-Healing] Marking service ${service.serviceId} as PAID for batch ${batch.id}`);
                await prisma.batchOrderService.update({
                  where: { id: service.id },
                  data: { status: 'PAID' }
                });
                service.status = 'PAID'; // Update local object for immediate response
              } else {
                allPaid = false;
              }
            }
          }
          if (allPaid && batch.status === 'UNPAID') {
            await prisma.batchOrder.update({
              where: { id: batch.id },
              data: { status: 'PAID' }
            });
            batch.status = 'PAID'; // Update local object
          }
        }
      }
    } catch (syncError) {
      console.error('❌ [Self-Healing] Error syncing procedure statuses:', syncError);
      // Don't fail the whole request if sync fails
    }

    // Normalize image paths for frontend
    const normalizePath = (filePath) => {
      if (!filePath) return filePath;
      const normalized = filePath.replace(/\\/g, '/');
      if (normalized.includes('/uploads/')) {
        return 'uploads/' + normalized.split('/uploads/').pop();
      }
      return normalized;
    };

    if (visit.attachedImages) {
      visit.attachedImages = visit.attachedImages.map(img => ({
        ...img,
        filePath: normalizePath(img.filePath)
      }));
    }

    if (visit.galleryImages) {
      visit.galleryImages = visit.galleryImages.map(img => ({
        ...img,
        filePath: normalizePath(img.filePath)
      }));
    }

    // Format procedures for frontend
    const procedures = [];
    // 1. From BatchOrders with type PROCEDURE
    visit.batchOrders?.filter(bo => bo.type === 'PROCEDURE')?.forEach(bo => {
      bo.services?.forEach(s => {
        procedures.push({
          id: s.id,
          name: s.service?.name || s.investigationType?.name || 'Procedure',
          status: s.status || bo.status,
          createdAt: s.createdAt || bo.createdAt
        });
      });
    });
    // 2. From nurseServiceAssignments with category PROCEDURE
    visit.nurseServiceAssignments?.filter(ns => ns.service?.category === 'PROCEDURE')?.forEach(ns => {
      procedures.push({
        id: ns.id,
        name: ns.service?.name || 'Procedure',
        status: ns.status,
        createdAt: ns.createdAt
      });
    });

    // Format radiology orders for frontend (including pending ones)
    const radiologyOrders = [];
    visit.batchOrders?.filter(bo => bo.type === 'RADIOLOGY')?.forEach(bo => {
      bo.services?.forEach(s => {
        radiologyOrders.push({
          id: s.id,
          typeId: s.investigationTypeId,
          investigationTypeId: s.investigationTypeId,
          type: s.investigationType || s.service || { name: 'Radiology' },
          status: s.status || bo.status || 'PENDING',
          createdAt: s.createdAt || bo.createdAt
        });
      });
    });

    // Fetch compound prescriptions separately (relation may not be generated in client yet)
    let compoundPrescriptions = [];
    try {
      compoundPrescriptions = await prisma.compoundPrescription.findMany({
        where: { visitId: parseInt(visitId) },
        include: { ingredients: true },
        orderBy: { createdAt: 'desc' }
      });
    } catch (cpErr) {
      console.warn('Could not fetch compoundPrescriptions:', cpErr.message);
    }

    const labResults = [];
    for (const labTestOrder of visit.labTestOrders || []) {
      const orderResult = labTestOrder.results && labTestOrder.results.length > 0 ? labTestOrder.results[0] : null;
      labResults.push({
        id: 'labtestorder-' + labTestOrder.id,
        testType: labTestOrder.labTest || { name: 'Lab Test', category: 'GENERAL' },
        resultText: orderResult ? orderResult.additionalNotes : null,
        detailedResults: [],
        additionalNotes: labTestOrder.instructions || (orderResult ? orderResult.additionalNotes : ''),
        status: labTestOrder.status || 'PENDING',
        attachments: orderResult ? orderResult.attachments : [],
        results: orderResult && orderResult.results ? { ...orderResult.results, _images: orderResult.results._images || [] } : { _images: [] },
        createdAt: labTestOrder.createdAt,
        verifiedBy: orderResult ? orderResult.verifiedBy : null,
        verifiedAt: orderResult ? orderResult.verifiedAt : null
      });
    }

    // If this visit has a parent (transferred from another doctor), include parent data
    let parentVisitData = null;
    if (visit.parentVisit) {
      parentVisitData = {
        ...visit.parentVisit,
        diagnoses: visit.parentVisit.patientDiagnoses || [],
        transferredFromDoctor: visit.parentVisit.createdBy
      };
    }

    res.json({
      ...visit,
      parentVisit: parentVisitData,
      diagnoses: visit.patientDiagnoses || [],
      compoundPrescriptions,
      procedures,
      radiologyOrders,
      labResults
    });
  } catch (error) {
    console.error('Error fetching visit details:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.selectVisit = async (req, res) => {
  try {
    const { visitId } = selectVisitSchema.parse(req.body);
    const doctorId = req.user.id;

    // Check if visit exists and is in correct status
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        patient: {
          select: { id: true, name: true, gender: true, dob: true, mobile: true, email: true, bloodType: true, type: true, allergies: true }
        },
        vitals: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        },
        labOrders: {
          include: {
            type: true,
            labResults: {
              include: {
                testType: true,
                attachments: true
              }
            }
          }
        },
        radiologyOrders: {
          include: {
            type: true,
            radiologyResults: {
              include: {
                testType: true,
                attachments: true
              }
            }
          }
        },
        medicationOrders: {
          include: {
            continuousInfusion: true
          }
        },
        bills: {
          include: {
            services: {
              include: {
                service: true
              }
            },
            payments: true
          }
        },
      }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    if (!['WAITING_FOR_DOCTOR', 'AWAITING_RESULTS_REVIEW', 'RETURNED_WITH_RESULTS', 'SENT_TO_LAB', 'SENT_TO_RADIOLOGY', 'SENT_TO_BOTH', 'AWAITING_LAB_RESULTS', 'AWAITING_RADIOLOGY_RESULTS', 'UNDER_DOCTOR_REVIEW'].includes(visit.status)) {
      return res.status(400).json({ error: 'Visit is not available for doctor review' });
    }

    // Auto-assign doctor if not assigned or assigned to someone else
    let currentAssignmentId = visit.assignmentId;

    if (!currentAssignmentId) {
      console.log('🔍 Visit has no assignment, creating new assignment for doctor:', doctorId);
      const newAssignment = await prisma.assignment.create({
        data: {
          patientId: visit.patientId,
          doctorId: doctorId,
          status: 'Pending'
        }
      });
      currentAssignmentId = newAssignment.id;

      // Update visit with the new assignmentId
      await prisma.visit.update({
        where: { id: visitId },
        data: { assignmentId: currentAssignmentId }
      });
    } else {
      // Check if already assigned to this doctor
      const existingAssignment = await prisma.assignment.findUnique({
        where: { id: currentAssignmentId }
      });

      if (!existingAssignment || existingAssignment.doctorId !== doctorId) {
        console.log(`🔍 Visit was assigned to ${existingAssignment?.doctorId}, re-assigning to ${doctorId}`);
        const updatedAssignment = await prisma.assignment.update({
          where: { id: currentAssignmentId },
          data: { doctorId: doctorId }
        });
      }
    }

    // Update visit status to under doctor review
    const updatedVisit = await prisma.visit.update({
      where: { id: visitId },
      data: { status: 'UNDER_DOCTOR_REVIEW' }
    });

    // Determine stage based on existing orders
    const hasLabOrders = visit.labOrders.length > 0;
    const hasRadiologyOrders = visit.radiologyOrders.length > 0;
    const hasCompletedLab = visit.labOrders.some(order => order.status === 'COMPLETED');
    const hasCompletedRadiology = visit.radiologyOrders.some(order => order.status === 'COMPLETED');

    const stage = (hasLabOrders || hasRadiologyOrders) && (hasCompletedLab || hasCompletedRadiology)
      ? 'POST_DIAGNOSTICS'
      : 'PRE_DIAGNOSTICS';

    try {
      getIO().emit('queue:visit-update', {
        visitId,
        patientId: visit.patientId,
        patientName: visit.patient?.name,
        doctorId,
        status: 'UNDER_DOCTOR_REVIEW',
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error('[WS] Failed to emit selectVisit event:', e.message);
    }

    res.json({
      message: 'Visit selected for review',
      visit: updatedVisit,
      stage,
      canOrderMedications: stage === 'POST_DIAGNOSTICS'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.updateVisit = async (req, res) => {
  try {
    const { visitId } = req.params;
    const { diagnosis, diagnosisDetails, instructions } = updateVisitSchema.parse(req.body);
    const doctorId = req.user.id;

    // Check if visit exists and is under doctor review
    const visit = await prisma.visit.findUnique({
      where: { id: parseInt(visitId) },
      include: { patient: true }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    if (!['WAITING_FOR_DOCTOR', 'AWAITING_RESULTS_REVIEW', 'UNDER_DOCTOR_REVIEW', 'SENT_TO_LAB', 'SENT_TO_RADIOLOGY', 'SENT_TO_BOTH', 'RETURNED_WITH_RESULTS', 'AWAITING_LAB_RESULTS', 'AWAITING_RADIOLOGY_RESULTS'].includes(visit.status)) {
      return res.status(400).json({ error: 'Visit is not available for doctor review' });
    }

    // Update visit with diagnosis and instructions
    const updatedVisit = await prisma.visit.update({
      where: { id: parseInt(visitId) },
      data: {
        diagnosis,
        diagnosisDetails,
        instructions,
        status: 'UNDER_DOCTOR_REVIEW'
      },
      include: {
        patient: true,
        vitals: true,
        labOrders: true,
        radiologyOrders: true,
        medicationOrders: {
          include: {
            continuousInfusion: true
          }
        },
        bills: {
          include: {
            services: {
              include: {
                service: true
              }
            },
            payments: true
          }
        },
      }
    });

    res.json({
      message: 'Visit updated successfully',
      visit: updatedVisit
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.createLabOrder = async (req, res) => {
  try {
    const { visitId, patientId, typeId, instructions } = labOrderSchema.parse(req.body);
    const doctorId = req.user.id;

    // Check if visit exists and is under doctor review
    const visit = await prisma.visit.findUnique({
      where: { id: visitId }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Allow orders to be created if visit is waiting for doctor, under doctor review, or sent to lab
    if (!['WAITING_FOR_DOCTOR', 'UNDER_DOCTOR_REVIEW', 'SENT_TO_LAB', 'SENT_TO_RADIOLOGY', 'SENT_TO_BOTH'].includes(visit.status)) {
      return res.status(400).json({ error: 'Visit must be waiting for doctor, under doctor review, or sent to lab/radiology to create orders' });
    }

    // Get investigation type with service
    const investigation = await prisma.investigationType.findUnique({
      where: { id: typeId, category: 'LAB' },
      include: { service: true }
    });

    if (!investigation) {
      return res.status(404).json({ error: 'Lab investigation type not found' });
    }

    if (!investigation.service) {
      return res.status(400).json({ error: 'Investigation type is not linked to a service' });
    }

    // Create lab order
    const order = await prisma.labOrder.create({
      data: {
        visitId,
        doctorId,
        patientId,
        typeId,
        instructions,
        status: 'UNPAID'
      },
      include: {
        type: {
          include: {
            service: true
          }
        },
        visit: {
          select: {
            id: true,
            visitUid: true
          }
        }
      }
    });

    // Check if diagnostics billing already exists for this visit
    let billing = await prisma.billing.findFirst({
      where: {
        visitId: visitId,
        notes: {
          contains: 'diagnostics'
        },
        status: 'PENDING'
      }
    });

    if (!billing) {
      // Create combined diagnostics billing
      billing = await prisma.billing.create({
        data: {
          patientId,
          visitId,
          totalAmount: investigation.service.price,
          status: 'PENDING',
          notes: 'Combined diagnostics billing - lab and radiology'
        }
      });
    } else {
      // Update existing diagnostics billing
      await prisma.billing.update({
        where: { id: billing.id },
        data: {
          totalAmount: billing.totalAmount + investigation.service.price
        }
      });
    }

    // Add service to billing
    await prisma.billingService.create({
      data: {
        billingId: billing.id,
        serviceId: investigation.service.id,
        quantity: 1,
        unitPrice: investigation.service.price,
        totalPrice: investigation.service.price
      }
    });

    // Update visit status based on existing orders
    const visitWithOrders = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        labOrders: true,
        radiologyOrders: true
      }
    });

    let newStatus = 'SENT_TO_LAB';
    if (visitWithOrders.radiologyOrders.length > 0) {
      newStatus = 'SENT_TO_BOTH';
    }

    await prisma.visit.update({
      where: { id: visitId },
      data: { status: newStatus }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: doctorId,
        action: 'CREATE_LAB_ORDER',
        entity: 'LabOrder',
        entityId: order.id,
        details: JSON.stringify({
          visitId,
          patientId,
          typeId,
          instructions,
          investigationType: order.type.name,
          serviceCode: order.type.service.code,
          servicePrice: order.type.service.price
        }),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({
      message: 'Lab order created successfully',
      order,
      billing: {
        id: billing.id,
        totalAmount: billing.totalAmount
      },
      visitStatus: newStatus
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.createMultipleLabOrders = async (req, res) => {
  try {
    const { visitId, patientId, orders } = multipleLabOrdersSchema.parse(req.body);
    const doctorId = req.user.id;

    // Check if visit exists and is under doctor review
    const visit = await prisma.visit.findUnique({
      where: { id: visitId }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Allow orders to be created if visit is waiting for doctor, under doctor review, or sent to lab
    if (!['WAITING_FOR_DOCTOR', 'UNDER_DOCTOR_REVIEW', 'SENT_TO_LAB', 'SENT_TO_RADIOLOGY', 'SENT_TO_BOTH'].includes(visit.status)) {
      return res.status(400).json({ error: 'Visit must be waiting for doctor, under doctor review, or sent to lab/radiology to create orders' });
    }

    // Check if consultation fee has been paid
    const consultationBilling = await prisma.billing.findFirst({
      where: {
        visitId: visitId,
        services: {
          some: {
            service: {
              code: 'CONS001' // Consultation service code
            }
          }
        }
      },
      include: {
        payments: true
      }
    });

    if (!consultationBilling || consultationBilling.status !== 'PAID') {
      return res.status(400).json({ error: 'Consultation fee must be paid before ordering lab tests' });
    }

    // Check for existing lab orders to prevent duplicates
    const existingLabOrders = await prisma.labOrder.findMany({
      where: {
        visitId: visitId,
        status: {
          in: ['UNPAID', 'PAID', 'QUEUED', 'IN_PROGRESS', 'COMPLETED']
        }
      },
      include: {
        type: true
      }
    });

    const existingBatchOrders = await prisma.batchOrder.findMany({
      where: {
        visitId: visitId,
        type: 'LAB',
        status: {
          in: ['UNPAID', 'PAID', 'QUEUED', 'IN_PROGRESS', 'COMPLETED']
        }
      },
      include: {
        services: {
          include: {
            investigationType: true
          }
        }
      }
    });

    // Get all already ordered lab test types
    const alreadyOrderedTypes = new Set();

    // Add from individual lab orders
    existingLabOrders.forEach(order => {
      alreadyOrderedTypes.add(order.typeId);
    });

    // Add from batch orders
    existingBatchOrders.forEach(batchOrder => {
      batchOrder.services.forEach(service => {
        if (service.investigationType && service.investigationType.category === 'LAB') {
          alreadyOrderedTypes.add(service.investigationType.id);
        }
      });
    });

    // Check for duplicates in the new orders
    const duplicateTypes = orders.filter(order => alreadyOrderedTypes.has(order.typeId));
    const newOrders = orders.filter(order => !alreadyOrderedTypes.has(order.typeId));

    if (duplicateTypes.length > 0) {
      const duplicateTypeNames = await prisma.investigationType.findMany({
        where: { id: { in: duplicateTypes.map(o => o.typeId) } },
        select: { id: true, name: true }
      });

      return res.status(400).json({
        error: 'Some lab tests have already been ordered',
        duplicates: duplicateTypeNames.map(t => t.name),
        message: `The following lab tests are already ordered: ${duplicateTypeNames.map(t => t.name).join(', ')}. Please remove them and try again.`,
        alreadyOrdered: duplicateTypeNames.map(t => ({ id: t.id, name: t.name }))
      });
    }

    if (newOrders.length === 0) {
      return res.status(400).json({
        error: 'All selected lab tests have already been ordered',
        message: 'All the lab tests you selected have already been ordered for this patient.'
      });
    }

    // Get the correct service IDs for each investigation type (only new orders)
    const investigationTypes = await prisma.investigationType.findMany({
      where: {
        id: { in: newOrders.map(o => o.typeId) },
        category: 'LAB'
      },
      select: { id: true, serviceId: true }
    });

    // Convert individual orders to batch order format (only new orders)
    const batchOrderData = {
      visitId,
      patientId,
      type: 'LAB',
      instructions: 'Lab tests ordered by doctor',
      services: newOrders.map(order => {
        const investigation = investigationTypes.find(i => i.id === order.typeId);
        if (!investigation || !investigation.serviceId) {
          throw new Error(`Investigation type ${order.typeId} not found or not linked to a service`);
        }
        return {
          serviceId: investigation.serviceId,
          investigationTypeId: order.typeId,
          instructions: order.instructions || 'Lab test'
        };
      })
    };

    // Create batch order using the batch order controller
    // This will create a BatchOrder with services, NOT individual LabOrder records
    const batchOrderController = require('./batchOrderController');
    req.body = batchOrderData;
    return await batchOrderController.createBatchOrder(req, res);

    // NOTE: All code below this return is UNREACHABLE and has been removed
    // It was creating duplicate LabOrder records when BatchOrders were created
    // The batchOrderController.createBatchOrder handles all billing and status updates
    // This prevents the automatic creation of duplicate LabOrders
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.createRadiologyOrder = async (req, res) => {
  try {
    const { visitId, patientId, typeId, instructions } = radiologyOrderSchema.parse(req.body);
    const doctorId = req.user.id;

    // Check if visit exists and is under doctor review
    const visit = await prisma.visit.findUnique({
      where: { id: visitId }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Allow orders to be created if visit is waiting for doctor, under doctor review, or sent to lab
    if (!['WAITING_FOR_DOCTOR', 'UNDER_DOCTOR_REVIEW', 'SENT_TO_LAB', 'SENT_TO_RADIOLOGY', 'SENT_TO_BOTH'].includes(visit.status)) {
      return res.status(400).json({ error: 'Visit must be waiting for doctor, under doctor review, or sent to lab/radiology to create orders' });
    }

    // Get investigation type with service
    const investigation = await prisma.investigationType.findUnique({
      where: { id: typeId, category: 'RADIOLOGY' },
      include: { service: true }
    });

    if (!investigation) {
      return res.status(404).json({ error: 'Radiology investigation type not found' });
    }

    if (!investigation.service) {
      return res.status(400).json({ error: 'Investigation type is not linked to a service' });
    }

    // Create radiology order
    const order = await prisma.radiologyOrder.create({
      data: {
        visitId,
        doctorId,
        patientId,
        typeId,
        instructions,
        status: 'UNPAID'
      },
      include: {
        type: {
          include: {
            service: true
          }
        },
        visit: {
          select: {
            id: true,
            visitUid: true
          }
        }
      }
    });

    // Check if diagnostics billing already exists for this visit
    let billing = await prisma.billing.findFirst({
      where: {
        visitId: visitId,
        notes: {
          contains: 'diagnostics'
        },
        status: 'PENDING'
      }
    });

    if (!billing) {
      // Create combined diagnostics billing
      billing = await prisma.billing.create({
        data: {
          patientId,
          visitId,
          totalAmount: investigation.service.price,
          status: 'PENDING',
          notes: 'Combined diagnostics billing - lab and radiology'
        }
      });
    } else {
      // Update existing diagnostics billing
      await prisma.billing.update({
        where: { id: billing.id },
        data: {
          totalAmount: billing.totalAmount + investigation.service.price
        }
      });
    }

    // Add service to billing
    await prisma.billingService.create({
      data: {
        billingId: billing.id,
        serviceId: investigation.service.id,
        quantity: 1,
        unitPrice: investigation.service.price,
        totalPrice: investigation.service.price
      }
    });

    // Update visit status based on existing orders
    const visitWithOrders = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        labOrders: true,
        radiologyOrders: true
      }
    });

    let newStatus = 'SENT_TO_RADIOLOGY';
    if (visitWithOrders.labOrders.length > 0) {
      newStatus = 'SENT_TO_BOTH';
    }

    await prisma.visit.update({
      where: { id: visitId },
      data: { status: newStatus }
    });

    res.json({
      message: 'Radiology order created successfully',
      order,
      billing: {
        id: billing.id,
        totalAmount: billing.totalAmount
      },
      visitStatus: newStatus
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.createMultipleRadiologyOrders = async (req, res) => {
  try {
    const { visitId, patientId, orders } = createMultipleRadiologyOrdersSchema.parse(req.body);
    const doctorId = req.user.id;

    // Check if visit exists and is under doctor review
    const visit = await prisma.visit.findUnique({
      where: { id: visitId }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Allow orders to be created if visit is waiting for doctor, under doctor review, or sent to lab
    if (!['WAITING_FOR_DOCTOR', 'UNDER_DOCTOR_REVIEW', 'SENT_TO_LAB', 'SENT_TO_RADIOLOGY', 'SENT_TO_BOTH'].includes(visit.status)) {
      return res.status(400).json({ error: 'Visit must be waiting for doctor, under doctor review, or sent to lab/radiology to create orders' });
    }

    // Check if consultation fee has been paid
    const consultationBilling = await prisma.billing.findFirst({
      where: {
        visitId: visitId,
        services: {
          some: {
            service: {
              code: 'CONS001' // Consultation service code
            }
          }
        }
      },
      include: {
        payments: true
      }
    });

    if (!consultationBilling || consultationBilling.status !== 'PAID') {
      return res.status(400).json({ error: 'Consultation fee must be paid before ordering radiology tests' });
    }

    // Check for existing radiology orders to prevent duplicates
    const existingRadiologyOrders = await prisma.radiologyOrder.findMany({
      where: {
        visitId: visitId,
        status: {
          in: ['UNPAID', 'PAID', 'QUEUED', 'IN_PROGRESS', 'COMPLETED']
        }
      },
      include: {
        type: true
      }
    });

    const existingBatchOrders = await prisma.batchOrder.findMany({
      where: {
        visitId: visitId,
        type: 'RADIOLOGY',
        status: {
          in: ['UNPAID', 'PAID', 'QUEUED', 'IN_PROGRESS', 'COMPLETED']
        }
      },
      include: {
        services: {
          include: {
            investigationType: true
          }
        }
      }
    });

    // Get all already ordered radiology test types
    const alreadyOrderedTypes = new Set();

    // Add from individual radiology orders
    existingRadiologyOrders.forEach(order => {
      alreadyOrderedTypes.add(order.typeId);
    });

    // Add from batch orders
    existingBatchOrders.forEach(batchOrder => {
      batchOrder.services.forEach(service => {
        if (service.investigationType && service.investigationType.category === 'RADIOLOGY') {
          alreadyOrderedTypes.add(service.investigationType.id);
        }
      });
    });

    // Check for duplicates in the new orders
    const duplicateTypes = orders.filter(order => alreadyOrderedTypes.has(order.typeId));
    const newOrders = orders.filter(order => !alreadyOrderedTypes.has(order.typeId));

    if (duplicateTypes.length > 0) {
      const duplicateTypeNames = await prisma.investigationType.findMany({
        where: { id: { in: duplicateTypes.map(o => o.typeId) } },
        select: { id: true, name: true }
      });

      return res.status(400).json({
        error: 'Some radiology tests have already been ordered',
        duplicates: duplicateTypeNames.map(t => t.name),
        message: `The following radiology tests are already ordered: ${duplicateTypeNames.map(t => t.name).join(', ')}. Please remove them and try again.`,
        alreadyOrdered: duplicateTypeNames.map(t => ({ id: t.id, name: t.name }))
      });
    }

    if (newOrders.length === 0) {
      return res.status(400).json({
        error: 'All selected radiology tests have already been ordered',
        message: 'All the radiology tests you selected have already been ordered for this patient.'
      });
    }

    // Get the correct service IDs for each investigation type (only new orders)
    const investigationTypes = await prisma.investigationType.findMany({
      where: {
        id: { in: newOrders.map(o => o.typeId) },
        category: 'RADIOLOGY'
      },
      select: { id: true, serviceId: true }
    });

    // Convert individual orders to batch order format (only new orders)
    const batchOrderData = {
      visitId,
      patientId,
      type: 'RADIOLOGY',
      instructions: 'Radiology tests ordered by doctor',
      services: newOrders.map(order => {
        const investigation = investigationTypes.find(i => i.id === order.typeId);
        if (!investigation || !investigation.serviceId) {
          throw new Error(`Investigation type ${order.typeId} not found or not linked to a service`);
        }
        return {
          serviceId: investigation.serviceId,
          investigationTypeId: order.typeId,
          instructions: order.instructions || 'Radiology test'
        };
      })
    };

    // Create batch order using the batch order controller
    // This creates a BatchOrder with services - NOT individual LabOrder records
    // This prevents duplicate orders
    const batchOrderController = require('./batchOrderController');
    req.body = batchOrderData;
    return await batchOrderController.createBatchOrder(req, res);

    // NOTE: All code below this return is UNREACHABLE and was removed
    // It was creating duplicate LabOrder records when BatchOrders were created
    // The old system created individual LabOrders, but we now use BatchOrders only

    // Validate all investigation types
    const investigationIds = orders.map(order => order.typeId);
    const investigations = await prisma.investigationType.findMany({
      where: {
        id: { in: investigationIds },
        category: 'RADIOLOGY'
      },
      include: { service: true }
    });

    if (investigations.length !== investigationIds.length) {
      return res.status(400).json({ error: 'One or more invalid radiology investigation types' });
    }

    // Create all radiology orders
    const radiologyOrders = [];
    let totalAmount = 0;

    for (const order of orders) {
      const investigation = investigations.find(inv => inv.id === order.typeId);

      const radiologyOrder = await prisma.radiologyOrder.create({
        data: {
          visitId,
          patientId,
          doctorId,
          typeId: order.typeId,
          instructions: order.instructions || null,
          status: 'UNPAID'
        },
        include: {
          type: {
            include: { service: true }
          },
          visit: {
            select: { id: true, visitUid: true }
          }
        }
      });

      radiologyOrders.push(radiologyOrder);
      totalAmount += investigation.price;
    }

    // Create separate billings for each radiology order to avoid unique constraint
    const billings = [];

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      const investigation = investigations.find(inv => inv.id === order.typeId);

      const billing = await prisma.billing.create({
        data: {
          patientId,
          visitId,
          totalAmount: investigation.price,
          status: 'PENDING',
          notes: `Radiology order - ${investigation.name}`
        }
      });

      await prisma.billingService.create({
        data: {
          billingId: billing.id,
          serviceId: investigation.serviceId,
          quantity: 1,
          unitPrice: investigation.price,
          totalPrice: investigation.price
        }
      });

      billings.push(billing);
    }

    // Update visit status to sent to radiology
    await prisma.visit.update({
      where: { id: visitId },
      data: { status: 'SENT_TO_RADIOLOGY' }
    });

    res.json({
      message: 'Multiple radiology orders created successfully',
      orders: radiologyOrders,
      billings: billings.map(b => ({
        id: b.id,
        totalAmount: b.totalAmount
      })),
      totalAmount: totalAmount,
      visitStatus: 'SENT_TO_RADIOLOGY'
    });

  } catch (error) {
    console.error('Multiple radiology orders creation error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.createMedicationOrder = async (req, res) => {
  try {
    console.log('🔍 Medication Order Request Body:', JSON.stringify(req.body, null, 2));

    let data;
    try {
      data = medicationOrderSchema.parse(req.body);
    } catch (parseError) {
      console.error('❌ Validation Error:', JSON.stringify(parseError.errors, null, 2));
      return res.status(400).json({ error: 'Validation error', details: parseError.errors });
    }
    console.log('✅ Parsed medication order data:', JSON.stringify(data, null, 2));

    const doctorId = req.user.id;

    // Check if visit exists and is under doctor review
    const visit = await prisma.visit.findUnique({
      where: { id: data.visitId },
      include: {
        labOrders: true,
        radiologyOrders: true
      }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // REMOVED: No visit status restrictions - doctor can order medications at any time
    // REMOVED: No investigation completion checks - doctor can order medications regardless of lab/radiology status

    // Create medication order
    const order = await prisma.medicationOrder.create({
      data: {
        visitId: data.visitId,
        doctorId,
        patientId: data.patientId,
        name: data.name,
        genericName: data.genericName || null,
        normalizedName: data.normalizedName || data.name.toLowerCase(),
        dosageFormCategory: data.dosageFormCategory || null,
        dosageForm: data.dosageForm,
        strength: data.strength,
        strengthText: data.strengthText || null,
        instructionText: data.instructionText || null,
        quantity: data.quantity || null,
        quantityNumeric: data.quantityNumeric || (data.quantity ? parseFloat(data.quantity) : null),
        calculatedQuantity: data.calculatedQuantity || null,
        finalQuantity: data.finalQuantity || null,
        quantityOverridden: data.quantityOverridden || false,
        unit: data.unit || null,
        frequencyType: data.frequencyType || null,
        frequencyValue: data.frequencyValue || null,
        frequencyUnit: data.frequencyUnit || null,
        frequencyText: data.frequencyText || data.frequency || null,
        duration: data.duration || null,
        durationValue: data.durationValue || null,
        durationUnit: data.durationUnit || null,
        durationText: data.durationText || null,

        routeCode: data.routeCode || null,
        route: data.route || null,
        instructions: data.instructions || null,
        additionalNotes: data.additionalNotes,
        category: data.category,
        rxnormCode: data.rxnormCode || null,
        atcCode: data.atcCode || null,
        snomedCode: data.snomedCode || null,
        isDeferred: data.isDeferred || false,
        status: data.isDeferred ? 'DEFERRED' : 'UNPAID'
      },
      include: {
        visit: {
          select: {
            id: true,
            visitUid: true
          }
        }
      }
    });

    // Link medication to catalog if found (DO NOT decrement inventory here - only on dispense)
    // Try to find the medication in the catalog and link it
    try {
      const medicationCatalog = await prisma.medicationCatalog.findFirst({
        where: {
          name: {
            contains: data.name,
            mode: 'insensitive'
          },
          strength: data.strength,
          dosageForm: data.dosageForm
        }
      });

      if (medicationCatalog) {
        // Parse quantity to number for validation and storage
        const orderedQuantity = parseFloat(data.quantity) || 0;

        // Check if sufficient quantity is available (but don't decrement yet)
        if (orderedQuantity > 0 && medicationCatalog.availableQuantity >= orderedQuantity) {
          // Link the order to the catalog and set the price
          // Also store numeric quantity and unit for calculations
          await prisma.medicationOrder.update({
            where: { id: order.id },
            data: {
              medicationCatalogId: medicationCatalog.id,
              unitPrice: medicationCatalog.unitPrice,
              quantityNumeric: orderedQuantity,
              unit: medicationCatalog.unit || 'unit'
            }
          });

          console.log(`Linked order to catalog for ${data.name}: ${orderedQuantity} ${medicationCatalog.unit || 'units'} (Available: ${medicationCatalog.availableQuantity})`);
        } else {
          console.warn(`Insufficient inventory for ${data.name}. Available: ${medicationCatalog.availableQuantity}, Ordered: ${orderedQuantity}`);
          // Still link to catalog but warn about insufficient stock
          await prisma.medicationOrder.update({
            where: { id: order.id },
            data: {
              medicationCatalogId: medicationCatalog.id,
              unitPrice: medicationCatalog.unitPrice,
              quantityNumeric: orderedQuantity,
              unit: medicationCatalog.unit || 'unit'
            }
          });
        }
      } else {
        console.log(`Medication ${data.name} not found in catalog - custom medication`);
        // Try to parse quantity for custom medications too
        const orderedQuantity = parseFloat(data.quantity) || 0;
        if (orderedQuantity > 0) {
          await prisma.medicationOrder.update({
            where: { id: order.id },
            data: {
              quantityNumeric: orderedQuantity,
              unit: 'unit' // Default unit for custom medications
            }
          });
        }
      }
    } catch (inventoryError) {
      console.warn('Failed to link medication to catalog:', inventoryError.message);
      // Don't fail the order if catalog lookup fails
    }

    // If it's a continuous infusion, create the infusion record and nurse tasks
    if (data.isContinuousInfusion && data.continuousInfusionDays && data.dailyDose) {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + data.continuousInfusionDays);

      const continuousInfusion = await prisma.continuousInfusion.create({
        data: {
          medicationOrderId: order.id,
          startDate,
          endDate,
          dailyDose: data.dailyDose,
          frequency: data.frequency,
          days: data.continuousInfusionDays,
          status: 'UNPAID'
        }
      });

      // Create nurse administration tasks for each day
      const nurseTasks = [];
      for (let i = 0; i < data.continuousInfusionDays; i++) {
        const scheduledFor = new Date(startDate);
        scheduledFor.setDate(scheduledFor.getDate() + i);
        scheduledFor.setHours(9, 0, 0, 0); // Default to 9 AM

        nurseTasks.push({
          continuousInfusionId: continuousInfusion.id,
          scheduledFor,
          completed: false
        });
      }

      await prisma.nurseAdministration.createMany({
        data: nurseTasks
      });
    }

    // Check for an existing PENDING pharmacy invoice for this visit
    let pharmacyInvoice = await prisma.pharmacyInvoice.findFirst({
      where: {
        visitId: data.visitId,
        patientId: data.patientId,
        status: 'PENDING'
      }
    });

    if (!pharmacyInvoice) {
      // Create new pharmacy invoice for medications
      pharmacyInvoice = await prisma.pharmacyInvoice.create({
        data: {
          patientId: data.patientId,
          visitId: data.visitId,
          totalAmount: 0,
          status: 'PENDING',
          notes: data.isContinuousInfusion ? 'Continuous infusion medication billing' : 'Medication order billing'
        }
      });
    }

    // Create pharmacy invoice item for the medication
    // Fetch the updated order to get the correct unitPrice
    const updatedOrder = await prisma.medicationOrder.findUnique({
      where: { id: order.id }
    });

    // Set default price for custom medications (not in catalog)
    const unitPrice = updatedOrder.unitPrice || (updatedOrder.medicationCatalogId ? 0 : 5.0); // Default 5 ETB for custom medications
    const quantity = parseInt(order.quantity) || 1;
    const totalPrice = unitPrice * quantity;

    const pharmacyInvoiceItem = await prisma.pharmacyInvoiceItem.create({
      data: {
        pharmacyInvoiceId: pharmacyInvoice.id,
        medicationOrderId: order.id,
        medicationCatalogId: updatedOrder.medicationCatalogId,
        name: order.name,
        dosageForm: order.dosageForm,
        strength: order.strength,
        quantity: quantity,
        unitPrice: unitPrice,
        totalPrice: totalPrice
      }
    });

    // Update pharmacy invoice total amount (increment, don't replace)
    await prisma.pharmacyInvoice.update({
      where: { id: pharmacyInvoice.id },
      data: {
        totalAmount: {
          increment: totalPrice
        }
      }
    });

    // For continuous infusion, create daily billing services
    if (data.isContinuousInfusion && data.continuousInfusionDays && data.dailyDose) {
      // Note: Continuous infusion billing is handled by the pharmacy when dispensing
      // The daily administration tasks are created above for nurse tracking
      console.log(`Continuous infusion created for ${data.continuousInfusionDays} days`);
    }

    // Update visit status to IN_DOCTOR_QUEUE if not already in a valid main queue status
    // This ensures the patient stays visible in the main queue after medication ordering
    // IN_DOCTOR_QUEUE is NOT in sentStatuses, so it will appear in the main queue
    const mainQueueStatuses = ['IN_DOCTOR_QUEUE', 'UNDER_DOCTOR_REVIEW', 'AWAITING_RESULTS_REVIEW', 'WAITING_FOR_DOCTOR', 'TRIAGED'];
    if (!mainQueueStatuses.includes(visit.status)) {
      await prisma.visit.update({
        where: { id: data.visitId },
        data: { status: 'IN_DOCTOR_QUEUE' }
      });
      console.log('🔍 createMedicationOrder: Updated visit status to IN_DOCTOR_QUEUE to keep patient in main queue');
    } else {
      console.log('🔍 createMedicationOrder: Keeping visit status as', visit.status, '- patient stays in main queue');
    }

    res.json({
      message: 'Medication order created successfully',
      order,
      pharmacyInvoice: {
        id: pharmacyInvoice.id,
        totalAmount: totalPrice
      }
    });
  } catch (error) {
    console.error('❌ Error creating medication order:', error);

    if (error instanceof z.ZodError) {
      console.error('❌ Validation errors:', error.errors);
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors ? error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        })) : error.issues ? error.issues.map(err => ({
          field: err.path.join('.'),
          message: err.message
        })) : [{ field: 'unknown', message: 'Validation error' }]
      });
    }

    res.status(500).json({ error: error.message });
  }
};

// Check if medication ordering is allowed for a visit
exports.checkMedicationOrdering = async (req, res) => {
  try {
    // REMOVED: All restrictions - doctor can order medications at any time
    // Always return allowed: true regardless of visit status or investigations
    res.json({
      allowed: true,
      reason: 'Medication ordering is always allowed'
    });
  } catch (error) {
    console.error('Error checking medication ordering:', error);
    // Even on error, allow medication ordering
    res.json({
      allowed: true,
      reason: 'Medication ordering is always allowed'
    });
  }
};

// ============================================
// CUSTOM MEDICATIONS - Save and Search
// ============================================

// Save custom medication (only when typed, not when selected from search)
exports.saveCustomMedication = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const {
      name,
      genericName,
      normalizedName,
      dosageFormCategory,
      dosageForm,
      strength,
      strengthText,
      routeCode,
      quantity,
      frequencyType,
      frequencyValue,
      frequencyUnit,
      frequencyText,
      durationValue,
      durationUnit,
      durationText,
      route,
      instructions,
      frequencyPeriod,
      durationPeriod,
      category,
      rxnormCode,
      atcCode,
      snomedCode
    } = req.body;

    if (!name || !dosageForm || !strength) {
      return res.status(400).json({ error: 'Name, dosage form, and strength are required' });
    }

    const normalized = name.trim().toLowerCase();

    const existing = await prisma.customMedication.findUnique({
      where: {
        doctorId_name_strength: {
          doctorId: doctorId,
          name: name.trim(),
          strength: strength.trim()
        }
      }
    });

    if (existing) {
      return res.status(200).json({
        message: 'Custom medication with this name and strength already exists',
        exists: true,
        customMedication: existing
      });
    }

    const customMed = await prisma.customMedication.create({
      data: {
        doctorId,
        name: name.trim(),
        genericName: genericName?.trim() || null,
        normalizedName: normalized,
        dosageFormCategory: dosageFormCategory || null,
        dosageForm: dosageForm.trim(),
        strength: strength.trim(),
        strengthText: strengthText || null,
        routeCode: routeCode || null,
        quantity: quantity || null,
        frequencyType: frequencyType || null,
        frequencyValue: frequencyValue ? parseFloat(frequencyValue) : null,
        frequencyUnit: frequencyUnit || null,
        frequencyText: frequencyText || null,
        durationValue: durationValue ? parseFloat(durationValue) : null,
        durationUnit: durationUnit || null,
        durationText: durationText || null,
        route: route || null,
        instructions: instructions || null,
        frequencyPeriod: frequencyPeriod || null,
        durationPeriod: durationPeriod || null,
        category: category || null,
        rxnormCode: rxnormCode || null,
        atcCode: atcCode || null,
        snomedCode: snomedCode || null
      }
    });

    res.status(201).json({
      message: 'Custom medication saved successfully',
      exists: false,
      customMedication: customMed
    });
  } catch (error) {
    console.error('Error saving custom medication:', error);
    if (error.code === 'P2002') {
      return res.status(200).json({
        message: 'Custom medication with this name and strength already exists',
        exists: true
      });
    }
    res.status(500).json({ error: error.message });
  }
};

// Search custom medications (for autocomplete)
exports.searchCustomMedications = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { query } = req.query;

    if (!query || query.trim().length < 2) {
      return res.json({ customMedications: [] });
    }

    const searchQuery = query.trim().toLowerCase();

    const customMeds = await prisma.customMedication.findMany({
      where: {
        doctorId: doctorId,
        OR: [
          { name: { contains: searchQuery, mode: 'insensitive' } },
          { genericName: { contains: searchQuery, mode: 'insensitive' } }
        ]
      },
      orderBy: [
        { name: 'asc' },
        { updatedAt: 'desc' }
      ],
      take: 20 // Limit to 20 results
    });

    res.json({ customMedications: customMeds });
  } catch (error) {
    console.error('Error searching custom medications:', error);
    res.status(500).json({ error: error.message });
  }
};

// Create doctor service order (for custom services like Booth Cleaning, Special Treatments, etc.)
exports.createDoctorServiceOrder = async (req, res) => {
  try {
    console.log('🔍 Doctor Service Order Request Body:', JSON.stringify(req.body, null, 2));

    const { visitId, patientId, serviceIds, assignedNurseId, instructions, customPrices, servicePrices, isDeferred } = req.body;
    const effectiveCustomPrices = customPrices || servicePrices;
    const doctorId = req.user.id;

    // Validate required fields
    if (!visitId || !patientId || !serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      return res.status(400).json({ error: 'Missing required fields: visitId, patientId, serviceIds' });
    }

    // Check if visit exists
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: { patient: true }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Check if all services exist
    const services = await prisma.service.findMany({
      where: {
        id: { in: serviceIds },
        isActive: true
      }
    });

    if (services.length !== serviceIds.length) {
      return res.status(404).json({ error: 'One or more services not found or inactive' });
    }

    // Validate custom prices against ranges
    if (effectiveCustomPrices) {
      for (const serviceId of serviceIds) {
        const service = services.find(s => s.id === serviceId);
        if (service && service.isVariablePrice && effectiveCustomPrices[serviceId]) {
          const price = parseFloat(effectiveCustomPrices[serviceId]);
          if (service.minPrice !== null && price < service.minPrice) {
            return res.status(400).json({ error: `Price for ${service.name} is below minimum (${service.minPrice} ETB)` });
          }
          if (service.maxPrice !== null && price > service.maxPrice) {
            return res.status(400).json({ error: `Price for ${service.name} exceeds maximum (${service.maxPrice} ETB)` });
          }
        }
      }
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
      const doctorServiceAssignments = [];
      const serviceNames = [];

      // For deferred orders, create a SEPARATE billing that is already PAID
      // This way the deferred service shows up in billing history but doesn't require new payment
      // and doesn't add to the patient's existing debt
      if (isDeferred) {
        // Create a separate billing for deferred services (marked as PAID)
        const deferredBilling = await tx.billing.create({
          data: {
            patientId,
            visitId,
            totalAmount: 0,
            paidAmount: 0,
            discount: 0,
            isDeferred: true,
            status: 'PAID', // Already paid - connected to previous payment
            notes: 'DEFERRED_CONNECTED: Follow-up services covered by existing credit/payment agreement'
          },
          include: {
            services: true
          }
        });

        let totalIncrease = 0;

        for (const serviceId of serviceIds) {
          const service = services.find(s => s.id === serviceId);
          serviceNames.push(service.name);
          const price = effectiveCustomPrices && effectiveCustomPrices[serviceId] ? parseFloat(effectiveCustomPrices[serviceId]) : service.price;

          // Create nurse assignment as PENDING so nurse can do the work
          const assignment = await tx.nurseServiceAssignment.create({
            data: {
              visitId,
              serviceId,
              assignedNurseId,
              assignedById: doctorId,
              status: 'PENDING', // PENDING so nurse can start work immediately
              notes: instructions || `Doctor ordered (deferred/connected): ${service.name}`,
              orderType: 'DOCTOR_ORDERED',
              isWaived: true, // Mark as waived so billing knows this is pre-paid
              customPrice: effectiveCustomPrices && effectiveCustomPrices[serviceId] ? parseFloat(effectiveCustomPrices[serviceId]) : null
            },
            include: {
              service: true,
              assignedNurse: { select: { id: true, fullname: true, username: true } },
              assignedBy: { select: { id: true, fullname: true, username: true } }
            }
          });
          doctorServiceAssignments.push(assignment);

          // Add service to deferred billing
          await tx.billingService.create({
            data: {
              billingId: deferredBilling.id,
              serviceId,
              quantity: 1,
              unitPrice: price,
              totalPrice: price
            }
          });

          totalIncrease += price;
        }

        // Update deferred billing total and paidAmount to match (already paid)
        const updatedNotes = `DEFERRED_CONNECTED: ${serviceNames.join(', ')} - covered by existing credit/payment`;

        const finalBilling = await tx.billing.update({
          where: { id: deferredBilling.id },
          data: {
            totalAmount: totalIncrease,
            paidAmount: totalIncrease, // Mark as fully paid
            notes: updatedNotes.substring(0, 500)
          }
        });

        return { doctorServiceAssignments, billing: finalBilling };
      }

      // Normal (non-deferred) flow
      let billing = await tx.billing.findFirst({
        where: {
          visitId,
          status: 'PENDING'
        },
        include: {
          services: true
        }
      });

      if (!billing) {
        billing = await tx.billing.create({
          data: {
            patientId,
            visitId,
            totalAmount: 0,
            paidAmount: 0,
            discount: 0,
            isDeferred: false,
            status: 'PENDING',
            notes: ''
          },
          include: {
            services: true
          }
        });
      }

      let totalIncrease = 0;

      // Create doctor service assignments for each service
      for (const serviceId of serviceIds) {
        const service = services.find(s => s.id === serviceId);
        serviceNames.push(service.name);
        const price = effectiveCustomPrices && effectiveCustomPrices[serviceId] ? parseFloat(effectiveCustomPrices[serviceId]) : service.price;

        const assignment = await tx.nurseServiceAssignment.create({
          data: {
            visitId,
            serviceId,
            assignedNurseId,
            assignedById: doctorId,
            status: 'PENDING',
            notes: instructions || `Doctor ordered: ${service.name}`,
            orderType: 'DOCTOR_ORDERED',
            customPrice: effectiveCustomPrices && effectiveCustomPrices[serviceId] ? parseFloat(effectiveCustomPrices[serviceId]) : null
          },
          include: {
            service: true,
            assignedNurse: { select: { id: true, fullname: true, username: true } },
            assignedBy: { select: { id: true, fullname: true, username: true } }
          }
        });
        doctorServiceAssignments.push(assignment);

        // Add service to billing
        const existingBillingService = billing.services.find(bs => bs.serviceId === serviceId);
        if (existingBillingService && !service.isVariablePrice) {
          await tx.billingService.update({
            where: {
              billingId_serviceId: {
                billingId: billing.id,
                serviceId: serviceId
              }
            },
            data: {
              quantity: { increment: 1 },
              totalPrice: { increment: price }
            }
          });
        } else {
          await tx.billingService.create({
            data: {
              billingId: billing.id,
              serviceId,
              quantity: 1,
              unitPrice: price,
              totalPrice: price
            }
          });
        }
        totalIncrease += price;
      }

      // Update billing total and notes
      const updatedNotes = billing.notes
        ? `${billing.notes}; Doctor ordered: ${serviceNames.join(', ')}`
        : `Doctor ordered: ${serviceNames.join(', ')}`;

      const finalBilling = await tx.billing.update({
        where: { id: billing.id },
        data: {
          totalAmount: { increment: totalIncrease },
          notes: updatedNotes.substring(0, 500)
        }
      });

      return { doctorServiceAssignments, billing: finalBilling };
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: doctorId,
        action: 'CREATE_DOCTOR_SERVICE_ORDER',
        entity: 'NurseServiceAssignment',
        entityId: result.doctorServiceAssignments[0]?.id || 0,
        details: JSON.stringify({
          visitId,
          patientId,
          serviceIds,
          assignedNurseId,
          instructions,
          customPrices: effectiveCustomPrices,
          totalAmount: result.billing.totalAmount
        }),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({
      message: `${serviceIds.length} service(s) ordered successfully`,
      assignments: result.doctorServiceAssignments,
      billing: {
        id: result.billing.id,
        totalAmount: result.billing.totalAmount
      },
      visitStatus: visit.status
    });

  } catch (error) {
    console.error('Error creating doctor service order:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get comprehensive patient history
exports.getPatientHistory = async (req, res) => {
  try {
    const { patientId } = req.params;

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        insurance: true
      }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Calculate age from dob
    let age = null;
    if (patient.dob) {
      const today = new Date();
      const birthDate = new Date(patient.dob);
      age = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
    }

    // Build patient object with calculated age
    const patientWithAge = {
      ...patient,
      age,
      gender: patient.gender
    };

    // Get all visits with complete details
    const visits = await prisma.visit.findMany({
      where: { patientId },
      include: {
        parentVisit: {
          select: {
            id: true, visitUid: true, status: true, notes: true, diagnosis: true, diagnosisDetails: true, createdAt: true,
            createdBy: { select: { id: true, fullname: true } }
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
            medicationCatalog: {
              select: {
                id: true,
                name: true,
                genericName: true,
                dosageForm: true,
                strength: true,
                unitPrice: true
              }
            },
            doctor: {
              select: {
                id: true,
                fullname: true,
                qualifications: true,
                licenseNumber: true
              }
            },
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
            services: {
              include: {
                service: true
              }
            },
            payments: true
          }
        },
        pharmacyInvoices: {
          include: {
            dispensedMedicines: {
              include: {
                medicationOrder: true
              }
            }
          }
        },
        batchOrders: {
          include: {
            services: {
              include: {
                investigationType: true,
                service: true
              }
            },
            radiologyResults: {
              include: {
                testType: { select: { id: true, name: true } },
                attachments: { select: { id: true, fileUrl: true, fileName: true } }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        labTestOrders: {
          include: {
            labTest: {
              include: {
                resultFields: {
                  orderBy: { displayOrder: 'asc' }
                }
              }
            },
            results: {
              include: {
                test: {
                  include: {
                    resultFields: {
                      orderBy: { displayOrder: 'asc' }
                    }
                  }
                },
                attachments: true
                // Note: verifiedByUser is not a relation, we fetch it separately below
              },
              orderBy: { createdAt: 'desc' }
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
        },
        patientDiagnoses: {
          include: {
            disease: true
          }
        },
        dentalRecords: true,
        dentalPhotos: true,
        attachedImages: true,
        diagnosisNotes: {
          include: {
            doctor: {
              select: {
                id: true,
                fullname: true,
                role: true
              }
            }
          }
        },
        galleryImages: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                fullname: true,
                role: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        nurseServiceAssignments: {
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
        },
        dentalProcedureCompletions: {
          include: {
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
          orderBy: { completedAt: 'desc' }
        },
        emergencyDrugOrders: {
          include: {
            service: true,
            doctor: {
              select: {
                id: true,
                fullname: true,
                username: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        materialNeedsOrders: {
          include: {
            service: true,
            nurse: {
              select: {
                id: true,
                fullname: true,
                username: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get medical history
    const medicalHistory = await prisma.medicalHistory.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' }
    });

    // Get all card products for resolving cardProductId → name
    const cardProducts = await prisma.cardProduct.findMany({
      select: { id: true, name: true, slug: true, regPrice: true, actPrice: true }
    });
    const cardProductMap = Object.fromEntries(cardProducts.map(cp => [cp.id, cp]));

    // Batch fetch assignments for assigned doctor info
    const assignmentIds = visits.map(v => v.assignmentId).filter(Boolean);
    const assignments = assignmentIds.length > 0
      ? await prisma.assignment.findMany({
          where: { id: { in: assignmentIds } },
          include: {
            doctor: { select: { id: true, fullname: true, role: true, qualifications: true } }
          }
        })
      : [];
    const assignmentDoctorMap = Object.fromEntries(
      assignments.map(a => [a.id, a.doctor])
    );

    // Add radiology and lab results to each visit
    const visitsWithResults = await Promise.all(visits.map(async (visit) => {
      // Debug: Log batch orders for this visit
      console.log(`🔍 Visit ${visit.id}: batchOrders count = ${visit.batchOrders?.length || 0}`);
      if (visit.batchOrders && visit.batchOrders.length > 0) {
        visit.batchOrders.forEach(bo => {
          console.log(`  - BatchOrder ${bo.id}: type=${bo.type}, services count=${bo.services?.length || 0}`);
        });
      }
      // Get radiology results for batch orders
      const radiologyBatchOrderIds = visit.batchOrders
        .filter(bo => bo.type === 'RADIOLOGY')
        .map(bo => bo.id);

      let radiologyResults = [];
      if (radiologyBatchOrderIds.length > 0) {
        const radiologyResultsRaw = await prisma.radiologyResult.findMany({
          where: {
            batchOrderId: {
              in: radiologyBatchOrderIds
            }
          },
          include: {
            testType: true,
            attachments: {
              orderBy: { uploadedAt: 'desc' },
              take: 1 // Get first attachment to find radiologist
            }
          },
          orderBy: { createdAt: 'desc' }
        });

        // Fetch radiologist info from attachments
        radiologyResults = await Promise.all(radiologyResultsRaw.map(async (result) => {
          let radiologistUser = null;
          try {
            if (result.attachments && result.attachments.length > 0 && result.attachments[0]?.uploadedBy) {
              const uploadedById = result.attachments[0].uploadedBy;
              // Only query if ID is valid (not null, not empty, looks like UUID)
              if (uploadedById && typeof uploadedById === 'string' && uploadedById.length > 0) {
                radiologistUser = await prisma.user.findUnique({
                  where: { id: uploadedById },
                  select: { id: true, fullname: true, role: true }
                }).catch(() => null); // Return null on error instead of throwing
              }
            }
          } catch (err) {
            console.error('Error fetching radiologist user:', err);
            // Continue with null radiologistUser
          }
          return {
            ...result,
            radiologistUser: radiologistUser || null
          };
        }));
      }

      // Get detailed lab results from DetailedLabResult table
      const batchOrderIds = visit.batchOrders
        .filter(bo => bo.type === 'LAB')
        .map(bo => bo.id);

      let labResults = [];
      let detailedLabResults = [];
      if (batchOrderIds.length > 0) {
        detailedLabResults = await prisma.detailedLabResult.findMany({
          where: {
            labOrderId: {
              in: batchOrderIds
            }
          },
          include: {
            template: true
          },
          orderBy: { createdAt: 'desc' }
        });

        // Convert detailed lab results to the expected format
        labResults = await Promise.all(detailedLabResults.map(async (result) => {
          // Get template fields
          const templateFields = result.template?.fields || {};

          // Convert results object to array format
          let detailedResultsArray = [];
          if (result.results && typeof result.results === 'object') {
            // If results is an object (key-value pairs), convert to array
            detailedResultsArray = Object.entries(templateFields).map(([fieldName, fieldConfig]) => ({
              testName: fieldName,
              result: result.results[fieldName] || null,
              unit: fieldConfig.unit || '',
              referenceRange: fieldConfig.referenceRange || ''
            }));
          }

          // Fetch verifiedBy user if exists
          let verifiedByUser = null;
          if (result.verifiedBy) {
            try {
              const verifiedById = result.verifiedBy;
              // Only query if ID is valid (not null, not empty, looks like UUID)
              if (verifiedById && typeof verifiedById === 'string' && verifiedById.length > 0) {
                verifiedByUser = await prisma.user.findUnique({
                  where: { id: verifiedById },
                  select: { id: true, fullname: true, role: true }
                }).catch(() => null); // Return null on error instead of throwing
              }
            } catch (err) {
              console.error('Error fetching verifiedBy user:', err);
              // Continue with null verifiedByUser
            }
          }

          return {
            id: result.id,
            testType: {
              name: result.template?.name || 'Lab Test',
              category: result.template?.category || 'GENERAL'
            },
            resultText: detailedResultsArray.length > 0 ? `Detailed results for ${result.template.name}` : null,
            detailedResults: detailedResultsArray,
            additionalNotes: result.additionalNotes || '',
            status: result.status,
            attachments: [], // Detailed lab results don't have separate attachments
            createdAt: result.createdAt,
            verifiedBy: result.verifiedBy,
            verifiedByUser: verifiedByUser,
            verifiedAt: result.verifiedAt
          };
        }));
      }

      // Also include direct labOrders from the visit
      // BUT: Only include if they're not duplicates of batch order services
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/02072a7c-232e-4783-a3a7-bf011c7b47c3', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'doctorController.js:4419', message: 'Processing labOrders for display', data: { visitId: visit.id, labOrdersCount: visit.labOrders?.length || 0, batchOrdersCount: visit.batchOrders?.filter(bo => bo.type === 'LAB').length || 0, labOrders: visit.labOrders?.map(lo => ({ id: lo.id, typeId: lo.typeId, status: lo.status })) || [] }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(() => { });
      // #endregion
      for (const labOrder of visit.labOrders || []) {
        // Check if this labOrder is already represented in batch orders or labResults
        const isInLabResults = labResults.some(lr =>
          lr.id === `laborder-${labOrder.id}` ||
          lr.id === labOrder.id ||
          (lr.testType?.id === labOrder.typeId && lr.createdAt === labOrder.createdAt)
        );

        const isInBatchOrder = visit.batchOrders?.some(bo =>
          bo.type === 'LAB' && bo.services?.some(s =>
            s.investigationTypeId === labOrder.typeId
          ) || bo.id === labOrder.id
        );

        // Skip if it's already in labResults or a batch order (to avoid duplicates)
        if (isInLabResults || isInBatchOrder) {
          console.log(`🔍 Skipping LabOrder ${labOrder.id} - already represented`);
          continue;
        }

        // Check if we already have a detailed result for this lab order
        const hasDetailedResult = detailedLabResults.some(dr =>
          dr.labOrderId === labOrder.id
        );

        // If no detailed result exists, still show the order
        if (!hasDetailedResult) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/02072a7c-232e-4783-a3a7-bf011c7b47c3', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'doctorController.js:4427', message: 'Adding LabOrder to labResults', data: { labOrderId: labOrder.id, typeId: labOrder.typeId, status: labOrder.status, typeName: labOrder.type?.name }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E' }) }).catch(() => { });
          // #endregion
          labResults.push({
            id: `laborder-${labOrder.id}`,
            testType: labOrder.type || { name: 'Lab Test', category: 'GENERAL' },
            resultText: labOrder.result || null,
            detailedResults: [],
            additionalNotes: labOrder.notes || labOrder.additionalNotes || '',
            status: labOrder.status,
            attachments: labOrder.attachments || [],
            createdAt: labOrder.createdAt
          });
        }
      }

      // Also include lab orders from batch order services (both filled and unfilled)
      // IMPORTANT: Always show batch order services, even if they don't have results yet
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/02072a7c-232e-4783-a3a7-bf011c7b47c3', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'doctorController.js:4442', message: 'Processing batchOrder services', data: { visitId: visit.id, labBatchOrdersCount: visit.batchOrders?.filter(bo => bo.type === 'LAB').length || 0, labBatchOrders: visit.batchOrders?.filter(bo => bo.type === 'LAB').map(bo => ({ id: bo.id, status: bo.status, servicesCount: bo.services?.length || 0 })) || [] }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'F' }) }).catch(() => { });
      // #endregion
      for (const batchOrder of visit.batchOrders || []) {
        if (batchOrder.type === 'LAB') {
          for (const service of batchOrder.services || []) {
            // Check if we already have a detailed result for this batch order
            const detailedResult = detailedLabResults.find(dr =>
              dr.labOrderId === batchOrder.id
            );

            // Check if we already added this as a batch service or lab result
            const alreadyAdded = labResults.some(lr =>
              lr.id === `batch-${batchOrder.id}-${service.id}` ||
              lr.id === batchOrder.id ||
              (detailedResult && lr.id === detailedResult.id)
            );

            // Always show the order, even if no result exists yet
            if (!alreadyAdded) {
              // Convert results object to array format if detailed result exists
              let detailedResultsArray = [];
              if (detailedResult && detailedResult.results && typeof detailedResult.results === 'object') {
                const templateFields = detailedResult.template?.fields || {};
                detailedResultsArray = Object.entries(templateFields).map(([fieldName, fieldConfig]) => ({
                  testName: fieldName,
                  result: detailedResult.results[fieldName] || null,
                  unit: fieldConfig.unit || '',
                  referenceRange: fieldConfig.referenceRange || ''
                }));
              }

              let verifiedByUser = null;
              if (detailedResult?.verifiedBy) {
                try {
                  const verifiedById = detailedResult.verifiedBy;
                  if (verifiedById && typeof verifiedById === 'string' && verifiedById.length > 0) {
                    verifiedByUser = await prisma.user.findUnique({
                      where: { id: verifiedById },
                      select: { id: true, fullname: true, role: true }
                    }).catch(() => null);
                  }
                } catch (err) {
                  console.error('Error fetching verifiedBy user for batch lab:', err);
                }
              }

              labResults.push({
                id: `batch-${batchOrder.id}-${service.id}`,
                testType: service.investigationType || service.service || { name: service.service?.name || 'Lab Test', category: 'GENERAL' },
                resultText: service.result || (detailedResult ? `Detailed results for ${detailedResult.template?.name}` : null),
                detailedResults: detailedResultsArray,
                additionalNotes: service.additionalNotes || batchOrder.additionalNotes || '',
                status: service.status || batchOrder.status || 'PENDING',
                attachments: [],
                createdAt: batchOrder.createdAt || service.createdAt,
                verifiedBy: detailedResult?.verifiedBy,
                verifiedByUser: verifiedByUser,
                verifiedAt: detailedResult?.verifiedAt
              });
            }
          }
        }
      }

      // Also include LabTestOrders (new system) with their results
      for (const labTestOrder of visit.labTestOrders || []) {
        // Check if already added
        const alreadyAdded = labResults.some(lr =>
          lr.id === `labtestorder-${labTestOrder.id}`
        );

        if (!alreadyAdded) {
          // Get the result for this order (if exists)
          const orderResult = labTestOrder.results && labTestOrder.results.length > 0
            ? labTestOrder.results[0]
            : null;

          // Convert resultFields to detailedResults format
          let detailedResults = [];
          if (orderResult && orderResult.results && typeof orderResult.results === 'object') {
            const resultFields = labTestOrder.labTest?.resultFields || [];
            detailedResults = resultFields.map(field => {
              const fieldValue = orderResult.results[field.fieldName] || null;
              return {
                testName: field.label || field.fieldName,
                result: fieldValue,
                unit: field.unit || '',
                referenceRange: field.referenceRange || ''
              };
            }).filter(item => item.result !== null); // Only include fields with values
          }

          // Fetch verifiedBy user if exists
          let verifiedByUser = null;
          if (orderResult?.verifiedBy) {
            try {
              const verifiedById = orderResult.verifiedBy;
              if (verifiedById && typeof verifiedById === 'string' && verifiedById.length > 0) {
                verifiedByUser = await prisma.user.findUnique({
                  where: { id: verifiedById },
                  select: { id: true, fullname: true, role: true }
                }).catch(() => null);
              }
            } catch (err) {
              console.error('Error fetching verifiedBy user:', err);
            }
          }

          let processedByUser = null;
          if (orderResult?.processedBy) {
            try {
              const processedById = orderResult.processedBy;
              if (processedById && typeof processedById === 'string' && processedById.length > 0) {
                processedByUser = await prisma.user.findUnique({
                  where: { id: processedById },
                  select: { id: true, fullname: true, role: true }
                }).catch(() => null);
              }
            } catch (err) {
              console.error('Error fetching processedBy user:', err);
            }
          }

          labResults.push({
            id: `labtestorder-${labTestOrder.id}`,
            testType: labTestOrder.labTest || { name: 'Lab Test', category: 'GENERAL' },
            resultText: orderResult?.additionalNotes || null,
            detailedResults: detailedResults,
            additionalNotes: labTestOrder.instructions || orderResult?.additionalNotes || '',
            status: labTestOrder.status || 'PENDING',
            attachments: orderResult?.attachments || [],
            createdAt: labTestOrder.createdAt,
            verifiedBy: orderResult?.verifiedBy || null,
            verifiedByUser: verifiedByUser,
            processedByUser: processedByUser,
            verifiedAt: orderResult?.verifiedAt || null
          });
        }
      }

      // Format medications for frontend (map medicationOrders to medications)
      const medications = visit.medicationOrders?.map(order => ({
        id: order.id,
        medication: order.medicationCatalog || {
          id: null,
          name: order.name,
          genericName: order.genericName,
          dosageForm: order.dosageForm,
          strength: order.strength
        },
        medicationCatalog: order.medicationCatalog,
        name: order.medicationCatalog?.name || order.name,
        dosage: order.dosage || null,
        frequency: order.frequency || null,
        duration: order.duration || null,
        quantity: order.quantity || order.quantityNumeric || null,
        instructions: order.instructions || order.additionalNotes || null,
        status: order.status,
        createdAt: order.createdAt,
        doctor: order.doctor || null // Include doctor who prescribed
      })) || [];

      // Format dental services for frontend
      const dentalServices = visit.dentalProcedureCompletions?.map(completion => ({
        id: completion.id,
        serviceName: completion.batchOrderService?.service?.name || 'Unknown Service',
        serviceCode: completion.batchOrderService?.service?.code || '',
        servicePrice: completion.batchOrderService?.service?.price || 0,
        serviceDescription: completion.batchOrderService?.service?.description || '',
        doctor: completion.doctor?.fullname || null,
        notes: completion.notes || null,
        completedAt: completion.completedAt,
        createdAt: completion.createdAt
      })) || [];

      // Format nurse services for frontend (only completed ones)
      const nurseServices = visit.nurseServiceAssignments?.filter(assignment => assignment.status === 'COMPLETED').map(assignment => ({
        id: assignment.id,
        serviceName: assignment.service?.name || 'Unknown Service',
        serviceCode: assignment.service?.code || '',
        servicePrice: assignment.service?.price || 0,
        serviceDescription: assignment.service?.description || '',
        assignedNurse: assignment.assignedNurse?.fullname || null,
        assignedBy: assignment.assignedBy?.fullname || null,
        notes: assignment.notes || null,
        completedAt: assignment.completedAt,
        createdAt: assignment.createdAt
      })) || [];

      // Format emergency drug orders for frontend
      const emergencyOrders = visit.emergencyDrugOrders?.map(order => ({
        id: order.id,
        serviceName: order.service?.name || 'Unknown Service',
        serviceCode: order.service?.code || '',
        servicePrice: order.service?.price || 0,
        quantity: order.quantity || 1,
        instructions: order.instructions || '',
        notes: order.notes || '',
        status: order.status,
        doctor: order.doctor?.fullname || null,
        dosageForm: order.dosageForm,
        strength: order.strength,
        frequency: order.frequency,
        frequencyPeriod: order.frequencyPeriod,
        duration: order.duration,
        durationPeriod: order.durationPeriod,
        route: order.route,
        completedAt: order.completedAt,
        createdAt: order.createdAt
      })) || [];

      // Format material needs orders for frontend
      const materialNeeds = visit.materialNeedsOrders?.map(order => ({
        id: order.id,
        serviceName: order.service?.name || 'Unknown Service',
        serviceCode: order.service?.code || '',
        servicePrice: order.service?.price || 0,
        quantity: order.quantity || 1,
        instructions: order.instructions || '',
        notes: order.notes || '',
        status: order.status,
        nurse: order.nurse?.fullname || null,
        completedAt: order.completedAt,
        createdAt: order.createdAt
      })) || [];

      // Format procedures for frontend
      const procedures = [];
      // 1. From BatchOrders with type PROCEDURE
      visit.batchOrders?.filter(bo => bo.type === 'PROCEDURE')?.forEach(bo => {
        bo.services?.forEach(s => {
          procedures.push({
            id: s.id,
            name: s.service?.name || s.investigationType?.name || 'Procedure',
            status: s.status || bo.status,
            createdAt: s.createdAt || bo.createdAt
          });
        });
      });
      // 2. From nurseServiceAssignments with category PROCEDURE
      visit.nurseServiceAssignments?.filter(ns => ns.service?.category === 'PROCEDURE')?.forEach(ns => {
        procedures.push({
          id: ns.id,
          name: ns.service?.name || 'Procedure',
          status: ns.status,
          createdAt: ns.createdAt
        });
      });

      // Format radiology orders for frontend (including pending ones)
      const radiologyOrders = [];
      visit.batchOrders?.filter(bo => bo.type === 'RADIOLOGY')?.forEach(bo => {
        bo.services?.forEach(s => {
          radiologyOrders.push({
            id: s.id,
            typeId: s.investigationTypeId,
            investigationTypeId: s.investigationTypeId,
            type: s.investigationType || s.service || { name: 'Radiology' },
            status: s.status || bo.status || 'PENDING',
            createdAt: s.createdAt || bo.createdAt
          });
        });
      });

      // Debug: Log final labResults count
      console.log(`🔍 Visit ${visit.id}: Final labResults count = ${labResults.length}`);
      if (labResults.length > 0) {
        labResults.forEach(lr => {
          console.log(`  - LabResult: id=${lr.id}, testType=${lr.testType?.name || 'N/A'}, status=${lr.status}`);
        });
      }

      // Fetch compound prescriptions for this visit separately
      let compoundPrescriptions = [];
      try {
        compoundPrescriptions = await prisma.compoundPrescription.findMany({
          where: { visitId: visit.id },
          include: { ingredients: true },
          orderBy: { createdAt: 'desc' }
        });
      } catch (cpErr) {
        console.warn('Could not fetch compoundPrescriptions for visit', visit.id, ':', cpErr.message);
      }

      // Fetch abortion care and family planning records for this visit
      let abortionCareRecords = [];
      let familyPlanningRecords = [];
      try {
        abortionCareRecords = await prisma.abortionCareRecord.findMany({
          where: { visitId: visit.id },
          orderBy: { createdAt: 'desc' }
        });
      } catch (acErr) {
        console.warn('Could not fetch abortionCareRecords for visit', visit.id, ':', acErr.message);
      }
      try {
        familyPlanningRecords = await prisma.familyPlanningRecord.findMany({
          where: { visitId: visit.id },
          orderBy: { regDate: 'desc' }
        });
      } catch (fpErr) {
        console.warn('Could not fetch familyPlanningRecords for visit', visit.id, ':', fpErr.message);
      }

      return {
        ...visit,
        doctor: assignmentDoctorMap[visit.assignmentId] || visit.createdBy,
        medicationOrders: visit.medicationOrders || [], // Explicitly include medication orders
        medications: medications, // Also map to medications for frontend compatibility
        radiologyResults,
        radiologyOrders, // Added radiologyOrders for showing pending scans
        procedures, // Added procedures for the Procedures tab
        labResults: labResults, // Include formatted lab results (includes LabTestOrders formatted)
        labOrders: visit.labOrders || [], // Also include raw labOrders for compatibility
        labTestOrders: visit.labTestOrders || [], // Also include raw labTestOrders for frontend checks
        diagnoses: visit.patientDiagnoses || [], // Map patientDiagnoses → diagnoses for frontend
        compoundPrescriptions, // Fetched separately
        dentalServices,
        nurseServices,
        emergencyOrders,
        materialNeeds,
        cardProduct: visit.cardProductId ? (cardProductMap[visit.cardProductId] || null) : null,
        abortionCareRecords,
        familyPlanningRecords
      };
    }));

    // Get transfer records for grouping
    const transfers = await prisma.patientTransfer.findMany({
      where: { patientId },
      select: {
        id: true, fromDoctorId: true, toDoctorId: true, visitId: true, subVisitId: true,
        status: true, reason: true, createdAt: true,
        fromDoctor: { select: { id: true, fullname: true } },
        toDoctor: { select: { id: true, fullname: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      patient: patientWithAge,
      visits: visitsWithResults,
      medicalHistory,
      transfers
    });
  } catch (error) {
    console.error('❌ [getPatientHistory] Error:', error);
    console.error('❌ [getPatientHistory] Stack:', error.stack);
    res.status(500).json({ error: error.message || 'Failed to fetch patient history' });
  }
};

// Generate PDF for patient visit history (with images)
exports.generateVisitHistoryPDF = async (req, res) => {
  try {
    const { patientId, visitId } = req.params;
    const PdfPrinter = require('pdfmake');
    const fs = require('fs');
    const path = require('path');

    const fonts = {
      Roboto: {
        normal: 'node_modules/roboto-font/fonts/Roboto/roboto-regular-webfont.ttf',
        bold: 'node_modules/roboto-font/fonts/Roboto/roboto-bold-webfont.ttf',
      },
    };

    const printer = new PdfPrinter(fonts);

    // Get patient and visit data
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: { insurance: true }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Calculate age from dob
    let age = null;
    if (patient.dob) {
      const today = new Date();
      const birthDate = new Date(patient.dob);
      age = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
    }
    patient.age = age;

    const visit = await prisma.visit.findUnique({
      where: { id: parseInt(visitId) },
      include: {
        createdBy: { select: { fullname: true } },
        vitals: { orderBy: { createdAt: 'desc' } },
        labOrders: { include: { type: true, attachments: true } },
        radiologyOrders: { include: { type: true, attachments: true } },
        medicationOrders: { include: { medicationCatalog: true } },
        diagnosisNotes: { include: { doctor: { select: { fullname: true } } } },
        attachedImages: true,
        galleryImages: { include: { uploadedBy: { select: { fullname: true } } } },
        batchOrders: {
          include: {
            services: { include: { investigationType: true } }
          }
        },
        nurseServiceAssignments: {
          include: {
            bills: {
              include: {
                services: {
                  include: {
                    service: true
                  }
                }
              }
            },
            vitals: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Get lab and radiology results
    const radiologyResults = await prisma.radiologyResult.findMany({
      where: {
        batchOrderId: { in: visit.batchOrders.filter(bo => bo.type === 'RADIOLOGY').map(bo => bo.id) }
      },
      include: { testType: true, attachments: true }
    });

    const detailedLabResults = await prisma.detailedLabResult.findMany({
      where: {
        labOrderId: { in: visit.batchOrders.filter(bo => bo.type === 'LAB').map(bo => bo.id) }
      },
      include: { template: true }
    });

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const formatDateTime = (date) => {
      return new Date(date).toLocaleString('en-US');
    };

    // Build PDF content
    const content = [
      // Header
      {
        text: 'Clinic',
        style: 'header',
        alignment: 'center',
        margin: [0, 0, 0, 5]
      },
      {
        text: 'Patient Medical History Report',
        style: 'subheader',
        alignment: 'center',
        margin: [0, 0, 0, 20]
      },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
        margin: [0, 0, 0, 15]
      },

      // Patient Information
      {
        text: 'Patient Information',
        style: 'sectionTitle',
        margin: [0, 0, 0, 10]
      },
      {
        columns: [
          { text: `Name: ${patient.name}`, style: 'field' },
          { text: `ID: ${patient.id}`, style: 'field' },
          { text: `Gender: ${patient.gender || 'N/A'}`, style: 'field' }
        ],
        margin: [0, 0, 0, 5]
      },
      {
        columns: [
          { text: `Age: ${patient.age || 'N/A'}`, style: 'field' },
          { text: `Blood Type: ${patient.bloodType || 'N/A'}`, style: 'field' },
          { text: `Phone: ${patient.phone || 'N/A'}`, style: 'field' }
        ],
        margin: [0, 0, 0, 15]
      },
      {
        text: `Visit ID: ${visit.visitUid} | Date: ${formatDate(visit.date)} | Status: ${visit.status.replace(/_/g, ' ')}`,
        style: 'field',
        margin: [0, 0, 0, 15]
      },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
        margin: [0, 0, 0, 15]
      }
    ];

    // Add Vitals
    if (visit.vitals && visit.vitals.length > 0) {
      const vital = visit.vitals[0];
      content.push(
        { text: 'Vital Signs', style: 'sectionTitle', margin: [0, 0, 0, 10] },
        {
          columns: [
            { text: `BP: ${vital.bloodPressure || 'N/A'}`, style: 'field' },
            { text: `Temp: ${vital.temperature ? vital.temperature + '°C' : 'N/A'}`, style: 'field' },
            { text: `HR: ${vital.heartRate ? vital.heartRate + ' bpm' : 'N/A'}`, style: 'field' },
            { text: `O2 Sat: ${vital.oxygenSaturation ? vital.oxygenSaturation + '%' : 'N/A'}`, style: 'field' }
          ],
          margin: [0, 0, 0, 10]
        }
      );
      if (vital.chiefComplaint) {
        content.push({ text: `Chief Complaint: ${vital.chiefComplaint}`, style: 'textContent', margin: [0, 0, 0, 5] });
      }
      if (vital.physicalExamination) {
        content.push({ text: `Physical Examination: ${vital.physicalExamination}`, style: 'textContent', margin: [0, 0, 0, 15] });
      }
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }], margin: [0, 0, 0, 15] });
    }

    // Add Diagnosis Notes
    if (visit.diagnosisNotes && visit.diagnosisNotes.length > 0) {
      content.push({ text: 'Diagnosis & Notes', style: 'sectionTitle', margin: [0, 0, 0, 10] });
      visit.diagnosisNotes.forEach(note => {
        content.push({ text: `Dr. ${note.doctor?.fullname || 'Unknown'} - ${formatDateTime(note.createdAt)}`, style: 'field', margin: [0, 0, 0, 5] });
        if (note.chiefComplaint) content.push({ text: `Chief Complaint: ${note.chiefComplaint}`, style: 'textContent', margin: [0, 0, 0, 5] });
        if (note.assessmentAndDiagnosis) content.push({ text: `Diagnosis: ${note.assessmentAndDiagnosis}`, style: 'textContent', margin: [0, 0, 0, 5] });
        if (note.treatmentPlan) content.push({ text: `Treatment Plan: ${note.treatmentPlan}`, style: 'textContent', margin: [0, 0, 0, 10] });
      });
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }], margin: [0, 0, 0, 15] });
    }

    // Add Final Diagnosis
    if (visit.diagnosis) {
      content.push(
        { text: 'Final Diagnosis', style: 'sectionTitle', margin: [0, 0, 0, 10] },
        { text: visit.diagnosis, style: 'textContent', margin: [0, 0, 0, 5] }
      );
      if (visit.diagnosisDetails) {
        content.push({ text: visit.diagnosisDetails, style: 'textContent', margin: [0, 0, 0, 15] });
      }
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }], margin: [0, 0, 0, 15] });
    }

    // Add Lab Results with images
    if (detailedLabResults.length > 0 || visit.labOrders.length > 0) {
      content.push({ text: 'Lab Results', style: 'sectionTitle', margin: [0, 0, 0, 10] });
      detailedLabResults.forEach(result => {
        content.push({ text: result.template.name, style: 'field', margin: [0, 0, 0, 5] });
        if (result.results && typeof result.results === 'object') {
          Object.entries(result.results).forEach(([key, value]) => {
            content.push({ text: `${key}: ${value}`, style: 'textContent', margin: [0, 0, 0, 2] });
          });
        }
        content.push({ text: '', margin: [0, 0, 0, 5] });
      });
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }], margin: [0, 0, 0, 15] });
    }

    // Add Radiology Results with images
    if (radiologyResults.length > 0 || visit.radiologyOrders.length > 0) {
      content.push({ text: 'Radiology Results', style: 'sectionTitle', margin: [0, 0, 0, 10] });
      radiologyResults.forEach(result => {
        content.push({ text: result.testType?.name || 'Radiology Test', style: 'field', margin: [0, 0, 0, 5] });
        if (result.resultText) {
          content.push({ text: result.resultText, style: 'textContent', margin: [0, 0, 0, 5] });
        }
        // Add images if available
        if (result.attachments && result.attachments.length > 0) {
          result.attachments.forEach(attachment => {
            const imagePath = path.join(__dirname, '../../', attachment.path || attachment.fileUrl);
            if (fs.existsSync(imagePath)) {
              try {
                const imageData = fs.readFileSync(imagePath);
                const base64Image = imageData.toString('base64');
                content.push({
                  image: `data:image/jpeg;base64,${base64Image}`,
                  width: 200,
                  margin: [0, 5, 0, 10]
                });
              } catch (err) {
                console.error('Error reading image:', err);
              }
            }
          });
        }
        content.push({ text: '', margin: [0, 0, 0, 5] });
      });
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }], margin: [0, 0, 0, 15] });
    }

    // Add Medications
    if (visit.medicationOrders && visit.medicationOrders.length > 0) {
      content.push({ text: 'Medications', style: 'sectionTitle', margin: [0, 0, 0, 10] });
      visit.medicationOrders.forEach(order => {
        content.push({
          text: `${order.name} - ${order.strength} | Qty: ${order.quantity} | ${order.frequency || 'N/A'}`,
          style: 'textContent',
          margin: [0, 0, 0, 5]
        });
      });
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }], margin: [0, 0, 0, 15] });
    }

    // Add Nurse Services
    const completedNurseServices = visit.nurseServiceAssignments?.filter(assignment => assignment.status === 'COMPLETED') || [];
    if (completedNurseServices.length > 0) {
      content.push({ text: 'Nurse Services', style: 'sectionTitle', margin: [0, 0, 0, 10] });
      completedNurseServices.forEach(service => {
        content.push({
          text: `${service.service?.name || 'Service'} (${service.service?.code || 'N/A'}) - Performed by: ${service.assignedNurse?.fullname || 'N/A'} | ETB ${service.service?.price || 0}`,
          style: 'textContent',
          margin: [0, 0, 0, 5]
        });
        if (service.notes) {
          content.push({
            text: `Notes: ${service.notes}`,
            style: 'textContent',
            margin: [10, 0, 0, 5],
            fontSize: 9
          });
        }
      });
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }], margin: [0, 0, 0, 15] });
    }

    // Add Dental Services
    const dentalCompletions = await prisma.dentalProcedureCompletion.findMany({
      where: { visitId: visit.id },
      include: {
        batchOrderService: {
          include: {
            service: true
          }
        },
        doctor: {
          select: {
            fullname: true
          }
        }
      }
    });

    if (dentalCompletions.length > 0) {
      content.push({ text: 'Dental Services', style: 'sectionTitle', margin: [0, 0, 0, 10] });
      dentalCompletions.forEach(completion => {
        const service = completion.batchOrderService?.service;
        content.push({
          text: `${service?.name || 'Service'} (${service?.code || 'N/A'}) - Performed by: Dr. ${completion.doctor?.fullname || 'N/A'} | ETB ${service?.price || 0}`,
          style: 'textContent',
          margin: [0, 0, 0, 5]
        });
        if (completion.notes) {
          content.push({
            text: `Notes: ${completion.notes}`,
            style: 'textContent',
            margin: [10, 0, 0, 5],
            fontSize: 9
          });
        }
      });
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }], margin: [0, 0, 0, 15] });
    }

    // Add Attached Images
    if (visit.attachedImages && visit.attachedImages.length > 0) {
      content.push({ text: 'Attached Images', style: 'sectionTitle', margin: [0, 0, 0, 10] });
      visit.attachedImages.forEach(image => {
        const imagePath = path.join(__dirname, '../../', image.filePath);
        if (fs.existsSync(imagePath)) {
          try {
            const imageData = fs.readFileSync(imagePath);
            const base64Image = imageData.toString('base64');
            content.push({
              text: image.description || 'Medical Image',
              style: 'field',
              margin: [0, 0, 0, 5]
            });
            content.push({
              image: `data:image/jpeg;base64,${base64Image}`,
              width: 200,
              margin: [0, 5, 0, 10]
            });
          } catch (err) {
            console.error('Error reading image:', err);
          }
        }
      });
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }], margin: [0, 0, 0, 15] });
    }

    // Add Gallery Images
    if (visit.galleryImages && visit.galleryImages.length > 0) {
      content.push({ text: 'Before & After Gallery', style: 'sectionTitle', margin: [0, 0, 0, 10] });
      visit.galleryImages.forEach(image => {
        const imagePath = path.join(__dirname, '../../', image.filePath);
        if (fs.existsSync(imagePath)) {
          try {
            const imageData = fs.readFileSync(imagePath);
            const base64Image = imageData.toString('base64');
            content.push({
              text: `${image.imageType} - ${image.uploadedBy?.fullname || 'Unknown'}`,
              style: 'field',
              margin: [0, 0, 0, 5]
            });
            content.push({
              image: `data:image/jpeg;base64,${base64Image}`,
              width: 200,
              margin: [0, 5, 0, 10]
            });
          } catch (err) {
            console.error('Error reading image:', err);
          }
        }
      });
    }

    // Signature Section
    content.push(
      { text: '', margin: [0, 30, 0, 0] },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 1, color: '#000' }],
        margin: [0, 0, 0, 5]
      },
      {
        text: 'Signature: _________________________',
        style: 'field',
        margin: [0, 0, 0, 5]
      },
      {
        text: 'Date: _________________________',
        style: 'field',
        margin: [0, 0, 0, 20]
      }
    );

    // Footer
    content.push(
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2 }],
        margin: [0, 20, 0, 10]
      },
      {
        text: 'Clinic',
        style: 'footer',
        alignment: 'center',
        margin: [0, 5, 0, 0]
      },
      {
        text: `Generated on: ${formatDateTime(new Date())}`,
        style: 'footer',
        alignment: 'center',
        margin: [0, 0, 0, 0]
      }
    );

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      content: content,
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          color: '#000'
        },
        subheader: {
          fontSize: 14,
          color: '#666'
        },
        sectionTitle: {
          fontSize: 14,
          bold: true,
          color: '#000',
          decoration: 'underline'
        },
        field: {
          fontSize: 11,
          color: '#000'
        },
        textContent: {
          fontSize: 10,
          color: '#000',
          margin: [10, 0, 0, 0]
        },
        footer: {
          fontSize: 9,
          color: '#666'
        }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const fileName = `patient-history-${visit.visitUid}-${Date.now()}.pdf`;
    const filePath = `uploads/${fileName}`;

    pdfDoc.pipe(fs.createWriteStream(filePath));
    pdfDoc.end();

    await new Promise((resolve) => {
      pdfDoc.on('end', resolve);
    });

    res.json({
      message: 'PDF generated successfully',
      fileName,
      filePath: `/uploads/${fileName}`,
      visit
    });
  } catch (error) {
    console.error('Error generating visit history PDF:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.completeVisit = async (req, res) => {
  try {
    const { visitId, diagnosis, diagnosisDetails, instructions, finalNotes, countAsMedicalTreated, needsAppointment, appointmentDate, appointmentTime, appointmentNotes } = completeVisitSchema.parse(req.body);
    const doctorId = req.user.id;

    console.log('🔍 Completing visit:', visitId, 'by doctor:', doctorId, 'countAsMedicalTreated:', countAsMedicalTreated);

    // Check if visit exists
    const visit = await prisma.visit.findUnique({
      where: { id: visitId }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Guard: check if patient has active admission
    const activeAdmission = await prisma.admission.findFirst({
      where: { patientId: visit.patientId, status: 'ADMITTED' },
    });
    if (activeAdmission) {
      return res.status(400).json({
        error: 'Cannot complete visit while patient has an active bed admission. Please discharge the patient from bed management first.',
      });
    }

    // Build notes with marker if needed
    let updatedNotes = visit.notes || '';
    if (finalNotes) {
      updatedNotes = `${updatedNotes}\n\nFinal Notes: ${finalNotes}`.trim();
    }
    if (countAsMedicalTreated) {
      const markerTag = '[DERM_MEDICAL_TREATED]';
      updatedNotes = `${updatedNotes}\n${markerTag}`.trim();
    }

    // Update visit status to COMPLETED directly (simplified)
    await prisma.visit.update({
      where: { id: visitId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        diagnosis: diagnosis || null,
        diagnosisDetails: diagnosisDetails || null,
        instructions: instructions || null,
        notes: updatedNotes || null
      }
    });

    // Create audit log for medical treated marking
    if (countAsMedicalTreated) {
      await prisma.auditLog.create({
        data: {
          userId: doctorId,
          action: 'DERM_MEDICAL_TREATED_MARK',
          entity: 'Visit',
          entityId: visitId,
          details: `Patient marked as medical treated by doctor`,
          createdAt: new Date()
        }
      });
    }

    // Create follow-up appointment if needed (outside transaction)
    if (needsAppointment && appointmentDate && appointmentTime) {
      try {
        await prisma.appointment.create({
          data: {
            patientId: visit.patientId,
            doctorId: doctorId,
            appointmentDate: new Date(appointmentDate),
            appointmentTime: appointmentTime,
            type: 'FOLLOW_UP',
            status: 'SCHEDULED',
            notes: appointmentNotes || 'Follow-up appointment',
            createdById: doctorId
          }
        });
      } catch (apptError) {
        console.error('Warning: Could not create appointment:', apptError.message);
      }
    }

    try {
      getIO().emit('queue:visit-update', {
        visitId,
        patientId: visit.patientId,
        doctorId,
        status: 'COMPLETED',
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error('[WS] Failed to emit completeVisit event:', e.message);
    }

    console.log('✅ Visit completed successfully:', visitId);
    res.json({
      message: 'Visit completed successfully',
      visitId: visit.id,
      visitUid: visit.visitUid
    });
  } catch (error) {
    console.error('Error completing visit:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get patient vitals data for doctor
exports.getPatientVitals = async (req, res) => {
  try {
    const { visitId } = req.params;
    const doctorId = req.user.id;

    // Check if doctor is assigned to this visit
    const visit = await prisma.visit.findUnique({
      where: { id: parseInt(visitId) },
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
        }
      }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Check if doctor is assigned to this patient
    const assignment = await prisma.assignment.findFirst({
      where: {
        patientId: visit.patientId,
        doctorId: doctorId,
        status: {
          in: ['Active', 'Pending']
        }
      }
    });

    // For now, allow any doctor to access vitals (for testing purposes)
    // TODO: Re-enable assignment check in production
    // if (!assignment) {
    //   return res.status(403).json({ error: 'You are not assigned to this patient' });
    // }

    // Get the most recent vitals for this visit
    const vitals = await prisma.vitalSign.findFirst({
      where: {
        visitId: parseInt(visitId)
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!vitals) {
      return res.status(404).json({ error: 'No vitals recorded for this visit' });
    }

    res.json({
      vitals: {
        // Basic Vitals
        bloodPressure: vitals.bloodPressure,
        temperature: vitals.temperature,
        heartRate: vitals.heartRate,
        height: vitals.height,
        weight: vitals.weight,
        bmi: vitals.bmi,
        oxygenSaturation: vitals.oxygenSaturation,
        condition: vitals.condition,
        notes: vitals.notes,

        // Chief Complaint & History
        chiefComplaint: vitals.chiefComplaint,
        historyOfPresentIllness: vitals.historyOfPresentIllness,
        onsetOfSymptoms: vitals.onsetOfSymptoms,
        durationOfSymptoms: vitals.durationOfSymptoms,
        severityOfSymptoms: vitals.severityOfSymptoms,
        associatedSymptoms: vitals.associatedSymptoms,
        relievingFactors: vitals.relievingFactors,
        aggravatingFactors: vitals.aggravatingFactors,

        // Physical Examination
        generalAppearance: vitals.generalAppearance,
        headAndNeck: vitals.headAndNeck,
        cardiovascularExam: vitals.cardiovascularExam,
        respiratoryExam: vitals.respiratoryExam,
        abdominalExam: vitals.abdominalExam,
        extremities: vitals.extremities,
        neurologicalExam: vitals.neurologicalExam,

        createdAt: vitals.createdAt
      },
      patient: visit.patient
    });
  } catch (error) {
    console.error('Error fetching patient vitals:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get current order status for a visit (to show which tests are already ordered)
exports.getVisitOrderStatus = async (req, res) => {
  try {
    const { visitId } = req.params;
    const doctorId = req.user.id;

    // Check if visit exists
    const visit = await prisma.visit.findUnique({
      where: { id: parseInt(visitId) }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Get existing lab orders
    const existingLabOrders = await prisma.labOrder.findMany({
      where: {
        visitId: parseInt(visitId),
        status: {
          in: ['UNPAID', 'PAID', 'QUEUED', 'IN_PROGRESS', 'COMPLETED']
        }
      },
      include: {
        type: true
      }
    });

    // Get existing radiology orders
    const existingRadiologyOrders = await prisma.radiologyOrder.findMany({
      where: {
        visitId: parseInt(visitId),
        status: {
          in: ['UNPAID', 'PAID', 'QUEUED', 'IN_PROGRESS', 'COMPLETED']
        }
      },
      include: {
        type: true
      }
    });

    // Get existing batch orders
    const existingBatchOrders = await prisma.batchOrder.findMany({
      where: {
        visitId: parseInt(visitId),
        status: {
          in: ['UNPAID', 'PAID', 'QUEUED', 'IN_PROGRESS', 'COMPLETED']
        }
      },
      include: {
        services: {
          include: {
            investigationType: true
          }
        }
      }
    });

    // Extract ordered test types
    const orderedLabTypes = new Set();
    const orderedRadiologyTypes = new Set();

    // Add from individual lab orders
    existingLabOrders.forEach(order => {
      orderedLabTypes.add(order.typeId);
    });

    // Add from individual radiology orders
    existingRadiologyOrders.forEach(order => {
      orderedRadiologyTypes.add(order.typeId);
    });

    // Add from batch orders
    existingBatchOrders.forEach(batchOrder => {
      batchOrder.services.forEach(service => {
        if (service.investigationType) {
          if (service.investigationType.category === 'LAB') {
            orderedLabTypes.add(service.investigationType.id);
          } else if (service.investigationType.category === 'RADIOLOGY') {
            orderedRadiologyTypes.add(service.investigationType.id);
          }
        }
      });
    });

    res.json({
      visitId: parseInt(visitId),
      orderedLabTypes: Array.from(orderedLabTypes),
      orderedRadiologyTypes: Array.from(orderedRadiologyTypes),
      labOrders: existingLabOrders.map(order => ({
        id: order.id,
        typeId: order.typeId,
        typeName: order.type.name,
        status: order.status,
        instructions: order.instructions,
        createdAt: order.createdAt
      })),
      radiologyOrders: existingRadiologyOrders.map(order => ({
        id: order.id,
        typeId: order.typeId,
        typeName: order.type.name,
        status: order.status,
        instructions: order.instructions,
        createdAt: order.createdAt
      })),
      batchOrders: existingBatchOrders.map(batchOrder => ({
        id: batchOrder.id,
        type: batchOrder.type,
        status: batchOrder.status,
        services: batchOrder.services.map(service => ({
          id: service.id,
          investigationTypeId: service.investigationType?.id,
          investigationTypeName: service.investigationType?.name,
          category: service.investigationType?.category
        }))
      }))
    });
  } catch (error) {
    console.error('Error fetching visit order status:', error);
    res.status(500).json({ error: error.message });
  }
};

// Batch prescription submission
exports.createBatchPrescription = async (req, res) => {
  try {
    console.log('🔍 createBatchPrescription - Request body:', req.body);
    const { visitId, patientId, medications } = req.body;
    const doctorId = req.user.id;
    console.log('🔍 createBatchPrescription - Extracted:', { visitId, patientId, medications, doctorId });

    // Validate required fields
    if (!visitId || !patientId || !medications || !Array.isArray(medications) || medications.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: visitId, patientId, and medications array'
      });
    }

    // Validate each medication
    const medicationSchema = z.object({
      medicationCatalogId: z.string().nullable().optional(),
      name: z.string().min(1, 'Medication name is required'),
      genericName: z.string().nullable().optional(),
      dosageForm: z.string().min(1, 'Dosage form is required'),
      strength: z.string().min(1, 'Strength is required'),
      quantity: z.number().nullable().optional(), // Optional - no minimum required
      frequency: z.string().nullable().optional(),
      frequencyPeriod: z.string().nullable().optional(),
      duration: z.string().nullable().optional(),
      durationPeriod: z.string().nullable().optional(),
      instructions: z.string().nullable().optional(),
      additionalNotes: z.string().nullable().optional(),
      category: z.string().nullable().optional(),
      type: z.string().default('Prescription'),
      unitPrice: z.number().nullable().optional()
    });

    // Validate all medications
    for (const medication of medications) {
      try {
        medicationSchema.parse(medication);
      } catch (validationError) {
        console.log('🔍 Validation error:', validationError);
        return res.status(400).json({
          success: false,
          error: `Invalid medication data: ${validationError.errors?.[0]?.message || validationError.message}`,
          details: validationError.errors || [validationError.message]
        });
      }
    }

    // Check if visit exists and doctor is assigned
    console.log('🔍 createBatchPrescription - Looking up visit:', parseInt(visitId));
    const visit = await prisma.visit.findUnique({
      where: { id: parseInt(visitId) },
      include: {
        patient: true
      }
    });
    console.log('🔍 createBatchPrescription - Visit found:', !!visit);

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }

    // Check if doctor is assigned to this patient
    const assignment = await prisma.assignment.findFirst({
      where: {
        patientId: visit.patientId,
        doctorId: doctorId,
        status: { in: ['Active', 'Pending'] }
      }
    });
    console.log('🔍 createBatchPrescription - Assignment found:', !!assignment);

    if (!assignment) {
      return res.status(403).json({
        success: false,
        error: 'You are not assigned to this patient'
      });
    }

    // Validate medication catalog IDs if provided
    const catalogIds = medications
      .map(m => m.medicationCatalogId)
      .filter(Boolean);

    if (catalogIds.length > 0) {
      const existingMedications = await prisma.medicationCatalog.findMany({
        where: { id: { in: catalogIds } },
        select: { id: true, name: true, availableQuantity: true }
      });

      const existingIds = existingMedications.map(m => m.id);
      const missingIds = catalogIds.filter(id => !existingIds.includes(id));

      if (missingIds.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Medications not found in catalog: ${missingIds.join(', ')}`
        });
      }

      // Check stock availability
      const lowStockMedications = existingMedications.filter(med => {
        const requestedMed = medications.find(m => m.medicationCatalogId === med.id);
        return requestedMed && med.availableQuantity < requestedMed.quantity;
      });

      if (lowStockMedications.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient stock for some medications',
          lowStock: lowStockMedications.map(med => {
            const requestedMed = medications.find(m => m.medicationCatalogId === med.id);
            return {
              id: med.id,
              name: med.name,
              available: med.availableQuantity,
              requested: requestedMed ? requestedMed.quantity : 0
            };
          })
        });
      }
    }

    // Create medication orders
    console.log('🔍 createBatchPrescription - Creating medication orders...');
    const medicationData = medications.map(medication => ({
      visitId: parseInt(visitId),
      patientId,
      doctorId,
      medicationCatalogId: medication.medicationCatalogId || null,
      name: medication.name,
      genericName: medication.genericName || null,
      dosageForm: medication.dosageForm,
      strength: medication.strength,
      quantity: medication.quantity || null, // Optional
      frequency: medication.frequency || null, // Optional
      frequencyPeriod: medication.frequencyPeriod || null,
      duration: medication.duration || null, // Optional
      durationPeriod: medication.durationPeriod || null,
      instructions: medication.instructions || null, // Optional
      additionalNotes: medication.additionalNotes || null,
      category: medication.category || null,
      type: medication.type || 'Prescription',
      unitPrice: medication.unitPrice || null,
      status: 'UNPAID'
    }));
    console.log('🔍 createBatchPrescription - Medication data:', medicationData);

    const createdOrders = await prisma.medicationOrder.createMany({
      data: medicationData
    });
    console.log('🔍 createBatchPrescription - Created orders:', createdOrders);

    // Create pharmacy invoice for the medications
    const totalAmount = medications.reduce((total, med) => {
      return total + ((med.unitPrice || 0) * med.quantity);
    }, 0);

    const pharmacyInvoice = await prisma.pharmacyInvoice.create({
      data: {
        patientId,
        visitId: parseInt(visitId),
        totalAmount,
        status: 'PENDING',
        notes: 'Doctor prescribed medications',
        type: 'DOCTOR_PRESCRIPTION'
      }
    });

    // Get the created medication orders to link them to invoice items
    const createdOrderIds = await prisma.medicationOrder.findMany({
      where: {
        visitId: parseInt(visitId),
        patientId,
        doctorId
      },
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
      take: medications.length
    });

    // Create pharmacy invoice items for each medication
    const invoiceItems = await prisma.pharmacyInvoiceItem.createMany({
      data: medications.map((medication, index) => ({
        pharmacyInvoiceId: pharmacyInvoice.id,
        medicationOrderId: createdOrderIds[index]?.id || null, // Use createdOrderIds instead of createdOrders
        medicationCatalogId: medication.medicationCatalogId || null,
        name: medication.name,
        dosageForm: medication.dosageForm,
        strength: medication.strength,
        quantity: medication.quantity,
        unitPrice: medication.unitPrice || 0,
        totalPrice: (medication.unitPrice || 0) * medication.quantity
      }))
    });


    // Update visit status to IN_DOCTOR_QUEUE if not already in a valid main queue status
    // This ensures the patient stays visible in the main queue after batch prescription
    // IN_DOCTOR_QUEUE is NOT in sentStatuses, so it will appear in the main queue
    const mainQueueStatuses = ['IN_DOCTOR_QUEUE', 'UNDER_DOCTOR_REVIEW', 'AWAITING_RESULTS_REVIEW', 'WAITING_FOR_DOCTOR', 'TRIAGED'];
    if (!mainQueueStatuses.includes(visit.status)) {
      await prisma.visit.update({
        where: { id: parseInt(visitId) },
        data: { status: 'IN_DOCTOR_QUEUE' }
      });
      console.log('🔍 createBatchPrescription: Updated visit status to IN_DOCTOR_QUEUE to keep patient in main queue');
    } else {
      console.log('🔍 createBatchPrescription: Keeping visit status as', visit.status, '- patient stays in main queue');
    }

    res.status(201).json({
      success: true,
      message: 'Prescription submitted successfully',
      ordersCreated: createdOrders.count,
      pharmacyInvoiceId: pharmacyInvoice.id,
      totalAmount,
      visitId: parseInt(visitId),
      patientId,
      medications: medications.map(med => ({
        name: med.name,
        dosageForm: med.dosageForm,
        strength: med.strength,
        quantity: med.quantity
      }))
    });

  } catch (error) {
    console.error('Error creating batch prescription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create prescription',
      details: error.message
    });
  }
};

// Get prescription history for a visit
exports.getPrescriptionHistory = async (req, res) => {
  try {
    const { visitId } = req.params;
    const doctorId = req.user.id;

    // Check if doctor is assigned to this visit
    const visit = await prisma.visit.findUnique({
      where: { id: parseInt(visitId) },
      include: {
        patient: true,
        vitals: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }

    if (visit.assignments.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'You are not assigned to this patient'
      });
    }

    // Get all medication orders for this visit
    const prescriptions = await prisma.medicationOrder.findMany({
      where: { visitId: parseInt(visitId) },
      include: {
        medicationCatalog: {
          select: {
            id: true,
            name: true,
            genericName: true,
            unitPrice: true,
            availableQuantity: true
          }
        },
        dispensedMedicines: {
          include: {
            pharmacyInvoice: {
              select: {
                id: true,
                invoiceNumber: true,
                status: true,
                dispensedAt: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      prescriptions: prescriptions.map(prescription => ({
        id: prescription.id,
        name: prescription.name,
        genericName: prescription.genericName,
        dosageForm: prescription.dosageForm,
        strength: prescription.strength,
        quantity: prescription.quantity,
        frequency: prescription.frequency,
        duration: prescription.duration,
        instructions: prescription.instructions,
        additionalNotes: prescription.additionalNotes,
        category: prescription.category,
        type: prescription.type,
        unitPrice: prescription.unitPrice,
        status: prescription.status,
        createdAt: prescription.createdAt,
        catalogInfo: prescription.medicationCatalog,
        dispensedInfo: prescription.dispensedMedicines.map(dispensed => ({
          id: dispensed.id,
          quantity: dispensed.quantity,
          status: dispensed.status,
          dispensedAt: dispensed.dispensedAt,
          pharmacyInvoice: dispensed.pharmacyInvoice
        }))
      }))
    });

  } catch (error) {
    console.error('Error fetching prescription history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch prescription history',
      details: error.message
    });
  }
};

// Direct complete visit (for patients who don't need lab/radiology orders)
exports.directCompleteVisit = async (req, res) => {
  try {
    const { visitId, countAsMedicalTreated } = req.body;
    const doctorId = req.user.id;

    // Check if doctor is assigned to this visit
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        patient: true,
        vitals: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!visit) {
      return res.status(404).json({
        success: false,
        error: 'Visit not found'
      });
    }

    // Guard: check if patient has active admission
    const activeAdmission = await prisma.admission.findFirst({
      where: { patientId: visit.patientId, status: 'ADMITTED' },
    });
    if (activeAdmission) {
      return res.status(400).json({
        success: false,
        error: 'Cannot complete visit while patient has an active bed admission. Please discharge the patient from bed management first.',
      });
    }

    // Update visit status to COMPLETED - remove from queue
    await prisma.visit.update({
      where: { id: visitId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Handle medical treated marking for dermatology
    if (countAsMedicalTreated) {
      const markerTag = '[DERM_MEDICAL_TREATED]';
      const currentNotes = visit.notes || '';
      
      await prisma.visit.update({
        where: { id: visitId },
        data: {
          notes: `${currentNotes}\n${markerTag}`.trim()
        }
      });

      await prisma.auditLog.create({
        data: {
          userId: doctorId,
          action: 'DERM_MEDICAL_TREATED_MARK',
          entity: 'Visit',
          entityId: visitId,
          details: `Patient marked as medical treated by doctor`,
          createdAt: new Date()
        }
      });
    }

    res.json({
      success: true,
      message: 'Visit completed successfully'
    });
  } catch (error) {
    console.error('Error completing visit directly:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete visit',
      details: error.message
    });
  }
};

// Save diagnosis notes for a visit
exports.saveDiagnosisNotes = async (req, res) => {
  try {
    const { visitId } = req.params;
    const { notes } = req.body;
    const doctorId = req.user.id;

    console.log('🔍 Saving diagnosis notes for visit:', visitId);
    console.log('📝 Notes data:', Object.keys(notes).map(key => `${key}: ${(notes[key] || '').length} chars`));

    // Sanitize notes data - convert null/undefined to empty strings
    const sanitizedNotes = Object.keys(notes).reduce((acc, key) => {
      acc[key] = notes[key] || '';
      return acc;
    }, {});

    // Check if visit exists and doctor has access
    const visit = await prisma.visit.findUnique({
      where: { id: parseInt(visitId) },
      include: {
        patient: true
      }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Check if doctor has access to this visit
    const assignment = await prisma.assignment.findFirst({
      where: {
        patientId: visit.patientId,
        doctorId: doctorId
      }
    });

    const hasBatchOrder = await prisma.batchOrder.findFirst({
      where: {
        visitId: parseInt(visitId),
        doctorId: doctorId
      }
    });

    const isSuggestedDoctor = visit.suggestedDoctorId === doctorId;

    if (!assignment && !hasBatchOrder && !isSuggestedDoctor) {
      return res.status(403).json({ error: 'Access denied to this visit' });
    }

    // Create or update diagnosis notes
    const existingNotes = await prisma.diagnosisNotes.findFirst({
      where: { visitId: parseInt(visitId) }
    });

    let diagnosisNotes;
    if (existingNotes) {
      // Update existing notes
      diagnosisNotes = await prisma.diagnosisNotes.update({
        where: { id: existingNotes.id },
        data: {
          ...sanitizedNotes,
          updatedAt: new Date(),
          updatedBy: doctorId
        }
      });
    } else {
      // Create new notes
      diagnosisNotes = await prisma.diagnosisNotes.create({
        data: {
          visitId: parseInt(visitId),
          patientId: visit.patientId,
          doctorId: doctorId,
          ...sanitizedNotes,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }

    console.log('✅ Diagnosis notes saved successfully');

    res.json({
      message: 'Diagnosis notes saved successfully',
      notes: diagnosisNotes
    });
  } catch (error) {
    console.error('❌ Error saving diagnosis notes:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get diagnosis notes for a visit
exports.getDiagnosisNotes = async (req, res) => {
  try {
    const { visitId } = req.params;
    const doctorId = req.user.id;

    console.log('🔍 Getting diagnosis notes for visit:', visitId);

    // Check if visit exists
    const visit = await prisma.visit.findUnique({
      where: { id: parseInt(visitId) }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Relaxed check: Admins and Doctors can view notes for any visit to support referrals/certificates
    const isDoctorOrAdmin = req.user.role === 'DOCTOR' || req.user.role === 'ADMIN';

    if (!isDoctorOrAdmin) {
      const assignment = await prisma.assignment.findFirst({
        where: {
          patientId: visit.patientId,
          doctorId: doctorId
        }
      });

      const hasBatchOrder = await prisma.batchOrder.findFirst({
        where: {
          visitId: parseInt(visitId),
          doctorId: doctorId
        }
      });

      const isSuggestedDoctor = visit.suggestedDoctorId === doctorId;

      if (!assignment && !hasBatchOrder && !isSuggestedDoctor) {
        return res.status(403).json({ error: 'Access denied to this visit' });
      }
    }

    // Get diagnosis notes
    const diagnosisNotes = await prisma.diagnosisNotes.findFirst({
      where: { visitId: parseInt(visitId) },
      include: {
        doctor: {
          select: {
            id: true,
            fullname: true
          }
        }
      }
    });

    console.log('✅ Diagnosis notes retrieved successfully');

    res.json({
      notes: diagnosisNotes || {
        chiefComplaint: '',
        historyOfPresentIllness: '',
        pastMedicalHistory: '',
        allergicHistory: '',
        physicalExamination: '',
        investigationFindings: '',
        assessmentAndDiagnosis: '',
        treatmentPlan: '',
        treatmentGiven: '',
        medicationIssued: '',
        additional: '',
        prognosis: ''
      }
    });
  } catch (error) {
    console.error('❌ Error getting diagnosis notes:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update diagnosis notes for a visit
exports.updateDiagnosisNotes = async (req, res) => {
  try {
    const { visitId, noteId } = req.params;
    const { notes } = req.body;
    const doctorId = req.user.id;

    console.log('🔍 Updating diagnosis notes for visit:', visitId, 'noteId:', noteId);

    // Validate visitId
    const visit = await prisma.visit.findUnique({
      where: { id: parseInt(visitId, 10) }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // authorization check: only doctors/health officers/dermatology roles and
    // admins are allowed without an explicit assignment.  for simplicity we
    // treat any user with role 'DOCTOR' as a doctor here (the routing layer
    // already restricts access to doctor endpoints), and admins may bypass.
    const isDoctorOrAdmin = DOCTOR_ROLES.includes(req.user.role) || req.user.role === 'ADMIN';
    if (!isDoctorOrAdmin) {
      const assignment = await prisma.assignment.findFirst({
        where: {
          patientId: visit.patientId,
          doctorId: doctorId
        }
      });
      if (!assignment) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // notes should be an object; guard against bad payloads
    if (!notes || typeof notes !== 'object') {
      return res.status(400).json({ error: 'Invalid notes payload' });
    }

    // Sanitize notes data (strip null/undefined to empty string)
    const sanitizedNotes = Object.keys(notes).reduce((acc, key) => {
      acc[key] = notes[key] || '';
      return acc;
    }, {});

    // Update diagnosis notes; noteId is a UUID string so don't parseInt it
    const diagnosisNotes = await prisma.diagnosisNotes.update({
      where: { id: noteId },
      data: {
        ...sanitizedNotes,
        updatedAt: new Date(),
        updatedBy: doctorId
      }
    });

    console.log('✅ Diagnosis notes updated successfully');
    res.json({
      message: 'Diagnosis notes updated successfully',
      notes: diagnosisNotes
    });
  } catch (error) {
    console.error('❌ Error updating diagnosis notes:', error);
    // include stack to help debugging if log visible
    console.error(error.stack);
    res.status(500).json({ error: error.message });
  }
};
// Delete a visit (doctors can delete any visit without restrictions)
exports.deleteVisit = async (req, res) => {
  try {
    const { visitId } = req.params;
    const doctorId = req.user.id;

    if (!visitId) {
      return res.status(400).json({ error: 'Visit ID is required' });
    }

    // Find the visit with all related data
    const visit = await prisma.visit.findUnique({
      where: { id: parseInt(visitId) },
      include: {
        patient: {
          select: {
            id: true,
            name: true
          }
        },
        bills: true,
        vitals: true,
        labOrders: true,
        labTestOrders: true,
        radiologyOrders: true,
        medicationOrders: true,
        dentalRecords: true,
        dentalPhotos: true,
        attachedImages: true
      }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Start a transaction to delete all related records
    await prisma.$transaction(async (tx) => {
      // Delete related records in correct order (respecting foreign key constraints)

      // 1. Delete patient attached images
      if (visit.attachedImages.length > 0) {
        await tx.patientAttachedImage.deleteMany({
          where: { visitId: parseInt(visitId) }
        });
      }

      // 2. Delete dental photos
      if (visit.dentalPhotos.length > 0) {
        await tx.dentalPhoto.deleteMany({
          where: { visitId: parseInt(visitId) }
        });
      }

      // 3. Delete dental records
      if (visit.dentalRecords.length > 0) {
        await tx.dentalRecord.deleteMany({
          where: { visitId: parseInt(visitId) }
        });
      }

      // 4. Delete vitals
      if (visit.vitals.length > 0) {
        await tx.vitalSign.deleteMany({
          where: { visitId: parseInt(visitId) }
        });
      }

      // 5. Delete lab test results first
      const labTestOrderIds = visit.labTestOrders.map(o => o.id);
      if (labTestOrderIds.length > 0) {
        await tx.labTestResult.deleteMany({
          where: { orderId: { in: labTestOrderIds } }
        });
      }

      // 6. Delete medication orders
      if (visit.medicationOrders.length > 0) {
        await tx.medicationOrder.deleteMany({
          where: { visitId: parseInt(visitId) }
        });
      }

      // 7. Delete radiology orders
      if (visit.radiologyOrders.length > 0) {
        await tx.radiologyOrder.deleteMany({
          where: { visitId: parseInt(visitId) }
        });
      }

      // 8. Delete lab orders (old system)
      if (visit.labOrders.length > 0) {
        await tx.labOrder.deleteMany({
          where: { visitId: parseInt(visitId) }
        });
      }

      // 9. Delete lab test orders (new system)
      if (visit.labTestOrders.length > 0) {
        await tx.labTestOrder.deleteMany({
          where: { visitId: parseInt(visitId) }
        });
      }

      // 10. Delete bills and payments
      if (visit.bills.length > 0) {
        for (const bill of visit.bills) {
          await tx.billPayment.deleteMany({
            where: { billingId: bill.id }
          });

          await tx.billingService.deleteMany({
            where: { billingId: bill.id }
          });
        }

        await tx.billing.deleteMany({
          where: { visitId: parseInt(visitId) }
        });
      }

      // 11. Finally delete the visit
      await tx.visit.delete({
        where: { id: parseInt(visitId) }
      });
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: doctorId,
        action: 'DELETE_VISIT',
        entity: 'Visit',
        entityId: parseInt(visitId),
        details: JSON.stringify({
          visitUid: visit.visitUid,
          patientId: visit.patientId,
          patientName: visit.patient.name,
          visitStatus: visit.status,
          deletedAt: new Date().toISOString(),
          reason: 'Doctor deletion - no restrictions'
        }),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({
      message: 'Visit deleted successfully',
      deletedVisit: {
        id: visit.id,
        visitUid: visit.visitUid,
        patientId: visit.patientId,
        patientName: visit.patient.name,
        status: visit.status
      }
    });

  } catch (error) {
    console.error('Error deleting visit:', error);
    res.status(500).json({ error: error.message });
  }
};
/**
 * Update medication order
 */
exports.updateMedicationOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const doctorId = req.user.id;

    const order = await prisma.medicationOrder.findUnique({
      where: { id: parseInt(id) },
      include: { pharmacyInvoiceItems: true }
    });

    if (!order) {
      return res.status(404).json({ error: 'Medication order not found' });
    }

    if (order.status !== 'UNPAID') {
      return res.status(400).json({ error: 'Only unpaid medication orders can be updated' });
    }

    // Update medication order
    const updatedOrder = await prisma.medicationOrder.update({
      where: { id: parseInt(id) },
      data: {
        name: data.name,
        dosageForm: data.dosageForm,
        strength: data.strength,
        quantity: data.quantity,
        frequencyText: data.frequency,
        duration: data.duration,
        route: data.route,
        instructions: data.instructions,
        additionalNotes: data.additionalNotes,
        category: data.category
      }
    });

    // Handle pharmacy invoice update if quantity or price might have changed
    if (order.pharmacyInvoiceItems.length > 0) {
      const invoiceItem = order.pharmacyInvoiceItems[0];
      const quantity = parseInt(data.quantity) || 1;
      const unitPrice = order.unitPrice || 0;
      const totalPrice = unitPrice * quantity;

      await prisma.pharmacyInvoiceItem.update({
        where: { id: invoiceItem.id },
        data: {
          name: data.name,
          dosageForm: data.dosageForm,
          strength: data.strength,
          quantity: quantity,
          totalPrice: totalPrice
        }
      });

      // Update invoice total
      const invoice = await prisma.pharmacyInvoice.findUnique({
        where: { id: invoiceItem.pharmacyInvoiceId },
        include: { pharmacyInvoiceItems: true }
      });

      const newTotal = invoice.pharmacyInvoiceItems.reduce((sum, item) => sum + item.totalPrice, 0);

      await prisma.pharmacyInvoice.update({
        where: { id: invoice.id },
        data: { totalAmount: newTotal }
      });
    }

    res.json({
      success: true,
      message: 'Medication order updated successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Error updating medication order:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete medication order
 */
exports.deleteMedicationOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const doctorId = req.user.id;

    const order = await prisma.medicationOrder.findUnique({
      where: { id: parseInt(id) },
      include: { pharmacyInvoiceItems: true }
    });

    if (!order) {
      return res.status(404).json({ error: 'Medication order not found' });
    }

    if (order.status !== 'UNPAID') {
      return res.status(400).json({ error: 'Only unpaid medication orders can be deleted' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete pharmacy invoice items
      for (const item of order.pharmacyInvoiceItems) {
        const invoiceId = item.pharmacyInvoiceId;

        await tx.pharmacyInvoiceItem.delete({
          where: { id: item.id }
        });

        // 2. Check if invoice is now empty or needs total update
        const remainingItems = await tx.pharmacyInvoiceItem.findMany({
          where: { pharmacyInvoiceId: invoiceId }
        });

        if (remainingItems.length === 0) {
          await tx.pharmacyInvoice.delete({
            where: { id: invoiceId }
          });
        } else {
          const newTotal = remainingItems.reduce((sum, ri) => sum + ri.totalPrice, 0);
          await tx.pharmacyInvoice.update({
            where: { id: invoiceId },
            data: { totalAmount: newTotal }
          });
        }
      }

      // 3. Delete medication order
      await tx.medicationOrder.delete({
        where: { id: parseInt(id) }
      });
    });

    res.json({
      success: true,
      message: 'Medication order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting medication order:', error);
    res.status(500).json({ error: error.message });
  }
};

// Doctor self-report daily work endpoints
const DW_INCLUDED_CATEGORIES = new Set(['PROCEDURE', 'DENTAL', 'TREATMENT', 'LAB', 'RADIOLOGY', 'EMERGENCY_DRUG', 'CONSULTATION', 'NURSE', 'DOCTOR_WALKIN']);
const DW_PAYMENT_TYPES = ['CASH', 'BANK', 'INSURANCE', 'CHARITY'];

const dwCommissionMap = async (doctorId) => {
  const commissions = await prisma.doctorCommission.findMany({ where: { doctorId } });
  const map = {};
  for (const c of commissions) {
    if (c.percentage > 0) map[c.serviceCategory] = c.percentage;
  }
  return map;
};

const dwDateKey = (dateValue) => {
  const d = new Date(dateValue);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const { isCardRegistration, isCardActivation } = require('../utils/cardBucketHelper');

const getLabServiceToGroupMap = async () => {
  const labTests = await prisma.labTest.findMany({
    where: { serviceId: { not: null }, isActive: true },
    select: { serviceId: true, id: true, groupId: true }
  });
  const map = new Map();
  for (const lt of labTests) {
    map.set(lt.serviceId, { labTestId: lt.id, groupId: lt.groupId });
  }
  return map;
};

const dwRelevantTotals = (billing) => {
  const allServices = Array.isArray(billing?.services) ? billing.services : [];
  const relevantServices = allServices.filter((item) => DW_INCLUDED_CATEGORIES.has(item?.service?.category));
  const billedRelevant = relevantServices.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  const ratio = billing?.totalAmount > 0 ? billedRelevant / billing.totalAmount : 0;
  const paidRelevant = Math.min(billedRelevant, (billing?.paidAmount || 0) * ratio);
  return { billedRelevant, paidRelevant, ratio, relevantServices };
};

const dwVisitWhere = (doctorId, assignmentIds = []) => {
  const orConditions = [{ suggestedDoctorId: doctorId }];
  if (assignmentIds.length > 0) {
    orConditions.push({ assignmentId: { in: assignmentIds } });
  }
  return { OR: orConditions };
};

const dwAssignmentIds = async (doctorId) => {
  const assignments = await prisma.assignment.findMany({ where: { doctorId }, select: { id: true } });
  return assignments.map((item) => item.id);
};

exports.getDailyWorkMonthly = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const year = Number.parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = Number.parseInt(req.query.month, 10);
    const normalizedMonth = Number.isInteger(month) ? month : new Date().getMonth();

    const startDate = new Date(year, normalizedMonth, 1, 0, 0, 0, 0);
    const endDate = new Date(year, normalizedMonth + 1, 0, 23, 59, 59, 999);
    const daysInMonth = new Date(year, normalizedMonth + 1, 0).getDate();

    const assignmentIds = await dwAssignmentIds(doctorId);
    const visitWhere = dwVisitWhere(doctorId, assignmentIds);
    const labServiceMap = await getLabServiceToGroupMap();

    const visits = await prisma.visit.findMany({
      where: { createdAt: { gte: startDate, lte: endDate }, ...visitWhere },
      include: {
        patient: { select: { id: true, name: true } },
        bills: { include: { services: { include: { service: { select: { id: true, name: true, category: true, code: true } } } } } }
      }
    });

    const payments = await prisma.billPayment.findMany({
      where: {
        type: { in: DW_PAYMENT_TYPES },
        createdAt: { gte: startDate, lte: endDate },
        billing: { visit: visitWhere }
      },
      include: {
        billing: {
          select: {
            id: true,
            totalAmount: true,
            paidAmount: true,
            services: { include: { service: { select: { category: true } } } }
          }
        }
      }
    });

    const commissionMap = await dwCommissionMap(doctorId);
    const hasCommission = Object.keys(commissionMap).length > 0;

    const dayMap = new Map();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = `${year}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      dayMap.set(key, {
        date: key,
        day,
        visits: 0,
        patients: 0,
        billedAmount: 0,
        paidAmountByVisitDate: 0,
        collectedAmountByPaymentDate: 0,
        cashCollectedByPaymentDate: 0,
        bankCollectedByPaymentDate: 0,
        insuranceCollectedByPaymentDate: 0,
        charityCollectedByPaymentDate: 0,
        commissionAmount: 0,
        commissionBreakdown: {},
        categoryBreakdown: {},
        cardOpened: { count: 0, revenue: 0 },
        cardActivation: { count: 0, revenue: 0 },
        _patientIds: new Set()
      });
    }

    visits.forEach((visit) => {
      const key = dwDateKey(visit.createdAt);
      const bucket = dayMap.get(key);
      if (!bucket) return;

      bucket.visits += 1;
      if (visit.patient?.id) bucket._patientIds.add(visit.patient.id);

      (visit.bills || []).forEach((billing) => {
        const totals = dwRelevantTotals(billing);
        bucket.billedAmount += totals.billedRelevant;
        bucket.paidAmountByVisitDate += totals.paidRelevant;

        totals.relevantServices.forEach((item) => {
          const cat = item.service?.category || 'OTHER';
          if (!bucket.categoryBreakdown[cat]) bucket.categoryBreakdown[cat] = { count: 0, revenue: 0 };
          let effectiveCount = item.quantity || 1;
          if (cat === 'LAB') {
            const labInfo = labServiceMap.get(item.service?.id);
            if (labInfo?.groupId) {
              const dedupKey = `${billing.id}_${labInfo.groupId}`;
              if (!bucket._labPanelSeen) bucket._labPanelSeen = new Set();
              if (bucket._labPanelSeen.has(dedupKey)) {
                effectiveCount = 0;
              } else {
                bucket._labPanelSeen.add(dedupKey);
                effectiveCount = 1;
              }
            }
          }
          bucket.categoryBreakdown[cat].count += effectiveCount;
          bucket.categoryBreakdown[cat].revenue += item.totalPrice || 0;

          const code = (item.service?.code || '').toUpperCase();
          const name = (item.service?.name || '').toUpperCase();
          if (isCardRegistration(code, name)) {
            bucket.cardOpened.count += item.quantity || 1;
            bucket.cardOpened.revenue += item.totalPrice || 0;
          } else if (isCardActivation(code, name)) {
            bucket.cardActivation.count += item.quantity || 1;
            bucket.cardActivation.revenue += item.totalPrice || 0;
          }

          if (hasCommission) {
            const pct = commissionMap[cat];
            if (pct) {
              const comm = (item.totalPrice || 0) * (pct / 100);
              bucket.commissionAmount += comm;
              if (!bucket.commissionBreakdown[cat]) bucket.commissionBreakdown[cat] = 0;
              bucket.commissionBreakdown[cat] += comm;
            }
          }
        });
      });
    });

    payments.forEach((payment) => {
      const key = dwDateKey(payment.createdAt);
      const bucket = dayMap.get(key);
      if (!bucket) return;

      const totals = dwRelevantTotals(payment.billing);
      const relevantPaymentAmount = (payment.amount || 0) * (totals.ratio || 0);
      bucket.collectedAmountByPaymentDate += relevantPaymentAmount;

      if (payment.type === 'CASH') bucket.cashCollectedByPaymentDate += relevantPaymentAmount;
      if (payment.type === 'BANK') bucket.bankCollectedByPaymentDate += relevantPaymentAmount;
      if (payment.type === 'INSURANCE') bucket.insuranceCollectedByPaymentDate += relevantPaymentAmount;
      if (payment.type === 'CHARITY') bucket.charityCollectedByPaymentDate += relevantPaymentAmount;
    });

    const dailyData = Array.from(dayMap.values())
      .map((item) => ({ ...item, patients: item._patientIds.size, _patientIds: undefined }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const summary = dailyData.reduce((acc, item) => {
      acc.visits += item.visits;
      acc.uniquePatientApprox += item.patients;
      acc.billedAmount += item.billedAmount;
      acc.paidAmountByVisitDate += item.paidAmountByVisitDate;
      acc.collectedAmountByPaymentDate += item.collectedAmountByPaymentDate;
      acc.cashCollectedByPaymentDate += item.cashCollectedByPaymentDate;
      acc.bankCollectedByPaymentDate += item.bankCollectedByPaymentDate;
      acc.insuranceCollectedByPaymentDate += item.insuranceCollectedByPaymentDate;
      acc.charityCollectedByPaymentDate += item.charityCollectedByPaymentDate;
      acc.commissionAmount += item.commissionAmount;

      Object.entries(item.categoryBreakdown || {}).forEach(([cat, val]) => {
        if (!acc.categoryBreakdown[cat]) acc.categoryBreakdown[cat] = { count: 0, revenue: 0 };
        acc.categoryBreakdown[cat].count += val.count;
        acc.categoryBreakdown[cat].revenue += val.revenue;
      });

      Object.entries(item.commissionBreakdown || {}).forEach(([cat, val]) => {
        acc.commissionBreakdown[cat] = (acc.commissionBreakdown[cat] || 0) + val;
      });

      acc.cardOpened.count += item.cardOpened?.count || 0;
      acc.cardOpened.revenue += item.cardOpened?.revenue || 0;
      acc.cardActivation.count += item.cardActivation?.count || 0;
      acc.cardActivation.revenue += item.cardActivation?.revenue || 0;

      return acc;
    }, {
      visits: 0,
      uniquePatientApprox: 0,
      billedAmount: 0,
      paidAmountByVisitDate: 0,
      collectedAmountByPaymentDate: 0,
      cashCollectedByPaymentDate: 0,
      bankCollectedByPaymentDate: 0,
      insuranceCollectedByPaymentDate: 0,
      charityCollectedByPaymentDate: 0,
      commissionAmount: 0,
      commissionBreakdown: {},
      categoryBreakdown: {},
      cardOpened: { count: 0, revenue: 0 },
      cardActivation: { count: 0, revenue: 0 }
    });

    return res.json({ year, month: normalizedMonth, summary, dailyData, hasCommission });
  } catch (error) {
    console.error('Error fetching doctor daily work monthly data:', error);
    return res.status(500).json({ error: error.message });
  }
};

exports.getDailyWorkDayDetails = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const { date } = req.query;

    if (!date) return res.status(400).json({ error: 'Date is required in YYYY-MM-DD format' });

    const parsedDate = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const dayStart = new Date(parsedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(parsedDate);
    dayEnd.setHours(23, 59, 59, 999);

    const assignmentIds = await dwAssignmentIds(doctorId);
    const visitWhere = dwVisitWhere(doctorId, assignmentIds);

    const commissionMap = await dwCommissionMap(doctorId);
    const hasCommission = Object.keys(commissionMap).length > 0;
    const labServiceMap = await getLabServiceToGroupMap();

    const visits = await prisma.visit.findMany({
      where: { createdAt: { gte: dayStart, lte: dayEnd }, ...visitWhere },
      include: {
        patient: { select: { id: true, name: true, gender: true, age: true } },
        bills: { include: { services: { include: { service: { select: { id: true, name: true, category: true, code: true } } } } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const paymentsOnDate = await prisma.billPayment.findMany({
      where: {
        type: { in: DW_PAYMENT_TYPES },
        createdAt: { gte: dayStart, lte: dayEnd },
        billing: { visit: visitWhere }
      },
      include: {
        billing: {
          include: {
            visit: { select: { id: true, createdAt: true, patient: { select: { id: true, name: true } } } },
            services: { include: { service: { select: { category: true } } } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const visitDetails = visits.map((visit) => {
      const relevantServices = [];
      let billedAmount = 0;
      let paidAmountByVisitDate = 0;
      let commissionAmount = 0;

      (visit.bills || []).forEach((billing) => {
        const totals = dwRelevantTotals(billing);
        billedAmount += totals.billedRelevant;
        paidAmountByVisitDate += totals.paidRelevant;

        totals.relevantServices.forEach((serviceItem) => {
          const cat = serviceItem.service?.category;
          const pct = commissionMap[cat];
          const commission = pct ? (serviceItem.totalPrice || 0) * (pct / 100) : 0;
          commissionAmount += commission;
          relevantServices.push({
            billingId: billing.id,
            serviceId: serviceItem.service?.id,
            serviceName: serviceItem.service?.name,
            serviceCode: serviceItem.service?.code || '',
            category: cat,
            quantity: serviceItem.quantity,
            unitPrice: serviceItem.unitPrice,
            totalPrice: serviceItem.totalPrice,
            commissionPct: pct || 0,
            commissionAmount: commission,
          });
        });
      });

      return {
        visitId: visit.id,
        visitUid: visit.visitUid,
        patientId: visit.patient?.id,
        patientName: visit.patient?.name,
        patientGender: visit.patient?.gender,
        patientAge: visit.patient?.age,
        visitCreatedAt: visit.createdAt,
        billedAmount,
        paidAmountByVisitDate,
        commissionAmount,
        services: relevantServices
      };
    });

    const paymentDetails = paymentsOnDate.map((payment) => {
      const totals = dwRelevantTotals(payment.billing);
      const relevantPaymentAmount = (payment.amount || 0) * (totals.ratio || 0);
      return {
        paymentId: payment.id,
        billingId: payment.billingId,
        paymentType: payment.type,
        amount: payment.amount || 0,
        relevantAmount: relevantPaymentAmount,
        bankName: payment.bankName,
        transNumber: payment.transNumber,
        patientId: payment.billing?.visit?.patient?.id,
        patientName: payment.billing?.visit?.patient?.name,
        visitId: payment.billing?.visit?.id,
        visitDate: payment.billing?.visit?.createdAt,
        createdAt: payment.createdAt
      };
    });

    const uniquePatients = new Set(visitDetails.map((item) => item.patientId).filter(Boolean));

    const categoryBreakdown = {};
    const commissionBreakdown = {};
    let cardOpened = { count: 0, revenue: 0 };
    let cardActivation = { count: 0, revenue: 0 };
    const labPanelSeen = new Set();

    visitDetails.forEach((v) => {
      (v.services || []).forEach((svc) => {
        const cat = svc.category || 'OTHER';
        if (!categoryBreakdown[cat]) categoryBreakdown[cat] = { count: 0, revenue: 0 };
        let effectiveCount = svc.quantity || 1;
        if (cat === 'LAB') {
          const labInfo = labServiceMap.get(svc.serviceId);
          if (labInfo?.groupId) {
            const dedupKey = `${svc.billingId}_${labInfo.groupId}`;
            if (labPanelSeen.has(dedupKey)) {
              effectiveCount = 0;
            } else {
              labPanelSeen.add(dedupKey);
              effectiveCount = 1;
            }
          }
        }
        categoryBreakdown[cat].count += effectiveCount;
        categoryBreakdown[cat].revenue += svc.totalPrice || 0;

        if (svc.commissionPct > 0) {
          commissionBreakdown[cat] = (commissionBreakdown[cat] || 0) + (svc.commissionAmount || 0);
        }

        const code = (svc.serviceCode || '').toUpperCase();
        const name = (svc.serviceName || '').toUpperCase();
        if (isCardRegistration(code, name)) {
          cardOpened.count += svc.quantity || 1;
          cardOpened.revenue += svc.totalPrice || 0;
        } else if (isCardActivation(code, name)) {
          cardActivation.count += svc.quantity || 1;
          cardActivation.revenue += svc.totalPrice || 0;
        }
      });
    });

    const summary = {
      date,
      visits: visitDetails.length,
      patients: uniquePatients.size,
      billedAmount: visitDetails.reduce((sum, item) => sum + item.billedAmount, 0),
      paidAmountByVisitDate: visitDetails.reduce((sum, item) => sum + item.paidAmountByVisitDate, 0),
      collectedAmountByPaymentDate: paymentDetails.reduce((sum, item) => sum + item.relevantAmount, 0),
      cashCollectedByPaymentDate: paymentDetails.filter((item) => item.paymentType === 'CASH').reduce((sum, item) => sum + item.relevantAmount, 0),
      bankCollectedByPaymentDate: paymentDetails.filter((item) => item.paymentType === 'BANK').reduce((sum, item) => sum + item.relevantAmount, 0),
      insuranceCollectedByPaymentDate: paymentDetails.filter((item) => item.paymentType === 'INSURANCE').reduce((sum, item) => sum + item.relevantAmount, 0),
      charityCollectedByPaymentDate: paymentDetails.filter((item) => item.paymentType === 'CHARITY').reduce((sum, item) => sum + item.relevantAmount, 0),
      commissionAmount: visitDetails.reduce((sum, item) => sum + item.commissionAmount, 0),
      commissionBreakdown,
      categoryBreakdown,
      cardOpened,
      cardActivation
    };

    return res.json({ date, summary, visits: visitDetails, paymentsOnDate: paymentDetails, hasCommission });
  } catch (error) {
    console.error('Error fetching doctor daily work day details:', error);
    return res.status(500).json({ error: error.message });
  }
};


// Bulk complete all active visits for the logged-in doctor
exports.bulkCompleteActiveVisits = async (req, res) => {
  try {
    const doctorId = req.user.id;

    // Also find assignments for this doctor
    const assignments = await prisma.assignment.findMany({
      where: { doctorId, status: 'ACTIVE' },
      select: { id: true }
    });
    const assignmentIds = assignments.map(a => a.id);
    console.log('Doctor ID:', doctorId, 'Found assignments:', assignmentIds.length);

    const activeVisits = await prisma.visit.findMany({
      where: {
        OR: [
          { createdById: doctorId },
          { suggestedDoctorId: doctorId },
          { assignmentId: { in: assignmentIds } }
        ],
        status: { notIn: ['COMPLETED', 'CANCELLED'] }
      },
      select: { id: true, visitUid: true, status: true, patientId: true }
    });
    console.log('Active visits found:', activeVisits.length, 'IDs:', activeVisits.map(v => v.id + ':' + v.status));

    // Check for active bed admissions — skip those patients
    const visitPatientIds = [...new Set(activeVisits.filter(v => v.patientId).map(v => v.patientId))];
    let patientIdsWithBeds = new Set();
    if (visitPatientIds.length > 0) {
      const activeAdmissions = await prisma.admission.findMany({
        where: {
          patientId: { in: visitPatientIds },
          status: 'ADMITTED'
        },
        select: { patientId: true }
      });
      patientIdsWithBeds = new Set(activeAdmissions.map(a => a.patientId));
    }

    const visitsToComplete = activeVisits.filter(v => !patientIdsWithBeds.has(v.patientId));
    const skippedVisits = activeVisits.filter(v => patientIdsWithBeds.has(v.patientId));
    const count = visitsToComplete.length;
    const skippedCount = skippedVisits.length;

    if (count === 0) {
      return res.json({
        success: true,
        message: skippedCount > 0
          ? `No visits to complete (${skippedCount} patient(s) skipped due to active bed admission)`
          : 'No active visits to complete',
        count: 0,
        skipped: skippedCount,
        skippedVisitUids: skippedVisits.map(v => v.visitUid)
      });
    }

    const visitIds = visitsToComplete.map(v => v.id);

    await prisma.visit.updateMany({
      where: { id: { in: visitIds } },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        updatedAt: new Date()
      }
    });

    let message = `Completed ${count} visit(s) successfully`;
    if (skippedCount > 0) {
      message += `. ${skippedCount} patient(s) skipped (active bed admission)`;
    }

    res.json({
      success: true,
      message,
      count,
      skipped: skippedCount,
      skippedVisitUids: skippedVisits.map(v => v.visitUid)
    });
  } catch (error) {
    console.error('Error bulk completing visits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getProcedureGroups = async (req, res) => {
  try {
    const services = await prisma.service.findMany({
      where: {
        category: 'PROCEDURE',
        isActive: true
      },
      select: {
        id: true,
        code: true,
        name: true,
        price: true,
        description: true,
        unit: true,
        isVariablePrice: true,
        minPrice: true,
        maxPrice: true,
        procedureGroup: true
      },
      orderBy: { name: 'asc' }
    });

    const groups = {};
    for (const s of services) {
      const group = s.procedureGroup || 'OTHER';
      if (!groups[group]) groups[group] = [];
      groups[group].push(s);
    }

    res.json({ groups });
  } catch (error) {
    console.error('Error fetching procedure groups:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.createExternalPrescription = async (req, res) => {
  try {
    const { visitId, patientId, name, strength, instructionText } = req.body;
    const doctorId = req.user.id;

    if (!visitId || !patientId || !name) {
      return res.status(400).json({ error: 'visitId, patientId, and name are required' });
    }

    const order = await prisma.medicationOrder.create({
      data: {
        visitId: parseInt(visitId),
        doctorId,
        patientId: String(patientId),
        name,
        strength: strength || 'N/A',
        dosageForm: 'N/A',
        instructionText: instructionText || null,
        instructions: instructionText || null,
        type: 'EXTERNAL',
        status: 'UNPAID'
      }
    });

    res.json({ message: 'External prescription saved', order });
  } catch (error) {
    console.error('Error creating external prescription:', error);
    res.status(500).json({ error: 'Failed to save external prescription' });
  }
};

exports.getExternalPrescriptions = async (req, res) => {
  try {
    const { visitId } = req.params;
    const orders = await prisma.medicationOrder.findMany({
      where: { visitId: parseInt(visitId), type: 'EXTERNAL' },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ externalPrescriptions: orders });
  } catch (error) {
    console.error('Error fetching external prescriptions:', error);
    res.status(500).json({ error: 'Failed to fetch external prescriptions' });
  }
};
