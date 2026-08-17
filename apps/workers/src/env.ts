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
    .min(1, "DATABASE_URL is required for worker persistence"),
  DIRECT_URL: z.string().optional(),
  REDIS_URL: z
    .string()
    .min(1, "REDIS_URL is required for BullMQ background queues"),
  NATS_URL: z.string().default("nats://localhost:4222"),
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

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

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
  return result.data;
}
