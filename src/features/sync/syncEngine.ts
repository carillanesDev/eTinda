"use client";

import { db } from "@/lib/db/dexie";
import {
  DEFAULT_DEVICE_ID,
  DEFAULT_OWNER_ID,
  DEFAULT_STORE_ID,
} from "@/lib/db/seed-local";
import { generateUuid } from "@/lib/utils/uuid";
import { uuidSchema } from "@/lib/validation/schemas";
import { useSessionStore } from "@/stores/useSessionStore";
import { useUIStore } from "@/stores/useUIStore";
import type {
  CategoryEntity,
  CustomerEntity,
  DeviceEntity,
  ProductEntity,
  ProductVariantEntity,
  RecordSyncStatus,
  SyncEvent,
  SyncEventType,
  UtangAccountEntity,
  UtangLedgerEntryEntity,
} from "@/types/domain";

function ensureValidUuid(candidate: string | undefined, fallback: string): string {
  return candidate && uuidSchema.safeParse(candidate).success
    ? candidate
    : fallback;
}

export function createSyncEvent<TPayload>(params: {
  eventType: SyncEventType;
  entityId: string;
  payload: TPayload;
}): SyncEvent<TPayload> {
  const session = useSessionStore.getState();
  const eventId = generateUuid();

  return {
    eventId,
    storeId: ensureValidUuid(session.storeId, DEFAULT_STORE_ID),
    deviceId: ensureValidUuid(session.deviceId, DEFAULT_DEVICE_ID),
    userId: ensureValidUuid(session.userId, DEFAULT_OWNER_ID),
    eventType: params.eventType,
    entityId: ensureValidUuid(params.entityId, generateUuid()),
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    payload: params.payload,
    status: "PENDING",
    retryCount: 0,
  };
}

let activeSyncPromise: Promise<{
  syncedCount: number;
  conflictCount: number;
  failedCount: number;
  error?: string;
}> | null = null;

/**
 * Synchronizes all pending or retryable events in `db.sync_outbox` with `/api/sync`.
 * Never marks an event as synchronized before receiving a valid server acknowledgment (AGENTS.md §10).
 */
