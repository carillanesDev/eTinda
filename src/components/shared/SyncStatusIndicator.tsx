"use client";

import * as React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  RefreshCw,
  ShieldCheck,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  resolveConflictOutboxEvent,
  synchronizePendingOutbox,
} from "@/features/sync/syncEngine";
import { useSyncSummary } from "@/hooks/useSyncSummary";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils/cn";
import { useSessionStore } from "@/stores/useSessionStore";
import { useUIStore } from "@/stores/useUIStore";

export function SyncStatusIndicator() {
  const summary = useSyncSummary();
  const isSyncSheetOpen = useUIStore((s) => s.isSyncSheetOpen);
  const setSyncSheetOpen = useUIStore((s) => s.setSyncSheetOpen);
  const setSimulatedOffline = useUIStore((s) => s.setSimulatedOffline);
  const setSimulateServerSyncFailure = useUIStore(
    (s) => s.setSimulateServerSyncFailure
  );
  const role = useSessionStore((s) => s.role);
  const canResolveConflicts = hasPermission(role, "RESOLVE_SYNC_CONFLICTS");

  // Clear any previously persisted test simulation toggles on production mount
  React.useEffect(() => {
    setSimulatedOffline(false);
    setSimulateServerSyncFailure(false);
  }, [setSimulatedOffline, setSimulateServerSyncFailure]);

  // Close dropdown on Escape key press
  React.useEffect(() => {
    if (!isSyncSheetOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSyncSheetOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSyncSheetOpen, setSyncSheetOpen]);

  const getVisualConfig = () => {
    switch (summary.state) {
      case "ONLINE_SYNCED":
        return {
          label: "Synced",
          shortLabel: "Synced",
          className:
            "bg-primary-muted text-primary-muted-foreground border-emerald-300",
          icon: <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />,
        };
      case "OFFLINE":
        return {
          label: "Offline Mode",
          shortLabel: "Offline",
          className: "bg-slate-200 text-slate-800 border-slate-300",
          icon: <WifiOff className="h-3.5 w-3.5 shrink-0 text-slate-700" />,
        };
      case "PENDING_SYNC":
        return {
          label: `Pending (${summary.totalOutboxCount})`,
          shortLabel: `Pending (${summary.totalOutboxCount})`,
          className:
            "bg-warning-muted text-warning-muted-foreground border-amber-300",
          icon: <CloudUpload className="h-3.5 w-3.5 shrink-0 text-warning" />,
        };
      case "SYNCING":
        return {
          label: `Syncing (${summary.totalOutboxCount})...`,
          shortLabel: "Syncing...",
          className: "bg-info-muted text-info-muted-foreground border-blue-300",
          icon: (
            <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-info" />
          ),
        };
      case "SYNC_FAILED":
        return {
          label: `Retry (${summary.totalOutboxCount})`,
          shortLabel: `Retry (${summary.totalOutboxCount})`,
          className:
            "bg-destructive-muted text-destructive-muted-foreground border-red-300",
          icon: <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />,
        };
      case "CONFLICT_REQUIRED":
        return {
          label: `Conflict (${summary.conflictCount})`,
          shortLabel: `Conflict (${summary.conflictCount})`,
          className:
            "bg-destructive text-destructive-foreground border-red-800",
          icon: <AlertTriangle className="h-3.5 w-3.5 shrink-0" />,
        };
    }
  };

  const config = getVisualConfig();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setSyncSheetOpen(!isSyncSheetOpen)}
        data-testid="sync-status-indicator"
        aria-expanded={isSyncSheetOpen}
        aria-label={`Synchronization status: ${config.label}. Click to toggle details.`}
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold transition-all hover:opacity-90 cursor-pointer",
          config.className
        )}
      >
        {config.icon}
        <span className="hidden sm:inline">{config.label}</span>
        <span className="sm:hidden">{config.shortLabel}</span>
      </button>

      {isSyncSheetOpen ? (
        <>
          {/* Backdrop covering main page below the top navbar */}
          <div
            className="fixed inset-x-0 bottom-0 top-14 md:top-16 z-30 bg-slate-950/40 backdrop-blur-[1px]"
            onClick={() => setSyncSheetOpen(false)}
            aria-hidden="true"
          />

          {/* Anchored Dropdown Panel covering main page below top navbar */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sync-dropdown-title"
            className="fixed inset-x-3 top-16 z-40 flex max-h-[calc(100dvh-5.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[480px]"
          >
            {/* Dropdown Header */}
            <div className="flex items-start justify-between border-b border-border bg-card px-4 py-3">
              <div className="min-w-0 flex-1 pr-2">
                <h2
                  id="sync-dropdown-title"
                  className="text-sm font-bold text-foreground md:text-base"
                >
                  Offline & Synchronization Center
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                  Local IndexedDB transactions reconciled with the PostgreSQL server.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSyncSheetOpen(false)}
                data-testid="sync-dialog-close-btn"
                aria-label="Close sync details"
                className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border bg-muted/60 px-2.5 text-xs font-semibold text-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
                <span>Close</span>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Current Status Card */}
              <div className="rounded-xl border border-border bg-muted/50 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {summary.isOnline ? (
                      <Wifi className="h-5 w-5 text-primary shrink-0" />
                    ) : (
                      <WifiOff className="h-5 w-5 text-warning shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {summary.isOnline
                          ? "Network Connected"
                          : "Working Offline (IndexedDB Active)"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last Server Sync:{" "}
                        {summary.lastSuccessfulSyncAt
                          ? new Date(summary.lastSuccessfulSyncAt).toLocaleString(
                              "en-PH",
                              {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              }
                            )
                          : "Not synced yet"}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => void synchronizePendingOutbox()}
                    disabled={!summary.isOnline || summary.state === "SYNCING"}
                    data-testid="manual-sync-button"
                  >
                    <RefreshCw
                      className={cn(
                        "h-4 w-4 shrink-0",
                        summary.state === "SYNCING" && "animate-spin"
                      )}
                    />
                    Sync Now ({summary.totalOutboxCount})
                  </Button>
                </div>

                {summary.lastError ? (
                  <div
                    className="mt-3 rounded-lg border border-red-300 bg-destructive-muted p-2.5 text-xs text-destructive-muted-foreground"
                    role="alert"
                  >
                    <strong>Sync Notice:</strong> {summary.lastError}
                  </div>
                ) : null}
              </div>

              {/* Outbox Queue List */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    Persistent Local Sync Outbox ({summary.outboxEvents.length})
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Idempotent UUID Events
                  </span>
                </div>

                {summary.outboxEvents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center">
                    <ShieldCheck className="mx-auto h-7 w-7 text-primary" />
                    <p className="mt-1.5 text-sm font-medium text-foreground">
                      Outbox is empty — all local records are server-acknowledged.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                    {summary.outboxEvents.map((evt) => (
                      <div
                        key={evt.eventId}
                        className="rounded-lg border border-border bg-card p-3 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-foreground">
                            {evt.eventType}
                          </span>
                          <Badge
                            variant={
                              evt.status === "CONFLICT" || evt.status === "FAILED"
                                ? "destructive"
                                : "warning"
                            }
                          >
                            {evt.status}
                          </Badge>
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                          Event UUID: {evt.eventId}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Created:{" "}
                          {new Date(evt.createdAt).toLocaleTimeString("en-PH")} •
                          Retries: {evt.retryCount}
                        </p>
                        {evt.conflictReason ? (
                          <div className="mt-2 rounded bg-destructive-muted p-2 text-destructive-muted-foreground">
                            <p className="font-medium">{evt.conflictReason}</p>
                            {canResolveConflicts ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-2 h-8 text-xs"
                                onClick={() =>
                                  void resolveConflictOutboxEvent(
                                    evt.eventId,
                                    "Physical shelf count verified by Store Owner"
                                  )
                                }
                              >
                                Verify & Mark Reconciled
                              </Button>
                            ) : (
                              <p className="mt-1 text-[11px] italic">
                                Ask the Store Owner to review and reconcile this
                                stock discrepancy.
                              </p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Dropdown Footer */}
            <div className="flex items-center justify-end border-t border-border bg-muted/30 px-4 py-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSyncSheetOpen(false)}
                data-testid="sync-dialog-close-btn-footer"
              >
                Close
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
