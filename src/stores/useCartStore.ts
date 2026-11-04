"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  calculateLineSubtotalCentavos,
  sumCentavos,
} from "@/lib/utils/money";
import { normalizeQuantity } from "@/lib/utils/quantity";
import type {
  CartLineItem,
  PaymentMethod,
  ProductEntity,
  ProductVariantEntity,
} from "@/types/domain";

export interface CartState {
  items: CartLineItem[];
  paymentMethod: PaymentMethod;
  cashTenderedCentavos: number;
  selectedCustomerId: string;
  checkoutNotes: string;
  addItem: (
    product: ProductEntity,
    variant?: ProductVariantEntity,
    addQty?: number
  ) => void;
  updateItemQuantity: (cartLineId: string, nextQuantity: number) => void;
  stepItemQuantity: (cartLineId: string, delta: number) => void;
  removeItem: (cartLineId: string) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setCashTenderedCentavos: (centavos: number) => void;
  setSelectedCustomerId: (customerId: string) => void;
  setCheckoutNotes: (notes: string) => void;
  clearCart: () => void;
  getTotalCentavos: () => number;
  getItemCount: () => number;
}

export function buildCartLineId(productId: string, variantId?: string): string {
  return `${productId}::${variantId ?? "base"}`;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      paymentMethod: "CASH",
      cashTenderedCentavos: 0,
      selectedCustomerId: "",
      checkoutNotes: "",

      addItem: (product, variant, addQty = 1) => {
        const cartLineId = buildCartLineId(product.id, variant?.id);
        const allowDecimal = variant
          ? variant.allowDecimalQuantity
          : product.allowDecimalQuantity;
        const normalizedAdd = normalizeQuantity(addQty, allowDecimal);
        if (normalizedAdd <= 0) return;

        set((state) => {
          const existingIndex = state.items.findIndex(
            (i) => i.cartLineId === cartLineId
          );

          if (existingIndex >= 0) {
            const updated = [...state.items];
            const existing = updated[existingIndex];
            const nextQty = normalizeQuantity(
              existing.quantity + normalizedAdd,
              existing.allowDecimalQuantity
            );
            updated[existingIndex] = {
              ...existing,
              quantity: nextQty,
              availableBaseStock: product.cachedStock,
            };
            return { items: updated };
          }

          const newItem: CartLineItem = {
            cartLineId,
            productId: product.id,
            variantId: variant?.id,
            productName: variant
              ? `${product.name} (${variant.name})`
              : product.name,
            unitLabel: variant ? variant.unitLabel : product.baseUnit,
            baseUnitMultiplier: variant ? variant.conversionMultiplier : 1,
            unitPriceCentavos: variant
              ? variant.sellingPriceCentavos
              : product.sellingPriceCentavos,
            unitCostSnapshotCentavos: variant
              ? Math.round(
                  product.latestCostCentavos * variant.conversionMultiplier
                )
              : product.latestCostCentavos,
            quantity: normalizedAdd,
            allowDecimalQuantity: allowDecimal,
            availableBaseStock: product.cachedStock,
          };

          return { items: [...state.items, newItem] };
        });
      },

      updateItemQuantity: (cartLineId, nextQuantity) => {
        set((state) => {
          const target = state.items.find((i) => i.cartLineId === cartLineId);
          if (!target) return state;

          const normalized = normalizeQuantity(
            nextQuantity,
            target.allowDecimalQuantity
          );
          if (normalized <= 0) {
            return {
              items: state.items.filter((i) => i.cartLineId !== cartLineId),
            };
          }

          return {
            items: state.items.map((item) =>
              item.cartLineId === cartLineId
                ? { ...item, quantity: normalized }
                : item
            ),
          };
        });
      },

      stepItemQuantity: (cartLineId, delta) => {
        const target = get().items.find((i) => i.cartLineId === cartLineId);
        if (!target) return;
        const next = target.quantity + delta;
        get().updateItemQuantity(cartLineId, next);
      },

      removeItem: (cartLineId) =>
        set((state) => ({
          items: state.items.filter((i) => i.cartLineId !== cartLineId),
        })),

      setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
      setCashTenderedCentavos: (cashTenderedCentavos) =>
        set({ cashTenderedCentavos: Math.max(0, Math.round(cashTenderedCentavos)) }),
      setSelectedCustomerId: (selectedCustomerId) => set({ selectedCustomerId }),
      setCheckoutNotes: (checkoutNotes) => set({ checkoutNotes }),

      clearCart: () =>
        set({
          items: [],
          paymentMethod: "CASH",
          cashTenderedCentavos: 0,
          selectedCustomerId: "",
          checkoutNotes: "",
        }),

      getTotalCentavos: () => {
        const subtotals = get().items.map((item) =>
          calculateLineSubtotalCentavos(item.unitPriceCentavos, item.quantity)
        );
        return sumCentavos(subtotals);
      },

      getItemCount: () => get().items.length,
    }),
    {
      name: "etinda-pos-cart-v1",
    }
  )
);

