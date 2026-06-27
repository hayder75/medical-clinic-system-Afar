const prisma = require('../config/database');
const { z } = require('zod');

// Validation schemas
const addToVirtualQueueSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone number is required'),
  patientId: z.string().nullable().optional(), // Allow null for new patients
  priority: z.number().min(1).max(3).default(3), // 1=urgent, 2=priority, 3=normal
  notes: z.string().optional()
});

const processVirtualQueueSchema = z.object({
  virtualQueueId: z.string().uuid('Invalid virtual queue ID')
});

const searchVirtualQueueSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  type: z.enum(['name', 'phone']).default('name')
});

// Add patient to Pre-Registration queue
exports.addToVirtualQueue = async (req, res) => {
  try {
    const data = addToVirtualQueueSchema.parse(req.body);
    const billingOfficerId = req.user.id;

    // If patientId is provided, verify patient exists
    if (data.patientId) {
      const existingPatient = await prisma.patient.findUnique({
        where: { id: data.patientId }
      });

      if (!existingPatient) {
        return res.status(404).json({
          success: false,
          error: 'Patient not found'
        });
      }
    }

    // Check if patient already has a pending virtual queue entry
    const existingQueue = await prisma.virtualQueue.findFirst({
      where: {
        phone: data.phone,
        status: 'PENDING'
      }
    });

    if (existingQueue) {
      return res.status(409).json({
        success: false,
        error: 'Patient already has a pending Pre-Registration entry',
        existingEntry: {
          id: existingQueue.id,
          name: existingQueue.name,
          phone: existingQueue.phone,
          createdAt: existingQueue.createdAt
        }
      });
    }

    const virtualQueue = await prisma.virtualQueue.create({
      data: {
        name: data.name,
        phone: data.phone,
        patientId: data.patientId || null,
        priority: data.priority,
        notes: data.notes,
        processedBy: billingOfficerId
      },
      include: {
        patient: data.patientId ? {
          select: {
            id: true,
            name: true,
            mobile: true,
            email: true,
            dob: true,
            gender: true,
            bloodType: true
          }
        } : false
      }
    });

    res.json({
      success: true,
      message: 'Patient added to Pre-Registration queue successfully',
      virtualQueue
    });

  } catch (error) {
    console.error('Error adding to virtual queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add patient to Pre-Registration queue',
      details: error.message
    });
  }
};

// Get Pre-Registration queue list
exports.getVirtualQueue = async (req, res) => {
  try {
    const { status = 'PENDING', priority } = req.query;

    const whereClause = {
      status: status.toUpperCase()
    };

    if (priority) {
      whereClause.priority = parseInt(priority);
    }

    const virtualQueue = await prisma.virtualQueue.findMany({
      where: whereClause,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            mobile: true,
            email: true,
            dob: true,
            gender: true,
            bloodType: true
          }
        }
      },
      orderBy: [
        { priority: 'asc' }, // Urgent first
        { createdAt: 'asc' }  // Then by time
      ]
    });

    // Get statistics
    const stats = await prisma.virtualQueue.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    });

    const priorityStats = await prisma.virtualQueue.groupBy({
      by: ['priority'],
      where: { status: 'PENDING' },
      _count: {
        id: true
      }
    });

    res.json({
      success: true,
      virtualQueue,
      stats: {
        byStatus: stats.reduce((acc, stat) => {
          acc[stat.status.toLowerCase()] = stat._count.id;
          return acc;
        }, {}),
        byPriority: priorityStats.reduce((acc, stat) => {
          acc[`priority_${stat.priority}`] = stat._count.id;
          return acc;
        }, {})
      }
    });

  } catch (error) {
    console.error('Error fetching virtual queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Pre-Registration queue',
      details: error.message
    });
  }
};

// Search within Pre-Registration queue
exports.searchVirtualQueue = async (req, res) => {
  try {
    const { query, type = 'name' } = searchVirtualQueueSchema.parse(req.query);

    const whereClause = {
      status: 'PENDING'
    };

    if (type === 'name') {
      whereClause.name = {
        contains: query,
        mode: 'insensitive'
      };
    } else if (type === 'phone') {
      whereClause.phone = {
        contains: query
      };
    }

    const results = await prisma.virtualQueue.findMany({
      where: whereClause,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            mobile: true,
            email: true,
            dob: true,
            gender: true,
            bloodType: true
          }
        }
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    res.json({
      success: true,
      results,
      count: results.length
    });

  } catch (error) {
    console.error('Error searching virtual queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search Pre-Registration queue',
      details: error.message
    });
  }
};

