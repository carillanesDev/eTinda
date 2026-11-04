"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useUIStore } from "@/stores/useUIStore";
import type { GlobalSyncState, SyncEvent } from "@/types/domain";

export interface SyncSummary {
  state: GlobalSyncState;
  isOnline: boolean;
  pendingCount: number;
  conflictCount: number;
  failedCount: number;
  totalOutboxCount: number;
  outboxEvents: SyncEvent[];
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
}

export function useSyncSummary(): SyncSummary {
  const { isOnline } = useOnlineStatus();
  const isSyncingNow = useUIStore((s) => s.isSyncingNow);
  const lastSyncError = useUIStore((s) => s.lastSyncError);

  const outboxEvents =
    useLiveQuery(async () => {
      return db.sync_outbox.orderBy("createdAt").reverse().toArray();
    }, []) ?? [];

  const lastSyncRecord = useLiveQuery(async () => {
    return db.sync_metadata.get("lastSuccessfulSyncAt");
  }, []);

  const pendingCount = outboxEvents.filter(
    (e) => e.status === "PENDING" || e.status === "SYNCING"
  ).length;
  const conflictCount = outboxEvents.filter(
    (e) => e.status === "CONFLICT"
  ).length;
  const failedCount = outboxEvents.filter((e) => e.status === "FAILED").length;
  const totalOutboxCount = outboxEvents.length;

  let state: GlobalSyncState = "ONLINE_SYNCED";

  if (conflictCount > 0) {
    state = "CONFLICT_REQUIRED";
  } else if (isSyncingNow) {
    state = "SYNCING";
  } else if (!isOnline) {
    state = pendingCount + failedCount > 0 ? "PENDING_SYNC" : "OFFLINE";
  } else if (failedCount > 0 || lastSyncError) {
    state = "SYNC_FAILED";
  } else if (pendingCount > 0) {
    state = "PENDING_SYNC";
  } else {
    state = "ONLINE_SYNCED";
  }

  return {
    state,
    isOnline,
    pendingCount,
    conflictCount,
    failedCount,
    totalOutboxCount,
    outboxEvents,
    lastSuccessfulSyncAt: lastSyncRecord?.value ?? null,
    lastError: lastSyncError,
  };
}

