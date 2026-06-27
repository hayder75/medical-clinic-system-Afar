const prisma = require('../config/database');

exports.getRecords = async (req, res) => {
  try {
    const { patientId, startDate, endDate } = req.query;
    const where = {};
    if (patientId) where.patientId = patientId;
    if (startDate || endDate) {
      where.regDate = {};
      if (startDate) where.regDate.gte = new Date(startDate);
      if (endDate) where.regDate.lte = new Date(endDate);
    }
    const records = await prisma.familyPlanningRecord.findMany({
      where,
      orderBy: { regDate: 'desc' }
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createRecord = async (req, res) => {
  try {
    const data = req.body;
    const record = await prisma.familyPlanningRecord.create({
      data: {
        patientId: data.patientId,
        visitId: data.visitId || null,
        mrn: data.mrn,
        name: data.name,
        age: data.age ? parseInt(data.age) : null,
        sex: data.sex,
        regDate: data.regDate ? new Date(data.regDate) : new Date(),
        isNewAcceptor: data.isNewAcceptor === true || data.isNewAcceptor === 'true',
        isRepeatAcceptor: data.isRepeatAcceptor === true || data.isRepeatAcceptor === 'true',
        hivTestOffered: data.hivTestOffered === true || data.hivTestOffered === 'true',
        hivTestPerformed: data.hivTestPerformed === true || data.hivTestPerformed === 'true',
        hivTestResult: data.hivTestResult,
        hivCounselingOffered: data.hivCounselingOffered === true || data.hivCounselingOffered === 'true',
        hivPositiveLinkedART: data.hivPositiveLinkedART === true || data.hivPositiveLinkedART === 'true',
        targetPopulation: data.targetPopulation,
        tdStatusChecked: data.tdStatusChecked === true || data.tdStatusChecked === 'true',
        contraindicationIUCD: data.contraindicationIUCD === true || data.contraindicationIUCD === 'true',
        contraceptiveProvided: data.contraceptiveProvided,
        referralSource: data.referralSource,
        notes: data.notes,
        createdById: req.user?.id
      }
    });
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const record = await prisma.familyPlanningRecord.update({
      where: { id },
      data: {
        name: data.name,
        age: data.age ? parseInt(data.age) : null,
        sex: data.sex,
        isNewAcceptor: data.isNewAcceptor !== undefined ? (data.isNewAcceptor === true || data.isNewAcceptor === 'true') : undefined,
        isRepeatAcceptor: data.isRepeatAcceptor !== undefined ? (data.isRepeatAcceptor === true || data.isRepeatAcceptor === 'true') : undefined,
        hivTestOffered: data.hivTestOffered !== undefined ? (data.hivTestOffered === true || data.hivTestOffered === 'true') : undefined,
        hivTestPerformed: data.hivTestPerformed !== undefined ? (data.hivTestPerformed === true || data.hivTestPerformed === 'true') : undefined,
        hivTestResult: data.hivTestResult,
        hivCounselingOffered: data.hivCounselingOffered !== undefined ? (data.hivCounselingOffered === true || data.hivCounselingOffered === 'true') : undefined,
        hivPositiveLinkedART: data.hivPositiveLinkedART !== undefined ? (data.hivPositiveLinkedART === true || data.hivPositiveLinkedART === 'true') : undefined,
        targetPopulation: data.targetPopulation,
        tdStatusChecked: data.tdStatusChecked !== undefined ? (data.tdStatusChecked === true || data.tdStatusChecked === 'true') : undefined,
        contraindicationIUCD: data.contraindicationIUCD !== undefined ? (data.contraindicationIUCD === true || data.contraindicationIUCD === 'true') : undefined,
        contraceptiveProvided: data.contraceptiveProvided,
        referralSource: data.referralSource,
        notes: data.notes
      }
    });
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const records = await prisma.familyPlanningRecord.findMany({
      where: { patientId },
      orderBy: { regDate: 'desc' }
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getByVisit = async (req, res) => {
  try {
    const { visitId } = req.params;
    const records = await prisma.familyPlanningRecord.findMany({
      where: { visitId },
      orderBy: { regDate: 'desc' }
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteRecord = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.familyPlanningRecord.delete({ where: { id } });
    res.json({ message: 'Record deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getVisits = async (req, res) => {
  try {
    const { recordId } = req.query;
    const where = {};
    if (recordId) where.recordId = recordId;
    const visits = await prisma.familyPlanningVisit.findMany({
      where,
      orderBy: { visitDate: 'desc' }
    });
    res.json(visits);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createVisit = async (req, res) => {
  try {
    const data = req.body;
    const visit = await prisma.familyPlanningVisit.create({
      data: {
        recordId: data.recordId,
        visitDate: data.visitDate ? new Date(data.visitDate) : new Date(),
        visitNo: data.visitNo ? parseInt(data.visitNo) : null,
        contraceptiveProvided: data.contraceptiveProvided,
        appointmentDate: data.appointmentDate ? new Date(data.appointmentDate) : null,
        referredFrom: data.referredFrom,
        followUpNote: data.followUpNote,
        createdById: req.user?.id
      }
    });
    res.status(201).json(visit);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const where = {};
    if (startDate || endDate) {
      where.regDate = {};
      if (startDate) where.regDate.gte = new Date(startDate);
      if (endDate) where.regDate.lte = new Date(endDate);
    }
    const records = await prisma.familyPlanningRecord.findMany({ where });
    const total = records.length;
    const newAcceptors = records.filter(r => r.isNewAcceptor).length;
    const repeatAcceptors = records.filter(r => r.isRepeatAcceptor).length;
    const hivTested = records.filter(r => r.hivTestPerformed).length;
    const hivPositive = records.filter(r => r.hivTestResult === 'POSITIVE').length;
    const methods = {};
    records.forEach(r => {
      if (r.contraceptiveProvided) {
        methods[r.contraceptiveProvided] = (methods[r.contraceptiveProvided] || 0) + 1;
      }
    });
    res.json({ total, newAcceptors, repeatAcceptors, hivTested, hivPositive, methods });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
