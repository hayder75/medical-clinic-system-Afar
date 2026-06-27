const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const log = (msg) => console.log(`  ${msg}`);

// ============================================================
// RESULT FIELD DEFINITIONS FOR ALL TESTS
// ============================================================

const RESULT_FIELDS = {
  // ========== HEMATOLOGY ==========
  'CBC-WBC': [{ fieldName: 'wbc', label: 'WBC', fieldType: 'number', unit: 'x10^3/uL', normalRange: '4.5–11.0', displayOrder: 1 }],
  'CBC-RBC': [{ fieldName: 'rbc', label: 'RBC', fieldType: 'number', unit: 'x10^6/uL', normalRange: 'M: 4.5–5.5, F: 4.0–5.0', displayOrder: 1 }],
  'CBC-HGB': [{ fieldName: 'hgb', label: 'Hemoglobin', fieldType: 'number', unit: 'g/dL', normalRange: 'M: 13.5–17.5, F: 12.0–16.0', displayOrder: 1 }],
  'CBC-HCT': [{ fieldName: 'hct', label: 'Hematocrit', fieldType: 'number', unit: '%', normalRange: 'M: 38–50, F: 36–48', displayOrder: 1 }],
  'CBC-MCV': [{ fieldName: 'mcv', label: 'MCV', fieldType: 'number', unit: 'fL', normalRange: '80–100', displayOrder: 1 }],
  'CBC-MCH': [{ fieldName: 'mch', label: 'MCH', fieldType: 'number', unit: 'pg', normalRange: '27–34', displayOrder: 1 }],
  'CBC-MCHC': [{ fieldName: 'mchc', label: 'MCHC', fieldType: 'number', unit: 'g/dL', normalRange: '32–36', displayOrder: 1 }],
  'CBC-PLT': [{ fieldName: 'plt', label: 'Platelet Count', fieldType: 'number', unit: 'x10^3/uL', normalRange: '150–450', displayOrder: 1 }],
  'CBC-NEUT': [{ fieldName: 'neut', label: 'Neutrophils', fieldType: 'number', unit: '%', normalRange: '40–75', displayOrder: 1 }],
  'CBC-LYMPH': [{ fieldName: 'lymph', label: 'Lymphocytes', fieldType: 'number', unit: '%', normalRange: '20–45', displayOrder: 1 }],
  'CBC-MONO': [{ fieldName: 'mono', label: 'Monocytes', fieldType: 'number', unit: '%', normalRange: '2–10', displayOrder: 1 }],
  'CBC-EO': [{ fieldName: 'eo', label: 'Eosinophils', fieldType: 'number', unit: '%', normalRange: '1–6', displayOrder: 1 }],
  'CBC-BASO': [{ fieldName: 'baso', label: 'Basophils', fieldType: 'number', unit: '%', normalRange: '0–2', displayOrder: 1 }],
  'CBC-LYMPHABS': [{ fieldName: 'lymphAbs', label: 'Lymphocyte Absolute', fieldType: 'number', unit: 'x10^3/uL', normalRange: '1.0–4.8', displayOrder: 1 }],
  'CBC-MIDABS': [{ fieldName: 'midAbs', label: 'Mid Cell Absolute', fieldType: 'number', unit: 'x10^3/uL', normalRange: '0.1–0.8', displayOrder: 1 }],
  'CBC-GRANABS': [{ fieldName: 'granAbs', label: 'Granulocyte Absolute', fieldType: 'number', unit: 'x10^3/uL', normalRange: '2.0–7.0', displayOrder: 1 }],
  'CBC-LYMPHPCT': [{ fieldName: 'lymphPct', label: 'Lymphocyte %', fieldType: 'number', unit: '%', normalRange: '20–45', displayOrder: 1 }],
  'CBC-MIDPCT': [{ fieldName: 'midPct', label: 'Mid Cell %', fieldType: 'number', unit: '%', normalRange: '3–10', displayOrder: 1 }],
  'CBC-GRANPCT': [{ fieldName: 'granPct', label: 'Granulocyte %', fieldType: 'number', unit: '%', normalRange: '40–75', displayOrder: 1 }],
  'CBC-RDWCV': [{ fieldName: 'rdwCv', label: 'RDW-CV', fieldType: 'number', unit: '%', normalRange: '11.5–14.5', displayOrder: 1 }],
  'CBC-RDWS': [{ fieldName: 'rdwSd', label: 'RDW-SD', fieldType: 'number', unit: 'fL', normalRange: '39–46', displayOrder: 1 }],
  'CBC-MPV': [{ fieldName: 'mpv', label: 'MPV', fieldType: 'number', unit: 'fL', normalRange: '7.5–11.5', displayOrder: 1 }],
  'CBC-PDW': [{ fieldName: 'pdw', label: 'PDW', fieldType: 'number', unit: 'fL', normalRange: '9.0–17.0', displayOrder: 1 }],
  'CBC-PCT': [{ fieldName: 'pct', label: 'PCT', fieldType: 'number', unit: '%', normalRange: '0.15–0.35', displayOrder: 1 }],

  'COAG-PT': [{ fieldName: 'pt', label: 'PT', fieldType: 'number', unit: 'sec', normalRange: '11–13.5', displayOrder: 1 }],
  'COAG-APTT': [{ fieldName: 'aptt', label: 'aPTT', fieldType: 'number', unit: 'sec', normalRange: '25–35', displayOrder: 1 }],
  'COAG-INR': [{ fieldName: 'inr', label: 'INR', fieldType: 'number', normalRange: '0.8–1.2', displayOrder: 1 }],

  'ESR001': [{ fieldName: 'esr', label: 'ESR', fieldType: 'number', unit: 'mm/hr', normalRange: 'M: 0–15, F: 0–20', displayOrder: 1 }],
  'BGRH001': [
    { fieldName: 'bloodGroup', label: 'Blood Group', fieldType: 'select', options: ['A', 'B', 'AB', 'O'], displayOrder: 1 },
    { fieldName: 'rhFactor', label: 'Rh Factor', fieldType: 'select', options: ['Positive', 'Negative'], displayOrder: 2 },
  ],
  'PICT001': [
    { fieldName: 'species', label: 'Species', fieldType: 'select', options: ['P. falciparum', 'P. vivax', 'P. ovale', 'P. malariae', 'Mixed', 'Negative'], normalRange: 'Negative', displayOrder: 1 },
    { fieldName: 'parasiteDensity', label: 'Parasite Density', fieldType: 'number', unit: 'parasites/uL', displayOrder: 2 },
  ],

  // ========== URINALYSIS ==========
  'UACOLOR': [{ fieldName: 'color', label: 'Color', fieldType: 'select', options: ['Yellow', 'Straw', 'Dark Amber', 'Red', 'Brown', 'Clear'], normalRange: 'Yellow/Straw', displayOrder: 1 }],
  'UAPH': [{ fieldName: 'ph', label: 'pH', fieldType: 'number', normalRange: '4.5–8.0', displayOrder: 1 }],
  'UAAPPEAR': [{ fieldName: 'appearance', label: 'Appearance', fieldType: 'select', options: ['Clear', 'Slightly Cloudy', 'Cloudy', 'Turbid'], normalRange: 'Clear', displayOrder: 1 }],
  'UASG': [{ fieldName: 'sg', label: 'Specific Gravity', fieldType: 'number', unit: '', normalRange: '1.005–1.030', displayOrder: 1 }],
  'UANITRITE': [{ fieldName: 'nitrite', label: 'Nitrite', fieldType: 'select', options: ['Negative', 'Positive'], normalRange: 'Negative', displayOrder: 1 }],
  'UAALB': [{ fieldName: 'albumin', label: 'Albumin (Protein)', fieldType: 'select', options: ['Negative', 'Trace', '1+', '2+', '3+', '4+'], normalRange: 'Negative', displayOrder: 1 }],
  'UAKETON': [{ fieldName: 'ketones', label: 'Ketones', fieldType: 'select', options: ['Negative', 'Trace', '1+', '2+', '3+'], normalRange: 'Negative', displayOrder: 1 }],
  'UABILI': [{ fieldName: 'bilirubin', label: 'Bilirubin', fieldType: 'select', options: ['Negative', '1+', '2+', '3+'], normalRange: 'Negative', displayOrder: 1 }],
  'UAUROBIL': [{ fieldName: 'urobilinogen', label: 'Urobilinogen', fieldType: 'number', unit: 'mg/dL', normalRange: '0.1–1.0', displayOrder: 1 }],
  'UABLOOD': [{ fieldName: 'blood', label: 'Blood', fieldType: 'select', options: ['Negative', 'Trace', '1+', '2+', '3+', '4+'], normalRange: 'Negative', displayOrder: 1 }],
  'UALEUK': [{ fieldName: 'leukocytes', label: 'Leukocyte Esterase', fieldType: 'select', options: ['Negative', 'Trace', '1+', '2+', '3+'], normalRange: 'Negative', displayOrder: 1 }],
  'UASUGAR': [{ fieldName: 'glucose', label: 'Glucose (Sugar)', fieldType: 'select', options: ['Negative', 'Trace', '1+', '2+', '3+', '4+'], normalRange: 'Negative', displayOrder: 1 }],
  'UAWBC': [{ fieldName: 'wbcHpf', label: 'WBC/HPF', fieldType: 'number', unit: '/HPF', normalRange: '0–5', displayOrder: 1 }],
  'UARBC': [{ fieldName: 'rbcHpf', label: 'RBC/HPF', fieldType: 'number', unit: '/HPF', normalRange: '0–3', displayOrder: 1 }],
  'UAEPI': [{ fieldName: 'epithelial', label: 'Epithelial Cells', fieldType: 'number', unit: '/LPF', normalRange: '0–5', displayOrder: 1 }],
  'UACRYST': [{ fieldName: 'crystals', label: 'Crystals', fieldType: 'text', displayOrder: 1 }],
  'UABACT': [{ fieldName: 'bacteria', label: 'Bacteria', fieldType: 'select', options: ['None', 'Few', 'Moderate', 'Many'], normalRange: 'None', displayOrder: 1 }],
  'UACASTS': [{ fieldName: 'casts', label: 'Casts', fieldType: 'text', displayOrder: 1 }],
  'UAPREG': [{ fieldName: 'pregnancy', label: 'Urine Pregnancy', fieldType: 'select', options: ['Positive', 'Negative'], normalRange: 'Negative', displayOrder: 1 }],

  // ========== PARASITOLOGY ==========
  'STCOLOR': [{ fieldName: 'stoolColor', label: 'Stool Color', fieldType: 'select', options: ['Brown', 'Yellow', 'Green', 'Red', 'Black', 'Clay'], normalRange: 'Brown', displayOrder: 1 }],
  'STCONSIST': [{ fieldName: 'consistency', label: 'Consistency', fieldType: 'select', options: ['Formed', 'Soft', 'Watery', 'Mucoid', 'Bloody'], normalRange: 'Formed', displayOrder: 1 }],
  'STDIRECT': [{ fieldName: 'microscopy', label: 'Direct Microscopy', fieldType: 'textarea', displayOrder: 1 }],
  'STOCCULT': [{ fieldName: 'occultBlood', label: 'Occult Blood', fieldType: 'select', options: ['Positive', 'Negative'], normalRange: 'Negative', displayOrder: 1 }],
  'STCONCENT': [{ fieldName: 'concentration', label: 'Concentration Findings', fieldType: 'textarea', displayOrder: 1 }],

  // ========== CHEMISTRY ==========
  'KFT-NA': [{ fieldName: 'sodium', label: 'Sodium', fieldType: 'number', unit: 'mEq/L', normalRange: '136–145', displayOrder: 1 }],
  'KFT-K': [{ fieldName: 'potassium', label: 'Potassium', fieldType: 'number', unit: 'mEq/L', normalRange: '3.5–5.1', displayOrder: 1 }],
  'KFT-CA': [{ fieldName: 'calcium', label: 'Calcium Total', fieldType: 'number', unit: 'mg/dL', normalRange: '8.5–10.5', displayOrder: 1 }],
  'CHEMCAION': [{ fieldName: 'caIonized', label: 'Calcium Ionized', fieldType: 'number', unit: 'mg/dL', normalRange: '4.5–5.6', displayOrder: 1 }],
  'VITAMIN-MG': [{ fieldName: 'magnesium', label: 'Magnesium', fieldType: 'number', unit: 'mg/dL', normalRange: '1.7–2.3', displayOrder: 1 }],
  'BONE-PO4': [{ fieldName: 'phosphorus', label: 'Phosphorus', fieldType: 'number', unit: 'mg/dL', normalRange: '2.5–4.5', displayOrder: 1 }],
  'KFT-CL': [{ fieldName: 'chloride', label: 'Chloride', fieldType: 'number', unit: 'mEq/L', normalRange: '98–107', displayOrder: 1 }],
  'LFT-AST': [{ fieldName: 'ast', label: 'AST (SGOT)', fieldType: 'number', unit: 'U/L', normalRange: '10–40', displayOrder: 1 }],
  'LFT-ALT': [{ fieldName: 'alt', label: 'ALT (SGPT)', fieldType: 'number', unit: 'U/L', normalRange: '7–56', displayOrder: 1 }],
  'LFT-ALP': [{ fieldName: 'alp', label: 'ALP', fieldType: 'number', unit: 'U/L', normalRange: '44–147', displayOrder: 1 }],
  'LFT-ALB': [{ fieldName: 'albumin', label: 'Albumin', fieldType: 'number', unit: 'g/dL', normalRange: '3.5–5.0', displayOrder: 1 }],
  'LFT-TBIL': [{ fieldName: 'tbil', label: 'Total Bilirubin', fieldType: 'number', unit: 'mg/dL', normalRange: '0.3–1.2', displayOrder: 1 }],
  'LFT-DBIL': [{ fieldName: 'dbil', label: 'Direct Bilirubin', fieldType: 'number', unit: 'mg/dL', normalRange: '0.0–0.3', displayOrder: 1 }],
  'LFT-TP': [{ fieldName: 'tp', label: 'Total Protein', fieldType: 'number', unit: 'g/dL', normalRange: '6.0–8.3', displayOrder: 1 }],
  'LIPID-TC': [{ fieldName: 'tc', label: 'Total Cholesterol', fieldType: 'number', unit: 'mg/dL', normalRange: '<200', displayOrder: 1 }],
  'LIPID-HDL': [{ fieldName: 'hdl', label: 'HDL Cholesterol', fieldType: 'number', unit: 'mg/dL', normalRange: '>40', displayOrder: 1 }],
  'LIPID-LDL': [{ fieldName: 'ldl', label: 'LDL Cholesterol', fieldType: 'number', unit: 'mg/dL', normalRange: '<100', displayOrder: 1 }],
  'LIPID-TG': [{ fieldName: 'tg', label: 'Triglycerides', fieldType: 'number', unit: 'mg/dL', normalRange: '<150', displayOrder: 1 }],
  'KFT-BUN': [{ fieldName: 'bun', label: 'BUN (Urea)', fieldType: 'number', unit: 'mg/dL', normalRange: '7–20', displayOrder: 1 }],
  'KFT-CREA': [{ fieldName: 'crea', label: 'Creatinine', fieldType: 'number', unit: 'mg/dL', normalRange: '0.6–1.2', displayOrder: 1 }],
  'AMY001': [{ fieldName: 'amylase', label: 'Amylase', fieldType: 'number', unit: 'U/L', normalRange: '30–110', displayOrder: 1 }],
  'CHEMLIPASE': [{ fieldName: 'lipase', label: 'Lipase', fieldType: 'number', unit: 'U/L', normalRange: '0–160', displayOrder: 1 }],

  // ========== CSF ==========
  'CSFGLUC': [{ fieldName: 'glucose', label: 'CSF Glucose', fieldType: 'number', unit: 'mg/dL', normalRange: '40–70', displayOrder: 1 }],
  'CSFMICRO': [{ fieldName: 'microscopy', label: 'CSF Microscopy', fieldType: 'textarea', displayOrder: 1 }],
  'CSFPRESS': [{ fieldName: 'pressure', label: 'CSF Pressure', fieldType: 'number', unit: 'cm H2O', normalRange: '7–18', displayOrder: 1 }],
  'CSFPROT': [{ fieldName: 'protein', label: 'CSF Protein', fieldType: 'number', unit: 'mg/dL', normalRange: '15–45', displayOrder: 1 }],
  'CSFAPPEAR': [{ fieldName: 'appearance', label: 'CSF Appearance', fieldType: 'select', options: ['Clear', 'Cloudy', 'Turbid', 'Xanthochromic', 'Bloody'], normalRange: 'Clear', displayOrder: 1 }],
  'CSFCULT': [{ fieldName: 'culture', label: 'CSF Culture', fieldType: 'textarea', displayOrder: 1 }],
  'CSFCELL': [{ fieldName: 'cellCount', label: 'CSF Cell Count', fieldType: 'number', unit: 'cells/uL', normalRange: '0–5', displayOrder: 1 }],
  'CSFAFB': [{ fieldName: 'afbStain', label: 'AFB Stain', fieldType: 'select', options: ['Positive', 'Negative'], normalRange: 'Negative', displayOrder: 1 }],
  'CSFCYTO': [{ fieldName: 'cytospin', label: 'Cytospin Findings', fieldType: 'textarea', displayOrder: 1 }],
  'CSFCRAG': [{ fieldName: 'crag', label: 'Cryptococcal Antigen', fieldType: 'select', options: ['Positive', 'Negative'], normalRange: 'Negative', displayOrder: 1 }],
  'CSFCHIK': [{ fieldName: 'chikungunya', label: 'Chikungunya RT-PCR', fieldType: 'select', options: ['Detected', 'Not Detected'], normalRange: 'Not Detected', displayOrder: 1 }],
  'CSFINK': [{ fieldName: 'indiaInk', label: 'India Ink', fieldType: 'select', options: ['Positive', 'Negative'], normalRange: 'Negative', displayOrder: 1 }],
  'CSFCRDET': [{ fieldName: 'cryptoDetection', label: 'Cryptococcus Detection', fieldType: 'select', options: ['Positive', 'Negative'], normalRange: 'Negative', displayOrder: 1 }],
  'CSFDENG': [{ fieldName: 'dengue', label: 'Dengue RT-PCR', fieldType: 'select', options: ['Detected', 'Not Detected'], normalRange: 'Not Detected', displayOrder: 1 }],
  'CSFZIKA': [{ fieldName: 'zika', label: 'Zika RT-PCR', fieldType: 'select', options: ['Detected', 'Not Detected'], normalRange: 'Not Detected', displayOrder: 1 }],

  // ========== HORMONE ==========
  'THYROID-TSH': [{ fieldName: 'tsh', label: 'TSH', fieldType: 'number', unit: 'uIU/mL', normalRange: '0.4–4.0', displayOrder: 1 }],
  'THYROID-FT3': [{ fieldName: 'ft3', label: 'Free T3', fieldType: 'number', unit: 'pg/mL', normalRange: '2.0–4.4', displayOrder: 1 }],
  'THYROID-FT4': [{ fieldName: 'ft4', label: 'Free T4', fieldType: 'number', unit: 'ng/dL', normalRange: '0.8–1.8', displayOrder: 1 }],
  'HORM-T3': [{ fieldName: 't3', label: 'Total T3', fieldType: 'number', unit: 'ng/mL', normalRange: '0.8–2.0', displayOrder: 1 }],
  'HORM-T4': [{ fieldName: 't4', label: 'Total T4', fieldType: 'number', unit: 'ug/dL', normalRange: '4.5–12.0', displayOrder: 1 }],
  'HORM-AMH': [{ fieldName: 'amh', label: 'AMH', fieldType: 'number', unit: 'ng/mL', normalRange: 'Age-dependent: 0.5–10.0', displayOrder: 1 }],
  'HORMONE-FSH': [{ fieldName: 'fsh', label: 'FSH', fieldType: 'number', unit: 'mIU/mL', normalRange: 'M: 1.5–12.4, F: Follicular 3–12, Mid-cycle 10–30, Luteal 2–10', displayOrder: 1 }],
  'HORMONE-LH': [{ fieldName: 'lh', label: 'LH', fieldType: 'number', unit: 'mIU/mL', normalRange: 'M: 1.7–8.6, F: Follicular 2–15, Mid-cycle 20–100, Luteal 1–12', displayOrder: 1 }],
  'HORMONE-PRL': [{ fieldName: 'prl', label: 'Prolactin', fieldType: 'number', unit: 'ng/mL', normalRange: 'M: 2–18, F: 2–29', displayOrder: 1 }],
  'HORMONE-E2': [{ fieldName: 'e2', label: 'Estradiol (E2)', fieldType: 'number', unit: 'pg/mL', normalRange: 'M: 10–40, F: Follicular 20–150, Luteal 30–400', displayOrder: 1 }],
  'HORMONE-PROG': [{ fieldName: 'prog', label: 'Progesterone', fieldType: 'number', unit: 'ng/mL', normalRange: 'Follicular <1, Luteal 3–30', displayOrder: 1 }],
  'CARD-TROPI': [{ fieldName: 'tropi', label: 'Troponin I', fieldType: 'number', unit: 'ng/mL', normalRange: '<0.04', displayOrder: 1 }],
  'CARD-BNP': [{ fieldName: 'bnp', label: 'BNP', fieldType: 'number', unit: 'pg/mL', normalRange: '<100', displayOrder: 1 }],
  'INFLAM-CRP': [{ fieldName: 'crp', label: 'CRP', fieldType: 'number', unit: 'mg/L', normalRange: '<5', displayOrder: 1 }],
  'DIABETES-A1C': [{ fieldName: 'a1c', label: 'HbA1c', fieldType: 'number', unit: '%', normalRange: '<5.7 (normal)', displayOrder: 1 }],
  'IRON-FERR': [{ fieldName: 'ferr', label: 'Ferritin', fieldType: 'number', unit: 'ng/mL', normalRange: 'M: 20–250, F: 10–120', displayOrder: 1 }],
  'TUMOR-CEA': [{ fieldName: 'cea', label: 'CEA', fieldType: 'number', unit: 'ng/mL', normalRange: '<5.0', displayOrder: 1 }],
  'TUMOR-PSA': [{ fieldName: 'psa', label: 'PSA', fieldType: 'number', unit: 'ng/mL', normalRange: '<4.0', displayOrder: 1 }],
  'VITAMIN-D': [{ fieldName: 'vitd', label: 'Vitamin D 25-OH', fieldType: 'number', unit: 'ng/mL', normalRange: '30–100', displayOrder: 1 }],

  // ========== SEROLOGY ==========
  'SERO-ASO': [{ fieldName: 'aso', label: 'ASO Titer', fieldType: 'number', unit: 'IU/mL', normalRange: '<200', displayOrder: 1 }],
  'SERO-RF': [{ fieldName: 'rf', label: 'Rheumatoid Factor', fieldType: 'select', options: ['Positive', 'Negative'], normalRange: 'Negative', displayOrder: 1 }],
  'KFT-UA': [{ fieldName: 'ua', label: 'Uric Acid', fieldType: 'number', unit: 'mg/dL', normalRange: 'M: 3.4–7.0, F: 2.4–6.0', displayOrder: 1 }],
  'DIABETES-FBS': [{ fieldName: 'fbs', label: 'Fasting Blood Sugar', fieldType: 'number', unit: 'mg/dL', normalRange: '70–100', displayOrder: 1 }],
  'RBG001': [{ fieldName: 'rbs', label: 'Random Blood Sugar', fieldType: 'number', unit: 'mg/dL', normalRange: '<140', displayOrder: 1 }],
  'SERO-WIDAL': [
    { fieldName: 'widalO', label: 'O Titer', fieldType: 'text', normalRange: '<=1:80', displayOrder: 1 },
    { fieldName: 'widalH', label: 'H Titer', fieldType: 'text', normalRange: '<=1:160', displayOrder: 2 },
  ],
  'SERO-VDRL': [{ fieldName: 'vdrl', label: 'VDRL/RPR', fieldType: 'select', options: ['Reactive', 'Non-Reactive'], normalRange: 'Non-Reactive', displayOrder: 1 }],
  'SERO-HIV': [{ fieldName: 'hivResult', label: 'HIV Result', fieldType: 'select', options: ['Positive', 'Negative', 'Indeterminate'], normalRange: 'Negative', displayOrder: 1 }],
  'WEIL001': [{ fieldName: 'weilFelix', label: 'Weil Felix OX19', fieldType: 'number', unit: 'titer', normalRange: '<1:80', displayOrder: 1 }],

  // ========== VIROLOGY ==========
  'SERO-HBSAG': [{ fieldName: 'hbsag', label: 'HBsAg', fieldType: 'select', options: ['Positive', 'Negative'], normalRange: 'Negative', displayOrder: 1 }],
  'SERO-HCV': [{ fieldName: 'hcv', label: 'Anti-HCV', fieldType: 'select', options: ['Positive', 'Negative'], normalRange: 'Negative', displayOrder: 1 }],

  // ========== BACTERIOLOGY ==========
  'MICRO-GRAM': [{ fieldName: 'gramResult', label: 'Gram Stain Result', fieldType: 'textarea', displayOrder: 1 }],
  'MICRO-CS': [
    { fieldName: 'cultureResult', label: 'Culture Result', fieldType: 'textarea', normalRange: 'No growth', displayOrder: 1 },
    { fieldName: 'sensitivity', label: 'Sensitivity', fieldType: 'textarea', displayOrder: 2 },
  ],
  'BACTWET': [{ fieldName: 'wetSmear', label: 'Wet Smear Findings', fieldType: 'textarea', displayOrder: 1 }],

  // ========== BODY FLUID SPECIMEN ==========
  'BFSTUD': [{ fieldName: 'studdedCells', label: 'Studded Epithelial Cells', fieldType: 'textarea', displayOrder: 1 }],
  'BFCULT': [{ fieldName: 'bfCulture', label: 'Body Fluid Culture', fieldType: 'textarea', displayOrder: 1 }],
  'BFEPI': [{ fieldName: 'bfEpithelial', label: 'Epithelial Cells (BF)', fieldType: 'textarea', displayOrder: 1 }],

  // ========== FUNGAL ==========
  'FUNGKOH': [{ fieldName: 'kohFindings', label: 'KOH Mount Findings', fieldType: 'textarea', displayOrder: 1 }],
};

