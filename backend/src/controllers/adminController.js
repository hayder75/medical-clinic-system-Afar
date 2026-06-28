const prisma = require('../config/database');
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const { getDefaultClinicName } = require('../utils/pdfGenerator');
const { buildCardBucketEntries, getCardProducts, extractSlugFromServiceCode } = require('../utils/cardBucketHelper');

const STATIC_SERVICE_BUCKETS = {
  LAB: 'Lab',
  LAB_WALKIN: 'Lab Walk-in',
  RADIOLOGY: 'Radiology',
  RADIOLOGY_WALKIN: 'Radiology Walk-in',
  PROCEDURE: 'Procedure',
  NURSE_SERVICES: 'Nurse Services',
  NURSE_WALKIN: 'Nurse Walk-in',
  CONSULTATION_GENERAL: 'Consultation (Medical)',
  CONSULTATION_DERMATOLOGY: 'Consultation (Dermatology)',
  MATERIAL_NEEDS: 'Material Needs',
  EMERGENCY_MEDICATION: 'Emergency Medication',
  OTHER: 'Other Services'
};

let _cardBucketLabels = null;
const getCardBucketLabels = async () => {
  if (_cardBucketLabels) return _cardBucketLabels;
  _cardBucketLabels = await buildCardBucketEntries({});
  return _cardBucketLabels;
};
const invalidateCardBucketLabels = () => { _cardBucketLabels = null; };

const getServiceBucketKey = (service) => {
  if (!service) return 'OTHER';

  const code = (service.code || '').toUpperCase();
  const name = (service.name || '').toUpperCase();
  const category = service.category;
  const isDerm = code.includes('DERM') || name.includes('DERM') || name.includes('SKIN');

  // Card services: extract slug from code for dynamic bucket keys
  if (code.startsWith('CARD-REG-')) return 'CARD_CREATED_' + code.replace('CARD-REG-', '');
  if (code.startsWith('CARD-ACT-')) return 'CARD_REACTIVATION_' + code.replace('CARD-ACT-', '');
  // Fallback for non-standard card service codes
  if (code.startsWith('CARD-REG') || name.includes('CARD REGISTRATION') || name.includes('CARD CREATED')) {
    return isDerm ? 'CARD_CREATED_DERMATOLOGY' : 'CARD_CREATED_GENERAL';
  }
  if (code.startsWith('CARD-ACT') || name.includes('CARD ACTIVATION') || name.includes('CARD REACTIVATION') || name.includes('CARD RENEWAL')) {
    return isDerm ? 'CARD_REACTIVATION_DERMATOLOGY' : 'CARD_REACTIVATION_GENERAL';
  }

  if (category === 'LAB') return 'LAB';
  if (category === 'RADIOLOGY') return 'RADIOLOGY';
  if (category === 'PROCEDURE' || category === 'DENTAL' || category === 'TREATMENT') return 'PROCEDURE';
  if (category === 'NURSE' || category === 'NURSE_WALKIN' || category === 'CONTINUOUS_INFUSION') return 'NURSE_SERVICES';
  if (category === 'MATERIAL_NEEDS') return 'MATERIAL_NEEDS';
  if (category === 'EMERGENCY_DRUG') return 'EMERGENCY_MEDICATION';
  if (category === 'CONSULTATION') return isDerm ? 'CONSULTATION_DERMATOLOGY' : 'CONSULTATION_GENERAL';

  return 'OTHER';
};

const EMPTY_BUCKET_TOTALS = (extraKeys = []) => {
  const allKeys = [...new Set([...Object.keys(STATIC_SERVICE_BUCKETS), ...extraKeys])];
  return allKeys.reduce((acc, key) => { acc[key] = 0; return acc; }, {});
};

const EMPTY_BUCKET_TOTALS_ASYNC = async () => {
  const cardLabels = await getCardBucketLabels();
  return EMPTY_BUCKET_TOTALS(Object.keys(cardLabels));
};

const allocateBillingAmountByBucket = (billing, paidAmount) => {
  const totals = EMPTY_BUCKET_TOTALS();
  const services = billing?.services || [];
  const billingTotal = billing?.totalAmount || services.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

  if (!services.length || billingTotal <= 0 || paidAmount <= 0) {
    return totals;
  }

  const ratio = Math.min(1, paidAmount / billingTotal);

  for (const item of services) {
    const bucket = getServiceBucketKey(item.service);
    totals[bucket] += (item.totalPrice || 0) * ratio;
  }

  return totals;
};

const buildWalkInBillingFlags = async (billingIds) => {
  const flagsMap = new Map();
  const uniqueBillingIds = [...new Set((billingIds || []).filter(Boolean))];

  if (!uniqueBillingIds.length) {
    return flagsMap;
  }

  const [labWalkInOrders, radiologyWalkInOrders, nurseWalkInOrders] = await Promise.all([
    prisma.labTestOrder.findMany({
      where: {
        billingId: { in: uniqueBillingIds },
        isWalkIn: true
      },
      select: { billingId: true }
    }),
    prisma.radiologyOrder.findMany({
      where: {
        billingId: { in: uniqueBillingIds },
        isWalkIn: true
      },
      select: { billingId: true }
    }),
    prisma.nurseWalkInOrder.findMany({
      where: {
        billingId: { in: uniqueBillingIds }
      },
      select: { billingId: true }
    })
  ]);

  labWalkInOrders.forEach((order) => {
    if (!order.billingId) return;
    const current = flagsMap.get(order.billingId) || { labWalkIn: false, radiologyWalkIn: false, nurseWalkIn: false };
    current.labWalkIn = true;
    flagsMap.set(order.billingId, current);
  });

  radiologyWalkInOrders.forEach((order) => {
    if (!order.billingId) return;
    const current = flagsMap.get(order.billingId) || { labWalkIn: false, radiologyWalkIn: false, nurseWalkIn: false };
    current.radiologyWalkIn = true;
    flagsMap.set(order.billingId, current);
  });

  nurseWalkInOrders.forEach((order) => {
    if (!order.billingId) return;
    const current = flagsMap.get(order.billingId) || { labWalkIn: false, radiologyWalkIn: false, nurseWalkIn: false };
    current.nurseWalkIn = true;
    flagsMap.set(order.billingId, current);
  });

  return flagsMap;
};

const allocateBillingAmountWithWalkInSplit = (billing, paidAmount, walkInFlags = null) => {
  const totals = EMPTY_BUCKET_TOTALS();
  const services = billing?.services || [];
  const billingTotal = billing?.totalAmount || services.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

  if (!services.length || billingTotal <= 0 || paidAmount <= 0) {
    return totals;
  }

  const ratio = Math.min(1, paidAmount / billingTotal);

  for (const item of services) {
    const category = item.service?.category;
    const amount = (item.totalPrice || 0) * ratio;

    if (walkInFlags?.labWalkIn && category === 'LAB') {
      totals.LAB_WALKIN += amount;
      continue;
    }

    if (walkInFlags?.radiologyWalkIn && category === 'RADIOLOGY') {
      totals.RADIOLOGY_WALKIN += amount;
      continue;
    }

    if (walkInFlags?.nurseWalkIn && (category === 'NURSE_WALKIN' || category === 'NURSE' || category === 'CONTINUOUS_INFUSION')) {
      totals.NURSE_WALKIN += amount;
      continue;
    }

    const bucket = getServiceBucketKey(item.service);
    totals[bucket] += amount;
  }

  return totals;
};

const getCardServiceUsageCounts = async (startDate, endDate, doctorIds = []) => {
  const cardProducts = await getCardProducts();
  const usage = {
    opened: {},
    activation: {},
    total: 0,
    details: { opened: {}, activation: {} }
  };

  for (const product of cardProducts) {
    const slug = (product.slug || '').toUpperCase();
    usage.opened[slug] = 0;
    usage.activation[slug] = 0;
  }
  usage.opened._total = 0;
  usage.activation._total = 0;

  const scopedDoctorIds = Array.isArray(doctorIds) ? doctorIds.filter(Boolean) : [];
  let assignmentIds = [];
  if (scopedDoctorIds.length > 0) {
    const assignments = await prisma.assignment.findMany({
      where: { doctorId: { in: scopedDoctorIds } },
      select: { id: true }
    });
    assignmentIds = assignments.map((a) => a.id);
  }

  const doctorVisitFilter = scopedDoctorIds.length > 0
    ? {
      billing: {
        visit: {
          OR: [
            { suggestedDoctorId: { in: scopedDoctorIds } },
            ...(assignmentIds.length > 0 ? [{ assignmentId: { in: assignmentIds } }] : [])
          ]
        }
      }
    }
    : {};

  const paymentTransactions = await prisma.cashTransaction.findMany({
    where: {
      type: 'PAYMENT_RECEIVED',
      billingId: { not: null },
      ...doctorVisitFilter,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      billing: {
        select: {
          id: true,
          status: true,
          services: {
            select: {
              quantity: true,
              service: {
                select: {
                  code: true,
                  name: true
                }
              }
            }
          }
        }
      }
    }
  });

  const processedBillingIds = new Set();

  for (const tx of paymentTransactions) {
    const billing = tx.billing;
    if (!billing?.id) continue;
    if (billing.status !== 'PAID') continue;
    if (processedBillingIds.has(billing.id)) continue;

    processedBillingIds.add(billing.id);

    for (const line of billing.services || []) {
      const code = (line.service?.code || '').toUpperCase();
      const name = (line.service?.name || '').toUpperCase();

      const isCardOpened =
        code.startsWith('CARD-REG') ||
        name.includes('CARD REGISTRATION') ||
        name.includes('CARD CREATED');
      const isCardActivation =
        code.startsWith('CARD-ACT') ||
        name.includes('CARD ACTIVATION') ||
        name.includes('CARD REACTIVATION') ||
        name.includes('CARD RENEWAL');

      if (!isCardOpened && !isCardActivation) continue;

      const quantity = Number(line.quantity) > 0 ? Number(line.quantity) : 1;

      let slug = extractSlugFromServiceCode(code);
      if (!slug || !usage.opened.hasOwnProperty(slug)) {
        const c = (code || '').toUpperCase();
        const n = (name || '').toUpperCase();
        const isDerm = c.includes('DERM') || n.includes('DERM') || n.includes('SKIN');
        slug = isDerm ? 'DERMATOLOGY' : 'GENERAL';
      }

      if (isCardOpened) {
        if (!usage.opened.hasOwnProperty(slug)) usage.opened[slug] = 0;
        usage.opened[slug] += quantity;
        usage.opened._total += quantity;
      }
      if (isCardActivation) {
        if (!usage.activation.hasOwnProperty(slug)) usage.activation[slug] = 0;
        usage.activation[slug] += quantity;
        usage.activation._total += quantity;
      }
    }
  }

  usage.total = usage.opened._total + usage.activation._total;
  return usage;
};

const getDermatologyMedicalTreatedCount = async (startDate, endDate, doctorIds = []) => {
  const scopedDoctorIds = Array.isArray(doctorIds) ? doctorIds.filter(Boolean) : [];
  const markerTag = '[DERM_MEDICAL_TREATED]';

  const auditWhere = {
    action: 'DERM_MEDICAL_TREATED_MARK',
    ...(scopedDoctorIds.length > 0 ? { userId: { in: scopedDoctorIds } } : {}),
    createdAt: {
      gte: startDate,
      lte: endDate
    }
  };

  let assignmentIds = [];
  if (scopedDoctorIds.length > 0) {
    const assignments = await prisma.assignment.findMany({
      where: { doctorId: { in: scopedDoctorIds } },
      select: { id: true }
    });
    assignmentIds = assignments.map((a) => a.id);
  }

  const visitWhere = {
    completedAt: {
      gte: startDate,
      lte: endDate
    },
    notes: { contains: markerTag },
    ...(scopedDoctorIds.length > 0
      ? {
        OR: [
          { suggestedDoctorId: { in: scopedDoctorIds } },
          ...(assignmentIds.length > 0 ? [{ assignmentId: { in: assignmentIds } }] : [])
        ]
      }
      : {})
  };

  const [auditMarkers, taggedVisits] = await Promise.all([
    prisma.auditLog.findMany({ where: auditWhere, select: { entityId: true } }),
    prisma.visit.findMany({ where: visitWhere, select: { id: true } })
  ]);

  const uniqueVisitIds = new Set();
  auditMarkers.forEach((m) => {
    if (typeof m.entityId === 'number') uniqueVisitIds.add(m.entityId);
  });
  taggedVisits.forEach((v) => uniqueVisitIds.add(v.id));

  return uniqueVisitIds.size;
};

// Validation schemas
const createUserSchema = z.object({
  fullname: z.string().optional(),
  username: z.string().min(3),
  password: z.string().min(4),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  phone: z.string().optional(),
  role: z.enum(['ADMIN', 'OWNER', 'BILLING_OFFICER', 'PHARMACY_BILLING_OFFICER', 'CARE_COORDINATOR', 'CMO', 'CLINICAL_RESEARCH_COORDINATOR', 'DIETITIAN', 'DOCTOR', 'HOSPITAL_MANAGER', 'HR_OFFICER', 'IT_SUPPORT', 'LAB_TECHNICIAN', 'MEDICAL_RECORDS_OFFICER', 'NURSE', 'PATIENT', 'PHARMACY_OFFICER', 'PHARMACIST', 'RADIOLOGIST', 'RECEPTIONIST', 'SECURITY_STAFF', 'SOCIAL_WORKER']),
  qualifications: z.array(z.string()).optional(),
  specialty: z.string().optional(),
  licenseNumber: z.string().optional(),
  consultationFee: z.number().optional(),
  waiveConsultationFee: z.boolean().optional(),
  requiredCardType: z.string().optional(),
});

const createServiceSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1),
  category: z.enum(['CONSULTATION', 'LAB', 'RADIOLOGY', 'MEDICATION', 'PROCEDURE', 'NURSE', 'DENTAL', 'OTHER', 'NURSE_WALKIN', 'EMERGENCY_DRUG', 'MATERIAL_NEEDS', 'ACCOMMODATION']),
  price: z.number().nonnegative(), // Changed from positive() to nonnegative() to allow 0 for variable pricing
  unit: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  isVariablePrice: z.boolean().optional(),
  minPrice: z.number().nonnegative().optional().nullable(),
  maxPrice: z.number().nonnegative().optional().nullable(),
  procedureGroup: z.string().optional().nullable(),
  labGroup: z.string().optional().nullable(),
  radiologyGroup: z.string().optional().nullable(),
});

const createInsuranceSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  contactInfo: z.string().optional(),
});

const createInvestigationTypeSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
  category: z.enum(['LAB', 'RADIOLOGY']),
  serviceId: z.string().optional(),
  description: z.string().optional(),
});

const createLabTestGroupSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  price: z.number().nonnegative().optional(),
});

const createLabTestSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  category: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  unit: z.string().optional(),
  groupId: z.string().uuid().optional().nullable(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  resultFields: z.array(z.object({
    fieldName: z.string().min(1),
    label: z.string().min(1),
    fieldType: z.enum(['number', 'text', 'select', 'textarea', 'binary']),
    unit: z.string().optional().nullable(),
    normalRange: z.string().optional().nullable(),
    options: z.array(z.string()).optional().nullable(),
    isRequired: z.boolean().optional(),
    displayOrder: z.number().int().optional(),
  })).optional(),
});

const createInventorySchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().min(0),
  category: z.enum(['TABLETS', 'CAPSULES', 'INJECTIONS', 'SYRUPS', 'OINTMENTS', 'DROPS', 'INHALERS', 'PATCHES', 'INFUSIONS']).optional(),
  dosageForm: z.string().optional(),
  strength: z.string().optional(),
  expiryDate: z.string().datetime().optional(),
  supplier: z.string().optional(),
  price: z.number().positive().optional(),
  serviceId: z.string().optional(),
});

