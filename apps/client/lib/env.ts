/**
 * Environment Variable Validation
 * ================================
 * Validates required environment variables on startup.
 * Import this file early in your application to catch misconfigurations.
 *
 * Usage in app/layout.tsx or _app.tsx:
 *   import '@/lib/env';
 *
 * Or validate specific groups:
 *   import { validateEnv, envConfig } from '@/lib/env';
 *   validateEnv(['database', 'auth']);
 */

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
      { name: "CLERK_WEBHOOK_SECRET", required: false },
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
    ],
  },
  {
    name: "auth",
    description: "Authentication",
    variables: [
      { name: "AUTH_SECRET", required: true },
      { name: "AUTH_URL", required: false },
      { name: "NEXTAUTH_URL", required: false },
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
    name: "redis",
    description: "Redis Configuration",
    variables: [
      { name: "REDIS_URL", required: false },
      { name: "REDIS_HOST", required: false, default: "localhost" },
      { name: "REDIS_PORT", required: false, default: "6379" },
      { name: "UPSTASH_REDIS_REST_URL", required: false },
      { name: "UPSTASH_REDIS_REST_TOKEN", required: false },
    ],
  },
  {
    name: "services",
    description: "Internal Services",
    variables: [
      { name: "MESSAGING_SERVICE_URL", required: false },
      { name: "NOTIFICATION_SERVICE_URL", required: false },
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

  for (const group of groupsToValidate) {
    for (const variable of group.variables) {
      const value = process.env[variable.name];

      // Check required variables
      if (variable.required && !value) {
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
// Type-Safe Environment Config
// ============================================

/**
 * Type-safe environment configuration
 * Access environment variables with proper types and defaults
 */
export const envConfig = {
  // Environment
  nodeEnv: process.env.NODE_ENV || "development",
  isDev: process.env.NODE_ENV === "development",
  isProd: process.env.NODE_ENV === "production",
  isTest: process.env.NODE_ENV === "test",

  // URLs
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3500",
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3500/api",

  // Database
  databaseUrl: process.env.DATABASE_URL || "",

  // Redis
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || "0", 10),
    url: process.env.REDIS_URL,
    tls: process.env.REDIS_TLS === "true",
  },

  // Services
  services: {
    messaging: process.env.MESSAGING_SERVICE_URL || "http://localhost:3010",
    notification:
      process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3011",
    search:
      process.env.NEXT_PUBLIC_SEARCH_SERVICE_URL || "http://localhost:3005",
  },

  // Feature Flags
  features: {
    notifications: process.env.ENABLE_NOTIFICATION_SERVICE === "true",
    gdpr: process.env.ENABLE_GDPR_FEATURES === "true",
    encryption: process.env.ENABLE_ENCRYPTION === "true",
    auditLogging: process.env.ENABLE_AUDIT_LOGGING === "true",
  },

  // GDPR
  gdpr: {
    exportExpiryHours: parseInt(process.env.EXPORT_EXPIRY_HOURS || "48", 10),
    deletionGraceDays: parseInt(
      process.env.DELETION_GRACE_PERIOD_DAYS || "30",
      10,
    ),
    dpoEmail: process.env.DPO_EMAIL || "",
  },

  // S3
  s3: {
    disabled: process.env.S3_DISABLED === "true",
    region: process.env.AWS_REGION || "af-south-1",
    exportBucket:
      process.env.S3_EXPORT_BUCKET ||
      process.env.EXPORTS_BUCKET_NAME ||
      "buildmarket-exports",
    localDir: process.env.EXPORT_LOCAL_DIR || "./temp-exports",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },

  // Encryption
  encryption: {
    currentVersion: process.env.CURRENT_KEY_VERSION || "v1",
    migrationMode: process.env.ENCRYPTION_MIGRATION_MODE === "true",
    legacyDeadline: process.env.LEGACY_FORMAT_DEADLINE || "",
    keys: {
      v1: process.env.ENCRYPTION_KEY_V1 || "",
      v2: process.env.ENCRYPTION_KEY_V2 || "",
      v3: process.env.ENCRYPTION_KEY_V3 || "",
      v4: process.env.ENCRYPTION_KEY_V4 || "",
      v5: process.env.ENCRYPTION_KEY_V5 || "",
    },
    batchSize: parseInt(process.env.ROTATION_BATCH_SIZE || "100", 10),
  },

  // NATS Messaging
  nats: {
    url: process.env.NATS_URL || "nats://localhost:4222",
    clientName:
      process.env.NATS_CLIENT_NAME ||
      `build-market-${process.env.NODE_ENV || "development"}`,
    token: process.env.NATS_TOKEN,
    user: process.env.NATS_USER,
    pass: process.env.NATS_PASS,
    reconnect: true,
    maxReconnectAttempts: parseInt(
      process.env.NATS_MAX_RECONNECT_ATTEMPTS || "-1",
      10,
    ),
    reconnectTimeWait: parseInt(
      process.env.NATS_RECONNECT_TIME_WAIT ||
        (process.env.NODE_ENV === "production" ? "2000" : "1000"),
      10,
    ),
    timeout: parseInt(
      process.env.NATS_TIMEOUT ||
        (process.env.NODE_ENV === "production" ? "10000" : "5000"),
      10,
    ),
    verboseLogging: process.env.NODE_ENV === "development",
  },
} as const;

// ============================================
// Auto-validate on import (development only)
// ============================================

if (typeof window === "undefined" && process.env.NODE_ENV !== "test") {
  // Only validate on server-side and not during tests
  try {
    // Validate critical groups only to avoid blocking startup
    validateEnv(["clerk", "database", "urls"], false);
  } catch {
    // Log but don't block - full validation happens on demand
    console.warn(
      "⚠️  Some environment variables may be missing. Run validateEnv() for details.",
    );
  }
}

export default envConfig;
