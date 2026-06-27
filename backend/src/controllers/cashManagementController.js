const prisma = require('../config/database');
const z = require('zod');
const { getDefaultClinicName } = require('../utils/pdfGenerator');
const { buildCardBucketEntries, extractSlugFromServiceCode } = require('../utils/cardBucketHelper');

// Validation schemas
const createSessionSchema = z.object({
  startingCash: z.number().min(0).default(0)
});

const addTransactionSchema = z.object({
  type: z.enum(['PAYMENT_RECEIVED', 'REFUND_GIVEN', 'CASH_ADJUSTMENT', 'OTHER']),
  amount: z.number().positive(),
  description: z.string().min(1),
  paymentMethod: z.enum(['CASH', 'BANK', 'INSURANCE', 'CHARITY']),
  billingId: z.string().optional(),
  patientId: z.string().optional()
});

const addBankDepositSchema = z.object({
  amount: z.number().positive(),
  bankName: z.string().min(1),
  accountNumber: z.string().optional(),
  transactionNumber: z.string().optional(),
  notes: z.string().optional()
});

const addExpenseSchema = z.object({
  amount: z.number().positive(),
  category: z.enum(['OFFICE_SUPPLIES', 'MEDICAL_SUPPLIES', 'MAINTENANCE', 'UTILITIES', 'FOOD_BEVERAGE', 'TRANSPORTATION', 'STAFF_LOAN', 'RETURNED_TO_PATIENT', 'WRONG_TRANSACTION', 'OTHER']),
  description: z.string().min(1, 'Description is required'),
  vendor: z.string().optional(),
  departmentId: z.number().int().optional()
});

const resetSessionSchema = z.object({
  sessionId: z.string(),
  endingCash: z.number().min(0)
});

const ACCEPTED_SERVICE_BUCKETS = {
  ALL: { label: 'All Services' },
  LAB_ORDERED: { label: 'Lab (Doctor Ordered)' },
  LAB_WALKIN: { label: 'Lab Walk-in' },
  RADIOLOGY_ORDERED: { label: 'Radiology (Doctor Ordered)' },
  RADIOLOGY_WALKIN: { label: 'Radiology Walk-in' },
  PROCEDURE: { label: 'Procedure' },
  NURSE_SERVICES: { label: 'Nurse Services' },
  MATERIAL_NEEDS: { label: 'Material Needs' },
  EMERGENCY_MEDICATION: { label: 'Emergency Medication' },
  OTHER: { label: 'Other Services' }
};

const buildAcceptedWalkInFlags = async (billingIds) => {
  const flagsMap = new Map();
  const uniqueBillingIds = [...new Set((billingIds || []).filter(Boolean))];

  if (!uniqueBillingIds.length) {
    return flagsMap;
  }

  const [labWalkInOrders, radiologyWalkInOrders] = await Promise.all([
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
    })
  ]);

  labWalkInOrders.forEach((order) => {
    if (!order.billingId) return;
    const current = flagsMap.get(order.billingId) || { labWalkIn: false, radiologyWalkIn: false };
    current.labWalkIn = true;
    flagsMap.set(order.billingId, current);
  });

  radiologyWalkInOrders.forEach((order) => {
    if (!order.billingId) return;
    const current = flagsMap.get(order.billingId) || { labWalkIn: false, radiologyWalkIn: false };
    current.radiologyWalkIn = true;
    flagsMap.set(order.billingId, current);
  });

  return flagsMap;
};

const getBucketLabel = (key) => {
  return ACCEPTED_SERVICE_BUCKETS[key]?.label ||
    key.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
};

