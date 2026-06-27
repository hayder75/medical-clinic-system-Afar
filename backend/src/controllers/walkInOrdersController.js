const prisma = require('../config/database');
const { safeCreatePatient } = require('../utils/prismaCompat');

/**
 * Create a walk-in lab order for an outsider (non-patient) - NEW SYSTEM
 */
const createWalkInLabOrder = async (req, res) => {
  try {
    const { name, phone, labTestIds, notes } = req.body;
    
    if (!name || !phone || !labTestIds || !Array.isArray(labTestIds) || labTestIds.length === 0) {
      return res.status(400).json({ 
        message: 'Name, phone, and labTestIds (array) are required' 
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
          cardStatus: 'INACTIVE'
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
    
    // Calculate total amount
    const totalAmount = labTests.reduce((sum, test) => sum + test.price, 0);
    
    // Create billing record
    const billing = await prisma.billing.create({
      data: {
        patientId: outsiderId,
        totalAmount: totalAmount,
        status: 'PENDING',
        notes: notes || 'Walk-in lab order',
        services: {
          create: labTests.map(test => ({
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
    const { name, phone, testTypes, notes } = req.body;
    
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
          cardStatus: 'INACTIVE'
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
        notes: notes || 'Walk-in radiology order',
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
    
    if (!name || !phone || !serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      return res.status(400).json({ 
        message: 'Name, phone, and serviceIds (array) are required' 
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

module.exports = {
  createWalkInLabOrder,
  createWalkInRadiologyOrder,
  createWalkInNurseOrder
};
