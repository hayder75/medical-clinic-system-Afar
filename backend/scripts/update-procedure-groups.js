const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const groups = {
    GYNECOLOGY: [
      'PROC007', // dipo provera
      'PROC008', // lucid
      'PROC009', // Implanole removal
      'PROC006', // implant insertion
      'PROC032', // ubandex
    ],
    SURGERY: [
      'PROC003', // Wound Debridement
      'PROC005', // Foreign Body Removal
      'PROC001', // Minor Surgical Procedure
      'PROC002', // Suture Removal
      'PROC004', // Abscess Drainage
      'PROC012', // abscess drainage large
      'PROC018', // FB Removal
      'PROC019', // SATURING
      'PROC020', // ABSCESSDRAIN
      'PROC021', // MINOR PROCEDUE(MIN)
      'PROC016', // Circumcision (for Male)
      'PROC025', // cryotherapy
      'PROC026', // electrosurgery
      'PROC027', // skin analysis 1
      'PROC028', // Skin Analysis 2
      'PROC029', // PRP
      'CONS009', // PRP+ micro needling
      'CONS008', // Micro needling
      'PROC031', // IL steriod
      'PROC030', // facial
    ],
  };

  for (const [group, codes] of Object.entries(groups)) {
    const result = await prisma.service.updateMany({
      where: { code: { in: codes } },
      data: { procedureGroup: group },
    });
    console.log(`Set ${result.count} services to ${group}`);
  }

  const remaining = await prisma.service.findMany({
    where: { category: 'PROCEDURE', procedureGroup: null },
    select: { code: true, name: true },
  });
  if (remaining.length > 0) {
    console.log('\nServices still without procedureGroup (will show as OTHER):');
    remaining.forEach(s => console.log(`  ${s.code} - ${s.name}`));
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
