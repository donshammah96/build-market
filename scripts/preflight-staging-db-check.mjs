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

function fail(message) {
  console.error(`[preflight] FAIL: ${message}`);
  process.exitCode = 1;
}

function headers(extra = {}) {
  return {
    "Content-Type": "application/json",
    "x-internal-secret": internalSecret,
    ...(testSecret ? { "x-test-control-secret": testSecret } : {}),
    ...(stagingAuthSecret ? { "x-staging-secret": stagingAuthSecret } : {}),
    ...extra,
  };
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
      (body?.message || "Deployment resolved database host to localhost/127.0.0.1.") +
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
  }

  console.log("[preflight] Passed. Proceeding to full Cypress suite.");
}

main();
