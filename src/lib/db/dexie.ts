import Dexie, { type Table } from "dexie";
import type {
  AuditLogEntity,
  CategoryEntity,
  CustomerEntity,
  DeviceEntity,
  InventoryMovementEntity,
  PaymentEntity,
  ProductEntity,
  ProductVariantEntity,
  PurchaseItemEntity,
  PurchaseRecordEntity,
  SaleEntity,
  SaleItemEntity,
  StoreEntity,
  SyncEvent,
  SyncMetadataRecord,
  UserEntity,
  UtangAccountEntity,
  UtangLedgerEntryEntity,
} from "@/types/domain";

/**
 * eTinda Local IndexedDB Database (Dexie.js)
 * Implements all 12 required stores from AGENTS.md Section 10 plus supporting
 * purchasing, device, and audit stores for full offline capability.
 */
export class ETindaLocalDB extends Dexie {
  // 12 Mandatory Stores (AGENTS.md Section 10)
  products!: Table<ProductEntity, string>;
  categories!: Table<CategoryEntity, string>;
  product_variants!: Table<ProductVariantEntity, string>;
  sales!: Table<SaleEntity, string>;
  sale_items!: Table<SaleItemEntity, string>;
  payments!: Table<PaymentEntity, string>;
  customers!: Table<CustomerEntity, string>;
  utang_accounts!: Table<UtangAccountEntity, string>;
  utang_ledger!: Table<UtangLedgerEntryEntity, string>;
  inventory_movements!: Table<InventoryMovementEntity, string>;
  sync_outbox!: Table<SyncEvent, string>;
  sync_metadata!: Table<SyncMetadataRecord, string>;

  // Supporting Offline Stores (AGENTS.md Section 6)
  purchase_records!: Table<PurchaseRecordEntity, string>;
  purchase_items!: Table<PurchaseItemEntity, string>;
  stores!: Table<StoreEntity, string>;
  users!: Table<UserEntity, string>;
  devices!: Table<DeviceEntity, string>;
  audit_logs!: Table<AuditLogEntity, string>;

  constructor(dbName = "etinda_offline_db_v2") {
    super(dbName);

    this.version(1).stores({
      products:
        "id, storeId, categoryId, name, isFrequent, isActive, syncStatus, updatedAt",
      categories: "id, storeId, sortOrder, isActive, syncStatus",
      product_variants: "id, storeId, productId, isActive, syncStatus",
      sales:
        "id, storeId, receiptNumber, status, paymentMethod, customerId, syncStatus, createdAt",
      sale_items: "id, saleId, storeId, productId",
      payments: "id, storeId, saleId, customerId, paymentType, syncStatus, createdAt",
      customers: "id, storeId, name, contactNumber, syncStatus",
      utang_accounts:
        "id, storeId, &customerId, cachedBalanceCentavos, hasPendingSyncEntries, needsReconciliation",
      utang_ledger:
        "id, storeId, utangAccountId, customerId, entryType, syncStatus, createdAt",
      inventory_movements:
        "id, storeId, productId, movementType, referenceId, syncStatus, createdAt",
      sync_outbox: "eventId, storeId, eventType, entityId, status, createdAt",
      sync_metadata: "key, updatedAt",
      purchase_records: "id, storeId, syncStatus, createdAt",
      purchase_items: "id, purchaseRecordId, storeId, productId",
      stores: "id",
      users: "id, storeId, username, role, isActive",
      devices: "id, storeId, isAuthorized",
      audit_logs: "id, storeId, entityType, createdAt",
    });

    this.version(2).stores({
      users: "id, storeId, email, username, role, isActive",
    });
  }
}

export const db = new ETindaLocalDB();

