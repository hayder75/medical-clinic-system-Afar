const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const tables = [
    'User', 'Service', 'Insurance', 'Patient', 'Visit', 'NurseServiceAssignment',
    'VitalSign', 'Appointment', 'Billing', 'BillPayment', 'BillingService',
    'PharmacyInvoice', 'PharmacyInvoiceItem', 'DispensedMedicine', 'MedicationOrder',
    'CompoundPrescription', 'CompoundIngredient', 'DispenseLog', 'LabOrder',
    'RadiologyOrder', 'NurseWalkInOrder', 'DoctorWalkInOrder', 'EmergencyDrugOrder',
    'MaterialNeedsOrder', 'MedicalHistory', 'File', 'DentalRecord', 'Tooth',
    'InvestigationType', 'Department', 'AuditLog', 'Inventory', 'MedicationCatalog',
    'Assignment', 'ContinuousInfusion', 'NurseAdministration', 'CardActivation',
    'CardProduct', 'BatchOrder', 'BatchOrderService', 'ExternalDiagnosticOrder',
    'LabResult', 'LabResultFile', 'RadiologyResult', 'RadiologyTemplate',
    'RadiologyResultFile', 'LabTestGroup', 'LabTest', 'LabTestResultField',
    'LabTestOrder', 'LabTestResult', 'LabTestResultFile', 'LabTestTemplate',
    'DetailedLabResult', 'DentalPhoto', 'DentalProcedureCompletion',
    'PatientAttachedImage', 'VirtualQueue', 'MedicalCertificate', 'DailyCashSession',
    'CashTransaction', 'BankDeposit', 'CashExpense', 'Loan', 'DiagnosisNotes',
    'PatientGallery', 'InsuranceTransaction', 'PatientAccount', 'AccountDeposit',
    'AccountTransaction', 'AccountRequest', 'SystemSettings', 'CustomMedication',
    'ClinicSetting', 'Referral', 'InternationalMedicalCertificate', 'Disease',
    'PatientDiagnosis', 'Bed', 'Admission', 'AdmissionService', 'PatientTransfer',
  ];

  const dump = {};

  for (const model of tables) {
    try {
      const data = await prisma[model].findMany();
      if (data.length > 0) {
        dump[model] = data;
        console.log(`  ✓ ${model}: ${data.length} rows`);
      } else {
        console.log(`  - ${model}: empty`);
      }
    } catch (err) {
      console.error(`  ✗ ${model}: ERROR - ${err.message}`);
    }
  }

  const outputPath = path.join(__dirname, 'seed-data.json');
  fs.writeFileSync(outputPath, JSON.stringify(dump, null, 2));
  console.log(`\n✅ Data dumped to ${outputPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
