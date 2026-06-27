// This seed file is kept for Prisma compatibility but should not be used
// All data is imported from server-database-export.sql
// To seed the database, use: psql -h localhost -U postgres -d medical_clinic_system -f ../server-database-export.sql

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('⚠️  This seed file is not used.');
  console.log('📥 To import server data, run:');
  console.log('   psql -h localhost -U postgres -d medical_clinic_system -f ../server-database-export.sql');
  console.log('');
  console.log('✅ All data should be imported from server-database-export.sql');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
