import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { validateEnv } from "@/app/lib/infrastructure/env";

const ORIGINAL_ENV = process.env;
const ORIGINAL_ARGV = [...process.argv];

async function importFreshEnvModule() {
  vi.resetModules();
  return import("@/app/lib/infrastructure/env");
}

/**
 * Puts the process into a state where the Redis group validation requires
 * Upstash credentials (production + explicit redis backend).
 * Does NOT set Upstash credentials — callers that want a passing result must
 * add them explicitly.
 */
function setRedisRequiredBaseline() {
  process.env = {
    ...process.env,
    NODE_ENV: "production",
    RATE_LIMIT_BACKEND: "redis",
  };
  // Remove any stubs that might have leaked in from .env.test
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
}

describe("env redis readiness validation — Upstash credential checks", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.argv = [...ORIGINAL_ARGV];
    // Set required env vars to dummy values for validation
    process.env.UPSTASH_REDIS_REST_URL = "https://dummy.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "dummy_token";
    process.env.CLERK_SECRET_KEY = "dummy_clerk_secret";
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
    process.argv = ORIGINAL_ARGV;
  });

  it("fails when UPSTASH_REDIS_REST_URL is missing in a Redis-required backend", () => {
    setRedisRequiredBaseline();
    process.env.UPSTASH_REDIS_REST_TOKEN = "valid_token";

    const result = validateEnv(["redis"], false);

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("UPSTASH_REDIS_REST_URL")),
    ).toBe(true);
  });

  it("fails when UPSTASH_REDIS_REST_TOKEN is missing in a Redis-required backend", () => {
    setRedisRequiredBaseline();
    process.env.UPSTASH_REDIS_REST_URL = "https://valid-db.upstash.io";

    const result = validateEnv(["redis"], false);

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("UPSTASH_REDIS_REST_TOKEN")),
    ).toBe(true);
  });

  it("fails when UPSTASH_REDIS_REST_URL does not start with https://", () => {
    setRedisRequiredBaseline();
    process.env.UPSTASH_REDIS_REST_URL = "http://invalid.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "valid_token";

    const result = validateEnv(["redis"], false);

    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("UPSTASH_REDIS_REST_URL")),
    ).toBe(true);
  });

  it("passes when both Upstash credentials are present and valid", () => {
    setRedisRequiredBaseline();
    process.env.UPSTASH_REDIS_REST_URL = "https://valid-db.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "valid_token";

    const result = validateEnv(["redis"], false);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("does not add readiness errors on top of group errors when backend mode does not require Redis", () => {
    // In dev + auto mode, validateRedisRateLimitReadiness returns early (no Redis required).
    // The group-level required: true check still fires for missing Upstash vars.
    // This test confirms that the EXTRA readiness-function errors (the validateRedisRateLimitReadiness
    // path) are NOT added — only the standard required-field errors from the group scan appear.
    process.env = { ...process.env, NODE_ENV: "development" };
    process.env.RATE_LIMIT_BACKEND = "auto";
    // Provide credentials so the group-level required check passes cleanly.
    process.env.UPSTASH_REDIS_REST_URL = "https://stub.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "stub_token";

    const result = validateEnv(["redis"], false);

    expect(result.valid).toBe(true);
    // Confirm no readiness-function errors were appended for the non-required backend
    expect(result.errors).toHaveLength(0);
  });

  it("defers Upstash credential checks during Next production build phase", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
      RATE_LIMIT_BACKEND: "auto",
    };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const result = validateEnv(["redis"], false);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(
      result.warnings.some((w) =>
        w.includes("Deferring Upstash credential checks"),
      ),
    ).toBe(true);
  });
});

describe("env build-vs-runtime secret validation", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.argv = [...ORIGINAL_ARGV];
  });

  it("defers missing server-only secrets during Next production build phase", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "development",
      NEXT_PHASE: "phase-production-build",
    };
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_deferred";
    delete process.env.CLERK_SECRET_KEY;

    const result = validateEnv(["clerk"], false);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toContain(
      "[clerk] Deferring required server env until runtime: CLERK_SECRET_KEY",
    );
  });

  it("fails fast at runtime when deferred server-only secrets are still missing", () => {
    process.env = {
      ...process.env,
      NODE_ENV: "development",
    };
    delete process.env.NEXT_PHASE;
    process.argv = ["node", "vitest"];
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_runtime";
    delete process.env.CLERK_SECRET_KEY;

    expect(() => validateEnv(["clerk"], true)).toThrow(
      /Missing required: CLERK_SECRET_KEY/,
    );
  });
});

