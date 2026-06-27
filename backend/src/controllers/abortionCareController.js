const prisma = require('../config/database');

exports.getRecords = async (req, res) => {
  try {
    const { patientId, startDate, endDate, careType } = req.query;
    const where = {};
    if (patientId) where.patientId = patientId;
    if (careType) where.careType = careType;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    const records = await prisma.abortionCareRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createRecord = async (req, res) => {
  try {
    const data = req.body;
    const record = await prisma.abortionCareRecord.create({
      data: {
        patientId: data.patientId,
        visitId: data.visitId || null,
        mrn: data.mrn,
        age: data.age ? parseInt(data.age) : null,
        gravida: data.gravida ? parseInt(data.gravida) : null,
        para: data.para ? parseInt(data.para) : null,
        gestationalAgeWeeks: data.gestationalAgeWeeks ? parseInt(data.gestationalAgeWeeks) : null,
        careType: data.careType,
        procedureType: data.procedureType,
        managedAsOutpatient: data.managedAsOutpatient === true || data.managedAsOutpatient === 'true',
        managedAsInpatient: data.managedAsInpatient === true || data.managedAsInpatient === 'true',
        referred: data.referred === true || data.referred === 'true',
        drugsProvided: data.drugsProvided,
        hivTestAccepted: data.hivTestAccepted === true || data.hivTestAccepted === 'true',
        hivTestResult: data.hivTestResult,
        hivTestReceivedCounselling: data.hivTestReceivedCounselling === true || data.hivTestReceivedCounselling === 'true',
        hivPositiveLinkedART: data.hivPositiveLinkedART === true || data.hivPositiveLinkedART === 'true',
        postAbortionContraceptiveNew: data.postAbortionContraceptiveNew === true || data.postAbortionContraceptiveNew === 'true',
        postAbortionContraceptiveRepeat: data.postAbortionContraceptiveRepeat === true || data.postAbortionContraceptiveRepeat === 'true',
        postAbortionContraceptiveMethod: data.postAbortionContraceptiveMethod,
        death: data.death === true || data.death === 'true',
        complications: data.complications === true || data.complications === 'true',
        complicationDetails: data.complicationDetails,
        safeAbortionReason: data.safeAbortionReason,
        postAbortionDiagnosis: data.postAbortionDiagnosis,
        otherServiceCode: data.otherServiceCode,
        referralSource: data.referralSource,
        serviceProviderName: data.serviceProviderName,
        serviceProviderSignature: data.serviceProviderSignature,
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
    const record = await prisma.abortionCareRecord.update({
      where: { id },
      data: {
        age: data.age ? parseInt(data.age) : undefined,
        gravida: data.gravida ? parseInt(data.gravida) : undefined,
        para: data.para ? parseInt(data.para) : undefined,
        gestationalAgeWeeks: data.gestationalAgeWeeks ? parseInt(data.gestationalAgeWeeks) : undefined,
        careType: data.careType,
        procedureType: data.procedureType,
        managedAsOutpatient: data.managedAsOutpatient !== undefined ? (data.managedAsOutpatient === true || data.managedAsOutpatient === 'true') : undefined,
        managedAsInpatient: data.managedAsInpatient !== undefined ? (data.managedAsInpatient === true || data.managedAsInpatient === 'true') : undefined,
        referred: data.referred !== undefined ? (data.referred === true || data.referred === 'true') : undefined,
        drugsProvided: data.drugsProvided,
        hivTestAccepted: data.hivTestAccepted !== undefined ? (data.hivTestAccepted === true || data.hivTestAccepted === 'true') : undefined,
        hivTestResult: data.hivTestResult,
        hivTestReceivedCounselling: data.hivTestReceivedCounselling !== undefined ? (data.hivTestReceivedCounselling === true || data.hivTestReceivedCounselling === 'true') : undefined,
        hivPositiveLinkedART: data.hivPositiveLinkedART !== undefined ? (data.hivPositiveLinkedART === true || data.hivPositiveLinkedART === 'true') : undefined,
        postAbortionContraceptiveNew: data.postAbortionContraceptiveNew !== undefined ? (data.postAbortionContraceptiveNew === true || data.postAbortionContraceptiveNew === 'true') : undefined,
        postAbortionContraceptiveRepeat: data.postAbortionContraceptiveRepeat !== undefined ? (data.postAbortionContraceptiveRepeat === true || data.postAbortionContraceptiveRepeat === 'true') : undefined,
        postAbortionContraceptiveMethod: data.postAbortionContraceptiveMethod,
        death: data.death !== undefined ? (data.death === true || data.death === 'true') : undefined,
        complications: data.complications !== undefined ? (data.complications === true || data.complications === 'true') : undefined,
        complicationDetails: data.complicationDetails,
        safeAbortionReason: data.safeAbortionReason,
        postAbortionDiagnosis: data.postAbortionDiagnosis,
        otherServiceCode: data.otherServiceCode,
        referralSource: data.referralSource,
        serviceProviderName: data.serviceProviderName,
        serviceProviderSignature: data.serviceProviderSignature
      }
    });
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteRecord = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.abortionCareRecord.delete({ where: { id } });
    res.json({ message: 'Record deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const records = await prisma.abortionCareRecord.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getByVisit = async (req, res) => {
  try {
    const { visitId } = req.params;
    const records = await prisma.abortionCareRecord.findMany({
      where: { visitId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const where = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    const records = await prisma.abortionCareRecord.findMany({ where });
    const total = records.length;
    const safeAbortion = records.filter(r => r.careType === 'SAFE_ABORTION').length;
    const postAbortion = records.filter(r => r.careType === 'POST_ABORTION').length;
    const byProcedure = {};
    records.forEach(r => {
      if (r.procedureType) byProcedure[r.procedureType] = (byProcedure[r.procedureType] || 0) + 1;
    });
    const deaths = records.filter(r => r.death).length;
    const withComplications = records.filter(r => r.complications).length;
    res.json({ total, safeAbortion, postAbortion, byProcedure, deaths, withComplications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
