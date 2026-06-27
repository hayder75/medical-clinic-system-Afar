const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CATEGORIES = [
  { name: 'Head', displayOrder: 1 },
  { name: 'Chest', displayOrder: 2 },
  { name: 'Upper extremity', displayOrder: 3 },
  { name: 'Abdomen', displayOrder: 4 },
  { name: 'Back', displayOrder: 5 },
  { name: 'Pelvis', displayOrder: 6 },
  { name: 'Lower limb', displayOrder: 7 },
  { name: 'Angiography', displayOrder: 8 },
  { name: 'CT Scan', displayOrder: 9 },
  { name: 'Ultrasound', displayOrder: 10 },
];

const CATEGORY_PROCEDURES = {
  'Head': [
    'X-ray of mandible (Panorex)',
    'X-ray of mandible, three views',
    'X-ray of skull, four views',
    'X-ray of skull, two views',
  ],
  'Chest': [
    'PA/lat CXR',
    'X-ray of sternum, two to three views',
    'X-ray, chest',
    'Chest x-ray, single view',
    'X-ray of bilateral ribs, 2 views',
    'X-ray of chest PA/lateral + right and left lateral-decubitus, four views',
    'CXR 1 view AP',
    'CXR 2 views and apical',
    'CXR 4 views',
    'CXR apical lordotic',
    'Bilateral oblique CXR',
    'X-ray of chest, four views',
    'X-ray of left chest lateral-decubitus, one view',
    'X-ray of left ribs, two views',
    'X-ray of ribs, two views',
    'X-ray of right chest lateral-decubitus, one view',
    'X-ray of right ribs, two views',
    'X-ray of unilateral ribs and single view chest',
  ],
  'Upper extremity': [
    'X-ray of bilateral wrists',
    'X-ray of left scapula, two views',
    'X-ray of right scapula, two views',
    'X-ray, arm',
    'X-ray, hand',
    'X-ray, shoulder',
    'X-ray of bilateral elbows, 2 views',
    'X-ray of bilateral forearms, 2 views',
    'X-ray of bilateral upper arms, 2 views',
    'X-ray of left elbow, two views',
    'X-ray of left forearm, two views',
    'X-ray of left hand, two views',
    'X-ray of left upper arm, two views',
    'X-ray of left wrist, two views',
    'X-ray of right elbow, two views',
    'X-ray of right forearm, two views',
    'X-ray of right hand, two views',
    'X-ray of right upper arm, two views',
    'X-ray of right wrist, two views',
    'X-ray of bilateral hands, 2 views',
    'X-ray of bilateral acromioclavicular joints',
    'X-ray of bilateral clavicles, 2 views',
    'X-ray of left clavicle, two views',
    'X-ray of left shoulder, two views',
    'X-ray of left shoulder, Y view, one view',
    'X-ray of right clavicle, two views',
    'X-ray of right shoulder, two views',
    'X-ray of right shoulder, Y view, one view',
  ],
  'Abdomen': [
    'Radiographic imaging nephrostomy',
    'Retrograde cystography',
    'X-ray of kidney with intravenous contrast, six to eight views',
    'X-ray, abdomen',
    'Retrograde pyelogram',
    'X-ray of abdomen supine and upright, two views',
    'X-ray of abdomen, 1 view',
    'X-ray of abdomen, 2 views (AP supine and lateral decubitus)',
    'X-ray of upright abdomen, one view',
  ],
  'Back': [
    'X-ray of both sacroiliac joints',
    'X-ray of cervical spine, flexion and extension, two views',
    'X-ray of lumbar spine AP/lat + right and left obliques, four views',
    'X-ray of lumbar spine, flexion and extension, two views',
    'X-ray of lumbar spine, two standing views',
    'X-ray of right and left oblique lumbar spine, two views',
    'X-ray of right and left oblique thoracic spine, two views',
    'X-ray of thoracic spine, two views',
    'X-ray of thoracic-lumbar spine, four views',
    'X-ray of thoracolumbar spine, two standing views for scoliosis',
    'X-ray, spine',
    'X-ray of cervical spine AP/lateral and oblique, four views',
    'X-ray of cervical spine obliques, two views',
    'X-ray of cervical spine, two or three views',
    'X-ray of lumbar spine, two or three views',
    'X-ray of lumbosacral spine, two to three views',
    'X-ray of spine, single view',
    'X-ray of thoracic and lumbar spine, two views',
    'X-ray of thoracic spine AP/Lat + right and left obliques, four views',
    'X-ray of thoracic spine, two standing views',
  ],
  'Pelvis': [
    'Perineogram',
    'Plain x-ray of left sacroiliac joint',
    'Plain x-ray of right sacroiliac joint',
    'Ureteral reflux study',
    'Voiding urethrocystography',
    'X-ray of coccyx, two views',
    'X-ray, pelvis',
    'X-ray of AP Pelvis frog legs, one view',
    'X-ray of pelvis, 1 view',
  ],
  'Lower limb': [
    'X-ray, foot',
    'X-ray, leg',
    'X-ray of bilateral feet, 2 views',
    'X-ray of bilateral femurs, 2 views',
    'X-ray of both ankles, 2 views',
    'X-ray of both calcanei, two views',
    'X-ray of left ankle, three views',
    'X-ray of left ankle, two views',
    'X-ray of left calcaneus, two views',
    'X-ray of left femur, two views',
    'X-ray of left foot, two views',
    'X-ray of left lower leg, two views',
    'X-ray of right ankle, 2 views',
    'X-ray of right ankle, three views',
    'X-ray of right calcaneus, two views',
    'X-ray of right femur, two views',
    'X-ray of right foot, two views',
    'X-ray of right lower leg, two views',
    'X-ray of bilateral knees, 2 views',
    'X-ray of both knees two views with tunnel view',
    'X-ray of both knees, six views',
    'X-ray of left knee and sunrise, three views',
    'X-ray of left knee AP/lat + oblique, three views',
    'X-ray of left knee AP/lat and tunnel view, three views',
    'X-ray of left knee, one or two views',
    'X-ray of right knee and sunrise, three views',
    'X-ray of right knee AP/lat + oblique, three views',
    'X-ray of right knee AP/lat and tunnel, three views',
    'X-ray of right knee, one or two views',
  ],
  'Angiography': [
    'Angiogram',
    'Cerebral four vessel angiogram',
  ],
  'CT Scan': [
    'CT of abdomen and pelvis with IV contrast',
    'Computed tomography of abdomen and pelvis without contrast',
    'Computed tomography of bilateral lower extremities with IV contrast',
    'Computed tomography of bilateral lower extremities without contrast',
    'Computed tomography of both lower extremities without contrast',
    'Computed tomography of chest and abdomen with IV contrast',
    'Computed tomography of chest and abdomen without IV contrast',
    'Computed tomography of chest, abdomen and pelvis with IV contrast',
    'Computed tomography of chest, abdomen and pelvis without IV contrast',
    'CT of face with IV contrast',
    'Computed tomography of femur',
    'Cardiac CT',
    'Computed tomography of hip',
    'Computed tomography of knee',
    'Computed tomography of left lower extremity with intravenous contrast',
    'Computed tomography of orbits with contrast',
    'Computed tomography of orbits without contrast',
    'Computed tomography of right lower extremity with intravenous contrast',
    'Computed tomography of thoracic spine without contrast',
    'Computerized tomography of abdomen and pelvis without contrast',
    'Computerized tomography of cervical spine without contrast',
    'Computerized tomography of facial bones and maxilla without contrast',
    'Computerized tomography of left lower extremity without contrast',
    'Computerized tomography of left upper extremity with IV contrast',
    'Computerized tomography of left upper extremity without contrast',
    'Computerized tomography of lumbar spine without contrast',
    'Computerized tomography of right lower extremity without contrast',
    'Computerized tomography of right upper extremity with IV contrast',
    'Computerized tomography of right upper extremity without contrast',
    'CT modality',
    'CT scan of abdomen without contrast',
    'CT scan, chest',
    'Nephrostomy using computed tomography guidance',
    'Computed tomography of abdomen with contrast',
    'Computed tomography of abdomen without contrast',
    'CT of chest with IV contrast',
    'Computed tomography of chest without contrast',
    'Computed tomography of head with intravenous contrast',
    'Computed tomography scan, head',
    'CT of neck with IV contrast',
    'Computerized tomography of neck without contrast',
    'Computed tomography of pelvis without contrast',
    'Computed tomography of pelvis without then with intravenous contrast',
    'CT scan, pelvis',
    'CT of cervical spine with IV contrast',
    'CT of lumbar spine with IV contrast',
    'CT of thoracic spine with IV contrast',
  ],
  'Ultrasound': [
    'Doppler ultrasound of renal artery',
    'Endorectal US',
    'US Obstretric',
    'Ultrasonography by transrectal approach',
    'Ultrasound guidance for aspiration of pericardial space',
    'Ultrasound guidance for percutaneous drainage of cavity',
    'Ultrasound guided paracentesis',
    'Ultrasound obstetric doppler',
    'Ultrasound of abdomen and retroperitoneum, limited',
    'Ultrasound of bilateral lower extremity veins',
    'Ultrasound of left breast',
    'Ultrasound of left lower extremity vein',
    'Prostate US',
    'Ultrasound of right breast',
    'Ultrasound of right lower extremity vein',
    'Ultrasound of scrotum and testicle',
    'Thyroid US',
    'Ultrasound of vein of left upper extremity',
    'Ultrasound of veins of both upper extremities',
    'Ultrasound of veins of right upper extremity',
    'Ultrasound, abdomen',
    'Ultrasound, hepatic',
    'Ultrasound of abdomen and retroperitoneum',
    'Ultrasound of abdomen, limited',
    'Ultrasound of chest',
    'Ultrasound scan of head',
    'Ultrasound of head and neck',
    'Ultrasound of pelvis',
    'Ultrasound of pelvis, limited',
    'Ultrasound of pelvis, transvaginal',
  ],
};

