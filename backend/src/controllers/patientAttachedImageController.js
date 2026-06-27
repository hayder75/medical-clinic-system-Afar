const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../config/database');



// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/patient-attached-images');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common image formats and PDFs
    const allowedTypes = /jpeg|jpg|png|gif|pdf|dcm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'application/pdf' || file.mimetype === 'application/dicom';

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF) and PDF files are allowed'));
    }
  }
});

// Upload patient attached image
exports.uploadPatientAttachedImage = async (req, res) => {
  try {
    const billingOfficerId = req.user.id;

    // Handle file upload first
    upload.single('image')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Now get the form data after multer has processed it
      const { visitId, patientId, description } = req.body;

      if (!visitId || !patientId) {
        // Clean up uploaded file if validation fails
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ error: 'Missing required fields: visitId, patientId' });
      }

      // Verify visit exists and belongs to patient
      const visit = await prisma.visit.findFirst({
        where: {
          id: parseInt(visitId),
          patientId: patientId
        },
        include: {
          patient: true
        }
      });

      if (!visit) {
        // Clean up uploaded file
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(404).json({ error: 'Visit not found or does not belong to patient' });
      }

      // Create database record
      // Store relative path (uploads/...) in database instead of absolute path
      const relativePath = req.file.path.replace(/\\/g, '/').split('/uploads/').pop();
      const finalFilePath = 'uploads/' + relativePath;

      const attachedImage = await prisma.patientAttachedImage.create({
        data: {
          visitId: parseInt(visitId),
          patientId: patientId,
          doctorId: null, // Will be set when doctor is assigned
          fileName: req.file.originalname,
          filePath: finalFilePath,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          description: description || null,
          uploadedBy: billingOfficerId
        },
        include: {
          visit: {
            select: {
              id: true,
              visitUid: true,
              status: true
            }
          },
          patient: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: billingOfficerId,
          action: 'UPLOAD_PATIENT_ATTACHED_IMAGE',
          entity: 'PatientAttachedImage',
          entityId: attachedImage.visitId, // Use visit ID as entityId since it's an Int
          details: JSON.stringify({
            fileName: attachedImage.fileName,
            description: attachedImage.description,
            visitId: attachedImage.visitId,
            patientId: attachedImage.patientId,
            attachedImageId: attachedImage.id // Store the actual UUID here
          }),
          ip: req.ip,
          userAgent: req.get('User-Agent')
        }
      });

      res.json({
        message: 'Patient attached image uploaded successfully',
        attachedImage: {
          id: attachedImage.id,
          fileName: attachedImage.fileName,
          filePath: attachedImage.filePath.replace(/^.*\/uploads\//, 'uploads/'),
          fileSize: attachedImage.fileSize,
          mimeType: attachedImage.mimeType,
          description: attachedImage.description,
          uploadedAt: attachedImage.uploadedAt,
          visit: attachedImage.visit,
          patient: attachedImage.patient
        }
      });
    });
  } catch (error) {
    console.error('Error uploading patient attached image:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get patient attached images for a visit
exports.getPatientAttachedImages = async (req, res) => {
  try {
    const { visitId } = req.params;

    const visit = await prisma.visit.findUnique({
      where: { id: parseInt(visitId) },
      include: {
        patient: {
          select: {
            id: true,
            name: true
          }
        },
        attachedImages: {
          orderBy: {
            uploadedAt: 'desc'
          }
        }
      }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    res.json({
      visitId: parseInt(visitId),
      patient: {
        id: visit.patient.id,
        name: visit.patient.name
      },
      attachedImages: visit.attachedImages.map(image => ({
        id: image.id,
        fileName: image.fileName,
        filePath: image.filePath.replace(/^.*\/uploads\//, 'uploads/'),
        fileSize: image.fileSize,
        mimeType: image.mimeType,
        description: image.description,
        uploadedAt: image.uploadedAt,
        uploadedBy: image.uploadedBy
      }))
    });
  } catch (error) {
    console.error('Error fetching patient attached images:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete patient attached image
exports.deletePatientAttachedImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    const billingOfficerId = req.user.id;

    // Find the image
    const image = await prisma.patientAttachedImage.findUnique({
      where: { id: imageId },
      include: {
        visit: {
          select: {
            id: true,
            visitUid: true
          }
        },
        patient: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!image) {
      return res.status(404).json({ error: 'Attached image not found' });
    }

    // Delete file from filesystem
    if (fs.existsSync(image.filePath)) {
      fs.unlinkSync(image.filePath);
    }

    // Delete from database
    await prisma.patientAttachedImage.delete({
      where: { id: imageId }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: billingOfficerId,
        action: 'DELETE_PATIENT_ATTACHED_IMAGE',
        entity: 'PatientAttachedImage',
        entityId: image.visitId, // Use visit ID as entityId since it's an Int
        details: JSON.stringify({
          fileName: image.fileName,
          description: image.description,
          visitId: image.visitId,
          patientId: image.patientId,
          attachedImageId: imageId // Store the actual UUID here
        }),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({
      message: 'Patient attached image deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting patient attached image:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  uploadPatientAttachedImage: exports.uploadPatientAttachedImage,
  getPatientAttachedImages: exports.getPatientAttachedImages,
  deletePatientAttachedImage: exports.deletePatientAttachedImage
};
