const prisma = require('../config/database');

const searchDiseases = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Query parameter is required' });
        }

        const diseases = await prisma.disease.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { code: { contains: query, mode: 'insensitive' } }
                ]
            },
            take: 50,
            orderBy: { name: 'asc' }
        });

        res.json(diseases);
    } catch (error) {
        console.error('Error searching diseases:', error);
        res.status(500).json({ error: 'Failed to search diseases' });
    }
};

const addPatientDiagnosis = async (req, res) => {
    try {
        const { visitId, patientId, diseaseId, type, status, isPrimary, notes, outcome } = req.body;
        const doctorId = req.user.id; // From authMiddleware

        // 1. Create PatientDiagnosis
        const diagnosis = await prisma.patientDiagnosis.create({
            data: {
                visitId: parseInt(visitId),
                patientId,
                diseaseId,
                doctorId,
                type: type || 'CLINICAL', // 'CLINICAL', 'CONFIRMED', 'SUSPECTED'
                status: status || 'ACTIVE',
                isPrimary: isPrimary ?? true,
                notes
            },
            include: {
                disease: true
            }
        });

        // 2. Update Visit outcome if provided (last diagnosis usually dictates endpoint, or just accumulate)
        // Also update the text-based diagnosis field for backward compatibility
        if (outcome) {
            await prisma.visit.update({
                where: { id: parseInt(visitId) },
                data: { outcome }
            });
        }

        // Update the legacy string field in Visit for lists
        const diseaseName = diagnosis.disease.name;
        const currentVisit = await prisma.visit.findUnique({ where: { id: parseInt(visitId) }, select: { diagnosis: true } });

        let newDiagnosisString = currentVisit.diagnosis ? `${currentVisit.diagnosis}, ${diseaseName}` : diseaseName;
        // Limit string length just in case
        if (newDiagnosisString.length > 190) newDiagnosisString = newDiagnosisString.substring(0, 190) + '...';

        await prisma.visit.update({
            where: { id: parseInt(visitId) },
            data: { diagnosis: newDiagnosisString }
        });

        res.json(diagnosis);
    } catch (error) {
        console.error('Error adding diagnosis:', error);
        res.status(500).json({ error: 'Failed to add diagnosis' });
    }
};

const deletePatientDiagnosis = async (req, res) => {
    try {
        const { diagnosisId } = req.params;

        const removed = await prisma.$transaction(async (tx) => {
            const existingDiagnosis = await tx.patientDiagnosis.findUnique({
                where: { id: diagnosisId },
                include: { disease: true }
            });

            if (!existingDiagnosis) {
                return null;
            }

            await tx.patientDiagnosis.delete({ where: { id: diagnosisId } });

            const remainingDiagnoses = await tx.patientDiagnosis.findMany({
                where: { visitId: existingDiagnosis.visitId },
                include: { disease: true },
                orderBy: { createdAt: 'asc' }
            });

            let updatedDiagnosisText = remainingDiagnoses
                .map((item) => item.disease?.name)
                .filter(Boolean)
                .join(', ');

            if (updatedDiagnosisText.length > 190) {
                updatedDiagnosisText = `${updatedDiagnosisText.substring(0, 190)}...`;
            }

            await tx.visit.update({
                where: { id: existingDiagnosis.visitId },
                data: { diagnosis: updatedDiagnosisText || null }
            });

            return { id: diagnosisId, visitId: existingDiagnosis.visitId };
        });

        if (!removed) {
            return res.status(404).json({ error: 'Diagnosis not found' });
        }

        res.json({ message: 'Diagnosis deleted successfully', ...removed });
    } catch (error) {
        console.error('Error deleting diagnosis:', error);
        res.status(500).json({ error: 'Failed to delete diagnosis' });
    }
};

const getVisitDiagnoses = async (req, res) => {
    try {
        const { visitId } = req.params;
        const diagnoses = await prisma.patientDiagnosis.findMany({
            where: { visitId: parseInt(visitId) },
            include: { disease: true }
        });
        res.json(diagnoses);
    } catch (error) {
        console.error('Error fetching diagnoses:', error);
        res.status(500).json({ error: 'Failed to fetch diagnoses' });
    }
};

