import { NextResponse } from "next/server";
import { resolveRequestAuthContext } from "@/lib/auth/guard";
import { serverStoreLedger } from "@/server/repositories/storeLedgerEngine";

export async function GET(request: Request) {
  try {
    const ctx = await resolveRequestAuthContext(request, "VIEW_SALES_HISTORY");
    const state = serverStoreLedger.getState();

    const sales = Array.from(state.sales.values())
      .filter((s) => s.storeId === ctx.storeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const saleItems = Array.from(state.saleItems.values()).filter(
      (i) => i.storeId === ctx.storeId
    );

    return NextResponse.json({
      ok: true,
      sales,
      saleItems,
    });
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };
    return NextResponse.json(
      { ok: false, code: err.code ?? "SALES_GET_ERROR", error: err.message },
      { status: err.statusCode ?? 500 }
    );
  }
}

