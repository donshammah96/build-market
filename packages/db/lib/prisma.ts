import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Use the pooled DATABASE_URL at runtime.
// DIRECT_URL is consumed only by `prisma migrate deploy` — never at runtime.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "[db] DATABASE_URL is not set. " +
      "Set it to the Supabase Supavisor session-mode pooler URL.",
  );
}

const pool = new Pool({
  connectionString,
  // Serverless: one connection per invocation is optimal.
  // Supabase Supavisor manages the actual Postgres connection pool.
  max: 1,
});
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