describe("env storage alias resolution", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.argv = [...ORIGINAL_ARGV];
  });

  it("prefers canonical R2 variables over AWS/S3 aliases", async () => {
    process.env = { ...process.env, NODE_ENV: "test" };
    process.env.R2_ACCESS_KEY_ID = "r2-key";
    process.env.AWS_ACCESS_KEY_ID = "aws-key";
    process.env.S3_ACCESS_KEY_ID = "s3-key";
    process.env.R2_SECRET_ACCESS_KEY = "r2-secret";
    process.env.AWS_SECRET_ACCESS_KEY = "aws-secret";
    process.env.S3_SECRET_ACCESS_KEY = "s3-secret";
    process.env.R2_ENDPOINT = "https://r2.example.com";
    process.env.S3_URL = "https://s3.example.com";
    process.env.R2_ASSET_BUCKET = "r2-assets";
    process.env.STORAGE_BUCKET = "storage-assets";
    process.env.S3_ASSET_BUCKET = "s3-assets";
    process.env.R2_EXPORT_BUCKET = "r2-exports";
    process.env.S3_EXPORT_BUCKET = "s3-exports";
    process.env.R2_PUBLIC_BASE_URL = "https://cdn-r2.example.com";
    process.env.CDN_URL = "https://cdn-legacy.example.com";
    process.env.R2_REGION = "auto";
    process.env.AWS_REGION = "us-east-1";
    process.env.S3_REGION = "eu-west-1";

    const { env } = await importFreshEnvModule();

    expect(env.storage.accessKeyId).toBe("r2-key");
    expect(env.storage.secretAccessKey).toBe("r2-secret");
    expect(env.storage.endpoint).toBe("https://r2.example.com");
    expect(env.storage.assetBucket).toBe("r2-assets");
    expect(env.storage.publicBaseUrl).toBe("https://cdn-r2.example.com");
    expect(env.storage.region).toBe("auto");
    expect(env.s3.exportBucket).toBe("r2-exports");
  });

  it("falls back to AWS credentials and storage aliases when R2 variables are absent", async () => {
    process.env = { ...process.env, NODE_ENV: "test" };
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_ENDPOINT;
    delete process.env.R2_ASSET_BUCKET;
    delete process.env.R2_PUBLIC_BASE_URL;
    delete process.env.R2_REGION;
    delete process.env.R2_EXPORT_BUCKET;

    process.env.AWS_ACCESS_KEY_ID = "aws-key";
    process.env.AWS_SECRET_ACCESS_KEY = "aws-secret";
    process.env.AWS_REGION = "us-west-2";
    process.env.S3_URL = "https://s3-compat.example.com";
    process.env.STORAGE_BUCKET = "storage-assets";
    process.env.CDN_URL = "https://cdn-legacy.example.com";
    process.env.S3_EXPORT_BUCKET = "s3-exports";

    const { env } = await importFreshEnvModule();

    expect(env.storage.accessKeyId).toBe("aws-key");
    expect(env.storage.secretAccessKey).toBe("aws-secret");
    expect(env.storage.endpoint).toBe("https://s3-compat.example.com");
    expect(env.storage.assetBucket).toBe("storage-assets");
    expect(env.storage.publicBaseUrl).toBe("https://cdn-legacy.example.com");
    expect(env.storage.region).toBe("us-west-2");
    expect(env.s3.exportBucket).toBe("s3-exports");
  });

  it("falls back to S3 aliases when neither R2 nor AWS credentials are provided", async () => {
    process.env = { ...process.env, NODE_ENV: "test" };
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_ENDPOINT;
    delete process.env.R2_ASSET_BUCKET;
    delete process.env.R2_PUBLIC_BASE_URL;
    delete process.env.R2_REGION;
    delete process.env.R2_EXPORT_BUCKET;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_REGION;

    process.env.S3_ACCESS_KEY_ID = "s3-key";
    process.env.S3_SECRET_ACCESS_KEY = "s3-secret";
    process.env.S3_REGION = "eu-central-1";
    process.env.S3_URL = "https://legacy-s3.example.com";
    process.env.S3_ASSET_BUCKET = "s3-assets";
    process.env.CDN_URL = "https://cdn-s3.example.com";
    process.env.EXPORTS_BUCKET_NAME = "legacy-exports";

    const { env } = await importFreshEnvModule();

    expect(env.storage.accessKeyId).toBe("s3-key");
    expect(env.storage.secretAccessKey).toBe("s3-secret");
    expect(env.storage.endpoint).toBe("https://legacy-s3.example.com");
    expect(env.storage.assetBucket).toBe("s3-assets");
    expect(env.storage.publicBaseUrl).toBe("https://cdn-s3.example.com");
    expect(env.storage.region).toBe("eu-central-1");
    expect(env.s3.exportBucket).toBe("legacy-exports");
  });
});

