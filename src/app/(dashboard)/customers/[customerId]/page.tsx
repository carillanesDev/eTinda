"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Phone, ReceiptText, WalletCards } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { RecordSyncBadge } from "@/components/shared/StatusBadges";
import { db } from "@/lib/db/dexie";

export default function CustomerDetailProfilePage() {
  const params = useParams<{ customerId: string }>();
  const customerId = params.customerId;

  const customer = useLiveQuery(
    async () => db.customers.get(customerId),
    [customerId]
  );

  const account = useLiveQuery(
    async () =>
      db.utang_accounts.where("customerId").equals(customerId).first(),
    [customerId]
  );

  const ledger =
    useLiveQuery(
      async () =>
        db.utang_ledger
          .where("customerId")
          .equals(customerId)
          .reverse()
          .toArray(),
      [customerId]
    ) ?? [];

  const customerSales =
    useLiveQuery(
      async () =>
        db.sales.where("customerId").equals(customerId).reverse().toArray(),
      [customerId]
    ) ?? [];

  if (!customer) {
    return (
      <div className="space-y-4">
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Customers
        </Link>
        <p className="text-sm text-muted-foreground">Customer not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href="/customers"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Customers Directory
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="text-xl">{customer.name}</CardTitle>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3.5 w-3.5" /> {customer.contactNumber}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Outstanding Utang</p>
            <CurrencyDisplay
              centavos={account?.cachedBalanceCentavos ?? 0}
              className="text-2xl font-extrabold text-warning"
            />
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Utang Ledger Entries */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <WalletCards className="h-4 w-4 text-primary" />
              Customer Utang Ledger ({ledger.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {ledger.length === 0 ? (
              <p className="py-4 text-xs text-muted-foreground">
                No credit ledger entries recorded for this customer.
              </p>
            ) : (
              ledger.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-2.5 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          entry.entryType === "CHARGE" ? "warning" : "default"
                        }
                      >
                        {entry.entryType}
                      </Badge>
                      <span className="font-medium text-foreground">
                        {entry.notes}
                      </span>
                    </div>
                    <p className="mt-0.5 text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString("en-PH")}
                    </p>
                  </div>
                  <div className="text-right">
                    <CurrencyDisplay
                      centavos={entry.signedAmountCentavos}
                      showPlusSign
                      className={
                        entry.signedAmountCentavos > 0
                          ? "font-bold text-warning"
                          : "font-bold text-primary"
                      }
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Bal:{" "}
                      <CurrencyDisplay
                        centavos={entry.runningBalanceSnapshotCentavos}
                      />
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Customer Purchase History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ReceiptText className="h-4 w-4 text-primary" />
              Purchase History ({customerSales.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {customerSales.length === 0 ? (
              <p className="py-4 text-xs text-muted-foreground">
                No direct receipts linked to this customer yet.
              </p>
            ) : (
              customerSales.map((sale) => (
                <Link
                  key={sale.id}
                  href={`/sales/${sale.id}`}
                  className="flex items-center justify-between py-2.5 text-xs hover:bg-muted/40"
                >
                  <div>
                    <span className="font-bold text-foreground">
                      {sale.receiptNumber}
                    </span>
                    <p className="text-muted-foreground">
                      {new Date(sale.createdAt).toLocaleString("en-PH")} •{" "}
                      {sale.paymentMethod}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CurrencyDisplay
                      centavos={sale.totalCentavos}
                      className="font-bold text-foreground"
                    />
                    <RecordSyncBadge status={sale.syncStatus} compact />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

