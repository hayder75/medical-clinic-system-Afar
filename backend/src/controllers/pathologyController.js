const prisma = require('../config/database');
const { z } = require('zod');

const createReportSchema = z.object({
  patientId: z.string(),
  visitId: z.number().optional(),
  sampleId: z.string().optional(),
  pathologyNo: z.string().optional(),
  receiptNo: z.string().optional(),
  reportDate: z.string().optional(),
  grossFinding: z.string().optional(),
  microscopy: z.string().optional(),
  conclusion: z.string().optional(),
  recommendation: z.string().optional(),
  natureOfSpecimen: z.string().optional(),
  durationOfLesion: z.string().optional(),
  infiltrationSign: z.string().optional(),
  symptomsSigns: z.string().optional(),
  lmp: z.string().optional(),
  relevantLabData: z.string().optional(),
  pathologistName: z.string().optional(),
  pathologistSignature: z.string().optional()
});

exports.createReport = async (req, res) => {
  try {
    const data = createReportSchema.parse(req.body);
    const report = await prisma.pathologyReport.create({
      data: {
        ...data,
        doctorId: req.user.id,
        reportDate: data.reportDate ? new Date(data.reportDate) : new Date()
      }
    });
    res.json(report);
  } catch (error) {
    console.error('Error creating pathology report:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.updateReport = async (req, res) => {
  try {
    const { id } = req.params;
    const data = createReportSchema.partial().parse(req.body);
    const report = await prisma.pathologyReport.update({
      where: { id },
      data: {
        ...data,
        reportDate: data.reportDate ? new Date(data.reportDate) : undefined
      }
    });
    res.json(report);
  } catch (error) {
    console.error('Error updating pathology report:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.getReport = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await prisma.pathologyReport.findUnique({ where: { id } });
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPatientReports = async (req, res) => {
  try {
    const { patientId } = req.params;
    const reports = await prisma.pathologyReport.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.listReports = async (req, res) => {
  try {
    const { search } = req.query;
    const where = {};
    if (search) {
      where.OR = [
        { pathologyNo: { contains: search, mode: 'insensitive' } },
        { patient: { name: { contains: search, mode: 'insensitive' } } },
        { patient: { id: { contains: search, mode: 'insensitive' } } }
      ];
    }
    const reports = await prisma.pathologyReport.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, gender: true, age: true } },
        doctor: { select: { id: true, fullname: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { reportStatus } = req.body;
    const report = await prisma.pathologyReport.update({
      where: { id },
      data: { reportStatus }
    });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteReport = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.pathologyReport.delete({ where: { id } });
    res.json({ success: true, message: 'Report deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
