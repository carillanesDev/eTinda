"use client";

import { db } from "@/lib/db/dexie";
import { ensureLocalDatabaseInitialized } from "@/lib/db/seed-local";
import { generateUuid } from "@/lib/utils/uuid";
import { useSessionStore } from "@/stores/useSessionStore";
import type {
  CategoryEntity,
  DeviceEntity,
  ProductEntity,
  StoreEntity,
  UserEntity,
} from "@/types/domain";

export interface PairingCodeInfo {
  code: string;
  formattedCode: string;
  token: string;
  expiresAt: string;
  deviceName: string;
  deviceType: "MOBILE" | "TABLET" | "DESKTOP";
}

export interface PairingStatusInfo {
  isClaimed: boolean;
  claimedAt?: string;
  claimedDeviceId?: string;
  deviceName?: string;
  deviceType?: "MOBILE" | "TABLET" | "DESKTOP";
}

/**
 * Initiates an "Add Device" pairing request on the Main Terminal (Store Owner only).
 * Generates a 6-digit code and pairing token valid for 15 minutes.
 */
export async function requestDevicePairingCode(params: {
  deviceName: string;
  deviceType?: "MOBILE" | "TABLET" | "DESKTOP";
}): Promise<PairingCodeInfo> {
  const session = useSessionStore.getState();

  // Export current local store state snapshot so the paired device gets exact store, users & auth verifiers
  const localStore =
    (await db.stores.get(session.storeId)) ??
    (await db.stores.toCollection().first());
  const localUsers = await db.users.filter((u) => u.isActive).toArray();
  const localCategories = await db.categories.toArray();
  const localProducts = await db.products.toArray();
  const allMeta = await db.sync_metadata.toArray();
  const authVerifiers: Record<string, string> = {};
  for (const m of allMeta) {
    if (m.key.startsWith("auth_verifier:")) {
      authVerifiers[m.key] = m.value;
    }
  }

  const response = await fetch("/api/devices", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-etinda-user-id": session.userId,
      "x-etinda-user-role": session.role,
      "x-etinda-store-id": session.storeId,
      "x-etinda-device-id": session.deviceId,
    },
    body: JSON.stringify({
      deviceName: params.deviceName.trim(),
      deviceType: params.deviceType ?? "MOBILE",
      snapshot: {
        store: localStore,
        users: localUsers,
        categories: localCategories,
        products: localProducts,
        authVerifiers,
      },
    }),
  });

  const data = (await response.json()) as {
    ok: boolean;
    error?: string;
    code: string;
    formattedCode: string;
    token: string;
    expiresAt: string;
    deviceName: string;
    deviceType: "MOBILE" | "TABLET" | "DESKTOP";
  };

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Failed to generate device pairing code.");
  }

  // Pre-insert pending device in local Dexie so it reflects immediately in local state
  const pendingDevice: DeviceEntity = {
    id: data.token,
    storeId: session.storeId,
    deviceName: `${data.deviceName} (Pairing...)`,
    deviceType: data.deviceType,
    registeredByUserId: session.userId,
    isAuthorized: true,
    downloadCursor: 0,
    createdAt: new Date().toISOString(),
  };

  await db.devices.put(pendingDevice).catch(() => {});

  return {
    code: data.code,
    formattedCode: data.formattedCode,
    token: data.token,
    expiresAt: data.expiresAt,
    deviceName: data.deviceName,
    deviceType: data.deviceType,
  };
}

/**
 * Polls the pairing code status to check if the secondary device has completed pairing.
 */
