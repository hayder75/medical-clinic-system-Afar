const prisma = require('../config/database');
const { z } = require('zod');
const { checkVisitInvestigationCompletion } = require('../utils/investigationUtils');
const { createPDFDocument, generatePDF, getDefaultClinicName } = require('../utils/pdfGenerator');
const fs = require('fs');
const path = require('path');

// Validation schemas
const fillReportSchema = z.object({
  orderId: z.number(),
  testResults: z.array(z.object({
    testTypeId: z.number(),
    resultText: z.string().optional(), // Keep for backward compatibility
    findings: z.string().optional(),
    conclusion: z.string().optional(),
    additionalNotes: z.string().optional(),
    attachments: z.array(z.object({
      path: z.string(),
      type: z.string(),
      originalName: z.string()
    })).optional()
  }))
});

exports.getOrders = async (req, res) => {
  try {
    const currentUser = req.user;
    const { status } = req.query; // 'PENDING' or 'COMPLETED'
    const isDentalDoctor = currentUser.specialty === 'dentist' || (currentUser.qualifications && currentUser.qualifications.includes('Dentist'));

    const statusFilter = status === 'COMPLETED'
      ? { in: ['COMPLETED'] }
      : status === 'ALL'
        ? { in: ['PAID', 'QUEUED', 'IN_PROGRESS', 'COMPLETED'] }
        : { in: ['PAID', 'QUEUED', 'IN_PROGRESS'] };

    // Get batch orders instead of individual radiology orders
    const batchOrders = await prisma.batchOrder.findMany({
      where: {
        AND: [
          {
            OR: [
              { type: 'RADIOLOGY' },
              { type: 'MIXED' }
            ]
          },
          {
            OR: [
              // Regular orders that are paid
              {
                status: statusFilter
              },
              // Emergency orders that are unpaid (treated as pre-paid)
              {
                status: 'UNPAID',
                visit: {
                  isEmergency: true
                }
              }
            ]
          }
        ]
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
            status: true,
            isEmergency: true
          }
        },
        attachments: true
      },
      orderBy: [
        { createdAt: 'desc' } // Newest first for queue visibility
      ]
    });

    // Only filter dental orders for non-dental doctors (not for radiology staff)
    const filteredOrders = batchOrders.filter(order => {
      // If user is radiology staff, show all orders
      if (currentUser.role === 'RADIOLOGIST') {
        return true;
      }

      // If user is a dental doctor, show all orders
      if (isDentalDoctor) {
        return true;
      }

      // For other non-dental doctors, hide orders that contain dental services
      const hasDentalServices = order.services.some(service =>
        service.service?.code?.startsWith('DENTAL_') ||
        service.investigationType?.name?.toLowerCase().includes('dental')
      );

      return !hasDentalServices;
    });

    // Get walk-in radiology orders
    const walkInOrdersRaw = await prisma.radiologyOrder.findMany({
      where: {
        isWalkIn: true,
        status: statusFilter
      },
      include: {
        patient: { select: { id: true, name: true, mobile: true, type: true, email: true } },
        type: true,
        radiologyResults: { include: { testType: true, attachments: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Group walk-in orders by patient and billing (similar to lab orders)
    const groupedOrders = {};
    walkInOrdersRaw.forEach(order => {
      const key = `${order.patientId}-${order.billingId || 'no-billing'}`;
      if (!groupedOrders[key]) {
        groupedOrders[key] = {
          id: order.id, // Use first order ID as the group ID
          patientId: order.patientId,
          patient: order.patient,
          billingId: order.billingId,
          status: order.status,
          instructions: order.instructions,
          createdAt: order.createdAt,
          isWalkIn: true,
          services: [] // Array of individual orders as services
        };
      }

      // Add this order as a service
      groupedOrders[key].services.push({
        id: order.id,
        service: order.type, // The investigation type
        investigationType: order.type,
        radiologyResults: order.radiologyResults,
        status: order.status // CRITICAL: Include status for grouping logic
      });

      // Update group status if this order has a different status
      if (order.status !== groupedOrders[key].status) {
        // Group status logic:
        // 1. If ALL orders are COMPLETED, group is COMPLETED
        // 2. If ANY order is IN_PROGRESS, group is IN_PROGRESS
        // 3. Otherwise, use the status of the first order
        const groupServices = groupedOrders[key].services;
        const allCompleted = groupServices.every(s => s.status === 'COMPLETED');
        const anyInProgress = groupServices.some(s => s.status === 'IN_PROGRESS');

        if (allCompleted) {
          groupedOrders[key].status = 'COMPLETED';
        } else if (anyInProgress) {
          groupedOrders[key].status = 'IN_PROGRESS';
        } else {
          groupedOrders[key].status = order.status;
        }
      }
    });

    const groupedWalkInOrders = Object.values(groupedOrders).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json({ batchOrders: filteredOrders, walkInOrders: groupedWalkInOrders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.fillReport = async (req, res) => {
  try {
    const { orderId, testResults, isWalkIn: isWalkInRequest } = req.body;
    const radiologistId = req.user.id;

    console.log(`🔍 [fillReport] Processing order ${orderId}, isWalkInRequest: ${isWalkInRequest}, testResults count: ${testResults?.length || 0}`);

    let batchOrder = null;
    let isWalkIn = false;
    let walkInOrders = [];

    if (isWalkInRequest) {
      // Explicitly handle walk-in order
      const firstWalkInOrder = await prisma.radiologyOrder.findFirst({
        where: { id: orderId, isWalkIn: true },
        include: {
          patient: true,
          type: true
        }
      });

      if (firstWalkInOrder && firstWalkInOrder.billingId) {
        walkInOrders = await prisma.radiologyOrder.findMany({
          where: {
            billingId: firstWalkInOrder.billingId,
            isWalkIn: true,
            status: { in: ['PAID', 'QUEUED', 'IN_PROGRESS', 'COMPLETED'] }
          },
          include: {
            patient: true,
            type: true
          },
          orderBy: { createdAt: 'asc' }
        });

        if (walkInOrders.length > 0) {
          isWalkIn = true;
          console.log(`✅ [fillReport] Found ${walkInOrders.length} walk-in orders in billing group`);
        }
      }
    } else {
      // Handle batch order
      batchOrder = await prisma.batchOrder.findUnique({
        where: { id: orderId },
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
          visit: {
            select: {
              id: true,
              visitUid: true
            }
          },
          attachments: true
        }
      });
    }

    if (!batchOrder && !isWalkIn) {
      console.log(`❌ [fillReport] Order ${orderId} not found (isWalkInRequest: ${isWalkInRequest})`);
      return res.status(404).json({ error: 'Radiology order not found' });
    }

    if (batchOrder && !['QUEUED', 'PAID', 'IN_PROGRESS', 'COMPLETED'].includes(batchOrder.status)) {
      console.log(`⚠️  [fillReport] Batch order ${orderId} has status '${batchOrder.status}', which is not processable.`);
      return res.status(400).json({
        error: 'Order is not in queue for processing',
        currentStatus: batchOrder.status
      });
    }

    // Create individual radiology results for each test
    const createdResults = [];

    if (isWalkIn) {
      // Handle walk-in orders - create results for each radiology order
      for (const testResult of testResults) {
        const { testTypeId, resultText, clinicalIndication, technique, comparison, findings, conclusion, recommendations, additionalNotes, attachments } = testResult;

        // Find the corresponding walk-in order for this test type
        const walkInOrder = walkInOrders.find(order => order.typeId === testTypeId);
        if (!walkInOrder) {
          console.warn(`⚠️  No walk-in order found for testTypeId: ${testTypeId}`);
          continue;
        }

        // Update existing result for this test or create a new one.
        const existingResult = await prisma.radiologyResult.findFirst({
          where: {
            orderId: walkInOrder.id,
            testTypeId: testTypeId
          }
        });

        const resultData = {
          resultText: resultText || findings || conclusion || 'No result provided',
          clinicalIndication: clinicalIndication || null,
          technique: technique || null,
          comparison: comparison || null,
          findings: findings || null,
          conclusion: conclusion || null,
          recommendations: recommendations || null,
          additionalNotes: additionalNotes || '',
          status: 'COMPLETED',
          processedBy: radiologistId
        };

        const radiologyResult = existingResult
          ? await prisma.radiologyResult.update({
            where: { id: existingResult.id },
            data: resultData
          })
          : await prisma.radiologyResult.create({
            data: {
              orderId: walkInOrder.id,
              testTypeId: testTypeId,
              ...resultData
            }
          });

        // Handle file attachments for this specific test
        if (attachments && attachments.length > 0) {
          for (const attachment of attachments) {
            const fileUrl = attachment.path || attachment.fileUrl || attachment;
            const fileName = attachment.originalName || attachment.fileName || 'uploaded_file';
            const fileType = attachment.type || attachment.fileType || 'image/png';

            const existingFile = await prisma.radiologyResultFile.findFirst({
              where: {
                resultId: radiologyResult.id,
                fileUrl,
                fileName
              }
            });

            if (!existingFile) {
              await prisma.radiologyResultFile.create({
                data: {
                  resultId: radiologyResult.id,
                  fileUrl,
                  fileName,
                  fileType,
                  uploadedBy: radiologistId
                }
              });
            }
          }
        }

        // Update walk-in order status to COMPLETED
        await prisma.radiologyOrder.update({
          where: { id: walkInOrder.id },
          data: { status: 'COMPLETED' }
        });

        createdResults.push(radiologyResult);
      }

      // Return response for walk-in orders
      const patient = walkInOrders[0].patient;
      res.json({
        message: 'Walk-in radiology report completed successfully',
        patient: {
          id: patient.id,
          name: patient.name,
          type: patient.type
        },
        results: createdResults
      });
      return;
    }

    // Handle batch orders (existing code)
    for (const testResult of testResults) {
      const { testTypeId, resultText, clinicalIndication, technique, comparison, findings, conclusion, recommendations, additionalNotes, attachments } = testResult;

      // Update existing result for this test or create a new one.
      const existingResult = await prisma.radiologyResult.findFirst({
        where: {
          batchOrderId: orderId,
          testTypeId: testTypeId
        }
      });

      const resultData = {
        resultText: resultText || findings || conclusion || 'No result provided',
        clinicalIndication: clinicalIndication || null,
        technique: technique || null,
        comparison: comparison || null,
        findings: findings || null,
        conclusion: conclusion || null,
        recommendations: recommendations || null,
        additionalNotes: additionalNotes || '',
        status: 'COMPLETED',
        processedBy: radiologistId
      };

      const radiologyResult = existingResult
        ? await prisma.radiologyResult.update({
          where: { id: existingResult.id },
          data: resultData
        })
        : await prisma.radiologyResult.create({
          data: {
            batchOrderId: orderId,
            testTypeId: testTypeId,
            ...resultData
          }
        });

      // Handle file attachments for this specific test
      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          // Create RadiologyResultFile record with the file path from the uploaded file
          const fileUrl = attachment.path || attachment.fileUrl || attachment;
          const fileName = attachment.originalName || attachment.fileName || 'uploaded_file';
          const fileType = attachment.type || attachment.fileType || 'image/png';

          const existingFile = await prisma.radiologyResultFile.findFirst({
            where: {
              resultId: radiologyResult.id,
              fileUrl,
              fileName
            }
          });

          if (!existingFile) {
            await prisma.radiologyResultFile.create({
              data: {
                resultId: radiologyResult.id,
                fileUrl,
                fileName,
                fileType,
                uploadedBy: radiologistId
              }
            });
          }
        }
      }

      createdResults.push(radiologyResult);
    }

    console.log(`✅ [fillReport] Created ${createdResults.length} radiology results for batch order ${orderId}`);

    // Update individual radiology services to COMPLETED
    for (const service of batchOrder.services) {
      if (service.investigationType?.category === 'RADIOLOGY' || service.service?.code?.startsWith('RAD_')) {
        await prisma.batchOrderService.update({
          where: { id: service.id },
          data: { status: 'COMPLETED' }
        });
      }
    }

    // Re-fetch batch order to get updated service statuses
    const updatedBatchOrderSnapshot = await prisma.batchOrder.findUnique({
      where: { id: orderId },
      include: { services: true }
    });

    // Determine if the WHOLE batch order is now complete
    const allServicesCompleted = updatedBatchOrderSnapshot.services.every(s => s.status === 'COMPLETED');

    if (allServicesCompleted) {
      console.log(`🔄 [fillReport] All services done. Updating batch order ${orderId} to 'COMPLETED'...`);
      await prisma.batchOrder.update({
        where: { id: orderId },
        data: {
          status: 'COMPLETED',
          updatedAt: new Date()
        }
      });
    } else {
      console.log(`ℹ️ [fillReport] Some services still pending in batch order ${orderId}. Keeping status as is.`);
    }

    // Assign for the response (using a fresh fetch to be sure)
    updatedBatchOrder = await prisma.batchOrder.findUnique({
      where: { id: orderId },
      include: {
        services: { include: { service: true, investigationType: true } },
        patient: { select: { id: true, name: true, type: true } },
        doctor: { select: { id: true, fullname: true } },
        visit: { select: { id: true, visitUid: true } }
      }
    });

    // Handle legacy file attachments if provided (for backward compatibility)
    if (req.body.attachments && req.body.attachments.length > 0) {
      for (const attachment of req.body.attachments) {
        await prisma.file.create({
          data: {
            patientId: batchOrder.patientId,
            batchOrderId: orderId,
            path: attachment.path,
            type: attachment.type,
            accessLog: JSON.stringify([{
              accessedAt: new Date(),
              accessedBy: radiologistId,
              action: 'UPLOADED'
            }])
          }
        });
      }
    }

    // Create medical history entry
    await prisma.medicalHistory.create({
      data: {
        patientId: batchOrder.patientId,
        details: JSON.stringify({
          type: 'RADIOLOGY_RESULT',
          batchOrderId: batchOrder.id,
          services: batchOrder.services.map(s => s.investigationType?.name).join(', '),
          testResults: createdResults.map(r => ({
            testType: r.testTypeId,
            result: r.resultText,
            notes: r.additionalNotes
          })),
          completedAt: new Date(),
          completedBy: radiologistId
        })
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: radiologistId,
        action: 'FILL_RADIOLOGY_REPORT',
        entity: 'BatchOrder',
        entityId: batchOrder.id,
        details: JSON.stringify({
          batchOrderId: batchOrder.id,
          patientId: batchOrder.patientId,
          services: batchOrder.services.map(s => s.investigationType?.name).join(', '),
          testResults: createdResults.map(r => ({
            testType: r.testTypeId,
            result: r.resultText,
            notes: r.additionalNotes
          }))
        }),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    // Check if all investigations for this visit are completed
    try {
      const completionResult = await checkVisitInvestigationCompletion(batchOrder.visitId);
      console.log(`📋 Visit ${batchOrder.visitId} completion check result:`, completionResult.isComplete);
    } catch (error) {
      console.error('Error checking investigation completion:', error);

      // Fallback: manually check and update if needed
      try {
        const visit = await prisma.visit.findUnique({
          where: { id: batchOrder.visitId },
          include: { batchOrders: true }
        });

        if (visit && visit.batchOrders.every(order => order.status === 'COMPLETED')) {
          await prisma.visit.update({
            where: { id: batchOrder.visitId },
            data: {
              status: 'AWAITING_RESULTS_REVIEW',
              queueType: 'RESULTS_REVIEW',
              updatedAt: new Date()
            }
          });
          console.log(`🔄 Fallback: Visit ${batchOrder.visitId} updated to AWAITING_RESULTS_REVIEW`);
        }
      } catch (fallbackError) {
        console.error('Fallback visit update failed:', fallbackError?.message || fallbackError);
      }
    }

    res.json({
      message: 'Radiology report completed successfully',
      batchOrder: updatedBatchOrder
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.getInvestigationTypes = async (req, res) => {
  try {
    const types = await prisma.investigationType.findMany({
      where: {
        isActive: true,
        category: 'RADIOLOGY',
        OR: [
          { serviceId: null },
          { service: { isActive: true } }
        ]
      },
      include: {
        service: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
            price: true,
            isActive: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json({ investigationTypes: types });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getOrganizedInvestigationTypes = async (req, res) => {
  try {
    const categories = await prisma.radiologyCategory.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        investigationTypes: {
          where: {
            isActive: true,
            OR: [
              { serviceId: null },
              { service: { isActive: true } }
            ]
          },
          include: {
            service: {
              select: {
                id: true,
                code: true,
                name: true,
                category: true,
                price: true,
                isActive: true
              }
            }
          },
          orderBy: { name: 'asc' }
        }
      }
    });

    const organized = {};
    for (const cat of categories) {
      organized[cat.name] = {
        id: cat.id,
        displayOrder: cat.displayOrder,
        tests: cat.investigationTypes.map(t => ({
          id: t.id,
          name: t.name,
          price: t.service?.price || 0,
          code: t.service?.code || '',
          description: t.description,
          serviceId: t.serviceId,
        }))
      };
    }

    res.json({ organized });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.uploadAttachment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check if order exists
    const order = await prisma.radiologyOrder.findUnique({
      where: { id: parseInt(orderId) }
    });

    if (!order) {
      return res.status(404).json({ error: 'Radiology order not found' });
    }

    // Create file record
    const fileRecord = await prisma.file.create({
      data: {
        patientId: order.patientId,
        radiologyOrderId: order.id,
        path: file.path,
        type: file.mimetype,
        accessLog: [`Uploaded by ${req.user.fullname} at ${new Date().toISOString()}`]
      }
    });

    res.json({
      message: 'File uploaded successfully',
      file: fileRecord
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.uploadBatchAttachment = async (req, res) => {
  try {
    const { batchOrderId } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check if batch order exists
    const batchOrder = await prisma.batchOrder.findUnique({
      where: { id: parseInt(batchOrderId) }
    });

    if (!batchOrder) {
      return res.status(404).json({ error: 'Batch order not found' });
    }

    // Create file record
    const fileRecord = await prisma.file.create({
      data: {
        patientId: batchOrder.patientId,
        batchOrderId: parseInt(batchOrderId),
        path: file.path,
        type: file.mimetype,
        accessLog: [`Uploaded by ${req.user.fullname || req.user.id} at ${new Date().toISOString()}`]
      }
    });

    res.json({
      message: 'File uploaded successfully',
      file: fileRecord
    });
  } catch (error) {
    console.error('Error uploading batch attachment:', error);
    res.status(500).json({ error: error.message });
  }
};

// New per-test result management functions
const createRadiologyResultSchema = z.object({
  orderId: z.number(),
  testTypeId: z.number(),
  resultText: z.string().optional(),
  additionalNotes: z.string().optional()
});

exports.createRadiologyResult = async (req, res) => {
  try {
    const data = createRadiologyResultSchema.parse(req.body);
    const radiologistId = req.user.id;

    // Check if radiology order exists and is in correct status
    const radiologyOrder = await prisma.radiologyOrder.findUnique({
      where: { id: data.orderId },
      include: {
        patient: true,
        visit: true
      }
    });

    if (!radiologyOrder) {
      return res.status(404).json({ error: 'Radiology order not found' });
    }

    if (radiologyOrder.status !== 'QUEUED' && radiologyOrder.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Radiology order is not in correct status for result entry' });
    }

    // Create radiology result
    const radiologyResult = await prisma.radiologyResult.create({
      data: {
        orderId: data.orderId,
        testTypeId: data.testTypeId,
        resultText: data.resultText,
        additionalNotes: data.additionalNotes,
        status: 'COMPLETED',
        processedBy: radiologistId,
      },
      include: {
        testType: true,
        attachments: true
      }
    });

    // Update radiology order status if this is the last result
    const allResults = await prisma.radiologyResult.findMany({
      where: { orderId: data.orderId }
    });

    if (allResults.length > 0) {
      await prisma.radiologyOrder.update({
        where: { id: data.orderId },
        data: { status: 'COMPLETED' }
      });

      // Check if all investigations for this visit are completed
      try {
        await checkVisitInvestigationCompletion(radiologyOrder.visitId);
      } catch (error) {
        console.error('Error checking investigation completion:', error);
        // Don't fail the request if investigation completion check fails
      }
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: radiologistId,
        action: 'CREATE_RADIOLOGY_RESULT',
        entity: 'RadiologyResult',
        entityId: radiologyResult.id,
        details: JSON.stringify({
          orderId: data.orderId,
          testTypeId: data.testTypeId,
          resultText: data.resultText
        }),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({ radiologyResult });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.uploadRadiologyResultFile = async (req, res) => {
  try {
    const { resultId } = req.params;
    const file = req.file;
    const radiologistId = req.user.id;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check if radiology result exists
    const radiologyResult = await prisma.radiologyResult.findUnique({
      where: { id: resultId },
      include: {
        order: {
          include: {
            patient: true
          }
        }
      }
    });

    if (!radiologyResult) {
      return res.status(404).json({ error: 'Radiology result not found' });
    }

    // Create file record
    const radiologyResultFile = await prisma.radiologyResultFile.create({
      data: {
        resultId: resultId,
        fileUrl: file.path,
        fileName: file.originalname,
        fileType: file.mimetype,
        uploadedBy: radiologistId
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: radiologistId,
        action: 'UPLOAD_RADIOLOGY_RESULT_FILE',
        entity: 'RadiologyResultFile',
        entityId: radiologyResultFile.id,
        details: JSON.stringify({
          resultId: resultId,
          fileName: file.originalname,
          fileType: file.mimetype
        }),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({ radiologyResultFile });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getRadiologyResults = async (req, res) => {
  try {
    const { orderId } = req.params;

    const radiologyResults = await prisma.radiologyResult.findMany({
      where: { orderId: parseInt(orderId) },
      include: {
        testType: true,
        attachments: true
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({ radiologyResults });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// New batch order radiology result functions
exports.createBatchRadiologyResult = async (req, res) => {
  try {
    const { batchOrderId } = req.params;
    const { testTypeId, resultText, findings, conclusion, additionalNotes } = req.body;
    const radiologistId = req.user.id;

    // Check if batch order exists and is in correct status
    const batchOrder = await prisma.batchOrder.findUnique({
      where: { id: parseInt(batchOrderId) },
      include: {
        services: {
          include: {
            investigationType: true
          }
        },
        patient: true,
        visit: true
      }
    });

    if (!batchOrder) {
      return res.status(404).json({ error: 'Batch order not found' });
    }

    if (!['QUEUED', 'IN_PROGRESS', 'COMPLETED'].includes(batchOrder.status)) {
      return res.status(400).json({ error: 'Order must be queued, in progress, or completed to add results' });
    }

    // Verify the test type is part of this batch order
    const serviceExists = batchOrder.services.some(service =>
      service.investigationType &&
      service.investigationType.id === testTypeId &&
      service.investigationType.category === 'RADIOLOGY'
    );

    if (!serviceExists) {
      return res.status(400).json({ error: 'Test type is not part of this batch order' });
    }

    // Check if result already exists for this test type
    const existingResult = await prisma.radiologyResult.findFirst({
      where: {
        batchOrderId: parseInt(batchOrderId),
        testTypeId: testTypeId
      }
    });

    if (existingResult) {
      return res.status(400).json({ error: 'Result already exists for this test type' });
    }

    // Create radiology result directly linked to batch order
    const radiologyResult = await prisma.radiologyResult.create({
      data: {
        batchOrderId: parseInt(batchOrderId),
        testTypeId: testTypeId,
        resultText: resultText || findings || conclusion || null, // Keep for backward compatibility
        findings: findings || null,
        conclusion: conclusion || null,
        additionalNotes: additionalNotes,
        status: 'COMPLETED',
        processedBy: radiologistId,
      },
      include: {
        testType: true,
        attachments: true
      }
    });

    // Check if all radiology tests in this batch order are completed
    const radiologyServices = batchOrder.services.filter(service =>
      service.investigationType && service.investigationType.category === 'RADIOLOGY'
    );

    let allServicesCompleted = true;
    for (const service of radiologyServices) {
      const result = await prisma.radiologyResult.findFirst({
        where: {
          testTypeId: service.investigationType.id,
          batchOrderId: parseInt(batchOrderId)
        }
      });
      if (!result) {
        allServicesCompleted = false;
        break;
      }
    }

    // If all radiology tests are completed, update batch order status
    if (allServicesCompleted) {
      await prisma.batchOrder.update({
        where: { id: parseInt(batchOrderId) },
        data: {
          status: 'COMPLETED',
          result: resultText, // Use the latest result as general result
          additionalNotes: additionalNotes,
          updatedAt: new Date()
        }
      });

      // Check if all investigations for this visit are completed
      try {
        await checkVisitInvestigationCompletion(batchOrder.visitId);
      } catch (error) {
        console.error('Error checking investigation completion:', error);
      }
    }

    res.json({
      message: 'Radiology result created successfully',
      radiologyResult: radiologyResult
    });

  } catch (error) {
    console.error('Error creating batch radiology result:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.uploadBatchRadiologyResultFile = async (req, res) => {
  try {
    const { batchOrderId, resultId } = req.params;
    const file = req.file;
    const radiologistId = req.user.id;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check if radiology result exists and belongs to the batch order
    const radiologyResult = await prisma.radiologyResult.findFirst({
      where: {
        id: resultId,
        batchOrderId: parseInt(batchOrderId)
      }
    });

    if (!radiologyResult) {
      return res.status(404).json({ error: 'Radiology result not found' });
    }

    // Create file record
    const fileRecord = await prisma.radiologyResultFile.create({
      data: {
        resultId: resultId,
        fileUrl: file.path,
        fileName: file.originalname,
        fileType: file.mimetype,
        uploadedBy: radiologistId
      }
    });

    res.json({
      message: 'File uploaded successfully',
      file: fileRecord
    });

  } catch (error) {
    console.error('Error uploading batch radiology result file:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getBatchRadiologyResults = async (req, res) => {
  try {
    const { batchOrderId } = req.params;

    // Get the batch order to find the visit and patient
    const batchOrder = await prisma.batchOrder.findUnique({
      where: { id: parseInt(batchOrderId) },
      include: {
        services: {
          include: {
            investigationType: true
          }
        }
      }
    });

    if (!batchOrder) {
      return res.status(404).json({ error: 'Batch order not found' });
    }

    // Get radiology results for this batch order
    const radiologyResultsRaw = await prisma.radiologyResult.findMany({
      where: {
        batchOrderId: parseInt(batchOrderId)
      },
      include: {
        testType: true,
        attachments: {
          orderBy: { uploadedAt: 'asc' },
          take: 1 // Get first attachment to find radiologist
        },
        batchOrder: true
      },
      orderBy: { createdAt: 'asc' }
    });

    // Fetch radiologist info from attachments
    const radiologyResults = await Promise.all(radiologyResultsRaw.map(async (result) => {
      let radiologistUser = null;
      if (result.attachments && result.attachments.length > 0 && result.attachments[0].uploadedBy) {
        try {
          radiologistUser = await prisma.user.findUnique({
            where: { id: result.attachments[0].uploadedBy },
            select: { id: true, fullname: true, role: true }
          });
        } catch (err) {
          console.error('Error fetching radiologist user:', err);
        }
      }
      return {
        ...result,
        radiologistUser: radiologistUser
      };
    }));

    // Debug logging
    console.log(`📋 [getBatchRadiologyResults] Found ${radiologyResults.length} radiology results for batch order ${batchOrderId}`);
    radiologyResults.forEach((result, idx) => {
      console.log(`  Result ${idx + 1}: ${result.testType?.name}, attachments: ${result.attachments?.length || 0}`);
      if (result.attachments && result.attachments.length > 0) {
        result.attachments.forEach((att, attIdx) => {
          console.log(`    Attachment ${attIdx + 1}: ${att.fileName} (${att.fileUrl})`);
        });
      }
    });

    res.json({ radiologyResults });

  } catch (error) {
    console.error('Error fetching batch radiology results:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get template for a specific radiology test type
exports.getTemplate = async (req, res) => {
  try {
    const { investigationTypeId } = req.params;
    const parsedId = parseInt(investigationTypeId);

    console.log(`🔍 [Radiology Template] Fetching template for investigationTypeId: ${parsedId} (raw: ${investigationTypeId})`);

    const template = await prisma.radiologyTemplate.findUnique({
      where: { investigationTypeId: parsedId },
      include: {
        investigationType: {
          select: {
            id: true,
            name: true,
            category: true
          }
        }
      }
    });

    if (!template) {
      console.log(`⚠️  [Radiology Template] Template NOT FOUND for investigationTypeId: ${parsedId}`);
      return res.json({ template: null });
    }

    console.log(`✅ [Radiology Template] Template found for ${template.investigationType.name} (ID: ${template.investigationType.id}):`, {
      hasClinicalIndication: !!template.clinicalIndicationTemplate,
      hasTechnique: !!template.techniqueTemplate,
      hasFindings: !!template.findingsTemplate,
      findingsLength: template.findingsTemplate?.length || 0,
      hasConclusion: !!template.conclusionTemplate,
      conclusionLength: template.conclusionTemplate?.length || 0
    });

    res.json({ template });
  } catch (error) {
    console.error(`❌ [Radiology Template] Error fetching template for investigationTypeId ${req.params.investigationTypeId}:`, error);
    res.status(500).json({ error: error.message });
  }
};

// Get all templates (for admin)
exports.getAllTemplates = async (req, res) => {
  try {
    const templates = await prisma.radiologyTemplate.findMany({
      where: { isActive: true },
      include: {
        investigationType: {
          select: {
            id: true,
            name: true,
            category: true,
            price: true
          }
        }
      },
      orderBy: {
        investigationType: {
          name: 'asc'
        }
      }
    });

    res.json({ templates });
  } catch (error) {
    console.error('Error fetching radiology templates:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.completeBatchRadiologyOrder = async (req, res) => {
  try {
    const { batchOrderId } = req.params;
    const radiologistId = req.user.id;

    // Get the batch order
    const batchOrder = await prisma.batchOrder.findUnique({
      where: { id: parseInt(batchOrderId) },
      include: {
        services: {
          include: {
            investigationType: true
          }
        },
        visit: true
      }
    });

    if (!batchOrder) {
      return res.status(404).json({ error: 'Batch order not found' });
    }

    if (batchOrder.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Batch order is already completed' });
    }

    // Update batch order status to completed
    const updatedBatchOrder = await prisma.batchOrder.update({
      where: { id: parseInt(batchOrderId) },
      data: {
        status: 'COMPLETED',
        updatedAt: new Date()
      },
      include: {
        services: {
          include: {
            investigationType: true
          }
        },
        visit: true
      }
    });

    // Update all services to COMPLETED as well
    await prisma.batchOrderService.updateMany({
      where: { batchOrderId: parseInt(batchOrderId) },
      data: { status: 'COMPLETED' }
    });

    // Check if all investigations for this visit are completed
    try {
      const { checkVisitInvestigationCompletion } = require('../utils/investigationUtils');
      await checkVisitInvestigationCompletion(batchOrder.visitId);
    } catch (error) {
      console.error('Error checking investigation completion:', error);
      // Don't fail the request if investigation completion check fails
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: radiologistId,
        action: 'COMPLETE_RADIOLOGY_BATCH_ORDER',
        entity: 'BatchOrder',
        entityId: parseInt(batchOrderId),
        details: JSON.stringify({
          batchOrderId: parseInt(batchOrderId),
          visitId: batchOrder.visitId,
          services: batchOrder.services.map(s => s.investigationType?.name).join(', ')
        }),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({
      message: 'Radiology batch order completed successfully',
      batchOrder: updatedBatchOrder
    });

  } catch (error) {
    console.error('Error completing radiology batch order:', error);
    res.status(500).json({ error: error.message });
  }
};

// Generate PDF for radiology results (works for both batch orders and walk-in orders automatically)
exports.generateRadiologyResultsPDF = async (req, res) => {
  try {
    const { batchOrderId } = req.params;
    const radiologistId = req.user.id;
    const orderId = parseInt(batchOrderId);

    // Always use A4 paper size
    const selectedPaperSize = 'A4';

    console.log(`\n📸 [Radiology PDF] ===== Starting PDF Generation =====`);
    console.log(`📸 [Radiology PDF] Order ID: ${orderId}, Paper Size: A4`);
    console.log(`📸 [Radiology PDF] User ID: ${radiologistId}`);

    let batchOrder = null;
    let walkInOrders = [];
    let radiologyResults = [];
    let patient = null;
    let orderDate = null;
    let orderStatus = null;

    // First, try to get batch order
    batchOrder = await prisma.batchOrder.findUnique({
      where: { id: orderId },
      include: {
        patient: true,
        services: {
          include: {
            service: true,
            investigationType: true
          }
        },
        doctor: {
          select: {
            fullname: true
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

    if (batchOrder) {
      // This is a batch order
      console.log(`✅ [Radiology PDF] Found batch order ${orderId}`);
      console.log(`   Patient: ${batchOrder.patient?.name || 'N/A'}`);
      console.log(`   Status: ${batchOrder.status}`);
      patient = batchOrder.patient;
      orderDate = batchOrder.createdAt;
      orderStatus = batchOrder.status;

      // Get radiology results for batch order
      radiologyResults = await prisma.radiologyResult.findMany({
        where: { batchOrderId: orderId },
        include: {
          testType: true,
          attachments: true
        },
        orderBy: { createdAt: 'asc' }
      });
      console.log(`📸 [Radiology PDF] Found ${radiologyResults.length} radiology results for batch order`);
    } else {
      console.log(`⚠️  [Radiology PDF] Batch order ${orderId} not found, checking walk-in orders...`);
      // Try walk-in order - the orderId could be from a grouped order
      // First try finding by ID directly
      let firstWalkInOrder = await prisma.radiologyOrder.findFirst({
        where: { id: orderId, isWalkIn: true },
        include: {
          patient: true,
          type: true,
          billing: true,
          radiologyResults: {
            include: {
              testType: true,
              attachments: true
            }
          }
        }
      });

      // If not found by direct ID, try finding by checking all walk-in orders
      // The frontend might be using a group ID that doesn't match the actual order ID
      if (!firstWalkInOrder) {
        console.log(`⚠️  [Radiology PDF] Order ${orderId} not found directly, searching all walk-in orders...`);

        // Get all walk-in orders to check if any have results
        // This is a fallback for when the ID doesn't match directly
        const allWalkInWithResults = await prisma.radiologyOrder.findMany({
          where: {
            isWalkIn: true,
            radiologyResults: {
              some: {}
            }
          },
          include: {
            patient: true,
            type: true,
            billing: true,
            radiologyResults: {
              include: {
                testType: true,
                attachments: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10 // Limit to recent orders
        });

        console.log(`🔍 [Radiology PDF] Found ${allWalkInWithResults.length} walk-in orders with results`);

        // Try to find an order that might match (maybe by checking if orderId is in a billing group)
        for (const order of allWalkInWithResults) {
          if (order.billingId) {
            const groupOrders = await prisma.radiologyOrder.findMany({
              where: {
                billingId: order.billingId,
                isWalkIn: true
              },
              include: {
                patient: true,
                type: true,
                radiologyResults: {
                  include: {
                    testType: true,
                    attachments: true
                  }
                }
              },
              orderBy: { createdAt: 'asc' }
            });

            // Check if any order in this group has the ID we're looking for
            const match = groupOrders.find(o => o.id === orderId);
            if (match || groupOrders.length > 0) {
              // Use the first order from the group that has this billingId
              if (order.id === orderId || groupOrders.some(o => o.id === orderId)) {
                firstWalkInOrder = groupOrders[0] || order;
                walkInOrders = groupOrders;
                console.log(`✅ [Radiology PDF] Found matching walk-in order group with ${walkInOrders.length} orders`);
                break;
              }
            }
          }
        }
      } else {
        // Found order directly, now get all orders in the billing group
        if (firstWalkInOrder.billingId) {
          walkInOrders = await prisma.radiologyOrder.findMany({
            where: {
              billingId: firstWalkInOrder.billingId,
              isWalkIn: true
            },
            include: {
              patient: true,
              type: true,
              radiologyResults: {
                include: {
                  testType: true,
                  attachments: true
                }
              }
            },
            orderBy: { createdAt: 'asc' }
          });
          console.log(`✅ [Radiology PDF] Found ${walkInOrders.length} walk-in orders in billing group ${firstWalkInOrder.billingId}`);
        } else {
          walkInOrders = [firstWalkInOrder];
          console.log(`✅ [Radiology PDF] Found single walk-in order ${orderId}`);
        }
      }

      if (!firstWalkInOrder && walkInOrders.length === 0) {
        // Last resort: search for any completed radiology order with results
        console.log(`⚠️  [Radiology PDF] Trying last resort: searching all radiology results...`);
        const allResults = await prisma.radiologyResult.findMany({
          where: {
            OR: [
              { batchOrderId: orderId },
              { orderId: orderId }
            ]
          },
          include: {
            testType: true,
            batchOrder: {
              include: { patient: true }
            },
            radiologyOrder: {
              include: { patient: true }
            },
            attachments: true
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        });

        if (allResults.length > 0) {
          console.log(`✅ [Radiology PDF] Found ${allResults.length} results by searching radiology results directly`);
          radiologyResults = allResults;

          // Get patient from first result
          if (allResults[0].batchOrder) {
            patient = allResults[0].batchOrder.patient;
            orderDate = allResults[0].batchOrder.createdAt;
            orderStatus = allResults[0].batchOrder.status;
          } else if (allResults[0].radiologyOrder) {
            patient = allResults[0].radiologyOrder.patient;
            orderDate = allResults[0].radiologyOrder.createdAt;
            orderStatus = allResults[0].radiologyOrder.status;
          }
        } else {
          console.log(`❌ [Radiology PDF] Order ${orderId} not found anywhere`);
          return res.status(404).json({
            error: `Radiology order ${orderId} not found`,
            details: 'Please ensure the order has been completed and results have been saved.'
          });
        }
      } else {
        // Get patient and order info from first walk-in order
        const sourceOrder = firstWalkInOrder || walkInOrders[0];
        patient = sourceOrder.patient;
        orderDate = sourceOrder.createdAt;

        // Determine group status
        if (walkInOrders.length > 0) {
          if (walkInOrders.every(o => o.status === 'COMPLETED')) {
            orderStatus = 'COMPLETED';
          } else if (walkInOrders.some(o => o.status === 'IN_PROGRESS')) {
            orderStatus = 'IN_PROGRESS';
          } else {
            orderStatus = walkInOrders[0].status;
          }
        } else {
          orderStatus = sourceOrder.status;
        }

        // Collect all radiology results from all walk-in orders
        radiologyResults = walkInOrders.length > 0
          ? walkInOrders.flatMap(order => order.radiologyResults || [])
          : (firstWalkInOrder.radiologyResults || []);
      }
    }

    // Calculate age from dob
    if (patient?.dob) {
      const today = new Date();
      const birthDate = new Date(patient.dob);
      patient.age = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
    }

    if (radiologyResults.length === 0) {
      console.log(`⚠️  [Radiology PDF] No radiology results found for order ${orderId}`);
      return res.status(404).json({ error: 'No radiology results found for this order. Please complete the radiology tests first.' });
    }

    if (!patient) {
      console.log(`❌ [Radiology PDF] Patient information not found for order ${orderId}`);
      return res.status(404).json({ error: 'Patient information not found' });
    }

    console.log(`✅ [Radiology PDF] Successfully prepared ${radiologyResults.length} radiology results for order ${orderId}`);

    // Get radiologist info
    const radiologist = await prisma.user.findUnique({
      where: { id: radiologistId },
      select: { fullname: true, username: true }
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

    // Build PDF content (NOT including images - only findings and conclusion)
    const pdfContent = [];

    // Subheader
    pdfContent.push({
      text: 'Radiology Results',
      style: 'subheader',
      margin: [0, 0, 0, 20]
    });

    // Patient Information
    pdfContent.push({
      text: 'Patient Information',
      style: 'sectionTitle'
    });

    pdfContent.push({
      columns: [
        { text: `Name: ${patient.name}`, style: 'field' },
        { text: `ID: ${patient.id}`, style: 'field' },
        { text: `Gender: ${patient.gender || 'N/A'}`, style: 'field' }
      ],
      margin: [0, 0, 0, 5]
    });

    pdfContent.push({
      columns: [
        { text: `Age: ${patient.age || 'N/A'}`, style: 'field' },
        { text: `Blood Type: ${patient.bloodType || 'N/A'}`, style: 'field' },
        { text: `Phone: ${patient.mobile || 'N/A'}`, style: 'field' }
      ],
      margin: [0, 0, 0, 15]
    });

    pdfContent.push({
      text: `Order ID: ${orderId} | Date: ${formatDate(orderDate)} | Status: ${orderStatus.replace(/_/g, ' ')}`,
      style: 'field',
      margin: [0, 0, 0, 15]
    });

    // Results Section
    pdfContent.push({
      text: 'Radiology Results',
      style: 'sectionTitle'
    });

    // Add each radiology result (findings and conclusion only, NO images)
    radiologyResults.forEach((result, index) => {
      const testType = result.testType || result.type;
      const testName = testType?.name || 'Radiology Test';

      const testStack = [];

      testStack.push({
        text: `${index + 1}. ${testName}`,
        style: 'testTitle',
        margin: [0, 10, 0, 10]
      });

      // Add Clinical Indication
      if (result.clinicalIndication) {
        testStack.push({
          text: 'CLINICAL INDICATION:',
          style: 'tableHeader',
          bold: true,
          margin: [0, 5, 0, 5]
        });
        testStack.push({
          text: result.clinicalIndication,
          style: 'tableCell',
          margin: [10, 0, 0, 10]
        });
      }

      // Add Technique
      if (result.technique) {
        testStack.push({
          text: 'TECHNIQUE:',
          style: 'tableHeader',
          bold: true,
          margin: [0, 5, 0, 5]
        });
        testStack.push({
          text: result.technique,
          style: 'tableCell',
          margin: [10, 0, 0, 10]
        });
      }

      // Add Comparison
      if (result.comparison) {
        testStack.push({
          text: 'COMPARISON:',
          style: 'tableHeader',
          bold: true,
          margin: [0, 5, 0, 5]
        });
        testStack.push({
          text: result.comparison,
          style: 'tableCell',
          margin: [10, 0, 0, 10]
        });
      }

      // Add Findings
      if (result.findings) {
        testStack.push({
          text: 'FINDINGS:',
          style: 'tableHeader',
          bold: true,
          margin: [0, 5, 0, 5]
        });
        testStack.push({
          text: result.findings,
          style: 'tableCell',
          margin: [10, 0, 0, 10]
        });
      }

      // Add Conclusion
      if (result.conclusion) {
        testStack.push({
          text: 'CONCLUSION:',
          style: 'tableHeader',
          bold: true,
          margin: [0, 5, 0, 5]
        });
        testStack.push({
          text: result.conclusion,
          style: 'tableCell',
          margin: [10, 0, 0, 10]
        });
      }

      // Add Recommendations
      if (result.recommendations) {
        testStack.push({
          text: 'RECOMMENDATIONS:',
          style: 'tableHeader',
          bold: true,
          margin: [0, 5, 0, 5]
        });
        testStack.push({
          text: result.recommendations,
          style: 'tableCell',
          margin: [10, 0, 0, 10]
        });
      }

      // Add results text if no structured fields are present (backward compatibility)
      if (!result.clinicalIndication && !result.technique && !result.comparison && !result.findings && !result.conclusion && !result.recommendations && result.resultText) {
        testStack.push({
          text: 'RESULT:',
          style: 'tableHeader',
          bold: true,
          margin: [0, 5, 0, 5]
        });
        testStack.push({
          text: result.resultText,
          style: 'tableCell',
          margin: [10, 0, 0, 10]
        });
      }

      if (result.additionalNotes) {
        testStack.push({
          text: `Notes: ${result.additionalNotes}`,
          style: 'notes',
          margin: [0, 0, 0, 10]
        });
      }

      // Push the stack with unbreakable property
      pdfContent.push({
        stack: testStack,
        unbreakable: true,
        margin: [0, 0, 0, 20] // Space between different tests
      });

      // Note: We intentionally do NOT include images in the PDF
      if (result.attachments && result.attachments.length > 0) {
        pdfContent.push({
          text: `Note: ${result.attachments.length} image(s) attached (not included in print)`,
          style: 'notes',
          margin: [0, 0, 0, 10]
        });
      }
    });

    // Add signature section
    pdfContent.push({
      text: 'Radiologist:',
      style: 'signatureLabel',
      margin: [0, 20, 0, 5]
    });
    pdfContent.push({
      text: radiologist?.fullname || 'Radiologist',
      style: 'signatureName',
      margin: [0, 0, 0, 10]
    });

    // Create PDF document using utility
    try {
      console.log(`📸 [Radiology PDF] Creating PDF document definition...`);
      const docDefinition = createPDFDocument({
        paperSize: selectedPaperSize,
        clinicName: getDefaultClinicName(),
        content: pdfContent,
        includeLogo: true,
        footerText: `Generated on: ${formatDateTime(new Date())}`
      });
      console.log(`✅ [Radiology PDF] PDF document definition created successfully`);

      // Generate PDF - ensure uploads directory exists
      const uploadsDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadsDir)) {
        console.log(`📁 [Radiology PDF] Creating uploads directory: ${uploadsDir}`);
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const fileName = `radiology-results-${orderId}-${Date.now()}.pdf`;
      const filePath = path.join(uploadsDir, fileName);

      console.log(`📸 [Radiology PDF] Generating PDF file for order ${orderId} with paper size ${selectedPaperSize}...`);
      console.log(`   File path: ${filePath}`);

      await generatePDF(docDefinition, filePath);
      console.log(`✅ [Radiology PDF] PDF file generated successfully: ${filePath}`);

      // Check if file was created
      if (!fs.existsSync(filePath)) {
        console.error(`❌ [Radiology PDF] PDF file was not created: ${filePath}`);
        return res.status(500).json({ error: 'PDF file generation failed' });
      }

      const stats = fs.statSync(filePath);
      console.log(`📊 [Radiology PDF] PDF file size: ${stats.size} bytes`);

      if (stats.size === 0) {
        console.error(`❌ [Radiology PDF] PDF file is empty (0 bytes)`);
        return res.status(500).json({ error: 'PDF file generation failed - empty file' });
      }

      // Read the file and send it directly as a buffer
      // This is more reliable than sendFile for PDFs
      try {
        const fileBuffer = fs.readFileSync(filePath);
        console.log(`✅ [Radiology PDF] File read successfully, buffer size: ${fileBuffer.length} bytes`);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        res.setHeader('Content-Length', fileBuffer.length);
        res.setHeader('Cache-Control', 'no-cache');

        res.send(fileBuffer);
        console.log(`✅ [Radiology PDF] PDF sent successfully to client`);
      } catch (readError) {
        console.error(`❌ [Radiology PDF] Error reading/sending file:`, readError);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error reading PDF file', details: readError.message });
        }
      }
    } catch (pdfError) {
      console.error(`❌ [Radiology PDF] Error during PDF generation:`, pdfError);
      console.error(`   Stack:`, pdfError.stack);
      throw pdfError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error(`\n❌ [Radiology PDF] ===== ERROR =====`);
    console.error(`❌ [Radiology PDF] Error generating PDF for order ${req.params.batchOrderId}:`, error);
    console.error(`❌ [Radiology PDF] Stack:`, error.stack);
    console.error(`❌ [Radiology PDF] ===================\n`);

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Failed to generate PDF',
        message: error.message,
        details: 'Please check the server logs for more information.'
      });
    }
  }
};

exports.getRadiologyReports = async (req, res) => {
  try {
    const { startDate, endDate, radiologistId, type } = req.query;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let start = startDate ? new Date(startDate) : today;
    let end = endDate ? new Date(endDate) : tomorrow;
    
    if (type === 'monthly') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    } else if (type === 'weekly') {
      const dayOfWeek = today.getDay();
      start = new Date(today);
      start.setDate(today.getDate() - dayOfWeek);
      end = new Date(start);
      end.setDate(start.getDate() + 6, 23, 59, 59);
    }

    const radiologyOrders = await prisma.radiologyOrder.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: {
        type: true,
        patient: { select: { id: true, name: true, gender: true, dob: true } },
        doctor: { select: { id: true, fullname: true } },
        radiologyResults: { select: { id: true, testTypeId: true, status: true, createdAt: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const batchOrders = await prisma.batchOrder.findMany({
      where: { type: 'RADIOLOGY', createdAt: { gte: start, lte: end } },
      include: {
        patient: { select: { id: true, name: true, gender: true, dob: true } },
        doctor: { select: { id: true, fullname: true } },
        services: { include: { investigationType: true } },
        radiologyResults: {
          select: {
            id: true,
            testTypeId: true,
            resultText: true,
            findings: true,
            conclusion: true,
            status: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const processedIndividualOrders = radiologyOrders.map(order => {
      return {
        id: order.id, type: 'INDIVIDUAL', testName: order.type?.name || 'Unknown', testCategory: order.type?.category || 'General',
        patientId: order.patientId, patientName: order.patient?.name, doctorName: order.doctor?.fullname || 'Walk-in',
        status: order.status, isWalkIn: order.isWalkIn, processedBy: null,
        billingId: order.billingId,
        createdAt: order.createdAt, completedAt: order.radiologyResults[0]?.createdAt || null
      };
    });

    const processedBatchOrders = batchOrders.map(order => {
      return (order.services || []).map(service => {
        const matchingResult = (order.radiologyResults || []).find(r => r.testTypeId === service.investigationType?.id) || order.radiologyResults?.[0] || null;
        const status = matchingResult?.status || service.status || order.status;

        return {
          id: `${order.id}-${service.id}`, type: 'BATCH_ORDER', testName: service.investigationType?.name || 'Unknown Test',
          testCategory: service.investigationType?.category || 'General', patientId: order.patientId, patientName: order.patient?.name,
          doctorName: order.doctor?.fullname || 'Unknown', status, isWalkIn: !!order.isWalkIn,
          processedBy: null,
          billingId: service.billingId || order.billingId,
          createdAt: order.createdAt, completedAt: matchingResult?.createdAt || (status === 'COMPLETED' ? order.updatedAt : null)
        };
      });
    }).flat();

    const allTests = [...processedIndividualOrders, ...processedBatchOrders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const totalTests = allTests.length;
    const walkInTests = allTests.filter(t => t.isWalkIn).length;
    const regularTests = totalTests - walkInTests;
    const completedTests = allTests.filter(t => t.status === 'COMPLETED').length;
    const pendingTests = allTests.filter(t => t.status !== 'COMPLETED').length;

    const byDate = {};
    allTests.forEach(test => {
      const dateKey = new Date(test.createdAt).toISOString().split('T')[0];
      if (!byDate[dateKey]) byDate[dateKey] = { date: dateKey, total: 0, completed: 0, pending: 0, walkIn: 0, regular: 0 };
      byDate[dateKey].total++;
      if (test.isWalkIn) byDate[dateKey].walkIn++;
      else byDate[dateKey].regular++;
      if (test.status === 'COMPLETED') byDate[dateKey].completed++;
      else byDate[dateKey].pending++;
    });

    const byCategory = {};
    allTests.forEach(test => {
      const cat = test.testCategory || 'Other';
      if (!byCategory[cat]) byCategory[cat] = { category: cat, total: 0, completed: 0 };
      byCategory[cat].total++;
      if (test.status === 'COMPLETED') byCategory[cat].completed++;
    });

    let financialSummary = null;
    if (req.user.role === 'ADMIN') {
      const walkInIndividualBillingIds = [...new Set(radiologyOrders.filter(o => o.isWalkIn && o.billingId).map(o => o.billingId))];
      const regularIndividualBillingIds = [...new Set(radiologyOrders.filter(o => !o.isWalkIn && o.billingId).map(o => o.billingId))];
      const walkInBatchBillingIds = [...new Set(batchOrders.filter(o => o.isWalkIn).flatMap(o => o.services?.map(s => s.billingId) || []).filter(Boolean))];
      const regularBatchBillingIds = [...new Set(batchOrders.filter(o => !o.isWalkIn).flatMap(o => o.services?.map(s => s.billingId) || []).filter(Boolean))];
      const walkInBillingIds = [...new Set([...walkInIndividualBillingIds, ...walkInBatchBillingIds])];
      const regularBillingIds = [...new Set([...regularIndividualBillingIds, ...regularBatchBillingIds])];
      const billingIds = [...new Set([...walkInBillingIds, ...regularBillingIds])];

      const billings = await prisma.billing.findMany({ where: { id: { in: billingIds } } });
      const walkInBillingIdSet = new Set(walkInBillingIds);
      const regularBillingIdSet = new Set(regularBillingIds);

      const totalRevenue = billings.filter(b => b.status === 'PAID').reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      const pendingRevenue = billings.filter(b => b.status === 'PENDING').reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      const walkInRevenue = billings
        .filter(b => b.status === 'PAID' && walkInBillingIdSet.has(b.id))
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      const regularRevenue = billings
        .filter(b => b.status === 'PAID' && regularBillingIdSet.has(b.id))
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      const walkInPendingRevenue = billings
        .filter(b => b.status === 'PENDING' && walkInBillingIdSet.has(b.id))
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      const regularPendingRevenue = billings
        .filter(b => b.status === 'PENDING' && regularBillingIdSet.has(b.id))
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

      financialSummary = {
        totalRevenue,
        pendingRevenue,
        paidCount: billings.filter(b => b.status === 'PAID').length,
        pendingCount: billings.filter(b => b.status === 'PENDING').length,
        walkInRevenue,
        regularRevenue,
        walkInPendingRevenue,
        regularPendingRevenue,
        walkInPaidCount: billings.filter(b => b.status === 'PAID' && walkInBillingIdSet.has(b.id)).length,
        regularPaidCount: billings.filter(b => b.status === 'PAID' && regularBillingIdSet.has(b.id)).length,
        walkInPendingCount: billings.filter(b => b.status === 'PENDING' && walkInBillingIdSet.has(b.id)).length,
        regularPendingCount: billings.filter(b => b.status === 'PENDING' && regularBillingIdSet.has(b.id)).length
      };
    }

    res.json({
      period: { start, end, type },
      summary: { totalTests, walkInTests, regularTests, completedTests, pendingTests },
      byDate: Object.values(byDate).sort((a, b) => new Date(b.date) - new Date(a.date)),
      byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
      byTechnician: [],
      tests: allTests, financialSummary
    });
  } catch (error) {
    console.error('Error generating radiology reports:', error);
    res.status(500).json({ error: error.message });
  }
};

// ── Radiologist Daily Work ──────────────────────────────────────

exports.getDailyWorkMonthly = async (req, res) => {
  try {
    const radiologistId = req.user.id;
    const year = Number.parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = Number.parseInt(req.query.month, 10);
    const normalizedMonth = Number.isInteger(month) ? month - 1 : new Date().getMonth();

    const startDate = new Date(year, normalizedMonth, 1, 0, 0, 0, 0);
    const endDate = new Date(year, normalizedMonth + 1, 0, 23, 59, 59, 999);
    const daysInMonth = new Date(year, normalizedMonth + 1, 0).getDate();

    const results = await prisma.radiologyResult.findMany({
      where: {
        processedBy: radiologistId,
        createdAt: { gte: startDate, lte: endDate },
        status: 'COMPLETED',
      },
      include: {
        testType: { select: { id: true, name: true, price: true } },
        batchOrder: { select: { id: true } },
        order: { select: { id: true } },
      },
    });

    const commission = await prisma.radiologistCommission.findUnique({
      where: { radiologistId },
    });
    const pct = commission?.percentage || 0;
    const hasCommission = pct > 0;

    const dayMap = new Map();
    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${year}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      dayMap.set(key, { date: key, day, orders: 0, totalPrice: 0, commissionAmount: 0 });
    }

    results.forEach((r) => {
      const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, '0')}-${String(r.createdAt.getDate()).padStart(2, '0')}`;
      const bucket = dayMap.get(key);
      if (!bucket) return;
      bucket.orders += 1;
      const price = r.testType?.price || 0;
      bucket.totalPrice += price;
      if (hasCommission) bucket.commissionAmount += price * (pct / 100);
    });

    res.json({
      daily: Array.from(dayMap.values()),
      hasCommission,
      commissionPct: pct,
      totalOrders: results.length,
      totalCommission: results.reduce((sum, r) => sum + ((r.testType?.price || 0) * (pct / 100)), 0),
    });
  } catch (error) {
    console.error('Error fetching radiologist daily work monthly:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getDailyWorkDayDetails = async (req, res) => {
  try {
    const radiologistId = req.user.id;
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Date parameter required (YYYY-MM-DD)' });

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const results = await prisma.radiologyResult.findMany({
      where: {
        processedBy: radiologistId,
        createdAt: { gte: dayStart, lte: dayEnd },
        status: 'COMPLETED',
      },
      include: {
        testType: { select: { id: true, name: true, price: true } },
        batchOrder: { select: { id: true, patient: { select: { id: true, name: true } } } },
        order: { select: { id: true, patient: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const commission = await prisma.radiologistCommission.findUnique({
      where: { radiologistId },
    });
    const pct = commission?.percentage || 0;
    const hasCommission = pct > 0;

    const orders = results.map((r) => {
      const price = r.testType?.price || 0;
      const patient = r.batchOrder?.patient || r.order?.patient || null;
      return {
        id: r.id,
        testName: r.testType?.name || 'Unknown',
        price,
        commissionPct: pct,
        commissionAmount: hasCommission ? price * (pct / 100) : 0,
        patientName: patient?.name || 'Unknown',
        patientId: patient?.id,
        createdAt: r.createdAt,
      };
    });

    res.json({
      date,
      orders,
      summary: {
        totalOrders: orders.length,
        totalPrice: orders.reduce((s, o) => s + o.price, 0),
        totalCommission: orders.reduce((s, o) => s + o.commissionAmount, 0),
      },
      hasCommission,
      commissionPct: pct,
    });
  } catch (error) {
    console.error('Error fetching radiologist daily work details:', error);
    res.status(500).json({ error: error.message });
  }
};