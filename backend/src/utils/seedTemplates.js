const prisma = require('../config/database');
const RADIOLOGY_TEMPLATE_DATA = require('../../radiology_template_data');

const LAB_GROUPS = [
  { name: 'Complete Blood Count (CBC)', category: 'Hematology', displayOrder: 1 },
  { name: 'Liver Function Tests (LFT)', category: 'Blood Chemistry', displayOrder: 2 },
  { name: 'Kidney Function Tests (KFT)', category: 'Blood Chemistry', displayOrder: 3 },
  { name: 'Lipid Profile', category: 'Blood Chemistry', displayOrder: 4 },
  { name: 'Thyroid Function Tests', category: 'Blood Chemistry', displayOrder: 5 },
  { name: 'Serology', category: 'Serology', displayOrder: 6 },
  { name: 'Microbiology', category: 'Microbiology', displayOrder: 7 },
  { name: 'Dipstick', category: 'Urinalysis', displayOrder: 24 },
  { name: 'Urine microscopy', category: 'Urinalysis', displayOrder: 25 },
  { name: 'Coagulation Studies', category: 'Hematology', displayOrder: 8 },
  { name: 'Cardiac Markers', category: 'Blood Chemistry', displayOrder: 9 },
  { name: 'Tumor Markers', category: 'Blood Chemistry', displayOrder: 10 },
  { name: 'Hormone Profile', category: 'Blood Chemistry', displayOrder: 11 },
  { name: 'Iron Studies / Anemia Panel', category: 'Blood Chemistry', displayOrder: 12 },
  { name: 'Immunology', category: 'Immunology', displayOrder: 13 },
  { name: 'Inflammatory Markers', category: 'Blood Chemistry', displayOrder: 14 },
  { name: 'Arterial Blood Gas', category: 'Blood Chemistry', displayOrder: 15 },
  { name: 'Diabetes Monitoring', category: 'Blood Chemistry', displayOrder: 16 },
  { name: 'Infectious Disease Serology', category: 'Serology', displayOrder: 17 },
  { name: 'Hepatitis Profile', category: 'Serology', displayOrder: 18 },
  { name: 'Allergy Testing', category: 'Immunology', displayOrder: 19 },
  { name: 'Therapeutic Drug Monitoring', category: 'Blood Chemistry', displayOrder: 20 },
  { name: 'Vitamins & Nutrition', category: 'Blood Chemistry', displayOrder: 21 },
  { name: 'Bone & Joint Markers', category: 'Blood Chemistry', displayOrder: 22 }
];

