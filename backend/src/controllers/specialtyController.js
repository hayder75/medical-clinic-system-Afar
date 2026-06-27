const prisma = require('../config/database');

const getPatientId = async (visitId) => {
  if (!visitId) return null;
  const visit = await prisma.visit.findUnique({ where: { id: parseInt(visitId) }, select: { patientId: true } });
  return visit?.patientId || null;
};

const getPregnancyRecords = async (req, res) => {
  try {
    const { patientId } = req.params;
    const records = await prisma.pregnancyRecord.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const savePregnancyRecord = async (req, res) => {
  try {
    const { patientId, visitId, lmp, edd, gravida, para, gestationalAgeWeeks, bloodPressure, weight, fundalHeight, fetalHeartRate, presentation, ultrasoundFindings, complications, notes } = req.body;
    const record = await prisma.pregnancyRecord.create({
      data: {
        patientId, visitId: visitId ? parseInt(visitId) : null, doctorId: req.user.id,
        lmp: lmp ? new Date(lmp) : null, edd: edd ? new Date(edd) : null,
        gravida: gravida ? parseInt(gravida) : null, para: para ? parseInt(para) : null,
        gestationalAgeWeeks: gestationalAgeWeeks ? parseInt(gestationalAgeWeeks) : null,
        bloodPressure, weight: weight ? parseFloat(weight) : null,
        fundalHeight: fundalHeight ? parseFloat(fundalHeight) : null,
        fetalHeartRate: fetalHeartRate ? parseInt(fetalHeartRate) : null,
        presentation, ultrasoundFindings, complications, notes
      }
    });
    res.json({ success: true, record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getGrowthMeasurements = async (req, res) => {
  try {
    const { patientId } = req.params;
    const records = await prisma.growthMeasurement.findMany({ where: { patientId }, orderBy: { recordDate: 'desc' } });
    res.json({ success: true, records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const saveGrowthMeasurement = async (req, res) => {
  try {
    const { patientId, visitId, recordDate, weight, height, headCircumference, bmi, weightPercentile, heightPercentile, headPercentile, bmiPercentile, notes } = req.body;
    const record = await prisma.growthMeasurement.create({
      data: {
        patientId, visitId: visitId ? parseInt(visitId) : null, recordedById: req.user.id,
        recordDate: recordDate ? new Date(recordDate) : new Date(),
        weight: weight ? parseFloat(weight) : null, height: height ? parseFloat(height) : null,
        headCircumference: headCircumference ? parseFloat(headCircumference) : null,
        bmi: bmi ? parseFloat(bmi) : null,
        weightPercentile: weightPercentile ? parseFloat(weightPercentile) : null,
        heightPercentile: heightPercentile ? parseFloat(heightPercentile) : null,
        headPercentile: headPercentile ? parseFloat(headPercentile) : null,
        bmiPercentile: bmiPercentile ? parseFloat(bmiPercentile) : null,
        notes
      }
    });
    res.json({ success: true, record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getVaccinations = async (req, res) => {
  try {
    const { patientId } = req.params;
    const records = await prisma.vaccinationRecord.findMany({ where: { patientId }, orderBy: { administrationDate: 'desc' } });
    res.json({ success: true, records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const saveVaccination = async (req, res) => {
  try {
    const { patientId, visitId, vaccineName, doseNumber, administrationDate, batchNumber, manufacturer, route, site, nextDueDate, notes } = req.body;
    const record = await prisma.vaccinationRecord.create({
      data: {
        patientId, visitId: visitId ? parseInt(visitId) : null, administeredById: req.user.id,
        vaccineName, doseNumber: doseNumber ? parseInt(doseNumber) : null,
        administrationDate: administrationDate ? new Date(administrationDate) : new Date(),
        batchNumber, manufacturer, route, site,
        nextDueDate: nextDueDate ? new Date(nextDueDate) : null, notes
      }
    });
    res.json({ success: true, record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteVaccination = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.vaccinationRecord.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getDevelopmentMilestones = async (req, res) => {
  try {
    const { patientId } = req.params;
    const records = await prisma.developmentMilestone.findMany({ where: { patientId }, orderBy: { recordDate: 'desc' } });
    res.json({ success: true, records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const saveDevelopmentMilestone = async (req, res) => {
  try {
    const { patientId, visitId, recordDate, category, milestoneName, achieved, achievedDate, expectedAgeMonths, notes } = req.body;
    const record = await prisma.developmentMilestone.create({
      data: {
        patientId, visitId: visitId ? parseInt(visitId) : null, recordedById: req.user.id,
        recordDate: recordDate ? new Date(recordDate) : new Date(),
        category, milestoneName, achieved: achieved === true || achieved === 'true',
        achievedDate: achievedDate ? new Date(achievedDate) : null,
        expectedAgeMonths: expectedAgeMonths ? parseInt(expectedAgeMonths) : null, notes
      }
    });
    res.json({ success: true, record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteDevelopmentMilestone = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.developmentMilestone.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getChronicDiseases = async (req, res) => {
  try {
    const { patientId } = req.params;
    const records = await prisma.chronicDiseaseRecord.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const saveChronicDisease = async (req, res) => {
  try {
    const { patientId, visitId, diseaseName, diagnosisDate, severity, status, medications, notes } = req.body;
    const record = await prisma.chronicDiseaseRecord.create({
      data: {
        patientId, visitId: visitId ? parseInt(visitId) : null, recordedById: req.user.id,
        diseaseName, diagnosisDate: diagnosisDate ? new Date(diagnosisDate) : null,
        severity, status: status || 'ACTIVE', medications, notes
      }
    });
    res.json({ success: true, record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateChronicDisease = async (req, res) => {
  try {
    const { id } = req.params;
    const { diseaseName, diagnosisDate, severity, status, medications, notes } = req.body;
    const record = await prisma.chronicDiseaseRecord.update({
      where: { id },
      data: {
        diseaseName, diagnosisDate: diagnosisDate ? new Date(diagnosisDate) : undefined,
        severity, status, medications, notes
      }
    });
    res.json({ success: true, record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getSurgicalNotes = async (req, res) => {
  try {
    const { patientId } = req.params;
    const records = await prisma.surgicalNote.findMany({ where: { patientId }, orderBy: { surgeryDate: 'desc' } });
    res.json({ success: true, records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const saveSurgicalNote = async (req, res) => {
  try {
    const { patientId, visitId, surgeryName, surgeryDate, preoperativeDiagnosis, postoperativeDiagnosis, procedureDescription, findings, complications, estimatedBloodLoss, anesthesiaType, antibiotics, followUpInstructions, notes } = req.body;
    const record = await prisma.surgicalNote.create({
      data: {
        patientId, visitId: visitId ? parseInt(visitId) : null, surgeonId: req.user.id,
        surgeryName, surgeryDate: surgeryDate ? new Date(surgeryDate) : null,
        preoperativeDiagnosis, postoperativeDiagnosis, procedureDescription, findings,
        complications, estimatedBloodLoss, anesthesiaType, antibiotics, followUpInstructions, notes
      }
    });
    res.json({ success: true, record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getBodyChartRecords = async (req, res) => {
  try {
    const { patientId } = req.params;
    const records = await prisma.bodyChartRecord.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const saveBodyChartRecord = async (req, res) => {
  try {
    const { patientId, visitId, diagramData, painPoints, notes } = req.body;
    const record = await prisma.bodyChartRecord.create({
      data: {
        patientId, visitId: visitId ? parseInt(visitId) : null, createdById: req.user.id,
        diagramData: diagramData || undefined, painPoints: painPoints || undefined, notes
      }
    });
    res.json({ success: true, record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getExercisePrescriptions = async (req, res) => {
  try {
    const { patientId } = req.params;
    const records = await prisma.exercisePrescription.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const saveExercisePrescription = async (req, res) => {
  try {
    const { patientId, visitId, exerciseName, description, sets, reps, duration, frequency, intensity, instructions, precautions, status, startDate, endDate, notes } = req.body;
    const record = await prisma.exercisePrescription.create({
      data: {
        patientId, visitId: visitId ? parseInt(visitId) : null, prescribedById: req.user.id,
        exerciseName, description, sets: sets ? parseInt(sets) : null, reps: reps ? parseInt(reps) : null,
        duration: duration ? parseInt(duration) : null, frequency, intensity, instructions, precautions,
        status: status || 'ACTIVE', startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null, notes
      }
    });
    res.json({ success: true, record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateExercisePrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const { exerciseName, description, sets, reps, duration, frequency, intensity, instructions, precautions, status, startDate, endDate, notes } = req.body;
    const record = await prisma.exercisePrescription.update({
      where: { id },
      data: {
        exerciseName, description, sets: sets ? parseInt(sets) : undefined, reps: reps ? parseInt(reps) : undefined,
        duration: duration ? parseInt(duration) : undefined, frequency, intensity, instructions, precautions,
        status, startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined, notes
      }
    });
    res.json({ success: true, record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getOutcomeScores = async (req, res) => {
  try {
    const { patientId } = req.params;
    const records = await prisma.outcomeScore.findMany({ where: { patientId }, orderBy: { recordedAt: 'desc' } });
    res.json({ success: true, records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const saveOutcomeScore = async (req, res) => {
  try {
    const { patientId, visitId, scoreType, scoreName, scoreValue, maxScore, notes, recordedAt } = req.body;
    const percentage = maxScore && parseFloat(maxScore) > 0 ? (parseFloat(scoreValue) / parseFloat(maxScore)) * 100 : null;
    const record = await prisma.outcomeScore.create({
      data: {
        patientId, visitId: visitId ? parseInt(visitId) : null, recordedById: req.user.id,
        scoreType, scoreName, scoreValue: parseFloat(scoreValue),
        maxScore: maxScore ? parseFloat(maxScore) : null, percentage,
        notes, recordedAt: recordedAt ? new Date(recordedAt) : new Date()
      }
    });
    res.json({ success: true, record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getPatientImages = async (req, res) => {
  try {
    const { patientId } = req.params;
    const [attached, gallery] = await Promise.all([
      prisma.patientAttachedImage.findMany({ where: { patientId }, orderBy: { uploadedAt: 'desc' } }),
      prisma.patientGallery.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } })
    ]);
    const images = [
      ...attached.map(i => ({ id: i.id, type: 'attached', fileName: i.fileName, filePath: i.filePath, fileSize: i.fileSize, mimeType: i.mimeType, description: i.description, uploadedAt: i.uploadedAt })),
      ...gallery.map(i => ({ id: i.id, type: 'gallery', fileName: i.filePath?.split('/').pop(), filePath: i.filePath, description: i.description, uploadedAt: i.createdAt }))
    ];
    images.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    res.json({ success: true, images });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getPregnancyRecords, savePregnancyRecord,
  getGrowthMeasurements, saveGrowthMeasurement,
  getVaccinations, saveVaccination, deleteVaccination,
  getDevelopmentMilestones, saveDevelopmentMilestone, deleteDevelopmentMilestone,
  getChronicDiseases, saveChronicDisease, updateChronicDisease,
  getSurgicalNotes, saveSurgicalNote,
  getBodyChartRecords, saveBodyChartRecord,
  getExercisePrescriptions, saveExercisePrescription, updateExercisePrescription,
  getOutcomeScores, saveOutcomeScore,
  getPatientImages
};
