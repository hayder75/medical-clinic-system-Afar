const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DESIRED_CBC_FIELDS = [
  { fieldName: 'wbc', label: 'WBC', unit: 'x10^3/uL' },
  { fieldName: 'lymph_abs', label: 'Lymph#', unit: 'x10^3/uL' },
  { fieldName: 'mid_abs', label: 'Mid#', unit: 'x10^3/uL' },
  { fieldName: 'gran_abs', label: 'Gran#', unit: 'x10^3/uL' },
  { fieldName: 'lymph_pct', label: 'Lymph%', unit: '%' },
  { fieldName: 'mid_pct', label: 'Mid%', unit: '%' },
  { fieldName: 'gran_pct', label: 'Gran%', unit: '%' },
  { fieldName: 'hgb', label: 'HGB', unit: 'g/dL' },
  { fieldName: 'rbc', label: 'RBC', unit: 'x10^6/uL' },
  { fieldName: 'hct', label: 'HCT', unit: '%' },
  { fieldName: 'mcv', label: 'MCV', unit: 'fL' },
  { fieldName: 'mch', label: 'MCH', unit: 'pg' },
  { fieldName: 'mchc', label: 'MCHC', unit: 'g/dL' },
  { fieldName: 'rdw_cv', label: 'RDW-CV', unit: '%' },
  { fieldName: 'rdw_sd', label: 'RDW-SD', unit: 'fL' },
  { fieldName: 'plt', label: 'PLT', unit: 'x10^3/uL' },
  { fieldName: 'mpv', label: 'MPV', unit: 'fL' },
  { fieldName: 'pdw', label: 'PDW', unit: 'fL' },
  { fieldName: 'pct', label: 'PCT', unit: '%' },
  { fieldName: 'additional_notes', label: 'Additional Notes', unit: null, fieldType: 'textarea', isRequired: false }
];

const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function updateCbcTemplate() {
  console.log('Updating CBC template fields...');

  const cbcTest = await prisma.labTest.findFirst({
    where: { code: 'CBC001' },
    include: { resultFields: true }
  });

  if (!cbcTest) {
    throw new Error('CBC test (code CBC001) not found');
  }

  const existing = cbcTest.resultFields || [];

  // Preserve existing normal ranges by matching either label or fieldName.
  const rangeByKey = new Map();
  for (const field of existing) {
    rangeByKey.set(normalize(field.label), field.normalRange || null);
    rangeByKey.set(normalize(field.fieldName), field.normalRange || null);
  }

  await prisma.$transaction(async (tx) => {
    await tx.labTestResultField.deleteMany({
      where: { testId: cbcTest.id }
    });

    await tx.labTestResultField.createMany({
      data: DESIRED_CBC_FIELDS.map((field, idx) => ({
        testId: cbcTest.id,
        fieldName: field.fieldName,
        label: field.label,
        fieldType: field.fieldType || 'number',
        unit: field.unit,
        normalRange: rangeByKey.get(normalize(field.label)) || rangeByKey.get(normalize(field.fieldName)) || null,
        options: null,
        isRequired: field.isRequired ?? true,
        displayOrder: idx + 1
      }))
    });
  });

  console.log(`CBC template updated with ${DESIRED_CBC_FIELDS.length} fields in the requested order.`);
  console.log('Removed machine-incompatible fields: Neutrophils, Monocytes, Eosinophils, Basophils.');
}

updateCbcTemplate()
  .catch((error) => {
    console.error('Failed to update CBC template:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
