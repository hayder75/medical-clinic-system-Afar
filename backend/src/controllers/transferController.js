const prisma = require('../config/database');
const { getIO, emitToRole } = require('../config/socket');

exports.getAvailableDoctors = async (req, res) => {
  try {
    const doctors = await prisma.user.findMany({
      where: { role: { in: ['DOCTOR'] }, isActive: true },
      select: { id: true, fullname: true, role: true, qualifications: true, consultationFee: true, requiredCardType: true }
    });
    res.json({ doctors });
  } catch (error) {
    console.error('Error fetching available doctors:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.transferPatient = async (req, res) => {
  try {
    const { patientId, toDoctorId, visitId, reason } = req.body;
    const fromDoctorId = req.user.id;

    if (!patientId || !toDoctorId || !visitId) {
      return res.status(400).json({ error: 'patientId, toDoctorId, and visitId are required' });
    }

    const [patient, fromDoctor, toDoctor, visit] = await Promise.all([
      prisma.patient.findUnique({ where: { id: patientId } }),
      prisma.user.findUnique({ where: { id: fromDoctorId } }),
      prisma.user.findUnique({ where: { id: toDoctorId } }),
      prisma.visit.findUnique({ where: { id: visitId } })
    ]);

    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    if (!fromDoctor) return res.status(404).json({ error: 'From doctor not found' });
    if (!toDoctor) return res.status(404).json({ error: 'To doctor not found' });
    if (!visit) return res.status(404).json({ error: 'Visit not found' });

    // Check if original visit has orders
    const [labOrders, radiologyOrders, medicationOrders, batchOrders] = await Promise.all([
      prisma.labOrder.count({ where: { visitId } }),
      prisma.radiologyOrder.count({ where: { visitId } }),
      prisma.medicationOrder.count({ where: { visitId } }),
      prisma.batchOrder.count({ where: { visitId } })
    ]);
    const hasOrders = labOrders > 0 || radiologyOrders > 0 || medicationOrders > 0 || batchOrders > 0;

    // Determine if consultation fee is needed
    const consultationFee = toDoctor.consultationFee || 0;
    const needsPayment = hasOrders && consultationFee > 0;

    // Doctor A's work is done — mark original visit COMPLETED regardless of payment
    await prisma.visit.update({
      where: { id: visitId },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });

    if (needsPayment) {
      // Find consultation service
      const consultationService = await prisma.service.findFirst({
        where: { category: 'CONSULTATION', name: { contains: 'Consultation', mode: 'insensitive' } }
      });
      if (!consultationService) {
        return res.status(500).json({ error: 'Consultation service not found in catalog' });
      }

      // Create billing for the target doctor's consultation fee
      const billing = await prisma.billing.create({
        data: {
          patientId, visitId,
          totalAmount: consultationFee,
          paidAmount: 0,
          status: 'PENDING',
          billingType: 'REGULAR',
          notes: `Transfer consultation fee — ${toDoctor.fullname}`,
          services: {
            create: { serviceId: consultationService.id, quantity: 1, unitPrice: consultationFee, totalPrice: consultationFee }
          }
        }
      });

      // Create transfer record awaiting payment
      const transfer = await prisma.patientTransfer.create({
        data: {
          patientId, fromDoctorId, toDoctorId, visitId,
          reason, paymentRule: 'CONSULTATION_FEE',
          paymentRequired: true, paymentAmount: consultationFee,
          billingId: billing.id, status: 'AWAITING_PAYMENT'
        }
      });

      // Notify old doctor that patient left their queue
      try {
        const io = getIO();
        io.to(`doctor:${fromDoctorId}`).emit('queue:visit-removed', { visitId, patientId });
      } catch (e) {
        console.error('Socket notification error (non-fatal):', e.message);
      }

      res.json({
        transfer: { ...transfer, id: transfer.id, status: 'AWAITING_PAYMENT' },
        billing,
        paymentRequired: true,
        paymentAmount: consultationFee,
        message: `Patient sent to billing. Consultation fee of ETB ${consultationFee} required.`
      });
    } else {
      // Free transfer — create sub-visit immediately

      // Find or create assignment to ensure sub-visit is visible in receiving doctor's queue
      let assignment = await prisma.assignment.findFirst({
        where: { patientId, doctorId: toDoctorId }
      });
      if (!assignment) {
        assignment = await prisma.assignment.create({
          data: { patientId, doctorId: toDoctorId, status: 'Pending' }
        });
      }

      const subVisit = await prisma.visit.create({
        data: {
          visitUid: `${visit.visitUid}-T${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
          patientId, createdById: fromDoctorId,
          suggestedDoctorId: toDoctorId,
          assignmentId: assignment.id,
          parentVisitId: visitId,
          status: 'IN_DOCTOR_QUEUE',
          queueType: 'CONSULTATION',
          notes: `Transferred from ${fromDoctor.fullname} - ${reason || ''}`
        }
      });

      const transfer = await prisma.patientTransfer.create({
        data: {
          patientId, fromDoctorId, toDoctorId, visitId,
          subVisitId: subVisit.id, reason,
          paymentRequired: false, paymentAmount: 0, status: 'ACCEPTED'
        }
      });

      // Notify doctors via socket
      try {
        // Notify old doctor (patient removed from their queue)
        emitToRole('DOCTOR', 'queue:visit-removed', { visitId, patientId });
        // Notify new doctor (patient added to their queue)
        emitToRole('DOCTOR', 'queue:new-visit', {
          visitId: subVisit.id,
          patientId,
          patientName: patient.name,
          doctorId: toDoctorId,
          status: 'IN_DOCTOR_QUEUE',
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        console.error('Socket notification error (non-fatal):', e.message);
      }

      res.json({
        transfer: { ...transfer, id: transfer.id, subVisitId: subVisit.id, status: 'ACCEPTED' },
        visit: subVisit,
        paymentRequired: false,
        message: `Patient transferred to ${toDoctor.fullname}`
      });
    }
  } catch (error) {
    console.error('Error transferring patient:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getIncomingTransfers = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const transfers = await prisma.patientTransfer.findMany({
      where: { toDoctorId: doctorId },
      include: {
        patient: { select: { id: true, name: true, cardType: true } },
        fromDoctor: { select: { id: true, fullname: true } },
        visit: { select: { id: true, visitUid: true, notes: true } },
        subVisit: { select: { id: true, status: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ transfers });
  } catch (error) {
    console.error('Error fetching incoming transfers:', error);
    res.status(500).json({ error: error.message });
  }
};


