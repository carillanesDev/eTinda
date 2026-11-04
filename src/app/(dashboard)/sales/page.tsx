"use client";

import * as React from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight, ReceiptText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { EmptyState, SearchInput } from "@/components/shared/StateViews";
import { RecordSyncBadge } from "@/components/shared/StatusBadges";
import { db } from "@/lib/db/dexie";
import { sumCentavos } from "@/lib/utils/money";

export default function SalesHistoryPage() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<
    "ALL" | "COMPLETED" | "VOIDED"
  >("ALL");
  const [paymentFilter, setPaymentFilter] = React.useState<
    "ALL" | "CASH" | "UTANG" | "PARTIAL_CASH_UTANG"
  >("ALL");
  const [syncFilter, setSyncFilter] = React.useState<
    "ALL" | "PENDING" | "SYNCED"
  >("ALL");

  const sales =
    useLiveQuery(async () => {
      return db.sales.orderBy("createdAt").reverse().toArray();
    }, []) ?? [];

  const filteredSales = sales.filter((sale) => {
    if (statusFilter !== "ALL" && sale.status !== statusFilter) return false;
    if (paymentFilter !== "ALL" && sale.paymentMethod !== paymentFilter)
      return false;
    if (syncFilter === "PENDING" && sale.syncStatus === "SYNCED") return false;
    if (syncFilter === "SYNCED" && sale.syncStatus !== "SYNCED") return false;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      sale.receiptNumber.toLowerCase().includes(q) ||
      (sale.customerNameSnapshot ?? "").toLowerCase().includes(q) ||
      sale.userNameSnapshot.toLowerCase().includes(q)
    );
  });

  const filteredCompletedTotal = sumCentavos(
    filteredSales
      .filter((s) => s.status === "COMPLETED")
      .map((s) => s.totalCentavos)
  );

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <Card>
        <CardContent className="p-3.5 space-y-3">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by receipt number (e.g. OR-2026), customer name, or operator..."
          />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select
              aria-label="Filter by transaction status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as "ALL" | "COMPLETED" | "VOIDED"
                )
              }
              className="min-h-10 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed Only</option>
              <option value="VOIDED">Voided / Reversed</option>
            </select>

            <select
              aria-label="Filter by payment method"
              value={paymentFilter}
              onChange={(e) =>
                setPaymentFilter(
                  e.target.value as
                    | "ALL"
                    | "CASH"
                    | "UTANG"
                    | "PARTIAL_CASH_UTANG"
                )
              }
              className="min-h-10 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground"
            >
              <option value="ALL">All Payment Methods</option>
              <option value="CASH">Cash Sales</option>
              <option value="UTANG">Full Utang (Credit)</option>
              <option value="PARTIAL_CASH_UTANG">Partial Cash + Utang</option>
            </select>

            <select
              aria-label="Filter by synchronization status"
              value={syncFilter}
              onChange={(e) =>
                setSyncFilter(e.target.value as "ALL" | "PENDING" | "SYNCED")
              }
              className="min-h-10 rounded-lg border border-input bg-card px-3 text-xs font-semibold text-foreground"
            >
              <option value="ALL">All Sync States</option>
              <option value="PENDING">Saved Locally (Pending Sync)</option>
              <option value="SYNCED">Server Confirmed (Synced)</option>
            </select>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
            <span>Showing {filteredSales.length} transaction(s)</span>
            <span>
              Active Total:{" "}
              <CurrencyDisplay
                centavos={filteredCompletedTotal}
                className="text-foreground font-bold"
              />
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Sales List */}
      {filteredSales.length === 0 ? (
        <EmptyState
          title="No matching sales records"
          description="Try adjusting your filters or record a new transaction in POS."
          icon={<ReceiptText className="h-6 w-6" />}
        />
      ) : (
        <div className="space-y-2.5">
          {filteredSales.map((sale) => (
            <Link
              key={sale.id}
              href={`/sales/${sale.id}`}
              className="block rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-primary/50 hover:bg-muted/30"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-foreground">
                      {sale.receiptNumber}
                    </span>
                    <Badge
                      variant={
                        sale.status === "VOIDED"
                          ? "destructive"
                          : sale.paymentMethod === "CASH"
                            ? "default"
                            : "warning"
                      }
                    >
                      {sale.status === "VOIDED" ? "VOIDED" : sale.paymentMethod}
                    </Badge>
                    <RecordSyncBadge status={sale.syncStatus} compact />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(sale.createdAt).toLocaleString("en-PH")} •
                    Operator: {sale.userNameSnapshot}
                    {sale.customerNameSnapshot
                      ? ` • Customer: ${sale.customerNameSnapshot}`
                      : ""}
                  </p>
                  {sale.voidReason ? (
                    <p className="text-xs font-medium text-destructive">
                      Void Reason: {sale.voidReason}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <CurrencyDisplay
                      centavos={sale.totalCentavos}
                      className={
                        sale.status === "VOIDED"
                          ? "text-base font-bold line-through text-muted-foreground"
                          : "text-base font-extrabold text-foreground"
                      }
                    />
                    {sale.utangChargedCentavos > 0 ? (
                      <p className="text-[11px] font-medium text-warning">
                        Utang:{" "}
                        <CurrencyDisplay centavos={sale.utangChargedCentavos} />
                      </p>
                    ) : null}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

