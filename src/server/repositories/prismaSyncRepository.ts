import { hashPasswordOrPin } from "@/lib/auth/password";
import { isPrismaDatabaseConfigured, prisma } from "@/lib/db/prisma";
import {
  serverStoreLedger,
  type ServerSyncEventInput,
} from "./storeLedgerEngine";

/**
 * Coordinates server persistence across Prisma PostgreSQL (Vercel Prisma Postgres Free Tier
 * or when `ETINDA_USE_PRISMA_DB=true`) and the authoritative in-process `serverStoreLedger`
 * transactional engine.
 */
export async function executeServerSyncBatch(params: {
  storeId: string;
  deviceId: string;
  storeName?: string;
  deviceName?: string;
  actorUser?: {
    id: string;
    name?: string;
    email?: string;
    username?: string;
    role: "ADMIN" | "HELPER";
  };
  isDeviceAuthorized?: boolean;
  simulateFailure?: boolean;
  events: ServerSyncEventInput[];
}) {
  // Always apply inside the deterministic snapshot-transactional ledger engine
  const result = serverStoreLedger.processSyncBatch(params);

  // Mirror the batch in a Prisma PostgreSQL transaction when configured
  if (isPrismaDatabaseConfigured()) {
    try {
      const state = serverStoreLedger.getState();

      await prisma.$transaction(async (tx) => {
        // 1. Ensure parent Store record exists in PostgreSQL (prevents FK violation)
        const storeIds = new Set<string>([
          params.storeId,
          ...params.events.map((e) => e.storeId),
        ]);
        for (const sId of storeIds) {
          const memStore = state.stores.get(sId);
          await tx.store.upsert({
            where: { id: sId },
            update: {
              ...(memStore?.name ? { name: memStore.name } : {}),
            },
            create: {
              id: sId,
              name: memStore?.name || params.storeName || "My Sari-Sari Store",
              address: memStore?.address || "",
              contactNumber: memStore?.contactNumber || "",
              createdAt: memStore?.createdAt
                ? new Date(memStore.createdAt)
                : new Date(),
            },
          });
        }

        // 2. Ensure parent User records exist in PostgreSQL (prevents sync_events_user_id_fkey & devices_registered_by_user_id_fkey violation)
        const userIds = new Set<string>(params.events.map((e) => e.userId));
        if (params.actorUser?.id) {
          userIds.add(params.actorUser.id);
        }
        if (userIds.size === 0) {
          const firstMemUser = Array.from(state.users.keys())[0];
          userIds.add(firstMemUser ?? "20000000-0000-4000-8000-000000000001");
        }
        const primaryRegisteredUserId = Array.from(userIds)[0];

        for (const uId of userIds) {
          const existingById = await tx.user.findUnique({ where: { id: uId } });
          if (!existingById) {
            const memUser = state.users.get(uId);
            const fallbackSlug = uId.replace(/-/g, "").slice(0, 10);
            const candidateUsername =
              memUser?.username ||
              (params.actorUser?.id === uId
                ? params.actorUser.username
                : undefined) ||
              `operator_${fallbackSlug}`;
            const candidateEmail =
              memUser?.email ||
              (params.actorUser?.id === uId
                ? params.actorUser.email
                : undefined) ||
              `${candidateUsername}.${fallbackSlug}@etinda.ph`;

            const conflictEmailOrUsername = await tx.user.findFirst({
              where: {
                OR: [
                  { email: candidateEmail },
                  {
                    storeId: memUser?.storeId || params.storeId,
                    username: candidateUsername,
                  },
                ],
              },
            });

            const safeUsername = conflictEmailOrUsername
              ? `${candidateUsername}_${fallbackSlug.slice(0, 6)}`
              : candidateUsername;
            const safeEmail = conflictEmailOrUsername
              ? `${ fallbackSlug }@etinda.ph`
              : candidateEmail;

            await tx.user.create({
              data: {
                id: uId,
                storeId: memUser?.storeId || params.storeId,
                name:
                  memUser?.name ||
                  params.actorUser?.name ||
                  "Store Operator",
                email: safeEmail,
                username: safeUsername,
                passwordHash:
                  state.userPasswordHashes.get(uId) ||
                  hashPasswordOrPin("etinda-synced-operator"),
                role: memUser?.role || params.actorUser?.role || "ADMIN",
                isActive: memUser?.isActive ?? true,
                createdAt: memUser?.createdAt
                  ? new Date(memUser.createdAt)
                  : new Date(),
              },
            });
          }
        }

        // 3. Ensure parent Device records exist in PostgreSQL (prevents sync_events_device_id_fkey & sync_checkpoints_device_id_fkey violation)
        const deviceIds = new Set<string>([
          params.deviceId,
          ...params.events.map((e) => e.deviceId),
        ]);
        for (const dId of deviceIds) {
          const memDevice = state.devices.get(dId);
          await tx.device.upsert({
            where: { id: dId },
            update: {
              lastSyncAt: new Date(result.serverTimestamp),
              isAuthorized: memDevice?.isAuthorized ?? true,
            },
            create: {
              id: dId,
              storeId: memDevice?.storeId || params.storeId,
              deviceName:
                memDevice?.deviceName ||
                params.deviceName ||
                "Primary Store Terminal",
              deviceType: memDevice?.deviceType || "TABLET",
              registeredByUserId:
                memDevice?.registeredByUserId &&
                userIds.has(memDevice.registeredByUserId)
                  ? memDevice.registeredByUserId
                  : primaryRegisteredUserId,
              isAuthorized: memDevice?.isAuthorized ?? true,
              lastSyncAt: new Date(result.serverTimestamp),
              createdAt: memDevice?.createdAt
                ? new Date(memDevice.createdAt)
                : new Date(),
            },
          });
        }

        // 4. Mirror domain entities modified in this batch
        for (const ack of result.acknowledgments) {
          if (ack.duplicate) continue;
          const sourceEvt = params.events.find(
            (e) => e.eventId === ack.eventId
          );
          if (!sourceEvt) continue;

          if (sourceEvt.eventType === "CATEGORY_UPSERTED") {
            const cat = state.categories.get(sourceEvt.entityId);
            if (cat) {
              await tx.category.upsert({
                where: { id: cat.id },
                update: {
                  name: cat.name,
                  sortOrder: cat.sortOrder,
                  isActive: cat.isActive,
                  updatedAt: new Date(cat.updatedAt),
                },
                create: {
                  id: cat.id,
                  storeId: cat.storeId,
                  name: cat.name,
                  sortOrder: cat.sortOrder,
                  isActive: cat.isActive,
                  updatedAt: new Date(cat.updatedAt),
                },
              });
            }
          } else if (sourceEvt.eventType === "PRODUCT_UPSERTED") {
            const prod = state.products.get(sourceEvt.entityId);
            if (prod) {
              const cat = state.categories.get(prod.categoryId);
              await tx.category.upsert({
                where: { id: prod.categoryId },
                update: {},
                create: {
                  id: prod.categoryId,
                  storeId: prod.storeId,
                  name: cat?.name || "General Merchandise",
                  sortOrder: cat?.sortOrder ?? 1,
                  isActive: true,
                },
              });

              await tx.product.upsert({
                where: { id: prod.id },
                update: {
                  categoryId: prod.categoryId,
                  name: prod.name,
                  baseUnit: prod.baseUnit,
                  sellingPriceCentavos: prod.sellingPriceCentavos,
                  latestCostCentavos: prod.latestCostCentavos,
                  lowStockThreshold: prod.lowStockThreshold,
                  allowDecimalQuantity: prod.allowDecimalQuantity,
                  isFrequent: prod.isFrequent,
                  isActive: prod.isActive,
                  cachedStock: prod.cachedStock,
                  hasOversellConflict: Boolean(prod.hasOversellConflict),
                  updatedAt: new Date(prod.updatedAt),
                },
                create: {
                  id: prod.id,
                  storeId: prod.storeId,
                  categoryId: prod.categoryId,
                  name: prod.name,
                  baseUnit: prod.baseUnit,
                  sellingPriceCentavos: prod.sellingPriceCentavos,
                  latestCostCentavos: prod.latestCostCentavos,
                  lowStockThreshold: prod.lowStockThreshold,
                  allowDecimalQuantity: prod.allowDecimalQuantity,
                  isFrequent: prod.isFrequent,
                  isActive: prod.isActive,
                  cachedStock: prod.cachedStock,
                  hasOversellConflict: Boolean(prod.hasOversellConflict),
                  createdAt: new Date(prod.createdAt),
                  updatedAt: new Date(prod.updatedAt),
                },
              });
            }
          } else if (sourceEvt.eventType === "CUSTOMER_UPSERTED") {
            const cust = state.customers.get(sourceEvt.entityId);
            if (cust) {
              await tx.customer.upsert({
                where: { id: cust.id },
                update: {
                  name: cust.name,
                  contactNumber: cust.contactNumber ?? null,
                  updatedAt: new Date(cust.updatedAt),
                },
                create: {
                  id: cust.id,
                  storeId: cust.storeId,
                  name: cust.name,
                  contactNumber: cust.contactNumber ?? null,
                  createdAt: new Date(cust.createdAt),
                  updatedAt: new Date(cust.updatedAt),
                },
              });
            }
          }

          // 5. Record idempotent SyncEventRecord in PostgreSQL
          await tx.syncEventRecord.upsert({
            where: { eventId: sourceEvt.eventId },
            update: {
              status: ack.status === "CONFLICT" ? "CONFLICT" : "ACKNOWLEDGED",
              conflictReason: ack.conflictReason ?? null,
              acknowledgedAt: new Date(ack.acknowledgedAt),
            },
            create: {
              eventId: sourceEvt.eventId,
              storeId: sourceEvt.storeId,
              deviceId: sourceEvt.deviceId,
              userId: sourceEvt.userId,
              eventType: sourceEvt.eventType,
              entityId: sourceEvt.entityId,
              schemaVersion: sourceEvt.schemaVersion,
              payload: sourceEvt.payload as object,
              status: ack.status === "CONFLICT" ? "CONFLICT" : "ACKNOWLEDGED",
              conflictReason: ack.conflictReason ?? null,
              clientCreatedAt: new Date(sourceEvt.createdAt),
              acknowledgedAt: new Date(ack.acknowledgedAt),
            },
          });
        }

        // 6. Update per-device SyncCheckpoint cursor
        await tx.syncCheckpoint.upsert({
          where: {
            storeId_deviceId: {
              storeId: params.storeId,
              deviceId: params.deviceId,
            },
          },
          update: {
            lastSequenceNumber: BigInt(result.lastSequenceNumber),
          },
          create: {
            storeId: params.storeId,
            deviceId: params.deviceId,
            lastSequenceNumber: BigInt(result.lastSequenceNumber),
          },
        });
      });
    } catch (prismaError) {
      console.error(
        "[eTinda Sync] Prisma PostgreSQL persistence warning (in-memory ledger succeeded):",
        prismaError
      );
    }
  }

  return result;
}
