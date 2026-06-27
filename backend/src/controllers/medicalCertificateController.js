const prisma = require('../config/database');
const { z } = require('zod');
const PdfPrinter = require('pdfmake');
const fs = require('fs');
const { getDefaultClinicName } = require('../utils/pdfGenerator');

const fonts = {
  Roboto: {
    normal: 'node_modules/roboto-font/fonts/Roboto/roboto-regular-webfont.ttf',
    bold: 'node_modules/roboto-font/fonts/Roboto/roboto-bold-webfont.ttf',
  },
};

const printer = new PdfPrinter(fonts);

// Validation schemas
const createCertificateSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  visitId: z.number().int().optional(),
  certificateDate: z.string().optional().nullable().or(z.literal('')),
  restStartDate: z.string().optional().nullable().or(z.literal('')),
  restEndDate: z.string().optional().nullable().or(z.literal('')),
  appointmentDate: z.string().optional().nullable().or(z.literal('')),
  diagnosis: z.string().min(1, 'Diagnosis is required'),
  treatment: z.string().optional(),
  recommendations: z.string().optional(),
});

const updateCertificateSchema = z.object({
  certificateDate: z.string().optional().nullable().or(z.literal('')),
  restStartDate: z.string().optional().nullable().or(z.literal('')),
  restEndDate: z.string().optional().nullable().or(z.literal('')),
  appointmentDate: z.string().optional().nullable().or(z.literal('')),
  diagnosis: z.string().optional(),
  treatment: z.string().optional(),
  recommendations: z.string().optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED']).optional(),
});

// Generate certificate number to match the image format (MC-000019)
const generateCertificateNumber = async () => {
  // Find the last certificate to get the next sequence number
  const lastCertificate = await prisma.medicalCertificate.findFirst({
    orderBy: {
      certificateNo: 'desc'
    }
  });

  let sequence = 1;
  if (lastCertificate) {
    // Extract sequence number from format MC-000019
    const match = lastCertificate.certificateNo.match(/MC-(\d+)/);
    if (match) {
      sequence = parseInt(match[1]) + 1;
    }
  }

  return `MC-${String(sequence).padStart(6, '0')}`;
};

// Calculate total days between dates
const calculateTotalDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
};

