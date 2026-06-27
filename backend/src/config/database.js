const { PrismaClient } = require('@prisma/client');

// Get DATABASE_URL and add connection pooling parameters for Render
let databaseUrl = process.env.DATABASE_URL;

// Add connection pooling parameters if not already present
if (databaseUrl && !databaseUrl.includes('?') && process.env.NODE_ENV === 'production') {
  databaseUrl += '?pgbouncer=true&connect_timeout=10';
}

// Singleton Prisma client with connection handling
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});

// Lightweight WebSocket emission on Visit status changes
prisma.$use(async (params, next) => {
  const result = await next(params);
  if (params.model === 'Visit' && ['create', 'update', 'updateMany'].includes(params.action)) {
    try {
      const { emitQueueEvent } = require('./socket');
      const visit = params.action === 'create' ? result : result;
      if (visit?.status) {
        emitQueueEvent('queue:visit-update', {
          visitId: visit.id || params.args?.where?.id,
          status: visit.status,
          patientId: visit.patientId,
          timestamp: new Date().toISOString()
        });
      }
    } catch { }
  }
  return result;
});

module.exports = prisma;