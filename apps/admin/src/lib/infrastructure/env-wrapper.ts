/**
 * apps/admin — Environment Configuration Wrapper
 * =================================================
 * Mirrors the ADR-004 pattern already used by apps/verification-ops
 * (`lib/infrastructure/env.ts`): every runtime read of `process.env` in this
 * app should go through the `env` object exported here, not scattered raw
 * environment variable calls and not `adminEnvConfig` directly.
 *
 * WHY THIS FILE EXISTS (and didn't before):
 * `env.ts` (this app's Zod schema — kept as-is, imported below as
 * `adminEnvConfig`) validates and types individual raw env vars. It does
 * NOT resolve cross-var invariants or build the nested shape
 * (`env.clerk.*`, `env.appUrl`, `env.auth.*`, ...) that middleware.ts,
 * redirect-policy.ts, and redirect-url.ts already import and rely on. That
 * gap is exactly how the satellite redirect loop shipped: the raw vars
 * existed and were validated, but nothing in the codebase resolved them
 * into the values consumers actually read. This file is that resolution
 * layer, and it is the SINGLE place cross-field invariants (like "satellite
 * mode requires a domain and a primary sign-in URL") are checked, instead
 * of that check being duplicated — or silently skipped — per call site.
 *
 * Cross-field invariants (satellite config, dev bypass fail-closed-in-prod)
 * are resolved via `@build/env-validation`'s `validateSatelliteInvariants`
 * and `resolveDevAuthBypass` — the same canonical engine apps/client and
 * apps/verification-ops use — so this app can no longer silently diverge
 * from either of them on how these checks behave (Drift 2).
 *
 * File naming: this file lives at `env-wrapper.ts` (kebab-case, matching
 * `env-schema.ts` and `env-utils.ts`) and is imported by `env.ts` as
 * `./env-wrapper`. It was previously misnamed `env_wrapper.ts` on disk
 * while `env.ts` imported `./env.wrapper` — a filename that never existed
 * — which broke module resolution for every consumer (middleware.ts,
 * redirect-policy.ts, redirect-url.ts). If this comment and the actual
 * filename ever disagree again, trust the filesystem and fix the import,
 * not the other way around.
 */

import {
  adminEnvConfig,
  isStaticBuildPhase,
  type AdminEnvConfig,
} from "./env-schema";
import {
  resolveDevAuthBypass,
  validateSatelliteInvariants,
} from "@build/env-validation";
// -----------------------------------------------------------------------------
// Small helpers
// -----------------------------------------------------------------------------

