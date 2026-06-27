// Medical standards for lab templates and vitals

// Individual lab field standards - normal ranges for specific fields
export const LAB_FIELD_STANDARDS = {
  // CBC/Hematology Fields
  'Hb (Hemoglobin)': { unit: 'g/dl', normal: { min: 12.1, max: 17.2 }, acceptable: { min: 11.0, max: 18.0 } },
  'Hemoglobin': { unit: 'g/dl', normal: { min: 12.1, max: 17.2 }, acceptable: { min: 11.0, max: 18.0 } },
  'HCT / PCV': { unit: '%', normal: { min: 36.1, max: 50.3 }, acceptable: { min: 33.0, max: 53.0 } },
  'Hematocrit': { unit: '%', normal: { min: 36.1, max: 50.3 }, acceptable: { min: 33.0, max: 53.0 } },
  'RBC': { unit: '×10⁶/µL', normal: { min: 4.2, max: 6.1 }, acceptable: { min: 3.8, max: 6.5 } },
  'WBC': { unit: '×10³/µL', normal: { min: 4.5, max: 11.0 }, acceptable: { min: 3.5, max: 12.0 } },
  'White Blood Cell': { unit: '×10³/µL', normal: { min: 4.5, max: 11.0 }, acceptable: { min: 3.5, max: 12.0 } },
  'Plt (Platelets)': { unit: '×10³/µL', normal: { min: 150, max: 450 }, acceptable: { min: 100, max: 500 } },
  'Platelets': { unit: '×10³/µL', normal: { min: 150, max: 450 }, acceptable: { min: 100, max: 500 } },
  'MCV': { unit: 'fL', normal: { min: 80, max: 100 }, acceptable: { min: 75, max: 105 } },
  'MCH': { unit: 'pg', normal: { min: 27, max: 33 }, acceptable: { min: 25, max: 35 } },
  'MCHC': { unit: 'g/dl', normal: { min: 32, max: 36 }, acceptable: { min: 31, max: 37 } },
  'RDW-CV': { unit: '%', normal: { min: 11.5, max: 14.5 }, acceptable: { min: 10.5, max: 15.5 } },
  'RDW-CV (Red Cell Distribution Width - CV)': { unit: '%', normal: { min: 11.5, max: 14.5 }, acceptable: { min: 10.5, max: 15.5 } },
  'RDW-SD': { unit: 'fL', normal: { min: 39, max: 46 }, acceptable: { min: 36, max: 49 } },
  'RDW-SD (Red Cell Distribution Width - SD)': { unit: 'fL', normal: { min: 39, max: 46 }, acceptable: { min: 36, max: 49 } },
  'MPV': { unit: 'fL', normal: { min: 7.5, max: 11.5 }, acceptable: { min: 6.5, max: 12.5 } },
  'MPV (Mean Platelet Volume)': { unit: 'fL', normal: { min: 7.5, max: 11.5 }, acceptable: { min: 6.5, max: 12.5 } },
  'PDW': { unit: 'fL', normal: { min: 9.0, max: 17.0 }, acceptable: { min: 8.0, max: 18.0 } },
  'PDW (Platelet Distribution Width)': { unit: 'fL', normal: { min: 9.0, max: 17.0 }, acceptable: { min: 8.0, max: 18.0 } },
  'PCT': { unit: '%', normal: { min: 0.15, max: 0.35 }, acceptable: { min: 0.10, max: 0.40 } },
  'PCT (Plateletcrit)': { unit: '%', normal: { min: 0.15, max: 0.35 }, acceptable: { min: 0.10, max: 0.40 } },
  'Lymph#': { unit: '×10³/µL', normal: { min: 1.0, max: 4.8 }, acceptable: { min: 0.8, max: 5.5 } },
  'Lymphocyte Number': { unit: '×10³/µL', normal: { min: 1.0, max: 4.8 }, acceptable: { min: 0.8, max: 5.5 } },
  'Mid#': { unit: '×10³/µL', normal: { min: 0.1, max: 1.0 }, acceptable: { min: 0.05, max: 1.5 } },
  'Mid-range Cell Number': { unit: '×10³/µL', normal: { min: 0.1, max: 1.0 }, acceptable: { min: 0.05, max: 1.5 } },
  'Gran#': { unit: '×10³/µL', normal: { min: 1.8, max: 7.7 }, acceptable: { min: 1.5, max: 8.5 } },
  'Granulocyte Number': { unit: '×10³/µL', normal: { min: 1.8, max: 7.7 }, acceptable: { min: 1.5, max: 8.5 } },
  'Mid%': { unit: '%', normal: { min: 3, max: 15 }, acceptable: { min: 1, max: 17 } },
  'Mid-range Cell %': { unit: '%', normal: { min: 3, max: 15 }, acceptable: { min: 1, max: 17 } },
  'Gran%': { unit: '%', normal: { min: 40, max: 70 }, acceptable: { min: 35, max: 75 } },
  'Granulocytes %': { unit: '%', normal: { min: 40, max: 70 }, acceptable: { min: 35, max: 75 } },
  'ESR': { unit: 'mm/hr', normal: { min: 0, max: 20 }, acceptable: { min: 0, max: 30 } },
  'N (Neutrophils)': { unit: '%', normal: { min: 40, max: 70 }, acceptable: { min: 35, max: 75 } },
  'L (Lymphocytes)': { unit: '%', normal: { min: 20, max: 45 }, acceptable: { min: 15, max: 50 } },
  'Lymph%': { unit: '%', normal: { min: 20, max: 45 }, acceptable: { min: 15, max: 50 } },
  'M (Monocytes)': { unit: '%', normal: { min: 2, max: 10 }, acceptable: { min: 1, max: 12 } },
  'E (Eosinophils)': { unit: '%', normal: { min: 0, max: 5 }, acceptable: { min: 0, max: 7 } },
  'B (Basophils)': { unit: '%', normal: { min: 0, max: 2 }, acceptable: { min: 0, max: 3 } },

  // Blood Chemistry Fields
  'Glucose': { unit: 'mg/dL', normal: { min: 70, max: 100 }, acceptable: { min: 65, max: 110 } },
  'FBS': { unit: 'mg/dL', normal: { min: 70, max: 100 }, acceptable: { min: 65, max: 110 } },
  'Fasting Blood Sugar': { unit: 'mg/dL', normal: { min: 70, max: 100 }, acceptable: { min: 65, max: 110 } },
  'Creatinine': { unit: 'mg/dL', normal: { min: 0.6, max: 1.3 }, acceptable: { min: 0.5, max: 1.5 } },
  'BUN': { unit: 'mg/dL', normal: { min: 7, max: 20 }, acceptable: { min: 5, max: 25 } },
  'Blood Urea Nitrogen': { unit: 'mg/dL', normal: { min: 7, max: 20 }, acceptable: { min: 5, max: 25 } },
  'Total Cholesterol': { unit: 'mg/dL', normal: { min: 0, max: 200 }, acceptable: { min: 0, max: 240 } },
  'Cholesterol': { unit: 'mg/dL', normal: { min: 0, max: 200 }, acceptable: { min: 0, max: 240 } },
  'LDL': { unit: 'mg/dL', normal: { min: 0, max: 100 }, acceptable: { min: 0, max: 130 } },
  'HDL': { unit: 'mg/dL', normal: { min: 50, max: 200 }, acceptable: { min: 40, max: 200 } },
  'Triglycerides': { unit: 'mg/dL', normal: { min: 0, max: 150 }, acceptable: { min: 0, max: 200 } },
  'ALT': { unit: 'U/L', normal: { min: 4, max: 36 }, acceptable: { min: 2, max: 50 } },
  'AST': { unit: 'U/L', normal: { min: 8, max: 33 }, acceptable: { min: 5, max: 45 } },
  'ALP': { unit: 'U/L', normal: { min: 20, max: 130 }, acceptable: { min: 15, max: 150 } },
  'Alkaline Phosphatase': { unit: 'U/L', normal: { min: 20, max: 130 }, acceptable: { min: 15, max: 150 } },
  'Total Bilirubin': { unit: 'mg/dL', normal: { min: 0.1, max: 1.2 }, acceptable: { min: 0.0, max: 2.0 } },
  'Bilirubin': { unit: 'mg/dL', normal: { min: 0.1, max: 1.2 }, acceptable: { min: 0.0, max: 2.0 } },
  'Albumin': { unit: 'g/dL', normal: { min: 3.4, max: 5.4 }, acceptable: { min: 3.0, max: 5.8 } },
  'Total Protein': { unit: 'g/dL', normal: { min: 6.0, max: 8.3 }, acceptable: { min: 5.5, max: 8.8 } },

  // Urinalysis Fields
  'Specific Gravity': { unit: '', normal: { min: 1.003, max: 1.030 }, acceptable: { min: 1.001, max: 1.035 } },
  'pH': { unit: '', normal: { min: 4.5, max: 8.0 }, acceptable: { min: 4.0, max: 8.5 } },
  'Protein': { unit: '', normal: { min: 0, max: 0 }, acceptable: { min: 0, max: 0 }, isQualitative: true, normalValue: 'Negative' },
  'Glucose': { unit: '', normal: { min: 0, max: 0 }, acceptable: { min: 0, max: 0 }, isQualitative: true, normalValue: 'Negative' },
  'Ketones': { unit: '', normal: { min: 0, max: 0 }, acceptable: { min: 0, max: 0 }, isQualitative: true, normalValue: 'Negative' },
};

