import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStorageProvider } from "@/app/lib/infrastructure/storage";

describe("storage configuration invariants", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.buildmarket.test");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.buildmarket.test");
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
    vi.stubEnv("NODE_ENV", "production");

    expect(() =>
      createStorageProvider({
        provider: "local",
        cdnUrl: "https://cdn.buildmarket.test",
      }),
    ).toThrow(/local storage provider is prohibited in production/i);
  });

  it("blocks relative upload origins in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() =>
      createStorageProvider({
        provider: "s3",
        bucket: "assets-bucket",
        cdnUrl: "/uploads",
      }),
    ).toThrow(/CDN URL must be an absolute remote origin/i);
  });

  it("blocks same-origin upload delivery in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() =>
      createStorageProvider({
        provider: "s3",
        bucket: "assets-bucket",
        cdnUrl: "https://app.buildmarket.test/uploads",
      }),
    ).toThrow(/must not be served from the application origin/i);
  });

  it("requires a bucket for remote storage providers", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() =>
      createStorageProvider({
        provider: "s3",
        bucket: undefined,
        cdnUrl: "https://cdn.buildmarket.test",
      }),
    ).toThrow(/requires STORAGE_BUCKET/i);
  });

  it("allows a fully configured S3 provider in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    const provider = createStorageProvider({
      provider: "s3",
      bucket: "assets-bucket",
      region: "af-south-1",
      cdnUrl: "https://cdn.buildmarket.test",
    });

    expect(provider).toBeDefined();
  });
});
