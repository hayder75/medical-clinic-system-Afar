const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tests = await prisma.labTest.findMany({
    where: {
      isActive: true,
      serviceId: null
    }
  });

  if (tests.length === 0) {
    console.log('All active LabTests already have a linked Service.');
    return;
  }

  console.log(`Found ${tests.length} active LabTest(s) without a Service:\n`);

  for (const test of tests) {
    const code = `LAB-${test.code || test.id.slice(0, 8).toUpperCase()}`;

    const existingService = await prisma.service.findUnique({ where: { code } });

    if (existingService) {
      console.log(`  Service ${code} already exists, linking to ${test.name}...`);
      await prisma.labTest.update({
        where: { id: test.id },
        data: { serviceId: existingService.id }
      });
      console.log(`  ✅ Linked ${test.name} (${test.code}) -> Service ${code}`);
      continue;
    }

    const service = await prisma.service.create({
      data: {
        code,
        name: `${test.name} (Lab)`,
        category: 'LAB',
        price: test.price,
        unit: 'UNIT',
        description: test.description || `Lab test: ${test.name}`,
        isActive: true
      }
    });

    await prisma.labTest.update({
      where: { id: test.id },
      data: { serviceId: service.id }
    });

    console.log(`  ✅ Created Service ${code} (${test.price} ETB) and linked ${test.name}`);
  }

  console.log('\nDone! All active LabTests now have a linked Service.');
}

main()
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