// Lab template standards - minimum expected fields filled for different template types
export const LAB_TEMPLATE_STANDARDS = {
  // General standards - minimum fields expected to be filled
  GENERAL: {
    minFields: 3, // At least 3 fields should be filled
    recommendedFields: 5, // Recommended number of fields
  },
  // Blood tests typically have many fields
  HEMATOLOGY: {
    minFields: 5,
    recommendedFields: 8,
  },
  // Chemistry tests
  CHEMISTRY: {
    minFields: 4,
    recommendedFields: 6,
  },
  // Urinalysis
  URINALYSIS: {
    minFields: 3,
    recommendedFields: 5,
  },
  // Microbiology
  MICROBIOLOGY: {
    minFields: 2,
    recommendedFields: 4,
  },
};

// Vital signs normal ranges (adult standards)
export const VITAL_SIGNS_STANDARDS = {
  temperature: {
    celsius: {
      normal: { min: 36.5, max: 37.3 },
      acceptable: { min: 36.0, max: 37.5 }, // Slightly wider acceptable range
      unit: '°C',
    },
    fahrenheit: {
      normal: { min: 97.8, max: 99.1 },
      acceptable: { min: 97.0, max: 99.5 },
      unit: '°F',
    },
  },
  heartRate: {
    normal: { min: 60, max: 100 },
    acceptable: { min: 50, max: 110 }, // Slightly wider acceptable range
    unit: 'bpm',
  },
  bloodPressure: {
    systolic: {
      normal: { min: 90, max: 120 },
      acceptable: { min: 85, max: 140 },
      unit: 'mmHg',
    },
    diastolic: {
      normal: { min: 60, max: 80 },
      acceptable: { min: 55, max: 90 },
      unit: 'mmHg',
    },
  },
  respirationRate: {
    normal: { min: 12, max: 18 },
    acceptable: { min: 10, max: 20 },
    unit: 'breaths/min',
  },
  oxygenSaturation: {
    normal: { min: 95, max: 100 },
    acceptable: { min: 92, max: 100 }, // Critical if below 92
    unit: '%',
  },
};