// ============================================================
// NEW CBC COMPONENT TESTS (replace CBC001)
// ============================================================
const CBC_SPLIT_TESTS = [
  { code: 'CBC-WBC', name: 'WBC', price: 80 },
  { code: 'CBC-RBC', name: 'RBC', price: 80 },
  { code: 'CBC-HGB', name: 'Hemoglobin', price: 80 },
  { code: 'CBC-HCT', name: 'Hematocrit', price: 80 },
  { code: 'CBC-MCV', name: 'MCV', price: 80 },
  { code: 'CBC-MCH', name: 'MCH', price: 80 },
  { code: 'CBC-MCHC', name: 'MCHC', price: 80 },
  { code: 'CBC-PLT', name: 'Platelet Count', price: 80 },
  { code: 'CBC-NEUT', name: 'Neutrophils', price: 60 },
  { code: 'CBC-LYMPH', name: 'Lymphocytes', price: 60 },
  { code: 'CBC-MONO', name: 'Monocytes', price: 60 },
  { code: 'CBC-EO', name: 'Eosinophils', price: 60 },
  { code: 'CBC-BASO', name: 'Basophils', price: 60 },
  { code: 'CBC-LYMPHABS', name: 'Lymphocyte Absolute', price: 60 },
  { code: 'CBC-MIDABS', name: 'Mid Cell Absolute', price: 60 },
  { code: 'CBC-GRANABS', name: 'Granulocyte Absolute', price: 60 },
  { code: 'CBC-LYMPHPCT', name: 'Lymphocyte %', price: 60 },
  { code: 'CBC-MIDPCT', name: 'Mid Cell %', price: 60 },
  { code: 'CBC-GRANPCT', name: 'Granulocyte %', price: 60 },
  { code: 'CBC-RDWCV', name: 'RDW-CV', price: 60 },
  { code: 'CBC-RDWS', name: 'RDW-SD', price: 60 },
  { code: 'CBC-MPV', name: 'MPV', price: 60 },
  { code: 'CBC-PDW', name: 'PDW', price: 60 },
  { code: 'CBC-PCT', name: 'PCT', price: 60 },
];

