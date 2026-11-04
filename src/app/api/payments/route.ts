import { NextResponse } from "next/server";
import { resolveRequestAuthContext } from "@/lib/auth/guard";
import { generateUuid } from "@/lib/utils/uuid";
import { utangPaymentSchema } from "@/lib/validation/schemas";
import { serverStoreLedger } from "@/server/repositories/storeLedgerEngine";
import type { PaymentEntity, UtangLedgerEntryEntity } from "@/types/domain";

export async function GET(request: Request) {
  try {
    const ctx = await resolveRequestAuthContext(
      request,
      "RECORD_UTANG_CHARGE_OR_PAYMENT"
    );
    const state = serverStoreLedger.getState();

    const payments = Array.from(state.payments.values())
      .filter((p) => p.storeId === ctx.storeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({
      ok: true,
      payments,
    });
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };
    return NextResponse.json(
      { ok: false, code: err.code ?? "PAYMENTS_GET_ERROR", error: err.message },
      { status: err.statusCode ?? 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await resolveRequestAuthContext(
      request,
      "RECORD_UTANG_CHARGE_OR_PAYMENT"
    );
    const rawBody = await request.json();
    const parsed = utangPaymentSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_PAYLOAD",
          error: "Invalid Utang payment payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const state = serverStoreLedger.getState();
    const customer = state.customers.get(input.customerId);
    if (!customer) {
      return NextResponse.json(
        { ok: false, code: "CUSTOMER_NOT_FOUND", error: "Customer not found." },
        { status: 404 }
      );
    }

    const account = Array.from(state.utangAccounts.values()).find(
      (a) => a.customerId === customer.id
    );

    if (
      ctx.role === "HELPER" &&
      account &&
      account.cachedBalanceCentavos >= 0 &&
      input.amountCentavos > account.cachedBalanceCentavos
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "OVERPAYMENT_NOT_ALLOWED_FOR_HELPER",
          error:
            "Helper payment cannot exceed the customer's current outstanding Utang balance.",
        },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const paymentId = generateUuid();
    const ledgerId = generateUuid();
    const userName = state.users.get(ctx.userId)?.name ?? "Store User";

    const paymentRecord: PaymentEntity = {
      id: paymentId,
      storeId: ctx.storeId,
      customerId: customer.id,
      customerNameSnapshot: customer.name,
      amountCentavos: input.amountCentavos,
      paymentType: "UTANG_PAYMENT",
      notes: input.notes ?? "Customer utang payment",
      deviceId: ctx.deviceId,
      userId: ctx.userId,
      userNameSnapshot: userName,
      syncStatus: "SYNCED",
      createdAt: nowIso,
    };

    const ledgerEntry: UtangLedgerEntryEntity = {
      id: ledgerId,
      storeId: ctx.storeId,
      utangAccountId: account?.id ?? generateUuid(),
      customerId: customer.id,
      customerNameSnapshot: customer.name,
      entryType: "PAYMENT",
      signedAmountCentavos: -Math.abs(input.amountCentavos),
      runningBalanceSnapshotCentavos: 0,
      referencePaymentId: paymentId,
      notes: input.notes ?? "Customer cash payment toward utang balance",
      deviceId: ctx.deviceId,
      userId: ctx.userId,
      userNameSnapshot: userName,
      syncStatus: "SYNCED",
      createdAt: nowIso,
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
          eventType: "UTANG_LEDGER_RECORDED",
          entityId: ledgerId,
          schemaVersion: 1,
          createdAt: nowIso,
          payload: {
            ledgerEntry,
            paymentRecord,
          },
        },
      ],
    });

    return NextResponse.json(
      {
        ok: true,
        paymentRecord,
        acknowledgment: result.acknowledgments[0],
      },
      { status: 201 }
    );
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };
    return NextResponse.json(
      { ok: false, code: err.code ?? "PAYMENT_CREATE_ERROR", error: err.message },
      { status: err.statusCode ?? 500 }
    );
  }
}