const getDiseaseReport = async (req, res) => {
    try {
        // detail: 'summary' or 'detailed'
        const { startDate, endDate, type, detail } = req.query;

        // Validate dates
        const start = new Date(startDate);
        const end = new Date(endDate);
        // Adjust end date to end of day
        end.setHours(23, 59, 59, 999);

        const diagnoses = await prisma.patientDiagnosis.findMany({
            where: {
                createdAt: {
                    gte: start,
                    lte: end
                }
            },
            include: {
                disease: true,
                patient: {
                    select: { name: true, dob: true, gender: true } // Name needed for detailed list
                },
                visit: {
                    select: {
                        visitUid: true,
                        queueType: true,
                        status: true,
                        outcome: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (detail === 'detailed') {
            // Return raw list for "Detailed Report"
            const list = diagnoses.map(d => ({
                id: d.id,
                date: d.createdAt,
                visitUid: d.visit.visitUid,
                patientName: d.patient.name,
                age: d.patient.dob ? Math.floor((new Date() - new Date(d.patient.dob)) / (1000 * 60 * 60 * 24 * 365.25)) : 'N/A',
                gender: d.patient.gender,
                disease: d.disease.name,
                code: d.disease.code,
                type: d.type,
                status: d.status,
                outcome: d.visit.outcome || '-'
            }));
            return res.json(list);
        }

        // Aggregation Logic (Summary)
        const report = {};

        for (const d of diagnoses) {
            const diseaseId = d.diseaseId;
            if (!report[diseaseId]) {
                report[diseaseId] = {
                    id: diseaseId,
                    name: d.disease.name,
                    code: d.disease.code,
                    category: d.disease.category,
                    reportFrequency: d.disease.reportFrequency || 'NONE',
                    outPatientCases: 0,
                    inPatientCases: 0,
                    deaths: 0,
                    under5: 0,
                    over5: 0
                };
            }

            const isInpatient = d.visit.status === 'ADMITTED' || d.visit.status === 'DISCHARGED' || d.visit.outcome === 'ADMITTED';

            if (isInpatient) {
                report[diseaseId].inPatientCases++;
            } else {
                report[diseaseId].outPatientCases++;
            }

            if (d.visit.outcome === 'Death' || d.visit.outcome === 'DEATH') {
                report[diseaseId].deaths++;
            }

            // Age calculation
            if (d.patient.dob) {
                const age = (new Date() - new Date(d.patient.dob)) / (1000 * 60 * 60 * 24 * 365.25);
                if (age < 5) report[diseaseId].under5++;
                else report[diseaseId].over5++;
            }
        }

        res.json(Object.values(report));
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
};

// Create a new disease (for custom diseases)
const createDisease = async (req, res) => {
    try {
        const { name, code, category, isReportable, reportFrequency } = req.body;
        const normalizedName = String(name || '').trim();

        if (!normalizedName) {
            return res.status(400).json({ error: 'Disease name is required' });
        }

        const existingDisease = await prisma.disease.findFirst({
            where: {
                name: {
                    equals: normalizedName,
                    mode: 'insensitive'
                }
            }
        });

        if (existingDisease) {
            return res.json(existingDisease);
        }

        const disease = await prisma.disease.create({
            data: {
                name: normalizedName,
                code: code || `CUSTOM-${Date.now()}`,
                category: category || 'Other',
                isReportable: isReportable || false,
                reportFrequency: reportFrequency || null
            }
        });

        res.json(disease);
    } catch (error) {
        console.error('Error creating disease:', error);
        res.status(500).json({ error: 'Failed to create disease' });
    }
};

const getAgeGenderDistribution = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start date and end date are required' });
        }

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        console.log('Fetching age-gender distribution from', start, 'to', end);

        // Get all diagnoses within date range with patient data
        const diagnoses = await prisma.patientDiagnosis.findMany({
            where: {
                createdAt: {
                    gte: start,
                    lte: end
                }
            },
            include: {
                patient: {
                    select: {
                        id: true,
                        name: true,
                        dob: true,
                        age: true,
                        gender: true
                    }
                },
                disease: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        category: true
                    }
                }
            }
        });

        console.log('Found', diagnoses.length, 'diagnoses');
        if (diagnoses.length > 0) {
            console.log('Sample diagnosis:', {
                disease: diagnoses[0].disease?.name,
                patientName: diagnoses[0].patient?.name,
                patientAge: diagnoses[0].patient?.age,
                patientDob: diagnoses[0].patient?.dob,
                patientGender: diagnoses[0].patient?.gender,
                createdAt: diagnoses[0].createdAt
            });
        }

        // Define age groups
        const ageGroups = [
            { label: '<1', min: 0, max: 0 },
            { label: '1-4', min: 1, max: 4 },
            { label: '5-14', min: 5, max: 14 },
            { label: '15-29', min: 15, max: 29 },
            { label: '30-64', min: 30, max: 64 },
            { label: '>=65', min: 65, max: 999 }
        ];

        // Calculate age from dob or use stored age
        const calculateAge = (patient) => {
            if (patient.age !== null && patient.age !== undefined) {
                return patient.age;
            }
            if (patient.dob) {
                const today = new Date();
                const birthDate = new Date(patient.dob);
                return Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
            }
            return null;
        };

        // Group by disease
        const diseaseMap = {};
        let skippedCount = 0;
        
        diagnoses.forEach(diagnosis => {
            const diseaseName = diagnosis.disease?.name || 'Unknown';
            const patientAge = calculateAge(diagnosis.patient);
            const gender = diagnosis.patient?.gender;
            
            console.log('Processing:', diseaseName, 'Age:', patientAge, 'Gender:', gender);
            
            if (!diseaseMap[diseaseName]) {
                diseaseMap[diseaseName] = {
                    diseaseId: diagnosis.diseaseId,
                    diseaseName: diseaseName,
                    diseaseCode: diagnosis.disease?.code,
                    category: diagnosis.disease?.category,
                    counts: {
                        '<1': { male: 0, female: 0, total: 0 },
                        '1-4': { male: 0, female: 0, total: 0 },
                        '5-14': { male: 0, female: 0, total: 0 },
                        '15-29': { male: 0, female: 0, total: 0 },
                        '30-64': { male: 0, female: 0, total: 0 },
                        '>=65': { male: 0, female: 0, total: 0 }
                    },
                    maleTotal: 0,
                    femaleTotal: 0,
                    total: 0
                };
            }

            // Find the age group
            let ageGroup = null;
            if (patientAge !== null && patientAge !== undefined && !isNaN(patientAge)) {
                if (patientAge < 1) {
                    ageGroup = '<1';
                } else if (patientAge >= 1 && patientAge <= 4) {
                    ageGroup = '1-4';
                } else if (patientAge >= 5 && patientAge <= 14) {
                    ageGroup = '5-14';
                } else if (patientAge >= 15 && patientAge <= 29) {
                    ageGroup = '15-29';
                } else if (patientAge >= 30 && patientAge <= 64) {
                    ageGroup = '30-64';
                } else if (patientAge >= 65) {
                    ageGroup = '>=65';
                }
            }

            const genderKey = gender === 'MALE' ? 'male' : (gender === 'FEMALE' ? 'female' : null);
            
            if (ageGroup && genderKey) {
                diseaseMap[diseaseName].counts[ageGroup][genderKey]++;
                diseaseMap[diseaseName].counts[ageGroup].total++;
                if (genderKey === 'male') {
                    diseaseMap[diseaseName].maleTotal++;
                } else {
                    diseaseMap[diseaseName].femaleTotal++;
                }
                diseaseMap[diseaseName].total++;
            }
        });
        
        console.log('Skipped', skippedCount, 'diagnoses due to missing age or gender');

        // Convert to array and sort by total count descending
        const result = Object.values(diseaseMap).sort((a, b) => b.total - a.total);

        res.json({
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            totalDiagnoses: diagnoses.length,
            diseaseCount: result.length,
            diseases: result
        });
    } catch (error) {
        console.error('Error getting age-gender distribution:', error);
        res.status(500).json({ error: 'Failed to get age-gender distribution' });
    }
};

const getAllDiseases = async (req, res) => {
    try {
        const { page = 1, limit = 100, search } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const where = search ? {
            OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } }
            ]
        } : {};

        const [diseases, total] = await Promise.all([
            prisma.disease.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { name: 'asc' }
            }),
            prisma.disease.count({ where })
        ]);

        res.json({ diseases, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (error) {
        console.error('Error listing diseases:', error);
        res.status(500).json({ error: 'Failed to list diseases' });
    }
};

const updateDisease = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, category, isReportable, reportFrequency } = req.body;

        const existing = await prisma.disease.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Disease not found' });

        const updated = await prisma.disease.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(code !== undefined && { code }),
                ...(category !== undefined && { category }),
                ...(isReportable !== undefined && { isReportable }),
                ...(reportFrequency !== undefined && { reportFrequency })
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('Error updating disease:', error);
        res.status(500).json({ error: 'Failed to update disease' });
    }
};

