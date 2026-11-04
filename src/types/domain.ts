/**
 * eTinda Core Domain & Synchronization Types
 * Aligned with AGENTS.md Sections 6, 7, 8, 9, 10, 11, and 12.
 * All monetary amounts are represented in integer centavos (e.g., ₱15.50 = 1550).
 */

export type UserRole = "ADMIN" | "HELPER";

export type RecordSyncStatus =
  | "PENDING"
  | "SYNCING"
  | "SYNCED"
  | "FAILED"
  | "CONFLICT";

export type GlobalSyncState =
  | "ONLINE_SYNCED"
  | "OFFLINE"
  | "PENDING_SYNC"
  | "SYNCING"
  | "SYNC_FAILED"
  | "CONFLICT_REQUIRED";

export type InventoryMovementType =
  | "SALE_DEDUCTION"
  | "PURCHASE_RECEIPT"
  | "STOCK_ADDITION"
  | "STOCK_DEDUCTION"
  | "STOCK_ADJUSTMENT"
  | "SALE_VOID_REVERSAL";

export type UtangLedgerEntryType = "CHARGE" | "PAYMENT" | "ADJUSTMENT";

export type PaymentMethod = "CASH" | "UTANG" | "PARTIAL_CASH_UTANG";

export type SaleTransactionStatus = "COMPLETED" | "VOIDED";

export type SyncEventType =
  | "SALE_CREATED"
  | "SALE_VOIDED"
  | "PRODUCT_UPSERTED"
  | "CATEGORY_UPSERTED"
  | "INVENTORY_MOVEMENT_RECORDED"
  | "PURCHASE_RECORDED"
  | "CUSTOMER_UPSERTED"
  | "UTANG_LEDGER_RECORDED"
  | "DEVICE_STATUS_UPDATED";

export interface SyncEvent<TPayload = unknown> {
  eventId: string;
  storeId: string;
  deviceId: string;
  userId: string;
  eventType: SyncEventType;
  entityId: string;
  schemaVersion: number;
  createdAt: string;
  payload: TPayload;
  /** Local outbox tracking metadata */
  status: RecordSyncStatus;
  retryCount: number;
  lastError?: string;
  conflictReason?: string;
  acknowledgedAt?: string;
}

export interface SyncMetadataRecord {
  key: string;
  value: string;
  updatedAt: string;
}

export interface StoreEntity {
  id: string;
  name: string;
  address: string;
  contactNumber: string;
  createdAt: string;
}

