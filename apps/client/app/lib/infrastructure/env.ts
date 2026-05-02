/**
 * Environment Variable Validation
 * ================================
 * Validates required environment variables on startup.
 * Import this file early in your application to catch misconfigurations.
 *
 * Usage in app/layout.tsx or app/lib/infrastructure/env.ts:
 *   import '@/app/lib/infrastructure/env';
 *
 * Or validate specific groups:
 *   import { validateEnv, envConfig } from '@/app/lib/infrastructure/env';
 *   validateEnv(['database', 'auth']);
 *
 * ARCHITECTURE NOTE (ADR-004):
 *   All process.env reads in apps/client MUST go through this module.
 *   Direct process.env access in routes, services, or UI code is a boundary violation.
 *   Bootstrap exceptions (next.config.ts, instrumentation.ts, sentry.*.config.ts)
 *   must carry a comment: // bootstrap-only: module graph not initialized at this callsite
 *
 * BOOTSTRAP EXCEPTION INVENTORY (ADR-004):
 *   These variables are accessed outside this module at bootstrap-only callsites.
 *   They are validated by next-config-env.ts, not by this module.
 *
 *   Callsite: next.config.ts (via next-config-env.ts)
 *     - NODE_ENV              → configEnv.nodeEnv
 *     - NEXT_PUBLIC_APP_URL   → configEnv.appUrl
 *     - NEXT_PUBLIC_API_URL   → configEnv.apiUrl
 *     - NEXT_PUBLIC_CLERK_FRONTEND_API → configEnv.clerkFrontendApi (optional)
 *     - NEXT_PUBLIC_POSTHOG_HOST       → configEnv.analyticsPosthogHost
 */

import { assertUploadProcessingModeInvariant } from "./upload-processing-mode";

type EnvVar = {
  name: string;
  required: boolean;
  default?: string;
  validate?: (value: string) => boolean;
  errorMessage?: string;
};

type EnvGroup = {
  name: string;
  description: string;
  variables: EnvVar[];
};

/**
 * Canonical role set per ADR-007.
 * "SUPPORT" and "pending_professional" are removed — legacy trust-boundary
 * normalization maps SUPPORT → ADMIN at adapter entry points.
 */
type AppUserRole = "CLIENT" | "PROFESSIONAL" | "ADMIN";

type RateLimitBackendMode = "auto" | "memory" | "redis";

// ============================================
// Environment Variable Definitions
// ============================================

