"use client";

import { db } from "@/lib/db/dexie";
import { hasPermission } from "@/lib/permissions";
import { generateUuid } from "@/lib/utils/uuid";
import {
  customerFormSchema,
  utangAdjustmentSchema,
  utangPaymentSchema,
} from "@/lib/validation/schemas";
import {
  createSyncEvent,
  synchronizePendingOutbox,
} from "@/features/sync/syncEngine";
import { useSessionStore } from "@/stores/useSessionStore";
import type {
  CustomerEntity,
  PaymentEntity,
  UtangAccountEntity,
  UtangLedgerEntryEntity,
} from "@/types/domain";
import type { z } from "zod";

export async function upsertCustomer(
  rawInput: z.infer<typeof customerFormSchema>,
  existingCustomerId?: string
): Promise<CustomerEntity> {
  const session = useSessionStore.getState();
  const input = customerFormSchema.parse(rawInput);
  const nowIso = new Date().toISOString();
  const customerId = existingCustomerId ?? generateUuid();

  let savedCustomer!: CustomerEntity;

  await db.transaction(
    "rw",
    [db.customers, db.utang_accounts, db.sync_outbox],
    async () => {
      const existing = existingCustomerId
        ? await db.customers.get(existingCustomerId)
        : undefined;

      savedCustomer = {
        id: customerId,
        storeId: session.storeId,
        name: input.name,
        contactNumber: input.contactNumber,
        syncStatus: "PENDING",
        createdAt: existing ? existing.createdAt : nowIso,
        updatedAt: nowIso,
      };

      await db.customers.put(savedCustomer);

      const existingAccount = await db.utang_accounts
        .where("customerId")
        .equals(customerId)
        .first();

      if (existingAccount) {
        await db.utang_accounts.update(existingAccount.id, {
          customerNameSnapshot: input.name,
          contactNumberSnapshot: input.contactNumber,
          updatedAt: nowIso,
        });
      } else {
        const account: UtangAccountEntity = {
          id: generateUuid(),
          storeId: session.storeId,
          customerId,
          customerNameSnapshot: input.name,
          contactNumberSnapshot: input.contactNumber,
          cachedBalanceCentavos: 0,
          hasPendingSyncEntries: false,
          needsReconciliation: false,
          updatedAt: nowIso,
        };
        await db.utang_accounts.put(account);
      }

      await db.sync_outbox.put(
        createSyncEvent({
          eventType: "CUSTOMER_UPSERTED",
          entityId: customerId,
          payload: savedCustomer,
        })
      );
    }
  );

  void synchronizePendingOutbox();
  return savedCustomer;
}

/**
 * Records a Customer Utang Payment (full or partial) per AGENTS.md Section 9:
 * - Payment ledger entry = negative signed centavos (-amountCentavos)
 * - Outstanding balance is the sum of valid ledger entries.
 */
