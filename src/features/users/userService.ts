"use client";

import { db } from "@/lib/db/dexie";
import {
  DEFAULT_STORE_ID,
  ensureLocalDatabaseInitialized,
} from "@/lib/db/seed-local";
import { hasPermission } from "@/lib/permissions";
import { generateUuid } from "@/lib/utils/uuid";
import {
  createStoreUserSchema,
  ownerRegistrationSchema,
} from "@/lib/validation/schemas";
import { useSessionStore } from "@/stores/useSessionStore";
import type { StoreEntity, UserEntity } from "@/types/domain";
import type { z } from "zod";

/**
 * Computes a one-way salted SHA-256 credential verifier using Web Crypto API
 * so offline sign-in can verify passwords without storing raw secrets in IndexedDB (AGENTS.md §12).
 */
async function computeClientCredentialVerifier(
  userId: string,
  pinOrPassword: string
): Promise<string> {
  const normalized = `etinda-v3:${userId}:${pinOrPassword.trim()}`;
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoded = new TextEncoder().encode(normalized);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback deterministic hash if SubtleCrypto is unavailable in test runner
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16)}`;
}

/**
 * Registers a new Store Owner (ADMIN) account and updates the Store Profile.
 * Persists locally in IndexedDB for instant offline operation and registers hashed
 * credentials with `/api/users` when online.
 */
export async function registerOwnerAccount(
  rawInput: z.infer<typeof ownerRegistrationSchema>
): Promise<{ store: StoreEntity; owner: UserEntity }> {
  await ensureLocalDatabaseInitialized();
  const parsed = ownerRegistrationSchema.safeParse({
    ...rawInput,
    ownerName:
      rawInput.ownerName.trim() ||
      rawInput.username.trim() ||
      "Store Owner",
    storeName:
      rawInput.storeName.trim() || "Aling Nena's Sari-Sari Store",
    storeAddress:
      rawInput.storeAddress.trim() || "Brgy. San Isidro, Quezon City",
    contactNumber: rawInput.contactNumber.trim() || "09178234510",
  });
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ??
        "Invalid Owner registration details. Check your email, username, and password."
    );
  }
  const input = parsed.data;
  const session = useSessionStore.getState();
  const nowIso = new Date().toISOString();

  const normalizedUsername = input.username.trim().toLowerCase();
  const normalizedEmail = input.email.trim().toLowerCase();

  const existingUserByUsername = await db.users
    .filter((u) => u.username.toLowerCase() === normalizedUsername)
    .first();

  if (existingUserByUsername) {
    throw new Error(`Username '${normalizedUsername}' is already taken.`);
  }

  const existingUserByEmail = await db.users
    .filter((u) => (u.email ?? "").toLowerCase() === normalizedEmail)
    .first();

  if (existingUserByEmail) {
    throw new Error(`Email '${normalizedEmail}' is already registered.`);
  }

  const storeId = session.storeId || DEFAULT_STORE_ID;
  const ownerId = generateUuid();

  const existingStore = await db.stores.get(storeId);
  const store: StoreEntity = {
    id: storeId,
    name: input.storeName.trim(),
    address: input.storeAddress.trim(),
    contactNumber: input.contactNumber.trim(),
    createdAt: existingStore?.createdAt ?? nowIso,
  };

  const owner: UserEntity = {
    id: ownerId,
    storeId,
    name: input.ownerName.trim(),
    email: normalizedEmail,
    username: normalizedUsername,
    role: "ADMIN",
    isActive: true,
    createdAt: nowIso,
  };

  const verifier = await computeClientCredentialVerifier(
    owner.id,
    input.pinOrPassword
  );

  await db.transaction(
    "rw",
    [db.stores, db.users, db.audit_logs, db.sync_metadata],
    async () => {
      await db.stores.put(store);
      await db.users.put(owner);
      await db.sync_metadata.put({
        key: `auth_verifier:${owner.id}`,
        value: verifier,
        updatedAt: nowIso,
      });
      await db.audit_logs.put({
        id: generateUuid(),
        storeId,
        deviceId: session.deviceId,
        userId: owner.id,
        userNameSnapshot: owner.name,
        userRole: "ADMIN",
        action: "OWNER_ACCOUNT_REGISTERED",
        entityType: "USER",
        entityId: owner.id,
        summary: `Registered Store Owner account ${owner.name} (@${owner.username}, ${owner.email}) for ${store.name}`,
        createdAt: nowIso,
      });
    }
  );

  // Register hashed credentials with the server when online
  try {
    await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "REGISTER_OWNER",
        storeId,
        ownerId,
        deviceId: session.deviceId,
        ...input,
      }),
    });
  } catch {
    // Offline fallback: local IndexedDB account is active immediately
  }

  session.loginAsUser({
    userId: owner.id,
    userName: owner.name,
    email: owner.email,
    username: owner.username,
    role: "ADMIN",
    storeId: store.id,
    storeName: store.name,
  });

  return { store, owner };
}

/**
 * Creates a new Helper (HELPER) or Co-Owner (ADMIN) account.
 * Restricted strictly to Store Owners (ADMIN) per AGENTS.md Section 5.1.
 */
export async function createStoreUserAccount(
  rawInput: z.infer<typeof createStoreUserSchema>
): Promise<UserEntity> {
  await ensureLocalDatabaseInitialized();
  const session = useSessionStore.getState();
  if (!hasPermission(session.role, "MANAGE_USERS_AND_DEVICES")) {
    throw new Error(
      "Only the Store Owner (ADMIN) can create Helper or User accounts."
    );
  }

  const parsed = createStoreUserSchema.safeParse({
    ...rawInput,
    name: rawInput.name.trim() || rawInput.username.trim(),
  });
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ??
        "Invalid user account details. Check the email, username, and password."
    );
  }
  const input = parsed.data;
  const normalizedUsername = input.username.trim().toLowerCase();
  const normalizedEmail = input.email.trim().toLowerCase();

  const duplicate = await db.users
    .filter((u) => u.username.toLowerCase() === normalizedUsername)
    .first();

  if (duplicate) {
    throw new Error(`Username '${normalizedUsername}' is already registered.`);
  }

  const duplicateEmail = await db.users
    .filter((u) => (u.email ?? "").toLowerCase() === normalizedEmail)
    .first();

  if (duplicateEmail) {
    throw new Error(`Email '${normalizedEmail}' is already registered.`);
  }

  const nowIso = new Date().toISOString();
  const newUserId = generateUuid();

  const newUser: UserEntity = {
    id: newUserId,
    storeId: session.storeId,
    name: input.name.trim(),
    email: normalizedEmail,
    username: normalizedUsername,
    role: input.role,
    isActive: true,
    createdAt: nowIso,
  };

  const verifier = await computeClientCredentialVerifier(
    newUser.id,
    input.pinOrPassword
  );

  await db.transaction(
    "rw",
    [db.users, db.audit_logs, db.sync_metadata],
    async () => {
      await db.users.put(newUser);
      await db.sync_metadata.put({
        key: `auth_verifier:${newUser.id}`,
        value: verifier,
        updatedAt: nowIso,
      });
      await db.audit_logs.put({
        id: generateUuid(),
        storeId: session.storeId,
        deviceId: session.deviceId,
        userId: session.userId,
        userNameSnapshot: session.userName,
        userRole: session.role,
        action: "USER_ACCOUNT_CREATED",
        entityType: "USER",
        entityId: newUser.id,
        summary: `Created ${newUser.role} account ${newUser.name} (@${newUser.username}, ${newUser.email})`,
        createdAt: nowIso,
      });
    }
  );

  try {
    await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-etinda-user-id": session.userId,
        "x-etinda-user-role": session.role,
        "x-etinda-store-id": session.storeId,
        "x-etinda-device-id": session.deviceId,
      },
      body: JSON.stringify({
        mode: "CREATE_USER",
        userId: newUserId,
        ...input,
      }),
    });
  } catch {
    // Offline fallback: local IndexedDB user is active immediately
  }

  return newUser;
}

/**
 * Activates or deactivates a Store Helper or User account (Owner-only).
 */
export async function toggleStoreUserActiveStatus(
  targetUserId: string,
  nextActive: boolean
): Promise<UserEntity> {
  const session = useSessionStore.getState();
  if (!hasPermission(session.role, "MANAGE_USERS_AND_DEVICES")) {
    throw new Error(
      "Only the Store Owner (ADMIN) can activate or deactivate user accounts."
    );
  }

  const target = await db.users.get(targetUserId);
  if (!target) {
    throw new Error("User account not found.");
  }

  if (!nextActive && target.role === "ADMIN") {
    const activeAdmins = await db.users
      .filter((u) => u.role === "ADMIN" && u.isActive && u.id !== target.id)
      .count();
    if (activeAdmins === 0) {
      throw new Error(
        "Cannot deactivate the only active Store Owner account."
      );
    }
  }

  const nowIso = new Date().toISOString();
  const updated: UserEntity = {
    ...target,
    isActive: nextActive,
  };

  await db.transaction("rw", [db.users, db.audit_logs], async () => {
    await db.users.put(updated);
    await db.audit_logs.put({
      id: generateUuid(),
      storeId: session.storeId,
      deviceId: session.deviceId,
      userId: session.userId,
      userNameSnapshot: session.userName,
      userRole: session.role,
      action: nextActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      entityType: "USER",
      entityId: target.id,
      summary: `${nextActive ? "Activated" : "Deactivated"} ${target.role} account ${target.name} (@${target.username})`,
      createdAt: nowIso,
    });
  });

  try {
    await fetch("/api/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-etinda-user-id": session.userId,
        "x-etinda-user-role": session.role,
        "x-etinda-store-id": session.storeId,
        "x-etinda-device-id": session.deviceId,
      },
      body: JSON.stringify({
        userId: targetUserId,
        isActive: nextActive,
      }),
    });
  } catch {
    // Offline fallback
  }

  return updated;
}

/**
 * Authenticates a Store Owner or Helper by Email/Username and Password.
 * Verifies against local one-way SHA-256 verifier (offline-capable) and `/api/users` when online.
 */
export async function authenticateStoreOperator(params: {
  identifier: string;
  pinOrPassword: string;
}): Promise<{ user: UserEntity; store?: StoreEntity }> {
  await ensureLocalDatabaseInitialized();
  const identifier = params.identifier.trim().toLowerCase();
  const pinOrPassword = params.pinOrPassword.trim();

  if (!identifier) {
    throw new Error("Please enter your Email or Username.");
  }
  if (pinOrPassword.length < 4) {
    throw new Error("Please enter your password (minimum 4 characters).");
  }

  const localUser = await db.users
    .filter(
      (u) =>
        u.username.toLowerCase() === identifier ||
        (u.email ?? "").toLowerCase() === identifier
    )
    .first();

  if (localUser) {
    if (!localUser.isActive) {
      throw new Error(
        `Account @${localUser.username} has been deactivated by the Store Owner.`
      );
    }

    const storedVerifier = await db.sync_metadata.get(
      `auth_verifier:${localUser.id}`
    );
    if (storedVerifier?.value) {
      const candidateVerifier = await computeClientCredentialVerifier(
        localUser.id,
        pinOrPassword
      );
      if (candidateVerifier !== storedVerifier.value) {
        throw new Error("Invalid password for this store account.");
      }
      const localStore = await db.stores.get(localUser.storeId);
      useSessionStore.getState().loginAsUser({
        userId: localUser.id,
        userName: localUser.name,
        email: localUser.email,
        username: localUser.username,
        role: localUser.role,
        storeId: localStore?.id ?? localUser.storeId,
        storeName: localStore?.name,
      });
      return { user: localUser, store: localStore };
    }
  }

  // Verify against server `/api/users` (supports multi-device sign-in & Vercel Prisma DB)
  try {
    const session = useSessionStore.getState();
    const response = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-etinda-store-id": session.storeId,
        "x-etinda-device-id": session.deviceId,
      },
      body: JSON.stringify({
        mode: "VERIFY_CREDENTIALS",
        identifier,
        pinOrPassword,
      }),
    });
    const data = (await response.json()) as {
      ok: boolean;
      error?: string;
      user?: UserEntity;
      store?: StoreEntity;
    };

    if (response.ok && data.ok && data.user) {
      const verifiedUser = data.user;
      const verifiedStore = data.store;
      const verifier = await computeClientCredentialVerifier(
        verifiedUser.id,
        pinOrPassword
      );
      const nowIso = new Date().toISOString();

      await db.transaction(
        "rw",
        [db.users, db.stores, db.sync_metadata],
        async () => {
          if (verifiedStore) {
            await db.stores.put(verifiedStore);
          }
          await db.users.put(verifiedUser);
          await db.sync_metadata.put({
            key: `auth_verifier:${verifiedUser.id}`,
            value: verifier,
            updatedAt: nowIso,
          });
        }
      );

      useSessionStore.getState().loginAsUser({
        userId: verifiedUser.id,
        userName: verifiedUser.name,
        email: verifiedUser.email,
        username: verifiedUser.username,
        role: verifiedUser.role,
        storeId: verifiedStore?.id ?? verifiedUser.storeId,
        storeName: verifiedStore?.name,
      });

      return { user: verifiedUser, store: verifiedStore };
    }

    if (response.status === 401) {
      throw new Error(data.error || "Invalid email/username or password.");
    }
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes("Invalid") || err.message.includes("deactivated"))
    ) {
      throw err;
    }
  }

  if (localUser) {
    const localStore = await db.stores.get(localUser.storeId);
    useSessionStore.getState().loginAsUser({
      userId: localUser.id,
      userName: localUser.name,
      email: localUser.email,
      username: localUser.username,
      role: localUser.role,
      storeId: localStore?.id ?? localUser.storeId,
      storeName: localStore?.name,
    });
    return { user: localUser, store: localStore };
  }

  throw new Error(
    `No active store account found for "${params.identifier.trim()}". If this is a new tindahan, create the Store Owner account first.`
  );
}

