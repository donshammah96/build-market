import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  normalizeQueueEnvKey,
  getQueueBackendType,
  getPostgresQueueConnectionOptions,
  getQueueConnectionOptions,
} from "../backend.js";
import { QueueRetentionPolicies } from "../retention.js";

describe("Queue Backend Resolution & Isolation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.QUEUE_BACKEND;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("normalizes queue names to uppercase environment key suffixes", () => {
    expect(normalizeQueueEnvKey("maintenance-jobs")).toBe("MAINTENANCE_JOBS");
    expect(normalizeQueueEnvKey("gdpr-data-export")).toBe("GDPR_DATA_EXPORT");
    expect(normalizeQueueEnvKey("uploads-image-processing")).toBe(
      "UPLOADS_IMAGE_PROCESSING",
    );
  });

  it("defaults to redis backend when no environment variables are set", () => {
    expect(getQueueBackendType("maintenance-jobs")).toBe("redis");
  });

  it("prioritizes granular per-queue backend environment variable over global QUEUE_BACKEND", () => {
    process.env.QUEUE_BACKEND = "redis";
    process.env.QUEUE_BACKEND_MAINTENANCE_JOBS = "postgres";

    expect(getQueueBackendType("maintenance-jobs")).toBe("postgres");
    expect(getQueueBackendType("gdpr-data-export")).toBe("redis");
  });

  it("uses global QUEUE_BACKEND when no specific queue override is defined", () => {
    process.env.QUEUE_BACKEND = "postgres";

    expect(getQueueBackendType("maintenance-jobs")).toBe("postgres");
    expect(getQueueBackendType("gdpr-data-export")).toBe("postgres");
  });

  it("configures PostgreSQL connection options scoped to 'bullmq' schema with pool bounds", () => {
    process.env.DATABASE_URL =
      "postgres://user:pass@localhost:5432/buildmarket";
    process.env.NODE_ENV = "production";

    const opts = getPostgresQueueConnectionOptions("maintenance-jobs");

    expect(opts.schema).toBe("bullmq");
    expect(opts.connectionString).toBe(
      "postgres://user:pass@localhost:5432/buildmarket",
    );
    expect(opts.ssl).toEqual({ rejectUnauthorized: true });
    expect(opts.max).toBe(3);
  });

  it("returns postgres connection options when backend resolves to postgres", () => {
    process.env.QUEUE_BACKEND_NOTIFICATION_RETRIES = "postgres";
    process.env.DATABASE_URL =
      "postgres://user:pass@localhost:5432/buildmarket";

    const conn = getQueueConnectionOptions("notification-retries") as any;

    expect(conn.schema).toBe("bullmq");
    expect(conn.connectionString).toBe(
      "postgres://user:pass@localhost:5432/buildmarket",
    );
  });

  it("enforces immutable retention policies for audit safety and bloat control", () => {
    expect(QueueRetentionPolicies.FINANCIAL_AUDIT.removeOnFail).toBe(false);
    expect(QueueRetentionPolicies.FINANCIAL_AUDIT.removeOnComplete).toEqual({
      age: 86400,
      count: 1000,
    });
    expect(QueueRetentionPolicies.STANDARD.removeOnComplete).toEqual({
      age: 86400,
      count: 1000,
    });
    expect(QueueRetentionPolicies.STANDARD.removeOnFail).toEqual({
      age: 7 * 86400,
      count: 5000,
    });
  });
});
