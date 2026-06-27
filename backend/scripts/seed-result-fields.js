const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const jsonPath = path.join(__dirname, '..', '..', 'system-full-data.json');
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(raw);

  // Insert LabTestResultFields from nested data
  let inserted = 0;
  for (const labTest of data.labTests) {
    const fields = labTest.resultFields;
    if (!fields || fields.length === 0) continue;

    for (const field of fields) {
      try {
        await prisma.labTestResultField.create({ data: field });
        inserted++;
      } catch (err) {
        if (err.code === 'P2002') {
          // skip duplicates
        } else {
          console.error(`Error inserting resultField ${field.id}: ${err.message}`);
        }
      }
    }
  }
  console.log(`LabTestResultField: ${inserted} records inserted`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Failed:', e);
  process.exit(1);
});