const getAcceptedServiceKey = (service, walkInFlags = null) => {
  if (!service) {
    return 'OTHER';
  }

  const code = (service.code || '').toUpperCase();
  const serviceName = (service.name || '').toUpperCase();
  const category = service.category;
  const isDermatology =
    code.includes('DERM') ||
    serviceName.includes('DERM') ||
    serviceName.includes('SKIN');

  // Card services: extract slug from code for dynamic bucket keys
  if (code.startsWith('CARD-REG-')) return 'CARD_CREATED_' + code.replace('CARD-REG-', '');
  if (code.startsWith('CARD-ACT-')) return 'CARD_REACTIVATION_' + code.replace('CARD-ACT-', '');
  // Fallback for non-standard card service codes
  if (code.startsWith('CARD-REG') || serviceName.includes('CARD REGISTRATION') || serviceName.includes('CARD CREATED')) {
    return isDermatology ? 'CARD_CREATED_DERMATOLOGY' : 'CARD_CREATED_GENERAL';
  }
  if (code.startsWith('CARD-ACT') || serviceName.includes('CARD ACTIVATION') || serviceName.includes('CARD REACTIVATION') || serviceName.includes('CARD RENEWAL')) {
    return isDermatology ? 'CARD_REACTIVATION_DERMATOLOGY' : 'CARD_REACTIVATION_GENERAL';
  }

  if (category === 'LAB') {
    return walkInFlags?.labWalkIn ? 'LAB_WALKIN' : 'LAB_ORDERED';
  }

  if (category === 'RADIOLOGY') {
    return walkInFlags?.radiologyWalkIn ? 'RADIOLOGY_WALKIN' : 'RADIOLOGY_ORDERED';
  }

  if (category === 'PROCEDURE' || category === 'DENTAL' || category === 'TREATMENT') {
    return 'PROCEDURE';
  }

  if (category === 'NURSE' || category === 'NURSE_WALKIN' || category === 'CONTINUOUS_INFUSION') {
    return 'NURSE_SERVICES';
  }

  if (category === 'MATERIAL_NEEDS') {
    return 'MATERIAL_NEEDS';
  }

  if (category === 'EMERGENCY_DRUG') {
    return 'EMERGENCY_MEDICATION';
  }

  return 'OTHER';
};

