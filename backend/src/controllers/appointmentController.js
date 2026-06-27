const prisma = require('../config/database');
const { z } = require('zod');

// Validation schemas
const createAppointmentSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  doctorId: z.string().min(1, 'Doctor ID is required'),
  appointmentDate: z.string().min(1, 'Appointment date is required'),
  appointmentTime: z.string().optional(),
  type: z.enum(['CONSULTATION', 'FOLLOW_UP']).optional(),
  duration: z.string().optional(),
  notes: z.string().optional(),
  reason: z.string().optional(),
});

const updateAppointmentSchema = z.object({
  status: z.enum(['SCHEDULED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  notes: z.string().optional(),
  appointmentDate: z.string().optional(),
  appointmentTime: z.string().optional(),
});

/**
 * Create a new appointment
 * Validates that patient has ACTIVE card
 */
const createAppointment = async (req, res) => {
  try {
    console.log('=== CREATE APPOINTMENT START ===');
    console.log('Request body:', req.body);
    console.log('User ID:', req.user?.id);

    const validatedData = createAppointmentSchema.parse(req.body);
    console.log('Validated data:', validatedData);

    const createdById = req.user.id;
    console.log('Created by ID:', createdById);

    // 1. Check if patient exists and has ACTIVE card
    console.log('Checking patient:', validatedData.patientId);
    const patient = await prisma.patient.findUnique({
      where: { id: validatedData.patientId },
      select: {
        id: true,
        name: true,
        cardStatus: true,
        visits: {
          where: {
            status: 'COMPLETED',
            diagnosisNotes: {
              some: {}
            }
          },
          include: {
            diagnosisNotes: {
              include: {
                doctor: {
                  select: { id: true, fullname: true }
                }
              },
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
    console.log('Patient found:', patient);

    if (!patient) {
      console.log('Patient not found');
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    if (patient.cardStatus !== 'ACTIVE') {
      console.log('Patient card not active:', patient.cardStatus);
      return res.status(400).json({
        success: false,
        message: 'Patient card must be ACTIVE to book an appointment',
        cardStatus: patient.cardStatus
      });
    }

    // 2. Get last diagnosed doctor (if any)
    let lastDiagnosedBy = null;
    if (patient.visits.length > 0 && patient.visits[0].diagnosisNotes.length > 0) {
      lastDiagnosedBy = patient.visits[0].diagnosisNotes[0].doctorId;
    }
    console.log('Last diagnosed by:', lastDiagnosedBy);

    // 3. Check if doctor exists
    console.log('Checking doctor:', validatedData.doctorId);
    const doctor = await prisma.user.findUnique({
      where: { id: validatedData.doctorId },
      select: { id: true, fullname: true, role: true }
    });
    console.log('Doctor found:', doctor);

    if (!doctor || doctor.role !== 'DOCTOR') {
      console.log('Doctor not found or not a doctor');
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // 4. Check for time conflicts (only if appointmentTime is provided)
    if (validatedData.appointmentTime) {
      const appointmentDateTime = new Date(validatedData.appointmentDate);
      const appointmentTimeStr = validatedData.appointmentTime;

      const parseTimeToMinutes = (timeStr) => {
        const [time, period] = timeStr.split(' ');
        const [hours, minutes] = time.split(':');
        let hour24 = parseInt(hours);
        if (period === 'PM' && hour24 !== 12) hour24 += 12;
        if (period === 'AM' && hour24 === 12) hour24 = 0;
        return hour24 * 60 + parseInt(minutes || 0);
      };

      const appointmentMinutes = parseTimeToMinutes(appointmentTimeStr);

      const startOfDay = new Date(appointmentDateTime);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(appointmentDateTime);
      endOfDay.setHours(23, 59, 59, 999);

      const existingAppointments = await prisma.appointment.findMany({
        where: {
          doctorId: validatedData.doctorId,
          appointmentDate: {
            gte: startOfDay,
            lte: endOfDay
          },
          status: {
            not: 'CANCELLED'
          }
        }
      });

      const GAP_MINUTES = 25;
      const conflictingAppointment = existingAppointments.find(existing => {
        const existingMinutes = parseTimeToMinutes(existing.appointmentTime);
        const timeDiff = Math.abs(existingMinutes - appointmentMinutes);
        return timeDiff < GAP_MINUTES;
      });

      if (conflictingAppointment) {
        console.log('Time conflict detected');
        return res.status(400).json({
          success: false,
          message: `Doctor already has an appointment at ${conflictingAppointment.appointmentTime}. Please schedule at least ${GAP_MINUTES} minutes apart.`,
          conflictingTime: conflictingAppointment.appointmentTime
        });
      }
    }

    // 5. Create appointment
    console.log('Creating appointment...');
    const appointment = await prisma.appointment.create({
      data: {
        patientId: validatedData.patientId,
        doctorId: validatedData.doctorId,
        appointmentDate: new Date(validatedData.appointmentDate),
        appointmentTime: validatedData.appointmentTime,
        type: validatedData.type || 'CONSULTATION',
        status: 'SCHEDULED',
        duration: validatedData.duration,
        notes: validatedData.notes,
        reason: validatedData.reason,
        createdById: createdById,
        lastDiagnosedBy: lastDiagnosedBy,
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            mobile: true,
            cardStatus: true
          }
        },
        doctor: {
          select: {
            id: true,
            fullname: true,
            consultationFee: true
          }
        },
        createdBy: {
          select: {
            id: true,
            fullname: true
          }
        }
      }
    });
    console.log('Appointment created successfully:', appointment);

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      appointment
    });

  } catch (error) {
    console.log('=== CREATE APPOINTMENT ERROR ===');
    console.error('Error details:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    if (error instanceof z.ZodError) {
      console.log('Zod validation error:', error.errors);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      });
    }

    console.error('Error creating appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create appointment',
      error: error.message
    });
  }
};

/**
 * Get appointments for a specific doctor
 */
const getAppointmentsByDoctor = async (req, res) => {
  try {
    const doctorId = req.query.doctorId || req.user.id;
    const { status, date, type } = req.query;

    const where = { doctorId };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      where.appointmentDate = {
        gte: startDate,
        lte: endDate
      };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            mobile: true,
            cardStatus: true,
            gender: true,
            dob: true
          }
        },
        doctor: {
          select: {
            id: true,
            fullname: true,
            consultationFee: true
          }
        },
        createdBy: {
          select: {
            id: true,
            fullname: true
          }
        }
      },
      orderBy: [
        { appointmentDate: 'asc' },
        { appointmentTime: 'asc' }
      ]
    });

    // Add lastDiagnosedByName for display
    const appointmentsWithLastDoc = await Promise.all(
      appointments.map(async (appt) => {
        let lastDiagnosedByName = null;
        if (appt.lastDiagnosedBy) {
          const lastDoc = await prisma.user.findUnique({
            where: { id: appt.lastDiagnosedBy },
            select: { fullname: true }
          });
          lastDiagnosedByName = lastDoc?.fullname || null;
        }
        return {
          ...appt,
          lastDiagnosedByName
        };
      })
    );

    res.json({
      success: true,
      appointments: appointmentsWithLastDoc
    });

  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointments',
      error: error.message
    });
  }
};

