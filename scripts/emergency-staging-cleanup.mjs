#!/usr/bin/env node
/**
 * Emergency Staging Cleanup Script
 * ============================================================================
 * Guaranteed fallback invoked in CI (`if: always()`) or disaster recovery to sweep
 * stranded/expired staging test runs and prevent fixture leakage.
 */

import fs from "node:fs";
import path from "node:path";

// Attempt to load local environment files if running locally outside CI
for (const envFile of [
  ".env.local",
  "apps/client/.env.local",
  ".env",
  "apps/client/.env",
]) {
  const resolved = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(resolved)) {
    try {
      process.loadEnvFile?.(resolved);
    } catch {
      // Ignore syntax or permission errors when reading optional env files
    }
  }
}

const databaseUrl = process.env.DATABASE_URL;
const baseUrl = process.env.STAGING_E2E_BASE_URL;
const internalSecret = (
  process.env.INTERNAL_API_SECRET ||
  process.env.INTERNAL_SERVICE_SECRET ||
  ""
).trim();
const testSecret = (process.env.TEST_CONTROL_SECRET || "").trim();
const stagingAuthSecret = (process.env.STAGING_AUTH_SECRET || "").trim();
const stagingAuthUser = (process.env.STAGING_AUTH_USER || "").trim();
const stagingAuthPassword = (process.env.STAGING_AUTH_PASSWORD || "").trim();

// Never log the raw connection string (it carries credentials) — just the
// host, so a divergence between "what the CI runner connects to" and "what
// the deployed app connects to" is visible at a glance in the logs.
function redactedDbHost(rawUrl) {
  if (!rawUrl) return "(unset)";
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return "(unparseable)";
  }
}

function getApiHeaders(additional = {}) {
  const headers = {
    "Content-Type": "application/json",
    "x-internal-secret": internalSecret,
    ...(testSecret ? { "x-test-control-secret": testSecret } : {}),
    ...(stagingAuthSecret ? { "x-staging-secret": stagingAuthSecret } : {}),
    ...additional,
  };

  if (!stagingAuthSecret && stagingAuthUser && stagingAuthPassword) {
    const basic = Buffer.from(
      `${stagingAuthUser}:${stagingAuthPassword}`,
    ).toString("base64");
    headers["Authorization"] = `Basic ${basic}`;
  }

  return headers;
}

async function performApiCleanup() {
  if (!baseUrl || !internalSecret) {
    console.log(
      "[emergency-cleanup] No STAGING_E2E_BASE_URL or INTERNAL_SERVICE_SECRET provided. Skipping API sweep.",
    );
    return false;
  }

  try {
    console.log(
      `[emergency-cleanup] Probing ${baseUrl}/api/internal/test-control...`,
    );
    const res = await fetch(`${baseUrl}/api/internal/test-control`, {
      method: "POST",
      headers: getApiHeaders(),
      body: JSON.stringify({
        action: "create-run",
        scenario: "onboarding",
        actorLabel: "emergency-probe",
      }),
    });

    if (res.ok) {
      const { runId, grantToken } = await res.json();
      console.log(
        `[emergency-cleanup] Probe successful; immediately cleaning up probe run ${runId}`,
      );
      await fetch(`${baseUrl}/api/internal/test-control`, {
        method: "POST",
        headers: getApiHeaders({ "x-test-control-grant": grantToken }),
        body: JSON.stringify({ action: "cleanup-run", runId }),
      });
    } else {
      const probeBodyText = await res.text();
      console.warn(
        `[emergency-cleanup] Probe failed with status ${res.status}:`,
        probeBodyText,
      );
      if (probeBodyText.includes("STAGING_DATABASE_MISCONFIGURED")) {
        console.warn(
          "[emergency-cleanup] The deployed app itself cannot reach its database " +
            "(this is a Vercel env-var scoping problem, not something this script " +
            "or the CI runner's own DB access can fix). See STAGING_DB_LOCALHOST_AUTOPSY.md.",
        );
      }
    }
    return true;
  } catch (err) {
    console.warn("[emergency-cleanup] API sweep failed:", err.message);
    return false;
  }
}

