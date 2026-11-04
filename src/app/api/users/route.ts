import { NextResponse } from "next/server";
import { resolveRequestAuthContext } from "@/lib/auth/guard";
import { hashPasswordOrPin, verifyPasswordOrPin } from "@/lib/auth/password";
import { isPrismaDatabaseConfigured, prisma } from "@/lib/db/prisma";
import {
  DEFAULT_DEVICE_ID,
  DEFAULT_STORE_ID,
} from "@/lib/db/seed-local";
import {
  createStoreUserSchema,
  ownerRegistrationSchema,
  updateStoreUserStatusSchema,
} from "@/lib/validation/schemas";
import { serverStoreLedger } from "@/server/repositories/storeLedgerEngine";

export async function GET(request: Request) {
  try {
    const ctx = await resolveRequestAuthContext(request);
    const state = serverStoreLedger.getState();

    const users = Array.from(state.users.values()).filter(
      (u) => u.storeId === ctx.storeId
    );
    const store = state.stores.get(ctx.storeId) ?? Array.from(state.stores.values())[0];

    return NextResponse.json({
      ok: true,
      store,
      users,
    });
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };
    return NextResponse.json(
      { ok: false, code: err.code ?? "USERS_GET_ERROR", error: err.message },
      { status: err.statusCode ?? 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = (await request.json()) as Record<string, unknown>;
    const mode = String(rawBody.mode ?? "CREATE_USER");

    if (mode === "VERIFY_CREDENTIALS") {
      const identifier = String(rawBody.identifier ?? "").trim().toLowerCase();
      const pinOrPassword = String(rawBody.pinOrPassword ?? "").trim();

      if (!identifier || !pinOrPassword) {
        return NextResponse.json(
          {
            ok: false,
            code: "INVALID_CREDENTIALS",
            error: "Please enter both your email/username and password.",
          },
          { status: 400 }
        );
      }

      const memVerified = serverStoreLedger.verifyUserCredentials(
        identifier,
        pinOrPassword
      );
      if (memVerified) {
        const store =
          serverStoreLedger.getState().stores.get(memVerified.storeId) ??
          Array.from(serverStoreLedger.getState().stores.values())[0];
        return NextResponse.json({
          ok: true,
          user: memVerified,
          store,
        });
      }

      if (isPrismaDatabaseConfigured()) {
        try {
          const dbUser = await prisma.user.findFirst({
            where: {
              isActive: true,
              OR: [{ username: identifier }, { email: identifier }],
            },
            include: { store: true },
          });

          if (
            dbUser &&
            verifyPasswordOrPin(pinOrPassword, dbUser.passwordHash)
          ) {
            const hydratedUser = {
              id: dbUser.id,
              storeId: dbUser.storeId,
              name: dbUser.name,
              email: dbUser.email,
              username: dbUser.username,
              role: dbUser.role as "ADMIN" | "HELPER",
              isActive: dbUser.isActive,
              createdAt: dbUser.createdAt.toISOString(),
            };
            const hydratedStore = {
              id: dbUser.store.id,
              name: dbUser.store.name,
              address: dbUser.store.address,
              contactNumber: dbUser.store.contactNumber,
              createdAt: dbUser.store.createdAt.toISOString(),
            };
            const state = serverStoreLedger.getState();
            state.stores.set(hydratedStore.id, hydratedStore);
            state.users.set(hydratedUser.id, hydratedUser);
            state.userPasswordHashes.set(dbUser.id, dbUser.passwordHash);

            return NextResponse.json({
              ok: true,
              user: hydratedUser,
              store: hydratedStore,
            });
          }
        } catch (dbErr) {
          console.error(
            "[eTinda Users] Prisma credential lookup warning:",
            dbErr
          );
        }
      }

      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_CREDENTIALS",
          error: "Invalid email/username or password.",
        },
        { status: 401 }
      );
    }

    if (mode === "REGISTER_OWNER") {
      const parsed = ownerRegistrationSchema.safeParse(rawBody);
      if (!parsed.success) {
        return NextResponse.json(
          {
            ok: false,
            code: "INVALID_PAYLOAD",
            error: "Invalid Owner registration details",
            details: parsed.error.flatten(),
          },
          { status: 400 }
        );
      }

      const deviceId =
        typeof rawBody.deviceId === "string" && rawBody.deviceId.length > 0
          ? rawBody.deviceId
          : DEFAULT_DEVICE_ID;
      const storeId =
        typeof rawBody.storeId === "string" && rawBody.storeId.length > 0
          ? rawBody.storeId
          : DEFAULT_STORE_ID;
      const ownerId =
        typeof rawBody.ownerId === "string" && rawBody.ownerId.length > 0
          ? rawBody.ownerId
          : undefined;

      const { store, owner } = serverStoreLedger.registerOwnerAndStore({
        storeId,
        storeName: parsed.data.storeName,
        storeAddress: parsed.data.storeAddress,
        contactNumber: parsed.data.contactNumber,
        ownerId,
        ownerName: parsed.data.ownerName,
        email: parsed.data.email,
        username: parsed.data.username,
        pinOrPassword: parsed.data.pinOrPassword,
        deviceId,
      });

      if (isPrismaDatabaseConfigured()) {
        try {
          const passwordHash = hashPasswordOrPin(parsed.data.pinOrPassword);
          await prisma.$transaction(async (tx) => {
            await tx.store.upsert({
              where: { id: store.id },
              update: {
                name: store.name,
                address: store.address,
                contactNumber: store.contactNumber,
              },
              create: {
                id: store.id,
                name: store.name,
                address: store.address,
                contactNumber: store.contactNumber,
                createdAt: new Date(store.createdAt),
              },
            });

            await tx.user.upsert({
              where: { id: owner.id },
              update: {
                name: owner.name,
                email: owner.email,
                username: owner.username,
                passwordHash,
                role: "ADMIN",
                isActive: true,
              },
              create: {
                id: owner.id,
                storeId: store.id,
                name: owner.name,
                email: owner.email,
                username: owner.username,
                passwordHash,
                role: "ADMIN",
                isActive: true,
                createdAt: new Date(owner.createdAt),
              },
            });

            await tx.device.upsert({
              where: { id: deviceId },
              update: {
                isAuthorized: true,
                registeredByUserId: owner.id,
              },
              create: {
                id: deviceId,
                storeId: store.id,
                deviceName: "Primary Store Terminal",
                deviceType: "TABLET",
                registeredByUserId: owner.id,
                isAuthorized: true,
              },
            });
          });
        } catch (dbErr) {
          console.error(
            "[eTinda Users] Prisma owner registration persistence warning:",
            dbErr
          );
        }
      }

      return NextResponse.json(
        {
          ok: true,
          store,
          user: owner,
        },
        { status: 201 }
      );
    }

    // Mode: CREATE_USER (Owner creating a Helper or Co-Owner account)
    const ctx = await resolveRequestAuthContext(
      request,
      "MANAGE_USERS_AND_DEVICES"
    );

    const parsed = createStoreUserSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_PAYLOAD",
          error: "Invalid user account payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    // Hydrate Owner in serverStoreLedger if serverless cold start occurred
    const state = serverStoreLedger.getState();
    if (!state.stores.has(ctx.storeId)) {
      state.stores.set(ctx.storeId, {
        id: ctx.storeId,
        name: "My Sari-Sari Store",
        address: "",
        contactNumber: "",
        createdAt: new Date().toISOString(),
      });
    }
    if (!state.users.has(ctx.userId)) {
      const ownerSlug = ctx.userId.replace(/-/g, "").slice(0, 8);
      state.users.set(ctx.userId, {
        id: ctx.userId,
        storeId: ctx.storeId,
        name: "Store Owner",
        email: `owner.${ownerSlug}@etinda.ph`,
        username: `owner_${ownerSlug}`,
        role: "ADMIN",
        isActive: true,
        createdAt: new Date().toISOString(),
      });
    }

    const requestedUserId =
      typeof rawBody.userId === "string" && rawBody.userId.length > 0
        ? rawBody.userId
        : undefined;

    const newUser = serverStoreLedger.createStoreUser({
      actorUserId: ctx.userId,
      storeId: ctx.storeId,
      deviceId: ctx.deviceId,
      userId: requestedUserId,
      name: parsed.data.name,
      email: parsed.data.email,
      username: parsed.data.username,
      role: parsed.data.role,
      pinOrPassword: parsed.data.pinOrPassword,
    });

    if (isPrismaDatabaseConfigured()) {
      try {
        const passwordHash = hashPasswordOrPin(parsed.data.pinOrPassword);
        await prisma.$transaction(async (tx) => {
          await tx.store.upsert({
            where: { id: newUser.storeId },
            update: {},
            create: {
              id: newUser.storeId,
              name: "My Sari-Sari Store",
              address: "",
              contactNumber: "",
            },
          });

          await tx.user.upsert({
            where: { id: newUser.id },
            update: {
              name: newUser.name,
              email: newUser.email,
              username: newUser.username,
              passwordHash,
              role: newUser.role,
              isActive: newUser.isActive,
            },
            create: {
              id: newUser.id,
              storeId: newUser.storeId,
              name: newUser.name,
              email: newUser.email,
              username: newUser.username,
              passwordHash,
              role: newUser.role,
              isActive: newUser.isActive,
              createdAt: new Date(newUser.createdAt),
            },
          });
        });
      } catch (dbErr) {
        console.error(
          "[eTinda Users] Prisma create user persistence warning:",
          dbErr
        );
      }
    }

    return NextResponse.json(
      {
        ok: true,
        user: newUser,
      },
      { status: 201 }
    );
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };
    return NextResponse.json(
      { ok: false, code: err.code ?? "USER_CREATE_ERROR", error: err.message },
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
    const parsed = updateStoreUserStatusSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_PAYLOAD",
          error: "Invalid user status update payload",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const updatedUser = serverStoreLedger.setUserActiveStatus({
      actorUserId: ctx.userId,
      deviceId: ctx.deviceId,
      targetUserId: parsed.data.userId,
      isActive: parsed.data.isActive,
    });

    if (process.env.ETINDA_USE_PRISMA_DB === "true") {
      await prisma.user.update({
        where: { id: updatedUser.id },
        data: { isActive: updatedUser.isActive },
      });
    }

    return NextResponse.json({
      ok: true,
      user: updatedUser,
    });
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };
    return NextResponse.json(
      { ok: false, code: err.code ?? "USER_UPDATE_ERROR", error: err.message },
      { status: err.statusCode ?? 500 }
    );
  }
}

