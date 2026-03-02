/**
 * Unit Tests for Field Encryption
 *
 * Tests GDPR encryption functionality including:
 * - Key validation and loading
 * - Deterministic encryption (same input = same output)
 * - Randomized encryption (same input = different output)
 * - Decryption of both formats
 * - Key versioning and legacy format support
 * - Error handling and migration mode
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock environment variables before importing the module
const mockEnv = {
  ENCRYPTION_KEY_V1: "a".repeat(64), // Valid 32-byte hex key
  ENCRYPTION_KEY_V2: "b".repeat(64), // Second key for rotation
  CURRENT_KEY_VERSION: "v1",
  ENCRYPTION_MIGRATION_MODE: "false",
  LEGACY_FORMAT_DEADLINE: new Date(
    Date.now() + 90 * 24 * 60 * 60 * 1000,
  ).toISOString(),
};

// Store original env
const originalEnv = { ...process.env };

describe("FieldEncryption", () => {
  beforeEach(() => {
    // Reset module cache to allow re-importing with new env
    vi.resetModules();
    // Set mock environment
    Object.assign(process.env, mockEnv);
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  describe("Key Configuration", () => {
    it("should throw error when no encryption keys are configured", async () => {
      // Remove all encryption keys
      delete process.env.ENCRYPTION_KEY_V1;
      delete process.env.ENCRYPTION_KEY_V2;
      delete process.env.ENCRYPTION_KEY;

      await expect(async () => {
        await import("../field-encryption");
      }).rejects.toThrow("FATAL: No encryption keys configured");
    });

    it("should throw error when key is not 64 hex characters", async () => {
      process.env.ENCRYPTION_KEY_V1 = "tooshort";

      await expect(async () => {
        await import("../field-encryption");
      }).rejects.toThrow("must be exactly 64 hex characters");
    });

    it("should throw error when CURRENT_KEY_VERSION is not configured", async () => {
      process.env.CURRENT_KEY_VERSION = "v3"; // v3 key doesn't exist

      await expect(async () => {
        await import("../field-encryption");
      }).rejects.toThrow("ENCRYPTION_KEY_V3 is not configured");
    });

    it("should load legacy ENCRYPTION_KEY as v1 fallback", async () => {
      delete process.env.ENCRYPTION_KEY_V1;
      process.env.ENCRYPTION_KEY = "c".repeat(64);
      process.env.CURRENT_KEY_VERSION = "v1";

      const { FieldEncryption } = await import("../field-encryption");
      const metadata = FieldEncryption.getMetadata();

      expect(metadata.availableVersions).toContain("v1");
    });

    it("should validate configuration correctly", async () => {
      const { FieldEncryption } = await import("../field-encryption");
      const config = FieldEncryption.validateConfiguration();

      expect(config.valid).toBe(true);
      expect(config.errors).toHaveLength(0);
    });
  });

  describe("Deterministic Encryption", () => {
    it("should produce same output for same input", async () => {
      const { FieldEncryption } = await import("../field-encryption");

      const plaintext = "A123456789B";
      const encrypted1 = FieldEncryption.encryptDeterministic(plaintext);
      const encrypted2 = FieldEncryption.encryptDeterministic(plaintext);

      expect(encrypted1).toBe(encrypted2);
    });

    it("should include version prefix in output", async () => {
      const { FieldEncryption } = await import("../field-encryption");

      const encrypted = FieldEncryption.encryptDeterministic("test");

      expect(encrypted).toMatch(/^v1:/);
    });

    it("should have correct format: version:iv:authTag:encrypted", async () => {
      const { FieldEncryption } = await import("../field-encryption");

      const encrypted = FieldEncryption.encryptDeterministic("test");
      const parts = encrypted.split(":");

      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe("v1");
      expect(parts[1]).toHaveLength(24); // IV is 12 bytes = 24 hex chars
      expect(parts[2]).toHaveLength(32); // AuthTag is 16 bytes = 32 hex chars
      expect(parts[3]).toBeDefined();
      expect(parts[3]!.length).toBeGreaterThan(0);
    });

    it("should return empty string for empty input", async () => {
      const { FieldEncryption } = await import("../field-encryption");

      expect(FieldEncryption.encryptDeterministic("")).toBe("");
      expect(FieldEncryption.encryptDeterministic(null as any)).toBeFalsy();
    });
  });

  describe("Randomized Encryption", () => {
    it("should produce different output for same input", async () => {
      const { FieldEncryption } = await import("../field-encryption");

      const plaintext = "+254712345678";
      const encrypted1 = FieldEncryption.encryptRandomized(plaintext);
      const encrypted2 = FieldEncryption.encryptRandomized(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it("should include version prefix in output", async () => {
      const { FieldEncryption } = await import("../field-encryption");

      const encrypted = FieldEncryption.encryptRandomized("test");

      expect(encrypted).toMatch(/^v1:/);
    });

    it("should return empty string for empty input", async () => {
      const { FieldEncryption } = await import("../field-encryption");

      expect(FieldEncryption.encryptRandomized("")).toBe("");
    });
  });

  describe("Decryption", () => {
    it("should decrypt deterministically encrypted data", async () => {
      const { FieldEncryption } = await import("../field-encryption");

      const plaintext = "A123456789B";
      const encrypted = FieldEncryption.encryptDeterministic(plaintext);
      const decrypted = FieldEncryption.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should decrypt randomized encrypted data", async () => {
      const { FieldEncryption } = await import("../field-encryption");

      const plaintext = "+254712345678";
      const encrypted = FieldEncryption.encryptRandomized(plaintext);
      const decrypted = FieldEncryption.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should return original text for non-encrypted input", async () => {
      const { FieldEncryption } = await import("../field-encryption");

      const plaintext = "notencrypted";
      const result = FieldEncryption.decrypt(plaintext);

      expect(result).toBe(plaintext);
    });

    it("should handle empty input", async () => {
      const { FieldEncryption } = await import("../field-encryption");

      expect(FieldEncryption.decrypt("")).toBe("");
      expect(FieldEncryption.decrypt(null as any)).toBeFalsy();
    });

    it("should handle text without colons", async () => {
      const { FieldEncryption } = await import("../field-encryption");

      const text = "plaintext-no-colons";
      expect(FieldEncryption.decrypt(text)).toBe(text);
    });
  });

  describe("Legacy Format Support", () => {
    it("should detect legacy format correctly", async () => {
      const { FieldEncryption } = await import("../field-encryption");

      // Legacy format: iv(24):authTag(32):encrypted
      const legacyFormat =
        "a".repeat(24) + ":" + "b".repeat(32) + ":" + "c".repeat(20);
      const versionedFormat =
        "v1:" + "a".repeat(24) + ":" + "b".repeat(32) + ":" + "c".repeat(20);

      expect(FieldEncryption.isLegacyFormat(legacyFormat)).toBe(true);
      expect(FieldEncryption.isLegacyFormat(versionedFormat)).toBe(false);
    });

    it("should get key version from encrypted text", async () => {
      const { FieldEncryption } = await import("../field-encryption");

      const encrypted = FieldEncryption.encryptDeterministic("test");
      const version = FieldEncryption.getKeyVersion(encrypted);

      expect(version).toBe("v1");
    });

    it("should return v1 for legacy format", async () => {
      const { FieldEncryption } = await import("../field-encryption");

      const legacyFormat =
        "a".repeat(24) + ":" + "b".repeat(32) + ":" + "c".repeat(20);
      const version = FieldEncryption.getKeyVersion(legacyFormat);

      expect(version).toBe("v1");
    });
  });

  describe("isEncrypted Detection", () => {
    it("should detect versioned encrypted format", async () => {
      const { FieldEncryption } = await import("../field-encryption");

      const encrypted = FieldEncryption.encryptDeterministic("test");

      expect(FieldEncryption.isEncrypted(encrypted)).toBe(true);
    });

    it("should detect legacy encrypted format", async () => {
      const { FieldEncryption } = await import("../field-encryption");

      const legacyFormat =
        "a".repeat(24) + ":" + "b".repeat(32) + ":" + "c".repeat(20);

      expect(FieldEncryption.isEncrypted(legacyFormat)).toBe(true);
    });

    it("should return false for plain text", async () => {
      const { FieldEncryption } = await import("../field-encryption");

      expect(FieldEncryption.isEncrypted("plaintext")).toBe(false);
      expect(FieldEncryption.isEncrypted("has:colons:but:invalid")).toBe(false);
      expect(FieldEncryption.isEncrypted("")).toBe(false);
      expect(FieldEncryption.isEncrypted(null as any)).toBe(false);
    });
  });

  describe("Re-encryption for Key Rotation", () => {
    it("should re-encrypt data to current version", async () => {
      const { FieldEncryption } = await import("../field-encryption");

      const plaintext = "sensitive-data";
      const encrypted = FieldEncryption.encryptDeterministic(plaintext);

      // Re-encrypt (should return same since already on current version)
      const reEncrypted = FieldEncryption.reEncrypt(encrypted, "deterministic");

      expect(reEncrypted).toBe(encrypted); // Already on v1, no change
    });

    it("should skip re-encryption if already on current version", async () => {
      const { FieldEncryption } = await import("../field-encryption");

      const encrypted = FieldEncryption.encryptDeterministic("test");
      const reEncrypted = FieldEncryption.reEncrypt(encrypted, "deterministic");

      expect(reEncrypted).toBe(encrypted);
    });

    it("should handle empty input", async () => {
      const { FieldEncryption } = await import("../field-encryption");

      expect(FieldEncryption.reEncrypt("", "deterministic")).toBe("");
    });
  });

  describe("Error Handling", () => {
    it("should throw DecryptionError in production mode on failure", async () => {
      process.env.ENCRYPTION_MIGRATION_MODE = "false";

      const { FieldEncryption, DecryptionError } = await import(
        "../field-encryption"
      );

      // Create corrupted encrypted data
      const corrupted =
        "v1:" + "a".repeat(24) + ":" + "b".repeat(32) + ":corrupted";

      expect(() => FieldEncryption.decrypt(corrupted)).toThrow(DecryptionError);
    });

    it("should return original in migration mode on failure", async () => {
      process.env.ENCRYPTION_MIGRATION_MODE = "true";
      vi.resetModules();

      const { FieldEncryption } = await import("../field-encryption");

      // Create corrupted encrypted data
      const corrupted =
        "v1:" + "a".repeat(24) + ":" + "b".repeat(32) + ":corrupted";

      // Should not throw, should return original
      const result = FieldEncryption.decrypt(corrupted);
      expect(result).toBe(corrupted);
    });
  });

  describe("Metadata", () => {
    it("should return correct metadata", async () => {
      const { FieldEncryption } = await import("../field-encryption");

      const metadata = FieldEncryption.getMetadata();

      expect(metadata.currentVersion).toBe("v1");
      expect(metadata.availableVersions).toContain("v1");
      expect(metadata.availableVersions).toContain("v2");
      expect(metadata.migrationMode).toBe(false);
      expect(metadata.legacyDeadline).toBeDefined();
    });
  });

  describe("Round-trip Tests", () => {
    it("should round-trip various data types correctly", async () => {
      const { FieldEncryption } = await import("../field-encryption");

      const testCases = [
        "simple",
        "+254712345678",
        "A123456789B", // KRA PIN format
        "user@example.com",
        "Special chars: !@#$%^&*()",
        "Unicode: 日本語 العربية",
        "Very long string ".repeat(100),
        "   spaces   ",
        "line\nbreak",
      ];

      for (const plaintext of testCases) {
        const encryptedDet = FieldEncryption.encryptDeterministic(plaintext);
        const encryptedRand = FieldEncryption.encryptRandomized(plaintext);

        expect(FieldEncryption.decrypt(encryptedDet)).toBe(plaintext);
        expect(FieldEncryption.decrypt(encryptedRand)).toBe(plaintext);
      }
    });
  });
});
