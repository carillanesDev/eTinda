import * as React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PackageCheck,
  PackageMinus,
  PackageX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatQuantity } from "@/lib/utils/quantity";
import type { RecordSyncStatus } from "@/types/domain";

export interface StockStatusBadgeProps {
  stock: number;
  lowStockThreshold: number;
  unitLabel: string;
  hasOversellConflict?: boolean;
  compact?: boolean;
}

export function StockStatusBadge({
  stock,
  lowStockThreshold,
  unitLabel,
  hasOversellConflict = false,
  compact = false,
}: StockStatusBadgeProps) {
  const formattedQty = formatQuantity(stock, unitLabel);

  if (stock < 0 || hasOversellConflict) {
    return (
      <Badge variant="destructive" title="Offline oversell discrepancy">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          {compact ? `${formattedQty} (Oversold)` : `Oversold • ${formattedQty}`}
        </span>
      </Badge>
    );
  }

  if (stock === 0) {
    return (
      <Badge variant="destructive">
        <PackageX className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{compact ? "0 Stock" : `Out of Stock (0 ${unitLabel})`}</span>
      </Badge>
    );
  }

  if (stock <= lowStockThreshold) {
    return (
      <Badge variant="warning">
        <PackageMinus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{compact ? `Low • ${formattedQty}` : `Low Stock • ${formattedQty}`}</span>
      </Badge>
    );
  }

  return (
    <Badge variant="default">
      <PackageCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{formattedQty}</span>
    </Badge>
  );
}

export interface RecordSyncBadgeProps {
  status: RecordSyncStatus;
  compact?: boolean;
}

export function RecordSyncBadge({
  status,
  compact = false,
}: RecordSyncBadgeProps) {
  switch (status) {
    case "SYNCED":
      return (
        <Badge variant="default">
          <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{compact ? "Synced" : "Server Synced"}</span>
        </Badge>
      );
    case "PENDING":
    case "SYNCING":
      return (
        <Badge variant="warning">
          <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>
            {compact ? "Pending Sync" : "Saved Locally • Pending Sync"}
          </span>
        </Badge>
      );
    case "FAILED":
      return (
        <Badge variant="destructive">
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{compact ? "Sync Retry" : "Local Saved • Retry Queued"}</span>
        </Badge>
      );
    case "CONFLICT":
      return (
        <Badge variant="destructive">
          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>
            {compact ? "Conflict" : "Requires Reconciliation"}
          </span>
        </Badge>
      );
  }
}