/**
 * Check if a single lab field value is within standard range
 * @param {string} fieldName - Name of the field
 * @param {any} value - The value to check
 * @param {string} unit - Optional unit from field config
 * @returns {Object} - { inRange: boolean, status: 'normal' | 'warning' | 'critical', message: string }
 */
export const checkLabFieldStandard = (fieldName, value, unit = null) => {
  if (value === null || value === undefined || value === '' || String(value).trim() === '') {
    return {
      inRange: true, // Empty values are allowed (optional)
      status: 'normal',
      message: null,
    };
  }

  // Find matching standard (try exact match first, then partial match)
  let fieldStandard = LAB_FIELD_STANDARDS[fieldName];

  if (!fieldStandard) {
    // Try to find by partial match (e.g., "Hemoglobin" matches "Hb (Hemoglobin)")
    const fieldNameUpper = fieldName.toUpperCase();
    for (const [standardField, standard] of Object.entries(LAB_FIELD_STANDARDS)) {
      if (fieldNameUpper.includes(standardField.toUpperCase()) || standardField.toUpperCase().includes(fieldNameUpper)) {
        fieldStandard = standard;
        break;
      }
    }
  }

  // If no standard found, return normal
  if (!fieldStandard) {
    return {
      inRange: true,
      status: 'normal',
      message: null,
    };
  }

  // For qualitative fields (like protein, glucose, ketones in urine)
  if (fieldStandard.isQualitative) {
    const valueStr = String(value).trim().toLowerCase();
    const normalValueStr = String(fieldStandard.normalValue || 'Negative').toLowerCase();
    if (valueStr !== normalValueStr && valueStr !== 'negative' && valueStr !== 'normal') {
      return {
        inRange: false,
        status: 'warning',
        message: `${fieldName}: "${value}" - Expected: ${fieldStandard.normalValue || 'Negative'}`,
      };
    }
    return { inRange: true, status: 'normal', message: null };
  }

  // For quantitative fields
  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    return {
      inRange: true,
      status: 'normal',
      message: null,
    };
  }

  const normal = fieldStandard.normal;
  const acceptable = fieldStandard.acceptable || normal;

  // Check if within normal range
  if (numValue >= normal.min && numValue <= normal.max) {
    return { inRange: true, status: 'normal', message: null };
  }

  // Check if within acceptable range (warning) or outside (critical)
  const isLow = numValue < normal.min;
  const isHigh = numValue > normal.max;
  const isCritical = numValue < (acceptable.min || normal.min) || numValue > (acceptable.max || normal.max);

  const unitDisplay = fieldStandard.unit || unit || '';
  const unitStr = unitDisplay ? ` ${unitDisplay}` : '';

  return {
    inRange: false,
    status: isCritical ? 'critical' : 'warning',
    message: `${fieldName}: ${numValue}${unitStr} - ${isLow ? 'Below' : 'Above'} standard (Normal: ${normal.min}-${normal.max}${unitStr})`,
  };
};

