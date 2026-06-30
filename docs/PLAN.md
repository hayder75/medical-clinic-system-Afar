# Today's Plan — 4 Issues

## Phases
| Phase | Issue | Status |
|-------|-------|--------|
| 1 | Remove Differential Payment from Procedure Module | Pending |
| 2 | Printout Address — "Hawassa" → "Awash 7 Kilo" | Pending |
| 3 | Radiology Commission Module | Pending |
| 4 | Continuous Vital Signs in Bed & Admission Modules | Pending |

**Workflow:** Code locally → Test on `localhost:3000` / `localhost:3002` → Push to GitHub → Deploy to server only when user says.

---

## Phase 1: Remove Differential Payment from Procedure Module
**Goal:** Hide the "Convert remaining to patient debt" card in the Billing Queue UI.

### What to do
- `frontend/src/components/billing/BillingQueue.jsx` — comment out / remove the differential payment card (lines ~1122-1201)
- That's it. No backend changes. Hide only the card.

### Files affected
- `frontend/src/components/billing/BillingQueue.jsx`

---

## Phase 2: Printout Address — "Hawassa" → "Awash 7 Kilo"
**Goal:** Replace all hardcoded "Hawassa" addresses in print templates with "Awash 7 Kilo".

### What to do
Find and replace "Hawassa" with "Awash 7 Kilo" in these locations:

| File | Lines | Current Text |
|------|-------|-------------|
| `frontend/src/pages/admin/DiseaseReports.jsx` | 415, 418 | `Zone: Hawassa`, `Woreda: Hawassa` |
| `frontend/src/pages/admin/DiseaseReports.jsx` | 654, 658 | `Zone: Hawassa`, `Woreda: Hawassa` |
| `frontend/src/pages/doctor/InternationalMedicalCertificatePage.jsx` | 514 | Full street address containing "Hawassa" |

### Files affected
- `frontend/src/pages/admin/DiseaseReports.jsx`
- `frontend/src/pages/doctor/InternationalMedicalCertificatePage.jsx`

---

## Phase 3: Radiology Commission Module
**Goal:** Add commission for radiologists (role `RADIOLOGIST`) — configurable percentage per radiologist, shown on a radiologist Daily Work page.

### What we agreed
- Doctor Commission module stays untouched
- Radiologist is the person **doing** the radiology work, not the one ordering it
- Commission is a simple percentage per radiologist
- Radiologist Daily Work shows ALL completed work regardless of commission
- Commission column/card only appears when percentage > 0%
- Formula: `commission = radiology service price × radiologistCommission.percentage / 100`
- Example: Radiologist has 50% share, did 10,000 birr of work → shows 5,000 commission

### Sub-tasks

#### 3a. Database — New Model
- Add `RadiologistCommission` model to `backend/prisma/schema.prisma`:
  ```
  model RadiologistCommission {
    id            String   @id @default(uuid())
    radiologistId String   @unique
    percentage    Float    @default(0)
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt
    radiologist   User     @relation(fields: [radiologistId], references: [id])
  }
  ```
- Run `npx prisma migrate dev` to create migration

#### 3b. Backend — Commission API
- Add GET/PUT routes for radiologist commissions (admin only):
  - `GET /admin/radiologist-commissions` — list all radiologists with their commission %
  - `PUT /admin/radiologist-commissions/:radiologistId` — upsert commission %
- Add radiologist daily-work endpoint:
  - `GET /radiologists/daily-work/day-details?date=YYYY-MM-DD` — returns completed radiology orders for that radiologist with per-order price and calculated commission
  - `GET /radiologists/daily-work/monthly?year=2026&month=5` — monthly summary with commission totals

#### 3c. Frontend — Admin Commission Page
- Rename sidebar "Doctor Commissions" → "Commission Management" in `Layout.jsx`
- Update `DoctorCommissionManager.jsx` — add two tabs: **Doctors** (existing) and **Radiologists** (new)
- Radiologists tab: list all `RADIOLOGIST` users, show percentage input per radiologist, save button

