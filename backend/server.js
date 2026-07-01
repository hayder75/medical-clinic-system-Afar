// Load environment variables first
require('dotenv').config();

const express = require('express');
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const morgan = require('morgan');
const multer = require('multer');
const pdfmake = require('pdfmake');
const cron = require('node-cron');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const zod = require('zod');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initSocket } = require('./src/config/socket');

// Routes
const authRoutes = require('./src/routes/auth');
const patientsRoutes = require('./src/routes/patients');
const visitsRoutes = require('./src/routes/visits');
const billingRoutes = require('./src/routes/billing');
const doctorsRoutes = require('./src/routes/doctors');
const nursesRoutes = require('./src/routes/nurses');
const radiologiesRoutes = require('./src/routes/radiologies');
const labsRoutes = require('./src/routes/labs');
const pharmaciesRoutes = require('./src/routes/pharmacies');
const warehouseRoutes = require('./src/routes/warehouse');
const suppliersRoutes = require('./src/routes/suppliers');
const purchaseOrdersRoutes = require('./src/routes/purchaseOrders');
const batchOrdersRoutes = require('./src/routes/batchOrders');
const pharmacyBillingRoutes = require('./src/routes/pharmacyBilling');
const medicationRoutes = require('./src/routes/medications');
const adminRoutes = require('./src/routes/admin');
const schedulesRoutes = require('./src/routes/schedules');
const walkInSalesRoutes = require('./src/routes/walkInSales');
const dentalRoutes = require('./src/routes/dental');
const dentalPhotosRoutes = require('./src/routes/dentalPhotos');
const patientAttachedImagesRoutes = require('./src/routes/patientAttachedImages');
const virtualQueueRoutes = require('./src/routes/virtualQueue');
const medicalCertificatesRoutes = require('./src/routes/medicalCertificates');
const continuousInfusionsRoutes = require('./src/routes/continuousInfusions');
const receptionRoutes = require('./src/routes/reception');
const emergencyBillingRoutes = require('./src/routes/emergencyBilling');
const emergencyRoutes = require('./src/routes/emergency');
const cashManagementRoutes = require('./src/routes/cashManagement');
const galleryRoutes = require('./src/routes/gallery');
const appointmentsRoutes = require('./src/routes/appointments');
const insuranceRoutes = require('./src/routes/insurance');
const loansRoutes = require('./src/routes/loans');
const accountsRoutes = require('./src/routes/accounts');
const walkInOrdersRoutes = require('./src/routes/walkInOrders');
const referralsRoutes = require('./src/routes/referrals');
const internationalMedicalCertificatesRoutes = require('./src/routes/internationalMedicalCertificates');
const diseasesRoutes = require('./src/routes/diseases');
const accommodationRoutes = require('./src/routes/accommodation');
const compoundPrescriptionRoutes = require('./src/routes/compoundPrescriptions');
const specialtyRoutes = require('./src/routes/specialty');
const familyPlanningRoutes = require('./src/routes/familyPlanning');
const abortionCareRoutes = require('./src/routes/abortionCare');
const pathologyRoutes = require('./src/routes/pathology');

// Middleware
const authMiddleware = require('./src/middleware/auth');
const roleGuard = require('./src/middleware/roleGuard');
const fileUpload = require('./src/middleware/fileUpload');
const logger = require('./src/middleware/logger');

const app = express();

// Singleton Prisma client
const prisma = require('./src/config/database');

// Auto-seed built-in templates (lab tests, radiology, teeth) on startup if empty
const { seedAll } = require('./src/utils/seedTemplates');

// Handle connection cleanup on shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// CORS configuration - allow all origins
app.use(cors({
  origin: true, // Allow all origins (since we're behind Nginx proxy or dev)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Explicitly handle OPTIONS requests for all routes
app.options('*', cors());

// Serve uploads folder with absolute path (BEFORE Helmet to avoid COEP/CORP issues, AFTER CORS)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Use Helmet for security headers but relax CSP for development
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "*"], // Allow images from anywhere
      connectSrc: ["'self'", "*"] // Allow connection to any host
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false // Allow cross-origin resource sharing (fixes image loading from different ports)
}));

// CORS configuration now moved up
app.use(morgan('dev')); // Enabled for debugging
app.use(express.json({ limit: "50mb" }));
// Serve uploads folder line removed from here

// Serve static frontend files if dist folder exists (for compiled deployment)
const frontendDistPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  // Frontend static files enabled
}

// Middleware to populate req.ip
app.use((req, res, next) => {
  req.ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
    req.headers['x-forwarded-for'] || '127.0.0.1';
  next();
});