/**
 * Check if lab template results meet standards
 * @param {Object} results - The filled results object
 * @param {Object} template - The template object with fields
 * @returns {Object} - { meetsStandard: boolean, warning: string | null, filledCount: number, fieldWarnings: Array }
 */
export const checkLabTemplateStandard = (results, template) => {
  if (!results || !template || !template.fields) {
    return {
      meetsStandard: false,
      warning: 'No results or template provided',
      filledCount: 0,
      fieldWarnings: [],
    };
  }

  // Count filled fields (non-empty values)
  const filledCount = Object.keys(template.fields).filter(fieldName => {
    const value = results[fieldName];
    return value !== null && value !== undefined && value !== '' && String(value).trim() !== '';
  }).length;

  // Get standard based on template category
  const category = template.category?.toUpperCase() || 'GENERAL';
  let standard = LAB_TEMPLATE_STANDARDS.GENERAL;

  if (category.includes('HEMATOLOGY')) {
    standard = LAB_TEMPLATE_STANDARDS.HEMATOLOGY;
  } else if (category.includes('CHEMISTRY') || category.includes('BIOCHEMISTRY')) {
    standard = LAB_TEMPLATE_STANDARDS.CHEMISTRY;
  } else if (category.includes('URINE') || category.includes('URINALYSIS')) {
    standard = LAB_TEMPLATE_STANDARDS.URINALYSIS;
  } else if (category.includes('MICROBIOLOGY') || category.includes('CULTURE')) {
    standard = LAB_TEMPLATE_STANDARDS.MICROBIOLOGY;
  }

  // Check individual field standards
  const fieldWarnings = [];
  Object.entries(template.fields).forEach(([fieldName, fieldConfig]) => {
    const value = results[fieldName];
    if (value !== null && value !== undefined && value !== '' && String(value).trim() !== '') {
      const fieldCheck = checkLabFieldStandard(fieldName, value, fieldConfig.unit);
      if (!fieldCheck.inRange && fieldCheck.message) {
        fieldWarnings.push({
          fieldName,
          value,
          ...fieldCheck,
        });
      }
    }
  });

  const totalFields = Object.keys(template.fields).length;
  const meetsMinStandard = filledCount >= standard.minFields;
  const exceedsRecommended = filledCount > standard.recommendedFields * 1.5; // 50% more than recommended

  let warning = null;
  if (!meetsMinStandard) {
    warning = `Warning: Only ${filledCount} field(s) filled. Standard recommends at least ${standard.minFields} fields.`;
  } else if (exceedsRecommended && totalFields > standard.recommendedFields) {
    warning = `Warning: ${filledCount} fields filled, which exceeds the recommended ${standard.recommendedFields} fields.`;
  }

  return {
    meetsStandard: meetsMinStandard && !exceedsRecommended && fieldWarnings.length === 0,
    warning,
    filledCount,
    standard: standard,
    totalFields,
    fieldWarnings,
  };
};

