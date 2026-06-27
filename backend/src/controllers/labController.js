const prisma = require('../config/database');
const { z } = require('zod');
const { createPDFDocument, generatePDF } = require('../utils/pdfGenerator');
const fs = require('fs');
const path = require('path');
const { getIO } = require('../config/socket');

const individualLabResultSchema = z.object({
  labOrderId: z.number(),
  serviceId: z.number(),
  templateId: z.string(),
  results: z.object({}).passthrough(),
  additionalNotes: z.string().optional()
});

const getTemplates = async (req, res) => {
  try {
    const templates = await prisma.labTestTemplate.findMany({
      where: { isActive: true },
      orderBy: { category: 'asc' }
    });
    res.json({ templates });
  } catch (error) {
    console.error('Error fetching lab templates:', error);
    res.status(500).json({ error: error.message });
  }
};

const getOrders = async (req, res) => {
  try {
    const { date, status } = req.query;
    const where = {};

    const pendingStatuses = ['UNPAID', 'PAID', 'QUEUED', 'IN_PROGRESS'];
    const completedStatuses = ['COMPLETED'];
    const allVisibleStatuses = [...pendingStatuses, ...completedStatuses];
    const statusList = status === 'COMPLETED'
      ? completedStatuses
      : status === 'ALL'
        ? allVisibleStatuses
        : pendingStatuses;

    const batchStatusClause = status === 'COMPLETED'
      ? { status: { in: completedStatuses } }
      : status === 'ALL'
        ? {
          OR: [
            { status: { in: allVisibleStatuses } },
            { status: 'UNPAID', visit: { isEmergency: true } }
          ]
        }
        : {
          OR: [
            { status: { in: pendingStatuses } },
            { status: 'UNPAID', visit: { isEmergency: true } }
          ]
        };
    
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      where.createdAt = {
        gte: startOfDay,
        lte: endOfDay
      };
    }

    const patientSelect = { select: { id: true, name: true, gender: true, dob: true, mobile: true, bloodType: true, type: true } };
    const [batchOrders, walkInOrdersRaw, labTestOrdersRaw] = await Promise.all([
      prisma.batchOrder.findMany({
        where: { type: 'LAB', ...batchStatusClause, ...where },
        include: { patient: patientSelect, services: { include: { service: { select: { id: true, name: true, category: true } }, investigationType: { select: { id: true, name: true, category: true } } } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.labOrder.findMany({
        where: {
          isWalkIn: true,
          status: { in: statusList },
          billingId: { not: null },
          ...where
        },
        include: { patient: patientSelect, type: true, labResults: { select: { id: true, status: true, resultText: true, additionalNotes: true, createdAt: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.labTestOrder.findMany({
        where: {
          status: { in: statusList },
          OR: [{ isWalkIn: false }, { isWalkIn: true, billingId: { not: null } }],
          ...where
        },
        include: {
          labTest: { select: { id: true, name: true, category: true, groupId: true, group: { select: { id: true, name: true } }, resultFields: { orderBy: { displayOrder: 'asc' }, select: { id: true, fieldName: true, label: true, fieldType: true, options: true, unit: true, normalRange: true, displayOrder: true } } } },
          patient: patientSelect,
          doctor: { select: { id: true, fullname: true } },
          results: { select: { id: true, status: true, results: true, additionalNotes: true, processedBy: true, verifiedBy: true, verifiedAt: true, createdAt: true } }
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const billingIds = [...new Set([
      ...walkInOrdersRaw.map((order) => order.billingId).filter(Boolean),
      ...labTestOrdersRaw.filter((order) => order.isWalkIn).map((order) => order.billingId).filter(Boolean)
    ])];

    const paidBillingIds = billingIds.length
      ? new Set(
        (await prisma.billing.findMany({
          where: {
            id: { in: billingIds },
            status: 'PAID'
          },
          select: { id: true }
        })).map((billing) => billing.id)
      )
      : new Set();

    const walkInOrders = walkInOrdersRaw.filter((order) => paidBillingIds.has(order.billingId));
    const labTestOrders = labTestOrdersRaw.filter((order) => !order.isWalkIn || (order.billingId && paidBillingIds.has(order.billingId)));

    const labTestLinkedBatchIds = new Set(
      labTestOrders.map((order) => order.batchOrderId).filter(Boolean)
    );
    const labTestLinkedVisitIds = new Set(
      labTestOrders.map((order) => order.visitId).filter(Boolean)
    );

    const filteredBatchOrders = batchOrders.filter((order) => {
      const hasServices = Array.isArray(order.services) && order.services.length > 0;
      const linkedByBatchId = labTestLinkedBatchIds.has(order.id);
      const linkedByVisitId = Boolean(order.visitId) && labTestLinkedVisitIds.has(order.visitId);
      const looksLikeTemplatePlaceholder = /lab tests ordered by doctor/i.test(order.instructions || '');

      if (!hasServices && (linkedByBatchId || linkedByVisitId || looksLikeTemplatePlaceholder)) {
        return false;
      }
      return true;
    });

    res.json({ batchOrders: filteredBatchOrders, walkInOrders, labTestOrders });
  } catch (error) {
    console.error('Error fetching lab orders:', error);
    res.status(500).json({ error: error.message });
  }
};

const saveIndividualLabResult = async (req, res) => {
  try {
    const { labOrderId, serviceId, templateId, results, additionalNotes } = req.body;
    const labTechnicianId = req.user.id;
    const validated = individualLabResultSchema.parse(req.body);

    const existingResult = await prisma.labResult.findFirst({
      where: { orderId: validated.labOrderId, testTypeId: validated.serviceId }
    });

    let result;
    if (existingResult) {
      result = await prisma.labResult.update({
        where: { id: existingResult.id },
        data: {
          resultText: JSON.stringify(validated.results),
          additionalNotes: validated.additionalNotes || null,
          status: 'COMPLETED',
          verifiedBy: labTechnicianId,
          verifiedAt: new Date()
        }
      });
    } else {
      result = await prisma.labResult.create({
        data: {
          orderId: validated.labOrderId,
          testTypeId: validated.serviceId,
          resultText: JSON.stringify(validated.results),
          additionalNotes: validated.additionalNotes || null,
          status: 'COMPLETED',
          verifiedBy: labTechnicianId,
          verifiedAt: new Date()
        }
      });
    }

    res.json({ success: true, result });
  } catch (error) {
    console.error('Error saving lab result:', error);
    if (error.name === 'ZodError') return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: error.message });
  }
};

const getDetailedResults = async (req, res) => {
  try {
    const { orderId } = req.params;
    const batchOrder = await prisma.batchOrder.findUnique({
      where: { id: parseInt(orderId) },
      include: { patient: true, services: { include: { investigationType: true } }, detailedResults: { include: { template: true } }, doctor: { select: { fullname: true } } }
    });

    if (batchOrder) return res.json({ order: batchOrder, isWalkIn: false });

    const walkInOrder = await prisma.labOrder.findUnique({
      where: { id: parseInt(orderId) },
      include: { patient: true, type: true, labResults: { include: { testType: true } } }
    });

    if (walkInOrder) return res.json({ order: walkInOrder, isWalkIn: true });
    res.status(404).json({ error: 'Order not found' });
  } catch (error) {
    console.error('Error fetching detailed results:', error);
    res.status(500).json({ error: error.message });
  }
};

const sendToDoctor = async (req, res) => {
  try {
    const { labOrderId } = req.params;
    const labTechnicianId = req.user.id;
    const orderId = parseInt(labOrderId);

    let batchOrder = await prisma.batchOrder.findUnique({ where: { id: orderId }, include: { visit: true } });

    if (!batchOrder) {
      const walkInOrder = await prisma.labOrder.findUnique({ where: { id: orderId } });
      if (walkInOrder && walkInOrder.isWalkIn) {
        await prisma.labOrder.update({ where: { id: orderId }, data: { status: 'COMPLETED' } });
        return res.json({ message: 'Lab results sent to doctor successfully', batchOrderId: orderId, visitStatus: 'COMPLETED' });
      }
    }

    if (!batchOrder) return res.status(404).json({ error: 'Lab order not found' });

    await prisma.batchOrder.update({ where: { id: orderId }, data: { status: 'COMPLETED' } });

    let updatedVisit;
    if (batchOrder.visitId) {
      updatedVisit = await checkAndUpdateVisitStatus(batchOrder.visitId);
    }

    try {
      getIO().emit('queue:results-ready', {
        visitId: batchOrder.visitId,
        patientId: batchOrder.patientId,
        batchOrderId: orderId,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error('[WS] Failed to emit results-ready event:', e.message);
    }

    res.json({ message: 'Lab results sent to doctor successfully', batchOrderId: orderId, visitStatus: updatedVisit?.status || 'IN_DOCTOR_QUEUE' });
  } catch (error) {
    console.error('Error sending lab results to doctor:', error);
    res.status(500).json({ error: error.message });
  }
};

const updateLabOrderStatus = async (req, res) => {
  try {
    const { labOrderId } = req.params;
    const { status } = req.body;
    const updatedOrder = await prisma.labOrder.update({ where: { id: parseInt(labOrderId) }, data: { status } });
    res.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error('Error updating lab order status:', error);
    res.status(500).json({ error: error.message });
  }
};

const generateLabResultsPDF = async (req, res) => {
  try {
    const { batchOrderId } = req.params;
    const orderId = parseInt(batchOrderId);

    let batchOrder = await prisma.batchOrder.findUnique({
      where: { id: orderId },
      include: { patient: true, services: { include: { investigationType: true } }, detailedResults: { include: { template: true } }, doctor: { select: { fullname: true } } }
    });

    let isWalkIn = false;
    let walkInOrder = null;

    if (!batchOrder) {
      walkInOrder = await prisma.labOrder.findUnique({ where: { id: orderId }, include: { patient: true, type: true, labResults: { include: { testType: true } } } });
      if (!walkInOrder) return res.status(404).json({ error: 'Lab order not found' });
      if (!walkInOrder.isWalkIn) return res.status(400).json({ error: 'This endpoint only supports batch orders and walk-in orders' });
      isWalkIn = true;
    }

    const formatDateTime = (date) => new Date(date).toLocaleString('en-US');
    const patient = batchOrder?.patient || walkInOrder?.patient;
    const orderDate = batchOrder?.createdAt || walkInOrder?.createdAt;
    const orderStatus = batchOrder?.status || walkInOrder?.status;

    if (patient?.dob) {
      const today = new Date();
      const birthDate = new Date(patient.dob);
      patient.age = Math.floor((today - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
    }

    const pdfContent = [];
    pdfContent.push({ text: 'Laboratory Test Results', style: 'subheader', margin: [0, 0, 0, 20] });
    pdfContent.push({ text: 'Patient Information', style: 'sectionTitle' });
    pdfContent.push({ columns: [{ text: `Name: ${patient.name}`, style: 'field' }, { text: `ID: ${patient.id}`, style: 'field' }, { text: `Gender: ${patient.gender || 'N/A'}`, style: 'field' }], margin: [0, 0, 0, 5] });
    pdfContent.push({ columns: [{ text: `Age: ${patient.age || 'N/A'}`, style: 'field' }, { text: `Blood Type: ${patient.bloodType || 'N/A'}`, style: 'field' }, { text: `Phone: ${patient.mobile || 'N/A'}`, style: 'field' }], margin: [0, 0, 0, 15] });
    pdfContent.push({ text: `Order ID: ${batchOrderId} | Date: ${formatDateTime(orderDate)} | Status: ${orderStatus?.replace(/_/g, ' ') || 'N/A'}`, style: 'field', margin: [0, 0, 0, 15] });
    pdfContent.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }], margin: [0, 0, 0, 15] });
    pdfContent.push({ text: 'Laboratory Test Results', style: 'sectionTitle' });

    if (!isWalkIn && batchOrder?.detailedResults) {
      batchOrder.detailedResults.forEach((result, index) => {
        pdfContent.push({ text: `${index + 1}. ${result.template?.name || 'Test'}`, style: 'testTitle', margin: [0, 10, 0, 5] });
        if (result.results && Object.keys(result.results).length > 0) {
          const tableBody = [];
          Object.entries(result.results).forEach(([key, value]) => tableBody.push([key, String(value || '-')]));
          pdfContent.push({ table: { headerRows: 1, widths: ['*', '*'], body: tableBody }, layout: 'lightHorizontalLines', margin: [0, 5, 0, 10] });
        }
        if (result.additionalNotes) pdfContent.push({ text: `Notes: ${result.additionalNotes}`, style: 'notes', margin: [0, 5, 0, 15] });
      });
    }

    pdfContent.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }], margin: [0, 20, 0, 10] });
    pdfContent.push({ text: 'Generated by lab technician', style: 'footer', alignment: 'right' });

    const docDefinition = {
      content: pdfContent,
      styles: {
        subheader: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
        sectionTitle: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] },
        field: { fontSize: 10, margin: [0, 2, 0, 2] },
        testTitle: { fontSize: 12, bold: true },
        resultText: { fontSize: 10 },
        notes: { fontSize: 10, italics: true },
        footer: { fontSize: 8, color: 'gray' }
      }
    };

    const fileName = `lab-results-${orderId}-${Date.now()}.pdf`;
    const filePath = `uploads/${fileName}`;
    await generatePDF(docDefinition, filePath);
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Error generating lab results PDF:', error);
    res.status(500).json({ error: error.message });
  }
};

async function checkAndUpdateVisitStatus(visitId) {
  try {
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        labOrders: true,
        radiologyOrders: true,
        batchOrders: {
          where: { type: 'LAB' },
          include: {
            services: { select: { status: true } },
            labTestOrders: { select: { status: true } }
          }
        }
      }
    });
    if (!visit) return null;

    const completedStatuses = ['COMPLETED', 'CANCELLED'];

    // Keep compatibility placeholder batch orders in sync with linked LabTestOrder records.
    for (const batch of (visit.batchOrders || [])) {
      const hasLinkedLabTests = Array.isArray(batch.labTestOrders) && batch.labTestOrders.length > 0;
      if (!hasLinkedLabTests) continue;

      const hasPendingLabTests = batch.labTestOrders.some(
        (order) => !completedStatuses.includes(order.status)
      );

      if (!hasPendingLabTests && batch.status !== 'COMPLETED') {
        await prisma.batchOrder.update({
          where: { id: batch.id },
          data: { status: 'COMPLETED' }
        });
        batch.status = 'COMPLETED';
      }
    }

    const hasActiveLabOrders = visit.labOrders?.some(
      (o) => !completedStatuses.includes(o.status)
    );
    const hasActiveRadiology = visit.radiologyOrders?.some(
      (o) => !completedStatuses.includes(o.status)
    );
    const hasPendingLabBatch = (visit.batchOrders || []).some((batch) => {
      const hasLinkedLabTests = Array.isArray(batch.labTestOrders) && batch.labTestOrders.length > 0;
      const hasServices = Array.isArray(batch.services) && batch.services.length > 0;

      if (hasLinkedLabTests) {
        return batch.labTestOrders.some((order) => !completedStatuses.includes(order.status));
      }

      if (hasServices) {
        return batch.services.some((service) => !completedStatuses.includes(service.status));
      }

      // Ignore empty placeholder LAB batch orders with no child records.
      return false;
    });

    if (!hasActiveLabOrders && !hasPendingLabBatch && !hasActiveRadiology) {
      return await prisma.visit.update({ where: { id: visitId }, data: { status: 'AWAITING_RESULTS_REVIEW', queueType: 'RESULTS_REVIEW' } });
    } else if (!hasActiveLabOrders && !hasPendingLabBatch) {
      return await prisma.visit.update({ where: { id: visitId }, data: { status: 'SENT_TO_RADIOLOGY' } });
    }
    return visit;
  } catch (error) {
    console.error(`Error checking/updating visit status for visit ${visitId}:`, error);
  }
}

const getLabReports = async (req, res) => {
  try {
    const { startDate, endDate, technicianId, type } = req.query;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let start = startDate ? new Date(startDate) : today;
    let end = endDate ? new Date(endDate) : tomorrow;
    
    if (type === 'monthly') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    } else if (type === 'weekly') {
      const dayOfWeek = today.getDay();
      start = new Date(today);
      start.setDate(today.getDate() - dayOfWeek);
      end = new Date(start);
      end.setDate(start.getDate() + 6, 23, 59, 59);
    }

    const labTestOrders = await prisma.labTestOrder.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: {
        labTest: true,
        patient: { select: { id: true, name: true, gender: true, dob: true } },
        doctor: { select: { id: true, fullname: true } },
        results: {
          where: technicianId
            ? {
                OR: [
                  { processedBy: technicianId },
                  { verifiedBy: technicianId }
                ]
              }
            : {}
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const batchOrders = await prisma.batchOrder.findMany({
      where: { type: 'LAB', createdAt: { gte: start, lte: end } },
      include: {
        patient: { select: { id: true, name: true, gender: true, dob: true } },
        doctor: { select: { id: true, fullname: true } },
        services: { include: { investigationType: true } },
        detailedResults: {
          where: technicianId ? { verifiedBy: technicianId } : {},
          select: {
            serviceId: true,
            verifiedBy: true,
            verifiedAt: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const users = await prisma.user.findMany({ where: { role: 'LAB_TECHNICIAN' }, select: { id: true, fullname: true, username: true } });
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u.fullname || u.username || 'Unknown'; });

    const processedTestOrders = labTestOrders.map(order => {
      const processedBy = order.results[0]?.processedBy || order.results[0]?.verifiedBy;
      return {
        id: order.id, type: 'LAB_TEST', testName: order.labTest?.name || 'Unknown Test', testCategory: order.labTest?.category || 'General',
        patientId: order.patientId, patientName: order.patient?.name, doctorName: order.doctor?.fullname || 'Walk-in',
        status: order.status, isWalkIn: order.isWalkIn, processedBy: processedBy ? userMap[processedBy] || 'Unknown' : null,
        billingId: order.billingId,
        createdAt: order.createdAt, completedAt: order.results[0]?.verifiedAt || null
      };
    });

    const processedBatchOrders = batchOrders.map(order => {
      return (order.services || []).map(service => {
        const matchingDetailedResult = (order.detailedResults || []).find((result) => result.serviceId === service.id) || order.detailedResults?.[0] || null;
        const processedBy = matchingDetailedResult?.verifiedBy || null;
        const status = matchingDetailedResult?.status || service.status || order.status;

        return {
          id: `${order.id}-${service.id}`, type: 'BATCH_ORDER', testName: service.investigationType?.name || 'Unknown Test',
          testCategory: service.investigationType?.category || 'General', patientId: order.patientId, patientName: order.patient?.name,
          doctorName: order.doctor?.fullname || 'Unknown', status, isWalkIn: !!order.isWalkIn,
          processedBy: processedBy ? userMap[processedBy] || 'Unknown' : null,
          billingId: service.billingId || order.billingId,
          createdAt: order.createdAt, completedAt: matchingDetailedResult?.verifiedAt || (status === 'COMPLETED' ? order.updatedAt : null)
        };
      });
    }).flat();

    const allTests = [...processedTestOrders, ...processedBatchOrders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const totalTests = allTests.length;
    const walkInTests = allTests.filter(t => t.isWalkIn).length;
    const regularTests = totalTests - walkInTests;
    const completedTests = allTests.filter(t => t.status === 'COMPLETED').length;
    const pendingTests = allTests.filter(t => t.status !== 'COMPLETED').length;

    const byDate = {};
    allTests.forEach(test => {
      const dateKey = new Date(test.createdAt).toISOString().split('T')[0];
      if (!byDate[dateKey]) byDate[dateKey] = { date: dateKey, total: 0, completed: 0, pending: 0, walkIn: 0, regular: 0 };
      byDate[dateKey].total++;
      if (test.isWalkIn) byDate[dateKey].walkIn++;
      else byDate[dateKey].regular++;
      if (test.status === 'COMPLETED') byDate[dateKey].completed++;
      else byDate[dateKey].pending++;
    });

    const byCategory = {};
    allTests.forEach(test => {
      const cat = test.testCategory || 'Other';
      if (!byCategory[cat]) byCategory[cat] = { category: cat, total: 0, completed: 0 };
      byCategory[cat].total++;
      if (test.status === 'COMPLETED') byCategory[cat].completed++;
    });

    const byTechnician = {};
    users.forEach(u => {
      const name = u.fullname || u.username || 'Unknown';
      byTechnician[name] = { name, userId: u.id, total: 0, completed: 0, pending: 0, revenue: 0, pendingRevenue: 0 };
    });
    const techBillingIds = {};
    allTests.forEach(test => {
      if (test.processedBy && byTechnician[test.processedBy]) {
        byTechnician[test.processedBy].total++;
        if (test.status === 'COMPLETED') byTechnician[test.processedBy].completed++;
        else byTechnician[test.processedBy].pending++;
        if (test.billingId) {
          if (!techBillingIds[test.processedBy]) techBillingIds[test.processedBy] = new Set();
          techBillingIds[test.processedBy].add(test.billingId);
        }
      }
    });

    let financialSummary = null;
    if (req.user.role === 'ADMIN') {
      const walkInLabTestBillingIds = [...new Set(labTestOrders.filter(o => o.isWalkIn && o.billingId).map(o => o.billingId))];
      const regularLabBillingIds = [...new Set(labTestOrders.filter(o => !o.isWalkIn && o.billingId).map(o => o.billingId))];
      const walkInBatchBillingIds = [...new Set(batchOrders.filter(o => o.isWalkIn).flatMap(o => o.services?.map(s => s.billingId) || []).filter(Boolean))];
      const regularBatchBillingIds = [...new Set(batchOrders.filter(o => !o.isWalkIn).flatMap(o => o.services?.map(s => s.billingId) || []).filter(Boolean))];
      const walkInBillingIds = [...new Set([...walkInLabTestBillingIds, ...walkInBatchBillingIds])];
      const regularBillingIds = [...new Set([...regularLabBillingIds, ...regularBatchBillingIds])];
      const billingIds = [...new Set([...walkInBillingIds, ...regularBillingIds])];

      const billings = await prisma.billing.findMany({ where: { id: { in: billingIds } } });
      const walkInBillingIdSet = new Set(walkInBillingIds);
      const regularBillingIdSet = new Set(regularBillingIds);
      const billingMap = {};
      billings.forEach(b => { billingMap[b.id] = b; });

      const totalRevenue = billings.filter(b => b.status === 'PAID').reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      const pendingRevenue = billings.filter(b => b.status === 'PENDING').reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      const walkInRevenue = billings
        .filter(b => b.status === 'PAID' && walkInBillingIdSet.has(b.id))
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      const regularRevenue = billings
        .filter(b => b.status === 'PAID' && regularBillingIdSet.has(b.id))
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      const walkInPendingRevenue = billings
        .filter(b => b.status === 'PENDING' && walkInBillingIdSet.has(b.id))
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      const regularPendingRevenue = billings
        .filter(b => b.status === 'PENDING' && regularBillingIdSet.has(b.id))
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

      financialSummary = {
        totalRevenue,
        pendingRevenue,
        paidCount: billings.filter(b => b.status === 'PAID').length,
        pendingCount: billings.filter(b => b.status === 'PENDING').length,
        walkInRevenue,
        regularRevenue,
        walkInPendingRevenue,
        regularPendingRevenue,
        walkInPaidCount: billings.filter(b => b.status === 'PAID' && walkInBillingIdSet.has(b.id)).length,
        regularPaidCount: billings.filter(b => b.status === 'PAID' && regularBillingIdSet.has(b.id)).length,
        walkInPendingCount: billings.filter(b => b.status === 'PENDING' && walkInBillingIdSet.has(b.id)).length,
        regularPendingCount: billings.filter(b => b.status === 'PENDING' && regularBillingIdSet.has(b.id)).length
      };

      Object.keys(techBillingIds).forEach(techName => {
        const techBillingIdArray = [...techBillingIds[techName]];
        const techBillings = techBillingIdArray.map(id => billingMap[id]).filter(Boolean);
        byTechnician[techName].revenue = techBillings.filter(b => b.status === 'PAID').reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        byTechnician[techName].pendingRevenue = techBillings.filter(b => b.status === 'PENDING').reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      });
    }

    res.json({
      period: { start, end, type },
      summary: { totalTests, walkInTests, regularTests, completedTests, pendingTests },
      byDate: Object.values(byDate).sort((a, b) => new Date(b.date) - new Date(a.date)),
      byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
      byTechnician: Object.values(byTechnician).sort((a, b) => b.total - a.total),
      tests: allTests, financialSummary
    });
  } catch (error) {
    console.error('Error generating lab reports:', error);
    res.status(500).json({ error: error.message });
  }
};

const saveLabTestResult = async (req, res) => {
  try {
    const { orderId, labTestId, results, additionalNotes, finalize = true } = req.body;
    const labTechnicianId = req.user.id;
    const requestedFinalize = !(finalize === false || finalize === 'false');

    const normalizeResultsObject = (value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
      }
      return value;
    };

    const hasMeaningfulResults = (value) => {
      const normalized = normalizeResultsObject(value);
      return Object.values(normalized).some((item) => {
        if (item === null || item === undefined) return false;
        if (typeof item === 'string') return item.trim() !== '';
        if (Array.isArray(item)) return item.length > 0;
        if (typeof item === 'object') return Object.keys(item).length > 0;
        return true;
      });
    };

    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }

    const order = await prisma.labTestOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ error: 'Lab test order not found' });
    }

    const existingResult = await prisma.labTestResult.findUnique({
      where: { orderId_testId: { orderId, testId: order.labTestId } }
    });

    const incomingResults = normalizeResultsObject(results);
    const existingStoredResults = normalizeResultsObject(existingResult?.results);
    const effectiveResults = hasMeaningfulResults(incomingResults)
      ? incomingResults
      : existingStoredResults;
    const hasAnyResultData = hasMeaningfulResults(effectiveResults);
    const hasAdditionalNotes = typeof additionalNotes === 'string' && additionalNotes.trim() !== '';

    const hasImages = incomingResults._images && incomingResults._images.length > 0;

    const shouldFinalize = requestedFinalize || existingResult?.status === 'COMPLETED';
    const targetStatus = shouldFinalize ? 'COMPLETED' : 'IN_PROGRESS';

    let result;
    if (existingResult) {
      result = await prisma.labTestResult.update({
        where: { id: existingResult.id },
        data: {
          results: effectiveResults,
          additionalNotes: additionalNotes || null,
          processedBy: labTechnicianId,
          verifiedBy: shouldFinalize ? labTechnicianId : null,
          verifiedAt: shouldFinalize ? new Date() : null,
          status: targetStatus
        },
        include: { test: { include: { resultFields: true } } }
      });
    } else {
      result = await prisma.labTestResult.create({
        data: {
          orderId: orderId,
          testId: order.labTestId,
          results: effectiveResults,
          additionalNotes: additionalNotes || null,
          processedBy: labTechnicianId,
          verifiedBy: shouldFinalize ? labTechnicianId : null,
          verifiedAt: shouldFinalize ? new Date() : null,
          status: targetStatus
        },
        include: { test: { include: { resultFields: true } } }
      });
    }

    if (shouldFinalize) {
      await prisma.labTestOrder.update({ where: { id: orderId }, data: { status: 'COMPLETED' } });

      if (order.visitId) {
        await checkAndUpdateVisitStatus(order.visitId);
      }
    } else if (order.status !== 'COMPLETED') {
      await prisma.labTestOrder.update({ where: { id: orderId }, data: { status: 'IN_PROGRESS' } });
    }

    res.json({ success: true, result, finalized: shouldFinalize });
  } catch (error) {
    console.error('Error saving lab test result:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getTemplates, getOrders, saveIndividualLabResult, getDetailedResults,
  sendToDoctor, updateLabOrderStatus, generateLabResultsPDF, getLabReports, saveLabTestResult
};
