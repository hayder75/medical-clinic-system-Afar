require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const antibodyCode = 'HPYLORIAB001';
  const antigenCode = 'HPYLORIAG001';

  const antibody = await prisma.labTest.findUnique({
    where: { code: antibodyCode },
    include: { resultFields: { orderBy: { displayOrder: 'asc' } } }
  });

  const antigen = await prisma.labTest.findUnique({
    where: { code: antigenCode },
    include: { resultFields: { orderBy: { displayOrder: 'asc' } } }
  });

  if (!antibody) {
    throw new Error(`Lab test not found: ${antibodyCode}`);
  }

  if (!antigen) {
    throw new Error(`Lab test not found: ${antigenCode}`);
  }

  console.log(`Found antibody fields: ${antibody.resultFields.length}`);
  console.log(`Found antigen fields before update: ${antigen.resultFields.length}`);

  await prisma.$transaction(async (tx) => {
    await tx.labTest.update({
      where: { id: antigen.id },
      data: {
        category: 'Serology',
        groupId: antibody.groupId || null
      }
    });

    await tx.labTestResultField.deleteMany({
      where: { testId: antigen.id }
    });

    if (antibody.resultFields.length > 0) {
      await tx.labTestResultField.createMany({
        data: antibody.resultFields.map((field) => ({
          testId: antigen.id,
          fieldName: field.fieldName,
          label: field.label,
          fieldType: field.fieldType,
          unit: field.unit,
          normalRange: field.normalRange,
          options: field.options,
          isRequired: field.isRequired,
          displayOrder: field.displayOrder
        }))
      });
    }
  });

  const updatedAntigen = await prisma.labTest.findUnique({
    where: { id: antigen.id },
    include: { resultFields: { orderBy: { displayOrder: 'asc' } } }
  });

  console.log('Done.');
  console.log(`Updated antigen category: ${updatedAntigen.category}`);
  console.log(`Updated antigen groupId: ${updatedAntigen.groupId || 'null'}`);
  console.log(`Updated antigen fields: ${updatedAntigen.resultFields.length}`);
}

main()
  .catch((error) => {
    console.error('Failed to fix H. pylori antigen setup:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