describe("env storage production readiness validation", () => {
  function applyRemoteStorageBaseline() {
    process.env = { ...process.env, NODE_ENV: "production" };
    process.env.STORAGE_PROVIDER = "s3";
    process.env.S3_DISABLED = "false";
    process.env.R2_ENDPOINT = "https://r2.example.com";
    process.env.R2_ACCESS_KEY_ID = "r2-key";
    process.env.R2_SECRET_ACCESS_KEY = "r2-secret";
    process.env.R2_ASSET_BUCKET = "assets";
    process.env.R2_PUBLIC_BASE_URL = "https://cdn.example.com";
  }

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.argv = [...ORIGINAL_ARGV];
  });

  it("fails closed when endpoint is missing in production remote storage", () => {
    applyRemoteStorageBaseline();
    delete process.env.R2_ENDPOINT;
    delete process.env.S3_URL;

    const result = validateEnv(["storage"], false);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("R2_ENDPOINT"))).toBe(true);
  });

  it("fails closed when credentials are missing in production remote storage", () => {
    applyRemoteStorageBaseline();
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.S3_SECRET_ACCESS_KEY;

    const result = validateEnv(["storage"], false);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("R2_ACCESS_KEY_ID"))).toBe(
      true,
    );
    expect(result.errors.some((e) => e.includes("R2_SECRET_ACCESS_KEY"))).toBe(
      true,
    );
  });

  it("fails closed when asset bucket is missing in production remote storage", () => {
    applyRemoteStorageBaseline();
    delete process.env.R2_ASSET_BUCKET;
    delete process.env.STORAGE_BUCKET;
    delete process.env.S3_ASSET_BUCKET;

    const result = validateEnv(["storage"], false);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("R2_ASSET_BUCKET"))).toBe(true);
  });

  it("fails closed when public base URL is missing or invalid in production remote storage", () => {
    applyRemoteStorageBaseline();
    process.env.R2_PUBLIC_BASE_URL = "cdn-relative-path";
    delete process.env.CDN_URL;

    const result = validateEnv(["storage"], false);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("R2_PUBLIC_BASE_URL"))).toBe(
      true,
    );
  });

  it("preserves local provider behavior in non-production environments", () => {
    process.env = { ...process.env, NODE_ENV: "development" };
    process.env.STORAGE_PROVIDER = "local";
    process.env.S3_DISABLED = "true";
    delete process.env.R2_ENDPOINT;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_ASSET_BUCKET;
    delete process.env.R2_PUBLIC_BASE_URL;

    const result = validateEnv(["storage"], false);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  describe("env database validation — hosted loopback guard", () => {
    it("accepts a remote Supabase pooler URL in production", () => {
      process.env = { ...process.env, NODE_ENV: "production" };
      process.env.DATABASE_URL =
        "postgresql://postgres.testref:pass@aws-1.pooler.supabase.com:5432/postgres";

      const result = validateEnv(["database"], false);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects loopback host 127.0.0.1 in production", () => {
      process.env = { ...process.env, NODE_ENV: "production" };
      delete process.env.ALLOW_LOCALHOST_DB;
      process.env.DATABASE_URL =
        "postgresql://postgres:pass@127.0.0.1:5432/postgres";

      const result = validateEnv(["database"], false);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("DATABASE_URL"))).toBe(true);
    });

    it("rejects loopback host localhost when VERCEL=1", () => {
      process.env = { ...process.env, VERCEL: "1", NODE_ENV: "development" };
      delete process.env.ALLOW_LOCALHOST_DB;
      process.env.DATABASE_URL =
        "postgresql://postgres:pass@localhost:5432/postgres";

      const result = validateEnv(["database"], false);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("DATABASE_URL"))).toBe(true);
    });

    it("allows loopback host in development without ALLOW_LOCALHOST_DB", () => {
      process.env = { ...process.env, NODE_ENV: "development" };
      delete process.env.VERCEL;
      process.env.DATABASE_URL =
        "postgresql://postgres:pass@127.0.0.1:5432/postgres";

      const result = validateEnv(["database"], false);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("allows loopback host in production when ALLOW_LOCALHOST_DB=true", () => {
      process.env = {
        ...process.env,
        NODE_ENV: "production",
        ALLOW_LOCALHOST_DB: "true",
      };
      process.env.DATABASE_URL =
        "postgresql://postgres:pass@127.0.0.1:5432/postgres";

      const result = validateEnv(["database"], false);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
