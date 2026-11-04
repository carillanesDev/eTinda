"use client";

import * as React from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowDownUp,
  History,
  Package,
  PackagePlus,
  Truck,
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
import {
  RecordSyncBadge,
  StockStatusBadge,
} from "@/components/shared/StatusBadges";
import {
  recordPurchaseReceipt,
  recordStockAdjustment,
} from "@/features/inventory/inventoryService";
import { db } from "@/lib/db/dexie";
import { hasPermission } from "@/lib/permissions";
import {
  centavosToInputString,
  parsePesoInputToCentavos,
} from "@/lib/utils/money";
import { useSessionStore } from "@/stores/useSessionStore";

export default function InventoryPage() {
  const role = useSessionStore((s) => s.role);
  const canViewCosts = hasPermission(role, "VIEW_FINANCIAL_MARGINS");

  const [activeTab, setActiveTab] = React.useState<
    "STOCK_LEVELS" | "MOVEMENT_LEDGER" | "PURCHASES"
  >("STOCK_LEVELS");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Stock Adjustment Sheet state
  const [isAdjustOpen, setIsAdjustOpen] = React.useState(false);
  const [adjProductId, setAdjProductId] = React.useState("");
  const [adjType, setAdjType] = React.useState<
    "STOCK_ADDITION" | "STOCK_DEDUCTION" | "STOCK_ADJUSTMENT"
  >("STOCK_ADDITION");
  const [adjQtyStr, setAdjQtyStr] = React.useState("1");
  const [adjReason, setAdjReason] = React.useState("");
  const [adjError, setAdjError] = React.useState("");

  // Purchase Receiving Sheet state
  const [isReceiveOpen, setIsReceiveOpen] = React.useState(false);
  const [supplierName, setSupplierName] = React.useState("");
  const [referenceNote, setReferenceNote] = React.useState("");
  const [receiveProductId, setReceiveProductId] = React.useState("");
  const [receiveQtyStr, setReceiveQtyStr] = React.useState("10");
  const [receiveUnitCostStr, setReceiveUnitCostStr] = React.useState("");
  const [receiveError, setReceiveError] = React.useState("");

  const products =
    useLiveQuery(async () => db.products.orderBy("name").toArray(), []) ?? [];

  const movements =
    useLiveQuery(async () => {
      return db.inventory_movements.orderBy("createdAt").reverse().toArray();
    }, []) ?? [];

  const purchaseRecords =
    useLiveQuery(async () => {
      return db.purchase_records.orderBy("createdAt").reverse().toArray();
    }, []) ?? [];

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const openAdjustForProduct = (productId: string) => {
    setAdjProductId(productId);
    setAdjType("STOCK_ADDITION");
    setAdjQtyStr("1");
    setAdjReason("");
    setAdjError("");
    setIsAdjustOpen(true);
  };

  const openReceiveModal = (productId?: string) => {
    const target =
      products.find((p) => p.id === productId) ?? products[0] ?? null;
    setReceiveProductId(target?.id ?? "");
    setReceiveQtyStr("12");
    setReceiveUnitCostStr(
      target ? centavosToInputString(target.latestCostCentavos) : "15.00"
    );
    setSupplierName("Puregold Wholesale");
    setReferenceNote("");
    setReceiveError("");
    setIsReceiveOpen(true);
  };

  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjError("");
    try {
      await recordStockAdjustment({
        productId: adjProductId,
        movementType: adjType,
        quantityChange: Number.parseFloat(adjQtyStr),
        reasonOrNotes: adjReason,
      });
      setIsAdjustOpen(false);
    } catch (err) {
      setAdjError(
        err instanceof Error ? err.message : "Unable to record stock movement"
      );
    }
  };

  const handleSubmitPurchaseReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setReceiveError("");
    try {
      await recordPurchaseReceipt({
        supplierName,
        referenceNote,
        items: [
          {
            productId: receiveProductId,
            quantityAdded: Number.parseFloat(receiveQtyStr),
            unitCostCentavos: parsePesoInputToCentavos(receiveUnitCostStr),
          },
        ],
      });
      setIsReceiveOpen(false);
    } catch (err) {
      setReceiveError(
        err instanceof Error ? err.message : "Unable to record purchase receipt"
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("STOCK_LEVELS")}
            className={`min-h-10 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "STOCK_LEVELS"
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            Stock Levels ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("MOVEMENT_LEDGER")}
            data-testid="tab-movement-ledger-btn"
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "MOVEMENT_LEDGER"
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Movement Ledger ({movements.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("PURCHASES")}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === "PURCHASES"
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            <Truck className="h-3.5 w-3.5" />
            Purchases ({purchaseRecords.length})
          </button>
          <Link
            href="/products"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted"
          >
            <Package className="h-3.5 w-3.5 text-primary" />
            Catalog & Units
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => openAdjustForProduct(products[0]?.id ?? "")}
            data-testid="open-stock-adjustment-btn"
          >
            <ArrowDownUp className="h-4 w-4" />
            Stock Adjustment
          </Button>
          <Button
            size="sm"
            onClick={() => openReceiveModal()}
            data-testid="open-purchase-receive-btn"
          >
            <PackagePlus className="h-4 w-4" />
            Receive Delivery
          </Button>
        </div>
      </div>

      {activeTab === "STOCK_LEVELS" ? (
        <div className="space-y-3">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Filter inventory by product name..."
          />

          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {filteredProducts.map((product) => (
              <Card key={product.id}>
                <CardContent className="flex items-center justify-between gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/products/${product.id}`}
                      className="truncate text-sm font-bold text-foreground hover:text-primary hover:underline block"
                    >
                      {product.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        Price:{" "}
                        <CurrencyDisplay
                          centavos={product.sellingPriceCentavos}
                        />
                      </span>
                      {canViewCosts ? (
                        <span>
                          • Cost:{" "}
                          <CurrencyDisplay
                            centavos={product.latestCostCentavos}
                          />
                        </span>
                      ) : null}
                      <span>
                        • Alert ≤ {product.lowStockThreshold} {product.baseUnit}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <StockStatusBadge
                      stock={product.cachedStock}
                      lowStockThreshold={product.lowStockThreshold}
                      unitLabel={product.baseUnit}
                      hasOversellConflict={product.hasOversellConflict}
                    />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openReceiveModal(product.id)}
                        className="rounded-md border border-border bg-muted/60 px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted cursor-pointer"
                      >
                        + Receive
                      </button>
                      <button
                        type="button"
                        onClick={() => openAdjustForProduct(product.id)}
                        className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Adjust
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === "MOVEMENT_LEDGER" ? (
        <Card>
          <CardHeader>
            <CardTitle>Append-Only Inventory Movement Ledger</CardTitle>
            <p className="text-xs text-muted-foreground">
              Every sale deduction, purchase receipt, and stock recount is
              recorded as an immutable signed movement (AGENTS.md §7).
            </p>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {movements.map((mov) => (
              <div
                key={mov.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">
                      {mov.productNameSnapshot}
                    </span>
                    <Badge
                      variant={mov.quantityChange >= 0 ? "default" : "secondary"}
                    >
                      {mov.movementType}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {mov.reasonOrNotes} • By {mov.userNameSnapshot} •{" "}
                    {new Date(mov.createdAt).toLocaleString("en-PH")}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`font-mono text-base font-extrabold ${
                      mov.quantityChange >= 0
                        ? "text-primary"
                        : "text-destructive"
                    }`}
                  >
                    {mov.quantityChange > 0
                      ? `+${mov.quantityChange}`
                      : mov.quantityChange}
                  </span>
                  <RecordSyncBadge status={mov.syncStatus} compact />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "PURCHASES" ? (
        <Card>
          <CardHeader>
            <CardTitle>Historical Purchase & Restock Records</CardTitle>
            <p className="text-xs text-muted-foreground">
              Historical purchase costs are preserved without overwriting prior
              deliveries (AGENTS.md §6).
            </p>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {purchaseRecords.map((pur) => (
              <div
                key={pur.id}
                className="flex items-center justify-between gap-2 py-3 text-xs"
              >
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {pur.supplierName}
                  </p>
                  <p className="text-muted-foreground">
                    {pur.referenceNote || "Restock delivery"} • Recorded by{" "}
                    {pur.userNameSnapshot} •{" "}
                    {new Date(pur.createdAt).toLocaleString("en-PH")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {canViewCosts ? (
                    <CurrencyDisplay
                      centavos={pur.totalCostCentavos}
                      className="text-sm font-bold text-foreground"
                    />
                  ) : null}
                  <RecordSyncBadge status={pur.syncStatus} compact />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Stock Adjustment Dialog */}
      <ResponsiveDialog
        open={isAdjustOpen}
        onClose={() => setIsAdjustOpen(false)}
        title="Record Append-Only Stock Movement"
        description="Stock levels are never directly overwritten; record an addition, deduction, or recount adjustment."
      >
        <form onSubmit={handleSubmitAdjustment} className="space-y-3.5">
          <div>
            <label
              htmlFor="adj-product-select"
              className="mb-1 block text-xs font-semibold text-foreground"
            >
              Product
            </label>
            <select
              id="adj-product-select"
              value={adjProductId}
              onChange={(e) => setAdjProductId(e.target.value)}
              className="flex min-h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Current: {p.cachedStock} {p.baseUnit})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="adj-type-select"
                className="mb-1 block text-xs font-semibold text-foreground"
              >
                Movement Type
              </label>
              <select
                id="adj-type-select"
                value={adjType}
                onChange={(e) =>
                  setAdjType(
                    e.target.value as
                      | "STOCK_ADDITION"
                      | "STOCK_DEDUCTION"
                      | "STOCK_ADJUSTMENT"
                  )
                }
                className="flex min-h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
              >
                <option value="STOCK_ADDITION">Stock Addition (+)</option>
                <option value="STOCK_DEDUCTION">
                  Spoilage / Deduction (-)
                </option>
                <option value="STOCK_ADJUSTMENT">
                  Recount Adjustment (+/-)
                </option>
              </select>
            </div>
            <div>
              <label
                htmlFor="adj-qty-input"
                className="mb-1 block text-xs font-semibold text-foreground"
              >
                Quantity
              </label>
              <Input
                id="adj-qty-input"
                type="number"
                step="any"
                value={adjQtyStr}
                onChange={(e) => setAdjQtyStr(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="adj-reason-input"
              className="mb-1 block text-xs font-semibold text-foreground"
            >
              Reason / Audit Note
            </label>
            <Input
              id="adj-reason-input"
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value)}
              placeholder="e.g., Physical shelf recount or damaged sachet"
              error={adjError}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsAdjustOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Commit Movement</Button>
          </div>
        </form>
      </ResponsiveDialog>

      {/* Receive Purchase Delivery Dialog */}
      <ResponsiveDialog
        open={isReceiveOpen}
        onClose={() => setIsReceiveOpen(false)}
        title="Receive Supplier Stock Delivery"
        description="Adds stock via PURCHASE_RECEIPT movement and snapshots historical unit cost."
      >
        <form onSubmit={handleSubmitPurchaseReceipt} className="space-y-3.5">
          <div>
            <label
              htmlFor="rec-supplier-input"
              className="mb-1 block text-xs font-semibold text-foreground"
            >
              Supplier / Market Source
            </label>
            <Input
              id="rec-supplier-input"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="e.g., Puregold Wholesale / Divisoria"
              required
            />
          </div>
          <div>
            <label
              htmlFor="rec-ref-input"
              className="mb-1 block text-xs font-semibold text-foreground"
            >
              Receipt / Delivery Note (Optional)
            </label>
            <Input
              id="rec-ref-input"
              value={referenceNote}
              onChange={(e) => setReferenceNote(e.target.value)}
              placeholder="e.g., OR #10492"
            />
          </div>
          <div>
            <label
              htmlFor="rec-product-select"
              className="mb-1 block text-xs font-semibold text-foreground"
            >
              Product Received
            </label>
            <select
              id="rec-product-select"
              value={receiveProductId}
              onChange={(e) => {
                setReceiveProductId(e.target.value);
                const prod = products.find((p) => p.id === e.target.value);
                if (prod) {
                  setReceiveUnitCostStr(
                    centavosToInputString(prod.latestCostCentavos)
                  );
                }
              }}
              className="flex min-h-11 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.baseUnit})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="rec-qty-input"
                className="mb-1 block text-xs font-semibold text-foreground"
              >
                Quantity Added
              </label>
              <Input
                id="rec-qty-input"
                type="number"
                step="any"
                min="0.01"
                value={receiveQtyStr}
                onChange={(e) => setReceiveQtyStr(e.target.value)}
                required
              />
            </div>
            <div>
              <label
                htmlFor="rec-cost-input"
                className="mb-1 block text-xs font-semibold text-foreground"
              >
                Purchase Unit Cost (₱)
              </label>
              <Input
                id="rec-cost-input"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={receiveUnitCostStr}
                onChange={(e) => setReceiveUnitCostStr(e.target.value)}
                error={receiveError}
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsReceiveOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Receive Stock & Save Cost</Button>
          </div>
        </form>
      </ResponsiveDialog>
    </div>
  );
}

