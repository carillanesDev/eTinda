import { NextResponse } from "next/server";
import { resolveRequestAuthContext } from "@/lib/auth/guard";
import { uuidSchema } from "@/lib/validation/schemas";
import { serverStoreLedger } from "@/server/repositories/storeLedgerEngine";
import { z } from "zod";

const updateDeviceAuthorizationSchema = z.object({
  deviceId: uuidSchema,
  isAuthorized: z.boolean(),
});

const createDevicePairingSchema = z.object({
  deviceName: z.string().min(2).max(50),
  deviceType: z.enum(["MOBILE", "TABLET", "DESKTOP"]).default("MOBILE"),
  snapshot: z
    .object({
      store: z.any().optional(),
      users: z.array(z.any()).optional(),
      categories: z.array(z.any()).optional(),
      products: z.array(z.any()).optional(),
      authVerifiers: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const checkCode = url.searchParams.get("checkCode");
    if (checkCode) {
      const record = serverStoreLedger.checkDevicePairingCode(checkCode);
      if (!record) {
        return NextResponse.json(
          { ok: false, error: "Pairing code not found or has expired." },
          { status: 404 }
        );
      }
      return NextResponse.json({
        ok: true,
        code: record.code,
        formattedCode: `${record.code.slice(0, 3)}-${record.code.slice(3)}`,
        isClaimed: record.isClaimed,
        claimedAt: record.claimedAt,
        claimedDeviceId: record.claimedDeviceId,
        deviceName: record.deviceName,
        deviceType: record.deviceType,
        expiresAt: record.expiresAt,
      });
    }

    const ctx = await resolveRequestAuthContext(request);
    const devices = Array.from(
      serverStoreLedger.getState().devices.values()
    ).filter((d) => d.storeId === ctx.storeId);
    return NextResponse.json({ ok: true, devices });
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };
    return NextResponse.json(
      { ok: false, code: err.code ?? "DEVICES_GET_ERROR", error: err.message },
      { status: err.statusCode ?? 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await resolveRequestAuthContext(
      request,
      "MANAGE_USERS_AND_DEVICES"
    );
    const rawBody = await request.json();
    const parsed = createDevicePairingSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_PAYLOAD",
          error: "Invalid device pairing request payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const record = serverStoreLedger.createDevicePairingCode({
      actorUserId: ctx.userId,
      storeId: ctx.storeId,
      deviceName: parsed.data.deviceName,
      deviceType: parsed.data.deviceType,
      snapshot: parsed.data.snapshot,
    });

    return NextResponse.json({
      ok: true,
      code: record.code,
      formattedCode: `${record.code.slice(0, 3)}-${record.code.slice(3)}`,
      token: record.token,
      expiresAt: record.expiresAt,
      deviceName: record.deviceName,
      deviceType: record.deviceType,
    });
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };
    return NextResponse.json(
      { ok: false, code: err.code ?? "DEVICE_PAIR_ERROR", error: err.message },
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

