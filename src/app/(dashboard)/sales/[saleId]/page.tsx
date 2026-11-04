"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Ban, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { ResponsiveDialog } from "@/components/shared/StateViews";
import { RecordSyncBadge } from "@/components/shared/StatusBadges";
import { voidSaleTransaction } from "@/features/sales/salesService";
import { db } from "@/lib/db/dexie";
import { hasPermission } from "@/lib/permissions";
import { useSessionStore } from "@/stores/useSessionStore";

export default function SaleReceiptDetailPage() {
  const params = useParams<{ saleId: string }>();
  const saleId = params.saleId;
  const role = useSessionStore((s) => s.role);
  const canVoidSale = hasPermission(role, "VOID_SALE_TRANSACTION");
  const canViewCosts = hasPermission(role, "VIEW_FINANCIAL_MARGINS");

  const [isVoidDialogOpen, setIsVoidDialogOpen] = React.useState(false);
  const [voidReason, setVoidReason] = React.useState("");
  const [voidError, setVoidError] = React.useState("");

  const sale = useLiveQuery(async () => db.sales.get(saleId), [saleId]);
  const lineItems =
    useLiveQuery(
      async () => db.sale_items.where("saleId").equals(saleId).toArray(),
      [saleId]
    ) ?? [];

  if (!sale) {
    return (
      <div className="space-y-4">
        <Link
          href="/sales"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Sales History
        </Link>
        <p className="text-sm text-muted-foreground">Receipt not found.</p>
      </div>
    );
  }

  const handleConfirmVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    setVoidError("");
    try {
      await voidSaleTransaction({
        saleId: sale.id,
        voidReason,
      });
      setIsVoidDialogOpen(false);
    } catch (err) {
      setVoidError(
        err instanceof Error ? err.message : "Unable to void transaction"
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/sales"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Sales History
        </Link>

        {sale.status === "COMPLETED" && canVoidSale ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsVoidDialogOpen(true)}
            data-testid="void-sale-btn"
          >
            <Ban className="h-4 w-4" />
            Void / Reverse Transaction
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 border-b border-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">{sale.receiptNumber}</CardTitle>
              <Badge
                variant={sale.status === "VOIDED" ? "destructive" : "default"}
              >
                {sale.status}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Recorded: {new Date(sale.createdAt).toLocaleString("en-PH")} •
              Operator: {sale.userNameSnapshot} • Device: {sale.deviceId}
            </p>
            {sale.customerNameSnapshot ? (
              <p className="mt-0.5 text-xs font-semibold text-foreground">
                Customer: {sale.customerNameSnapshot}
              </p>
            ) : null}
          </div>
          <RecordSyncBadge status={sale.syncStatus} />
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {sale.status === "VOIDED" ? (
            <div className="rounded-xl border border-red-300 bg-destructive-muted p-3 text-xs text-destructive-muted-foreground">
              <strong>Transaction Voided / Reversed:</strong> {sale.voidReason}{" "}
              (Stock movements and any utang charges were reversed via explicit
              append-only records).
            </div>
          ) : null}

          {/* Preserved Snapshot Line Items */}
          <div className="divide-y divide-border">
            {lineItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 py-2.5 text-sm"
              >
                <div>
                  <p className="font-semibold text-foreground">
                    {item.productNameSnapshot}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} {item.unitLabelSnapshot} ×{" "}
                    <CurrencyDisplay centavos={item.unitSellingPriceCentavos} />
                    {canViewCosts ? (
                      <>
                        {" "}
                        (Cost Snapshot:{" "}
                        <CurrencyDisplay
                          centavos={item.unitCostSnapshotCentavos}
                        />
                        )
                      </>
                    ) : null}
                  </p>
                </div>
                <CurrencyDisplay
                  centavos={item.subtotalCentavos}
                  className="font-bold text-foreground"
                />
              </div>
            ))}
          </div>

          {/* Financial Totals */}
          <div className="space-y-1.5 rounded-xl border border-border bg-muted/40 p-3.5 text-sm">
            <div className="flex justify-between font-bold text-base">
              <span>Transaction Total:</span>
              <CurrencyDisplay centavos={sale.totalCentavos} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Payment Method:</span>
              <span className="font-semibold text-foreground">
                {sale.paymentMethod}
              </span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Cash Tendered:</span>
              <CurrencyDisplay centavos={sale.cashTenderedCentavos} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Change Given:</span>
              <CurrencyDisplay centavos={sale.changeGivenCentavos} />
            </div>
            {sale.utangChargedCentavos > 0 ? (
              <div className="flex justify-between text-xs font-semibold text-warning">
                <span>Charged to Utang Ledger:</span>
                <CurrencyDisplay centavos={sale.utangChargedCentavos} />
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Non-Destructive Void / Reversal Dialog */}
      <ResponsiveDialog
        open={isVoidDialogOpen}
        onClose={() => setIsVoidDialogOpen(false)}
        title={`Void & Reverse ${sale.receiptNumber}`}
        description="Completed financial records are never deleted. Voiding records an append-only inventory reversal and credit adjustment."
      >
        <form onSubmit={handleConfirmVoid} className="space-y-3.5">
          <div className="flex items-start gap-2 rounded-lg bg-warning-muted p-3 text-xs text-warning-muted-foreground">
            <ShieldAlert className="h-4 w-4 shrink-0 text-warning" />
            <span>
              Stock quantities for all {lineItems.length} item(s) will be
              restored to inventory via a <code>SALE_VOID_REVERSAL</code>{" "}
              movement.
            </span>
          </div>
          <div>
            <label
              htmlFor="void-reason-input"
              className="mb-1 block text-xs font-semibold text-foreground"
            >
              Reason for Reversal (Required for Audit Log)
            </label>
            <Input
              id="void-reason-input"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="e.g., Customer returned unopened item / wrong item punched"
              error={voidError}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsVoidDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive">
              Confirm Void & Reverse
            </Button>
          </div>
        </form>
      </ResponsiveDialog>
    </div>
  );
}

