import { buildInitialSeedDataset } from "../../lib/db/seed-local.ts";
import {
  hashPasswordOrPin,
  verifyPasswordOrPin,
} from "../../lib/auth/password.ts";
import { hasPermission } from "../../lib/permissions/index.ts";
import { sumCentavos } from "../../lib/utils/money.ts";
import { roundSignedStockQuantity } from "../../lib/utils/quantity.ts";
import { generateUuid } from "../../lib/utils/uuid.ts";
import type {
  AuditLogEntity,
  CategoryEntity,
  CustomerEntity,
  DeviceEntity,
  InventoryMovementEntity,
  PaymentEntity,
  ProductEntity,
  ProductVariantEntity,
  PurchaseItemEntity,
  PurchaseRecordEntity,
  SaleEntity,
  SaleItemEntity,
  StoreEntity,
  SyncEventType,
  UserEntity,
  UtangAccountEntity,
  UtangLedgerEntryEntity,
} from "../../types/domain.ts";

export interface ServerSyncEventInput {
  eventId: string;
  storeId: string;
  deviceId: string;
  userId: string;
  eventType: SyncEventType;
  entityId: string;
  schemaVersion: number;
  createdAt: string;
  payload: unknown;
}

export interface ServerEventAcknowledgment {
  eventId: string;
  entityId: string;
  eventType: SyncEventType;
  sequenceNumber: number;
  status: "ACKNOWLEDGED" | "CONFLICT" | "REJECTED";
  duplicate: boolean;
  acknowledgedAt: string;
  conflictReason?: string;
  serverProductSnapshots?: Array<{
    productId: string;
    cachedStock: number;
    hasOversellConflict: boolean;
    latestCostCentavos: number;
  }>;
  serverUtangSnapshot?: {
    utangAccountId: string;
    customerId: string;
    cachedBalanceCentavos: number;
    needsReconciliation: boolean;
    runningBalanceSnapshotCentavos: number;
  };
}

export interface ServerSyncCheckpoint {
  id: string;
  storeId: string;
  deviceId: string;
  lastSequenceNumber: number;
  lastSyncedAt: string;
}

export interface ProcessedServerEventRecord extends ServerSyncEventInput {
  sequenceNumber: number;
  status: "ACKNOWLEDGED" | "CONFLICT" | "REJECTED";
  conflictReason?: string;
  acknowledgedAt: string;
  acknowledgment: ServerEventAcknowledgment;
}

export interface ServerStateSnapshot {
  sequenceCounter: number;
  stores: Map<string, StoreEntity>;
  users: Map<string, UserEntity>;
  userPasswordHashes: Map<string, string>;
  devices: Map<string, DeviceEntity>;
  categories: Map<string, CategoryEntity>;
  products: Map<string, ProductEntity>;
  productVariants: Map<string, ProductVariantEntity>;
  customers: Map<string, CustomerEntity>;
  utangAccounts: Map<string, UtangAccountEntity>;
  utangLedger: Map<string, UtangLedgerEntryEntity>;
  sales: Map<string, SaleEntity>;
  saleItems: Map<string, SaleItemEntity>;
  payments: Map<string, PaymentEntity>;
  inventoryMovements: Map<string, InventoryMovementEntity>;
  purchaseRecords: Map<string, PurchaseRecordEntity>;
  purchaseItems: Map<string, PurchaseItemEntity>;
  auditLogs: Map<string, AuditLogEntity>;
  processedEvents: Map<string, ProcessedServerEventRecord>;
  syncCheckpoints: Map<string, ServerSyncCheckpoint>;
}

export function createCleanProductionServerState(): ServerStateSnapshot {
  const dataset = buildInitialSeedDataset();
  const cleanStore: StoreEntity = {
    id: dataset.store.id,
    name: "My Sari-Sari Store",
    address: "",
    contactNumber: "",
    createdAt: new Date().toISOString(),
  };
  const primaryDevice: DeviceEntity = {
    id: dataset.devices[0].id,
    storeId: dataset.store.id,
    deviceName: "Primary Store Terminal",
    deviceType: "TABLET",
    registeredByUserId: dataset.devices[0].registeredByUserId,
    isAuthorized: true,
    downloadCursor: 0,
    createdAt: new Date().toISOString(),
  };

  return {
    sequenceCounter: 0,
    stores: new Map([[cleanStore.id, cleanStore]]),
    users: new Map(),
    userPasswordHashes: new Map(),
    devices: new Map([[primaryDevice.id, primaryDevice]]),
    categories: new Map(
      dataset.categories.map((item) => [item.id, structuredClone(item)])
    ),
    products: new Map(),
    productVariants: new Map(),
    customers: new Map(),
    utangAccounts: new Map(),
    utangLedger: new Map(),
    sales: new Map(),
    saleItems: new Map(),
    payments: new Map(),
    inventoryMovements: new Map(),
    purchaseRecords: new Map(),
    purchaseItems: new Map(),
    auditLogs: new Map(),
    processedEvents: new Map(),
    syncCheckpoints: new Map(),
  };
}