/**
 * Check if a vital sign value is within normal range
 * @param {string} vitalName - Name of the vital sign
 * @param {number} value - The value to check
 * @param {string} unit - Optional unit (e.g., 'C' for Celsius)
 * @returns {Object} - { inRange: boolean, status: 'normal' | 'warning' | 'critical', message: string }
 */
export const checkVitalSignStandard = (vitalName, value, unit = null) => {
  if (value === null || value === undefined || value === '') {
    return {
      inRange: true, // Empty values are allowed (optional)
      status: 'normal',
      message: null,
    };
  }

  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    return {
      inRange: true,
      status: 'normal',
      message: null,
    };
  }

  switch (vitalName) {
    case 'temperature':
      const tempStandard = unit === 'F'
        ? VITAL_SIGNS_STANDARDS.temperature.fahrenheit
        : VITAL_SIGNS_STANDARDS.temperature.celsius;

      if (numValue < tempStandard.normal.min || numValue > tempStandard.normal.max) {
        const isLow = numValue < tempStandard.normal.min;
        const isHigh = numValue > tempStandard.normal.max;
        const isCritical = numValue < tempStandard.acceptable.min || numValue > tempStandard.acceptable.max;

        return {
          inRange: false,
          status: isCritical ? 'critical' : 'warning',
          message: `${isLow ? 'Low' : 'High'} temperature: ${numValue}${tempStandard.unit}. Normal range: ${tempStandard.normal.min}-${tempStandard.normal.max}${tempStandard.unit}`,
        };
      }
      return { inRange: true, status: 'normal', message: null };

    case 'heartRate':
      if (numValue < VITAL_SIGNS_STANDARDS.heartRate.normal.min || numValue > VITAL_SIGNS_STANDARDS.heartRate.normal.max) {
        const isLow = numValue < VITAL_SIGNS_STANDARDS.heartRate.normal.min;
        const isCritical = numValue < VITAL_SIGNS_STANDARDS.heartRate.acceptable.min || numValue > VITAL_SIGNS_STANDARDS.heartRate.acceptable.max;

        return {
          inRange: false,
          status: isCritical ? 'critical' : 'warning',
          message: `${isLow ? 'Low' : 'High'} heart rate: ${numValue}${VITAL_SIGNS_STANDARDS.heartRate.unit}. Normal range: ${VITAL_SIGNS_STANDARDS.heartRate.normal.min}-${VITAL_SIGNS_STANDARDS.heartRate.normal.max}${VITAL_SIGNS_STANDARDS.heartRate.unit}`,
        };
      }
      return { inRange: true, status: 'normal', message: null };

    case 'bloodPressureSystolic':
      if (numValue < VITAL_SIGNS_STANDARDS.bloodPressure.systolic.normal.min || numValue > VITAL_SIGNS_STANDARDS.bloodPressure.systolic.normal.max) {
        const isLow = numValue < VITAL_SIGNS_STANDARDS.bloodPressure.systolic.normal.min;
        const isCritical = numValue < VITAL_SIGNS_STANDARDS.bloodPressure.systolic.acceptable.min || numValue > VITAL_SIGNS_STANDARDS.bloodPressure.systolic.acceptable.max;

        return {
          inRange: false,
          status: isCritical ? 'critical' : 'warning',
          message: `${isLow ? 'Low' : 'High'} systolic BP: ${numValue}${VITAL_SIGNS_STANDARDS.bloodPressure.systolic.unit}. Normal range: ${VITAL_SIGNS_STANDARDS.bloodPressure.systolic.normal.min}-${VITAL_SIGNS_STANDARDS.bloodPressure.systolic.normal.max}${VITAL_SIGNS_STANDARDS.bloodPressure.systolic.unit}`,
        };
      }
      return { inRange: true, status: 'normal', message: null };

    case 'bloodPressureDiastolic':
      if (numValue < VITAL_SIGNS_STANDARDS.bloodPressure.diastolic.normal.min || numValue > VITAL_SIGNS_STANDARDS.bloodPressure.diastolic.normal.max) {
        const isLow = numValue < VITAL_SIGNS_STANDARDS.bloodPressure.diastolic.normal.min;
        const isCritical = numValue < VITAL_SIGNS_STANDARDS.bloodPressure.diastolic.acceptable.min || numValue > VITAL_SIGNS_STANDARDS.bloodPressure.diastolic.acceptable.max;

        return {
          inRange: false,
          status: isCritical ? 'critical' : 'warning',
          message: `${isLow ? 'Low' : 'High'} diastolic BP: ${numValue}${VITAL_SIGNS_STANDARDS.bloodPressure.diastolic.unit}. Normal range: ${VITAL_SIGNS_STANDARDS.bloodPressure.diastolic.normal.min}-${VITAL_SIGNS_STANDARDS.bloodPressure.diastolic.normal.max}${VITAL_SIGNS_STANDARDS.bloodPressure.diastolic.unit}`,
        };
      }
      return { inRange: true, status: 'normal', message: null };

    case 'respirationRate':
      if (numValue < VITAL_SIGNS_STANDARDS.respirationRate.normal.min || numValue > VITAL_SIGNS_STANDARDS.respirationRate.normal.max) {
        const isLow = numValue < VITAL_SIGNS_STANDARDS.respirationRate.normal.min;
        const isCritical = numValue < VITAL_SIGNS_STANDARDS.respirationRate.acceptable.min || numValue > VITAL_SIGNS_STANDARDS.respirationRate.acceptable.max;

        return {
          inRange: false,
          status: isCritical ? 'critical' : 'warning',
          message: `${isLow ? 'Low' : 'High'} respiration rate: ${numValue}${VITAL_SIGNS_STANDARDS.respirationRate.unit}. Normal range: ${VITAL_SIGNS_STANDARDS.respirationRate.normal.min}-${VITAL_SIGNS_STANDARDS.respirationRate.normal.max}${VITAL_SIGNS_STANDARDS.respirationRate.unit}`,
        };
      }
      return { inRange: true, status: 'normal', message: null };

    case 'oxygenSaturation':
      if (numValue < VITAL_SIGNS_STANDARDS.oxygenSaturation.normal.min) {
        const isCritical = numValue < VITAL_SIGNS_STANDARDS.oxygenSaturation.acceptable.min;

        return {
          inRange: false,
          status: isCritical ? 'critical' : 'warning',
          message: `Low oxygen saturation: ${numValue}${VITAL_SIGNS_STANDARDS.oxygenSaturation.unit}. Normal range: ${VITAL_SIGNS_STANDARDS.oxygenSaturation.normal.min}-${VITAL_SIGNS_STANDARDS.oxygenSaturation.normal.max}${VITAL_SIGNS_STANDARDS.oxygenSaturation.unit}`,
        };
      }
      return { inRange: true, status: 'normal', message: null };

    default:
      return { inRange: true, status: 'normal', message: null };
  }
};

