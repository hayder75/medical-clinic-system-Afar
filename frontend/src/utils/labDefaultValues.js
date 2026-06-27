/**
 * Extract default values from lab test result fields based on normalRange and field type
 * This allows forms to be pre-filled with typical/average values
 * NOTE: Default values are disabled - technicians must manually enter all results
 */

import { parseNormalRange } from './normalRangeParser';

/**
 * Get default value for a lab test result field
 * @param {Object} field - LabTestResultField object with fieldType, normalRange, options, etc.
 * @returns {string|number|null} - Always returns null (no defaults)
 */
export const getDefaultValueForField = (field) => {
  // Default values are disabled - always return null
  // Technicians must manually enter all results
  return null;
};

/**
 * Generate default results object for a lab test based on its resultFields
 * @param {Array} resultFields - Array of LabTestResultField objects
 * @param {String} labTestCode - Optional lab test code to apply special rules
 * @returns {Object} - Object with fieldName as keys and default values as values
 */
export const generateDefaultResults = (resultFields, labTestCode = null) => {
  if (!resultFields || !Array.isArray(resultFields)) {
    return {};
  }

  // Fields that should NOT have default values for CBC
  const cbcAdditionalFields = ['mcv', 'mch', 'mchc'];
  
  const defaults = {};
  resultFields.forEach(field => {
    // Skip CBC additional fields (MCV, MCH, MCHC) - they should be empty by default
    if (labTestCode === 'CBC001' && cbcAdditionalFields.includes(field.fieldName)) {
      return; // Don't set default values for these fields
    }
    
    const defaultValue = getDefaultValueForField(field);
    if (defaultValue !== null && defaultValue !== undefined) {
      defaults[field.fieldName] = defaultValue;
    }
  });

  return defaults;
};


