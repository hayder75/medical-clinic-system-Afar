const PdfPrinter = require('pdfmake');
const fs = require('fs');
const path = require('path');

// Clinic name will be updated dynamically from DB on first use
let _clinicName = 'Clinic';
let _loadingPromise = null;

function _loadClinicName() {
  if (!_loadingPromise) {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      _loadingPromise = prisma.clinicSetting.findFirst().then(s => {
        if (s?.name) _clinicName = s.name;
        return prisma.$disconnect();
      }).catch(() => {});
    } catch {}
  }
}

function getDefaultClinicName() {
  _loadClinicName();
  return _clinicName;
}

const fonts = {
  Roboto: {
    normal: 'node_modules/roboto-font/fonts/Roboto/roboto-regular-webfont.ttf',
    bold: 'node_modules/roboto-font/fonts/Roboto/roboto-bold-webfont.ttf',
    italics: 'node_modules/roboto-font/fonts/Roboto/roboto-italic-webfont.ttf',
    bolditalics: 'node_modules/roboto-font/fonts/Roboto/roboto-bolditalic-webfont.ttf',
  },
};

const printer = new PdfPrinter(fonts);

// Paper size definitions in mm (pdfmake uses points, 1mm = 2.83465 points)
const PAPER_SIZES = {
  A4: {
    width: 210,  // mm
    height: 297, // mm
    name: 'A4'
  },
  A5: {
    width: 148,  // mm
    height: 210, // mm
    name: 'A5'
  },
  A6: {
    width: 105,  // mm
    height: 148, // mm
    name: 'A6'
  }
};

/**
 * Convert mm to points (pdfmake units)
 */
const mmToPoints = (mm) => mm * 2.83465;

/**
 * Get paper size configuration
 */
const getPaperSize = (size = 'A4') => {
  const paperSize = PAPER_SIZES[size.toUpperCase()] || PAPER_SIZES.A4;
  return {
    width: mmToPoints(paperSize.width),
    height: mmToPoints(paperSize.height),
    name: paperSize.name,
    dimensions: paperSize
  };
};

/**
 * Calculate responsive sizes based on paper size
 */
const getResponsiveSizes = (paperSize) => {
  const baseWidth = paperSize.dimensions.width;

  // Scale factor: A4 = 1.0, A5 = 0.7, A6 = 0.5
  const scaleFactor = baseWidth / 210;

  return {
    scaleFactor,
    // Margins (scaled)
    marginHorizontal: 40 * scaleFactor,
    marginVertical: 60 * scaleFactor,
    // Font sizes (scaled)
    fontSize: {
      clinicName: Math.round(24 * scaleFactor),
      subheader: Math.round(20 * scaleFactor),
      sectionTitle: Math.round(20 * scaleFactor),
      field: Math.round(16 * scaleFactor),
      testTitle: Math.round(18 * scaleFactor),
      tableCell: Math.round(16 * scaleFactor),
      notes: Math.round(16 * scaleFactor),
      signatureLabel: Math.round(16 * scaleFactor),
      signatureName: Math.round(18 * scaleFactor),
      footer: Math.round(14 * scaleFactor),
      small: Math.round(10 * scaleFactor)
    },
    // Logo size (scaled)
    logoSize: {
      width: Math.round(80 * scaleFactor),
      height: Math.round(80 * scaleFactor)
    }
  };
};

/**
 * Get clinic logo (base64 or path)
 * You can place your logo at: backend/uploads/logo.png or backend/public/logo.png
 */
const getClinicLogo = () => {
  const logoPaths = [
    path.join(__dirname, '../../uploads/logo.png'),
    path.join(__dirname, '../../public/logo.png'),
    path.join(__dirname, '../../uploads/logo.jpg'),
    path.join(__dirname, '../../public/logo.jpg')
  ];

  for (const logoPath of logoPaths) {
    if (fs.existsSync(logoPath)) {
      try {
        const logoBuffer = fs.readFileSync(logoPath);
        const logoBase64 = logoBuffer.toString('base64');
        const extension = path.extname(logoPath).toLowerCase();
        const mimeType = extension === '.png' ? 'image/png' : 'image/jpeg';
        return `data:${mimeType};base64,${logoBase64}`;
      } catch (error) {
        console.warn('Error reading logo file:', error.message);
      }
    }
  }

  // Return null if logo not found (will skip logo in PDF)
  return null;
};

/**
 * Create header with logo and clinic name
 */
