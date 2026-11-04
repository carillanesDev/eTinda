import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  StoreLedgerEngine,
  createCleanProductionServerState,
} from "../src/server/repositories/storeLedgerEngine.ts";
import {
  DEFAULT_DEVICE_ID,
  DEFAULT_HELPER_ID,
  DEFAULT_OWNER_ID,
  DEFAULT_STORE_ID,
  REVOKED_DEVICE_ID,
  SECONDARY_DEVICE_ID,
  SEED_CATEGORY_IDS,
  SEED_CUSTOMER_IDS,
  SEED_PRODUCT_IDS,
  SEED_UTANG_ACCOUNT_IDS,
} from "../src/lib/db/seed-local.ts";
import { generateUuid } from "../src/lib/utils/uuid.ts";
import {
  hashPasswordOrPin,
  verifyPasswordOrPin,
} from "../src/lib/auth/password.ts";
import { syncEventSchema } from "../src/lib/validation/schemas.ts";

describe("eTinda Multi-Device Synchronization, Integrity & Edge-Case Suite (AGENTS.md §16)", () => {
  let engine: StoreLedgerEngine;

  beforeEach(() => {
    engine = new StoreLedgerEngine();
  });

  it("1. Processes offline Cash Sale and deducts inventory via append-only movement", () => {
    const saleId = generateUuid();
    const saleItemId = generateUuid();
    const movementId = generateUuid();
    const paymentId = generateUuid();
    const eventId = generateUuid();
    const nowIso = new Date().toISOString();

    const initialStock =
      engine.getState().products.get(SEED_PRODUCT_IDS.PANCIT_CANTON)
        ?.cachedStock ?? 0;

    const result = engine.processSyncBatch({
      storeId: DEFAULT_STORE_ID,
      deviceId: DEFAULT_DEVICE_ID,
      events: [
        {
          eventId,
          storeId: DEFAULT_STORE_ID,
          deviceId: DEFAULT_DEVICE_ID,
          userId: DEFAULT_HELPER_ID,
          eventType: "SALE_CREATED",
          entityId: saleId,
          schemaVersion: 1,
          createdAt: nowIso,
          payload: {
            sale: {
              id: saleId,
              storeId: DEFAULT_STORE_ID,
              receiptNumber: "OR-3000-20261103-0001",
              status: "COMPLETED",
              paymentMethod: "CASH",
              subtotalCentavos: 3600,
              totalCentavos: 3600,
              cashTenderedCentavos: 5000,
              changeGivenCentavos: 1400,
              utangChargedCentavos: 0,
              deviceId: DEFAULT_DEVICE_ID,
              userId: DEFAULT_HELPER_ID,
              userNameSnapshot: "Jomar Reyes (Store Helper)",
              syncStatus: "PENDING",
              createdAt: nowIso,
            },
            saleItems: [
              {
                id: saleItemId,
                saleId,
                storeId: DEFAULT_STORE_ID,
                productId: SEED_PRODUCT_IDS.PANCIT_CANTON,
                productNameSnapshot: "Lucky Me! Pancit Canton Calamansi 80g",
                unitLabelSnapshot: "pack",
                quantity: 2,
                baseUnitMultiplier: 1,
                unitSellingPriceCentavos: 1800,
                unitCostSnapshotCentavos: 1450,
                subtotalCentavos: 3600,
              },
            ],
            payments: [
              {
                id: paymentId,
                storeId: DEFAULT_STORE_ID,
                saleId,
                amountCentavos: 3600,
                paymentType: "CASH_SALE",
                deviceId: DEFAULT_DEVICE_ID,
                userId: DEFAULT_HELPER_ID,
                userNameSnapshot: "Jomar Reyes (Store Helper)",
                syncStatus: "PENDING",
                createdAt: nowIso,
              },
            ],
            movements: [
              {
                id: movementId,
                storeId: DEFAULT_STORE_ID,
                productId: SEED_PRODUCT_IDS.PANCIT_CANTON,
                productNameSnapshot: "Lucky Me! Pancit Canton Calamansi 80g",
                movementType: "SALE_DEDUCTION",
                quantityChange: -2,
                unitCostCentavos: 1450,
                reasonOrNotes: "Sale OR-3000-20261103-0001 (2 pack)",
                deviceId: DEFAULT_DEVICE_ID,
                userId: DEFAULT_HELPER_ID,
                userNameSnapshot: "Jomar Reyes (Store Helper)",
                referenceId: saleId,
                syncStatus: "PENDING",
                createdAt: nowIso,
              },
            ],
          },
        },
      ],
    });

    assert.equal(result.acknowledgments.length, 1);
    assert.equal(result.acknowledgments[0].status, "ACKNOWLEDGED");
    assert.equal(result.acknowledgments[0].duplicate, false);

    const updatedProduct = engine
      .getState()
      .products.get(SEED_PRODUCT_IDS.PANCIT_CANTON);
    assert.equal(updatedProduct?.cachedStock, initialStock - 2);
  });

  it("2. Enforces idempotent duplicate event processing without double-deducting stock or Utang", () => {
    const saleId = generateUuid();
    const movementId = generateUuid();
    const ledgerId = generateUuid();
    const eventId = generateUuid();
    const nowIso = new Date().toISOString();

    const initialStock =
      engine.getState().products.get(SEED_PRODUCT_IDS.CORNED_BEEF)
        ?.cachedStock ?? 0;
    const initialUtang =
      engine.getState().utangAccounts.get(SEED_UTANG_ACCOUNT_IDS.MARIA_SANTOS)
        ?.cachedBalanceCentavos ?? 0;

    const eventPayload = {
      eventId,
      storeId: DEFAULT_STORE_ID,
      deviceId: DEFAULT_DEVICE_ID,
      userId: DEFAULT_OWNER_ID,
      eventType: "SALE_CREATED" as const,
      entityId: saleId,
      schemaVersion: 1,
      createdAt: nowIso,
      payload: {
        sale: {
          id: saleId,
          storeId: DEFAULT_STORE_ID,
          receiptNumber: "OR-3000-20261103-0002",
          status: "COMPLETED",
          paymentMethod: "UTANG",
          customerId: SEED_CUSTOMER_IDS.MARIA_SANTOS,
          customerNameSnapshot: "Nanay Maria Santos",
          subtotalCentavos: 4200,
          totalCentavos: 4200,
          cashTenderedCentavos: 0,
          changeGivenCentavos: 0,
          utangChargedCentavos: 4200,
          deviceId: DEFAULT_DEVICE_ID,
          userId: DEFAULT_OWNER_ID,
          userNameSnapshot: "Aling Nena (Store Owner)",
          syncStatus: "PENDING",
          createdAt: nowIso,
        },
        saleItems: [
          {
            id: generateUuid(),
            saleId,
            storeId: DEFAULT_STORE_ID,
            productId: SEED_PRODUCT_IDS.CORNED_BEEF,
            productNameSnapshot: "Argentina Corned Beef 150g",
            unitLabelSnapshot: "can",
            quantity: 1,
            baseUnitMultiplier: 1,
            unitSellingPriceCentavos: 4200,
            unitCostSnapshotCentavos: 3550,
            subtotalCentavos: 4200,
          },
        ],
        movements: [
          {
            id: movementId,
            storeId: DEFAULT_STORE_ID,
            productId: SEED_PRODUCT_IDS.CORNED_BEEF,
            productNameSnapshot: "Argentina Corned Beef 150g",
            movementType: "SALE_DEDUCTION",
            quantityChange: -1,
            unitCostCentavos: 3550,
            reasonOrNotes: "Utang sale",
            deviceId: DEFAULT_DEVICE_ID,
            userId: DEFAULT_OWNER_ID,
            userNameSnapshot: "Aling Nena (Store Owner)",
            referenceId: saleId,
            syncStatus: "PENDING",
            createdAt: nowIso,
          },
        ],
        utangLedgerEntry: {
          id: ledgerId,
          storeId: DEFAULT_STORE_ID,
          utangAccountId: SEED_UTANG_ACCOUNT_IDS.MARIA_SANTOS,
          customerId: SEED_CUSTOMER_IDS.MARIA_SANTOS,
          customerNameSnapshot: "Nanay Maria Santos",
          entryType: "CHARGE",
          signedAmountCentavos: 4200,
          runningBalanceSnapshotCentavos: initialUtang + 4200,
          referenceSaleId: saleId,
          notes: "Utang sale",
          deviceId: DEFAULT_DEVICE_ID,
          userId: DEFAULT_OWNER_ID,
          userNameSnapshot: "Aling Nena (Store Owner)",
          syncStatus: "PENDING",
          createdAt: nowIso,
        },
      },
    };

    // First delivery
    const firstResult = engine.processSyncBatch({
      storeId: DEFAULT_STORE_ID,
      deviceId: DEFAULT_DEVICE_ID,
      events: [eventPayload],
    });
    assert.equal(firstResult.acknowledgments[0].duplicate, false);

    // Second (duplicate) delivery of exact same eventId
    const secondResult = engine.processSyncBatch({
      storeId: DEFAULT_STORE_ID,
      deviceId: DEFAULT_DEVICE_ID,
      events: [eventPayload],
    });
    assert.equal(secondResult.acknowledgments[0].duplicate, true);
    assert.equal(
      secondResult.acknowledgments[0].sequenceNumber,
      firstResult.acknowledgments[0].sequenceNumber
    );

    // Stock and Utang balance must only be modified ONCE
    assert.equal(
      engine.getState().products.get(SEED_PRODUCT_IDS.CORNED_BEEF)?.cachedStock,
      initialStock - 1
    );
    assert.equal(
      engine.getState().utangAccounts.get(SEED_UTANG_ACCOUNT_IDS.MARIA_SANTOS)
        ?.cachedBalanceCentavos,
      initialUtang + 4200
    );
  });

  it("3. Detects multi-device overselling conflict when two devices sell the same remaining stock without discarding either sale", () => {
    // Sinandomeng Special Rice has 42.5 kg in seed stock
    const productId = SEED_PRODUCT_IDS.SINANDOMENG_RICE;
    assert.equal(engine.getState().products.get(productId)?.cachedStock, 42.5);

    const nowIso = new Date().toISOString();
    const sale1Id = generateUuid();
    const sale2Id = generateUuid();

    // Device 1 sells 30 kg offline
    const res1 = engine.processSyncBatch({
      storeId: DEFAULT_STORE_ID,
      deviceId: DEFAULT_DEVICE_ID,
      events: [
        {
          eventId: generateUuid(),
          storeId: DEFAULT_STORE_ID,
          deviceId: DEFAULT_DEVICE_ID,
          userId: DEFAULT_OWNER_ID,
          eventType: "SALE_CREATED",
          entityId: sale1Id,
          schemaVersion: 1,
          createdAt: nowIso,
          payload: {
            sale: {
              id: sale1Id,
              storeId: DEFAULT_STORE_ID,
              receiptNumber: "OR-3000-20261103-0010",
              status: "COMPLETED",
              paymentMethod: "CASH",
              subtotalCentavos: 168000,
              totalCentavos: 168000,
              cashTenderedCentavos: 170000,
              changeGivenCentavos: 2000,
              utangChargedCentavos: 0,
              deviceId: DEFAULT_DEVICE_ID,
              userId: DEFAULT_OWNER_ID,
              userNameSnapshot: "Aling Nena (Store Owner)",
              syncStatus: "PENDING",
              createdAt: nowIso,
            },
            saleItems: [],
            movements: [
              {
                id: generateUuid(),
                storeId: DEFAULT_STORE_ID,
                productId,
                productNameSnapshot: "Sinandomeng Special Rice (Per Kilo)",
                movementType: "SALE_DEDUCTION",
                quantityChange: -30,
                unitCostCentavos: 4700,
                reasonOrNotes: "Device 1 offline sale (30 kg)",
                deviceId: DEFAULT_DEVICE_ID,
                userId: DEFAULT_OWNER_ID,
                userNameSnapshot: "Aling Nena (Store Owner)",
                referenceId: sale1Id,
                syncStatus: "PENDING",
                createdAt: nowIso,
              },
            ],
          },
        },
      ],
    });
    assert.equal(res1.acknowledgments[0].status, "ACKNOWLEDGED");
    assert.equal(engine.getState().products.get(productId)?.cachedStock, 12.5);

    // Device 2 also sold 20 kg while offline (before seeing Device 1's sync)
    const res2 = engine.processSyncBatch({
      storeId: DEFAULT_STORE_ID,
      deviceId: SECONDARY_DEVICE_ID,
      events: [
        {
          eventId: generateUuid(),
          storeId: DEFAULT_STORE_ID,
          deviceId: SECONDARY_DEVICE_ID,
          userId: DEFAULT_HELPER_ID,
          eventType: "SALE_CREATED",
          entityId: sale2Id,
          schemaVersion: 1,
          createdAt: nowIso,
          payload: {
            sale: {
              id: sale2Id,
              storeId: DEFAULT_STORE_ID,
              receiptNumber: "OR-3002-20261103-0001",
              status: "COMPLETED",
              paymentMethod: "CASH",
              subtotalCentavos: 112000,
              totalCentavos: 112000,
              cashTenderedCentavos: 120000,
              changeGivenCentavos: 8000,
              utangChargedCentavos: 0,
              deviceId: SECONDARY_DEVICE_ID,
              userId: DEFAULT_HELPER_ID,
              userNameSnapshot: "Jomar Reyes (Store Helper)",
              syncStatus: "PENDING",
              createdAt: nowIso,
            },
            saleItems: [],
            movements: [
              {
                id: generateUuid(),
                storeId: DEFAULT_STORE_ID,
                productId,
                productNameSnapshot: "Sinandomeng Special Rice (Per Kilo)",
                movementType: "SALE_DEDUCTION",
                quantityChange: -20,
                unitCostCentavos: 4700,
                reasonOrNotes: "Device 2 offline sale (20 kg)",
                deviceId: SECONDARY_DEVICE_ID,
                userId: DEFAULT_HELPER_ID,
                userNameSnapshot: "Jomar Reyes (Store Helper)",
                referenceId: sale2Id,
                syncStatus: "PENDING",
                createdAt: nowIso,
              },
            ],
          },
        },
      ],
    });

    // Must NOT discard sale2, must flag CONFLICT, and set stock to -7.5 with hasOversellConflict=true
    assert.equal(res2.acknowledgments[0].status, "CONFLICT");
    assert.match(
      res2.acknowledgments[0].conflictReason ?? "",
      /Oversell conflict/i
    );
    assert.equal(engine.getState().sales.has(sale1Id), true);
    assert.equal(engine.getState().sales.has(sale2Id), true);
    assert.equal(engine.getState().products.get(productId)?.cachedStock, -7.5);
    assert.equal(
      engine.getState().products.get(productId)?.hasOversellConflict,
      true
    );
  });

  it("4. Reconciles concurrent Utang customer payments recorded offline on two devices", () => {
    // Mang Roberto Dizon starts with ₱242.00 (24200 centavos) balance
    const accountId = SEED_UTANG_ACCOUNT_IDS.ROBERTO_DIZON;
    const customerId = SEED_CUSTOMER_IDS.ROBERTO_DIZON;
    assert.equal(
      engine.getState().utangAccounts.get(accountId)?.cachedBalanceCentavos,
      24200
    );

    const nowIso = new Date().toISOString();

    // Device 1 records a ₱150.00 (15000 centavos) partial payment
    const res1 = engine.processSyncBatch({
      storeId: DEFAULT_STORE_ID,
      deviceId: DEFAULT_DEVICE_ID,
      events: [
        {
          eventId: generateUuid(),
          storeId: DEFAULT_STORE_ID,
          deviceId: DEFAULT_DEVICE_ID,
          userId: DEFAULT_OWNER_ID,
          eventType: "UTANG_LEDGER_RECORDED",
          entityId: generateUuid(),
          schemaVersion: 1,
          createdAt: nowIso,
          payload: {
            ledgerEntry: {
              id: generateUuid(),
              storeId: DEFAULT_STORE_ID,
              utangAccountId: accountId,
              customerId,
              customerNameSnapshot: "Mang Roberto Dizon",
              entryType: "PAYMENT",
              signedAmountCentavos: -15000,
              runningBalanceSnapshotCentavos: 9200,
              notes: "Payment on Device 1",
              deviceId: DEFAULT_DEVICE_ID,
              userId: DEFAULT_OWNER_ID,
              userNameSnapshot: "Aling Nena (Store Owner)",
              syncStatus: "PENDING",
              createdAt: nowIso,
            },
          },
        },
      ],
    });
    assert.equal(res1.acknowledgments[0].status, "ACKNOWLEDGED");
    assert.equal(
      res1.acknowledgments[0].serverUtangSnapshot?.cachedBalanceCentavos,
      9200
    );

    // Device 2 also recorded a ₱150.00 (15000 centavos) payment while offline -> total balance becomes -5800 centavos
    const res2 = engine.processSyncBatch({
      storeId: DEFAULT_STORE_ID,
      deviceId: SECONDARY_DEVICE_ID,
      events: [
        {
          eventId: generateUuid(),
          storeId: DEFAULT_STORE_ID,
          deviceId: SECONDARY_DEVICE_ID,
          userId: DEFAULT_HELPER_ID,
          eventType: "UTANG_LEDGER_RECORDED",
          entityId: generateUuid(),
          schemaVersion: 1,
          createdAt: nowIso,
          payload: {
            ledgerEntry: {
              id: generateUuid(),
              storeId: DEFAULT_STORE_ID,
              utangAccountId: accountId,
              customerId,
              customerNameSnapshot: "Mang Roberto Dizon",
              entryType: "PAYMENT",
              signedAmountCentavos: -15000,
              runningBalanceSnapshotCentavos: 9200, // Stale local snapshot from Device 2
              notes: "Payment on Device 2",
              deviceId: SECONDARY_DEVICE_ID,
              userId: DEFAULT_HELPER_ID,
              userNameSnapshot: "Jomar Reyes (Store Helper)",
              syncStatus: "PENDING",
              createdAt: nowIso,
            },
          },
        },
      ],
    });

    // Server recomputes authoritative balance (-5800 centavos), preserves both payments, and flags needsReconciliation
    assert.equal(res2.acknowledgments[0].status, "CONFLICT");
    assert.equal(
      res2.acknowledgments[0].serverUtangSnapshot?.cachedBalanceCentavos,
      -5800
    );
    assert.equal(
      res2.acknowledgments[0].serverUtangSnapshot?.needsReconciliation,
      true
    );
  });

  it("5. Rejects unauthorized Helper operations, revoked devices, and rolls back failed server transactions atomically", () => {
    const nowIso = new Date().toISOString();

    // 5a. Revoked device rejection (403 DEVICE_REVOKED)
    assert.throws(
      () =>
        engine.processSyncBatch({
          storeId: DEFAULT_STORE_ID,
          deviceId: REVOKED_DEVICE_ID,
          events: [],
        }),
      (err: Error & { statusCode?: number; code?: string }) =>
        err.statusCode === 403 && err.code === "DEVICE_REVOKED"
    );

    // 5b. Helper attempting to modify product catalog (403 FORBIDDEN_ROLE_OPERATION)
    assert.throws(
      () =>
        engine.processSyncBatch({
          storeId: DEFAULT_STORE_ID,
          deviceId: DEFAULT_DEVICE_ID,
          events: [
            {
              eventId: generateUuid(),
              storeId: DEFAULT_STORE_ID,
              deviceId: DEFAULT_DEVICE_ID,
              userId: DEFAULT_HELPER_ID,
              eventType: "PRODUCT_UPSERTED",
              entityId: SEED_PRODUCT_IDS.PANCIT_CANTON,
              schemaVersion: 1,
              createdAt: nowIso,
              payload: {
                id: SEED_PRODUCT_IDS.PANCIT_CANTON,
                name: "Tampered Price",
              },
            },
          ],
        }),
      (err: Error & { statusCode?: number; code?: string }) =>
        err.statusCode === 403 && err.code === "FORBIDDEN_ROLE_OPERATION"
    );

    // 5c. Atomic rollback when a second event in a batch fails mid-transaction
    const initialStock =
      engine.getState().products.get(SEED_PRODUCT_IDS.SINANDOMENG_RICE)
        ?.cachedStock ?? 0;

    assert.throws(() =>
      engine.processSyncBatch({
        storeId: DEFAULT_STORE_ID,
        deviceId: DEFAULT_DEVICE_ID,
        events: [
          // Valid first event: stock addition of +10 kg rice
          {
            eventId: generateUuid(),
            storeId: DEFAULT_STORE_ID,
            deviceId: DEFAULT_DEVICE_ID,
            userId: DEFAULT_OWNER_ID,
            eventType: "INVENTORY_MOVEMENT_RECORDED",
            entityId: generateUuid(),
            schemaVersion: 1,
            createdAt: nowIso,
            payload: {
              id: generateUuid(),
              storeId: DEFAULT_STORE_ID,
              productId: SEED_PRODUCT_IDS.SINANDOMENG_RICE,
              productNameSnapshot: "Sinandomeng Special Rice (Per Kilo)",
              movementType: "STOCK_ADDITION",
              quantityChange: 10,
              unitCostCentavos: 4700,
              reasonOrNotes: "Valid first event in batch",
              deviceId: DEFAULT_DEVICE_ID,
              userId: DEFAULT_OWNER_ID,
              userNameSnapshot: "Aling Nena (Store Owner)",
              syncStatus: "PENDING",
              createdAt: nowIso,
            },
          },
          // Invalid second event in same batch: references non-existent product UUID
          {
            eventId: generateUuid(),
            storeId: DEFAULT_STORE_ID,
            deviceId: DEFAULT_DEVICE_ID,
            userId: DEFAULT_OWNER_ID,
            eventType: "INVENTORY_MOVEMENT_RECORDED",
            entityId: generateUuid(),
            schemaVersion: 1,
            createdAt: nowIso,
            payload: {
              id: generateUuid(),
              storeId: DEFAULT_STORE_ID,
              productId: generateUuid(), // Non-existent product
              productNameSnapshot: "Ghost Product",
              movementType: "STOCK_ADDITION",
              quantityChange: 5,
              unitCostCentavos: 1000,
              reasonOrNotes: "Invalid second event",
              deviceId: DEFAULT_DEVICE_ID,
              userId: DEFAULT_OWNER_ID,
              userNameSnapshot: "Aling Nena (Store Owner)",
              syncStatus: "PENDING",
              createdAt: nowIso,
            },
          },
        ],
      })
    );

    // Verify first event was completely rolled back!
    assert.equal(
      engine.getState().products.get(SEED_PRODUCT_IDS.SINANDOMENG_RICE)
        ?.cachedStock,
      initialStock
    );
  });

  it("6. Validates scrypt password/PIN hashing and RFC 4122 UUID syncEventSchema", () => {
    const hash = hashPasswordOrPin("123456");
    assert.equal(verifyPasswordOrPin("123456", hash), true);
    assert.equal(verifyPasswordOrPin("999999", hash), false);

    // Invalid non-UUID eventId must be rejected by syncEventSchema
    const invalidSyncEvt = syncEventSchema.safeParse({
      eventId: "not-a-uuid",
      storeId: DEFAULT_STORE_ID,
      deviceId: DEFAULT_DEVICE_ID,
      userId: DEFAULT_OWNER_ID,
      eventType: "CATEGORY_UPSERTED",
      entityId: SEED_CATEGORY_IDS.NOODLES_CANNED,
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      payload: {},
    });
    assert.equal(invalidSyncEvt.success, false);
  });

  it("7. Supports Store Owner registration (email + username + password), Helper/User account creation, RBAC enforcement, and credential verification", () => {
    const regResult = engine.registerOwnerAndStore({
      storeId: DEFAULT_STORE_ID,
      storeName: "Tindahan ni Mang Jose",
      storeAddress: "Sampaloc, Manila",
      contactNumber: "0917-555-8888",
      ownerName: "Mang Jose (Owner)",
      email: "jose.owner@etinda.ph",
      username: "owner_jose",
      pinOrPassword: "888888",
      deviceId: DEFAULT_DEVICE_ID,
    });

    assert.equal(regResult.owner.role, "ADMIN");
    assert.equal(regResult.owner.email, "jose.owner@etinda.ph");
    assert.equal(regResult.store.name, "Tindahan ni Mang Jose");

    // Verify credentials for newly registered Owner by username AND by email
    const verifiedOwnerByUsername = engine.verifyUserCredentials(
      "owner_jose",
      "888888"
    );
    assert.ok(verifiedOwnerByUsername);
    assert.equal(verifiedOwnerByUsername?.id, regResult.owner.id);

    const verifiedOwnerByEmail = engine.verifyUserCredentials(
      "jose.owner@etinda.ph",
      "888888"
    );
    assert.ok(verifiedOwnerByEmail);
    assert.equal(verifiedOwnerByEmail?.id, regResult.owner.id);

    // Owner creates a Helper account with email, username, and password
    const createdHelper = engine.createStoreUser({
      storeId: DEFAULT_STORE_ID,
      actorUserId: regResult.owner.id,
      deviceId: DEFAULT_DEVICE_ID,
      name: "Kuya Ben (Cashier)",
      email: "ben.helper@etinda.ph",
      username: "helper_ben",
      role: "HELPER",
      pinOrPassword: "5555",
    });

    assert.equal(createdHelper.role, "HELPER");
    assert.equal(createdHelper.email, "ben.helper@etinda.ph");
    assert.equal(createdHelper.username, "helper_ben");

    // Verify Helper can sign in via email or username
    assert.equal(
      engine.verifyUserCredentials("ben.helper@etinda.ph", "5555")?.id,
      createdHelper.id
    );

    // Duplicate email is rejected
    assert.throws(
      () =>
        engine.createStoreUser({
          storeId: DEFAULT_STORE_ID,
          actorUserId: regResult.owner.id,
          deviceId: DEFAULT_DEVICE_ID,
          name: "Duplicate Email User",
          email: "ben.helper@etinda.ph",
          username: "unique_username_99",
          role: "HELPER",
          pinOrPassword: "5555",
        }),
      /Email 'ben\.helper@etinda\.ph' is already registered/
    );

    // Helper cannot create another user (RBAC FORBIDDEN_ROLE_OPERATION)
    assert.throws(
      () =>
        engine.createStoreUser({
          storeId: DEFAULT_STORE_ID,
          actorUserId: createdHelper.id,
          deviceId: DEFAULT_DEVICE_ID,
          name: "Unauthorized User",
          email: "unauth@etinda.ph",
          username: "unauth_user",
          role: "HELPER",
          pinOrPassword: "5555",
        }),
      /Only the Store Owner/
    );

    // Deactivating Helper blocks credential login
    const deactivatedUser = engine.setUserActiveStatus({
      actorUserId: regResult.owner.id,
      targetUserId: createdHelper.id,
      isActive: false,
      deviceId: DEFAULT_DEVICE_ID,
    });
    assert.equal(deactivatedUser.isActive, false);

    const deactivatedLogin = engine.verifyUserCredentials(
      "helper_ben",
      "5555"
    );
    assert.equal(deactivatedLogin, null);
  });

  it("8. Starts clean production state with zero pre-seeded accounts/products and syncs Owner catalog & POS sales across serverless cold starts", () => {
    const cleanEngine = new StoreLedgerEngine(createCleanProductionServerState());
    assert.equal(cleanEngine.getState().users.size, 0);
    assert.equal(cleanEngine.getState().products.size, 0);
    assert.equal(cleanEngine.getState().sales.size, 0);
    assert.equal(cleanEngine.getState().customers.size, 0);

    const ownerId = generateUuid();
    const productId = generateUuid();
    const saleId = generateUuid();
    const nowIso = new Date().toISOString();

    const batchResult = cleanEngine.processSyncBatch({
      storeId: DEFAULT_STORE_ID,
      deviceId: DEFAULT_DEVICE_ID,
      storeName: "Rosa's Tindahan",
      deviceName: "Counter Tablet",
      actorUser: {
        id: ownerId,
        name: "Nanay Rosa",
        email: "rosa@etinda.ph",
        username: "rosa_owner",
        role: "ADMIN",
      },
      events: [
        {
          eventId: generateUuid(),
          storeId: DEFAULT_STORE_ID,
          deviceId: DEFAULT_DEVICE_ID,
          userId: ownerId,
          eventType: "PRODUCT_UPSERTED",
          entityId: productId,
          schemaVersion: 1,
          createdAt: nowIso,
          payload: {
            id: productId,
            storeId: DEFAULT_STORE_ID,
            categoryId: SEED_CATEGORY_IDS.NOODLES_CANNED,
            name: "Century Tuna Flakes in Oil 155g",
            baseUnit: "can",
            sellingPriceCentavos: 3800,
            latestCostCentavos: 3150,
            lowStockThreshold: 6,
            allowDecimalQuantity: false,
            isFrequent: true,
            isActive: true,
            cachedStock: 20,
            syncStatus: "PENDING",
            createdAt: nowIso,
            updatedAt: nowIso,
          },
        },
        {
          eventId: generateUuid(),
          storeId: DEFAULT_STORE_ID,
          deviceId: DEFAULT_DEVICE_ID,
          userId: ownerId,
          eventType: "SALE_CREATED",
          entityId: saleId,
          schemaVersion: 1,
          createdAt: nowIso,
          payload: {
            sale: {
              id: saleId,
              storeId: DEFAULT_STORE_ID,
              receiptNumber: "OR-3000-20261104-1001",
              status: "COMPLETED",
              paymentMethod: "CASH",
              subtotalCentavos: 7600,
              totalCentavos: 7600,
              cashTenderedCentavos: 10000,
              changeGivenCentavos: 2400,
              utangChargedCentavos: 0,
              deviceId: DEFAULT_DEVICE_ID,
              userId: ownerId,
              userNameSnapshot: "Nanay Rosa",
              syncStatus: "PENDING",
              createdAt: nowIso,
            },
            items: [
              {
                id: generateUuid(),
                saleId,
                storeId: DEFAULT_STORE_ID,
                productId,
                productNameSnapshot: "Century Tuna Flakes in Oil 155g",
                unitLabelSnapshot: "can",
                quantity: 2,
                baseUnitMultiplier: 1,
                unitSellingPriceCentavos: 3800,
                unitCostSnapshotCentavos: 3150,
                subtotalCentavos: 7600,
              },
            ],
            inventoryMovements: [
              {
                id: generateUuid(),
                storeId: DEFAULT_STORE_ID,
                productId,
                productNameSnapshot: "Century Tuna Flakes in Oil 155g",
                movementType: "SALE_DEDUCTION",
                quantityChange: -2,
                unitCostCentavos: 3150,
                reasonOrNotes: "Sale OR-3000-20261104-1001",
                deviceId: DEFAULT_DEVICE_ID,
                userId: ownerId,
                userNameSnapshot: "Nanay Rosa",
                referenceId: saleId,
                syncStatus: "PENDING",
                createdAt: nowIso,
              },
            ],
            payments: [],
          },
        },
      ],
    });

    assert.equal(batchResult.acknowledgments.length, 2);
    assert.equal(batchResult.acknowledgments[0].status, "ACKNOWLEDGED");
    assert.equal(batchResult.acknowledgments[1].status, "ACKNOWLEDGED");
    assert.equal(
      cleanEngine.getState().products.get(productId)?.cachedStock,
      18
    );
  });
});