export interface UserEntity {
  id: string;
  storeId: string;
  name: string;
  email: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface DeviceEntity {
  id: string;
  storeId: string;
  deviceName: string;
  deviceType: "MOBILE" | "TABLET" | "DESKTOP";
  registeredByUserId: string;
  isAuthorized: boolean;
  revokedAt?: string;
  lastSyncAt?: string;
  downloadCursor: number;
  createdAt: string;
}

export interface CategoryEntity {
  id: string;
  storeId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  syncStatus: RecordSyncStatus;
  updatedAt: string;
}

export interface ProductVariantEntity {
  id: string;
  storeId: string;
  productId: string;
  name: string; // e.g., "Single Piece", "Half-Dozen Tie (6 pcs)", "1 Box (24 pcs)"
  unitLabel: string; // e.g., "pc", "tie", "box", "kg", "pack"
  conversionMultiplier: number; // Multiplier in base product units (e.g., 1 tie = 6 base pcs)
  sellingPriceCentavos: number;
  barcodeOrSku?: string;
  allowDecimalQuantity: boolean;
  isActive: boolean;
  syncStatus: RecordSyncStatus;
  updatedAt: string;
}

export interface ProductEntity {
  id: string;
  storeId: string;
  categoryId: string;
  name: string;
  baseUnit: string; // e.g., "pc", "kg", "pack", "sachet", "bottle"
  sellingPriceCentavos: number; // Base unit selling price in centavos
  latestCostCentavos: number; // Historical/current cost snapshot in centavos
  lowStockThreshold: number;
  allowDecimalQuantity: boolean;
  isFrequent: boolean; // Pinned for quick access in POS
  isActive: boolean;
  /**
   * Cached stock in base units. Authoritative stock is the sum of InventoryMovementEntity records,
   * updated atomically inside IndexedDB/PostgreSQL transactions.
   */
  cachedStock: number;
  hasOversellConflict?: boolean;
  syncStatus: RecordSyncStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovementEntity {
  id: string;
  storeId: string;
  productId: string;
  productNameSnapshot: string;
  variantId?: string;
  movementType: InventoryMovementType;
  /** Signed quantity change in base units (+ for additions/receipts/reversals, - for sales/deductions) */
  quantityChange: number;
  unitCostCentavos?: number;
  reasonOrNotes: string;
  deviceId: string;
  userId: string;
  userNameSnapshot: string;
  referenceId?: string; // Sale ID or Purchase ID
  syncStatus: RecordSyncStatus;
  conflictNote?: string;
  createdAt: string;
}

export interface PurchaseRecordEntity {
  id: string;
  storeId: string;
  supplierName: string;
  referenceNote?: string;
  totalCostCentavos: number;
  deviceId: string;
  userId: string;
  userNameSnapshot: string;
  syncStatus: RecordSyncStatus;
  createdAt: string;
}

export interface PurchaseItemEntity {
  id: string;
  purchaseRecordId: string;
  storeId: string;
  productId: string;
  productNameSnapshot: string;
  quantityAdded: number;
  unitCostCentavos: number;
  subtotalCostCentavos: number;
}

export interface SaleEntity {
  id: string;
  storeId: string;
  receiptNumber: string;
  status: SaleTransactionStatus;
  paymentMethod: PaymentMethod;
  subtotalCentavos: number;
  totalCentavos: number;
  cashTenderedCentavos: number;
  changeGivenCentavos: number;
  utangChargedCentavos: number;
  customerId?: string;
  customerNameSnapshot?: string;
  deviceId: string;
  userId: string;
  userNameSnapshot: string;
  voidedAt?: string;
  voidReason?: string;
  voidedByUserId?: string;
  syncStatus: RecordSyncStatus;
  conflictReason?: string;
  createdAt: string;
}

export interface SaleItemEntity {
  id: string;
  saleId: string;
  storeId: string;
  productId: string;
  variantId?: string;
  productNameSnapshot: string;
  unitLabelSnapshot: string;
  quantity: number;
  baseUnitMultiplier: number; // Base units deducted = quantity * baseUnitMultiplier
  unitSellingPriceCentavos: number;
  unitCostSnapshotCentavos: number;
  subtotalCentavos: number;
}

export interface PaymentEntity {
  id: string;
  storeId: string;
  saleId?: string;
  customerId?: string;
  customerNameSnapshot?: string;
  amountCentavos: number;
  paymentType: "SALE_CASH" | "UTANG_PAYMENT";
  notes?: string;
  deviceId: string;
  userId: string;
  userNameSnapshot: string;
  syncStatus: RecordSyncStatus;
  createdAt: string;
}

export interface CustomerEntity {
  id: string;
  storeId: string;
  name: string;
  contactNumber: string;
  syncStatus: RecordSyncStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UtangAccountEntity {
  id: string;
  storeId: string;
  customerId: string;
  customerNameSnapshot: string;
  contactNumberSnapshot: string;
  /**
   * Cached balance in centavos. Authoritative balance is the sum of UtangLedgerEntryEntity signed amounts:
   * CHARGE (+), PAYMENT (-), ADJUSTMENT (+/-).
   */
  cachedBalanceCentavos: number;
  hasPendingSyncEntries: boolean;
  needsReconciliation: boolean;
  updatedAt: string;
}

export interface UtangLedgerEntryEntity {
  id: string;
  storeId: string;
  utangAccountId: string;
  customerId: string;
  customerNameSnapshot: string;
  entryType: UtangLedgerEntryType;
  /**
   * Signed centavos per AGENTS.md Section 9:
   * CHARGE = positive (+), PAYMENT = negative (-), ADJUSTMENT = signed (+/-)
   */
  signedAmountCentavos: number;
  runningBalanceSnapshotCentavos: number;
  referenceSaleId?: string;
  referencePaymentId?: string;
  notes: string;
  deviceId: string;
  userId: string;
  userNameSnapshot: string;
  syncStatus: RecordSyncStatus;
  createdAt: string;
}

export interface AuditLogEntity {
  id: string;
  storeId: string;
  deviceId: string;
  userId: string;
  userNameSnapshot: string;
  userRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
}

export interface CartLineItem {
  cartLineId: string; // productId + "::" + (variantId || "base")
  productId: string;
  variantId?: string;
  productName: string;
  unitLabel: string;
  baseUnitMultiplier: number;
  unitPriceCentavos: number;
  unitCostSnapshotCentavos: number;
  quantity: number;
  allowDecimalQuantity: boolean;
  availableBaseStock: number;
}

