import { z } from "zod";

const booleanString = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((value) => value === "true" || value === "1");

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
      /^(nats|tls):\/\//,
      "NATS_URL must be a valid NATS connection string starting with nats:// or tls://",
    )
    .optional(),
  DB_POOL_MAX: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 5))
    .pipe(z.number().min(1).max(20)),
  HEALTH_PORT: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 8080))
    .pipe(z.number()),
  DISABLE_BACKGROUND_JOBS: booleanString,
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
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
