"use client";

import { db } from "@/lib/db/dexie";
import { hasPermission } from "@/lib/permissions";
import {
  calculateCheckoutSettlement,
  calculateLineSubtotalCentavos,
  sumCentavos,
} from "@/lib/utils/money";
import { calculateBaseUnits } from "@/lib/utils/quantity";
import { generateUuid } from "@/lib/utils/uuid";
import { checkoutSubmissionSchema } from "@/lib/validation/schemas";
import {
  createSyncEvent,
  synchronizePendingOutbox,
} from "@/features/sync/syncEngine";
import { useSessionStore } from "@/stores/useSessionStore";
import type {
  CartLineItem,
  InventoryMovementEntity,
  PaymentEntity,
  PaymentMethod,
  SaleEntity,
  SaleItemEntity,
  UtangLedgerEntryEntity,
} from "@/types/domain";

export interface CompleteSaleInput {
  items: CartLineItem[];
  paymentMethod: PaymentMethod;
  cashTenderedCentavos: number;
  customerId?: string;
  notes?: string;
}

export async function completeSaleTransaction(
  input: CompleteSaleInput
): Promise<SaleEntity> {
  if (input.items.length === 0) {
    throw new Error("Cannot complete a sale with an empty cart.");
  }

  const lineSubtotals = input.items.map((item) =>
    calculateLineSubtotalCentavos(item.unitPriceCentavos, item.quantity)
  );
  const totalCentavos = sumCentavos(lineSubtotals);

  const validated = checkoutSubmissionSchema.parse({
    paymentMethod: input.paymentMethod,
    cashTenderedCentavos: input.cashTenderedCentavos,
    totalCentavos,
    customerId: input.customerId || undefined,
    notes: input.notes,
  });

  const session = useSessionStore.getState();
  const now = new Date();
  const nowIso = now.toISOString();
  const saleId = generateUuid();
  const deviceShortCode = session.deviceId.replace(/-/g, "").slice(0, 4).toUpperCase();
  const yyyymmdd = nowIso.slice(0, 10).replace(/-/g, "");
  const receiptNumber = `OR-${deviceShortCode}-${yyyymmdd}-${String(
    Math.floor(1000 + Math.random() * 9000)
  )}`;

  const settlement = calculateCheckoutSettlement({
    totalCentavos,
    cashTenderedCentavos: validated.cashTenderedCentavos,
    allowUtang:
      validated.paymentMethod === "UTANG" ||
      validated.paymentMethod === "PARTIAL_CASH_UTANG",
  });

  if (!settlement.isFullyCovered) {
    throw new Error("Payment tendered does not cover the transaction total.");
  }

  let completedSale!: SaleEntity;

  await db.transaction(
    "rw",
    [
      db.sales,
      db.sale_items,
      db.payments,
      db.products,
      db.inventory_movements,
      db.customers,
      db.utang_accounts,
      db.utang_ledger,
      db.audit_logs,
      db.sync_outbox,
    ],
    async () => {
      let customerNameSnapshot: string | undefined;
      if (validated.customerId) {
        const customer = await db.customers.get(validated.customerId);
        if (!customer) {
          throw new Error("Selected customer record was not found.");
        }
        customerNameSnapshot = customer.name;
      }

      const saleItems: SaleItemEntity[] = [];
      const inventoryMovements: InventoryMovementEntity[] = [];
      let oversoldOffline = false;

      for (let i = 0; i < input.items.length; i++) {
        const cartItem = input.items[i];
        const subtotalCentavos = lineSubtotals[i];
        const baseUnitsDeducted = calculateBaseUnits(
          cartItem.quantity,
          cartItem.baseUnitMultiplier
        );

        saleItems.push({
          id: generateUuid(),
          saleId,
          storeId: session.storeId,
          productId: cartItem.productId,
          variantId: cartItem.variantId,
          productNameSnapshot: cartItem.productName,
          unitLabelSnapshot: cartItem.unitLabel,
          quantity: cartItem.quantity,
          baseUnitMultiplier: cartItem.baseUnitMultiplier,
          unitSellingPriceCentavos: cartItem.unitPriceCentavos,
          unitCostSnapshotCentavos: cartItem.unitCostSnapshotCentavos,
          subtotalCentavos,
        });

        const product = await db.products.get(cartItem.productId);
        if (product) {
          const nextCachedStock =
            Math.round((product.cachedStock - baseUnitsDeducted) * 1000) / 1000;
          if (nextCachedStock < 0) {
            oversoldOffline = true;
          }
          await db.products.update(product.id, {
            cachedStock: nextCachedStock,
            hasOversellConflict: nextCachedStock < 0 ? true : product.hasOversellConflict,
            updatedAt: nowIso,
          });
        }

        inventoryMovements.push({
          id: generateUuid(),
          storeId: session.storeId,
          productId: cartItem.productId,
          productNameSnapshot: cartItem.productName,
          variantId: cartItem.variantId,
          movementType: "SALE_DEDUCTION",
          quantityChange: -baseUnitsDeducted,
          unitCostCentavos: cartItem.unitCostSnapshotCentavos,
          reasonOrNotes: `Sale ${receiptNumber}`,
          deviceId: session.deviceId,
          userId: session.userId,
          userNameSnapshot: session.userName,
          referenceId: saleId,
          syncStatus: "PENDING",
          createdAt: nowIso,
        });
      }

      completedSale = {
        id: saleId,
        storeId: session.storeId,
        receiptNumber,
        status: "COMPLETED",
        paymentMethod: validated.paymentMethod,
        subtotalCentavos: totalCentavos,
        totalCentavos,
        cashTenderedCentavos: validated.cashTenderedCentavos,
        changeGivenCentavos: settlement.changeDueCentavos,
        utangChargedCentavos: settlement.utangChargedCentavos,
        customerId: validated.customerId,
        customerNameSnapshot,
        deviceId: session.deviceId,
        userId: session.userId,
        userNameSnapshot: session.userName,
        syncStatus: "PENDING",
        createdAt: nowIso,
      };

      await db.sales.put(completedSale);
      await db.sale_items.bulkPut(saleItems);
      await db.inventory_movements.bulkPut(inventoryMovements);

      const paymentsRecorded: PaymentEntity[] = [];
      if (settlement.cashAppliedCentavos > 0) {
        const cashPayment: PaymentEntity = {
          id: generateUuid(),
          storeId: session.storeId,
          saleId,
          customerId: validated.customerId,
          customerNameSnapshot,
          amountCentavos: settlement.cashAppliedCentavos,
          paymentType: "SALE_CASH",
          notes: validated.notes || `Cash received for ${receiptNumber}`,
          deviceId: session.deviceId,
          userId: session.userId,
          userNameSnapshot: session.userName,
          syncStatus: "PENDING",
          createdAt: nowIso,
        };
        await db.payments.put(cashPayment);
        paymentsRecorded.push(cashPayment);
      }

      let utangLedgerEntry: UtangLedgerEntryEntity | undefined;
      if (settlement.utangChargedCentavos > 0 && validated.customerId) {
        let account = await db.utang_accounts
          .where("customerId")
          .equals(validated.customerId)
          .first();

        if (!account) {
          const cust = await db.customers.get(validated.customerId);
          account = {
            id: generateUuid(),
            storeId: session.storeId,
            customerId: validated.customerId,
            customerNameSnapshot: cust?.name ?? "Store Customer",
            contactNumberSnapshot: cust?.contactNumber ?? "",
            cachedBalanceCentavos: 0,
            hasPendingSyncEntries: true,
            needsReconciliation: false,
            updatedAt: nowIso,
          };
          await db.utang_accounts.put(account);
        }

        const nextBalance =
          account.cachedBalanceCentavos + settlement.utangChargedCentavos;

        utangLedgerEntry = {
          id: generateUuid(),
          storeId: session.storeId,
          utangAccountId: account.id,
          customerId: validated.customerId,
          customerNameSnapshot: account.customerNameSnapshot,
          entryType: "CHARGE",
          signedAmountCentavos: settlement.utangChargedCentavos, // Positive CHARGE per AGENTS.md §9
          runningBalanceSnapshotCentavos: nextBalance,
          referenceSaleId: saleId,
          notes:
            validated.notes ||
            `Utang charge from ${receiptNumber} (${input.items.length} item${
              input.items.length === 1 ? "" : "s"
            })`,
          deviceId: session.deviceId,
          userId: session.userId,
          userNameSnapshot: session.userName,
          syncStatus: "PENDING",
          createdAt: nowIso,
        };

        await db.utang_ledger.put(utangLedgerEntry);
        await db.utang_accounts.update(account.id, {
          cachedBalanceCentavos: nextBalance,
          hasPendingSyncEntries: true,
          updatedAt: nowIso,
        });
      }

      const syncEvent = createSyncEvent({
        eventType: "SALE_CREATED",
        entityId: saleId,
        payload: {
          sale: completedSale,
          saleItems,
          items: saleItems,
          movements: inventoryMovements,
          inventoryMovements,
          payments: paymentsRecorded,
          utangLedgerEntry,
          oversoldOffline,
        },
      });

      await db.sync_outbox.put(syncEvent);
    }
  );

  // Trigger non-blocking background synchronization if online
  void synchronizePendingOutbox();

  return completedSale;
}

