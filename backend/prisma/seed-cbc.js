const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CBC_FIELDS = [
  { fieldName: 'wbc', label: 'WBC', fieldType: 'number', unit: 'x10^3/uL', normalRange: '4.5–11.0', displayOrder: 1, isAdditional: false },
  { fieldName: 'lymphAbsolute', label: 'Lymph#', fieldType: 'number', unit: 'x10^3/uL', displayOrder: 2, isAdditional: true },
  { fieldName: 'midAbsolute', label: 'Mid#', fieldType: 'number', unit: 'x10^3/uL', displayOrder: 3, isAdditional: true },
  { fieldName: 'granAbsolute', label: 'Gran#', fieldType: 'number', unit: 'x10^3/uL', displayOrder: 4, isAdditional: true },
  { fieldName: 'lymphPercent', label: 'Lymph%', fieldType: 'number', unit: '%', displayOrder: 5, isAdditional: true },
  { fieldName: 'midPercent', label: 'Mid%', fieldType: 'number', unit: '%', displayOrder: 6, isAdditional: true },
  { fieldName: 'granPercent', label: 'Gran%', fieldType: 'number', unit: '%', displayOrder: 7, isAdditional: true },
  { fieldName: 'hgb', label: 'HGB', fieldType: 'number', unit: 'g/dL', displayOrder: 8, isAdditional: false },
  { fieldName: 'rbc', label: 'RBC', fieldType: 'number', unit: 'x10^6/uL', normalRange: '4.2–6.1', displayOrder: 9, isAdditional: false },
  { fieldName: 'hct', label: 'HCT', fieldType: 'number', unit: '%', displayOrder: 10, isAdditional: false },
  { fieldName: 'mcv', label: 'MCV', fieldType: 'number', unit: 'fL', normalRange: '80–100', displayOrder: 11, isAdditional: false },
  { fieldName: 'mch', label: 'MCH', fieldType: 'number', unit: 'pg', normalRange: '27–31', displayOrder: 12, isAdditional: false },
  { fieldName: 'mchc', label: 'MCHC', fieldType: 'number', unit: 'g/dL', normalRange: '32–36', displayOrder: 13, isAdditional: false },
  { fieldName: 'rdwCv', label: 'RDW-CV', fieldType: 'number', unit: '%', normalRange: '11.5–14.5', displayOrder: 14, isAdditional: true },
  { fieldName: 'rdwSd', label: 'RDW-SD', fieldType: 'number', unit: 'fL', normalRange: '39–46', displayOrder: 15, isAdditional: true },
  { fieldName: 'plt', label: 'PLT', fieldType: 'number', unit: 'x10^3/uL', displayOrder: 16, isAdditional: false },
  { fieldName: 'mpv', label: 'MPV', fieldType: 'number', unit: 'fL', normalRange: '7.5–11.5', displayOrder: 17, isAdditional: true },
  { fieldName: 'pdw', label: 'PDW', fieldType: 'number', unit: 'fL', normalRange: '9.0–17.0', displayOrder: 18, isAdditional: true },
  { fieldName: 'pct', label: 'PCT', fieldType: 'number', unit: '%', normalRange: '0.15–0.35', displayOrder: 19, isAdditional: true },
  { fieldName: 'additionalNotes', label: 'Additional Notes', fieldType: 'textarea', displayOrder: 20, isAdditional: true },
];

async function main() {
  let cbcTest = await prisma.labTest.findUnique({ where: { code: 'CBC001' } });

  if (!cbcTest) {
    console.log('Creating CBC001 LabTest...');
    cbcTest = await prisma.labTest.create({
      data: {
        code: 'CBC001',
        name: 'Complete Blood Count (CBC)',
        category: 'Hematology',
        description: 'Comprehensive hematology panel including WBC, RBC, HGB, HCT, Platelets, Indices, and Differential',
        price: 400,
        unit: 'UNIT',
        isActive: true,
        displayOrder: 0,
      },
    });
    console.log(`Created CBC001 with id: ${cbcTest.id}`);
  } else {
    console.log(`Found CBC001 with id: ${cbcTest.id}`);
  }

  // Upsert all result fields
  for (const field of CBC_FIELDS) {
    const existing = await prisma.labTestResultField.findFirst({
      where: { testId: cbcTest.id, fieldName: field.fieldName },
    });

    if (existing) {
      await prisma.labTestResultField.update({
        where: { id: existing.id },
        data: field,
      });
      console.log(`Updated field: ${field.fieldName}`);
    } else {
      await prisma.labTestResultField.create({
        data: { ...field, testId: cbcTest.id },
      });
      console.log(`Created field: ${field.fieldName}`);
    }
  }

  const fieldCount = await prisma.labTestResultField.count({ where: { testId: cbcTest.id } });
  console.log(`\n✅ CBC panel setup complete! ${fieldCount} result fields configured.`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
