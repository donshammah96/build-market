import { z } from "zod";

const booleanString = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((value) => value === "true" || value === "1");

const defaultTrueBooleanString = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((value) =>
    value === undefined ? true : value === "true" || value === "1",
  );

const workerEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required for worker persistence")
    .regex(
      /^(postgresql|postgres):\/\//,
      "DATABASE_URL must be a valid PostgreSQL connection string starting with postgresql:// or postgres://",
    ),
  QUEUE_DATABASE_URL: z
    .string()
    .regex(
      /^(postgresql|postgres):\/\//,
      "QUEUE_DATABASE_URL must be a valid PostgreSQL connection string starting with postgresql:// or postgres://",
    )
    .optional(),
  DIRECT_URL: z.string().optional(),
  REDIS_URL: z
    .string()
    .min(1, "REDIS_URL is required for BullMQ background queues")
    .regex(
      /^(redis|rediss):\/\//,
      "REDIS_URL must be a valid Redis connection string starting with redis:// or rediss://",
    ),
  // No blanket default here on purpose — an unset NATS_URL must fail loudly in
  // production rather than silently falling back to a localhost address that
  // doesn't exist inside the container. The localhost convenience default for
  // local dev is applied explicitly in validateWorkerEnv() below, only when
  // NODE_ENV !== "production".
  NATS_URL: z
    .string()
    .regex(
      /^(nats|tls|ws|wss):\/\//,
      "NATS_URL must be a valid NATS connection string starting with nats://, tls://, ws://, or wss://",
    )
    .optional(),
  NATS_TOKEN: z.string().min(1).optional(),
  DB_POOL_MAX: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 5))
    .pipe(z.number().min(1).max(20)),
  PORT: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined))
    .pipe(z.number().optional()),
  HEALTH_PORT: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 8080))
    .pipe(z.number()),
  DISABLE_BACKGROUND_JOBS: booleanString,
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
  QUEUE_BACKEND: z.enum(["redis", "postgres"]).default("redis"),

  // M-Pesa is disabled by default and must be explicitly enabled after
  // sandbox credentials and callback routes have been verified.
  MPESA_ENABLED: booleanString,
  MPESA_BASE_URL: z.string().url().optional(),
  MPESA_CONSUMER_KEY: z.string().min(1).optional(),
  MPESA_CONSUMER_SECRET: z.string().min(1).optional(),
  MPESA_SHORTCODE: z
    .string()
    .regex(/^\d{5,7}$/)
    .optional(),
  MPESA_PASSKEY: z.string().min(1).optional(),
  MPESA_CALLBACK_URL: z.string().url().optional(),
  MPESA_B2C_ENABLED: booleanString,
  MPESA_B2C_INITIATOR_NAME: z.string().min(1).optional(),
  MPESA_B2C_INITIATOR_PASSWORD: z.string().min(1).optional(),
  MPESA_B2C_CERTIFICATE_PEM: z.string().min(1).optional(),
  MPESA_B2C_RESULT_URL: z.string().url().optional(),
  MPESA_B2C_TIMEOUT_URL: z.string().url().optional(),

  // Storage / S3 / R2 Configuration for Export Processor
  S3_DISABLED: booleanString,
  R2_EXPORT_BUCKET: z.string().min(1).optional(),
  S3_EXPORT_BUCKET: z.string().min(1).optional(),
  EXPORTS_BUCKET_NAME: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_ENDPOINT: z.string().url().optional(),
  S3_URL: z.string().url().optional(),
  R2_REGION: z.string().min(1).optional(),
  AWS_REGION: z.string().min(1).optional(),
  S3_REGION: z.string().min(1).optional(),

  // Media / Security / Virus Scanner Configuration
  CLOUDMERSIVE_API_KEY: z.string().min(1).optional(),
  CLOUDMERSIVE_BASE_URL: z.string().url().optional(),
  ALLOW_MOCK_VIRUS_SCANNER: booleanString,
  WORKER_IMAGE_PROCESSING_ENABLED: defaultTrueBooleanString,

  // Notification / Compliance Mailer Configuration
  RESEND_API_KEY: z.string().min(1).optional(),
  ODPC_EMAIL: z.string().email().optional(),
  DPO_EMAIL: z.string().email().optional(),

  // OpenTelemetry / Datadog Collector Configuration
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().min(1).optional(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().min(1).optional(),
  OTEL_SERVICE_NAME: z.string().min(1).default("build-market-workers"),
  OTEL_RESOURCE_ATTRIBUTES: z.string().optional(),
  DD_API_KEY: z.string().min(1).optional(),
  DD_SITE: z.string().min(1).default("us5.datadoghq.com"),
  DD_SITE_HOST: z.string().min(1).default("us5.datadoghq.com"),
  DD_ENV: z.string().min(1).optional(),
  DD_SERVICE: z.string().min(1).optional(),
  DD_VERSION: z.string().min(1).optional(),
  DD_AGENT_HOST: z.string().min(1).optional(),
  DD_TRACE_ENABLED: booleanString,
});

