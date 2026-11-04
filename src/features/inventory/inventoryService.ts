"use client";

import { db } from "@/lib/db/dexie";
import { hasPermission } from "@/lib/permissions";
import {
  calculateLineSubtotalCentavos,
  sumCentavos,
} from "@/lib/utils/money";
import { generateUuid } from "@/lib/utils/uuid";
import { generateDuplicateProductName } from "@/lib/utils/product";
import {
  categoryFormSchema,
  productFormSchema,
  productVariantSchema,
  purchaseReceivingFormSchema,
  stockAdjustmentFormSchema,
} from "@/lib/validation/schemas";
import {
  createSyncEvent,
  synchronizePendingOutbox,
} from "@/features/sync/syncEngine";
import { useSessionStore } from "@/stores/useSessionStore";
import type {
  CategoryEntity,
  InventoryMovementEntity,
  ProductEntity,
  ProductVariantEntity,
  PurchaseItemEntity,
  PurchaseRecordEntity,
} from "@/types/domain";
import type { z } from "zod";

export async function upsertProduct(
  rawInput: z.infer<typeof productFormSchema>,
  existingProductId?: string,
  initialStock = 0
): Promise<ProductEntity> {
  const session = useSessionStore.getState();
  if (!hasPermission(session.role, "MANAGE_PRODUCTS")) {
    throw new Error("Only the Store Owner can create or modify products.");
  }

  const input = productFormSchema.parse(rawInput);
  const nowIso = new Date().toISOString();
  const productId = existingProductId ?? generateUuid();

  let savedProduct!: ProductEntity;

  await db.transaction(
    "rw",
    [db.products, db.inventory_movements, db.audit_logs, db.sync_outbox],
    async () => {
      const existing = existingProductId
        ? await db.products.get(existingProductId)
        : undefined;

      savedProduct = {
        id: productId,
        storeId: session.storeId,
        categoryId: input.categoryId,
        name: input.name,
        baseUnit: input.baseUnit,
        sellingPriceCentavos: input.sellingPriceCentavos,
        latestCostCentavos: input.latestCostCentavos,
        lowStockThreshold: input.lowStockThreshold,
        allowDecimalQuantity: input.allowDecimalQuantity,
        isFrequent: input.isFrequent,
        isActive: input.isActive,
        cachedStock: existing ? existing.cachedStock : Math.max(0, initialStock),
        syncStatus: "PENDING",
        createdAt: existing ? existing.createdAt : nowIso,
        updatedAt: nowIso,
      };

      await db.products.put(savedProduct);

      let openingMovement: InventoryMovementEntity | undefined;
      // If creating a brand-new product with initial stock > 0, record an append-only movement
      if (!existing && initialStock > 0) {
        const movId = generateUuid();
        openingMovement = {
          id: movId,
          storeId: session.storeId,
          productId,
          productNameSnapshot: input.name,
          movementType: "STOCK_ADDITION",
          quantityChange: initialStock,
          unitCostCentavos: input.latestCostCentavos,
          reasonOrNotes: "Opening stock on product creation",
          deviceId: session.deviceId,
          userId: session.userId,
          userNameSnapshot: session.userName,
          syncStatus: "PENDING",
          createdAt: nowIso,
        };
        await db.inventory_movements.put(openingMovement);
      }

      await db.audit_logs.put({
        id: generateUuid(),
        storeId: session.storeId,
        deviceId: session.deviceId,
        userId: session.userId,
        userNameSnapshot: session.userName,
        userRole: session.role,
        action: existing ? "PRODUCT_UPDATED" : "PRODUCT_CREATED",
        entityType: "PRODUCT",
        entityId: productId,
        summary: `${existing ? "Updated" : "Created"} product ${input.name}`,
        createdAt: nowIso,
      });

      await db.sync_outbox.put(
        createSyncEvent({
          eventType: "PRODUCT_UPSERTED",
          entityId: productId,
          payload: openingMovement
            ? { ...savedProduct, openingMovement }
            : savedProduct,
        })
      );
    }
  );

  void synchronizePendingOutbox();
  return savedProduct;
}

