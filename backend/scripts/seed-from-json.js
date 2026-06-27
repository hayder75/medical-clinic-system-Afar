const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const jsonPath = path.join(__dirname, '..', '..', 'system-full-data.json');
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const data = JSON.parse(raw);

  const modelMap = {
    users: 'user',
    services: 'service',
    medications: 'medicationCatalog',
    investigationTypes: 'investigationType',
    diseases: 'disease',
    labTestGroups: 'labTestGroup',
    labTests: 'labTest',
    patients: 'patient',
    visits: 'visit',
    billings: 'billing',
    billingServices: 'billingService',
    billPayments: 'billPayment',
  };

  const order = [
    'users',
    'services',
    'medications',
    'investigationTypes',
    'diseases',
    'labTestGroups',
    'labTests',
    'patients',
    'visits',
    'billings',
    'billingServices',
    'billPayments',
  ];

  for (const key of order) {
    const items = data[key];
    if (!items || items.length === 0) {
      console.log(`Skipping ${key}: no data`);
      continue;
    }

    const modelName = modelMap[key];
    const model = prisma[modelName];
    if (!model) {
      console.log(`Skipping ${key}: prisma.${modelName} not found`);
      continue;
    }

    let inserted = 0;
    for (const item of items) {
      try {
        const record = { ...item };

        // Remove nested objects that aren't direct Prisma fields
        delete record.resultFields;
        delete record.group;
        delete record.tests;

        await model.create({ data: record });
        inserted++;
      } catch (err) {
        if (err.code === 'P2002') {
          // Duplicate - skip
          console.log(`  ${key}: duplicate ${item.id || item.name || 'record'}, skipping`);
        } else {
          console.error(`  ${key}: error inserting ${item.id || item.name}: ${err.message}`);
        }
      }
    }

    console.log(`${key}: ${inserted}/${items.length} records inserted`);
  }

  console.log('\nSeed complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