// User Management
exports.createUser = async (req, res) => {
  try {
    const data = createUserSchema.parse(req.body);

    // Clean up data - remove empty strings and convert to null/undefined
    const cleanedData = { ...data };
    if (cleanedData.fullname === '') {
      cleanedData.fullname = null;
    }
    if (cleanedData.email === '' || !cleanedData.email) {
      delete cleanedData.email; // Remove email if empty or not provided
    }
    if (cleanedData.phone === '') {
      cleanedData.phone = null;
    }

    // Check if username or email already exists
    const whereClause = {
      OR: [
        { username: cleanedData.username }
      ]
    };

    // Only check email if it's provided and not empty
    if (cleanedData.email) {
      whereClause.OR.push({ email: cleanedData.email });
    }

    const existingUser = await prisma.user.findFirst({
      where: whereClause
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'Username or email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(cleanedData.password, 10);

    // Prepare user data, excluding email if not provided
    const userData = {
      ...cleanedData,
      password: hashedPassword,
      qualifications: cleanedData.qualifications || [],
      isActive: true // Ensure new users are active by default
    };

    // Only include email if it's provided
    if (cleanedData.email) {
      userData.email = cleanedData.email;
    }

    const user = await prisma.user.create({
      data: userData,
      select: {
        id: true,
        fullname: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        qualifications: true,
        specialty: true,
        licenseNumber: true,
        consultationFee: true,
        waiveConsultationFee: true,
        availability: true,
        createdAt: true
      }
    });

    res.status(201).json({
      message: 'User created successfully',
      user
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

async function retryQuery(queryFn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await queryFn();
    } catch (error) {
      if (error.message?.includes('Server has closed the connection') && i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      throw error;
    }
  }
}

exports.getUsers = async (req, res) => {
  try {
    const { role } = req.query;

    let whereClause = {};
    if (role) {
      whereClause.role = role;
    }

    const users = await retryQuery(() => prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        fullname: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        qualifications: true,
        specialty: true,
        licenseNumber: true,
        consultationFee: true,
        waiveConsultationFee: true,
        availability: true,
        isActive: true,
        passwordChangedAt: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    }));

    res.json({ users: users || [] });
  } catch (error) {
    console.error('❌ [getUsers] Error:', error);
    res.status(500).json({ error: 'Failed to fetch users', details: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const data = createUserSchema.partial().omit({ password: true }).parse(req.body);

    // Clean up data - handle empty strings
    const cleanedData = { ...data };
    if (cleanedData.email === '') {
      cleanedData.email = null; // Set to null if explicitly cleared
    } else if (!cleanedData.email) {
      delete cleanedData.email; // Remove if not provided (don't update)
    }
    if (cleanedData.phone === '') {
      cleanedData.phone = null;
    }
    if (cleanedData.fullname === '') {
      cleanedData.fullname = null;
    }

    // Check if username or email already exists (excluding current user)
    if (cleanedData.username || cleanedData.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                cleanedData.username ? { username: cleanedData.username } : {},
                cleanedData.email ? { email: cleanedData.email } : {}
              ]
            }
          ]
        }
      });

      if (existingUser) {
        return res.status(400).json({
          error: 'Username or email already exists'
        });
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: cleanedData,
      select: {
        id: true,
        fullname: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        qualifications: true,
        specialty: true,
        licenseNumber: true,
        consultationFee: true,
        waiveConsultationFee: true,
        availability: true,
        createdAt: true
      }
    });

    res.json({
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deletion of admin users
    if (user.role === 'ADMIN' || user.role === 'OWNER') {
      return res.status(400).json({ error: 'Cannot delete admin or owner users' });
    }

    await prisma.user.delete({
      where: { id }
    });

    res.json({
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });

    res.json({
      message: 'Password updated successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Helper function to generate service code
async function generateServiceCode(category) {
  // Category prefix mapping
  const categoryPrefixes = {
    'CONSULTATION': 'CONS',
    'LAB': 'LAB',
    'RADIOLOGY': 'RAD',
    'MEDICATION': 'MED',
    'PROCEDURE': 'PROC',
    'NURSE': 'NURSE',
    'DENTAL': 'DENT',
    'OTHER': 'OTH',
    'NURSE_WALKIN': 'NWALK',
    'EMERGENCY_DRUG': 'EMDRUG',
    'MATERIAL_NEEDS': 'MAT'
  };

  const prefix = categoryPrefixes[category] || 'SRV';

  // Find the highest number for this category
  const existingServices = await prisma.service.findMany({
    where: {
      code: {
        startsWith: prefix
      }
    },
    orderBy: {
      code: 'desc'
    },
    take: 1
  });

  let nextNumber = 1;
  if (existingServices.length > 0) {
    const lastCode = existingServices[0].code;
    const lastNumber = parseInt(lastCode.replace(prefix, '')) || 0;
    nextNumber = lastNumber + 1;
  }

  // Format: PREFIX + 3-digit number (e.g., CONS001, LAB045)
  return `${prefix}${String(nextNumber).padStart(3, '0')}`;
}

// Service Management
exports.createService = async (req, res) => {
  try {
    const data = createServiceSchema.parse(req.body);

    // Auto-generate code if not provided
    let serviceCode = data.code;
    if (!serviceCode || serviceCode.trim() === '') {
      serviceCode = await generateServiceCode(data.category);
    }

    // Check if service code already exists
    const existingService = await prisma.service.findUnique({
      where: { code: serviceCode }
    });

    if (existingService) {
      return res.status(400).json({
        error: 'Service code already exists. Please choose a different code.'
      });
    }

    const service = await prisma.service.create({
      data: {
        ...data,
        code: serviceCode
      }
    });

    // Automatically create related records based on category
    const autoCreated = {
      investigationType: false,
      labTest: false
    };

    try {
      if (data.category === 'RADIOLOGY') {
        // Check if InvestigationType already exists for this service
        const existingInvestigationType = await prisma.investigationType.findFirst({
          where: {
            serviceId: service.id
          }
        });

        if (!existingInvestigationType) {
          const radiologyGroupMap = {
            'XRAY': 'X-Ray',
            'ULTRASOUND': 'Ultrasound',
            'CT_SCAN': 'CT Scan',
            'MRI': 'MRI',
            'MAMMOGRAPHY': 'Mammography',
            'FLUOROSCOPY': 'Fluoroscopy',
            'OTHER': 'Other'
          };

          let radiologyCategoryId = null;
          if (data.radiologyGroup) {
            const catName = radiologyGroupMap[data.radiologyGroup] || data.radiologyGroup;
            let radCat = await prisma.radiologyCategory.findFirst({
              where: { name: catName }
            });
            if (!radCat) {
              radCat = await prisma.radiologyCategory.create({
                data: { name: catName, displayOrder: 999, isActive: true }
              });
            }
            radiologyCategoryId = radCat.id;
          }

          await prisma.investigationType.create({
            data: {
              name: service.name,
              category: 'RADIOLOGY',
              price: service.price,
              service: {
                connect: { id: service.id }
              },
              ...(radiologyCategoryId ? { radiologyCategoryId } : {})
            }
          });
          autoCreated.investigationType = true;
          console.log(`✅ Auto-created InvestigationType for RADIOLOGY service: ${service.name}${radiologyCategoryId ? ` (category: ${radiologyGroupMap[data.radiologyGroup] || data.radiologyGroup})` : ''}`);
        }
      } else if (data.category === 'LAB') {
        // Check if LabTest already exists for this service
        const existingLabTest = await prisma.labTest.findFirst({
          where: {
            serviceId: service.id
          }
        });

        if (!existingLabTest) {
          // Generate a unique code for the LabTest (use service code or generate one)
          const labTestCode = serviceCode || `LAB${String(Date.now()).slice(-6)}`;

          // Create LabTest for LAB service with basic template
          const labTest = await prisma.labTest.create({
            data: {
              code: labTestCode,
              name: service.name,
              category: data.labGroup || 'OTHER',
              description: service.description || `Lab test: ${service.name}`,
              price: service.price,
              unit: service.unit || 'UNIT',
              isActive: service.isActive !== false, // Default to true
              serviceId: service.id,
              groupId: null, // Standalone by default
              displayOrder: 0
            }
          });

          // Create basic result fields: Result and Remarks
          await prisma.labTestResultField.createMany({
            data: [
              {
                testId: labTest.id,
                fieldName: 'result',
                label: 'Result',
                fieldType: 'textarea',
                unit: null,
                normalRange: null,
                options: null,
                isRequired: false,
                displayOrder: 1
              },
              {
                testId: labTest.id,
                fieldName: 'remarks',
                label: 'Remarks',
                fieldType: 'textarea',
                unit: null,
                normalRange: null,
                options: null,
                isRequired: false,
                displayOrder: 2
              }
            ]
          });

          autoCreated.labTest = true;
          console.log(`✅ Auto-created LabTest with basic template for LAB service: ${service.name}`);
        }
      }
    } catch (autoCreateError) {
      // Log error but don't fail the service creation
      console.error(`⚠️  Warning: Failed to auto-create related records for service ${service.name}:`, autoCreateError.message);
      // Continue - service was created successfully, related records can be created manually later
    }

    res.status(201).json({
      message: 'Service created successfully',
      service,
      autoCreated
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.getServices = async (req, res) => {
  try {
    const { category, isActive } = req.query;

    let whereClause = {};
    if (category && category !== 'ALL') {
      // Handle ENTRY category (stored as OTHER with code ENTRY001)
      if (category === 'ENTRY') {
        whereClause.category = 'OTHER';
        whereClause.code = 'ENTRY001';
      } else {
        whereClause.category = category;
      }
    }
    if (isActive !== undefined) {
      whereClause.isActive = isActive === 'true';
    }

    const services = await prisma.service.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
      // Select only needed fields for faster queries
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        price: true,
        unit: true,
        description: true,
        isActive: true,
        isVariablePrice: true,
        minPrice: true,
        maxPrice: true,
        procedureGroup: true,
        labGroup: true,
        radiologyGroup: true,
        createdAt: true,
        updatedAt: true
      }
    });

    res.json({ success: true, services });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: error.message });
  }
};


exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const data = createServiceSchema.partial().parse(req.body);

    // If code is being updated, check if the new code already exists (excluding current service)
    if (data.code) {
      const existingService = await prisma.service.findFirst({
        where: {
          code: data.code,
          id: { not: id } // Exclude current service
        }
      });

      if (existingService) {
        return res.status(400).json({
          error: 'Service code already exists. Please choose a different code.'
        });
      }
    }

    // Get the existing service to check category
    const existingService = await prisma.service.findUnique({
      where: { id }
    });

    if (!existingService) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const service = await prisma.service.update({
      where: { id },
      data
    });

    // Auto-create InvestigationType if category is RADIOLOGY
    if (service.category === 'RADIOLOGY') {
      try {
        const existingInvestigationType = await prisma.investigationType.findFirst({
          where: { serviceId: service.id }
        });

        if (!existingInvestigationType) {
          const radiologyGroupMap = {
            XRAY: 'X-Ray', ULTRASOUND: 'Ultrasound',
            CT_SCAN: 'CT Scan', MRI: 'MRI',
            MAMMOGRAPHY: 'Mammography', FLUOROSCOPY: 'Fluoroscopy',
            OTHER: 'Other'
          };
          let radId = null;
          const rg = service.radiologyGroup;
          if (rg) {
            const cName = radiologyGroupMap[rg] || rg;
            let rc = await prisma.radiologyCategory.findFirst({ where: { name: cName } });
            if (!rc) {
              rc = await prisma.radiologyCategory.create({ data: { name: cName, displayOrder: 999, isActive: true } });
            }
            radId = rc.id;
          }
          await prisma.investigationType.create({
            data: {
              name: service.name,
              category: 'RADIOLOGY',
              price: service.price,
              service: { connect: { id: service.id } },
              ...(radId ? { radiologyCategoryId: radId } : {})
            }
          });
          console.log(`✅ Auto-created InvestigationType for updated RADIOLOGY service: ${service.name}`);
        } else {
          // Update existing InvestigationType
          const updateData = { name: service.name, price: service.price };
          const rg = service.radiologyGroup;
          if (rg) {
            const radiologyGroupMap = {
              XRAY: 'X-Ray', ULTRASOUND: 'Ultrasound',
              CT_SCAN: 'CT Scan', MRI: 'MRI',
              MAMMOGRAPHY: 'Mammography', FLUOROSCOPY: 'Fluoroscopy',
              OTHER: 'Other'
            };
            const cName = radiologyGroupMap[rg] || rg;
            let rc = await prisma.radiologyCategory.findFirst({ where: { name: cName } });
            if (!rc) {
              rc = await prisma.radiologyCategory.create({ data: { name: cName, displayOrder: 999, isActive: true } });
            }
            updateData.radiologyCategoryId = rc.id;
          } else {
            updateData.radiologyCategoryId = null;
          }
          await prisma.investigationType.updateMany({
            where: { serviceId: service.id },
            data: updateData
          });
        }
      } catch (error) {
        console.error(`⚠️  Warning: Failed to auto-create/update InvestigationType for service ${service.name}:`, error.message);
      }
    }

    // Auto-create LabTest if category is LAB
    if (service.category === 'LAB') {
      try {
        const existingLabTest = await prisma.labTest.findFirst({
          where: { serviceId: service.id }
        });

        if (!existingLabTest) {
          const labTestCode = service.code || `LAB${String(Date.now()).slice(-6)}`;
          const labTest = await prisma.labTest.create({
            data: {
              code: labTestCode,
              name: service.name,
              category: service.labGroup || 'OTHER',
              description: service.description || `Lab test: ${service.name}`,
              price: service.price,
              unit: service.unit || 'UNIT',
              isActive: service.isActive !== false,
              serviceId: service.id,
              groupId: null,
              displayOrder: 0
            }
          });

          await prisma.labTestResultField.createMany({
            data: [
              {
                testId: labTest.id,
                fieldName: 'result',
                label: 'Result',
                fieldType: 'textarea',
                unit: null,
                normalRange: null,
                options: null,
                isRequired: false,
                displayOrder: 1
              },
              {
                testId: labTest.id,
                fieldName: 'remarks',
                label: 'Remarks',
                fieldType: 'textarea',
                unit: null,
                normalRange: null,
                options: null,
                isRequired: false,
                displayOrder: 2
              }
            ]
          });
          console.log(`✅ Auto-created LabTest for updated LAB service: ${service.name}`);
        } else {
          // Update existing LabTest
          const updateData = {
            name: service.name,
            price: service.price,
            description: service.description,
            category: service.labGroup || 'OTHER'
          };
          await prisma.labTest.updateMany({
            where: { serviceId: service.id },
            data: updateData
          });
        }
      } catch (error) {
        console.error(`⚠️  Warning: Failed to auto-create/update LabTest for service ${service.name}:`, error.message);
      }
    }

    res.json({
      message: 'Service updated successfully',
      service
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if service exists
    const service = await prisma.service.findUnique({
      where: { id }
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Check if service is being used anywhere in the system
    const [
      billingServices,
      labTests,
      investigationTypes,
      nurseAssignments,
      nurseWalkInOrders,
      emergencyDrugOrders,
      materialNeedsOrders,
      batchOrderServices
    ] = await Promise.all([
      prisma.billingService.findFirst({ where: { serviceId: id } }),
      prisma.labTest.findFirst({ where: { serviceId: id } }),
      prisma.investigationType.findFirst({ where: { serviceId: id } }),
      prisma.nurseServiceAssignment.findFirst({ where: { serviceId: id } }),
      prisma.nurseWalkInOrder.findFirst({ where: { serviceId: id } }),
      prisma.emergencyDrugOrder.findFirst({ where: { serviceId: id } }),
      prisma.materialNeedsOrder.findFirst({ where: { serviceId: id } }),
      prisma.batchOrderService.findFirst({ where: { serviceId: id } })
    ]);

    // For InvestigationType, check if it has actual orders (not just existence)
    let hasRadiologyOrders = false;
    let hasLabOrders = false;
    if (investigationTypes) {
      const [radiologyOrderCount, labOrderCount, batchOrderServiceCount] = await Promise.all([
        prisma.radiologyOrder.count({ where: { typeId: investigationTypes.id } }),
        prisma.labOrder.count({ where: { typeId: investigationTypes.id } }),
        prisma.batchOrderService.count({ where: { investigationTypeId: investigationTypes.id } })
      ]);
      hasRadiologyOrders = radiologyOrderCount > 0 || batchOrderServiceCount > 0;
      hasLabOrders = labOrderCount > 0;
    }

    // For LabTest, check if it has actual orders
    let hasLabTestOrders = false;
    if (labTests) {
      const labTestOrderCount = await prisma.labTestOrder.count({
        where: { labTestId: labTests.id }
      });
      hasLabTestOrders = labTestOrderCount > 0;
    }

    // Build list of usage locations (only if actually used, not just linked)
    const usageLocations = [];
    if (billingServices) usageLocations.push('billing records');
    if (labTests && hasLabTestOrders) usageLocations.push('lab test orders');
    if (investigationTypes && (hasRadiologyOrders || hasLabOrders)) {
      if (hasRadiologyOrders) usageLocations.push('radiology orders');
      if (hasLabOrders) usageLocations.push('lab orders');
    }
    if (nurseAssignments) usageLocations.push('nurse service assignments');
    if (nurseWalkInOrders) usageLocations.push('nurse walk-in orders');
    if (emergencyDrugOrders) usageLocations.push('emergency drug orders');
    if (materialNeedsOrders) usageLocations.push('material needs orders');
    if (batchOrderServices) usageLocations.push('batch orders');

    if (usageLocations.length > 0) {
      return res.status(400).json({
        error: `Cannot delete service that is being used in: ${usageLocations.join(', ')}. Please deactivate it instead.`
      });
    }

    // Delete related records if they exist (InvestigationType or LabTest)
    // These were auto-created, so we clean them up when deleting the service
    if (investigationTypes) {
      // Check if InvestigationType has result fields or files that need cleanup
      await prisma.investigationType.delete({
        where: { id: investigationTypes.id }
      });
    }

    if (labTests) {
      // Delete result fields first (cascade should handle this, but being explicit)
      await prisma.labTestResultField.deleteMany({
        where: { testId: labTests.id }
      });
      await prisma.labTest.delete({
        where: { id: labTests.id }
      });
    }

    // Now delete the service
    await prisma.service.delete({
      where: { id }
    });

    res.json({
      message: 'Service deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Insurance Management
exports.createInsurance = async (req, res) => {
  try {
    const data = createInsuranceSchema.parse(req.body);

    // Check if insurance code already exists
    const existingInsurance = await prisma.insurance.findUnique({
      where: { code: data.code }
    });

    if (existingInsurance) {
      return res.status(400).json({
        error: 'Insurance code already exists'
      });
    }

    const insurance = await prisma.insurance.create({
      data
    });

    res.status(201).json({
      message: 'Insurance created successfully',
      insurance
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.getInsurances = async (req, res) => {
  try {
    try {
      const insurances = await prisma.insurance.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' }
      });

      res.json({ insurances });
    } catch (dbError) {
      console.log('Database not available, returning mock insurances data');

      // Fallback mock data when database is not available
      const mockInsurances = [
        {
          id: '1',
          name: 'Ethiopian Telecom',
          code: 'ETC001',
          type: 'CORPORATE',
          coveragePercentage: 80,
          maxCoverageAmount: 10000,
          isActive: true,
          createdAt: new Date('2025-09-30T21:22:59.046Z')
        },
        {
          id: '2',
          name: 'Test Insurance',
          code: 'TEST001',
          type: 'INDIVIDUAL',
          coveragePercentage: 70,
          maxCoverageAmount: 5000,
          isActive: true,
          createdAt: new Date('2025-09-30T21:22:59.046Z')
        },
        {
          id: '3',
          name: 'Government Insurance',
          code: 'GOV001',
          type: 'GOVERNMENT',
          coveragePercentage: 90,
          maxCoverageAmount: 15000,
          isActive: true,
          createdAt: new Date('2025-09-30T21:22:59.046Z')
        }
      ];

      res.json({ insurances: mockInsurances });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateInsurance = async (req, res) => {
  try {
    const { id } = req.params;
    const data = createInsuranceSchema.partial().parse(req.body);

    const insurance = await prisma.insurance.update({
      where: { id },
      data
    });

    res.json({
      message: 'Insurance updated successfully',
      insurance
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.deleteInsurance = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if insurance exists
    const insurance = await prisma.insurance.findUnique({
      where: { id }
    });

    if (!insurance) {
      return res.status(404).json({ error: 'Insurance not found' });
    }

    // Check if insurance is being used by patients
    const patientsWithInsurance = await prisma.patient.findFirst({
      where: { insuranceId: id }
    });

    if (patientsWithInsurance) {
      return res.status(400).json({
        error: 'Cannot delete insurance that is being used by patients'
      });
    }

    await prisma.insurance.delete({
      where: { id }
    });

    res.json({
      message: 'Insurance deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Investigation Types Management
exports.createInvestigationType = async (req, res) => {
  try {
    const data = createInvestigationTypeSchema.parse(req.body);

    const investigationType = await prisma.investigationType.create({
      data
    });

    res.status(201).json({
      message: 'Investigation type created successfully',
      investigationType
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.getInvestigationTypes = async (req, res) => {
  try {
    const { category } = req.query;

    let whereClause = {};
    if (category) {
      whereClause.category = category;
    }
    // Only show investigation types where service is active
    // Exclude investigation types with inactive services
    whereClause.service = {
      isActive: true
    };

    const investigationTypes = await prisma.investigationType.findMany({
      where: whereClause,
      include: {
        service: {
          select: {
            id: true,
            code: true,
            name: true,
            price: true,
            isActive: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Additional client-side filter to ensure we only return active services
    // This double-checks and filters out any investigation types with inactive services
    const filteredTypes = investigationTypes.filter(inv =>
      inv.service && inv.service.isActive === true
    );

    res.json({ investigationTypes: filteredTypes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Inventory Management
exports.createInventoryItem = async (req, res) => {
  try {
    const data = createInventorySchema.parse(req.body);

    const inventoryItem = await prisma.inventory.create({
      data
    });

    res.status(201).json({
      message: 'Inventory item created successfully',
      inventoryItem
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.getInventory = async (req, res) => {
  try {
    const { category, lowStock } = req.query;

    let whereClause = {};
    if (category) {
      whereClause.category = category;
    }
    if (lowStock === 'true') {
      whereClause.quantity = { lt: 10 }; // Less than 10 items
    }

    const inventory = await prisma.inventory.findMany({
      where: whereClause,
      include: {
        service: {
          select: {
            id: true,
            code: true,
            name: true,
            price: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json({ inventory });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const data = createInventorySchema.partial().parse(req.body);

    const inventoryItem = await prisma.inventory.update({
      where: { id: parseInt(id) },
      data
    });

    res.json({
      message: 'Inventory item updated successfully',
      inventoryItem
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

// Billing Overview
exports.getBillingOverview = async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;

    let whereClause = {};
    if (status) {
      whereClause.status = status;
    }
    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const billings = await prisma.billing.findMany({
      where: whereClause,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        services: {
          include: {
            service: {
              select: {
                code: true,
                name: true,
                category: true
              }
            }
          }
        },
        payments: true,
        insurance: {
          select: {
            name: true,
            code: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate summary statistics
    const totalAmount = billings.reduce((sum, billing) => sum + billing.totalAmount, 0);
    const paidAmount = billings
      .filter(billing => billing.status === 'PAID')
      .reduce((sum, billing) => sum + billing.totalAmount, 0);
    const pendingAmount = billings
      .filter(billing => billing.status === 'PENDING')
      .reduce((sum, billing) => sum + billing.totalAmount, 0);

    res.json({
      billings,
      summary: {
        totalBillings: billings.length,
        totalAmount,
        paidAmount,
        pendingAmount,
        paidPercentage: totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Audit Logs
exports.getAuditLogs = async (req, res) => {
  try {
    const { userId, action, entity, startDate, endDate } = req.query;

    let whereClause = {};
    if (userId) {
      whereClause.userId = userId;
    }
    if (action) {
      whereClause.action = { contains: action };
    }
    if (entity) {
      whereClause.entity = entity;
    }
    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            fullname: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 1000 // Limit to last 1000 entries
    });

    res.json({ auditLogs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Reports
exports.getDailyReport = async (req, res) => {
  try {
    const { date } = req.query;
    const reportDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(reportDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(reportDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Revenue by service category
    const revenueByCategory = await prisma.billing.groupBy({
      by: ['status'],
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      _sum: {
        totalAmount: true
      },
      _count: {
        id: true
      }
    });

    // Service-wise revenue
    const serviceRevenue = await prisma.billingService.groupBy({
      by: ['serviceId'],
      where: {
        billing: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      },
      _sum: {
        totalPrice: true
      },
      _count: {
        id: true
      }
    });

    // Get service details
    const serviceDetails = await prisma.service.findMany({
      where: {
        id: {
          in: serviceRevenue.map(s => s.serviceId)
        }
      },
      select: {
        id: true,
        name: true,
        category: true,
        code: true
      }
    });

    // Patient statistics
    const patientStats = await prisma.patient.groupBy({
      by: ['type'],
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      _count: {
        id: true
      }
    });

    // Visit statistics
    const visitStats = await prisma.visit.groupBy({
      by: ['status'],
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      _count: {
        id: true
      }
    });

    // Lab orders pending
    const pendingLabOrders = await prisma.labOrder.count({
      where: {
        status: 'QUEUED',
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    // Radiology orders pending
    const pendingRadiologyOrders = await prisma.radiologyOrder.count({
      where: {
        status: 'QUEUED',
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    // Medication orders pending
    const pendingMedicationOrders = await prisma.medicationOrder.count({
      where: {
        status: 'QUEUED',
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    // Pharmacy invoices pending
    const pendingPharmacyInvoices = await prisma.pharmacyInvoice.count({
      where: {
        status: 'PENDING',
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    // Calculate totals
    const totalRevenue = revenueByCategory
      .filter(r => r.status === 'PAID')
      .reduce((sum, r) => sum + (r._sum.totalAmount || 0), 0);

    const totalBillings = revenueByCategory.reduce((sum, r) => sum + (r._count.id || 0), 0);

    res.json({
      date: reportDate.toISOString().split('T')[0],
      revenue: {
        total: totalRevenue,
        byStatus: revenueByCategory,
        byService: serviceRevenue.map(s => ({
          ...s,
          service: serviceDetails.find(sd => sd.id === s.serviceId)
        }))
      },
      patients: {
        byType: patientStats,
        total: patientStats.reduce((sum, p) => sum + (p._count.id || 0), 0)
      },
      visits: {
        byStatus: visitStats,
        total: visitStats.reduce((sum, v) => sum + (v._count.id || 0), 0)
      },
      pendingOrders: {
        lab: pendingLabOrders,
        radiology: pendingRadiologyOrders,
        medication: pendingMedicationOrders,
        pharmacy: pendingPharmacyInvoices
      },
      summary: {
        totalBillings,
        totalRevenue,
        averageBillingAmount: totalBillings > 0 ? totalRevenue / totalBillings : 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getWeeklyReport = async (req, res) => {
  try {
    const { startDate } = req.query;
    const weekStart = startDate ? new Date(startDate) : new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Daily revenue breakdown
    const dailyRevenue = [];
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(weekStart);
      dayStart.setDate(dayStart.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayRevenue = await prisma.billing.aggregate({
        where: {
          status: 'PAID',
          createdAt: {
            gte: dayStart,
            lte: dayEnd
          }
        },
        _sum: {
          totalAmount: true
        },
        _count: {
          id: true
        }
      });

      dailyRevenue.push({
        date: dayStart.toISOString().split('T')[0],
        revenue: dayRevenue._sum.totalAmount || 0,
        billings: dayRevenue._count.id || 0
      });
    }

    // Service category performance
    const categoryPerformance = await prisma.billingService.groupBy({
      by: ['serviceId'],
      where: {
        billing: {
          status: 'PAID',
          createdAt: {
            gte: weekStart,
            lte: weekEnd
          }
        }
      },
      _sum: {
        totalPrice: true
      },
      _count: {
        id: true
      }
    });

    // Get service details
    const serviceDetails = await prisma.service.findMany({
      where: {
        id: {
          in: categoryPerformance.map(s => s.serviceId)
        }
      },
      select: {
        id: true,
        name: true,
        category: true,
        code: true
      }
    });

    // Doctor performance
    const doctorPerformance = await prisma.visit.groupBy({
      by: ['createdById'],
      where: {
        status: 'COMPLETED',
        createdAt: {
          gte: weekStart,
          lte: weekEnd
        }
      },
      _count: {
        id: true
      }
    });

    // Get doctor details
    const doctorDetails = await prisma.user.findMany({
      where: {
        id: {
          in: doctorPerformance.map(d => d.createdById).filter(Boolean)
        },
        role: 'DOCTOR'
      },
      select: {
        id: true,
        fullname: true,
        qualifications: true
      }
    });

    // Calculate totals
    const totalRevenue = dailyRevenue.reduce((sum, day) => sum + day.revenue, 0);
    const totalBillings = dailyRevenue.reduce((sum, day) => sum + day.billings, 0);

    res.json({
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      dailyRevenue,
      categoryPerformance: categoryPerformance.map(cp => ({
        ...cp,
        service: serviceDetails.find(sd => sd.id === cp.serviceId)
      })),
      doctorPerformance: doctorPerformance.map(dp => ({
        ...dp,
        doctor: doctorDetails.find(dd => dd.id === dp.createdById)
      })),
      summary: {
        totalRevenue,
        totalBillings,
        averageDailyRevenue: totalRevenue / 7,
        averageBillingAmount: totalBillings > 0 ? totalRevenue / totalBillings : 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getRevenueReport = async (req, res) => {
  try {
    const { startDate, endDate, groupBy } = req.query;
    const start = startDate ? new Date(startDate) : new Date();
    start.setDate(start.getDate() - 30); // Default to last 30 days
    const end = endDate ? new Date(endDate) : new Date();

    // Revenue trends - always group by date for billing table
    const revenueTrends = await prisma.billing.groupBy({
      by: ['createdAt'],
      where: {
        status: 'PAID',
        createdAt: {
          gte: start,
          lte: end
        }
      },
      _sum: {
        totalAmount: true
      },
      _count: {
        id: true
      }
    });

    // Top performing services
    const topServices = await prisma.billingService.groupBy({
      by: ['serviceId'],
      where: {
        billing: {
          status: 'PAID',
          createdAt: {
            gte: start,
            lte: end
          }
        }
      },
      _sum: {
        totalPrice: true
      },
      _count: {
        id: true
      },
      orderBy: {
        _sum: {
          totalPrice: 'desc'
        }
      },
      take: 10
    });

    // Get service details for top services
    const topServiceDetails = await prisma.service.findMany({
      where: {
        id: {
          in: topServices.map(s => s.serviceId)
        }
      },
      select: {
        id: true,
        name: true,
        category: true,
        code: true,
        price: true
      }
    });

    // Payment method breakdown
    const paymentMethods = await prisma.billPayment.groupBy({
      by: ['type'],
      where: {
        createdAt: {
          gte: start,
          lte: end
        }
      },
      _sum: {
        amount: true
      },
      _count: {
        id: true
      }
    });

    // Insurance vs cash revenue
    const insuranceRevenue = await prisma.billing.aggregate({
      where: {
        status: 'INSURANCE_CLAIMED',
        createdAt: {
          gte: start,
          lte: end
        }
      },
      _sum: {
        totalAmount: true
      },
      _count: {
        id: true
      }
    });

    const cashRevenue = await prisma.billing.aggregate({
      where: {
        status: 'PAID',
        insuranceId: null,
        createdAt: {
          gte: start,
          lte: end
        }
      },
      _sum: {
        totalAmount: true
      },
      _count: {
        id: true
      }
    });

    res.json({
      period: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      },
      revenueTrends,
      topServices: topServices.map(ts => ({
        ...ts,
        service: topServiceDetails.find(tsd => tsd.id === ts.serviceId)
      })),
      paymentMethods,
      revenueBreakdown: {
        insurance: insuranceRevenue._sum.totalAmount || 0,
        cash: cashRevenue._sum.totalAmount || 0,
        total: (insuranceRevenue._sum.totalAmount || 0) + (cashRevenue._sum.totalAmount || 0)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all nurses (users with role=NURSE)
exports.getNurses = async (req, res) => {
  try {
    const nurses = await prisma.user.findMany({
      where: {
        role: 'NURSE',
        availability: true
      },
      select: {
        id: true,
        fullname: true,
        username: true,
        email: true,
        phone: true,
        qualifications: true,
        availability: true,
        createdAt: true
      },
      orderBy: { fullname: 'asc' }
    });

    res.json({ nurses });
  } catch (error) {
    console.error('Error fetching nurses:', error);
    res.status(500).json({ error: error.message });
  }
};

// Comprehensive Revenue Stats for Admin Dashboard (ALL users, not just current user)
exports.getRevenueStats = async (req, res) => {
  try {
    const { period = 'daily', startDate, endDate } = req.query;

    // Calculate date range based on period
    let start, end;
    const now = new Date();

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      switch (period) {
        case 'daily':
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          end = new Date(start);
          end.setDate(end.getDate() + 1);
          break;
        case 'weekly':
          const dayOfWeek = now.getDay();
          start = new Date(now);
          start.setDate(start.getDate() - dayOfWeek);
          start.setHours(0, 0, 0, 0);
          end = new Date(start);
          end.setDate(end.getDate() + 7);
          break;
        case 'monthly':
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          break;
        case 'yearly':
          start = new Date(now.getFullYear(), 0, 1);
          end = new Date(now.getFullYear() + 1, 0, 1);
          break;
        default:
          start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          end = new Date(start);
          end.setDate(end.getDate() + 1);
      }
    }

    // ========== MEDICAL REVENUE (Completed/PAID) ==========
    // Get all PAID payments from BillPayment (not user-specific)
    const medicalPayments = await prisma.billPayment.findMany({
      where: {
        createdAt: {
          gte: start,
          lt: end
        }
      },
      include: {
        billing: {
          include: {
            services: {
              include: {
                service: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Count completed visits
    const completedVisits = await prisma.visit.count({
      where: {
        status: 'COMPLETED',
        updatedAt: {
          gte: start,
          lt: end
        }
      }
    });

    // Count lab tests completed
    const labTests = await prisma.labOrder.count({
      where: {
        status: 'COMPLETED',
        updatedAt: {
          gte: start,
          lt: end
        }
      }
    });

    // Count radiology scans completed
    const radiologyScans = await prisma.radiologyOrder.count({
      where: {
        status: 'COMPLETED',
        updatedAt: {
          gte: start,
          lt: end
        }
      }
    });

    // Calculate medical revenue breakdown
    const medicalRevenue = medicalPayments.reduce((sum, p) => sum + p.amount, 0);
    const medicalByType = medicalPayments.reduce((acc, p) => {
      acc[p.type] = acc[p.type] || { count: 0, amount: 0 };
      acc[p.type].count += 1;
      acc[p.type].amount += p.amount;
      return acc;
    }, {});

    const medicalTransactions = await prisma.cashTransaction.findMany({
      where: {
        billingId: { not: null },
        type: 'PAYMENT_RECEIVED',
        createdAt: {
          gte: start,
          lt: end
        }
      },
      include: {
        billing: {
          include: {
            services: {
              include: {
                service: true
              }
            }
          }
        }
      }
    });

    const medicalCategoryBreakdown = await EMPTY_BUCKET_TOTALS_ASYNC();
    const walkInFlagsByBilling = await buildWalkInBillingFlags(medicalTransactions.map((tx) => tx.billingId));

    medicalTransactions.forEach((tx) => {
      if (!tx.billing) return;
      const walkInFlags = walkInFlagsByBilling.get(tx.billingId) || null;
      const allocation = allocateBillingAmountWithWalkInSplit(
        tx.billing,
        tx.amount || 0,
        walkInFlags
      );
      Object.keys(medicalCategoryBreakdown).forEach((bucket) => {
        medicalCategoryBreakdown[bucket] += allocation[bucket] || 0;
      });
    });

    // ========== PHARMACY REVENUE (Completed/PAID) ==========
    // Get all PAID pharmacy invoices
    const pharmacyInvoices = await prisma.pharmacyInvoice.findMany({
      where: {
        status: 'PAID',
        createdAt: {
          gte: start,
          lt: end
        }
      },
      include: {
        dispensedMedicines: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const pharmacyRevenue = pharmacyInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const prescriptions = pharmacyInvoices.length;
    const medicationsDispensed = pharmacyInvoices.reduce((sum, inv) =>
      sum + inv.dispensedMedicines.length, 0
    );

    // ========== PENDING MEDICAL BILLS ==========
    const pendingMedicalBills = await prisma.billing.findMany({
      where: {
        status: 'PENDING',
        createdAt: {
          gte: start,
          lt: end
        },
        NOT: {
          billingType: 'EMERGENCY'
        }
      },
      select: {
        totalAmount: true
      }
    });

    const pendingMedicalRevenue = pendingMedicalBills.reduce((sum, b) => sum + b.totalAmount, 0);

    // ========== PENDING PHARMACY INVOICES ==========
    const pendingPharmacyInvoices = await prisma.pharmacyInvoice.findMany({
      where: {
        status: 'PENDING',
        createdAt: {
          gte: start,
          lt: end
        }
      },
      select: {
        totalAmount: true
      }
    });

    const pendingPharmacyRevenue = pendingPharmacyInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

    // ========== RESPONSE STRUCTURE ==========
    const response = {
      period,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      completed: {
        medical: {
          revenue: medicalRevenue,
          transactions: medicalPayments.length,
          consultations: completedVisits,
          labTests,
          radiologyScans,
          byType: medicalByType,
          categoryBreakdown: medicalCategoryBreakdown
        },
        pharmacy: {
          revenue: pharmacyRevenue,
          prescriptions,
          medications: medicationsDispensed,
          transactions: pharmacyInvoices.length
        },
        combined: {
          totalRevenue: medicalRevenue + pharmacyRevenue,
          totalTransactions: medicalPayments.length + pharmacyInvoices.length
        }
      },
      pending: {
        medical: {
          revenue: pendingMedicalRevenue,
          bills: pendingMedicalBills.length
        },
        pharmacy: {
          revenue: pendingPharmacyRevenue,
          invoices: pendingPharmacyInvoices.length
        },
        combined: {
          totalRevenue: pendingMedicalRevenue + pendingPharmacyRevenue,
          totalBills: pendingMedicalBills.length + pendingPharmacyInvoices.length
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting revenue stats:', error);
    res.status(500).json({ error: error.message });
  }
};

// Export financial report to Excel (CSV)
exports.exportFinancialReportExcel = async (req, res) => {
  try {
    const { period, revenueType, year, month, dailyBreakdown } = req.body;
    const fs = require('fs');
    const path = require('path');

    // Build CSV content
    const headers = ['Date', 'Medical Revenue (ETB)', 'Pharmacy Revenue (ETB)', 'Total Revenue (ETB)'];
    const rows = [];

    if (dailyBreakdown && dailyBreakdown.length > 0) {
      dailyBreakdown.forEach(day => {
        rows.push([
          new Date(day.date).toLocaleDateString(),
          (day.medical?.revenue || 0).toFixed(2),
          (day.pharmacy?.revenue || 0).toFixed(2),
          (day.combined?.revenue || 0).toFixed(2)
        ]);
      });
    } else {
      // If no data, add a message row
      rows.push(['No data available for the selected period', '', '', '']);
    }

    const csvContent = [
      `${getDefaultClinicName()} - Financial Report`,
      `Period: ${period === 'daily' ? 'Daily' : `${getMonthName(month)} ${year}`}`,
      `Revenue Type: ${revenueType}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const fileName = `financial-report-${revenueType}-${year}-${month + 1}-${Date.now()}.csv`;
    const filePath = path.join(__dirname, '../../uploads', fileName);
    const uploadsDir = path.dirname(filePath);

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    fs.writeFileSync(filePath, '\ufeff' + csvContent, 'utf8');

    res.json({
      message: 'Excel file generated successfully',
      fileName,
      filePath: `/uploads/${fileName}`
    });
  } catch (error) {
    console.error('Error exporting financial report to Excel:', error);
    res.status(500).json({ error: error.message });
  }
};

// Helper function to get month name
function getMonthName(monthIndex) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return months[monthIndex] || 'Unknown';
}

// Export financial report to PDF
exports.exportFinancialReportPDF = async (req, res) => {
  try {
    const { period, revenueType, year, month, dailyBreakdown, revenueStats } = req.body;
    const PdfPrinter = require('pdfmake');
    const fs = require('fs');
    const path = require('path');

    // Define fonts
    const fonts = {
      Roboto: {
        normal: path.join(__dirname, '../../node_modules/roboto-font/fonts/Roboto/roboto-regular-webfont.ttf'),
        bold: path.join(__dirname, '../../node_modules/roboto-font/fonts/Roboto/roboto-bold-webfont.ttf'),
        italics: path.join(__dirname, '../../node_modules/roboto-font/fonts/Roboto/roboto-italic-webfont.ttf'),
        bolditalics: path.join(__dirname, '../../node_modules/roboto-font/fonts/Roboto/roboto-bolditalic-webfont.ttf')
      }
    };

    const printer = new PdfPrinter(fonts);

    // Build table rows
    const tableBody = [
      [
        { text: 'Date', style: 'tableHeader', bold: true },
        { text: 'Medical Revenue (ETB)', style: 'tableHeader', bold: true, alignment: 'right' },
        { text: 'Pharmacy Revenue (ETB)', style: 'tableHeader', bold: true, alignment: 'right' },
        { text: 'Total Revenue (ETB)', style: 'tableHeader', bold: true, alignment: 'right' }
      ]
    ];

    let totalMedical = 0;
    let totalPharmacy = 0;
    let totalCombined = 0;

    if (dailyBreakdown && dailyBreakdown.length > 0) {
      dailyBreakdown.forEach(day => {
        const medical = day.medical?.revenue || 0;
        const pharmacy = day.pharmacy?.revenue || 0;
        const combined = day.combined?.revenue || 0;

        totalMedical += medical;
        totalPharmacy += pharmacy;
        totalCombined += combined;

        tableBody.push([
          new Date(day.date).toLocaleDateString(),
          { text: medical.toFixed(2), alignment: 'right' },
          { text: pharmacy.toFixed(2), alignment: 'right' },
          { text: combined.toFixed(2), alignment: 'right' }
        ]);
      });

      // Add totals row
      tableBody.push([
        { text: 'TOTAL', bold: true },
        { text: totalMedical.toFixed(2), bold: true, alignment: 'right' },
        { text: totalPharmacy.toFixed(2), bold: true, alignment: 'right' },
        { text: totalCombined.toFixed(2), bold: true, alignment: 'right' }
      ]);
    } else {
      tableBody.push([
        { text: 'No data available for the selected period', colSpan: 4, alignment: 'center', italics: true },
        {},
        {},
        {}
      ]);
    }

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      content: [
        {
          text: getDefaultClinicName(),
          style: 'clinicName',
          alignment: 'center',
          margin: [0, 0, 0, 10]
        },
        {
          text: 'Financial Report',
          style: 'subheader',
          alignment: 'center',
          margin: [0, 0, 0, 5]
        },
        {
          text: `Period: ${period === 'daily' ? 'Daily' : `${getMonthName(month)} ${year}`}`,
          style: 'field',
          alignment: 'center',
          margin: [0, 0, 0, 5]
        },
        {
          text: `Revenue Type: ${revenueType.toUpperCase()}`,
          style: 'field',
          alignment: 'center',
          margin: [0, 0, 0, 5]
        },
        {
          text: `Generated: ${new Date().toLocaleString()}`,
          style: 'field',
          alignment: 'center',
          margin: [0, 0, 0, 20]
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', '*', '*', '*'],
            body: tableBody
          },
          layout: {
            hLineWidth: (i, node) => i === 0 || i === node.table.body.length ? 1 : 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#aaa',
            vLineColor: () => '#aaa',
            paddingLeft: () => 5,
            paddingRight: () => 5,
            paddingTop: () => 5,
            paddingBottom: () => 5
          }
        },
        { text: '', margin: [0, 30, 0, 0] },
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 1, color: '#000' }],
          margin: [0, 0, 0, 5]
        },
        {
          text: 'Signature: _________________________',
          style: 'field',
          margin: [0, 0, 0, 5]
        },
        {
          text: 'Date: _________________________',
          style: 'field',
          margin: [0, 0, 0, 0]
        }
      ],
      styles: {
        clinicName: {
          fontSize: 18,
          bold: true,
          color: '#000'
        },
        subheader: {
          fontSize: 14,
          color: '#666'
        },
        field: {
          fontSize: 11,
          color: '#000'
        },
        tableHeader: {
          fontSize: 10,
          color: '#000',
          fillColor: '#f0f0f0'
        }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const fileName = `financial-report-${revenueType}-${year}-${month + 1}-${Date.now()}.pdf`;
    const filePath = path.join(__dirname, '../../uploads', fileName);
    const uploadsDir = path.dirname(filePath);

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    pdfDoc.pipe(fs.createWriteStream(filePath));
    pdfDoc.end();

    await new Promise((resolve) => {
      pdfDoc.on('end', resolve);
    });

    res.json({
      message: 'PDF generated successfully',
      fileName,
      filePath: `/uploads/${fileName}`
    });
  } catch (error) {
    console.error('Error exporting financial report to PDF:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get admin dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Total Patients
    const totalPatients = await prisma.patient.count({
      where: {
        status: 'Active'
      }
    });

    // Active Doctors (users with role DOCTOR and availability true)
    const totalDoctors = await prisma.user.count({
      where: {
        role: 'DOCTOR',
        availability: true
      }
    });

    // Active Nurses (users with role NURSE and availability true)
    const totalNurses = await prisma.user.count({
      where: {
        role: 'NURSE',
        availability: true
      }
    });

    // Pending Billings (billings with status PENDING)
    const pendingBillings = await prisma.billing.count({
      where: {
        status: 'PENDING'
      }
    });

    // Pending Lab Orders (lab orders that are not completed)
    const pendingLabOrders = await prisma.labOrder.count({
      where: {
        status: {
          in: ['UNPAID', 'PAID', 'QUEUED', 'IN_PROGRESS']
        }
      }
    });

    // Also count batch orders for lab
    const pendingBatchLabOrders = await prisma.batchOrder.count({
      where: {
        type: 'LAB',
        status: {
          in: ['UNPAID', 'PAID', 'QUEUED', 'IN_PROGRESS']
        }
      }
    });

    const totalPendingLabOrders = pendingLabOrders + pendingBatchLabOrders;

    // Pending Radiology Orders
    const pendingRadiologyOrders = await prisma.radiologyOrder.count({
      where: {
        status: {
          in: ['UNPAID', 'PAID', 'QUEUED', 'IN_PROGRESS']
        }
      }
    });

    // Also count batch orders for radiology
    const pendingBatchRadiologyOrders = await prisma.batchOrder.count({
      where: {
        type: 'RADIOLOGY',
        status: {
          in: ['UNPAID', 'PAID', 'QUEUED', 'IN_PROGRESS']
        }
      }
    });

    const totalPendingRadiologyOrders = pendingRadiologyOrders + pendingBatchRadiologyOrders;

    // Pharmacy Queue (pharmacy invoices with status PENDING)
    const pharmacyQueue = await prisma.pharmacyInvoice.count({
      where: {
        status: 'PENDING'
      }
    });

    // Today's Appointments
    const todayAppointments = await prisma.appointment.count({
      where: {
        appointmentDate: {
          gte: today,
          lt: tomorrow
        },
        status: {
          in: ['SCHEDULED', 'ARRIVED', 'IN_PROGRESS']
        }
      }
    });

    // Bed Stats
    const totalBeds = await prisma.bed.count();
    const occupiedBeds = await prisma.bed.count({
      where: { status: 'OCCUPIED' }
    });

    // Active Visits (visits with active statuses today)
    const activeVisits = await prisma.visit.count({
      where: {
        status: {
          in: ['WAITING_FOR_DOCTOR', 'IN_DOCTOR_QUEUE', 'UNDER_DOCTOR_REVIEW', 'IN_PROGRESS', 'TRIAGED', 'AWAITING_RESULTS_REVIEW', 'SENT_TO_LAB', 'SENT_TO_RADIOLOGY']
        },
        createdAt: { gte: today, lt: tomorrow }
      }
    });

    // Total Revenue (paid billings + pharmacy invoices today)
    const paidBillings = await prisma.billing.findMany({
      where: { status: 'PAID', updatedAt: { gte: today, lt: tomorrow } },
      select: { totalAmount: true }
    });
    const paidPharmacy = await prisma.pharmacyInvoice.findMany({
      where: { status: 'PAID', updatedAt: { gte: today, lt: tomorrow } },
      select: { totalAmount: true }
    });
    const totalRevenue = [...paidBillings, ...paidPharmacy].reduce((s, i) => s + i.totalAmount, 0);

    // Total Doctor Encounters today
    const totalDoctorEncounters = await prisma.visit.count({
      where: {
        status: { in: ['UNDER_DOCTOR_REVIEW', 'COMPLETED'] },
        updatedAt: { gte: today, lt: tomorrow }
      }
    });

    res.json({
      totalPatients,
      totalDoctors,
      totalNurses,
      pendingBillings,
      pendingLabOrders: totalPendingLabOrders,
      pendingRadiologyOrders: totalPendingRadiologyOrders,
      pharmacyQueue,
      todayAppointments,
      totalBeds,
      occupiedBeds,
      activeVisits,
      totalRevenue,
      totalDoctorEncounters
    });
  } catch (error) {
    console.error('Error fetching admin dashboard stats:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get daily breakdown for a specific month
exports.getDailyBreakdown = async (req, res) => {
  try {
    const { year, month } = req.query; // e.g., year=2025, month=10 (0-based)

    const daysInMonth = new Date(year, parseInt(month) + 1, 0).getDate();
    const dailyData = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStart = new Date(year, month, day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(year, month, day);
      dayEnd.setHours(23, 59, 59, 999);

      // Get medical payments for this day
      const medicalPayments = await prisma.billPayment.findMany({
        where: {
          createdAt: {
            gte: dayStart,
            lte: dayEnd
          }
        },
        include: {
          billing: {
            include: {
              services: {
                include: {
                  service: true
                }
              }
            }
          }
        }
      });

      // Get pharmacy invoices for this day
      const pharmacyInvoices = await prisma.pharmacyInvoice.findMany({
        where: {
          status: 'PAID',
          createdAt: {
            gte: dayStart,
            lte: dayEnd
          }
        }
      });

      const medicalRevenue = medicalPayments.reduce((sum, p) => sum + p.amount, 0);
      const pharmacyRevenue = pharmacyInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
      const totalRevenue = medicalRevenue + pharmacyRevenue;
      const medicalTransactions = await prisma.cashTransaction.findMany({
        where: {
          billingId: { not: null },
          type: 'PAYMENT_RECEIVED',
          createdAt: {
            gte: dayStart,
            lte: dayEnd
          }
        },
        include: {
          billing: {
            include: {
              services: {
                include: {
                  service: true
                }
              }
            }
          }
        }
      });

      const medicalCategoryBreakdown = await EMPTY_BUCKET_TOTALS_ASYNC();
      const walkInFlagsByBilling = await buildWalkInBillingFlags(medicalTransactions.map((tx) => tx.billingId));

      medicalTransactions.forEach((tx) => {
        if (!tx.billing) return;
        const walkInFlags = walkInFlagsByBilling.get(tx.billingId) || null;
        const allocation = allocateBillingAmountWithWalkInSplit(
          tx.billing,
          tx.amount || 0,
          walkInFlags
        );
        Object.keys(medicalCategoryBreakdown).forEach((bucket) => {
          medicalCategoryBreakdown[bucket] += allocation[bucket] || 0;
        });
      });

      dailyData.push({
        date: `${year}-${String(parseInt(month) + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        day,
        medical: {
          revenue: medicalRevenue,
          transactions: medicalPayments.length,
          categoryBreakdown: medicalCategoryBreakdown
        },
        pharmacy: {
          revenue: pharmacyRevenue,
          transactions: pharmacyInvoices.length
        },
        combined: {
          revenue: totalRevenue,
          transactions: medicalPayments.length + pharmacyInvoices.length
        }
      });
    }

    res.json({ dailyData });
  } catch (error) {
    console.error('Error getting daily breakdown:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get doctor performance statistics
exports.getDoctorPerformanceStats = async (req, res) => {
  try {
    const { period = 'daily', doctorId } = req.query;
    const DOCTOR_REPORT_QUALIFICATIONS = [
      'DERMATOLOGY',
      'DERMATOLOGIST',
      'Dermatology',
      'Dermatologist',
      'HEALTH OFFICER',
      'HEALTH_OFFICER',
      'Health Officer',
      'Health_Officer'
    ];
    const PROCEDURE_CATEGORIES = ['PROCEDURE', 'DENTAL', 'TREATMENT'];
    const LAB_CATEGORIES = ['LAB'];
    const EMERGENCY_MEDICATION_CATEGORIES = ['EMERGENCY_DRUG'];
    const DOCTOR_REPORT_CATEGORIES = [...PROCEDURE_CATEGORIES, ...LAB_CATEGORIES, ...EMERGENCY_MEDICATION_CATEGORIES];

    // Calculate date range based on period
    const now = new Date();
    let startDate, endDate;

    if (period === 'daily') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (period === 'weekly') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (period === 'yearly') {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    }

    // Get all doctors with consultation fees
    const doctors = await prisma.user.findMany({
      where: {
        OR: [
          { role: 'DOCTOR' },
          { qualifications: { hasSome: DOCTOR_REPORT_QUALIFICATIONS } }
        ],
        ...(doctorId && { id: doctorId })
      },
      select: {
        id: true,
        fullname: true,
        role: true,
        qualifications: true,
        consultationFee: true
      }
    });

    const results = await Promise.all(doctors.map(async (doctor) => {
      // First, get assignment IDs for this doctor
      const assignments = await prisma.assignment.findMany({
        where: {
          doctorId: doctor.id
        },
        select: {
          id: true
        }
      });
      const assignmentIds = assignments.map(a => a.id);

      console.log(`🔍 Doctor ${doctor.fullname} (${doctor.id}):`);
      console.log(`   - Assignment IDs: ${assignmentIds.length}`);
      console.log(`   - Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

      // Get assignments created in the date range for this doctor
      const doctorAssignments = await prisma.assignment.findMany({
        where: {
          doctorId: doctor.id,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          id: true,
          patientId: true
        }
      });
      
      const doctorAssignmentIds = doctorAssignments.map(a => a.id);
      const assignedPatientIdsFromAssignments = new Set(doctorAssignments.map(a => a.patientId).filter(Boolean));

      // Patients treated should reflect assigned patients in the selected period,
      // Also include visits where suggestedDoctorId matches and created in date range
      const assignedVisits = await prisma.visit.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          },
          OR: [
            { suggestedDoctorId: doctor.id },
            ...(doctorAssignmentIds.length > 0 ? [{ assignmentId: { in: doctorAssignmentIds } }] : [])
          ]
        },
        select: {
          id: true,
          patientId: true
        }
      });

      // Combine patient IDs from both assignments and visits
      const allAssignedPatientIds = new Set([
        ...assignedPatientIdsFromAssignments,
        ...(assignedVisits || []).map(v => v.patientId).filter(Boolean)
      ]);
      
      const totalPatients = allAssignedPatientIds.size;

      // Procedure revenue is based on procedure lines created in the selected period.
      const procedureLines = await prisma.billingService.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          },
          service: {
            category: { in: DOCTOR_REPORT_CATEGORIES }
          },
          billing: {
            visit: assignmentIds.length > 0
              ? {
                OR: [
                  { suggestedDoctorId: doctor.id },
                  { assignmentId: { in: assignmentIds } }
                ]
              }
              : {
                suggestedDoctorId: doctor.id
              }
          }
        },
        include: {
          billing: {
            select: {
              id: true,
              visitId: true,
              status: true,
              visit: {
                select: {
                  id: true,
                  createdAt: true,
                  patientId: true,
                  patient: {
                    select: {
                      name: true
                    }
                  }
                }
              }
            }
          },
          service: {
            select: {
              id: true,
              code: true,
              name: true,
              category: true
            }
          }
        }
      });

      console.log(`   - Doctor report lines found: ${procedureLines.length}`);

      // Calculate statistics
      const sectionStats = {
        procedures: { revenue: 0, orders: 0, patientIds: new Set() },
        labs: { revenue: 0, orders: 0, patientIds: new Set() },
        emergencyMedications: { revenue: 0, orders: 0, patientIds: new Set() }
      };

      procedureLines.forEach((line) => {
        const visit = line.billing?.visit;
        if (!visit) return;

        const category = line.service?.category;
        let targetSection = null;
        if (PROCEDURE_CATEGORIES.includes(category)) {
          targetSection = sectionStats.procedures;
        } else if (LAB_CATEGORIES.includes(category)) {
          targetSection = sectionStats.labs;
        } else if (EMERGENCY_MEDICATION_CATEGORIES.includes(category)) {
          targetSection = sectionStats.emergencyMedications;
        }

        if (!targetSection) return;

        targetSection.revenue += line.totalPrice || 0;
        targetSection.orders += 1;
        if (visit.patientId) {
          targetSection.patientIds.add(visit.patientId);
        }
      });

      const allPatientIds = new Set([
        ...sectionStats.procedures.patientIds,
        ...sectionStats.labs.patientIds,
        ...sectionStats.emergencyMedications.patientIds
      ]);

      const procedureRevenue = sectionStats.procedures.revenue;
      const labRevenue = sectionStats.labs.revenue;
      const emergencyMedicationRevenue = sectionStats.emergencyMedications.revenue;
      const totalRevenue = procedureRevenue + labRevenue + emergencyMedicationRevenue;
      const avgPerPatient = totalPatients > 0 ? totalRevenue / totalPatients : 0;

      console.log(`   - Procedure Revenue: ${procedureRevenue}`);
      console.log(`   - Lab Revenue: ${labRevenue}`);
      console.log(`   - Emergency Medication Revenue: ${emergencyMedicationRevenue}`);
      console.log(`   - Total Patients: ${totalPatients}`);

      const visitMap = new Map();
      procedureLines.forEach((line) => {
        const visit = line.billing?.visit;
        if (!visit || visitMap.has(visit.id)) return;
        visitMap.set(visit.id, {
          id: visit.id,
          date: visit.createdAt,
          patientId: visit.patientId,
          patientName: visit.patient?.name || 'Unknown'
        });
      });

      return {
        doctorId: doctor.id,
        doctorName: doctor.fullname,
        role: doctor.role,
        qualifications: doctor.qualifications || [],
        consultationFee: doctor.consultationFee,
        totalPatients,
        totalRevenue,
        procedureRevenue,
        procedureOrders: sectionStats.procedures.orders,
        procedurePatients: sectionStats.procedures.patientIds.size,
        labRevenue,
        labOrders: sectionStats.labs.orders,
        labPatients: sectionStats.labs.patientIds.size,
        emergencyMedicationRevenue,
        emergencyMedicationOrders: sectionStats.emergencyMedications.orders,
        emergencyMedicationPatients: sectionStats.emergencyMedications.patientIds.size,
        avgPerPatient,
        visits: Array.from(visitMap.values())
      };
    }));

    const doctorIdsForFilter = doctors.map((d) => d.id);

    const [cardUsage, medicalTreatedByDermatology] = await Promise.all([
      getCardServiceUsageCounts(startDate, endDate, doctorIdsForFilter),
      getDermatologyMedicalTreatedCount(startDate, endDate, doctorIdsForFilter)
    ]);

    // Calculate summary statistics
    const summary = {
      totalConsultationFees: results.reduce((sum, r) => sum + r.procedureRevenue, 0),
      totalProcedureRevenue: results.reduce((sum, r) => sum + r.procedureRevenue, 0),
      totalProcedureOrders: results.reduce((sum, r) => sum + r.procedureOrders, 0),
      totalLabRevenue: results.reduce((sum, r) => sum + (r.labRevenue || 0), 0),
      totalLabOrders: results.reduce((sum, r) => sum + (r.labOrders || 0), 0),
      totalEmergencyMedicationRevenue: results.reduce((sum, r) => sum + (r.emergencyMedicationRevenue || 0), 0),
      totalEmergencyMedicationOrders: results.reduce((sum, r) => sum + (r.emergencyMedicationOrders || 0), 0),
      totalRevenue: results.reduce((sum, r) => sum + (r.totalRevenue || 0), 0),
      avgPerDoctor: results.length > 0 ? results.reduce((sum, r) => sum + (r.totalRevenue || 0), 0) / results.length : 0,
      totalConsultations: results.reduce((sum, r) => sum + r.totalPatients, 0),
      topPerformer: results.reduce((top, current) => (current.totalRevenue || 0) > (top?.totalRevenue || 0) ? current : top, results[0] || null),
      cardUsage,
      medicalTreatedByDermatology
    };

    res.json({
      period,
      dateRange: { startDate, endDate },
      summary,
      doctors: results
    });
  } catch (error) {
    console.error('Error getting doctor performance stats:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get doctor daily breakdown for calendar view
exports.getDoctorDailyBreakdown = async (req, res) => {
  try {
    const { doctorId, year, month } = req.query;
    const PROCEDURE_CATEGORIES = ['PROCEDURE', 'DENTAL', 'TREATMENT'];
    const LAB_CATEGORIES = ['LAB'];
    const EMERGENCY_MEDICATION_CATEGORIES = ['EMERGENCY_DRUG'];
    const DOCTOR_REPORT_CATEGORIES = [...PROCEDURE_CATEGORIES, ...LAB_CATEGORIES, ...EMERGENCY_MEDICATION_CATEGORIES];

    if (!doctorId) {
      return res.status(400).json({ error: 'Doctor ID is required' });
    }

    const y = parseInt(year || new Date().getFullYear());
    const m = parseInt(month || new Date().getMonth());
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const dailyData = [];

    // Get assignment IDs for this doctor
    const assignments = await prisma.assignment.findMany({
      where: {
        doctorId: doctorId
      },
      select: {
        id: true
      }
    });
    const assignmentIds = assignments.map(a => a.id);

    const monthStart = new Date(y, m, 1, 0, 0, 0, 0);
    const monthEnd = new Date(y, m + 1, 0, 23, 59, 59, 999);
    const medicalTreatedLogs = await prisma.auditLog.findMany({
      where: {
        action: 'DERM_MEDICAL_TREATED_MARK',
        userId: doctorId,
        createdAt: {
          gte: monthStart,
          lte: monthEnd
        }
      },
      select: { createdAt: true }
    });

    const medicalTreatedByDay = new Map();
    medicalTreatedLogs.forEach((log) => {
      const d = new Date(log.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      medicalTreatedByDay.set(key, (medicalTreatedByDay.get(key) || 0) + 1);
    });

    console.log(`🔍 Daily Breakdown - Doctor ID: ${doctorId}`);
    console.log(`   - Assignment IDs: ${assignmentIds.length}`);
    console.log(`   - Month: ${m + 1}, Year: ${y}`);

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStart = new Date(y, m, day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(y, m, day);
      dayEnd.setHours(23, 59, 59, 999);

      // Get assignments created on this day for this doctor
      const dayAssignments = await prisma.assignment.findMany({
        where: {
          doctorId: doctorId,
          createdAt: {
            gte: dayStart,
            lte: dayEnd
          }
        },
        select: {
          id: true,
          patientId: true
        }
      });
      
      const dayAssignmentIds = dayAssignments.map(a => a.id);
      const assignedPatientIdsFromDayAssignments = new Set(dayAssignments.map(a => a.patientId).filter(Boolean));

      // Get visits created on this day with doctor assignment
      const dayVisits = await prisma.visit.findMany({
        where: {
          createdAt: {
            gte: dayStart,
            lte: dayEnd
          },
          OR: [
            { suggestedDoctorId: doctorId },
            ...(dayAssignmentIds.length > 0 ? [{ assignmentId: { in: dayAssignmentIds } }] : [])
          ]
        },
        select: {
          id: true,
          patientId: true
        }
      });
      
      // Combine patient IDs from both assignments and visits for this day
      const dayAssignedPatientIds = new Set([
        ...assignedPatientIdsFromDayAssignments,
        ...dayVisits.map(v => v.patientId).filter(Boolean)
      ]);
      
      const assignedPatientsCount = dayAssignedPatientIds.size;

      // Use procedure lines created on this day, then attribute them to the doctor via visit linkage.
      const procedureLines = await prisma.billingService.findMany({
        where: {
          createdAt: {
            gte: dayStart,
            lte: dayEnd
          },
          service: {
            category: { in: DOCTOR_REPORT_CATEGORIES }
          },
          billing: {
            visit: assignmentIds.length > 0
              ? {
                OR: [
                  { suggestedDoctorId: doctorId },
                  { assignmentId: { in: assignmentIds } }
                ]
              }
              : {
                suggestedDoctorId: doctorId
              }
          }
        },
        include: {
          billing: {
            select: {
              id: true,
              visitId: true,
              status: true
              ,
              visit: {
                select: {
                  id: true,
                  patientId: true,
                  patient: {
                    select: {
                      name: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      const sectionStats = {
        procedures: { revenue: 0, orders: 0, patientIds: new Set() },
        labs: { revenue: 0, orders: 0, patientIds: new Set() },
        emergencyMedications: { revenue: 0, orders: 0, patientIds: new Set() }
      };
      const detailsByVisit = new Map();

      for (const line of procedureLines) {
        const visitData = line.billing?.visit;
        if (!visitData) continue;

        const visitId = visitData.id;

        if (!detailsByVisit.has(visitId)) {
          detailsByVisit.set(visitId, {
            visitId,
            patientId: visitData.patientId,
            patientName: visitData.patient?.name || 'Unknown',
            amount: 0,
            paymentStatus: line.billing?.status || 'PENDING',
            ordersCount: 0
          });
        }

        const category = line.service?.category;
        let targetSection = null;
        if (PROCEDURE_CATEGORIES.includes(category)) {
          targetSection = sectionStats.procedures;
        } else if (LAB_CATEGORIES.includes(category)) {
          targetSection = sectionStats.labs;
        } else if (EMERGENCY_MEDICATION_CATEGORIES.includes(category)) {
          targetSection = sectionStats.emergencyMedications;
        }

        if (targetSection) {
          targetSection.revenue += line.totalPrice || 0;
          targetSection.orders += 1;
          if (visitData.patientId) {
            targetSection.patientIds.add(visitData.patientId);
          }
        }

        const current = detailsByVisit.get(visitId);
        current.amount += line.totalPrice || 0;
        current.ordersCount += 1;
      }

      const details = Array.from(detailsByVisit.values()).sort((a, b) => b.amount - a.amount);
      const treatedPatientCount = new Set([
        ...sectionStats.procedures.patientIds,
        ...sectionStats.labs.patientIds,
        ...sectionStats.emergencyMedications.patientIds
      ]).size;
      const procedurePatientCount = sectionStats.procedures.patientIds.size;
      const labPatientCount = sectionStats.labs.patientIds.size;
      const emergencyMedicationPatientCount = sectionStats.emergencyMedications.patientIds.size;
      const procedureRevenue = sectionStats.procedures.revenue;
      const labRevenue = sectionStats.labs.revenue;
      const emergencyMedicationRevenue = sectionStats.emergencyMedications.revenue;
      const totalRevenue = procedureRevenue + labRevenue + emergencyMedicationRevenue;
      const totalOrders = sectionStats.procedures.orders + sectionStats.labs.orders + sectionStats.emergencyMedications.orders;

      dailyData.push({
        date: `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        day,
        revenue: totalRevenue,
        totalRevenue,
        procedureRevenue,
        labRevenue,
        emergencyMedicationRevenue,
        patients: assignedPatientsCount,
        treatedPatients: treatedPatientCount,
        procedurePatients: procedurePatientCount,
        labPatients: labPatientCount,
        emergencyMedicationPatients: emergencyMedicationPatientCount,
        procedureOrders: sectionStats.procedures.orders,
        labOrders: sectionStats.labs.orders,
        emergencyMedicationOrders: sectionStats.emergencyMedications.orders,
        totalOrders,
        medicalTreatedByDermatology: medicalTreatedByDay.get(`${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`) || 0,
        details
      });
    }

    res.json({ dailyData });
  } catch (error) {
    console.error('Error getting doctor daily breakdown:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get detailed procedure list for one doctor on one day (loaded on demand for performance)
exports.getDoctorDayProcedureDetails = async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    const PROCEDURE_CATEGORIES = ['PROCEDURE', 'DENTAL', 'TREATMENT'];
    const LAB_CATEGORIES = ['LAB'];
    const EMERGENCY_MEDICATION_CATEGORIES = ['EMERGENCY_DRUG'];
    const DOCTOR_REPORT_CATEGORIES = [...PROCEDURE_CATEGORIES, ...LAB_CATEGORIES, ...EMERGENCY_MEDICATION_CATEGORIES];

    if (!doctorId) {
      return res.status(400).json({ error: 'Doctor ID is required' });
    }

    if (!date) {
      return res.status(400).json({ error: 'Date is required in YYYY-MM-DD format' });
    }

    const parsedDate = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const dayStart = new Date(parsedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(parsedDate);
    dayEnd.setHours(23, 59, 59, 999);

    const assignments = await prisma.assignment.findMany({
      where: { doctorId },
      select: { id: true }
    });
    const assignmentIds = assignments.map((a) => a.id);

    const procedureLines = await prisma.billingService.findMany({
      where: {
        createdAt: {
          gte: dayStart,
          lte: dayEnd
        },
        service: {
          category: { in: DOCTOR_REPORT_CATEGORIES }
        },
        billing: {
          visit: assignmentIds.length > 0
            ? {
                OR: [
                  { suggestedDoctorId: doctorId },
                  { assignmentId: { in: assignmentIds } }
                ]
              }
            : {
                suggestedDoctorId: doctorId
              }
        }
      },
      include: {
        billing: {
          select: {
            id: true,
            visitId: true,
            status: true,
            visit: {
              select: {
                id: true,
                patientId: true,
                patient: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        },
        service: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const SECTION_CONFIG = {
      procedures: {
        categories: PROCEDURE_CATEGORIES,
        defaultServiceName: 'Procedure'
      },
      labs: {
        categories: LAB_CATEGORIES,
        defaultServiceName: 'Lab Test'
      },
      emergencyMedications: {
        categories: EMERGENCY_MEDICATION_CATEGORIES,
        defaultServiceName: 'Emergency Medication'
      }
    };

    const sectionAccumulator = {
      procedures: { detailsByVisit: new Map(), topItemsByName: new Map(), revenue: 0, orders: 0, patientIds: new Set() },
      labs: { detailsByVisit: new Map(), topItemsByName: new Map(), revenue: 0, orders: 0, patientIds: new Set() },
      emergencyMedications: { detailsByVisit: new Map(), topItemsByName: new Map(), revenue: 0, orders: 0, patientIds: new Set() }
    };

    const detectSection = (category) => {
      if (SECTION_CONFIG.procedures.categories.includes(category)) return 'procedures';
      if (SECTION_CONFIG.labs.categories.includes(category)) return 'labs';
      if (SECTION_CONFIG.emergencyMedications.categories.includes(category)) return 'emergencyMedications';
      return null;
    };

    for (const line of procedureLines) {
      const visit = line.billing?.visit;
      if (!visit) continue;

      const sectionKey = detectSection(line.service?.category);
      if (!sectionKey) continue;

      const section = sectionAccumulator[sectionKey];
      const defaultServiceName = SECTION_CONFIG[sectionKey].defaultServiceName;

      if (!section.detailsByVisit.has(visit.id)) {
        section.detailsByVisit.set(visit.id, {
          visitId: visit.id,
          patientId: visit.patientId,
          patientName: visit.patient?.name || 'Unknown',
          billingIds: new Set(),
          paymentStatus: line.billing?.status || 'PENDING',
          amount: 0,
          ordersCount: 0,
          items: []
        });
      }

      const current = section.detailsByVisit.get(visit.id);
      current.amount += line.totalPrice || 0;
      current.ordersCount += 1;
      if (line.billing?.id) {
        current.billingIds.add(line.billing.id);
      }
      current.items.push({
        serviceId: line.service?.id || null,
        serviceCode: line.service?.code || '',
        serviceName: line.service?.name || defaultServiceName,
        quantity: line.quantity || 1,
        amount: line.totalPrice || 0
      });

      const itemKey = line.service?.name || defaultServiceName;
      if (!section.topItemsByName.has(itemKey)) {
        section.topItemsByName.set(itemKey, {
          serviceName: itemKey,
          count: 0,
          revenue: 0
        });
      }

      const itemSummary = section.topItemsByName.get(itemKey);
      itemSummary.count += line.quantity || 1;
      itemSummary.revenue += line.totalPrice || 0;

      section.revenue += line.totalPrice || 0;
      section.orders += 1;
      if (visit.patientId) {
        section.patientIds.add(visit.patientId);
      }
    }

    const buildSectionResponse = (sectionKey) => {
      const section = sectionAccumulator[sectionKey];
      const details = Array.from(section.detailsByVisit.values())
        .map((item) => ({
          ...item,
          billingIds: Array.from(item.billingIds)
        }))
        .sort((a, b) => b.amount - a.amount);

      const topItems = Array.from(section.topItemsByName.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 20);

      return {
        revenue: section.revenue,
        orders: section.orders,
        patients: section.patientIds.size,
        visits: details.length,
        details,
        topItems
      };
    };

    const procedureSection = buildSectionResponse('procedures');
    const labSection = buildSectionResponse('labs');
    const emergencyMedicationSection = buildSectionResponse('emergencyMedications');
    const allDetails = [...procedureSection.details, ...labSection.details, ...emergencyMedicationSection.details]
      .sort((a, b) => b.amount - a.amount);
    const allPatients = new Set([
      ...sectionAccumulator.procedures.patientIds,
      ...sectionAccumulator.labs.patientIds,
      ...sectionAccumulator.emergencyMedications.patientIds
    ]);

    const summary = {
      procedureRevenue: procedureSection.revenue,
      procedureOrders: procedureSection.orders,
      labRevenue: labSection.revenue,
      labOrders: labSection.orders,
      emergencyMedicationRevenue: emergencyMedicationSection.revenue,
      emergencyMedicationOrders: emergencyMedicationSection.orders,
      totalRevenue: procedureSection.revenue + labSection.revenue + emergencyMedicationSection.revenue,
      totalOrders: procedureSection.orders + labSection.orders + emergencyMedicationSection.orders,
      medicalTreatedByDermatology: await getDermatologyMedicalTreatedCount(dayStart, dayEnd, [doctorId]),
      patients: allPatients.size,
      visits: allDetails.length
    };

    res.json({
      date,
      summary,
      sections: {
        procedures: procedureSection,
        labs: labSection,
        emergencyMedications: emergencyMedicationSection
      },
      topProcedures: procedureSection.topItems,
      details: procedureSection.details
    });
  } catch (error) {
    console.error('Error getting doctor day procedure details:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get billing user performance statistics (all medical billing users)
exports.getBillingPerformanceStats = async (req, res) => {
  try {
    const { period = 'daily', userId } = req.query;
    const now = new Date();
    let startDate;
    let endDate;

    if (period === 'daily') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (period === 'weekly') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    }

    const billingUsers = await prisma.user.findMany({
      where: {
        role: 'BILLING_OFFICER',
        ...(userId ? { id: userId } : {})
      },
      select: {
        id: true,
        fullname: true,
        username: true,
        role: true
      },
      orderBy: { fullname: 'asc' }
    });

    const transactions = await prisma.cashTransaction.findMany({
      where: {
        type: 'PAYMENT_RECEIVED',
        paymentMethod: {
          in: ['CASH', 'BANK', 'INSURANCE', 'CHARITY']
        },
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        ...(userId ? { processedById: userId } : {})
      },
      include: {
        processedBy: {
          select: {
            id: true,
            fullname: true,
            username: true,
            role: true
          }
        },
        billing: {
          include: {
            services: {
              include: {
                service: true
              }
            }
          }
        }
      }
    });

    const usersMap = new Map();
    const walkInFlagsByBilling = await buildWalkInBillingFlags(transactions.map((tx) => tx.billingId));

    const bucketTotals = await EMPTY_BUCKET_TOTALS_ASYNC();
    // Initialize all billing users so zero-activity users still appear in the UI list.
    billingUsers.forEach((u) => {
      usersMap.set(u.id, {
        userId: u.id,
        userName: u.fullname || u.username,
        role: u.role,
        totalAmount: 0,
        totalTransactions: 0,
        categoryBreakdown: { ...bucketTotals }
      });
    });

    transactions.forEach((tx) => {
      if (!tx.processedBy) return;
      const key = tx.processedBy.id;

      if (!usersMap.has(key)) {
        // Safety for legacy data where processor user may not currently be a billing officer.
        usersMap.set(key, {
          userId: tx.processedBy.id,
          userName: tx.processedBy.fullname || tx.processedBy.username,
          role: tx.processedBy.role,
          totalAmount: 0,
          totalTransactions: 0,
          categoryBreakdown: { ...bucketTotals }
        });
      }

      const item = usersMap.get(key);
      item.totalAmount += tx.amount || 0;
      item.totalTransactions += 1;

      const allocation = allocateBillingAmountWithWalkInSplit(
        tx.billing,
        tx.amount || 0,
        walkInFlagsByBilling.get(tx.billingId)
      );
      Object.keys(item.categoryBreakdown).forEach((bucket) => {
        item.categoryBreakdown[bucket] += allocation[bucket] || 0;
      });
    });

    const users = Array.from(usersMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);

    res.json({
      period,
      dateRange: { startDate, endDate },
      summary: {
        totalProcessedAmount: users.reduce((sum, u) => sum + u.totalAmount, 0),
        totalTransactions: users.reduce((sum, u) => sum + u.totalTransactions, 0),
        totalUsers: users.length
      },
      users
    });
  } catch (error) {
    console.error('Error getting billing performance stats:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get billing user monthly daily breakdown (lightweight calendar payload)
exports.getBillingUserDailyBreakdown = async (req, res) => {
  try {
    const { userId, year, month } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Billing user ID is required' });
    }

    const y = parseInt(year || new Date().getFullYear(), 10);
    const m = parseInt(month || new Date().getMonth(), 10);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const dailyData = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStart = new Date(y, m, day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(y, m, day);
      dayEnd.setHours(23, 59, 59, 999);

      const transactions = await prisma.cashTransaction.findMany({
        where: {
          processedById: userId,
          type: 'PAYMENT_RECEIVED',
          paymentMethod: {
            in: ['CASH', 'BANK', 'INSURANCE', 'CHARITY']
          },
          createdAt: {
            gte: dayStart,
            lte: dayEnd
          }
        },
        include: {
          billing: {
            include: {
              services: {
                include: {
                  service: true
                }
              }
            }
          }
        }
      });

      const categoryBreakdown = await EMPTY_BUCKET_TOTALS_ASYNC();
      const walkInFlagsByBilling = await buildWalkInBillingFlags(transactions.map((tx) => tx.billingId));
      transactions.forEach((tx) => {
        const allocation = allocateBillingAmountWithWalkInSplit(
          tx.billing,
          tx.amount || 0,
          walkInFlagsByBilling.get(tx.billingId)
        );
        Object.keys(categoryBreakdown).forEach((bucket) => {
          categoryBreakdown[bucket] += allocation[bucket] || 0;
        });
      });

      dailyData.push({
        date: `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        day,
        revenue: transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0),
        transactions: transactions.length,
        categoryBreakdown
      });
    }

    const allBuckets = await getCardBucketLabels();
    res.json({ dailyData, buckets: { ...STATIC_SERVICE_BUCKETS, ...allBuckets } });
  } catch (error) {
    console.error('Error getting billing user daily breakdown:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get detailed billing user transactions and service sections for one day
exports.getBillingUserDayDetails = async (req, res) => {
  try {
    const { userId, date } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Billing user ID is required' });
    }

    if (!date) {
      return res.status(400).json({ error: 'Date is required in YYYY-MM-DD format' });
    }

    const parsedDate = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const dayStart = new Date(parsedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(parsedDate);
    dayEnd.setHours(23, 59, 59, 999);

    const transactions = await prisma.cashTransaction.findMany({
      where: {
        processedById: userId,
        type: 'PAYMENT_RECEIVED',
        paymentMethod: {
          in: ['CASH', 'BANK', 'INSURANCE', 'CHARITY']
        },
        createdAt: {
          gte: dayStart,
          lte: dayEnd
        }
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true
          }
        },
        billing: {
          include: {
            services: {
              include: {
                service: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const categoryBreakdown = await EMPTY_BUCKET_TOTALS_ASYNC();
    const walkInFlagsByBilling = await buildWalkInBillingFlags(transactions.map((tx) => tx.billingId));
    const details = transactions.map((tx) => {
      const walkInFlags = walkInFlagsByBilling.get(tx.billingId);
      const allocation = allocateBillingAmountWithWalkInSplit(tx.billing, tx.amount || 0, walkInFlags);
      Object.keys(categoryBreakdown).forEach((bucket) => {
        categoryBreakdown[bucket] += allocation[bucket] || 0;
      });

      return {
        transactionId: tx.id,
        billingId: tx.billingId,
        patientId: tx.patient?.id || tx.patientId,
        patientName: tx.patient?.name || 'Unknown',
        paymentMethod: tx.paymentMethod,
        amount: tx.amount || 0,
        createdAt: tx.createdAt,
        walkInFlags: walkInFlags || { labWalkIn: false, radiologyWalkIn: false, nurseWalkIn: false },
        categoryBreakdown: allocation
      };
    });

    res.json({
      date,
      buckets: await getCardBucketLabels().then(labels => ({ ...STATIC_SERVICE_BUCKETS, ...labels })),
      summary: {
        revenue: details.reduce((sum, item) => sum + item.amount, 0),
        transactions: details.length,
        categoryBreakdown
      },
      details
    });
  } catch (error) {
    console.error('Error getting billing user day details:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get nurse performance statistics
exports.getNursePerformanceStats = async (req, res) => {
  try {
    const { period = 'daily', nurseId } = req.query;

    // Calculate date range based on period
    const now = new Date();
    let startDate, endDate;

    if (period === 'daily') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (period === 'weekly') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else if (period === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (period === 'yearly') {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    }

    // Get all nurses
    const nurses = await prisma.user.findMany({
      where: {
        role: 'NURSE',
        ...(nurseId && { id: nurseId })
      },
      select: {
        id: true,
        fullname: true,
        username: true
      }
    });

    if (nurses.length === 0) {
      return res.json({
        period,
        dateRange: { startDate, endDate },
        summary: {
          totalTriages: 0,
          totalServicesOrdered: 0,
          totalPaidServices: 0,
          regularServicesCount: 0,
          walkInServicesCount: 0,
          totalRevenue: 0,
          totalPaidRevenue: 0,
          regularRevenue: 0,
          walkInRevenue: 0,
          avgPerNurse: 0,
          topPerformer: null
        },
        nurses: []
      });
    }

    const results = await Promise.all(nurses.map(async (nurse) => {
      // Count unique visits triaged by this nurse in the selected period.
      const triageAuditLogs = await prisma.auditLog.findMany({
        where: {
          userId: nurse.id,
          action: 'RECORD_VITALS',
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          entityId: true,
          details: true
        }
      });

      const triagedVisitIds = new Set();
      triageAuditLogs.forEach(log => {
        try {
          const details = JSON.parse(log.details || '{}');
          if (details.visitId) {
            triagedVisitIds.add(details.visitId);
          }
        } catch (e) {
          // Skip invalid JSON
        }
      });
      const triageCount = triagedVisitIds.size;

      // Collect nurse assignments first, then map to PAID billing lines.
      const serviceAssignments = await prisma.nurseServiceAssignment.findMany({
        where: {
          assignedById: nurse.id,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          visitId: true,
          serviceId: true
        }
      });

      const assignmentKeys = new Set(
        serviceAssignments.map((assignment) => `${assignment.visitId}|${assignment.serviceId}`)
      );

      const visitIds = [...new Set(serviceAssignments.map((assignment) => assignment.visitId))];
      const serviceIds = [...new Set(serviceAssignments.map((assignment) => assignment.serviceId))];

      let paidServiceLines = [];

      if (visitIds.length > 0 && serviceIds.length > 0) {
        const candidateLines = await prisma.billingService.findMany({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            },
            serviceId: {
              in: serviceIds
            },
            billing: {
              status: 'PAID',
              visitId: {
                in: visitIds
              }
            }
          },
          include: {
            service: {
              select: {
                id: true,
                name: true,
                category: true
              }
            },
            billing: {
              select: {
                id: true,
                visitId: true,
                visit: {
                  select: {
                    id: true,
                    patientId: true,
                    patient: {
                      select: {
                        name: true
                      }
                    }
                  }
                }
              }
            }
          }
        });

        paidServiceLines = candidateLines.filter((line) => {
          const visitIdValue = line.billing?.visitId;
          if (!visitIdValue) return false;
          return assignmentKeys.has(`${visitIdValue}|${line.serviceId}`);
        });
      }

      const walkInOrders = await prisma.nurseWalkInOrder.findMany({
        where: {
          nurseId: nurse.id,
          status: {
            in: ['PAID', 'COMPLETED']
          },
          OR: [
            {
              completedAt: {
                gte: startDate,
                lte: endDate
              }
            },
            {
              completedAt: null,
              createdAt: {
                gte: startDate,
                lte: endDate
              }
            }
          ]
        },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              category: true,
              price: true
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

      const regularServicesCount = paidServiceLines.length;
      const regularRevenue = paidServiceLines.reduce((sum, line) => sum + (line.totalPrice || 0), 0);
      const walkInServicesCount = walkInOrders.length;
      const walkInRevenue = walkInOrders.reduce((sum, order) => sum + (order.service?.price || 0), 0);

      const totalServicesOrdered = regularServicesCount + walkInServicesCount;
      const totalPaidServices = totalServicesOrdered;
      const totalRevenue = regularRevenue + walkInRevenue;
      const totalPaidRevenue = totalRevenue;

      const uniquePatients = new Set(
        paidServiceLines
          .map((line) => line.billing?.visit?.patientId)
          .filter(Boolean)
      );
      walkInOrders.forEach((order) => {
        if (order.patient?.id) {
          uniquePatients.add(order.patient.id);
        }
      });
      const totalPatients = uniquePatients.size;

      const serviceBreakdown = {};
      paidServiceLines.forEach((line) => {
        const category = line.service?.category || 'OTHER';
        if (!serviceBreakdown[category]) {
          serviceBreakdown[category] = { count: 0, revenue: 0 };
        }
        serviceBreakdown[category].count++;
        serviceBreakdown[category].revenue += line.totalPrice || 0;
      });
      walkInOrders.forEach((order) => {
        const category = order.service?.category || 'NURSE_WALKIN';
        if (!serviceBreakdown[category]) {
          serviceBreakdown[category] = { count: 0, revenue: 0 };
        }
        serviceBreakdown[category].count++;
        serviceBreakdown[category].revenue += order.service?.price || 0;
      });

      const patientDetails = Array.from(uniquePatients).map((patientId) => {
        const patientLines = paidServiceLines.filter((line) => line.billing?.visit?.patientId === patientId);
        const patientWalkIns = walkInOrders.filter((order) => order.patient?.id === patientId);
        const patientName = patientLines[0]?.billing?.visit?.patient?.name || patientWalkIns[0]?.patient?.name || 'Unknown';
        const patientRevenue = patientLines.reduce((sum, line) => sum + (line.totalPrice || 0), 0);
        const patientWalkInRevenue = patientWalkIns.reduce((sum, order) => sum + (order.service?.price || 0), 0);

        return {
          patientId: patientId,
          patientName,
          servicesCount: patientLines.length + patientWalkIns.length,
          regularServicesCount: patientLines.length,
          walkInServicesCount: patientWalkIns.length,
          regularRevenue: patientRevenue,
          walkInRevenue: patientWalkInRevenue,
          revenue: patientRevenue + patientWalkInRevenue
        };
      });

      return {
        nurseId: nurse.id,
        nurseName: nurse.fullname,
        username: nurse.username,
        triageCount,
        totalServicesOrdered,
        totalRevenue,
        totalPaidServices,
        totalPaidRevenue,
        regularServicesCount,
        walkInServicesCount,
        regularRevenue,
        walkInRevenue,
        totalPatients,
        avgPerPatient: totalPatients > 0 ? totalRevenue / totalPatients : 0,
        serviceBreakdown,
        patientDetails
      };
    }));

    // Calculate summary statistics
    const summary = {
      totalTriages: results.reduce((sum, r) => sum + r.triageCount, 0),
      totalServicesOrdered: results.reduce((sum, r) => sum + r.totalServicesOrdered, 0),
      totalPaidServices: results.reduce((sum, r) => sum + r.totalPaidServices, 0),
      regularServicesCount: results.reduce((sum, r) => sum + (r.regularServicesCount || 0), 0),
      walkInServicesCount: results.reduce((sum, r) => sum + (r.walkInServicesCount || 0), 0),
      totalRevenue: results.reduce((sum, r) => sum + r.totalRevenue, 0),
      totalPaidRevenue: results.reduce((sum, r) => sum + r.totalPaidRevenue, 0),
      regularRevenue: results.reduce((sum, r) => sum + (r.regularRevenue || 0), 0),
      walkInRevenue: results.reduce((sum, r) => sum + (r.walkInRevenue || 0), 0),
      avgPerNurse: results.length > 0 ? results.reduce((sum, r) => sum + r.totalRevenue, 0) / results.length : 0,
      topPerformer: results.length > 0 ? results.reduce((top, current) => current.totalRevenue > top.totalRevenue ? current : top, results[0]) : null
    };

    res.json({
      period,
      dateRange: { startDate, endDate },
      summary,
      nurses: results
    });
  } catch (error) {
    console.error('Error getting nurse performance stats:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get nurse daily breakdown for calendar view
exports.getNurseDailyBreakdown = async (req, res) => {
  try {
    const { nurseId, year, month } = req.query;

    if (!nurseId) {
      return res.status(400).json({ error: 'Nurse ID is required' });
    }

    const y = parseInt(year || new Date().getFullYear());
    const m = parseInt(month || new Date().getMonth());
    const monthStart = new Date(y, m, 1, 0, 0, 0, 0);
    const monthEnd = new Date(y, m + 1, 0, 23, 59, 59, 999);
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    const dailyMap = new Map();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      dailyMap.set(date, {
        date,
        day,
        triageCount: 0,
        regularServices: 0,
        regularRevenue: 0,
        walkInServices: 0,
        walkInRevenue: 0,
        servicesOrdered: 0,
        paidServices: 0,
        revenue: 0,
        patients: 0,
        details: []
      });
    }

    const triageAuditLogs = await prisma.auditLog.findMany({
      where: {
        userId: nurseId,
        action: 'RECORD_VITALS',
        createdAt: {
          gte: monthStart,
          lte: monthEnd
        }
      },
      select: {
        createdAt: true,
        details: true
      }
    });

    const triageByDate = new Map();
    triageAuditLogs.forEach((log) => {
      const dateKey = `${log.createdAt.getFullYear()}-${String(log.createdAt.getMonth() + 1).padStart(2, '0')}-${String(log.createdAt.getDate()).padStart(2, '0')}`;
      if (!triageByDate.has(dateKey)) {
        triageByDate.set(dateKey, new Set());
      }

      try {
        const details = JSON.parse(log.details || '{}');
        if (details.visitId) {
          triageByDate.get(dateKey).add(details.visitId);
        }
      } catch (e) {
        // Skip malformed audit records.
      }
    });

    const nurseAssignments = await prisma.nurseServiceAssignment.findMany({
      where: {
        assignedById: nurseId,
        createdAt: {
          gte: monthStart,
          lte: monthEnd
        }
      },
      select: {
        visitId: true,
        serviceId: true
      }
    });

    const assignmentKeys = new Set(
      nurseAssignments.map((assignment) => `${assignment.visitId}|${assignment.serviceId}`)
    );

    const visitIds = [...new Set(nurseAssignments.map((assignment) => assignment.visitId))];
    const serviceIds = [...new Set(nurseAssignments.map((assignment) => assignment.serviceId))];

    let paidServiceLines = [];
    if (visitIds.length > 0 && serviceIds.length > 0) {
      const candidateLines = await prisma.billingService.findMany({
        where: {
          createdAt: {
            gte: monthStart,
            lte: monthEnd
          },
          serviceId: {
            in: serviceIds
          },
          billing: {
            status: 'PAID',
            visitId: {
              in: visitIds
            }
          }
        },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              category: true
            }
          },
          billing: {
            select: {
              id: true,
              visitId: true,
              visit: {
                select: {
                  patientId: true,
                  patient: {
                    select: {
                      name: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      paidServiceLines = candidateLines.filter((line) => {
        const visitIdValue = line.billing?.visitId;
        if (!visitIdValue) return false;
        return assignmentKeys.has(`${visitIdValue}|${line.serviceId}`);
      });
    }

    paidServiceLines.forEach((line) => {
      const dateKey = `${line.createdAt.getFullYear()}-${String(line.createdAt.getMonth() + 1).padStart(2, '0')}-${String(line.createdAt.getDate()).padStart(2, '0')}`;
      if (!dailyMap.has(dateKey)) return;

      const dayItem = dailyMap.get(dateKey);
      dayItem.regularServices += 1;
      dayItem.regularRevenue += line.totalPrice || 0;
      dayItem.servicesOrdered += 1;
      dayItem.paidServices += 1;
      dayItem.revenue += line.totalPrice || 0;

      const patientId = line.billing?.visit?.patientId;
      if (!dayItem._patients) {
        dayItem._patients = new Set();
      }
      if (patientId) {
        dayItem._patients.add(patientId);
      }
    });

    const walkInOrders = await prisma.nurseWalkInOrder.findMany({
      where: {
        nurseId,
        status: {
          in: ['PAID', 'COMPLETED']
        },
        OR: [
          {
            completedAt: {
              gte: monthStart,
              lte: monthEnd
            }
          },
          {
            completedAt: null,
            createdAt: {
              gte: monthStart,
              lte: monthEnd
            }
          }
        ]
      },
      include: {
        service: {
          select: {
            id: true,
            price: true,
            category: true
          }
        },
        patient: {
          select: {
            id: true
          }
        }
      }
    });

    walkInOrders.forEach((order) => {
      const sourceDate = order.completedAt || order.createdAt;
      const dateKey = `${sourceDate.getFullYear()}-${String(sourceDate.getMonth() + 1).padStart(2, '0')}-${String(sourceDate.getDate()).padStart(2, '0')}`;
      if (!dailyMap.has(dateKey)) return;

      const dayItem = dailyMap.get(dateKey);
      const amount = order.service?.price || 0;

      dayItem.walkInServices += 1;
      dayItem.walkInRevenue += amount;
      dayItem.servicesOrdered += 1;
      dayItem.paidServices += 1;
      dayItem.revenue += amount;

      if (!dayItem._patients) {
        dayItem._patients = new Set();
      }
      if (order.patient?.id) {
        dayItem._patients.add(order.patient.id);
      }
    });

    triageByDate.forEach((visitSet, dateKey) => {
      if (!dailyMap.has(dateKey)) return;
      dailyMap.get(dateKey).triageCount = visitSet.size;
    });

    const dailyData = Array.from(dailyMap.values())
      .map((item) => ({
        ...item,
        patients: item._patients ? item._patients.size : 0,
        details: []
      }))
      .map(({ _patients, ...item }) => item)
      .sort((a, b) => a.day - b.day);

    res.json({ dailyData });
  } catch (error) {
    console.error('Error getting nurse daily breakdown:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get detailed paid service list for one nurse on one day (loaded on demand)
exports.getNurseDayDetails = async (req, res) => {
  try {
    const { nurseId, date } = req.query;

    if (!nurseId) {
      return res.status(400).json({ error: 'Nurse ID is required' });
    }

    if (!date) {
      return res.status(400).json({ error: 'Date is required in YYYY-MM-DD format' });
    }

    const parsedDate = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const dayStart = new Date(parsedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(parsedDate);
    dayEnd.setHours(23, 59, 59, 999);

    const triageAuditLogs = await prisma.auditLog.findMany({
      where: {
        userId: nurseId,
        action: 'RECORD_VITALS',
        createdAt: {
          gte: dayStart,
          lte: dayEnd
        }
      },
      select: {
        details: true
      }
    });

    const triagedVisitIds = new Set();
    triageAuditLogs.forEach((log) => {
      try {
        const details = JSON.parse(log.details || '{}');
        if (details.visitId) {
          triagedVisitIds.add(details.visitId);
        }
      } catch (e) {
        // Skip malformed audit records.
      }
    });

    const nurseAssignments = await prisma.nurseServiceAssignment.findMany({
      where: {
        assignedById: nurseId,
        createdAt: {
          gte: dayStart,
          lte: dayEnd
        }
      },
      select: {
        visitId: true,
        serviceId: true
      }
    });

    const assignmentKeys = new Set(
      nurseAssignments.map((assignment) => `${assignment.visitId}|${assignment.serviceId}`)
    );
    const visitIds = [...new Set(nurseAssignments.map((assignment) => assignment.visitId))];
    const serviceIds = [...new Set(nurseAssignments.map((assignment) => assignment.serviceId))];

    let paidServiceLines = [];
    if (visitIds.length > 0 && serviceIds.length > 0) {
      const candidateLines = await prisma.billingService.findMany({
        where: {
          createdAt: {
            gte: dayStart,
            lte: dayEnd
          },
          serviceId: {
            in: serviceIds
          },
          billing: {
            status: 'PAID',
            visitId: {
              in: visitIds
            }
          }
        },
        include: {
          service: {
            select: {
              id: true,
              code: true,
              name: true,
              category: true
            }
          },
          billing: {
            select: {
              id: true,
              visitId: true,
              visit: {
                select: {
                  id: true,
                  patientId: true,
                  patient: {
                    select: {
                      name: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      paidServiceLines = candidateLines.filter((line) => {
        const visitIdValue = line.billing?.visitId;
        if (!visitIdValue) return false;
        return assignmentKeys.has(`${visitIdValue}|${line.serviceId}`);
      });
    }

    const categoryBreakdown = {};
    const regularDetails = paidServiceLines.map((line) => {
      const category = line.service?.category || 'OTHER';
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = 0;
      }
      categoryBreakdown[category] += line.totalPrice || 0;

      return {
        billingId: line.billingId,
        visitId: line.billing?.visitId || line.billing?.visit?.id || null,
        patientId: line.billing?.visit?.patientId || null,
        patientName: line.billing?.visit?.patient?.name || 'Unknown',
        serviceId: line.service?.id || null,
        serviceCode: line.service?.code || '',
        serviceName: line.service?.name || 'Service',
        serviceCategory: category,
        quantity: line.quantity || 1,
        amount: line.totalPrice || 0,
        date: line.createdAt,
        sourceType: 'REGULAR'
      };
    });

    const walkInOrders = await prisma.nurseWalkInOrder.findMany({
      where: {
        nurseId,
        status: {
          in: ['PAID', 'COMPLETED']
        },
        OR: [
          {
            completedAt: {
              gte: dayStart,
              lte: dayEnd
            }
          },
          {
            completedAt: null,
            createdAt: {
              gte: dayStart,
              lte: dayEnd
            }
          }
        ]
      },
      include: {
        service: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
            price: true
          }
        },
        patient: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        completedAt: 'desc'
      }
    });

    const walkInDetails = walkInOrders.map((order) => {
      const category = order.service?.category || 'NURSE_WALKIN';
      const amount = order.service?.price || 0;
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = 0;
      }
      categoryBreakdown[category] += amount;

      return {
        billingId: order.billingId,
        visitId: order.visitId || null,
        patientId: order.patient?.id || null,
        patientName: order.patient?.name || 'Unknown',
        serviceId: order.service?.id || null,
        serviceCode: order.service?.code || '',
        serviceName: order.service?.name || 'Walk-in Service',
        serviceCategory: category,
        quantity: 1,
        amount,
        date: order.completedAt || order.createdAt,
        sourceType: 'WALK_IN',
        walkInOrderId: order.id
      };
    });

    const details = [...regularDetails, ...walkInDetails].sort((a, b) => new Date(b.date) - new Date(a.date));

    const regularRevenue = regularDetails.reduce((sum, item) => sum + (item.amount || 0), 0);
    const walkInRevenue = walkInDetails.reduce((sum, item) => sum + (item.amount || 0), 0);

    res.json({
      date,
      summary: {
        triageCount: triagedVisitIds.size,
        regularPaidServices: regularDetails.length,
        walkInPaidServices: walkInDetails.length,
        paidServices: details.length,
        regularRevenue,
        walkInRevenue,
        revenue: regularRevenue + walkInRevenue,
        patients: new Set(details.map((item) => item.patientId).filter(Boolean)).size,
        categoryBreakdown
      },
      triagedVisitIds: Array.from(triagedVisitIds),
      details,
      regularDetails,
      walkInDetails
    });
  } catch (error) {
    console.error('Error getting nurse day details:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// LAB TEST MANAGEMENT (NEW SYSTEM)
// ============================================

// Lab Test Groups CRUD
exports.createLabTestGroup = async (req, res) => {
  try {
    const data = createLabTestGroupSchema.parse(req.body);
    const userId = req.user.id;

    const group = await prisma.labTestGroup.create({
      data: {
        ...data,
        createdBy: userId,
        updatedBy: userId,
        displayOrder: data.displayOrder || 0,
        isActive: data.isActive !== false
      }
    });

    res.status(201).json({
      message: 'Lab test group created successfully',
      group
    });
  } catch (error) {
    console.error('Error creating lab test group:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getLabTestGroups = async (req, res) => {
  try {
    const { category, isActive } = req.query;

    const whereClause = {};
    if (category) whereClause.category = category;
    if (isActive !== undefined) whereClause.isActive = isActive === 'true';

    const groups = await prisma.labTestGroup.findMany({
      where: whereClause,
      include: {
        tests: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            name: true,
            code: true,
            price: true,
            displayOrder: true
          }
        }
      },
      orderBy: { displayOrder: 'asc' }
    });

    res.json({ groups });
  } catch (error) {
    console.error('Error fetching lab test groups:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateLabTestGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const data = createLabTestGroupSchema.partial().parse(req.body);
    const userId = req.user.id;

    const group = await prisma.labTestGroup.update({
      where: { id },
      data: {
        ...data,
        updatedBy: userId
      }
    });

    res.json({
      message: 'Lab test group updated successfully',
      group
    });
  } catch (error) {
    console.error('Error updating lab test group:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteLabTestGroup = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if group has tests
    const testCount = await prisma.labTest.count({
      where: { groupId: id }
    });

    if (testCount > 0) {
      return res.status(400).json({
        error: `Cannot delete group with ${testCount} associated test(s). Please remove or reassign tests first.`
      });
    }

    await prisma.labTestGroup.delete({
      where: { id }
    });

    res.json({
      message: 'Lab test group deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting lab test group:', error);
    res.status(500).json({ error: error.message });
  }
};

// Lab Tests CRUD
exports.createLabTest = async (req, res) => {
  try {
    const data = createLabTestSchema.parse(req.body);
    const userId = req.user.id;

    // Auto-generate code if not provided
    let testCode = data.code;
    if (!testCode || testCode.trim() === '') {
      const categoryCode = data.category.substring(0, 3).toUpperCase();
      const count = await prisma.labTest.count({
        where: { category: data.category }
      });
      testCode = `${categoryCode}${String(count + 1).padStart(4, '0')}`;
    }

    // Check if code already exists
    const existingTest = await prisma.labTest.findUnique({
      where: { code: testCode }
    });

    if (existingTest) {
      return res.status(400).json({
        error: 'Test code already exists. Please choose a different code.'
      });
    }

    // Create or find service for billing
    let service = await prisma.service.findUnique({
      where: { code: testCode }
    });

    if (!service) {
      service = await prisma.service.create({
        data: {
          code: testCode,
          name: data.name,
          category: 'LAB',
          price: data.price,
          description: data.description || `${data.name} test`,
          isActive: data.isActive !== false
        }
      });
    }

    // Create test
    const test = await prisma.labTest.create({
      data: {
        name: data.name,
        code: testCode,
        category: data.category,
        description: data.description,
        price: data.price,
        unit: data.unit || 'UNIT',
        groupId: data.groupId || null,
        displayOrder: data.displayOrder || 0,
        serviceId: service.id,
        isActive: data.isActive !== false,
        createdBy: userId,
        updatedBy: userId
      }
    });

    // Create result fields if provided
    if (data.resultFields && data.resultFields.length > 0) {
      await prisma.labTestResultField.createMany({
        data: data.resultFields.map(field => ({
          testId: test.id,
          fieldName: field.fieldName,
          label: field.label,
          fieldType: field.fieldType,
          unit: field.unit || null,
          normalRange: field.normalRange || null,
          options: field.options || null,
          isRequired: field.isRequired || false,
          displayOrder: field.displayOrder || 0
        }))
      });
    }

    const testWithFields = await prisma.labTest.findUnique({
      where: { id: test.id },
      include: {
        resultFields: {
          orderBy: { displayOrder: 'asc' }
        },
        group: true,
        service: true
      }
    });

    res.status(201).json({
      message: 'Lab test created successfully',
      test: testWithFields
    });
  } catch (error) {
    console.error('Error creating lab test:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getLabTests = async (req, res) => {
  try {
    const { category, groupId, isActive } = req.query;

    const whereClause = {};
    if (category) whereClause.category = category;
    if (groupId) whereClause.groupId = groupId;
    if (isActive !== undefined) whereClause.isActive = isActive === 'true';

    const tests = await prisma.labTest.findMany({
      where: whereClause,
      include: {
        group: {
          select: {
            id: true,
            name: true,
            category: true
          }
        },
        resultFields: {
          orderBy: { displayOrder: 'asc' }
        },
        service: {
          select: {
            id: true,
            code: true,
            name: true,
            price: true
          }
        }
      },
      orderBy: [
        { category: 'asc' },
        { displayOrder: 'asc' },
        { name: 'asc' }
      ]
    });

    res.json({ tests });
  } catch (error) {
    console.error('Error fetching lab tests:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getLabTest = async (req, res) => {
  try {
    const { id } = req.params;

    const test = await prisma.labTest.findUnique({
      where: { id },
      include: {
        group: true,
        resultFields: {
          orderBy: { displayOrder: 'asc' }
        },
        service: true
      }
    });

    if (!test) {
      return res.status(404).json({ error: 'Lab test not found' });
    }

    res.json({ test });
  } catch (error) {
    console.error('Error fetching lab test:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateLabTest = async (req, res) => {
  try {
    const { id } = req.params;
    const data = createLabTestSchema.partial().parse(req.body);
    const userId = req.user.id;

    // If code is being updated, check if it already exists
    if (data.code) {
      const existingTest = await prisma.labTest.findFirst({
        where: {
          code: data.code,
          id: { not: id }
        }
      });

      if (existingTest) {
        return res.status(400).json({
          error: 'Test code already exists. Please choose a different code.'
        });
      }
    }

    // Update test
    const test = await prisma.labTest.update({
      where: { id },
      data: {
        ...data,
        updatedBy: userId
      }
    });

    // Update service if price or name changed
    if (test.serviceId && (data.price || data.name)) {
      const serviceUpdate = {};
      if (data.price) serviceUpdate.price = data.price;
      if (data.name) serviceUpdate.name = data.name;

      await prisma.service.update({
        where: { id: test.serviceId },
        data: serviceUpdate
      });
    }

    // Update result fields if provided
    if (data.resultFields) {
      // Delete existing fields
      await prisma.labTestResultField.deleteMany({
        where: { testId: id }
      });

      // Create new fields
      if (data.resultFields.length > 0) {
        await prisma.labTestResultField.createMany({
          data: data.resultFields.map(field => ({
            testId: id,
            fieldName: field.fieldName,
            label: field.label,
            fieldType: field.fieldType,
            unit: field.unit || null,
            normalRange: field.normalRange || null,
            options: field.options || null,
            isRequired: field.isRequired || false,
            displayOrder: field.displayOrder || 0
          }))
        });
      }
    }

    const testWithFields = await prisma.labTest.findUnique({
      where: { id },
      include: {
        resultFields: {
          orderBy: { displayOrder: 'asc' }
        },
        group: true,
        service: true
      }
    });

    res.json({
      message: 'Lab test updated successfully',
      test: testWithFields
    });
  } catch (error) {
    console.error('Error updating lab test:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteLabTest = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if test has orders
    const orderCount = await prisma.labTestOrder.count({
      where: { labTestId: id }
    });

    if (orderCount > 0) {
      return res.status(400).json({
        error: `Cannot delete test with ${orderCount} existing order(s). Deactivate instead.`
      });
    }

    // Delete result fields first
    await prisma.labTestResultField.deleteMany({
      where: { testId: id }
    });

    // Get service ID before deleting test
    const test = await prisma.labTest.findUnique({
      where: { id },
      select: { serviceId: true }
    });

    // Delete test
    await prisma.labTest.delete({
      where: { id }
    });

    // Optionally delete associated service (if not used elsewhere)
    if (test.serviceId) {
      const serviceUsage = await prisma.billingService.count({
        where: { serviceId: test.serviceId }
      });

      if (serviceUsage === 0) {
        await prisma.service.delete({
          where: { id: test.serviceId }
        });
      }
    }

    res.json({
      message: 'Lab test deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting lab test:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get all lab tests organized by category and groups (for ordering UI)
exports.getLabTestsForOrdering = async (req, res) => {
  try {
    const CATEGORY_ORDER = [
      'Hematology', 'Urinalysis', 'Virology', 'Serology', 'Parasitology',
      'Chemistry', 'CSF', 'Hormone', 'Bacteriology', 'Body fluid specimen', 'Fungal'
    ];

    const [groups, standaloneTests] = await Promise.all([
      prisma.labTestGroup.findMany({
        where: { isActive: true },
        include: {
          tests: {
            where: {
              AND: [
                { isActive: true },
                { OR: [{ serviceId: null }, { service: { isActive: true } }] }
              ]
            },
            orderBy: { displayOrder: 'asc' },
            select: { id: true, name: true, code: true, category: true, price: true, description: true }
          }
        },
        orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }]
      }),
      prisma.labTest.findMany({
        where: {
          AND: [
            { isActive: true },
            { groupId: null },
            { OR: [{ serviceId: null }, { service: { isActive: true } }] }
          ]
        },
        orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, code: true, category: true, price: true, description: true }
      })
    ]);

    const organized = {};
    for (const cat of CATEGORY_ORDER) {
      organized[cat] = { color: '', panels: [], standalone: [] };
    }

    // Add panels to their categories
    for (const group of groups) {
      const cat = group.category;
      if (!organized[cat]) {
        organized[cat] = { color: group.color || '', panels: [], standalone: [] };
      }
      if (!organized[cat].color && group.color) {
        organized[cat].color = group.color;
      }
      if (group.tests && group.tests.length > 0) {
        organized[cat].panels.push({
          id: group.id,
          name: group.name,
          description: group.description,
          price: group.price,
          tests: group.tests
        });
      }
    }

    // Add standalone tests to their categories
    for (const test of standaloneTests) {
      const cat = test.category;
      if (!organized[cat]) {
        organized[cat] = { color: '', panels: [], standalone: [] };
      }
      organized[cat].standalone.push(test);
    }

    // Filter out empty categories
    const result = {};
    for (const cat of CATEGORY_ORDER) {
      const data = organized[cat];
      if (!data) continue;
      const hasPanels = data.panels.length > 0;
      const hasStandalone = data.standalone.length > 0;
      if (!hasPanels && !hasStandalone) continue;

      // Rename PICT001 for display
      for (const panel of data.panels) {
        for (const test of panel.tests) {
          if (test.code === 'PICT001') test.name = 'Malarial smear';
        }
      }
      for (const test of data.standalone) {
        if (test.code === 'PICT001') test.name = 'Malarial smear';
        if (test.code === 'BGRH001') test.name = 'Blood typing';
      }

      result[cat] = data;
    }

    // Also include non-standard categories (e.g., 'OTHER')
    for (const cat of Object.keys(organized)) {
      if (result[cat]) continue;
      const data = organized[cat];
      if (!data) continue;
      const hasPanels = data.panels.length > 0;
      const hasStandalone = data.standalone.length > 0;
      if (!hasPanels && !hasStandalone) continue;
      for (const panel of data.panels) {
        for (const test of panel.tests) {
          if (test.code === 'PICT001') test.name = 'Malarial smear';
        }
      }
      for (const test of data.standalone) {
        if (test.code === 'PICT001') test.name = 'Malarial smear';
        if (test.code === 'BGRH001') test.name = 'Blood typing';
      }
      result[cat] = data;
    }

    console.log('✅ [getLabTestsForOrdering] Response:', {
      categories: Object.keys(result),
      totalPanels: Object.values(result).reduce((s, c) => s + c.panels.length, 0),
      totalStandalone: Object.values(result).reduce((s, c) => s + c.standalone.length, 0)
    });

    res.json({ organized: result });
  } catch (error) {
    console.error('❌ [getLabTestsForOrdering] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// Lab Pricing (for admin ServiceCatalog price editing)
exports.getLabPricing = async (req, res) => {
  try {
    const [groups, standaloneTests] = await Promise.all([
      prisma.labTestGroup.findMany({
        where: { isActive: true },
        include: {
          tests: {
            where: { isActive: true },
            orderBy: { displayOrder: 'asc' },
            select: {
              id: true,
              name: true,
              code: true,
              category: true,
              price: true,
              description: true,
              displayOrder: true
            }
          }
        },
        orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }]
      }),
      prisma.labTest.findMany({
        where: {
          AND: [
            { isActive: true },
            { groupId: null },
            { OR: [{ serviceId: null }, { service: { isActive: true } }] }
          ]
        },
        orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          code: true,
          category: true,
          price: true,
          description: true,
          displayOrder: true
        }
      })
    ]);

    const panels = groups
      .filter(g => g.tests && g.tests.length > 0)
      .map(g => ({
      id: g.id,
      name: g.name,
      category: g.category,
      price: g.price,
      description: g.description,
      displayOrder: g.displayOrder,
      color: g.color,
      tests: g.tests
    }));

    res.json({ panels, standalone: standaloneTests });
  } catch (error) {
    console.error('❌ [getLabPricing] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// Get all patients (for admin patient management)
exports.getAllPatients = async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;

    const where = {};
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          mobile: true,
          email: true,
          gender: true,
          dob: true,
          type: true,
          status: true,
          cardStatus: true,
          createdAt: true,
          patientAccount: {
            select: {
              balance: true,
              debtOwed: true,
              accountType: true
            }
          },
          visits: {
            where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
            select: { id: true, visitUid: true, status: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          _count: {
            select: {
              visits: true,
              labTestOrders: true,
              radiologyOrders: true,
              bills: true,
              accountDeposits: true,
              accountTransactions: true,
              accountRequests: true
            }
          }
        }
      }),
      prisma.patient.count({ where })
    ]);

    // Add activeVisit field to each patient
    const patientsWithVisit = patients.map((p) => ({
      ...p,
      activeVisit: p.visits?.[0] || null,
      visits: undefined
    }));

    res.json({
      patients: patientsWithVisit,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching all patients:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete patient with cascade deletion of all related records
exports.deletePatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const userId = req.user.id;

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        _count: {
          select: {
            visits: true,
            labOrders: true,
            labTestOrders: true,
            radiologyOrders: true,
            orders: true,
            bills: true,
            payments: true,
            dispenseLogs: true,
            history: true,
            appointments: true,
            files: true,
            dentalRecords: true,
            dentalPhotos: true,
            attachedImages: true,
            pharmacyInvoices: true,
            virtualQueues: true,
            medicalCertificates: true,
            diagnosisNotes: true,
            cardActivations: true,
            cashTransactions: true,
            galleryImages: true,
            insuranceTransactions: true,
            accountDeposits: true,
            accountTransactions: true,
            accountRequests: true,
            dentalProcedureCompletions: true,
            nurseWalkInOrders: true,
            emergencyDrugOrders: true,
            materialNeedsOrders: true,
          }
        }
      }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    await prisma.$transaction(async (tx) => {
      const visits = await tx.visit.findMany({
        where: { patientId },
        select: { id: true }
      });
      const visitIds = visits.map(v => v.id);

      if (visitIds.length > 0) {
        await tx.vitalSign.deleteMany({ where: { visitId: { in: visitIds } } });
        await tx.labOrder.deleteMany({ where: { visitId: { in: visitIds } } });
        await tx.radiologyOrder.deleteMany({ where: { visitId: { in: visitIds } } });
        await tx.medicationOrder.deleteMany({ where: { visitId: { in: visitIds } } });
        await tx.dentalRecord.deleteMany({ where: { visitId: { in: visitIds } } });
        await tx.dentalPhoto.deleteMany({ where: { visitId: { in: visitIds } } });
        await tx.patientAttachedImage.deleteMany({ where: { visitId: { in: visitIds } } });
        await tx.medicalCertificate.deleteMany({ where: { visitId: { in: visitIds } } });
        await tx.diagnosisNotes.deleteMany({ where: { visitId: { in: visitIds } } });
        await tx.nurseServiceAssignment.deleteMany({ where: { visitId: { in: visitIds } } });
        await tx.emergencyDrugOrder.deleteMany({ where: { visitId: { in: visitIds } } });
        await tx.materialNeedsOrder.deleteMany({ where: { visitId: { in: visitIds } } });
        await tx.patientGallery.deleteMany({ where: { visitId: { in: visitIds } } });
        await tx.insuranceTransaction.deleteMany({ where: { visitId: { in: visitIds } } });
        await tx.accountTransaction.deleteMany({ where: { visitId: { in: visitIds } } });
        await tx.dentalProcedureCompletion.deleteMany({ where: { visitId: { in: visitIds } } });

        const bills = await tx.billing.findMany({
          where: { visitId: { in: visitIds } },
          select: { id: true }
        });
        const billingIds = bills.map(b => b.id);

        if (billingIds.length > 0) {
          await tx.billPayment.deleteMany({ where: { billingId: { in: billingIds } } });
          await tx.billingService.deleteMany({ where: { billingId: { in: billingIds } } });
          await tx.billing.deleteMany({ where: { id: { in: billingIds } } });
        }

        const batchOrders = await tx.batchOrder.findMany({
          where: { visitId: { in: visitIds } },
          select: { id: true }
        });
        const batchOrderIds = batchOrders.map(bo => bo.id);

        if (batchOrderIds.length > 0) {
          await tx.batchOrderService.deleteMany({ where: { batchOrderId: { in: batchOrderIds } } });
          await tx.batchOrder.deleteMany({ where: { id: { in: batchOrderIds } } });
        }

        const pharmacyInvoices = await tx.pharmacyInvoice.findMany({
          where: { visitId: { in: visitIds } },
          select: { id: true }
        });
        const pharmacyInvoiceIds = pharmacyInvoices.map(pi => pi.id);

        if (pharmacyInvoiceIds.length > 0) {
          await tx.pharmacyInvoiceItem.deleteMany({ where: { pharmacyInvoiceId: { in: pharmacyInvoiceIds } } });
          await tx.dispensedMedicine.deleteMany({ where: { pharmacyInvoiceId: { in: pharmacyInvoiceIds } } });
          await tx.pharmacyInvoice.deleteMany({ where: { id: { in: pharmacyInvoiceIds } } });
        }

        await tx.visit.deleteMany({ where: { id: { in: visitIds } } });
      }

      // Delete ALL Pharmacy Invoices for this patient (including walk-ins)
      const allPharmacyInvoices = await tx.pharmacyInvoice.findMany({
        where: { patientId },
        select: { id: true }
      });
      const allPharmacyInvoiceIds = allPharmacyInvoices.map(pi => pi.id);
      if (allPharmacyInvoiceIds.length > 0) {
        await tx.pharmacyInvoiceItem.deleteMany({ where: { pharmacyInvoiceId: { in: allPharmacyInvoiceIds } } });
        await tx.dispensedMedicine.deleteMany({ where: { pharmacyInvoiceId: { in: allPharmacyInvoiceIds } } });
        await tx.pharmacyInvoice.deleteMany({ where: { id: { in: allPharmacyInvoiceIds } } });
      }

      // Delete ALL bills and their related records
      const allPatientBills = await tx.billing.findMany({
        where: { patientId },
        select: { id: true }
      });
      const allBillingIds = allPatientBills.map(b => b.id);
      if (allBillingIds.length > 0) {
        await tx.billPayment.deleteMany({ where: { billingId: { in: allBillingIds } } });
        await tx.billingService.deleteMany({ where: { billingId: { in: allBillingIds } } });
        await tx.accountTransaction.deleteMany({ where: { billingId: { in: allBillingIds } } });
        await tx.cardActivation.deleteMany({ where: { billingId: { in: allBillingIds } } });
        await tx.cashTransaction.deleteMany({ where: { billingId: { in: allBillingIds } } });
        await tx.billing.deleteMany({ where: { id: { in: allBillingIds } } });
      }

      // Delete ALL patient orders (both visit-linked and non-visit-linked)
      // First get all labTestOrder IDs to delete their results
      const allPatientLabTestOrders = await tx.labTestOrder.findMany({
        where: { patientId },
        select: { id: true }
      });
      const allPatientLabTestOrderIds = allPatientLabTestOrders.map(o => o.id);
      if (allPatientLabTestOrderIds.length > 0) {
        await tx.labTestResult.deleteMany({ where: { orderId: { in: allPatientLabTestOrderIds } } });
      }

      // Handle LabOrders and their results
      const allPatientLabOrders = await tx.labOrder.findMany({
        where: { patientId },
        select: { id: true }
      });
      const allPatientLabOrderIds = allPatientLabOrders.map(o => o.id);
      if (allPatientLabOrderIds.length > 0) {
        // Delete LabResultFiles first if they exist
        const labResults = await tx.labResult.findMany({
          where: { orderId: { in: allPatientLabOrderIds } },
          select: { id: true }
        });
        const labResultIds = labResults.map(r => r.id);
        if (labResultIds.length > 0) {
          await tx.labResultFile.deleteMany({ where: { resultId: { in: labResultIds } } });
        }
        await tx.labResult.deleteMany({ where: { orderId: { in: allPatientLabOrderIds } } });
      }

      // Handle RadiologyOrders and their results
      const allPatientRadiologyOrders = await tx.radiologyOrder.findMany({
        where: { patientId },
        select: { id: true }
      });
      const allPatientRadiologyOrderIds = allPatientRadiologyOrders.map(o => o.id);
      if (allPatientRadiologyOrderIds.length > 0) {
        // Delete RadiologyResultFiles first
        const radioResults = await tx.radiologyResult.findMany({
          where: { orderId: { in: allPatientRadiologyOrderIds } },
          select: { id: true }
        });
        const radioResultIds = radioResults.map(r => r.id);
        if (radioResultIds.length > 0) {
          await tx.radiologyResultFile.deleteMany({ where: { resultId: { in: radioResultIds } } });
        }
        await tx.radiologyResult.deleteMany({ where: { orderId: { in: allPatientRadiologyOrderIds } } });
      }

      await tx.labOrder.deleteMany({ where: { patientId } });
      await tx.labTestOrder.deleteMany({ where: { patientId } });
      await tx.radiologyOrder.deleteMany({ where: { patientId } });
      await tx.medicationOrder.deleteMany({ where: { patientId } });
      await tx.batchOrder.deleteMany({ where: { patientId } });

      // Handle Admissions and their services
      const patientAdmissions = await tx.admission.findMany({
        where: { patientId },
        select: { id: true }
      });
      const admissionIds = patientAdmissions.map(a => a.id);
      if (admissionIds.length > 0) {
        await tx.admissionService.deleteMany({ where: { admissionId: { in: admissionIds } } });
        await tx.admission.deleteMany({ where: { id: { in: admissionIds } } });
      }

      await tx.referral.deleteMany({ where: { patientId } });
      await tx.internationalMedicalCertificate.deleteMany({ where: { patientId } });
      await tx.vitalSign.deleteMany({ where: { patientId } });

      await tx.assignment.deleteMany({ where: { patientId } });
      await tx.dispenseLog.deleteMany({ where: { patientId } });
      await tx.patientDiagnosis.deleteMany({ where: { patientId } });
      await tx.medicalHistory.deleteMany({ where: { patientId } });
      await tx.appointment.deleteMany({ where: { patientId } });
      await tx.file.deleteMany({ where: { patientId } });
      await tx.virtualQueue.deleteMany({ where: { patientId } });
      await tx.medicalCertificate.deleteMany({ where: { patientId } });
      await tx.diagnosisNotes.deleteMany({ where: { patientId } });
      await tx.cardActivation.deleteMany({ where: { patientId } });
      await tx.cashTransaction.deleteMany({ where: { patientId } });
      await tx.patientGallery.deleteMany({ where: { patientId } });
      await tx.insuranceTransaction.deleteMany({ where: { patientId } });
      await tx.accountDeposit.deleteMany({ where: { patientId } });
      await tx.accountTransaction.deleteMany({ where: { patientId } });
      await tx.accountRequest.deleteMany({ where: { patientId } });
      await tx.dentalProcedureCompletion.deleteMany({ where: { patientId } });
      await tx.nurseWalkInOrder.deleteMany({ where: { patientId } });
      await tx.emergencyDrugOrder.deleteMany({ where: { patientId } });
      await tx.materialNeedsOrder.deleteMany({ where: { patientId } });

      await tx.patientAccount.deleteMany({ where: { patientId } });
      await tx.patient.delete({ where: { id: patientId } });
    });

    await prisma.auditLog.create({
      data: {
        userId: userId,
        action: 'DELETE_PATIENT',
        entity: 'Patient',
        entityId: 0, // Patient IDs are strings, use 0 as placeholder
        details: JSON.stringify({
          patientId: patientId,
          patientName: patient.name,
          deletedRecords: patient._count
        }),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({
      message: 'Patient and all related records deleted successfully',
      deletedRecords: patient._count
    });
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteMultiplePatients = async (req, res) => {
  try {
    const { patientIds } = req.body;
    const userId = req.user.id;

    if (!patientIds || !Array.isArray(patientIds) || patientIds.length === 0) {
      return res.status(400).json({ error: 'No patients selected for deletion' });
    }

    let deletedCount = 0;

    for (const patientId of patientIds) {
      const patient = await prisma.patient.findUnique({
        where: { id: patientId }
      });

      if (!patient) continue;

      await prisma.$transaction(async (tx) => {
        const visits = await tx.visit.findMany({
          where: { patientId },
          select: { id: true }
        });
        const visitIds = visits.map(v => v.id);

        if (visitIds.length > 0) {
          await tx.vitalSign.deleteMany({ where: { visitId: { in: visitIds } } });
          await tx.labOrder.deleteMany({ where: { visitId: { in: visitIds } } });
          await tx.radiologyOrder.deleteMany({ where: { visitId: { in: visitIds } } });
          await tx.medicationOrder.deleteMany({ where: { visitId: { in: visitIds } } });
          await tx.dentalRecord.deleteMany({ where: { visitId: { in: visitIds } } });
          await tx.dentalPhoto.deleteMany({ where: { visitId: { in: visitIds } } });
          await tx.patientAttachedImage.deleteMany({ where: { visitId: { in: visitIds } } });
          await tx.medicalCertificate.deleteMany({ where: { visitId: { in: visitIds } } });
          await tx.diagnosisNotes.deleteMany({ where: { visitId: { in: visitIds } } });
          await tx.nurseServiceAssignment.deleteMany({ where: { visitId: { in: visitIds } } });
          await tx.emergencyDrugOrder.deleteMany({ where: { visitId: { in: visitIds } } });
          await tx.materialNeedsOrder.deleteMany({ where: { visitId: { in: visitIds } } });
          await tx.patientGallery.deleteMany({ where: { visitId: { in: visitIds } } });
          await tx.insuranceTransaction.deleteMany({ where: { visitId: { in: visitIds } } });
          await tx.accountTransaction.deleteMany({ where: { visitId: { in: visitIds } } });
          await tx.dentalProcedureCompletion.deleteMany({ where: { visitId: { in: visitIds } } });

          const bills = await tx.billing.findMany({
            where: { visitId: { in: visitIds } },
            select: { id: true }
          });
          const billingIds = bills.map(b => b.id);

          if (billingIds.length > 0) {
            await tx.billPayment.deleteMany({ where: { billingId: { in: billingIds } } });
            await tx.billingService.deleteMany({ where: { billingId: { in: billingIds } } });
            await tx.accountTransaction.deleteMany({ where: { billingId: { in: billingIds } } });
            await tx.cardActivation.deleteMany({ where: { billingId: { in: billingIds } } });
            await tx.cashTransaction.deleteMany({ where: { billingId: { in: billingIds } } });
            await tx.billing.deleteMany({ where: { id: { in: billingIds } } });
          }

          const batchOrders = await tx.batchOrder.findMany({
            where: { visitId: { in: visitIds } },
            select: { id: true }
          });
          const batchOrderIds = batchOrders.map(bo => bo.id);

          if (batchOrderIds.length > 0) {
            await tx.batchOrderService.deleteMany({ where: { batchOrderId: { in: batchOrderIds } } });
            await tx.batchOrder.deleteMany({ where: { id: { in: batchOrderIds } } });
          }

          const pharmacyInvoices = await tx.pharmacyInvoice.findMany({
            where: { visitId: { in: visitIds } },
            select: { id: true }
          });
          const pharmacyInvoiceIds = pharmacyInvoices.map(pi => pi.id);

          if (pharmacyInvoiceIds.length > 0) {
            await tx.pharmacyInvoiceItem.deleteMany({ where: { pharmacyInvoiceId: { in: pharmacyInvoiceIds } } });
            await tx.dispensedMedicine.deleteMany({ where: { pharmacyInvoiceId: { in: pharmacyInvoiceIds } } });
            await tx.pharmacyInvoice.deleteMany({ where: { id: { in: pharmacyInvoiceIds } } });
          }

          await tx.visit.deleteMany({ where: { id: { in: visitIds } } });
        }

        // Delete ALL Pharmacy Invoices for this patient (including walk-ins)
        const allPharmacyInvoices = await tx.pharmacyInvoice.findMany({
          where: { patientId },
          select: { id: true }
        });
        const allPharmacyInvoiceIds = allPharmacyInvoices.map(pi => pi.id);
        if (allPharmacyInvoiceIds.length > 0) {
          await tx.pharmacyInvoiceItem.deleteMany({ where: { pharmacyInvoiceId: { in: allPharmacyInvoiceIds } } });
          await tx.dispensedMedicine.deleteMany({ where: { pharmacyInvoiceId: { in: allPharmacyInvoiceIds } } });
          await tx.pharmacyInvoice.deleteMany({ where: { id: { in: allPharmacyInvoiceIds } } });
        }

        // Delete bills that are directly linked to patient (not just through visits)
        const allPatientBills = await tx.billing.findMany({
          where: { patientId },
          select: { id: true }
        });
        const allBillingIds = allPatientBills.map(b => b.id);
        if (allBillingIds.length > 0) {
          await tx.billPayment.deleteMany({ where: { billingId: { in: allBillingIds } } });
          await tx.billingService.deleteMany({ where: { billingId: { in: allBillingIds } } });
          await tx.accountTransaction.deleteMany({ where: { billingId: { in: allBillingIds } } });
          await tx.cardActivation.deleteMany({ where: { billingId: { in: allBillingIds } } });
          await tx.cashTransaction.deleteMany({ where: { billingId: { in: allBillingIds } } });
          await tx.billing.deleteMany({ where: { id: { in: allBillingIds } } });
        }

        // Delete ALL patient orders (both visit-linked and non-visit-linked)
        const allPatientLabTestOrders = await tx.labTestOrder.findMany({
          where: { patientId },
          select: { id: true }
        });
        const allPatientLabTestOrderIds = allPatientLabTestOrders.map(o => o.id);
        if (allPatientLabTestOrderIds.length > 0) {
          await tx.labTestResult.deleteMany({ where: { orderId: { in: allPatientLabTestOrderIds } } });
        }

        // Handle LabOrders and their results
        const allPatientLabOrders = await tx.labOrder.findMany({
          where: { patientId },
          select: { id: true }
        });
        const allPatientLabOrderIds = allPatientLabOrders.map(o => o.id);
        if (allPatientLabOrderIds.length > 0) {
          const labResults = await tx.labResult.findMany({
            where: { orderId: { in: allPatientLabOrderIds } },
            select: { id: true }
          });
          const labResultIds = labResults.map(r => r.id);
          if (labResultIds.length > 0) {
            await tx.labResultFile.deleteMany({ where: { resultId: { in: labResultIds } } });
          }
          await tx.labResult.deleteMany({ where: { orderId: { in: allPatientLabOrderIds } } });
        }

        // Handle RadiologyOrders and their results
        const allPatientRadiologyOrders = await tx.radiologyOrder.findMany({
          where: { patientId },
          select: { id: true }
        });
        const allPatientRadiologyOrderIds = allPatientRadiologyOrders.map(o => o.id);
        if (allPatientRadiologyOrderIds.length > 0) {
          const radioResults = await tx.radiologyResult.findMany({
            where: { orderId: { in: allPatientRadiologyOrderIds } },
            select: { id: true }
          });
          const radioResultIds = radioResults.map(r => r.id);
          if (radioResultIds.length > 0) {
            await tx.radiologyResultFile.deleteMany({ where: { resultId: { in: radioResultIds } } });
          }
          await tx.radiologyResult.deleteMany({ where: { orderId: { in: allPatientRadiologyOrderIds } } });
        }

        await tx.labOrder.deleteMany({ where: { patientId } });
        await tx.labTestOrder.deleteMany({ where: { patientId } });
        await tx.radiologyOrder.deleteMany({ where: { patientId } });
        await tx.medicationOrder.deleteMany({ where: { patientId } });
        await tx.batchOrder.deleteMany({ where: { patientId } });

        // Deletals for Admission, Referral, InternationalMedicalCertificate, VitalSign
        const patientAdmissions = await tx.admission.findMany({
          where: { patientId },
          select: { id: true }
        });
        const admissionIds = patientAdmissions.map(a => a.id);
        if (admissionIds.length > 0) {
          await tx.admissionService.deleteMany({ where: { admissionId: { in: admissionIds } } });
          await tx.admission.deleteMany({ where: { id: { in: admissionIds } } });
        }
        await tx.referral.deleteMany({ where: { patientId } });
        await tx.internationalMedicalCertificate.deleteMany({ where: { patientId } });
        await tx.vitalSign.deleteMany({ where: { patientId } });

        await tx.assignment.deleteMany({ where: { patientId } });
        await tx.dispenseLog.deleteMany({ where: { patientId } });
        await tx.patientDiagnosis.deleteMany({ where: { patientId } });
        await tx.medicalHistory.deleteMany({ where: { patientId } });
        await tx.appointment.deleteMany({ where: { patientId } });
        await tx.file.deleteMany({ where: { patientId } });
        await tx.virtualQueue.deleteMany({ where: { patientId } });
        await tx.medicalCertificate.deleteMany({ where: { patientId } });
        await tx.diagnosisNotes.deleteMany({ where: { patientId } });
        await tx.cardActivation.deleteMany({ where: { patientId } });
        await tx.cashTransaction.deleteMany({ where: { patientId } });
        await tx.patientGallery.deleteMany({ where: { patientId } });
        await tx.insuranceTransaction.deleteMany({ where: { patientId } });
        await tx.accountDeposit.deleteMany({ where: { patientId } });
        await tx.accountTransaction.deleteMany({ where: { patientId } });
        await tx.accountRequest.deleteMany({ where: { patientId } });
        await tx.dentalProcedureCompletion.deleteMany({ where: { patientId } });
        await tx.nurseWalkInOrder.deleteMany({ where: { patientId } });
        await tx.emergencyDrugOrder.deleteMany({ where: { patientId } });
        await tx.materialNeedsOrder.deleteMany({ where: { patientId } });
        await tx.patientAccount.deleteMany({ where: { patientId } });
        await tx.patient.delete({ where: { id: patientId } });
      });

      deletedCount++;
    }

    await prisma.auditLog.create({
      data: {
        userId: userId,
        action: 'DELETE_PATIENTS_BULK',
        entity: 'Patient',
        entityId: 0,
        details: JSON.stringify({
          patientIds,
          deletedCount
        }),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({
      message: `${deletedCount} patient(s) and all related records clean deleted successfully`,
    });
  } catch (error) {
    console.error('Error in bulk deleting patients:', error);
    res.status(500).json({ error: error.message });
  }
};

// Complete a patient's active visit
exports.completePatientVisit = async (req, res) => {
  try {
    const { patientId } = req.params;
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const activeVisit = await prisma.visit.findFirst({
      where: { patientId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      orderBy: { createdAt: 'desc' }
    });
    if (!activeVisit) return res.status(400).json({ error: 'No active visit found' });

    await prisma.visit.update({
      where: { id: activeVisit.id },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });

    res.json({ message: 'Visit completed', visitId: activeVisit.id, visitUid: activeVisit.visitUid });
  } catch (error) {
    console.error('Error completing visit:', error);
    res.status(500).json({ error: error.message });
  }
};

// Card Products Management
exports.getDepartments = async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' }
    });
    res.json({ departments });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getCardProducts = async (req, res) => {
  try {
    const cardProducts = await prisma.cardProduct.findMany({
      orderBy: { name: 'asc' }
    });
    res.json({ cardProducts });
  } catch (error) {
    console.error('Error fetching card products:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.createCardProduct = async (req, res) => {
  try {
    const { name, slug, regPrice, actPrice, description } = req.body;

    if (!name || !slug || regPrice === undefined || actPrice === undefined) {
      return res.status(400).json({ error: 'name, slug, regPrice, and actPrice are required' });
    }

    const existing = await prisma.cardProduct.findUnique({ where: { slug } });
    if (existing) {
      return res.status(400).json({ error: `Card product with slug "${slug}" already exists` });
    }

    const cardProduct = await prisma.cardProduct.create({
      data: { name, slug: slug.toUpperCase(), regPrice, actPrice, description }
    });

    res.status(201).json({ cardProduct });
  } catch (error) {
    console.error('Error creating card product:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateCardProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, regPrice, actPrice, description, isActive } = req.body;

    const existing = await prisma.cardProduct.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Card product not found' });
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (slug !== undefined) data.slug = slug.toUpperCase();
    if (regPrice !== undefined) data.regPrice = regPrice;
    if (actPrice !== undefined) data.actPrice = actPrice;
    if (description !== undefined) data.description = description;
    if (isActive !== undefined) data.isActive = isActive;

    const cardProduct = await prisma.cardProduct.update({ where: { id }, data });

    res.json({ cardProduct });
  } catch (error) {
    console.error('Error updating card product:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.deleteCardProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.cardProduct.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Card product not found' });
    }

    await prisma.cardProduct.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({ message: 'Card product deactivated' });
  } catch (error) {
    console.error('Error deactivating card product:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getClinicSettings = async (req, res) => {
  try {
    let settings = await prisma.clinicSetting.findFirst();
    if (!settings) {
      settings = await prisma.clinicSetting.create({
        data: { name: 'Clinic', tagline: 'Quality Healthcare You Can Trust', logoUrl: '/clinic-logo.jpg' }
      });
    }
    res.json(settings);
  } catch (error) {
    console.error('Error fetching clinic settings:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateClinicSettings = async (req, res) => {
  try {
    const { name, tagline } = req.body;
    let settings = await prisma.clinicSetting.findFirst();
    if (!settings) {
      settings = await prisma.clinicSetting.create({
        data: { name: name || 'Clinic', tagline: tagline || 'Quality Healthcare You Can Trust', logoUrl: '/clinic-logo.jpg' }
      });
    } else {
      settings = await prisma.clinicSetting.update({
        where: { id: settings.id },
        data: { ...(name !== undefined && { name }), ...(tagline !== undefined && { tagline }) }
      });
    }
    res.json(settings);
  } catch (error) {
    console.error('Error updating clinic settings:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.uploadClinicLogo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const logoUrl = '/uploads/' + req.file.filename;
    let settings = await prisma.clinicSetting.findFirst();
    if (!settings) {
      settings = await prisma.clinicSetting.create({
        data: { name: 'Clinic', tagline: 'Quality Healthcare You Can Trust', logoUrl }
      });
    } else {
      settings = await prisma.clinicSetting.update({
        where: { id: settings.id },
        data: { logoUrl }
      });
    }
    res.json(settings);
  } catch (error) {
    console.error('Error uploading clinic logo:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getCentralRegister = async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 50 } = req.query;
    const where = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          bills: {
            include: { payments: true },
            orderBy: { createdAt: 'desc' },
            take: 1
          },
          visits: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { visitUid: true, date: true, status: true }
          }
        }
      }),
      prisma.patient.count({ where })
    ]);

    const rows = patients.map(p => {
      const latestBill = p.bills?.[0];
      const latestPayment = latestBill?.payments?.[0];
      const paymentType = latestPayment?.type || 'N/A';
      return {
        mrn: p.id,
        name: p.name,
        age: p.age || (p.dob ? Math.floor((Date.now() - new Date(p.dob)) / (1000 * 60 * 60 * 24 * 365.25)) : 'N/A'),
        sex: p.gender,
        disabilityStatus: p.disabilityStatus || 'N/A',
        paymentType,
        regDate: p.createdAt,
        lastVisit: p.visits?.[0] || null
      };
    });

    res.json({ rows, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    console.error('Error generating central register:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getDiseaseTallySheet = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate query parameters are required' });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid startDate or endDate format' });
    }
    end.setHours(23, 59, 59, 999);

    const diagnoses = await prisma.patientDiagnosis.findMany({
      where: {
        createdAt: { gte: start, lte: end }
      },
      include: {
        disease: true,
        patient: { select: { dob: true, gender: true } }
      }
    });

    const getAgeGroup = (dob) => {
      if (!dob) return 'Unknown';
      const age = (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (age < 1) return '<1';
      if (age < 5) return '1-4';
      if (age < 15) return '5-14';
      if (age < 30) return '15-29';
      if (age < 65) return '30-64';
      return '>=65';
    };

    const tally = {};
    for (const d of diagnoses) {
      const key = d.diseaseId;
      if (!tally[key]) {
        tally[key] = {
          diseaseName: d.disease.name,
          code: d.disease.code,
          Female: { '<1': 0, '1-4': 0, '5-14': 0, '15-29': 0, '30-64': 0, '>=65': 0 },
          Male: { '<1': 0, '1-4': 0, '5-14': 0, '15-29': 0, '30-64': 0, '>=65': 0 }
        };
      }
      const ageGroup = getAgeGroup(d.patient.dob);
      const gender = d.patient.gender === 'FEMALE' ? 'Female' : 'Male';
      if (tally[key][gender] && ageGroup in tally[key][gender]) {
        tally[key][gender][ageGroup]++;
      }
    }

    res.json(Object.values(tally));
  } catch (error) {
    console.error('Error generating disease tally:', error);
    res.status(500).json({ error: error.message });
  }
};

// ── Doctor Commissions ─────────────────────────────────────────
const COMMISSION_CATEGORIES = [
  'CONSULTATION', 'LAB', 'RADIOLOGY', 'PROCEDURE', 'DENTAL',
  'TREATMENT', 'EMERGENCY_DRUG', 'NURSE', 'DOCTOR_WALKIN'
];

exports.getDoctorCommissions = async (req, res) => {
  try {
    const doctors = await prisma.user.findMany({
      where: {
        OR: [
          { role: 'DOCTOR' },
          { qualifications: { hasSome: ['DERMATOLOGY', 'DERMATOLOGIST', 'Dermatology'] } },
        ],
        isActive: true,
      },
      select: {
        id: true,
        fullname: true,
        qualifications: true,
        consultationFee: true,
        commissions: true,
      },
      orderBy: { fullname: 'asc' },
    });

    const result = doctors.map(doc => {
      const commissionMap = {};
      for (const c of doc.commissions) {
        commissionMap[c.serviceCategory] = c.percentage;
      }
      const commissions = COMMISSION_CATEGORIES.map(cat => ({
        serviceCategory: cat,
        percentage: commissionMap[cat] || 0,
      }));
      return { id: doc.id, fullname: doc.fullname, qualifications: doc.qualifications, consultationFee: doc.consultationFee, commissions };
    });

    res.json({ doctors: result, categories: COMMISSION_CATEGORIES });
  } catch (error) {
    console.error('Error fetching doctor commissions:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getSingleDoctorCommissions = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const doctor = await prisma.user.findUnique({
      where: { id: doctorId },
      select: { id: true, fullname: true, qualifications: true, consultationFee: true, commissions: true },
    });
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

    const commissionMap = {};
    for (const c of doctor.commissions) {
      commissionMap[c.serviceCategory] = c.percentage;
    }
    const commissions = COMMISSION_CATEGORIES.map(cat => ({
      serviceCategory: cat,
      percentage: commissionMap[cat] || 0,
    }));

    res.json({ doctor: { id: doctor.id, fullname: doctor.fullname, qualifications: doctor.qualifications, consultationFee: doctor.consultationFee }, commissions, categories: COMMISSION_CATEGORIES });
  } catch (error) {
    console.error('Error fetching doctor commissions:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateDoctorCommissions = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { commissions } = req.body;

    if (!Array.isArray(commissions)) {
      return res.status(400).json({ error: 'commissions must be an array of { serviceCategory, percentage }' });
    }

    const doctor = await prisma.user.findUnique({ where: { id: doctorId } });
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

    // Upsert each commission
    for (const item of commissions) {
      const cat = String(item.serviceCategory).trim().toUpperCase();
      if (!COMMISSION_CATEGORIES.includes(cat)) continue;
      const pct = Math.min(100, Math.max(0, parseFloat(item.percentage) || 0));

      await prisma.doctorCommission.upsert({
        where: { doctorId_serviceCategory: { doctorId, serviceCategory: cat } },
        update: { percentage: pct },
        create: { doctorId, serviceCategory: cat, percentage: pct },
      });
    }

    // Return updated
    const updated = await prisma.user.findUnique({
      where: { id: doctorId },
      select: { id: true, fullname: true, commissions: true },
    });
    const commissionMap = {};
    for (const c of updated.commissions) {
      commissionMap[c.serviceCategory] = c.percentage;
    }
    const result = COMMISSION_CATEGORIES.map(cat => ({
      serviceCategory: cat,
      percentage: commissionMap[cat] || 0,
    }));

    res.json({ message: 'Commissions updated', doctorId, commissions: result });
  } catch (error) {
    console.error('Error updating doctor commissions:', error);
    res.status(500).json({ error: error.message });
  }
};