async function performDatabaseSweep() {
  if (!databaseUrl) {
    console.log(
      "[emergency-cleanup] No DATABASE_URL provided. Skipping direct DB sweep.",
    );
    return;
  }

  console.log(
    `[emergency-cleanup] Runner-side DATABASE_URL host: ${redactedDbHost(databaseUrl)}`,
  );

  let Pool;
  try {
    const pgModule = await import("pg");
    Pool = pgModule.Pool || pgModule.default?.Pool;
    if (!Pool) {
      throw new Error("Pool constructor not found on 'pg' module");
    }
  } catch (err) {
    console.warn(
      "[emergency-cleanup] 'pg' package not available; skipping direct DB sweep:",
      err.message,
    );
    return;
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    connectionTimeoutMillis: 5000,
  });

  let errorCount = 0;
  let sweptCount = 0;

  try {
    console.log(
      "[emergency-cleanup] Sweeping expired or stranded staging test runs directly from DB...",
    );
    const client = await pool.connect();
    try {
      // 7b: Table existence preflight check to detect Prisma @@map drift
      const TABLES = [
        "MessageThread",
        "MarketplaceLead",
        "staging_test_outbound_deliveries",
        "MpesaCallbackEvent",
        "MpesaTransaction",
        "Review",
        "Lead",
        "Project",
        "ProfessionalProfile",
        "users",
        "staging_test_identity_leases",
        "staging_test_runs",
      ];
      const check = await client.query(
        `SELECT t AS name, to_regclass(format('%I', t)) AS oid FROM unnest($1::text[]) AS t`,
        [TABLES],
      );
      const missing = check.rows.filter((r) => !r.oid).map((r) => r.name);
      if (missing.length) {
        throw new Error(
          `[emergency-cleanup] Unknown tables (Prisma @@map drift?): ${missing.join(", ")}`,
        );
      }

      // 7a: Find expired or stranded runs older than 1 minute (never touch active runs).
      // When running in GitHub Actions, scope strictly to this workflow run to avoid touching concurrent jobs.
      const workflowRunId = process.env.GITHUB_RUN_ID?.trim();
      let selectQuery = `
        SELECT "id" FROM "staging_test_runs"
        WHERE "state" IN ('ACTIVE', 'CLEANING')
          AND "expiresAt" < NOW() - INTERVAL '1 minute'
      `;
      const selectParams = [];
      if (workflowRunId) {
        selectParams.push(workflowRunId);
        selectQuery += ` AND "workflowRunId" = $${selectParams.length}`;
      }

      const selectRes = await client.query(selectQuery, selectParams);

      // 7c: Per-run transaction with try/COMMIT/catch/ROLLBACK
      for (const row of selectRes.rows) {
        const runId = row.id;
        console.log(`[emergency-cleanup] Cleaning stranded run: ${runId}`);

        try {
          await client.query("BEGIN");

          await client.query(
            'DELETE FROM "MessageThread" WHERE "stagingTestRunId" = $1',
            [runId],
          );
          await client.query(
            'DELETE FROM "MarketplaceLead" WHERE "stagingTestRunId" = $1',
            [runId],
          );
          await client.query(
            'DELETE FROM "staging_test_outbound_deliveries" WHERE "stagingTestRunId" = $1',
            [runId],
          );
          await client.query(
            'DELETE FROM "MpesaCallbackEvent" WHERE "stagingTestRunId" = $1',
            [runId],
          );
          await client.query(
            'DELETE FROM "MpesaTransaction" WHERE "stagingTestRunId" = $1',
            [runId],
          );
          // Derived review deletion (C-3) before projects are deleted
          await client.query(
            `DELETE FROM "Review"
             WHERE "stagingTestRunId" = $1
                OR "projectId" IN (SELECT "id" FROM "Project" WHERE "stagingTestRunId" = $1)`,
            [runId],
          );
          await client.query('DELETE FROM "Lead" WHERE "stagingTestRunId" = $1', [
            runId,
          ]);
          await client.query(
            'DELETE FROM "Project" WHERE "stagingTestRunId" = $1',
            [runId],
          );
          await client.query(
            'DELETE FROM "ProfessionalProfile" WHERE "stagingTestRunId" = $1',
            [runId],
          );
          // Protect immutable identity pool users (C-5)
          await client.query(
            `DELETE FROM "users"
             WHERE "stagingTestRunId" = $1
               AND "email" NOT IN (
                 'e2e_pro_1@staging.buildmarket.app',
                 'e2e_pro_2@staging.buildmarket.app',
                 'e2e_client_1@staging.buildmarket.app',
                 'e2e_client_2@staging.buildmarket.app'
               )`,
            [runId],
          );
          await client.query(
            'UPDATE "staging_test_identity_leases" SET "state" = \'RELEASED\', "releasedAt" = NOW() WHERE "stagingTestRunId" = $1 AND "state" IN (\'LEASED\', \'RESETTING\', \'READY\', \'BORROWED\')',
            [runId],
          );
          await client.query(
            'UPDATE "staging_test_runs" SET "state" = \'CLEANED\', "cleanedAt" = NOW() WHERE "id" = $1',
            [runId],
          );
          await client.query("COMMIT");
          sweptCount++;
        } catch (runErr) {
          await client.query("ROLLBACK").catch(() => {});
          console.error(
            `[emergency-cleanup] Failed to clean run ${runId}:`,
            runErr.message,
          );
          errorCount++;
        }
      }

      console.log(
        `[emergency-cleanup] Summary: Swept ${sweptCount} stranded run(s), ${errorCount} failed.`,
      );

      const expiredLeases = await client.query(`
        UPDATE "staging_test_identity_leases"
        SET "state" = 'RELEASED', "releasedAt" = NOW()
        WHERE "state" IN ('LEASED', 'RESETTING', 'READY', 'BORROWED')
          AND "leaseExpiresAt" < NOW()
      `);
      if (expiredLeases.rowCount > 0) {
        console.log(
          `[emergency-cleanup] Released ${expiredLeases.rowCount} expired identity lease(s).`,
        );
      }
    } finally {
      client.release();
    }
  } catch (e) {
    console.error(
      "[emergency-cleanup] Direct DB sweep encountered an error:",
      e.message,
    );
    errorCount++;
  } finally {
    await pool.end();
  }

  // 7d: Emit GitHub Actions warning annotation so cleanup failure is visible without breaking CI
  if (errorCount > 0) {
    console.log(
      `::warning title=Staging cleanup incomplete::${errorCount} error(s) occurred during emergency sweep`,
    );
  }
}

async function main() {
  console.log(
    "[emergency-cleanup] Starting staging test run cleanup verification...",
  );
  await performApiCleanup();
  await performDatabaseSweep();
  console.log("[emergency-cleanup] Completed.");
}

main().catch((err) => {
  console.error("[emergency-cleanup] Fatal error:", err);
  process.exit(0); // Exit 0 so always() step does not mask underlying failure
});
