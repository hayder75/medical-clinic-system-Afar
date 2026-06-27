const prisma = require('../config/database');
const { safeCreatePatient } = require('../utils/prismaCompat');

const normalizeOptionalText = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.toUpperCase() === 'N/A') return null;
  return text;
};

const parseGender = (value) => {
  const text = normalizeOptionalText(value);
  if (!text) return null;

  switch (text.toLowerCase()) {
    case 'male':
    case 'm':
      return 'MALE';
    case 'female':
    case 'f':
      return 'FEMALE';
    case 'other':
      return 'OTHER';
    default:
      return null;
  }
};

const parseAge = (value) => {
  const text = normalizeOptionalText(value);
  if (!text) return null;

  const parsed = Number.parseInt(text, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 130) {
    return null;
  }
  return parsed;
};

const parseBloodType = (value) => {
  const text = normalizeOptionalText(value);
  if (!text) return null;

  const normalized = text.toUpperCase().replace(/\s+/g, '');
  const map = {
    'A+': 'A_PLUS',
    'A-': 'A_MINUS',
    'B+': 'B_PLUS',
    'B-': 'B_MINUS',
    'AB+': 'AB_PLUS',
    'AB-': 'AB_MINUS',
    'O+': 'O_PLUS',
    'O-': 'O_MINUS',
    UNKNOWN: 'UNKNOWN'
  };
  return map[normalized] || null;
};

const formatBloodTypeForPrint = (enumValue) => {
  const map = {
    A_PLUS: 'A+',
    A_MINUS: 'A-',
    B_PLUS: 'B+',
    B_MINUS: 'B-',
    AB_PLUS: 'AB+',
    AB_MINUS: 'AB-',
    O_PLUS: 'O+',
    O_MINUS: 'O-',
    UNKNOWN: 'Unknown'
  };
  return map[enumValue] || null;
};

const extractWalkInMetadata = ({ gender, age, bloodType, referringDoctor }) => {
  const normalizedGender = parseGender(gender);
  const normalizedAge = parseAge(age);
  const normalizedBloodType = parseBloodType(bloodType);
  const normalizedReferringDoctor = normalizeOptionalText(referringDoctor);

  return {
    patientData: {
      ...(normalizedGender ? { gender: normalizedGender } : {}),
      ...(normalizedAge ? { age: normalizedAge } : {}),
      ...(normalizedBloodType ? { bloodType: normalizedBloodType } : {})
    },
    printable: {
      ...(normalizedGender ? { gender: normalizedGender } : {}),
      ...(normalizedAge ? { age: normalizedAge } : {}),
      ...(normalizedBloodType ? { bloodType: formatBloodTypeForPrint(normalizedBloodType) } : {}),
      ...(normalizedReferringDoctor ? { referringDoctor: normalizedReferringDoctor } : {})
    }
  };
};

const buildWalkInBillingNotes = (baseNote, customNotes, printableMeta) => {
  const lines = [normalizeOptionalText(customNotes) || baseNote];
  if (printableMeta.gender) lines.push(`Gender: ${printableMeta.gender}`);
  if (printableMeta.age) lines.push(`Age: ${printableMeta.age}`);
  if (printableMeta.bloodType) lines.push(`Blood Type: ${printableMeta.bloodType}`);
  if (printableMeta.referringDoctor) lines.push(`Referring Doctor: ${printableMeta.referringDoctor}`);
  return lines.join('\n');
};

/**
 * Create a walk-in lab order for an outsider (non-patient) - NEW SYSTEM
 */