const deleteDisease = async (req, res) => {
    try {
        const { id } = req.params;

        const existing = await prisma.disease.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Disease not found' });

        const linkedDiagnoses = await prisma.patientDiagnosis.count({ where: { diseaseId: id } });
        if (linkedDiagnoses > 0) {
            return res.status(400).json({ error: `Cannot delete disease with ${linkedDiagnoses} linked diagnosis records` });
        }

        await prisma.disease.delete({ where: { id } });
        res.json({ message: 'Disease deleted successfully' });
    } catch (error) {
        console.error('Error deleting disease:', error);
        res.status(500).json({ error: 'Failed to delete disease' });
    }
};

const importDiseasesFromExcel = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Excel file is required' });

        const XLSX = require('xlsx');
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        let created = 0, updated = 0, skipped = 0;
        const errors = [];

        for (let i = 0; i < rows.length; i++) {
            try {
                const row = rows[i];
                const name = String(row.name || row.Name || row.NAME || '').trim();
                const code = String(row.code || row.Code || row.CODE || '').trim();
                const category = String(row.category || row.Category || row.CATEGORY || 'Other').trim();
                const isReportable = row.isReportable === true || row.isReportable === 'true' || row.isReportable === 'TRUE' || row.isReportable === 'Yes' || row.isReportable === 'YES';
                const reportFrequency = String(row.reportFrequency || row.ReportFrequency || row.REPORT_FREQUENCY || row.report_frequency || '').trim().toUpperCase() || null;

                if (!name || !code) {
                    errors.push({ row: i + 1, error: 'Missing name or code', data: row });
                    skipped++;
                    continue;
                }

                const existing = await prisma.disease.findUnique({ where: { code } });
                if (existing) {
                    await prisma.disease.update({
                        where: { code },
                        data: { name, category, isReportable, reportFrequency }
                    });
                    updated++;
                } else {
                    await prisma.disease.create({
                        data: { name, code, category, isReportable, reportFrequency }
                    });
                    created++;
                }
            } catch (rowErr) {
                errors.push({ row: i + 1, error: rowErr.message, data: rows[i] });
                skipped++;
            }
        }

        res.json({ created, updated, skipped, total: rows.length, errors: errors.length > 0 ? errors : undefined });
    } catch (error) {
        console.error('Error importing diseases:', error);
        res.status(500).json({ error: 'Failed to import diseases' });
    }
};

module.exports = {
    searchDiseases,
    addPatientDiagnosis,
    deletePatientDiagnosis,
    getVisitDiagnoses,
    getDiseaseReport,
    createDisease,
    getAgeGenderDistribution,
    getAllDiseases,
    updateDisease,
    deleteDisease,
    importDiseasesFromExcel
};