export async function recordUtangPayment(
  rawInput: z.infer<typeof utangPaymentSchema>
): Promise<UtangLedgerEntryEntity> {
  const session = useSessionStore.getState();
  const input = utangPaymentSchema.parse(rawInput);
  const nowIso = new Date().toISOString();

  let ledgerEntry!: UtangLedgerEntryEntity;

  await db.transaction(
    "rw",
    [
      db.customers,
      db.utang_accounts,
      db.utang_ledger,
      db.payments,
      db.audit_logs,
      db.sync_outbox,
    ],
    async () => {
      const customer = await db.customers.get(input.customerId);
      if (!customer) {
        throw new Error("Customer not found.");
      }

      let account = await db.utang_accounts
        .where("customerId")
        .equals(customer.id)
        .first();

      if (!account) {
        account = {
          id: generateUuid(),
          storeId: session.storeId,
          customerId: customer.id,
          customerNameSnapshot: customer.name,
          contactNumberSnapshot: customer.contactNumber,
          cachedBalanceCentavos: 0,
          hasPendingSyncEntries: true,
          needsReconciliation: false,
          updatedAt: nowIso,
        };
        await db.utang_accounts.put(account);
      }

      // Pre-Database Decision #5: Cap standard Helper UTANG_PAYMENT entries at outstanding balance
      if (
        session.role === "HELPER" &&
        account.cachedBalanceCentavos >= 0 &&
        input.amountCentavos > account.cachedBalanceCentavos
      ) {
        throw new Error(
          "Helper payment cannot exceed the customer's current outstanding Utang balance."
        );
      }

      const paymentId = generateUuid();
      const ledgerId = generateUuid();
      const signedCentavos = -Math.abs(input.amountCentavos); // Negative for PAYMENT per AGENTS.md §9
      const nextBalance = account.cachedBalanceCentavos + signedCentavos;

      const paymentRecord: PaymentEntity = {
        id: paymentId,
        storeId: session.storeId,
        customerId: customer.id,
        customerNameSnapshot: customer.name,
        amountCentavos: input.amountCentavos,
        paymentType: "UTANG_PAYMENT",
        notes: input.notes || "Customer utang payment",
        deviceId: session.deviceId,
        userId: session.userId,
        userNameSnapshot: session.userName,
        syncStatus: "PENDING",
        createdAt: nowIso,
      };

      ledgerEntry = {
        id: ledgerId,
        storeId: session.storeId,
        utangAccountId: account.id,
        customerId: customer.id,
        customerNameSnapshot: customer.name,
        entryType: "PAYMENT",
        signedAmountCentavos: signedCentavos,
        runningBalanceSnapshotCentavos: nextBalance,
        referencePaymentId: paymentId,
        notes: input.notes || "Customer cash payment toward utang balance",
        deviceId: session.deviceId,
        userId: session.userId,
        userNameSnapshot: session.userName,
        syncStatus: "PENDING",
        createdAt: nowIso,
      };

      await db.payments.put(paymentRecord);
      await db.utang_ledger.put(ledgerEntry);
      await db.utang_accounts.update(account.id, {
        cachedBalanceCentavos: nextBalance,
        hasPendingSyncEntries: true,
        updatedAt: nowIso,
      });

      await db.audit_logs.put({
        id: generateUuid(),
        storeId: session.storeId,
        deviceId: session.deviceId,
        userId: session.userId,
        userNameSnapshot: session.userName,
        userRole: session.role,
        action: "UTANG_PAYMENT_RECORDED",
        entityType: "UTANG_LEDGER",
        entityId: ledgerId,
        summary: `Recorded utang payment for ${customer.name}`,
        createdAt: nowIso,
      });

      await db.sync_outbox.put(
        createSyncEvent({
          eventType: "UTANG_LEDGER_RECORDED",
          entityId: ledgerId,
          payload: {
            ledgerEntry,
            paymentRecord,
          },
        })
      );
    }
  );

  void synchronizePendingOutbox();
  return ledgerEntry;
}

/**
 * Owner-only Utang Balance Adjustment (AGENTS.md Section 9).
 */
export async function recordUtangAdjustment(
  rawInput: z.infer<typeof utangAdjustmentSchema>
): Promise<UtangLedgerEntryEntity> {
  const session = useSessionStore.getState();
  if (!hasPermission(session.role, "ADJUST_UTANG_BALANCE")) {
    throw new Error("Only the Store Owner can post manual ledger adjustments.");
  }

  const input = utangAdjustmentSchema.parse(rawInput);
  const nowIso = new Date().toISOString();
  let ledgerEntry!: UtangLedgerEntryEntity;

  await db.transaction(
    "rw",
    [
      db.customers,
      db.utang_accounts,
      db.utang_ledger,
      db.audit_logs,
      db.sync_outbox,
    ],
    async () => {
      const customer = await db.customers.get(input.customerId);
      if (!customer) {
        throw new Error("Customer not found.");
      }

      const account = await db.utang_accounts
        .where("customerId")
        .equals(customer.id)
        .first();
      if (!account) {
        throw new Error("Utang account not found.");
      }

      const ledgerId = generateUuid();
      const nextBalance =
        account.cachedBalanceCentavos + input.signedAmountCentavos;

      ledgerEntry = {
        id: ledgerId,
        storeId: session.storeId,
        utangAccountId: account.id,
        customerId: customer.id,
        customerNameSnapshot: customer.name,
        entryType: "ADJUSTMENT",
        signedAmountCentavos: input.signedAmountCentavos,
        runningBalanceSnapshotCentavos: nextBalance,
        notes: input.notes,
        deviceId: session.deviceId,
        userId: session.userId,
        userNameSnapshot: session.userName,
        syncStatus: "PENDING",
        createdAt: nowIso,
      };

      await db.utang_ledger.put(ledgerEntry);
      await db.utang_accounts.update(account.id, {
        cachedBalanceCentavos: nextBalance,
        hasPendingSyncEntries: true,
        updatedAt: nowIso,
      });

      await db.audit_logs.put({
        id: generateUuid(),
        storeId: session.storeId,
        deviceId: session.deviceId,
        userId: session.userId,
        userNameSnapshot: session.userName,
        userRole: session.role,
        action: "UTANG_ADJUSTMENT_RECORDED",
        entityType: "UTANG_LEDGER",
        entityId: ledgerId,
        summary: `Adjusted ${customer.name} utang ledger (${input.notes})`,
        createdAt: nowIso,
      });

      await db.sync_outbox.put(
        createSyncEvent({
          eventType: "UTANG_LEDGER_RECORDED",
          entityId: ledgerId,
          payload: { ledgerEntry },
        })
      );
    }
  );

  void synchronizePendingOutbox();
  return ledgerEntry;
}