const LAB_TESTS = [
  // CBC
  { name: 'White Blood Cell Count', code: 'CBC-WBC', category: 'Hematology', price: 0, groupName: 'Complete Blood Count (CBC)', displayOrder: 1, fields: [{ fieldName: 'wbc', label: 'WBC', fieldType: 'NUMERIC', unit: '10^3/uL', normalRange: '4.0-11.0' }] },
  { name: 'Red Blood Cell Count', code: 'CBC-RBC', category: 'Hematology', price: 0, groupName: 'Complete Blood Count (CBC)', displayOrder: 2, fields: [{ fieldName: 'rbc', label: 'RBC', fieldType: 'NUMERIC', unit: '10^6/uL', normalRange: 'M: 4.5-5.5, F: 4.0-5.0' }] },
  { name: 'Hemoglobin', code: 'CBC-HGB', category: 'Hematology', price: 0, groupName: 'Complete Blood Count (CBC)', displayOrder: 3, fields: [{ fieldName: 'hgb', label: 'Hemoglobin', fieldType: 'NUMERIC', unit: 'g/dL', normalRange: 'M: 13.5-17.5, F: 12.0-16.0' }] },
  { name: 'Hematocrit', code: 'CBC-HCT', category: 'Hematology', price: 0, groupName: 'Complete Blood Count (CBC)', displayOrder: 4, fields: [{ fieldName: 'hct', label: 'Hematocrit', fieldType: 'NUMERIC', unit: '%', normalRange: 'M: 38-50, F: 36-48' }] },
  { name: 'Mean Corpuscular Volume', code: 'CBC-MCV', category: 'Hematology', price: 0, groupName: 'Complete Blood Count (CBC)', displayOrder: 5, fields: [{ fieldName: 'mcv', label: 'MCV', fieldType: 'NUMERIC', unit: 'fL', normalRange: '80-100' }] },
  { name: 'Mean Corpuscular Hemoglobin', code: 'CBC-MCH', category: 'Hematology', price: 0, groupName: 'Complete Blood Count (CBC)', displayOrder: 6, fields: [{ fieldName: 'mch', label: 'MCH', fieldType: 'NUMERIC', unit: 'pg', normalRange: '27-34' }] },
  { name: 'Mean Corpuscular Hemoglobin Concentration', code: 'CBC-MCHC', category: 'Hematology', price: 0, groupName: 'Complete Blood Count (CBC)', displayOrder: 7, fields: [{ fieldName: 'mchc', label: 'MCHC', fieldType: 'NUMERIC', unit: 'g/dL', normalRange: '32-36' }] },
  { name: 'Platelet Count', code: 'CBC-PLT', category: 'Hematology', price: 0, groupName: 'Complete Blood Count (CBC)', displayOrder: 8, fields: [{ fieldName: 'plt', label: 'Platelet Count', fieldType: 'NUMERIC', unit: '10^3/uL', normalRange: '150-450' }] },
  { name: 'Neutrophils', code: 'CBC-NEUT', category: 'Hematology', price: 0, groupName: 'Complete Blood Count (CBC)', displayOrder: 9, fields: [{ fieldName: 'neut', label: 'Neutrophils', fieldType: 'NUMERIC', unit: '%', normalRange: '40-75' }] },
  { name: 'Lymphocytes', code: 'CBC-LYMPH', category: 'Hematology', price: 0, groupName: 'Complete Blood Count (CBC)', displayOrder: 10, fields: [{ fieldName: 'lymph', label: 'Lymphocytes', fieldType: 'NUMERIC', unit: '%', normalRange: '20-45' }] },
  { name: 'Monocytes', code: 'CBC-MONO', category: 'Hematology', price: 0, groupName: 'Complete Blood Count (CBC)', displayOrder: 11, fields: [{ fieldName: 'mono', label: 'Monocytes', fieldType: 'NUMERIC', unit: '%', normalRange: '2-10' }] },
  { name: 'Eosinophils', code: 'CBC-EO', category: 'Hematology', price: 0, groupName: 'Complete Blood Count (CBC)', displayOrder: 12, fields: [{ fieldName: 'eo', label: 'Eosinophils', fieldType: 'NUMERIC', unit: '%', normalRange: '1-6' }] },
  { name: 'Basophils', code: 'CBC-BASO', category: 'Hematology', price: 0, groupName: 'Complete Blood Count (CBC)', displayOrder: 13, fields: [{ fieldName: 'baso', label: 'Basophils', fieldType: 'NUMERIC', unit: '%', normalRange: '0-2' }] },
  // LFT
  { name: 'Total Bilirubin', code: 'LFT-TBIL', category: 'Blood Chemistry', price: 0, groupName: 'Liver Function Tests (LFT)', displayOrder: 1, fields: [{ fieldName: 'tbil', label: 'Total Bilirubin', fieldType: 'NUMERIC', unit: 'mg/dL', normalRange: '0.3-1.2' }] },
  { name: 'Direct Bilirubin', code: 'LFT-DBIL', category: 'Blood Chemistry', price: 0, groupName: 'Liver Function Tests (LFT)', displayOrder: 2, fields: [{ fieldName: 'dbil', label: 'Direct Bilirubin', fieldType: 'NUMERIC', unit: 'mg/dL', normalRange: '0.0-0.3' }] },
  { name: 'AST (SGOT)', code: 'LFT-AST', category: 'Blood Chemistry', price: 0, groupName: 'Liver Function Tests (LFT)', displayOrder: 3, fields: [{ fieldName: 'ast', label: 'AST (SGOT)', fieldType: 'NUMERIC', unit: 'U/L', normalRange: '10-40' }] },
  { name: 'ALT (SGPT)', code: 'LFT-ALT', category: 'Blood Chemistry', price: 0, groupName: 'Liver Function Tests (LFT)', displayOrder: 4, fields: [{ fieldName: 'alt', label: 'ALT (SGPT)', fieldType: 'NUMERIC', unit: 'U/L', normalRange: '7-56' }] },
  { name: 'Alkaline Phosphatase', code: 'LFT-ALP', category: 'Blood Chemistry', price: 0, groupName: 'Liver Function Tests (LFT)', displayOrder: 5, fields: [{ fieldName: 'alp', label: 'Alkaline Phosphatase', fieldType: 'NUMERIC', unit: 'U/L', normalRange: '44-147' }] },
  { name: 'Total Protein', code: 'LFT-TP', category: 'Blood Chemistry', price: 0, groupName: 'Liver Function Tests (LFT)', displayOrder: 6, fields: [{ fieldName: 'tp', label: 'Total Protein', fieldType: 'NUMERIC', unit: 'g/dL', normalRange: '6.0-8.3' }] },
  { name: 'Albumin', code: 'LFT-ALB', category: 'Blood Chemistry', price: 0, groupName: 'Liver Function Tests (LFT)', displayOrder: 7, fields: [{ fieldName: 'alb', label: 'Albumin', fieldType: 'NUMERIC', unit: 'g/dL', normalRange: '3.5-5.0' }] },
  // KFT
  { name: 'Blood Urea Nitrogen', code: 'KFT-BUN', category: 'Blood Chemistry', price: 0, groupName: 'Kidney Function Tests (KFT)', displayOrder: 1, fields: [{ fieldName: 'bun', label: 'BUN', fieldType: 'NUMERIC', unit: 'mg/dL', normalRange: '7-20' }] },
  { name: 'Creatinine', code: 'KFT-CREA', category: 'Blood Chemistry', price: 0, groupName: 'Kidney Function Tests (KFT)', displayOrder: 2, fields: [{ fieldName: 'crea', label: 'Creatinine', fieldType: 'NUMERIC', unit: 'mg/dL', normalRange: '0.6-1.2' }] },
  { name: 'Uric Acid', code: 'KFT-UA', category: 'Blood Chemistry', price: 0, groupName: 'Kidney Function Tests (KFT)', displayOrder: 3, fields: [{ fieldName: 'ua', label: 'Uric Acid', fieldType: 'NUMERIC', unit: 'mg/dL', normalRange: 'M: 3.4-7.0, F: 2.4-6.0' }] },
  { name: 'Sodium', code: 'KFT-NA', category: 'Blood Chemistry', price: 0, groupName: 'Kidney Function Tests (KFT)', displayOrder: 4, fields: [{ fieldName: 'na', label: 'Sodium', fieldType: 'NUMERIC', unit: 'mEq/L', normalRange: '136-145' }] },
  { name: 'Potassium', code: 'KFT-K', category: 'Blood Chemistry', price: 0, groupName: 'Kidney Function Tests (KFT)', displayOrder: 5, fields: [{ fieldName: 'k', label: 'Potassium', fieldType: 'NUMERIC', unit: 'mEq/L', normalRange: '3.5-5.1' }] },
  { name: 'Chloride', code: 'KFT-CL', category: 'Blood Chemistry', price: 0, groupName: 'Kidney Function Tests (KFT)', displayOrder: 6, fields: [{ fieldName: 'cl', label: 'Chloride', fieldType: 'NUMERIC', unit: 'mEq/L', normalRange: '98-107' }] },
  { name: 'Calcium', code: 'KFT-CA', category: 'Blood Chemistry', price: 0, groupName: 'Kidney Function Tests (KFT)', displayOrder: 7, fields: [{ fieldName: 'ca', label: 'Calcium', fieldType: 'NUMERIC', unit: 'mg/dL', normalRange: '8.5-10.5' }] },
  // Lipid Profile
  { name: 'Total Cholesterol', code: 'LIPID-TC', category: 'Blood Chemistry', price: 0, groupName: 'Lipid Profile', displayOrder: 1, fields: [{ fieldName: 'tc', label: 'Total Cholesterol', fieldType: 'NUMERIC', unit: 'mg/dL', normalRange: '<200' }] },
  { name: 'HDL Cholesterol', code: 'LIPID-HDL', category: 'Blood Chemistry', price: 0, groupName: 'Lipid Profile', displayOrder: 2, fields: [{ fieldName: 'hdl', label: 'HDL Cholesterol', fieldType: 'NUMERIC', unit: 'mg/dL', normalRange: '>40' }] },
  { name: 'LDL Cholesterol', code: 'LIPID-LDL', category: 'Blood Chemistry', price: 0, groupName: 'Lipid Profile', displayOrder: 3, fields: [{ fieldName: 'ldl', label: 'LDL Cholesterol', fieldType: 'NUMERIC', unit: 'mg/dL', normalRange: '<100' }] },
  { name: 'Triglycerides', code: 'LIPID-TG', category: 'Blood Chemistry', price: 0, groupName: 'Lipid Profile', displayOrder: 4, fields: [{ fieldName: 'tg', label: 'Triglycerides', fieldType: 'NUMERIC', unit: 'mg/dL', normalRange: '<150' }] },
  // Thyroid
  { name: 'TSH', code: 'THYROID-TSH', category: 'Blood Chemistry', price: 0, groupName: 'Thyroid Function Tests', displayOrder: 1, fields: [{ fieldName: 'tsh', label: 'TSH', fieldType: 'NUMERIC', unit: 'uIU/mL', normalRange: '0.4-4.0' }] },
  { name: 'Free T3', code: 'THYROID-FT3', category: 'Blood Chemistry', price: 0, groupName: 'Thyroid Function Tests', displayOrder: 2, fields: [{ fieldName: 'ft3', label: 'Free T3', fieldType: 'NUMERIC', unit: 'pg/mL', normalRange: '2.0-4.4' }] },
  { name: 'Free T4', code: 'THYROID-FT4', category: 'Blood Chemistry', price: 0, groupName: 'Thyroid Function Tests', displayOrder: 3, fields: [{ fieldName: 'ft4', label: 'Free T4', fieldType: 'NUMERIC', unit: 'ng/dL', normalRange: '0.8-1.8' }] },
  // Serology
  { name: 'HBsAg', code: 'SERO-HBSAG', category: 'Serology', price: 0, groupName: 'Serology', displayOrder: 1, fields: [{ fieldName: 'hbsag', label: 'HBsAg', fieldType: 'OPTIONS', options: 'Positive,Negative', normalRange: 'Negative' }] },
  { name: 'Anti-HCV', code: 'SERO-HCV', category: 'Serology', price: 0, groupName: 'Serology', displayOrder: 2, fields: [{ fieldName: 'hcv', label: 'Anti-HCV', fieldType: 'OPTIONS', options: 'Positive,Negative', normalRange: 'Negative' }] },
  { name: 'VDRL/RPR', code: 'SERO-VDRL', category: 'Serology', price: 0, groupName: 'Serology', displayOrder: 3, fields: [{ fieldName: 'vdrl', label: 'VDRL/RPR', fieldType: 'OPTIONS', options: 'Reactive,Non-Reactive', normalRange: 'Non-Reactive' }] },
  { name: 'HIV 1&2', code: 'SERO-HIV', category: 'Serology', price: 0, groupName: 'Serology', displayOrder: 4, fields: [{ fieldName: 'hiv_result', label: 'HIV Result', fieldType: 'OPTIONS', options: 'Positive,Negative,Indeterminate', normalRange: 'Negative' }] },
  { name: 'Widal Test', code: 'SERO-WIDAL', category: 'Serology', price: 0, groupName: 'Serology', displayOrder: 5, fields: [
    { fieldName: 'widal_o', label: 'O Titer', fieldType: 'TEXT', normalRange: '<=1:80' },
    { fieldName: 'widal_h', label: 'H Titer', fieldType: 'TEXT', normalRange: '<=1:160' }
  ]},
  { name: 'Rheumatoid Factor', code: 'SERO-RF', category: 'Immunology', price: 0, groupName: 'Immunology', displayOrder: 1, fields: [{ fieldName: 'rf', label: 'RF', fieldType: 'OPTIONS', options: 'Positive,Negative', normalRange: 'Negative' }] },
  { name: 'ASO Titer', code: 'SERO-ASO', category: 'Immunology', price: 0, groupName: 'Immunology', displayOrder: 2, fields: [{ fieldName: 'aso', label: 'ASO Titer', fieldType: 'NUMERIC', unit: 'IU/mL', normalRange: '<200' }] },
  // Microbiology
  { name: 'Blood Film for Malaria', code: 'MICRO-BF', category: 'Microbiology', price: 0, groupName: 'Microbiology', displayOrder: 1, fields: [
    { fieldName: 'species', label: 'Species', fieldType: 'OPTIONS', options: 'P.falciparum,P.vivax,P.ovale,P.malariae,Mixed,Negative', normalRange: 'Negative' },
    { fieldName: 'parasite_density', label: 'Parasite Density', fieldType: 'TEXT', normalRange: '' }
  ]},
  // --- Dipstick (12 tests) ---
  { name: 'Color', code: 'UACOLOR', category: 'Urinalysis', price: 0, groupName: 'Dipstick', displayOrder: 1, fields: [
    { fieldName: 'color', label: 'Color', fieldType: 'OPTIONS', options: 'Yellow,Straw,Dark Amber,Red,Brown,Clear', normalRange: 'Yellow/Straw' }
  ]},
  { name: 'Appearance', code: 'UAAPPEAR', category: 'Urinalysis', price: 0, groupName: 'Dipstick', displayOrder: 2, fields: [
    { fieldName: 'appearance', label: 'Appearance', fieldType: 'OPTIONS', options: 'Clear,Slightly Cloudy,Cloudy,Turbid', normalRange: 'Clear' }
  ]},
  { name: 'pH', code: 'UAPH', category: 'Urinalysis', price: 0, groupName: 'Dipstick', displayOrder: 3, fields: [
    { fieldName: 'ph', label: 'pH', fieldType: 'NUMERIC', unit: '', normalRange: '4.5-8.0' }
  ]},
  { name: 'Sp. Gravity', code: 'UASG', category: 'Urinalysis', price: 0, groupName: 'Dipstick', displayOrder: 4, fields: [
    { fieldName: 'sg', label: 'Specific Gravity', fieldType: 'NUMERIC', unit: '', normalRange: '1.005-1.030' }
  ]},
  { name: 'Sugar', code: 'UASUGAR', category: 'Urinalysis', price: 0, groupName: 'Dipstick', displayOrder: 5, fields: [
    { fieldName: 'sugar', label: 'Glucose (Sugar)', fieldType: 'OPTIONS', options: 'None,Few,Moderate,Many', normalRange: 'None' }
  ]},
  { name: 'Bilirubin', code: 'UABILI', category: 'Urinalysis', price: 0, groupName: 'Dipstick', displayOrder: 6, fields: [
    { fieldName: 'bilirubin', label: 'Bilirubin', fieldType: 'OPTIONS', options: 'None,Few,Moderate,Many', normalRange: 'None' }
  ]},
  { name: 'Keton', code: 'UAKETON', category: 'Urinalysis', price: 0, groupName: 'Dipstick', displayOrder: 7, fields: [
    { fieldName: 'keton', label: 'Ketones', fieldType: 'OPTIONS', options: 'None,Few,Moderate,Many', normalRange: 'None' }
  ]},
  { name: 'Blood', code: 'UABLOOD', category: 'Urinalysis', price: 0, groupName: 'Dipstick', displayOrder: 8, fields: [
    { fieldName: 'blood', label: 'Blood', fieldType: 'OPTIONS', options: 'None,Few,Moderate,Many', normalRange: 'None' }
  ]},
  { name: 'Nitrite', code: 'UANITRITE', category: 'Urinalysis', price: 0, groupName: 'Dipstick', displayOrder: 9, fields: [
    { fieldName: 'nitrite', label: 'Nitrite', fieldType: 'OPTIONS', options: 'None,Few,Moderate,Many', normalRange: 'None' }
  ]},
  { name: 'Urobilinogen', code: 'UAUROBIL', category: 'Urinalysis', price: 0, groupName: 'Dipstick', displayOrder: 10, fields: [
    { fieldName: 'urobilinogen', label: 'Urobilinogen', fieldType: 'OPTIONS', options: 'None,Few,Moderate,Many', normalRange: 'None' }
  ]},
  { name: 'Leukocyte', code: 'UALEUK', category: 'Urinalysis', price: 0, groupName: 'Dipstick', displayOrder: 11, fields: [
    { fieldName: 'leukocyte', label: 'Leukocyte Esterase', fieldType: 'OPTIONS', options: 'None,Few,Moderate,Many', normalRange: 'None' }
  ]},
  { name: 'Albumin', code: 'UAALB', category: 'Urinalysis', price: 0, groupName: 'Dipstick', displayOrder: 12, fields: [
    { fieldName: 'albumin', label: 'Albumin (Protein)', fieldType: 'OPTIONS', options: 'None,Few,Moderate,Many', normalRange: 'None' }
  ]},
  // --- Urine microscopy (6 tests) ---
  { name: 'Bacteria', code: 'UABACT', category: 'Urinalysis', price: 0, groupName: 'Urine microscopy', displayOrder: 1, fields: [
    { fieldName: 'bacteria', label: 'Bacteria', fieldType: 'OPTIONS', options: 'None,Few,Moderate,Many', normalRange: 'None' }
  ]},
  { name: 'Casts in urine', code: 'UACASTS', category: 'Urinalysis', price: 0, groupName: 'Urine microscopy', displayOrder: 2, fields: [
    { fieldName: 'casts', label: 'Casts', fieldType: 'OPTIONS', options: 'None,Few,Moderate,Many', normalRange: 'None' }
  ]},
  { name: 'Crystals/LPF', code: 'UACRYST', category: 'Urinalysis', price: 0, groupName: 'Urine microscopy', displayOrder: 3, fields: [
    { fieldName: 'crystals', label: 'Crystals', fieldType: 'OPTIONS', options: 'None,Few,Moderate,Many', normalRange: 'None' }
  ]},
  { name: 'Epithelial cells/LPF', code: 'UAEPI', category: 'Urinalysis', price: 0, groupName: 'Urine microscopy', displayOrder: 4, fields: [
    { fieldName: 'epi', label: 'Epithelial Cells', fieldType: 'OPTIONS', options: 'None,Few,Moderate,Many', normalRange: 'None' }
  ]},
  { name: 'RBC/HPF', code: 'UARBC', category: 'Urinalysis', price: 0, groupName: 'Urine microscopy', displayOrder: 5, fields: [
    { fieldName: 'rbc_hpf', label: 'RBC/HPF', fieldType: 'OPTIONS', options: 'None,Few,Moderate,Many', normalRange: 'None' }
  ]},
  { name: 'WBC/HPF', code: 'UAWBC', category: 'Urinalysis', price: 0, groupName: 'Urine microscopy', displayOrder: 6, fields: [
    { fieldName: 'wbc_hpf', label: 'WBC/HPF', fieldType: 'OPTIONS', options: 'None,Few,Moderate,Many', normalRange: 'None' }
  ]},
  // --- Standalone ---
  { name: 'Urine pregnancy test', code: 'UAPREG', category: 'Urinalysis', price: 50, groupName: null, displayOrder: 99, fields: [
    { fieldName: 'preg', label: 'Urine Pregnancy', fieldType: 'OPTIONS', options: 'Positive,Negative', normalRange: 'Negative' }
  ]},
  { name: 'Stool Microscopy', code: 'MICRO-STOOL', category: 'Microbiology', price: 0, groupName: 'Microbiology', displayOrder: 3, fields: [
    { fieldName: 'stool_consistency', label: 'Consistency', fieldType: 'OPTIONS', options: 'Formed,Soft,Watery,Mucoid,Bloody', normalRange: 'Formed' },
    { fieldName: 'stool_ova', label: 'Ova/Parasites', fieldType: 'OPTIONS', options: 'None seen,E.histolytica,G.lamblia,Ascaris,Taenia,H.nana,Others', normalRange: 'None seen' },
    { fieldName: 'stool_rbc', label: 'RBC', fieldType: 'OPTIONS', options: 'None,Few,Moderate,Many', normalRange: 'None' },
    { fieldName: 'stool_wbc', label: 'WBC', fieldType: 'OPTIONS', options: 'None,Few,Moderate,Many', normalRange: 'None' }
  ]},
  { name: 'Gram Stain', code: 'MICRO-GRAM', category: 'Microbiology', price: 0, groupName: 'Microbiology', displayOrder: 4, fields: [{ fieldName: 'gram_result', label: 'Gram Stain Result', fieldType: 'TEXT', normalRange: '' }] },
  { name: 'Culture & Sensitivity', code: 'MICRO-CS', category: 'Microbiology', price: 0, groupName: 'Microbiology', displayOrder: 5, fields: [
    { fieldName: 'culture_result', label: 'Culture Result', fieldType: 'TEXT', normalRange: 'No growth' },
    { fieldName: 'sensitivity', label: 'Sensitivity', fieldType: 'TEXT', normalRange: '' }
  ]},
  // Coagulation Studies
  { name: 'Prothrombin Time', code: 'COAG-PT', category: 'Hematology', price: 0, groupName: 'Coagulation Studies', displayOrder: 1, fields: [{ fieldName: 'pt', label: 'PT', fieldType: 'NUMERIC', unit: 'sec', normalRange: '11-13.5' }] },
  { name: 'INR', code: 'COAG-INR', category: 'Hematology', price: 0, groupName: 'Coagulation Studies', displayOrder: 2, fields: [{ fieldName: 'inr', label: 'INR', fieldType: 'NUMERIC', unit: '', normalRange: '0.8-1.2' }] },
  { name: 'Activated Partial Thromboplastin Time', code: 'COAG-APTT', category: 'Hematology', price: 0, groupName: 'Coagulation Studies', displayOrder: 3, fields: [{ fieldName: 'aptt', label: 'aPTT', fieldType: 'NUMERIC', unit: 'sec', normalRange: '25-35' }] },
  { name: 'D-Dimer', code: 'COAG-DDIMER', category: 'Hematology', price: 0, groupName: 'Coagulation Studies', displayOrder: 4, fields: [{ fieldName: 'ddimer', label: 'D-Dimer', fieldType: 'NUMERIC', unit: 'mg/L', normalRange: '<0.5' }] },
  { name: 'Fibrinogen', code: 'COAG-FIB', category: 'Hematology', price: 0, groupName: 'Coagulation Studies', displayOrder: 5, fields: [{ fieldName: 'fibrinogen', label: 'Fibrinogen', fieldType: 'NUMERIC', unit: 'g/L', normalRange: '2.0-4.0' }] },
  { name: 'Bleeding Time', code: 'COAG-BT', category: 'Hematology', price: 0, groupName: 'Coagulation Studies', displayOrder: 6, fields: [{ fieldName: 'bt', label: 'Bleeding Time', fieldType: 'NUMERIC', unit: 'min', normalRange: '2-7' }] },
  // Cardiac Markers
  { name: 'Troponin I', code: 'CARD-TROPI', category: 'Blood Chemistry', price: 0, groupName: 'Cardiac Markers', displayOrder: 1, fields: [{ fieldName: 'tropi', label: 'Troponin I', fieldType: 'NUMERIC', unit: 'ng/mL', normalRange: '<0.04' }] },
  { name: 'Troponin T', code: 'CARD-TROPT', category: 'Blood Chemistry', price: 0, groupName: 'Cardiac Markers', displayOrder: 2, fields: [{ fieldName: 'tropT', label: 'Troponin T', fieldType: 'NUMERIC', unit: 'ng/mL', normalRange: '<0.01' }] },
  { name: 'CK-MB', code: 'CARD-CKMB', category: 'Blood Chemistry', price: 0, groupName: 'Cardiac Markers', displayOrder: 3, fields: [{ fieldName: 'ckmb', label: 'CK-MB', fieldType: 'NUMERIC', unit: 'ng/mL', normalRange: '<5.0' }] },
  { name: 'BNP', code: 'CARD-BNP', category: 'Blood Chemistry', price: 0, groupName: 'Cardiac Markers', displayOrder: 4, fields: [{ fieldName: 'bnp', label: 'BNP', fieldType: 'NUMERIC', unit: 'pg/mL', normalRange: '<100' }] },
  { name: 'NT-proBNP', code: 'CARD-NTBNP', category: 'Blood Chemistry', price: 0, groupName: 'Cardiac Markers', displayOrder: 5, fields: [{ fieldName: 'ntbnp', label: 'NT-proBNP', fieldType: 'NUMERIC', unit: 'pg/mL', normalRange: '<125' }] },
  { name: 'Homocysteine', code: 'CARD-HCY', category: 'Blood Chemistry', price: 0, groupName: 'Cardiac Markers', displayOrder: 6, fields: [{ fieldName: 'hcy', label: 'Homocysteine', fieldType: 'NUMERIC', unit: 'umol/L', normalRange: '5-15' }] },
  // Tumor Markers
  { name: 'AFP (Alpha-Fetoprotein)', code: 'TUMOR-AFP', category: 'Blood Chemistry', price: 0, groupName: 'Tumor Markers', displayOrder: 1, fields: [{ fieldName: 'afp', label: 'AFP', fieldType: 'NUMERIC', unit: 'ng/mL', normalRange: '<10' }] },
  { name: 'CEA (Carcinoembryonic Antigen)', code: 'TUMOR-CEA', category: 'Blood Chemistry', price: 0, groupName: 'Tumor Markers', displayOrder: 2, fields: [{ fieldName: 'cea', label: 'CEA', fieldType: 'NUMERIC', unit: 'ng/mL', normalRange: '<5.0' }] },
  { name: 'CA 125', code: 'TUMOR-CA125', category: 'Blood Chemistry', price: 0, groupName: 'Tumor Markers', displayOrder: 3, fields: [{ fieldName: 'ca125', label: 'CA 125', fieldType: 'NUMERIC', unit: 'U/mL', normalRange: '<35' }] },
  { name: 'CA 15-3', code: 'TUMOR-CA153', category: 'Blood Chemistry', price: 0, groupName: 'Tumor Markers', displayOrder: 4, fields: [{ fieldName: 'ca153', label: 'CA 15-3', fieldType: 'NUMERIC', unit: 'U/mL', normalRange: '<31' }] },
  { name: 'CA 19-9', code: 'TUMOR-CA199', category: 'Blood Chemistry', price: 0, groupName: 'Tumor Markers', displayOrder: 5, fields: [{ fieldName: 'ca199', label: 'CA 19-9', fieldType: 'NUMERIC', unit: 'U/mL', normalRange: '<37' }] },
  { name: 'Beta-hCG (Quantitative)', code: 'TUMOR-BHCG', category: 'Blood Chemistry', price: 0, groupName: 'Tumor Markers', displayOrder: 6, fields: [{ fieldName: 'bhcg', label: 'Beta-hCG', fieldType: 'NUMERIC', unit: 'mIU/mL', normalRange: '<5 (non-pregnant)' }] },
  { name: 'PSA Total', code: 'TUMOR-PSA', category: 'Blood Chemistry', price: 0, groupName: 'Tumor Markers', displayOrder: 7, fields: [{ fieldName: 'psa', label: 'PSA', fieldType: 'NUMERIC', unit: 'ng/mL', normalRange: '<4.0' }] },
  { name: 'PSA Free', code: 'TUMOR-PSAF', category: 'Blood Chemistry', price: 0, groupName: 'Tumor Markers', displayOrder: 8, fields: [{ fieldName: 'psaf', label: 'PSA Free', fieldType: 'NUMERIC', unit: 'ng/mL', normalRange: '' }] },
  // Hormone Profile
  { name: 'FSH', code: 'HORMONE-FSH', category: 'Blood Chemistry', price: 0, groupName: 'Hormone Profile', displayOrder: 1, fields: [{ fieldName: 'fsh', label: 'FSH', fieldType: 'NUMERIC', unit: 'mIU/mL', normalRange: 'M: 1.5-12.4, F: follicular 3-12, mid-cycle 10-30, luteal 2-10' }] },
  { name: 'LH', code: 'HORMONE-LH', category: 'Blood Chemistry', price: 0, groupName: 'Hormone Profile', displayOrder: 2, fields: [{ fieldName: 'lh', label: 'LH', fieldType: 'NUMERIC', unit: 'mIU/mL', normalRange: 'M: 1.7-8.6, F: follicular 2-15, mid-cycle 20-100, luteal 1-12' }] },
  { name: 'Prolactin', code: 'HORMONE-PRL', category: 'Blood Chemistry', price: 0, groupName: 'Hormone Profile', displayOrder: 3, fields: [{ fieldName: 'prl', label: 'Prolactin', fieldType: 'NUMERIC', unit: 'ng/mL', normalRange: 'M: 2-18, F: 2-29' }] },
  { name: 'Estradiol (E2)', code: 'HORMONE-E2', category: 'Blood Chemistry', price: 0, groupName: 'Hormone Profile', displayOrder: 4, fields: [{ fieldName: 'e2', label: 'Estradiol', fieldType: 'NUMERIC', unit: 'pg/mL', normalRange: 'M: 10-40, F: follicular 20-150, luteal 30-400' }] },
  { name: 'Progesterone', code: 'HORMONE-PROG', category: 'Blood Chemistry', price: 0, groupName: 'Hormone Profile', displayOrder: 5, fields: [{ fieldName: 'prog', label: 'Progesterone', fieldType: 'NUMERIC', unit: 'ng/mL', normalRange: 'Follicular <1, Luteal 3-30' }] },
  { name: 'Testosterone Total', code: 'HORMONE-TESTO', category: 'Blood Chemistry', price: 0, groupName: 'Hormone Profile', displayOrder: 6, fields: [{ fieldName: 'testo', label: 'Testosterone', fieldType: 'NUMERIC', unit: 'ng/dL', normalRange: 'M: 300-1000, F: 15-70' }] },
  { name: 'Cortisol (AM)', code: 'HORMONE-CORT', category: 'Blood Chemistry', price: 0, groupName: 'Hormone Profile', displayOrder: 7, fields: [{ fieldName: 'cort', label: 'Cortisol', fieldType: 'NUMERIC', unit: 'ug/dL', normalRange: '6-23 (AM)' }] },
  { name: 'Parathyroid Hormone (PTH)', code: 'HORMONE-PTH', category: 'Blood Chemistry', price: 0, groupName: 'Hormone Profile', displayOrder: 8, fields: [{ fieldName: 'pth', label: 'PTH', fieldType: 'NUMERIC', unit: 'pg/mL', normalRange: '10-65' }] },
  { name: 'DHEA-S', code: 'HORMONE-DHEA', category: 'Blood Chemistry', price: 0, groupName: 'Hormone Profile', displayOrder: 9, fields: [{ fieldName: 'dheas', label: 'DHEA-S', fieldType: 'NUMERIC', unit: 'ug/dL', normalRange: 'M: 100-450, F: 45-350 (age-dependent)' }] },
  { name: 'IGF-1', code: 'HORMONE-IGF1', category: 'Blood Chemistry', price: 0, groupName: 'Hormone Profile', displayOrder: 10, fields: [{ fieldName: 'igf1', label: 'IGF-1', fieldType: 'NUMERIC', unit: 'ng/mL', normalRange: 'Age-dependent' }] },
  // Iron Studies / Anemia Panel
  { name: 'Serum Iron', code: 'IRON-FE', category: 'Blood Chemistry', price: 0, groupName: 'Iron Studies / Anemia Panel', displayOrder: 1, fields: [{ fieldName: 'fe', label: 'Serum Iron', fieldType: 'NUMERIC', unit: 'ug/dL', normalRange: '50-150' }] },
  { name: 'Total Iron Binding Capacity', code: 'IRON-TIBC', category: 'Blood Chemistry', price: 0, groupName: 'Iron Studies / Anemia Panel', displayOrder: 2, fields: [{ fieldName: 'tibc', label: 'TIBC', fieldType: 'NUMERIC', unit: 'ug/dL', normalRange: '250-450' }] },
  { name: 'Transferrin', code: 'IRON-TRANSF', category: 'Blood Chemistry', price: 0, groupName: 'Iron Studies / Anemia Panel', displayOrder: 3, fields: [{ fieldName: 'transf', label: 'Transferrin', fieldType: 'NUMERIC', unit: 'mg/dL', normalRange: '200-360' }] },
  { name: 'Transferrin Saturation', code: 'IRON-TSAT', category: 'Blood Chemistry', price: 0, groupName: 'Iron Studies / Anemia Panel', displayOrder: 4, fields: [{ fieldName: 'tsat', label: 'Transferrin Saturation', fieldType: 'NUMERIC', unit: '%', normalRange: '20-50' }] },
  { name: 'Ferritin', code: 'IRON-FERR', category: 'Blood Chemistry', price: 0, groupName: 'Iron Studies / Anemia Panel', displayOrder: 5, fields: [{ fieldName: 'ferr', label: 'Ferritin', fieldType: 'NUMERIC', unit: 'ng/mL', normalRange: 'M: 20-250, F: 10-120' }] },
  // Immunology (continued — RF & ASO moved above)
  { name: 'ANA (Antinuclear Antibody)', code: 'IMMUNO-ANA', category: 'Immunology', price: 0, groupName: 'Immunology', displayOrder: 3, fields: [{ fieldName: 'ana', label: 'ANA', fieldType: 'OPTIONS', options: 'Positive,Negative', normalRange: 'Negative' }] },
  { name: 'Anti-dsDNA', code: 'IMMUNO-DSDNA', category: 'Immunology', price: 0, groupName: 'Immunology', displayOrder: 4, fields: [{ fieldName: 'dsdna', label: 'Anti-dsDNA', fieldType: 'NUMERIC', unit: 'IU/mL', normalRange: '<30' }] },
  { name: 'Anti-CCP', code: 'IMMUNO-CCP', category: 'Immunology', price: 0, groupName: 'Immunology', displayOrder: 5, fields: [{ fieldName: 'ccp', label: 'Anti-CCP', fieldType: 'NUMERIC', unit: 'U/mL', normalRange: '<20' }] },
  { name: 'Anti-TPO', code: 'IMMUNO-TPO', category: 'Immunology', price: 0, groupName: 'Immunology', displayOrder: 6, fields: [{ fieldName: 'tpo', label: 'Anti-TPO', fieldType: 'NUMERIC', unit: 'IU/mL', normalRange: '<35' }] },
  { name: 'Anti-Tissue Transglutaminase (tTG) IgA', code: 'IMMUNO-TTG', category: 'Immunology', price: 0, groupName: 'Immunology', displayOrder: 7, fields: [{ fieldName: 'ttg', label: 'tTG IgA', fieldType: 'NUMERIC', unit: 'U/mL', normalRange: '<15' }] },
  { name: 'Complement C3', code: 'IMMUNO-C3', category: 'Immunology', price: 0, groupName: 'Immunology', displayOrder: 8, fields: [{ fieldName: 'c3', label: 'Complement C3', fieldType: 'NUMERIC', unit: 'mg/dL', normalRange: '90-180' }] },
  { name: 'Complement C4', code: 'IMMUNO-C4', category: 'Immunology', price: 0, groupName: 'Immunology', displayOrder: 9, fields: [{ fieldName: 'c4', label: 'Complement C4', fieldType: 'NUMERIC', unit: 'mg/dL', normalRange: '10-40' }] },
  // Inflammatory Markers
  { name: 'C-Reactive Protein (CRP)', code: 'INFLAM-CRP', category: 'Blood Chemistry', price: 0, groupName: 'Inflammatory Markers', displayOrder: 1, fields: [{ fieldName: 'crp', label: 'CRP', fieldType: 'NUMERIC', unit: 'mg/L', normalRange: '<5' }] },
  { name: 'Procalcitonin', code: 'INFLAM-PCT', category: 'Blood Chemistry', price: 0, groupName: 'Inflammatory Markers', displayOrder: 2, fields: [{ fieldName: 'pct', label: 'Procalcitonin', fieldType: 'NUMERIC', unit: 'ng/mL', normalRange: '<0.5' }] },
  { name: 'Haptoglobin', code: 'INFLAM-HAPTO', category: 'Blood Chemistry', price: 0, groupName: 'Inflammatory Markers', displayOrder: 3, fields: [{ fieldName: 'hapto', label: 'Haptoglobin', fieldType: 'NUMERIC', unit: 'mg/dL', normalRange: '30-200' }] },
  // Arterial Blood Gas
  { name: 'Arterial Blood Gas (ABG)', code: 'ABG-PANEL', category: 'Blood Chemistry', price: 0, groupName: 'Arterial Blood Gas', displayOrder: 1, fields: [
    { fieldName: 'abg_ph', label: 'pH', fieldType: 'NUMERIC', unit: '', normalRange: '7.35-7.45' },
    { fieldName: 'abg_pco2', label: 'pCO2', fieldType: 'NUMERIC', unit: 'mmHg', normalRange: '35-45' },
    { fieldName: 'abg_po2', label: 'pO2', fieldType: 'NUMERIC', unit: 'mmHg', normalRange: '80-100' },
    { fieldName: 'abg_hco3', label: 'HCO3', fieldType: 'NUMERIC', unit: 'mEq/L', normalRange: '22-26' },
    { fieldName: 'abg_be', label: 'Base Excess', fieldType: 'NUMERIC', unit: 'mEq/L', normalRange: '-2 to +2' },
    { fieldName: 'abg_o2sat', label: 'O2 Saturation', fieldType: 'NUMERIC', unit: '%', normalRange: '95-100' },
    { fieldName: 'abg_lactate', label: 'Lactate', fieldType: 'NUMERIC', unit: 'mmol/L', normalRange: '0.5-2.2' }
  ]},
  // Diabetes Monitoring
  { name: 'HbA1c', code: 'DIABETES-A1C', category: 'Blood Chemistry', price: 0, groupName: 'Diabetes Monitoring', displayOrder: 1, fields: [{ fieldName: 'a1c', label: 'HbA1c', fieldType: 'NUMERIC', unit: '%', normalRange: '<5.7' }] },
  { name: 'Fasting Blood Sugar', code: 'DIABETES-FBS', category: 'Blood Chemistry', price: 0, groupName: 'Diabetes Monitoring', displayOrder: 2, fields: [{ fieldName: 'fbs', label: 'Fasting Blood Sugar', fieldType: 'NUMERIC', unit: 'mg/dL', normalRange: '70-100' }] },
  { name: 'Postprandial Blood Sugar (2hr)', code: 'DIABETES-PPBS', category: 'Blood Chemistry', price: 0, groupName: 'Diabetes Monitoring', displayOrder: 3, fields: [{ fieldName: 'ppbs', label: 'PPBS (2hr)', fieldType: 'NUMERIC', unit: 'mg/dL', normalRange: '<140' }] },
  { name: 'Oral Glucose Tolerance Test (OGTT)', code: 'DIABETES-OGTT', category: 'Blood Chemistry', price: 0, groupName: 'Diabetes Monitoring', displayOrder: 4, fields: [
    { fieldName: 'ogtt_fasting', label: 'Fasting', fieldType: 'NUMERIC', unit: 'mg/dL', normalRange: '70-100' },
    { fieldName: 'ogtt_1hr', label: '1 Hour', fieldType: 'NUMERIC', unit: 'mg/dL', normalRange: '<180' },
    { fieldName: 'ogtt_2hr', label: '2 Hour', fieldType: 'NUMERIC', unit: 'mg/dL', normalRange: '<140' }
  ]},
  { name: 'Microalbumin (Urine)', code: 'DIABETES-MALB', category: 'Blood Chemistry', price: 0, groupName: 'Diabetes Monitoring', displayOrder: 5, fields: [{ fieldName: 'malb', label: 'Microalbumin', fieldType: 'NUMERIC', unit: 'mg/L', normalRange: '<30' }] },
  // Infectious Disease Serology
  { name: 'Rubella IgG', code: 'IDSERO-RUBG', category: 'Serology', price: 0, groupName: 'Infectious Disease Serology', displayOrder: 1, fields: [{ fieldName: 'rubg', label: 'Rubella IgG', fieldType: 'OPTIONS', options: 'Positive,Negative,Equivocal', normalRange: 'Positive (immune)' }] },
  { name: 'Rubella IgM', code: 'IDSERO-RUBM', category: 'Serology', price: 0, groupName: 'Infectious Disease Serology', displayOrder: 2, fields: [{ fieldName: 'rubm', label: 'Rubella IgM', fieldType: 'OPTIONS', options: 'Positive,Negative', normalRange: 'Negative' }] },
  { name: 'CMV IgG', code: 'IDSERO-CMVG', category: 'Serology', price: 0, groupName: 'Infectious Disease Serology', displayOrder: 3, fields: [{ fieldName: 'cmvg', label: 'CMV IgG', fieldType: 'OPTIONS', options: 'Positive,Negative', normalRange: 'Negative' }] },
  { name: 'CMV IgM', code: 'IDSERO-CMVM', category: 'Serology', price: 0, groupName: 'Infectious Disease Serology', displayOrder: 4, fields: [{ fieldName: 'cmvm', label: 'CMV IgM', fieldType: 'OPTIONS', options: 'Positive,Negative', normalRange: 'Negative' }] },
  { name: 'EBV VCA IgG', code: 'IDSERO-EBVVG', category: 'Serology', price: 0, groupName: 'Infectious Disease Serology', displayOrder: 5, fields: [{ fieldName: 'ebv_vca_g', label: 'EBV VCA IgG', fieldType: 'OPTIONS', options: 'Positive,Negative', normalRange: 'Negative' }] },
  { name: 'EBV VCA IgM', code: 'IDSERO-EBVVM', category: 'Serology', price: 0, groupName: 'Infectious Disease Serology', displayOrder: 6, fields: [{ fieldName: 'ebv_vca_m', label: 'EBV VCA IgM', fieldType: 'OPTIONS', options: 'Positive,Negative', normalRange: 'Negative' }] },
  { name: 'EBV EBNA IgG', code: 'IDSERO-EBVNA', category: 'Serology', price: 0, groupName: 'Infectious Disease Serology', displayOrder: 7, fields: [{ fieldName: 'ebv_ebna', label: 'EBV EBNA IgG', fieldType: 'OPTIONS', options: 'Positive,Negative', normalRange: 'Negative (past infection = Positive)' }] },
  { name: 'Toxoplasma IgG', code: 'IDSERO-TOXG', category: 'Serology', price: 0, groupName: 'Infectious Disease Serology', displayOrder: 8, fields: [{ fieldName: 'toxg', label: 'Toxoplasma IgG', fieldType: 'OPTIONS', options: 'Positive,Negative,Equivocal', normalRange: 'Negative' }] },
  { name: 'Toxoplasma IgM', code: 'IDSERO-TOXM', category: 'Serology', price: 0, groupName: 'Infectious Disease Serology', displayOrder: 9, fields: [{ fieldName: 'toxm', label: 'Toxoplasma IgM', fieldType: 'OPTIONS', options: 'Positive,Negative', normalRange: 'Negative' }] },
  { name: 'Dengue IgG/IgM', code: 'IDSERO-DENGUE', category: 'Serology', price: 0, groupName: 'Infectious Disease Serology', displayOrder: 10, fields: [{ fieldName: 'dengue_ig', label: 'Dengue IgG/IgM', fieldType: 'OPTIONS', options: 'Positive,Negative', normalRange: 'Negative' }] },
  { name: 'Brucella Antibody', code: 'IDSERO-BRUCELLA', category: 'Serology', price: 0, groupName: 'Infectious Disease Serology', displayOrder: 11, fields: [{ fieldName: 'brucella', label: 'Brucella Titer', fieldType: 'NUMERIC', unit: 'titer', normalRange: '<1:80' }] },
  { name: 'Mycoplasma pneumoniae IgG', code: 'IDSERO-MYCOG', category: 'Serology', price: 0, groupName: 'Infectious Disease Serology', displayOrder: 12, fields: [{ fieldName: 'mycog', label: 'Mycoplasma IgG', fieldType: 'OPTIONS', options: 'Positive,Negative', normalRange: 'Negative' }] },
  { name: 'Mycoplasma pneumoniae IgM', code: 'IDSERO-MYCOM', category: 'Serology', price: 0, groupName: 'Infectious Disease Serology', displayOrder: 13, fields: [{ fieldName: 'mycom', label: 'Mycoplasma IgM', fieldType: 'OPTIONS', options: 'Positive,Negative', normalRange: 'Negative' }] },
  { name: 'COVID-19 PCR', code: 'IDSERO-COVPCR', category: 'Serology', price: 0, groupName: 'Infectious Disease Serology', displayOrder: 14, fields: [{ fieldName: 'cov_pcr', label: 'COVID-19 PCR', fieldType: 'OPTIONS', options: 'Detected,Not Detected', normalRange: 'Not Detected' }] },
  { name: 'COVID-19 IgG', code: 'IDSERO-COVIGG', category: 'Serology', price: 0, groupName: 'Infectious Disease Serology', displayOrder: 15, fields: [{ fieldName: 'cov_igg', label: 'COVID-19 IgG', fieldType: 'OPTIONS', options: 'Positive,Negative', normalRange: 'Negative' }] },
  // Hepatitis Profile
  { name: 'HAV Ab Total', code: 'HEP-HAVAB', category: 'Serology', price: 0, groupName: 'Hepatitis Profile', displayOrder: 1, fields: [{ fieldName: 'hav_ab', label: 'HAV Ab Total', fieldType: 'OPTIONS', options: 'Positive,Negative', normalRange: 'Negative' }] },
  { name: 'HAV Ab IgM', code: 'HEP-HAVIGM', category: 'Serology', price: 0, groupName: 'Hepatitis Profile', displayOrder: 2, fields: [{ fieldName: 'hav_igm', label: 'HAV Ab IgM', fieldType: 'OPTIONS', options: 'Positive,Negative', normalRange: 'Negative' }] },
  { name: 'HBcAb Total', code: 'HEP-HBCAB', category: 'Serology', price: 0, groupName: 'Hepatitis Profile', displayOrder: 3, fields: [{ fieldName: 'hbc_ab', label: 'HBcAb Total', fieldType: 'OPTIONS', options: 'Positive,Negative', normalRange: 'Negative' }] },
  { name: 'HBcAb IgM', code: 'HEP-HBCIGM', category: 'Serology', price: 0, groupName: 'Hepatitis Profile', displayOrder: 4, fields: [{ fieldName: 'hbc_igm', label: 'HBcAb IgM', fieldType: 'OPTIONS', options: 'Positive,Negative', normalRange: 'Negative' }] },
  { name: 'HBsAb (Hepatitis B Surface Antibody)', code: 'HEP-HBSAB', category: 'Serology', price: 0, groupName: 'Hepatitis Profile', displayOrder: 5, fields: [{ fieldName: 'hbs_ab', label: 'HBsAb', fieldType: 'NUMERIC', unit: 'mIU/mL', normalRange: '>10 (protective)' }] },
  { name: 'HBeAg', code: 'HEP-HBEAG', category: 'Serology', price: 0, groupName: 'Hepatitis Profile', displayOrder: 6, fields: [{ fieldName: 'hbe_ag', label: 'HBeAg', fieldType: 'OPTIONS', options: 'Positive,Negative', normalRange: 'Negative' }] },
  { name: 'HBeAb', code: 'HEP-HBEAB', category: 'Serology', price: 0, groupName: 'Hepatitis Profile', displayOrder: 7, fields: [{ fieldName: 'hbe_ab', label: 'HBeAb', fieldType: 'OPTIONS', options: 'Positive,Negative', normalRange: 'Negative' }] },
  // Allergy Testing
  { name: 'Total IgE', code: 'ALLERGY-IGE', category: 'Immunology', price: 0, groupName: 'Allergy Testing', displayOrder: 1, fields: [{ fieldName: 'ige', label: 'Total IgE', fieldType: 'NUMERIC', unit: 'IU/mL', normalRange: '<100' }] },
  { name: 'Food Allergy Panel IgE', code: 'ALLERGY-FOOD', category: 'Immunology', price: 0, groupName: 'Allergy Testing', displayOrder: 2, fields: [{ fieldName: 'food_ige', label: 'Food Allergen IgE', fieldType: 'TEXT', normalRange: '' }] },
  { name: 'Inhalant Allergy Panel IgE', code: 'ALLERGY-INHAL', category: 'Immunology', price: 0, groupName: 'Allergy Testing', displayOrder: 3, fields: [{ fieldName: 'inhal_ige', label: 'Inhalant Allergen IgE', fieldType: 'TEXT', normalRange: '' }] },
  // Therapeutic Drug Monitoring
  { name: 'Digoxin', code: 'TDM-DIGOXIN', category: 'Blood Chemistry', price: 0, groupName: 'Therapeutic Drug Monitoring', displayOrder: 1, fields: [{ fieldName: 'digoxin', label: 'Digoxin', fieldType: 'NUMERIC', unit: 'ng/mL', normalRange: '0.5-2.0' }] },
  { name: 'Lithium', code: 'TDM-LITHIUM', category: 'Blood Chemistry', price: 0, groupName: 'Therapeutic Drug Monitoring', displayOrder: 2, fields: [{ fieldName: 'lithium', label: 'Lithium', fieldType: 'NUMERIC', unit: 'mEq/L', normalRange: '0.6-1.2' }] },
  { name: 'Valproic Acid', code: 'TDM-VALPROATE', category: 'Blood Chemistry', price: 0, groupName: 'Therapeutic Drug Monitoring', displayOrder: 3, fields: [{ fieldName: 'valproate', label: 'Valproic Acid', fieldType: 'NUMERIC', unit: 'ug/mL', normalRange: '50-100' }] },
  { name: 'Carbamazepine', code: 'TDM-CARBA', category: 'Blood Chemistry', price: 0, groupName: 'Therapeutic Drug Monitoring', displayOrder: 4, fields: [{ fieldName: 'carba', label: 'Carbamazepine', fieldType: 'NUMERIC', unit: 'ug/mL', normalRange: '4-12' }] },
  { name: 'Phenytoin', code: 'TDM-PHENYTOIN', category: 'Blood Chemistry', price: 0, groupName: 'Therapeutic Drug Monitoring', displayOrder: 5, fields: [{ fieldName: 'phenytoin', label: 'Phenytoin', fieldType: 'NUMERIC', unit: 'ug/mL', normalRange: '10-20' }] },
  { name: 'Vancomycin (Trough)', code: 'TDM-VANCO', category: 'Blood Chemistry', price: 0, groupName: 'Therapeutic Drug Monitoring', displayOrder: 6, fields: [{ fieldName: 'vanco', label: 'Vancomycin Trough', fieldType: 'NUMERIC', unit: 'ug/mL', normalRange: '10-20' }] },
  // Vitamins & Nutrition
  { name: 'Vitamin D 25-OH', code: 'VITAMIN-D', category: 'Blood Chemistry', price: 0, groupName: 'Vitamins & Nutrition', displayOrder: 1, fields: [{ fieldName: 'vitd', label: 'Vitamin D 25-OH', fieldType: 'NUMERIC', unit: 'ng/mL', normalRange: '30-100' }] },
  { name: 'Vitamin B12', code: 'VITAMIN-B12', category: 'Blood Chemistry', price: 0, groupName: 'Vitamins & Nutrition', displayOrder: 2, fields: [{ fieldName: 'b12', label: 'Vitamin B12', fieldType: 'NUMERIC', unit: 'pg/mL', normalRange: '200-900' }] },
  { name: 'Folate (Serum)', code: 'VITAMIN-FOLATE', category: 'Blood Chemistry', price: 0, groupName: 'Vitamins & Nutrition', displayOrder: 3, fields: [{ fieldName: 'folate', label: 'Folate', fieldType: 'NUMERIC', unit: 'ng/mL', normalRange: '3-17' }] },
  { name: 'Magnesium', code: 'VITAMIN-MG', category: 'Blood Chemistry', price: 0, groupName: 'Vitamins & Nutrition', displayOrder: 4, fields: [{ fieldName: 'mg', label: 'Magnesium', fieldType: 'NUMERIC', unit: 'mg/dL', normalRange: '1.7-2.3' }] },
  { name: 'Zinc', code: 'VITAMIN-ZN', category: 'Blood Chemistry', price: 0, groupName: 'Vitamins & Nutrition', displayOrder: 5, fields: [{ fieldName: 'zn', label: 'Zinc', fieldType: 'NUMERIC', unit: 'ug/dL', normalRange: '70-120' }] },
  // Bone & Joint Markers
  { name: 'Phosphorus', code: 'BONE-PO4', category: 'Blood Chemistry', price: 0, groupName: 'Bone & Joint Markers', displayOrder: 1, fields: [{ fieldName: 'po4', label: 'Phosphorus', fieldType: 'NUMERIC', unit: 'mg/dL', normalRange: '2.5-4.5' }] }
];