app.use(logger);  // Audit middleware

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again after a minute' }
});

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many search requests, please slow down' }
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  let dbStatus = 'unknown';
  let dbError = null;

  // Try to ping database without disconnecting
  try {
    await prisma.$executeRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = 'disconnected';
    dbError = error.message;
  }

  // Always return 200 OK - service is live, database may be sleeping
  res.status(200).json({
    status: dbStatus === 'connected' ? 'OK' : 'STARTING',
    database: dbStatus,
    error: dbError,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth', authRoutes);

// General rate limiter for all other API routes
app.use('/api', generalLimiter);
app.use('/api/patients', authMiddleware, patientsRoutes);
app.use('/api/visits', authMiddleware, visitsRoutes);
app.use('/api/billing', authMiddleware, roleGuard(['BILLING_OFFICER', 'PHARMACY_BILLING_OFFICER', 'PHARMACIST', 'RECEPTIONIST', 'NURSE', 'ADMIN']), billingRoutes);
app.use('/api/doctors', authMiddleware, roleGuard(['DOCTOR', 'HEALTH_OFFICER', 'DERMATOLOGY', 'ADMIN', 'BILLING_OFFICER', 'NURSE', 'RECEPTIONIST', 'LAB_TECHNICIAN', 'RADIOLOGIST']), doctorsRoutes);
app.use('/api/nurses', authMiddleware, roleGuard(['NURSE', 'ADMIN', 'DOCTOR']), nursesRoutes);
app.use('/api/radiologies', authMiddleware, roleGuard(['RADIOLOGIST', 'RADIOLOGY_TECHNICIAN', 'DOCTOR', 'ADMIN', 'LAB_TECHNICIAN', 'BILLING_OFFICER']), radiologiesRoutes);
app.use('/api/labs', authMiddleware, roleGuard(['LAB_TECHNICIAN', 'DOCTOR', 'ADMIN', 'BILLING_OFFICER']), labsRoutes);
app.use('/api/pharmacies', authMiddleware, roleGuard(['PHARMACY_OFFICER', 'PHARMACIST', 'PHARMACY_BILLING_OFFICER', 'ADMIN']), pharmaciesRoutes);
app.use('/api/batch-orders', batchOrdersRoutes);
app.use('/api/pharmacy-billing', authMiddleware, roleGuard(['PHARMACY_BILLING_OFFICER', 'PHARMACIST', 'ADMIN']), pharmacyBillingRoutes);
app.use('/api/medications', authMiddleware, medicationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/schedules', authMiddleware, schedulesRoutes);
app.use('/api/walk-in-sales', authMiddleware, roleGuard(['PHARMACIST', 'PHARMACY_BILLING_OFFICER', 'PHARMACY_OFFICER', 'ADMIN']), walkInSalesRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/purchase-orders', purchaseOrdersRoutes);
app.use('/api/dental', dentalRoutes);
app.use('/api/dental-photos', authMiddleware, roleGuard(['DOCTOR', 'ADMIN']), dentalPhotosRoutes);
app.use('/api/patient-attached-images', authMiddleware, patientAttachedImagesRoutes);
app.use('/api/pre-registration', authMiddleware, roleGuard(['BILLING_OFFICER', 'RECEPTIONIST', 'ADMIN']), virtualQueueRoutes);
app.use('/api/medical-certificates', authMiddleware, roleGuard(['DOCTOR', 'ADMIN']), medicalCertificatesRoutes);
app.use('/api/continuous-infusions', continuousInfusionsRoutes);
app.use('/api/reception', receptionRoutes);
app.use('/api/emergency-billing', authMiddleware, roleGuard(['BILLING_OFFICER', 'ADMIN']), emergencyBillingRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/cash-management', cashManagementRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/appointments', authMiddleware, appointmentsRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/loans', loansRoutes);
app.use('/api/accounts', authMiddleware, accountsRoutes);
app.use('/api/walk-in-orders', authMiddleware, walkInOrdersRoutes);
app.use('/api/referrals', authMiddleware, roleGuard(['DOCTOR', 'ADMIN']), referralsRoutes);
app.use('/api/international-medical-certificates', authMiddleware, roleGuard(['DOCTOR', 'ADMIN']), internationalMedicalCertificatesRoutes);
app.use('/api/diseases', diseasesRoutes);
app.use('/api/accommodation', accommodationRoutes);
app.use('/api/compound-prescriptions', authMiddleware, compoundPrescriptionRoutes);
app.use('/api/specialty', authMiddleware, specialtyRoutes);
app.use('/api/family-planning', familyPlanningRoutes);
app.use('/api/abortion-care', abortionCareRoutes);
app.use('/api/pathology', authMiddleware, roleGuard(['DOCTOR', 'ADMIN', 'LAB_TECHNICIAN', 'NURSE']), pathologyRoutes);

// Serve frontend for all non-API routes (SPA routing)
// This must be after all API routes
if (fs.existsSync(frontendDistPath)) {
  app.get('*', (req, res, next) => {
    // Only serve frontend for non-API routes and non-upload routes
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    } else {
      next();
    }
  });
}

// Cron for inactivity (run daily)
cron.schedule('0 0 * * *', async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await prisma.patient.updateMany({
    where: { updatedAt: { lt: thirtyDaysAgo }, status: 'Active' },
    data: { status: 'Inactive' },
  });
  // Inactivity cron ran
});

// Automatic card deactivation function
async function deactivateExpiredCards() {
  try {
    const now = new Date();

    // Find all active cards that have passed their expiry date
    const expiredCards = await prisma.patient.findMany({
      where: {
        cardStatus: 'ACTIVE',
        cardExpiryDate: {
          lt: now // Expiry date is in the past
        }
      },
      select: {
        id: true,
        name: true,
        cardExpiryDate: true
      }
    });

    if (expiredCards.length > 0) {
      // Deactivate expired cards
      const result = await prisma.patient.updateMany({
        where: {
          cardStatus: 'ACTIVE',
          cardExpiryDate: {
            lt: now
          }
        },
        data: {
          cardStatus: 'INACTIVE'
        }
      });

      // Automatically deactivated expired cards

      // Log each deactivation
      for (const card of expiredCards) {
        try {
          await prisma.auditLog.create({
            data: {
              action: 'CARD_AUTO_DEACTIVATED',
              entity: 'Patient',
              entityId: parseInt(card.id.split('-').pop()) || 0,
              userId: null, // System action (userId is nullable and 'system' is not a valid User ID)
              details: `Card automatically deactivated for ${card.name} (${card.id}). Expired on: ${card.cardExpiryDate?.toISOString()}`
            }
          });
        } catch (logError) {
          // Error logging card deactivation - silently continue
        }
      }
    }
  } catch (error) {
    // Error in automatic card deactivation - silently continue
  }
}

// Run card deactivation on server start
deactivateExpiredCards();

// Schedule daily card deactivation check (runs at 2 AM every day)
cron.schedule('0 2 * * *', () => {
  deactivateExpiredCards();
});

// Automatic bed termination for expired admissions
async function terminateExpiredAdmissions() {
  try {
    const now = new Date();
    const expiredAdmissions = await prisma.admission.findMany({
      where: {
        status: 'ADMITTED',
        expectedEndDate: {
          lt: now
        }
      }
    });

    if (expiredAdmissions.length > 0) {
      for (const admission of expiredAdmissions) {
        await prisma.$transaction([
          prisma.admission.update({
            where: { id: admission.id },
            data: {
              status: 'DISCHARGED',
              actualEndDate: now
            }
          }),
          prisma.bed.update({
            where: { id: admission.bedId },
            data: {
              status: 'AVAILABLE'
            }
          })
        ]);
      }
      // Automatically terminated expired admissions
    }
  } catch (error) {
    // Error in automatic bed termination
  }
}

// Run on start
terminateExpiredAdmissions();

// Schedule hourly check for expired admissions
cron.schedule('0 * * * *', () => {
  terminateExpiredAdmissions();
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Cleanup stuck visits (runs hourly)
async function cleanupStuckVisits() {
  try {
    const fourDaysAgo = new Date(Date.now() - 96 * 60 * 60 * 1000);
    const stuckVisits = await prisma.visit.findMany({
      where: {
        status: {
          in: ['AWAITING_LAB_RESULTS', 'AWAITING_RADIOLOGY_RESULTS', 'AWAITING_RESULTS_REVIEW',
                'SENT_TO_LAB', 'SENT_TO_RADIOLOGY', 'SENT_TO_BOTH', 'AWAITING_CARD_BILLING']
        },
        updatedAt: { lt: fourDaysAgo }
      },
      select: { id: true, visitUid: true, status: true }
    });

    for (const visit of stuckVisits) {
      await prisma.visit.update({
        where: { id: visit.id },
        data: {
          notes: `${visit.notes || ''}\n[AUTO] Visit auto-completed after 4d inactivity (was: ${visit.status})`.trim(),
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });
      await prisma.auditLog.create({
        data: {
          action: 'VISIT_AUTO_COMPLETED',
          entity: 'Visit',
          entityId: visit.id,
          userId: null,
          details: `Visit ${visit.visitUid} auto-completed from ${visit.status} after 4d of inactivity`
        }
      });
    }
    if (stuckVisits.length > 0) {
      console.log(`[Cron] Auto-completed ${stuckVisits.length} stuck visits`);
    }
  } catch (error) {
    console.error('[Cron] Error cleaning up stuck visits:', error.message);
  }
}

// Run on startup
cleanupStuckVisits();

// Schedule hourly check
cron.schedule('0 * * * *', () => {
  cleanupStuckVisits();
});

const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

// Auto-seed built-in templates on startup
seedAll().catch(err => console.error('[Server] Template seeding failed:', err.message));

server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`Node environment: ${process.env.NODE_ENV}`);
});