/**
 * Non-destructive Sale Void / Reversal (AGENTS.md Section 3.3 & DESIGNS.md Section 9).
 * Never deletes historical sales; creates explicit reversal inventory movements and utang adjustments.
 */
export async function voidSaleTransaction(params: {
  saleId: string;
  voidReason: string;
}): Promise<void> {
  const session = useSessionStore.getState();
  if (!hasPermission(session.role, "VOID_SALE_TRANSACTION")) {
    throw new Error("Only the Store Owner can void or reverse completed sales.");
  }

  const trimmedReason = params.voidReason.trim();
  if (trimmedReason.length < 3) {
    throw new Error("Please provide a valid reason for voiding this transaction.");
  }

  const nowIso = new Date().toISOString();

  await db.transaction(
    "rw",
    [
      db.sales,
      db.sale_items,
      db.products,
      db.inventory_movements,
      db.utang_accounts,
      db.utang_ledger,
      db.audit_logs,
      db.sync_outbox,
    ],
    async () => {
      const sale = await db.sales.get(params.saleId);
      if (!sale) {
        throw new Error("Transaction not found.");
      }
      if (sale.status === "VOIDED") {
        throw new Error("Transaction is already voided.");
      }

      const items = await db.sale_items
        .where("saleId")
        .equals(sale.id)
        .toArray();

      await db.sales.update(sale.id, {
        status: "VOIDED",
        voidedAt: nowIso,
        voidReason: trimmedReason,
        voidedByUserId: session.userId,
        syncStatus: "PENDING",
      });

      const reversalMovements: InventoryMovementEntity[] = [];
      let reversalUtangEntry: UtangLedgerEntryEntity | undefined;

      for (const item of items) {
        const baseUnitsRestored = calculateBaseUnits(
          item.quantity,
          item.baseUnitMultiplier
        );
        const product = await db.products.get(item.productId);
        if (product) {
          const nextStock =
            Math.round((product.cachedStock + baseUnitsRestored) * 1000) / 1000;
          await db.products.update(product.id, {
            cachedStock: nextStock,
            hasOversellConflict: nextStock >= 0 ? false : product.hasOversellConflict,
            updatedAt: nowIso,
          });
        }

        const reversalMovement: InventoryMovementEntity = {
          id: generateUuid(),
          storeId: session.storeId,
          productId: item.productId,
          productNameSnapshot: item.productNameSnapshot,
          variantId: item.variantId,
          movementType: "SALE_VOID_REVERSAL",
          quantityChange: baseUnitsRestored,
          unitCostCentavos: item.unitCostSnapshotCentavos,
          reasonOrNotes: `Void reversal for ${sale.receiptNumber}: ${trimmedReason}`,
          deviceId: session.deviceId,
          userId: session.userId,
          userNameSnapshot: session.userName,
          referenceId: sale.id,
          syncStatus: "PENDING",
          createdAt: nowIso,
        };
        reversalMovements.push(reversalMovement);
        await db.inventory_movements.put(reversalMovement);
      }

      if (sale.utangChargedCentavos > 0 && sale.customerId) {
        const account = await db.utang_accounts
          .where("customerId")
          .equals(sale.customerId)
          .first();

        if (account) {
          const nextBalance =
            account.cachedBalanceCentavos - sale.utangChargedCentavos;

          reversalUtangEntry = {
            id: generateUuid(),
            storeId: session.storeId,
            utangAccountId: account.id,
            customerId: sale.customerId,
            customerNameSnapshot: account.customerNameSnapshot,
            entryType: "ADJUSTMENT",
            signedAmountCentavos: -sale.utangChargedCentavos,
            runningBalanceSnapshotCentavos: nextBalance,
            referenceSaleId: sale.id,
            notes: `Void reversal of ${sale.receiptNumber}: ${trimmedReason}`,
            deviceId: session.deviceId,
            userId: session.userId,
            userNameSnapshot: session.userName,
            syncStatus: "PENDING",
            createdAt: nowIso,
          };

          await db.utang_ledger.put(reversalUtangEntry);

          await db.utang_accounts.update(account.id, {
            cachedBalanceCentavos: nextBalance,
            hasPendingSyncEntries: true,
            updatedAt: nowIso,
          });
        }
      }

      await db.audit_logs.put({
        id: generateUuid(),
        storeId: session.storeId,
        deviceId: session.deviceId,
        userId: session.userId,
        userNameSnapshot: session.userName,
        userRole: session.role,
        action: "SALE_VOIDED",
        entityType: "SALE",
        entityId: sale.id,
        summary: `Voided ${sale.receiptNumber} (${trimmedReason})`,
        createdAt: nowIso,
      });

      await db.sync_outbox.put(
        createSyncEvent({
          eventType: "SALE_VOIDED",
          entityId: sale.id,
          payload: {
            saleId: sale.id,
            receiptNumber: sale.receiptNumber,
            voidReason: trimmedReason,
            voidedAt: nowIso,
            reversalMovements,
            reversalUtangEntry,
          },
        })
      );
    }
  );

  void synchronizePendingOutbox();
}

