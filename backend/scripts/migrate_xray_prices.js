const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const NEW_XRAYS = {
  Head: [
    { name: 'Skull xray', price: 1200 },
    { name: 'Neck xray', price: 1200 },
  ],
  Chest: [
    { name: 'Chest xray (One view)', price: 800 },
    { name: 'Chest xray (2 view)', price: 1200 },
  ],
  Abdomen: [
    { name: 'Abdominal xray', price: 1200 },
  ],
  Back: [
    { name: 'Lumbo sacral xray', price: 1400 },
    { name: 'Thoraco lumbar xray', price: 1400 },
  ],
  Pelvis: [
    { name: 'Pelvic xray (one view)', price: 800 },
    { name: 'Pelvic xray (2 view)', price: 1200 },
    { name: 'Rt hip xray', price: 1200 },
    { name: 'Lt hip xray', price: 1200 },
  ],
  'Upper extremity': [
    { name: 'Rt shoulder xray', price: 1200 },
    { name: 'Lt shoulder xray', price: 1200 },
    { name: 'Lt scapular y view', price: 1200 },
    { name: 'Rt scapular y view', price: 1200 },
    { name: 'Rt humeral xray', price: 1200 },
    { name: 'Lt humeral xray', price: 1200 },
    { name: 'Rt elbow xray', price: 1200 },
    { name: 'Lt elbow xray', price: 1200 },
    { name: 'Rt forearm xray', price: 1200 },
    { name: 'Lt forearm xray', price: 1200 },
    { name: 'Rt wrist xray', price: 1200 },
    { name: 'Lt wrist xray', price: 1200 },
    { name: 'Rt hand xray', price: 1200 },
    { name: 'Lt hand xray', price: 1200 },
  ],
  'Lower limb': [
    { name: 'Rt femur xray', price: 1200 },
    { name: 'Lt femur xray', price: 1200 },
    { name: 'Rt knee xray', price: 1200 },
    { name: 'Lt knee xray', price: 1200 },
    { name: 'Rt leg xray', price: 1200 },
    { name: 'Lt leg xray', price: 1200 },
    { name: 'Rt ankle xray', price: 1200 },
    { name: 'Lt ankle xray', price: 1200 },
    { name: 'Rt foot xray', price: 1200 },
    { name: 'Lt foot xray', price: 1200 },
  ],
};

async function main() {
  console.log('Fetching radiology categories...');
  const categories = await prisma.radiologyCategory.findMany();
  const catMap = {};
  categories.forEach(c => { catMap[c.name] = c; });
  console.log('Categories:', categories.map(c => `${c.name} (id=${c.id})`).join(', '));

  const affectedCatNames = Object.keys(NEW_XRAYS);
  const affectedCats = affectedCatNames.map(n => catMap[n]).filter(Boolean);
  console.log(`\nAffected categories: ${affectedCats.map(c => c.name).join(', ')}`);

  // Step 1: Deactivate old X-ray InvestigationTypes in affected categories
  for (const cat of affectedCats) {
    const oldXrays = await prisma.investigationType.findMany({
      where: {
        radiologyCategoryId: cat.id,
        OR: [
          { name: { contains: 'x-ray', mode: 'insensitive' } },
          { name: { contains: 'cxr', mode: 'insensitive' } },
          { name: { contains: 'pa/lat', mode: 'insensitive' } },
        ]
      }
    });

    if (oldXrays.length > 0) {
      const ids = oldXrays.map(t => t.id);
      console.log(`\nDeactivating ${oldXrays.length} old X-rays in ${cat.name}:`);
      oldXrays.forEach(t => console.log(`  [${t.id}] ${t.name} = ${t.price}`));

      await prisma.investigationType.updateMany({
        where: { id: { in: ids } },
        data: { isActive: false }
      });

      // Also deactivate linked services
      const linkedServiceIds = oldXrays.filter(t => t.serviceId).map(t => t.serviceId);
      if (linkedServiceIds.length > 0) {
        await prisma.service.updateMany({
          where: { id: { in: linkedServiceIds } },
          data: { isActive: false }
        });
        console.log(`  Deactivated ${linkedServiceIds.length} linked services`);
      }
    }
  }

  // Step 2: Create new X-ray InvestigationTypes + Services
  for (const [catName, xrays] of Object.entries(NEW_XRAYS)) {
    const cat = catMap[catName];
    if (!cat) { console.error(`Category "${catName}" not found!`); continue; }

    for (const xr of xrays) {
      const serviceCode = `XR-${catName.replace(/\s+/g, '')}-${xr.name.replace(/[^a-zA-Z0-9]/g, '')}`;

      // Check if InvestigationType already exists with this name
      let invType = await prisma.investigationType.findFirst({
        where: { name: xr.name, category: 'RADIOLOGY' }
      });

      if (invType) {
        // Update existing - reactivate and update price/category
        console.log(`\nUpdating existing InvestigationType: ${xr.name}`);
        invType = await prisma.investigationType.update({
          where: { id: invType.id },
          data: {
            isActive: true,
            price: 0, // price comes from service
            radiologyCategoryId: cat.id,
          }
        });
      } else {
        // Create new InvestigationType
        console.log(`\nCreating InvestigationType: ${xr.name}`);
        invType = await prisma.investigationType.create({
          data: {
            name: xr.name,
            price: 0,
            category: 'RADIOLOGY',
            isActive: true,
            radiologyCategoryId: cat.id,
          }
        });
      }

      // Create or update Service
      let service = await prisma.service.findFirst({
        where: {
          OR: [
            { name: xr.name },
            { code: serviceCode }
          ]
        }
      });

      if (service) {
        console.log(`  Updating Service: ${service.name} -> ${xr.price}`);
        service = await prisma.service.update({
          where: { id: service.id },
          data: {
            name: xr.name,
            price: xr.price,
            isActive: true,
            category: 'RADIOLOGY',
            code: serviceCode,
            radiologyGroup: catName,
          }
        });
      } else {
        console.log(`  Creating Service: ${xr.name} = ${xr.price}`);
        service = await prisma.service.create({
          data: {
            name: xr.name,
            price: xr.price,
            isActive: true,
            category: 'RADIOLOGY',
            code: serviceCode,
            radiologyGroup: catName,
          }
        });
      }

      // Link InvestigationType to Service
      if (invType.serviceId !== service.id) {
        await prisma.investigationType.update({
          where: { id: invType.id },
          data: { serviceId: service.id }
        });
        console.log(`  Linked to service [${service.id}]`);
      }
    }
  }

  console.log('\n=== DONE ===');
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
