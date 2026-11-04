"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Layers,
  Minus,
  Plus,
  ShoppingCart,
  Star,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CartCheckoutPanel } from "@/components/pos/CartCheckoutPanel";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import {
  EmptyState,
  ResponsiveDialog,
  SearchInput,
} from "@/components/shared/StateViews";
import { StockStatusBadge } from "@/components/shared/StatusBadges";
import { db } from "@/lib/db/dexie";
import { cn } from "@/lib/utils/cn";
import { buildCartLineId, useCartStore } from "@/stores/useCartStore";
import { useUIStore } from "@/stores/useUIStore";
import type { ProductEntity, ProductVariantEntity } from "@/types/domain";

export default function PosScreenPage() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategoryId, setSelectedCategoryId] =
    React.useState<string>("ALL");
  const [variantModalProduct, setVariantModalProduct] =
    React.useState<ProductEntity | null>(null);

  const isMobileCartOpen = useUIStore((s) => s.isMobileCartOpen);
  const setMobileCartOpen = useUIStore((s) => s.setMobileCartOpen);

  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const stepItemQuantity = useCartStore((s) => s.stepItemQuantity);
  const totalCentavos = useCartStore((s) => s.getTotalCentavos());

  const categories =
    useLiveQuery(async () => {
      return db.categories
        .filter((c) => c.isActive)
        .sortBy("sortOrder");
    }, []) ?? [];

  const productsQuery = useLiveQuery(async () => {
    return db.products.filter((p) => p.isActive).toArray();
  }, []);
  const products = React.useMemo(() => productsQuery ?? [], [productsQuery]);

  const variantsQuery = useLiveQuery(async () => {
    return db.product_variants.filter((v) => v.isActive).toArray();
  }, []);

  const variantsByProductId = React.useMemo(() => {
    const map = new Map<string, ProductVariantEntity[]>();
    for (const v of variantsQuery ?? []) {
      const list = map.get(v.productId) ?? [];
      list.push(v);
      map.set(v.productId, list);
    }
    return map;
  }, [variantsQuery]);

  const filteredProducts = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products
      .filter((product) => {
        if (selectedCategoryId === "FREQUENT" && !product.isFrequent) {
          return false;
        }
        if (
          selectedCategoryId !== "ALL" &&
          selectedCategoryId !== "FREQUENT" &&
          product.categoryId !== selectedCategoryId
        ) {
          return false;
        }
        if (!q) return true;
        return product.name.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (a.isFrequent !== b.isFrequent) return a.isFrequent ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [products, searchQuery, selectedCategoryId]);

  const quantityMap = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(
        item.productId,
        (map.get(item.productId) ?? 0) +
          item.quantity * item.baseUnitMultiplier
      );
    }
    return map;
  }, [items]);

  return (
    <div className="flex flex-col gap-4 md:h-[calc(100dvh-5.5rem)] md:flex-row">
      {/* LEFT ~65%: Product Search, Category Pills & Touch Product Grid */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 md:w-[64%] md:overflow-hidden">
        {/* Search & Category Filter Header */}
        <div className="space-y-2.5 rounded-2xl border border-border bg-card p-3 shadow-2xs">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search sari-sari items (e.g., Canton, Rice, Nescafé, Sardines)..."
            ariaLabel="Search POS products"
          />

          {/* Horizontal Category Pills */}
          <div
            className="flex items-center gap-1.5 overflow-x-auto pb-1"
            role="tablist"
            aria-label="Product categories"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategoryId === "ALL"}
              onClick={() => setSelectedCategoryId("ALL")}
              className={cn(
                "min-h-10 shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                selectedCategoryId === "ALL"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-muted/60 text-foreground hover:bg-muted"
              )}
            >
              All Items ({products.length})
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={selectedCategoryId === "FREQUENT"}
              onClick={() => setSelectedCategoryId("FREQUENT")}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                selectedCategoryId === "FREQUENT"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-muted/60 text-foreground hover:bg-muted"
              )}
            >
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
              Frequent
            </button>

            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={selectedCategoryId === cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={cn(
                  "min-h-10 shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                  selectedCategoryId === cat.id
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-muted/60 text-foreground hover:bg-muted"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Selection Grid */}
        <div className="flex-1 overflow-y-auto pr-0.5 pb-16 md:pb-2">
          {filteredProducts.length === 0 ? (
            <EmptyState
              title="No matching products found"
              description="Try clearing your search filter or switching to All Items."
              actionLabel="Reset Filters"
              onAction={() => {
                setSearchQuery("");
                setSelectedCategoryId("ALL");
              }}
            />
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => {
                const productVariants =
                  variantsByProductId.get(product.id) ?? [];
                const baseCartLineId = buildCartLineId(product.id);
                const baseCartItem = items.find(
                  (i) => i.cartLineId === baseCartLineId
                );
                const totalBaseQtyInCart = quantityMap.get(product.id) ?? 0;

                return (
                  <div
                    key={product.id}
                    data-testid={`pos-product-card-${product.id}`}
                    className={cn(
                      "flex flex-col justify-between rounded-xl border bg-card p-3 transition-all",
                      totalBaseQtyInCart > 0
                        ? "border-primary ring-2 ring-primary/25 bg-primary-muted/15"
                        : "border-border hover:border-slate-300"
                    )}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1.5">
                        <StockStatusBadge
                          stock={product.cachedStock}
                          lowStockThreshold={product.lowStockThreshold}
                          unitLabel={product.baseUnit}
                          hasOversellConflict={product.hasOversellConflict}
                          compact
                        />
                        {product.allowDecimalQuantity ? (
                          <Badge variant="info" title="Sold by weight/decimal">
                            <Scale className="h-3 w-3" />
                            <span>kg/dec</span>
                          </Badge>
                        ) : null}
                      </div>

                      <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-foreground leading-snug">
                        {product.name}
                      </h3>

                      <div className="mt-1.5 flex items-baseline gap-1">
                        <CurrencyDisplay
                          centavos={product.sellingPriceCentavos}
                          className="text-base font-bold text-primary"
                        />
                        <span className="text-xs text-muted-foreground">
                          / {product.baseUnit}
                        </span>
                      </div>
                    </div>

                    {/* Action Area */}
                    <div className="mt-3 space-y-1.5 pt-2 border-t border-border/70">
                      {/* Fractional Weight Quick-Tap Buttons (e.g., Rice 1/4 kg, 1/2 kg, 1 kg) */}
                      {product.allowDecimalQuantity ? (
                        <div className="grid grid-cols-3 gap-1">
                          <button
                            type="button"
                            onClick={() => addItem(product, undefined, 0.25)}
                            className="min-h-8 rounded-md border border-border bg-muted/60 text-[11px] font-semibold text-foreground hover:bg-muted cursor-pointer"
                          >
                            +¼ {product.baseUnit}
                          </button>
                          <button
                            type="button"
                            onClick={() => addItem(product, undefined, 0.5)}
                            className="min-h-8 rounded-md border border-border bg-muted/60 text-[11px] font-semibold text-foreground hover:bg-muted cursor-pointer"
                          >
                            +½ {product.baseUnit}
                          </button>
                          <button
                            type="button"
                            onClick={() => addItem(product, undefined, 1)}
                            className="min-h-8 rounded-md bg-primary text-[11px] font-semibold text-primary-foreground hover:bg-primary-hover cursor-pointer"
                          >
                            +1 {product.baseUnit}
                          </button>
                        </div>
                      ) : baseCartItem ? (
                        <div className="flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              stepItemQuantity(baseCartLineId, -1)
                            }
                            aria-label={`Remove 1 ${product.name}`}
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted cursor-pointer"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="font-mono text-sm font-bold text-primary">
                            {baseCartItem.quantity} {product.baseUnit}
                          </span>
                          <button
                            type="button"
                            onClick={() => addItem(product)}
                            aria-label={`Add 1 more ${product.name}`}
                            className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full min-h-10 text-xs font-semibold"
                          onClick={() => addItem(product)}
                          data-testid={`add-to-cart-${product.id}`}
                        >
                          <Plus className="h-4 w-4" />
                          Add 1 {product.baseUnit}
                        </Button>
                      )}

                      {/* Variant / Pack Unit Selector Trigger */}
                      {productVariants.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setVariantModalProduct(product)}
                          className="flex min-h-8 w-full items-center justify-center gap-1 rounded-lg border border-blue-200 bg-info-muted/60 px-2 py-1 text-[11px] font-semibold text-info-muted-foreground hover:bg-info-muted cursor-pointer"
                        >
                          <Layers className="h-3 w-3" />
                          Units ({productVariants.length} Pack/Tie Option
                          {productVariants.length === 1 ? "" : "s"})
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT ~35% on Tablet & Desktop: Persistent Split-Screen Cart & Checkout */}
      <div className="hidden md:block md:w-[36%] md:min-w-[330px] md:max-w-[420px]">
        <CartCheckoutPanel />
      </div>

      {/* MOBILE STICKY BOTTOM CHECKOUT BAR (< 768px) */}
      <div className="fixed bottom-16 left-0 right-0 z-30 border-t border-border bg-card/95 p-2.5 shadow-xl backdrop-blur-md md:hidden">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMobileCartOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left cursor-pointer"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary font-bold">
              {items.length}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                Current Order ({items.length} line{items.length === 1 ? "" : "s"})
              </p>
              <CurrencyDisplay
                centavos={totalCentavos}
                className="text-lg font-extrabold text-foreground"
              />
            </div>
          </button>

          <Button
            size="lg"
            onClick={() => setMobileCartOpen(true)}
            data-testid="mobile-open-checkout-btn"
            className="shrink-0 px-5"
          >
            <ShoppingCart className="h-4 w-4" />
            Checkout →
          </Button>
        </div>
      </div>

      {/* Mobile Full Cart & Checkout Sheet */}
      <ResponsiveDialog
        open={isMobileCartOpen}
        onClose={() => setMobileCartOpen(false)}
        title="Cart & Customer Checkout"
        description="Complete Cash or Utang transaction"
      >
        <CartCheckoutPanel
          onSaleCompleted={() => {
            setTimeout(() => setMobileCartOpen(false), 1200);
          }}
        />
      </ResponsiveDialog>

      {/* Product Variant / Selling Unit Selector Dialog */}
      <ResponsiveDialog
        open={Boolean(variantModalProduct)}
        onClose={() => setVariantModalProduct(null)}
        title={variantModalProduct?.name ?? "Select Selling Unit"}
        description="Choose between base retail unit or wholesale pack/tie conversion"
      >
        {variantModalProduct ? (
          <div className="space-y-2.5">
            {/* Base Unit Option */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Single / Base Unit ({variantModalProduct.baseUnit})
                </p>
                <p className="text-xs text-muted-foreground">
                  Deducts 1 {variantModalProduct.baseUnit} from stock
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  addItem(variantModalProduct);
                  setVariantModalProduct(null);
                }}
              >
                Add (<CurrencyDisplay centavos={variantModalProduct.sellingPriceCentavos} />)
              </Button>
            </div>

            {/* Variants List */}
            {(variantsByProductId.get(variantModalProduct.id) ?? []).map(
              (variant) => (
                <div
                  key={variant.id}
                  className="flex items-center justify-between rounded-xl border border-blue-200 bg-info-muted/30 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {variant.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Unit: <strong>{variant.unitLabel}</strong> • Deducts{" "}
                      {variant.conversionMultiplier}{" "}
                      {variantModalProduct.baseUnit}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      addItem(variantModalProduct, variant);
                      setVariantModalProduct(null);
                    }}
                  >
                    Add (<CurrencyDisplay centavos={variant.sellingPriceCentavos} />)
                  </Button>
                </div>
              )
            )}
          </div>
        ) : null}
      </ResponsiveDialog>
    </div>
  );
}
