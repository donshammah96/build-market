import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import dotenv from "dotenv";
import pg from "pg";

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

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
 * Checks whether any queue is configured to use the PostgreSQL backend.
 */
export function isPostgresQueueConfigured(): boolean {
  loadEnvIfMissing();
  if (
    process.env.QUEUE_BACKEND?.trim()?.toLowerCase()?.startsWith("postgres")
  ) {
    return true;
  }
  return Object.keys(process.env).some(
    (key) =>
      key.startsWith("QUEUE_BACKEND_") &&
      process.env[key]?.trim()?.toLowerCase()?.startsWith("postgres"),
  );
}

/**
 * Pre-deploy database migration runner for BullMQ PostgreSQL backend.
 * Ensures the dedicated "bullmq" schema is created and verified.
 * Gracefully no-ops if no queues are currently configured for postgres.
 */
export async function migrateBullMqSchema(): Promise<void> {
  loadEnvIfMissing();

  if (!isPostgresQueueConfigured()) {
    console.log(
      "[BullMQ Migration] No queues currently configured for PostgreSQL backend. Skipping schema migration.",
    );
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "[BullMQ Migration] DATABASE_URL environment variable is required when PostgreSQL queue backend is active.",
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
