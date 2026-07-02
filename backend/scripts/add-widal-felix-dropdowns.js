const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const log = (msg) => console.log(`  ${msg}`);

async function main() {
  console.log('Adding Widal/Weil-Felix dropdown result fields...\n');

  const tests = await prisma.labTest.findMany({
    where: { code: { in: ['SERO-WIDAL', 'WEIL001'] } },
    select: { id: true, code: true, name: true }
  });

  const widal = tests.find(t => t.code === 'SERO-WIDAL');
  const weil = tests.find(t => t.code === 'WEIL001');

  const REACTIVE_OPTIONS = ['Reactive', 'Non-reactive', 'Strongly Reactive'];

  // Widal test: add dropdown fields for O and H interpretation
  if (widal) {
    const existingFieldNames = (await prisma.labTestResultField.findMany({
      where: { testId: widal.id },
      select: { fieldName: true }
    })).map(f => f.fieldName);

    const widalFieldsToAdd = [
      { fieldName: 'widalOReactive', label: 'O Titer Interpretation', fieldType: 'select', options: REACTIVE_OPTIONS, displayOrder: 3 },
      { fieldName: 'widalHReactive', label: 'H Titer Interpretation', fieldType: 'select', options: REACTIVE_OPTIONS, displayOrder: 4 },
    ];

    for (const field of widalFieldsToAdd) {
      if (!existingFieldNames.includes(field.fieldName)) {
        await prisma.labTestResultField.create({
          data: { testId: widal.id, ...field }
        });
        log(`Added "${field.label}" to ${widal.name}`);
      } else {
        log(`Skipped "${field.label}" — already exists`);
      }
    }
  }

  // Weil-Felix test: add dropdown fields for OX19, OX2, OXK
  if (weil) {
    const existingFieldNames = (await prisma.labTestResultField.findMany({
      where: { testId: weil.id },
      select: { fieldName: true }
    })).map(f => f.fieldName);

    const weilFieldsToAdd = [
      { fieldName: 'ox19Reactive', label: 'OX19 Interpretation', fieldType: 'select', options: REACTIVE_OPTIONS, displayOrder: 2 },
      { fieldName: 'ox2Reactive', label: 'OX2 Interpretation', fieldType: 'select', options: REACTIVE_OPTIONS, displayOrder: 3 },
      { fieldName: 'oxkReactive', label: 'OXK Interpretation', fieldType: 'select', options: REACTIVE_OPTIONS, displayOrder: 4 },
    ];

    for (const field of weilFieldsToAdd) {
      if (!existingFieldNames.includes(field.fieldName)) {
        await prisma.labTestResultField.create({
          data: { testId: weil.id, ...field }
        });
        log(`Added "${field.label}" to ${weil.name}`);
      } else {
        log(`Skipped "${field.label}" — already exists`);
      }
    }
  }

  console.log('\nDone.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
