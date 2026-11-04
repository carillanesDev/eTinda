import { db } from "./dexie.ts";
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
  UserEntity,
  UtangAccountEntity,
  UtangLedgerEntryEntity,
} from "@/types/domain";

/**
 * Deterministic RFC 4122 v4 UUID Constants for Store Seed Data
 * Aligned with AGENTS.md Section 6: "Primary keys must use UUIDs."
 */
export const DEFAULT_STORE_ID = "10000000-0000-4000-8000-000000000001";
export const DEFAULT_OWNER_ID = "20000000-0000-4000-8000-000000000001";
export const DEFAULT_HELPER_ID = "20000000-0000-4000-8000-000000000002";
export const DEFAULT_DEVICE_ID = "30000000-0000-4000-8000-000000000001";
export const SECONDARY_DEVICE_ID = "30000000-0000-4000-8000-000000000002";
export const REVOKED_DEVICE_ID = "30000000-0000-4000-8000-000000000003";

export const SEED_CATEGORY_IDS = {
  NOODLES_CANNED: "40000000-0000-4000-8000-000000000001",
  COFFEE_DRINKS: "40000000-0000-4000-8000-000000000002",
  RICE_STAPLES: "40000000-0000-4000-8000-000000000003",
  LAUNDRY_HYGIENE: "40000000-0000-4000-8000-000000000004",
  SNACKS_BREAD: "40000000-0000-4000-8000-000000000005",
} as const;

export const SEED_PRODUCT_IDS = {
  PANCIT_CANTON: "50000000-0000-4000-8000-000000000001",
  CORNED_BEEF: "50000000-0000-4000-8000-000000000002",
  MEGA_SARDINES: "50000000-0000-4000-8000-000000000003",
  NESCAFE_TWIN: "50000000-0000-4000-8000-000000000004",
  BEAR_BRAND: "50000000-0000-4000-8000-000000000005",
  COKE_MISMO: "50000000-0000-4000-8000-000000000006",
  SINANDOMENG_RICE: "50000000-0000-4000-8000-000000000007",
  FRESH_EGGS: "50000000-0000-4000-8000-000000000008",
  DATU_PUTI_PACK: "50000000-0000-4000-8000-000000000009",
  SURF_SACHET: "50000000-0000-4000-8000-000000000010",
  PALMOLIVE_SACHET: "50000000-0000-4000-8000-000000000011",
  SKYFLAKES: "50000000-0000-4000-8000-000000000012",
} as const;

export const SEED_CUSTOMER_IDS = {
  MARIA_SANTOS: "70000000-0000-4000-8000-000000000001",
  ROBERTO_DIZON: "70000000-0000-4000-8000-000000000002",
  GRACE_VILLANUEVA: "70000000-0000-4000-8000-000000000003",
} as const;

export const SEED_UTANG_ACCOUNT_IDS = {
  MARIA_SANTOS: "71000000-0000-4000-8000-000000000001",
  ROBERTO_DIZON: "71000000-0000-4000-8000-000000000002",
  GRACE_VILLANUEVA: "71000000-0000-4000-8000-000000000003",
} as const;

