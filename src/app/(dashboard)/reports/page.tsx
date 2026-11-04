"use client";

import * as React from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertTriangle,
  BarChart3,
  Lock,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { StockStatusBadge } from "@/components/shared/StatusBadges";
import { db } from "@/lib/db/dexie";
import { hasPermission } from "@/lib/permissions";
import { sumCentavos } from "@/lib/utils/money";
import { useSessionStore } from "@/stores/useSessionStore";

export default function ReportsPage() {
  const role = useSessionStore((s) => s.role);
  const canViewReports = hasPermission(role, "VIEW_OWNER_REPORTS");

  const sales =
    useLiveQuery(async () => db.sales.toArray(), []) ?? [];
  const saleItems =
    useLiveQuery(async () => db.sale_items.toArray(), []) ?? [];
  const payments =
    useLiveQuery(async () => db.payments.toArray(), []) ?? [];
  const products =
    useLiveQuery(async () => db.products.toArray(), []) ?? [];

  if (!canViewReports) {
    return (
      <Card
        data-testid="reports-permission-denied"
        className="border-red-300 bg-destructive-muted/40"
      >
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Lock className="h-8 w-8 text-destructive" />
          <h2 className="mt-3 text-lg font-bold text-foreground">
            Owner Permission Required
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Financial margin reports, historical purchase costs, and store
            reconciliation summaries are restricted to the Store Owner (ADMIN).
          </p>
          <Link
            href="/pos"
            className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            Return to Point of Sale
          </Link>
        </CardContent>
      </Card>
    );
  }

  const completedSales = sales.filter((s) => s.status === "COMPLETED");
  const completedIds = new Set(completedSales.map((s) => s.id));
  const validItems = saleItems.filter((i) => completedIds.has(i.saleId));

  const grossRevenueCentavos = sumCentavos(
    completedSales.map((s) => s.totalCentavos)
  );
  const totalCostOfGoodsCentavos = sumCentavos(
    validItems.map((i) => Math.round(i.unitCostSnapshotCentavos * i.quantity))
  );
  const grossProfitCentavos = grossRevenueCentavos - totalCostOfGoodsCentavos;
  const marginPercent =
    grossRevenueCentavos > 0
      ? ((grossProfitCentavos / grossRevenueCentavos) * 100).toFixed(1)
      : "0.0";

  const cashFromSalesCentavos = sumCentavos(
    payments
      .filter((p) => p.paymentType === "SALE_CASH")
      .map((p) => p.amountCentavos)
  );
  const utangCollectionsCentavos = sumCentavos(
    payments
      .filter((p) => p.paymentType === "UTANG_PAYMENT")
      .map((p) => p.amountCentavos)
  );
  const utangIssuedCentavos = sumCentavos(
    completedSales.map((s) => s.utangChargedCentavos)
  );

  // Aggregate top-selling items
  const productStatsMap = new Map<
    string,
    {
      name: string;
      unit: string;
      qtySold: number;
      revenueCentavos: number;
      costCentavos: number;
    }
  >();

  for (const item of validItems) {
    const existing = productStatsMap.get(item.productId) ?? {
      name: item.productNameSnapshot,
      unit: item.unitLabelSnapshot,
      qtySold: 0,
      revenueCentavos: 0,
      costCentavos: 0,
    };
    existing.qtySold =
      Math.round((existing.qtySold + item.quantity) * 1000) / 1000;
    existing.revenueCentavos += item.subtotalCentavos;
    existing.costCentavos += Math.round(
      item.unitCostSnapshotCentavos * item.quantity
    );
    productStatsMap.set(item.productId, existing);
  }

  const topProducts = Array.from(productStatsMap.values()).sort(
    (a, b) => b.revenueCentavos - a.revenueCentavos
  );

  const oversoldProducts = products.filter(
    (p) => p.cachedStock < 0 || p.hasOversellConflict
  );

  return (
    <div className="space-y-5">
      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center justify-between text-xs uppercase text-muted-foreground">
              <span>Gross Sales Revenue</span>
              <BarChart3 className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CurrencyDisplay
              centavos={grossRevenueCentavos}
              className="text-2xl font-extrabold text-foreground"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              From {completedSales.length} completed transaction(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center justify-between text-xs uppercase text-muted-foreground">
              <span>Gross Profit & Margin</span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <CurrencyDisplay
                centavos={grossProfitCentavos}
                className="text-2xl font-extrabold text-primary"
              />
              <Badge variant="default">{marginPercent}% Margin</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Historical Cost Basis:{" "}
              <CurrencyDisplay centavos={totalCostOfGoodsCentavos} />
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center justify-between text-xs uppercase text-muted-foreground">
              <span>Total Cash In Drawer</span>
              <WalletCards className="h-4 w-4 text-info" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CurrencyDisplay
              centavos={cashFromSalesCentavos + utangCollectionsCentavos}
              className="text-2xl font-extrabold text-foreground"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Sales Cash: <CurrencyDisplay centavos={cashFromSalesCentavos} /> +
              Utang Paid:{" "}
              <CurrencyDisplay centavos={utangCollectionsCentavos} /> (Utang
              Issued: <CurrencyDisplay centavos={utangIssuedCentavos} />)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Offline Overselling & Reconciliation Alert */}
      {oversoldProducts.length > 0 ? (
        <Card className="border-red-300 bg-destructive-muted/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Multi-Device Offline Overselling Discrepancies (
              {oversoldProducts.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Per AGENTS.md §7, offline sales are never discarded. Reconcile
              negative stock below by logging a physical restock receipt or
              recount adjustment in Inventory.
            </p>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {oversoldProducts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <span className="font-semibold text-foreground">{p.name}</span>
                <StockStatusBadge
                  stock={p.cachedStock}
                  lowStockThreshold={p.lowStockThreshold}
                  unitLabel={p.baseUnit}
                  hasOversellConflict
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Product Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product Sales & Historical Cost Breakdown</CardTitle>
          <p className="text-xs text-muted-foreground">
            Calculated from immutable sale_items snapshots (AGENTS.md §8).
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 font-semibold">Product</th>
                  <th className="pb-2 font-semibold text-right">Qty Sold</th>
                  <th className="pb-2 font-semibold text-right">Revenue</th>
                  <th className="pb-2 font-semibold text-right">
                    Cost Snapshot
                  </th>
                  <th className="pb-2 font-semibold text-right">Net Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topProducts.map((row) => (
                  <tr key={row.name}>
                    <td className="py-2.5 font-semibold text-foreground">
                      {row.name}
                    </td>
                    <td className="py-2.5 text-right font-mono">
                      {row.qtySold} {row.unit}
                    </td>
                    <td className="py-2.5 text-right">
                      <CurrencyDisplay centavos={row.revenueCentavos} />
                    </td>
                    <td className="py-2.5 text-right text-muted-foreground">
                      <CurrencyDisplay centavos={row.costCentavos} />
                    </td>
                    <td className="py-2.5 text-right">
                      <CurrencyDisplay
                        centavos={row.revenueCentavos - row.costCentavos}
                        className="text-primary font-bold"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

