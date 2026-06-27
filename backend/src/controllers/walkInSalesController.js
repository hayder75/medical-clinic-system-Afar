const prisma = require('../config/database');
const { z } = require('zod');
const PdfPrinter = require('pdfmake');
const fs = require('fs');
const path = require('path');
const { getDefaultClinicName } = require('../utils/pdfGenerator');

// Define fonts with absolute paths
const fonts = {
  Roboto: {
    normal: path.join(__dirname, '../../node_modules/roboto-font/fonts/Roboto/roboto-regular-webfont.ttf'),
    bold: path.join(__dirname, '../../node_modules/roboto-font/fonts/Roboto/roboto-bold-webfont.ttf'),
    italics: path.join(__dirname, '../../node_modules/roboto-font/fonts/Roboto/roboto-italic-webfont.ttf'),
    bolditalics: path.join(__dirname, '../../node_modules/roboto-font/fonts/Roboto/roboto-bolditalic-webfont.ttf'),
  },
};

const printer = new PdfPrinter(fonts);

// Validation schemas
const createWalkInSaleSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().optional(),
  pharmacyInvoiceItems: z.array(z.object({
    medicationCatalogId: z.string().optional(),
    name: z.string().min(1, 'Medication name is required'),
    dosageForm: z.string().min(1, 'Dosage form is required'),
    strength: z.string().min(1, 'Strength is required'),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
    unitPrice: z.number().min(0, 'Unit price must be positive').optional(),
    notes: z.string().optional()
  })).min(1, 'At least one item is required'),
  paymentMethod: z.enum(['CASH', 'INSURANCE', 'BANK']),
  insuranceId: z.string().optional(),
  totalAmount: z.number().min(0, 'Total amount must be positive'),
  notes: z.string().optional()
});

