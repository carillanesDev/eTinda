import { NextResponse } from "next/server";
import { resolveRequestAuthContext } from "@/lib/auth/guard";
import { uuidSchema } from "@/lib/validation/schemas";
import { serverStoreLedger } from "@/server/repositories/storeLedgerEngine";
import { z } from "zod";

const updateDeviceAuthorizationSchema = z.object({
  deviceId: uuidSchema,
  isAuthorized: z.boolean(),
});

export async function GET(request: Request) {
  try {
    const ctx = await resolveRequestAuthContext(request);
    const devices = Array.from(serverStoreLedger.getState().devices.values()).filter(
      (d) => d.storeId === ctx.storeId
    );
    return NextResponse.json({ ok: true, devices });
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };
    return NextResponse.json(
      { ok: false, code: err.code ?? "DEVICES_GET_ERROR", error: err.message },
      { status: err.statusCode ?? 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await resolveRequestAuthContext(
      request,
      "MANAGE_USERS_AND_DEVICES"
    );
    const rawBody = await request.json();
    const parsed = updateDeviceAuthorizationSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_PAYLOAD",
          error: "Invalid device authorization payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const updatedDevice = serverStoreLedger.setDeviceAuthorization(
      ctx.userId,
      parsed.data.deviceId,
      parsed.data.isAuthorized
    );

    return NextResponse.json({
      ok: true,
      device: updatedDevice,
    });
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };
    return NextResponse.json(
      { ok: false, code: err.code ?? "DEVICE_UPDATE_ERROR", error: err.message },
      { status: err.statusCode ?? 500 }
    );
  }
}