export async function duplicateProduct(
  sourceProductId: string,
  overrides?: {
    name?: string;
    categoryId?: string;
    baseUnit?: string;
    sellingPriceCentavos?: number;
    latestCostCentavos?: number;
    lowStockThreshold?: number;
    allowDecimalQuantity?: boolean;
    isFrequent?: boolean;
    isActive?: boolean;
    initialStock?: number;
  }
): Promise<ProductEntity> {
  const session = useSessionStore.getState();
  if (!hasPermission(session.role, "MANAGE_PRODUCTS")) {
    throw new Error("Only the Store Owner can create or modify products.");
  }

  const sourceProduct = await db.products.get(sourceProductId);
  if (!sourceProduct) {
    throw new Error("Source product not found.");
  }

  const existingProducts = await db.products.toArray();
  const duplicateName =
    overrides?.name?.trim() ||
    generateDuplicateProductName(
      sourceProduct.name,
      existingProducts.map((p) => p.name)
    );

  const initialStock = overrides?.initialStock ?? 0;
  const newProductId = generateUuid();
  const nowIso = new Date().toISOString();

  let savedProduct!: ProductEntity;

  await db.transaction(
    "rw",
    [
      db.products,
      db.product_variants,
      db.inventory_movements,
      db.audit_logs,
      db.sync_outbox,
    ],
    async () => {
      savedProduct = {
        id: newProductId,
        storeId: session.storeId,
        categoryId: overrides?.categoryId ?? sourceProduct.categoryId,
        name: duplicateName,
        baseUnit: overrides?.baseUnit ?? sourceProduct.baseUnit,
        sellingPriceCentavos:
          overrides?.sellingPriceCentavos ?? sourceProduct.sellingPriceCentavos,
        latestCostCentavos:
          overrides?.latestCostCentavos ?? sourceProduct.latestCostCentavos,
        lowStockThreshold:
          overrides?.lowStockThreshold ?? sourceProduct.lowStockThreshold,
        allowDecimalQuantity:
          overrides?.allowDecimalQuantity ?? sourceProduct.allowDecimalQuantity,
        isFrequent: overrides?.isFrequent ?? sourceProduct.isFrequent,
        isActive: overrides?.isActive ?? sourceProduct.isActive,
        cachedStock: Math.max(0, initialStock),
        syncStatus: "PENDING",
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await db.products.put(savedProduct);

      let openingMovement: InventoryMovementEntity | undefined;
      if (initialStock > 0) {
        const movId = generateUuid();
        openingMovement = {
          id: movId,
          storeId: session.storeId,
          productId: newProductId,
          productNameSnapshot: duplicateName,
          movementType: "STOCK_ADDITION",
          quantityChange: initialStock,
          unitCostCentavos: savedProduct.latestCostCentavos,
          reasonOrNotes: `Opening stock on product duplication from ${sourceProduct.name}`,
          deviceId: session.deviceId,
          userId: session.userId,
          userNameSnapshot: session.userName,
          syncStatus: "PENDING",
          createdAt: nowIso,
        };
        await db.inventory_movements.put(openingMovement);
      }

      // Copy variants from source product
      const sourceVariants = await db.product_variants
        .where("productId")
        .equals(sourceProductId)
        .toArray();

      const newVariants: ProductVariantEntity[] = sourceVariants.map((v) => ({
        id: generateUuid(),
        storeId: session.storeId,
        productId: newProductId,
        name: v.name,
        unitLabel: v.unitLabel,
        conversionMultiplier: v.conversionMultiplier,
        sellingPriceCentavos: v.sellingPriceCentavos,
        barcodeOrSku: v.barcodeOrSku,
        allowDecimalQuantity: v.allowDecimalQuantity,
        isActive: v.isActive,
        syncStatus: "PENDING",
        createdAt: nowIso,
        updatedAt: nowIso,
      }));

      for (const variant of newVariants) {
        await db.product_variants.put(variant);
      }

      await db.audit_logs.put({
        id: generateUuid(),
        storeId: session.storeId,
        deviceId: session.deviceId,
        userId: session.userId,
        userNameSnapshot: session.userName,
        userRole: session.role,
        action: "PRODUCT_CREATED",
        entityType: "PRODUCT",
        entityId: newProductId,
        summary: `Duplicated product "${sourceProduct.name}" as "${duplicateName}"`,
        createdAt: nowIso,
      });

      await db.sync_outbox.put(
        createSyncEvent({
          eventType: "PRODUCT_UPSERTED",
          entityId: newProductId,
          payload: openingMovement
            ? { ...savedProduct, openingMovement }
            : savedProduct,
        })
      );

      for (const variant of newVariants) {
        await db.sync_outbox.put(
          createSyncEvent({
            eventType: "PRODUCT_UPSERTED",
            entityId: newProductId,
            payload: { variant },
          })
        );
      }
    }
  );

  void synchronizePendingOutbox();
  return savedProduct;
}

export async function upsertCategory(
  rawInput: z.infer<typeof categoryFormSchema>,
  existingCategoryId?: string
): Promise<CategoryEntity> {
  const session = useSessionStore.getState();
  if (!hasPermission(session.role, "MANAGE_PRODUCTS")) {
    throw new Error("Only the Store Owner can manage categories.");
  }

  const input = categoryFormSchema.parse(rawInput);
  const nowIso = new Date().toISOString();
  const categoryId = existingCategoryId ?? generateUuid();

  const category: CategoryEntity = {
    id: categoryId,
    storeId: session.storeId,
    name: input.name,
    sortOrder: input.sortOrder,
    isActive: true,
    syncStatus: "PENDING",
    updatedAt: nowIso,
  };

  await db.transaction("rw", [db.categories, db.sync_outbox], async () => {
    await db.categories.put(category);
    await db.sync_outbox.put(
      createSyncEvent({
        eventType: "CATEGORY_UPSERTED",
        entityId: categoryId,
        payload: category,
      })
    );
  });

  void synchronizePendingOutbox();
  return category;
}

export async function upsertProductVariant(
  rawInput: z.infer<typeof productVariantSchema>,
  existingVariantId?: string
): Promise<ProductVariantEntity> {
  const session = useSessionStore.getState();
  if (!hasPermission(session.role, "MANAGE_PRODUCTS")) {
    throw new Error("Only the Store Owner can configure product variants.");
  }

  const input = productVariantSchema.parse(rawInput);
  const nowIso = new Date().toISOString();
  const variantId = existingVariantId ?? generateUuid();

  const variant: ProductVariantEntity = {
    id: variantId,
    storeId: session.storeId,
    productId: input.productId,
    name: input.name,
    unitLabel: input.unitLabel,
    conversionMultiplier: input.conversionMultiplier,
    sellingPriceCentavos: input.sellingPriceCentavos,
    barcodeOrSku: input.barcodeOrSku,
    allowDecimalQuantity: input.allowDecimalQuantity,
    isActive: input.isActive,
    syncStatus: "PENDING",
    updatedAt: nowIso,
  };

  await db.transaction("rw", [db.product_variants, db.sync_outbox], async () => {
    await db.product_variants.put(variant);
    await db.sync_outbox.put(
      createSyncEvent({
        eventType: "PRODUCT_UPSERTED",
        entityId: input.productId,
        payload: { variant },
      })
    );
  });

  void synchronizePendingOutbox();
  return variant;
}

/**
 * Append-only Inventory Movement Recording (AGENTS.md Section 7 & DESIGNS.md Section 8).
 * Never overwrites stock directly without recording an InventoryMovementEntity.
 */
export async function recordStockAdjustment(
  rawInput: z.infer<typeof stockAdjustmentFormSchema>
): Promise<InventoryMovementEntity> {
  const session = useSessionStore.getState();
  const input = stockAdjustmentFormSchema.parse(rawInput);
  const nowIso = new Date().toISOString();

  let recordedMovement!: InventoryMovementEntity;

  await db.transaction(
    "rw",
    [db.products, db.inventory_movements, db.audit_logs, db.sync_outbox],
    async () => {
      const product = await db.products.get(input.productId);
      if (!product) {
        throw new Error("Product not found.");
      }

      const signedChange =
        input.movementType === "STOCK_DEDUCTION"
          ? -Math.abs(input.quantityChange)
          : input.movementType === "STOCK_ADDITION"
            ? Math.abs(input.quantityChange)
            : input.quantityChange;

      const nextCachedStock =
        Math.round((product.cachedStock + signedChange) * 1000) / 1000;

      const movementId = generateUuid();
      recordedMovement = {
        id: movementId,
        storeId: session.storeId,
        productId: product.id,
        productNameSnapshot: product.name,
        movementType: input.movementType,
        quantityChange: signedChange,
        unitCostCentavos: product.latestCostCentavos,
        reasonOrNotes: input.reasonOrNotes,
        deviceId: session.deviceId,
        userId: session.userId,
        userNameSnapshot: session.userName,
        syncStatus: "PENDING",
        createdAt: nowIso,
      };

      await db.inventory_movements.put(recordedMovement);
      await db.products.update(product.id, {
        cachedStock: nextCachedStock,
        hasOversellConflict:
          nextCachedStock >= 0 ? false : product.hasOversellConflict,
        syncStatus: "PENDING",
        updatedAt: nowIso,
      });

      await db.audit_logs.put({
        id: generateUuid(),
        storeId: session.storeId,
        deviceId: session.deviceId,
        userId: session.userId,
        userNameSnapshot: session.userName,
        userRole: session.role,
        action: input.movementType,
        entityType: "INVENTORY_MOVEMENT",
        entityId: movementId,
        summary: `${product.name}: ${signedChange > 0 ? `+${signedChange}` : signedChange} ${product.baseUnit} (${input.reasonOrNotes})`,
        createdAt: nowIso,
      });

      await db.sync_outbox.put(
        createSyncEvent({
          eventType: "INVENTORY_MOVEMENT_RECORDED",
          entityId: movementId,
          payload: recordedMovement,
        })
      );
    }
  );

  void synchronizePendingOutbox();
  return recordedMovement;
}

/**
 * Purchase Receiving with Historical Purchase Cost Preservation (AGENTS.md Section 6).
 */
export async function recordPurchaseReceipt(
  rawInput: z.infer<typeof purchaseReceivingFormSchema>
): Promise<PurchaseRecordEntity> {
  const session = useSessionStore.getState();
  const input = purchaseReceivingFormSchema.parse(rawInput);
  const nowIso = new Date().toISOString();
  const purchaseId = generateUuid();

  let purchaseRecord!: PurchaseRecordEntity;

  await db.transaction(
    "rw",
    [
      db.products,
      db.purchase_records,
      db.purchase_items,
      db.inventory_movements,
      db.audit_logs,
      db.sync_outbox,
    ],
    async () => {
      const purchaseItems: PurchaseItemEntity[] = [];
      const movements: InventoryMovementEntity[] = [];
      const itemSubtotals: number[] = [];

      for (let i = 0; i < input.items.length; i++) {
        const line = input.items[i];
        const product = await db.products.get(line.productId);
        if (!product) {
          throw new Error(`Product ${line.productId} not found.`);
        }

        const subtotalCost = calculateLineSubtotalCentavos(
          line.unitCostCentavos,
          line.quantityAdded
        );
        itemSubtotals.push(subtotalCost);

        purchaseItems.push({
          id: generateUuid(),
          purchaseRecordId: purchaseId,
          storeId: session.storeId,
          productId: product.id,
          productNameSnapshot: product.name,
          quantityAdded: line.quantityAdded,
          unitCostCentavos: line.unitCostCentavos,
          subtotalCostCentavos: subtotalCost,
        });

        const nextStock =
          Math.round((product.cachedStock + line.quantityAdded) * 1000) / 1000;

        await db.products.update(product.id, {
          cachedStock: nextStock,
          latestCostCentavos: line.unitCostCentavos,
          hasOversellConflict:
            nextStock >= 0 ? false : product.hasOversellConflict,
          syncStatus: "PENDING",
          updatedAt: nowIso,
        });

        movements.push({
          id: generateUuid(),
          storeId: session.storeId,
          productId: product.id,
          productNameSnapshot: product.name,
          movementType: "PURCHASE_RECEIPT",
          quantityChange: line.quantityAdded,
          unitCostCentavos: line.unitCostCentavos,
          reasonOrNotes: `Received from ${input.supplierName}${
            input.referenceNote ? ` (${input.referenceNote})` : ""
          }`,
          deviceId: session.deviceId,
          userId: session.userId,
          userNameSnapshot: session.userName,
          referenceId: purchaseId,
          syncStatus: "PENDING",
          createdAt: nowIso,
        });
      }

      purchaseRecord = {
        id: purchaseId,
        storeId: session.storeId,
        supplierName: input.supplierName,
        referenceNote: input.referenceNote,
        totalCostCentavos: sumCentavos(itemSubtotals),
        deviceId: session.deviceId,
        userId: session.userId,
        userNameSnapshot: session.userName,
        syncStatus: "PENDING",
        createdAt: nowIso,
      };

      await db.purchase_records.put(purchaseRecord);
      await db.purchase_items.bulkPut(purchaseItems);
      await db.inventory_movements.bulkPut(movements);

      await db.audit_logs.put({
        id: generateUuid(),
        storeId: session.storeId,
        deviceId: session.deviceId,
        userId: session.userId,
        userNameSnapshot: session.userName,
        userRole: session.role,
        action: "PURCHASE_RECEIVED",
        entityType: "PURCHASE_RECORD",
        entityId: purchaseId,
        summary: `Received ${input.items.length} item(s) from ${input.supplierName}`,
        createdAt: nowIso,
      });

      await db.sync_outbox.put(
        createSyncEvent({
          eventType: "PURCHASE_RECORDED",
          entityId: purchaseId,
          payload: {
            purchaseRecord,
            purchaseItems,
            movements,
          },
        })
      );
    }
  );

  void synchronizePendingOutbox();
  return purchaseRecord;
}

