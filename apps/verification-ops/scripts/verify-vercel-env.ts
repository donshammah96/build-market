#!/usr/bin/env tsx
/**
 * scripts/verify-vercel-env.ts
 * ============================================================================
 * Deploy-time guard for the exact misconfiguration class that caused the
 * satellite redirect-loop incident (see SATELLITE_DOMAIN_AUTH_AUTOPSY.md):
 * `NEXT_PUBLIC_CLERK_IS_SATELLITE=true` in a `production` or `staging`
 * deployment target with `NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL` unset, or
 * set to something that isn't an absolute http(s) URL (most commonly a
 * relative path copy-pasted from `NEXT_PUBLIC_CLERK_SIGN_IN_URL`).
 *
 * This exists because the per-app `env.ts`/`env-wrapper.ts` checks
 * (`validateSatelliteInvariants` from `@build/env-validation`) run *inside*
 * the Next.js process at boot/build time. That already fails closed in prod
 * for apps/admin and apps/verification-ops (see AUTH_HARDENING_RECOMMENDATIONS.md
 * §6.1). This script exists to catch the same class of misconfiguration
 * one step earlier — as an explicit CI/pre-deploy gate — so a bad Vercel
 * project env var setting fails a CI job with a clear message instead of
 * failing a `next build`/runtime boot three layers down the stack, or (worse)
 * being caught by one app's fail-open-in-preview/fail-closed-in-prod branching
 * only after a real deploy.
 *
 * USAGE
 * -----
 *   tsx scripts/verify-vercel-env.ts --app admin --profile production
 *   tsx scripts/verify-vercel-env.ts --app verification-ops --profile staging
 *
 * By default this script reads target env vars from `process.env` — the
 * expected CI usage is one invocation per (app, target) pair, with that
 * target's env vars already loaded into the process (e.g. via
 * `vercel env pull .env.<target>.local --environment=<target>` followed by
 * `dotenv -e .env.<target>.local -- tsx scripts/verify-vercel-env.ts ...`,
 * or equivalently injected by the CI platform's own per-job env config).
 * This script deliberately does NOT shell out to the Vercel CLI itself —
 * keeping it a dumb, static check over whatever env vars it's handed keeps
 * it usable both in CI and as a quick local sanity check
 * (`NEXT_PUBLIC_CLERK_IS_SATELLITE=true NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL=/sign-in tsx scripts/verify-vercel-env.ts --app admin --profile production`
 * reliably fails, for example).
 *
 * `--app` is accepted and included in output for readability in CI logs
 * when this script is invoked once per app in a matrix job; the check
 * itself doesn't currently vary by app.
 *
 * Exit code 0 = pass (or not applicable), 1 = fail.
 */

type DeploymentProfile = "production" | "staging" | "preview" | "development";

const GATED_PROFILES: readonly DeploymentProfile[] = ["production", "staging"];

interface ParsedArgs {
  app?: string;
  profile?: DeploymentProfile;
}

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--app") {
      const val = argv[++i];
      if (val !== undefined) result.app = val;
    } else if (arg === "--profile") {
      const val = argv[++i];
      if (val !== undefined) result.profile = val as DeploymentProfile;
    } else if (arg?.startsWith("--app=")) {
      result.app = arg.slice("--app=".length);
    } else if (arg?.startsWith("--profile=")) {
      result.profile = arg.slice("--profile=".length) as DeploymentProfile;
    }
  }
  return result;
}

/** Returns true only if `value` parses as a well-formed absolute http(s) URL. */
function isAbsoluteHttpUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function toBool(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export interface VerifyResult {
  ok: boolean;
  messages: string[];
}

/**
 * Pure check, exported separately from `main()` so it's directly unit
 * testable (see tests/satellite-auth-hardening.test.ts) without needing to
 * spawn a subprocess or mock process.argv/process.exit.
 */
export function verifySatelliteEnv(
  env: Record<string, string | undefined>,
  profile: DeploymentProfile | undefined,
  appLabel = "app",
): VerifyResult {
  const messages: string[] = [];

  if (!profile) {
    return {
      ok: false,
      messages: [
        `[verify-vercel-env] Missing required --profile argument for ${appLabel}. ` +
          `Expected one of: ${GATED_PROFILES.join(", ")}, preview, development.`,
      ],
    };
  }

  if (!GATED_PROFILES.includes(profile)) {
    return {
      ok: true,
      messages: [
        `[verify-vercel-env] ${appLabel}: profile "${profile}" is not gated ` +
          `(only ${GATED_PROFILES.join("/")} are checked) — skipping.`,
      ],
    };
  }

  const isSatellite = toBool(env.NEXT_PUBLIC_CLERK_IS_SATELLITE);

  if (!isSatellite) {
    return {
      ok: true,
      messages: [
        `[verify-vercel-env] ${appLabel} (${profile}): NEXT_PUBLIC_CLERK_IS_SATELLITE ` +
          "is not true — satellite invariant check not applicable.",
      ],
    };
  }

  const primarySignInUrl = env.NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL;

  if (!isAbsoluteHttpUrl(primarySignInUrl)) {
    messages.push(
      `[verify-vercel-env] FAIL — ${appLabel} (${profile}): ` +
        "NEXT_PUBLIC_CLERK_IS_SATELLITE=true but NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL is " +
        (primarySignInUrl
          ? `set to "${primarySignInUrl}", which is not an absolute http(s) URL ` +
            "(did you mean to set NEXT_PUBLIC_CLERK_SIGN_IN_URL instead — that one IS " +
            "relative? See SATELLITE_DOMAIN_AUTH_AUTOPSY.md Finding 6.)"
          : "unset. Set it to the primary app's absolute sign-in URL, e.g. " +
            '"https://accounts.buildmarket.app/sign-in", in this Vercel target\'s project settings.'),
    );
    return { ok: false, messages };
  }

  messages.push(
    `[verify-vercel-env] PASS — ${appLabel} (${profile}): NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL ` +
      `is a valid absolute URL ("${primarySignInUrl}").`,
  );
  return { ok: true, messages };
}

function main(): void {
  const { app, profile } = parseArgs(process.argv.slice(2));
  const result = verifySatelliteEnv(process.env, profile, app ?? "app");

  for (const message of result.messages) {
    (result.ok ? console.log : console.error)(message);
  }

  // Avoid process.exit() — calling it synchronously after console output can
  // race the stdout flush on Windows Node (libuv UV_HANDLE_CLOSING assertion).
  // Setting exitCode and returning lets Node drain I/O before shutting down.
  process.exitCode = result.ok ? 0 : 1;
}

// Only run when invoked directly (tsx script.ts), not when imported by tests.
// `require.main === module` is CJS-only; use the ESM-safe equivalent instead.
// Node 22.6+ auto-detects ES modules from `export` statements, so `require`
// is not defined in this scope.
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  (await import("node:url")).fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main();
}