const INVESTIGATION_TYPES = [
  { name: 'X-Ray Chest', category: 'RADIOLOGY', price: 0 },
  { name: 'X-Ray Abdomen', category: 'RADIOLOGY', price: 0 },
  { name: 'X-Ray Extremity', category: 'RADIOLOGY', price: 0 },
  { name: 'X-Ray Cervical Spine', category: 'RADIOLOGY', price: 0 },
  { name: 'X-Ray Lumbar Spine', category: 'RADIOLOGY', price: 0 },
  { name: 'X-Ray Pelvis', category: 'RADIOLOGY', price: 0 },
  { name: 'X-Ray Shoulder', category: 'RADIOLOGY', price: 0 },
  { name: 'X-Ray Knee', category: 'RADIOLOGY', price: 0 },
  { name: 'X-Ray Wrist', category: 'RADIOLOGY', price: 0 },
  { name: 'X-Ray Skull', category: 'RADIOLOGY', price: 0 },
  { name: 'X-Ray Sinuses', category: 'RADIOLOGY', price: 0 },
  { name: 'Ultrasound Abdomen', category: 'RADIOLOGY', price: 0 },
  { name: 'Ultrasound Pelvis', category: 'RADIOLOGY', price: 0 },
  { name: 'Ultrasound Obstetric', category: 'RADIOLOGY', price: 0 },
  { name: 'Ultrasound Thyroid', category: 'RADIOLOGY', price: 0 },
  { name: 'Ultrasound Breast', category: 'RADIOLOGY', price: 0 },
  { name: 'Ultrasound Doppler', category: 'RADIOLOGY', price: 0 },
  { name: 'Ultrasound Renal', category: 'RADIOLOGY', price: 0 },
  { name: 'Ultrasound Scrotum', category: 'RADIOLOGY', price: 0 },
  { name: 'Ultrasound Transvaginal', category: 'RADIOLOGY', price: 0 },
  { name: 'Ultrasound Soft Tissue', category: 'RADIOLOGY', price: 0 },
  { name: 'Ultrasound Neck', category: 'RADIOLOGY', price: 0 },
  { name: 'CT Scan Head', category: 'RADIOLOGY', price: 0 },
  { name: 'CT Scan Chest', category: 'RADIOLOGY', price: 0 },
  { name: 'CT Scan Abdomen', category: 'RADIOLOGY', price: 0 },
  { name: 'CT Scan Pelvis', category: 'RADIOLOGY', price: 0 },
  { name: 'CT Scan Lumbar Spine', category: 'RADIOLOGY', price: 0 },
  { name: 'CT Scan Sinuses', category: 'RADIOLOGY', price: 0 },
  { name: 'CT Coronary Angiography', category: 'RADIOLOGY', price: 0 },
  { name: 'CT Urogram', category: 'RADIOLOGY', price: 0 },
  { name: 'MRI Brain', category: 'RADIOLOGY', price: 0 },
  { name: 'MRI Cervical Spine', category: 'RADIOLOGY', price: 0 },
  { name: 'MRI Lumbar Spine', category: 'RADIOLOGY', price: 0 },
  { name: 'MRI Shoulder', category: 'RADIOLOGY', price: 0 },
  { name: 'MRI Knee', category: 'RADIOLOGY', price: 0 },
  { name: 'MRI Abdomen', category: 'RADIOLOGY', price: 0 },
  { name: 'MRI Pelvis', category: 'RADIOLOGY', price: 0 },
  { name: 'MRCP', category: 'RADIOLOGY', price: 0 },
  { name: 'Mammography', category: 'RADIOLOGY', price: 0 },
  { name: 'Bone Scan', category: 'RADIOLOGY', price: 0 },
  { name: 'PET/CT Scan', category: 'RADIOLOGY', price: 0 },
  { name: 'Thyroid Scan', category: 'RADIOLOGY', price: 0 },
  { name: 'Barium Swallow', category: 'RADIOLOGY', price: 0 },
  { name: 'Upper GI Series', category: 'RADIOLOGY', price: 0 },
  { name: 'Barium Enema', category: 'RADIOLOGY', price: 0 },
  { name: 'Hysterosalpingography (HSG)', category: 'RADIOLOGY', price: 0 },
  { name: 'DEXA Bone Density', category: 'RADIOLOGY', price: 0 },
  { name: 'Arthrogram', category: 'RADIOLOGY', price: 0 },
  { name: 'Myelogram', category: 'RADIOLOGY', price: 0 }
];

