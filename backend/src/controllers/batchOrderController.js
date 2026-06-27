const prisma = require('../config/database');
const { z } = require('zod');


// Validation schemas
const createBatchOrderSchema = z.object({
  visitId: z.union([z.number(), z.string()]).transform(val => typeof val === 'string' ? parseInt(val, 10) : val),
  patientId: z.string(),
  type: z.enum(['LAB', 'RADIOLOGY', 'MIXED', 'NURSE', 'DENTAL', 'PROCEDURE']),
  instructions: z.string().optional(),
  assignedNurseId: z.string().optional(), // For nurse services
  services: z.array(z.object({
    serviceId: z.string(),
    investigationTypeId: z.number().optional(),
    instructions: z.string().optional(),
    customPrice: z.number().optional().nullable()
  })).optional(), // Optional for new lab test system
  labTestIds: z.array(z.string().uuid()).optional(), // New: array of lab test IDs
  isDeferred: z.boolean().optional()
});

// Create a batch order
exports.createBatchOrder = async (req, res) => {
  try {
    const parseResult = createBatchOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.error('❌ Validation error:', parseResult.error.errors);
      return res.status(400).json({ error: 'Validation error', details: parseResult.error.errors });
    }

    const { visitId, patientId, type, instructions, services, assignedNurseId, isDeferred } = parseResult.data;
    const doctorId = req.user.id;

    // Check if visit exists and is in correct status
    const visit = await prisma.visit.findUnique({
      where: { id: visitId }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Block only true read-only visit states. Diagnostic ordering should remain possible
    // even if upstream workflow status is lagging behind triage/consultation transitions.
    if (['COMPLETED', 'CANCELLED'].includes(visit.status)) {
      return res.status(400).json({
        error: 'Completed or cancelled visits are read-only. Open an active visit to place new orders.',
        status: visit.status
      });
    }

    // For emergency patients, use the assigned doctor's ID instead of requesting user's ID
    let actualDoctorId = doctorId;
    if (visit.isEmergency && visit.assignmentId) {
      const assignment = await prisma.assignment.findUnique({
        where: { id: visit.assignmentId },
        select: { doctorId: true }
      });
      if (assignment) {
        actualDoctorId = assignment.doctorId;
        // Emergency patient - Using assigned doctor ID
      }
    } else {
      // Regular patient - Using requesting user ID
    }

    // For nurse services or procedures with nurse assignment, validate assigned nurse
    if ((type === 'NURSE' || type === 'PROCEDURE') && assignedNurseId) {
      const assignedNurse = await prisma.user.findUnique({
        where: { id: assignedNurseId, role: 'NURSE', availability: true }
      });

      if (!assignedNurse) {
        return res.status(404).json({ error: 'Nurse not found or not available' });
      }
    }

    // Validate all services exist
    const serviceIds = services.map(s => s.serviceId);
    const uniqueServiceIds = [...new Set(serviceIds)]; // Get unique service IDs
    const investigationTypeIds = services.map(s => s.investigationTypeId).filter(Boolean);

    // Debug - service processing

    const [validServices, validInvestigationTypes] = await Promise.all([
      prisma.service.findMany({
        where: {
          id: { in: uniqueServiceIds },
          isActive: true
        },
        select: { id: true, name: true, price: true, category: true, isActive: true, isVariablePrice: true, minPrice: true, maxPrice: true }
      }),
      investigationTypeIds.length > 0 ? prisma.investigationType.findMany({
        where: { id: { in: investigationTypeIds } },
        select: { id: true, name: true, price: true, category: true, serviceId: true }
      }) : []
    ]);

    // Debug - validation complete

    // Check if all unique service IDs were found and active (not the total count, since we allow duplicates for quantities)
    if (validServices.length !== uniqueServiceIds.length) {
      const missingIds = uniqueServiceIds.filter(id => !validServices.find(s => s.id === id));
      console.error('❌ Missing or inactive service IDs:', missingIds);
      return res.status(404).json({ error: 'One or more services not found or inactive', missingIds });
    }

    if (investigationTypeIds.length > 0 && validInvestigationTypes.length !== investigationTypeIds.length) {
      return res.status(404).json({ error: 'One or more investigation types not found' });
    }

    // Validate variable prices
    for (const service of services) {
      const serviceData = validServices.find(s => s.id === service.serviceId);
      if (serviceData && serviceData.isVariablePrice) {
        const customPrice = parseFloat(service.customPrice);
        if (isNaN(customPrice)) {
          return res.status(400).json({ error: `Price is required for variable priced service: ${serviceData.name}` });
        }
        if (serviceData.minPrice !== null && customPrice < serviceData.minPrice) {
          return res.status(400).json({ error: `Price for ${serviceData.name} is below minimum allowed (${serviceData.minPrice} ETB)` });
        }
        if (serviceData.maxPrice !== null && customPrice > serviceData.maxPrice) {
          return res.status(400).json({ error: `Price for ${serviceData.name} exceeds maximum allowed (${serviceData.maxPrice} ETB)` });
        }
      }
    }

    const getEffectiveServicePrice = (serviceInput) => {
      const serviceData = validServices.find(s => s.id === serviceInput.serviceId);
      const investigationData = serviceInput.investigationTypeId
        ? validInvestigationTypes.find(i => i.id === serviceInput.investigationTypeId)
        : null;

      const hasCustomPrice = serviceInput.customPrice !== undefined && serviceInput.customPrice !== null;
      return hasCustomPrice
        ? Number(serviceInput.customPrice)
        : (investigationData ? investigationData.price : serviceData.price);
    };

    // Calculate total amount
    const totalAmount = services.reduce((total, service) => {
      const serviceData = validServices.find(s => s.id === service.serviceId);
      const investigationData = service.investigationTypeId ?
        validInvestigationTypes.find(i => i.id === service.investigationTypeId) : null;

      // Use custom price if provided, otherwise check investigation type, then service price
      const price = service.customPrice !== undefined && service.customPrice !== null ?
        service.customPrice :
        (investigationData ? investigationData.price : serviceData.price);
      return total + price;
    }, 0);

    // Check if there's already a batch order for this visit and type
    // For emergency patients, we want to group all orders together
    const existingBatchOrder = await prisma.batchOrder.findFirst({
      where: {
        visitId: visitId,
        type: type,
        status: visit.isEmergency ? 'QUEUED' : { in: ['UNPAID', 'PAID', 'QUEUED', 'IN_PROGRESS'] }
      },
      include: {
        services: {
          include: {
            service: true,
            investigationType: true
          }
        }
      }
    });

    let batchOrder;
    let newServicesAdded = [];

    if (existingBatchOrder) {
      // Add services to existing batch order
      // Adding services to existing batch order

      // Aggregate services by unique serviceId + investigationTypeId to avoid unique constraint violations
      const uniqueServicesToAdd = [];
      const serviceCounts = {};

      services.forEach(service => {
        const key = `${service.serviceId}-${service.investigationTypeId || 'null'}`;
        if (!serviceCounts[key]) {
          serviceCounts[key] = {
            serviceId: service.serviceId,
            investigationTypeId: service.investigationTypeId || null,
            instructions: service.instructions || null,
            customPrice: service.customPrice ?? null,
            count: 0
          };
          uniqueServicesToAdd.push(serviceCounts[key]);
        }
        serviceCounts[key].count++;
      });

      for (const service of uniqueServicesToAdd) {
        // Check if this service already exists in the batch order
        const existingService = existingBatchOrder.services.find(
          s => s.serviceId === service.serviceId &&
            s.investigationTypeId === (service.investigationTypeId || null)
        );

        if (existingService) {
          // Service already exists in batch order, skipping
          // Still add to newServicesAdded for billing calculation with count
          const price = getEffectiveServicePrice(service);

          for (let i = 0; i < service.count; i++) {
            newServicesAdded.push({
              serviceId: service.serviceId,
              investigationTypeId: service.investigationTypeId || null,
              price: price
            });
          }
          continue;
        }

        const price = getEffectiveServicePrice(service);

        const newService = await prisma.batchOrderService.create({
          data: {
            batchOrderId: existingBatchOrder.id,
            serviceId: service.serviceId,
            investigationTypeId: service.investigationTypeId,
            instructions: service.instructions,
            customPrice: service.customPrice,
            status: visit.isEmergency ? 'QUEUED' : 'UNPAID'
          },
          include: {
            service: true,
            investigationType: true
          }
        });

        // Add to newServicesAdded with count for billing calculation
        for (let i = 0; i < service.count; i++) {
          newServicesAdded.push({
            serviceId: service.serviceId,
            investigationTypeId: service.investigationTypeId || null,
            price: price
          });
        }
      }

      // Update the existing batch order
      batchOrder = await prisma.batchOrder.update({
        where: { id: existingBatchOrder.id },
        data: {
          instructions: instructions || existingBatchOrder.instructions
        },
        include: {
          services: {
            include: {
              service: true,
              investigationType: true
            }
          },
          patient: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
          doctor: {
            select: {
              id: true,
              fullname: true
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
    } else {
      // Create new batch order
      // Creating new batch order

      // For dental services with quantities, we need to aggregate by unique serviceId
      // to avoid unique constraint violations on [batchOrderId, serviceId]
      const uniqueServices = [];
      const serviceCounts = {};

      services.forEach(service => {
        const key = `${service.serviceId}-${service.investigationTypeId || 'null'}`;
        if (!serviceCounts[key]) {
          serviceCounts[key] = {
            serviceId: service.serviceId,
            investigationTypeId: service.investigationTypeId || null,
            instructions: service.instructions || null,
            customPrice: service.customPrice || null,
            count: 0
          };
          uniqueServices.push(serviceCounts[key]);
        }
        serviceCounts[key].count++;
      });

      // Unique services after aggregation

      batchOrder = await prisma.batchOrder.create({
        data: {
          visitId,
          patientId,
          doctorId: actualDoctorId,
          type,
          instructions,
          isDeferred: isDeferred || false,
          status: visit.isEmergency ? 'QUEUED' : (isDeferred ? 'DEFERRED' : 'UNPAID'),
          services: {
            create: uniqueServices.map(service => ({
              serviceId: service.serviceId,
              investigationTypeId: service.investigationTypeId,
              instructions: service.instructions,
              customPrice: service.customPrice
            }))
          }
        },
        include: {
          services: {
            include: {
              service: true,
              investigationType: true
            }
          },
          patient: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
          doctor: {
            select: {
              id: true,
              fullname: true
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/02072a7c-232e-4783-a3a7-bf011c7b47c3', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'batchOrderController.js:314', message: 'BatchOrder created', data: { batchOrderId: batchOrder.id, servicesCount: batchOrder.services.length, services: batchOrder.services.map(s => ({ id: s.id, serviceId: s.serviceId, investigationTypeId: s.investigationTypeId })) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(() => { });
      // #endregion
      // For new batch orders, we need to expand unique services back to include quantities for billing
      // The batchOrder.services only has unique entries, but billing needs quantity information
      newServicesAdded = [];
      batchOrder.services.forEach(batchService => {
        // Count how many times this service appears in the original services array
        const count = services.filter(s =>
          s.serviceId === batchService.serviceId &&
          (s.investigationTypeId || null) === (batchService.investigationTypeId || null)
        ).length;

        const serviceData = validServices.find(s => s.id === batchService.serviceId);
        const investigationData = batchService.investigationTypeId ?
          validInvestigationTypes.find(i => i.id === batchService.investigationTypeId) : null;
        const price = batchService.customPrice !== null && batchService.customPrice !== undefined ?
          batchService.customPrice :
          (investigationData ? investigationData.price : serviceData.price);

        // Add count times for billing calculation
        for (let i = 0; i < count; i++) {
          newServicesAdded.push({
            serviceId: batchService.serviceId,
            investigationTypeId: batchService.investigationTypeId || null,
            price: price
          });
        }
      });
    }

    // Handle billing based on visit type
    let billing;

    if (visit.isEmergency) {
      // For emergency patients, use the new unified emergency billing system
      console.log('Emergency patient detected - using unified emergency billing system');

      // Import the emergency controller function
      const { getOrCreateEmergencyBilling } = require('./emergencyController');

      try {
        // Get or create emergency billing
        billing = await getOrCreateEmergencyBilling(visitId);

        // Add services to emergency billing
        for (const service of newServicesAdded) {
          const price = service.price;

          // Check if service already exists
          const existingService = await prisma.billingService.findFirst({
            where: {
              billingId: billing.id,
              serviceId: service.serviceId
            }
          });

          if (!existingService) {
            await prisma.billingService.create({
              data: {
                billingId: billing.id,
                serviceId: service.serviceId,
                quantity: 1,
                unitPrice: price,
                totalPrice: price
              }
            });

            // Update total amount
            await prisma.billing.update({
              where: { id: billing.id },
              data: {
                totalAmount: {
                  increment: price
                }
              }
            });
          }
        }

        console.log(`✅ Emergency services added to billing ${billing.id}`);
      } catch (error) {
        console.error('Error with emergency billing:', error);
        // Fallback to regular billing if emergency system fails
        billing = await prisma.billing.create({
          data: {
            patientId: visit.patientId,
            visitId: visitId,
            totalAmount: totalAmount,
            status: 'PENDING',
            notes: 'Emergency services - fallback billing'
          }
        });
      }
    } else {
      // For regular patients, check for ANY existing PENDING billing for this visit
      // This will merge all services (dental, lab, radiology) with nurse services or any other pending billing
      billing = await prisma.billing.findFirst({
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

      if (type === 'DENTAL') {
        // Aggregate services by serviceId to handle quantities
        // Use newServicesAdded which already has the correct count from quantity expansion
        const serviceQuantities = {};
        const servicePrices = {};

        newServicesAdded.forEach(service => {
          if (!serviceQuantities[service.serviceId]) {
            serviceQuantities[service.serviceId] = 0;
            servicePrices[service.serviceId] = service.price;
          }
          serviceQuantities[service.serviceId]++;
        });

        // Create billing services array with aggregated quantities
        const billingServices = Object.keys(serviceQuantities).map(serviceId => ({
          serviceId: serviceId,
          quantity: serviceQuantities[serviceId],
          unitPrice: servicePrices[serviceId],
          totalPrice: servicePrices[serviceId] * serviceQuantities[serviceId]
        }));

        // Recalculate total with aggregated quantities
        const aggregatedTotal = billingServices.reduce((sum, bs) => sum + bs.totalPrice, 0);

        if (isDeferred) {
          // DEFERRED dental order: Create a separate billing marked as PAID
          // This shows up in billing history but doesn't require new payment
          const dentalServiceNames = validServices.map(s => {
            const qty = serviceQuantities[s.id] || 0;
            return qty > 0 ? `${s.name} (×${qty})` : null;
          }).filter(Boolean).join(', ');

          billing = await prisma.billing.create({
            data: {
              patientId,
              visitId,
              totalAmount: aggregatedTotal,
              paidAmount: aggregatedTotal, // Already paid - connected to previous payment
              isDeferred: true,
              status: 'PAID',
              notes: `DEFERRED_CONNECTED: ${dentalServiceNames} - covered by existing credit/payment`,
              services: {
                create: billingServices
              }
            }
          });
          console.log(`✅ Created deferred (pre-paid) dental billing: ${billing.id}`);
        } else if (!billing) {
          // No existing billing - create new one
          billing = await prisma.billing.create({
            data: {
              patientId,
              visitId,
              totalAmount: aggregatedTotal,
              status: 'PENDING',
              notes: `Dental services: ${validServices.map(s => {
                const qty = serviceQuantities[s.id] || 0;
                return qty > 0 ? `${s.name} (×${qty})` : null;
              }).filter(Boolean).join(', ')}`,
              services: {
                create: billingServices
              }
            }
          });
          // Created new billing for dental services
        } else {
          // Merge with existing billing
          console.log(`🔄 Merging dental services into existing billing: ${billing.id}`);

          // Add new services to existing billing
          for (const serviceData of billingServices) {
            // Check if service already exists in billing
            const existingService = billing.services.find(
              bs => bs.serviceId === serviceData.serviceId
            );

            if (existingService) {
              // Update quantity and total for existing service
              await prisma.billingService.update({
                where: {
                  billingId_serviceId: {
                    billingId: billing.id,
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
              await prisma.billingService.create({
                data: {
                  billingId: billing.id,
                  ...serviceData
                }
              });
            }
          }

          // Update billing total and notes
          const dentalServiceNames = validServices.map(s => {
            const qty = serviceQuantities[s.id] || 0;
            return qty > 0 ? `${s.name} (×${qty})` : null;
          }).filter(Boolean).join(', ');

          const updatedNotes = billing.notes
            ? `${billing.notes} + Dental services: ${dentalServiceNames}`
            : `Dental services: ${dentalServiceNames}`;

          billing = await prisma.billing.update({
            where: { id: billing.id },
            data: {
              totalAmount: {
                increment: aggregatedTotal
              },
              notes: updatedNotes
            }
          });

          // Dental services merged into existing billing
        }
      } else if (type === 'PROCEDURE') {
        // Aggregate services by serviceId to handle quantities
        const serviceQuantities = {};
        const servicePrices = {};

        newServicesAdded.forEach(s => {
          if (!serviceQuantities[s.serviceId]) {
            serviceQuantities[s.serviceId] = 0;
            servicePrices[s.serviceId] = s.price;
          }
          serviceQuantities[s.serviceId]++;
        });

        const billingServices = Object.keys(serviceQuantities).map(serviceId => ({
          serviceId: serviceId,
          quantity: serviceQuantities[serviceId],
          unitPrice: servicePrices[serviceId],
          totalPrice: servicePrices[serviceId] * serviceQuantities[serviceId]
        }));

        const aggregatedTotal = billingServices.reduce((sum, bs) => sum + bs.totalPrice, 0);
        const procedureNames = validServices.map(s => s.name).join(', ');

        if (!billing) {
          billing = await prisma.billing.create({
            data: {
              patientId,
              visitId,
              totalAmount: aggregatedTotal,
              status: 'PENDING',
              notes: `Procedures: ${procedureNames}`,
              services: {
                create: billingServices
              }
            }
          });
        } else {
          // Add procedure services to existing billing
          for (const bs of billingServices) {
            const existingService = billing.services?.find(s => s.serviceId === bs.serviceId);
            if (existingService) {
              await prisma.billingService.update({
                where: { billingId_serviceId: { billingId: billing.id, serviceId: bs.serviceId } },
                data: {
                  quantity: existingService.quantity + bs.quantity,
                  totalPrice: existingService.totalPrice + bs.totalPrice
                }
              });
            } else {
              await prisma.billingService.create({
                data: {
                  billingId: billing.id,
                  serviceId: bs.serviceId,
                  quantity: bs.quantity,
                  unitPrice: bs.unitPrice,
                  totalPrice: bs.totalPrice
                }
              });
            }
          }

          const updatedNotes = billing.notes
            ? `${billing.notes} + Procedures: ${procedureNames}`
            : `Procedures: ${procedureNames}`;

          billing = await prisma.billing.update({
            where: { id: billing.id },
            data: {
              totalAmount: { increment: aggregatedTotal },
              notes: updatedNotes
            }
          });
        }
      } else {
        // For lab/radiology, merge with existing billing if found
        if (!billing) {
          // Create new diagnostics billing
          billing = await prisma.billing.create({
            data: {
              patientId,
              visitId,
              totalAmount,
              status: 'PENDING',
              notes: 'Combined diagnostics billing - lab and radiology',
              services: {
                create: services.map(service => {
                  const serviceData = validServices.find(s => s.id === service.serviceId);
                  const investigationData = service.investigationTypeId ?
                    validInvestigationTypes.find(i => i.id === service.investigationTypeId) : null;
                  const price = investigationData ? investigationData.price : serviceData.price;

                  return {
                    serviceId: service.serviceId,
                    quantity: 1,
                    unitPrice: price,
                    totalPrice: price
                  };
                })
              }
            }
          });
          // Created new billing for diagnostics
        } else {
          // Merge with existing billing
          console.log(`🔄 Merging diagnostics services into existing billing: ${billing.id}`);

          // Get existing billing services to check for duplicates
          const existingBillingServices = await prisma.billingService.findMany({
            where: { billingId: billing.id },
            select: { serviceId: true }
          });

          const existingServiceIds = existingBillingServices.map(s => s.serviceId);

          // Add only the new services to existing billing
          for (const service of newServicesAdded) {
            // Skip if service already exists in billing
            if (existingServiceIds.includes(service.serviceId)) {
              console.log(`Service ${service.serviceId} already exists in billing ${billing.id}, skipping`);
              continue;
            }

            const serviceData = validServices.find(s => s.id === service.serviceId);
            const investigationData = service.investigationTypeId ?
              validInvestigationTypes.find(i => i.id === service.investigationTypeId) : null;
            const price = investigationData ? investigationData.price : serviceData.price;

            await prisma.billingService.create({
              data: {
                billingId: billing.id,
                serviceId: service.serviceId,
                quantity: 1,
                unitPrice: price,
                totalPrice: price
              }
            });
          }

          // Update existing billing total with only the new services amount
          const newServicesAmount = newServicesAdded.reduce((total, service) => {
            const serviceData = validServices.find(s => s.id === service.serviceId);
            const investigationData = service.investigationTypeId ?
              validInvestigationTypes.find(i => i.id === service.investigationTypeId) : null;
            const price = investigationData ? investigationData.price : serviceData.price;
            return total + price;
          }, 0);

          const updatedNotes = billing.notes
            ? `${billing.notes} + Diagnostics services`
            : 'Combined diagnostics billing - lab and radiology';

          billing = await prisma.billing.update({
            where: { id: billing.id },
            data: {
              totalAmount: {
                increment: newServicesAmount
              },
              notes: updatedNotes
            }
          });

          // Diagnostics services merged into existing billing
        }
      }
    }

    // Update visit status based on order type
    // Refresh visit status in case it changed during batch order creation
    const currentVisit = await prisma.visit.findUnique({
      where: { id: visitId },
      select: { status: true, isEmergency: true }
    });

    let newStatus = currentVisit.status;

    // For emergency patients, keep them in UNDER_DOCTOR_REVIEW to allow more orders
    if (currentVisit.isEmergency) {
      newStatus = 'UNDER_DOCTOR_REVIEW';
    } else {
      const activeStatuses = ['UNPAID', 'PAID', 'QUEUED', 'IN_PROGRESS', 'COMPLETED'];
      const [activeLabBatchOrders, activeRadiologyBatchOrders, activeLabOrders, activeRadiologyOrders, activeLabTestOrders] = await Promise.all([
        prisma.batchOrder.count({
          where: {
            visitId,
            type: { in: ['LAB', 'MIXED'] },
            status: { in: activeStatuses }
          }
        }),
        prisma.batchOrder.count({
          where: {
            visitId,
            type: { in: ['RADIOLOGY', 'MIXED'] },
            status: { in: activeStatuses }
          }
        }),
        prisma.labOrder.count({
          where: {
            visitId,
            status: { in: activeStatuses }
          }
        }),
        prisma.radiologyOrder.count({
          where: {
            visitId,
            status: { in: activeStatuses }
          }
        }),
        prisma.labTestOrder.count({
          where: {
            visitId,
            status: { in: activeStatuses }
          }
        })
      ]);

      const hasLabOrders = (activeLabBatchOrders + activeLabOrders + activeLabTestOrders) > 0;
      const hasRadiologyOrders = (activeRadiologyBatchOrders + activeRadiologyOrders) > 0;

      // Always set SENT_* status for diagnostic ordering so visit leaves doctor queue immediately.
      if (['LAB', 'RADIOLOGY', 'MIXED'].includes(type)) {
        if (hasLabOrders && hasRadiologyOrders) {
          newStatus = 'SENT_TO_BOTH';
        } else if (hasLabOrders) {
          newStatus = 'SENT_TO_LAB';
        } else if (hasRadiologyOrders) {
          newStatus = 'SENT_TO_RADIOLOGY';
        }
      } else if (currentVisit.status === 'UNDER_DOCTOR_REVIEW' || currentVisit.status === 'WAITING_FOR_DOCTOR') {
        if (type === 'NURSE') {
          newStatus = 'NURSE_SERVICES_ORDERED';
        } else if (type === 'DENTAL') {
          newStatus = 'DENTAL_SERVICES_ORDERED';
        } else if (type === 'PROCEDURE') {
          newStatus = 'PROCEDURE_SERVICES_ORDERED';
        }
      } else if (currentVisit.status === 'IN_DOCTOR_QUEUE' && (type === 'DENTAL' || type === 'PROCEDURE')) {
        // Patient returned from billing, ordering more dental/procedure services - remove from queue again
        newStatus = type === 'DENTAL' ? 'DENTAL_SERVICES_ORDERED' : 'PROCEDURE_SERVICES_ORDERED';
      } else if (currentVisit.status === 'PROCEDURE_SERVICES_COMPLETED' && type === 'PROCEDURE') {
        // More procedures ordered after completion
        newStatus = 'PROCEDURE_SERVICES_ORDERED';
      } else if (currentVisit.status === 'SENT_TO_LAB' && type === 'RADIOLOGY') {
        // If already sent to lab and now ordering radiology, change to mixed
        newStatus = 'SENT_TO_BOTH';
      } else if (currentVisit.status === 'SENT_TO_RADIOLOGY' && type === 'LAB') {
        // If already sent to radiology and now ordering lab, change to mixed
        newStatus = 'SENT_TO_BOTH';
      } else if (currentVisit.status === 'AWAITING_RESULTS_REVIEW') {
        // Doctor is reviewing results and ordering additional tests
        // Check if there are existing pending lab or radiology orders
        const existingLabOrders = await prisma.batchOrder.findFirst({
          where: {
            visitId: visitId,
            type: { in: ['LAB', 'MIXED'] },
            status: { in: ['UNPAID', 'PAID', 'QUEUED', 'IN_PROGRESS'] }
          }
        });

        const existingRadiologyOrders = await prisma.batchOrder.findFirst({
          where: {
            visitId: visitId,
            type: { in: ['RADIOLOGY', 'MIXED'] },
            status: { in: ['UNPAID', 'PAID', 'QUEUED', 'IN_PROGRESS'] }
          }
        });

        if (type === 'LAB') {
          // Ordering lab - check if radiology is pending
          if (existingRadiologyOrders) {
            newStatus = 'SENT_TO_BOTH';
          } else {
            newStatus = 'SENT_TO_LAB';
          }
        } else if (type === 'RADIOLOGY') {
          // Ordering radiology - check if lab is pending
          if (existingLabOrders) {
            newStatus = 'SENT_TO_BOTH';
          } else {
            newStatus = 'SENT_TO_RADIOLOGY';
          }
        } else if (type === 'MIXED') {
          newStatus = 'SENT_TO_BOTH';
        } else if (type === 'NURSE') {
          newStatus = 'NURSE_SERVICES_ORDERED';
        }
      }
      // For other non-diagnostic cases, keep the current status
    }

    // Always update visit status when ordering dental services to remove from queue
    // This ensures patients are removed from queue even if they're in IN_DOCTOR_QUEUE status
    if (type === 'DENTAL' && currentVisit.status === 'IN_DOCTOR_QUEUE') {
      newStatus = 'DENTAL_SERVICES_ORDERED';
      console.log(`🦷 Updating visit ${visitId} status from ${currentVisit.status} to ${newStatus} for dental services order`);
    }

    await prisma.visit.update({
      where: { id: visitId },
      data: { status: newStatus }
    });

    console.log(`✅ Visit ${visitId} status updated to: ${newStatus}`);

    // For nurse services or procedures with nurse assignment, create nurse service assignments
    if ((type === 'NURSE' || type === 'PROCEDURE') && assignedNurseId) {
      const nurseServiceAssignments = [];
      for (const service of services) {
        const assignment = await prisma.nurseServiceAssignment.create({
          data: {
            visitId,
            serviceId: service.serviceId,
            assignedNurseId,
            assignedById: actualDoctorId,
            status: 'PENDING',
            notes: service.instructions || `Doctor ordered: ${validServices.find(s => s.id === service.serviceId)?.name}`,
            orderType: type === 'PROCEDURE' ? 'PROCEDURE_ORDERED' : 'DOCTOR_ORDERED'
          },
          include: {
            service: true,
            assignedNurse: {
              select: {
                id: true,
                fullname: true,
                username: true
              }
            }
          }
        });
        nurseServiceAssignments.push(assignment);
      }
    }

    res.status(201).json({
      message: 'Batch order created successfully',
      batchOrder,
      billing: {
        id: billing.id,
        totalAmount: billing.totalAmount
      },
      visitStatus: newStatus
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Validation error:', error.errors);
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('❌ Error creating batch order:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get batch orders for lab department
exports.getLabBatchOrders = async (req, res) => {
  try {
    const batchOrders = await prisma.batchOrder.findMany({
      where: {
        OR: [
          { type: 'LAB' },
          { type: 'MIXED' }
        ],
        status: {
          in: ['UNPAID', 'PAID', 'QUEUED', 'IN_PROGRESS', 'COMPLETED']
        }
      },
      include: {
        services: {
          include: {
            service: true,
            investigationType: true
          }
        },
        patient: {
          select: {
            id: true,
            name: true,
            type: true,
            mobile: true,
            email: true
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
            vitals: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        },
        attachments: true
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({ batchOrders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get batch orders for radiology department
exports.getRadiologyBatchOrders = async (req, res) => {
  try {
    const batchOrders = await prisma.batchOrder.findMany({
      where: {
        OR: [
          { type: 'RADIOLOGY' },
          { type: 'MIXED' }
        ],
        status: {
          in: ['UNPAID', 'PAID', 'QUEUED', 'IN_PROGRESS', 'COMPLETED']
        }
      },
      include: {
        services: {
          include: {
            service: true,
            investigationType: true
          }
        },
        patient: {
          select: {
            id: true,
            name: true,
            type: true,
            mobile: true,
            email: true
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
            vitals: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        },
        attachments: true
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({ batchOrders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update batch order results
exports.updateBatchOrderResults = async (req, res) => {
  try {
    const { batchOrderId } = req.params;
    const { result, additionalNotes, serviceResults } = req.body;

    // Update batch order
    const updatedBatchOrder = await prisma.batchOrder.update({
      where: { id: parseInt(batchOrderId) },
      data: {
        result: result || null,
        additionalNotes: additionalNotes || null,
        status: 'COMPLETED',
        updatedAt: new Date()
      },
      include: {
        services: {
          include: {
            service: true,
            investigationType: true
          }
        },
        patient: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        doctor: {
          select: {
            id: true,
            fullname: true
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

    // Update individual service results if provided
    if (serviceResults && Array.isArray(serviceResults)) {
      for (const serviceResult of serviceResults) {
        if (serviceResult.batchOrderServiceId && serviceResult.result) {
          await prisma.batchOrderService.update({
            where: { id: serviceResult.batchOrderServiceId },
            data: {
              result: serviceResult.result,
              status: 'COMPLETED'
            }
          });
        }
      }
    }

    res.json({
      message: 'Batch order results updated successfully',
      batchOrder: updatedBatchOrder
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Upload attachment for batch order
exports.uploadBatchOrderAttachment = async (req, res) => {
  try {
    const { batchOrderId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get the batch order to find the patientId
    const batchOrder = await prisma.batchOrder.findUnique({
      where: { id: parseInt(batchOrderId) },
      select: { patientId: true }
    });

    if (!batchOrder) {
      return res.status(404).json({ error: 'Batch order not found' });
    }

    const file = await prisma.file.create({
      data: {
        patientId: batchOrder.patientId,
        path: req.file.path,
        type: req.file.mimetype,
        batchOrderId: parseInt(batchOrderId),
        accessLog: [JSON.stringify({
          action: 'UPLOADED',
          timestamp: new Date().toISOString(),
          userId: req.user.id
        })]
      }
    });

    res.json({
      message: 'File uploaded successfully',
      file: {
        id: file.id,
        path: file.path,
        type: file.type
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// NEW LAB TEST ORDER SYSTEM
// ============================================

// Create lab test orders (new system)
exports.createLabTestOrders = async (req, res) => {
  try {
    const { visitId, patientId, labTestIds, instructions } = req.body;
    const doctorId = req.user.id;

    if (!visitId || !patientId || !labTestIds || !Array.isArray(labTestIds) || labTestIds.length === 0) {
      return res.status(400).json({ error: 'visitId, patientId, and labTestIds (array) are required' });
    }

    // Validate visit
    const visit = await prisma.visit.findUnique({
      where: { id: visitId }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Validate patient
    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Validate lab tests
    const labTests = await prisma.labTest.findMany({
      where: {
        id: { in: labTestIds },
        isActive: true
      },
      include: {
        service: true
      }
    });

    if (labTests.length !== labTestIds.length) {
      return res.status(404).json({ error: 'One or more lab tests not found or inactive' });
    }

    // Check for existing orders to avoid duplicates
    // Only block if there are unpaid or active orders (not completed ones - allow re-ordering)
    // Orders without billingId are orphaned from a failed prior attempt and should be retryable
    const existingOrders = await prisma.labTestOrder.findMany({
      where: {
        visitId: visitId,
        labTestId: { in: labTestIds },
        status: { in: ['UNPAID', 'PAID', 'QUEUED', 'IN_PROGRESS'] },
        billingId: { not: null }
      },
      select: { labTestId: true, status: true }
    });

    const existingTestIds = new Set(existingOrders.map(o => o.labTestId));

    // Clean up orphaned orders (UNPAID, no billingId) from a failed prior attempt
    const orphanedOrders = await prisma.labTestOrder.findMany({
      where: {
        visitId: visitId,
        labTestId: { in: labTestIds },
        status: 'UNPAID',
        billingId: null
      },
      select: { id: true, batchOrderId: true }
    });
    if (orphanedOrders.length > 0) {
      console.log(`🧹 [createLabTestOrders] Cleaning up ${orphanedOrders.length} orphaned orders from failed prior attempt`);
      const orphanedBatchIds = [...new Set(orphanedOrders.map(o => o.batchOrderId).filter(Boolean))];
      await prisma.labTestOrder.deleteMany({
        where: { id: { in: orphanedOrders.map(o => o.id) } }
      });
      if (orphanedBatchIds.length > 0) {
        await prisma.batchOrder.deleteMany({
          where: { id: { in: orphanedBatchIds } }
        });
      }
    }

    const newTestIds = labTestIds.filter(id => !existingTestIds.has(id));

    if (newTestIds.length === 0) {
      const completedTestIds = await prisma.labTestOrder.findMany({
        where: {
          visitId: visitId,
          labTestId: { in: labTestIds },
          status: 'COMPLETED'
        },
        select: { labTestId: true }
      });

      if (completedTestIds.length > 0 && completedTestIds.length === labTestIds.length) {
        return res.status(400).json({
          error: 'All selected lab tests have active orders. Completed tests can be re-ordered, but you have active (unpaid/queued) orders for all selected tests.',
          message: 'You have active orders for all selected tests. Please wait for them to be completed or pay for existing orders first.'
        });
      }

      return res.status(400).json({
        error: 'All selected lab tests have already been ordered for this visit',
        message: 'You have active orders for all selected tests. You can re-order completed tests, but please wait for active orders to be processed first.'
      });
    }

    console.log(`✅ [createLabTestOrders] Creating ${newTestIds.length} new orders (${labTestIds.length - newTestIds.length} already exist)`);

    const result = await prisma.$transaction(async (tx) => {
      // Create a batch order for grouping (optional, for compatibility)
      const batchOrder = await tx.batchOrder.create({
        data: {
          visitId,
          patientId,
          doctorId,
          type: 'LAB',
          instructions: instructions || 'Lab tests ordered by doctor',
          status: 'UNPAID'
        }
      });

      // Create lab test orders
      const createdOrders = [];
      let totalAmount = 0;
      const panelPricing = {}; // panelId -> price

      for (const testId of newTestIds) {
        const test = labTests.find(t => t.id === testId);
        if (!test) continue;

        const order = await tx.labTestOrder.create({
          data: {
            labTestId: testId,
            batchOrderId: batchOrder.id,
            visitId,
            patientId,
            doctorId,
            instructions: instructions || `Lab test: ${test.name}`,
            status: visit.isEmergency ? 'QUEUED' : 'UNPAID',
            isWalkIn: false
          },
          include: {
            labTest: {
              include: {
                service: true,
                group: true
              }
            }
          }
        });

        createdOrders.push(order);
        if (test.groupId) {
          if (!panelPricing[test.groupId]) {
            const group = await tx.labTestGroup.findUnique({ where: { id: test.groupId }, select: { price: true } });
            panelPricing[test.groupId] = group?.price || 0;
          }
        } else {
          totalAmount += test.price;
        }
      }
      // Add panel prices once per panel
      Object.values(panelPricing).forEach(p => totalAmount += p);

      // Create billing entry
      let billing = await tx.billing.findFirst({
        where: {
          visitId: visitId,
          status: 'PENDING'
        }
      });

      if (!billing) {
        billing = await tx.billing.create({
          data: {
            patientId,
            visitId,
            totalAmount: 0,
            status: 'PENDING',
            notes: 'Diagnostics billing'
          }
        });
      }

      // Link all orders to this billing
      await tx.labTestOrder.updateMany({
        where: {
          id: { in: createdOrders.map(o => o.id) }
        },
        data: {
          billingId: billing.id
        }
      });

      // Add services to billing
      for (const order of createdOrders) {
        if (order.labTest.serviceId) {
          const existingBillingService = await tx.billingService.findFirst({
            where: {
              billingId: billing.id,
              serviceId: order.labTest.serviceId
            }
          });

          if (!existingBillingService) {
            const effPrice1 = order.labTest.groupId ? (panelPricing[order.labTest.groupId] || 0) : order.labTest.price;
            await tx.billingService.create({
              data: {
                billingId: billing.id,
                serviceId: order.labTest.serviceId,
                quantity: 1,
                unitPrice: effPrice1,
                totalPrice: effPrice1
              }
            });
          }
        } else {
            const fallbackServiceCode = `LABTEST-${order.labTest.id}`;

            let fallbackService = await tx.service.findUnique({
              where: { code: fallbackServiceCode },
              select: { id: true }
            });

            if (!fallbackService) {
              fallbackService = await tx.service.create({
                data: {
                  code: fallbackServiceCode,
                  name: order.labTest.name,
                  category: 'LAB',
                  price: order.labTest.groupId ? (panelPricing[order.labTest.groupId] || 0) : order.labTest.price,
                  unit: order.labTest.unit || 'UNIT',
                  description: `Auto-generated LAB service for lab test ${order.labTest.name}`,
                  isActive: true
                },
                select: { id: true }
              });
            }

            if (!order.labTest.serviceId) {
              await tx.labTest.update({
                where: { id: order.labTest.id },
                data: { serviceId: fallbackService.id }
              });
            }

            const existingFallbackLine = await tx.billingService.findFirst({
              where: {
                billingId: billing.id,
                serviceId: fallbackService.id
              }
            });

            if (existingFallbackLine) {
              await tx.billingService.update({
                where: {
                  billingId_serviceId: {
                    billingId: billing.id,
                    serviceId: fallbackService.id
                  }
                },
                data: {
                  quantity: { increment: 1 },
                  totalPrice: { increment: order.labTest.price }
                }
              });
            } else {
              await tx.billingService.create({
                data: {
                  billingId: billing.id,
                  serviceId: fallbackService.id,
                  quantity: 1,
                  unitPrice: order.labTest.price,
                  totalPrice: order.labTest.price
                }
              });
            }

            console.log(`[createLabTestOrders] Lab test "${order.labTest.name}" (${order.labTest.price}) added to billing via fallback LAB service ${fallbackServiceCode}`);
        }
      }

      // Update billing total
      const billingServices = await tx.billingService.findMany({
        where: { billingId: billing.id }
      });
      const servicesTotal = billingServices.reduce((sum, bs) => sum + bs.totalPrice, 0);

      await tx.billing.update({
        where: { id: billing.id },
        data: { totalAmount: servicesTotal }
      });

      // Update visit status - check if there are also radiology orders
      const hasRadiologyOrders = await tx.radiologyOrder.count({
        where: {
          visitId: visitId,
          status: { in: ['UNPAID', 'PAID', 'QUEUED', 'IN_PROGRESS', 'COMPLETED'] }
        }
      }) > 0;

      let newVisitStatus = visit.status;
      if (hasRadiologyOrders) {
        newVisitStatus = 'SENT_TO_BOTH';
      } else {
        newVisitStatus = 'SENT_TO_LAB';
      }

      if (!['SENT_TO_LAB', 'SENT_TO_RADIOLOGY', 'SENT_TO_BOTH'].includes(visit.status)) {
        await tx.visit.update({
          where: { id: visitId },
          data: { status: newVisitStatus }
        });
        console.log(`✅ Updated visit ${visitId} status to ${newVisitStatus}`);
      }

      return { batchOrder, createdOrders, billing };
    });

    const { batchOrder, createdOrders, billing } = result;
    const totalAmount = createdOrders.reduce((sum, o) => sum + (o.labTest?.price || 0), 0);

    res.status(201).json({
      message: `${createdOrders.length} lab test order(s) created successfully`,
      orders: createdOrders,
      batchOrder,
      billing,
      totalAmount
    });

  } catch (error) {
    console.error('Error creating lab test orders:', error);
    res.status(500).json({ error: error.message });
  }
};

// Complete a procedure (doctor side)
exports.completeProcedure = async (req, res) => {
  try {
    const { batchOrderId, serviceId } = req.body;
    const doctorId = req.user.id;

    const batchOrder = await prisma.batchOrder.findUnique({
      where: { id: parseInt(batchOrderId) },
      include: {
        services: true,
        visit: true
      }
    });

    if (!batchOrder) {
      return res.status(404).json({ error: 'Batch order not found' });
    }

    if (batchOrder.doctorId !== doctorId) {
      return res.status(403).json({ error: 'You are not authorized to complete this procedure' });
    }

    const batchService = await prisma.batchOrderService.findUnique({
      where: {
        batchOrderId_serviceId: {
          batchOrderId: parseInt(batchOrderId),
          serviceId: serviceId
        }
      }
    });

    if (!batchService) {
      return res.status(404).json({ error: 'Procedure not found in this batch order' });
    }

    // Allow completion regardless of payment status as requested
    // (service can be completed before or after payment)

    // Mark as completed
    await prisma.batchOrderService.update({
      where: {
        batchOrderId_serviceId: {
          batchOrderId: parseInt(batchOrderId),
          serviceId: serviceId
        }
      },
      data: {
        status: 'COMPLETED'
      }
    });

    // Check if all procedures in this batch are completed
    const allServices = await prisma.batchOrderService.findMany({
      where: { batchOrderId: parseInt(batchOrderId) }
    });

    const allCompleted = allServices.every(s => s.status === 'COMPLETED' || s.status === 'CANCELLED');

    if (allCompleted) {
      await prisma.batchOrder.update({
        where: { id: parseInt(batchOrderId) },
        data: { status: 'COMPLETED' }
      });

      // Update visit status
      if (batchOrder.visit.status === 'PROCEDURE_SERVICES_ORDERED') {
        await prisma.visit.update({
          where: { id: batchOrder.visitId },
          data: { status: 'PROCEDURE_SERVICES_COMPLETED' }
        });
      }
    }

    res.json({
      success: true,
      message: 'Procedure completed successfully',
      isBatchCompleted: allCompleted
    });

  } catch (error) {
    console.error('Error completing procedure:', error);
    res.status(500).json({ error: error.message });
  }
};

const removeOnePendingBillingServiceForVisit = async (tx, visitId, serviceId) => {
  if (!visitId || !serviceId) return;

  const billingService = await tx.billingService.findFirst({
    where: {
      serviceId,
      billing: {
        visitId,
        status: 'PENDING'
      }
    },
    include: {
      billing: true
    },
    orderBy: {
      id: 'desc'
    }
  });

  if (!billingService) return;

  await tx.billingService.delete({
    where: { id: billingService.id }
  });

  const remainingServices = await tx.billingService.findMany({
    where: { billingId: billingService.billingId }
  });

  if (remainingServices.length === 0) {
    await tx.billing.delete({
      where: { id: billingService.billingId }
    });
    return;
  }

  const newTotalAmount = remainingServices.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  await tx.billing.update({
    where: { id: billingService.billingId },
    data: { totalAmount: newTotalAmount }
  });
};

const refreshVisitOrderStatus = async (tx, visitId) => {
  if (!visitId) return;

  const visitWithOrders = await tx.visit.findUnique({
    where: { id: visitId },
    include: {
      labOrders: true,
      radiologyOrders: true,
      batchOrders: {
        include: {
          services: true
        }
      },
      labTestOrders: true
    }
  });

  if (!visitWithOrders) return;

  const hasLabOrders =
    (visitWithOrders.labOrders || []).length > 0 ||
    (visitWithOrders.labTestOrders || []).length > 0 ||
    (visitWithOrders.batchOrders || []).some((order) => order.type === 'LAB' && (order.services || []).length > 0);

  const hasRadiologyOrders =
    (visitWithOrders.radiologyOrders || []).length > 0 ||
    (visitWithOrders.batchOrders || []).some((order) => order.type === 'RADIOLOGY' && (order.services || []).length > 0);

  let nextStatus = 'UNDER_DOCTOR_REVIEW';
  if (hasLabOrders && hasRadiologyOrders) nextStatus = 'SENT_TO_BOTH';
  else if (hasLabOrders) nextStatus = 'SENT_TO_LAB';
  else if (hasRadiologyOrders) nextStatus = 'SENT_TO_RADIOLOGY';

  await tx.visit.update({
    where: { id: visitId },
    data: { status: nextStatus }
  });
};

exports.deleteLabBatchOrder = async (req, res) => {
  try {
    const batchOrderId = parseInt(req.params.id, 10);
    if (!batchOrderId) {
      return res.status(400).json({ error: 'Invalid batch order id' });
    }

    const batchOrder = await prisma.batchOrder.findUnique({
      where: { id: batchOrderId },
      include: {
        services: true,
        detailedResults: true,
        labTestOrders: {
          include: {
            results: true
          }
        }
      }
    });

    if (!batchOrder || batchOrder.type !== 'LAB') {
      return res.status(404).json({ error: 'Lab batch order not found' });
    }

    if (batchOrder.status === 'COMPLETED' || batchOrder.detailedResults.length > 0) {
      return res.status(400).json({ error: 'Completed lab orders cannot be deleted' });
    }

    const hasProcessedLabTestOrder = batchOrder.labTestOrders.some((order) =>
      order.status === 'COMPLETED' || (order.results && order.results.length > 0)
    );

    if (hasProcessedLabTestOrder) {
      return res.status(400).json({ error: 'Lab order already has results and cannot be deleted' });
    }

    await prisma.$transaction(async (tx) => {
      for (const service of batchOrder.services) {
        await removeOnePendingBillingServiceForVisit(tx, batchOrder.visitId, service.serviceId);
      }

      await tx.batchOrderService.deleteMany({
        where: { batchOrderId }
      });

      for (const order of batchOrder.labTestOrders) {
        await tx.labTestOrder.delete({ where: { id: order.id } });
      }

      await tx.batchOrder.delete({
        where: { id: batchOrderId }
      });

      await refreshVisitOrderStatus(tx, batchOrder.visitId);
    });

    return res.json({
      success: true,
      message: 'Lab order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting lab batch order:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete lab order' });
  }
};

exports.deleteLabTestOrder = async (req, res) => {
  try {
    const orderId = String(req.params.id || '').trim();
    if (!orderId) {
      return res.status(400).json({ error: 'Invalid lab test order id' });
    }

    const order = await prisma.labTestOrder.findUnique({
      where: { id: orderId },
      include: {
        results: true,
        labTest: {
          select: {
            serviceId: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Lab test order not found' });
    }

    if (order.status === 'COMPLETED' || order.results.length > 0) {
      return res.status(400).json({ error: 'Completed lab test orders cannot be deleted' });
    }

    await prisma.$transaction(async (tx) => {
      await removeOnePendingBillingServiceForVisit(tx, order.visitId, order.labTest?.serviceId || null);

      await tx.labTestOrder.delete({
        where: { id: orderId }
      });

      await refreshVisitOrderStatus(tx, order.visitId);
    });

    return res.json({
      success: true,
      message: 'Lab test order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting lab test order:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete lab test order' });
  }
};

exports.deleteRadiologyBatchOrder = async (req, res) => {
  try {
    const batchOrderId = parseInt(req.params.id, 10);
    if (!batchOrderId) {
      return res.status(400).json({ error: 'Invalid batch order id' });
    }

    const batchOrder = await prisma.batchOrder.findUnique({
      where: { id: batchOrderId },
      include: {
        services: true,
        radiologyResults: true
      }
    });

    if (!batchOrder || batchOrder.type !== 'RADIOLOGY') {
      return res.status(404).json({ error: 'Radiology batch order not found' });
    }

    if (batchOrder.status === 'COMPLETED' || batchOrder.radiologyResults.length > 0) {
      return res.status(400).json({ error: 'Completed radiology orders cannot be deleted' });
    }

    await prisma.$transaction(async (tx) => {
      for (const service of batchOrder.services) {
        await removeOnePendingBillingServiceForVisit(tx, batchOrder.visitId, service.serviceId);
      }

      await tx.batchOrderService.deleteMany({
        where: { batchOrderId }
      });

      await tx.batchOrder.delete({
        where: { id: batchOrderId }
      });

      await refreshVisitOrderStatus(tx, batchOrder.visitId);
    });

    return res.json({
      success: true,
      message: 'Radiology order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting radiology batch order:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete radiology order' });
  }
};
