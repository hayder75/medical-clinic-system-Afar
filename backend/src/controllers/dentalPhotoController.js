const prisma = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');


// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/dental-photos';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Upload dental photo
exports.uploadDentalPhoto = async (req, res) => {
  try {
    const doctorId = req.user.id;

    // Handle file upload first
    upload.single('photo')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Now get the form data after multer has processed it
      const { visitId, patientId, photoType, description } = req.body;

      if (!visitId || !patientId || !photoType) {
        // Clean up uploaded file if validation fails
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ error: 'Missing required fields: visitId, patientId, photoType' });
      }

      if (!['BEFORE', 'AFTER'].includes(photoType)) {
        // Clean up uploaded file if validation fails
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ error: 'photoType must be either BEFORE or AFTER' });
      }

      try {
        // Verify the visit exists and doctor has access
        const visit = await prisma.visit.findUnique({
          where: { id: parseInt(visitId) },
          include: {
            patient: true
          }
        });

        if (!visit) {
          // Clean up uploaded file if visit not found
          if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(404).json({ error: 'Visit not found' });
        }

        if (visit.patientId !== patientId) {
          // Clean up uploaded file if patient ID mismatch
          if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(400).json({ error: 'Patient ID does not match visit' });
        }

        // Check if doctor is assigned to this visit
        const assignment = await prisma.assignment.findFirst({
          where: {
            patientId: patientId,
            doctorId: doctorId,
            status: { in: ['Active', 'Pending'] }
          }
        });

        if (!assignment) {
          // Clean up uploaded file if doctor not assigned
          if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(403).json({ error: 'You are not assigned to this patient' });
        }

        // Create dental photo record
        const dentalPhoto = await prisma.dentalPhoto.create({
          data: {
            visitId: parseInt(visitId),
            patientId: patientId,
            doctorId: doctorId,
            photoType: photoType,
            filePath: req.file.path,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            description: description || null,
            uploadedBy: doctorId
          },
          include: {
            visit: {
              select: {
                visitUid: true,
                status: true
              }
            },
            patient: {
              select: {
                name: true,
                id: true
              }
            },
            doctor: {
              select: {
                fullname: true,
                username: true
              }
            }
          }
        });

        // Create audit log
        await prisma.auditLog.create({
          data: {
            userId: doctorId,
            action: 'UPLOAD_DENTAL_PHOTO',
            entity: 'DentalPhoto',
            entityId: parseInt(visitId), // Use visit ID as entityId since it's an Int
            details: JSON.stringify({
              visitId: parseInt(visitId),
              patientId: patientId,
              photoType: photoType,
              fileName: req.file.originalname,
              fileSize: req.file.size,
              dentalPhotoId: dentalPhoto.id // Store the actual UUID here
            }),
            ip: req.ip,
            userAgent: req.get('User-Agent')
          }
        });

        res.json({
          message: 'Dental photo uploaded successfully',
          photo: {
            id: dentalPhoto.id,
            photoType: dentalPhoto.photoType,
            fileName: dentalPhoto.fileName,
            filePath: dentalPhoto.filePath.replace(/^.*\/uploads\//, 'uploads/'),
            description: dentalPhoto.description,
            uploadedAt: dentalPhoto.uploadedAt,
            visit: dentalPhoto.visit,
            patient: dentalPhoto.patient,
            doctor: dentalPhoto.doctor
          }
        });

      } catch (dbError) {
        // Clean up uploaded file if database operation fails
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        console.error('Database error:', dbError);
        res.status(500).json({ error: dbError.message });
      }
    });

  } catch (error) {
    console.error('Error uploading dental photo:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get dental photos for a visit
exports.getDentalPhotos = async (req, res) => {
  try {
    const { visitId } = req.params;
    const doctorId = req.user.id;

    // Verify the visit exists and doctor has access
    const visit = await prisma.visit.findUnique({
      where: { id: parseInt(visitId) },
      include: {
        patient: true
      }
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Check if doctor is assigned to this patient
    const assignment = await prisma.assignment.findFirst({
      where: {
        patientId: visit.patientId,
        doctorId: doctorId,
        status: { in: ['Active', 'Pending'] }
      }
    });

    if (!assignment) {
      return res.status(403).json({ error: 'You are not assigned to this patient' });
    }

    // Get dental photos for this visit
    const photos = await prisma.dentalPhoto.findMany({
      where: {
        visitId: parseInt(visitId)
      },
      include: {
        doctor: {
          select: {
            fullname: true,
            username: true
          }
        }
      },
      orderBy: {
        uploadedAt: 'asc'
      }
    });

    // Group photos by type
    const beforePhotos = photos.filter(photo => photo.photoType === 'BEFORE');
    const afterPhotos = photos.filter(photo => photo.photoType === 'AFTER');

    console.log('🔍 Raw photo filePath examples:', beforePhotos.slice(0, 2).map(p => p.filePath));
    console.log('🔍 After regex replacement:', beforePhotos.slice(0, 2).map(p => p.filePath.replace(/^.*\/uploads\//, 'uploads/')));

    res.json({
      visitId: parseInt(visitId),
      patient: {
        id: visit.patient.id,
        name: visit.patient.name
      },
      beforePhotos: beforePhotos.map(photo => ({
        id: photo.id,
        fileName: photo.fileName,
        filePath: photo.filePath.replace(/^.*\/uploads\//, 'uploads/'),
        description: photo.description,
        uploadedAt: photo.uploadedAt,
        uploadedBy: photo.doctor.fullname
      })),
      afterPhotos: afterPhotos.map(photo => ({
        id: photo.id,
        fileName: photo.fileName,
        filePath: photo.filePath.replace(/^.*\/uploads\//, 'uploads/'),
        description: photo.description,
        uploadedAt: photo.uploadedAt,
        uploadedBy: photo.doctor.fullname
      }))
    });

  } catch (error) {
    console.error('Error fetching dental photos:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete dental photo
exports.deleteDentalPhoto = async (req, res) => {
  try {
    const { photoId } = req.params;
    const doctorId = req.user.id;

    // Find the photo
    const photo = await prisma.dentalPhoto.findUnique({
      where: { id: photoId },
      include: {
        visit: {
          include: {
            patient: true
          }
        }
      }
    });

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Check if doctor has permission to delete this photo
    if (photo.doctorId !== doctorId) {
      return res.status(403).json({ error: 'You can only delete your own photos' });
    }

    // Delete the file from filesystem
    if (fs.existsSync(photo.filePath)) {
      fs.unlinkSync(photo.filePath);
    }

    // Delete the database record
    await prisma.dentalPhoto.delete({
      where: { id: photoId }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: doctorId,
        action: 'DELETE_DENTAL_PHOTO',
        entity: 'DentalPhoto',
        entityId: photo.visitId, // Use visit ID as entityId since it's an Int
        details: JSON.stringify({
          fileName: photo.fileName,
          photoType: photo.photoType,
          visitId: photo.visitId,
          patientId: photo.patientId,
          dentalPhotoId: photoId // Store the actual UUID here
        }),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({ message: 'Dental photo deleted successfully' });

  } catch (error) {
    console.error('Error deleting dental photo:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get multer upload middleware for use in routes
exports.uploadMiddleware = upload;