export function buildInitialSeedDataset(now = new Date()) {
  const isoHoursAgo = (hours: number) =>
    new Date(now.getTime() - hours * 3600_000).toISOString();

  const store: StoreEntity = {
    id: DEFAULT_STORE_ID,
    name: "Aling Nena's Sari-Sari Store",
    address: "Purok 4, Brgy. San Isidro, Quezon City",
    contactNumber: "09178234510",
    createdAt: isoHoursAgo(720),
  };

  const users: UserEntity[] = [
    {
      id: DEFAULT_OWNER_ID,
      storeId: DEFAULT_STORE_ID,
      name: "Aling Nena (Store Owner)",
      email: "nena.owner@etinda.ph",
      username: "nena.owner",
      role: "ADMIN",
      isActive: true,
      createdAt: isoHoursAgo(720),
    },
    {
      id: DEFAULT_HELPER_ID,
      storeId: DEFAULT_STORE_ID,
      name: "Jomar Reyes (Store Helper)",
      email: "jomar.helper@etinda.ph",
      username: "jomar.helper",
      role: "HELPER",
      isActive: true,
      createdAt: isoHoursAgo(480),
    },
  ];

  const devices: DeviceEntity[] = [
    {
      id: DEFAULT_DEVICE_ID,
      storeId: DEFAULT_STORE_ID,
      deviceName: "Counter Tablet (Main POS)",
      deviceType: "TABLET",
      registeredByUserId: DEFAULT_OWNER_ID,
      isAuthorized: true,
      lastSyncAt: isoHoursAgo(0.25),
      downloadCursor: 0,
      createdAt: isoHoursAgo(720),
    },
    {
      id: SECONDARY_DEVICE_ID,
      storeId: DEFAULT_STORE_ID,
      deviceName: "Aling Nena Android Phone",
      deviceType: "MOBILE",
      registeredByUserId: DEFAULT_OWNER_ID,
      isAuthorized: true,
      lastSyncAt: isoHoursAgo(1.5),
      downloadCursor: 0,
      createdAt: isoHoursAgo(650),
    },
    {
      id: REVOKED_DEVICE_ID,
      storeId: DEFAULT_STORE_ID,
      deviceName: "Old Helper Phone (Revoked)",
      deviceType: "MOBILE",
      registeredByUserId: DEFAULT_OWNER_ID,
      isAuthorized: false,
      revokedAt: isoHoursAgo(48),
      lastSyncAt: isoHoursAgo(72),
      downloadCursor: 0,
      createdAt: isoHoursAgo(500),
    },
  ];

  const categories: CategoryEntity[] = [
    {
      id: SEED_CATEGORY_IDS.NOODLES_CANNED,
      storeId: DEFAULT_STORE_ID,
      name: "Noodles & Canned",
      sortOrder: 1,
      isActive: true,
      syncStatus: "SYNCED",
      updatedAt: isoHoursAgo(120),
    },
    {
      id: SEED_CATEGORY_IDS.COFFEE_DRINKS,
      storeId: DEFAULT_STORE_ID,
      name: "Coffee, Milk & Drinks",
      sortOrder: 2,
      isActive: true,
      syncStatus: "SYNCED",
      updatedAt: isoHoursAgo(120),
    },
    {
      id: SEED_CATEGORY_IDS.RICE_STAPLES,
      storeId: DEFAULT_STORE_ID,
      name: "Bigas, Cooking & Condiments",
      sortOrder: 3,
      isActive: true,
      syncStatus: "SYNCED",
      updatedAt: isoHoursAgo(120),
    },
    {
      id: SEED_CATEGORY_IDS.LAUNDRY_HYGIENE,
      storeId: DEFAULT_STORE_ID,
      name: "Sachets & Laundry",
      sortOrder: 4,
      isActive: true,
      syncStatus: "SYNCED",
      updatedAt: isoHoursAgo(120),
    },
    {
      id: SEED_CATEGORY_IDS.SNACKS_BREAD,
      storeId: DEFAULT_STORE_ID,
      name: "Snacks & Biscuits",
      sortOrder: 5,
      isActive: true,
      syncStatus: "SYNCED",
      updatedAt: isoHoursAgo(120),
    },
  ];

  const products: ProductEntity[] = [
    {
      id: SEED_PRODUCT_IDS.PANCIT_CANTON,
      storeId: DEFAULT_STORE_ID,
      categoryId: SEED_CATEGORY_IDS.NOODLES_CANNED,
      name: "Lucky Me! Pancit Canton Calamansi 80g",
      baseUnit: "pack",
      sellingPriceCentavos: 1800,
      latestCostCentavos: 1450,
      lowStockThreshold: 12,
      allowDecimalQuantity: false,
      isFrequent: true,
      isActive: true,
      cachedStock: 34,
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(300),
      updatedAt: isoHoursAgo(2),
    },
    {
      id: SEED_PRODUCT_IDS.CORNED_BEEF,
      storeId: DEFAULT_STORE_ID,
      categoryId: SEED_CATEGORY_IDS.NOODLES_CANNED,
      name: "Argentina Corned Beef 175g",
      baseUnit: "can",
      sellingPriceCentavos: 4500,
      latestCostCentavos: 3850,
      lowStockThreshold: 8,
      allowDecimalQuantity: false,
      isFrequent: true,
      isActive: true,
      cachedStock: 16,
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(300),
      updatedAt: isoHoursAgo(4),
    },
    {
      id: SEED_PRODUCT_IDS.MEGA_SARDINES,
      storeId: DEFAULT_STORE_ID,
      categoryId: SEED_CATEGORY_IDS.NOODLES_CANNED,
      name: "Mega Sardines in Tomato Sauce 155g",
      baseUnit: "can",
      sellingPriceCentavos: 2600,
      latestCostCentavos: 2150,
      lowStockThreshold: 10,
      allowDecimalQuantity: false,
      isFrequent: true,
      isActive: true,
      cachedStock: 6,
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(300),
      updatedAt: isoHoursAgo(5),
    },
    {
      id: SEED_PRODUCT_IDS.NESCAFE_TWIN,
      storeId: DEFAULT_STORE_ID,
      categoryId: SEED_CATEGORY_IDS.COFFEE_DRINKS,
      name: "Nescafé Original 3-in-1 Twin Pack",
      baseUnit: "sachet",
      sellingPriceCentavos: 1500,
      latestCostCentavos: 1225,
      lowStockThreshold: 15,
      allowDecimalQuantity: false,
      isFrequent: true,
      isActive: true,
      cachedStock: 48,
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(300),
      updatedAt: isoHoursAgo(1),
    },
    {
      id: SEED_PRODUCT_IDS.BEAR_BRAND,
      storeId: DEFAULT_STORE_ID,
      categoryId: SEED_CATEGORY_IDS.COFFEE_DRINKS,
      name: "Bear Brand Fortified Powdered Milk Swak 33g",
      baseUnit: "sachet",
      sellingPriceCentavos: 1400,
      latestCostCentavos: 1120,
      lowStockThreshold: 12,
      allowDecimalQuantity: false,
      isFrequent: true,
      isActive: true,
      cachedStock: 9,
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(300),
      updatedAt: isoHoursAgo(6),
    },
    {
      id: SEED_PRODUCT_IDS.COKE_MISMO,
      storeId: DEFAULT_STORE_ID,
      categoryId: SEED_CATEGORY_IDS.COFFEE_DRINKS,
      name: "Coca-Cola Mismo 290ml PET",
      baseUnit: "bottle",
      sellingPriceCentavos: 2200,
      latestCostCentavos: 1750,
      lowStockThreshold: 12,
      allowDecimalQuantity: false,
      isFrequent: true,
      isActive: true,
      cachedStock: 28,
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(300),
      updatedAt: isoHoursAgo(2),
    },
    {
      id: SEED_PRODUCT_IDS.SINANDOMENG_RICE,
      storeId: DEFAULT_STORE_ID,
      categoryId: SEED_CATEGORY_IDS.RICE_STAPLES,
      name: "Well-Milled Sinandomeng Rice",
      baseUnit: "kg",
      sellingPriceCentavos: 5600,
      latestCostCentavos: 4900,
      lowStockThreshold: 15,
      allowDecimalQuantity: true,
      isFrequent: true,
      isActive: true,
      cachedStock: 42.5,
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(300),
      updatedAt: isoHoursAgo(3),
    },
    {
      id: SEED_PRODUCT_IDS.FRESH_EGGS,
      storeId: DEFAULT_STORE_ID,
      categoryId: SEED_CATEGORY_IDS.RICE_STAPLES,
      name: "Fresh Farm Egg (Medium)",
      baseUnit: "pc",
      sellingPriceCentavos: 900,
      latestCostCentavos: 720,
      lowStockThreshold: 15,
      allowDecimalQuantity: false,
      isFrequent: true,
      isActive: true,
      cachedStock: 11,
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(300),
      updatedAt: isoHoursAgo(3),
    },
    {
      id: SEED_PRODUCT_IDS.DATU_PUTI_PACK,
      storeId: DEFAULT_STORE_ID,
      categoryId: SEED_CATEGORY_IDS.RICE_STAPLES,
      name: "Datu Puti Toyo & Suka Value Pack 100ml",
      baseUnit: "pack",
      sellingPriceCentavos: 1600,
      latestCostCentavos: 1250,
      lowStockThreshold: 8,
      allowDecimalQuantity: false,
      isFrequent: false,
      isActive: true,
      cachedStock: 19,
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(300),
      updatedAt: isoHoursAgo(12),
    },
    {
      id: SEED_PRODUCT_IDS.SURF_SACHET,
      storeId: DEFAULT_STORE_ID,
      categoryId: SEED_CATEGORY_IDS.LAUNDRY_HYGIENE,
      name: "Surf Powder Detergent Cherry Blossom 65g",
      baseUnit: "sachet",
      sellingPriceCentavos: 900,
      latestCostCentavos: 710,
      lowStockThreshold: 18,
      allowDecimalQuantity: false,
      isFrequent: true,
      isActive: true,
      cachedStock: 36,
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(300),
      updatedAt: isoHoursAgo(8),
    },
    {
      id: SEED_PRODUCT_IDS.PALMOLIVE_SACHET,
      storeId: DEFAULT_STORE_ID,
      categoryId: SEED_CATEGORY_IDS.LAUNDRY_HYGIENE,
      name: "Palmolive Naturals Shampoo 15ml Sachet",
      baseUnit: "sachet",
      sellingPriceCentavos: 800,
      latestCostCentavos: 620,
      lowStockThreshold: 12,
      allowDecimalQuantity: false,
      isFrequent: false,
      isActive: true,
      cachedStock: 0,
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(300),
      updatedAt: isoHoursAgo(10),
    },
    {
      id: SEED_PRODUCT_IDS.SKYFLAKES,
      storeId: DEFAULT_STORE_ID,
      categoryId: SEED_CATEGORY_IDS.SNACKS_BREAD,
      name: "M.Y. San SkyFlakes Crackers 25g",
      baseUnit: "pack",
      sellingPriceCentavos: 800,
      latestCostCentavos: 640,
      lowStockThreshold: 10,
      allowDecimalQuantity: false,
      isFrequent: false,
      isActive: true,
      cachedStock: 25,
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(300),
      updatedAt: isoHoursAgo(6),
    },
  ];

  const variants: ProductVariantEntity[] = [
    {
      id: "60000000-0000-4000-8000-000000000001",
      storeId: DEFAULT_STORE_ID,
      productId: SEED_PRODUCT_IDS.NESCAFE_TWIN,
      name: "Half-Dozen Tie (6 Twin Packs)",
      unitLabel: "tie (6s)",
      conversionMultiplier: 6,
      sellingPriceCentavos: 8700,
      allowDecimalQuantity: false,
      isActive: true,
      syncStatus: "SYNCED",
      updatedAt: isoHoursAgo(100),
    },
    {
      id: "60000000-0000-4000-8000-000000000002",
      storeId: DEFAULT_STORE_ID,
      productId: SEED_PRODUCT_IDS.SURF_SACHET,
      name: "Half-Dozen Tie (6 Sachets)",
      unitLabel: "tie (6s)",
      conversionMultiplier: 6,
      sellingPriceCentavos: 5100,
      allowDecimalQuantity: false,
      isActive: true,
      syncStatus: "SYNCED",
      updatedAt: isoHoursAgo(100),
    },
    {
      id: "60000000-0000-4000-8000-000000000003",
      storeId: DEFAULT_STORE_ID,
      productId: SEED_PRODUCT_IDS.COKE_MISMO,
      name: "1 Case (12 Bottles)",
      unitLabel: "case (12s)",
      conversionMultiplier: 12,
      sellingPriceCentavos: 25000,
      allowDecimalQuantity: false,
      isActive: true,
      syncStatus: "SYNCED",
      updatedAt: isoHoursAgo(100),
    },
    {
      id: "60000000-0000-4000-8000-000000000004",
      storeId: DEFAULT_STORE_ID,
      productId: SEED_PRODUCT_IDS.FRESH_EGGS,
      name: "1 Dozen (12 Eggs)",
      unitLabel: "dozen (12s)",
      conversionMultiplier: 12,
      sellingPriceCentavos: 10400,
      allowDecimalQuantity: false,
      isActive: true,
      syncStatus: "SYNCED",
      updatedAt: isoHoursAgo(100),
    },
  ];

  const initialPurchaseId = "80000000-0000-4000-8000-000000000001";

  const movements: InventoryMovementEntity[] = products
    .filter((p) => p.cachedStock > 0)
    .map((product, idx) => ({
      id: `81000000-0000-4000-8000-${String(idx + 1).padStart(12, "0")}`,
      storeId: DEFAULT_STORE_ID,
      productId: product.id,
      productNameSnapshot: product.name,
      movementType: "PURCHASE_RECEIPT",
      quantityChange: product.cachedStock,
      unitCostCentavos: product.latestCostCentavos,
      reasonOrNotes: "Initial store stock & wholesale delivery receipt",
      deviceId: DEFAULT_DEVICE_ID,
      userId: DEFAULT_OWNER_ID,
      userNameSnapshot: "Aling Nena (Store Owner)",
      referenceId: initialPurchaseId,
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(48),
    }));

  const purchaseRecords: PurchaseRecordEntity[] = [
    {
      id: initialPurchaseId,
      storeId: DEFAULT_STORE_ID,
      supplierName: "Puregold Balintawak Wholesale",
      referenceNote: "OR #884920 - Weekly restock",
      totalCostCentavos: 485000,
      deviceId: DEFAULT_DEVICE_ID,
      userId: DEFAULT_OWNER_ID,
      userNameSnapshot: "Aling Nena (Store Owner)",
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(48),
    },
  ];

  const purchaseItems: PurchaseItemEntity[] = [
    {
      id: "82000000-0000-4000-8000-000000000001",
      purchaseRecordId: initialPurchaseId,
      storeId: DEFAULT_STORE_ID,
      productId: SEED_PRODUCT_IDS.SINANDOMENG_RICE,
      productNameSnapshot: "Well-Milled Sinandomeng Rice",
      quantityAdded: 50,
      unitCostCentavos: 4900,
      subtotalCostCentavos: 245000,
    },
    {
      id: "82000000-0000-4000-8000-000000000002",
      purchaseRecordId: initialPurchaseId,
      storeId: DEFAULT_STORE_ID,
      productId: SEED_PRODUCT_IDS.PANCIT_CANTON,
      productNameSnapshot: "Lucky Me! Pancit Canton Calamansi 80g",
      quantityAdded: 40,
      unitCostCentavos: 1450,
      subtotalCostCentavos: 58000,
    },
  ];

  const customers: CustomerEntity[] = [
    {
      id: SEED_CUSTOMER_IDS.MARIA_SANTOS,
      storeId: DEFAULT_STORE_ID,
      name: "Nanay Maria Santos",
      contactNumber: "09175550192",
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(240),
      updatedAt: isoHoursAgo(4),
    },
    {
      id: SEED_CUSTOMER_IDS.ROBERTO_DIZON,
      storeId: DEFAULT_STORE_ID,
      name: "Mang Roberto Dizon",
      contactNumber: "09184420911",
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(200),
      updatedAt: isoHoursAgo(18),
    },
    {
      id: SEED_CUSTOMER_IDS.GRACE_VILLANUEVA,
      storeId: DEFAULT_STORE_ID,
      name: "Ate Grace Villanueva",
      contactNumber: "09983124455",
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(160),
      updatedAt: isoHoursAgo(24),
    },
  ];

  const utangAccounts: UtangAccountEntity[] = [
    {
      id: "71000000-0000-4000-8000-000000000001",
      storeId: DEFAULT_STORE_ID,
      customerId: SEED_CUSTOMER_IDS.MARIA_SANTOS,
      customerNameSnapshot: "Nanay Maria Santos",
      contactNumberSnapshot: "09175550192",
      cachedBalanceCentavos: 13500,
      hasPendingSyncEntries: false,
      needsReconciliation: false,
      updatedAt: isoHoursAgo(2),
    },
    {
      id: "71000000-0000-4000-8000-000000000002",
      storeId: DEFAULT_STORE_ID,
      customerId: SEED_CUSTOMER_IDS.ROBERTO_DIZON,
      customerNameSnapshot: "Mang Roberto Dizon",
      contactNumberSnapshot: "09184420911",
      cachedBalanceCentavos: 24200,
      hasPendingSyncEntries: false,
      needsReconciliation: false,
      updatedAt: isoHoursAgo(18),
    },
    {
      id: "71000000-0000-4000-8000-000000000003",
      storeId: DEFAULT_STORE_ID,
      customerId: SEED_CUSTOMER_IDS.GRACE_VILLANUEVA,
      customerNameSnapshot: "Ate Grace Villanueva",
      contactNumberSnapshot: "09983124455",
      cachedBalanceCentavos: 0,
      hasPendingSyncEntries: false,
      needsReconciliation: false,
      updatedAt: isoHoursAgo(24),
    },
  ];

  const cashSaleId = "90000000-0000-4000-8000-000000000001";
  const utangSaleId = "90000000-0000-4000-8000-000000000002";
  const samplePaymentId = "92000000-0000-4000-8000-000000000003";

  const utangLedger: UtangLedgerEntryEntity[] = [
    {
      id: "72000000-0000-4000-8000-000000000001",
      storeId: DEFAULT_STORE_ID,
      utangAccountId: "71000000-0000-4000-8000-000000000001",
      customerId: SEED_CUSTOMER_IDS.MARIA_SANTOS,
      customerNameSnapshot: "Nanay Maria Santos",
      entryType: "CHARGE",
      signedAmountCentavos: 18500,
      runningBalanceSnapshotCentavos: 18500,
      referenceSaleId: utangSaleId,
      notes:
        "Utang sale: 2kg Sinandomeng Rice + 1 Argentina Corned Beef + 2 Pancit Canton",
      deviceId: DEFAULT_DEVICE_ID,
      userId: DEFAULT_HELPER_ID,
      userNameSnapshot: "Jomar Reyes (Store Helper)",
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(5),
    },
    {
      id: "72000000-0000-4000-8000-000000000002",
      storeId: DEFAULT_STORE_ID,
      utangAccountId: "71000000-0000-4000-8000-000000000001",
      customerId: SEED_CUSTOMER_IDS.MARIA_SANTOS,
      customerNameSnapshot: "Nanay Maria Santos",
      entryType: "PAYMENT",
      signedAmountCentavos: -5000,
      runningBalanceSnapshotCentavos: 13500,
      referencePaymentId: samplePaymentId,
      notes: "Partial cash payment dropped off by daughter",
      deviceId: DEFAULT_DEVICE_ID,
      userId: DEFAULT_OWNER_ID,
      userNameSnapshot: "Aling Nena (Store Owner)",
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(2),
    },
    {
      id: "72000000-0000-4000-8000-000000000003",
      storeId: DEFAULT_STORE_ID,
      utangAccountId: "71000000-0000-4000-8000-000000000002",
      customerId: SEED_CUSTOMER_IDS.ROBERTO_DIZON,
      customerNameSnapshot: "Mang Roberto Dizon",
      entryType: "CHARGE",
      signedAmountCentavos: 24200,
      runningBalanceSnapshotCentavos: 24200,
      notes: "3kg Rice + 2 Mega Sardines + 2 Coke Mismo",
      deviceId: DEFAULT_DEVICE_ID,
      userId: DEFAULT_OWNER_ID,
      userNameSnapshot: "Aling Nena (Store Owner)",
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(18),
    },
  ];

  const sampleSales: SaleEntity[] = [
    {
      id: cashSaleId,
      storeId: DEFAULT_STORE_ID,
      receiptNumber: "OR-3000-20261103-0041",
      status: "COMPLETED",
      paymentMethod: "CASH",
      subtotalCentavos: 9300,
      totalCentavos: 9300,
      cashTenderedCentavos: 10000,
      changeGivenCentavos: 700,
      utangChargedCentavos: 0,
      deviceId: DEFAULT_DEVICE_ID,
      userId: DEFAULT_HELPER_ID,
      userNameSnapshot: "Jomar Reyes (Store Helper)",
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(1.2),
    },
    {
      id: utangSaleId,
      storeId: DEFAULT_STORE_ID,
      receiptNumber: "OR-3000-20261103-0040",
      status: "COMPLETED",
      paymentMethod: "PARTIAL_CASH_UTANG",
      subtotalCentavos: 19300,
      totalCentavos: 19300,
      cashTenderedCentavos: 800,
      changeGivenCentavos: 0,
      utangChargedCentavos: 18500,
      customerId: SEED_CUSTOMER_IDS.MARIA_SANTOS,
      customerNameSnapshot: "Nanay Maria Santos",
      deviceId: DEFAULT_DEVICE_ID,
      userId: DEFAULT_HELPER_ID,
      userNameSnapshot: "Jomar Reyes (Store Helper)",
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(5),
    },
  ];

  const sampleSaleItems: SaleItemEntity[] = [
    {
      id: "91000000-0000-4000-8000-000000000001",
      saleId: cashSaleId,
      storeId: DEFAULT_STORE_ID,
      productId: SEED_PRODUCT_IDS.PANCIT_CANTON,
      productNameSnapshot: "Lucky Me! Pancit Canton Calamansi 80g",
      unitLabelSnapshot: "pack",
      quantity: 2,
      baseUnitMultiplier: 1,
      unitSellingPriceCentavos: 1800,
      unitCostSnapshotCentavos: 1450,
      subtotalCentavos: 3600,
    },
    {
      id: "91000000-0000-4000-8000-000000000002",
      saleId: cashSaleId,
      storeId: DEFAULT_STORE_ID,
      productId: SEED_PRODUCT_IDS.NESCAFE_TWIN,
      productNameSnapshot: "Nescafé Original 3-in-1 Twin Pack",
      unitLabelSnapshot: "sachet",
      quantity: 1,
      baseUnitMultiplier: 1,
      unitSellingPriceCentavos: 1500,
      unitCostSnapshotCentavos: 1225,
      subtotalCentavos: 1500,
    },
    {
      id: "91000000-0000-4000-8000-000000000003",
      saleId: cashSaleId,
      storeId: DEFAULT_STORE_ID,
      productId: SEED_PRODUCT_IDS.SINANDOMENG_RICE,
      productNameSnapshot: "Well-Milled Sinandomeng Rice",
      unitLabelSnapshot: "kg",
      quantity: 0.75,
      baseUnitMultiplier: 1,
      unitSellingPriceCentavos: 5600,
      unitCostSnapshotCentavos: 4900,
      subtotalCentavos: 4200,
    },
    {
      id: "91000000-0000-4000-8000-000000000004",
      saleId: utangSaleId,
      storeId: DEFAULT_STORE_ID,
      productId: SEED_PRODUCT_IDS.SINANDOMENG_RICE,
      productNameSnapshot: "Well-Milled Sinandomeng Rice",
      unitLabelSnapshot: "kg",
      quantity: 2,
      baseUnitMultiplier: 1,
      unitSellingPriceCentavos: 5600,
      unitCostSnapshotCentavos: 4900,
      subtotalCentavos: 11200,
    },
    {
      id: "91000000-0000-4000-8000-000000000005",
      saleId: utangSaleId,
      storeId: DEFAULT_STORE_ID,
      productId: SEED_PRODUCT_IDS.CORNED_BEEF,
      productNameSnapshot: "Argentina Corned Beef 175g",
      unitLabelSnapshot: "can",
      quantity: 1,
      baseUnitMultiplier: 1,
      unitSellingPriceCentavos: 4500,
      unitCostSnapshotCentavos: 3850,
      subtotalCentavos: 4500,
    },
    {
      id: "91000000-0000-4000-8000-000000000006",
      saleId: utangSaleId,
      storeId: DEFAULT_STORE_ID,
      productId: SEED_PRODUCT_IDS.PANCIT_CANTON,
      productNameSnapshot: "Lucky Me! Pancit Canton Calamansi 80g",
      unitLabelSnapshot: "pack",
      quantity: 2,
      baseUnitMultiplier: 1,
      unitSellingPriceCentavos: 1800,
      unitCostSnapshotCentavos: 1450,
      subtotalCentavos: 3600,
    },
  ];

  const samplePayments: PaymentEntity[] = [
    {
      id: "92000000-0000-4000-8000-000000000001",
      storeId: DEFAULT_STORE_ID,
      saleId: cashSaleId,
      amountCentavos: 9300,
      paymentType: "SALE_CASH",
      notes: "Cash sale payment",
      deviceId: DEFAULT_DEVICE_ID,
      userId: DEFAULT_HELPER_ID,
      userNameSnapshot: "Jomar Reyes (Store Helper)",
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(1.2),
    },
    {
      id: "92000000-0000-4000-8000-000000000002",
      storeId: DEFAULT_STORE_ID,
      saleId: utangSaleId,
      customerId: SEED_CUSTOMER_IDS.MARIA_SANTOS,
      customerNameSnapshot: "Nanay Maria Santos",
      amountCentavos: 800,
      paymentType: "SALE_CASH",
      notes: "Partial cash paid during utang purchase",
      deviceId: DEFAULT_DEVICE_ID,
      userId: DEFAULT_HELPER_ID,
      userNameSnapshot: "Jomar Reyes (Store Helper)",
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(5),
    },
    {
      id: samplePaymentId,
      storeId: DEFAULT_STORE_ID,
      customerId: SEED_CUSTOMER_IDS.MARIA_SANTOS,
      customerNameSnapshot: "Nanay Maria Santos",
      amountCentavos: 5000,
      paymentType: "UTANG_PAYMENT",
      notes: "Partial cash payment dropped off by daughter",
      deviceId: DEFAULT_DEVICE_ID,
      userId: DEFAULT_OWNER_ID,
      userNameSnapshot: "Aling Nena (Store Owner)",
      syncStatus: "SYNCED",
      createdAt: isoHoursAgo(2),
    },
  ];

  const auditLogs: AuditLogEntity[] = [
    {
      id: "99000000-0000-4000-8000-000000000001",
      storeId: DEFAULT_STORE_ID,
      deviceId: DEFAULT_DEVICE_ID,
      userId: DEFAULT_OWNER_ID,
      userNameSnapshot: "Aling Nena (Store Owner)",
      userRole: "ADMIN",
      action: "DEVICE_REGISTERED",
      entityType: "DEVICE",
      entityId: DEFAULT_DEVICE_ID,
      summary:
        "Registered Counter Tablet (Main POS) as primary store terminal",
      createdAt: isoHoursAgo(720),
    },
    {
      id: "99000000-0000-4000-8000-000000000002",
      storeId: DEFAULT_STORE_ID,
      deviceId: DEFAULT_DEVICE_ID,
      userId: DEFAULT_OWNER_ID,
      userNameSnapshot: "Aling Nena (Store Owner)",
      userRole: "ADMIN",
      action: "DEVICE_REVOKED",
      entityType: "DEVICE",
      entityId: REVOKED_DEVICE_ID,
      summary: "Revoked authorization for Old Helper Phone",
      createdAt: isoHoursAgo(48),
    },
    {
      id: "99000000-0000-4000-8000-000000000003",
      storeId: DEFAULT_STORE_ID,
      deviceId: DEFAULT_DEVICE_ID,
      userId: DEFAULT_OWNER_ID,
      userNameSnapshot: "Aling Nena (Store Owner)",
      userRole: "ADMIN",
      action: "UTANG_PAYMENT_RECORDED",
      entityType: "UTANG_LEDGER",
      entityId: "72000000-0000-4000-8000-000000000002",
      summary: "Recorded ₱50.00 partial payment for Nanay Maria Santos",
      createdAt: isoHoursAgo(2),
    },
  ];

  return {
    store,
    users,
    devices,
    categories,
    products,
    variants,
    movements,
    purchaseRecords,
    purchaseItems,
    customers,
    utangAccounts,
    utangLedger,
    sampleSales,
    sampleSaleItems,
    samplePayments,
    auditLogs,
    lastSuccessfulSyncAt: isoHoursAgo(0.25),
  };
}