/**
 * Get all vital sign warnings for a vitals form
 * @param {Object} vitalsForm - The vitals form data
 * @returns {Array} - Array of warning messages
 */
export const getVitalSignsWarnings = (vitalsForm) => {
  const warnings = [];

  // Check temperature
  if (vitalsForm.temperature) {
    const tempCheck = checkVitalSignStandard('temperature', vitalsForm.temperature, vitalsForm.tempUnit);
    if (!tempCheck.inRange && tempCheck.message) {
      warnings.push(tempCheck);
    }
  }

  // Check heart rate
  if (vitalsForm.heartRate) {
    const hrCheck = checkVitalSignStandard('heartRate', vitalsForm.heartRate);
    if (!hrCheck.inRange && hrCheck.message) {
      warnings.push(hrCheck);
    }
  }

  // Check blood pressure
  if (vitalsForm.bloodPressureSystolic) {
    const systolicCheck = checkVitalSignStandard('bloodPressureSystolic', vitalsForm.bloodPressureSystolic);
    if (!systolicCheck.inRange && systolicCheck.message) {
      warnings.push(systolicCheck);
    }
  }
  if (vitalsForm.bloodPressureDiastolic) {
    const diastolicCheck = checkVitalSignStandard('bloodPressureDiastolic', vitalsForm.bloodPressureDiastolic);
    if (!diastolicCheck.inRange && diastolicCheck.message) {
      warnings.push(diastolicCheck);
    }
  }

  // Check respiration rate
  if (vitalsForm.respirationRate) {
    const respCheck = checkVitalSignStandard('respirationRate', vitalsForm.respirationRate);
    if (!respCheck.inRange && respCheck.message) {
      warnings.push(respCheck);
    }
  }

  // Check oxygen saturation
  if (vitalsForm.oxygenSaturation) {
    const o2Check = checkVitalSignStandard('oxygenSaturation', vitalsForm.oxygenSaturation);
    if (!o2Check.inRange && o2Check.message) {
      warnings.push(o2Check);
    }
  }

  return warnings;
};

