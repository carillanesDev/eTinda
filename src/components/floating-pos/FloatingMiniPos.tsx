"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Check,
  GripHorizontal,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  ShoppingBasket,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { SearchInput } from "@/components/shared/StateViews";
import { StockStatusBadge } from "@/components/shared/StatusBadges";
import { completeSaleTransaction } from "@/features/sales/salesService";
import { db } from "@/lib/db/dexie";
import { cn } from "@/lib/utils/cn";
import { useCartStore } from "@/stores/useCartStore";
import { useUIStore } from "@/stores/useUIStore";

export function FloatingMiniPos() {
  const pathname = usePathname();
  const router = useRouter();

  const isExpanded = useUIStore((s) => s.isMiniPosExpanded);
  const isHiddenByUser = useUIStore((s) => s.isMiniPosHiddenByUser);
  const setExpanded = useUIStore((s) => s.setMiniPosExpanded);
  const setHiddenByUser = useUIStore((s) => s.setMiniPosHiddenByUser);
  const offset = useUIStore((s) => s.miniPosOffset);
  const setOffset = useUIStore((s) => s.setMiniPosOffset);

  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const stepItemQuantity = useCartStore((s) => s.stepItemQuantity);
  const clearCart = useCartStore((s) => s.clearCart);
  const totalCentavos = useCartStore((s) => s.getTotalCentavos());

  const [searchQuery, setSearchQuery] = React.useState("");
  const [quickSaleMessage, setQuickSaleMessage] = React.useState<string | null>(
    null
  );
  const [isProcessing, setIsProcessing] = React.useState(false);

  // Dragging state
  const dragStartRef = React.useRef<{
    pointerId: number;
    pointerX: number;
    pointerY: number;
    startX: number;
    startY: number;
    hasMoved: boolean;
    captured: boolean;
  } | null>(null);
  const wasDraggedRef = React.useRef(false);

  const matchingProducts =
    useLiveQuery(async () => {
      const allActive = await db.products
        .filter((p) => p.isActive)
        .toArray();
      const q = searchQuery.trim().toLowerCase();
      if (!q) {
        return allActive.filter((p) => p.isFrequent).slice(0, 5);
      }
      return allActive
        .filter((p) => p.name.toLowerCase().includes(q))
        .slice(0, 6);
    }, [searchQuery]) ?? [];

  // Never block essential POS controls when already on /pos (DESIGNS.md §11)
  if (
    pathname === "/pos" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/device-setup")
  ) {
    return null;
  }

  if (isHiddenByUser) {
    return null;
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    const targetEl = e.target as HTMLElement | null;
    if (
      targetEl &&
      targetEl !== e.currentTarget &&
      targetEl.closest("[data-no-drag='true']")
    ) {
      return;
    }
    wasDraggedRef.current = false;
    dragStartRef.current = {
      pointerId: e.pointerId,
      pointerX: e.clientX,
      pointerY: e.clientY,
      startX: offset.x,
      startY: offset.y,
      hasMoved: false,
      captured: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.pointerX;
    const dy = e.clientY - dragStartRef.current.pointerY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragStartRef.current.hasMoved = true;
      wasDraggedRef.current = true;
      if (!dragStartRef.current.captured) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragStartRef.current.captured = true;
        } catch {
          // Ignore if pointer capture is unavailable
        }
      }
    }
    if (!dragStartRef.current.hasMoved) return;
    const maxOffsetX =
      typeof window !== "undefined" ? window.innerWidth - 100 : 300;
    const maxOffsetY =
      typeof window !== "undefined" ? window.innerHeight - 160 : 500;
    const clampedX = Math.max(
      -maxOffsetX,
      Math.min(20, dragStartRef.current.startX + dx)
    );
    const clampedY = Math.max(
      -maxOffsetY,
      Math.min(20, dragStartRef.current.startY + dy)
    );
    setOffset({ x: clampedX, y: clampedY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (dragStartRef.current?.captured) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if already released
      }
    }
    dragStartRef.current = null;
  };

  const handleQuickExactCashSale = async () => {
    if (items.length === 0 || isProcessing) return;
    setIsProcessing(true);
    try {
      const sale = await completeSaleTransaction({
        items,
        paymentMethod: "CASH",
        cashTenderedCentavos: totalCentavos,
        notes: "Express Cash Sale via Floating Mini-POS",
      });
      clearCart();
      setQuickSaleMessage(`Saved ${sale.receiptNumber}`);
      setTimeout(() => setQuickSaleMessage(null), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  // Minimized Floating Action Button (FAB)
  if (!isExpanded) {
    return (
      <div
        style={{
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
        }}
        className="fixed bottom-20 right-4 z-40 md:bottom-6 md:right-6"
      >
        <div className="flex items-center gap-1 rounded-full border border-emerald-700 bg-primary p-1 text-primary-foreground shadow-xl">
          <button
            type="button"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onClick={() => {
              if (!wasDraggedRef.current) {
                setExpanded(true);
              }
            }}
            data-testid="floating-mini-pos-fab"
            aria-label="Open Quick Mini-POS Panel"
            className="flex min-h-11 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold hover:bg-primary-hover cursor-pointer"
          >
            <ShoppingBasket className="h-4 w-4 shrink-0" />
            <span>Quick POS</span>
            {items.length > 0 ? (
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-primary">
                {items.length} • <CurrencyDisplay centavos={totalCentavos} />
              </span>
            ) : null}
          </button>
          <button
            type="button"
            data-no-drag="true"
            data-testid="floating-mini-pos-dismiss-btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setHiddenByUser(true)}
            aria-label="Dismiss Floating Mini-POS button"
            className="flex h-8 w-8 items-center justify-center rounded-full text-emerald-100 hover:bg-emerald-800 hover:text-white cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Expanded Draggable Mini-POS Panel
  return (
    <div
      style={{
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
      }}
      data-testid="floating-mini-pos-panel"
      role="region"
      aria-label="Floating Quick Mini-POS Window"
      className="fixed bottom-20 right-3 z-40 flex max-h-[74dvh] w-[calc(100vw-24px)] max-w-[360px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl md:bottom-6 md:right-6"
    >
      {/* Draggable Header Bar */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex cursor-grab items-center justify-between bg-slate-900 px-3.5 py-2.5 text-white active:cursor-grabbing select-none"
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-semibold tracking-wide">
            Quick Lookup & Mini-POS
          </span>
        </div>
        <div
          data-no-drag="true"
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center gap-1"
        >
          <button
            type="button"
            data-no-drag="true"
            data-testid="floating-mini-pos-maximize-btn"
            onClick={() => {
              setExpanded(false);
              router.push("/pos");
            }}
            title="Expand to full POS screen"
            aria-label="Expand to full POS screen"
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            data-no-drag="true"
            data-testid="floating-mini-pos-minimize-btn"
            onClick={() => setExpanded(false)}
            title="Minimize panel"
            aria-label="Minimize Mini-POS panel"
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            data-no-drag="true"
            data-testid="floating-mini-pos-close-btn"
            onClick={() => setHiddenByUser(true)}
            title="Close Mini-POS"
            aria-label="Close Mini-POS panel"
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Price & stock check (e.g. Canton, Rice)..."
          ariaLabel="Quick product search in Mini-POS"
        />

        {quickSaleMessage ? (
          <div className="flex items-center gap-2 rounded-lg bg-primary-muted px-3 py-2 text-xs font-semibold text-primary-muted-foreground">
            <Check className="h-4 w-4 shrink-0" />
            <span>{quickSaleMessage} (Saved Locally)</span>
          </div>
        ) : null}

        {/* Quick Lookup Results */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {searchQuery.trim() ? "Matching Products" : "Frequent Items"}
          </p>
          {matchingProducts.map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">
                  {product.name}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <CurrencyDisplay
                    centavos={product.sellingPriceCentavos}
                    className="text-primary"
                  />
                  <span>/ {product.baseUnit}</span>
                  <StockStatusBadge
                    stock={product.cachedStock}
                    lowStockThreshold={product.lowStockThreshold}
                    unitLabel={product.baseUnit}
                    compact
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => addItem(product)}
                aria-label={`Add ${product.name} to cart`}
                className="h-9 px-2.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
          ))}
        </div>

        {/* Active Mini Cart Summary */}
        {items.length > 0 ? (
          <div className="rounded-xl border border-border bg-muted/30 p-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                Active Cart ({items.length})
              </span>
              <span className="text-sm font-bold text-primary">
                <CurrencyDisplay centavos={totalCentavos} />
              </span>
            </div>
            <div className="max-h-28 space-y-1.5 overflow-y-auto pr-1">
              {items.map((line) => (
                <div
                  key={line.cartLineId}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="truncate pr-2 text-foreground">
                    {line.productName}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => stepItemQuantity(line.cartLineId, -1)}
                      className="flex h-6 w-6 items-center justify-center rounded border border-border bg-card hover:bg-muted cursor-pointer"
                      aria-label={`Decrease ${line.productName}`}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-7 text-center font-mono text-xs font-semibold">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => stepItemQuantity(line.cartLineId, 1)}
                      className="flex h-6 w-6 items-center justify-center rounded border border-border bg-card hover:bg-muted cursor-pointer"
                      aria-label={`Increase ${line.productName}`}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center gap-2 border-t border-border bg-muted/50 p-2.5">
        {items.length > 0 ? (
          <Button
            size="sm"
            variant="secondary"
            className="flex-1 text-xs"
            disabled={isProcessing}
            onClick={() => void handleQuickExactCashSale()}
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Exact Cash (<CurrencyDisplay centavos={totalCentavos} />)
          </Button>
        ) : null}
        <Button
          size="sm"
          className={cn("text-xs", items.length === 0 ? "w-full" : "flex-1")}
          onClick={() => router.push("/pos")}
        >
          Full POS Checkout →
        </Button>
      </div>
    </div>
  );
}