function createInitialServerState(): ServerStateSnapshot {
  const dataset = buildInitialSeedDataset();
  const userPasswordHashes = new Map<string, string>();
  for (const u of dataset.users) {
    const defaultPin = u.role === "ADMIN" ? "1234" : "0000";
    userPasswordHashes.set(u.id, hashPasswordOrPin(defaultPin, "etinda-seed-salt"));
  }

  return {
    sequenceCounter: 0,
    stores: new Map([[dataset.store.id, structuredClone(dataset.store)]]),
    users: new Map(dataset.users.map((item) => [item.id, structuredClone(item)])),
    userPasswordHashes,
    devices: new Map(
      dataset.devices.map((item) => [item.id, structuredClone(item)])
    ),
    categories: new Map(
      dataset.categories.map((item) => [item.id, structuredClone(item)])
    ),
    products: new Map(
      dataset.products.map((item) => [item.id, structuredClone(item)])
    ),
    productVariants: new Map(
      dataset.variants.map((item) => [item.id, structuredClone(item)])
    ),
    customers: new Map(
      dataset.customers.map((item) => [item.id, structuredClone(item)])
    ),
    utangAccounts: new Map(
      dataset.utangAccounts.map((item) => [item.id, structuredClone(item)])
    ),
    utangLedger: new Map(
      dataset.utangLedger.map((item) => [item.id, structuredClone(item)])
    ),
    sales: new Map(
      dataset.sampleSales.map((item) => [item.id, structuredClone(item)])
    ),
    saleItems: new Map(
      dataset.sampleSaleItems.map((item) => [item.id, structuredClone(item)])
    ),
    payments: new Map(
      dataset.samplePayments.map((item) => [item.id, structuredClone(item)])
    ),
    inventoryMovements: new Map(
      dataset.movements.map((item) => [item.id, structuredClone(item)])
    ),
    purchaseRecords: new Map(
      dataset.purchaseRecords.map((item) => [item.id, structuredClone(item)])
    ),
    purchaseItems: new Map(
      dataset.purchaseItems.map((item) => [item.id, structuredClone(item)])
    ),
    auditLogs: new Map(
      dataset.auditLogs.map((item) => [item.id, structuredClone(item)])
    ),
    processedEvents: new Map(),
    syncCheckpoints: new Map(),
  };
}

/**
 * Authoritative Server Ledger & Transactional Store Engine.
 * Enforces ACID snapshot rollback, idempotency by `eventId`, device authorization,
 * role-based access control, append-only inventory movements, oversell conflict detection,
 * and server-recomputed Utang running balances.
 */
export class StoreLedgerEngine {
  private state: ServerStateSnapshot;

  constructor(initialState?: ServerStateSnapshot) {
    this.state = initialState ?? createInitialServerState();
  }

  public resetToSeedState(): void {
    this.state = createInitialServerState();
  }

  public getState(): ServerStateSnapshot {
    return this.state;
  }

  private cloneStateSnapshot(): ServerStateSnapshot {
    return structuredClone(this.state);
  }

  /**
   * Executes a work callback inside an atomic snapshot transaction.
   * If any error is thrown inside `work`, the entire server state is rolled back
   * to the pre-transaction snapshot.
   */
  public runInTransaction<TResult>(
    work: (txState: ServerStateSnapshot) => TResult
  ): TResult {
    const backupSnapshot = this.cloneStateSnapshot();
    try {
      const result = work(this.state);
      return result;
    } catch (error) {
      this.state = backupSnapshot;
      throw error;
    }
  }

  public isDeviceAuthorized(deviceId: string, clientFlag = true): boolean {
    if (!clientFlag) {
      return false;
    }
    const existingDevice = this.state.devices.get(deviceId);
    if (!existingDevice) {
      return true;
    }
    return existingDevice.isAuthorized && !existingDevice.revokedAt;
  }

  public setDeviceAuthorization(
    actorUserId: string,
    deviceId: string,
    isAuthorized: boolean
  ): DeviceEntity {
    return this.runInTransaction((tx) => {
      const actor = tx.users.get(actorUserId);
      if (!actor || !hasPermission(actor.role, "MANAGE_USERS_AND_DEVICES")) {
        throw new Error(
          "FORBIDDEN: Only Store Owner can authorize or revoke devices."
        );
      }

      const device = tx.devices.get(deviceId);
      if (!device) {
        throw new Error(`Device ${deviceId} not found.`);
      }

      const nowIso = new Date().toISOString();
      const updated: DeviceEntity = {
        ...device,
        isAuthorized,
        revokedAt: isAuthorized ? undefined : nowIso,
        lastSyncAt: nowIso,
      };
      tx.devices.set(deviceId, updated);

      const auditId = generateUuid();
      tx.auditLogs.set(auditId, {
        id: auditId,
        storeId: device.storeId,
        deviceId,
        userId: actor.id,
        userNameSnapshot: actor.name,
        userRole: actor.role,
        action: isAuthorized ? "DEVICE_AUTHORIZED" : "DEVICE_REVOKED",
        entityType: "DEVICE",
        entityId: deviceId,
        summary: `${isAuthorized ? "Authorized" : "Revoked"} device ${device.deviceName}`,
        createdAt: nowIso,
      });

      return updated;
    });
  }

  public registerOwnerAndStore(params: {
    storeId?: string;
    storeName: string;
    storeAddress: string;
    contactNumber: string;
    ownerId?: string;
    ownerName: string;
    email?: string;
    username: string;
    pinOrPassword: string;
    deviceId: string;
  }): { store: StoreEntity; owner: UserEntity } {
    return this.runInTransaction((tx) => {
      const normalizedUsername = params.username.trim().toLowerCase();
      const normalizedEmail = (
        params.email?.trim() || `${normalizedUsername}@etinda.ph`
      ).toLowerCase();

      const duplicateUsername = Array.from(tx.users.values()).find(
        (u) => u.username.toLowerCase() === normalizedUsername
      );
      if (duplicateUsername) {
        const err = new Error(
          `Username '${normalizedUsername}' is already taken.`
        ) as Error & { statusCode?: number; code?: string };
        err.statusCode = 409;
        err.code = "USERNAME_TAKEN";
        throw err;
      }

      const duplicateEmail = Array.from(tx.users.values()).find(
        (u) => u.email.toLowerCase() === normalizedEmail
      );
      if (duplicateEmail) {
        const err = new Error(
          `Email '${normalizedEmail}' is already registered.`
        ) as Error & { statusCode?: number; code?: string };
        err.statusCode = 409;
        err.code = "EMAIL_TAKEN";
        throw err;
      }

      const nowIso = new Date().toISOString();
      const targetStoreId =
        params.storeId ??
        Array.from(tx.stores.keys())[0] ??
        generateUuid();

      const store: StoreEntity = {
        id: targetStoreId,
        name: params.storeName.trim(),
        address: params.storeAddress.trim(),
        contactNumber: params.contactNumber.trim(),
        createdAt: tx.stores.get(targetStoreId)?.createdAt ?? nowIso,
      };
      tx.stores.set(store.id, store);

      const ownerId = params.ownerId ?? generateUuid();
      const owner: UserEntity = {
        id: ownerId,
        storeId: store.id,
        name: params.ownerName.trim(),
        email: normalizedEmail,
        username: normalizedUsername,
        role: "ADMIN",
        isActive: true,
        createdAt: nowIso,
      };
      tx.users.set(owner.id, owner);
      tx.userPasswordHashes.set(
        owner.id,
        hashPasswordOrPin(params.pinOrPassword.trim())
      );

      const auditId = generateUuid();
      tx.auditLogs.set(auditId, {
        id: auditId,
        storeId: store.id,
        deviceId: params.deviceId,
        userId: owner.id,
        userNameSnapshot: owner.name,
        userRole: "ADMIN",
        action: "OWNER_ACCOUNT_REGISTERED",
        entityType: "USER",
        entityId: owner.id,
        summary: `Registered Store Owner account ${owner.name} (@${owner.username}, ${owner.email}) for ${store.name}`,
        createdAt: nowIso,
      });

      return { store, owner };
    });
  }