// Process Pre-Registration queue item
exports.processVirtualQueue = async (req, res) => {
  try {
    const { virtualQueueId } = processVirtualQueueSchema.parse(req.body);
    const billingOfficerId = req.user.id;

    const virtualQueueItem = await prisma.virtualQueue.findUnique({
      where: { id: virtualQueueId },
      include: {
        patient: true
      }
    });

    if (!virtualQueueItem) {
      return res.status(404).json({
        success: false,
        error: 'Pre-Registration entry not found'
      });
    }

    if (virtualQueueItem.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: 'This Pre-Registration entry has already been processed'
      });
    }

    // Update status to PROCESSING
    await prisma.virtualQueue.update({
      where: { id: virtualQueueId },
      data: {
        status: 'PROCESSING',
        processedAt: new Date(),
        processedBy: billingOfficerId
      }
    });

    // If patient exists, create visit directly
    if (virtualQueueItem.patient) {
      const { generateUniqueVisitUid } = require('../utils/visitUidGenerator');
      
      const visit = await generateUniqueVisitUid(async (visitUid) => {
        return await prisma.visit.create({
          data: {
            visitUid: visitUid,
            patientId: virtualQueueItem.patient.id,
            createdById: billingOfficerId,
            status: 'WAITING_FOR_TRIAGE',
            notes: `Patient processed from Pre-Registration queue. Original notes: ${virtualQueueItem.notes || 'None'}`
          }
        });
      }, prisma);

      // Mark as completed
      await prisma.virtualQueue.update({
        where: { id: virtualQueueId },
        data: { status: 'COMPLETED' }
      });

      res.json({
        success: true,
        message: 'Patient processed successfully. Visit created.',
        action: 'visit_created',
        visit: {
          id: visit.id,
          visitUid: visit.visitUid,
          patientId: visit.patientId
        },
        patient: virtualQueueItem.patient
      });

    } else {
      // New patient - redirect to registration
      res.json({
        success: true,
        message: 'Redirecting to patient registration',
        action: 'redirect_to_registration',
        virtualQueueData: {
          name: virtualQueueItem.name,
          phone: virtualQueueItem.phone,
          notes: virtualQueueItem.notes,
          priority: virtualQueueItem.priority
        }
      });
    }

  } catch (error) {
    console.error('Error processing virtual queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process Pre-Registration entry',
      details: error.message
    });
  }
};

// Cancel Pre-Registration queue item
exports.cancelVirtualQueue = async (req, res) => {
  try {
    const { virtualQueueId } = processVirtualQueueSchema.parse(req.body);

    const virtualQueueItem = await prisma.virtualQueue.findUnique({
      where: { id: virtualQueueId }
    });

    if (!virtualQueueItem) {
      return res.status(404).json({
        success: false,
        error: 'Pre-Registration entry not found'
      });
    }

    if (virtualQueueItem.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: 'This Pre-Registration entry has already been processed'
      });
    }

    await prisma.virtualQueue.update({
      where: { id: virtualQueueId },
      data: {
        status: 'CANCELLED',
        processedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Pre-Registration entry cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling virtual queue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel Pre-Registration entry',
      details: error.message
    });
  }
};

// Search existing patients for Pre-Registration
exports.searchPatientsForVirtualQueue = async (req, res) => {
  try {
    const { query, type = 'name' } = req.query;

    if (!query || query.length < 2) {
      return res.json({
        success: true,
        patients: [],
        count: 0
      });
    }

    const whereClause = {};

    if (type === 'name') {
      whereClause.name = {
        contains: query,
        mode: 'insensitive'
      };
    } else if (type === 'phone') {
      whereClause.mobile = {
        contains: query
      };
    } else if (type === 'id') {
      whereClause.id = {
        contains: query,
        mode: 'insensitive'
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
        bloodType: true,
        type: true,
        status: true
      },
      orderBy: { name: 'asc' },
      take: 10 // Limit results
    });

    res.json({
      success: true,
      patients,
      count: patients.length
    });

  } catch (error) {
    console.error('Error searching patients:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search patients',
      details: error.message
    });
  }
};
