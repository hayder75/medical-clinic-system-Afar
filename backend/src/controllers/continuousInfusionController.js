const prisma = require('../config/database');
const { z } = require('zod');

// Get all active continuous infusions
exports.getActiveInfusions = async (req, res) => {
  try {
    const infusions = await prisma.continuousInfusion.findMany({
      where: {
        status: {
          in: ['UNPAID', 'PAID', 'IN_PROGRESS']
        }
      },
      include: {
        medicationOrder: {
          include: {
            patient: {
              select: {
                id: true,
                name: true,
                mobile: true,
                dob: true,
                gender: true
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
        },
        nurseTasks: {
          include: {
            administeredBy: {
              select: {
                id: true,
                fullname: true,
                username: true
              }
            }
          },
          orderBy: {
            scheduledFor: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      infusions: infusions.map(infusion => ({
        id: infusion.id,
        patient: infusion.medicationOrder.patient,
        visit: infusion.medicationOrder.visit,
        medication: {
          name: infusion.medicationOrder.name,
          dosage: infusion.medicationOrder.strength,
          dailyDose: infusion.dailyDose,
          frequency: infusion.frequency
        },
        schedule: {
          startDate: infusion.startDate,
          endDate: infusion.endDate,
          days: infusion.days,
          totalDays: infusion.days
        },
        status: infusion.status,
        progress: {
          totalTasks: infusion.nurseTasks.length,
          completedTasks: infusion.nurseTasks.filter(task => task.completed).length,
          pendingTasks: infusion.nurseTasks.filter(task => !task.completed).length
        },
        nurseTasks: infusion.nurseTasks,
        createdAt: infusion.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching active infusions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active infusions'
    });
  }
};

// Get continuous infusion details
exports.getInfusionDetails = async (req, res) => {
  try {
    const { infusionId } = req.params;

    const infusion = await prisma.continuousInfusion.findUnique({
      where: { id: parseInt(infusionId) },
      include: {
        medicationOrder: {
          include: {
            patient: {
              select: {
                id: true,
                name: true,
                mobile: true,
                dob: true,
                gender: true,
                address: true,
                emergencyContact: true
              }
            },
            visit: {
              select: {
                id: true,
                visitUid: true,
                date: true,
                status: true,
                diagnosis: true,
                diagnosisDetails: true
              }
            }
          }
        },
        nurseTasks: {
          include: {
            administeredBy: {
              select: {
                id: true,
                fullname: true,
                username: true
              }
            }
          },
          orderBy: {
            scheduledFor: 'asc'
          }
        }
      }
    });

    if (!infusion) {
      return res.status(404).json({
        success: false,
        error: 'Continuous infusion not found'
      });
    }

    res.json({
      success: true,
      infusion: {
        id: infusion.id,
        patient: infusion.medicationOrder.patient,
        visit: infusion.medicationOrder.visit,
        medication: {
          name: infusion.medicationOrder.name,
          genericName: infusion.medicationOrder.genericName,
          dosage: infusion.medicationOrder.strength,
          dailyDose: infusion.dailyDose,
          frequency: infusion.frequency,
          instructions: infusion.medicationOrder.instructions
        },
        schedule: {
          startDate: infusion.startDate,
          endDate: infusion.endDate,
          days: infusion.days,
          totalDays: infusion.days
        },
        status: infusion.status,
        progress: {
          totalTasks: infusion.nurseTasks.length,
          completedTasks: infusion.nurseTasks.filter(task => task.completed).length,
          pendingTasks: infusion.nurseTasks.filter(task => !task.completed).length,
          completionPercentage: Math.round((infusion.nurseTasks.filter(task => task.completed).length / infusion.nurseTasks.length) * 100) || 0
        },
        nurseTasks: infusion.nurseTasks,
        createdAt: infusion.createdAt,
        updatedAt: infusion.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching infusion details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch infusion details'
    });
  }
};

// Update infusion status
exports.updateInfusionStatus = async (req, res) => {
  try {
    const { infusionId } = req.params;
    const { status } = req.body;

    const validStatuses = ['UNPAID', 'PAID', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const infusion = await prisma.continuousInfusion.update({
      where: { id: parseInt(infusionId) },
      data: { status },
      include: {
        medicationOrder: {
          include: {
            patient: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    res.json({
      success: true,
      message: `Infusion status updated to ${status}`,
      infusion: {
        id: infusion.id,
        status: infusion.status,
        patient: infusion.medicationOrder.patient
      }
    });
  } catch (error) {
    console.error('Error updating infusion status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update infusion status'
    });
  }
};

// Assign nurse to infusion
exports.assignNurseToInfusion = async (req, res) => {
  try {
    const { infusionId } = req.params;
    const { nurseId } = req.body;

    // Verify nurse exists and is available
    const nurse = await prisma.user.findUnique({
      where: {
        id: nurseId,
        role: 'NURSE',
        availability: true
      }
    });

    if (!nurse) {
      return res.status(400).json({
        success: false,
        error: 'Nurse not found or not available'
      });
    }

    // Update all pending nurse tasks for this infusion
    await prisma.nurseAdministration.updateMany({
      where: {
        continuousInfusionId: parseInt(infusionId),
        completed: false
      },
      data: {
        administeredById: nurseId
      }
    });

    res.json({
      success: true,
      message: `Nurse ${nurse.fullname} assigned to infusion`,
      nurse: {
        id: nurse.id,
        name: nurse.fullname,
        username: nurse.username
      }
    });
  } catch (error) {
    console.error('Error assigning nurse to infusion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign nurse to infusion'
    });
  }
};

// Get nurses for assignment
exports.getAvailableNurses = async (req, res) => {
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
        phone: true
      },
      orderBy: {
        fullname: 'asc'
      }
    });

    res.json({
      success: true,
      nurses
    });
  } catch (error) {
    console.error('Error fetching nurses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch nurses'
    });
  }
};

// Get daily tasks for a specific continuous infusion
exports.getInfusionTasks = async (req, res) => {
  try {
    const { infusionId } = req.params;
    
    const tasks = await prisma.nurseAdministration.findMany({
      where: {
        continuousInfusionId: parseInt(infusionId)
      },
      include: {
        administeredBy: {
          select: {
            id: true,
            fullname: true,
            username: true
          }
        }
      },
      orderBy: {
        scheduledFor: 'asc'
      }
    });

    res.json({ tasks });
  } catch (error) {
    console.error('Error fetching infusion tasks:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update infusion status
exports.updateInfusionStatus = async (req, res) => {
  try {
    const { infusionId } = req.params;
    const { status } = req.body;
    
    const updatedInfusion = await prisma.continuousInfusion.update({
      where: { id: parseInt(infusionId) },
      data: { status },
      include: {
        medicationOrder: {
          include: {
            patient: true,
            visit: true
          }
        }
      }
    });

    res.json({ 
      message: 'Infusion status updated successfully',
      infusion: updatedInfusion 
    });
  } catch (error) {
    console.error('Error updating infusion status:', error);
    res.status(500).json({ error: error.message });
  }
};

// Complete a daily infusion task
exports.completeInfusionTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { completed, notes } = req.body;
    const nurseId = req.user.id;

    // Find the task
    const task = await prisma.nurseAdministration.findUnique({
      where: { id: parseInt(taskId) },
      include: {
        continuousInfusion: {
          include: {
            medicationOrder: {
              include: {
                patient: true,
                visit: true
              }
            }
          }
        }
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Update the task
    const updatedTask = await prisma.nurseAdministration.update({
      where: { id: parseInt(taskId) },
      data: {
        completed: completed || true,
        administeredById: nurseId,
        administeredAt: completed ? new Date() : null,
        notes: notes || 'Daily dose administered'
      },
      include: {
        continuousInfusion: {
          include: {
            medicationOrder: {
              include: {
                patient: true,
                visit: true
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
        patientId: task.continuousInfusion.medicationOrder.patientId,
        details: JSON.stringify({
          type: 'CONTINUOUS_INFUSION_ADMINISTRATION',
          taskId: task.id,
          medication: task.continuousInfusion.medicationOrder.name,
          dosage: task.continuousInfusion.dailyDose,
          scheduledDate: task.scheduledFor,
          administeredAt: new Date(),
          administeredBy: req.user.fullname,
          notes: notes || 'Daily dose administered'
        })
      }
    });

    res.json({
      message: 'Task updated successfully',
      task: updatedTask
    });
  } catch (error) {
    console.error('Error completing infusion task:', error);
    res.status(500).json({ error: error.message });
  }
};
