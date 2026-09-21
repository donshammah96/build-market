#!/usr/bin/env node
/**
 * Staging Cleanup Verification Script (Gate 3)
 * ============================================================================
 * Asserts database invariant integrity following staging test execution:
 * 1. Zero ACTIVE or CLEANING staging test runs.
 * 2. Zero active (non-RELEASED) identity leases.
 * 3. Zero orphaned reviews attached to run-owned projects.
 * 4. Zero orphaned reviews tagged directly with stagingTestRunId.
 * 5. All configured identity pool users survive intact.
 */

import fs from "node:fs";
import path from "node:path";

// Load local environment files if running locally
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

if (!databaseUrl) {
  console.error("[verify-staging-cleanup] DATABASE_URL is not set. Exiting.");
  process.exit(1);
}

const POOL_EMAILS = [
  "e2e_pro_1@staging.buildmarket.app",
  "e2e_pro_2@staging.buildmarket.app",
  "e2e_client_1@staging.buildmarket.app",
  "e2e_client_2@staging.buildmarket.app",
];

async function main() {
  console.log("[verify-staging-cleanup] Connecting to database...");

  let Pool;
  try {
    const pgModule = await import("pg");
    Pool = pgModule.Pool || pgModule.default?.Pool;
    if (!Pool) throw new Error("Pool constructor not found on 'pg' module");
  } catch (err) {
    console.error("[verify-staging-cleanup] 'pg' package not available:", err.message);
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 5000,
  });

  const client = await pool.connect();
  const violations = [];

  try {
    // 1. Verify no ACTIVE or CLEANING staging test runs
    const activeRunsRes = await client.query(`
      SELECT count(*)::int AS count
      FROM "staging_test_runs"
      WHERE "state" IN ('ACTIVE', 'CLEANING')
    `);
    const activeRunsCount = activeRunsRes.rows[0].count;
    if (activeRunsCount > 0) {
      violations.push(`Active/cleaning test runs remain: ${activeRunsCount}`);
    } else {
      console.log("✓ Zero active or cleaning staging test runs");
    }

    // 2. Verify no active identity leases (must be RELEASED or FAILED)
    const activeLeasesRes = await client.query(`
      SELECT count(*)::int AS count
      FROM "staging_test_identity_leases"
      WHERE "state" NOT IN ('RELEASED', 'FAILED')
    `);
    const activeLeasesCount = activeLeasesRes.rows[0].count;
    if (activeLeasesCount > 0) {
      violations.push(`Active/unreleased identity leases remain: ${activeLeasesCount}`);
    } else {
      console.log("✓ Zero unreleased identity leases");
    }

    // 3. Verify zero derived reviews on test-owned projects
    const derivedReviewsRes = await client.query(`
      SELECT count(*)::int AS count
      FROM "Review" r
      JOIN "Project" p ON p.id = r."projectId"
      WHERE p."stagingTestRunId" IS NOT NULL
    `);
    const derivedReviewsCount = derivedReviewsRes.rows[0].count;
    if (derivedReviewsCount > 0) {
      violations.push(`Orphaned derived reviews on test-owned projects remain: ${derivedReviewsCount}`);
    } else {
      console.log("✓ Zero orphaned derived reviews on test-owned projects");
    }

    // 4. Verify zero direct stagingTestRunId reviews
    const directReviewsRes = await client.query(`
      SELECT count(*)::int AS count
      FROM "Review"
      WHERE "stagingTestRunId" IS NOT NULL
    `);
    const directReviewsCount = directReviewsRes.rows[0].count;
    if (directReviewsCount > 0) {
      violations.push(`Orphaned reviews with stagingTestRunId remain: ${directReviewsCount}`);
    } else {
      console.log("✓ Zero orphaned direct test-run reviews");
    }

    // 5. Verify all identity pool users exist
    const poolUsersRes = await client.query(`
      SELECT email
      FROM "users"
      WHERE email = ANY($1::text[])
    `, [POOL_EMAILS]);

    const survivingEmails = new Set(poolUsersRes.rows.map((r) => r.email.toLowerCase()));
    const missingPoolUsers = POOL_EMAILS.filter((e) => !survivingEmails.has(e.toLowerCase()));

    if (missingPoolUsers.length > 0) {
      violations.push(`Pool users missing from database: ${missingPoolUsers.join(", ")}`);
    } else {
      console.log(`✓ All ${POOL_EMAILS.length} pre-provisioned pool users survive in database`);
    }

    if (violations.length > 0) {
      console.error("\n❌ Staging cleanup verification FAILED with violations:");
      for (const violation of violations) {
        console.error(`  - ${violation}`);
      }
      process.exit(1);
    }

    console.log("\n✅ All Staging Cleanup Gate 3 invariants verified successfully.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[verify-staging-cleanup] Unhandled fatal error:", err);
  process.exit(1);
});
