const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // All tables with autoincrement integer IDs
  const tables = [
    'CardActivation',
    'Visit',
    'AuditLog',
    'VitalSign',
    'LabOrder',
    'RadiologyOrder',
    'MedicationOrder',
    'Appointment',
    'BatchOrder',
    'BatchOrderService',
    'MedicalHistory',
    'NurseWalkInOrder',
    'EmergencyDrugOrder',
    'MaterialNeedsOrder',
    'NurseServiceAssignment',
    'DentalRecord',
    'Inventory',
    'Department',
    'File',
    'DispenseLog',
    'InvestigationType',
    'Tooth',
    'DentalPhoto',
    'DentalProcedureCompletion',
    'LabResult',
    'RadiologyResult',
    'DetailedLabResult',
    'DispensedMedicine',
    'NurseAdministration',
    'VirtualQueue',
    'Admission',
    'AdmissionService',
  ];

  try {
    console.log('🔧 Fixing all autoincrement sequences...\n');

    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`
                    SELECT setval(
                        pg_get_serial_sequence('"${table}"', 'id'),
                        COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1,
                        false
                    );
                `);
        console.log(`  ✅ ${table} sequence fixed`);
      } catch (error) {
        // Table might not exist or might not have a sequence (UUID-based)
        console.log(`  ⏭️  ${table} - skipped (${error.message?.substring(0, 60) || 'no sequence'})`);
      }
    }

    console.log('\n✅ All sequences fixed successfully!');
  } catch (error) {
    console.error('Error resetting sequences:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
