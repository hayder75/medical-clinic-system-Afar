// Note: Prisma client will be passed as parameter to avoid multiple instances

/**
 * Generate a unique visitUid with auto-expanding numeric suffix
 * Format: VISIT-YYMMDD-N
 *
 * Uses:
 * - Date (YYMMDD) for date-based grouping
 * - Numeric suffix starts at 001 and auto-expands beyond 999 (1000, 1001, ...)
 * - Retry-safe creation is handled by generateUniqueVisitUid on unique collisions
 * 
 * @param {Object} prisma - Prisma client instance
 * @returns {Promise<string>} A unique visitUid
 */
async function generateVisitUid(prisma) {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // Last 2 digits of year
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const dateStr = `${year}${month}${day}`; // YYMMDD

  const existingVisits = await prisma.visit.findMany({
    where: {
      visitUid: {
        startsWith: `VISIT-${dateStr}-`
      }
    },
    select: { visitUid: true }
  });

  let maxSuffix = 0;
  for (const row of existingVisits) {
    const parts = row.visitUid.split('-');
    if (parts.length !== 3 || parts[0] !== 'VISIT' || parts[1] !== dateStr) continue;
    const parsed = parseInt(parts[2], 10);
    if (Number.isInteger(parsed) && parsed > maxSuffix) {
      maxSuffix = parsed;
    }
  }

  const nextSuffix = maxSuffix + 1;
  const suffixStr = nextSuffix < 1000
    ? String(nextSuffix).padStart(3, '0')
    : String(nextSuffix);

  return `VISIT-${dateStr}-${suffixStr}`;
}

/**
 * Generate a unique visitUid with retry logic for database collision handling
 * This wraps the generation in retry logic in case of race conditions (multiple visits created simultaneously)
 * 
 * @param {Function} createFunction - Async function that creates the visit (should throw on P2002 error)
 * @param {Object} prisma - Prisma client instance
 * @param {number} maxRetries - Maximum number of retries (default: 10)
 * @returns {Promise<Object>} The created visit
 */
async function generateUniqueVisitUid(createFunction, prisma, maxRetries = 10) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const visitUid = await generateVisitUid(prisma);
      const result = await createFunction(visitUid);
      return result;
    } catch (error) {
      // If it's a unique constraint error on visitUid, retry with a new ID
      if (error.code === 'P2002' && error.meta?.target?.includes('visitUid')) {
        retries++;
        if (retries >= maxRetries) {
          throw new Error('Unable to generate unique visit ID after multiple attempts. Please try again.');
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
  generateVisitUid,
  generateUniqueVisitUid
};


