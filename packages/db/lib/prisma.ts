import { Pool, PoolConfig } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";
export * from "../src/staging-test-runs/contracts.js";
export { resolveDatabaseUrl } from "./connection-url.js";
import { resolveDatabaseUrl } from "./connection-url.js";

interface GlobalDatabaseContext {
  prisma?: PrismaClient;
  pool?: Pool;
}

const globalForPrisma = globalThis as unknown as GlobalDatabaseContext;

function createDatabaseClient(): { prisma: PrismaClient; pool: Pool } {
  // Use the pooled DATABASE_URL at runtime (with resilient aliases and loopback guards).
  // DIRECT_URL is consumed only by `prisma migrate deploy` — never at runtime.
  const connectionString = resolveDatabaseUrl();

  // Serverless environments (Vercel / Lambda): 1 connection per invocation is optimal.
  // Persistent servers (apps/admin, BullMQ queue workers): pool size defaults to 10 or DB_POOL_MAX.
  const isServerless = Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
  );
  const maxConnections = isServerless
    ? 1
    : parseInt(process.env.DB_POOL_MAX || "10", 10);

  const poolConfig: PoolConfig = {
    connectionString,
    max: maxConnections,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };

  const pool = new Pool(poolConfig);
  const adapter = new PrismaPg(pool);

  const client = new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

  return { prisma: client, pool };
}

function getDatabaseClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const { prisma: client, pool } = createDatabaseClient();
  globalForPrisma.prisma = client;
  globalForPrisma.pool = pool;

  return client;
}

/**
 * Lazy Prisma client singleton proxy.
 * Prevents connection instantiation during module import or build-time evaluation,
 * and preserves connection pools across dev HMR reloads.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop: keyof PrismaClient) {
    const client = getDatabaseClient();
    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/**
 * Explicitly disconnect Prisma client and drain the underlying connection pool.
 */
export async function disconnectDatabase(): Promise<void> {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
    globalForPrisma.prisma = undefined;
  }
  if (globalForPrisma.pool) {
    await globalForPrisma.pool.end();
    globalForPrisma.pool = undefined;
  }
}
