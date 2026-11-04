import { NextResponse } from "next/server";
import { resolveRequestAuthContext } from "@/lib/auth/guard";
import { generateUuid } from "@/lib/utils/uuid";
import { stockAdjustmentFormSchema } from "@/lib/validation/schemas";
import { serverStoreLedger } from "@/server/repositories/storeLedgerEngine";

export async function GET(request: Request) {
  try {
    const ctx = await resolveRequestAuthContext(request, "VIEW_INVENTORY");
    const state = serverStoreLedger.getState();

    const movements = Array.from(state.inventoryMovements.values())
      .filter((m) => m.storeId === ctx.storeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({
      ok: true,
      movements,
    });
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };
    return NextResponse.json(
      { ok: false, code: err.code ?? "INVENTORY_GET_ERROR", error: err.message },
      { status: err.statusCode ?? 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await resolveRequestAuthContext(request, "ADJUST_INVENTORY");
    const rawBody = await request.json();
    const parsed = stockAdjustmentFormSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_PAYLOAD",
          error: "Invalid stock adjustment payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const nowIso = new Date().toISOString();
    const movementId = generateUuid();
    const eventId = generateUuid();

    const product = serverStoreLedger.getState().products.get(input.productId);
    if (!product) {
      return NextResponse.json(
        { ok: false, code: "PRODUCT_NOT_FOUND", error: "Product not found." },
        { status: 404 }
      );
    }

    const signedChange =
      input.movementType === "STOCK_DEDUCTION"
        ? -Math.abs(input.quantityChange)
        : input.movementType === "STOCK_ADDITION"
          ? Math.abs(input.quantityChange)
          : input.quantityChange;

    const movementPayload = {
      id: movementId,
      storeId: ctx.storeId,
      productId: product.id,
      productNameSnapshot: product.name,
      movementType: input.movementType,
      quantityChange: signedChange,
      unitCostCentavos: product.latestCostCentavos,
      reasonOrNotes: input.reasonOrNotes,
      deviceId: ctx.deviceId,
      userId: ctx.userId,
      userNameSnapshot:
        serverStoreLedger.getState().users.get(ctx.userId)?.name ?? "Store User",
      syncStatus: "SYNCED" as const,
      createdAt: nowIso,
    };

    const result = serverStoreLedger.processSyncBatch({
      storeId: ctx.storeId,
      deviceId: ctx.deviceId,
      events: [
        {
          eventId,
          storeId: ctx.storeId,
          deviceId: ctx.deviceId,
          userId: ctx.userId,
          eventType: "INVENTORY_MOVEMENT_RECORDED",
          entityId: movementId,
          schemaVersion: 1,
          createdAt: nowIso,
          payload: movementPayload,
        },
      ],
    });

    return NextResponse.json(
      {
        ok: true,
        movement: movementPayload,
        acknowledgment: result.acknowledgments[0],
      },
      { status: 201 }
    );
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };
    return NextResponse.json(
      {
        ok: false,
        code: err.code ?? "INVENTORY_ADJUSTMENT_ERROR",
        error: err.message,
      },
      { status: err.statusCode ?? 500 }
    );
  }
}
