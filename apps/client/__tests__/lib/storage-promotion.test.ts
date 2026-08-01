import { describe, expect, it, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  createStorageProvider,
  StorageProvider,
} from "@/app/lib/infrastructure/storage";

const { mockEnv, sendMock, TEST_DIR } = vi.hoisted(() => {
  const testDir = "./tmp/storage-promotion-test";
  return {
    TEST_DIR: testDir,
    mockEnv: {
      isProd: false,
      appUrl: "https://app.buildmarket.test",
      apiUrl: "https://api.buildmarket.test",
      storage: {
        provider: "local" as "local" | "s3" | "gcs",
        localPath: testDir,
        bucket: "buildmarket-assets",
        privateBucket: "buildmarket-verified-private",
        stagedBucket: "buildmarket-staged",
        quarantineBucket: "buildmarket-quarantine",
        region: "auto",
        endpoint: "https://account.r2.cloudflarestorage.com",
        cdnUrl: "/uploads",
        accessKeyId: "r2-access-key",
        secretAccessKey: "r2-secret-key",
      },
    },
    sendMock: vi.fn(),
  };
});

vi.mock("@/app/lib/infrastructure/env", () => ({
  env: mockEnv,
}));

vi.mock("@aws-sdk/client-s3", () => {
  class S3Client {
    send = sendMock;
  }
  class PutObjectCommand {
    constructor(public input: unknown) {}
  }
  class GetObjectCommand {
    constructor(public input: unknown) {}
  }
  class HeadObjectCommand {
    constructor(public input: unknown) {}
  }
  class CopyObjectCommand {
    constructor(public input: unknown) {}
  }
  class DeleteObjectCommand {
    constructor(public input: unknown) {}
  }

  return {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    CopyObjectCommand,
    DeleteObjectCommand,
    S3ServiceException: Error,
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://storage.example.com/signed"),
}));

describe("Storage promotion and quarantine lifecycle", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await fs.promises
      .rm(TEST_DIR, { recursive: true, force: true })
      .catch(() => undefined);
  });

  describe("LocalStorageProvider", () => {
    it("promotes staged local objects to verified private path", async () => {
      const provider = createStorageProvider({
        provider: "local",
        localPath: TEST_DIR,
      });
      const stagedKey = "staged/onboarding/document.pdf";
      const targetKey = "verified/user_123/document.pdf";

      await provider.putObject(
        stagedKey,
        Buffer.from("PDF_CONTENT"),
        "application/pdf",
        {
          visibility: "private",
        },
      );

      const result = await provider.promoteStagedObject(stagedKey, targetKey);

      expect(result.size).toBe(Buffer.from("PDF_CONTENT").length);
      expect(typeof result.checksum).toBe("string");
      expect(await provider.exists(targetKey, { visibility: "private" })).toBe(
        true,
      );
    });

    it("quarantines staged local objects to quarantine path", async () => {
      const provider = createStorageProvider({
        provider: "local",
        localPath: TEST_DIR,
      });
      const stagedKey = "staged/malware.bin";
      const quarantineKey = "infected.bin";

      await provider.putObject(
        stagedKey,
        Buffer.from("EICAR_TEST"),
        "application/octet-stream",
      );

      await provider.quarantineStagedObject(stagedKey, quarantineKey);

      expect(await provider.exists(stagedKey)).toBe(false);
      expect(await provider.exists(`quarantine/${quarantineKey}`)).toBe(true);
    });
  });

  describe("S3StorageProvider", () => {
    it("promotes staged objects using CopyObjectCommand and returns checksum/size", async () => {
      mockEnv.storage.provider = "s3";
      sendMock.mockImplementation((command) => {
        if (command.constructor.name === "HeadObjectCommand") {
          return Promise.resolve({
            ContentLength: 1024,
            Metadata: { checksum: "abc123sha256" },
            ETag: '"etag-123"',
          });
        }
        return Promise.resolve({});
      });

      const provider = createStorageProvider({
        provider: "s3",
        bucket: "buildmarket-assets",
        privateBucket: "buildmarket-verified-private",
        stagedBucket: "buildmarket-staged",
        cdnUrl: "https://cdn.buildmarket.test",
        endpoint: "https://account.r2.cloudflarestorage.com",
      });

      const result = await provider.promoteStagedObject(
        "staged/doc.pdf",
        "verified/doc.pdf",
      );

      expect(result).toEqual({
        checksum: "abc123sha256",
        size: 1024,
      });

      expect(sendMock).toHaveBeenCalledTimes(3);
    });

    it("quarantines infected staged objects to R2_BUCKET_QUARANTINE", async () => {
      mockEnv.storage.provider = "s3";
      sendMock.mockResolvedValue({});

      const provider = createStorageProvider({
        provider: "s3",
        bucket: "buildmarket-assets",
        privateBucket: "buildmarket-verified-private",
        stagedBucket: "buildmarket-staged",
        quarantineBucket: "buildmarket-quarantine",
        cdnUrl: "https://cdn.buildmarket.test",
        endpoint: "https://account.r2.cloudflarestorage.com",
      });

      await provider.quarantineStagedObject(
        "staged/virus.exe",
        "quarantine/virus.exe",
      );

      expect(sendMock).toHaveBeenCalledTimes(2);
    });
  });
});
