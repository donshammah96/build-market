import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true");

const optionalUrl = z.string().url().optional();

export const adminBaseEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  ADMIN_DEPLOYMENT_PROFILE: z
    .enum(["local", "test", "preview", "staging", "production"])
    .default("local"),
  DATABASE_URL: z.string().min(1).optional(),
  DIRECT_URL: z.string().min(1).optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  CLERK_WEBHOOK_SECRET: z.string().min(1).optional(),
  NEXT_PUBLIC_CLERK_IS_SATELLITE: booleanString,
  NEXT_PUBLIC_CLERK_DOMAIN: z.string().min(1).optional(),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().min(1).optional(),
  /** Absolute sign-in URL on the primary Clerk domain. Required when
   *  NEXT_PUBLIC_CLERK_IS_SATELLITE=true so that ClerkProvider routes
   *  unauthenticated users to the primary app instead of the satellite. */
  NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL: optionalUrl,
  CLIENT_APP_URL: optionalUrl,
  NEXT_PUBLIC_APP_URL: optionalUrl,
  APP_URL: optionalUrl,
  NEXT_PUBLIC_AUTH_SERVICE_URL: optionalUrl,
  NEXT_PUBLIC_PRODUCT_SERVICE_URL: optionalUrl,
  NEXT_PUBLIC_ORDER_SERVICE_URL: optionalUrl,
  NOTIFICATION_SERVICE_URL: optionalUrl,
  ENABLE_NOTIFICATION_SERVICE: booleanString,
  QUEUE_PROVIDER: z.enum(["memory", "redis", "bullmq", "db"]).optional(),
  INTERNAL_API_SECRET: z.string().min(1).optional(),
  DEV_ADMIN_BYPASS: booleanString,
  S3_DISABLED: booleanString,
  R2_EXPORT_BUCKET: z.string().min(1).optional(),
  S3_EXPORT_BUCKET: z.string().min(1).optional(),
  EXPORTS_BUCKET_NAME: z.string().min(1).optional(),
  R2_ASSET_BUCKET: z.string().min(1).optional(),
  STORAGE_BUCKET: z.string().min(1).optional(),
  S3_ASSET_BUCKET: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_ENDPOINT: optionalUrl,
  S3_URL: optionalUrl,
  R2_REGION: z.string().min(1).optional(),
  AWS_REGION: z.string().min(1).optional(),
  S3_REGION: z.string().min(1).optional(),
  ODPC_EMAIL: z.string().email().optional(),
  DPO_EMAIL: z.string().email().optional(),
  GDPR_ERASURE_CRON: z.string().min(1).optional(),
  GDPR_ERASURE_BATCH_SIZE: z.coerce.number().int().positive().optional(),
  EXPORT_CLEANUP_CRON: z.string().min(1).optional(),
  EXPORT_CLEANUP_BATCH_SIZE: z.coerce.number().int().positive().optional(),
  EXPORT_CLEANUP_MAX_RETRIES: z.coerce.number().int().nonnegative().optional(),
  DATA_RETENTION_CRON: z.string().min(1).optional(),
  RETENTION_BATCH_SIZE: z.coerce.number().int().positive().optional(),
  ASSET_CLEANUP_CRON: z.string().min(1).optional(),
  CLEANUP_BATCH_SIZE: z.coerce.number().int().positive().optional(),
  ANONYMIZATION_BATCH_CRON: z.string().min(1).optional(),
  ANONYMIZATION_BATCH_SIZE: z.coerce.number().int().positive().optional(),
  DELETION_GRACE_PERIOD_DAYS: z.coerce.number().int().positive().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  CURRENT_KEY_VERSION: z.string().min(1).optional(),
  LEGACY_FORMAT_DEADLINE: z.string().min(1).optional(),
  ENCRYPTION_MIGRATION_MODE: booleanString,
  ENCRYPTION_KEY: z.string().min(32).optional(),
  ENCRYPTION_KEY_V1: z.string().min(32).optional(),
  ENCRYPTION_KEY_V2: z.string().min(32).optional(),
  NEXT_PUBLIC_ADMIN_FF_V2_USER_MANAGEMENT: booleanString,
  NEXT_PUBLIC_ADMIN_FF_V2_VERIFICATION_QUEUE: booleanString,
  NEXT_PUBLIC_ADMIN_FF_V2_FINANCE_DASHBOARD: booleanString,
  NEXT_PUBLIC_ADMIN_FF_V2_AUDIT_LOG_UI: booleanString,
  NEXT_PUBLIC_ADMIN_FF_V2_STRUCTURED_LOGGING: booleanString,
  NEXT_PUBLIC_ADMIN_FF_LICENSE_VERIFICATION_QUEUE: booleanString,
  LICENSE_EXPIRY_CRON: z.string().min(1).optional(),
  LICENSE_EXPIRY_BATCH_SIZE: z.coerce.number().int().positive().optional(),
  NATS_URL: z.string().min(1).optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().min(1).optional(),
  OTEL_SERVICE_NAME: z.string().min(1).optional(),
  OTEL_RESOURCE_ATTRIBUTES: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
});

export const adminEnvSchema = adminBaseEnvSchema
  .refine(
    (data) => {
      // Require QUEUE_PROVIDER in production environment (F10)
      if (
        (data.NODE_ENV === "production" ||
          data.ADMIN_DEPLOYMENT_PROFILE === "production") &&
        !data.QUEUE_PROVIDER
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        "QUEUE_PROVIDER is required when NODE_ENV or ADMIN_DEPLOYMENT_PROFILE is production",
      path: ["QUEUE_PROVIDER"],
    },
  )
  .refine(
    (data) => {
      if (
        data.ADMIN_DEPLOYMENT_PROFILE === "production" ||
        data.ADMIN_DEPLOYMENT_PROFILE === "staging"
      ) {
        return Boolean(data.DATABASE_URL && data.DATABASE_URL.length > 0);
      }
      return true;
    },
    {
      message:
        "DATABASE_URL is required when ADMIN_DEPLOYMENT_PROFILE is production or staging",
      path: ["DATABASE_URL"],
    },
  );

export type AdminEnvConfig = z.infer<typeof adminEnvSchema>;

function isStaticBuildPhase(): boolean {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build"
  );
}

function cleanEnv(
  rawEnv: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(rawEnv)) {
    if (value === undefined) continue;

    // Strip surrounding quotes if present
    let cleanedValue = value.trim();
    if (
      (cleanedValue.startsWith('"') && cleanedValue.endsWith('"')) ||
      (cleanedValue.startsWith("'") && cleanedValue.endsWith("'"))
    ) {
      cleanedValue = cleanedValue.slice(1, -1).trim();
    }

    // Convert empty strings to undefined (omitted)
    if (cleanedValue === "") {
      continue;
    }

    // Normalize specific fields
    if (key === "QUEUE_PROVIDER") {
      cleanedValue = cleanedValue.toLowerCase();
    }

    env[key] = cleanedValue;
  }
  return env;
}

export function validateAdminEnv(): AdminEnvConfig {
  const cleanedEnv = cleanEnv(process.env);
  const parsed = adminEnvSchema.safeParse(cleanedEnv);

  if (parsed.success) {
    return parsed.data;
  }

  if (isStaticBuildPhase()) {
    return adminBaseEnvSchema.partial().parse(cleanedEnv) as AdminEnvConfig;
  }

  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid apps/admin environment: ${details}`);
}

export const adminEnvConfig = validateAdminEnv();