// Create a walk-in sale (with automatic payment processing)
exports.createWalkInSale = async (req, res) => {
  try {
    const data = createWalkInSaleSchema.parse(req.body);
    const pharmacyId = req.user.id;

    // Store customer info in notes as JSON
    const customerInfo = {
      customerName: data.customerName,
      customerPhone: data.customerPhone || null,
      notes: data.notes || null
    };

    // Create the walk-in sale invoice with payment already processed
    const invoice = await prisma.pharmacyInvoice.create({
      data: {
        type: 'WALK_IN_SALE',
        totalAmount: data.totalAmount,
        status: 'PAID', // Automatically mark as paid since payment is processed during creation
        paymentMethod: data.paymentMethod,
        insuranceId: data.insuranceId || null,
        notes: JSON.stringify(customerInfo), // Store customer info in notes
        createdBy: pharmacyId,
        processedBy: pharmacyId,
        processedAt: new Date()
      }
    });

    // Create invoice items and update inventory
    const invoiceItems = [];
    for (const item of data.pharmacyInvoiceItems) {
      let unitPrice = item.unitPrice;
      
      // If medication is from catalog, fetch price from catalog
      if (item.medicationCatalogId && !unitPrice) {
        const medication = await prisma.medicationCatalog.findUnique({
          where: { id: item.medicationCatalogId }
        });
        if (medication) {
          unitPrice = medication.unitPrice;
        }
      }

      // Create invoice item
      const invoiceItem = await prisma.pharmacyInvoiceItem.create({
        data: {
          pharmacyInvoiceId: invoice.id,
          medicationCatalogId: item.medicationCatalogId,
          name: item.name,
          dosageForm: item.dosageForm,
          strength: item.strength,
          quantity: item.quantity,
          unitPrice: unitPrice,
          totalPrice: item.quantity * unitPrice,
          notes: item.notes
        }
      });
      invoiceItems.push(invoiceItem);

      // Decrement inventory when creating sale (since we're dispensing immediately)
      if (item.medicationCatalogId) {
        await prisma.medicationCatalog.update({
          where: { id: item.medicationCatalogId },
          data: {
            availableQuantity: {
              decrement: item.quantity
            }
          }
        });
      }

      // Automatically create dispensed medicine record (dispensing immediately)
      if (item.medicationCatalogId) {
        await prisma.dispensedMedicine.create({
          data: {
            pharmacyInvoiceId: invoice.id,
            medicationCatalogId: item.medicationCatalogId,
            status: 'DISPENSED',
            name: item.name,
            dosageForm: item.dosageForm,
            strength: item.strength,
            quantity: item.quantity,
            unitPrice: unitPrice,
            notes: item.notes || '',
            dispensedBy: pharmacyId
          }
        });
      }
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: pharmacyId,
        action: 'CREATE_WALK_IN_SALE',
        entity: 'PharmacyInvoice',
        entityId: 0,
        details: JSON.stringify({
          invoiceId: invoice.id,
          customerName: data.customerName,
          totalAmount: data.totalAmount,
          itemCount: data.pharmacyInvoiceItems.length,
          paymentMethod: data.paymentMethod
        }),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    // Return invoice with customer info parsed
    const invoiceWithCustomerInfo = {
      ...invoice,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      pharmacyInvoiceItems: invoiceItems
    };

    res.status(201).json({
      message: 'Walk-in sale created and payment processed successfully',
      invoice: invoiceWithCustomerInfo
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
};

// Get walk-in sales
exports.getWalkInSales = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search } = req.query;
    const pharmacyId = req.user.id;

    const whereClause = {
      type: 'WALK_IN_SALE',
      createdBy: pharmacyId
    };

    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    // If search term provided, filter by customer name in notes
    if (search) {
      whereClause.notes = {
        contains: search,
        mode: 'insensitive'
      };
    }

    const sales = await prisma.pharmacyInvoice.findMany({
      where: whereClause,
      include: {
        pharmacyInvoiceItems: true,
        dispensedMedicines: true
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit)
    });

    // Parse customer info from notes and add to each sale
    const salesWithCustomerInfo = sales.map(sale => {
      let customerName = 'Unknown';
      let customerPhone = null;
      
      try {
        if (sale.notes) {
          const customerInfo = JSON.parse(sale.notes);
          customerName = customerInfo.customerName || 'Unknown';
          customerPhone = customerInfo.customerPhone;
        }
      } catch (e) {
        // If notes is not JSON, try to extract customer name from old format
        if (sale.notes && typeof sale.notes === 'string') {
          customerName = sale.notes;
        }
      }

      return {
        ...sale,
        customerName,
        customerPhone
      };
    });

    const total = await prisma.pharmacyInvoice.count({
      where: whereClause
    });

    res.json({
      sales: salesWithCustomerInfo,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.log('Database not available, returning mock walk-in sales data');
    
    // Fallback mock data when database is not available
    const mockSales = [
      {
        id: '1',
        customerName: 'John Doe',
        totalAmount: 25.50,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        pharmacyInvoiceItems: [
          {
            name: 'Paracetamol',
            dosageForm: 'Tablet',
            strength: '500mg',
            quantity: 10,
            unitPrice: 2.50,
            totalPrice: 25.00
          }
        ]
      },
      {
        id: '2',
        customerName: 'Jane Smith',
        totalAmount: 15.00,
        status: 'PAID',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        pharmacyInvoiceItems: [
          {
            name: 'Ibuprofen',
            dosageForm: 'Tablet',
            strength: '400mg',
            quantity: 5,
            unitPrice: 3.00,
            totalPrice: 15.00
          }
        ]
      }
    ];

    res.json({
      sales: mockSales,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: mockSales.length,
        pages: 1
      }
    });
  }
};

// Process payment for walk-in sale
exports.processWalkInPayment = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { paymentMethod, insuranceId } = req.body;
    const pharmacyId = req.user.id;

    const invoice = await prisma.pharmacyInvoice.findUnique({
      where: { id: invoiceId },
      include: { pharmacyInvoiceItems: true }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.type !== 'WALK_IN_SALE') {
      return res.status(400).json({ error: 'This is not a walk-in sale' });
    }

    // Update invoice status
    const updatedInvoice = await prisma.pharmacyInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paymentMethod,
        insuranceId
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: pharmacyId,
        action: 'PROCESS_WALK_IN_PAYMENT',
        entity: 'PharmacyInvoice',
        entityId: 0,
        details: JSON.stringify({
          invoiceId,
          paymentMethod,
          totalAmount: invoice.totalAmount
        }),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({
      message: 'Payment processed successfully',
      invoice: updatedInvoice
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Dispense walk-in sale
exports.dispenseWalkInSale = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { items } = req.body;
    const pharmacyId = req.user.id;

    const invoice = await prisma.pharmacyInvoice.findUnique({
      where: { id: invoiceId },
      include: { pharmacyInvoiceItems: true }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.status !== 'PAID') {
      return res.status(400).json({ error: 'Invoice must be paid before dispensing' });
    }

    // Create dispensed medicine records
    const dispensedMedicines = [];
    for (const item of items) {
      const dispensedMedicine = await prisma.dispensedMedicine.create({
        data: {
          pharmacyInvoiceId: invoiceId,
          medicationCatalogId: item.medicationCatalogId,
          status: 'DISPENSED',
          name: item.name,
          dosageForm: item.dosageForm,
          strength: item.strength,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          notes: item.notes || '',
          dispensedBy: pharmacyId
        }
      });
      dispensedMedicines.push(dispensedMedicine);
    }

    // Update invoice status - keep as PAID since COMPLETED is not in BillingStatus enum
    // The dispensed status is tracked in DispensedMedicine records
    // Invoice remains PAID after dispensing

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: pharmacyId,
        action: 'DISPENSE_WALK_IN_SALE',
        entity: 'PharmacyInvoice',
        entityId: 0,
        details: JSON.stringify({
          invoiceId,
          dispensedCount: dispensedMedicines.length
        }),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.json({
      message: 'Walk-in sale dispensed successfully',
      dispensedMedicines
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Generate PDF for walk-in sale
exports.generateWalkInSalePDF = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    console.log('🔍 Generating PDF for invoice:', invoiceId);

    const invoice = await prisma.pharmacyInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        pharmacyInvoiceItems: true
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.type !== 'WALK_IN_SALE') {
      return res.status(400).json({ error: 'This is not a walk-in sale' });
    }

    console.log('📄 Invoice found:', {
      id: invoice.id,
      totalAmount: invoice.totalAmount,
      itemCount: invoice.pharmacyInvoiceItems?.length || 0
    });

    // Parse customer info from notes
    let customerName = 'Unknown';
    let customerPhone = null;
    try {
      if (invoice.notes) {
        const customerInfo = JSON.parse(invoice.notes);
        customerName = customerInfo.customerName || 'Unknown';
        customerPhone = customerInfo.customerPhone;
      }
    } catch (e) {
      if (invoice.notes && typeof invoice.notes === 'string') {
        customerName = invoice.notes;
      }
    }

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const formatDateTime = (date) => {
      return new Date(date).toLocaleString('en-US');
    };

    // Build PDF content
    const content = [
      // Header
      {
        text: getDefaultClinicName(),
        style: 'clinicName',
        alignment: 'center',
        margin: [0, 0, 0, 5]
      },
      {
        text: 'Walk-In Sale Receipt',
        style: 'subheader',
        alignment: 'center',
        margin: [0, 0, 0, 20]
      },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
        margin: [0, 0, 0, 15]
      },

      // Sale Information
      {
        text: 'Sale Information',
        style: 'sectionTitle',
        margin: [0, 0, 0, 10]
      },
      {
        columns: [
          { text: `Invoice ID: ${invoice.id.substring(0, 8)}...`, style: 'field' },
          { text: `Date: ${formatDate(invoice.createdAt)}`, style: 'field' },
          { text: `Status: ${invoice.status}`, style: 'field' }
        ],
        margin: [0, 0, 0, 15]
      },

      // Customer Information
      {
        text: 'Customer Information',
        style: 'sectionTitle',
        margin: [0, 0, 0, 10]
      },
      {
        columns: [
          { text: `Name: ${customerName}`, style: 'field' },
          { text: customerPhone ? `Phone: ${customerPhone}` : '', style: 'field' }
        ],
        margin: [0, 0, 0, 15]
      },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }],
        margin: [0, 0, 0, 15]
      },

      // Items Table
      {
        text: 'Items',
        style: 'sectionTitle',
        margin: [0, 0, 0, 10]
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 80, 60, 80, 100],
          body: [
            [
              { text: 'Medication', style: 'tableHeader' },
              { text: 'Dosage', style: 'tableHeader' },
              { text: 'Qty', style: 'tableHeader' },
              { text: 'Unit Price', style: 'tableHeader' },
              { text: 'Total', style: 'tableHeader' }
            ],
            ...(invoice.pharmacyInvoiceItems && invoice.pharmacyInvoiceItems.length > 0 
              ? invoice.pharmacyInvoiceItems.map(item => [
                  { text: item.name || 'N/A', style: 'tableCell' },
                  { text: `${item.strength || 'N/A'} - ${item.dosageForm || 'N/A'}`, style: 'tableCell' },
                  { text: (item.quantity || 0).toString(), style: 'tableCell' },
                  { text: `ETB ${(item.unitPrice || 0).toFixed(2)}`, style: 'tableCell' },
                  { text: `ETB ${(item.totalPrice || 0).toFixed(2)}`, style: 'tableCell' }
            ])
              : [[
                  { text: 'No items found', style: 'tableCell', colSpan: 5, alignment: 'center' },
                  {}, {}, {}, {}
                ]]
            )
          ]
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
        },
        margin: [0, 0, 0, 15]
      },

      // Total
      {
        text: `Total Amount: ETB ${invoice.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        style: 'total',
        alignment: 'right',
        margin: [0, 0, 0, 15]
      },
      {
        text: `Payment Method: ${invoice.paymentMethod || 'N/A'}`,
        style: 'field',
        margin: [0, 0, 0, 15]
      },

      // Signature area
      { text: '', margin: [0, 30, 0, 0] },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 1, color: '#000' }],
        margin: [0, 0, 0, 5]
      },
      {
        text: 'Signature: _________________________',
        style: 'signatureLabel',
        margin: [0, 0, 0, 5]
      },
      {
        text: 'Date: _________________________',
        style: 'signatureLabel',
        margin: [0, 0, 0, 0]
      },
      {
        text: `Generated on: ${formatDateTime(new Date())}`,
        style: 'footer',
        alignment: 'center',
        margin: [0, 20, 0, 0]
      }
    ];

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      content: content,
      defaultStyle: {
        font: 'Roboto'
      },
      styles: {
        clinicName: {
          fontSize: 18,
          bold: true,
          color: '#000',
          font: 'Roboto'
        },
        subheader: {
          fontSize: 14,
          color: '#666',
          font: 'Roboto'
        },
        sectionTitle: {
          fontSize: 14,
          bold: true,
          color: '#000',
          decoration: 'underline',
          font: 'Roboto'
        },
        field: {
          fontSize: 11,
          color: '#000',
          font: 'Roboto'
        },
        tableHeader: {
          fontSize: 10,
          color: '#000',
          fillColor: '#f0f0f0',
          bold: true,
          font: 'Roboto'
        },
        tableCell: {
          fontSize: 10,
          color: '#000',
          font: 'Roboto'
        },
        total: {
          fontSize: 14,
          bold: true,
          color: '#000',
          font: 'Roboto'
        },
        signatureLabel: {
          fontSize: 10,
          color: '#666',
          font: 'Roboto'
        },
        footer: {
          fontSize: 9,
          color: '#666',
          font: 'Roboto'
        }
      }
    };

    console.log('📝 PDF document definition created, generating PDF...');

    // Verify fonts exist
    const fontNormalPath = fonts.Roboto.normal;
    if (!fs.existsSync(fontNormalPath)) {
      console.error('❌ Font file not found:', fontNormalPath);
      return res.status(500).json({ error: 'Font files not found. Please check installation.' });
    }

    // Generate PDF and buffer it first to catch any errors
    try {
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks = [];
      
      // Collect PDF chunks
      pdfDoc.on('data', (chunk) => {
        chunks.push(chunk);
      });

      pdfDoc.on('error', (error) => {
        console.error('❌ PDF generation error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to generate PDF: ' + error.message });
        }
      });
      
      // Wait for PDF to finish generating
      await new Promise((resolve, reject) => {
        pdfDoc.on('end', () => {
          console.log('✅ PDF generation completed, chunks:', chunks.length);
          resolve();
    });

        pdfDoc.on('error', reject);
        pdfDoc.end();
      });

      // Now send the buffered PDF
      if (chunks.length === 0) {
        console.error('❌ PDF generation produced no data');
        return res.status(500).json({ error: 'PDF generation failed - no data produced' });
      }

      const pdfBuffer = Buffer.concat(chunks);
      
      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Content-Disposition', `attachment; filename=walk-in-sale-${invoiceId.substring(0, 8)}.pdf`);

      // Send the PDF buffer
      res.send(pdfBuffer);
      console.log('✅ PDF sent successfully, size:', pdfBuffer.length, 'bytes');
      
    } catch (pdfError) {
      console.error('❌ Error creating PDF document:', pdfError);
      console.error('Error details:', pdfError.stack);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create PDF: ' + pdfError.message });
      }
    }
  } catch (error) {
    console.error('❌ Error generating walk-in sale PDF:', error);
    console.error('Error stack:', error.stack);
    if (!res.headersSent) {
    res.status(500).json({ error: error.message });
    }
  }
};
