"use client";

import * as React from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Clock,
  PackagePlus,
  ReceiptText,
  ShoppingCart,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import {
  RecordSyncBadge,
  StockStatusBadge,
} from "@/components/shared/StatusBadges";
import { useSyncSummary } from "@/hooks/useSyncSummary";
import { db } from "@/lib/db/dexie";
import { hasPermission } from "@/lib/permissions";
import { sumCentavos } from "@/lib/utils/money";
import { useSessionStore } from "@/stores/useSessionStore";

export default function DashboardPage() {
  const role = useSessionStore((s) => s.role);
  const canViewMargins = hasPermission(role, "VIEW_FINANCIAL_MARGINS");
  const syncSummary = useSyncSummary();

  const sales =
    useLiveQuery(async () => {
      return db.sales.orderBy("createdAt").reverse().toArray();
    }, []) ?? [];

  const saleItems = useLiveQuery(async () => db.sale_items.toArray(), []) ?? [];

  const products =
    useLiveQuery(async () => {
      return db.products.filter((p) => p.isActive).toArray();
    }, []) ?? [];

  const utangAccounts =
    useLiveQuery(async () => {
      return db.utang_accounts.toArray();
    }, []) ?? [];

  const completedSales = sales.filter((s) => s.status === "COMPLETED");

  const totalSalesCentavos = sumCentavos(
    completedSales.map((s) => s.totalCentavos)
  );
  const syncedSalesCentavos = sumCentavos(
    completedSales
      .filter((s) => s.syncStatus === "SYNCED")
      .map((s) => s.totalCentavos)
  );
  const pendingLocalSalesCentavos = sumCentavos(
    completedSales
      .filter((s) => s.syncStatus !== "SYNCED")
      .map((s) => s.totalCentavos)
  );

  // Gross margin calculation from preserved sale_items historical cost snapshots (Owner only)
  const completedSaleIds = new Set(completedSales.map((s) => s.id));
  const activeSaleItems = saleItems.filter((item) =>
    completedSaleIds.has(item.saleId)
  );
  const totalCogsCentavos = sumCentavos(
    activeSaleItems.map((item) =>
      Math.round(item.unitCostSnapshotCentavos * item.quantity)
    )
  );
  const estimatedGrossProfitCentavos = totalSalesCentavos - totalCogsCentavos;

  const lowOrOutStockProducts = products
    .filter((p) => p.cachedStock <= p.lowStockThreshold || p.hasOversellConflict)
    .sort((a, b) => a.cachedStock - b.cachedStock);

  const totalUtangCentavos = sumCentavos(
    utangAccounts.map((acc) => Math.max(0, acc.cachedBalanceCentavos))
  );
  const pendingUtangAccountsCount = utangAccounts.filter(
    (a) => a.hasPendingSyncEntries
  ).length;

  return (
    <div className="space-y-5">
      {/* Quick Action Strip for Mobile/Tablet Store Operations */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Link
          href="/pos"
          className="flex min-h-13 items-center gap-2.5 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary-hover"
        >
          <ShoppingCart className="h-5 w-5 shrink-0" />
          <span>New POS Sale</span>
        </Link>
        <Link
          href="/inventory"
          className="flex min-h-13 items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted"
        >
          <PackagePlus className="h-5 w-5 shrink-0 text-primary" />
          <span>Receive / Adjust Stock</span>
        </Link>
        <Link
          href="/utang"
          className="flex min-h-13 items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted"
        >
          <WalletCards className="h-5 w-5 shrink-0 text-warning" />
          <span>Record Utang Payment</span>
        </Link>
        <Link
          href="/sales"
          className="flex min-h-13 items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted"
        >
          <ReceiptText className="h-5 w-5 shrink-0 text-info" />
          <span>Sales Receipts</span>
        </Link>
      </div>

      {/* Pending Sync / Offline Notice Banner (DESIGNS.md Section 6) */}
      {(!syncSummary.isOnline || syncSummary.totalOutboxCount > 0) && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-warning-muted/80 px-4 py-3 text-xs text-warning-muted-foreground"
          role="status"
        >
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-warning" />
            <span>
              <strong>Local vs. Server Totals:</strong>{" "}
              {syncSummary.totalOutboxCount} operation(s) are saved in this
              device&apos;s IndexedDB and awaiting server acknowledgment.
            </span>
          </div>
          <span className="font-mono text-[11px]">
            Last Sync:{" "}
            {syncSummary.lastSuccessfulSyncAt
              ? new Date(syncSummary.lastSuccessfulSyncAt).toLocaleTimeString(
                  "en-PH"
                )
              : "Pending"}
          </span>
        </div>
      )}

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Recorded Store Sales</span>
              <ShoppingCart className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              <CurrencyDisplay centavos={totalSalesCentavos} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{completedSales.length} completed sale(s)</span>
              <span>•</span>
              <span className="text-primary font-medium">
                Confirmed: <CurrencyDisplay centavos={syncedSalesCentavos} />
              </span>
              {pendingLocalSalesCentavos > 0 ? (
                <Badge variant="warning">
                  Local Pending:{" "}
                  <CurrencyDisplay centavos={pendingLocalSalesCentavos} />
                </Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {canViewMargins ? (
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Est. Gross Profit (Owner)</span>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                <CurrencyDisplay centavos={estimatedGrossProfitCentavos} />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Cost Basis Snapshot:{" "}
                <CurrencyDisplay centavos={totalCogsCentavos} />
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Active Catalog Items</span>
                <Boxes className="h-4 w-4 text-info" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {products.length} Products
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Cached locally for instant offline POS lookup
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Outstanding Utang</span>
              <WalletCards className="h-4 w-4 text-warning" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              <CurrencyDisplay centavos={totalUtangCentavos} />
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {
                  utangAccounts.filter((a) => a.cachedBalanceCentavos > 0)
                    .length
                }{" "}
                customer(s) with balance
              </span>
              {pendingUtangAccountsCount > 0 ? (
                <Badge variant="warning">
                  {pendingUtangAccountsCount} Pending Sync
                </Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Inventory Alerts</span>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {lowOrOutStockProducts.length} Item
              {lowOrOutStockProducts.length === 1 ? "" : "s"}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {products.filter((p) => p.cachedStock <= 0).length} out of stock •{" "}
              {
                products.filter(
                  (p) => p.cachedStock > 0 && p.cachedStock <= p.lowStockThreshold
                ).length
              }{" "}
              low stock
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Two-Column Operational Details: Low Stock Alerts & Recent Transactions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Inventory Alerts Panel */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Low-Stock & Restock Alerts</CardTitle>
              <p className="text-xs text-muted-foreground">
                Derived from append-only inventory movements
              </p>
            </div>
            <Link
              href="/inventory"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Manage Stock <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {lowOrOutStockProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                All active products are above their low-stock thresholds.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {lowOrOutStockProducts.slice(0, 6).map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-2 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Threshold: {product.lowStockThreshold} {product.baseUnit} •
                        Price:{" "}
                        <CurrencyDisplay
                          centavos={product.sellingPriceCentavos}
                        />
                      </p>
                    </div>
                    <StockStatusBadge
                      stock={product.cachedStock}
                      lowStockThreshold={product.lowStockThreshold}
                      unitLabel={product.baseUnit}
                      hasOversellConflict={product.hasOversellConflict}
                      compact
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions Panel */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Recent Store Transactions</CardTitle>
              <p className="text-xs text-muted-foreground">
                Distinguishes locally saved vs. server-confirmed sales
              </p>
            </div>
            <Link
              href="/sales"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              View All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {sales.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No sales recorded yet.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {sales.slice(0, 6).map((sale) => (
                  <Link
                    key={sale.id}
                    href={`/sales/${sale.id}`}
                    className="flex items-center justify-between gap-2 py-2.5 hover:bg-muted/50 rounded-lg px-1.5 -mx-1.5 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {sale.receiptNumber}
                        </span>
                        <Badge
                          variant={
                            sale.status === "VOIDED"
                              ? "destructive"
                              : sale.paymentMethod === "CASH"
                                ? "secondary"
                                : "warning"
                          }
                        >
                          {sale.status === "VOIDED"
                            ? "VOIDED"
                            : sale.paymentMethod}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {new Date(sale.createdAt).toLocaleTimeString("en-PH", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}{" "}
                        •{" "}
                        {sale.customerNameSnapshot
                          ? `Customer: ${sale.customerNameSnapshot}`
                          : sale.userNameSnapshot}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <CurrencyDisplay
                        centavos={sale.totalCentavos}
                        className={
                          sale.status === "VOIDED"
                            ? "line-through text-muted-foreground text-sm"
                            : "text-sm text-foreground"
                        }
                      />
                      <RecordSyncBadge status={sale.syncStatus} compact />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

