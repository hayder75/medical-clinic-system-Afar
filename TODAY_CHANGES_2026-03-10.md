# Today Changes - 2026-03-10

## Dermatology Medical-Treated Flow

### Problem fixed
- Active doctor flow completes visits from `PatientConsultationPage.jsx` via `/doctors/complete`.
- Previously, `countAsMedicalTreated` logic existed on `/doctors/direct-complete` only, so checkbox counting did not apply in the main consultation completion path.

### Backend updates
- File: `backend/src/controllers/doctorController.js`
- Added `countAsMedicalTreated` to `completeVisitSchema`.
- Updated `completeVisit` to:
  - detect dermatology doctor by role/qualification,
  - create `AuditLog` marker `DERM_MEDICAL_TREATED_MARK` for the visit when checkbox is set,
  - de-duplicate mark per doctor+visit.

### Frontend updates
- File: `frontend/src/pages/doctor/PatientConsultationPage.jsx`
- Added dermatology detection.
- Added checkbox in the first confirmation popup:
  - `Count this patient as Medical treated?`
- Passed flag in completion payload to backend:
  - `countAsMedicalTreated`.

### Admin report daily visibility
- Backend file: `backend/src/controllers/adminController.js`
  - `getDermatologyMedicalTreatedCount` now supports optional doctorId filter list.
  - `getDoctorPerformanceStats` now filters medical-treated count by selected doctors in scope.
  - `getDoctorDailyBreakdown` now returns per-day `medicalTreatedByDermatology` for selected doctor.
  - `getDoctorDayProcedureDetails` summary now includes day-level `medicalTreatedByDermatology`.
- Frontend file: `frontend/src/components/admin/Reports.jsx`
  - Added a selected-day tile in doctor day details:
    - `Medical Treated (Dermatology)`.

## Server-Only Hotfixes (Already Applied)

### Keep out of next local deploy batch
- CBC template update was applied directly on server DB (code `CBC001`) and verified.
- Card pricing hardcode fix was applied directly on server controllers and DB values were corrected.
- These are intentionally server-side hotfixes for active hospital hours; skip re-applying during the next local->server sync.

## Schema / DB change tracking
- No Prisma schema model changes today.
- No migration file generated today.

## Queue And Order-ID Hotfixes

### Problem fixed
- Unpaid walk-in lab/radiology orders were still visible in processing queues.
- Lab queue could show duplicate/empty walk-in cards when legacy `labOrder` rows overlapped with new `labTestOrder` groups.
- Walk-in order labels were showing long internal IDs instead of short operational IDs.

### Backend updates
- File: `backend/src/controllers/labController.js`
  - `getOrders` now honors `status` query (`PENDING`, `COMPLETED`, `ALL`) with processable status lists.
  - Filters walk-in legacy `labOrder` rows to paid billing only and excludes records without test type.
  - Filters walk-in `labTestOrder` rows to paid billing only.
  - Keeps emergency unpaid batch lab orders visible only where intended.
- File: `backend/src/controllers/radiologyController.js`
  - `getOrders` now filters walk-in radiology orders to paid billing only.

### Frontend updates
- File: `frontend/src/pages/lab/LabOrders.jsx`
  - Added short display ID formatter: `YYYYMMDD-XXX`.
  - Dedupes legacy walk-in cards when corresponding grouped `labTestOrder` walk-in group exists.
  - Suppresses empty grouped lab cards (no valid tests).
  - Uses short display IDs in queue cards, modal header, and print metadata.
- File: `frontend/src/components/radiology/RadiologyOrders.jsx`
  - Added short display ID formatter: `YYYYMMDD-XXX`.
  - Uses short display IDs in queue cards, modal detail, and print metadata.

### Reporting reliability update
- File: `backend/src/controllers/adminController.js`
  - Expanded doctor report qualification matching list to include common dermatology/health-officer naming variants so dermatology-scoped metrics are less likely to be omitted by qualification label mismatch.

### Deployment note
- Server restart is required for backend controller changes.
- Frontend rebuild/redeploy is required for queue display and de-duplication changes.