// Get current active session or create new one
exports.getCurrentSession = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if there's an active session for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let session = await prisma.dailyCashSession.findFirst({
      where: {
        createdById: userId,
        sessionDate: {
          gte: today,
          lt: tomorrow
        },
        status: 'ACTIVE'
      },
      include: {
        transactions: {
          include: {
            patient: true,
            billing: true
          },
          orderBy: { createdAt: 'desc' }
        },
        bankDeposits: {
          orderBy: { createdAt: 'desc' }
        },
        expenses: {
          include: {
            recordedBy: {
              select: { fullname: true, username: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        createdBy: {
          select: { fullname: true, username: true }
        }
      }
    });
    
    // If no active session exists, create one
    if (!session) {
      session = await prisma.dailyCashSession.create({
        data: {
          createdById: userId,
          startingCash: 0,
          sessionDate: new Date()
        },
        include: {
          transactions: {
            include: {
              patient: true,
              billing: true
            },
            orderBy: { createdAt: 'desc' }
          },
          bankDeposits: {
            orderBy: { createdAt: 'desc' }
          },
          expenses: {
            include: {
              recordedBy: {
                select: { fullname: true, username: true }
              }
            },
            orderBy: { createdAt: 'desc' }
          },
          createdBy: {
            select: { fullname: true, username: true }
          }
        }
      });
    }
    
    // Calculate current totals
    // User-specific payment totals (do not mix between billing users)
    const userTodayTransactions = await prisma.cashTransaction.findMany({
      where: {
        type: 'PAYMENT_RECEIVED',
        processedById: userId,
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    const totalReceived = userTodayTransactions
      .reduce((sum, t) => sum + t.amount, 0);

    // Session transactions are also user-bound, this is kept for compatibility/debugging
    const sessionTotalReceived = session.transactions
      .filter(t => t.type === 'PAYMENT_RECEIVED')
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Get total from today's Account Deposits (advance payments only)
    // Note: INSURANCE and CHARITY payments are NOT counted - they have their own tracking pages
    // Note: CREDIT deposits are NOT counted - they're debt clearance, not new money received
    const todayForAccounts = new Date();
    todayForAccounts.setHours(0, 0, 0, 0);
    const tomorrowForAccounts = new Date(todayForAccounts);
    tomorrowForAccounts.setDate(tomorrowForAccounts.getDate() + 1);
    
    const todayAccountDeposits = await prisma.accountDeposit.findMany({
      where: {
        depositedById: userId,
        createdAt: {
          gte: todayForAccounts,
          lt: tomorrowForAccounts
        }
      },
      include: {
        account: true
      }
    });
    
    // Only count ADVANCE account deposits in daily cash (money received)
    // CREDIT deposits are debt payments, not new money received, so not counted
    const totalFromAccounts = todayAccountDeposits
      .filter(d => d.account.accountType === 'ADVANCE')
      .reduce((sum, d) => sum + d.amount, 0);
    
    // Total received = current user's CashTransaction records + current user's ADVANCE account deposits
    // INSURANCE and CHARITY payments are excluded (tracked separately)
    const totalReceivedAll = totalReceived + totalFromAccounts;
    
    const totalExpenses = session.expenses
      .reduce((sum, e) => sum + e.amount, 0);
    
    const totalBankDeposit = session.bankDeposits
      .reduce((sum, d) => sum + d.amount, 0);
    
    const currentCash = session.startingCash + totalReceivedAll - totalExpenses - totalBankDeposit;

    // Optional clinic-wide totals (not used for user reconciliation)
    const clinicTodayTransactions = await prisma.cashTransaction.findMany({
      where: {
        type: 'PAYMENT_RECEIVED',
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    const clinicTotalReceived = clinicTodayTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    res.json({
      session: {
        ...session,
        calculatedTotals: {
          totalReceived: totalReceivedAll,
          sessionTotalReceived,
          totalExpenses,
          totalBankDeposit,
          currentCash
        },
        clinicTotals: {
          totalReceived: clinicTotalReceived
        }
      }
    });
  } catch (error) {
    console.error('Error getting current session:', error);
    res.status(500).json({ error: error.message });
  }
};

// Add a cash transaction
exports.addTransaction = async (req, res) => {
  try {
    const validatedData = addTransactionSchema.parse(req.body);
    const userId = req.user.id;
    
    // Get current session
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let session = await prisma.dailyCashSession.findFirst({
      where: {
        createdById: userId,
        sessionDate: {
          gte: today,
          lt: tomorrow
        },
        status: 'ACTIVE'
      }
    });
    
    if (!session) {
      return res.status(404).json({ error: 'No active cash session found' });
    }
    
    // Create transaction
    const transaction = await prisma.cashTransaction.create({
      data: {
        sessionId: session.id,
        processedById: userId,
        ...validatedData
      },
      include: {
        patient: true,
        billing: true,
        processedBy: {
          select: { fullname: true, username: true }
        }
      }
    });
    
    res.json({
      message: 'Transaction added successfully',
      transaction
    });
  } catch (error) {
    console.error('Error adding transaction:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    res.status(500).json({ error: error.message });
  }
};

// Add bank deposit
exports.addBankDeposit = async (req, res) => {
  try {
    const validatedData = addBankDepositSchema.parse(req.body);
    const userId = req.user.id;
    
    // Get current session
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let session = await prisma.dailyCashSession.findFirst({
      where: {
        createdById: userId,
        sessionDate: {
          gte: today,
          lt: tomorrow
        },
        status: 'ACTIVE'
      }
    });
    
    if (!session) {
      return res.status(404).json({ error: 'No active cash session found' });
    }
    
    // Create bank deposit
    const deposit = await prisma.bankDeposit.create({
      data: {
        sessionId: session.id,
        depositedById: userId,
        ...validatedData
      },
      include: {
        depositedBy: {
          select: { fullname: true, username: true }
        }
      }
    });
    
    res.json({
      message: 'Bank deposit recorded successfully',
      deposit
    });
  } catch (error) {
    console.error('Error adding bank deposit:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    res.status(500).json({ error: error.message });
  }
};

// Add expense
exports.addExpense = async (req, res) => {
  try {
    const validatedData = addExpenseSchema.parse(req.body);
    const userId = req.user.id;
    
    // Get current session
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let session = await prisma.dailyCashSession.findFirst({
      where: {
        createdById: userId,
        sessionDate: {
          gte: today,
          lt: tomorrow
        },
        status: 'ACTIVE'
      }
    });
    
    if (!session) {
      return res.status(404).json({ error: 'No active cash session found' });
    }
    
    // Create expense
    const expense = await prisma.cashExpense.create({
      data: {
        sessionId: session.id,
        recordedById: userId,
        ...validatedData
      },
      include: {
        recordedBy: {
          select: { fullname: true, username: true }
        }
      }
    });
    
    res.json({
      message: 'Expense recorded successfully',
      expense
    });
  } catch (error) {
    console.error('Error adding expense:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    res.status(500).json({ error: error.message });
  }
};

// Reset daily session (Admin only)
exports.resetSession = async (req, res) => {
  try {
    const validatedData = resetSessionSchema.parse(req.body);
    const userId = req.user.id;
    
    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only administrators can reset cash sessions' });
    }
    
    // Get the session
    const session = await prisma.dailyCashSession.findUnique({
      where: { id: validatedData.sessionId }
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (session.isReset) {
      return res.status(400).json({ error: 'Session has already been reset' });
    }
    
    // Update session
    const updatedSession = await prisma.dailyCashSession.update({
      where: { id: validatedData.sessionId },
      data: {
        status: 'RESET',
        endingCash: validatedData.endingCash,
        endTime: new Date(),
        isReset: true,
        resetById: userId,
        resetAt: new Date()
      },
      include: {
        resetBy: {
          select: { fullname: true, username: true }
        }
      }
    });
    
    res.json({
      message: 'Session reset successfully',
      session: updatedSession
    });
  } catch (error) {
    console.error('Error resetting session:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    res.status(500).json({ error: error.message });
  }
};

// Get session history
exports.getSessionHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate } = req.query;
    const userId = req.user.id;
    
    const where = {
      createdById: userId
    };
    
    if (startDate && endDate) {
      where.sessionDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }
    
    const sessions = await prisma.dailyCashSession.findMany({
      where,
      include: {
        transactions: {
          include: {
            patient: true,
            billing: true
          }
        },
        bankDeposits: true,
        expenses: true,
        createdBy: {
          select: { fullname: true, username: true }
        },
        resetBy: {
          select: { fullname: true, username: true }
        }
      },
      orderBy: { sessionDate: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit)
    });
    
    const total = await prisma.dailyCashSession.count({ where });
    
    res.json({
      sessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting session history:', error);
    res.status(500).json({ error: error.message });
  }
};

// Export transactions to PDF
exports.exportTransactionsPDF = async (req, res) => {
  try {
    const { transactions, date } = req.body;
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

    // Calculate totals
    const totalAmount = transactions.reduce((sum, t) => {
      return sum + (t.type === 'PAYMENT_RECEIVED' ? t.amount : -t.amount);
    }, 0);

    // Build table rows
    const tableBody = [
      [
        { text: 'Date & Time', style: 'tableHeader', bold: true },
        { text: 'Description', style: 'tableHeader', bold: true },
        { text: 'Type', style: 'tableHeader', bold: true },
        { text: 'Payment Method', style: 'tableHeader', bold: true },
        { text: 'Patient', style: 'tableHeader', bold: true },
        { text: 'Amount', style: 'tableHeader', bold: true, alignment: 'right' }
      ],
      ...transactions.map(t => [
        new Date(t.createdAt).toLocaleString(),
        t.description || '-',
        t.type.replace('_', ' '),
        t.paymentMethod || '-',
        t.patient ? t.patient.name : '-',
        { 
          text: `${t.type === 'PAYMENT_RECEIVED' ? '+' : '-'}${t.amount.toFixed(2)} ETB`,
          alignment: 'right',
          color: t.type === 'PAYMENT_RECEIVED' ? '#059669' : '#dc2626'
        }
      ]),
      [
        { text: 'TOTAL', colSpan: 5, bold: true, alignment: 'right' },
        {},
        {},
        {},
        {},
        { 
          text: `${totalAmount >= 0 ? '+' : ''}${totalAmount.toFixed(2)} ETB`,
          bold: true,
          alignment: 'right',
          color: totalAmount >= 0 ? '#059669' : '#dc2626'
        }
      ]
    ];

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
          text: 'Daily Cash Transactions Report',
          style: 'subheader',
          alignment: 'center',
          margin: [0, 0, 0, 5]
        },
        {
          text: `Date: ${date ? new Date(date).toLocaleDateString() : new Date().toLocaleDateString()}`,
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
            widths: ['*', '*', '*', '*', '*', '*'],
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
          fontSize: 24,
          bold: true,
          color: '#000'
        },
        subheader: {
          fontSize: 20,
          color: '#666'
        },
        field: {
          fontSize: 18,
          color: '#000'
        },
        tableHeader: {
          fontSize: 18,
          color: '#000',
          fillColor: '#f0f0f0'
        }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const fileName = `transactions-${date || 'all'}-${Date.now()}.pdf`;
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
    console.error('Error exporting transactions PDF:', error);
    res.status(500).json({ error: error.message });
  }
};

// Upload receipt for bank deposit or expense
exports.uploadReceipt = async (req, res) => {
  try {
    const { type, id } = req.params; // type: 'deposit' or 'expense', id: record id
    const userId = req.user.id;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = `/uploads/receipts/${req.file.filename}`;
    
    if (type === 'deposit') {
      // Update bank deposit with receipt
      const deposit = await prisma.bankDeposit.update({
        where: { 
          id: id,
          depositedById: userId // Ensure user owns this deposit
        },
        data: { receiptImage: filePath },
        include: {
          depositedBy: {
            select: { fullname: true, username: true }
          }
        }
      });
      
      res.json({
        message: 'Receipt uploaded successfully',
        deposit
      });
    } else if (type === 'expense') {
      // Update expense with receipt
      const expense = await prisma.cashExpense.update({
        where: { 
          id: id,
          recordedById: userId // Ensure user owns this expense
        },
        data: { receiptImage: filePath },
        include: {
          recordedBy: {
            select: { fullname: true, username: true }
          }
        }
      });
      
      res.json({
        message: 'Receipt uploaded successfully',
        expense
      });
    } else {
      return res.status(400).json({ error: 'Invalid type. Must be "deposit" or "expense"' });
    }
  } catch (error) {
    console.error('Error uploading receipt:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get patient transactions by patient ID or search by name/phone
exports.getPatientTransactions = async (req, res) => {
  try {
    const { patientId, query, type = 'name' } = req.query;

    if (patientId) {
      // Get transactions for specific patient
      const transactions = await prisma.cashTransaction.findMany({
        where: {
          patientId: patientId,
          type: 'PAYMENT_RECEIVED' // Only payment transactions
        },
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              mobile: true,
              type: true
            }
          },
          billing: {
            include: {
              services: {
                include: {
                  service: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                      price: true,
                      category: true
                    }
                  }
                }
              }
            }
          },
          session: {
            select: {
              sessionDate: true
            }
          },
          processedBy: {
            select: {
              fullname: true,
              username: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({
        success: true,
        transactions,
        patient: transactions[0]?.patient || null
      });
    } else if (query && query.length >= 2) {
      // Search for patient by name or phone
      const whereClause = {};
      
      if (type === 'phone') {
        whereClause.mobile = {
          contains: query
        };
      } else {
        // Default to name search
        whereClause.name = {
          contains: query,
          mode: 'insensitive'
        };
      }

      const patients = await prisma.patient.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          mobile: true,
          type: true
        },
        take: 10,
        orderBy: { name: 'asc' }
      });

      res.json({
        success: true,
        patients
      });
    } else {
      return res.status(400).json({ 
        success: false,
        error: 'Either patientId or query (with at least 2 characters) is required' 
      });
    }
  } catch (error) {
    console.error('Error getting patient transactions:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Get all patients with their visits, services, and totals for receipt printing
exports.getPatientReceipts = async (req, res) => {
  try {
    const { date, search, searchType } = req.query;
    
    // Get date range for filtering
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Build where clause for patient search
    let patientWhere = {};
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      if (searchType === 'phone') {
        patientWhere = {
          mobile: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        };
      } else {
        // Default to name search
        patientWhere = {
          name: {
            contains: searchTerm,
            mode: 'insensitive'
          }
        };
      }
    }
    
    // Build the main where clause
    const whereClause = {
      AND: [
        {
          OR: [
            { status: 'PAID' },
            { payments: { some: {} } }
          ]
        },
        {
          OR: [
            // Bills created on this date
            {
              createdAt: {
                gte: targetDate,
                lt: nextDay
              }
            },
            // OR bills with payments made on this date
            {
              payments: {
                some: {
                  createdAt: {
                    gte: targetDate,
                    lt: nextDay
                  }
                }
              }
            }
          ]
        }
      ]
    };

    // Add patient search filter if provided
    if (Object.keys(patientWhere).length > 0) {
      whereClause.AND.push({ patient: patientWhere });
    }
    
    // Get all bills for the selected date with payments
    // Filter by payment date OR billing creation date (to catch both scenarios)
    const bills = await prisma.billing.findMany({
      where: whereClause,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            mobile: true,
            type: true
          }
        },
        services: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                code: true,
                category: true,
                price: true
              }
            }
          }
        },
        payments: true, // Get all payments, not filtered by date
        visit: {
          select: {
            id: true,
            visitUid: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Group bills by patient
    const patientsMap = new Map();
    
    bills.forEach(billing => {
      const patientId = billing.patientId;
      
      if (!patientsMap.has(patientId)) {
        patientsMap.set(patientId, {
          patient: billing.patient,
          services: [],
          totalAmount: 0,
          visitIds: new Set()
        });
      }
      
      const patientData = patientsMap.get(patientId);
      
      // Add services from this billing
      billing.services.forEach(billingService => {
        patientData.services.push({
          name: billingService.service.name,
          code: billingService.service.code,
          category: billingService.service.category,
          quantity: billingService.quantity,
          unitPrice: billingService.unitPrice,
          totalPrice: billingService.totalPrice,
          visitId: billing.visitId,
          visitUid: billing.visit?.visitUid
        });
      });
      
      // Add to total
      patientData.totalAmount += billing.totalAmount;
      
      // Track visit IDs
      if (billing.visitId) {
        patientData.visitIds.add(billing.visitId);
      }
    });
    
    // Convert map to array and format
    const patients = Array.from(patientsMap.values()).map(patientData => ({
      patient: patientData.patient,
      services: patientData.services,
      totalAmount: patientData.totalAmount,
      visitCount: patientData.visitIds.size
    }));
    
    console.log(`[getPatientReceipts] Found ${bills.length} bills, grouped into ${patients.length} patients for date ${targetDate.toISOString().split('T')[0]}`);
    
    res.json({
      success: true,
      patients,
      date: targetDate.toISOString().split('T')[0],
      count: patients.length
    });
  } catch (error) {
    console.error('Error getting patient receipts:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Get accepted/processed payments summary for current billing user on a selected date
exports.getAcceptedServicesSummary = async (req, res) => {
  try {
    const { date } = req.query;
    const userId = req.user.id;
    const userName = req.user.fullname || req.user.username || 'Current User';

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const transactions = await prisma.cashTransaction.findMany({
      where: {
        type: 'PAYMENT_RECEIVED',
        amount: { gt: 0 },
        createdAt: {
          gte: targetDate,
          lt: nextDay
        }
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true
          }
        },
        processedBy: {
          select: {
            id: true,
            fullname: true,
            username: true
          }
        },
        billing: {
          select: {
            id: true,
            totalAmount: true,
            services: {
              select: {
                totalPrice: true,
                service: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    category: true
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

    const walkInFlagsMap = await buildAcceptedWalkInFlags(
      transactions.map((tx) => tx.billingId).filter(Boolean)
    );

    const serviceTotalsMap = new Map();
    const myTransactions = [];

    Object.keys(ACCEPTED_SERVICE_BUCKETS).forEach((key) => {
      if (key === 'ALL') {
        return;
      }

      serviceTotalsMap.set(key, {
        key,
        label: ACCEPTED_SERVICE_BUCKETS[key].label,
        amount: 0,
        transactions: 0
      });
    });

    for (const tx of transactions) {
      const billingServices = tx.billing?.services || [];
      const billingTotal = tx.billing?.totalAmount || 0;

      const allocations = [];
      if (billingServices.length > 0 && billingTotal > 0) {
        let assignedAmount = 0;

        billingServices.forEach((billingService, idx) => {
          const walkInFlags = walkInFlagsMap.get(tx.billingId) || null;
          const serviceKey = getAcceptedServiceKey(billingService.service, walkInFlags);
          const isLast = idx === billingServices.length - 1;
          const proportionalAmount = isLast
            ? (tx.amount - assignedAmount)
            : (tx.amount * (billingService.totalPrice / billingTotal));

          assignedAmount += proportionalAmount;
          allocations.push({
            key: serviceKey,
            label: getBucketLabel(serviceKey),
            serviceName: billingService.service.name,
            serviceCode: billingService.service.code,
            amount: proportionalAmount
          });
        });
      } else {
        allocations.push({
          key: 'OTHER',
          label: ACCEPTED_SERVICE_BUCKETS.OTHER.label,
          serviceName: 'Unclassified Payment',
          serviceCode: '-',
          amount: tx.amount
        });
      }

      const allocationByService = new Map();
      allocations.forEach((allocation) => {
        const existing = allocationByService.get(allocation.key);
        if (existing) {
          existing.amount += allocation.amount;
        } else {
          allocationByService.set(allocation.key, {
            key: allocation.key,
            label: allocation.label,
            amount: allocation.amount
          });
        }

        const serviceTotal = serviceTotalsMap.get(allocation.key) || {
          key: allocation.key,
          label: allocation.label,
          amount: 0,
          transactions: 0
        };
        serviceTotal.amount += allocation.amount;
        serviceTotal.transactions += 1;
        serviceTotalsMap.set(allocation.key, serviceTotal);
      });

      const sortedAllocations = Array.from(allocationByService.values()).sort((a, b) => b.amount - a.amount);
      const primaryService = sortedAllocations[0] || {
        key: 'OTHER',
        label: ACCEPTED_SERVICE_BUCKETS.OTHER.label
      };

      if (tx.processedById === userId) {
        myTransactions.push({
          id: tx.id,
          createdAt: tx.createdAt,
          paymentMethod: tx.paymentMethod,
          amount: tx.amount,
          patientId: tx.patient?.id || null,
          patientName: tx.patient?.name || 'Unknown Patient',
          billingId: tx.billingId,
          primaryServiceKey: primaryService.key,
          primaryServiceLabel: primaryService.label,
          allocations: sortedAllocations,
          description: tx.description
        });
      }
    }

    const serviceTotals = Array.from(serviceTotalsMap.values()).sort((a, b) => b.amount - a.amount);
    const totalAcceptedAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);

    res.json({
      success: true,
      date: targetDate.toISOString().split('T')[0],
      currentUser: {
        id: userId,
        name: userName,
        username: req.user.username || '-'
      },
      totalAcceptedAmount,
      totalTransactions: transactions.length,
      serviceBuckets: ACCEPTED_SERVICE_BUCKETS,
      serviceTotals,
      myTransactions
    });
  } catch (error) {
    console.error('Error getting accepted services summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get daily expenses and bank deposits for a specific date
exports.getDailyExpenses = async (req, res) => {
  try {
    const { date } = req.query;
    let targetDate;
    if (date) {
      const [y, m, d] = date.split('-').map(Number);
      targetDate = new Date(y, m - 1, d);
    } else {
      targetDate = new Date();
      targetDate.setHours(0, 0, 0, 0);
    }
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const [expenses, bankDeposits] = await Promise.all([
      prisma.cashExpense.findMany({
        where: { createdAt: { gte: targetDate, lt: nextDay } },
        include: {
          recordedBy: { select: { fullname: true, username: true } },
          session: { select: { id: true, sessionDate: true } },
          department: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.bankDeposit.findMany({
        where: { createdAt: { gte: targetDate, lt: nextDay } },
        include: {
          depositedBy: { select: { fullname: true, username: true } },
          session: { select: { id: true, sessionDate: true } }
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const totalDeposits = bankDeposits.reduce((s, d) => s + d.amount, 0);

    const displayDate = date || targetDate.toISOString().split('T')[0];
    res.json({
      date: displayDate,
      expenses: expenses.map(e => ({
        id: e.id, amount: e.amount, category: e.category,
        description: e.description, vendor: e.vendor,
        recordedBy: e.recordedBy.fullname,
        createdAt: e.createdAt,
        department: e.department ? { id: e.department.id, name: e.department.name } : null
      })),
      bankDeposits: bankDeposits.map(d => ({
        id: d.id, amount: d.amount, bankName: d.bankName,
        accountNumber: d.accountNumber, transactionNumber: d.transactionNumber,
        notes: d.notes, recordedBy: d.depositedBy.fullname,
        createdAt: d.createdAt,
        status: d.status
      })),
      totals: {
        totalExpenses,
        totalDeposits,
        net: totalDeposits - totalExpenses
      }
    });
  } catch (error) {
    console.error('Error getting daily expenses:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update bank deposit status (Admin only)
exports.updateDepositStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['CONFIRMED', 'VERIFIED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be CONFIRMED or VERIFIED' });
    }

    const deposit = await prisma.bankDeposit.findUnique({ where: { id } });
    if (!deposit) {
      return res.status(404).json({ error: 'Bank deposit not found' });
    }

    const updated = await prisma.bankDeposit.update({
      where: { id },
      data: { status },
      include: {
        depositedBy: { select: { fullname: true, username: true } }
      }
    });

    res.json({ message: `Deposit status updated to ${status}`, deposit: updated });
  } catch (error) {
    console.error('Error updating deposit status:', error);
    res.status(500).json({ error: error.message });
  }
};
