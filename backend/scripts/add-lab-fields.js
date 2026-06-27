const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();
const uuidv4 = () => crypto.randomUUID();

async function main() {
  // Helper to find lab test by code
  const findTest = async (code) => {
    const t = await prisma.labTest.findUnique({ where: { code } });
    if (!t) console.log(`  WARN: Lab test ${code} not found`);
    return t;
  };

  // Helper to get max displayOrder for a test
  const maxOrder = async (testId) => {
    const max = await prisma.labTestResultField.aggregate({ where: { testId }, _max: { displayOrder: true } });
    return (max._max.displayOrder || 0) + 1;
  };

  // 1. Weil-Felix Test (WEIL001) - Add OX19, OX2, OXK
  const weil = await findTest('WEIL001');
  if (weil) {
    const order = await maxOrder(weil.id);
    const weilOptions = JSON.stringify(['Reactive', 'Non-reactive', 'Strong Reactive']);
    const fields = [
      { fieldName: 'ox19', label: 'OX19', fieldType: 'select', options: weilOptions, displayOrder: order },
      { fieldName: 'ox2', label: 'OX2', fieldType: 'select', options: weilOptions, displayOrder: order + 1 },
      { fieldName: 'oxk', label: 'OXK', fieldType: 'select', options: weilOptions, displayOrder: order + 2 },
    ];
    for (const f of fields) {
      await prisma.labTestResultField.create({ data: { id: uuidv4(), testId: weil.id, ...f } });
    }
    console.log('✅ Weil-Felix: added OX19, OX2, OXK');
  }

  // 2. Widal Test (WIDAL001) - Add O and H fields
  const widal = await findTest('WIDAL001');
  if (widal) {
    const order = await maxOrder(widal.id);
    const titerOptions = JSON.stringify(['1:20', '1:40', '1:80', '1:160', '1:320', 'Non-reactive']);
    await prisma.labTestResultField.create({ data: { id: uuidv4(), testId: widal.id, fieldName: 'o_titer', label: 'O Titer', fieldType: 'select', options: titerOptions, displayOrder: order } });
    await prisma.labTestResultField.create({ data: { id: uuidv4(), testId: widal.id, fieldName: 'h_titer', label: 'H Titer', fieldType: 'select', options: titerOptions, displayOrder: order + 1 } });
    console.log('✅ Widal: added O Titer, H Titer');
  }

  // 3. HIV/AIDS (HIV001) - Add First Line, Second Line, Final Result
  const hiv = await findTest('HIV001');
  if (hiv) {
    const order = await maxOrder(hiv.id);
    const hivOptions = JSON.stringify(['Positive', 'Negative', 'Invalid']);
    const fields = [
      { fieldName: 'first_line_result', label: 'First Line Result', fieldType: 'select', options: hivOptions, displayOrder: order },
      { fieldName: 'second_line_result', label: 'Second Line Result', fieldType: 'select', options: hivOptions, displayOrder: order + 1 },
      { fieldName: 'final_result', label: 'Final Result', fieldType: 'select', options: hivOptions, displayOrder: order + 2 },
    ];
    for (const f of fields) {
      await prisma.labTestResultField.create({ data: { id: uuidv4(), testId: hiv.id, ...f } });
    }
    console.log('✅ HIV: added First Line, Second Line, Final Result');
  }

  // 4. Rheumatoid Factor (RF001) - Update options to include Reactive/Non-reactive
  const rf = await findTest('RF001');
  if (rf) {
    await prisma.labTestResultField.updateMany({
      where: { testId: rf.id, fieldName: 'result' },
      data: { options: JSON.stringify(['Negative', 'Positive', 'Reactive', 'Non-reactive']) },
    });
    console.log('✅ RF: added Reactive/Non-reactive options');
  }

  // 5. VDRL (VDRL001) - Update options to include Reactive/Non-reactive
  const vdrl = await findTest('VDRL001');
  if (vdrl) {
    await prisma.labTestResultField.updateMany({
      where: { testId: vdrl.id, fieldName: 'result' },
      data: { options: JSON.stringify(['Negative', 'Positive', 'Reactive', 'Non-reactive']) },
    });
    console.log('✅ VDRL: added Reactive/Non-reactive options');
  }

  // 6. Gram Stain (GRAM001) - No new field needed, the remark already exists.
  // The frontend logic to auto-show remark when "Mixed organisms" is selected
  // will be handled in the frontend code.
  console.log('✅ Gram Stain: remark field already exists, will add frontend logic');

  // 7. Blood Film / Malaria BF (PBF001, PICT001) - Add parasite density
  for (const code of ['PBF001', 'PICT001']) {
    const bf = await findTest(code);
    if (bf) {
      const order = await maxOrder(bf.id);
      await prisma.labTestResultField.create({
        data: {
          id: uuidv4(), testId: bf.id,
          fieldName: 'parasite_density',
          label: 'Parasite Density',
          fieldType: 'select',
          options: JSON.stringify(['+1', '+2', '+3', '+4']),
          displayOrder: order,
        },
      });
      console.log(`✅ ${code}: added Parasite Density`);
    }
  }

  console.log('\n🎉 All lab test fields added successfully');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