async function main() {
  console.log('=== Seeding Radiology Categories & Procedures ===\n');

  // 1. Create/update categories
  const categoryMap = {};
  for (const cat of CATEGORIES) {
    const record = await prisma.radiologyCategory.upsert({
      where: { name: cat.name },
      update: { displayOrder: cat.displayOrder },
      create: { name: cat.name, displayOrder: cat.displayOrder },
    });
    categoryMap[cat.name] = record.id;
    console.log(`  ${cat.name} (id: ${record.id})`);
  }
  console.log(`\nCreated/updated ${CATEGORIES.length} categories\n`);

  // 2. Link procedures to categories
  let linked = 0;
  let created = 0;
  for (const [categoryName, procedures] of Object.entries(CATEGORY_PROCEDURES)) {
    const categoryId = categoryMap[categoryName];
    for (const procName of procedures) {
      // Find existing InvestigationType by name
      let invType = await prisma.investigationType.findFirst({
        where: { name: procName, category: 'RADIOLOGY' },
      });
      if (invType) {
        // Update its category link
        await prisma.investigationType.update({
          where: { id: invType.id },
          data: { radiologyCategoryId: categoryId },
        });
        linked++;
      } else {
        // Create new InvestigationType
        await prisma.investigationType.create({
          data: {
            name: procName,
            price: 0,
            category: 'RADIOLOGY',
            radiologyCategoryId: categoryId,
          },
        });
        created++;
      }
    }
  }

  console.log(`  Linked ${linked} existing procedures to categories`);
  console.log(`  Created ${created} new procedures`);
  console.log(`\nTotal procedures: ${linked + created}`);
  console.log('\n=== DONE ===');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
