const prisma = require('../config/database');
const { z } = require('zod');
const path = require('path');
const fs = require('fs').promises;



// Validation schemas
const uploadImageSchema = z.object({
  patientId: z.string(),
  visitId: z.number().int().positive(),
  imageType: z.enum(['BEFORE', 'AFTER', 'OTHER']),
  description: z.string().optional().nullable(),
});

/**
 * Upload a gallery image for a patient visit
 * @route POST /api/gallery/upload
 * @access NURSE, RECEPTIONIST, ADMIN
 */
exports.uploadImage = async (req, res) => {
  try {
    console.log('📸 Gallery upload request:', {
      body: req.body,
      file: req.file ? { name: req.file.filename, size: req.file.size } : null
    });

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    // Parse visitId
    const visitId = parseInt(req.body.visitId);
    if (isNaN(visitId)) {
      await fs.unlink(req.file.path).catch(() => { });
      return res.status(400).json({ error: 'Invalid visit ID' });
    }

    // Validate request body
    const validatedData = uploadImageSchema.parse({
      patientId: req.body.patientId,
      visitId: visitId,
      imageType: req.body.imageType,
      description: req.body.description || null,
    });

    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: validatedData.patientId },
    });

    if (!patient) {
      // Delete uploaded file if patient not found
      await fs.unlink(req.file.path).catch(() => { });
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Verify visit exists and belongs to patient
    const visit = await prisma.visit.findFirst({
      where: {
        id: validatedData.visitId,
        patientId: validatedData.patientId,
      },
    });

    if (!visit) {
      // Delete uploaded file if visit not found
      await fs.unlink(req.file.path).catch(() => { });
      return res.status(404).json({ error: 'Visit not found or does not belong to this patient' });
    }

    // Create gallery entry
    // Store relative path instead of absolute path for serving via Express static
    const relativePath = req.file.path.replace(/\\/g, '/').split('/uploads/').pop();
    const finalFilePath = 'uploads/' + relativePath;

    const galleryImage = await prisma.patientGallery.create({
      data: {
        patientId: validatedData.patientId,
        visitId: validatedData.visitId,
        imageType: validatedData.imageType,
        filePath: finalFilePath,
        description: validatedData.description,
        uploadedById: req.user.id,
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
        visit: {
          select: {
            id: true,
            visitUid: true,
            date: true,
          },
        },
        uploadedBy: {
          select: {
            id: true,
            fullname: true,
            role: true,
          },
        },
      },
    });

    res.status(201).json({
      message: 'Image uploaded successfully',
      image: galleryImage,
    });
  } catch (error) {
    console.error('❌ Error uploading gallery image:', error);

    // Delete uploaded file on error
    if (req.file && req.file.path) {
      await fs.unlink(req.file.path).catch(() => { });
    }

    if (error instanceof z.ZodError) {
      console.error('Validation errors:', error.errors);
      const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return res.status(400).json({
        error: 'Invalid input',
        details: error.errors,
        message: errorMessages
      });
    }
    res.status(500).json({ error: 'Failed to upload image', message: error.message });
  }
};

/**
 * Get all gallery images for a specific visit
 * @route GET /api/gallery/visit/:visitId
 * @access NURSE, RECEPTIONIST, DOCTOR, ADMIN
 */
exports.getVisitImages = async (req, res) => {
  try {
    const visitId = parseInt(req.params.visitId);

    if (isNaN(visitId)) {
      return res.status(400).json({ error: 'Invalid visit ID' });
    }

    // Verify visit exists
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Get all gallery images for this visit
    const images = await prisma.patientGallery.findMany({
      where: { visitId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            fullname: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Normalize image paths
    const normalizePath = (filePath) => {
      if (!filePath) return filePath;
      const normalized = filePath.replace(/\\/g, '/');
      if (normalized.includes('/uploads/')) {
        return 'uploads/' + normalized.split('/uploads/').pop();
      }
      return normalized;
    };

    const normalizedImages = images.map(img => ({
      ...img,
      filePath: normalizePath(img.filePath)
    }));

    res.json({
      visit: {
        id: visit.id,
        visitUid: visit.visitUid,
        date: visit.date,
        patient: visit.patient,
      },
      images: normalizedImages,
    });
  } catch (error) {
    console.error('Error fetching visit gallery images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
};

/**
 * Get all gallery images for a specific patient (all visits)
 * @route GET /api/gallery/patient/:patientId
 * @access NURSE, RECEPTIONIST, DOCTOR, ADMIN
 */
exports.getPatientImages = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Get all gallery images for this patient
    const images = await prisma.patientGallery.findMany({
      where: { patientId },
      include: {
        visit: {
          select: {
            id: true,
            visitUid: true,
            date: true,
          },
        },
        uploadedBy: {
          select: {
            id: true,
            fullname: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Normalize image paths
    const normalizePath = (filePath) => {
      if (!filePath) return filePath;
      const normalized = filePath.replace(/\\/g, '/');
      if (normalized.includes('/uploads/')) {
        return 'uploads/' + normalized.split('/uploads/').pop();
      }
      return normalized;
    };

    const normalizedImages = images.map(img => ({
      ...img,
      filePath: normalizePath(img.filePath)
    }));

    res.json({
      patient: {
        id: patient.id,
        name: patient.name,
      },
      images: normalizedImages,
    });
  } catch (error) {
    console.error('Error fetching patient gallery images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
};

/**
 * Delete a gallery image
 * @route DELETE /api/gallery/:imageId
 * @access NURSE, RECEPTIONIST, ADMIN
 */
exports.deleteImage = async (req, res) => {
  try {
    const { imageId } = req.params;

    // Find the image
    const image = await prisma.patientGallery.findUnique({
      where: { id: imageId },
    });

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Check if user has permission to delete (only uploader or admin)
    if (image.uploadedById !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized to delete this image' });
    }

    // Delete the image from database
    await prisma.patientGallery.delete({
      where: { id: imageId },
    });

    // Delete the physical file
    await fs.unlink(image.filePath).catch((err) => {
      console.error('Error deleting physical file:', err);
      // Continue even if file deletion fails
    });

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting gallery image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
};

