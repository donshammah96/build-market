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
 *
 * @build/env-validation (Drift 2):
 *   The EnvVar/EnvGroup *types* and the getStringEnv/getOptionalStringEnv/
 *   getBooleanEnv/isAbsoluteHttpUrl *primitives* below are now sourced from
 *   the shared `@build/env-validation` package instead of being a local
 *   copy — the same canonical engine apps/admin and apps/verification-ops
 *   use. This app's ~30 `envGroups` declarations and its Redis/storage
 *   readiness extensions stay local (they're this app's own contract, not
 *   shared behavior). See `validateEnv()` below for how the shared
 *   `validateEnvGroups()` core is composed with those app-specific checks.
 *
 *   NOTE ON A BEHAVIOR CHANGE: the shared package's `getBooleanEnv` accepts
 *   "true" / "1" / "yes" (case-insensitive) as truthy, where this file's
 *   previous local copy accepted only the exact string "true". This widens
 *   truthy-parsing for every boolean env var in this file (S3_DISABLED,
 *   ENABLE_GDPR_FEATURES, REDIS_TLS, etc.) — flagged here because it's a
 *   real behavior change, not just a refactor, even though it brings this
 *   app in line with how apps/admin/apps/verification-ops already parse
 *   booleans.
 */

import { assertUploadProcessingModeInvariant } from "./upload-processing-mode";
import {
  type EnvGroup,
  type ValidationResult,
  getBooleanEnv as getBooleanEnvFromObj,
  getOptionalStringEnv as getOptionalStringEnvFromObj,
  getStringEnv as getStringEnvFromObj,
  isAbsoluteHttpUrl,
  resolveDevAuthBypass,
  validateEnvGroups,
  validateSatelliteInvariants,
} from "@build/env-validation";

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
      // --- Satellite configuration ---------------------------------------
      // apps/client is the PRIMARY app (not expected to run as a Clerk
      // satellite), but these were previously undeclared here entirely —
      // meaning validateEnv() silently never checked them, and the values
      // actually consumed in buildEnvConfig()'s `clerk` block below were
      // read from the WRONG env var names (see Finding 6 fix there). They
      // are declared now for the same reason apps/admin and
      // apps/verification-ops declare them: if this app is ever pointed at
      // a non-default Clerk domain configuration, the individual-var
      // validation (in particular, "must be absolute" for
      // primarySignInUrl) actually fires instead of silently no-op'ing on
      // an undeclared variable.
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
          '(e.g. "https://buildmarket.app/sign-in"), not a relative path — that\'s ' +
          "what NEXT_PUBLIC_CLERK_SIGN_IN_URL is for.",
      },
      {
        name: "NEXT_PUBLIC_CLERK_SATELLITE_ORIGINS",
        required: false,
      },
      {
        name: "NEXT_PUBLIC_CSP_REPORT_ONLY",
        required: false,
        default: "false",
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
      { name: "NEXT_PUBLIC_ADMIN_APP_URL", required: false },
      { name: "NEXT_PUBLIC_VERIFICATION_APP_URL", required: false },
      { name: "NEXT_PUBLIC_VERIFICATION_OPS_URL", required: false },
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
        validate: (v) =>
          v.startsWith("https://") ||
          v.startsWith("http://127.0.0.1") ||
          v.startsWith("http://localhost"),
        errorMessage:
          "Must be a valid HTTPS Upstash REST URL (e.g. https://<db>.upstash.io) or local HTTP mock URL (e.g. http://127.0.0.1:8079)",
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
      { name: "R2_PRIVATE_BUCKET", required: false },
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
      { name: "S3_PRIVATE_BUCKET", required: false },
      { name: "STORAGE_PROVIDER", required: false, default: "local" },
      { name: "UPLOAD_DIR", required: false, default: "./public/uploads" },
      { name: "STORAGE_BUCKET", required: false },
      { name: "STORAGE_REGION", required: false, default: "eu" },
      { name: "CDN_URL", required: false, default: "/uploads" },
      {
        name: "R2_BUCKET_STAGED",
        required: false,
        default: "buildmarket-staged",
      },
      {
        name: "R2_BUCKET_VERIFIED_PRIVATE",
        required: false,
        default: "buildmarket-verified-private",
      },
      {
        name: "R2_BUCKET_QUARANTINE",
        required: false,
        default: "buildmarket-quarantine",
      },
      {
        name: "R2_SCAN_CALLBACK_URL",
        required: false,
        default: "/api/internal/uploads/scan-callback",
      },
      {
        name: "APP_CALLBACK_URL",
        required: false,
        default: "/api/internal/uploads/scan-callback",
      },
      {
        name: "CLOUDMERSIVE_API_KEY",
        required: false,
      },
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
      {
        name: "SCAN_CALLBACK_HMAC_SECRET",
        required: true,
        validate: (v) => v.length >= 32,
        errorMessage:
          "Must be at least 32 characters long for secure webhook HMAC validation (generate with: openssl rand -hex 32)",
      },
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
    name: "newsletter",
    description: "Newsletter / Email Service Provider (ESP) for footer signup",
    variables: [
      {
        name: "ESP_PROVIDER",
        required: false,
        default: "stub",
      },
      {
        name: "ESP_API_KEY",
        required: false,
      },
      {
        name: "ESP_LIST_ID",
        required: false,
      },
      {
        name: "RESEND_SEGMENT_ID",
        required: false,
      },
      {
        name: "RESEND_WEBHOOK_SECRET",
        required: false,
      },
      {
        name: "WORKER_HEALTH_PORT",
        required: false,
        default: "8080",
      },
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
        default: "security@buildmarket.app",
      },
      { name: "ENCRYPTION_MIGRATION_MODE", required: false, default: "false" },
      { name: "LEGACY_FORMAT_DEADLINE", required: false },
      { name: "ROTATION_BATCH_SIZE", required: false, default: "100" },
    ],
  },
  {
    name: "features",
    description: "Feature Flags and Strangler-Fig Rollouts",
    variables: [
      {
        name: "ENABLE_NOTIFICATION_SERVICE",
        required: false,
        default: "false",
      },
      { name: "ENABLE_GDPR_FEATURES", required: false, default: "true" },
      { name: "ENABLE_ENCRYPTION", required: false, default: "true" },
      { name: "ENABLE_AUDIT_LOGGING", required: false, default: "true" },
      {
        name: "ALLOW_MOCK_VIRUS_SCANNER",
        required: false,
        default: "false",
      },
      { name: "FEATURE_PORTAL_DASHBOARD_V2", required: false, default: "true" },
      { name: "FEATURE_PORTAL_LEADS_V2", required: false, default: "true" },
      { name: "FEATURE_PORTAL_FINANCE_V2", required: false, default: "true" },
      { name: "FEATURE_PORTAL_PROJECTS_V2", required: false, default: "true" },
      { name: "FEATURE_PORTAL_QUOTES_V2", required: false, default: "true" },
      { name: "FEATURE_PORTAL_STORES_V2", required: false, default: "true" },
      { name: "FEATURE_PORTAL_CALENDAR_V2", required: false, default: "true" },
      { name: "FEATURE_PORTAL_PORTFOLIO_V2", required: false, default: "true" },
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
      // Canonical flag (Drift 4) — BYPASS_AUTH is now the legacy fallback,
      // resolved together via @build/env-validation's resolveDevAuthBypass.
      { name: "AUTH_DEV_BYPASS", required: false, default: "false" },
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
  {
    name: "otel",
    description: "OpenTelemetry Tracing",
    variables: [
      {
        name: "OTEL_EXPORTER_OTLP_ENDPOINT",
        required: false,
      },
      {
        name: "OTEL_SERVICE_NAME",
        required: false,
      },
      {
        name: "OTEL_RESOURCE_ATTRIBUTES",
        required: false,
      },
    ],
  },
  {
    name: "regulators",
    description: "Regulator Verification API Credentials",
    variables: [
      { name: "REGULATOR_EBK_BASE_URL", required: false },
      { name: "REGULATOR_EBK_API_KEY", required: false },
      { name: "REGULATOR_EBK_SIGNING_SECRET", required: false },
      { name: "REGULATOR_BORAQS_BASE_URL", required: false },
      { name: "REGULATOR_BORAQS_API_KEY", required: false },
      { name: "REGULATOR_BORAQS_SIGNING_SECRET", required: false },
      { name: "REGULATOR_NCA_BASE_URL", required: false },
      { name: "REGULATOR_NCA_API_KEY", required: false },
      { name: "REGULATOR_NCA_SIGNING_SECRET", required: false },
      { name: "REGULATOR_EARB_BASE_URL", required: false },
      { name: "REGULATOR_EARB_API_KEY", required: false },
      { name: "REGULATOR_EARB_SIGNING_SECRET", required: false },
      { name: "REGULATOR_VRB_BASE_URL", required: false },
      { name: "REGULATOR_VRB_API_KEY", required: false },
      { name: "REGULATOR_VRB_SIGNING_SECRET", required: false },
      { name: "REGULATOR_ISK_BASE_URL", required: false },
      { name: "REGULATOR_ISK_API_KEY", required: false },
      { name: "REGULATOR_ISK_SIGNING_SECRET", required: false },
      { name: "REGULATOR_EPRA_BASE_URL", required: false },
      { name: "REGULATOR_EPRA_API_KEY", required: false },
      { name: "REGULATOR_EPRA_SIGNING_SECRET", required: false },
    ],
  },
];

// ============================================
// Validation Functions
// ============================================

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
  "SCAN_CALLBACK_HMAC_SECRET",
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
  const groupsToValidate =
    groups === "all"
      ? envGroups
      : envGroups.filter((g) => groups.includes(g.name));

  // Core per-variable validation (required/default/custom validate) now
  // delegated to @build/env-validation's validateEnvGroups — same engine
  // apps/admin and apps/verification-ops use. The app-specific extensions
  // below (Redis rate-limit readiness, remote storage readiness) still run
  // as a second pass over the same `result`, exactly as before.
  const result = validateEnvGroups(
    envGroups,
    process.env,
    groups,
    BUILD_DEFERRED_SERVER_ONLY_REQUIRED_VARS,
    shouldDeferServerOnlyValidationForBuild(),
  );

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
//
// getStringEnv/getOptionalStringEnv/getBooleanEnv are now thin
// process.env-bound wrappers over @build/env-validation's shared
// primitives (Drift 2) rather than a local re-implementation. Every
// existing call site in this file (`getStringEnv("X", "default")`, etc.)
// is unchanged — only the underlying implementation moved.

function getStringEnv(name: string, fallback = ""): string {
  return getStringEnvFromObj(process.env, name, fallback);
}

/**
 * Returns undefined instead of empty string for optional secrets.
 * Use this for credentials that must be absent (not empty) when not configured.
 */
function getOptionalStringEnv(name: string): string | undefined {
  return getOptionalStringEnvFromObj(process.env, name);
}

function getBooleanEnv(name: string, fallback = false): boolean {
  return getBooleanEnvFromObj(process.env, name, fallback);
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
  } else if (
    !upstashUrl.startsWith("https://") &&
    !upstashUrl.startsWith("http://127.0.0.1") &&
    !upstashUrl.startsWith("http://localhost")
  ) {
    result.valid = false;
    result.errors.push(
      "[redis] UPSTASH_REDIS_REST_URL must start with https:// (or http://127.0.0.1 / http://localhost for local/CI mocks). " +
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

// isAbsoluteHttpUrl now imported from @build/env-validation (Drift 2) —
// the local copy previously here was a byte-for-byte duplicate.

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
  const privateBucket =
    getOptionalStringEnv("R2_PRIVATE_BUCKET") ??
    getOptionalStringEnv("S3_PRIVATE_BUCKET");
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

  if (!privateBucket) {
    result.valid = false;
    result.errors.push(
      "[storage] R2_PRIVATE_BUCKET (or S3_PRIVATE_BUCKET alias) is required for private document uploads when remote storage is enabled in production.",
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
  const resolvedStoragePrivateBucket =
    getOptionalStringEnv("R2_PRIVATE_BUCKET") ??
    getOptionalStringEnv("S3_PRIVATE_BUCKET");
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

  // Clerk — pulled out to a local const (rather than inline in the return
  // object below) so validateSatelliteInvariants() can run against it
  // before buildEnvConfig() returns, matching the pattern in apps/admin's
  // env-wrapper.ts. apps/client is the PRIMARY app and isSatellite should
  // be false in every real deployment, but the check runs unconditionally
  // (it's a no-op when isSatellite is false) so a future misconfiguration
  // doesn't rely on someone remembering to add this check when satellite
  // mode is first turned on here.
  const clerk = {
    publishableKey: getStringEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    frontendApi: getOptionalStringEnv("NEXT_PUBLIC_CLERK_FRONTEND_API"),
    secretKey: getOptionalStringEnv("CLERK_SECRET_KEY"),
    webhookSecret:
      getOptionalStringEnv("CLERK_WEBHOOK_SECRET") ||
      getOptionalStringEnv("CLERK_WEBHOOK_SIGNING_SECRET"),
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
    // FIX (most severe finding in this pass): these three previously read
    // from the WRONG env var names entirely — "CLERK_IS_SATELLITE" and
    // "CLERK_DOMAIN" (no NEXT_PUBLIC_ prefix, so never actually set by any
    // deploy) and, worse, primarySignInUrl was reading
    // NEXT_PUBLIC_CLERK_SIGN_IN_URL — the *relative* sign-in path
    // variable, not NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL at all. That's
    // not "borrowing a fallback" (Finding 6's usual shape elsewhere in
    // this codebase) — it was the ONLY source, guaranteed to fail
    // isAbsoluteHttpUrl() in any consumer, on every request, in every
    // environment. Since apps/client's own envGroups declaration above
    // never declared these three vars either, validateEnv() also never
    // caught it. Fixed on both ends: declared above, and read from the
    // correct NEXT_PUBLIC_-prefixed names below with primarySignInUrl
    // resolving strictly (no relative-path fallback of any kind).
    isSatellite: getBooleanEnv("NEXT_PUBLIC_CLERK_IS_SATELLITE", false),
    domain: getOptionalStringEnv("NEXT_PUBLIC_CLERK_DOMAIN"),
    primarySignInUrl: (() => {
      const configured = getOptionalStringEnv(
        "NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL",
      );
      return configured && isAbsoluteHttpUrl(configured)
        ? configured
        : undefined;
    })(),
    satelliteOrigins: (
      getOptionalStringEnv("NEXT_PUBLIC_CLERK_SATELLITE_ORIGINS") ?? ""
    )
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  };

  const satelliteIssues = validateSatelliteInvariants({
    isSatellite: clerk.isSatellite,
    domain: clerk.domain,
    primarySignInUrl: clerk.primarySignInUrl,
    appName: "client",
  });
  if (
    satelliteIssues.length > 0 &&
    !shouldDeferServerOnlyValidationForBuild()
  ) {
    const message = `Invalid Clerk satellite configuration in apps/client:\n${satelliteIssues
      .map((i) => `  - ${i}`)
      .join("\n")}`;
    if (isProd) {
      // Fail CLOSED at boot in production — same posture as apps/admin's
      // env-wrapper.ts for this exact misconfiguration class.
      throw new Error(message);
    } else {
      console.warn(`[apps/client env] ${message}`); // bootstrap-only: env validation warning
    }
  }

  return {
    // Environment
    nodeEnv,
    isDev,
    isProd,
    isTest,
    cspReportOnly: getBooleanEnv("NEXT_PUBLIC_CSP_REPORT_ONLY", false),
    isCI: getBooleanEnv("CI"),
    isBuildPhase: process.env.NEXT_PHASE === "phase-production-build",

    // URLs
    appUrl: getStringEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3500"),
    apiUrl: getStringEnv("NEXT_PUBLIC_API_URL", "http://localhost:3500/api"),
    // BUG FIX (uncovered while wiring this app onto @build/security-clerk's
    // getSafeRedirectUrl elsewhere): apps/client/app/lib/security/redirect-url.ts
    // reads `env.clientAppUrl`, but this field never existed here — it
    // would have been `undefined` at runtime (and a TS compile error under
    // strict unknown-property checks). apps/client IS the primary/client
    // app, so this is a self-alias to `appUrl`, mirroring the same
    // `adminAppUrl: appUrl` self-alias pattern used in apps/admin's
    // env-wrapper.ts.
    clientAppUrl: getStringEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3500"),
    adminAppUrl: getStringEnv(
      "NEXT_PUBLIC_ADMIN_APP_URL",
      isProd ? "https://admin.buildmarket.app" : "http://localhost:3005",
    ),
    verificationAppUrl: getStringEnv(
      "NEXT_PUBLIC_VERIFICATION_APP_URL",
      getStringEnv(
        "NEXT_PUBLIC_VERIFICATION_OPS_URL",
        isProd
          ? "https://verification.buildmarket.app"
          : "http://localhost:3501",
      ),
    ),
    appVersion: getStringEnv("npm_package_version", "0.1.0"),

    // Local-only auth bypass — canonical AUTH_DEV_BYPASS with legacy
    // BYPASS_AUTH fallback (Drift 4), fail-closed in prod via
    // @build/env-validation's resolveDevAuthBypass (throws if somehow
    // true in a production NODE_ENV, same as apps/admin/apps/client's
    // other bypass-adjacent guards).
    auth: {
      secret: getStringEnv("AUTH_SECRET"),
      bypassEnabled: resolveDevAuthBypass(process.env, isProd, "client")
        .bypassEnabled,
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

    // Clerk (computed above buildEnvConfig()'s return so
    // validateSatelliteInvariants() can run against it first)
    clerk,

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
        "local" | "s3" | "gcs",
      localPath: getStringEnv("UPLOAD_DIR", "./public/uploads"),
      bucket: resolvedStorageAssetBucket,
      privateBucket: resolvedStoragePrivateBucket,
      stagedBucket: getStringEnv("R2_BUCKET_STAGED", "buildmarket-staged"),
      verifiedPrivateBucket: getStringEnv(
        "R2_BUCKET_VERIFIED_PRIVATE",
        "buildmarket-verified-private",
      ),
      quarantineBucket: getStringEnv(
        "R2_BUCKET_QUARANTINE",
        "buildmarket-quarantine",
      ),
      r2ScanCallbackUrl: getStringEnv(
        "R2_SCAN_CALLBACK_URL",
        getStringEnv(
          "APP_CALLBACK_URL",
          "http://localhost:3500/api/internal/uploads/scan-callback",
        ),
      ),
      appCallbackUrl: getStringEnv(
        "APP_CALLBACK_URL",
        getStringEnv(
          "R2_SCAN_CALLBACK_URL",
          "http://localhost:3500/api/internal/uploads/scan-callback",
        ),
      ),
      cloudmersiveApiKey: getOptionalStringEnv("CLOUDMERSIVE_API_KEY"),
      cloudmersiveBaseUrl:
        getOptionalStringEnv("CLOUDMERSIVE_BASE_URL") ??
        "https://api.cloudmersive.com",
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
      scanCallbackHmacSecret: getOptionalStringEnv("SCAN_CALLBACK_HMAC_SECRET"),
    },

    // Feature Flags
    features: {
      notifications: getBooleanEnv("ENABLE_NOTIFICATION_SERVICE"),
      gdpr: getBooleanEnv("ENABLE_GDPR_FEATURES"),
      encryption: getBooleanEnv("ENABLE_ENCRYPTION"),
      allowMockScanner: getBooleanEnv("ALLOW_MOCK_VIRUS_SCANNER"),
      auditLogging: getBooleanEnv("ENABLE_AUDIT_LOGGING"),
      portalDashboardV2: getBooleanEnv("FEATURE_PORTAL_DASHBOARD_V2", true),
      portalLeadsV2: getBooleanEnv("FEATURE_PORTAL_LEADS_V2", true),
      portalFinanceV2: getBooleanEnv("FEATURE_PORTAL_FINANCE_V2", true),
      portalProjectsV2: getBooleanEnv("FEATURE_PORTAL_PROJECTS_V2", true),
      portalQuotesV2: getBooleanEnv("FEATURE_PORTAL_QUOTES_V2", true),
      portalStoresV2: getBooleanEnv("FEATURE_PORTAL_STORES_V2", true),
      portalCalendarV2: getBooleanEnv("FEATURE_PORTAL_CALENDAR_V2", true),
      portalPortfolioV2: getBooleanEnv("FEATURE_PORTAL_PORTFOLIO_V2", true),
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

    newsletter: {
      provider: getStringEnv("ESP_PROVIDER", "stub") as
        "resend" | "mailchimp" | "stub",
      apiKey:
        getOptionalStringEnv("ESP_API_KEY") ||
        getOptionalStringEnv("RESEND_API_KEY"),
      listId:
        getOptionalStringEnv("ESP_LIST_ID") ||
        getOptionalStringEnv("RESEND_SEGMENT_ID"),
      resendApiKey: getOptionalStringEnv("RESEND_API_KEY"),
      resendSegmentId: getOptionalStringEnv("RESEND_SEGMENT_ID"),
      resendWebhookSecret: getOptionalStringEnv("RESEND_WEBHOOK_SECRET"),
      workerHealthPort: getNumberEnv("WORKER_HEALTH_PORT", 8080),
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

    // OpenTelemetry Tracing & Metrics
    otel: {
      endpoint: getOptionalStringEnv("OTEL_EXPORTER_OTLP_ENDPOINT"),
      serviceName: getStringEnv(
        "OTEL_SERVICE_NAME",
        `build-market-client-${nodeEnv}`,
      ),
      resourceAttributes: getOptionalStringEnv("OTEL_RESOURCE_ATTRIBUTES"),
    },

    // Regulator Verification API Credentials (ADR-004 boundary compliant)
    regulators: {
      EBK: {
        baseUrl: getOptionalStringEnv("REGULATOR_EBK_BASE_URL"),
        apiKey: getOptionalStringEnv("REGULATOR_EBK_API_KEY"),
        signingSecret: getOptionalStringEnv("REGULATOR_EBK_SIGNING_SECRET"),
      },
      BORAQS: {
        baseUrl: getOptionalStringEnv("REGULATOR_BORAQS_BASE_URL"),
        apiKey: getOptionalStringEnv("REGULATOR_BORAQS_API_KEY"),
        signingSecret: getOptionalStringEnv("REGULATOR_BORAQS_SIGNING_SECRET"),
      },
      NCA: {
        baseUrl: getOptionalStringEnv("REGULATOR_NCA_BASE_URL"),
        apiKey: getOptionalStringEnv("REGULATOR_NCA_API_KEY"),
        signingSecret: getOptionalStringEnv("REGULATOR_NCA_SIGNING_SECRET"),
      },
      EARB: {
        baseUrl: getOptionalStringEnv("REGULATOR_EARB_BASE_URL"),
        apiKey: getOptionalStringEnv("REGULATOR_EARB_API_KEY"),
        signingSecret: getOptionalStringEnv("REGULATOR_EARB_SIGNING_SECRET"),
      },
      VRB: {
        baseUrl: getOptionalStringEnv("REGULATOR_VRB_BASE_URL"),
        apiKey: getOptionalStringEnv("REGULATOR_VRB_API_KEY"),
        signingSecret: getOptionalStringEnv("REGULATOR_VRB_SIGNING_SECRET"),
      },
      ISK: {
        baseUrl: getOptionalStringEnv("REGULATOR_ISK_BASE_URL"),
        apiKey: getOptionalStringEnv("REGULATOR_ISK_API_KEY"),
        signingSecret: getOptionalStringEnv("REGULATOR_ISK_SIGNING_SECRET"),
      },
      EPRA: {
        baseUrl: getOptionalStringEnv("REGULATOR_EPRA_BASE_URL"),
        apiKey: getOptionalStringEnv("REGULATOR_EPRA_API_KEY"),
        signingSecret: getOptionalStringEnv("REGULATOR_EPRA_SIGNING_SECRET"),
      },
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
export type ClientEnvConfig = typeof envConfig;

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
