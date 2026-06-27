const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const URINALYSIS_CODE = 'URINE001';

const DESIRED_URINALYSIS_FIELDS = [
  // 1. Macroscopic / Chemical Examination
  {
    fieldName: 'colour',
    label: 'Colour',
    fieldType: 'select',
    options: ['Pale Yellow', 'Yellow', 'Dark Yellow', 'Amber', 'Red', 'Brown', 'Green', 'Colorless']
  },
  {
    fieldName: 'appearance',
    label: 'Appearance',
    fieldType: 'select',
    options: ['Clear', 'Slightly Turbid', 'Turbid', 'Cloudy']
  },
  {
    fieldName: 'ph',
    label: 'pH',
    fieldType: 'number',
    normalRange: '4.5 - 8.0'
  },
  {
    fieldName: 'specific_gravity',
    label: 'Specific Gravity (SG)',
    fieldType: 'number',
    normalRange: '1.005 - 1.030'
  },
  {
    fieldName: 'protein',
    label: 'Protein',
    fieldType: 'select',
    options: ['Negative', 'Trace', '+1', '+2', '+3', '+4']
  },
  {
    fieldName: 'sugar_glucose',
    label: 'Sugar (Glucose)',
    fieldType: 'select',
    options: ['Negative', 'Trace', '+1', '+2', '+3', '+4']
  },
  {
    fieldName: 'ketone',
    label: 'Ketone',
    fieldType: 'select',
    options: ['Negative', 'Trace', 'Small (+)', 'Moderate (++)', 'Large (+++)']
  },
  {
    fieldName: 'bilirubin',
    label: 'Bilirubin',
    fieldType: 'select',
    options: ['Negative', '+1', '+2', '+3']
  },
  {
    fieldName: 'urobilinogen',
    label: 'Urobilinogen',
    fieldType: 'select',
    options: ['Normal', '0.2 mg/dL', '1 mg/dL', '2 mg/dL', '4 mg/dL', '8 mg/dL']
  },
  {
    fieldName: 'blood',
    label: 'Blood',
    fieldType: 'select',
    options: ['Negative', 'Trace', '+1', '+2', '+3']
  },

  // 2. Microscopy
  {
    fieldName: 'epithelial_cells',
    label: 'Epithelial Cells',
    fieldType: 'number',
    unit: '/HPF'
  },
  {
    fieldName: 'wbc_pus_cells',
    label: 'WBC (Pus Cells)',
    fieldType: 'number',
    unit: '/HPF'
  },
  {
    fieldName: 'rbc',
    label: 'RBC',
    fieldType: 'number',
    unit: '/HPF'
  },
  {
    fieldName: 'casts',
    label: 'Casts',
    fieldType: 'select',
    options: ['None', 'Hyaline', 'Granular', 'RBC Cast', 'WBC Cast', 'Epithelial Cast']
  },
  {
    fieldName: 'cast_count',
    label: 'Cast Count (Optional)',
    fieldType: 'number',
    unit: '/LPF',
    isRequired: false
  },
  {
    fieldName: 'bacteria',
    label: 'Bacteria',
    fieldType: 'select',
    options: ['None', 'Few', 'Moderate', 'Many']
  },
  {
    fieldName: 'hcg_test',
    label: 'HCG Test',
    fieldType: 'select',
    options: ['Negative', 'Positive']
  }
];

async function updateUrinalysisTemplate() {
  console.log('Updating urinalysis template fields...');

  const test = await prisma.labTest.findFirst({
    where: {
      OR: [
        { code: URINALYSIS_CODE },
        { name: { contains: 'Urinalysis', mode: 'insensitive' } }
      ]
    },
    include: {
      resultFields: {
        orderBy: { displayOrder: 'asc' }
      }
    }
  });

  if (!test) {
    throw new Error('Urinalysis test not found (code URINE001).');
  }

  await prisma.$transaction(async (tx) => {
    await tx.labTestResultField.deleteMany({
      where: { testId: test.id }
    });

    await tx.labTestResultField.createMany({
      data: DESIRED_URINALYSIS_FIELDS.map((field, index) => ({
        testId: test.id,
        fieldName: field.fieldName,
        label: field.label,
        fieldType: field.fieldType,
        unit: field.unit || null,
        normalRange: field.normalRange || null,
        options: field.options || null,
        isRequired: field.isRequired ?? true,
        displayOrder: index + 1
      }))
    });
  });

  const updated = await prisma.labTest.findUnique({
    where: { id: test.id },
    include: {
      resultFields: {
        orderBy: { displayOrder: 'asc' }
      }
    }
  });

  console.log(`Updated ${updated.name} (${updated.code || 'no-code'}) with ${updated.resultFields.length} fields.`);
  updated.resultFields.forEach((field) => {
    const optionCount = Array.isArray(field.options) ? field.options.length : 0;
    console.log(
      `${String(field.displayOrder).padStart(2, '0')}. ${field.label} | type=${field.fieldType}` +
      `${field.unit ? ` | unit=${field.unit}` : ''}` +
      `${field.normalRange ? ` | range=${field.normalRange}` : ''}` +
      `${optionCount ? ` | options=${optionCount}` : ''}`
    );
  });
}

updateUrinalysisTemplate()
  .catch((error) => {
    console.error('Failed to update urinalysis template:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