const envGroups: EnvGroup[] = [
  {
    name: "clerk",
    description: "Clerk Authentication",
    variables: [
      { name: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", required: true },
      { name: "CLERK_SECRET_KEY", required: true },
      {
        name: "CLERK_WEBHOOK_SECRET",
        // FIX: previously computed at module-parse time via process.env.NODE_ENV === "production".
        // That caused a false required=true during Vercel build even when the var was legitimately
        // deferred. Marking always-required and relying on BUILD_DEFERRED_SERVER_ONLY_REQUIRED_VARS
        // for build-phase deferral is the canonical pattern.
        required: true,
        errorMessage:
          "CLERK_WEBHOOK_SECRET is required for webhook signature verification (set in Vercel env settings)",
      },
      {
        name: "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
        required: false,
        default: "/sign-in",
      },
      {
        name: "NEXT_PUBLIC_CLERK_SIGN_UP_URL",
        required: false,
        default: "/sign-up",
      },
      {
        name: "NEXT_PUBLIC_CLERK_FRONTEND_API",
        required: false,
      },
    ],
  },
  {
    name: "auth",
    description: "Authentication",
    variables: [
      { name: "AUTH_SECRET", required: true },
      { name: "GOOGLE_CLIENT_ID", required: false },
      { name: "GOOGLE_CLIENT_SECRET", required: false },
      { name: "GITHUB_CLIENT_ID", required: false },
      { name: "GITHUB_CLIENT_SECRET", required: false },
      { name: "FACEBOOK_CLIENT_ID", required: false },
      { name: "FACEBOOK_CLIENT_SECRET", required: false },
      { name: "AZURE_AD_CLIENT_ID", required: false },
      { name: "AZURE_AD_CLIENT_SECRET", required: false },
      { name: "AZURE_AD_TENANT_ID", required: false, default: "common" },
    ],
  },
  {
    name: "database",
    description: "Database Connection",
    variables: [
      {
        name: "DATABASE_URL",
        required: true,
        validate: (v) =>
          v.startsWith("postgresql://") || v.startsWith("postgres://"),
        errorMessage:
          "Must be a valid PostgreSQL connection string. " +
          "Use the Supabase Supavisor session-mode pooler URL " +
          "(postgresql://postgres.PROJECT_REF:PASSWORD@aws-REGION.pooler.supabase.com:5432/postgres).",
      },
      {
        // Used by: prisma migrate deploy / prisma migrate dev (CLI only, never at Next.js runtime).
        // Points to the Supabase direct connection (requires IPv4 add-on on free tier).
        // Optional here because the Prisma CLI on free tier falls back to DATABASE_URL
        // (pooler supports DDL in session mode).
        name: "DIRECT_URL",
        required: false,
        validate: (v) =>
          v.startsWith("postgresql://") || v.startsWith("postgres://"),
        errorMessage:
          "Must be a valid PostgreSQL connection string (Supabase direct URL)",
      },
      // POSTGRES_URL is an optional alias (e.g., Vercel Postgres injects this automatically).
      { name: "POSTGRES_URL", required: false },
    ],
  },
  {
    name: "supabase",
    description: "Supabase project credentials",
    variables: [
      {
        // Non-secret: the project URL is safe to commit and expose to clients.
        name: "SUPABASE_URL",
        required: false,
        validate: (v) => v.startsWith("https://"),
        errorMessage:
          "Must be a valid HTTPS Supabase project URL (https://PROJECT_REF.supabase.co)",
      },
      {
        // The anon/publishable key — safe to expose to the browser.
        // Required if using Supabase SDK / Realtime directly; optional for Prisma-only use.
        name: "SUPABASE_ANON_KEY",
        required: false,
      },
      {
        // Server-side only — bypasses Row Level Security.
        // NEVER prefix with NEXT_PUBLIC_. Optional: only needed for admin/service operations.
        name: "SUPABASE_SERVICE_ROLE_KEY",
        required: false,
      },
      // POSTGRES_URL is an optional alias (e.g., Vercel Postgres injects this automatically).
      { name: "POSTGRES_URL", required: false },
    ],
  },
  {
    name: "urls",
    description: "Application URLs",
    variables: [
      { name: "NEXT_PUBLIC_APP_URL", required: true },
      { name: "NEXT_PUBLIC_API_URL", required: true },
      { name: "NEXT_PUBLIC_SEARCH_SERVICE_URL", required: false },
    ],
  },
  {
    name: "csrf",
    description: "Trusted same-origin mutation policy",
    variables: [{ name: "CSRF_TRUSTED_ORIGINS", required: false }],
  },
  {
    name: "cors",
    description: "Cross-origin request policy",
    variables: [
      { name: "CORS_ALLOWED_ORIGINS", required: false },
      { name: "CORS_DEV_ALLOWED_ORIGINS", required: false },
    ],
  },
  {
    name: "redis",
    description: "Upstash Redis Configuration",
    variables: [
      // PRIMARY: Upstash REST credentials — required for rate limiting and cache.
      // The REST client uses HTTP transport; no persistent TCP connections are created.
      // Both variables are injected at runtime by Vercel and are not available during
      // Next.js production build (phase-production-build), so they are listed in
      // BUILD_DEFERRED_SERVER_ONLY_REQUIRED_VARS below.
      {
        name: "UPSTASH_REDIS_REST_URL",
        required: true,
        validate: (v) => v.startsWith("https://"),
        errorMessage:
          "Must be a valid HTTPS Upstash REST URL (e.g. https://<db>.upstash.io)",
      },
      {
        name: "UPSTASH_REDIS_REST_TOKEN",
        required: true,
        errorMessage:
          "UPSTASH_REDIS_REST_TOKEN is required. Copy it from the Upstash dashboard.",
      },
      // BullMQ TCP endpoint — required only for services running queue workers.
      // Format: rediss://:TOKEN@<host>.upstash.io:6379
      // The token value is the same as UPSTASH_REDIS_REST_TOKEN.
      { name: "REDIS_URL", required: false },
      // LEGACY — the fields below are no longer used by the primary REST client
      // or the @upstash/ratelimit rate limiter. They are retained for backwards
      // compatibility during transition and for non-client packages that may still
      // reference them. Safe to remove from apps/client once all consumers have
      // been migrated to the Upstash REST path.
      { name: "REDIS_HOST", required: false, default: "localhost" },
      { name: "REDIS_PORT", required: false, default: "6379" },
      { name: "REDIS_PASSWORD", required: false },
      { name: "REDIS_DB", required: false, default: "0" },
      { name: "REDIS_TLS", required: false, default: "false" },
      { name: "REDIS_FAMILY", required: false, default: "4" },
      // LEGACY — REDIS_ENABLED is no longer meaningful for the REST client.
      // Rate limiting always uses Upstash REST when credentials are present.
      { name: "REDIS_ENABLED", required: false, default: "true" },
      { name: "RATE_LIMIT_BACKEND", required: false, default: "auto" },
    ],
  },
  {
    name: "storage",
    description: "Upload and storage configuration",
    variables: [
      { name: "S3_DISABLED", required: false, default: "true" },
      // Canonical R2 credentials/config
      { name: "R2_ENDPOINT", required: false },
      { name: "R2_ACCESS_KEY_ID", required: false },
      { name: "R2_SECRET_ACCESS_KEY", required: false },
      { name: "R2_REGION", required: false, default: "auto" },
      { name: "R2_ASSET_BUCKET", required: false },
      { name: "R2_PUBLIC_BASE_URL", required: false },
      // Legacy aliases kept for one release
      { name: "AWS_ACCESS_KEY_ID", required: false },
      { name: "AWS_SECRET_ACCESS_KEY", required: false },
      { name: "AWS_REGION", required: false, default: "af-south-1" },
      { name: "S3_ACCESS_KEY_ID", required: false },
      { name: "S3_SECRET_ACCESS_KEY", required: false },
      { name: "S3_REGION", required: false, default: "af-south-1" },
      { name: "S3_URL", required: false },
      { name: "S3_EU_URL", required: false },
      { name: "S3_ASSET_BUCKET", required: false },
      { name: "STORAGE_PROVIDER", required: false, default: "local" },
      { name: "UPLOAD_DIR", required: false, default: "./public/uploads" },
      { name: "STORAGE_BUCKET", required: false },
      { name: "STORAGE_REGION", required: false, default: "eu" },
      { name: "CDN_URL", required: false, default: "/uploads" },
    ],
  },
  {
    name: "services",
    description: "Internal Services",
    variables: [
      { name: "MESSAGING_SERVICE_URL", required: false },
      // FIX: NEXT_PUBLIC_MESSAGING_SERVICE_URL was used in buildEnvConfig but absent
      // from envGroups, causing check-env-contract.mjs false negatives.
      { name: "NEXT_PUBLIC_MESSAGING_SERVICE_URL", required: false },
      { name: "NOTIFICATION_SERVICE_URL", required: false },
      { name: "HCAPTCHA_SECRET_KEY", required: false },
      { name: "INTERNAL_API_SECRET", required: false },
    ],
  },
  {
    name: "encryption",
    description: "Encryption Keys",
    variables: [
      {
        name: "ENCRYPTION_KEY_V1",
        required: true,
        validate: (v) => /^[0-9a-f]{64}$/i.test(v),
        errorMessage:
          "Must be 64 hex characters (32 bytes) — generate with: openssl rand -hex 32",
      },
      { name: "CURRENT_KEY_VERSION", required: false, default: "v1" },
      { name: "ENCRYPTION_KEY_V2", required: false },
      { name: "ENCRYPTION_KEY_V3", required: false },
      { name: "ENCRYPTION_KEY_V4", required: false },
      { name: "ENCRYPTION_KEY_V5", required: false },
      // Legacy fallback key for backward-compatible decryption
      { name: "ENCRYPTION_KEY", required: false },
    ],
  },
  {
    name: "email",
    description: "Email Service",
    variables: [
      { name: "RESEND_API_KEY", required: false },
      { name: "SMTP_HOST", required: false },
      { name: "SMTP_FROM", required: false },
    ],
  },
  {
    name: "webhooks",
    description: "Webhook replay and freshness controls",
    variables: [
      {
        name: "CLERK_WEBHOOK_REPLAY_WINDOW_SECONDS",
        required: false,
        default: "300",
      },
      {
        name: "CLERK_WEBHOOK_PROCESSING_TTL_SECONDS",
        required: false,
        default: "120",
      },
      {
        name: "CLERK_WEBHOOK_PROCESSED_TTL_SECONDS",
        required: false,
        default: "86400",
      },
    ],
  },
  {
    name: "maintenance",
    description: "Scheduled maintenance jobs",
    variables: [
      { name: "EXPORT_CLEANUP_CRON", required: false, default: "0 2 * * *" },
      { name: "DATA_RETENTION_CRON", required: false, default: "0 3 * * *" },
      {
        name: "ANONYMIZATION_BATCH_CRON",
        required: false,
        default: "0 4 * * *",
      },
      { name: "ASSET_CLEANUP_CRON", required: false, default: "0 5 * * *" },
      {
        name: "ONBOARDING_UPLOAD_CLEANUP_CRON",
        required: false,
        default: "0 3 * * *",
      },
      {
        name: "UPLOAD_PROCESS_INLINE",
        required: false,
        default: "false",
      },
      {
        name: "UPLOAD_STATUS_TTL_SECONDS",
        required: false,
        default: "1800",
      },
      { name: "EXPORT_CLEANUP_BATCH_SIZE", required: false, default: "100" },
      { name: "EXPORT_CLEANUP_MAX_RETRIES", required: false, default: "3" },
      { name: "RETENTION_BATCH_SIZE", required: false, default: "100" },
      { name: "ANONYMIZATION_BATCH_SIZE", required: false, default: "50" },
      { name: "CLEANUP_BATCH_SIZE", required: false, default: "100" },
      {
        name: "ODPC_EMAIL",
        required: false,
        default: "dataprotection@odpc.go.ke",
      },
      // Set to "true" in CI environments to suppress BullMQ queue initialisation.
      // Guards in initializeAllSchedulers() check envConfig.jobs.disableBackgroundJobs.
      { name: "DISABLE_BACKGROUND_JOBS", required: false, default: "false" },
    ],
  },
  {
    name: "gdpr",
    description: "GDPR Compliance",
    variables: [
      { name: "EXPORT_EXPIRY_HOURS", required: false, default: "48" },
      { name: "DELETION_GRACE_PERIOD_DAYS", required: false, default: "30" },
      {
        name: "DPO_EMAIL",
        required: false,
        default: "security@buildmarket.co.ke",
      },
      { name: "ENCRYPTION_MIGRATION_MODE", required: false, default: "false" },
      { name: "LEGACY_FORMAT_DEADLINE", required: false },
      { name: "ROTATION_BATCH_SIZE", required: false, default: "100" },
    ],
  },
  {
    name: "s3exports",
    description: "S3 Export Buckets",
    variables: [
      { name: "R2_EXPORT_BUCKET", required: false },
      { name: "S3_EXPORT_BUCKET", required: false },
      { name: "EXPORTS_BUCKET_NAME", required: false },
      { name: "EXPORT_LOCAL_DIR", required: false, default: "./temp-exports" },
    ],
  },
  {
    name: "analytics",
    description: "Analytics and Telemetry",
    variables: [
      { name: "NEXT_PUBLIC_POSTHOG_KEY", required: false },
      {
        name: "NEXT_PUBLIC_POSTHOG_HOST",
        required: false,
        default: "https://us.i.posthog.com",
      },
    ],
  },
  {
    name: "ai",
    description: "AI / LLM Integrations",
    variables: [
      // FIX: NEXT_PUBLIC_GEMINI_API_KEY was present in buildEnvConfig but missing
      // from envGroups, causing check-env-contract.mjs to flag it as undeclared.
      { name: "NEXT_PUBLIC_GEMINI_API_KEY", required: false },
    ],
  },
  {
    name: "localDev",
    description: "Local-only developer auth bypass settings",
    variables: [
      { name: "BYPASS_AUTH", required: false, default: "false" },
      { name: "DEV_CLERK_ID", required: false, default: "user_local_dev" },
      {
        name: "DEV_DB_USER_ID",
        required: false,
        default: "00000000-0000-0000-0000-000000000000",
      },
      {
        name: "DEV_USER_EMAIL",
        required: false,
        default: "developer@example.com",
      },
      { name: "DEV_USER_ROLE", required: false, default: "PROFESSIONAL" },
    ],
  },
  {
    name: "nats",
    description: "NATS Messaging",
    variables: [
      { name: "NATS_URL", required: false, default: "nats://localhost:4222" },
      { name: "NATS_CLIENT_NAME", required: false },
      { name: "NATS_TOKEN", required: false },
      { name: "NATS_USER", required: false },
      { name: "NATS_PASS", required: false },
      {
        name: "NATS_MAX_RECONNECT_ATTEMPTS",
        required: false,
        default: "-1",
        validate: (v) => !isNaN(parseInt(v, 10)),
        errorMessage: "Must be a valid number",
      },
      {
        name: "NATS_RECONNECT_TIME_WAIT",
        required: false,
        default: "2000",
        validate: (v) => !isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0,
        errorMessage: "Must be a positive number",
      },
      {
        name: "NATS_TIMEOUT",
        required: false,
        default: "10000",
        validate: (v) => !isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0,
        errorMessage: "Must be a positive number",
      },
    ],
  },
];

// ============================================
// Validation Functions
// ============================================

type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Server-only required variables that are deferred during Next.js production build
 * (NEXT_PHASE=phase-production-build). These variables are NOT available at build
 * time and are injected at runtime by the hosting platform (e.g., Vercel).
 *
 * NEXT_PUBLIC_* variables are intentionally excluded here because Vercel DOES
 * inject them at build time — they must be present before the first deployment.
 */
const BUILD_DEFERRED_SERVER_ONLY_REQUIRED_VARS = new Set<string>([
  "AUTH_SECRET",
  "CLERK_SECRET_KEY",
  "CLERK_WEBHOOK_SECRET",
  "DATABASE_URL",
  // DIRECT_URL is consumed only by the Prisma CLI (prisma migrate deploy / dev).
  // It is never read at Next.js runtime, so it is deferred like DATABASE_URL.
  "DIRECT_URL",
  "ENCRYPTION_KEY_V1",
  // Upstash credentials are runtime-injected by Vercel; not available at build time.
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
]);

function shouldDeferServerOnlyValidationForBuild(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

function isEdgeRuntime(): boolean {
  if (process.env.NEXT_RUNTIME === "edge") {
    return true;
  }

  const runtimeMarker = (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime;
  return typeof runtimeMarker === "string";
}

/**
 * Validates environment variables for specified groups.
 * @param groups - Array of group names to validate, or 'all' for all groups
 * @param throwOnError - Whether to throw an error on validation failure (default: true)
 */
export function validateEnv(
  groups: string[] | "all" = "all",
  throwOnError = true,
): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  const groupsToValidate =
    groups === "all"
      ? envGroups
      : envGroups.filter((g) => groups.includes(g.name));
  const deferServerOnlyRequiredErrors =
    shouldDeferServerOnlyValidationForBuild();

  for (const group of groupsToValidate) {
    for (const variable of group.variables) {
      const value = process.env[variable.name];

      // Check required variables
      if (variable.required && !value) {
        if (
          deferServerOnlyRequiredErrors &&
          BUILD_DEFERRED_SERVER_ONLY_REQUIRED_VARS.has(variable.name)
        ) {
          result.warnings.push(
            `[${group.name}] Deferring required server env until runtime: ${variable.name}`,
          );
          continue;
        }

        result.valid = false;
        result.errors.push(
          `[${group.name}] Missing required: ${variable.name}`,
        );
        continue;
      }

      // Skip validation for missing optional variables
      if (!value) {
        if (variable.default) {
          result.warnings.push(
            `[${group.name}] Using default for ${variable.name}: ${variable.default}`,
          );
        }
        continue;
      }

      // Run custom validation
      if (variable.validate && !variable.validate(value)) {
        result.valid = false;
        result.errors.push(
          `[${group.name}] Invalid ${variable.name}: ${variable.errorMessage || "Validation failed"}`,
        );
      }
    }
  }

  const validatesRedisGroup = groupsToValidate.some(
    (group) => group.name === "redis",
  );
  if (validatesRedisGroup) {
    validateRedisRateLimitReadiness(result);
  }

  const validatesStorageGroup = groupsToValidate.some(
    (group) => group.name === "storage" || group.name === "s3exports",
  );
  if (validatesStorageGroup) {
    validateStorageRemoteReadiness(result);
  }

  // Log results
  if (result.errors.length > 0) {
    console.error("\n❌ Environment validation errors:");
    result.errors.forEach((e) => console.error(`   ${e}`));
  }

  if (result.warnings.length > 0 && process.env.NODE_ENV === "development") {
    console.warn("\n⚠️  Environment warnings:");
    result.warnings.forEach((w) => console.warn(`   ${w}`));
  }

  if (throwOnError && !result.valid) {
    throw new Error(
      `Environment validation failed:\n${result.errors.join("\n")}\n\nSee .env.example for required variables.`,
    );
  }

  return result;
}

// ============================================
// Helper Functions (boundary-safe)
// ============================================

function getStringEnv(name: string, fallback = ""): string {
  return process.env[name] || fallback;
}

/**
 * Returns undefined instead of empty string for optional secrets.
 * Use this for credentials that must be absent (not empty) when not configured.
 */
function getOptionalStringEnv(name: string): string | undefined {
  const value = getStringEnv(name);
  return value.length > 0 ? value : undefined;
}

function getBooleanEnv(name: string, fallback = false): boolean {
  const value = process.env[name];
  return value === undefined ? fallback : value === "true";
}

function getNumberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function getRateLimitBackendEnv(
  name: string,
  fallback: RateLimitBackendMode,
): RateLimitBackendMode {
  const value = getStringEnv(name, fallback).toLowerCase();
  if (value === "auto" || value === "memory" || value === "redis") {
    return value;
  }

  return fallback;
}

function isRedisRateLimitBackendRequired(
  nodeEnv: string,
  backend: RateLimitBackendMode,
): boolean {
  if (backend === "redis") {
    return true;
  }

  return backend === "auto" && nodeEnv === "production";
}

/**
 * Validates that Upstash REST credentials are present when Redis rate limiting
 * is required at runtime (production, or explicit RATE_LIMIT_BACKEND=redis).
 *
 * The previous host/port/REDIS_ENABLED check has been removed: the rate limiter
 * now uses @upstash/ratelimit over the REST transport, not ioredis over TCP.
 * REDIS_ENABLED and REDIS_HOST/REDIS_PORT are legacy fields that are no longer
 * consulted by the primary client or rate limiter.
 */
function validateRedisRateLimitReadiness(result: ValidationResult): void {
  const nodeEnv = getStringEnv("NODE_ENV", "development");
  const rateLimitBackend = getRateLimitBackendEnv("RATE_LIMIT_BACKEND", "auto");

  if (!isRedisRateLimitBackendRequired(nodeEnv, rateLimitBackend)) {
    return;
  }

  if (shouldDeferServerOnlyValidationForBuild()) {
    result.warnings.push(
      `[redis] Deferring Upstash credential checks until runtime (backend=${rateLimitBackend}, env=${nodeEnv}).`,
    );
    return;
  }

  const upstashUrl = getOptionalStringEnv("UPSTASH_REDIS_REST_URL");
  const upstashToken = getOptionalStringEnv("UPSTASH_REDIS_REST_TOKEN");

  if (!upstashUrl) {
    result.valid = false;
    result.errors.push(
      "[redis] UPSTASH_REDIS_REST_URL is required for rate limiting in production. " +
        "Set it to your Upstash REST endpoint (https://<db>.upstash.io).",
    );
  } else if (!upstashUrl.startsWith("https://")) {
    result.valid = false;
    result.errors.push(
      "[redis] UPSTASH_REDIS_REST_URL must start with https://. " +
        `Received: ${upstashUrl.slice(0, 40)}`,
    );
  }

  if (!upstashToken) {
    result.valid = false;
    result.errors.push(
      "[redis] UPSTASH_REDIS_REST_TOKEN is required for rate limiting in production. " +
        "Copy it from the Upstash dashboard.",
    );
  }
}

function parseOriginList(raw?: string): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Enforces a fail-closed production posture for remote storage when the S3-compatible
 * provider path is enabled (AWS S3 or Cloudflare R2 via AWS SDK).
 */
function validateStorageRemoteReadiness(result: ValidationResult): void {
  const nodeEnv = getStringEnv("NODE_ENV", "development");
  const isProd = nodeEnv === "production";
  const storageProvider = getStringEnv("STORAGE_PROVIDER", "local");
  const s3Disabled = getBooleanEnv("S3_DISABLED", true);
  const remoteStorageEnabled = storageProvider === "s3" || !s3Disabled;

  if (!isProd || !remoteStorageEnabled) {
    return;
  }

  if (shouldDeferServerOnlyValidationForBuild()) {
    result.warnings.push(
      "[storage] Deferring remote storage credential checks until runtime.",
    );
    return;
  }

  const endpoint =
    getOptionalStringEnv("R2_ENDPOINT") ?? getOptionalStringEnv("S3_URL");
  const accessKeyId =
    getOptionalStringEnv("R2_ACCESS_KEY_ID") ??
    getOptionalStringEnv("AWS_ACCESS_KEY_ID") ??
    getOptionalStringEnv("S3_ACCESS_KEY_ID");
  const secretAccessKey =
    getOptionalStringEnv("R2_SECRET_ACCESS_KEY") ??
    getOptionalStringEnv("AWS_SECRET_ACCESS_KEY") ??
    getOptionalStringEnv("S3_SECRET_ACCESS_KEY");
  const assetBucket =
    getOptionalStringEnv("R2_ASSET_BUCKET") ??
    getOptionalStringEnv("STORAGE_BUCKET") ??
    getOptionalStringEnv("S3_ASSET_BUCKET");
  const publicBaseUrl =
    getOptionalStringEnv("R2_PUBLIC_BASE_URL") ??
    getOptionalStringEnv("CDN_URL");

  if (!endpoint || !isAbsoluteHttpUrl(endpoint)) {
    result.valid = false;
    result.errors.push(
      "[storage] R2_ENDPOINT (or S3_URL alias) must be an absolute HTTP(S) URL when remote storage is enabled in production.",
    );
  }

  if (!accessKeyId) {
    result.valid = false;
    result.errors.push(
      "[storage] R2_ACCESS_KEY_ID (or AWS_ACCESS_KEY_ID/S3_ACCESS_KEY_ID alias) is required when remote storage is enabled in production.",
    );
  }

  if (!secretAccessKey) {
    result.valid = false;
    result.errors.push(
      "[storage] R2_SECRET_ACCESS_KEY (or AWS_SECRET_ACCESS_KEY/S3_SECRET_ACCESS_KEY alias) is required when remote storage is enabled in production.",
    );
  }

  if (!assetBucket) {
    result.valid = false;
    result.errors.push(
      "[storage] R2_ASSET_BUCKET (or STORAGE_BUCKET/S3_ASSET_BUCKET alias) is required when remote storage is enabled in production.",
    );
  }

  if (!publicBaseUrl || !isAbsoluteHttpUrl(publicBaseUrl)) {
    result.valid = false;
    result.errors.push(
      "[storage] R2_PUBLIC_BASE_URL (or CDN_URL alias) must be an absolute HTTP(S) URL when remote storage is enabled in production.",
    );
  }
}

// ============================================
// Config Builder
// ============================================

function buildEnvConfig() {
  const nodeEnv = getStringEnv("NODE_ENV", "development");
  const isDev = nodeEnv === "development";
  const isProd = nodeEnv === "production";
  const isTest = nodeEnv === "test";
  const edgeRuntime = isEdgeRuntime();
  const uploadProcessInline = getBooleanEnv(
    "UPLOAD_PROCESS_INLINE",
    isDev || isTest,
  );

  const resolvedStorageAccessKeyId =
    getOptionalStringEnv("R2_ACCESS_KEY_ID") ??
    getOptionalStringEnv("AWS_ACCESS_KEY_ID") ??
    getOptionalStringEnv("S3_ACCESS_KEY_ID");
  const resolvedStorageSecretAccessKey =
    getOptionalStringEnv("R2_SECRET_ACCESS_KEY") ??
    getOptionalStringEnv("AWS_SECRET_ACCESS_KEY") ??
    getOptionalStringEnv("S3_SECRET_ACCESS_KEY");
  const resolvedStorageEndpoint =
    getOptionalStringEnv("R2_ENDPOINT") ?? getOptionalStringEnv("S3_URL");
  const resolvedStorageAssetBucket =
    getOptionalStringEnv("R2_ASSET_BUCKET") ??
    getOptionalStringEnv("STORAGE_BUCKET") ??
    getOptionalStringEnv("S3_ASSET_BUCKET");
  const resolvedStoragePublicBaseUrl = getStringEnv(
    "R2_PUBLIC_BASE_URL",
    getStringEnv("CDN_URL", "/uploads"),
  );
  const resolvedStorageRegion = getStringEnv(
    "R2_REGION",
    getStringEnv(
      "STORAGE_REGION",
      getStringEnv("AWS_REGION", getStringEnv("S3_REGION", "auto")),
    ),
  );
  const resolvedExportBucket =
    getOptionalStringEnv("R2_EXPORT_BUCKET") ??
    getOptionalStringEnv("S3_EXPORT_BUCKET") ??
    getOptionalStringEnv("EXPORTS_BUCKET_NAME") ??
    "buildmarket-exports";

  // Middleware and other edge entry points must not fail import-time on
  // node-only startup invariants. Node runtimes still enforce this strictly.
  if (!edgeRuntime) {
    assertUploadProcessingModeInvariant({
      isProd,
      uploadProcessInline,
    });
  }

  return {
    // Environment
    nodeEnv,
    isDev,
    isProd,
    isTest,
    isCI: getBooleanEnv("CI"),
    isBuildPhase: process.env.NEXT_PHASE === "phase-production-build",

    // URLs
    appUrl: getStringEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3500"),
    apiUrl: getStringEnv("NEXT_PUBLIC_API_URL", "http://localhost:3500/api"),
    appVersion: getStringEnv("npm_package_version", "0.1.0"),

    // Local-only auth bypass
    auth: {
      bypassEnabled: getBooleanEnv("BYPASS_AUTH"),
      devActor: {
        clerkId: getStringEnv(
          "DEV_CLERK_ID",
          "user_35Z6M7pKOJKZB9yNEZvS5udrrGo",
        ),
        dbUserId: getStringEnv(
          "DEV_DB_USER_ID",
          "929c4dd1-b8c2-416e-872d-068abdb80c40",
        ),
        userEmail: getStringEnv("DEV_USER_EMAIL", "developer@example.com"),
        userRole: getStringEnv("DEV_USER_ROLE", "PROFESSIONAL") as AppUserRole,
      },
      oauth: {
        google: {
          clientId: getOptionalStringEnv("GOOGLE_CLIENT_ID"),
          clientSecret: getOptionalStringEnv("GOOGLE_CLIENT_SECRET"),
        },
        github: {
          clientId: getOptionalStringEnv("GITHUB_CLIENT_ID"),
          clientSecret: getOptionalStringEnv("GITHUB_CLIENT_SECRET"),
        },
        facebook: {
          clientId: getOptionalStringEnv("FACEBOOK_CLIENT_ID"),
          clientSecret: getOptionalStringEnv("FACEBOOK_CLIENT_SECRET"),
        },
        azureAd: {
          clientId: getOptionalStringEnv("AZURE_AD_CLIENT_ID"),
          clientSecret: getOptionalStringEnv("AZURE_AD_CLIENT_SECRET"),
          tenantId: getStringEnv("AZURE_AD_TENANT_ID", "common"),
        },
      },
    },

    // CORS — FIX: use helper functions instead of direct process.env access
    cors: {
      allowedOrigins: parseOriginList(
        getOptionalStringEnv("CORS_ALLOWED_ORIGINS"),
      ),
      devAllowedOrigins: parseOriginList(
        getOptionalStringEnv("CORS_DEV_ALLOWED_ORIGINS"),
      ),
    },

    // CSRF / same-origin mutation protection — FIX: use helper
    csrf: {
      trustedOrigins: parseOriginList(
        getOptionalStringEnv("CSRF_TRUSTED_ORIGINS"),
      ),
    },

    // Clerk
    clerk: {
      publishableKey: getStringEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
      frontendApi: getOptionalStringEnv("NEXT_PUBLIC_CLERK_FRONTEND_API"),
      secretKey: getOptionalStringEnv("CLERK_SECRET_KEY"),
      webhookSecret: getOptionalStringEnv("CLERK_WEBHOOK_SECRET"),
      replayWindowSeconds: getNumberEnv(
        "CLERK_WEBHOOK_REPLAY_WINDOW_SECONDS",
        300,
      ),
      processingTtlSeconds: getNumberEnv(
        "CLERK_WEBHOOK_PROCESSING_TTL_SECONDS",
        120,
      ),
      processedTtlSeconds: getNumberEnv(
        "CLERK_WEBHOOK_PROCESSED_TTL_SECONDS",
        86400,
      ),
    },

    // Database
    databaseUrl: getOptionalStringEnv("DATABASE_URL"),
    // DIRECT_URL is used only by the Prisma CLI — never at Next.js runtime.
    // Exposed here so callers can inspect it without violating the ADR-004 boundary.
    directUrl: getOptionalStringEnv("DIRECT_URL"),
    // FIX: POSTGRES_URL is now declared in envGroups. It's an alias Vercel Postgres injects.
    postgresUrl:
      getOptionalStringEnv("POSTGRES_URL") ??
      getOptionalStringEnv("DATABASE_URL"),

    // Supabase project credentials
    // url and anonKey are safe for server-side use. serviceRoleKey bypasses RLS
    // and must never be passed to client components or prefixed NEXT_PUBLIC_.
    supabase: {
      url: getOptionalStringEnv("SUPABASE_URL"),
      anonKey: getOptionalStringEnv("SUPABASE_ANON_KEY"),
      serviceRoleKey: getOptionalStringEnv("SUPABASE_SERVICE_ROLE_KEY"),
    },

    // Redis / Upstash
    // upstashRestUrl and upstashRestToken are the primary credentials for the
    // @upstash/redis REST client used by rate limiting and cache.
    // url is the TCP endpoint for BullMQ workers (ioredis).
    // The remaining fields are legacy/deprecated; retained for packages outside
    // apps/client that still read them during the transition period.
    redis: {
      // PRIMARY — Upstash REST transport (serverless / Next.js / edge)
      upstashRestUrl: getOptionalStringEnv("UPSTASH_REDIS_REST_URL"),
      upstashRestToken: getOptionalStringEnv("UPSTASH_REDIS_REST_TOKEN"),
      // BullMQ TCP transport — long-running worker processes only
      url: getOptionalStringEnv("REDIS_URL"),
      // Rate-limit backend selection (auto | memory | redis).
      // "auto" resolves to Upstash REST in production when credentials are present.
      rateLimitBackend: getRateLimitBackendEnv("RATE_LIMIT_BACKEND", "auto"),
      // @deprecated — no longer consulted by the REST client or rate limiter.
      enabled: getBooleanEnv("REDIS_ENABLED", true),
      host: getStringEnv("REDIS_HOST", "localhost"),
      port: getNumberEnv("REDIS_PORT", 6379),
      password: getOptionalStringEnv("REDIS_PASSWORD"),
      db: getNumberEnv("REDIS_DB", 0),
      tls: getBooleanEnv("REDIS_TLS"),
    },

    // Storage — FIX: replaced direct process.env.AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
    // with getOptionalStringEnv to stay within the ADR-004 boundary.
    storage: {
      provider: getStringEnv("STORAGE_PROVIDER", "local") as
        | "local"
        | "s3"
        | "gcs",
      localPath: getStringEnv("UPLOAD_DIR", "./public/uploads"),
      bucket: resolvedStorageAssetBucket,
      region: resolvedStorageRegion,
      endpoint: resolvedStorageEndpoint,
      cdnUrl: resolvedStoragePublicBaseUrl,
      publicBaseUrl: resolvedStoragePublicBaseUrl,
      s3Disabled: getBooleanEnv("S3_DISABLED", true),
      assetBucket: resolvedStorageAssetBucket ?? "buildmarket-assets",
      awsRegion: resolvedStorageRegion,
      accessKeyId: resolvedStorageAccessKeyId,
      secretAccessKey: resolvedStorageSecretAccessKey,
    },

    // Services — FIX: messagingPublic now reads the correct variable name
    services: {
      messaging: getStringEnv("MESSAGING_SERVICE_URL", "http://localhost:3010"),
      messagingPublic: getStringEnv(
        "NEXT_PUBLIC_MESSAGING_SERVICE_URL",
        "http://localhost:3010",
      ),
      notification: getStringEnv(
        "NOTIFICATION_SERVICE_URL",
        "http://localhost:3011",
      ),
      search: getStringEnv(
        "NEXT_PUBLIC_SEARCH_SERVICE_URL",
        "http://localhost:3005",
      ),
      hcaptchaSecretKey: getOptionalStringEnv("HCAPTCHA_SECRET_KEY"),
      internalApiSecret: getOptionalStringEnv("INTERNAL_API_SECRET"),
    },

    // Feature Flags
    features: {
      notifications: getBooleanEnv("ENABLE_NOTIFICATION_SERVICE"),
      gdpr: getBooleanEnv("ENABLE_GDPR_FEATURES"),
      encryption: getBooleanEnv("ENABLE_ENCRYPTION"),
      auditLogging: getBooleanEnv("ENABLE_AUDIT_LOGGING"),
    },

    analytics: {
      posthogKey: getOptionalStringEnv("NEXT_PUBLIC_POSTHOG_KEY"),
      posthogHost: getStringEnv(
        "NEXT_PUBLIC_POSTHOG_HOST",
        "https://us.i.posthog.com",
      ),
    },

    // FIX: NEXT_PUBLIC_GEMINI_API_KEY is now in envGroups (ai group) and uses
    // getOptionalStringEnv so absence returns undefined rather than empty string.
    ai: {
      geminiApiKey: getOptionalStringEnv("NEXT_PUBLIC_GEMINI_API_KEY"),
    },

    // GDPR
    gdpr: {
      exportExpiryHours: getNumberEnv("EXPORT_EXPIRY_HOURS", 48),
      deletionGraceDays: getNumberEnv("DELETION_GRACE_PERIOD_DAYS", 30),
      dpoEmail: getStringEnv("DPO_EMAIL", "security@buildmarket.co.ke"),
      odpcEmail: getStringEnv("ODPC_EMAIL", "dataprotection@odpc.go.ke"),
    },

    // S3 exports — FIX: replaced direct process.env access with helpers
    s3: {
      disabled: getBooleanEnv("S3_DISABLED", true),
      region: resolvedStorageRegion,
      endpoint: resolvedStorageEndpoint,
      exportBucket: resolvedExportBucket,
      localDir: getStringEnv("EXPORT_LOCAL_DIR", "./temp-exports"),
      accessKeyId: resolvedStorageAccessKeyId,
      secretAccessKey: resolvedStorageSecretAccessKey,
    },

    // Encryption
    encryption: {
      currentVersion: getStringEnv("CURRENT_KEY_VERSION", "v1"),
      migrationMode: getBooleanEnv("ENCRYPTION_MIGRATION_MODE"),
      legacyDeadline: getOptionalStringEnv("LEGACY_FORMAT_DEADLINE"),
      legacyKey: getOptionalStringEnv("ENCRYPTION_KEY"),
      keys: {
        v1: getOptionalStringEnv("ENCRYPTION_KEY_V1"),
        v2: getOptionalStringEnv("ENCRYPTION_KEY_V2"),
        v3: getOptionalStringEnv("ENCRYPTION_KEY_V3"),
        v4: getOptionalStringEnv("ENCRYPTION_KEY_V4"),
        v5: getOptionalStringEnv("ENCRYPTION_KEY_V5"),
      },
      batchSize: getNumberEnv("ROTATION_BATCH_SIZE", 100),
    },

    // Maintenance jobs
    jobs: {
      exportCleanupCron: getStringEnv("EXPORT_CLEANUP_CRON", "0 2 * * *"),
      dataRetentionCron: getStringEnv("DATA_RETENTION_CRON", "0 3 * * *"),
      anonymizationBatchCron: getStringEnv(
        "ANONYMIZATION_BATCH_CRON",
        "0 4 * * *",
      ),
      assetCleanupCron: getStringEnv("ASSET_CLEANUP_CRON", "0 5 * * *"),
      onboardingUploadCleanupCron: getStringEnv(
        "ONBOARDING_UPLOAD_CLEANUP_CRON",
        "0 3 * * *",
      ),
      uploadProcessInline,
      uploadStatusTtlSeconds: getNumberEnv("UPLOAD_STATUS_TTL_SECONDS", 1800),
      exportCleanupBatchSize: getNumberEnv("EXPORT_CLEANUP_BATCH_SIZE", 100),
      exportCleanupMaxRetries: getNumberEnv("EXPORT_CLEANUP_MAX_RETRIES", 3),
      retentionBatchSize: getNumberEnv("RETENTION_BATCH_SIZE", 100),
      anonymizationBatchSize: getNumberEnv("ANONYMIZATION_BATCH_SIZE", 50),
      cleanupBatchSize: getNumberEnv("CLEANUP_BATCH_SIZE", 100),
      disableBackgroundJobs: getBooleanEnv("DISABLE_BACKGROUND_JOBS"),
    },

    // NATS Messaging — FIX: replaced all direct process.env access with helpers
    nats: {
      url: getStringEnv("NATS_URL", "nats://localhost:4222"),
      clientName: getStringEnv("NATS_CLIENT_NAME", `build-market-${nodeEnv}`),
      token: getOptionalStringEnv("NATS_TOKEN"),
      user: getOptionalStringEnv("NATS_USER"),
      pass: getOptionalStringEnv("NATS_PASS"),
      reconnect: true,
      maxReconnectAttempts: getNumberEnv("NATS_MAX_RECONNECT_ATTEMPTS", -1),
      reconnectTimeWait: getNumberEnv(
        "NATS_RECONNECT_TIME_WAIT",
        isProd ? 2000 : 1000,
      ),
      timeout: getNumberEnv("NATS_TIMEOUT", isProd ? 10000 : 5000),
      verboseLogging: isDev,
    },
  } as const;
}

// ============================================
// Type-Safe Environment Config
// ============================================

/**
 * Type-safe environment configuration.
 * Access environment variables with proper types and defaults.
 * Import this instead of reading process.env directly (ADR-004).
 */
export const envConfig = buildEnvConfig();

// ============================================
// Auto-validate on import (server runtime only)
// ============================================

if (
  typeof window === "undefined" &&
  process.env.NODE_ENV !== "test" &&
  !isEdgeRuntime()
) {
  const startupGroups = ["clerk", "database", "supabase", "urls", "encryption"];
  const remoteStorageEnabled =
    getStringEnv("STORAGE_PROVIDER", "local") === "s3" ||
    !getBooleanEnv("S3_DISABLED", true);

  // Always validate Upstash credentials in production — the REST client and
  // rate limiter require them regardless of RATE_LIMIT_BACKEND setting.
  // In development/test, only add the redis group when explicitly configured
  // to use Redis so local dev without Upstash credentials still boots.
  if (
    process.env.NODE_ENV === "production" ||
    isRedisRateLimitBackendRequired(
      getStringEnv("NODE_ENV", "development"),
      getRateLimitBackendEnv("RATE_LIMIT_BACKEND", "auto"),
    )
  ) {
    startupGroups.push("redis");
  }

  if (process.env.NODE_ENV === "production" || remoteStorageEnabled) {
    startupGroups.push("storage", "s3exports");
  }

  validateEnv(startupGroups);
}

export default envConfig;
export function getEnvConfig() {
  return envConfig;
}
export const env = envConfig;
