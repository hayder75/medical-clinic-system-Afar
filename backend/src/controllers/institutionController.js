const prisma = require('../config/database');

exports.getInstitutions = async (req, res) => {
  try {
    const { search, status, type } = req.query;
    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const institutions = await prisma.institution.findMany({
      where,
      include: {
        _count: { select: { patients: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = institutions.map((inst) => ({
      ...inst,
      patientCount: inst._count.patients,
      _count: undefined,
    }));

    res.json(data);
  } catch (error) {
    console.error('Error fetching institutions:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getInstitution = async (req, res) => {
  try {
    const { id } = req.params;
    const institution = await prisma.institution.findUnique({
      where: { id },
      include: {
        _count: { select: { patients: true } },
      },
    });
    if (!institution) return res.status(404).json({ error: 'Institution not found' });
    res.json({ ...institution, patientCount: institution._count.patients, _count: undefined });
  } catch (error) {
    console.error('Error fetching institution:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.createInstitution = async (req, res) => {
  try {
    const { name, type, tinNumber, contactPerson, phone, email, address } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'Name and type are required' });

    const institution = await prisma.institution.create({
      data: { name, type, tinNumber, contactPerson, phone, email, address },
    });
    res.status(201).json(institution);
  } catch (error) {
    console.error('Error creating institution:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateInstitution = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, tinNumber, contactPerson, phone, email, address, status } = req.body;

    const institution = await prisma.institution.update({
      where: { id },
      data: { name, type, tinNumber, contactPerson, phone, email, address, status },
    });
    res.json(institution);
  } catch (error) {
    console.error('Error updating institution:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteInstitution = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.institution.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
    res.json({ message: 'Institution deactivated' });
  } catch (error) {
    console.error('Error deactivating institution:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getLinkedPatients = async (req, res) => {
  try {
    const { id } = req.params;
    const links = await prisma.patientInstitution.findMany({
      where: { institutionId: id },
      include: {
        patient: { select: { id: true, name: true, gender: true, dob: true, mobile: true, cardStatus: true } },
        linkedBy: { select: { id: true, fullname: true } },
      },
      orderBy: { linkedAt: 'desc' },
    });
    res.json(links);
  } catch (error) {
    console.error('Error fetching linked patients:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.linkPatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { patientId, notes } = req.body;
    if (!patientId) return res.status(400).json({ error: 'Patient ID is required' });

    const existing = await prisma.patientInstitution.findUnique({
      where: { patientId_institutionId: { patientId, institutionId: id } },
    });
    if (existing) return res.status(400).json({ error: 'Patient already linked to this institution' });

    const link = await prisma.patientInstitution.create({
      data: { patientId, institutionId: id, linkedById: req.user.id, notes },
    });
    res.status(201).json(link);
  } catch (error) {
    console.error('Error linking patient:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.unlinkPatient = async (req, res) => {
  try {
    const { id, linkId } = req.params;
    await prisma.patientInstitution.delete({
      where: { id: linkId, institutionId: id },
    });
    res.json({ message: 'Patient unlinked' });
  } catch (error) {
    console.error('Error unlinking patient:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.createAndLinkPatient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, dob, gender, mobile, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Patient name is required' });

    const patientId = `PAT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const patient = await prisma.patient.create({
      data: { id: patientId, name, dob: dob ? new Date(dob) : null, gender, mobile, address, type: 'REGULAR' },
    });

    await prisma.patientInstitution.create({
      data: { patientId: patient.id, institutionId: id, linkedById: req.user.id },
    });

    res.status(201).json(patient);
  } catch (error) {
    console.error('Error creating and linking patient:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getInstitutionReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;

    const institution = await prisma.institution.findUnique({ where: { id } });
    if (!institution) return res.status(404).json({ error: 'Institution not found' });

    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to + 'T23:59:59.999Z');

    const billPayments = await prisma.billPayment.findMany({
      where: {
        institutionId: id,
        type: 'INSTITUTION',
        ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
      },
      include: {
        billing: {
          include: {
            services: { include: { service: true } },
          },
        },
        patient: { select: { id: true, name: true, mobile: true, gender: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const patientMap = new Map();
    let totalBilled = 0;

    for (const payment of billPayments) {
      const pid = payment.patientId;
      if (!patientMap.has(pid)) {
        patientMap.set(pid, { patient: payment.patient, bills: [], totalAmount: 0 });
      }
      const entry = patientMap.get(pid);
      const billServices = (payment.billing?.services || []).map((s) => ({
        name: s.service?.name || s.name || 'Unknown',
        price: s.price || 0,
        quantity: s.quantity || 1,
      }));
      entry.bills.push({
        billId: payment.billingId,
        date: payment.createdAt,
        services: billServices,
        billTotal: payment.amount,
      });
      entry.totalAmount += payment.amount;
      totalBilled += payment.amount;
    }

    const patientDetails = Array.from(patientMap.values()).map((entry) => ({
      patient: entry.patient,
      totalAmount: entry.totalAmount,
      bills: entry.bills,
    }));

    res.json({
      institution: { id: institution.id, name: institution.name, type: institution.type, tinNumber: institution.tinNumber, phone: institution.phone },
      summary: { totalPatients: patientDetails.length, totalBilled },
      patientDetails,
    });
  } catch (error) {
    console.error('Error fetching institution report:', error);
    res.status(500).json({ error: error.message });
  }
};
