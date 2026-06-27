const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const log = (msg) => console.log(`  ${msg}`);

async function main() {
  console.log('\n=== LAB RESTRUCTURE SEED ===\n');

  // ============================================================
  // 1. DEACTIVATE tests NOT in client's list
  // ============================================================
  console.log('--- Deactivating unused tests ---');
  const deactivateCodes = [
    // Individual CBC components (replaced by CBC001)
    'CBC-WBC', 'CBC-RBC', 'CBC-HGB', 'CBC-HCT', 'CBC-MCV', 'CBC-MCH', 'CBC-MCHC',
    'CBC-PLT', 'CBC-NEUT', 'CBC-LYMPH', 'CBC-MONO', 'CBC-EO', 'CBC-BASO',
    // Extra coagulation
    'COAG-DDIMER', 'COAG-FIB', 'COAG-BT',
    // Old urinalysis (replaced by individual items)
    'MICRO-UA',
    // Old stool (replaced by individual items)
    'MICRO-STOOL',
    // Extra serology (keep HPYLORIAB, HPYLORIAG — they are the main H. pylori tests)
    'HCV001', 'HIV001',
    // All infectious disease serology (not in client list)
    'IDSERO-RUBG', 'IDSERO-RUBM', 'IDSERO-CMVG', 'IDSERO-CMVM',
    'IDSERO-EBVVG', 'IDSERO-EBVVM', 'IDSERO-EBVNA',
    'IDSERO-TOXG', 'IDSERO-TOXM', 'IDSERO-DENGUE', 'IDSERO-BRUCELLA',
    'IDSERO-MYCOG', 'IDSERO-MYCOM', 'IDSERO-COVPCR', 'IDSERO-COVIGG',
    // Hepatitis profile (keep only HBsAg and Anti-HCV)
    'HEP-HAVAB', 'HEP-HAVIGM', 'HEP-HBCAB', 'HEP-HBCIGM', 'HEP-HBSAB', 'HEP-HBEAG', 'HEP-HBEAB',
    // HCG, RTD (old standalone)
    'HCG001', 'HCG002', 'RTD001',
    // Microbiology extras
    'AFB001', 'AFB003', 'SMPL001', 'TVAG001',
    // Tumor markers (keep only CEA, PSA)
    'TUMOR-AFP', 'TUMOR-CA125', 'TUMOR-CA153', 'TUMOR-CA199', 'TUMOR-BHCG', 'TUMOR-PSAF',
    // Cardiac markers (keep only Troponin I, BNP)
    'CARD-TROPT', 'CARD-CKMB', 'CARD-NTBNP', 'CARD-HCY',
    // Hormone extras (keep only what's in client list)
    'HORMONE-CORT', 'HORMONE-DHEA', 'HORMONE-IGF1', 'HORMONE-PTH', 'HORMONE-TESTO',
    // Iron studies (keep only Ferritin)
    'IRON-FE', 'IRON-TIBC', 'IRON-TRANSF', 'IRON-TSAT',
    // Inflammatory markers (keep only CRP)
    'INFLAM-PCT', 'INFLAM-HAPTO',
    // ABG
    'ABG-PANEL',
    // Diabetes extras (keep only FBS, HbA1c)
    'DIABETES-PPBS', 'DIABETES-OGTT', 'DIABETES-MALB',
    // Immunology (not in client's list)
    'IMMUNO-ANA', 'IMMUNO-CCP', 'IMMUNO-DSDNA', 'IMMUNO-TPO', 'IMMUNO-TTG', 'IMMUNO-C3', 'IMMUNO-C4',
    // Allergy
    'ALLERGY-IGE', 'ALLERGY-FOOD', 'ALLERGY-INHAL',
    // TDM
    'TDM-DIGOXIN', 'TDM-LITHIUM', 'TDM-VALPROATE', 'TDM-CARBA', 'TDM-PHENYTOIN', 'TDM-VANCO',
    // Vitamins (keep only D, Mg, B12, Folate, Zinc - actually client only uses D3)
    'VITAMIN-B12', 'VITAMIN-FOLATE', 'VITAMIN-ZN',
    // Old AST/ALP duplicates
    'AST001', 'ALP001', 'DBIL001', 'TBIL001', 'TP001',
    // RF duplicate
    'RF001',
    // Old microbiology
    'MICRO-BF', // We'll use PICT001 for malaria instead
  ];

  let deactivated = 0;
  for (const code of deactivateCodes) {
    const test = await prisma.labTest.findUnique({ where: { code } });
    if (test && test.isActive) {
      await prisma.labTest.update({ where: { code }, data: { isActive: false } });
      log(`Deactivated: ${code}`);
      deactivated++;
    }
  }

  // Also deactivate by name match for tests without codes
  const oldMicroTests = await prisma.labTest.findMany({
    where: { name: { in: ['Sample Examination', 'T. vaginalis Wet Mount'] }, isActive: true }
  });
  for (const t of oldMicroTests) {
    await prisma.labTest.update({ where: { id: t.id }, data: { isActive: false } });
    log(`Deactivated: ${t.name}`);
    deactivated++;
  }

  console.log(`  Total deactivated: ${deactivated}\n`);

  // ============================================================
  // 2. REACTIVATE tests needed by client
  // ============================================================
  console.log('--- Reactivating tests ---');
  const reactivateCodes = [
    { code: 'BGRH001', name: 'Blood Group & Rh' },
    { code: 'WEIL001', name: 'Weil-Felix Test' },
    { code: 'PICT001', name: 'Blood Film for Malaria' },
  ];
  let reactivated = 0;
  for (const { code, name } of reactivateCodes) {
    const test = await prisma.labTest.findUnique({ where: { code } });
    if (test && !test.isActive) {
      await prisma.labTest.update({ where: { code }, data: { isActive: true } });
      log(`Reactivated: ${code} (${name})`);
      reactivated++;
    }
  }
  console.log(`  Total reactivated: ${reactivated}\n`);

  // ============================================================
  // 3. UPDATE CATEGORIES - move tests to correct categories
  // ============================================================
  console.log('--- Updating categories ---');

  const moveToHormone = [
    { code: 'THYROID-TSH', name: 'TSH' },
    { code: 'THYROID-FT3', name: 'Free T3' },
    { code: 'THYROID-FT4', name: 'Free T4' },
    { code: 'HORMONE-FSH', name: 'FSH' },
    { code: 'HORMONE-LH', name: 'LH' },
    { code: 'HORMONE-PRL', name: 'Prolactin' },
    { code: 'HORMONE-E2', name: 'Estradiol (E2)' },
    { code: 'HORMONE-PROG', name: 'Progesterone' },
    { code: 'CARD-TROPI', name: 'Troponin I' },
    { code: 'CARD-BNP', name: 'BNP' },
    { code: 'INFLAM-CRP', name: 'CRP' },
    { code: 'DIABETES-A1C', name: 'HbA1c' },
    { code: 'IRON-FERR', name: 'Ferritin' },
    { code: 'TUMOR-CEA', name: 'CEA' },
    { code: 'TUMOR-PSA', name: 'PSA' },
    { code: 'VITAMIN-D', name: 'Vitamin D 25-OH' },
  ];

  const moveToSerology = [
    { code: 'SERO-ASO', name: 'ASO Titer' },
    { code: 'SERO-RF', name: 'Rheumatoid Factor' },
    { code: 'KFT-UA', name: 'Uric Acid' },
    { code: 'DIABETES-FBS', name: 'FBS' },
    { code: 'RBG001', name: 'RBS' },
    { code: 'SERO-WIDAL', name: 'Widal Test' },
    { code: 'SERO-VDRL', name: 'VDRL/RPR' },
    { code: 'SERO-HIV', name: 'HIV 1&2' },
    { code: 'WEIL001', name: 'Weil-Felix Test' },
    { code: 'SERO-ASO', name: 'ASO Titer' },
  ];

  const moveToVirology = [
    { code: 'SERO-HBSAG', name: 'HBsAg' },
    { code: 'SERO-HCV', name: 'Anti-HCV' },
  ];

  const moveToHematology = [
    { code: 'ESR001', name: 'ESR' },
    { code: 'BGRH001', name: 'Blood Group & Rh' },
    { code: 'PICT001', name: 'Blood Film for Malaria' },
  ];

  const moveToBacteriology = [
    { code: 'MICRO-GRAM', name: 'Gram stain' },
    { code: 'MICRO-CS', name: 'Culture & Sensitivity' },
  ];

  for (const { code, name } of moveToHormone) {
    const test = await prisma.labTest.findUnique({ where: { code } });
    if (test && test.category !== 'Hormone') {
      await prisma.labTest.update({ where: { code }, data: { category: 'Hormone' } });
      log(`Moved ${code} (${name}) → Hormone`);
    }
  }

  for (const { code, name } of moveToSerology) {
    const test = await prisma.labTest.findUnique({ where: { code } });
    if (test && test.category !== 'Serology') {
      await prisma.labTest.update({ where: { code }, data: { category: 'Serology' } });
      log(`Moved ${code} (${name}) → Serology`);
    }
  }

  for (const { code, name } of moveToHematology) {
    const test = await prisma.labTest.findUnique({ where: { code } });
    if (test && test.category !== 'Hematology') {
      await prisma.labTest.update({ where: { code }, data: { category: 'Hematology' } });
      log(`Moved ${code} (${name}) → Hematology`);
    }
  }

  for (const { code, name } of moveToVirology) {
    const test = await prisma.labTest.findUnique({ where: { code } });
    if (test && test.category !== 'Virology') {
      await prisma.labTest.update({ where: { code }, data: { category: 'Virology' } });
      log(`Moved ${code} (${name}) → Virology`);
    }
  }

  for (const { code, name } of moveToBacteriology) {
    const test = await prisma.labTest.findUnique({ where: { code } });
    if (test && test.category !== 'Bacteriology') {
      await prisma.labTest.update({ where: { code }, data: { category: 'Bacteriology' } });
      log(`Moved ${code} (${name}) → Bacteriology`);
    }
  }

  // Move Blood Chemistry tests that should stay in Chemistry to 'Chemistry' category
  const keepInChemistry = [
    'LFT-AST', 'LFT-ALT', 'LFT-ALP', 'LFT-ALB', 'LFT-TBIL', 'LFT-DBIL', 'LFT-TP',
    'LIPID-TC', 'LIPID-HDL', 'LIPID-LDL', 'LIPID-TG',
    'KFT-BUN', 'KFT-CREA', 'KFT-NA', 'KFT-K', 'KFT-CL', 'KFT-CA',
    'VITAMIN-MG', 'BONE-PO4', 'AMY001',
  ];
  for (const code of keepInChemistry) {
    const test = await prisma.labTest.findUnique({ where: { code } });
    if (test && test.category !== 'Chemistry') {
      await prisma.labTest.update({ where: { code }, data: { category: 'Chemistry' } });
      log(`Moved ${code} → Chemistry`);
    }
  }

  console.log('');

  // ============================================================
  // 4. CREATE NEW TESTS
  // ============================================================
  console.log('--- Creating new tests ---');

  const NEW_TESTS = [
    // ---- Urinalysis - Dipstick (12) ----
    { code: 'UASUGAR', name: 'Sugar', category: 'Urinalysis', price: 50 },
    { code: 'UACOLOR', name: 'Color', category: 'Urinalysis', price: 30 },
    { code: 'UAPH', name: 'pH', category: 'Urinalysis', price: 30 },
    { code: 'UAAPPEAR', name: 'Appearance', category: 'Urinalysis', price: 30 },
    { code: 'UASG', name: 'Sp. Gravity', category: 'Urinalysis', price: 30 },
    { code: 'UANITRITE', name: 'Nitrite', category: 'Urinalysis', price: 30 },
    { code: 'UAALB', name: 'Albumin', category: 'Urinalysis', price: 50 },
    { code: 'UAKETON', name: 'Keton', category: 'Urinalysis', price: 30 },
    { code: 'UABILI', name: 'Bilirubin', category: 'Urinalysis', price: 30 },
    { code: 'UAUROBIL', name: 'Urobilinogen', category: 'Urinalysis', price: 30 },
    { code: 'UABLOOD', name: 'Blood', category: 'Urinalysis', price: 30 },
    { code: 'UALEUK', name: 'Leukocyte', category: 'Urinalysis', price: 30 },
    // ---- Urinalysis - Microscopy (6) ----
    { code: 'UAWBC', name: 'WBC/HPF', category: 'Urinalysis', price: 50 },
    { code: 'UARBC', name: 'RBC/HPF', category: 'Urinalysis', price: 50 },
    { code: 'UAEPI', name: 'Epithelial cells/LPF', category: 'Urinalysis', price: 50 },
    { code: 'UACRYST', name: 'Crystals/LPF', category: 'Urinalysis', price: 50 },
    { code: 'UABACT', name: 'Bacteria', category: 'Urinalysis', price: 50 },
    { code: 'UACASTS', name: 'Casts in urine', category: 'Urinalysis', price: 50 },
    // ---- Urinalysis - standalone (1) ----
    { code: 'UAPREG', name: 'Urine pregnancy test', category: 'Urinalysis', price: 100 },
    // ---- Parasitology (5) ----
    { code: 'STCOLOR', name: 'stool Color', category: 'Parasitology', price: 30 },
    { code: 'STCONSIST', name: 'Consistency', category: 'Parasitology', price: 30 },
    { code: 'STDIRECT', name: 'Direct microscopy', category: 'Parasitology', price: 100 },
    { code: 'STOCCULT', name: 'Stool occult Blood', category: 'Parasitology', price: 50 },
    { code: 'STCONCENT', name: 'Stool Concentration', category: 'Parasitology', price: 80 },
    // ---- CSF (15) ----
    { code: 'CSFAPPEAR', name: 'CSF appearance', category: 'CSF', price: 50 },
    { code: 'CSFCELL', name: 'CSF cell count', category: 'CSF', price: 100 },
    { code: 'CSFGLUC', name: 'CSF glucose', category: 'CSF', price: 100 },
    { code: 'CSFPRESS', name: 'CSF pressure', category: 'CSF', price: 50 },
    { code: 'CSFPROT', name: 'CSF protein', category: 'CSF', price: 100 },
    { code: 'CSFMICRO', name: 'CSF microscopy', category: 'CSF', price: 100 },
    { code: 'CSFCULT', name: 'CSF bacterial culture', category: 'CSF', price: 200 },
    { code: 'CSFAFB', name: 'CSF AFB stain', category: 'CSF', price: 150 },
    { code: 'CSFCYTO', name: 'CSF analysis cytospin', category: 'CSF', price: 150 },
    { code: 'CSFCRAG', name: 'CSF Cryptococcus antigen', category: 'CSF', price: 200 },
    { code: 'CSFCHIK', name: 'Chikungunya RT-PCR (CSF)', category: 'CSF', price: 500 },
    { code: 'CSFINK', name: 'Cryptococcus India ink', category: 'CSF', price: 150 },
    { code: 'CSFCRDET', name: 'Cryptococcus detection (CSF)', category: 'CSF', price: 200 },
    { code: 'CSFDENG', name: 'Dengue RT-PCR (CSF)', category: 'CSF', price: 500 },
    { code: 'CSFZIKA', name: 'Zika RT-PCR (CSF)', category: 'CSF', price: 500 },
    // ---- Bacteriology (2 - Gram stain exists, need Wet Smear) ----
    { code: 'BACTWET', name: 'Wet Smear', category: 'Bacteriology', price: 100 },
    // ---- Body fluid specimen (3) ----
    { code: 'BFSTUD', name: 'Studded epithelial cells (body fluid)', category: 'Body fluid specimen', price: 100 },
    { code: 'BFCULT', name: 'Body fluid C/S', category: 'Body fluid specimen', price: 200 },
    { code: 'BFEPI', name: 'Epithelial cells (body fluid)', category: 'Body fluid specimen', price: 100 },
    // ---- Fungal (1) ----
    { code: 'FUNGKOH', name: 'Microscopy of KOH mount', category: 'Fungal', price: 100 },
    // ---- Chemistry (2 new) ----
    { code: 'CHEMLIPASE', name: 'Lipase', category: 'Chemistry', price: 150 },
    { code: 'CHEMCAION', name: 'Ca++ ionized', category: 'Chemistry', price: 100 },
    // ---- Hormone (3 new) ----
    { code: 'HORM-T3', name: 'T3', category: 'Hormone', price: 200 },
    { code: 'HORM-T4', name: 'T4', category: 'Hormone', price: 200 },
    { code: 'HORM-AMH', name: 'AMH', category: 'Hormone', price: 500 },
    // ---- Hematology (1 - malarial smear as rename of PICT001) ----
    // PICT001 reactivated above
  ];

  let created = 0;
  for (const testData of NEW_TESTS) {
    const existing = await prisma.labTest.findUnique({ where: { code: testData.code } });
    if (!existing) {
      await prisma.labTest.create({
        data: {
          ...testData,
          description: `${testData.name} — ${testData.category}`,
          displayOrder: 0,
        }
      });
      log(`Created: ${testData.code} (${testData.name})`);
      created++;
    } else if (!existing.isActive) {
      await prisma.labTest.update({ where: { code: testData.code }, data: { isActive: true } });
      log(`Reactivated: ${testData.code} (${testData.name})`);
      created++;
    }
  }
  console.log(`  Total created: ${created}\n`);

  // ============================================================
  // 5. UPDATE PANEL LABELS on PICT001 for malarial smear
  // ============================================================
  console.log('--- Updating test names ---');
  const renameTests = [
    { code: 'PICT001', name: 'Malarial smear' },
    { code: 'BGRH001', name: 'Blood typing' },
    { code: 'LFT-ALB', name: 'Serum Albumin' },
    { code: 'LFT-TBIL', name: 'Total bilirubin' },
    { code: 'LFT-DBIL', name: 'Direct bilirubin' },
    { code: 'LIPID-TC', name: 'Cholesterol' },
    { code: 'KFT-BUN', name: 'Urea' },
    { code: 'KFT-NA', name: 'Na+' },
    { code: 'KFT-K', name: 'K' },
    { code: 'KFT-CL', name: 'Cl--' },
    { code: 'KFT-CA', name: 'Ca++ total' },
    { code: 'VITAMIN-MG', name: 'Mg++' },
    { code: 'BONE-PO4', name: 'P' },
    { code: 'AMY001', name: 'Amylase' },
    { code: 'DIABETES-FBS', name: 'FBS' },
    { code: 'INFLAM-CRP', name: 'CRP' },
    { code: 'DIABETES-A1C', name: 'Hgb A/C' },
    { code: 'IRON-FERR', name: 'Serum Ferritin' },
    { code: 'CARD-TROPI', name: 'Troponin I measurement' },
    { code: 'CARD-BNP', name: 'BNP' },
    { code: 'TUMOR-CEA', name: 'CEA' },
    { code: 'TUMOR-PSA', name: 'PSA' },
    { code: 'HORMONE-PROG', name: 'Progesterone test' },
    { code: 'HORMONE-PRL', name: 'Serum Prolactin' },
    { code: 'VITAMIN-D', name: 'Vit D3' },
    { code: 'SERO-VDRL', name: 'VDRL' },
    { code: 'SERO-ASO', name: 'ASO Titer' },
    { code: 'SERO-RF', name: 'RH Factor' },
    { code: 'WEIL001', name: 'Weil Felix (OX19)' },
    { code: 'SERO-HIV', name: 'HIV rapid test' },
    { code: 'SERO-HCV', name: 'HCV Ab' },
    { code: 'SERO-HBSAG', name: 'HBsAg' },
    { code: 'SERO-WIDAL', name: 'Widal Test' },
    { code: 'MICRO-GRAM', name: 'Gram stain' },
    { code: 'COAG-PT', name: 'PT' },
    { code: 'COAG-APTT', name: 'PTT' },
    { code: 'COAG-INR', name: 'INR' },
    { code: 'LFT-ALP', name: 'ALP' },
    { code: 'LFT-AST', name: 'SGOT' },
    { code: 'LFT-ALT', name: 'SGPT' },
    { code: 'LFT-TP', name: 'Total Protein' },
    { code: 'KFT-CREA', name: 'Creatinine' },
    { code: 'KFT-UA', name: 'Uric Acid serum' },
    { code: 'LIPID-HDL', name: 'HDL' },
    { code: 'LIPID-LDL', name: 'LDL' },
    { code: 'LIPID-TG', name: 'Triglyceride' },
  ];

  for (const { code, name } of renameTests) {
    const test = await prisma.labTest.findUnique({ where: { code } });
    if (test && test.name !== name) {
      await prisma.labTest.update({ where: { code }, data: { name } });
      log(`Renamed ${code} → ${name}`);
    }
  }
  console.log('');

  // ============================================================
  // 6. CREATE/UPSERT PANELS (LabTestGroups)
  // ============================================================
  console.log('--- Creating/updating panels ---');

  const CATEGORY_COLORS = {
    'Hematology': '#dc2626',
    'Urinalysis': '#d97706',
    'Virology': '#7c3aed',
    'Serology': '#16a34a',
    'Parasitology': '#0d9488',
    'Chemistry': '#2563eb',
    'CSF': '#4338ca',
    'Hormone': '#ec4899',
    'Bacteriology': '#0891b2',
    'Body fluid specimen': '#64748b',
    'Fungal': '#ea580c',
  };

  const PANELS = [
    {
      name: 'CBC',
      category: 'Hematology',
      testCodes: ['CBC-WBC', 'CBC-RBC', 'CBC-HGB', 'CBC-HCT', 'CBC-MCV', 'CBC-MCH', 'CBC-MCHC', 'CBC-PLT', 'CBC-NEUT', 'CBC-LYMPH', 'CBC-MONO', 'CBC-EO', 'CBC-BASO', 'CBC-LYMPHABS', 'CBC-MIDABS', 'CBC-GRANABS', 'CBC-LYMPHPCT', 'CBC-MIDPCT', 'CBC-GRANPCT', 'CBC-RDWCV', 'CBC-RDWS', 'CBC-MPV', 'CBC-PDW', 'CBC-PCT'],
      displayOrder: 1
    },
    {
      name: 'Coagulation Profile',
      category: 'Hematology',
      testCodes: ['COAG-PT', 'COAG-APTT', 'COAG-INR'],
      displayOrder: 2
    },
    {
      name: 'Dipstick',
      category: 'Urinalysis',
      testCodes: ['UACOLOR', 'UAPH', 'UAAPPEAR', 'UASG', 'UANITRITE', 'UAALB', 'UAKETON', 'UABILI', 'UAUROBIL', 'UABLOOD', 'UALEUK', 'UASUGAR'],
      displayOrder: 1
    },
    {
      name: 'Urine microscopy',
      category: 'Urinalysis',
      testCodes: ['UAWBC', 'UARBC', 'UAEPI', 'UACRYST', 'UABACT', 'UACASTS'],
      displayOrder: 2
    },
    {
      name: 'Microscopy stool',
      category: 'Parasitology',
      testCodes: ['STCOLOR', 'STCONSIST', 'STDIRECT'],
      displayOrder: 1
    },
    {
      name: 'Electrolytes',
      category: 'Chemistry',
      testCodes: ['KFT-NA', 'KFT-K', 'KFT-CA', 'CHEMCAION', 'VITAMIN-MG', 'BONE-PO4', 'KFT-CL'],
      displayOrder: 1
    },
    {
      name: 'CSF exam',
      category: 'CSF',
      testCodes: ['CSFGLUC', 'CSFMICRO', 'CSFPRESS', 'CSFPROT', 'CSFAPPEAR', 'CSFCULT', 'CSFCELL', 'CSFAFB'],
      displayOrder: 1
    },
  ];

  // First, remove existing groups that are being replaced
  const oldGroupNames = ['Complete Blood Count (CBC)', 'Coagulation Studies', 'Dipstick', 'Urine microscopy', 'Microscopy stool', 'Electrolytes', 'CSF exam'];
  for (const name of oldGroupNames) {
    const group = await prisma.labTestGroup.findFirst({ where: { name } });
    if (group) {
      // Remove groupId from tests linked to this group
      await prisma.labTest.updateMany({ where: { groupId: group.id }, data: { groupId: null } });
      await prisma.labTestGroup.delete({ where: { id: group.id } });
      log(`Removed old group: ${name}`);
    }
  }

  // Create new panels
  for (const panel of PANELS) {
    const color = CATEGORY_COLORS[panel.category] || '';
    let group = await prisma.labTestGroup.findFirst({ where: { name: panel.name, category: panel.category } });
    if (!group) {
      group = await prisma.labTestGroup.create({
        data: { name: panel.name, category: panel.category, color, displayOrder: panel.displayOrder }
      });
    } else {
      await prisma.labTestGroup.update({
        where: { id: group.id },
        data: { displayOrder: panel.displayOrder, color }
      });
    }

    // Link tests to this panel
    for (const code of panel.testCodes) {
      const test = await prisma.labTest.findUnique({ where: { code } });
      if (test) {
        await prisma.labTest.update({ where: { code }, data: { groupId: group.id } });
      }
    }
    log(`Panel "${panel.name}" → ${panel.testCodes.length} tests`);
  }

  // Remove groupId from all tests not in any of the new panels
  const allPanelCodes = PANELS.flatMap(p => p.testCodes);
  const allPanelTests = await prisma.labTest.findMany({
    where: { groupId: { not: null }, isActive: true }
  });
  for (const test of allPanelTests) {
    if (!allPanelCodes.includes(test.code)) {
      await prisma.labTest.update({ where: { id: test.id }, data: { groupId: null } });
      log(`Removed ${test.code} from panel`);
    }
  }

  console.log('');

  // ============================================================
  // 7. VERIFY
  // ============================================================
  const byCategory = {};
  const allTests = await prisma.labTest.findMany({
    where: { isActive: true },
    include: { group: true },
    orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }]
  });
  for (const t of allTests) {
    if (!byCategory[t.category]) byCategory[t.category] = [];
    byCategory[t.category].push(t);
  }

  const categoryOrder = ['Hematology','Urinalysis','Virology','Serology','Parasitology','Chemistry','CSF','Hormone','Bacteriology','Body fluid specimen','Fungal'];
  console.log('\n=== FINAL STRUCTURE ===\n');
  let total = 0;
  for (const cat of categoryOrder) {
    const tests = byCategory[cat] || [];
    total += tests.length;
    const catColor = CATEGORY_COLORS[cat] || '';
    console.log(`\n${cat} (${tests.length} tests) [color: ${catColor || 'default'}]:`);
    const groups = {};
    for (const t of tests) {
      if (t.group) {
        if (!groups[t.group.name]) groups[t.group.name] = [];
        groups[t.group.name].push(t.code);
      } else {
        console.log(`  • ${t.code} — ${t.name}`);
      }
    }
    for (const [gname, gcodes] of Object.entries(groups)) {
      console.log(`  ▸ ${gname}: ${gcodes.join(', ')}`);
    }
  }
  console.log(`\nTotal active tests: ${total}`);

  // Also show leftover categories
  for (const [cat, tests] of Object.entries(byCategory)) {
    if (!categoryOrder.includes(cat)) {
      console.log(`\n⚠️  UNCATEGORIZED: ${cat} (${tests.length} tests) — these will need review`);
      tests.forEach(t => console.log(`  ${t.code} — ${t.name}`));
    }
  }

  console.log('\n=== DONE ===\n');
}

main()
  .catch(e => { console.error('SEED ERROR:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
