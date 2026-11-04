import { NextResponse } from "next/server";
import { resolveRequestAuthContext } from "@/lib/auth/guard";
import { generateUuid } from "@/lib/utils/uuid";
import { productFormSchema } from "@/lib/validation/schemas";
import { serverStoreLedger } from "@/server/repositories/storeLedgerEngine";
import type { ProductEntity } from "@/types/domain";

export async function GET(request: Request) {
  try {
    const ctx = await resolveRequestAuthContext(request, "VIEW_PRODUCTS");
    const state = serverStoreLedger.getState();

    const products = Array.from(state.products.values()).filter(
      (p) => p.storeId === ctx.storeId
    );
    const categories = Array.from(state.categories.values()).filter(
      (c) => c.storeId === ctx.storeId
    );
    const productVariants = Array.from(state.productVariants.values()).filter(
      (v) => v.storeId === ctx.storeId
    );

    return NextResponse.json({
      ok: true,
      products,
      categories,
      productVariants,
    });
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };
    return NextResponse.json(
      { ok: false, code: err.code ?? "PRODUCTS_GET_ERROR", error: err.message },
      { status: err.statusCode ?? 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await resolveRequestAuthContext(request, "MANAGE_PRODUCTS");
    const rawBody = await request.json();
    const parsed = productFormSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_PAYLOAD",
          error: "Invalid product payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const productId =
      typeof rawBody.id === "string" && rawBody.id.length > 0
        ? rawBody.id
        : generateUuid();

    const savedProduct = serverStoreLedger.runInTransaction((tx) => {
      const existing = tx.products.get(productId);
      const product: ProductEntity = {
        id: productId,
        storeId: ctx.storeId,
        categoryId: parsed.data.categoryId,
        name: parsed.data.name,
        baseUnit: parsed.data.baseUnit,
        sellingPriceCentavos: parsed.data.sellingPriceCentavos,
        latestCostCentavos: parsed.data.latestCostCentavos,
        lowStockThreshold: parsed.data.lowStockThreshold,
        allowDecimalQuantity: parsed.data.allowDecimalQuantity,
        isFrequent: parsed.data.isFrequent,
        isActive: parsed.data.isActive,
        cachedStock: existing ? existing.cachedStock : 0,
        syncStatus: "SYNCED",
        createdAt: existing ? existing.createdAt : nowIso,
        updatedAt: nowIso,
      };
      tx.products.set(productId, product);
      return product;
    });

    return NextResponse.json({ ok: true, product: savedProduct }, { status: 201 });
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };
    return NextResponse.json(
      { ok: false, code: err.code ?? "PRODUCT_SAVE_ERROR", error: err.message },
      { status: err.statusCode ?? 500 }
    );
  }
}
