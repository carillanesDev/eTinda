import { NextResponse } from "next/server";
import { DEFAULT_STORE_ID } from "@/lib/db/seed-local";
import { syncEventSchema, uuidSchema } from "@/lib/validation/schemas";
import { executeServerSyncBatch } from "@/server/repositories/prismaSyncRepository";
import { serverStoreLedger } from "@/server/repositories/storeLedgerEngine";
import { z } from "zod";

const syncBatchRequestSchema = z.object({
  storeId: uuidSchema,
  deviceId: uuidSchema,
  storeName: z.string().optional(),
  deviceName: z.string().optional(),
  actorUser: z
    .object({
      id: uuidSchema,
      name: z.string().optional(),
      email: z.string().optional(),
      username: z.string().optional(),
      role: z.enum(["ADMIN", "HELPER"]),
    })
    .optional(),
  isDeviceAuthorized: z.boolean().optional().default(true),
  simulateFailure: z.boolean().optional().default(false),
  events: z.array(syncEventSchema),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = syncBatchRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_PAYLOAD",
          error: "Invalid synchronization batch payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      storeId,
      deviceId,
      storeName,
      deviceName,
      actorUser,
      isDeviceAuthorized,
      simulateFailure,
      events,
    } = parsed.data;

    const headerUserId = request.headers.get("x-etinda-user-id");
    const headerRole = request.headers.get("x-etinda-user-role");
    const resolvedActorUser =
      actorUser ??
      (headerUserId && (headerRole === "ADMIN" || headerRole === "HELPER")
        ? {
            id: headerUserId,
            role: headerRole,
          }
        : undefined);

    if (simulateFailure) {
      return NextResponse.json(
        {
          ok: false,
          code: "SERVER_UNAVAILABLE",
          error:
            "Server temporarily unreachable (simulated network/server failure). Local transactions remain safely queued in IndexedDB outbox.",
        },
        { status: 503 }
      );
    }

    const result = await executeServerSyncBatch({
      storeId,
      deviceId,
      storeName,
      deviceName,
      actorUser: resolvedActorUser,
      isDeviceAuthorized,
      simulateFailure: false,
      events,
    });

    return NextResponse.json({
      ok: true,
      serverTimestamp: result.serverTimestamp,
      lastSequenceNumber: result.lastSequenceNumber,
      acknowledgments: result.acknowledgments,
    });
  } catch (error) {
    const typedError = error as Error & {
      statusCode?: number;
      code?: string;
    };
    const statusCode = typedError.statusCode ?? 500;

    return NextResponse.json(
      {
        ok: false,
        code: typedError.code ?? "SYNC_SERVER_ERROR",
        error:
          typedError instanceof Error
            ? typedError.message
            : "Unexpected synchronization server error",
      },
      { status: statusCode }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get("storeId") ?? DEFAULT_STORE_ID;
    const deviceId = searchParams.get("deviceId") ?? undefined;
    const sinceRaw = searchParams.get("sinceSequenceNumber");
    const sinceSequenceNumber = sinceRaw
      ? Math.max(0, Number.parseInt(sinceRaw, 10) || 0)
      : 0;

    const delta = serverStoreLedger.pullDeltaSnapshot({
      storeId,
      deviceId,
      sinceSequenceNumber,
    });

    return NextResponse.json({
      ok: true,
      ...delta,
    });
  } catch (error) {
    const typedError = error as Error & {
      statusCode?: number;
      code?: string;
    };
    return NextResponse.json(
      {
        ok: false,
        code: typedError.code ?? "SYNC_PULL_ERROR",
        error:
          typedError instanceof Error
            ? typedError.message
            : "Failed to pull delta snapshot",
      },
      { status: typedError.statusCode ?? 500 }
    );
  }
}
