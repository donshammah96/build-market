import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockEnv } = vi.hoisted(() => ({
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
      cdnUrl: "/uploads",
      accessKeyId: undefined,
      secretAccessKey: undefined,
    },
  },
}));

vi.mock("@/app/lib/infrastructure/env", () => ({
  env: mockEnv,
}));

import { createStorageProvider } from "@/app/lib/infrastructure/storage";

describe("storage configuration invariants", () => {
  beforeEach(() => {
    mockEnv.isProd = false;
    mockEnv.appUrl = "https://app.buildmarket.test";
    mockEnv.apiUrl = "https://api.buildmarket.test";
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

    expect(() =>
      createStorageProvider({
        provider: "s3",
        bucket: "assets-bucket",
        cdnUrl: "/uploads",
      }),
    ).toThrow(/CDN URL must be an absolute remote origin/i);
  });

  it("blocks same-origin upload delivery in production", () => {
    mockEnv.isProd = true;

    expect(() =>
      createStorageProvider({
        provider: "s3",
        bucket: "assets-bucket",
        cdnUrl: "https://app.buildmarket.test/uploads",
      }),
    ).toThrow(/must not be served from the application origin/i);
  });

  it("requires a bucket for remote storage providers", () => {
    mockEnv.isProd = true;

    expect(() =>
      createStorageProvider({
        provider: "s3",
        bucket: undefined,
        cdnUrl: "https://cdn.buildmarket.test",
      }),
    ).toThrow(/requires STORAGE_BUCKET/i);
  });

  it("allows a fully configured S3 provider in production", () => {
    mockEnv.isProd = true;

    const provider = createStorageProvider({
      provider: "s3",
      bucket: "assets-bucket",
      region: "af-south-1",
      cdnUrl: "https://cdn.buildmarket.test",
    });

    expect(provider).toBeDefined();
  });
});
