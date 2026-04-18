/**
 * Environment Variable Validation
 * ================================
 * Validates required environment variables on startup.
 * Import this file early in your application to catch misconfigurations.
 *
 * Usage in app/layout.tsx or _app.tsx:
 *   import '@/app/lib/infrastructure/env';
 *
 * Or validate specific groups:
 *   import { validateEnv, envConfig } from '@/app/lib/infrastructure/env';
 *   validateEnv(['database', 'auth']);
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

type AppUserRole =
  | "CLIENT"
  | "PROFESSIONAL"
  | "ADMIN"
  | "SUPPORT"
  | "pending_professional";

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
        required: process.env.NODE_ENV === "production",
        errorMessage:
          "CLERK_WEBHOOK_SECRET is required in production for webhook signature verification",
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
        errorMessage: "Must be a valid PostgreSQL connection string",
      },
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
    description: "Redis Configuration",
    variables: [
      { name: "REDIS_URL", required: false },
      { name: "REDIS_HOST", required: false, default: "localhost" },
      { name: "REDIS_PORT", required: false, default: "6379" },
      { name: "UPSTASH_REDIS_REST_URL", required: false },
      { name: "UPSTASH_REDIS_REST_TOKEN", required: false },
      { name: "REDIS_PASSWORD", required: false },
      { name: "REDIS_DB", required: false, default: "0" },
      { name: "REDIS_TLS", required: false, default: "false" },
      { name: "REDIS_FAMILY", required: false, default: "4" },
      { name: "REDIS_ENABLED", required: false, default: "true" },
      { name: "RATE_LIMIT_BACKEND", required: false, default: "auto" },
    ],
  },
  {
    name: "storage",
    description: "Upload and storage configuration",
    variables: [
      { name: "S3_DISABLED", required: false, default: "true" },
      { name: "AWS_ACCESS_KEY_ID", required: false },
      { name: "AWS_SECRET_ACCESS_KEY", required: false },
      { name: "AWS_REGION", required: false, default: "af-south-1" },
      { name: "S3_ASSET_BUCKET", required: false },
      { name: "STORAGE_PROVIDER", required: false, default: "local" },
      { name: "UPLOAD_DIR", required: false, default: "./public/uploads" },
      { name: "STORAGE_BUCKET", required: false },
      { name: "STORAGE_REGION", required: false, default: "af-south-1" },
      { name: "CDN_URL", required: false, default: "/uploads" },
    ],
  },
  {
    name: "services",
    description: "Internal Services",
    variables: [
      { name: "MESSAGING_SERVICE_URL", required: false },
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
        errorMessage: "Must be 64 hex characters (32 bytes)",
      },
      { name: "CURRENT_KEY_VERSION", required: false, default: "v1" },
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

const BUILD_DEFERRED_SERVER_ONLY_REQUIRED_VARS = new Set<string>([
  "AUTH_SECRET",
  "CLERK_SECRET_KEY",
  "CLERK_WEBHOOK_SECRET",
  "DATABASE_URL",
  "ENCRYPTION_KEY_V1",
]);

function shouldDeferServerOnlyValidationForBuild(): boolean {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return true;
  }

  return process.argv.join(" ").includes("next build");
}

/**
 * Validates environment variables for specified groups
 * @param groups - Array of group names to validate, or 'all' for all groups
 * @param throwOnError - Whether to throw an error on validation failure
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

function getStringEnv(name: string, fallback = ""): string {
  return process.env[name] || fallback;
}

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

function validateRedisRateLimitReadiness(result: ValidationResult): void {
  const nodeEnv = getStringEnv("NODE_ENV", "development");
  const rateLimitBackend = getRateLimitBackendEnv("RATE_LIMIT_BACKEND", "auto");

  if (!isRedisRateLimitBackendRequired(nodeEnv, rateLimitBackend)) {
    return;
  }

  const redisEnabled = getBooleanEnv("REDIS_ENABLED", true);
  if (!redisEnabled) {
    result.valid = false;
    result.errors.push(
      `[redis] RATE_LIMIT_BACKEND=${rateLimitBackend} requires REDIS_ENABLED=true when NODE_ENV=${nodeEnv}`,
    );
  }

  const redisHost = getStringEnv("REDIS_HOST").trim();
  const redisPortRaw = getStringEnv("REDIS_PORT").trim();
  if (!redisHost || !redisPortRaw) {
    result.valid = false;
    result.errors.push(
      "[redis] Redis rate-limit backend requires explicit REDIS_HOST and REDIS_PORT values.",
    );
    return;
  }

  const redisPort = Number.parseInt(redisPortRaw, 10);
  if (!Number.isFinite(redisPort) || redisPort <= 0) {
    result.valid = false;
    result.errors.push(
      `[redis] Invalid REDIS_PORT value: ${redisPortRaw}. Must be a positive integer.`,
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

function buildEnvConfig() {
  const nodeEnv = getStringEnv("NODE_ENV", "development");
  const isDev = nodeEnv === "development";
  const isProd = nodeEnv === "production";
  const isTest = nodeEnv === "test";
  const uploadProcessInline = getBooleanEnv(
    "UPLOAD_PROCESS_INLINE",
    isDev || isTest,
  );

  assertUploadProcessingModeInvariant({
    isProd,
    uploadProcessInline,
  });

  return {
    // Environment
    nodeEnv,
    isDev,
    isProd,
    isTest,
    isCI: getBooleanEnv("CI"),

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
          clientId: getStringEnv("GOOGLE_CLIENT_ID"),
          clientSecret: getStringEnv("GOOGLE_CLIENT_SECRET"),
        },
        github: {
          clientId: getStringEnv("GITHUB_CLIENT_ID"),
          clientSecret: getStringEnv("GITHUB_CLIENT_SECRET"),
        },
        facebook: {
          clientId: getStringEnv("FACEBOOK_CLIENT_ID"),
          clientSecret: getStringEnv("FACEBOOK_CLIENT_SECRET"),
        },
        azureAd: {
          clientId: getStringEnv("AZURE_AD_CLIENT_ID"),
          clientSecret: getStringEnv("AZURE_AD_CLIENT_SECRET"),
          tenantId: getStringEnv("AZURE_AD_TENANT_ID", "common"),
        },
      },
    },

    // CORS
    cors: {
      allowedOrigins: parseOriginList(process.env.CORS_ALLOWED_ORIGINS),
      devAllowedOrigins: parseOriginList(process.env.CORS_DEV_ALLOWED_ORIGINS),
    },

    // CSRF / same-origin mutation protection
    csrf: {
      trustedOrigins: parseOriginList(process.env.CSRF_TRUSTED_ORIGINS),
    },

    // Clerk
    clerk: {
      publishableKey: getStringEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
      frontendApi: getStringEnv("NEXT_PUBLIC_CLERK_FRONTEND_API"),
      secretKey: getStringEnv("CLERK_SECRET_KEY"),
      webhookSecret: getStringEnv("CLERK_WEBHOOK_SECRET"),
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
    databaseUrl: getStringEnv("DATABASE_URL"),
    postgresUrl: getStringEnv("POSTGRES_URL", getStringEnv("DATABASE_URL")),

    // Redis
    redis: {
      enabled: getBooleanEnv("REDIS_ENABLED", true),
      rateLimitBackend: getRateLimitBackendEnv("RATE_LIMIT_BACKEND", "auto"),
      host: getStringEnv("REDIS_HOST", "localhost"),
      port: getNumberEnv("REDIS_PORT", 6379),
      password: getOptionalStringEnv("REDIS_PASSWORD"),
      db: getNumberEnv("REDIS_DB", 0),
      url: getOptionalStringEnv("REDIS_URL"),
      upstashRestUrl: getStringEnv("UPSTASH_REDIS_REST_URL"),
      upstashRestToken: getStringEnv("UPSTASH_REDIS_REST_TOKEN"),
      tls: getBooleanEnv("REDIS_TLS"),
    },

    // Storage
    storage: {
      provider: getStringEnv("STORAGE_PROVIDER", "local") as
        | "local"
        | "s3"
        | "gcs",
      localPath: getStringEnv("UPLOAD_DIR", "./public/uploads"),
      bucket: process.env.STORAGE_BUCKET || undefined,
      region: getStringEnv("STORAGE_REGION", "af-south-1"),
      cdnUrl: getStringEnv("CDN_URL", "/uploads"),
      s3Disabled: getBooleanEnv("S3_DISABLED", true),
      assetBucket: getStringEnv("S3_ASSET_BUCKET", "buildmarket-assets"),
      awsRegion: getStringEnv("AWS_REGION", "af-south-1"),
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },

    // Services
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
      hcaptchaSecretKey: getStringEnv("HCAPTCHA_SECRET_KEY"),
      internalApiSecret: getStringEnv("INTERNAL_API_SECRET"),
    },

    // Feature Flags
    features: {
      notifications: getBooleanEnv("ENABLE_NOTIFICATION_SERVICE"),
      gdpr: getBooleanEnv("ENABLE_GDPR_FEATURES"),
      encryption: getBooleanEnv("ENABLE_ENCRYPTION"),
      auditLogging: getBooleanEnv("ENABLE_AUDIT_LOGGING"),
    },

    analytics: {
      posthogKey: getStringEnv("NEXT_PUBLIC_POSTHOG_KEY"),
      posthogHost: getStringEnv(
        "NEXT_PUBLIC_POSTHOG_HOST",
        "https://us.i.posthog.com",
      ),
    },

    ai: {
      geminiApiKey: getStringEnv("NEXT_PUBLIC_GEMINI_API_KEY"),
    },

    // GDPR
    gdpr: {
      exportExpiryHours: getNumberEnv("EXPORT_EXPIRY_HOURS", 48),
      deletionGraceDays: getNumberEnv("DELETION_GRACE_PERIOD_DAYS", 30),
      dpoEmail: getStringEnv("DPO_EMAIL", "security@buildmarket.co.ke"),
      odpcEmail: getStringEnv("ODPC_EMAIL", "dataprotection@odpc.go.ke"),
    },

    // S3 exports
    s3: {
      disabled: getBooleanEnv("S3_DISABLED", true),
      region: getStringEnv("AWS_REGION", "af-south-1"),
      exportBucket:
        getStringEnv("S3_EXPORT_BUCKET") ||
        getStringEnv("EXPORTS_BUCKET_NAME", "buildmarket-exports"),
      localDir: getStringEnv("EXPORT_LOCAL_DIR", "./temp-exports"),
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },

    // Encryption
    encryption: {
      currentVersion: getStringEnv("CURRENT_KEY_VERSION", "v1"),
      migrationMode: getBooleanEnv("ENCRYPTION_MIGRATION_MODE"),
      legacyDeadline: getStringEnv("LEGACY_FORMAT_DEADLINE"),
      legacyKey: getStringEnv("ENCRYPTION_KEY"),
      keys: {
        v1: getStringEnv("ENCRYPTION_KEY_V1"),
        v2: getStringEnv("ENCRYPTION_KEY_V2"),
        v3: getStringEnv("ENCRYPTION_KEY_V3"),
        v4: getStringEnv("ENCRYPTION_KEY_V4"),
        v5: getStringEnv("ENCRYPTION_KEY_V5"),
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
    },

    // NATS Messaging
    nats: {
      url: getStringEnv("NATS_URL", "nats://localhost:4222"),
      clientName: process.env.NATS_CLIENT_NAME || `build-market-${nodeEnv}`,
      token: process.env.NATS_TOKEN,
      user: process.env.NATS_USER,
      pass: process.env.NATS_PASS,
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
 * Type-safe environment configuration
 * Access environment variables with proper types and defaults
 */
export const envConfig = buildEnvConfig();

// ============================================
// Auto-validate on import (server runtime)
// ============================================

if (typeof window === "undefined" && process.env.NODE_ENV !== "test") {
  const startupGroups = ["clerk", "database", "urls", "encryption"];
  if (
    isRedisRateLimitBackendRequired(
      getStringEnv("NODE_ENV", "development"),
      getRateLimitBackendEnv("RATE_LIMIT_BACKEND", "auto"),
    )
  ) {
    startupGroups.push("redis");
  }

  validateEnv(startupGroups);
}

export default envConfig;
export function getEnvConfig() {
  return envConfig;
}
export const env = envConfig;