async function main() {
  console.log('\n=== LAB RESULT FIELDS + CBC SPLIT SEED ===\n');

  // ============================================================
  // STEP 1: Split CBC001 into individual tests
  // ============================================================
  console.log('--- Splitting CBC001 into individual tests ---');

  const cbc001 = await prisma.labTest.findUnique({ where: { code: 'CBC001' } });
  if (cbc001 && cbc001.isActive) {
    await prisma.labTest.update({ where: { code: 'CBC001' }, data: { isActive: false } });
    log('Deactivated CBC001 (Complete Blood Count - collective)');
  }

  let cbcCreatedCount = 0;
  for (const t of CBC_SPLIT_TESTS) {
    const existing = await prisma.labTest.findUnique({ where: { code: t.code } });
    if (existing) {
      if (!existing.isActive) {
        await prisma.labTest.update({
          where: { code: t.code },
          data: { isActive: true, name: t.name, category: 'Hematology', price: t.price, displayOrder: 0, groupId: null }
        });
        log(`Reactivated: ${t.code} (${t.name})`);
        cbcCreatedCount++;
      }
    } else {
      await prisma.labTest.create({
        data: {
          code: t.code,
          name: t.name,
          category: 'Hematology',
          description: `${t.name} — Hematology`,
          price: t.price,
          unit: 'UNIT',
          isActive: true,
          displayOrder: 0,
        }
      });
      log(`Created: ${t.code} (${t.name})`);
      cbcCreatedCount++;
    }
  }
  console.log(`  CBC components ready: ${cbcCreatedCount}\n`);

  // ============================================================
  // STEP 2: Update CBC panel to include all individual tests
  // ============================================================
  console.log('--- Updating CBC panel ---');
  const cbcPanelCodes = CBC_SPLIT_TESTS.map(t => t.code);

  let cbcGroup = await prisma.labTestGroup.findFirst({ where: { name: 'CBC', category: 'Hematology' } });
  if (!cbcGroup) {
    cbcGroup = await prisma.labTestGroup.create({
      data: { name: 'CBC', category: 'Hematology', color: '#dc2626', displayOrder: 1 }
    });
  }
  // Unlink all old tests from CBC group first
  await prisma.labTest.updateMany({ where: { groupId: cbcGroup.id }, data: { groupId: null } });
  // Link new component tests
  for (const code of cbcPanelCodes) {
    const test = await prisma.labTest.findUnique({ where: { code } });
    if (test) {
      await prisma.labTest.update({ where: { code }, data: { groupId: cbcGroup.id } });
    }
  }
  log(`CBC panel now contains ${cbcPanelCodes.length} tests\n`);

  // ============================================================
  // STEP 3: Upsert result fields for ALL tests
  // ============================================================
  console.log('--- Upserting result fields ---');
  let fieldsCreated = 0;
  let fieldsUpdated = 0;

  for (const [code, fields] of Object.entries(RESULT_FIELDS)) {
    const test = await prisma.labTest.findUnique({ where: { code } });
    if (!test) {
      log(`⚠️  Test not found: ${code} — skipping fields`);
      continue;
    }

    for (const field of fields) {
      const existing = await prisma.labTestResultField.findFirst({
        where: { testId: test.id, fieldName: field.fieldName }
      });
      if (existing) {
        await prisma.labTestResultField.update({
          where: { id: existing.id },
          data: { ...field, testId: test.id }
        });
        fieldsUpdated++;
      } else {
        await prisma.labTestResultField.create({
          data: { ...field, testId: test.id }
        });
        fieldsCreated++;
      }
    }
  }
  console.log(`  Result fields: ${fieldsCreated} created, ${fieldsUpdated} updated\n`);

  // ============================================================
  // STEP 4: Remove orphaned result fields (for deactivated tests)
  // ============================================================
  console.log('--- Cleaning orphaned result fields ---');
  const orphanedFields = await prisma.labTestResultField.findMany({
    where: { test: { isActive: false } }
  });
  if (orphanedFields.length > 0) {
    await prisma.labTestResultField.deleteMany({
      where: { id: { in: orphanedFields.map(f => f.id) } }
    });
    log(`Removed ${orphanedFields.length} orphaned result fields`);
  } else {
    log('No orphaned fields found');
  }

  // ============================================================
  // STEP 5: Ensure Additional Notes field exists on every test
  // ============================================================
  console.log('\n--- Ensuring Additional Notes field on all active tests ---');
  const allActiveTests = await prisma.labTest.findMany({ where: { isActive: true } });
  let notesAdded = 0;
  for (const test of allActiveTests) {
    const hasNotes = await prisma.labTestResultField.findFirst({
      where: { testId: test.id, fieldName: 'additionalNotes' }
    });
    if (!hasNotes) {
      await prisma.labTestResultField.create({
        data: {
          testId: test.id,
          fieldName: 'additionalNotes',
          label: 'Additional Notes',
          fieldType: 'textarea',
          displayOrder: 999,
          isAdditional: true,
        }
      });
      notesAdded++;
    }
  }
  console.log(`  Added Additional Notes to ${notesAdded} tests\n`);

  // ============================================================
  // STEP 6: VERIFY
  // ============================================================
  console.log('\n=== VERIFICATION ===\n');
  const byCategory = {};
  const allTests = await prisma.labTest.findMany({
    where: { isActive: true },
    include: { group: true, resultFields: { orderBy: { displayOrder: 'asc' } } },
    orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }]
  });
  for (const t of allTests) {
    if (!byCategory[t.category]) byCategory[t.category] = [];
    byCategory[t.category].push(t);
  }

  const categoryOrder = ['Hematology', 'Urinalysis', 'Virology', 'Serology', 'Parasitology', 'Chemistry', 'CSF', 'Hormone', 'Bacteriology', 'Body fluid specimen', 'Fungal'];
  let total = 0;
  for (const cat of categoryOrder) {
    const tests = byCategory[cat] || [];
    total += tests.length;
    console.log(`${cat} (${tests.length} tests):`);
    const groups = {};
    for (const t of tests) {
      const fieldCount = t.resultFields.length;
      if (t.group) {
        if (!groups[t.group.name]) groups[t.group.name] = { codes: [], hasFields: true };
        groups[t.group.name].codes.push(`${t.code} (${fieldCount}f)`);
      } else {
        const fieldStr = fieldCount > 0 ? `(${fieldCount}f)` : '⚠️ NO FIELDS';
        console.log(`  • ${t.code} — ${t.name} ${fieldStr}`);
      }
    }
    for (const [gname, gdata] of Object.entries(groups)) {
      console.log(`  ▸ ${gname}: ${gdata.codes.join(', ')}`);
    }
  }
  console.log(`\nTotal active tests: ${total}`);
  const totalFields = await prisma.labTestResultField.count({
    where: { test: { isActive: true } }
  });
  console.log(`Total result fields on active tests: ${totalFields}`);

  // Check for any tests still missing result fields
  console.log('\n--- Tests missing result fields ---');
  let missingAny = 0;
  for (const t of allTests) {
    if (t.resultFields.length === 0) {
      console.log(`  ⚠️  ${t.code} — ${t.name} (${t.category})`);
      missingAny++;
    }
  }
  if (missingAny === 0) console.log('  ✅ All tests have result fields!');
  else console.log(`  ⚠️  ${missingAny} tests have no result fields`);

  console.log('\n=== DONE ===\n');
}

main()
  .catch(e => { console.error('SEED ERROR:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
