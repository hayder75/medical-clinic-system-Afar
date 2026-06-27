
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const orders = await prisma.emergencyDrugOrder.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
            service: true,
            doctor: true,
            visit: true
        }
    });
    console.log(JSON.stringify(orders, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
