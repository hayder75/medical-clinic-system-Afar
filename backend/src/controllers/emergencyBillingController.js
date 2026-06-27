const prisma = require('../config/database');
const { z } = require('zod');


// Schema for adding services to emergency billing
const addServiceSchema = z.object({
  billingId: z.string(),
  serviceId: z.string(),
  quantity: z.number().min(1).default(1),
  notes: z.string().optional()
});

// Schema for emergency payment processing
const emergencyPaymentSchema = z.object({
  billingId: z.union([z.string(), z.number()]).transform(val => parseInt(val)),
  amount: z.union([z.string(), z.number()]).transform(val => parseFloat(val)),
  type: z.enum(['CASH', 'BANK', 'INSURANCE']),
  bankName: z.string().optional(),
  transNumber: z.string().optional(),
  insuranceId: z.string().optional(),
  notes: z.string().optional()
});

// Get all emergency patients with their billing information
exports.getEmergencyPatients = async (req, res) => {
  try {
    const emergencyVisits = await prisma.visit.findMany({
      where: {
        isEmergency: true,
        status: {
          in: ['WAITING_FOR_TRIAGE', 'TRIAGED', 'WAITING_FOR_DOCTOR', 'UNDER_DOCTOR_REVIEW', 'AWAITING_RESULTS_REVIEW', 'SENT_TO_PHARMACY', 'COMPLETED']
        }
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            mobile: true,
            type: true
          }
        },
        bills: {
          where: {
            billingType: 'EMERGENCY',
            status: {
              in: ['EMERGENCY_PENDING', 'PAID']
            }
          },
          include: {
            services: {
              include: {
                service: {
                  select: {
                    name: true,
                    price: true,
                    code: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Calculate running totals for each emergency patient
    const emergencyPatients = emergencyVisits.map(visit => {
      const billing = visit.bills[0]; // Should only have one emergency billing per visit
      const totalAmount = billing ? billing.services.reduce((sum, service) => 
        sum + (service.totalPrice), 0) : 0;

      return {
        visitId: visit.id,
        visitUid: visit.visitUid,
        patient: visit.patient,
        billing: billing ? {
          ...billing,
          totalAmount
        } : null,
        status: visit.status,
        createdAt: visit.createdAt
      };
    });

    res.json({
      emergencyPatients,
      total: emergencyPatients.length
    });
  } catch (error) {
    console.error('Error fetching emergency patients:', error);
    res.status(500).json({ error: error.message });
  }
};

// Add service to emergency billing
exports.addServiceToEmergency = async (req, res) => {
  try {
    const validatedData = addServiceSchema.parse(req.body);
    const billingOfficerId = req.user.id;

    // Get the billing record
    const billing = await prisma.billing.findUnique({
      where: { id: validatedData.billingId },
      include: {
        patient: true,
        visit: true
      }
    });

    if (!billing) {
      return res.status(404).json({ error: 'Emergency billing not found' });
    }

    if (billing.billingType !== 'EMERGENCY') {
      return res.status(400).json({ error: 'This is not an emergency billing record' });
    }

    // Get the service
    const service = await prisma.service.findUnique({
      where: { id: validatedData.serviceId }
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    if (!service.isActive) {
      return res.status(400).json({ error: 'Service is not active' });
    }

    // Check if service already exists in billing
    const existingService = await prisma.billingService.findUnique({
      where: {
        billingId_serviceId: {
          billingId: validatedData.billingId,
          serviceId: validatedData.serviceId
        }
      }
    });

    let billingService;
    if (existingService) {
      // Update quantity
      billingService = await prisma.billingService.update({
        where: { id: existingService.id },
        data: {
          quantity: existingService.quantity + validatedData.quantity,
          totalPrice: (existingService.quantity + validatedData.quantity) * service.price
        }
      });
    } else {
      // Create new service entry
      billingService = await prisma.billingService.create({
        data: {
          billingId: validatedData.billingId,
          serviceId: validatedData.serviceId,
          quantity: validatedData.quantity,
          unitPrice: service.price,
          totalPrice: validatedData.quantity * service.price
        }
      });
    }

    // Update total amount
    const allServices = await prisma.billingService.findMany({
      where: { billingId: validatedData.billingId }
    });

    const totalAmount = allServices.reduce((sum, service) => sum + service.totalPrice, 0);

    await prisma.billing.update({
      where: { id: validatedData.billingId },
      data: { totalAmount }
    });

    // Log action
    await prisma.auditLog.create({
      data: {
        action: 'EMERGENCY_SERVICE_ADDED',
        entity: 'BillingService',
        entityId: billingService.id,
        userId: billingOfficerId,
        details: `Added ${validatedData.quantity}x ${service.name} (${service.code}) to emergency billing for patient ${billing.patient.name}. Total: ETB ${billingService.totalPrice}`
      }
    });

    res.json({
      billingService,
      totalAmount,
      message: `Service added successfully. New total: ETB ${totalAmount}`
    });
  } catch (error) {
    console.error('Error adding service to emergency billing:', error);
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

// Remove service from emergency billing
exports.removeServiceFromEmergency = async (req, res) => {
  try {
    const { billingServiceId } = req.params;
    const billingOfficerId = req.user.id;

    // Get the billing service
    const billingService = await prisma.billingService.findUnique({
      where: { id: billingServiceId },
      include: {
        billing: {
          include: {
            patient: true
          }
        },
        service: true
      }
    });

    if (!billingService) {
      return res.status(404).json({ error: 'Billing service not found' });
    }

    if (billingService.billing.billingType !== 'EMERGENCY') {
      return res.status(400).json({ error: 'This is not an emergency billing service' });
    }

    // Delete the service
    await prisma.billingService.delete({
      where: { id: billingServiceId }
    });

    // Update total amount
    const remainingServices = await prisma.billingService.findMany({
      where: { billingId: billingService.billing.id }
    });

    const totalAmount = remainingServices.reduce((sum, service) => sum + service.totalPrice, 0);

    await prisma.billing.update({
      where: { id: billingService.billing.id },
      data: { totalAmount }
    });

    // Log action
    await prisma.auditLog.create({
      data: {
        action: 'EMERGENCY_SERVICE_REMOVED',
        entity: 'BillingService',
        entityId: billingService.id,
        userId: billingOfficerId,
        details: `Removed ${billingService.service.name} (${billingService.service.code}) from emergency billing for patient ${billingService.billing.patient.name}. Amount removed: ETB ${billingService.totalPrice}`
      }
    });

    res.json({
      totalAmount,
      message: `Service removed successfully. New total: ETB ${totalAmount}`
    });
  } catch (error) {
    console.error('Error removing service from emergency billing:', error);
    res.status(500).json({ error: error.message });
  }
};

// Process emergency payment - Simplified status update
exports.processEmergencyPayment = async (req, res) => {
  try {
    console.log('Emergency payment request body:', JSON.stringify(req.body, null, 2));
    
    const { billingId, amount, type, bankName, transNumber, notes } = req.body;
    const billingOfficerId = req.user.id;

    if (!billingId) {
      return res.status(400).json({ error: 'Billing ID is required' });
    }

    // Get the billing record
    const billing = await prisma.billing.findUnique({
      where: { id: billingId },
      include: {
        patient: true,
        visit: true,
        services: {
          include: {
            service: true
          }
        }
      }
    });

    if (!billing) {
      return res.status(404).json({ error: 'Emergency billing not found' });
    }

    if (billing.billingType !== 'EMERGENCY') {
      return res.status(400).json({ error: 'This is not an emergency billing record' });
    }

    if (billing.status !== 'EMERGENCY_PENDING') {
      return res.status(400).json({ error: 'Emergency billing is not pending payment' });
    }

    const paidAmount = amount ? parseFloat(amount) : billing.totalAmount;

    console.log('Updating emergency billing status...');

    // Create bill payment record for proper financial tracking
    await prisma.billPayment.create({
      data: {
        billingId: billing.id,
        amount: paidAmount,
        type: type || 'CASH',
        bankName: bankName || null,
        transNumber: transNumber || null,
        processedById: billingOfficerId
      }
    });

    // Update billing status to PAID
    await prisma.billing.update({
      where: { id: billingId },
      data: { 
        status: 'PAID',
        totalAmount: paidAmount,
        notes: `Emergency payment processed by billing officer. ${notes || ''}`.trim()
      }
    });

    // Update linked emergency drug orders to PAID
    await prisma.emergencyDrugOrder.updateMany({
      where: { billingId: billing.id, status: 'UNPAID' },
      data: { status: 'PAID' }
    });

    // Update linked material needs orders to PAID
    await prisma.materialNeedsOrder.updateMany({
      where: { billingId: billing.id, status: 'UNPAID' },
      data: { status: 'PAID' }
    });

    console.log('Billing status updated');

    // Log action
    await prisma.auditLog.create({
      data: {
        action: 'EMERGENCY_PAYMENT_PROCESSED',
        entity: 'Billing',
        entityId: 0,
        userId: billingOfficerId,
        details: `Emergency payment of ETB ${paidAmount} (${type || 'CASH'}) processed for patient ${billing.patient.name}. Linked orders marked PAID.`
      }
    });

    console.log('Audit log created');

    res.json({
      billing: {
        ...billing,
        status: 'PAID',
        totalAmount: paidAmount
      },
      message: `Emergency payment of ETB ${paidAmount} processed successfully. The visit will proceed through the normal workflow.`
    });
  } catch (error) {
    console.error('Error processing emergency payment:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get available services for emergency billing
exports.getEmergencyServices = async (req, res) => {
  try {
    const services = await prisma.service.findMany({
      where: {
        isActive: true,
        category: {
          in: ['CONSULTATION', 'EMERGENCY', 'DIAGNOSTIC', 'TREATMENT', 'PROCEDURE', 'MEDICATION']
        }
      },
      select: {
        id: true,
        name: true,
        code: true,
        price: true,
        category: true,
        description: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json({ services });
  } catch (error) {
    console.error('Error fetching emergency services:', error);
    res.status(500).json({ error: error.message });
  }
};
