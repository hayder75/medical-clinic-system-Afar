/**
 * Parse normal range strings and check if a value is within range
 * Supports formats like: "12-16", "<5.7", ">100", "12-16 (F), 14-18 (M)", etc.
 */

/**
 * Parse a normal range string into min and max values
 * @param {string} normalRange - Normal range string (e.g., "12-16", "<5.7", ">100")
 * @returns {Object} - { min: number | null, max: number | null, operator: string | null }
 */
export const parseNormalRange = (normalRange) => {
  if (!normalRange || typeof normalRange !== 'string') {
    return { min: null, max: null, operator: null };
  }

  const range = normalRange.trim();

  // Handle less than: "<5.7"
  if (range.startsWith('<')) {
    const value = parseFloat(range.substring(1).trim());
    if (!isNaN(value)) {
      return { min: null, max: value, operator: '<' };
    }
  }

  // Handle greater than: ">100"
  if (range.startsWith('>')) {
    const value = parseFloat(range.substring(1).trim());
    if (!isNaN(value)) {
      return { min: value, max: null, operator: '>' };
    }
  }

  // Handle less than or equal: "<=5.7"
  if (range.startsWith('<=')) {
    const value = parseFloat(range.substring(2).trim());
    if (!isNaN(value)) {
      return { min: null, max: value, operator: '<=' };
    }
  }

  // Handle greater than or equal: ">=100"
  if (range.startsWith('>=')) {
    const value = parseFloat(range.substring(2).trim());
    if (!isNaN(value)) {
      return { min: value, max: null, operator: '>=' };
    }
  }

  // Handle range: "12-16" or "12 - 16"
  const rangeMatch = range.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    if (!isNaN(min) && !isNaN(max)) {
      return { min, max, operator: 'range' };
    }
  }

  // Handle single value (treat as exact or approximate)
  const singleValue = parseFloat(range);
  if (!isNaN(singleValue)) {
    // If it's a single number, treat it as a target value with small tolerance
    return { min: singleValue * 0.95, max: singleValue * 1.05, operator: 'approx' };
  }

  // If we can't parse it, return null (no validation)
  return { min: null, max: null, operator: null };
};

/**
 * Check if a value is within the normal range
 * @param {number|string} value - The value to check
 * @param {string} normalRange - Normal range string (e.g., "12-16", "<5.7")
 * @returns {Object} - { inRange: boolean, isLow: boolean, isHigh: boolean, message: string }
 */
export const checkValueInNormalRange = (value, normalRange) => {
  // If no value or no normal range, consider it valid (optional field)
  if (value === null || value === undefined || value === '' || !normalRange) {
    return { inRange: true, isLow: false, isHigh: false, message: null };
  }

  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    // Non-numeric values (like "Positive", "Negative") are always valid
    return { inRange: true, isLow: false, isHigh: false, message: null };
  }

  const parsed = parseNormalRange(normalRange);

  // If we couldn't parse the range, consider it valid (no validation possible)
  if (parsed.min === null && parsed.max === null) {
    return { inRange: true, isLow: false, isHigh: false, message: null };
  }

  let inRange = true;
  let isLow = false;
  let isHigh = false;
  let message = null;

  switch (parsed.operator) {
    case '<':
      if (numValue >= parsed.max) {
        inRange = false;
        isHigh = true;
        message = `Above normal (Normal: <${parsed.max})`;
      }
      break;

    case '<=':
      if (numValue > parsed.max) {
        inRange = false;
        isHigh = true;
        message = `Above normal (Normal: ≤${parsed.max})`;
      }
      break;

    case '>':
      if (numValue <= parsed.min) {
        inRange = false;
        isLow = true;
        message = `Below normal (Normal: >${parsed.min})`;
      }
      break;

    case '>=':
      if (numValue < parsed.min) {
        inRange = false;
        isLow = true;
        message = `Below normal (Normal: ≥${parsed.min})`;
      }
      break;

    case 'range':
      if (numValue < parsed.min) {
        inRange = false;
        isLow = true;
        message = `Below normal (Normal: ${parsed.min}-${parsed.max})`;
      } else if (numValue > parsed.max) {
        inRange = false;
        isHigh = true;
        message = `Above normal (Normal: ${parsed.min}-${parsed.max})`;
      }
      break;

    case 'approx':
      if (numValue < parsed.min || numValue > parsed.max) {
        inRange = false;
        if (numValue < parsed.min) {
          isLow = true;
          message = `Below expected range`;
        } else {
          isHigh = true;
          message = `Above expected range`;
        }
      }
      break;

    default:
      // Unknown format, consider valid
      inRange = true;
  }

  return { inRange, isLow, isHigh, message };
};