const RADIOLOGY_TEMPLATES = RADIOLOGY_TEMPLATE_DATA;

const TEETH_DATA = [
  { number: 1, eruptionStart: 6, eruptionEnd: 8, rootCompletion: 10 },
  { number: 2, eruptionStart: 8, eruptionEnd: 9, rootCompletion: 11 },
  { number: 3, eruptionStart: 11, eruptionEnd: 12, rootCompletion: 13 },
  { number: 4, eruptionStart: 10, eruptionEnd: 11, rootCompletion: 12 },
  { number: 5, eruptionStart: 10, eruptionEnd: 12, rootCompletion: 13 },
  { number: 6, eruptionStart: 6, eruptionEnd: 7, rootCompletion: 9 },
  { number: 7, eruptionStart: 12, eruptionEnd: 13, rootCompletion: 14 },
  { number: 8, eruptionStart: 17, eruptionEnd: 25, rootCompletion: 25 },
  { number: 9, eruptionStart: 7, eruptionEnd: 8, rootCompletion: 9 },
  { number: 10, eruptionStart: 7, eruptionEnd: 9, rootCompletion: 11 },
  { number: 11, eruptionStart: 10, eruptionEnd: 11, rootCompletion: 12 },
  { number: 12, eruptionStart: 10, eruptionEnd: 12, rootCompletion: 13 },
  { number: 13, eruptionStart: 11, eruptionEnd: 12, rootCompletion: 13 },
  { number: 14, eruptionStart: 6, eruptionEnd: 7, rootCompletion: 9 },
  { number: 15, eruptionStart: 11, eruptionEnd: 13, rootCompletion: 14 },
  { number: 16, eruptionStart: 17, eruptionEnd: 25, rootCompletion: 25 },
  { number: 17, eruptionStart: 17, eruptionEnd: 25, rootCompletion: 25 },
  { number: 18, eruptionStart: 11, eruptionEnd: 13, rootCompletion: 14 },
  { number: 19, eruptionStart: 6, eruptionEnd: 7, rootCompletion: 9 },
  { number: 20, eruptionStart: 11, eruptionEnd: 12, rootCompletion: 13 },
  { number: 21, eruptionStart: 10, eruptionEnd: 12, rootCompletion: 13 },
  { number: 22, eruptionStart: 10, eruptionEnd: 11, rootCompletion: 12 },
  { number: 23, eruptionStart: 7, eruptionEnd: 9, rootCompletion: 11 },
  { number: 24, eruptionStart: 7, eruptionEnd: 8, rootCompletion: 9 },
  { number: 25, eruptionStart: 17, eruptionEnd: 25, rootCompletion: 25 },
  { number: 26, eruptionStart: 12, eruptionEnd: 13, rootCompletion: 14 },
  { number: 27, eruptionStart: 6, eruptionEnd: 7, rootCompletion: 9 },
  { number: 28, eruptionStart: 10, eruptionEnd: 12, rootCompletion: 13 },
  { number: 29, eruptionStart: 10, eruptionEnd: 11, rootCompletion: 12 },
  { number: 30, eruptionStart: 11, eruptionEnd: 12, rootCompletion: 13 },
  { number: 31, eruptionStart: 8, eruptionEnd: 9, rootCompletion: 11 },
  { number: 32, eruptionStart: 6, eruptionEnd: 8, rootCompletion: 10 }
];

