const prisma = require('../config/database');
const PdfPrinter = require('pdfmake');
const fs = require('fs');

const fonts = {
    Roboto: {
        normal: 'node_modules/roboto-font/fonts/Roboto/roboto-regular-webfont.ttf',
        bold: 'node_modules/roboto-font/fonts/Roboto/roboto-bold-webfont.ttf',
    },
};

const printer = new PdfPrinter(fonts);

const referralController = {
    // Create a new referral
    createReferral: async (req, res) => {
        try {
            const {
                patientId,
                visitId,
                referralReason,
                diagnosis,
                facilityName,
                doctorDetails,
                urgency,
                clinicalHistory,
                physicalExam,
                labInvestigation,
                imaging,
                treatmentGiven,
                region,
                zone,
                woreda,
                kebele
            } = req.body;

            const doctorId = req.user.id; // From auth middleware

            const referral = await prisma.referral.create({
                data: {
                    patientId,
                    visitId: visitId ? parseInt(visitId) : null,
                    doctorId,
                    referralReason,
                    diagnosis,
                    facilityName,
                    doctorDetails,
                    urgency: urgency || 'NORMAL',
                    status: 'PENDING',
                    clinicalHistory,
                    physicalExam,
                    labInvestigation,
                    imaging,
                    treatmentGiven,
                    region,
                    zone,
                    woreda,
                    kebele
                },
                include: {
                    patient: true,
                    doctor: true
                }
            });

            // Update patient address details if provided
            if (region || zone || woreda || kebele) {
                await prisma.patient.update({
                    where: { id: patientId },
                    data: { region, zone, woreda, kebele }
                });
            }

            res.status(201).json({
                success: true,
                message: 'Referral created successfully',
                referral
            });
        } catch (error) {
            console.error('Error creating referral:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create referral',
                error: error.message
            });
        }
    },

    // Update an existing referral
    updateReferral: async (req, res) => {
        try {
            const { id } = req.params;
            const {
                referralReason,
                diagnosis,
                facilityName,
                doctorDetails,
                urgency,
                status,
                clinicalHistory,
                physicalExam,
                labInvestigation,
                imaging,
                treatmentGiven,
                region,
                zone,
                woreda,
                kebele
            } = req.body;

            const referral = await prisma.referral.update({
                where: { id },
                data: {
                    referralReason,
                    diagnosis,
                    facilityName,
                    doctorDetails,
                    urgency,
                    status,
                    clinicalHistory,
                    physicalExam,
                    labInvestigation,
                    imaging,
                    treatmentGiven,
                    region,
                    zone,
                    woreda,
                    kebele
                },
                include: {
                    patient: true,
                    doctor: true
                }
            });

            // Update patient address details if provided
            if (region || zone || woreda || kebele) {
                await prisma.patient.update({
                    where: { id: referral.patientId },
                    data: { region, zone, woreda, kebele }
                });
            }

            res.json({
                success: true,
                message: 'Referral updated successfully',
                referral
            });
        } catch (error) {
            console.error('Error updating referral:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update referral',
                error: error.message
            });
        }
    },

    // Get all referrals (for the logged-in doctor)
    getMyReferrals: async (req, res) => {
        try {
            const doctorId = req.user.id;
            const referrals = await prisma.referral.findMany({
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
                referrals
            });
        } catch (error) {
            console.error('Error fetching referrals:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch referrals'
            });
        }
    },

    // Get referral details
    getReferralById: async (req, res) => {
        try {
            const { id } = req.params;
            const referral = await prisma.referral.findUnique({
                where: { id },
                include: {
                    patient: true,
                    doctor: true,
                    visit: true
                }
            });

            if (!referral) {
                return res.status(404).json({
                    success: false,
                    message: 'Referral not found'
                });
            }

            res.json({
                success: true,
                referral
            });
        } catch (error) {
            console.error('Error fetching referral details:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch referral details'
            });
        }
    },

    // Delete a referral
    deleteReferral: async (req, res) => {
        try {
            const { id } = req.params;
            await prisma.referral.delete({
                where: { id }
            });

            res.json({
                success: true,
                message: 'Referral deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting referral:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete referral'
            });
        }
    },

    // Generate PDF for referral
    generatePDF: async (req, res) => {
        try {
            const { id } = req.params;
            const referral = await prisma.referral.findUnique({
                where: { id },
                include: {
                    patient: true,
                    doctor: true,
                    visit: true
                }
            });

            if (!referral) {
                return res.status(404).json({ success: false, message: 'Referral not found' });
            }

            // Calculate age
            const age = referral.patient.dob ?
                Math.floor((new Date() - new Date(referral.patient.dob)) / (365.25 * 24 * 60 * 60 * 1000)) :
                'N/A';

            const docDefinition = {
                content: [
                    { text: 'CHARITE MEDIUM CLINIC', style: 'header', alignment: 'center' },
                    { text: 'REFERRAL FORM', style: 'subheader', alignment: 'center', margin: [0, 5, 0, 15] },
                    {
                        columns: [
                            { text: `ቀን/Date: ${new Date(referral.createdAt).toLocaleDateString()}`, width: '*' },
                            { text: `Card no: ${referral.patientId}`, width: 'auto' }
                        ],
                        margin: [0, 0, 0, 10]
                    },
                    {
                        text: [
                            { text: 'Patient Name: ', bold: true }, { text: referral.patient.name, decoration: 'underline' },
                            { text: '  Age: ', bold: true }, { text: String(age), decoration: 'underline' },
                            { text: '  Sex: ', bold: true }, { text: referral.patient.gender || '', decoration: 'underline' },
                            { text: '  Address: ', bold: true }, { text: referral.patient.address || '', decoration: 'underline' }
                        ],
                        margin: [0, 0, 0, 5]
                    },
                    {
                        text: [
                            { text: 'Region: ', bold: true }, { text: referral.region || '', decoration: 'underline' },
                            { text: '  Zone: ', bold: true }, { text: referral.zone || '', decoration: 'underline' },
                            { text: '  Woreda: ', bold: true }, { text: referral.woreda || '', decoration: 'underline' },
                            { text: '  Kebele: ', bold: true }, { text: referral.kebele || '', decoration: 'underline' }
                        ],
                        margin: [0, 0, 0, 15]
                    },
                    { text: 'Clinical history:', bold: true, margin: [0, 10, 0, 5] },
                    { text: referral.clinicalHistory || '', margin: [20, 0, 0, 10] },

                    { text: 'Physical Examination:', bold: true, margin: [0, 10, 0, 5] },
                    { text: referral.physicalExam || '', margin: [20, 0, 0, 10] },

                    { text: 'Lab Investigation:', bold: true, margin: [0, 10, 0, 5] },
                    { text: referral.labInvestigation || '', margin: [20, 0, 0, 10] },

                    { text: 'Imaging:', bold: true, margin: [0, 10, 0, 5] },
                    { text: referral.imaging || '', margin: [20, 0, 0, 10] },

                    { text: 'Diagnosis:', bold: true, margin: [0, 10, 0, 5] },
                    { text: referral.diagnosis || '', margin: [20, 0, 0, 10] },

                    { text: 'Treatment given:', bold: true, margin: [0, 10, 0, 5] },
                    { text: referral.treatmentGiven || '', margin: [20, 0, 0, 10] },

                    { text: 'Reason for refer:', bold: true, margin: [0, 10, 0, 5] },
                    { text: referral.referralReason || '', margin: [20, 0, 0, 20] },

                    { text: 'Name of physician & signature:', bold: true, margin: [0, 20, 0, 5] },
                    { text: `Dr. ${referral.doctor.fullname}`, margin: [0, 0, 0, 5] },
                    { text: '_______________________________' }
                ],
                styles: {
                    header: { fontSize: 18, bold: true },
                    subheader: { fontSize: 14, bold: true, decoration: 'underline' }
                },
                defaultStyle: { fontSize: 11, font: 'Roboto' }
            };

            const pdfDoc = printer.createPdfKitDocument(docDefinition);
            const fileName = `referral-${referral.id}.pdf`;
            const filePath = `uploads/${fileName}`;
            pdfDoc.pipe(fs.createWriteStream(filePath));
            pdfDoc.end();

            await new Promise((resolve) => {
                pdfDoc.on('end', resolve);
            });

            res.json({ success: true, filePath: `/uploads/${fileName}` });
        } catch (error) {
            console.error('Error generating referral PDF:', error);
            res.status(500).json({ success: false, message: 'Failed to generate PDF' });
        }
    }
};

module.exports = referralController;
