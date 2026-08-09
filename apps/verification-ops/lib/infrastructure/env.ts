/**
 * apps/verification-ops — Environment Variable Validation
 * =========================================================
 * Mirrors the ADR-004 pattern from apps/client
 * (`lib/infrastructure/env.ts`): all process.env reads in this app
 * should go through this module, not scattered raw `process.env.X` calls.
 *
 * Now built on `@build/env-validation` — the canonical engine
 * (EnvVar/EnvGroup/validateEnvGroups/validateSatelliteInvariants/
 * getStringEnv/getOptionalStringEnv/getBooleanEnv) shared with apps/client
 * and apps/admin, closing Drift 2 for this app. This file retains only
 * its own `envGroups` variable *declarations* — the validation behavior
 * itself is no longer a local copy.
 *
 * Usage:
 *   import { envConfig, validateEnv } from "@/lib/infrastructure/env";
 *   validateEnv(); // call once, early — see middleware.ts / instrumentation.ts
 *
 * SATELLITE UPDATE: this app is now a Clerk satellite of apps/client
 * (buildmarket.app), mirroring apps/admin's setup. Added
 * NEXT_PUBLIC_CLERK_IS_SATELLITE / NEXT_PUBLIC_CLERK_DOMAIN /
 * NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL to the `clerk` group below. See
 * layout.tsx and middleware.ts for how these are consumed — both must be
 * kept in sync with apps/admin's equivalent files.
 *
 * DEV BYPASS — EXPLICIT DECISION: apps/verification-ops does NOT implement
 * `AUTH_DEV_BYPASS` / any local auth bypass, even for local development.
 * This is deliberate, not an oversight (AUTH_HARDENING_RECOMMENDATIONS.md
 * §2, Drift 4 row): of the three apps, this one handles professional
 * license verification decisions and unredacted evidence export — the
 * most sensitive surface in the ecosystem. Local development against this
 * app should exercise the real Clerk satellite handshake against a shared
 * dev Clerk instance, not a bypass flag. Do not add bypass wiring here
 * without deliberately revisiting this decision (and updating this
 * comment to say so) — don't let it happen silently as a "convenience" fix
 * during some unrelated local-dev-friction pass.
 */

import {
  type EnvGroup,
  getBooleanEnv,
  getOptionalStringEnv,
  getStringEnv,
  isAbsoluteHttpUrl,
  validateEnvGroups,
  validateSatelliteInvariants,
} from "@build/env-validation";

export type ValidationResult = ReturnType<typeof validateEnvGroups>;

