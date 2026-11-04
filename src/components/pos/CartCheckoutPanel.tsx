"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  CheckCircle2,
  Clock,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  UserPlus,
  WalletCards,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import {
  ConfirmationDialog,
  ResponsiveDialog,
} from "@/components/shared/StateViews";
import { completeSaleTransaction } from "@/features/sales/salesService";
import { upsertCustomer } from "@/features/utang/utangService";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { db } from "@/lib/db/dexie";
import {
  calculateCheckoutSettlement,
  calculateLineSubtotalCentavos,
  centavosToInputString,
  parsePesoInputToCentavos,
} from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import { useCartStore } from "@/stores/useCartStore";
import type { PaymentMethod, SaleEntity } from "@/types/domain";

const QUICK_PESO_BILLS = [2000, 5000, 10000, 20000, 50000, 100000]; // ₱20, ₱50, ₱100, ₱200, ₱500, ₱1,000

export function CartCheckoutPanel({
  onSaleCompleted,
}: {
  onSaleCompleted?: (sale: SaleEntity) => void;
}) {
  const { isOnline } = useOnlineStatus();

  const items = useCartStore((s) => s.items);
  const paymentMethod = useCartStore((s) => s.paymentMethod);
  const cashTenderedCentavos = useCartStore((s) => s.cashTenderedCentavos);
  const selectedCustomerId = useCartStore((s) => s.selectedCustomerId);
  const checkoutNotes = useCartStore((s) => s.checkoutNotes);

  const stepItemQuantity = useCartStore((s) => s.stepItemQuantity);
  const updateItemQuantity = useCartStore((s) => s.updateItemQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const setPaymentMethod = useCartStore((s) => s.setPaymentMethod);
  const setCashTenderedCentavos = useCartStore(
    (s) => s.setCashTenderedCentavos
  );
  const setSelectedCustomerId = useCartStore((s) => s.setSelectedCustomerId);
  const clearCart = useCartStore((s) => s.clearCart);
  const totalCentavos = useCartStore((s) => s.getTotalCentavos());

  const [cashInputStr, setCashInputStr] = React.useState("");
  const [hasCustomCashInput, setHasCustomCashInput] = React.useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = React.useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = React.useState(false);
  const [newCustomerName, setNewCustomerName] = React.useState("");
  const [newCustomerPhone, setNewCustomerPhone] = React.useState("");
  const [customerFormError, setCustomerFormError] = React.useState("");

  const [checkoutError, setCheckoutError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [lastCompletedSale, setLastCompletedSale] =
    React.useState<SaleEntity | null>(null);

  const customers =
    useLiveQuery(async () => {
      return db.customers.orderBy("name").toArray();
    }, []) ?? [];

  const utangAccountsQuery = useLiveQuery(async () => {
    return db.utang_accounts.toArray();
  }, []);

  const balanceByCustomerId = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const acc of utangAccountsQuery ?? []) {
      map.set(acc.customerId, acc.cachedBalanceCentavos);
    }
    return map;
  }, [utangAccountsQuery]);

  const effectiveCashTenderedCentavos =
    paymentMethod === "UTANG"
      ? 0
      : paymentMethod === "CASH" && !hasCustomCashInput
        ? totalCentavos
        : cashTenderedCentavos;

  const displayedCashInputStr = hasCustomCashInput
    ? cashInputStr
    : totalCentavos > 0
      ? centavosToInputString(totalCentavos)
      : "";

  const settlement = calculateCheckoutSettlement({
    totalCentavos,
    cashTenderedCentavos: effectiveCashTenderedCentavos,
    allowUtang:
      paymentMethod === "UTANG" || paymentMethod === "PARTIAL_CASH_UTANG",
  });

  const handleSelectQuickBill = (billCentavos: number) => {
    setHasCustomCashInput(true);
    setCashTenderedCentavos(billCentavos);
    setCashInputStr(centavosToInputString(billCentavos));
    setCheckoutError(null);
  };

  const handleCashInputChange = (val: string) => {
    setHasCustomCashInput(true);
    setCashInputStr(val);
    setCashTenderedCentavos(parsePesoInputToCentavos(val));
    setCheckoutError(null);
  };

  const handleQuickCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomerFormError("");
    try {
      const created = await upsertCustomer({
        name: newCustomerName,
        contactNumber: newCustomerPhone,
      });
      setSelectedCustomerId(created.id);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setIsAddCustomerOpen(false);
    } catch (err) {
      setCustomerFormError(
        err instanceof Error ? err.message : "Invalid customer details"
      );
    }
  };

  const handleCompleteCheckout = async () => {
    if (items.length === 0 || isSubmitting) return;
    setCheckoutError(null);
    setIsSubmitting(true);

    try {
      const effectiveMethod: PaymentMethod =
        paymentMethod === "UTANG" && effectiveCashTenderedCentavos > 0
          ? "PARTIAL_CASH_UTANG"
          : paymentMethod;

      const completed = await completeSaleTransaction({
        items,
        paymentMethod: effectiveMethod,
        cashTenderedCentavos:
          effectiveMethod === "UTANG" ? 0 : effectiveCashTenderedCentavos,
        customerId: selectedCustomerId || undefined,
        notes: checkoutNotes,
      });

      setLastCompletedSale(completed);
      clearCart();
      setHasCustomCashInput(false);
      setCashInputStr("");
      onSaleCompleted?.(completed);
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : "Unable to complete checkout."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="flex h-full flex-col rounded-2xl border border-border bg-card shadow-xs"
      data-testid="pos-cart-panel"
    >
      {/* Cart Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">
            Current Order ({items.length})
          </h2>
        </div>
        {items.length > 0 ? (
          <button
            type="button"
            onClick={() => setIsClearConfirmOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive-muted cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Cart
          </button>
        ) : null}
      </div>

      {/* Completed Sale Feedback Banner */}
      {lastCompletedSale ? (
        <div
          data-testid="pos-sale-completed-banner"
          className={cn(
            "m-3 rounded-xl border p-3 text-xs",
            isOnline
              ? "border-emerald-300 bg-primary-muted text-primary-muted-foreground"
              : "border-amber-300 bg-warning-muted text-warning-muted-foreground"
          )}
          role="status"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
              ) : (
                <Clock className="h-4 w-4 shrink-0 text-warning" />
              )}
              <div>
                <p className="font-bold">
                  Sale {lastCompletedSale.receiptNumber} Completed!
                </p>
                <p className="mt-0.5">
                  Total:{" "}
                  <CurrencyDisplay centavos={lastCompletedSale.totalCentavos} />
                  {lastCompletedSale.changeGivenCentavos > 0 ? (
                    <>
                      {" "}
                      • Change:{" "}
                      <CurrencyDisplay
                        centavos={lastCompletedSale.changeGivenCentavos}
                      />
                    </>
                  ) : null}
                  {lastCompletedSale.utangChargedCentavos > 0 ? (
                    <>
                      {" "}
                      • Charged to Utang:{" "}
                      <CurrencyDisplay
                        centavos={lastCompletedSale.utangChargedCentavos}
                      />
                    </>
                  ) : null}
                </p>
                <p className="mt-0.5 font-semibold">
                  {isOnline
                    ? "Saved locally & synchronizing with server"
                    : "Saved Locally in IndexedDB • Pending Server Sync"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLastCompletedSale(null)}
              className="text-[11px] underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {/* Cart Line Items List */}
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {items.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-center text-muted-foreground">
            <ShoppingCart className="mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">Cart is empty</p>
            <p className="mt-0.5 max-w-[220px] text-xs">
              Tap any product card to add items to the customer&apos;s order.
            </p>
          </div>
        ) : (
          items.map((item) => {
            const lineSubtotal = calculateLineSubtotalCentavos(
              item.unitPriceCentavos,
              item.quantity
            );
            const stepSize = item.allowDecimalQuantity ? 0.25 : 1;

            return (
              <div
                key={item.cartLineId}
                data-testid={`cart-item-${item.productId}`}
                className="rounded-xl border border-border bg-muted/30 p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground leading-snug">
                      {item.productName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <CurrencyDisplay centavos={item.unitPriceCentavos} /> /{" "}
                      {item.unitLabel}
                    </p>
                  </div>
                  <CurrencyDisplay
                    centavos={lineSubtotal}
                    className="text-sm font-bold text-foreground"
                  />
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => removeItem(item.cartLineId)}
                    aria-label={`Remove ${item.productName} from cart`}
                    className="text-xs font-medium text-muted-foreground hover:text-destructive cursor-pointer"
                  >
                    Remove
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        stepItemQuantity(item.cartLineId, -stepSize)
                      }
                      aria-label={`Decrease quantity of ${item.productName}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted cursor-pointer"
                    >
                      <Minus className="h-4 w-4" />
                    </button>

                    <input
                      type="number"
                      inputMode={
                        item.allowDecimalQuantity ? "decimal" : "numeric"
                      }
                      step={item.allowDecimalQuantity ? "0.25" : "1"}
                      min={item.allowDecimalQuantity ? "0.05" : "1"}
                      aria-label={`Quantity for ${item.productName}`}
                      value={item.quantity}
                      onChange={(e) => {
                        const parsed = Number.parseFloat(e.target.value);
                        if (!Number.isNaN(parsed) && parsed > 0) {
                          updateItemQuantity(item.cartLineId, parsed);
                        }
                      }}
                      className="h-9 w-16 rounded-lg border border-input bg-card text-center font-mono text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        stepItemQuantity(item.cartLineId, stepSize)
                      }
                      aria-label={`Increase quantity of ${item.productName}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Checkout Section */}
      <div className="border-t border-border bg-muted/40 p-3.5 space-y-3">
        {/* Grand Total Row */}
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Total Due
          </span>
          <CurrencyDisplay
            centavos={totalCentavos}
            data-testid="pos-cart-total"
            className="text-2xl font-extrabold text-primary md:text-3xl"
          />
        </div>

        {/* Payment Method Selector */}
        <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => setPaymentMethod("CASH")}
            data-testid="payment-method-cash-btn"
            className={cn(
              "flex min-h-10 items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold transition-colors cursor-pointer",
              paymentMethod === "CASH"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Banknote className="h-3.5 w-3.5" />
            Cash
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod("UTANG")}
            data-testid="payment-method-utang-btn"
            className={cn(
              "flex min-h-10 items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold transition-colors cursor-pointer",
              paymentMethod === "UTANG"
                ? "bg-warning text-warning-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <WalletCards className="h-3.5 w-3.5" />
            Utang
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod("PARTIAL_CASH_UTANG")}
            data-testid="payment-method-partial-btn"
            className={cn(
              "flex min-h-10 items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold transition-colors cursor-pointer",
              paymentMethod === "PARTIAL_CASH_UTANG"
                ? "bg-info text-info-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Partial Cash
          </button>
        </div>

        {/* Customer Selector for Utang or Partial Cash */}
        {(paymentMethod === "UTANG" ||
          paymentMethod === "PARTIAL_CASH_UTANG") && (
          <div className="space-y-1.5 rounded-xl border border-amber-300 bg-warning-muted/50 p-2.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="pos-customer-select"
                className="text-xs font-semibold text-foreground"
              >
                Select Customer for Utang
              </label>
              <button
                type="button"
                onClick={() => setIsAddCustomerOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5" />
                New Customer
              </button>
            </div>
            <select
              id="pos-customer-select"
              data-testid="pos-customer-select"
              value={selectedCustomerId}
              onChange={(e) => {
                setSelectedCustomerId(e.target.value);
                setCheckoutError(null);
              }}
              className="flex min-h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">-- Choose Customer --</option>
              {customers.map((c) => {
                const currentBal = balanceByCustomerId.get(c.id) ?? 0;
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.contactNumber}) — Bal: ₱
                    {(currentBal / 100).toFixed(2)}
                  </option>
                );
              })}
            </select>

            {selectedCustomerId ? (
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>Projected New Balance:</span>
                <CurrencyDisplay
                  centavos={
                    (balanceByCustomerId.get(selectedCustomerId) ?? 0) +
                    settlement.utangChargedCentavos
                  }
                  className="font-bold text-warning-muted-foreground"
                />
              </div>
            ) : null}
          </div>
        )}

        {/* Cash Tendered & Quick Peso Bills */}
        {(paymentMethod === "CASH" ||
          paymentMethod === "PARTIAL_CASH_UTANG") && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="cash-tendered-input"
                className="text-xs font-semibold text-foreground"
              >
                Cash Received (₱)
              </label>
              <Input
                id="cash-tendered-input"
                data-testid="cash-tendered-input"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={displayedCashInputStr}
                onChange={(e) => handleCashInputChange(e.target.value)}
                placeholder={centavosToInputString(totalCentavos)}
                className="h-10 max-w-[150px] text-right font-mono font-bold"
              />
            </div>

            {/* Quick Philippine Peso Denominations */}
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => handleSelectQuickBill(totalCentavos)}
                className="min-h-9 rounded-lg border border-primary/40 bg-primary-muted/70 px-2 text-xs font-bold text-primary-muted-foreground hover:bg-primary-muted cursor-pointer"
              >
                Exact
              </button>
              {QUICK_PESO_BILLS.map((bill) => (
                <button
                  key={bill}
                  type="button"
                  onClick={() => handleSelectQuickBill(bill)}
                  className="min-h-9 rounded-lg border border-border bg-card px-2 font-mono text-xs font-semibold text-foreground hover:bg-muted cursor-pointer"
                >
                  ₱{bill / 100}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Change or Utang Summary Box */}
        {items.length > 0 ? (
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-xs">
            {paymentMethod === "CASH" ? (
              <>
                <span className="font-semibold text-muted-foreground">
                  Change Due (Sukli):
                </span>
                <CurrencyDisplay
                  centavos={settlement.changeDueCentavos}
                  data-testid="pos-change-due"
                  className="text-base font-bold text-primary"
                />
              </>
            ) : (
              <>
                <span className="font-semibold text-muted-foreground">
                  Amount Charged to Utang:
                </span>
                <CurrencyDisplay
                  centavos={settlement.utangChargedCentavos}
                  data-testid="pos-utang-charged"
                  className="text-base font-bold text-warning"
                />
              </>
            )}
          </div>
        ) : null}

        {checkoutError ? (
          <p
            className="rounded-lg bg-destructive-muted p-2 text-xs font-semibold text-destructive"
            role="alert"
          >
            {checkoutError}
          </p>
        ) : null}

        {/* Complete Sale CTA */}
        <Button
          size="lg"
          className="w-full text-base font-bold"
          disabled={items.length === 0 || isSubmitting}
          onClick={() => void handleCompleteCheckout()}
          data-testid="complete-sale-btn"
        >
          {isSubmitting ? (
            "Saving Transaction..."
          ) : (
            <>
              Complete {paymentMethod === "UTANG" ? "Utang" : "Sale"} (
              <CurrencyDisplay centavos={totalCentavos} />)
            </>
          )}
        </Button>

        {!isOnline ? (
          <p className="text-center text-[11px] font-medium text-warning">
            Offline Mode: Transaction will be committed to IndexedDB & Sync Outbox.
          </p>
        ) : null}
      </div>

      {/* Clear Cart Confirmation Dialog */}
      <ConfirmationDialog
        open={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        onConfirm={clearCart}
        title="Clear Current Shopping Cart?"
        description="This will remove all selected products from the current order."
        confirmLabel="Yes, Clear Cart"
        destructive
      />

      {/* Quick Create Customer Dialog */}
      <ResponsiveDialog
        open={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        title="Quick Add Store Customer"
        description="Customer records require only Name and Contact Number (AGENTS.md §9)."
      >
        <form onSubmit={handleQuickCreateCustomer} className="space-y-3.5">
          <div>
            <label
              htmlFor="quick-cust-name"
              className="mb-1 block text-xs font-semibold text-foreground"
            >
              Customer Full Name
            </label>
            <Input
              id="quick-cust-name"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              placeholder="e.g., Aling Rosa Mendoza"
              required
            />
          </div>
          <div>
            <label
              htmlFor="quick-cust-phone"
              className="mb-1 block text-xs font-semibold text-foreground"
            >
              Contact Number
            </label>
            <Input
              id="quick-cust-phone"
              type="tel"
              inputMode="tel"
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
              placeholder="e.g., 09171234567"
              error={customerFormError}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsAddCustomerOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Save & Select Customer</Button>
          </div>
        </form>
      </ResponsiveDialog>
    </div>
  );
}
