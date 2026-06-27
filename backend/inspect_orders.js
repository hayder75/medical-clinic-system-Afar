const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const orderIds = [6, 7, 8];

    console.log('--- BatchOrders ---');
    const batchOrders = await prisma.batchOrder.findMany({
        where: { id: { in: orderIds } },
        include: {
            services: true,
            _count: {
                select: { services: true }
            }
        }
    });
    console.log(JSON.stringify(batchOrders, null, 2));

    console.log('\n--- LabTestOrders linked to these BatchOrders ---');
    const labTestOrders = await prisma.labTestOrder.findMany({
        where: { batchOrderId: { in: orderIds } },
        include: {
            labTest: true
        }
    });
    console.log(JSON.stringify(labTestOrders, null, 2));

    console.log('\n--- All LabTestOrders for these patients/visits ---');
    const patientIds = [...new Set(batchOrders.map(bo => bo.patientId))];
    const visitIds = [...new Set(batchOrders.map(bo => bo.visitId).filter(Boolean))];

    const relatedLabTestOrders = await prisma.labTestOrder.findMany({
        where: {
            OR: [
                { patientId: { in: patientIds } },
                { visitId: { in: visitIds } }
            ]
        },
        include: {
            labTest: true
        }
    });
    console.log(JSON.stringify(relatedLabTestOrders, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