let seedPromise: Promise<void> | null = null;

export async function ensureLocalDatabaseInitialized(): Promise<void> {
  if (typeof window === "undefined") return;
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    const cleanSetupMeta = await db.sync_metadata.get(
      "cleanProductionSetupV3"
    );
    if (cleanSetupMeta?.value === "true") {
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const dataset = buildInitialSeedDataset(now);

    await db.transaction(
      "rw",
      [
        db.stores,
        db.users,
        db.devices,
        db.categories,
        db.products,
        db.product_variants,
        db.inventory_movements,
        db.purchase_records,
        db.purchase_items,
        db.customers,
        db.utang_accounts,
        db.utang_ledger,
        db.sales,
        db.sale_items,
        db.payments,
        db.audit_logs,
        db.sync_outbox,
        db.sync_metadata,
      ],
      async () => {
        // Remove any previously pre-seeded demo accounts (Aling Nena / Jomar Reyes) and demo transactions
        const existingUsers = await db.users.toArray();
        const realUsers = existingUsers.filter(
          (u) =>
            u.id !== DEFAULT_OWNER_ID &&
            u.id !== DEFAULT_HELPER_ID &&
            u.username !== "nena.owner" &&
            u.username !== "jomar.helper"
        );

        await db.users.clear();
        if (realUsers.length > 0) {
          await db.users.bulkPut(realUsers);
        } else {
          // Clean slate for first-time store deployment
          await db.products.clear();
          await db.product_variants.clear();
          await db.inventory_movements.clear();
          await db.purchase_records.clear();
          await db.purchase_items.clear();
          await db.customers.clear();
          await db.utang_accounts.clear();
          await db.utang_ledger.clear();
          await db.sales.clear();
          await db.sale_items.clear();
          await db.payments.clear();
          await db.audit_logs.clear();
          await db.sync_outbox.clear();
        }

        const existingStore = await db.stores.get(DEFAULT_STORE_ID);
        if (!existingStore || realUsers.length === 0) {
          await db.stores.put({
            id: DEFAULT_STORE_ID,
            name: "My Sari-Sari Store",
            address: "",
            contactNumber: "",
            createdAt: nowIso,
          });
        }

        await db.devices.clear();
        await db.devices.put({
          id: DEFAULT_DEVICE_ID,
          storeId: DEFAULT_STORE_ID,
          deviceName: "Primary Store Terminal",
          deviceType: "TABLET",
          registeredByUserId: realUsers[0]?.id ?? DEFAULT_OWNER_ID,
          isAuthorized: true,
          downloadCursor: 0,
          createdAt: nowIso,
        });

        const existingCategoriesCount = await db.categories.count();
        if (existingCategoriesCount === 0) {
          await db.categories.bulkPut(dataset.categories);
        }

        await db.sync_metadata.bulkPut([
          {
            key: "cleanProductionSetupV3",
            value: "true",
            updatedAt: nowIso,
          },
          {
            key: "downloadCursor",
            value: "0",
            updatedAt: nowIso,
          },
        ]);
      }
    );
  })().catch((err) => {
    seedPromise = null;
    throw err;
  });

  return seedPromise;
}
