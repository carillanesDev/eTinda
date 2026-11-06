import { NextResponse } from "next/server";
import { uuidSchema } from "@/lib/validation/schemas";
import { serverStoreLedger } from "@/server/repositories/storeLedgerEngine";
import { z } from "zod";

const claimDevicePairingSchema = z.object({
  codeOrToken: z.string().min(5).max(100),
  deviceId: uuidSchema.optional(),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = claimDevicePairingSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_PAIRING_PAYLOAD",
          error: "Invalid 6-digit pairing code format.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const result = serverStoreLedger.claimDevicePairingCode(
      parsed.data.codeOrToken,
      parsed.data.deviceId
    );

    return NextResponse.json({
      ok: true,
      device: result.device,
      store: result.store,
      users: result.users,
      categories: result.categories,
      products: result.products,
    });
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };
    return NextResponse.json(
      {
        ok: false,
        code: err.code ?? "DEVICE_PAIR_FAILED",
        error: err.message,
      },
      { status: err.statusCode ?? 400 }
    );
  }
}