const envGroups: EnvGroup[] = [
  {
    name: "clerk",
    description:
      "Clerk Authentication (shared Clerk instance with apps/client)",
    variables: [
      { name: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", required: true },
      { name: "CLERK_SECRET_KEY", required: true },
      // No CLERK_WEBHOOK_SECRET here on purpose — this app does not receive
      // Clerk webhooks; that's owned by apps/client. Requiring it here would
      // just be a second place to keep the same secret in sync for no
      // functional reason.
      {
        name: "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
        required: false,
        default: "/sign-in",
      },
      // --- Satellite configuration (mirrors apps/admin) -----------------
      // Not required: this app must keep working (as a plain, non-satellite
      // Clerk consumer) in local dev / any environment where satellite mode
      // hasn't been configured yet.
      {
        name: "NEXT_PUBLIC_CLERK_IS_SATELLITE",
        required: false,
        default: "false",
      },
      {
        name: "NEXT_PUBLIC_CLERK_DOMAIN",
        required: false,
      },
      {
        name: "NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL",
        required: false,
        validate: isAbsoluteHttpUrl,
        errorMessage:
          "NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL must be an absolute http(s) URL " +
          '(e.g. "https://accounts.buildmarket.app/sign-in"), not a relative path — that\'s ' +
          "what NEXT_PUBLIC_CLERK_SIGN_IN_URL is for.",
      },
    ],
  },
  {
    name: "database",
    description: "Postgres (via @build/db / Prisma)",
    variables: [
      {
        name: "DATABASE_URL",
        required: true,
        errorMessage:
          "DATABASE_URL is required — @build/db will otherwise fail deep inside a Prisma call at request time instead of at boot.",
      },
    ],
  },
  {
    name: "app",
    description: "App-level configuration",
    variables: [
      {
        name: "NEXT_PUBLIC_VERIFICATION_OPS_URL",
        required: false,
        default: "http://localhost:3501",
        validate: (value) => {
          try {
            new URL(value);
            return true;
          } catch {
            return false;
          }
        },
        errorMessage:
          "NEXT_PUBLIC_VERIFICATION_OPS_URL must be a valid absolute URL",
      },
    ],
  },
  // NOT included yet, intentionally: NATS_URL / regulator credentials.
  // This app has no write path or event-publishing today (see Phase 8
  // migration plan — writes are still behind a feature flag that doesn't
  // exist yet). Add a "nats" group here in the same PR that adds
  // `license.manual_decision_recorded` publishing, not before — an env
  // group required for a capability that doesn't exist yet just makes
  // local setup harder for no benefit.
];

const BUILD_DEFERRED_SERVER_ONLY_REQUIRED_VARS = new Set<string>([
  "CLERK_SECRET_KEY",
  "DATABASE_URL",
]);

function shouldDeferServerOnlyValidationForBuild(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

export function validateEnv(
  groups: string[] | "all" = "all",
  throwOnError = true,
): ValidationResult {
  const isBuildPhase = shouldDeferServerOnlyValidationForBuild();
  const result = validateEnvGroups(
    envGroups,
    process.env,
    groups,
    BUILD_DEFERRED_SERVER_ONLY_REQUIRED_VARS,
    isBuildPhase,
  );

  if (!result.valid && throwOnError) {
    throw new Error(
      `Environment validation failed:\n${result.errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }

  return result;
}

const isProdLikeProfile = process.env.NODE_ENV === "production";

function buildEnvConfig() {
  // Finding 6, CONFIRMED FIXED (not re-introduced here): `primarySignInUrl`
  // resolves strictly from `NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL` with NO
  // fallback to `NEXT_PUBLIC_CLERK_SIGN_IN_URL` — the two variables have
  // different contractual shapes (absolute vs. relative) and borrowing one
  // for the other is exactly the bug the hardening doc's Finding 6 flags.
  // If you're tempted to add a `??` fallback to the line below because a
  // preview environment is missing the absolute var, don't — fix the
  // environment's config instead (see `scripts/verify-vercel-env.ts`,
  // which now catches this class of gap in CI before it reaches a
  // satellite-mode deploy).
  const primarySignInUrl = getOptionalStringEnv(
    process.env,
    "NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL",
  );

  const clerk = {
    publishableKey: getStringEnv(
      process.env,
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    ),
    secretKey: getOptionalStringEnv(process.env, "CLERK_SECRET_KEY"),
    signInUrl: getStringEnv(
      process.env,
      "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
      "/sign-in",
    ),
    // Satellite config — see the "clerk" env group above for validation,
    // and layout.tsx / middleware.ts for how these are consumed.
    isSatellite: getBooleanEnv(
      process.env,
      "NEXT_PUBLIC_CLERK_IS_SATELLITE",
      false,
    ),
    domain: getOptionalStringEnv(process.env, "NEXT_PUBLIC_CLERK_DOMAIN"),
    primarySignInUrl,
  };

  // Cross-var invariant check, now delegated to the shared engine instead
  // of being left entirely to layout.tsx (fail fast) / middleware.ts (fail
  // open + log) to each re-derive independently. Kept fail-open + log here
  // (never throws from this module) — layout.tsx is still the fail-fast
  // enforcement point for this app, this is a second, cheap line of
  // defense that surfaces the misconfiguration in server logs at boot
  // regardless of which page happens to render first.
  const satelliteIssues = validateSatelliteInvariants({
    isSatellite: clerk.isSatellite,
    domain: clerk.domain,
    primarySignInUrl: clerk.primarySignInUrl,
    appName: "verification-ops",
  });
  if (
    satelliteIssues.length > 0 &&
    !shouldDeferServerOnlyValidationForBuild()
  ) {
    const message = `Invalid Clerk satellite configuration in apps/verification-ops:\n${satelliteIssues
      .map((i) => `  - ${i}`)
      .join("\n")}`;
    if (isProdLikeProfile) {
      console.error(`[verification-ops env] ${message}`); // bootstrap-only: fail-open + log, layout.tsx enforces fail-fast
    } else {
      console.warn(`[verification-ops env] ${message}`); // bootstrap-only: env validation warning
    }
  }

  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    clerk,
    database: {
      url: getOptionalStringEnv(process.env, "DATABASE_URL"),
    },
    app: {
      url: getStringEnv(
        process.env,
        "NEXT_PUBLIC_VERIFICATION_OPS_URL",
        "http://localhost:3501",
      ),
    },
    // NOTE ON NAMING: unlike `app.url` (this app's own origin), `appUrl`
    // here is the PRIMARY app's origin, best-effort derived from
    // `NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL`'s host. It exists so this
    // app can pass something into `AllowedEnvUrls.appUrl` when/if its
    // `redirect-url.ts` equivalent is migrated onto
    // `@build/security-clerk`'s `getSafeRedirectUrl()` (which checks
    // `envUrls.appUrl` against the *primary's* origin, not this app's
    // own). It is NOT this app's own URL — that's `app.url` above. Kept
    // as-is rather than renamed in this pass to avoid a silent behavior
    // change for any existing consumer of `envConfig.appUrl`.
    appUrl: primarySignInUrl
      ? (() => {
          try {
            return new URL(primarySignInUrl).origin;
          } catch {
            return undefined;
          }
        })()
      : undefined,
    // Explicit, permanent: no dev bypass in this app. See header comment.
    auth: {
      bypassEnabled: false as const,
    },
  } as const;
}

export const envConfig = buildEnvConfig();
export type VerificationOpsEnvConfig = typeof envConfig;
export const env = envConfig;
export default envConfig;
