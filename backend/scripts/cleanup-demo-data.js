const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  console.log('🧹 Cleaning up all patient/visit/billing test data...\n');

  // TRUNCATE CASCADE handles all FK dependencies automatically
  const tables = [
    'BatchOrderService', 'BatchOrder', 'BillingService', 'BillPayment',
    'CashTransaction', 'AccountTransaction', 'CardActivation',
    'LabTestResultFile', 'LabTestResult', 'LabTestOrder',
    'LabResultFile', 'LabResult', 'LabOrder',
    'MedicationOrder', 'MaterialNeedsOrder', 'NurseServiceAssignment',
    'PatientAttachedImage', 'PatientGallery', 'PatientAccount',
    'PatientDiagnosis', 'PatientTransfer',
    'FamilyPlanningVisit', 'FamilyPlanningRecord', 'AbortionCareRecord',
    'DiagnosisNotes', 'MedicalHistory', 'MedicalCertificate',
    'DentalPhoto', 'DentalProcedureCompletion', 'DentalRecord',
    'EmergencyDrugOrder', 'InsuranceTransaction',
    'NurseAdministration', 'ContinuousInfusion',
    'VitalSign', 'Appointment', 'Billing', 'Visit',
    'Referral', 'Admission', 'AdmissionService',
    'PregnancyRecord', 'GrowthMeasurement', 'VaccinationRecord',
    'DevelopmentMilestone', 'ChronicDiseaseRecord', 'SurgicalNote',
    'BodyChartRecord', 'ExercisePrescription', 'OutcomeScore',
    'AuditLog', 'Patient'
  ];

  // Wrap all truncates in a single transaction with CASCADE
  try {
    const tableList = tables.map(t => `"${t}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE ${tableList} CASCADE`);
    console.log('  ✅ All tables truncated successfully');
  } catch (err) {
    console.log(`  ❌ TRUNCATE failed: ${err.message.slice(0, 200)}`);
    // Fallback: try one by one
    console.log('  Trying individual deletes...');
    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
        console.log(`  ✅ ${table}: cleaned`);
      } catch (err2) {
        console.log(`  ❌ ${table}: ${err2.message.slice(0, 100)}`);
      }
    }
  }

  console.log('\n✨ Cleanup complete!');
}

cleanup()
  .catch(err => { console.error('Cleanup failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