const seedAll = async () => {
  const results = { seeded: [], skipped: [] };
  const log = (msg) => console.log(`[SeedTemplates] ${msg}`);

  try {
    // 1. Tooth data
    const existingTeeth = await prisma.tooth.count();
    if (existingTeeth === 0) {
      await prisma.tooth.createMany({ data: TEETH_DATA, skipDuplicates: true });
      log(`Seeded ${TEETH_DATA.length} teeth`);
      results.seeded.push('teeth');
    } else {
      log(`Teeth already seeded (${existingTeeth}), skipping`);
      results.skipped.push('teeth');
    }

    // 2. Lab Test Groups
    for (const group of LAB_GROUPS) {
      const existing = await prisma.labTestGroup.findFirst({ where: { name: group.name } });
      if (!existing) {
        await prisma.labTestGroup.create({ data: group });
        log(`Created lab group: ${group.name}`);
      }
    }
    // 3. Lab Tests + Fields
    for (const test of LAB_TESTS) {
      const existing = await prisma.labTest.findFirst({ where: { code: test.code } });
      const { fields, groupName, ...testData } = test;
      const autoDescription = testData.description || `${test.name} — ${groupName || testData.category}`;

      if (existing) {
        if (!existing.description) {
          await prisma.labTest.update({
            where: { id: existing.id },
            data: { description: autoDescription }
          });
          log(`Updated description for: ${test.name}`);
        }
        continue;
      }

      const group = await prisma.labTestGroup.findFirst({ where: { name: groupName } });
      const created = await prisma.labTest.create({
        data: { ...testData, description: autoDescription, groupId: group?.id || null }
      });
      if (fields?.length) {
        await prisma.labTestResultField.createMany({
          data: fields.map(f => ({ ...f, testId: created.id })),
          skipDuplicates: true
        });
      }
      log(`Created lab test: ${test.name}`);
    }

    // Verify counts
    const testCount = await prisma.labTest.count();
    const fieldCount = await prisma.labTestResultField.count();
    log(`Lab tests: ${testCount}, Fields: ${fieldCount}`);

    // 4. Investigation Types + Radiology Templates
    for (const inv of INVESTIGATION_TYPES) {
      const existing = await prisma.investigationType.findFirst({ where: { name: inv.name } });
      if (existing) continue;

      const created = await prisma.investigationType.create({ data: inv });

      const template = RADIOLOGY_TEMPLATES[inv.name];
      if (template) {
        await prisma.radiologyTemplate.create({
          data: {
            investigationTypeId: created.id,
            clinicalIndicationTemplate: template.clinicalIndication,
            techniqueTemplate: template.technique,
            findingsTemplate: template.findings,
            conclusionTemplate: template.conclusion
          }
        });
        log(`Created radiology template for: ${inv.name}`);
      }
    }

    const invCount = await prisma.investigationType.count();
    log(`Investigation types: ${invCount}`);

    log('Seeding complete');
    return results;
  } catch (error) {
    console.error('[SeedTemplates] Error:', error.message);
    throw error;
  }
};

module.exports = { seedAll, LAB_GROUPS, LAB_TESTS, INVESTIGATION_TYPES, RADIOLOGY_TEMPLATES, TEETH_DATA };
