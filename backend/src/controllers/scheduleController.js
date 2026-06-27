const prisma = require('../config/database');

exports.toggleAvailability = async (req, res) => {
  try {
    const { userId, availability } = req.body;
    const user = await prisma.user.update({ where: { id: userId }, data: { availability } });
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getAppointments = async (req, res) => {
  try {
    const appointments = await prisma.appointment.findMany({
      where: { doctorId: req.user.id },
      include: { patient: { select: { id: true, name: true } } },
    });
    const transformed = appointments.map(a => ({
      ...a,
      date: a.appointmentDate,
      time: a.appointmentTime,
    }));
    res.json(transformed);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.createAppointment = async (req, res) => {
  try {
    const { patientId, doctorId, date, time, notes, status } = req.body;

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        appointmentDate: new Date(date),
        appointmentTime: time,
        notes,
        status: status || 'SCHEDULED',
        createdById: req.user.id,
      },
      include: {
        patient: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({
      ...appointment,
      date: appointment.appointmentDate,
      time: appointment.appointmentTime,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { patientId, doctorId, date, time, notes, status } = req.body;

    const updateData = {};
    if (patientId) updateData.patientId = patientId;
    if (doctorId) updateData.doctorId = doctorId;
    if (date) updateData.appointmentDate = new Date(date);
    if (time) updateData.appointmentTime = time;
    if (notes !== undefined) updateData.notes = notes;
    if (status) updateData.status = status;

    const appointment = await prisma.appointment.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        patient: { select: { id: true, name: true } },
      },
    });

    res.json({
      ...appointment,
      date: appointment.appointmentDate,
      time: appointment.appointmentTime,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.appointment.delete({
      where: { id: parseInt(id) },
    });
    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};