const createHeader = (clinicName, sizes, logoBase64 = null) => {
  const headerContent = [];

  if (logoBase64) {
    headerContent.push({
      columns: [
        {
          image: logoBase64,
          width: sizes.logoSize.width,
          height: sizes.logoSize.height,
          alignment: 'left',
          margin: [0, 0, 10, 0]
        },
        {
          stack: [
            {
              text: clinicName,
              style: 'clinicName',
              alignment: 'left',
              margin: [0, 0, 0, 5]
            }
          ],
          width: '*',
          alignment: 'left'
        }
      ],
      columnGap: 10,
      margin: [0, 0, 0, 15]
    });
  } else {
    headerContent.push({
      text: clinicName || 'Clinic',
      style: 'clinicName',
      alignment: 'center',
      margin: [0, 0, 0, 5]
    });
  }

  return headerContent;
};

/**
 * Create professional styles based on paper size
 */
const createStyles = (sizes) => {
  return {
    clinicName: {
      fontSize: sizes.fontSize.clinicName,
      bold: true,
      color: '#000'
    },
    subheader: {
      fontSize: sizes.fontSize.subheader,
      color: '#666',
      alignment: 'center'
    },
    sectionTitle: {
      fontSize: sizes.fontSize.sectionTitle,
      bold: true,
      color: '#000',
      decoration: 'underline',
      margin: [0, 10, 0, 10]
    },
    field: {
      fontSize: sizes.fontSize.field,
      color: '#000'
    },
    testTitle: {
      fontSize: sizes.fontSize.testTitle,
      bold: true,
      color: '#000'
    },
    tableHeader: {
      fontSize: sizes.fontSize.tableCell,
      color: '#000',
      fillColor: '#f0f0f0',
      bold: true
    },
    tableCell: {
      fontSize: sizes.fontSize.tableCell,
      color: '#000'
    },
    notes: {
      fontSize: sizes.fontSize.notes,
      color: '#666',
      italics: true
    },
    signatureLabel: {
      fontSize: sizes.fontSize.signatureLabel,
      color: '#666'
    },
    signatureName: {
      fontSize: sizes.fontSize.signatureName,
      bold: true,
      color: '#000'
    },
    footer: {
      fontSize: sizes.fontSize.footer,
      color: '#666',
      alignment: 'center'
    },
    small: {
      fontSize: sizes.fontSize.small,
      color: '#666'
    }
  };
};

/**
 * Generate PDF document
 */