// ==========================================
// Medication Standards & Formatting
// ==========================================

export const MED_FREQUENCY_MAP = {
  'OD': 'daily',
  'BD': 'twice daily',
  'TID': 'three times daily',
  'QID': 'four times daily',
  'PRN': 'as needed',
  'STAT': 'immediately',
  'AC': 'before meals',
  'PC': 'after meals',
  'HS': 'at bedtime',
  'BID': 'twice daily', // Alternative for BD
};

export const MED_ROUTE_MAP = {
  'PO': 'po',
  'ORAL': 'po',
  'IV': 'IV',
  'IM': 'IM',
  'SC': 'SC',
  'TOP': 'topical',
  'PR': 'PR',
  'PV': 'PV',
  'SL': 'SL',
  'INH': 'inhalation',
};

export const MED_FORM_MAP = {
  'TABLET': 'tab',
  'CAPSULE': 'cap',
  'SYRUP': 'ml',
  'INJECTION': 'inj',
  'VIAL': 'vial',
  'AMPOULE': 'vial',
  'CREAM': 'app',
  'OINTMENT': 'app',
  'DROPS': 'gtt',
  'SUSPENSION': 'ml',
  'INHALER': 'puffs',
  'GEL': 'app',
  'LOTION': 'app',
  'SPRAY': 'spray',
  'POWDER': 'powder',
  'SUPPOSITORY': 'supp',
  'INFUSION': 'infusion',
};

/**
 * Format medication name to professional Title Case and remove internal suffixes
 * @param {string} name - Medication name
 * @param {string} strength - Optional strength to check for redundancy
 * @returns {string} - Cleaned medication name
 */
