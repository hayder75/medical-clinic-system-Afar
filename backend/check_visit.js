const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const visit = await prisma.visit.findUnique({
    where: { id: 2442 },
    include: {
      labTestOrders: { select: { id: true, labTestId: true, status: true, labTest: { select: { name: true } } } },
      batchOrders: { where: { type: 'LAB' }, select: { id: true } }
    }
  });
  if (!visit) { console.log('Visit 2442 not found'); return; }
  console.log('Visit 2442: labTestOrders=' + visit.labTestOrders.length + ', batchOrders(LAB)=' + visit.batchOrders.length);
  const testIds = visit.labTestOrders.map(o => o.labTestId).filter(Boolean);
  const uniqueIds = [...new Set(testIds)];
  console.log('Unique labTestIds ordered: ' + uniqueIds.length);
  visit.labTestOrders.slice(0, 5).forEach(o => console.log('  id=' + o.labTestId + ' name=' + (o.labTest?.name || '?') + ' status=' + o.status));
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
