#!/usr/bin/env node
/**
 * Preflight: Staging Deployment Database Reachability
 * ============================================================================
 * Runs BEFORE the Cypress suite. Makes a single create-run / cleanup-run round
 * trip against the deployed staging site (not the CI runner's own DB
 * connection — that's checked separately in emergency-staging-cleanup.mjs).
 *
 * Exists because: a broken deployment-side DATABASE_URL currently only shows
 * up as a "before each" hook failure, repeated identically across all 8
 * specs x up to 3 retries each, ~10s in, with the real signal buried in a
 * Cypress task stack trace. This script surfaces the same failure in under a
 * second, at the very top of the CI log, in plain language.
 *
 * Exit code IS meaningful here (unlike emergency-staging-cleanup.mjs) — a
 * non-zero exit should fail the job before Cypress even starts.
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

const cliUrlArg = process.argv
  .slice(2)
  .find((arg) => arg.startsWith("http://") || arg.startsWith("https://"));
const baseUrl = (
  cliUrlArg ||
  process.env.STAGING_E2E_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  ""
).trim();
const internalSecret = (
  process.env.INTERNAL_SERVICE_SECRET ||
  process.env.INTERNAL_API_SECRET ||
  ""
).trim();
const testSecret = (process.env.TEST_CONTROL_SECRET || "").trim();
const stagingAuthSecret = (process.env.STAGING_AUTH_SECRET || "").trim();
const stagingAuthUser = (process.env.STAGING_AUTH_USER || "").trim();
const stagingAuthPassword = (process.env.STAGING_AUTH_PASSWORD || "").trim();
const databaseUrl = (process.env.DATABASE_URL || "").trim();
const clerkSecretKey = (process.env.CLERK_SECRET_KEY || "").trim();

function fail(message) {
  console.error(`[preflight] FAIL: ${message}`);
  process.exitCode = 1;
}

function headers(extra = {}) {
  const result = {
    "Content-Type": "application/json",
    "x-internal-secret": internalSecret,
    ...(testSecret ? { "x-test-control-secret": testSecret } : {}),
    ...(stagingAuthSecret ? { "x-staging-secret": stagingAuthSecret } : {}),
    ...extra,
  };

  if (!stagingAuthSecret && stagingAuthUser && stagingAuthPassword) {
    const basic = Buffer.from(
      `${stagingAuthUser}:${stagingAuthPassword}`,
    ).toString("base64");
    result["Authorization"] = `Basic ${basic}`;
  }

  return result;
}

async function main() {
  if (!baseUrl) {
    fail(
      "STAGING_E2E_BASE_URL is not set — cannot reach the deployment at all. " +
        "Provide STAGING_E2E_BASE_URL in your environment or pass the URL as an argument, e.g.: " +
        "node scripts/preflight-staging-db-check.mjs https://staging.buildmarket.app",
    );
    return;
  }
  if (!internalSecret) {
    fail(
      "INTERNAL_SERVICE_SECRET/INTERNAL_API_SECRET is not set for this job.",
    );
    return;
  }

  console.log(
    `[preflight] Probing ${baseUrl}/api/health for staging test control kill switch ...`,
  );
  try {
    const healthRes = await fetch(`${baseUrl}/api/health`, {
      method: "GET",
      headers: headers(),
    });
    if (!healthRes.ok) {
      fail(`Could not query /api/health: status ${healthRes.status}`);
      return;
    }
    const healthBody = await healthRes.json();
    if (healthBody.stagingTestControlEnabled !== true) {
      fail(
        `Deployment has stagingTestControlEnabled: ${healthBody.stagingTestControlEnabled}. ` +
          `ENABLE_STAGING_TEST_CONTROL=true must be set in Vercel environment variables for Preview/Staging. ` +
          `Without this variable, all test-control calls will be rejected with 404 under the strict environment kill switch.`,
      );
      return;
    }
    console.log(
      `[preflight] OK — stagingTestControlEnabled: true verified on deployment.`,
    );
  } catch (err) {
    fail(`Could not probe /api/health at ${baseUrl}: ${err.message}`);
    return;
  }

  // S-2: Assert configured staging identity slots exist in Postgres and Clerk
  let STAGING_IDENTITY_SLOTS;
  try {
    const mod = await import(
      path.resolve(
        process.cwd(),
        "packages/db/dist/src/staging-test-runs/contracts.js",
      )
    );
    STAGING_IDENTITY_SLOTS = mod.STAGING_IDENTITY_SLOTS;
  } catch {
    STAGING_IDENTITY_SLOTS = [
      {
        slot: "pro-1",
        role: "PROFESSIONAL",
        email: "e2e_pro_1@staging.buildmarket.app",
      },
      {
        slot: "pro-2",
        role: "PROFESSIONAL",
        email: "e2e_pro_2@staging.buildmarket.app",
      },
      {
        slot: "client-1",
        role: "CLIENT",
        email: "e2e_client_1@staging.buildmarket.app",
      },
      {
        slot: "client-2",
        role: "CLIENT",
        email: "e2e_client_2@staging.buildmarket.app",
      },
    ];
  }

  if (databaseUrl) {
    console.log(
      `[preflight] Asserting ${STAGING_IDENTITY_SLOTS.length} configured staging identity slots exist in Postgres with correct roles...`,
    );
    let pgModule;
    try {
      pgModule = await import("pg");
    } catch (err) {
      console.warn(
        `[preflight] 'pg' package not available; skipping direct DB slot verification: ${err.message}`,
      );
    }
    if (pgModule) {
      const Pool = pgModule.Pool || pgModule.default?.Pool;
      const pool = new Pool({
        connectionString: databaseUrl,
        max: 1,
        connectionTimeoutMillis: 5000,
      });
      let client;
      try {
        client = await pool.connect();
        const emails = STAGING_IDENTITY_SLOTS.map((s) => s.email.toLowerCase());
        const res = await client.query(
          'SELECT LOWER(email) AS email, role, "clerkId" FROM users WHERE LOWER(email) = ANY($1::text[])',
          [emails],
        );
        const foundByEmail = new Map(res.rows.map((r) => [r.email, r]));
        for (const slot of STAGING_IDENTITY_SLOTS) {
          const row = foundByEmail.get(slot.email.toLowerCase());
          if (!row) {
            fail(
              `Missing Postgres user record for identity slot '${slot.slot}' (${slot.email}) in 'users' table.`,
            );
            return;
          }
          if (row.role !== slot.role) {
            fail(
              `Role mismatch for slot '${slot.slot}' (${slot.email}): expected ${slot.role}, found ${row.role} in Postgres.`,
            );
            return;
          }
          if (!row.clerkId || !row.clerkId.startsWith("user_")) {
            fail(
              `Invalid or missing clerkId for slot '${slot.slot}' (${slot.email}): '${row.clerkId}' in Postgres.`,
            );
            return;
          }
        }
        console.log(
          `[preflight] OK — all ${STAGING_IDENTITY_SLOTS.length} identity slots verified in Postgres with correct roles.`,
        );
      } catch (dbErr) {
        fail(`Database slot preflight query failed: ${dbErr.message}`);
        return;
      } finally {
        if (client) client.release();
        await pool.end().catch(() => {});
      }
    }
  }

  if (clerkSecretKey) {
    console.log(
      `[preflight] Asserting ${STAGING_IDENTITY_SLOTS.length} configured staging identity slots exist in Clerk...`,
    );
    for (const slot of STAGING_IDENTITY_SLOTS) {
      try {
        const clerkRes = await fetch(
          `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(slot.email)}`,
          {
            headers: {
              Authorization: `Bearer ${clerkSecretKey}`,
            },
          },
        );
        if (!clerkRes.ok) {
          fail(
            `Could not query Clerk API for slot '${slot.slot}' (${slot.email}): status ${clerkRes.status}`,
          );
          return;
        }
        const users = await clerkRes.json();
        if (!Array.isArray(users) || users.length === 0) {
          fail(
            `Clerk user for slot '${slot.slot}' (${slot.email}) was not found in Clerk.`,
          );
          return;
        }
        const clerkUser = users[0];
        const clerkRole = clerkUser.public_metadata?.role;
        if (clerkRole && clerkRole !== slot.role) {
          fail(
            `Clerk public_metadata.role mismatch for slot '${slot.slot}' (${slot.email}): expected ${slot.role}, found ${clerkRole}.`,
          );
          return;
        }
      } catch (clerkErr) {
        fail(
          `Clerk API request failed for slot '${slot.slot}' (${slot.email}): ${clerkErr.message}`,
        );
        return;
      }
    }
    console.log(
      `[preflight] OK — all ${STAGING_IDENTITY_SLOTS.length} identity slots verified in Clerk with matching roles.`,
    );
  }

  console.log(`[preflight] Probing ${baseUrl}/api/internal/test-control ...`);

  let res;
  try {
    res = await fetch(`${baseUrl}/api/internal/test-control`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        action: "create-run",
        scenario: "onboarding",
        actorLabel: "ci-preflight",
      }),
    });
  } catch (err) {
    fail(`Could not reach ${baseUrl}: ${err.message}`);
    return;
  }

  const bodyText = await res.text();
  let body = null;
  try {
    body = JSON.parse(bodyText);
  } catch {
    // leave body null; we'll report the raw text below
  }

  if (res.status === 404) {
    fail(
      `Deployment returned 404 (denial: ${res.headers.get("x-test-control-denial") || "unknown"}). ` +
        `The site does not think it is in a staging/test environment, or a secret was rejected. ` +
        `Check env.otel.ddEnv / stagingTestControl.enabled / stagingAuth.isEnabled and the ` +
        `x-internal-secret / x-test-control-secret values for this deployment.`,
    );
    return;
  }

  const isLoopbackError =
    body?.error === "STAGING_DATABASE_MISCONFIGURED" ||
    bodyText.includes("127.0.0.1:5432") ||
    bodyText.includes("localhost:5432") ||
    bodyText.includes("points to loopback host");

  if (isLoopbackError) {
    fail(
      (body?.message ||
        "Deployment resolved database host to localhost/127.0.0.1.") +
        "\n  -> This is a Vercel deployment/environment-variable problem: the running deployment is either " +
        "missing DATABASE_URL or was deployed before the variable was added to Vercel." +
        "\n  -> ACTION REQUIRED: Trigger a fresh deployment of the 'staging' branch on Vercel so the newly added DATABASE_URL is active." +
        "\n  -> See docs/STAGING_DB_LOCALHOST_AUTOPSY.md.",
    );
    return;
  }

  if (!res.ok) {
    fail(`Unexpected ${res.status} response: ${bodyText.slice(0, 500)}`);
    return;
  }

  const runId = body?.runId;
  const grantToken = body?.grantToken;
  console.log(
    `[preflight] OK — deployment can reach its database (run ${runId}).`,
  );

  if (runId && grantToken) {
    try {
      await fetch(`${baseUrl}/api/internal/test-control`, {
        method: "POST",
        headers: headers({ "x-test-control-grant": grantToken }),
        body: JSON.stringify({ action: "cleanup-run", runId }),
      });
    } catch (err) {
      // Non-fatal — the real emergency-cleanup step still runs `if: always()`.
      console.warn(
        `[preflight] Cleanup of probe run ${runId} failed (non-fatal): ${err.message}`,
      );
    }
    console.log(`[preflight] Probing ${baseUrl}/api/internal/queue-health ...`);
    try {
      const qRes = await fetch(`${baseUrl}/api/internal/queue-health`, {
        method: "GET",
        headers: headers(),
      });
      if (qRes.ok) {
        const qBody = await qRes.json();
        console.log(
          `[preflight] Queue health: backend=${qBody.backend}, connected=${qBody.connected}` +
            (qBody.consumerSeenAt
              ? `, consumerSeenAt=${qBody.consumerSeenAt}`
              : `, no active consumer detected`),
        );
      } else {
        console.warn(
          `[preflight] Queue health probe returned ${qRes.status} (non-fatal; spec 07 evaluates independently)`,
        );
      }
    } catch (qErr) {
      console.warn(
        `[preflight] Queue health probe failed (non-fatal): ${qErr.message}`,
      );
    }

    console.log("[preflight] Passed. Proceeding to full Cypress suite.");
  }
}
main();
