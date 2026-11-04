"use client";

import * as React from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Banknote,
  Clock,
  SlidersHorizontal,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import {
  ResponsiveDialog,
  SearchInput,
} from "@/components/shared/StateViews";
import { RecordSyncBadge } from "@/components/shared/StatusBadges";
import {
  recordUtangAdjustment,
  recordUtangPayment,
  upsertCustomer,
} from "@/features/utang/utangService";
import { db } from "@/lib/db/dexie";
import { hasPermission } from "@/lib/permissions";
import {
  centavosToInputString,
  parsePesoInputToCentavos,
  sumCentavos,
} from "@/lib/utils/money";
import { useSessionStore } from "@/stores/useSessionStore";

export default function UtangLedgerPage() {
  const role = useSessionStore((s) => s.role);
  const canAdjustBalance = hasPermission(role, "ADJUST_UTANG_BALANCE");

  const [searchQuery, setSearchQuery] = React.useState("");

  // Payment Sheet State
  const [paymentCustomerId, setPaymentCustomerId] = React.useState<
    string | null
  >(null);
  const [paymentAmountStr, setPaymentAmountStr] = React.useState("");
  const [paymentNotes, setPaymentNotes] = React.useState("");
  const [paymentError, setPaymentError] = React.useState("");

  // Adjustment Sheet State (Owner Only)
  const [adjustCustomerId, setAdjustCustomerId] = React.useState<string | null>(
    null
  );
  const [adjustAmountStr, setAdjustAmountStr] = React.useState("");
  const [adjustDirection, setAdjustDirection] = React.useState<
    "ADD_CHARGE" | "DEDUCT_BALANCE"
  >("DEDUCT_BALANCE");
  const [adjustNotes, setAdjustNotes] = React.useState("");
  const [adjustError, setAdjustError] = React.useState("");

  // New Customer Sheet State
  const [isNewCustomerOpen, setIsNewCustomerOpen] = React.useState(false);
  const [newCustomerName, setNewCustomerName] = React.useState("");
  const [newCustomerPhone, setNewCustomerPhone] = React.useState("");
  const [newCustomerError, setNewCustomerError] = React.useState("");

  const accounts =
    useLiveQuery(async () => {
      return db.utang_accounts
        .orderBy("cachedBalanceCentavos")
        .reverse()
        .toArray();
    }, []) ?? [];

  const ledgerEntries =
    useLiveQuery(async () => {
      return db.utang_ledger.orderBy("createdAt").reverse().toArray();
    }, []) ?? [];

  const totalOutstandingCentavos = sumCentavos(
    accounts.map((a) => Math.max(0, a.cachedBalanceCentavos))
  );

  const filteredAccounts = accounts.filter((acc) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      acc.customerNameSnapshot.toLowerCase().includes(q) ||
      acc.contactNumberSnapshot.includes(q)
    );
  });

  const openPaymentSheet = (customerId: string, currentBalanceCentavos: number) => {
    setPaymentCustomerId(customerId);
    setPaymentAmountStr(
      currentBalanceCentavos > 0
        ? centavosToInputString(currentBalanceCentavos)
        : ""
    );
    setPaymentNotes("");
    setPaymentError("");
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentCustomerId) return;
    setPaymentError("");
    try {
      await recordUtangPayment({
        customerId: paymentCustomerId,
        amountCentavos: parsePesoInputToCentavos(paymentAmountStr),
        notes: paymentNotes,
      });
      setPaymentCustomerId(null);
    } catch (err) {
      setPaymentError(
        err instanceof Error ? err.message : "Failed to record payment"
      );
    }
  };

  const handleRecordAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustCustomerId) return;
    setAdjustError("");
    try {
      const rawCentavos = Math.abs(parsePesoInputToCentavos(adjustAmountStr));
      const signed =
        adjustDirection === "DEDUCT_BALANCE" ? -rawCentavos : rawCentavos;
      await recordUtangAdjustment({
        customerId: adjustCustomerId,
        signedAmountCentavos: signed,
        notes: adjustNotes,
      });
      setAdjustCustomerId(null);
    } catch (err) {
      setAdjustError(
        err instanceof Error ? err.message : "Failed to record adjustment"
      );
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewCustomerError("");
    try {
      await upsertCustomer({
        name: newCustomerName,
        contactNumber: newCustomerPhone,
      });
      setNewCustomerName("");
      setNewCustomerPhone("");
      setIsNewCustomerOpen(false);
    } catch (err) {
      setNewCustomerError(
        err instanceof Error ? err.message : "Invalid customer info"
      );
    }
  };

  const selectedPaymentAccount = accounts.find(
    (a) => a.customerId === paymentCustomerId
  );

  return (
    <div className="space-y-5">
      {/* Summary Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-2xs">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Total Store Outstanding Utang
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <CurrencyDisplay
              centavos={totalOutstandingCentavos}
              data-testid="utang-total-outstanding"
              className="text-2xl font-extrabold text-warning md:text-3xl"
            />
            <span className="text-xs text-muted-foreground">
              across {accounts.filter((a) => a.cachedBalanceCentavos > 0).length}{" "}
              active account(s)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/customers"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted"
          >
            <Users className="h-4 w-4 text-primary" />
            Customer Directory
          </Link>
          <Button
            size="sm"
            onClick={() => setIsNewCustomerOpen(true)}
            data-testid="utang-add-customer-btn"
          >
            <UserPlus className="h-4 w-4" />
            Add Customer
          </Button>
        </div>
      </div>

      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search customer by name or mobile number..."
      />

      {/* Customer Utang Accounts Grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filteredAccounts.map((acc) => (
          <Card
            key={acc.id}
            data-testid={`utang-account-card-${acc.customerId}`}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/customers/${acc.customerId}`}
                    className="text-base font-bold text-foreground hover:text-primary hover:underline"
                  >
                    {acc.customerNameSnapshot}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {acc.contactNumberSnapshot}
                  </p>
                </div>

                {acc.hasPendingSyncEntries ? (
                  <Badge variant="warning">
                    <Clock className="h-3 w-3" />
                    Pending Sync
                  </Badge>
                ) : (
                  <Badge variant="default">Current</Badge>
                )}
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">
                  Outstanding Balance
                </p>
                <CurrencyDisplay
                  centavos={acc.cachedBalanceCentavos}
                  data-testid={`utang-balance-${acc.customerId}`}
                  className={`text-xl font-extrabold ${
                    acc.cachedBalanceCentavos > 0
                      ? "text-warning"
                      : "text-primary"
                  }`}
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() =>
                    openPaymentSheet(acc.customerId, acc.cachedBalanceCentavos)
                  }
                  data-testid={`record-payment-btn-${acc.customerId}`}
                >
                  <Banknote className="h-4 w-4" />
                  Record Payment
                </Button>

                {canAdjustBalance ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAdjustCustomerId(acc.customerId);
                      setAdjustAmountStr("");
                      setAdjustNotes("");
                      setAdjustError("");
                    }}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Adjust
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Append-Only Utang Ledger Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <WalletCards className="h-4 w-4 text-primary" />
            Append-Only Utang Ledger History ({ledgerEntries.length})
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Convention per AGENTS.md §9: CHARGE = positive (+), PAYMENT =
            negative (-), ADJUSTMENT = signed (+/-).
          </p>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {ledgerEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/customers/${entry.customerId}`}
                    className="text-sm font-bold text-foreground hover:underline"
                  >
                    {entry.customerNameSnapshot}
                  </Link>
                  <Badge
                    variant={
                      entry.entryType === "CHARGE"
                        ? "warning"
                        : entry.entryType === "PAYMENT"
                          ? "default"
                          : "info"
                    }
                  >
                    {entry.entryType}
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  {entry.notes} • Recorded by {entry.userNameSnapshot} •{" "}
                  {new Date(entry.createdAt).toLocaleString("en-PH")}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <CurrencyDisplay
                    centavos={entry.signedAmountCentavos}
                    showPlusSign
                    className={`text-sm font-extrabold ${
                      entry.signedAmountCentavos > 0
                        ? "text-warning"
                        : "text-primary"
                    }`}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Running Bal:{" "}
                    <CurrencyDisplay
                      centavos={entry.runningBalanceSnapshotCentavos}
                    />
                  </p>
                </div>
                <RecordSyncBadge status={entry.syncStatus} compact />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Record Customer Payment Dialog */}
      <ResponsiveDialog
        open={Boolean(paymentCustomerId)}
        onClose={() => setPaymentCustomerId(null)}
        title={`Record Payment — ${selectedPaymentAccount?.customerNameSnapshot ?? ""}`}
        description="Supports full or partial payments. Appends a negative PAYMENT entry to the customer's utang ledger."
      >
        <form onSubmit={handleRecordPayment} className="space-y-3.5">
          {selectedPaymentAccount ? (
            <div className="flex items-center justify-between rounded-xl bg-muted p-3 text-xs">
              <span className="text-muted-foreground">
                Current Outstanding Balance:
              </span>
              <CurrencyDisplay
                centavos={selectedPaymentAccount.cachedBalanceCentavos}
                className="text-base font-bold text-warning"
              />
            </div>
          ) : null}

          <div>
            <label
              htmlFor="utang-pay-amount"
              className="mb-1 block text-xs font-semibold text-foreground"
            >
              Payment Amount Received (₱)
            </label>
            <Input
              id="utang-pay-amount"
              data-testid="utang-payment-amount-input"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={paymentAmountStr}
              onChange={(e) => setPaymentAmountStr(e.target.value)}
              placeholder="e.g., 50.00"
              required
            />
          </div>

          <div>
            <label
              htmlFor="utang-pay-notes"
              className="mb-1 block text-xs font-semibold text-foreground"
            >
              Payment Note (Optional)
            </label>
            <Input
              id="utang-pay-notes"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="e.g., Cash partial payment at store counter"
              error={paymentError}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setPaymentCustomerId(null)}
            >
              Cancel
            </Button>
            <Button type="submit" data-testid="submit-utang-payment-btn">
              Save Payment
            </Button>
          </div>
        </form>
      </ResponsiveDialog>

      {/* Owner Ledger Adjustment Dialog */}
      <ResponsiveDialog
        open={Boolean(adjustCustomerId)}
        onClose={() => setAdjustCustomerId(null)}
        title="Owner Utang Ledger Adjustment"
        description="Appends a signed ADJUSTMENT record without rewriting historical entries."
      >
        <form onSubmit={handleRecordAdjustment} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAdjustDirection("DEDUCT_BALANCE")}
              className={`min-h-10 rounded-lg border text-xs font-semibold cursor-pointer ${
                adjustDirection === "DEDUCT_BALANCE"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground"
              }`}
            >
              Reduce Balance (-)
            </button>
            <button
              type="button"
              onClick={() => setAdjustDirection("ADD_CHARGE")}
              className={`min-h-10 rounded-lg border text-xs font-semibold cursor-pointer ${
                adjustDirection === "ADD_CHARGE"
                  ? "border-warning bg-warning text-warning-foreground"
                  : "border-border bg-card text-foreground"
              }`}
            >
              Add Charge (+)
            </button>
          </div>
          <div>
            <label
              htmlFor="adj-utang-amount"
              className="mb-1 block text-xs font-semibold text-foreground"
            >
              Adjustment Amount (₱)
            </label>
            <Input
              id="adj-utang-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={adjustAmountStr}
              onChange={(e) => setAdjustAmountStr(e.target.value)}
              required
            />
          </div>
          <div>
            <label
              htmlFor="adj-utang-notes"
              className="mb-1 block text-xs font-semibold text-foreground"
            >
              Audit Explanation (Required)
            </label>
            <Input
              id="adj-utang-notes"
              value={adjustNotes}
              onChange={(e) => setAdjustNotes(e.target.value)}
              placeholder="e.g., Correction for returned bottle deposit"
              error={adjustError}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAdjustCustomerId(null)}>
              Cancel
            </Button>
            <Button type="submit">Record Adjustment</Button>
          </div>
        </form>
      </ResponsiveDialog>

      {/* New Customer Modal */}
      <ResponsiveDialog
        open={isNewCustomerOpen}
        onClose={() => setIsNewCustomerOpen(false)}
        title="Register Customer Account"
        description="Limited to Customer Name and Contact Number for initial scope (AGENTS.md §9)."
      >
        <form onSubmit={handleCreateCustomer} className="space-y-3.5">
          <div>
            <label
              htmlFor="new-cust-name"
              className="mb-1 block text-xs font-semibold text-foreground"
            >
              Customer Full Name
            </label>
            <Input
              id="new-cust-name"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              placeholder="e.g., Kuya Noel Bautista"
              required
            />
          </div>
          <div>
            <label
              htmlFor="new-cust-phone"
              className="mb-1 block text-xs font-semibold text-foreground"
            >
              Mobile / Contact Number
            </label>
            <Input
              id="new-cust-phone"
              type="tel"
              inputMode="tel"
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
              placeholder="09171234567"
              error={newCustomerError}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsNewCustomerOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Create Customer</Button>
          </div>
        </form>
      </ResponsiveDialog>
    </div>
  );
}