/**
 * Get all appointments (for reception)
 */
const getAllAppointments = async (req, res) => {
  try {
    const { status, doctorId, date, type, search } = req.query;

    const where = {};

    if (status) {
      where.status = status;
    }

    if (doctorId) {
      where.doctorId = doctorId;
    }

    if (type) {
      where.type = type;
    }

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      where.appointmentDate = {
        gte: startDate,
        lte: endDate
      };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            mobile: true,
            cardStatus: true,
            gender: true,
            dob: true
          }
        },
        doctor: {
          select: {
            id: true,
            fullname: true,
            consultationFee: true,
            qualifications: true
          }
        },
        createdBy: {
          select: {
            id: true,
            fullname: true
          }
        }
      },
      orderBy: [
        { appointmentDate: 'asc' },
        { appointmentTime: 'asc' }
      ]
    });

    // Client-side search filtering for patient name, ID, or phone
    let filteredAppointments = appointments;
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      filteredAppointments = appointments.filter(apt => {
        const patientName = apt.patient?.name?.toLowerCase() || '';
        const patientId = apt.patient?.id?.toLowerCase() || '';
        const patientPhone = apt.patient?.mobile?.toLowerCase() || '';
        return patientName.includes(searchLower) ||
          patientId.includes(searchLower) ||
          patientPhone.includes(searchLower);
      });
    }

    // Add lastDiagnosedByName for display
    const appointmentsWithLastDoc = await Promise.all(
      filteredAppointments.map(async (appt) => {
        let lastDiagnosedByName = null;
        if (appt.lastDiagnosedBy) {
          const lastDoc = await prisma.user.findUnique({
            where: { id: appt.lastDiagnosedBy },
            select: { fullname: true }
          });
          lastDiagnosedByName = lastDoc?.fullname || null;
        }
        return {
          ...appt,
          lastDiagnosedByName
        };
      })
    );

    res.json({
      success: true,
      appointments: appointmentsWithLastDoc,
      total: appointmentsWithLastDoc.length
    });

  } catch (error) {
    console.error('Error fetching all appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointments',
      error: error.message
    });
  }
};