// Create a new medical certificate
exports.createCertificate = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const validatedData = createCertificateSchema.parse(req.body);

    // Validate date range
    let startDate = null;
    let endDate = null;
    let totalDays = null;

    if (validatedData.restStartDate && validatedData.restEndDate) {
      startDate = new Date(validatedData.restStartDate);
      endDate = new Date(validatedData.restEndDate);

      if (endDate <= startDate) {
        return res.status(400).json({
          error: 'Rest end date must be after start date'
        });
      }
      totalDays = calculateTotalDays(startDate, endDate);
    }

    // Check if patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: validatedData.patientId }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Generate certificate number
    const certificateNo = await generateCertificateNumber();

    // Create certificate
    const certificate = await prisma.medicalCertificate.create({
      data: {
        certificateNo,
        patientId: validatedData.patientId,
        doctorId,
        visitId: validatedData.visitId,
        certificateDate: validatedData.certificateDate ? new Date(validatedData.certificateDate) : new Date(),
        restStartDate: startDate,
        restEndDate: endDate,
        totalDays,
        appointmentDate: validatedData.appointmentDate ? new Date(validatedData.appointmentDate) : null,
        diagnosis: validatedData.diagnosis,
        treatment: validatedData.treatment,
        recommendations: validatedData.recommendations,
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            dob: true,
            gender: true,
          }
        },
        doctor: {
          select: {
            id: true,
            fullname: true,
            qualifications: true,
          }
        },
        visit: {
          select: {
            id: true,
            visitUid: true,
          }
        }
      }
    });

    res.json({
      message: 'Medical certificate created successfully',
      certificate
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
    console.error('Error creating medical certificate:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get all medical certificates with search and pagination
exports.getCertificates = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      doctorId = '',
      patientId = ''
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause
    const where = {};

    if (search) {
      where.OR = [
        { certificateNo: { contains: search, mode: 'insensitive' } },
        { patient: { name: { contains: search, mode: 'insensitive' } } },
        { diagnosis: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (status) {
      where.status = status;
    }

    if (doctorId) {
      where.doctorId = doctorId;
    }

    if (patientId) {
      where.patientId = patientId;
    }

    const [certificates, total] = await Promise.all([
      prisma.medicalCertificate.findMany({
        where,
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              dob: true,
              gender: true,
            }
          },
          doctor: {
            select: {
              id: true,
              fullname: true,
              qualifications: true,
            }
          },
          visit: {
            select: {
              id: true,
              visitUid: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.medicalCertificate.count({ where })
    ]);

    res.json({
      certificates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching medical certificates:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get a specific medical certificate
exports.getCertificate = async (req, res) => {
  try {
    const { id } = req.params;

    const certificate = await prisma.medicalCertificate.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            dob: true,
            gender: true,
            mobile: true,
            email: true,
            address: true,
          }
        },
        doctor: {
          select: {
            id: true,
            fullname: true,
            qualifications: true,
            email: true,
            phone: true,
          }
        },
        visit: {
          select: {
            id: true,
            visitUid: true,
            createdAt: true,
          }
        }
      }
    });

    if (!certificate) {
      return res.status(404).json({ error: 'Medical certificate not found' });
    }

    res.json({ certificate });
  } catch (error) {
    console.error('Error fetching medical certificate:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update a medical certificate
exports.updateCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = updateCertificateSchema.parse(req.body);

    // Check if certificate exists
    const existingCertificate = await prisma.medicalCertificate.findUnique({
      where: { id }
    });

    if (!existingCertificate) {
      return res.status(404).json({ error: 'Medical certificate not found' });
    }

    // Validate date range if dates are being updated
    if (validatedData.restStartDate && validatedData.restEndDate) {
      const startDate = new Date(validatedData.restStartDate);
      const endDate = new Date(validatedData.restEndDate);

      if (endDate <= startDate) {
        return res.status(400).json({
          error: 'Rest end date must be after start date'
        });
      }

      // Calculate total days
      validatedData.totalDays = calculateTotalDays(validatedData.restStartDate, validatedData.restEndDate);
    }

    // Update certificate
    const certificate = await prisma.medicalCertificate.update({
      where: { id },
      data: {
        ...validatedData,
        certificateDate: validatedData.certificateDate ? new Date(validatedData.certificateDate) : undefined,
        restStartDate: validatedData.restStartDate ? new Date(validatedData.restStartDate) : null,
        restEndDate: validatedData.restEndDate ? new Date(validatedData.restEndDate) : null,
        appointmentDate: validatedData.appointmentDate ? new Date(validatedData.appointmentDate) : null,
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            dob: true,
            gender: true,
          }
        },
        doctor: {
          select: {
            id: true,
            fullname: true,
            qualifications: true,
          }
        },
        visit: {
          select: {
            id: true,
            visitUid: true,
          }
        }
      }
    });

    res.json({
      message: 'Medical certificate updated successfully',
      certificate
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors
      });
    }
    console.error('Error updating medical certificate:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete a medical certificate
exports.deleteCertificate = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if certificate exists
    const certificate = await prisma.medicalCertificate.findUnique({
      where: { id }
    });

    if (!certificate) {
      return res.status(404).json({ error: 'Medical certificate not found' });
    }

    // Delete certificate
    await prisma.medicalCertificate.delete({
      where: { id }
    });

    res.json({ message: 'Medical certificate deleted successfully' });
  } catch (error) {
    console.error('Error deleting medical certificate:', error);
    res.status(500).json({ error: error.message });
  }
};

// Generate PDF for medical certificate
exports.generatePDF = async (req, res) => {
  try {
    const { id } = req.params;

    const certificate = await prisma.medicalCertificate.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            dob: true,
            gender: true,
            mobile: true,
            email: true,
            address: true,
          }
        },
        doctor: {
          select: {
            id: true,
            fullname: true,
            qualifications: true,
            email: true,
            phone: true,
          }
        }
      }
    });

    if (!certificate) {
      return res.status(404).json({ error: 'Medical certificate not found' });
    }

    // Calculate age
    const age = certificate.patient.dob ?
      Math.floor((new Date() - new Date(certificate.patient.dob)) / (365.25 * 24 * 60 * 60 * 1000)) :
      null;

    // Format dates to match the image format (MM/DD/YYYY)
    const formatDate = (date) => {
      const d = new Date(date);
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const year = d.getFullYear();
      return `${month}/${day}/${year}`;
    };

    // PDF document definition - Matching the exact design from the image
    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 50, 40, 50],
      content: [
        // Header Section - Clinic Name
        {
          text: getDefaultClinicName(),
          style: 'clinicName',
          alignment: 'center',
          margin: [0, 0, 0, 5]
        },

        // Doctor Name
        {
          text: `Dr. ${certificate.doctor.fullname}`,
          style: 'doctorName',
          alignment: 'center',
          margin: [0, 0, 0, 3]
        },

        // Horizontal line separator
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, color: '#000' }],
          margin: [0, 0, 0, 20]
        },

        // Certificate Title and Number
        {
          columns: [
            {
              text: 'MEDICAL CERTIFICATE',
              style: 'certificateTitle',
              alignment: 'center'
            },
            {
              text: `Certificate No.: ${certificate.certificateNo}`,
              style: 'certificateNumber',
              alignment: 'right'
            }
          ],
          margin: [0, 0, 0, 15]
        },
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, color: '#000' }],
          margin: [0, 0, 0, 15]
        },

        // Patient Information Section
        {
          text: 'Patient Information',
          style: 'sectionHeader',
          margin: [0, 0, 0, 8]
        },
        {
          columns: [
            {
              text: `Name: ${certificate.patient.name}`,
              style: 'fieldLabel'
            },
            {
              text: `Gender: ${certificate.patient.gender || ''}`,
              style: 'fieldLabel'
            },
            {
              text: `Age: ${age ? `${age} years` : ''}`,
              style: 'fieldLabel'
            }
          ],
          margin: [0, 0, 0, 15]
        },
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, color: '#000' }],
          margin: [0, 0, 0, 15]
        },

        // Certificate Details Section
        {
          text: 'Certificate Details',
          style: 'sectionHeader',
          margin: [0, 0, 0, 8]
        },
        {
          text: `Date Issued: ${formatDate(certificate.certificateDate)}`,
          style: 'fieldLabel',
          margin: [0, 0, 0, 15]
        },
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, color: '#000' }],
          margin: [0, 0, 0, 15]
        },

        // Medical Information Section
        {
          text: 'Medical Information',
          style: 'sectionHeader',
          margin: [0, 0, 0, 8]
        },
        {
          text: `Diagnosis: ${certificate.diagnosis}`,
          style: 'fieldLabel',
          margin: [0, 0, 0, 8]
        },
        ...(certificate.treatment ? [{
          text: `Treatment: ${certificate.treatment}`,
          style: 'fieldLabel',
          margin: [0, 0, 0, 8]
        }] : []),
        ...(certificate.recommendations ? [{
          text: `Recommendations: ${certificate.recommendations}`,
          style: 'fieldLabel',
          margin: [0, 0, 0, 15]
        }] : [{
          margin: [0, 0, 0, 15]
        }]),
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, color: '#000' }],
          margin: [0, 0, 0, 15]
        },

        // Rest Period Section
        ...(certificate.restStartDate && certificate.restEndDate ? [
          {
            text: 'Rest Period',
            style: 'sectionHeader',
            alignment: 'center',
            margin: [0, 0, 0, 8]
          },
          {
            text: `From ${formatDate(certificate.restStartDate)} to ${formatDate(certificate.restEndDate)}`,
            style: 'restPeriod',
            alignment: 'center',
            margin: [0, 0, 0, 5]
          },
          {
            text: `(Total of ${certificate.totalDays} days)`,
            style: 'restPeriod',
            alignment: 'center',
            margin: [0, 0, 0, 15]
          },
          {
            canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, color: '#000' }],
            margin: [0, 0, 0, 15]
          }
        ] : []),

        // Appointment Section
        ...(certificate.appointmentDate ? [
          {
            text: `The patient has an appointment on ${formatDate(certificate.appointmentDate)}.`,
            style: 'restPeriod',
            alignment: 'left',
            margin: [0, 0, 0, 15]
          },
          {
            canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, color: '#000' }],
            margin: [0, 0, 0, 15]
          }
        ] : []),

        // Issued By Section
        {
          text: 'Issued By',
          style: 'sectionHeader',
          margin: [0, 0, 0, 8]
        },
        {
          columns: [
            {
              text: `Name: ${certificate.doctor.fullname}`,
              style: 'fieldLabel'
            },
            {
              text: `Specialization: ${certificate.doctor.qualifications?.join(', ') || 'General Practitioner'}`,
              style: 'fieldLabel'
            }
          ],
          margin: [0, 0, 0, 20]
        },

        // Signature Section
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 300, y2: 0, lineWidth: 1, color: '#000' }],
          margin: [0, 0, 0, 5]
        },
        {
          columns: [
            {},
            {
              text: "Doctor's Signature",
              style: 'signatureLabel',
              alignment: 'right'
            }
          ],
          margin: [0, 0, 0, 5]
        },
        {
          text: certificate.doctor.fullname,
          style: 'signatureName',
          alignment: 'right'
        }
      ],
      styles: {
        clinicName: {
          fontSize: 18,
          bold: true,
          color: '#000'
        },
        doctorName: {
          fontSize: 14,
          bold: true,
          color: '#000'
        },
        clinicAddress: {
          fontSize: 10,
          color: '#666'
        },
        clinicContact: {
          fontSize: 10,
          color: '#666'
        },
        certificateTitle: {
          fontSize: 18,
          bold: true,
          color: '#000',
          decoration: 'underline'
        },
        certificateNumber: {
          fontSize: 10,
          bold: true,
          color: '#000'
        },
        sectionHeader: {
          fontSize: 12,
          bold: true,
          color: '#000',
          decoration: 'underline'
        },
        fieldLabel: {
          fontSize: 11,
          bold: false,
          color: '#000'
        },
        restPeriod: {
          fontSize: 11,
          color: '#000'
        },
        signatureLabel: {
          fontSize: 10,
          color: '#666'
        },
        signatureName: {
          fontSize: 12,
          bold: true,
          color: '#000'
        }
      }
    };

    // Generate PDF
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const fileName = `medical-certificate-${certificate.certificateNo}-${Date.now()}.pdf`;
    const filePath = `uploads/${fileName}`;

    pdfDoc.pipe(fs.createWriteStream(filePath));
    pdfDoc.end();

    // Wait for PDF to be written
    await new Promise((resolve) => {
      pdfDoc.on('end', resolve);
    });

    res.json({
      message: 'PDF generated successfully',
      fileName,
      filePath: `/uploads/${fileName}`,
      certificate
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: error.message });
  }
};

// Search patients for certificate creation
exports.searchPatients = async (req, res) => {
  try {
    const { query, type = 'name' } = req.query;

    if (!query || query.length < 2) {
      return res.json({ patients: [] });
    }

    const where = {};
    if (type === 'name') {
      where.name = {
        contains: query,
        mode: 'insensitive'
      };
    } else if (type === 'id') {
      where.id = {
        contains: query,
        mode: 'insensitive'
      };
    }

    const patients = await prisma.patient.findMany({
      where,
      select: {
        id: true,
        name: true,
        dob: true,
        gender: true,
        mobile: true,
        email: true,
      },
      take: 10,
      orderBy: { name: 'asc' }
    });

    res.json({ patients });
  } catch (error) {
    console.error('Error searching patients:', error);
    res.status(500).json({ error: error.message });
  }
};
