import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Resolves the PostgreSQL connection string across Vercel Prisma Postgres
 * Free Tier environment variables (`DATABASE_URL`, `PRISMA_DATABASE_URL`,
 * `POSTGRES_PRISMA_URL`, or `POSTGRES_URL`).
 */
export function resolveVercelPrismaDatabaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.PRISMA_DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL
  );
}

/**
 * Determines whether server endpoints should persist transactions to Prisma PostgreSQL.
 * Enabled when `ETINDA_USE_PRISMA_DB="true"` or automatically on Vercel when a
 * Vercel Prisma Postgres connection string is present.
 */
export function isPrismaDatabaseConfigured(): boolean {
  if (process.env.ETINDA_USE_PRISMA_DB === "false") {
    return false;
  }
  const url = resolveVercelPrismaDatabaseUrl();
  if (!url) {
    return false;
  }
  if (process.env.ETINDA_USE_PRISMA_DB === "true") {
    return true;
  }
  return Boolean(process.env.VERCEL);
}

const resolvedUrl = resolveVercelPrismaDatabaseUrl();

/**
 * Singleton PrismaClient instance for eTinda PostgreSQL persistence on
 * Vercel Free Tier + Vercel Prisma Postgres Free Tier.
 * Reuses the client across Next.js hot reloads in development.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(resolvedUrl ? { datasources: { db: { url: resolvedUrl } } } : {}),
    log:
      process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}


