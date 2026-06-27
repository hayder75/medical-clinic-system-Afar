const prisma = require('./src/config/database');

const CODES = ['URINE001', 'CBC001', 'STOOL001', 'HPA001', 'VDRL001', 'PICT001'];

async function main() {
  const tests = await prisma.labTest.findMany({
    where: { code: { in: CODES } },
    select: {
      code: true,
      name: true,
      resultFields: {
        select: {
          fieldName: true,
          label: true,
          fieldType: true,
          unit: true,
          normalRange: true,
          options: true,
          isRequired: true,
          displayOrder: true
        },
        orderBy: { displayOrder: 'asc' }
      }
    },
    orderBy: { code: 'asc' }
  });
  console.log(JSON.stringify(tests, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
