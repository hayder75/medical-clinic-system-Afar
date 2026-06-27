const prisma = require('../config/database');

const internationalMedicalCertificateController = {
    // Create a new certificate
    createCertificate: async (req, res) => {
        try {
            const {
                patientId,
                visitId,
                certificateNo,
                passportNo,
                hasPreviousDisease,
                previousDiseaseDetails,
                hasCurrentMedicalComplains,
                currentMedicalComplainsDetails,
                height,
                weight,
                bp,
                bloodGroup,
                heent,
                chest,
                cvs,
                abdomen,
                cns,
                chestXRay,
                hiv,
                hbsag,
                vdrl,
                hcv,
                hcg,
                fbsRbs,
                finalAssessment,
                directoryName
            } = req.body;

            const doctorId = req.user.id;

            // Generate Ref No if not provided
            let finalCertificateNo = certificateNo;
            if (!finalCertificateNo) {
                const count = await prisma.internationalMedicalCertificate.count();
                finalCertificateNo = `IMC-${String(count + 1).padStart(5, '0')}`;
            }

            const certificate = await prisma.internationalMedicalCertificate.create({
                data: {
                    patientId,
                    visitId: visitId ? parseInt(visitId) : null,
                    doctorId,
                    certificateNo: finalCertificateNo,
                    passportNo,
                    hasPreviousDisease: !!hasPreviousDisease,
                    previousDiseaseDetails,
                    hasCurrentMedicalComplains: !!hasCurrentMedicalComplains,
                    currentMedicalComplainsDetails,
                    height,
                    weight,
                    bp,
                    bloodGroup,
                    heent: heent || 'Normal',
                    chest: chest || 'Normal',
                    cvs: cvs || 'Normal',
                    abdomen: abdomen || 'Normal',
                    cns: cns || 'Normal',
                    chestXRay: chestXRay || 'Normal',
                    hiv: hiv || 'Negative',
                    hbsag: hbsag || 'Negative',
                    vdrl: vdrl || 'Negative',
                    hcv: hcv || 'Negative',
                    hcg: hcg || 'Negative',
                    fbsRbs: fbsRbs || 'Negative',
                    finalAssessment: finalAssessment || 'FIT',
                    directoryName
                },
                include: {
                    patient: true,
                    doctor: true
                }
            });

            res.status(201).json({
                success: true,
                message: 'Certificate created successfully',
                certificate
            });
        } catch (error) {
            console.error('Error creating certificate:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create certificate',
                error: error.message
            });
        }
    },

    // Update an existing certificate
    updateCertificate: async (req, res) => {
        try {
            const { id } = req.params;
            const {
                passportNo,
                hasPreviousDisease,
                previousDiseaseDetails,
                hasCurrentMedicalComplains,
                currentMedicalComplainsDetails,
                height,
                weight,
                bp,
                bloodGroup,
                heent,
                chest,
                cvs,
                abdomen,
                cns,
                chestXRay,
                hiv,
                hbsag,
                vdrl,
                hcv,
                hcg,
                fbsRbs,
                finalAssessment,
                directoryName
            } = req.body;

            const certificate = await prisma.internationalMedicalCertificate.update({
                where: { id },
                data: {
                    passportNo,
                    hasPreviousDisease: !!hasPreviousDisease,
                    previousDiseaseDetails,
                    hasCurrentMedicalComplains: !!hasCurrentMedicalComplains,
                    currentMedicalComplainsDetails,
                    height,
                    weight,
                    bp,
                    bloodGroup,
                    heent,
                    chest,
                    cvs,
                    abdomen,
                    cns,
                    chestXRay,
                    hiv,
                    hbsag,
                    vdrl,
                    hcv,
                    hcg,
                    fbsRbs,
                    finalAssessment,
                    directoryName
                },
                include: {
                    patient: true,
                    doctor: true
                }
            });

            res.json({
                success: true,
                message: 'Certificate updated successfully',
                certificate
            });
        } catch (error) {
            console.error('Error updating certificate:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update certificate',
                error: error.message
            });
        }
    },

    // Get all certificates (for the logged-in doctor)
    getMyCertificates: async (req, res) => {
        try {
            const doctorId = req.user.id;
            const certificates = await prisma.internationalMedicalCertificate.findMany({
                where: { doctorId },
                include: {
                    patient: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

            res.json({
                success: true,
                certificates
            });
        } catch (error) {
            console.error('Error fetching certificates:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch certificates'
            });
        }
    },

    // Get certificate details
    getCertificateById: async (req, res) => {
        try {
            const { id } = req.params;
            const certificate = await prisma.internationalMedicalCertificate.findUnique({
                where: { id },
                include: {
                    patient: true,
                    doctor: true,
                    visit: true
                }
            });

            if (!certificate) {
                return res.status(404).json({
                    success: false,
                    message: 'Certificate not found'
                });
            }

            res.json({
                success: true,
                certificate
            });
        } catch (error) {
            console.error('Error fetching certificate details:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch certificate details'
            });
        }
    },

    // Delete a certificate
    deleteCertificate: async (req, res) => {
        try {
            const { id } = req.params;
            await prisma.internationalMedicalCertificate.delete({
                where: { id }
            });

            res.json({
                success: true,
                message: 'Certificate deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting certificate:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete certificate'
            });
        }
    }
};

module.exports = internationalMedicalCertificateController;