  public createStoreUser(params: {
    actorUserId: string;
    storeId: string;
    deviceId: string;
    userId?: string;
    name: string;
    email?: string;
    username: string;
    role: "ADMIN" | "HELPER";
    pinOrPassword: string;
  }): UserEntity {
    return this.runInTransaction((tx) => {
      const actor = tx.users.get(params.actorUserId);
      if (!actor || !hasPermission(actor.role, "MANAGE_USERS_AND_DEVICES")) {
        const err = new Error(
          "Only the Store Owner (ADMIN) can create Helper or User accounts."
        ) as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN_ROLE_OPERATION";
        throw err;
      }

      const normalizedUsername = params.username.trim().toLowerCase();
      const normalizedEmail = (
        params.email?.trim() || `${normalizedUsername}@etinda.ph`
      ).toLowerCase();

      const duplicate = Array.from(tx.users.values()).find(
        (u) => u.username.toLowerCase() === normalizedUsername
      );
      if (duplicate) {
        const err = new Error(
          `Username '${normalizedUsername}' is already registered.`
        ) as Error & { statusCode?: number; code?: string };
        err.statusCode = 409;
        err.code = "USERNAME_TAKEN";
        throw err;
      }

      const duplicateEmail = Array.from(tx.users.values()).find(
        (u) => u.email.toLowerCase() === normalizedEmail
      );
      if (duplicateEmail) {
        const err = new Error(
          `Email '${normalizedEmail}' is already registered.`
        ) as Error & { statusCode?: number; code?: string };
        err.statusCode = 409;
        err.code = "EMAIL_TAKEN";
        throw err;
      }

      const nowIso = new Date().toISOString();
      const newUserId = params.userId ?? generateUuid();
      const newUser: UserEntity = {
        id: newUserId,
        storeId: params.storeId,
        name: params.name.trim(),
        email: normalizedEmail,
        username: normalizedUsername,
        role: params.role,
        isActive: true,
        createdAt: nowIso,
      };

      tx.users.set(newUser.id, newUser);
      tx.userPasswordHashes.set(
        newUser.id,
        hashPasswordOrPin(params.pinOrPassword.trim())
      );

      const auditId = generateUuid();
      tx.auditLogs.set(auditId, {
        id: auditId,
        storeId: params.storeId,
        deviceId: params.deviceId,
        userId: actor.id,
        userNameSnapshot: actor.name,
        userRole: actor.role,
        action: "USER_ACCOUNT_CREATED",
        entityType: "USER",
        entityId: newUser.id,
        summary: `Created ${params.role} account ${newUser.name} (@${newUser.username}, ${newUser.email})`,
        createdAt: nowIso,
      });

      return newUser;
    });
  }

  public setUserActiveStatus(params: {
    actorUserId: string;
    deviceId: string;
    targetUserId: string;
    isActive: boolean;
  }): UserEntity {
    return this.runInTransaction((tx) => {
      const actor = tx.users.get(params.actorUserId);
      if (!actor || !hasPermission(actor.role, "MANAGE_USERS_AND_DEVICES")) {
        const err = new Error(
          "Only the Store Owner (ADMIN) can activate or deactivate user accounts."
        ) as Error & { statusCode?: number; code?: string };
        err.statusCode = 403;
        err.code = "FORBIDDEN_ROLE_OPERATION";
        throw err;
      }

      const target = tx.users.get(params.targetUserId);
      if (!target) {
        const err = new Error("User account not found.") as Error & {
          statusCode?: number;
          code?: string;
        };
        err.statusCode = 404;
        err.code = "USER_NOT_FOUND";
        throw err;
      }

      if (!params.isActive && target.role === "ADMIN") {
        const activeAdmins = Array.from(tx.users.values()).filter(
          (u) => u.role === "ADMIN" && u.isActive && u.id !== target.id
        );
        if (activeAdmins.length === 0) {
          const err = new Error(
            "Cannot deactivate the only active Store Owner account."
          ) as Error & { statusCode?: number; code?: string };
          err.statusCode = 400;
          err.code = "CANNOT_DEACTIVATE_LAST_OWNER";
          throw err;
        }
      }

      const nowIso = new Date().toISOString();
      const updated: UserEntity = {
        ...target,
        isActive: params.isActive,
      };
      tx.users.set(target.id, updated);

      const auditId = generateUuid();
      tx.auditLogs.set(auditId, {
        id: auditId,
        storeId: target.storeId,
        deviceId: params.deviceId,
        userId: actor.id,
        userNameSnapshot: actor.name,
        userRole: actor.role,
        action: params.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
        entityType: "USER",
        entityId: target.id,
        summary: `${params.isActive ? "Activated" : "Deactivated"} ${target.role} account ${target.name} (@${target.username})`,
        createdAt: nowIso,
      });

      return updated;
    });
  }

