# System Clean Slate Setup Guide (Gold Master)

This guide explains how to use the generated `gold_master_system_dump.sql` to set up a clean version of the medical system for a new client.

## Included Data
- **All Lab Templates** (Tests, Groups, Fields)
- **Radiology Templates**
- **Service Catalog** (Pricing, Categories)
- **Medication Master List** (MedicationCatalog)
- **Department & Investigation Types**
- **Bed Management Setup**
- **Staff/User Accounts** (Roles and Permissions)
- **System Settings**
- **Teeth/Dental Database Structure**

## Excluded Data (Clean Slate)
- **Patients** & All Clinical Files
- **Visits**, Vitals, and History
- **Billing Records**, Invoices, and Payments
- **Lab & Radiology Orders**
- **Pharmacy Sales** & Dispensed Records
- **Audit Logs**
- **Current Inventory Stock Counts**
- **Admissions**

---

## How to Set Up for a New Client

### 1. Database Creation
Create a new PostgreSQL database on the new server:
```bash
createdb -U postgres new_clinic_db
```

### 2. Restore the System Configuration
Run the following command to import the "Gold Master" dump into the new database:
```bash
psql -U postgres -d new_clinic_db -f gold_master_system_dump.sql
```

### 3. Update Backend Environment
Update the `.env` file in the backend folder to point to the new database:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/new_clinic_db"
```

### 4. Run Prisma Sync
To ensure the Prisma Client is ready, run:
```bash
npx prisma generate
```

### 5. Start the System
```bash
# In Backend
npm start

# In Frontend
npm run dev
```

---
Generated on: 2026-02-09
Medical Clinic System - Gold Master Series
