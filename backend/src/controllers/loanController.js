const prisma = require('../config/database');

// Staff requests a loan
exports.requestLoan = async (req, res) => {
  try {
    const { amount, reason, settlementMethod } = req.body;
    const staffId = req.user.id;

    console.log('Loan request received:', { amount, reason, settlementMethod, staffId });

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    // Validate settlement method - ensure it's uppercase and valid
    const validSettlementMethods = ['INSTANT_PAID', 'FROM_PAYROLL'];
    const method = settlementMethod && typeof settlementMethod === 'string' && validSettlementMethods.includes(settlementMethod.toUpperCase())
      ? settlementMethod.toUpperCase()
      : 'INSTANT_PAID';
    
    console.log('Using settlement method:', method);

    const loan = await prisma.loan.create({
      data: {
        staffId,
        requestedAmount: amount,
        reason: reason || null,
        settlementMethod: method, // Explicitly set, don't rely on schema default
        status: 'PENDING'
      },
      include: {
        staff: {
          select: {
            id: true,
            fullname: true,
            role: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Loan request submitted successfully',
      loan
    });
  } catch (error) {
    console.error('Error requesting loan:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get staff's own loan requests
exports.getMyLoans = async (req, res) => {
  try {
    const staffId = req.user.id;

    const loans = await prisma.loan.findMany({
      where: { staffId },
      include: {
        reviewedBy: {
          select: {
            id: true,
            fullname: true
          }
        },
        givenBy: {
          select: {
            id: true,
            fullname: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ loans });
  } catch (error) {
    console.error('Error fetching loans:', error);
    res.status(500).json({ error: error.message });
  }
};

// Admin: Get all pending loan requests
exports.getPendingLoans = async (req, res) => {
  try {
    const pendingLoans = await prisma.loan.findMany({
      where: { status: 'PENDING' },
      include: {
        staff: {
          select: {
            id: true,
            fullname: true,
            role: true,
            email: true,
            phone: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ pendingLoans });
  } catch (error) {
    console.error('Error fetching pending loans:', error);
    res.status(500).json({ error: error.message });
  }
};

// Admin: Approve or deny loan request
exports.reviewLoan = async (req, res) => {
  try {
    const { loanId } = req.params;
    const { action, approvedAmount, notes } = req.body;
    const adminId = req.user.id;

    if (!['approve', 'deny'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use "approve" or "deny"' });
    }

    const loan = await prisma.loan.findUnique({
      where: { id: loanId }
    });

    if (!loan) {
      return res.status(404).json({ error: 'Loan request not found' });
    }

    if (loan.status !== 'PENDING') {
      return res.status(400).json({ error: 'Loan has already been reviewed' });
    }

    if (action === 'approve') {
      // If approvedAmount is provided, use it; otherwise use requested amount
      const finalAmount = approvedAmount || loan.requestedAmount;

      const updatedLoan = await prisma.loan.update({
        where: { id: loanId },
        data: {
          status: 'APPROVED',
          approvedAmount: finalAmount,
          reviewedAt: new Date(),
          approvedAt: new Date(),
          reviewedById: adminId,
          notes: notes || null
        },
        include: {
          staff: {
            select: {
              id: true,
              fullname: true,
              role: true
            }
          },
          reviewedBy: {
            select: {
              id: true,
              fullname: true
            }
          }
        }
      });

      res.json({
        message: 'Loan approved successfully',
        loan: updatedLoan
      });
    } else {
      // Deny
      const updatedLoan = await prisma.loan.update({
        where: { id: loanId },
        data: {
          status: 'DENIED',
          reviewedAt: new Date(),
          deniedAt: new Date(),
          reviewedById: adminId,
          notes: notes || null
        },
        include: {
          staff: {
            select: {
              id: true,
              fullname: true,
              role: true
            }
          }
        }
      });

      res.json({
        message: 'Loan denied',
        loan: updatedLoan
      });
    }
  } catch (error) {
    console.error('Error reviewing loan:', error);
    res.status(500).json({ error: error.message });
  }
};

// Billing: Get all approved loans awaiting disbursement
exports.getApprovedLoans = async (req, res) => {
  try {
    const approvedLoans = await prisma.loan.findMany({
      where: { status: 'APPROVED' },
      include: {
        staff: {
          select: {
            id: true,
            fullname: true,
            role: true
          }
        },
        reviewedBy: {
          select: {
            id: true,
            fullname: true
          }
        }
      },
      orderBy: { approvedAt: 'desc' }
    });

    res.json({ approvedLoans });
  } catch (error) {
    console.error('Error fetching approved loans:', error);
    res.status(500).json({ error: error.message });
  }
};

// Billing: Disburse loan (mark as given and record as expense)
exports.disburseLoan = async (req, res) => {
  try {
    const { loanId } = req.params;
    const billingId = req.user.id;

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        staff: true
      }
    });

    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    if (loan.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Only approved loans can be disbursed' });
    }

    // Get today's active cash session
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let cashSession = await prisma.dailyCashSession.findFirst({
      where: {
        sessionDate: {
          gte: today,
          lt: tomorrow
        },
        status: 'ACTIVE'
      }
    });

    if (!cashSession) {
      return res.status(404).json({ error: 'No active cash session found for today' });
    }

    // Create expense record
    const expense = await prisma.cashExpense.create({
      data: {
        sessionId: cashSession.id,
        amount: loan.approvedAmount,
        category: 'STAFF_LOAN',
        description: `Staff loan to ${loan.staff.fullname}`,
        recordedById: billingId
      }
    });

    // Update loan status
    const updatedLoan = await prisma.loan.update({
      where: { id: loanId },
      data: {
        status: 'GIVEN',
        givenAt: new Date(),
        givenById: billingId,
        expenseId: expense.id
      },
      include: {
        staff: {
          select: {
            id: true,
            fullname: true,
            role: true
          }
        },
        expense: {
          select: {
            id: true,
            amount: true,
            createdAt: true
          }
        }
      }
    });

    res.json({
      message: 'Loan disbursed successfully and recorded as expense',
      loan: updatedLoan
    });
  } catch (error) {
    console.error('Error disbursing loan:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get all loans with filters (for admin overview)
exports.getAllLoans = async (req, res) => {
  try {
    const { status, staffId } = req.query;
    
    const where = {};
    
    // Handle status filter - can be single status or comma-separated
    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      if (statuses.length === 1) {
        where.status = statuses[0];
      } else {
        where.status = { in: statuses };
      }
    }
    
    if (staffId) where.staffId = staffId;

    const loans = await prisma.loan.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            fullname: true,
            role: true
          }
        },
        reviewedBy: {
          select: {
            id: true,
            fullname: true
          }
        },
        givenBy: {
          select: {
            id: true,
            fullname: true
          }
        },
        settledBy: {
          select: {
            id: true,
            fullname: true
          }
        },
        settlementAcceptedBy: {
          select: {
            id: true,
            fullname: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ loans });
  } catch (error) {
    console.error('Error fetching all loans:', error);
    res.status(500).json({ error: error.message });
  }
};

// Staff: Settle a loan (mark as settled, awaiting billing acceptance)
exports.settleLoan = async (req, res) => {
  try {
    const { loanId } = req.params;
    const { settledAmount } = req.body;
    const staffId = req.user.id;

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        staff: {
          select: {
            id: true,
            fullname: true
          }
        }
      }
    });

    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    if (loan.staffId !== staffId) {
      return res.status(403).json({ error: 'You can only settle your own loans' });
    }

    // Only allow settlement if loan has been:
    // 1. Approved by admin (has approvedAmount or status is APPROVED/GIVEN)
    // 2. Disbursed by billing (status is GIVEN)
    // 3. Or already partially settled (status is SETTLED for additional payments)
    
    if (!['GIVEN', 'SETTLED'].includes(loan.status)) {
      return res.status(400).json({ error: 'Only loans that have been approved and disbursed can be settled' });
    }

    // Ensure loan was approved by admin (must have approvedAmount or be in GIVEN status which implies approval)
    if (loan.status === 'GIVEN' && !loan.approvedAmount && !loan.reviewedBy) {
      return res.status(400).json({ error: 'Loan must be approved by admin before it can be settled' });
    }

    if (loan.settlementMethod === 'FROM_PAYROLL') {
      return res.status(400).json({ error: 'Loans set for payroll settlement cannot be manually settled' });
    }

    const balance = loan.approvedAmount || loan.requestedAmount;
    const previousSettled = loan.settledAmount || 0;
    const remainingBalance = balance - previousSettled;

    // Validate settled amount
    const amountToSettle = parseFloat(settledAmount);
    if (isNaN(amountToSettle) || amountToSettle <= 0) {
      return res.status(400).json({ error: 'Valid settlement amount is required' });
    }

    if (amountToSettle > remainingBalance) {
      return res.status(400).json({ error: `Settlement amount cannot exceed remaining balance of ${remainingBalance.toFixed(2)} ETB` });
    }

    const newSettledAmount = previousSettled + amountToSettle;
    const newRemainingBalance = balance - newSettledAmount;

    // Update loan - if fully settled, status becomes SETTLED, otherwise stays SETTLED
    const updatedLoan = await prisma.loan.update({
      where: { id: loanId },
      data: {
        status: 'SETTLED',
        settledAt: new Date(),
        settledById: staffId,
        settledAmount: newSettledAmount
      },
      include: {
        staff: {
          select: {
            id: true,
            fullname: true,
            role: true
          }
        },
        reviewedBy: {
          select: {
            id: true,
            fullname: true
          }
        },
        settledBy: {
          select: {
            id: true,
            fullname: true
          }
        }
      }
    });

    res.json({
      message: `Settlement of ${amountToSettle.toFixed(2)} ETB recorded. ${newRemainingBalance > 0 ? `Remaining balance: ${newRemainingBalance.toFixed(2)} ETB` : 'Loan fully settled'}. Awaiting billing acceptance.`,
      loan: updatedLoan,
      remainingBalance: newRemainingBalance
    });
  } catch (error) {
    console.error('Error settling loan:', error);
    res.status(500).json({ error: error.message });
  }
};

// Billing: Get all settled loans awaiting acceptance
exports.getSettledLoans = async (req, res) => {
  try {
    const settledLoans = await prisma.loan.findMany({
      where: { status: 'SETTLED' },
      include: {
        staff: {
          select: {
            id: true,
            fullname: true,
            role: true,
            email: true,
            phone: true
          }
        },
        reviewedBy: {
          select: {
            id: true,
            fullname: true
          }
        },
        settledBy: {
          select: {
            id: true,
            fullname: true
          }
        }
      },
      orderBy: { settledAt: 'desc' }
    });

    res.json({ settledLoans });
  } catch (error) {
    console.error('Error fetching settled loans:', error);
    res.status(500).json({ error: error.message });
  }
};

// Billing: Accept settlement (confirm money received)
exports.acceptSettlement = async (req, res) => {
  try {
    const { loanId } = req.params;
    const { acceptedAmount } = req.body; // Amount actually received (can be less than settled)
    const billingId = req.user.id;

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        staff: true
      }
    });

    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    if (loan.status !== 'SETTLED') {
      return res.status(400).json({ error: 'Only settled loans can be accepted' });
    }

    // Use acceptedAmount if provided, otherwise use settledAmount, otherwise use full balance
    const settledAmount = loan.settledAmount || (loan.approvedAmount || loan.requestedAmount);
    const amountToAccept = acceptedAmount ? parseFloat(acceptedAmount) : settledAmount;

    if (isNaN(amountToAccept) || amountToAccept <= 0) {
      return res.status(400).json({ error: 'Valid accepted amount is required' });
    }

    if (amountToAccept > settledAmount) {
      return res.status(400).json({ error: `Accepted amount cannot exceed settled amount of ${settledAmount.toFixed(2)} ETB` });
    }

    // Get today's active cash session
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let cashSession = await prisma.dailyCashSession.findFirst({
      where: {
        createdById: billingId,
        sessionDate: {
          gte: today,
          lt: tomorrow
        },
        status: 'ACTIVE'
      }
    });

    // If no active session, create one
    if (!cashSession) {
      cashSession = await prisma.dailyCashSession.create({
        data: {
          createdById: billingId,
          startingCash: 0,
          sessionDate: new Date()
        }
      });
    }

    // Create cash transaction for loan settlement received (use actual accepted amount)
    await prisma.cashTransaction.create({
      data: {
        sessionId: cashSession.id,
        type: 'PAYMENT_RECEIVED',
        amount: amountToAccept,
        description: `Loan settlement from ${loan.staff.fullname} (Loan ID: ${loanId})${amountToAccept < settledAmount ? ` - Partial: ${amountToAccept.toFixed(2)} of ${settledAmount.toFixed(2)}` : ''}`,
        paymentMethod: 'CASH',
        processedById: billingId
      }
    });

    // Calculate remaining balance
    const balance = loan.approvedAmount || loan.requestedAmount;
    const totalAccepted = (loan.settlementAcceptedAmount || 0) + amountToAccept;
    const remainingBalance = balance - totalAccepted;

    // Update loan - if fully accepted, status becomes SETTLEMENT_ACCEPTED, otherwise stays SETTLED
    const updateData = {
      settlementAcceptedAt: new Date(),
      settlementAcceptedById: billingId,
      settlementAcceptedAmount: totalAccepted
    };

    // If fully accepted, change status
    if (remainingBalance <= 0) {
      updateData.status = 'SETTLEMENT_ACCEPTED';
    }

    const updatedLoan = await prisma.loan.update({
      where: { id: loanId },
      data: updateData,
      include: {
        staff: {
          select: {
            id: true,
            fullname: true,
            role: true
          }
        },
        settledBy: {
          select: {
            id: true,
            fullname: true
          }
        },
        settlementAcceptedBy: {
          select: {
            id: true,
            fullname: true
          }
        }
      }
    });

    res.json({
      message: `Settlement of ${amountToAccept.toFixed(2)} ETB accepted. ${remainingBalance > 0 ? `Remaining balance: ${remainingBalance.toFixed(2)} ETB` : 'Loan fully accepted'}. Money added to cash session.`,
      loan: updatedLoan,
      remainingBalance: remainingBalance
    });
  } catch (error) {
    console.error('Error accepting settlement:', error);
    res.status(500).json({ error: error.message });
  }
};

// Admin: Get loans for payroll settlement (FROM_PAYROLL method, status GIVEN)
exports.getPayrollLoans = async (req, res) => {
  try {
    const payrollLoans = await prisma.loan.findMany({
      where: {
        settlementMethod: 'FROM_PAYROLL',
        status: 'GIVEN'
      },
      include: {
        staff: {
          select: {
            id: true,
            fullname: true,
            role: true,
            email: true,
            phone: true
          }
        },
        reviewedBy: {
          select: {
            id: true,
            fullname: true
          }
        },
        givenBy: {
          select: {
            id: true,
            fullname: true
          }
        }
      },
      orderBy: { givenAt: 'desc' }
    });

    res.json({ payrollLoans });
  } catch (error) {
    console.error('Error fetching payroll loans:', error);
    res.status(500).json({ error: error.message });
  }
};

// Admin: Settle loan from payroll
exports.settleFromPayroll = async (req, res) => {
  try {
    const { loanId } = req.params;
    const adminId = req.user.id;

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        staff: true
      }
    });

    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    if (loan.settlementMethod !== 'FROM_PAYROLL') {
      return res.status(400).json({ error: 'This loan is not set for payroll settlement' });
    }

    if (loan.status !== 'GIVEN') {
      return res.status(400).json({ error: 'Only loans with status GIVEN can be settled from payroll' });
    }

    // Update loan status to SETTLEMENT_ACCEPTED (directly, since it's from payroll)
    const updatedLoan = await prisma.loan.update({
      where: { id: loanId },
      data: {
        status: 'SETTLEMENT_ACCEPTED',
        settledAt: new Date(),
        settledById: loan.staffId, // Staff settled via payroll
        settlementAcceptedAt: new Date(),
        settlementAcceptedById: adminId // Admin processed payroll
      },
      include: {
        staff: {
          select: {
            id: true,
            fullname: true,
            role: true
          }
        },
        settlementAcceptedBy: {
          select: {
            id: true,
            fullname: true
          }
        }
      }
    });

    res.json({
      message: 'Loan settled from payroll successfully',
      loan: updatedLoan
    });
  } catch (error) {
    console.error('Error settling loan from payroll:', error);
    res.status(500).json({ error: error.message });
  }
};

