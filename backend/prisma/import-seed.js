const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Must be in dependency order: parents before children
const MODELS_IN_ORDER = [
  'CardProduct', 'ClinicSetting', 'Department', 'Disease', 'Insurance',
  'LabTestGroup', 'LabTestTemplate', 'MedicationCatalog', 'Service', 'SystemSettings', 'Tooth',
  'User',
  'Patient',
  'Visit',
  'Appointment', 'Assignment', 'AuditLog', 'CustomMedication', 'DailyCashSession',
  'InvestigationType', 'LabTest',
  'Billing', 'BillingService', 'BillPayment',
  'BankDeposit', 'CashExpense', 'CashTransaction', 'Loan',
  'CardActivation',
  'ContinuousInfusion', 'DispenseLog', 'EmergencyDrugOrder',
  'MedicationOrder', 'NurseAdministration',
  'PharmacyInvoice', 'PharmacyInvoiceItem', 'DispensedMedicine',
  'CompoundPrescription', 'CompoundIngredient',
  'BatchOrder', 'BatchOrderService', 'DetailedLabResult',
  'LabOrder', 'LabResult', 'LabResultFile',
  'LabTestOrder', 'LabTestResult', 'LabTestResultFile', 'LabTestResultField',
  'RadiologyOrder', 'RadiologyResult', 'RadiologyResultFile', 'RadiologyTemplate',
  'DentalPhoto', 'DentalProcedureCompletion', 'DentalRecord',
  'DoctorWalkInOrder', 'NurseServiceAssignment', 'NurseWalkInOrder',
  'MaterialNeedsOrder',
  'DiagnosisNotes', 'ExternalDiagnosticOrder', 'File', 'Inventory',
  'MedicalCertificate', 'InternationalMedicalCertificate',
  'MedicalHistory',
  'PatientAttachedImage', 'PatientDiagnosis', 'PatientGallery', 'PatientTransfer',
  'Referral', 'VirtualQueue',
  'InsuranceTransaction', 'PatientAccount',
  'AccountDeposit', 'AccountTransaction', 'AccountRequest',
  'Admission', 'AdmissionService', 'Bed',
  'VitalSign',
];

async function main() {
  const seedPath = process.argv[2] || path.join(__dirname, 'seed-data.json');
  if (!fs.existsSync(seedPath)) {
    console.error(`File not found: ${seedPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  console.log(`Loaded ${Object.keys(data).length} tables from seed-data.json`);

  for (const model of MODELS_IN_ORDER) {
    const rows = data[model];
    if (!rows || rows.length === 0) continue;

    process.stdout.write(`Importing ${model} (${rows.length} rows)...`);
    try {
      await prisma[model].createMany({ data: rows, skipDuplicates: true });
      console.log(` OK`);
    } catch (err) {
      console.error(` FAILED - ${err.message}`);
    }
  }

  console.log('\n Seed import complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