#### 3d. Frontend — Radiologist Daily Work
- Create new page `frontend/src/pages/radiology/RadiologistDailyWork.jsx` (mirror `DoctorDailyWork.jsx` pattern)
- Monthly calendar view + day detail view
- Per-order display: service name, price, status, date
- If commission > 0%: show "Your Share: ETB X,XXX" card and per-order commission badges
- If commission = 0%: show work only, no commission UI
- Add sidebar link to Layout.jsx for `RADIOLOGIST` role → "Daily Work" → `/radiology/daily-work`

#### 3e. Backend — Admin Commission Reports
- Add filterable report endpoint for admin (by radiologist, date range, service)
- Or add to existing Admin Radiology Reports page

### Files affected
- `backend/prisma/schema.prisma` — new model
- `backend/src/routes/admin.js` — new commission routes
- `backend/src/controllers/adminController.js` — commission CRUD
- `backend/src/routes/radiologies.js` — new daily-work routes
- `backend/src/controllers/radiologyController.js` — daily-work logic + commission calc
- `frontend/src/pages/admin/DoctorCommissionManager.jsx` — add radiologists tab
- `frontend/src/pages/radiology/RadiologistDailyWork.jsx` — new file
- `frontend/src/components/common/Layout.jsx` — rename sidebar, add radiologist daily-work link
- `frontend/src/App.jsx` — route for `/radiology/daily-work`

---

## Phase 4: Continuous Vital Signs in Bed & Admission Modules
**Goal:** Show latest continuous vitals for admitted patients inside the Bed Management / Admission Management modules, with auto-refresh.

### What we agreed
- Latest continuous vitals per patient visible in `AdmissionManagement.jsx`
- Auto-refresh every ~30 seconds (or WebSocket if available)
- Add guard on individual `completeVisit` to prevent completing visit if patient has active admission
- Admission closure flow: a page/button to send remaining charges to billing then discharge

### Sub-tasks

#### 4a. Backend — Add guard on completeVisit
- In `doctorController.js`:
  - `completeVisit` (line ~6098) — check if patient has active `ADMITTED` admission → reject with message
  - `directCompleteVisit` (line ~6762) — same check
- Bulkd complete already has this guard

#### 4b. Backend — Endpoint for latest vitals per patient
- Already exists: `GET /nurses/patient-vitals/:patientId` returns all vitals for a patient (including continuous)
- Or create a simpler endpoint: `GET /accommodation/admissions/:id/vitals` — returns latest continuous vitals for the admitted patient

#### 4c. Frontend — Show vitals in AdmissionManagement
- In `AdmissionManagement.jsx`:
  - Fetch latest continuous vitals per admitted patient
  - Show BP, temp, HR, O2, GCS, etc. in a compact card/row alongside patient info
  - Auto-refresh every 30 seconds (polling)

#### 4d. Frontend — Admission closure page
- Add a "Close Admission & Send to Billing" button in `AdmissionManagement.jsx`
- On click: calculate remaining bed charges + outstanding services → create billing record → discharge patient → redirect
- Or create a dedicated billing page for admission closure

### Files affected
- `backend/src/controllers/doctorController.js` — add guards
- `backend/src/controllers/accommodationController.js` — maybe new endpoint
- `frontend/src/pages/accommodation/AdmissionManagement.jsx` — show vitals, add close button
- `frontend/src/components/doctor/AccommodationTab.jsx` — maybe show vitals here too

---

## Progress Log
| Date | Phase | Status | Notes |
|------|-------|--------|-------|
| 2026-06-30 | 1 | ✅ Done | Removed differential payment card in BillingQueue.jsx |
| 2026-06-30 | 2 | ✅ Done | Replaced "Hawassa" → "Awash 7 Kilo" in DiseaseReports.jsx & InternationalMedicalCertificatePage.jsx. Also replaced "Sidama Region" → "Addis Ababa" |
| 2026-06-30 | 3 | ✅ Done | Added RadiologistCommission model + Prisma push; Admin GET/PUT routes for radiologist commissions; Radiologist daily-work backend (monthly + day-details); Created RadiologistsTab in CommissionManager; Created RadiologistDailyWork.jsx page; Added sidebar "Daily Work" link for RADIOLOGIST |
| 2026-06-30 | 4 | ✅ Done | Guard on completeVisit/directCompleteVisit for active admissions; Latest continuous vitals shown in AdmissionManagement.jsx with 30s auto-refresh |