const createWalkInLabOrder = async (req, res) => {
  try {
    const { name, phone, labTestIds, notes, gender, age, bloodType, referringDoctor } = req.body;
    const metadata = extractWalkInMetadata({ gender, age, bloodType, referringDoctor });

    if (!name || !labTestIds || !Array.isArray(labTestIds) || labTestIds.length === 0) {
      return res.status(400).json({
        message: 'Name and labTestIds (array) are required'
      });
    }

    // Generate unique ID: LAB-YYYYMMDD-NNN
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // Get today's unique ID
    let outsiderId;
    let attempt = 1;
    let patient;

    do {
      const todaysLabOrders = await prisma.labTestOrder.count({
        where: {
          createdAt: { gte: todayStart, lte: todayEnd },
          isWalkIn: true
        }
      });

      outsiderId = `LAB-${dateStr}-${String(todaysLabOrders + attempt).padStart(3, '0')}`;

      // Check if patient ID already exists
      const existing = await prisma.patient.findUnique({
        where: { id: outsiderId }
      });

      if (!existing) {
        // Create "patient" (outsider)
        patient = await safeCreatePatient(prisma, {
          id: outsiderId,
          name,
          mobile: phone,
          type: 'REGULAR',
          status: 'Active',
          cardStatus: 'INACTIVE',
          ...metadata.patientData
        });
        break;
      }
      attempt++;
    } while (true);

    // Validate lab tests
    const labTests = await prisma.labTest.findMany({
      where: {
        id: { in: labTestIds },
        isActive: true
      },
      include: {
        service: true
      }
    });

    if (labTests.length !== labTestIds.length) {
      return res.status(404).json({
        message: 'One or more lab tests not found or inactive'
      });
    }

    // Filter to only tests that have a linked Service for billing
    const billableTests = labTests.filter(test => test.serviceId);

    // Calculate total amount from billable tests only
    const totalAmount = billableTests.reduce((sum, test) => sum + test.price, 0);

    if (billableTests.length === 0) {
      return res.status(400).json({
        message: 'None of the selected lab tests have a billing service configured. Please contact an administrator to set up services.'
      });
    }

    if (billableTests.length < labTests.length) {
      console.warn(`Walk-in lab billing: ${labTests.length - billableTests.length} test(s) skipped due to missing serviceId`);
    }

    // Create billing record (only for tests with a linked Service)
    const billing = await prisma.billing.create({
      data: {
        patientId: outsiderId,
        totalAmount: totalAmount,
        status: 'PENDING',
        notes: buildWalkInBillingNotes('Walk-in lab order', notes, metadata.printable),
        services: {
          create: billableTests.map(test => ({
            serviceId: test.serviceId,
            quantity: 1,
            unitPrice: test.price,
            totalPrice: test.price
          }))
        }
      },
      include: { services: { include: { service: true } } }
    });

    // Create lab test orders and link to billing
    const createdOrders = [];
    for (const testId of labTestIds) {
      const test = labTests.find(t => t.id === testId);
      if (!test) continue;

      const labTestOrder = await prisma.labTestOrder.create({
        data: {
          labTestId: testId,
          patientId: outsiderId,
          instructions: notes,
          isWalkIn: true,
          status: 'UNPAID',
          billingId: billing.id
        },
        include: {
          labTest: {
            include: {
              service: true,
              group: true
            }
          }
        }
      });

      createdOrders.push(labTestOrder);
    }

    res.status(201).json({
      success: true,
      outsider: patient,
      billing,
      orders: createdOrders,
      message: 'Walk-in lab order created successfully'
    });

  } catch (error) {
    console.error('Error creating walk-in lab order:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Create a walk-in radiology order for an outsider (non-patient)
 */
const createWalkInRadiologyOrder = async (req, res) => {
  try {
    const { name, phone, testTypes, notes, gender, age, bloodType, referringDoctor } = req.body;

    const metadata = extractWalkInMetadata({ gender, age, bloodType, referringDoctor });

    // Generate unique ID: RAD-YYYYMMDD-NNN
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // Get today's unique ID
    let outsiderId;
    let attempt = 1;
    let patient;

    do {
      const todaysRadOrders = await prisma.radiologyOrder.count({
        where: {
          createdAt: { gte: todayStart, lte: todayEnd },
          isWalkIn: true
        }
      });

      outsiderId = `RAD-${dateStr}-${String(todaysRadOrders + attempt).padStart(3, '0')}`;

      // Check if patient ID already exists
      const existing = await prisma.patient.findUnique({
        where: { id: outsiderId }
      });

      if (!existing) {
        // Create "patient" (outsider)
        patient = await safeCreatePatient(prisma, {
          id: outsiderId,
          name,
          mobile: phone,
          type: 'REGULAR',
          status: 'Active',
          cardStatus: 'INACTIVE',
          ...metadata.patientData
        });
        break;
      }
      attempt++;
    } while (true);

    // Get investigation types with their service data
    const investigationTypes = await prisma.investigationType.findMany({
      where: {
        id: { in: testTypes },
        category: 'RADIOLOGY'
      },
      include: {
        service: true
      }
    });

    if (investigationTypes.length !== testTypes.length) {
      return res.status(404).json({
        message: 'One or more radiology test types not found or not RADIOLOGY category'
      });
    }

    // Calculate total amount
    const totalAmount = investigationTypes.reduce((sum, type) => sum + type.price, 0);

    // Create billing record
    const billing = await prisma.billing.create({
      data: {
        patientId: outsiderId,
        totalAmount: totalAmount,
        status: 'PENDING',
        notes: buildWalkInBillingNotes('Walk-in radiology order', notes, metadata.printable),
        services: {
          create: investigationTypes.map(type => ({
            serviceId: type.serviceId || type.service?.id,
            quantity: 1,
            unitPrice: type.price,
            totalPrice: type.price
          })).filter(item => item.serviceId) // Only include if serviceId exists
        }
      },
      include: { services: { include: { service: true } } }
    });

    // Create radiology orders and link to billing
    const createdOrders = [];
    for (const testTypeId of testTypes) {
      const investigationType = investigationTypes.find(t => t.id === testTypeId);
      if (!investigationType) continue;

      const radiologyOrder = await prisma.radiologyOrder.create({
        data: {
          patientId: outsiderId,
          typeId: testTypeId,
          instructions: notes,
          isWalkIn: true,
          status: 'UNPAID',
          billingId: billing.id
        },
        include: {
          type: true
        }
      });

      createdOrders.push(radiologyOrder);
    }

    res.status(201).json({
      success: true,
      outsider: patient,
      billing,
      orders: createdOrders,
      message: 'Walk-in radiology order created successfully'
    });

  } catch (error) {
    console.error('Error creating walk-in radiology order:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Create a walk-in nurse service order for an outsider (non-patient)
 */
const createWalkInNurseOrder = async (req, res) => {
  try {
    const { name, phone, serviceIds, notes } = req.body;

    if (!name || !serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      return res.status(400).json({
        message: 'Name and serviceIds (array) are required'
      });
    }

    // Generate unique ID: NURSE-YYYYMMDD-NNN
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // Get today's unique ID
    let outsiderId;
    let attempt = 1;
    let patient;

    do {
      const todaysNurseOrders = await prisma.nurseWalkInOrder.count({
        where: {
          createdAt: { gte: todayStart, lte: todayEnd }
        }
      });

      outsiderId = `NURSE-${dateStr}-${String(todaysNurseOrders + attempt).padStart(3, '0')}`;

      // Check if patient ID already exists
      const existing = await prisma.patient.findUnique({
        where: { id: outsiderId }
      });

      if (!existing) {
        // Create "patient" (outsider)
        patient = await safeCreatePatient(prisma, {
          id: outsiderId,
          name,
          mobile: phone,
          type: 'REGULAR',
          status: 'Active',
          cardStatus: 'INACTIVE'
        });
        break;
      }
      attempt++;
    } while (true);

    // Validate services (must be NURSE_WALKIN category)
    const services = await prisma.service.findMany({
      where: {
        id: { in: serviceIds },
        category: 'NURSE_WALKIN',
        isActive: true
      }
    });

    if (services.length !== serviceIds.length) {
      return res.status(404).json({
        message: 'One or more services not found, inactive, or not NURSE_WALKIN category'
      });
    }

    // Calculate total amount
    const totalAmount = services.reduce((sum, service) => sum + service.price, 0);

    // Create billing record
    const billing = await prisma.billing.create({
      data: {
        patientId: outsiderId,
        totalAmount: totalAmount,
        status: 'PENDING',
        notes: notes || 'Walk-in nurse service order',
        services: {
          create: services.map(service => ({
            serviceId: service.id,
            quantity: 1,
            unitPrice: service.price,
            totalPrice: service.price
          }))
        }
      },
      include: { services: { include: { service: true } } }
    });

    // Create nurse walk-in orders and link to billing
    const createdOrders = [];
    for (const serviceId of serviceIds) {
      const service = services.find(s => s.id === serviceId);
      if (!service) continue;

      const nurseOrder = await prisma.nurseWalkInOrder.create({
        data: {
          patientId: outsiderId,
          serviceId: serviceId,
          instructions: notes,
          status: 'UNPAID',
          billingId: billing.id
        },
        include: {
          service: true,
          patient: {
            select: {
              id: true,
              name: true,
              mobile: true
            }
          }
        }
      });

      createdOrders.push(nurseOrder);
    }

    res.status(201).json({
      success: true,
      outsider: patient,
      billing,
      orders: createdOrders,
      message: 'Walk-in nurse service order created successfully'
    });

  } catch (error) {
    console.error('Error creating walk-in nurse service order:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Create a walk-in doctor service order for an outsider (non-patient)
 */
const createWalkInDoctorOrder = async (req, res) => {
  try {
    const { name, phone, serviceIds, notes } = req.body;

    if (!name || !serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      return res.status(400).json({
        message: 'Name and serviceIds (array) are required'
      });
    }

    // Generate unique ID: DOCTOR-YYYYMMDD-NNN
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // Get today's unique ID
    let outsiderId;
    let attempt = 1;
    let patient;

    do {
      const todaysDoctorOrders = await prisma.doctorWalkInOrder.count({
        where: {
          createdAt: { gte: todayStart, lte: todayEnd }
        }
      });

      outsiderId = `DOCTOR-${dateStr}-${String(todaysDoctorOrders + attempt).padStart(3, '0')}`;

      // Check if patient ID already exists
      const existing = await prisma.patient.findUnique({
        where: { id: outsiderId }
      });

      if (!existing) {
        // Create "patient" (outsider)
        patient = await safeCreatePatient(prisma, {
          id: outsiderId,
          name,
          mobile: phone,
          type: 'REGULAR',
          status: 'Active',
          cardStatus: 'INACTIVE'
        });
        break;
      }
      attempt++;
    } while (true);

    // Validate services (must be DOCTOR_WALKIN category)
    const services = await prisma.service.findMany({
      where: {
        id: { in: serviceIds },
        category: 'DOCTOR_WALKIN',
        isActive: true
      }
    });

    if (services.length !== serviceIds.length) {
      return res.status(404).json({
        message: 'One or more services not found, inactive, or not DOCTOR_WALKIN category'
      });
    }

    // Calculate total amount
    const totalAmount = services.reduce((sum, service) => sum + service.price, 0);

    // Create billing record
    const billing = await prisma.billing.create({
      data: {
        patientId: outsiderId,
        totalAmount: totalAmount,
        status: 'PENDING',
        notes: notes || 'Walk-in doctor service order',
        services: {
          create: services.map(service => ({
            serviceId: service.id,
            quantity: 1,
            unitPrice: service.price,
            totalPrice: service.price
          }))
        }
      },
      include: { services: { include: { service: true } } }
    });

    // Create doctor walk-in orders and link to billing
    const createdOrders = [];
    for (const serviceId of serviceIds) {
      const service = services.find(s => s.id === serviceId);
      if (!service) continue;

      const doctorOrder = await prisma.doctorWalkInOrder.create({
        data: {
          patientId: outsiderId,
          serviceId: serviceId,
          instructions: notes,
          status: 'UNPAID',
          billingId: billing.id
        },
        include: {
          service: true,
          patient: {
            select: {
              id: true,
              name: true,
              mobile: true
            }
          }
        }
      });

      createdOrders.push(doctorOrder);
    }

    res.status(201).json({
      success: true,
      outsider: patient,
      billing,
      orders: createdOrders,
      message: 'Walk-in doctor service order created successfully'
    });

  } catch (error) {
    console.error('Error creating walk-in doctor service order:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createWalkInLabOrder,
  createWalkInRadiologyOrder,
  createWalkInNurseOrder,
  createWalkInDoctorOrder
};