// NATS_URL is optional on the raw schema (see comment above) but is always
// guaranteed to be a defined string by the time validateWorkerEnv() returns —
// either the caller-provided value, or the dev-only localhost fallback.
export type WorkerEnv = Omit<z.infer<typeof workerEnvSchema>, "NATS_URL"> & {
  NATS_URL: string;
};

/**
 * Synchronous fail-closed environment validator.
 * Throws and terminates process immediately if environment is invalid on boot.
 */
export function validateWorkerEnv(): WorkerEnv {
  const result = workerEnvSchema.safeParse(process.env);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    console.error(
      `\n========================================================\n` +
        `[FATAL] Worker environment validation failed on boot:\n` +
        `${errorDetails}\n` +
        `========================================================\n`,
    );
    process.exit(1);
  }

  const data = result.data;

  if (data.MPESA_ENABLED) {
    const requiredMpesa = [
      "MPESA_BASE_URL",
      "MPESA_CONSUMER_KEY",
      "MPESA_CONSUMER_SECRET",
      "MPESA_SHORTCODE",
      "MPESA_PASSKEY",
      "MPESA_CALLBACK_URL",
    ] as const;
    const missing = requiredMpesa.filter((key) => !data[key]);
    if (missing.length > 0) {
      console.error(`[FATAL] MPESA_ENABLED requires: ${missing.join(", ")}`);
      process.exit(1);
    }
  }

  if (data.MPESA_B2C_ENABLED) {
    const requiredB2c = [
      "MPESA_ENABLED",
      "MPESA_B2C_INITIATOR_NAME",
      "MPESA_B2C_INITIATOR_PASSWORD",
      "MPESA_B2C_CERTIFICATE_PEM",
      "MPESA_B2C_RESULT_URL",
      "MPESA_B2C_TIMEOUT_URL",
    ] as const;
    const missing = requiredB2c.filter((key) => !data[key]);
    if (missing.length > 0) {
      console.error(
        `[FATAL] MPESA_B2C_ENABLED requires: ${missing.join(", ")}`,
      );
      process.exit(1);
    }
  }

  if (
    data.NODE_ENV === "production" &&
    (data.REDIS_URL.includes("localhost") ||
      data.REDIS_URL.includes("127.0.0.1") ||
      data.REDIS_URL.includes("0.0.0.0"))
  ) {
    console.error(
      `\n========================================================\n` +
        `[FATAL] Worker environment validation failed on boot:\n` +
        `  - REDIS_URL: cannot point to localhost/127.0.0.1 in production.\n` +
        `    On Render, set REDIS_URL to your Upstash TCP endpoint:\n` +
        `    rediss://:TOKEN@<host>.upstash.io:6379\n` +
        `========================================================\n`,
    );
    process.exit(1);
  }

  // BullMQ PostgreSQL backend requires session-level LISTEN/NOTIFY and advisory locks.
  // Transaction poolers (e.g. Supabase port 6543) break these primitives silently.
  const queueDbUrl =
    data.QUEUE_DATABASE_URL || data.DIRECT_URL || data.DATABASE_URL;
  if (data.QUEUE_BACKEND === "postgres" && queueDbUrl) {
    try {
      const parsed = new URL(queueDbUrl);
      if (
        parsed.port === "6543" ||
        parsed.searchParams.get("pgbouncer") === "true"
      ) {
        console.error(
          `\n========================================================\n` +
            `[FATAL] Worker environment validation failed on boot:\n` +
            `  - QUEUE_DATABASE_URL / DATABASE_URL: target port 6543 (transaction-mode pooler).\n` +
            `    BullMQ PostgreSQL backend requires session-level LISTEN/NOTIFY and advisory locks.\n` +
            `    Please configure QUEUE_DATABASE_URL to use a direct connection or Session Pooler (port 5432).\n` +
            `========================================================\n`,
        );
        process.exit(1);
      }
    } catch {
      // url regex handles structural validation
    }
  }

  let natsUrl = data.NATS_URL;
  if (!natsUrl) {
    if (data.NODE_ENV === "production") {
      console.error(
        `\n========================================================\n` +
          `[FATAL] Worker environment validation failed on boot:\n` +
          `  - NATS_URL: is required in production. It has no default here ` +
          `because a missing value would otherwise resolve to ` +
          `nats://localhost:4222 inside the container, fail to connect, ` +
          `log once, and then silently stop processing notification-retry ` +
          `events with no crash and no health signal.\n` +
          `========================================================\n`,
      );
      process.exit(1);
    }
    // Dev-only convenience default, matching local docker-compose's NATS port.
    natsUrl = "nats://localhost:4222";
  }

  return { ...data, NATS_URL: natsUrl };
}
