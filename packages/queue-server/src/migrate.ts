import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

const { Client } = pg;

function loadEnvIfMissing() {
  if (process.env.DATABASE_URL) return;

  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env.local"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(process.cwd(), "../../apps/workers/.env.local"),
    path.resolve(process.cwd(), "../../apps/workers/.env"),
    path.resolve(process.cwd(), "../workers/.env.local"),
    path.resolve(process.cwd(), "../workers/.env"),
    path.resolve(process.cwd(), "apps/workers/.env.local"),
    path.resolve(process.cwd(), "apps/workers/.env"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
      if (process.env.DATABASE_URL) break;
    }
  }
}

/**
 * Pre-deploy database migration runner for BullMQ PostgreSQL backend.
 * Ensures the dedicated "bullmq" schema is created and verified
 * before application workers boot.
 */
export async function migrateBullMqSchema(): Promise<void> {
  loadEnvIfMissing();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "[BullMQ Migration] DATABASE_URL environment variable is required to run migrations.",
    );
  }

  const isProd = process.env.NODE_ENV === "production";
  const client = new Client({
    connectionString: databaseUrl,
    ssl: isProd ? { rejectUnauthorized: true } : undefined,
  });

  try {
    await client.connect();
    console.log(
      "[BullMQ Migration] Connected to PostgreSQL. Ensuring 'bullmq' schema exists...",
    );

    await client.query("CREATE SCHEMA IF NOT EXISTS bullmq;");

    // Verify schema accessibility
    const result = await client.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'bullmq';",
    );

    if (result.rows.length === 0) {
      throw new Error(
        "[BullMQ Migration] Failed to verify 'bullmq' schema existence.",
      );
    }

    console.log("[BullMQ Migration] 'bullmq' schema successfully verified.");
  } finally {
    await client.end();
  }
}

// Allow direct execution via `pnpm tsx src/migrate.ts`
if (
  process.argv[1]?.endsWith("migrate.ts") ||
  process.argv[1]?.endsWith("migrate.js")
) {
  migrateBullMqSchema()
    .then(() => {
      console.log(
        "[BullMQ Migration] Pre-deploy migration completed successfully.",
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error(
        "[BullMQ Migration] Fatal error running schema migration:",
        err,
      );
      process.exit(1);
    });
}