export async function synchronizePendingOutbox(): Promise<{
  syncedCount: number;
  conflictCount: number;
  failedCount: number;
  error?: string;
}> {
  if (typeof window === "undefined") {
    return { syncedCount: 0, conflictCount: 0, failedCount: 0 };
  }

  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  const uiState = useUIStore.getState();
  const session = useSessionStore.getState();

  const isBrowserOnline =
    typeof navigator !== "undefined" ? navigator.onLine : true;

  if (!isBrowserOnline || uiState.simulatedOffline) {
    return {
      syncedCount: 0,
      conflictCount: 0,
      failedCount: 0,
      error: "Device is currently offline. Outbox events remain safely queued.",
    };
  }

  activeSyncPromise = (async () => {
    try {
      const pendingEvents = await db.sync_outbox
        .where("status")
        .anyOf(["PENDING", "FAILED"])
        .sortBy("createdAt");

      if (pendingEvents.length === 0) {
        uiState.setSyncingState(false, null);
        return { syncedCount: 0, conflictCount: 0, failedCount: 0 };
      }

      uiState.setSyncingState(true, null);

      const resolvedStoreId = ensureValidUuid(session.storeId, DEFAULT_STORE_ID);
      const resolvedDeviceId = ensureValidUuid(
        session.deviceId,
        DEFAULT_DEVICE_ID
      );
      const resolvedUserId = ensureValidUuid(session.userId, DEFAULT_OWNER_ID);

      const response = await fetch("/api/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-etinda-user-id": resolvedUserId,
          "x-etinda-user-role": session.role,
          "x-etinda-store-id": resolvedStoreId,
          "x-etinda-device-id": resolvedDeviceId,
        },
        body: JSON.stringify({
          storeId: resolvedStoreId,
          deviceId: resolvedDeviceId,
          storeName: session.storeName,
          deviceName: session.deviceName,
          actorUser: {
            id: resolvedUserId,
            name: session.userName || "Store Operator",
            email: session.email || undefined,
            username: session.username || undefined,
            role: session.role,
          },
          isDeviceAuthorized: session.isDeviceAuthorized,
          simulateFailure: uiState.simulateServerSyncFailure,
          events: pendingEvents.map((e) => ({
            eventId: ensureValidUuid(e.eventId, generateUuid()),
            storeId: ensureValidUuid(e.storeId, resolvedStoreId),
            deviceId: ensureValidUuid(e.deviceId, resolvedDeviceId),
            userId: ensureValidUuid(e.userId, resolvedUserId),
            eventType: e.eventType,
            entityId: ensureValidUuid(e.entityId, generateUuid()),
            schemaVersion: e.schemaVersion,
            createdAt: e.createdAt,
            payload: e.payload,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        const errMessage =
          data?.error || `Synchronization failed (${response.status})`;

        await db.transaction("rw", db.sync_outbox, async () => {
          for (const evt of pendingEvents) {
            await db.sync_outbox.update(evt.eventId, {
              status: "FAILED",
              retryCount: (evt.retryCount ?? 0) + 1,
              lastError: errMessage,
            });
          }
        });

        uiState.setSyncingState(false, errMessage);
        return {
          syncedCount: 0,
          conflictCount: 0,
          failedCount: pendingEvents.length,
          error: errMessage,
        };
      }

      let syncedCount = 0;
      let conflictCount = 0;

      const acknowledgments: Array<{
        eventId: string;
        entityId: string;
        eventType: SyncEventType;
        sequenceNumber?: number;
        status: "ACKNOWLEDGED" | "CONFLICT" | "REJECTED";
        acknowledgedAt: string;
        conflictReason?: string;
        serverProductSnapshots?: Array<{
          productId: string;
          cachedStock: number;
          hasOversellConflict: boolean;
          latestCostCentavos: number;
        }>;
        serverUtangSnapshot?: {
          utangAccountId: string;
          customerId: string;
          cachedBalanceCentavos: number;
          needsReconciliation: boolean;
          runningBalanceSnapshotCentavos: number;
        };
      }> = data.acknowledgments ?? [];

      await db.transaction(
        "rw",
        [
          db.sync_outbox,
          db.sync_metadata,
          db.sales,
          db.payments,
          db.products,
          db.categories,
          db.product_variants,
          db.inventory_movements,
          db.purchase_records,
          db.customers,
          db.utang_accounts,
          db.utang_ledger,
        ],
        async () => {
          for (const ack of acknowledgments) {
            const targetSyncStatus: RecordSyncStatus =
              ack.status === "CONFLICT" ? "CONFLICT" : "SYNCED";

            if (ack.status === "ACKNOWLEDGED") {
              syncedCount += 1;
              await db.sync_outbox.delete(ack.eventId);
            } else {
              conflictCount += 1;
              await db.sync_outbox.update(ack.eventId, {
                status: "CONFLICT",
                conflictReason: ack.conflictReason,
                acknowledgedAt: ack.acknowledgedAt,
              });
            }

            // Apply server-authoritative product stock & cost snapshots if returned
            if (Array.isArray(ack.serverProductSnapshots)) {
              for (const snap of ack.serverProductSnapshots) {
                await db.products.update(snap.productId, {
                  cachedStock: snap.cachedStock,
                  hasOversellConflict: snap.hasOversellConflict,
                  latestCostCentavos: snap.latestCostCentavos,
                  syncStatus: snap.hasOversellConflict ? "CONFLICT" : "SYNCED",
                });
              }
            }

            // Apply server-authoritative Utang balance snapshot if returned
            if (ack.serverUtangSnapshot) {
              await db.utang_accounts.update(
                ack.serverUtangSnapshot.utangAccountId,
                {
                  cachedBalanceCentavos:
                    ack.serverUtangSnapshot.cachedBalanceCentavos,
                  needsReconciliation:
                    ack.serverUtangSnapshot.needsReconciliation,
                  hasPendingSyncEntries: false,
                }
              );
            }

            // Reconcile entity syncStatus upon explicit server acknowledgment
            switch (ack.eventType) {
              case "SALE_CREATED":
              case "SALE_VOIDED": {
                await db.sales.update(ack.entityId, {
                  syncStatus: targetSyncStatus,
                  conflictReason: ack.conflictReason,
                });
                const saleMovements = await db.inventory_movements
                  .where("referenceId")
                  .equals(ack.entityId)
                  .toArray();
                for (const mov of saleMovements) {
                  await db.inventory_movements.update(mov.id, {
                    syncStatus: targetSyncStatus,
                    conflictNote: ack.conflictReason,
                  });
                }
                const salePayments = await db.payments
                  .where("saleId")
                  .equals(ack.entityId)
                  .toArray();
                for (const pay of salePayments) {
                  await db.payments.update(pay.id, {
                    syncStatus: targetSyncStatus,
                  });
                }
                const saleLedger = await db.utang_ledger
                  .where("referenceSaleId")
                  .equals(ack.entityId)
                  .toArray();
                for (const ul of saleLedger) {
                  await db.utang_ledger.update(ul.id, {
                    syncStatus: targetSyncStatus,
                    runningBalanceSnapshotCentavos:
                      ack.serverUtangSnapshot?.runningBalanceSnapshotCentavos ??
                      ul.runningBalanceSnapshotCentavos,
                  });
                  await db.utang_accounts.update(ul.utangAccountId, {
                    hasPendingSyncEntries: false,
                    needsReconciliation:
                      ack.status === "CONFLICT" ||
                      Boolean(ack.serverUtangSnapshot?.needsReconciliation),
                  });
                }
                break;
              }
              case "PRODUCT_UPSERTED": {
                await db.products.update(ack.entityId, {
                  syncStatus: targetSyncStatus,
                });
                const openingMovements = await db.inventory_movements
                  .where("productId")
                  .equals(ack.entityId)
                  .filter((m) => m.syncStatus === "PENDING")
                  .toArray();
                for (const mov of openingMovements) {
                  await db.inventory_movements.update(mov.id, {
                    syncStatus: targetSyncStatus,
                  });
                }
                break;
              }
              case "CATEGORY_UPSERTED": {
                await db.categories.update(ack.entityId, {
                  syncStatus: targetSyncStatus,
                });
                break;
              }
              case "INVENTORY_MOVEMENT_RECORDED": {
                await db.inventory_movements.update(ack.entityId, {
                  syncStatus: targetSyncStatus,
                });
                break;
              }
              case "PURCHASE_RECORDED": {
                await db.purchase_records.update(ack.entityId, {
                  syncStatus: targetSyncStatus,
                });
                const purMovements = await db.inventory_movements
                  .where("referenceId")
                  .equals(ack.entityId)
                  .toArray();
                for (const mov of purMovements) {
                  await db.inventory_movements.update(mov.id, {
                    syncStatus: targetSyncStatus,
                  });
                }
                break;
              }
              case "CUSTOMER_UPSERTED": {
                await db.customers.update(ack.entityId, {
                  syncStatus: targetSyncStatus,
                });
                break;
              }
              case "UTANG_LEDGER_RECORDED": {
                const entry = await db.utang_ledger.get(ack.entityId);
                await db.utang_ledger.update(ack.entityId, {
                  syncStatus: targetSyncStatus,
                  runningBalanceSnapshotCentavos:
                    ack.serverUtangSnapshot?.runningBalanceSnapshotCentavos ??
                    entry?.runningBalanceSnapshotCentavos,
                });
                if (entry) {
                  if (entry.referencePaymentId) {
                    await db.payments.update(entry.referencePaymentId, {
                      syncStatus: targetSyncStatus,
                    });
                  }
                  const remainingPending = await db.utang_ledger
                    .where("utangAccountId")
                    .equals(entry.utangAccountId)
                    .filter(
                      (item) =>
                        item.id !== ack.entityId &&
                        item.syncStatus === "PENDING"
                    )
                    .count();
                  await db.utang_accounts.update(entry.utangAccountId, {
                    hasPendingSyncEntries: remainingPending > 0,
                    needsReconciliation:
                      ack.status === "CONFLICT" ||
                      Boolean(ack.serverUtangSnapshot?.needsReconciliation),
                  });
                }
                break;
              }
              default:
                break;
            }
          }

          const nowIso = new Date().toISOString();
          await db.sync_metadata.put({
            key: "lastSuccessfulSyncAt",
            value: data.serverTimestamp ?? nowIso,
            updatedAt: nowIso,
          });

          if (typeof data.lastSequenceNumber === "number") {
            await db.sync_metadata.put({
              key: "lastSequenceNumber",
              value: String(data.lastSequenceNumber),
              updatedAt: nowIso,
            });
          }
        }
      );

      uiState.setSyncingState(false, null);
      return { syncedCount, conflictCount, failedCount: 0 };
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : "Network disconnection during synchronization";
      uiState.setSyncingState(false, msg);
      return { syncedCount: 0, conflictCount: 0, failedCount: 1, error: msg };
    } finally {
      activeSyncPromise = null;
    }
  })();

  return activeSyncPromise;
}

/**
 * Pulls delta events and authoritative store snapshots from `GET /api/sync`
 * so multi-device changes (stock updates, Utang payments, catalog edits) reconcile locally.
 */
export async function pullServerDelta(): Promise<{
  ok: boolean;
  latestSequenceNumber?: number;
}> {
  if (typeof window === "undefined") {
    return { ok: false };
  }

  const uiState = useUIStore.getState();
  const session = useSessionStore.getState();
  if (uiState.simulatedOffline) {
    return { ok: false };
  }

  try {
    const seqMeta = await db.sync_metadata.get("lastSequenceNumber");
    const sinceSequenceNumber = seqMeta
      ? Number.parseInt(seqMeta.value, 10) || 0
      : 0;

    const response = await fetch(
      `/api/sync?storeId=${encodeURIComponent(
        session.storeId
      )}&deviceId=${encodeURIComponent(
        session.deviceId
      )}&sinceSequenceNumber=${sinceSequenceNumber}`
    );
    if (!response.ok) {
      return { ok: false };
    }

    const data = (await response.json()) as {
      ok: boolean;
      latestSequenceNumber: number;
      snapshot?: {
        products?: ProductEntity[];
        categories?: CategoryEntity[];
        productVariants?: ProductVariantEntity[];
        customers?: CustomerEntity[];
        utangAccounts?: UtangAccountEntity[];
        utangLedger?: UtangLedgerEntryEntity[];
        devices?: DeviceEntity[];
      };
    };

    if (!data.ok || !data.snapshot) {
      return { ok: false };
    }

    const pendingOutboxCount = await db.sync_outbox
      .where("status")
      .anyOf(["PENDING", "FAILED"])
      .count();

    // Only overwrite local cached snapshots if this device has no unpushed local mutations
    // and the server has processed sequence events beyond our local cursor
    if (pendingOutboxCount === 0 && (data.latestSequenceNumber ?? 0) > sinceSequenceNumber) {
      await db.transaction(
        "rw",
        [
          db.products,
          db.categories,
          db.product_variants,
          db.customers,
          db.utang_accounts,
          db.utang_ledger,
          db.devices,
          db.sync_metadata,
        ],
        async () => {
          if (data.snapshot?.products) {
            await db.products.bulkPut(data.snapshot.products);
          }
          if (data.snapshot?.categories) {
            await db.categories.bulkPut(data.snapshot.categories);
          }
          if (data.snapshot?.productVariants) {
            await db.product_variants.bulkPut(data.snapshot.productVariants);
          }
          if (data.snapshot?.customers) {
            await db.customers.bulkPut(data.snapshot.customers);
          }
          if (data.snapshot?.utangAccounts) {
            await db.utang_accounts.bulkPut(data.snapshot.utangAccounts);
          }
          if (data.snapshot?.utangLedger) {
            await db.utang_ledger.bulkPut(data.snapshot.utangLedger);
          }
          if (data.snapshot?.devices) {
            await db.devices.bulkPut(data.snapshot.devices);
          }
          await db.sync_metadata.put({
            key: "lastSequenceNumber",
            value: String(data.latestSequenceNumber ?? 0),
            updatedAt: new Date().toISOString(),
          });
        }
      );
    }

    return { ok: true, latestSequenceNumber: data.latestSequenceNumber };
  } catch {
    return { ok: false };
  }
}

/**
 * Resolves a flagged synchronization conflict after the Store Owner inspects and acknowledges the discrepancy.
 */
export async function resolveConflictOutboxEvent(
  eventId: string,
  resolutionNote: string
): Promise<void> {
  const session = useSessionStore.getState();
  const evt = await db.sync_outbox.get(eventId);
  if (!evt) return;

  await db.transaction(
    "rw",
    [db.sync_outbox, db.sales, db.products, db.inventory_movements, db.audit_logs],
    async () => {
      await db.sync_outbox.delete(eventId);
      if (evt.eventType === "SALE_CREATED") {
        await db.sales.update(evt.entityId, {
          syncStatus: "SYNCED",
          conflictReason: undefined,
        });
      }
      await db.audit_logs.put({
        id: generateUuid(),
        storeId: session.storeId,
        deviceId: session.deviceId,
        userId: session.userId,
        userNameSnapshot: session.userName,
        userRole: session.role,
        action: "SYNC_CONFLICT_RESOLVED",
        entityType: evt.eventType,
        entityId: evt.entityId,
        summary: `Resolved sync conflict (${eventId}): ${resolutionNote}`,
        createdAt: new Date().toISOString(),
      });
    }
  );
}
