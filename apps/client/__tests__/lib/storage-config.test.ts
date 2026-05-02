import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertUploadProcessingModeInvariant } from "@/app/lib/infrastructure/upload-processing-mode";

const { mockEnv, s3ClientCtor } = vi.hoisted(() => ({
  mockEnv: {
    isProd: false,
    appUrl: "https://app.buildmarket.test",
    apiUrl: "https://api.buildmarket.test",
    storage: {
      provider: "local" as const,
      localPath: "./tmp/storage-config-test",
      bucket: undefined,
      assetBucket: undefined,
      region: "af-south-1",
      endpoint: undefined,
      cdnUrl: "/uploads",
      accessKeyId: undefined as string | undefined,
      secretAccessKey: undefined as string | undefined,
    },
  },
  s3ClientCtor: vi.fn(),
}));

vi.mock("@/app/lib/infrastructure/env", () => ({
  env: mockEnv,
}));

vi.mock("@aws-sdk/client-s3", () => {
  class S3Client {
    send = vi.fn();

    constructor(config: unknown) {
      s3ClientCtor(config);
    }
  }

  class PutObjectCommand {
    constructor(public input: unknown) {}
  }

  class DeleteObjectCommand {
    constructor(public input: unknown) {}
  }

  class HeadObjectCommand {
    constructor(public input: unknown) {}
  }

  class S3ServiceException extends Error {
    $metadata?: { httpStatusCode?: number };

    constructor(message: string, metadata?: { httpStatusCode?: number }) {
      super(message);
      this.$metadata = metadata;
    }
  }

  return {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
    S3ServiceException,
  };
});

import { createStorageProvider } from "@/app/lib/infrastructure/storage";

describe("storage configuration invariants", () => {
  beforeEach(() => {
    mockEnv.isProd = false;
    mockEnv.appUrl = "https://app.buildmarket.test";
    mockEnv.apiUrl = "https://api.buildmarket.test";
    mockEnv.storage.accessKeyId = undefined;
    mockEnv.storage.secretAccessKey = undefined;
    s3ClientCtor.mockReset();
  });

  it("allows local storage in non-production environments", () => {
    const provider = createStorageProvider({
      provider: "local",
      localPath: "./tmp/storage-config-test",
      cdnUrl: "/uploads",
    });

    expect(provider).toBeDefined();
  });

  it("blocks the local storage provider in production", () => {
    mockEnv.isProd = true;

    expect(() =>
      createStorageProvider({
        provider: "local",
        cdnUrl: "https://cdn.buildmarket.test",
      }),
    ).toThrow(/local storage provider is prohibited in production/i);
  });

  it("blocks relative upload origins in production", () => {
    mockEnv.isProd = true;
    mockEnv.storage.accessKeyId = "r2-key";
    mockEnv.storage.secretAccessKey = "r2-secret";

    expect(() =>
      createStorageProvider({
        provider: "s3",
        bucket: "assets-bucket",
        endpoint: "https://account.r2.cloudflarestorage.com",
        cdnUrl: "/uploads",
      }),
    ).toThrow(/CDN URL must be an absolute remote origin/i);
  });

  it("blocks same-origin upload delivery in production", () => {
    mockEnv.isProd = true;
    mockEnv.storage.accessKeyId = "r2-key";
    mockEnv.storage.secretAccessKey = "r2-secret";

    expect(() =>
      createStorageProvider({
        provider: "s3",
        bucket: "assets-bucket",
        endpoint: "https://account.r2.cloudflarestorage.com",
        cdnUrl: "https://app.buildmarket.test/uploads",
      }),
    ).toThrow(/must not be served from the application origin/i);
  });

  it("requires a bucket for remote storage providers", () => {
    mockEnv.isProd = true;
    mockEnv.storage.accessKeyId = "r2-key";
    mockEnv.storage.secretAccessKey = "r2-secret";

    expect(() =>
      createStorageProvider({
        provider: "s3",
        bucket: undefined,
        endpoint: "https://account.r2.cloudflarestorage.com",
        cdnUrl: "https://cdn.buildmarket.test",
      }),
    ).toThrow(/requires STORAGE_BUCKET/i);
  });

  it("requires a remote endpoint for S3-compatible providers in production", () => {
    mockEnv.isProd = true;
    mockEnv.storage.accessKeyId = "r2-key";
    mockEnv.storage.secretAccessKey = "r2-secret";

    expect(() =>
      createStorageProvider({
        provider: "s3",
        bucket: "assets-bucket",
        cdnUrl: "https://cdn.buildmarket.test",
      }),
    ).toThrow(/S3-compatible endpoint must be an absolute remote origin/i);
  });

  it("requires remote credentials for S3-compatible providers in production", () => {
    mockEnv.isProd = true;
    mockEnv.storage.accessKeyId = undefined;
    mockEnv.storage.secretAccessKey = undefined;

    expect(() =>
      createStorageProvider({
        provider: "s3",
        bucket: "assets-bucket",
        endpoint: "https://account.r2.cloudflarestorage.com",
        cdnUrl: "https://cdn.buildmarket.test",
      }),
    ).toThrow(/remote storage credentials are required in production/i);
  });

  it("allows a fully configured S3 provider in production", () => {
    mockEnv.isProd = true;
    mockEnv.storage.accessKeyId = "r2-key";
    mockEnv.storage.secretAccessKey = "r2-secret";

    const provider = createStorageProvider({
      provider: "s3",
      bucket: "assets-bucket",
      endpoint: "https://account.r2.cloudflarestorage.com",
      region: "auto",
      cdnUrl: "https://cdn.buildmarket.test",
    });

    expect(provider).toBeDefined();
    expect(s3ClientCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        region: "auto",
        endpoint: "https://account.r2.cloudflarestorage.com",
        credentials: {
          accessKeyId: "r2-key",
          secretAccessKey: "r2-secret",
        },
      }),
    );
  });

  it("blocks inline upload processing in production", () => {
    expect(() =>
      assertUploadProcessingModeInvariant({
        isProd: true,
        uploadProcessInline: true,
      }),
    ).toThrow(/UPLOAD_PROCESS_INLINE cannot be enabled in production/i);
  });
});