/**
 * Update appointment status and details
 */
const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateAppointmentSchema.parse(req.body);

    const updateData = {};

    if (validatedData.status) {
      updateData.status = validatedData.status;
    }

    if (validatedData.notes !== undefined) {
      updateData.notes = validatedData.notes;
    }

    if (validatedData.appointmentDate) {
      updateData.appointmentDate = new Date(validatedData.appointmentDate);
    }

    if (validatedData.appointmentTime) {
      updateData.appointmentTime = validatedData.appointmentTime;
    }

    const appointment = await prisma.appointment.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            mobile: true,
            cardStatus: true
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
      success: true,
      message: 'Appointment updated successfully',
      appointment
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      });
    }

    console.error('Error updating appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update appointment',
      error: error.message
    });
  }
};

/**
 * Delete an appointment
 */
const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if appointment has already been converted to a visit
    const appointment = await prisma.appointment.findUnique({
      where: { id: parseInt(id) },
      select: { visitId: true, status: true }
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.visitId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete appointment that has been converted to a visit'
      });
    }

    await prisma.appointment.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      success: true,
      message: 'Appointment deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete appointment',
      error: error.message
    });
  }
};

/**
 * Send appointment to doctor (create visit and add to queue)
 * This is called by reception when patient arrives
 */
const sendAppointmentToDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const processedBy = req.user.id;

    // 1. Get appointment details
    const appointment = await prisma.appointment.findUnique({
      where: { id: parseInt(id) },
      include: {
        patient: true,
        doctor: {
          select: {
            id: true,
            fullname: true,
            consultationFee: true
          }
        }
      }
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.visitId) {
      // Check if the visit is properly linked to an assignment
      const existingVisit = await prisma.visit.findUnique({
        where: { id: appointment.visitId },
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

      if (existingVisit && !existingVisit.assignmentId) {
        // Visit exists but not properly linked - fix it
        let assignment = await prisma.assignment.findFirst({
          where: {
            patientId: appointment.patientId,
            doctorId: appointment.doctorId,
            status: 'Pending'
          }
        });

        if (!assignment) {
          assignment = await prisma.assignment.create({
            data: {
              patientId: appointment.patientId,
              doctorId: appointment.doctorId,
              status: 'Pending'
            }
          });
        }

        // Link the visit to the assignment
        await prisma.visit.update({
          where: { id: existingVisit.id },
          data: { assignmentId: assignment.id }
        });

        return res.json({
          success: true,
          message: 'Appointment visit was already created but is now properly linked to doctor queue',
          visit: existingVisit,
          assignment
        });
      } else if (existingVisit && existingVisit.assignmentId) {
        return res.json({
          success: true,
          message: 'Appointment has already been properly sent to doctor queue',
          visit: existingVisit
        });
      }
    }

    if (appointment.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot process a cancelled appointment'
      });
    }

    // 2. Check patient card status
    if (appointment.patient.cardStatus !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        message: 'Patient card is not ACTIVE',
        cardStatus: appointment.patient.cardStatus
      });
    }

    // 3. Generate visit UID with unique generator
    const { generateUniqueVisitUid } = require('../utils/visitUidGenerator');

    // 4. Create visit with IN_DOCTOR_QUEUE status (skip triage)
    const visit = await generateUniqueVisitUid(async (visitUid) => {
      return await prisma.visit.create({
        data: {
          visitUid,
          patientId: appointment.patientId,
          createdById: processedBy,
          suggestedDoctorId: appointment.doctorId,
          status: 'IN_DOCTOR_QUEUE', // Skip triage completely
          notes: `Appointment visit - ${appointment.reason || appointment.notes || 'Follow-up'}`,
          isEmergency: false
        }
      });
    }, prisma);

    // 5. Create consultation billing ONLY for CONSULTATION type appointments
    let billing = null;

    if (appointment.type === 'CONSULTATION') {
      const consultationService = await prisma.service.findFirst({
        where: { code: 'CONS001' }
      });

      if (!consultationService) {
        throw new Error('Consultation service not found');
      }

      billing = await prisma.billing.create({
        data: {
          patientId: appointment.patientId,
          visitId: visit.id,
          totalAmount: appointment.doctor.consultationFee || consultationService.price,
          status: 'PENDING',
          billingType: 'REGULAR',
          services: {
            create: {
              serviceId: consultationService.id,
              quantity: 1,
              unitPrice: appointment.doctor.consultationFee || consultationService.price,
              totalPrice: appointment.doctor.consultationFee || consultationService.price,
            }
          }
        }
      });
    }

    // 6. Create or find assignment for the doctor
    let assignment = await prisma.assignment.findFirst({
      where: {
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        status: 'Pending'
      }
    });

    if (!assignment) {
      assignment = await prisma.assignment.create({
        data: {
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          status: 'Pending'
        }
      });
    }

    // 7. Update visit to link it to the assignment (ensure it's always linked)
    await prisma.visit.update({
      where: { id: visit.id },
      data: {
        assignmentId: assignment.id
      }
    });

    // 8. Update appointment status to IN_PROGRESS and link to visit
    await prisma.appointment.update({
      where: { id: parseInt(id) },
      data: {
        status: 'IN_PROGRESS',
        visitId: visit.id
      }
    });

    res.json({
      success: true,
      message: 'Appointment sent to doctor successfully',
      visit,
      billing,
      assignment,
      appointment: {
        ...appointment,
        status: 'IN_PROGRESS',
        visitId: visit.id
      }
    });

  } catch (error) {
    console.error('Error sending appointment to doctor:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send appointment to doctor',
      error: error.message
    });
  }
};

/**
 * Get appointment by ID
 */
const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await prisma.appointment.findUnique({
      where: { id: parseInt(id) },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            mobile: true,
            cardStatus: true,
            gender: true,
            dob: true
          }
        },
        doctor: {
          select: {
            id: true,
            fullname: true,
            consultationFee: true
          }
        },
        createdBy: {
          select: {
            id: true,
            fullname: true
          }
        }
      }
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Get lastDiagnosedByName
    let lastDiagnosedByName = null;
    if (appointment.lastDiagnosedBy) {
      const lastDoc = await prisma.user.findUnique({
        where: { id: appointment.lastDiagnosedBy },
        select: { fullname: true }
      });
      lastDiagnosedByName = lastDoc?.fullname || null;
    }

    res.json({
      success: true,
      appointment: {
        ...appointment,
        lastDiagnosedByName
      }
    });

  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointment',
      error: error.message
    });
  }
};

/**
 * Debug endpoint to check appointment and visit status
 */
const debugAppointmentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await prisma.appointment.findUnique({
      where: { id: parseInt(appointmentId) },
      include: {
        patient: true,
        doctor: true,
        visit: {
          include: {
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
            appointments: true
          }
        }
      }
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    res.json({
      success: true,
      appointment,
      debug: {
        hasVisit: !!appointment.visit,
        visitStatus: appointment.visit?.status,
        hasBilling: appointment.visit?.bills?.length > 0,
        billingStatus: appointment.visit?.bills?.[0]?.status,
        hasConsultationService: appointment.visit?.bills?.[0]?.services?.some(s => s.service.code === 'CONS001'),
        assignmentId: appointment.visit?.assignmentId
      }
    });

  } catch (error) {
    console.error('Error debugging appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to debug appointment',
      error: error.message
    });
  }
};

module.exports = {
  createAppointment,
  getAppointmentsByDoctor,
  getAllAppointments,
  updateAppointment,
  deleteAppointment,
  sendAppointmentToDoctor,
  getAppointmentById,
  debugAppointmentStatus
};