const generatePDF = async (docDefinition, outputPath) => {
  return new Promise((resolve, reject) => {
    try {
      console.log(`📄 [PDF Generator] Starting PDF generation for: ${outputPath}`);
      const pdfDoc = printer.createPdfKitDocument(docDefinition);

      // Ensure uploads directory exists
      const uploadsDir = path.dirname(outputPath);
      if (!fs.existsSync(uploadsDir)) {
        console.log(`📁 [PDF Generator] Creating directory: ${uploadsDir}`);
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const writeStream = fs.createWriteStream(outputPath);
      pdfDoc.pipe(writeStream);

      writeStream.on('finish', () => {
        console.log(`✅ [PDF Generator] PDF successfully generated: ${outputPath}`);
        resolve(outputPath);
      });

      writeStream.on('error', (error) => {
        console.error(`❌ [PDF Generator] WriteStream error:`, error);
        reject(error);
      });

      pdfDoc.on('error', (error) => {
        console.error(`❌ [PDF Generator] PdfDoc error:`, error);
        reject(error);
      });

      pdfDoc.end();
    } catch (error) {
      console.error(`❌ [PDF Generator] Unexpected error:`, error);
      reject(error);
    }
  });
};

/**
 * Main function to create PDF with paper size support
 */
const createPDFDocument = (options = {}) => {
  const {
    paperSize = 'A4',
    clinicName = getDefaultClinicName(),
    content = [],
    includeLogo = true,
    footerText = null,
    customStyles = {}
  } = options;

  // Validate and get paper size
  const paper = getPaperSize(paperSize);
  console.log(`📄 [createPDFDocument] Paper size:`, {
    requested: paperSize,
    width: paper.width,
    height: paper.height,
    dimensions: paper.dimensions
  });

  // Validate paper dimensions
  if (!paper.width || !paper.height || isNaN(paper.width) || isNaN(paper.height)) {
    console.error(`❌ [createPDFDocument] Invalid paper dimensions:`, paper);
    throw new Error(`Invalid paper size: ${paperSize}. Width: ${paper.width}, Height: ${paper.height}`);
  }

  const sizes = getResponsiveSizes(paper);
  console.log(`📄 [createPDFDocument] Responsive sizes:`, {
    marginHorizontal: sizes.marginHorizontal,
    marginVertical: sizes.marginVertical,
    fontSize: sizes.fontSize.field
  });

  // Validate sizes
  if (isNaN(sizes.marginHorizontal) || isNaN(sizes.marginVertical)) {
    console.error(`❌ [createPDFDocument] Invalid margin sizes:`, sizes);
    throw new Error(`Invalid margin sizes: Horizontal: ${sizes.marginHorizontal}, Vertical: ${sizes.marginVertical}`);
  }

  const logoBase64 = includeLogo ? getClinicLogo() : null;

  // Build document content
  const documentContent = [];

  // Header with logo
  if (includeLogo && logoBase64) {
    documentContent.push(...createHeader(clinicName, sizes, logoBase64));
  } else {
    documentContent.push({
      text: clinicName,
      style: 'clinicName',
      alignment: 'center',
      margin: [0, 0, 0, 20]
    });
  }

  // Separator line - calculate line width based on page width minus margins
  // Calculate available width for content (page width - left margin - right margin)
  const availableWidth = paper.width - (sizes.marginHorizontal * 2);
  const lineWidth = Math.max(100, availableWidth); // Ensure at least 100 points

  console.log(`📄 [createPDFDocument] Line width calculation:`, {
    paperWidth: paper.width,
    marginHorizontal: sizes.marginHorizontal,
    availableWidth: availableWidth,
    calculatedWidth: lineWidth
  });

  if (isNaN(lineWidth) || lineWidth <= 0) {
    console.error(`❌ [createPDFDocument] Invalid line width: ${lineWidth}, using default`);
    throw new Error(`Invalid line width calculation: ${lineWidth}`);
  }

  // Use numeric value for canvas line (pdfmake doesn't support percentages in canvas)
  documentContent.push({
    canvas: [{
      type: 'line',
      x1: 0,
      y1: 0,
      x2: lineWidth,
      y2: 0,
      lineWidth: 1
    }],
    margin: [0, 0, 0, 15]
  });

  // Main content
  documentContent.push(...content);

  // Footer - use the same line width as separator
  if (footerText) {
    documentContent.push({
      canvas: [{
        type: 'line',
        x1: 0,
        y1: 0,
        x2: lineWidth,
        y2: 0,
        lineWidth: 1
      }],
      margin: [0, 20, 0, 10]
    });
    documentContent.push({
      text: footerText,
      style: 'footer',
      margin: [0, 10, 0, 0]
    });
  } else {
    documentContent.push({
      canvas: [{
        type: 'line',
        x1: 0,
        y1: 0,
        x2: lineWidth,
        y2: 0,
        lineWidth: 1
      }],
      margin: [0, 20, 0, 10]
    });
    documentContent.push({
      text: `Generated on: ${new Date().toLocaleString()}`,
      style: 'footer',
      margin: [0, 10, 0, 0]
    });
  }

  // Combine custom styles with default styles
  const styles = {
    ...createStyles(sizes),
    ...customStyles
  };

  // Validate all numeric values before returning
  const pageWidth = Number(paper.width);
  const pageHeight = Number(paper.height);
  const marginH = Number(sizes.marginHorizontal);
  const marginV = Number(sizes.marginVertical);
  const fontSize = Number(sizes.fontSize.field);

  if (isNaN(pageWidth) || isNaN(pageHeight) || isNaN(marginH) || isNaN(marginV) || isNaN(fontSize)) {
    console.error(`❌ [createPDFDocument] Invalid numeric values:`, {
      pageWidth,
      pageHeight,
      marginH,
      marginV,
      fontSize
    });
    throw new Error('Invalid numeric values in PDF document definition');
  }

  console.log(`✅ [createPDFDocument] Document definition validated:`, {
    pageSize: [pageWidth, pageHeight],
    pageMargins: [marginH, marginV, marginH, marginV],
    contentLength: documentContent.length
  });

  // pdfmake accepts pageSize as array [width, height] or predefined string
  // Use array format for custom sizes
  const docDefinition = {
    pageSize: {
      width: pageWidth,
      height: pageHeight
    },
    pageMargins: [marginH, marginV, marginH, marginV],
    content: documentContent,
    styles: styles,
    defaultStyle: {
      fontSize: fontSize,
      font: 'Roboto'
    }
  };

  console.log(`✅ [createPDFDocument] Final document definition:`, {
    pageSize: docDefinition.pageSize,
    pageMargins: docDefinition.pageMargins,
    contentLength: docDefinition.content.length,
    defaultFontSize: docDefinition.defaultStyle.fontSize
  });

  return docDefinition;
};

module.exports = {
  generatePDF,
  createPDFDocument,
  getPaperSize,
  getResponsiveSizes,
  getClinicLogo,
  createHeader,
  createStyles,
  PAPER_SIZES,
  printer,
  getDefaultClinicName
};

