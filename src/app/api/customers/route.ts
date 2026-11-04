import { NextResponse } from "next/server";
import { resolveRequestAuthContext } from "@/lib/auth/guard";
import { generateUuid } from "@/lib/utils/uuid";
import { customerFormSchema } from "@/lib/validation/schemas";
import { serverStoreLedger } from "@/server/repositories/storeLedgerEngine";

export async function GET(request: Request) {
  try {
    const ctx = await resolveRequestAuthContext(
      request,
      "VIEW_CUSTOMERS_AND_UTANG"
    );
    const state = serverStoreLedger.getState();

    const customers = Array.from(state.customers.values()).filter(
      (c) => c.storeId === ctx.storeId
    );
    const utangAccounts = Array.from(state.utangAccounts.values()).filter(
      (a) => a.storeId === ctx.storeId
    );
    const utangLedger = Array.from(state.utangLedger.values())
      .filter((l) => l.storeId === ctx.storeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({
      ok: true,
      customers,
      utangAccounts,
      utangLedger,
    });
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };
    return NextResponse.json(
      { ok: false, code: err.code ?? "CUSTOMERS_GET_ERROR", error: err.message },
      { status: err.statusCode ?? 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await resolveRequestAuthContext(
      request,
      "VIEW_CUSTOMERS_AND_UTANG"
    );
    const rawBody = await request.json();
    const parsed = customerFormSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_PAYLOAD",
          error: "Invalid customer payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const customerId = generateUuid();
    const customerPayload = {
      id: customerId,
      storeId: ctx.storeId,
      name: parsed.data.name,
      contactNumber: parsed.data.contactNumber,
      syncStatus: "SYNCED" as const,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const result = serverStoreLedger.processSyncBatch({
      storeId: ctx.storeId,
      deviceId: ctx.deviceId,
      events: [
        {
          eventId: generateUuid(),
          storeId: ctx.storeId,
          deviceId: ctx.deviceId,
          userId: ctx.userId,
          eventType: "CUSTOMER_UPSERTED",
          entityId: customerId,
          schemaVersion: 1,
          createdAt: nowIso,
          payload: customerPayload,
        },
      ],
    });

    return NextResponse.json(
      {
        ok: true,
        customer: customerPayload,
        acknowledgment: result.acknowledgments[0],
      },
      { status: 201 }
    );
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };
    return NextResponse.json(
      { ok: false, code: err.code ?? "CUSTOMER_CREATE_ERROR", error: err.message },
      { status: err.statusCode ?? 500 }
    );
  }
}
