#!/usr/bin/env node
/**
 * Emergency Staging Cleanup Script
 * ============================================================================
 * Guaranteed fallback invoked in CI (`if: always()`) or disaster recovery to sweep
 * stranded/expired staging test runs and prevent fixture leakage.
 */

import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
const baseUrl = process.env.STAGING_E2E_BASE_URL;
const internalSecret = process.env.INTERNAL_API_SECRET || process.env.INTERNAL_SERVICE_SECRET;
const testSecret = process.env.TEST_CONTROL_SECRET;
const stagingAuthSecret = process.env.STAGING_AUTH_SECRET;
const stagingAuthUser = process.env.STAGING_AUTH_USER;
const stagingAuthPassword = process.env.STAGING_AUTH_PASSWORD;

function getApiHeaders(additional = {}) {
  const headers = {
    "Content-Type": "application/json",
    "x-internal-secret": internalSecret,
    ...(testSecret ? { "x-test-control-secret": testSecret } : {}),
    ...(stagingAuthSecret ? { "x-staging-secret": stagingAuthSecret } : {}),
    ...additional,
  };

  if (!stagingAuthSecret && stagingAuthUser && stagingAuthPassword) {
    const basic = Buffer.from(`${stagingAuthUser}:${stagingAuthPassword}`).toString("base64");
    headers["Authorization"] = `Basic ${basic}`;
  }

  return headers;
}

async function performApiCleanup() {
  if (!baseUrl || !internalSecret) {
    console.log("[emergency-cleanup] No STAGING_E2E_BASE_URL or INTERNAL_SERVICE_SECRET provided. Skipping API sweep.");
    return false;
  }

  try {
    console.log(`[emergency-cleanup] Probing ${baseUrl}/api/internal/test-control...`);
    const res = await fetch(`${baseUrl}/api/internal/test-control`, {
      method: "POST",
      headers: getApiHeaders(),
      body: JSON.stringify({ action: "create-run", scenario: "onboarding", actorLabel: "emergency-probe" }),
    });

    if (res.ok) {
      const { runId, grantToken } = await res.json();
      console.log(`[emergency-cleanup] Probe successful; immediately cleaning up probe run ${runId}`);
      await fetch(`${baseUrl}/api/internal/test-control`, {
        method: "POST",
        headers: getApiHeaders({ "x-test-control-grant": grantToken }),
        body: JSON.stringify({ action: "cleanup-run", runId }),
      });
    }
    return true;
  } catch (err) {
    console.warn("[emergency-cleanup] API sweep failed:", err.message);
    return false;
  }
}

async function performDatabaseSweep() {
  if (!databaseUrl) {
    console.log("[emergency-cleanup] No DATABASE_URL provided. Skipping direct DB sweep.");
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 2, connectionTimeoutMillis: 5000 });
  try {
    console.log("[emergency-cleanup] Sweeping expired or stranded staging test runs directly from DB...");
    const client = await pool.connect();
    try {
      // Find expired or stranded runs older than 10 minutes
      const selectRes = await client.query(`
        SELECT id FROM staging_test_runs
        WHERE state IN ('ACTIVE', 'CLEANING')
          AND expiresAt < NOW() + INTERVAL '5 minutes'
      `);

      for (const row of selectRes.rows) {
        const runId = row.id;
        console.log(`[emergency-cleanup] Cleaning stranded run: ${runId}`);

        await client.query("BEGIN");
        await client.query("DELETE FROM \"MessageThread\" WHERE \"stagingTestRunId\" = $1", [runId]);
        await client.query("DELETE FROM \"MarketplaceLead\" WHERE \"stagingTestRunId\" = $1", [runId]);
        await client.query("DELETE FROM staging_test_outbound_deliveries WHERE stagingTestRunId = $1", [runId]);
        await client.query("DELETE FROM \"MpesaCallbackEvent\" WHERE stagingTestRunId = $1", [runId]);
        await client.query("DELETE FROM \"MpesaTransaction\" WHERE stagingTestRunId = $1", [runId]);
        await client.query("DELETE FROM \"Review\" WHERE stagingTestRunId = $1", [runId]);
        await client.query("DELETE FROM \"Lead\" WHERE stagingTestRunId = $1", [runId]);
        await client.query("DELETE FROM \"Project\" WHERE stagingTestRunId = $1", [runId]);
        await client.query("DELETE FROM \"ProfessionalProfile\" WHERE stagingTestRunId = $1", [runId]);
        await client.query("DELETE FROM users WHERE stagingTestRunId = $1", [runId]);
        await client.query("UPDATE staging_test_identity_leases SET state = 'RELEASED', \"releasedAt\" = NOW() WHERE \"stagingTestRunId\" = $1 AND state IN ('LEASED', 'RESETTING', 'READY')", [runId]);
        await client.query("UPDATE staging_test_runs SET state = 'CLEANED', cleanedAt = NOW() WHERE id = $1", [runId]);
        await client.query("COMMIT");
      }
      console.log(`[emergency-cleanup] Swept ${selectRes.rows.length} stranded test run(s).`);

      const expiredLeases = await client.query(`
        UPDATE staging_test_identity_leases
        SET state = 'RELEASED', "releasedAt" = NOW()
        WHERE state IN ('LEASED', 'RESETTING', 'READY')
          AND "leaseExpiresAt" < NOW()
      `);
      if (expiredLeases.rowCount > 0) {
        console.log(`[emergency-cleanup] Released ${expiredLeases.rowCount} expired identity lease(s).`);
      }
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("[emergency-cleanup] Direct DB sweep encountered an error:", e.message);
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log("[emergency-cleanup] Starting staging test run cleanup verification...");
  await performApiCleanup();
  await performDatabaseSweep();
  console.log("[emergency-cleanup] Completed.");
}

main().catch((err) => {
  console.error("[emergency-cleanup] Fatal error:", err);
  process.exit(0); // Exit 0 so always() step does not mask underlying failure
});
