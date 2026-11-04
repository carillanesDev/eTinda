import { PrismaClient } from "@prisma/client";
import { buildInitialSeedDataset } from "../src/lib/db/seed-local.ts";
import { hashPasswordOrPin } from "../src/lib/auth/password.ts";

const prisma = new PrismaClient();

export async function seedPostgreSqlDatabase(): Promise<void> {
  const dataset = buildInitialSeedDataset();
  const seedDemoData = process.env.ETINDA_SEED_DEMO_DATA === "true";

  await prisma.$transaction(async (tx) => {
    const store = dataset.store;
    await tx.store.upsert({
      where: { id: store.id },
      update: {},
      create: {
        id: store.id,
        name: seedDemoData ? store.name : "My Sari-Sari Store",
        address: seedDemoData ? store.address : "",
        contactNumber: seedDemoData ? store.contactNumber : "",
        createdAt: new Date(store.createdAt),
      },
    });

    for (const category of dataset.categories) {
      await tx.category.upsert({
        where: { id: category.id },
        update: {
          name: category.name,
          sortOrder: category.sortOrder,
          isActive: category.isActive,
        },
        create: {
          id: category.id,
          storeId: category.storeId,
          name: category.name,
          sortOrder: category.sortOrder,
          isActive: category.isActive,
          updatedAt: new Date(category.updatedAt),
        },
      });
    }

    if (!seedDemoData) {
      return;
    }

    for (const user of dataset.users) {
      const defaultSecret = user.role === "ADMIN" ? "123456" : "0000";
      const passwordHash = hashPasswordOrPin(defaultSecret, "etinda-seed-salt");
      await tx.user.upsert({
        where: { id: user.id },
        update: {
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          passwordHash,
        },
        create: {
          id: user.id,
          storeId: user.storeId,
          name: user.name,
          email: user.email,
          username: user.username,
          passwordHash,
          role: user.role,
          isActive: user.isActive,
          createdAt: new Date(user.createdAt),
        },
      });
    }

    for (const device of dataset.devices) {
      await tx.device.upsert({
        where: { id: device.id },
        update: {
          deviceName: device.deviceName,
          deviceType: device.deviceType,
          isAuthorized: device.isAuthorized,
          revokedAt: device.revokedAt ? new Date(device.revokedAt) : null,
        },
        create: {
          id: device.id,
          storeId: device.storeId,
          deviceName: device.deviceName,
          deviceType: device.deviceType,
          registeredByUserId: device.registeredByUserId,
          isAuthorized: device.isAuthorized,
          lastSyncAt: device.lastSyncAt ? new Date(device.lastSyncAt) : null,
          revokedAt: device.revokedAt ? new Date(device.revokedAt) : null,
          createdAt: new Date(device.createdAt),
        },
      });
    }

    for (const category of dataset.categories) {
      await tx.category.upsert({
        where: { id: category.id },
        update: {
          name: category.name,
          sortOrder: category.sortOrder,
          isActive: category.isActive,
        },
        create: {
          id: category.id,
          storeId: category.storeId,
          name: category.name,
          sortOrder: category.sortOrder,
          isActive: category.isActive,
          updatedAt: new Date(category.updatedAt),
        },
      });
    }

    for (const product of dataset.products) {
      await tx.product.upsert({
        where: { id: product.id },
        update: {
          name: product.name,
          sellingPriceCentavos: product.sellingPriceCentavos,
          latestCostCentavos: product.latestCostCentavos,
          cachedStock: product.cachedStock,
        },
        create: {
          id: product.id,
          storeId: product.storeId,
          categoryId: product.categoryId,
          name: product.name,
          baseUnit: product.baseUnit,
          sellingPriceCentavos: product.sellingPriceCentavos,
          latestCostCentavos: product.latestCostCentavos,
          lowStockThreshold: product.lowStockThreshold,
          allowDecimalQuantity: product.allowDecimalQuantity,
          isFrequent: product.isFrequent,
          isActive: product.isActive,
          cachedStock: product.cachedStock,
          hasOversellConflict: Boolean(product.hasOversellConflict),
          createdAt: new Date(product.createdAt),
          updatedAt: new Date(product.updatedAt),
        },
      });
    }

    for (const variant of dataset.variants) {
      await tx.productVariant.upsert({
        where: { id: variant.id },
        update: {
          name: variant.name,
          sellingPriceCentavos: variant.sellingPriceCentavos,
        },
        create: {
          id: variant.id,
          storeId: variant.storeId,
          productId: variant.productId,
          name: variant.name,
          unitLabel: variant.unitLabel,
          conversionMultiplier: variant.conversionMultiplier,
          sellingPriceCentavos: variant.sellingPriceCentavos,
          barcodeOrSku: variant.barcodeOrSku ?? null,
          allowDecimalQuantity: variant.allowDecimalQuantity,
          isActive: variant.isActive,
          updatedAt: new Date(variant.updatedAt),
        },
      });
    }

    for (const customer of dataset.customers) {
      await tx.customer.upsert({
        where: { id: customer.id },
        update: {
          name: customer.name,
          contactNumber: customer.contactNumber ?? null,
        },
        create: {
          id: customer.id,
          storeId: customer.storeId,
          name: customer.name,
          contactNumber: customer.contactNumber ?? null,
          createdAt: new Date(customer.createdAt),
          updatedAt: new Date(customer.updatedAt),
        },
      });
    }

    for (const account of dataset.utangAccounts) {
      await tx.utangAccount.upsert({
        where: { id: account.id },
        update: {
          cachedBalanceCentavos: account.cachedBalanceCentavos,
        },
        create: {
          id: account.id,
          storeId: account.storeId,
          customerId: account.customerId,
          customerNameSnapshot: account.customerNameSnapshot,
          contactNumberSnapshot: account.contactNumberSnapshot ?? null,
          cachedBalanceCentavos: account.cachedBalanceCentavos,
          needsReconciliation: account.needsReconciliation,
          updatedAt: new Date(account.updatedAt),
        },
      });
    }
  });
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seedPostgreSqlDatabase()
    .then(async () => {
      await prisma.$disconnect();
      console.log("Seeded eTinda PostgreSQL database successfully.");
    })
    .catch(async (error) => {
      console.error("Failed to seed eTinda PostgreSQL database:", error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
