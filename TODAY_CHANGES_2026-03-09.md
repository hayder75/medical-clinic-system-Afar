# Today Changes - 2026-03-09

## Backend

### Reporting and Labels
- Updated report service labels from `General` to `Medical` where applicable:
  - `CARD_CREATED_GENERAL` -> `Medical Card Created`
  - `CARD_REACTIVATION_GENERAL` -> `Medical Card Reactivation`
  - `CONSULTATION_GENERAL` -> `Consultation (Medical)`
- Files:
  - `backend/src/controllers/adminController.js`
  - `backend/src/controllers/cashManagementController.js`

### Admin Doctor Report Enhancements
- Added card usage aggregation by payment date (not service line creation date), split by Medical/Dermatology:
  - cards opened
  - card activations
- Added dermatologist-tagged medical treated counter in summary:
  - `summary.medicalTreatedByDermatology`
- File:
  - `backend/src/controllers/adminController.js`

### Dermatology Medical-Treated Tracking
- Added support for optional flag on direct completion:
  - request field: `countAsMedicalTreated`
- For dermatology doctor completion with this flag, creates audit marker:
  - action: `DERM_MEDICAL_TREATED_MARK`
  - entity: `Visit`
- File:
  - `backend/src/controllers/doctorController.js`

### Procedure/Nurse Tasks Visibility Fix
- Nurse daily tasks now include assigned pending/in-progress nurse service tasks even if billing is pending/partial.
- Removed strict same-day `createdAt` filter for nurse service tasks so still-pending assignments are visible.
- Preserved billing/payment indicators in payload.
- File:
  - `backend/src/controllers/nurseController.js`

### Existing Patient Wording
- Changed default note text:
  - `Returning patient visit` -> `Repeat patient visit`
- File:
  - `backend/src/controllers/billingController.js`

### Lab Billing Fallback Robustness
- For lab tests missing linked service, creates/reuses fallback LAB service and links billing safely.
- File:
  - `backend/src/controllers/batchOrderController.js`

## Frontend

### Patient/Reception Naming Updates
- `Returning Patient` -> `Repeat Patient`
- `General Card` -> `Medical Card` (display label only; enum value remains `GENERAL`)
- Files:
  - `frontend/src/pages/patient/PatientRegistration.jsx`
  - `frontend/src/pages/reception/ReceptionPatientRegistration.jsx`
  - `frontend/src/pages/reception/PatientManagement.jsx`

### Admin Reports (Doctors Tab)
- Added clearer doctor cards:
  - Medical Cards Opened
  - Medical Card Activations
  - Dermatology Cards Opened
  - Dermatology Card Activations
  - Medical Treated (Dermatology)
- File:
  - `frontend/src/components/admin/Reports.jsx`

### Doctor Completion UX
- Dermatology-only completion option to count patient as Medical treated:
  - in unified completion modal (checkbox)
  - in patient queue flow (confirm)
- Files:
  - `frontend/src/components/doctor/UnifiedQueueComplete.jsx`
  - `frontend/src/components/doctor/PatientQueue.jsx`

### Procedure Orders UI Fix
- Fixed Current Procedure Orders display/count logic to match flattened data.
- Now shows proper count, service rows, statuses, and assignment details.
- File:
  - `frontend/src/components/doctor/ProcedureOrdering.jsx`

### Print Layout Alignment
- Updated compound print-all layout to A6 prescription style (matching normal prescription format).
- File:
  - `frontend/src/components/doctor/CompoundPrescriptionBuilder.jsx`

## Database/Schema Ops Performed Today

### Prisma Client/Schema Sync
- Ran in `backend/`:
  - `npm run generate`
  - `npx prisma db push`

### Explicit DB Patch Applied
- Executed SQL to guarantee compound prescription text columns exist:
  - `ALTER TABLE "CompoundPrescription" ADD COLUMN IF NOT EXISTS "prescriptionText" TEXT, ADD COLUMN IF NOT EXISTS "rawText" TEXT;`
- Executed via:
  - `npx prisma db execute --file /tmp/fix_compound_columns.sql --schema prisma/schema.prisma`

### Note for Server Update
- Ensure server DB has the same `CompoundPrescription` columns before deploying backend:
  - `prescriptionText`
  - `rawText`
- Regenerate Prisma client on server after schema sync.