export const formatMedicationName = (name, strength = '') => {
  if (!name) return 'Unknown Medication';

  // 1. Remove common suffixes in parentheses that look like internal metadata
  const metadataSuffixes = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'N/A', 'Vial', 'Ampoule', 'Cream', 'Ointment', 'Drops', 'Suspension', 'Inhaler', 'Gel', 'Lotion', 'Spray', 'Powder', 'Suppository'];
  let cleanName = name;

  metadataSuffixes.forEach(suffix => {
    const regex = new RegExp(`\\(${suffix}\\)`, 'gi');
    cleanName = cleanName.replace(regex, '');
  });

  // Remove "N/A" specifically if it's not in parentheses
  cleanName = cleanName.replace(/\bN\/A\b/gi, '');

  // If strength is already in the name, we'll return the name cleaned.
  // We'll handle the "N/A" check for strength in the component side, 
  // but here we just clean the name.

  // 2. Trim and handle multiple spaces
  cleanName = cleanName.replace(/\s+/g, ' ').trim();

  // 3. Convert to Title Case, but keep abbreviations
  const specialWords = ['mg', 'ml', 'iv', 'im', 'po', 'sc', 'sl', 'pr', 'pv', 'g', 'mcg'];

  return cleanName.split(' ').map(word => {
    const lowWord = word.toLowerCase().replace(/[^a-z]/g, '');
    if (specialWords.includes(lowWord)) {
      if (['iv', 'im', 'sc', 'sl', 'pr', 'pv'].includes(lowWord)) return word.toUpperCase();
      return word.toLowerCase();
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
};


/**
 * Format professional dosage instruction line
 * @param {Object} med - Medication order object
 * @returns {string} - Formatted instruction line
 */
export const formatMedicationInstruction = (med) => {
  if (!med) return '';

  const sig = (med.frequency || '').trim(); // Doctor uses frequency field for the Dose/SIG
  const form = (med.dosageForm || '').toUpperCase();
  const route = (med.route || '').toUpperCase();
  const freqCode = (med.frequencyPeriod || '').toUpperCase();
  const durationRaw = String(med.duration || '').trim();
  const durationPeriod = String(med.durationPeriod || '').trim();

  // 1. Get form abbreviation
  let formAbbr = MED_FORM_MAP[form] || form.toLowerCase() || '';
  // Fallback check if form is in the name but not in dosageForm field
  if (!formAbbr && med.name) {
    const nameUpper = med.name.toUpperCase();
    for (const [key, value] of Object.entries(MED_FORM_MAP)) {
      if (nameUpper.includes(key)) {
        formAbbr = value;
        break;
      }
    }
  }

  // 2. Get route abbreviation
  const routeAbbr = MED_ROUTE_MAP[route] || route.toLowerCase() || 'po';

  // 3. Get frequency in words
  const freqWords = MED_FREQUENCY_MAP[freqCode] || freqCode.toLowerCase() || '';

  // 4. Format duration
  let durationStr = '';
  if (durationRaw) {
    // If just a number, default to "days"
    if (/^\d+$/.test(durationRaw)) {
      durationStr = `${durationRaw} days`;
    } else {
      durationStr = durationRaw;
      if (durationPeriod && !durationStr.toLowerCase().includes(durationPeriod.toLowerCase())) {
        durationStr += ` ${durationPeriod}`;
      }
    }
  }

  // 5. Construct final line: {sig} {form_abbr} {route_abbr} {freqWords} for {durationStr}
  let line = `${sig} ${formAbbr} ${routeAbbr} ${freqWords}`.replace(/\s+/g, ' ').trim();
  if (durationStr) {
    line += ` for ${durationStr}`;
  }

  return line;
};

/**
 * Format professional instruction for Emergency Medications
 */
export const formatEmergencyInstruction = (med) => {
  if (!med) return { instruction: '', dispense: '', special: '' };

  const dosage = String(med.dosage || '').trim();
  const frequency = String(med.frequency || '').trim();
  const route = String(med.route || '').trim();
  const freqCode = String(med.frequencyPeriod || '').trim().toUpperCase();
  const durationRaw = String(med.duration || '').trim();
  const durationPeriod = String(med.durationPeriod || '').trim();
  const instructions = med.instructions ? String(med.instructions).trim() : '';

  const structuredParts = [];

  if (dosage) {
    structuredParts.push(`Dosage: ${dosage}`);
  }

  const freqWords = MED_FREQUENCY_MAP[freqCode] || freqCode.toLowerCase() || '';
  let frequencyText = frequency;
  if (freqWords) {
    if (frequencyText) {
      const lowerFrequency = frequencyText.toLowerCase();
      const lowerFreqWords = freqWords.toLowerCase();
      const lowerFreqCode = freqCode.toLowerCase();
      if (!lowerFrequency.includes(lowerFreqWords) && !lowerFrequency.includes(lowerFreqCode)) {
        frequencyText = `${frequencyText} ${freqWords}`.trim();
      }
    } else {
      frequencyText = freqWords;
    }
  }
  if (frequencyText) {
    structuredParts.push(`Frequency: ${frequencyText}`);
  }

  let durationText = durationRaw;
  if (durationText && durationPeriod && !durationText.toLowerCase().includes(durationPeriod.toLowerCase())) {
    durationText += ` ${durationPeriod}`;
  }
  if (durationText) {
    structuredParts.push(`Duration: ${durationText}`);
  }

  if (route) {
    structuredParts.push(`Route: ${route.toUpperCase()}`);
  }

  const mainLine = structuredParts.join(' • ');

  if (mainLine && instructions) {
    return {
      instruction: mainLine,
      dispense: '',
      special: `Instructions: ${instructions}`
    };
  }

  if (mainLine) {
    return {
      instruction: mainLine,
      dispense: '',
      special: ''
    };
  }

  return {
    instruction: instructions,
    dispense: '',
    special: ''
  };
};
