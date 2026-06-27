/**
 * Generate a unique patient ID with sequential numbering
 * Format: PAT-YYYY-SEQ (e.g., PAT-2026-01, PAT-2026-02, ..., PAT-2026-100)
 * 
 * Uses:
 * - Full year (YYYY) for year-based grouping
 * - Sequential number starting from 01, incrementing for each patient in the same year
 * - Automatically handles 2-digit (01-99) and 3+ digit (100+) numbers
 * 
 * @param {Object} prisma - Prisma client instance
 * @param {boolean} isEmergency - Whether this is an emergency patient (uses TEMP prefix)
 * @returns {Promise<string>} A unique patient ID
 */
async function generatePatientId(prisma, isEmergency = false) {
  const now = new Date();
  const year = now.getFullYear().toString(); // Full year (2026)
  
  // Find the last patient created this year
  const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  
  const prefix = isEmergency ? `PAT-${year}-TEMP-` : `PAT-${year}-`;
  
  // Find all patients with this prefix created this year
  const patients = await prisma.patient.findMany({
    where: {
      createdAt: {
        gte: startOfYear,
        lte: endOfYear
      },
      id: {
        startsWith: prefix
      }
    },
    select: {
      id: true
    }
  });
  
  let seqNumber = 1;
  
  if (patients.length > 0) {
    // Extract all sequence numbers and find the maximum
    const seqNumbers = patients
      .map(patient => {
        const parts = patient.id.split('-');
        if (isEmergency && parts.length === 4 && parts[0] === 'PAT' && parts[1] === year && parts[2] === 'TEMP') {
          return parseInt(parts[3], 10);
        } else if (!isEmergency && parts.length === 3 && parts[0] === 'PAT' && parts[1] === year) {
          return parseInt(parts[2], 10);
        }
        return 0;
      })
      .filter(num => !isNaN(num) && num > 0);
    
    if (seqNumbers.length > 0) {
      seqNumber = Math.max(...seqNumbers) + 1;
    }
  }
  
  // Format sequence number (2 digits for 01-99, 3+ digits for 100+)
  // Don't pad beyond 2 digits - let it grow naturally (01, 02, ..., 99, 100, 101, ...)
  const seqStr = seqNumber < 100 ? seqNumber.toString().padStart(2, '0') : seqNumber.toString();
  
  // Combine: PAT-YYYY-SEQ or PAT-YYYY-TEMP-SEQ
  // Example: PAT-2026-01, PAT-2026-02, ..., PAT-2026-99, PAT-2026-100
  // Or: PAT-2026-TEMP-01, PAT-2026-TEMP-02, etc.
  return isEmergency ? `PAT-${year}-TEMP-${seqStr}` : `PAT-${year}-${seqStr}`;
}

/**
 * Generate a unique patient ID with retry logic for database collision handling
 * This wraps the generation in retry logic in case of race conditions (multiple patients created simultaneously)
 * 
 * @param {Function} createFunction - Async function that creates the patient (should throw on P2002 error)
 * @param {Object} prisma - Prisma client instance
 * @param {boolean} isEmergency - Whether this is an emergency patient
 * @param {number} maxRetries - Maximum number of retries (default: 10)
 * @returns {Promise<Object>} The created patient
 */
async function generateUniquePatientId(createFunction, prisma, isEmergency = false, maxRetries = 10) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const patientId = await generatePatientId(prisma, isEmergency);
      const result = await createFunction(patientId);
      return result;
    } catch (error) {
      // If it's a unique constraint error on id, retry with a new ID
      if (error.code === 'P2002' && error.meta?.target?.includes('id')) {
        retries++;
        if (retries >= maxRetries) {
          console.error('❌ Failed to generate unique patient ID after', maxRetries, 'attempts');
          throw new Error('Unable to generate unique patient ID after multiple attempts. Please try again.');
        }
        // Wait a tiny bit before retrying (allows time for other concurrent requests to complete)
        await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay
      } else {
        // Different error - throw it immediately
        throw error;
      }
    }
  }
}

module.exports = {
  generatePatientId,
  generateUniquePatientId
};
