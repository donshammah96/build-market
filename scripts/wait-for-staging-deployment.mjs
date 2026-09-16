#!/usr/bin/env node
/**
 * Staging Deployment Readiness Gate
 * ============================================================================
 * Polls https://staging.buildmarket.app/api/health until the deployed buildSha
 * matches EXPECTED_SHA (typically github.sha in GitHub Actions).
 *
 * Exists because Vercel deployments take time to build and promote. Running
 * E2E tests against staging before the target commit is active yields false
 * negatives and tests stale code (or fails to verify recent fixes).
 *
 * Sends staging perimeter authentication headers (x-staging-secret or Basic auth)
 * because /api/health is protected by handleStagingProtection (only /api/healthz
 * is exempt).
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
      // Ignore syntax errors in local env files
    }
  }
}

const args = process.argv.slice(2);
const cliUrlArg = args.find(
  (arg) => arg.startsWith("http://") || arg.startsWith("https://"),
);
const baseUrl = (
  cliUrlArg ||
  process.env.STAGING_E2E_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://staging.buildmarket.app"
)
  .trim()
  .replace(/\/+$/, "");

const expectedShaArg = args.find(
  (arg) =>
    !arg.startsWith("http://") &&
    !arg.startsWith("https://") &&
    /^[0-9a-fA-F]{7,40}$/.test(arg),
);
const expectedSha = (
  expectedShaArg ||
  process.env.EXPECTED_SHA ||
  process.env.GITHUB_SHA ||
  ""
)
  .trim()
  .toLowerCase();

const stagingAuthSecret = (process.env.STAGING_AUTH_SECRET || "").trim();
const stagingAuthUser = (process.env.STAGING_AUTH_USER || "").trim();
const stagingAuthPassword = (process.env.STAGING_AUTH_PASSWORD || "").trim();

const POLL_INTERVAL_MS = 5000;
const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

function getHeaders() {
  const headers = {
    Accept: "application/json",
  };
  if (stagingAuthSecret) {
    headers["x-staging-secret"] = stagingAuthSecret;
  } else if (stagingAuthUser && stagingAuthPassword) {
    const basic = Buffer.from(
      `${stagingAuthUser}:${stagingAuthPassword}`,
    ).toString("base64");
    headers["Authorization"] = `Basic ${basic}`;
  }
  return headers;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkDeployment() {
  const healthUrl = `${baseUrl}/api/health`;
  try {
    const res = await fetch(healthUrl, {
      method: "GET",
      headers: getHeaders(),
      signal: AbortSignal.timeout(10000),
    });

    const status = res.status;
    const bodyText = await res.text();
    let data = null;
    try {
      data = JSON.parse(bodyText);
    } catch {
      // Non-JSON response (e.g. proxy error or perimeter block)
    }

    return {
      ok: res.ok || status === 200 || status === 207,
      status,
      buildSha: data?.buildSha
        ? String(data.buildSha).trim().toLowerCase()
        : null,
      deploymentId: data?.deploymentId ?? null,
      version: data?.version ?? null,
      errorText: data ? null : bodyText.slice(0, 200),
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      buildSha: null,
      deploymentId: null,
      version: null,
      errorText: err.message,
    };
  }
}

async function main() {
  if (!baseUrl) {
    console.error("[wait-for-deployment] ERROR: baseUrl is empty.");
    process.exit(1);
  }

  if (!expectedSha) {
    console.warn(
      "[wait-for-deployment] WARNING: No EXPECTED_SHA or GITHUB_SHA provided. Skipping SHA gate verification.",
    );
    process.exit(0);
  }

  console.log(`[wait-for-deployment] Target: ${baseUrl}`);
  console.log(`[wait-for-deployment] Expected commit SHA: ${expectedSha}`);
  console.log(
    `[wait-for-deployment] Polling interval: ${POLL_INTERVAL_MS / 1000}s, Timeout: ${TIMEOUT_MS / 1000}s`,
  );

  const startTime = Date.now();
  let attempt = 0;

  while (Date.now() - startTime < TIMEOUT_MS) {
    attempt++;
    const result = await checkDeployment();
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);

    if (result.buildSha) {
      // Check full match or prefix match (git shas often truncated to 7 chars)
      const matches =
        result.buildSha === expectedSha ||
        (expectedSha.length >= 7 && result.buildSha.startsWith(expectedSha)) ||
        (result.buildSha.length >= 7 &&
          expectedSha.startsWith(result.buildSha));

      if (matches) {
        console.log(
          `[wait-for-deployment] SUCCESS: Deployment at ${baseUrl} is running target commit ${result.buildSha} (deploymentId: ${result.deploymentId ?? "none"}) after ${elapsedSec}s (${attempt} probes).`,
        );
        process.exit(0);
      } else {
        console.log(
          `[wait-for-deployment] [${elapsedSec}s | attempt ${attempt}] Active buildSha is '${result.buildSha}' (deploymentId: ${result.deploymentId ?? "none"}), waiting for '${expectedSha}'...`,
        );
      }
    } else {
      console.log(
        `[wait-for-deployment] [${elapsedSec}s | attempt ${attempt}] Endpoint returned status ${result.status ?? "error"} (buildSha: null). Details: ${result.errorText ?? "No buildSha in response"}. Retrying...`,
      );
    }

    await sleep(POLL_INTERVAL_MS);
  }

  console.error(
    `[wait-for-deployment] TIMEOUT: Staging deployment did not promote commit ${expectedSha} within ${TIMEOUT_MS / 1000}s.`,
  );
  process.exit(1);
}

main().catch((err) => {
  console.error("[wait-for-deployment] Fatal error:", err);
  process.exit(1);
});