/** Returns the origin (scheme + host) of a URL, or undefined if invalid/absent. */
function toOrigin(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

/**
 * Clerk publishable keys encode the Frontend API host as
 * `pk_(test|live)_<base64(host + "$")>`. This is undocumented-but-stable
 * Clerk internal behavior, not a public contract. Kept only as a fallback
 * for environments that haven't set `NEXT_PUBLIC_CLERK_FRONTEND_API` yet —
 * see `clerk.frontendApi` below, which now prefers the explicit override.
 * Returns undefined on any failure rather than throwing, since this feeds
 * CSP header generation and a CSP gap should never be what takes the app
 * down.
 */
function deriveFrontendApiFromPublishableKey(
  publishableKey: string | undefined,
): string | undefined {
  if (!publishableKey) return undefined;
  const match = /^pk_(test|live)_(.+)$/.exec(publishableKey);
  if (!match || !match[2]) return undefined;
  try {
    const decoded = Buffer.from(match[2], "base64").toString("utf8");
    const host = decoded.replace(/\$$/, "");
    return host ? `https://${host}` : undefined;
  } catch {
    return undefined;
  }
}

type DeploymentProfile = AdminEnvConfig["ADMIN_DEPLOYMENT_PROFILE"];

function isProdLikeProfile(profile: DeploymentProfile): boolean {
  return profile === "production" || profile === "staging";
}

/**
 * Resolves this app's own absolute URL with explicit, documented
 * precedence instead of an undocumented "whichever is set first" chain.
 * `APP_URL` (server-only) wins over `NEXT_PUBLIC_APP_URL` (also sent to the
 * client) so an operator can point server-side redirect construction at an
 * internal URL distinct from what's exposed to the browser, if ever needed;
 * in the common case both are set to the same value and it doesn't matter.
 */
function resolveAppUrl(raw: AdminEnvConfig): string | undefined {
  return raw.APP_URL ?? raw.NEXT_PUBLIC_APP_URL ?? undefined;
}

// -----------------------------------------------------------------------------
// Build the resolved config
// -----------------------------------------------------------------------------
function buildEnvConfig() {
  const raw = adminEnvConfig;

  const isDev =
    raw.NODE_ENV !== "production" && raw.ADMIN_DEPLOYMENT_PROFILE === "local";
  const isCI = process.env.CI === "true" || process.env.CI === "1"; // bootstrap-only: CI environment detection
  const isProd = isProdLikeProfile(raw.ADMIN_DEPLOYMENT_PROFILE);
  const isBuildPhase = isStaticBuildPhase();

  // --- App URLs -----------------------------------------------------------
  // appUrl: THIS app's own absolute URL — self-referential, matching the
  // convention already established by redirect-url.ts (env.appUrl /
  // env.adminAppUrl / env.verificationAppUrl are three distinct per-app
  // self-URLs consumed together for cross-app allow-listing).
  const resolvedAppUrl = resolveAppUrl(raw);
  if (!resolvedAppUrl && !isBuildPhase) {
    if (isProd) {
      throw new Error(
        "[apps/admin env] APP_URL (or NEXT_PUBLIC_APP_URL) is required when " +
          "ADMIN_DEPLOYMENT_PROFILE is staging or production.",
      );
    }
    // local/test/preview: fall back to a documented dev default rather than
    // silently resolving to `undefined` and producing a confusing
    // downstream "Invalid URL" three modules away.
  }
  const appUrl = resolvedAppUrl ?? "http://localhost:3500";

  // clientAppUrl: the PRIMARY (apps/client) app's own URL. Distinct from
  // clerk.primarySignInUrl (which is a full */sign-in* path, not an
  // origin) and needed so this app's redirect allow-list can validate a
  // redirect_url pointing back at a non-*.buildmarket.app primary (local
  // dev, preview, staging).
  //
  // RESOLVED: the shared `@build/security-clerk`'s `getSafeRedirectUrl()`
  // now checks `envUrls.clientAppUrl` as one of its four allow-listed
  // origins (alongside appUrl/adminAppUrl/verificationAppUrl), and
  // apps/client's own `redirect-url.ts` already passes `env.clientAppUrl`
  // into it. This field exists so apps/admin can do the same if/when its
  // own `redirect-url.ts` is migrated onto the shared helper — it is no
  // longer a known gap, just plumbing waiting to be wired at the call site.
  const clientAppUrl = raw.CLIENT_APP_URL;

  const verificationAppUrl = raw.NEXT_PUBLIC_VERIFICATION_OPS_URL;

  // apiUrl: apps/admin is a single Next.js app serving both UI and API
  // routes from the same origin — there is no separate API_URL var in the
  // schema today, so this intentionally mirrors appUrl rather than silently
  // resolving to undefined. If a split API host is ever introduced, add a
  // dedicated `ADMIN_API_URL` field to the schema and resolve it here
  // instead of changing this fallback in place (call sites shouldn't have
  // to guess which one changed).
  const apiUrl = appUrl;

  // --- Clerk ----------------------------------------------------------------
  const isSatellite = raw.NEXT_PUBLIC_CLERK_IS_SATELLITE ?? false;
  const clerk = {
    publishableKey: raw.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    secretKey: raw.CLERK_SECRET_KEY,
    webhookSecret: raw.CLERK_WEBHOOK_SECRET,
    signInUrl: raw.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? "/sign-in",
    isSatellite,
    domain: raw.NEXT_PUBLIC_CLERK_DOMAIN,
    primarySignInUrl: raw.NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL,
    // §4.3: explicit override takes precedence over decoding the
    // publishable key. The decode fallback remains for environments that
    // haven't set the var yet, but new environments (and CI's
    // verify-vercel-env script) should set NEXT_PUBLIC_CLERK_FRONTEND_API
    // explicitly rather than relying on undocumented Clerk key encoding for
    // CSP header generation.
    //
    // NOTE: `raw.NEXT_PUBLIC_CLERK_FRONTEND_API` assumes `env-schema.ts` has
    // (or gains) a matching optional field, e.g.
    // `NEXT_PUBLIC_CLERK_FRONTEND_API: z.string().url().optional()`.
    // env-schema.ts wasn't in scope for this change — add that field there
    // if it isn't already present, or this reads as `undefined` and falls
    // straight through to the decode fallback, which is a safe no-op but
    // not the explicit override this is meant to provide.
    frontendApi:
      raw.NEXT_PUBLIC_CLERK_FRONTEND_API ||
      deriveFrontendApiFromPublishableKey(
        raw.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      ),
  };

  const satelliteIssues = validateSatelliteInvariants({
    isSatellite: clerk.isSatellite,
    domain: clerk.domain,
    primarySignInUrl: clerk.primarySignInUrl,
    appName: "admin",
  });

  if (satelliteIssues.length > 0) {
    const message = `Invalid Clerk satellite configuration in apps/admin:\n${satelliteIssues
      .map((i) => `  - ${i}`)
      .join("\n")}`;
    if (isBuildPhase) {
      // Fail OPEN during build (same rationale as env-schema.ts deferring
      // server-only required vars during `next build`) — a build machine
      // legitimately may not have runtime secrets/domains available.
      console.warn(`[apps/admin env] ${message}`); // bootstrap-only: env validation warning
    } else if (isProd) {
      // Fail CLOSED at boot in staging/production — this is the exact
      // misconfiguration class that caused the redirect loop incident, and
      // it belongs in a deploy-time failure, not a user-facing bug report.
      throw new Error(message);
    } else {
      // Fail OPEN with a loud warning in local/test — matches the
      // documented "fail open + log" contract from
      // apps/verification-ops/env.ts, since satellite mode may
      // legitimately be off in local dev.
      console.warn(`[apps/admin env] ${message}`); // bootstrap-only: env validation warning
    }
  }

  // --- Auth bypass invariant ------------------------------------------------
  // Unified onto @build/env-validation's resolveDevAuthBypass (Drift 4):
  // canonical AUTH_DEV_BYPASS with backward-compatible fallback to the
  // legacy DEV_ADMIN_BYPASS this app previously used exclusively. Always
  // fails closed in a prod-like profile — resolveDevAuthBypass throws
  // rather than warns in that case, since a bypass flag silently reaching a
  // deployed admin app is a strictly worse outcome than a failed build, and
  // that check is not conditioned on `isBuildPhase` the way the satellite
  // check above is.
  const { bypassEnabled: devAdminBypass, warnings: bypassWarnings } =
    resolveDevAuthBypass(process.env, isProd, "admin");

  for (const warning of bypassWarnings) {
    console.warn(`[apps/admin env] ${warning}`); // bootstrap-only: legacy env var warning
  }

  return {
    nodeEnv: raw.NODE_ENV,
    deploymentProfile: raw.ADMIN_DEPLOYMENT_PROFILE,
    isDev,
    isCI,
    isProd,

    appUrl,
    apiUrl,
    clientAppUrl,
    adminAppUrl: appUrl, // self-alias — see redirect-url.ts's allow-list contract
    verificationAppUrl,

    clerk,

    auth: {
      bypassEnabled: devAdminBypass,
      internalApiSecret: raw.INTERNAL_API_SECRET,
    },

    analytics: {
      posthogHost: raw.NEXT_PUBLIC_POSTHOG_HOST,
    },

    database: {
      url: raw.DATABASE_URL,
      directUrl: raw.DIRECT_URL,
    },

    queue: {
      provider: raw.QUEUE_PROVIDER,
    },

    storage: {
      disabled: raw.S3_DISABLED ?? false,
      exportBucket:
        raw.R2_EXPORT_BUCKET ?? raw.S3_EXPORT_BUCKET ?? raw.EXPORTS_BUCKET_NAME,
      assetBucket:
        raw.R2_ASSET_BUCKET ?? raw.STORAGE_BUCKET ?? raw.S3_ASSET_BUCKET,
      accessKeyId:
        raw.R2_ACCESS_KEY_ID ?? raw.AWS_ACCESS_KEY_ID ?? raw.S3_ACCESS_KEY_ID,
      secretAccessKey:
        raw.R2_SECRET_ACCESS_KEY ??
        raw.AWS_SECRET_ACCESS_KEY ??
        raw.S3_SECRET_ACCESS_KEY,
      endpoint: raw.R2_ENDPOINT ?? raw.S3_URL,
      region: raw.R2_REGION ?? raw.AWS_REGION ?? raw.S3_REGION,
    },

    encryption: {
      migrationMode: raw.ENCRYPTION_MIGRATION_MODE ?? false,
      currentKeyVersion: raw.CURRENT_KEY_VERSION,
      keys: {
        current: raw.ENCRYPTION_KEY,
        v1: raw.ENCRYPTION_KEY_V1,
        v2: raw.ENCRYPTION_KEY_V2,
      },
    },

    features: {
      v2UserManagement: raw.NEXT_PUBLIC_ADMIN_FF_V2_USER_MANAGEMENT ?? false,
      v2VerificationQueue:
        raw.NEXT_PUBLIC_ADMIN_FF_V2_VERIFICATION_QUEUE ?? false,
      v2FinanceDashboard:
        raw.NEXT_PUBLIC_ADMIN_FF_V2_FINANCE_DASHBOARD ?? false,
      v2AuditLogUi: raw.NEXT_PUBLIC_ADMIN_FF_V2_AUDIT_LOG_UI ?? false,
      v2StructuredLogging:
        raw.NEXT_PUBLIC_ADMIN_FF_V2_STRUCTURED_LOGGING ?? false,
      licenseVerificationQueue:
        raw.NEXT_PUBLIC_ADMIN_FF_LICENSE_VERIFICATION_QUEUE ?? false,
      verificationOpsV2: raw.NEXT_PUBLIC_ADMIN_FF_VERIFICATION_OPS_V2 ?? false,
    },

    cron: {
      gdprErasure: {
        schedule: raw.GDPR_ERASURE_CRON,
        batchSize: raw.GDPR_ERASURE_BATCH_SIZE,
      },
      exportCleanup: {
        schedule: raw.EXPORT_CLEANUP_CRON,
        batchSize: raw.EXPORT_CLEANUP_BATCH_SIZE,
        maxRetries: raw.EXPORT_CLEANUP_MAX_RETRIES,
      },
      dataRetention: {
        schedule: raw.DATA_RETENTION_CRON,
        batchSize: raw.RETENTION_BATCH_SIZE,
      },
      assetCleanup: {
        schedule: raw.ASSET_CLEANUP_CRON,
        batchSize: raw.CLEANUP_BATCH_SIZE,
      },
      anonymizationBatch: {
        schedule: raw.ANONYMIZATION_BATCH_CRON,
        batchSize: raw.ANONYMIZATION_BATCH_SIZE,
      },
      licenseExpiry: {
        schedule: raw.LICENSE_EXPIRY_CRON,
        batchSize: raw.LICENSE_EXPIRY_BATCH_SIZE,
      },
      deletionGracePeriodDays: raw.DELETION_GRACE_PERIOD_DAYS,
    },

    otel: {
      exporterEndpoint: raw.OTEL_EXPORTER_OTLP_ENDPOINT,
      serviceName: raw.OTEL_SERVICE_NAME,
      resourceAttributes: raw.OTEL_RESOURCE_ATTRIBUTES,
    },

    nats: {
      url: raw.NATS_URL,
    },

    redis: {
      restUrl: raw.UPSTASH_REDIS_REST_URL,
      restToken: raw.UPSTASH_REDIS_REST_TOKEN,
    },

    resendApiKey: raw.RESEND_API_KEY,
    privacy: {
      odpcEmail: raw.ODPC_EMAIL,
      dpoEmail: raw.DPO_EMAIL,
      legacyFormatDeadline: raw.LEGACY_FORMAT_DEADLINE,
    },
  } as const;
}

export const env = buildEnvConfig();
export type AdminEnv = ReturnType<typeof buildEnvConfig>;
export { toOrigin, adminEnvConfig };
export default env;