  public verifyUserCredentials(
    usernameOrEmailOrUserId: string,
    pinOrPassword: string
  ): UserEntity | null {
    const query = usernameOrEmailOrUserId.trim().toLowerCase();
    const user =
      this.state.users.get(usernameOrEmailOrUserId) ??
      Array.from(this.state.users.values()).find(
        (u) =>
          u.username.toLowerCase() === query ||
          u.email.toLowerCase() === query
      );

    if (!user || !user.isActive) {
      return null;
    }

    const storedHash = this.state.userPasswordHashes.get(user.id);
    if (!storedHash) {
      return user;
    }

    return verifyPasswordOrPin(pinOrPassword.trim(), storedHash) ? user : null;
  }

  /**
   * Recomputes the authoritative Utang balance for an account from all valid ledger entries.
   */
  public recomputeUtangAccountBalance(
    tx: ServerStateSnapshot,
    utangAccountId: string
  ): number {
    const entries = Array.from(tx.utangLedger.values())
      .filter((entry) => entry.utangAccountId === utangAccountId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    return sumCentavos(entries.map((entry) => entry.signedAmountCentavos));
  }

  /**
   * Processes a batch of client sync events inside an atomic server transaction.
   */
  public processSyncBatch(params: {
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
  }): {
    serverTimestamp: string;
    lastSequenceNumber: number;
    acknowledgments: ServerEventAcknowledgment[];
  } {
    if (
      !this.isDeviceAuthorized(params.deviceId, params.isDeviceAuthorized ?? true)
    ) {
      const err = new Error(
        "This device has been revoked by the Store Owner. Synchronization rejected."
      ) as Error & { statusCode?: number; code?: string };
      err.statusCode = 403;
      err.code = "DEVICE_REVOKED";
      throw err;
    }

    return this.runInTransaction((tx) => {
      if (params.simulateFailure) {
        const err = new Error(
          "Simulated server transaction failure. All batch changes rolled back."
        ) as Error & { statusCode?: number; code?: string };
        err.statusCode = 503;
        err.code = "SERVER_TRANSACTION_ROLLED_BACK";
        throw err;
      }

      const nowIso = new Date().toISOString();

      // Ensure store exists on the server (important for serverless cold starts)
      if (!tx.stores.has(params.storeId)) {
        tx.stores.set(params.storeId, {
          id: params.storeId,
          name: params.storeName || "My Sari-Sari Store",
          address: "",
          contactNumber: "",
          createdAt: nowIso,
        });
      }

      // Ensure device exists or update lastSyncAt
      const existingDevice = tx.devices.get(params.deviceId);
      if (existingDevice) {
        tx.devices.set(params.deviceId, {
          ...existingDevice,
          lastSyncAt: nowIso,
        });
      } else {
        tx.devices.set(params.deviceId, {
          id: params.deviceId,
          storeId: params.storeId,
          deviceName: params.deviceName || "Primary Store Terminal",
          deviceType: "TABLET",
          registeredByUserId:
            params.actorUser?.id ||
            params.events[0]?.userId ||
            "20000000-0000-4000-8000-000000000001",
          isAuthorized: params.isDeviceAuthorized ?? true,
          lastSyncAt: nowIso,
          downloadCursor: 0,
          createdAt: nowIso,
        });
      }

      // Hydrate actorUser if provided and not yet in memory (prevents false 403 on serverless cold starts)
      if (params.actorUser?.id && !tx.users.has(params.actorUser.id)) {
        const cleanUsername =
          params.actorUser.username ||
          `operator_${params.actorUser.id.slice(0, 8)}`;
        tx.users.set(params.actorUser.id, {
          id: params.actorUser.id,
          storeId: params.storeId,
          name: params.actorUser.name || "Store Operator",
          email: params.actorUser.email || `${cleanUsername}@etinda.ph`,
          username: cleanUsername,
          role: params.actorUser.role,
          isActive: true,
          createdAt: nowIso,
        });
      }

      const acknowledgments: ServerEventAcknowledgment[] = [];

      for (const evt of params.events) {
        // 1. Idempotent Deduplication by eventId
        const alreadyProcessed = tx.processedEvents.get(evt.eventId);
        if (alreadyProcessed) {
          acknowledgments.push({
            ...alreadyProcessed.acknowledgment,
            duplicate: true,
          });
          continue;
        }

        // 2. Verify User Role & RBAC Permissions on the Server
        const user = tx.users.get(evt.userId);
        const userRole = user?.role ?? params.actorUser?.role ?? "ADMIN";
        if (!user) {
          const fallbackUsername = `operator_${evt.userId.slice(0, 8)}`;
          tx.users.set(evt.userId, {
            id: evt.userId,
            storeId: evt.storeId,
            name: params.actorUser?.name || "Store Operator",
            email: params.actorUser?.email || `${fallbackUsername}@etinda.ph`,
            username: params.actorUser?.username || fallbackUsername,
            role: userRole,
            isActive: true,
            createdAt: nowIso,
          });
        }

        this.enforceEventRolePermission(tx, evt, userRole, nowIso);

        // 3. Assign monotonic sequence number and apply domain event
        tx.sequenceCounter += 1;
        const sequenceNumber = tx.sequenceCounter;

        const ack = this.applySingleSyncEvent(
          tx,
          evt,
          sequenceNumber,
          nowIso
        );

        tx.processedEvents.set(evt.eventId, {
          ...evt,
          sequenceNumber,
          status: ack.status,
          conflictReason: ack.conflictReason,
          acknowledgedAt: nowIso,
          acknowledgment: ack,
        });

        acknowledgments.push(ack);
      }

      // 4. Update per-device SyncCheckpoint
      const checkpointKey = `${params.storeId}:${params.deviceId}`;
      const existingCheckpoint = tx.syncCheckpoints.get(checkpointKey);
      tx.syncCheckpoints.set(checkpointKey, {
        id: existingCheckpoint?.id ?? generateUuid(),
        storeId: params.storeId,
        deviceId: params.deviceId,
        lastSequenceNumber: tx.sequenceCounter,
        lastSyncedAt: nowIso,
      });

      return {
        serverTimestamp: nowIso,
        lastSequenceNumber: tx.sequenceCounter,
        acknowledgments,
      };
    });
  }

  private enforceEventRolePermission(
    tx: ServerStateSnapshot,
    evt: ServerSyncEventInput,
    userRole: "ADMIN" | "HELPER",
    nowIso: string
  ): void {
    const rejectUnauthorized = (reason: string): never => {
      const auditId = generateUuid();
      tx.auditLogs.set(auditId, {
        id: auditId,
        storeId: evt.storeId,
        deviceId: evt.deviceId,
        userId: evt.userId,
        userNameSnapshot: tx.users.get(evt.userId)?.name ?? "Unknown User",
        userRole,
        action: "UNAUTHORIZED_OPERATION_REJECTED",
        entityType: evt.eventType,
        entityId: evt.entityId,
        summary: reason,
        createdAt: nowIso,
      });

      const err = new Error(reason) as Error & {
        statusCode?: number;
        code?: string;
      };
      err.statusCode = 403;
      err.code = "FORBIDDEN_ROLE_OPERATION";
      throw err;
    };

    if (
      (evt.eventType === "PRODUCT_UPSERTED" ||
        evt.eventType === "CATEGORY_UPSERTED") &&
      !hasPermission(userRole, "MANAGE_PRODUCTS")
    ) {
      rejectUnauthorized(
        "Helper role is not permitted to create or modify product catalog or categories."
      );
    }

    if (
      evt.eventType === "SALE_VOIDED" &&
      !hasPermission(userRole, "VOID_SALE_TRANSACTION")
    ) {
      rejectUnauthorized(
        "Helper role is not permitted to void completed sales."
      );
    }

    if (evt.eventType === "UTANG_LEDGER_RECORDED") {
      const payload = evt.payload as {
        ledgerEntry?: UtangLedgerEntryEntity;
      } | null;
      if (
        payload?.ledgerEntry?.entryType === "ADJUSTMENT" &&
        !hasPermission(userRole, "ADJUST_UTANG_BALANCE")
      ) {
        rejectUnauthorized(
          "Helper role is not permitted to post manual Utang balance adjustments."
        );
      }
    }
  }

  private resolveOrCreateUtangAccount(
    tx: ServerStateSnapshot,
    storeId: string,
    utangAccountId: string,
    customerId: string,
    customerNameFallback: string,
    nowIso: string
  ): UtangAccountEntity {
    const existing =
      tx.utangAccounts.get(utangAccountId) ??
      Array.from(tx.utangAccounts.values()).find(
        (acc) => acc.customerId === customerId
      );

    if (existing) {
      return existing;
    }

    const customer = tx.customers.get(customerId);
    const created: UtangAccountEntity = {
      id: utangAccountId,
      storeId,
      customerId,
      customerNameSnapshot: customer?.name ?? customerNameFallback,
      contactNumberSnapshot: customer?.contactNumber ?? "",
      cachedBalanceCentavos: 0,
      hasPendingSyncEntries: false,
      needsReconciliation: false,
      updatedAt: nowIso,
    };
    tx.utangAccounts.set(created.id, created);
    return created;
  }

  private applySingleSyncEvent(
    tx: ServerStateSnapshot,
    evt: ServerSyncEventInput,
    sequenceNumber: number,
    nowIso: string
  ): ServerEventAcknowledgment {
    let status: "ACKNOWLEDGED" | "CONFLICT" | "REJECTED" = "ACKNOWLEDGED";
    let conflictReason: string | undefined;
    const serverProductSnapshots: NonNullable<
      ServerEventAcknowledgment["serverProductSnapshots"]
    > = [];
    let serverUtangSnapshot: ServerEventAcknowledgment["serverUtangSnapshot"];

    switch (evt.eventType) {
      case "SALE_CREATED": {
        const payload = evt.payload as {
          sale?: SaleEntity;
          saleItems?: SaleItemEntity[];
          items?: SaleItemEntity[];
          payments?: PaymentEntity[];
          movements?: InventoryMovementEntity[];
          inventoryMovements?: InventoryMovementEntity[];
          utangLedgerEntry?: UtangLedgerEntryEntity;
        } | null;

        const resolvedSaleItems = payload?.saleItems ?? payload?.items;
        if (!payload?.sale || !Array.isArray(resolvedSaleItems)) {
          throw new Error(
            "Invalid SALE_CREATED payload: missing sale or saleItems."
          );
        }

        const saleItems = resolvedSaleItems;
        const movements =
          payload.movements ?? payload.inventoryMovements ?? [];
        const payments = payload.payments ?? [];
        const conflictMessages: string[] = [];

        // Apply append-only inventory movements and check for multi-device oversell
        for (const mov of movements) {
          let product = tx.products.get(mov.productId);
          if (!product) {
            // Reconstruct product baseline if syncing to a cold-started serverless instance
            const matchingLine = saleItems.find(
              (item) => item.productId === mov.productId
            );
            const fallbackCategoryId =
              Array.from(tx.categories.keys())[0] ??
              "40000000-0000-4000-8000-000000000001";
            product = {
              id: mov.productId,
              storeId: evt.storeId,
              categoryId: fallbackCategoryId,
              name:
                matchingLine?.productNameSnapshot ??
                mov.productNameSnapshot ??
                "Store Product",
              baseUnit: matchingLine?.unitLabelSnapshot ?? "pc",
              sellingPriceCentavos:
                matchingLine?.unitSellingPriceCentavos ??
                mov.unitCostCentavos ??
                0,
              latestCostCentavos:
                matchingLine?.unitCostSnapshotCentavos ??
                mov.unitCostCentavos ??
                0,
              lowStockThreshold: 5,
              allowDecimalQuantity: !Number.isInteger(mov.quantityChange),
              isFrequent: true,
              isActive: true,
              cachedStock: Math.abs(mov.quantityChange),
              syncStatus: "SYNCED",
              createdAt: nowIso,
              updatedAt: nowIso,
            };
            tx.products.set(product.id, product);
          }

          const nextStock = roundSignedStockQuantity(
            product.cachedStock + mov.quantityChange
          );
          const isOversold = nextStock < 0;

          if (isOversold) {
            conflictMessages.push(
              `Oversell conflict on ${product.name}: server stock dropped to ${nextStock} ${product.baseUnit} after multi-device sale.`
            );
          }

          const updatedProduct: ProductEntity = {
            ...product,
            cachedStock: nextStock,
            hasOversellConflict:
              isOversold || Boolean(product.hasOversellConflict),
            syncStatus: isOversold ? "CONFLICT" : "SYNCED",
            updatedAt: nowIso,
          };
          tx.products.set(product.id, updatedProduct);

          tx.inventoryMovements.set(mov.id, {
            ...mov,
            syncStatus: isOversold ? "CONFLICT" : "SYNCED",
            conflictNote: isOversold
              ? `Stock dropped to ${nextStock} ${product.baseUnit}`
              : undefined,
          });

          serverProductSnapshots.push({
            productId: updatedProduct.id,
            cachedStock: updatedProduct.cachedStock,
            hasOversellConflict: Boolean(updatedProduct.hasOversellConflict),
            latestCostCentavos: updatedProduct.latestCostCentavos,
          });
        }

        if (conflictMessages.length > 0) {
          status = "CONFLICT";
          conflictReason = conflictMessages.join(" ");

          const auditId = generateUuid();
          tx.auditLogs.set(auditId, {
            id: auditId,
            storeId: evt.storeId,
            deviceId: evt.deviceId,
            userId: evt.userId,
            userNameSnapshot: payload.sale.userNameSnapshot,
            userRole: tx.users.get(evt.userId)?.role ?? "HELPER",
            action: "INVENTORY_OVERSELL_CONFLICT",
            entityType: "SALE",
            entityId: payload.sale.id,
            summary: conflictReason,
            createdAt: nowIso,
          });
        }

        // Persist sale & sale items (never silently discard a completed sale per AGENTS.md §11)
        tx.sales.set(payload.sale.id, {
          ...payload.sale,
          syncStatus: status === "CONFLICT" ? "CONFLICT" : "SYNCED",
          conflictReason,
        });

        for (const item of saleItems) {
          tx.saleItems.set(item.id, { ...item });
        }

        for (const payment of payments) {
          tx.payments.set(payment.id, {
            ...payment,
            syncStatus: status === "CONFLICT" ? "CONFLICT" : "SYNCED",
          });
        }

        // Reconcile Utang Ledger if sale charged to Utang
        if (payload.utangLedgerEntry) {
          const entry = payload.utangLedgerEntry;
          const account = this.resolveOrCreateUtangAccount(
            tx,
            evt.storeId,
            entry.utangAccountId,
            entry.customerId,
            entry.customerNameSnapshot,
            nowIso
          );

          tx.utangLedger.set(entry.id, {
            ...entry,
            utangAccountId: account.id,
            syncStatus: status === "CONFLICT" ? "CONFLICT" : "SYNCED",
          });

          const authoritativeBalance = this.recomputeUtangAccountBalance(
            tx,
            account.id
          );

          tx.utangLedger.set(entry.id, {
            ...entry,
            utangAccountId: account.id,
            runningBalanceSnapshotCentavos: authoritativeBalance,
            syncStatus: status === "CONFLICT" ? "CONFLICT" : "SYNCED",
          });

          const updatedAccount: UtangAccountEntity = {
            ...account,
            cachedBalanceCentavos: authoritativeBalance,
            hasPendingSyncEntries: false,
            needsReconciliation:
              status === "CONFLICT" || authoritativeBalance < 0,
            updatedAt: nowIso,
          };
          tx.utangAccounts.set(account.id, updatedAccount);

          serverUtangSnapshot = {
            utangAccountId: updatedAccount.id,
            customerId: updatedAccount.customerId,
            cachedBalanceCentavos: updatedAccount.cachedBalanceCentavos,
            needsReconciliation: updatedAccount.needsReconciliation,
            runningBalanceSnapshotCentavos: authoritativeBalance,
          };
        }
        break;
      }

      case "SALE_VOIDED": {
        const payload = evt.payload as {
          saleId?: string;
          voidReason?: string;
          reversalMovements?: InventoryMovementEntity[];
          reversalUtangEntry?: UtangLedgerEntryEntity;
        } | null;

        const saleId = payload?.saleId ?? evt.entityId;
        const existingSale = tx.sales.get(saleId);
        if (existingSale) {
          tx.sales.set(saleId, {
            ...existingSale,
            status: "VOIDED",
            voidReason: payload?.voidReason ?? "Voided by Owner",
            voidedAt: nowIso,
            syncStatus: "SYNCED",
          });
        }

        for (const mov of payload?.reversalMovements ?? []) {
          const product = tx.products.get(mov.productId);
          if (product) {
            const nextStock = roundSignedStockQuantity(
              product.cachedStock + mov.quantityChange
            );
            const updatedProduct: ProductEntity = {
              ...product,
              cachedStock: nextStock,
              hasOversellConflict:
                nextStock >= 0 ? false : Boolean(product.hasOversellConflict),
              syncStatus: "SYNCED",
              updatedAt: nowIso,
            };
            tx.products.set(product.id, updatedProduct);
            serverProductSnapshots.push({
              productId: updatedProduct.id,
              cachedStock: updatedProduct.cachedStock,
              hasOversellConflict: Boolean(updatedProduct.hasOversellConflict),
              latestCostCentavos: updatedProduct.latestCostCentavos,
            });
          }
          tx.inventoryMovements.set(mov.id, {
            ...mov,
            syncStatus: "SYNCED",
          });
        }

        if (payload?.reversalUtangEntry) {
          const rev = payload.reversalUtangEntry;
          tx.utangLedger.set(rev.id, {
            ...rev,
            syncStatus: "SYNCED",
          });
          const authoritativeBalance = this.recomputeUtangAccountBalance(
            tx,
            rev.utangAccountId
          );
          tx.utangLedger.set(rev.id, {
            ...rev,
            runningBalanceSnapshotCentavos: authoritativeBalance,
            syncStatus: "SYNCED",
          });
          const account = tx.utangAccounts.get(rev.utangAccountId);
          if (account) {
            const updatedAccount: UtangAccountEntity = {
              ...account,
              cachedBalanceCentavos: authoritativeBalance,
              hasPendingSyncEntries: false,
              needsReconciliation: authoritativeBalance < 0,
              updatedAt: nowIso,
            };
            tx.utangAccounts.set(account.id, updatedAccount);
            serverUtangSnapshot = {
              utangAccountId: updatedAccount.id,
              customerId: updatedAccount.customerId,
              cachedBalanceCentavos: updatedAccount.cachedBalanceCentavos,
              needsReconciliation: updatedAccount.needsReconciliation,
              runningBalanceSnapshotCentavos: authoritativeBalance,
            };
          }
        }
        break;
      }

      case "PRODUCT_UPSERTED": {
        const payload = evt.payload as
          | (ProductEntity & { openingMovement?: InventoryMovementEntity })
          | { variant?: ProductVariantEntity }
          | null;

        if (payload && "variant" in payload && payload.variant) {
          tx.productVariants.set(payload.variant.id, {
            ...payload.variant,
            syncStatus: "SYNCED",
            updatedAt: nowIso,
          });
        } else if (payload && "id" in payload) {
          if (payload.categoryId && !tx.categories.has(payload.categoryId)) {
            tx.categories.set(payload.categoryId, {
              id: payload.categoryId,
              storeId: evt.storeId,
              name: "General Merchandise",
              sortOrder: tx.categories.size + 1,
              isActive: true,
              syncStatus: "SYNCED",
              updatedAt: nowIso,
            });
          }

          const existing = tx.products.get(payload.id);
          const { openingMovement, ...productFields } = payload;
          const updated: ProductEntity = {
            ...productFields,
            cachedStock: existing ? existing.cachedStock : payload.cachedStock,
            syncStatus: "SYNCED",
            updatedAt: nowIso,
          };
          tx.products.set(updated.id, updated);

          if (openingMovement?.id) {
            tx.inventoryMovements.set(openingMovement.id, {
              ...openingMovement,
              syncStatus: "SYNCED",
            });
          }

          serverProductSnapshots.push({
            productId: updated.id,
            cachedStock: updated.cachedStock,
            hasOversellConflict: Boolean(updated.hasOversellConflict),
            latestCostCentavos: updated.latestCostCentavos,
          });
        }
        break;
      }

      case "CATEGORY_UPSERTED": {
        const category = evt.payload as CategoryEntity | null;
        if (category?.id) {
          tx.categories.set(category.id, {
            ...category,
            syncStatus: "SYNCED",
            updatedAt: nowIso,
          });
        }
        break;
      }

      case "INVENTORY_MOVEMENT_RECORDED": {
        const mov = evt.payload as InventoryMovementEntity | null;
        if (!mov?.id || !mov.productId) {
          throw new Error("Invalid INVENTORY_MOVEMENT_RECORDED payload.");
        }
        const product = tx.products.get(mov.productId);
        if (!product) {
          throw new Error(`Product ${mov.productId} not found.`);
        }

        const nextStock = roundSignedStockQuantity(
          product.cachedStock + mov.quantityChange
        );
        const isOversold = nextStock < 0;

        if (isOversold) {
          status = "CONFLICT";
          conflictReason = `Inventory movement resulted in negative stock (${nextStock} ${product.baseUnit}) on ${product.name}.`;
        }

        const updatedProduct: ProductEntity = {
          ...product,
          cachedStock: nextStock,
          hasOversellConflict: isOversold,
          syncStatus: isOversold ? "CONFLICT" : "SYNCED",
          updatedAt: nowIso,
        };
        tx.products.set(product.id, updatedProduct);
        tx.inventoryMovements.set(mov.id, {
          ...mov,
          syncStatus: isOversold ? "CONFLICT" : "SYNCED",
          conflictNote: conflictReason,
        });

        serverProductSnapshots.push({
          productId: updatedProduct.id,
          cachedStock: updatedProduct.cachedStock,
          hasOversellConflict: Boolean(updatedProduct.hasOversellConflict),
          latestCostCentavos: updatedProduct.latestCostCentavos,
        });
        break;
      }

      case "PURCHASE_RECORDED": {
        const payload = evt.payload as {
          purchaseRecord?: PurchaseRecordEntity;
          purchaseItems?: PurchaseItemEntity[];
          movements?: InventoryMovementEntity[];
        } | null;

        if (!payload?.purchaseRecord) {
          throw new Error("Invalid PURCHASE_RECORDED payload.");
        }

        tx.purchaseRecords.set(payload.purchaseRecord.id, {
          ...payload.purchaseRecord,
          syncStatus: "SYNCED",
        });

        for (const item of payload.purchaseItems ?? []) {
          tx.purchaseItems.set(item.id, { ...item });
          const product = tx.products.get(item.productId);
          if (product) {
            const nextStock = roundSignedStockQuantity(
              product.cachedStock + item.quantityAdded
            );
            const updatedProduct: ProductEntity = {
              ...product,
              cachedStock: nextStock,
              latestCostCentavos: item.unitCostCentavos,
              hasOversellConflict:
                nextStock >= 0 ? false : Boolean(product.hasOversellConflict),
              syncStatus: "SYNCED",
              updatedAt: nowIso,
            };
            tx.products.set(product.id, updatedProduct);
            serverProductSnapshots.push({
              productId: updatedProduct.id,
              cachedStock: updatedProduct.cachedStock,
              hasOversellConflict: Boolean(updatedProduct.hasOversellConflict),
              latestCostCentavos: updatedProduct.latestCostCentavos,
            });
          }
        }

        for (const mov of payload.movements ?? []) {
          tx.inventoryMovements.set(mov.id, {
            ...mov,
            syncStatus: "SYNCED",
          });
        }
        break;
      }

      case "CUSTOMER_UPSERTED": {
        const customer = evt.payload as CustomerEntity | null;
        if (!customer?.id) {
          throw new Error("Invalid CUSTOMER_UPSERTED payload.");
        }
        tx.customers.set(customer.id, {
          ...customer,
          syncStatus: "SYNCED",
          updatedAt: nowIso,
        });

        this.resolveOrCreateUtangAccount(
          tx,
          evt.storeId,
          generateUuid(),
          customer.id,
          customer.name,
          nowIso
        );
        break;
      }

      case "UTANG_LEDGER_RECORDED": {
        const payload = evt.payload as {
          ledgerEntry?: UtangLedgerEntryEntity;
          paymentRecord?: PaymentEntity;
        } | null;

        if (!payload?.ledgerEntry) {
          throw new Error("Invalid UTANG_LEDGER_RECORDED payload.");
        }

        const entry = payload.ledgerEntry;
        const account = this.resolveOrCreateUtangAccount(
          tx,
          evt.storeId,
          entry.utangAccountId,
          entry.customerId,
          entry.customerNameSnapshot,
          nowIso
        );

        if (payload.paymentRecord) {
          tx.payments.set(payload.paymentRecord.id, {
            ...payload.paymentRecord,
            syncStatus: "SYNCED",
          });
        }

        tx.utangLedger.set(entry.id, {
          ...entry,
          utangAccountId: account.id,
          syncStatus: "SYNCED",
        });

        const authoritativeBalance = this.recomputeUtangAccountBalance(
          tx,
          account.id
        );

        // Detect multi-device concurrent payment overpayment (balance < 0)
        const needsReconciliation = authoritativeBalance < 0;
        if (needsReconciliation && entry.entryType === "PAYMENT") {
          status = "CONFLICT";
          conflictReason = `Concurrent Utang payments resulted in credit balance (${authoritativeBalance} centavos) for ${account.customerNameSnapshot}. Both payments were preserved; Owner reconciliation recommended.`;
        }

        tx.utangLedger.set(entry.id, {
          ...entry,
          utangAccountId: account.id,
          runningBalanceSnapshotCentavos: authoritativeBalance,
          syncStatus: status === "CONFLICT" ? "CONFLICT" : "SYNCED",
        });

        const updatedAccount: UtangAccountEntity = {
          ...account,
          cachedBalanceCentavos: authoritativeBalance,
          hasPendingSyncEntries: false,
          needsReconciliation,
          updatedAt: nowIso,
        };
        tx.utangAccounts.set(account.id, updatedAccount);

        serverUtangSnapshot = {
          utangAccountId: updatedAccount.id,
          customerId: updatedAccount.customerId,
          cachedBalanceCentavos: updatedAccount.cachedBalanceCentavos,
          needsReconciliation: updatedAccount.needsReconciliation,
          runningBalanceSnapshotCentavos: authoritativeBalance,
        };
        break;
      }

      default:
        break;
    }

    return {
      eventId: evt.eventId,
      entityId: evt.entityId,
      eventType: evt.eventType,
      sequenceNumber,
      status,
      duplicate: false,
      acknowledgedAt: nowIso,
      conflictReason,
      serverProductSnapshots:
        serverProductSnapshots.length > 0 ? serverProductSnapshots : undefined,
      serverUtangSnapshot,
    };
  }

  /**
   * Pulls delta events and current authoritative store entities since `sinceSequenceNumber`.
   */
  public pullDeltaSnapshot(params: {
    storeId: string;
    deviceId?: string;
    sinceSequenceNumber?: number;
  }) {
    if (params.deviceId && !this.isDeviceAuthorized(params.deviceId, true)) {
      const err = new Error(
        "This device has been revoked by the Store Owner."
      ) as Error & { statusCode?: number; code?: string };
      err.statusCode = 403;
      err.code = "DEVICE_REVOKED";
      throw err;
    }

    const since = params.sinceSequenceNumber ?? 0;
    const deltaEvents = Array.from(this.state.processedEvents.values())
      .filter(
        (evt) =>
          evt.storeId === params.storeId && evt.sequenceNumber > since
      )
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    return {
      serverTimestamp: new Date().toISOString(),
      latestSequenceNumber: this.state.sequenceCounter,
      deltaEvents,
      snapshot: {
        products: Array.from(this.state.products.values()).filter(
          (p) => p.storeId === params.storeId
        ),
        categories: Array.from(this.state.categories.values()).filter(
          (c) => c.storeId === params.storeId
        ),
        productVariants: Array.from(this.state.productVariants.values()).filter(
          (v) => v.storeId === params.storeId
        ),
        customers: Array.from(this.state.customers.values()).filter(
          (c) => c.storeId === params.storeId
        ),
        utangAccounts: Array.from(this.state.utangAccounts.values()).filter(
          (a) => a.storeId === params.storeId
        ),
        utangLedger: Array.from(this.state.utangLedger.values()).filter(
          (l) => l.storeId === params.storeId
        ),
        devices: Array.from(this.state.devices.values()).filter(
          (d) => d.storeId === params.storeId
        ),
      },
    };
  }
}

const globalForLedgerEngine = globalThis as unknown as {
  etindaCleanStoreLedgerEngineV3?: StoreLedgerEngine;
};

export const serverStoreLedger =
  globalForLedgerEngine.etindaCleanStoreLedgerEngineV3 ??
  new StoreLedgerEngine(createCleanProductionServerState());

if (process.env.NODE_ENV !== "production") {
  globalForLedgerEngine.etindaCleanStoreLedgerEngineV3 = serverStoreLedger;
}
