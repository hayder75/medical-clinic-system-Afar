# Today Changes - 2026-07-01

## Inventory/Warehouse Management System

### Summary
Added a full warehouse management system with a new `INVENTORY_MANAGER` role. Pharmacy users can now request stock from the warehouse. Inventory Manager approves, rejects, and delivers requests. Suppliers and Purchase Orders also supported.

---

### Phase 1: Database

#### Prisma Schema Changes (`backend/prisma/schema.prisma`)
- Added `INVENTORY_MANAGER` to `Role` enum
- New models: `WarehouseStock`, `StockRequest`, `StockRequestItem`, `StockMovement`, `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`
- New enums: `StockRequestStatus`, `MovementType`, `SupplierStatus`, `PurchaseOrderStatus`

#### Key Relationships
- `WarehouseStock` → `MedicationCatalog` (1:1)
- `StockRequest` → `User` (requestedBy, approvedBy) + `StockRequestItem[]`
- `StockRequestItem` → `MedicationCatalog`
- `StockMovement` → `MedicationCatalog` + `User`
- `Supplier` → `PurchaseOrder[]`
- `PurchaseOrder` → `Supplier` + `User` (orderedBy, receivedBy) + `PurchaseOrderItem[]`
- `PurchaseOrderItem` → `MedicationCatalog`

---

### Phase 2: Backend

#### New Controllers
1. **`warehouseController.js`**
   - `GET /api/warehouse/stock` — list warehouse stock
   - `PUT /api/warehouse/stock/:medicationCatalogId` — update stock quantity
   - `GET /api/warehouse/requests` — list stock requests (status filter)
   - `POST /api/warehouse/requests` — create stock request (pharmacy users)
   - `PUT /api/warehouse/requests/:id/approve` — approve request
   - `PUT /api/warehouse/requests/:id/reject` — reject request with note
   - `PUT /api/warehouse/requests/:id/deliver` — deliver (dec warehouse, inc pharmacy)
   - `GET /api/warehouse/movements` — stock movement audit trail

2. **`supplierController.js`**
   - CRUD: `GET/POST/PUT/DELETE /api/suppliers`

3. **`purchaseOrderController.js`**
   - `GET /api/purchase-orders` — list POs
   - `POST /api/purchase-orders` — create PO
   - `PUT /api/purchase-orders/:id/receive` — receive items (adds to warehouse stock)

#### Routes in `server.js`
- `/api/warehouse` → warehouse routes
- `/api/suppliers` → supplier routes
- `/api/purchase-orders` → purchase order routes

---

### Phase 3: Frontend — Sidebar & Routes

#### Layout.jsx
- Added `INVENTORY_MANAGER` case with sidebar items:
  - Warehouse, Warehouse Stock, Stock Requests, Suppliers, Purchase Orders, Stock Movements
- Added `Request Stock` to PHARMACIST/PHARMACY_BILLING_OFFICER sidebar

#### SystemView.jsx
- Added `INVENTORY_MANAGER` to `ROLES` array
- Added `ROLE_SIDEBAR_ITEMS['INVENTORY_MANAGER']` with all items
- Added `INVENTORY_MANAGER` color to `roleColors`
- Updated PHARMACIST/PHARMACY_BILLING_OFFICER sidebar items to include stock request

#### App.jsx
- Routes for INVENTORY_MANAGER pages under `/inventory/*`
- Pharmacy stock request route

---

### Phase 4: Inventory Manager Pages

1. **InventoryDashboard** — stats cards (total warehouse items, pending requests, low stock count, total suppliers), recent requests table
2. **WarehouseStock** — table of all warehouse stock items, edit quantity inline/modal, low stock indicators
3. **StockRequests** — tabbed view (Pending/Approved/Delivered/Rejected/All), approve/reject/deliver actions, deliver modal with quantity input
4. **SupplierList** — CRUD table, modal for create/edit, active/inactive toggle
5. **PurchaseOrders** — list POs with status badges, create PO modal, receive items modal
6. **StockMovements** — full audit trail table with filters (type, date range)

---

### Phase 5: Pharmacy Side

- Added "Request Stock" button to Pharmacy inventory page
- Request Stock modal: multi-select medications, enter quantities, submit
- Stock Requests tab on pharmacy dashboard showing request history + status

---

### Files Modified/Created

| File | Action |
|---|---|
| `backend/prisma/schema.prisma` | Modified — new models + role |
| `backend/src/controllers/warehouseController.js` | Created |
| `backend/src/controllers/supplierController.js` | Created |
| `backend/src/controllers/purchaseOrderController.js` | Created |
| `backend/src/routes/warehouse.js` | Created |
| `backend/src/routes/suppliers.js` | Created |
| `backend/src/routes/purchaseOrders.js` | Created |
| `backend/server.js` | Modified — mount routes |
| `frontend/src/components/common/Layout.jsx` | Modified — sidebar items |
| `frontend/src/pages/admin/SystemView.jsx` | Modified — sidebar config |
| `frontend/src/App.jsx` | Modified — routes |
| `frontend/src/pages/inventory/InventoryDashboard.jsx` | Created |
| `frontend/src/pages/inventory/WarehouseStock.jsx` | Created |
| `frontend/src/pages/inventory/StockRequests.jsx` | Created |
| `frontend/src/pages/inventory/SupplierList.jsx` | Created |
| `frontend/src/pages/inventory/PurchaseOrders.jsx` | Created |
| `frontend/src/pages/inventory/StockMovements.jsx` | Created |
| `frontend/src/components/inventory/DeliverModal.jsx` | Created |
| `frontend/src/pages/pharmacy/PharmacyStockRequests.jsx` | Created |

### Status
- All phases complete.
- Built and verified.