export async function checkDevicePairingStatus(
  code: string
): Promise<PairingStatusInfo> {
  const clean = code.replace(/[^a-zA-Z0-9-]/g, "").trim();
  const response = await fetch(
    `/api/devices?checkCode=${encodeURIComponent(clean)}`
  );
  const data = (await response.json()) as {
    ok: boolean;
    error?: string;
    isClaimed?: boolean;
    claimedAt?: string;
    claimedDeviceId?: string;
    deviceName?: string;
    deviceType?: "MOBILE" | "TABLET" | "DESKTOP";
  };

  if (!response.ok || !data.ok) {
    return { isClaimed: false };
  }

  return {
    isClaimed: Boolean(data.isClaimed),
    claimedAt: data.claimedAt,
    claimedDeviceId: data.claimedDeviceId,
    deviceName: data.deviceName,
    deviceType: data.deviceType,
  };
}

/**
 * Executed on the New / Secondary Device:
 * Exchanges the 6-digit code or URL token for the store identity, authorized device ID,
 * and initial catalog snapshot. Commits everything to local IndexedDB.
 */
export async function claimDevicePairingCode(
  codeOrToken: string
): Promise<{
  device: DeviceEntity;
  store: StoreEntity;
  users: UserEntity[];
}> {
  await ensureLocalDatabaseInitialized();

  const clean = codeOrToken.replace(/[^a-zA-Z0-9-]/g, "").trim();
  if (clean.length < 5) {
    throw new Error("Please enter a valid 6-digit pairing code.");
  }

  const newDeviceId = generateUuid();

  const response = await fetch("/api/devices/pair", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      codeOrToken: clean,
      deviceId: newDeviceId,
    }),
  });

  const data = (await response.json()) as {
    ok: boolean;
    error?: string;
    device?: DeviceEntity;
    store?: StoreEntity;
    users?: UserEntity[];
    categories?: CategoryEntity[];
    products?: ProductEntity[];
    authVerifiers?: Record<string, string>;
  };

  if (!response.ok || !data.ok || !data.device || !data.store) {
    throw new Error(
      data.error ||
        "Unable to connect to store. Please check the 6-digit code and ensure it hasn't expired."
    );
  }

  const {
    device,
    store,
    users = [],
    categories = [],
    products = [],
    authVerifiers = {},
  } = data;
  const nowIso = new Date().toISOString();

  // Atomically commit store, device, users, categories, products, and auth verifiers into local IndexedDB
  await db.transaction(
    "rw",
    [
      db.stores,
      db.devices,
      db.users,
      db.categories,
      db.products,
      db.sync_metadata,
      db.audit_logs,
    ],
    async () => {
      await db.stores.put(store);
      await db.devices.put(device);

      if (users.length > 0) {
        await db.users.bulkPut(users);
      }
      if (categories.length > 0) {
        await db.categories.bulkPut(categories);
      }
      if (products.length > 0) {
        await db.products.bulkPut(products);
      }

      // Persist client credential verifiers so user can log in immediately offline
      for (const [key, value] of Object.entries(authVerifiers)) {
        await db.sync_metadata.put({
          key,
          value,
          updatedAt: nowIso,
        });
      }

      await db.sync_metadata.put({
        key: "cleanProductionSetupV3",
        value: "true",
        updatedAt: nowIso,
      });

      await db.sync_metadata.put({
        key: "device_paired_at",
        value: nowIso,
        updatedAt: nowIso,
      });

      await db.audit_logs.put({
        id: generateUuid(),
        storeId: store.id,
        deviceId: device.id,
        userId: device.registeredByUserId,
        userNameSnapshot: "Store Terminal",
        userRole: "HELPER",
        action: "DEVICE_AUTHORIZED",
        entityType: "DEVICE",
        entityId: device.id,
        summary: `Device "${device.deviceName}" paired to store "${store.name}" successfully`,
        createdAt: nowIso,
      });
    }
  );

  // Update client session store
  useSessionStore.setState({
    storeId: store.id,
    storeName: store.name,
    deviceId: device.id,
    deviceName: device.deviceName,
    isDeviceAuthorized: true,
    isAuthenticated: false, // Forces user to sign in with their PIN or Password
  });

  return { device, store, users };
}
