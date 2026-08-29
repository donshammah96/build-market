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

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/infrastructure/env", () => {
  const mockConfig = {
    ENCRYPTION_KEY_V1: "a".repeat(64),
    ENCRYPTION_KEY_V2: "b".repeat(64),
    CURRENT_KEY_VERSION: "v1",
    ENCRYPTION_MIGRATION_MODE: false,
    LEGACY_FORMAT_DEADLINE: new Date(
      Date.now() + 90 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    ENCRYPTION_KEY: undefined,
    NODE_ENV: "test",
  };
  return {
    adminEnvConfig: mockConfig,
  };
});

import { adminEnvConfig } from "@/lib/infrastructure/env";
import {
  FieldEncryption,
  DecryptionError,
  loadEncryptionKeys,
} from "../field-encryption";

// Alias the imported mock config to mockEnvConfig for backward compatibility with existing test assertions
const mockEnvConfig = adminEnvConfig as any;

describe("FieldEncryption", () => {
  beforeEach(() => {
    // Reset mock environment
    mockEnvConfig.ENCRYPTION_KEY_V1 = "a".repeat(64);
    mockEnvConfig.ENCRYPTION_KEY_V2 = "b".repeat(64);
    mockEnvConfig.CURRENT_KEY_VERSION = "v1";
    mockEnvConfig.ENCRYPTION_MIGRATION_MODE = false;
    mockEnvConfig.LEGACY_FORMAT_DEADLINE = new Date(
      Date.now() + 90 * 24 * 60 * 60 * 1000,
    ).toISOString();
    mockEnvConfig.ENCRYPTION_KEY = undefined;

    // Reset configuration
    loadEncryptionKeys(true);
  });

  describe("Key Configuration", () => {
    it("should throw error when no encryption keys are configured", () => {
      // Remove all encryption keys
      mockEnvConfig.ENCRYPTION_KEY_V1 = undefined;
      mockEnvConfig.ENCRYPTION_KEY_V2 = undefined;
      mockEnvConfig.ENCRYPTION_KEY = undefined;

      expect(() => loadEncryptionKeys(true)).toThrow(
        "FATAL: No encryption keys configured",
      );
    });

    it("should throw error when key is not 64 hex characters", () => {
      mockEnvConfig.ENCRYPTION_KEY_V1 = "tooshort";

      expect(() => loadEncryptionKeys(true)).toThrow(
        "must be exactly 64 hex characters",
      );
    });

    it("should throw error when CURRENT_KEY_VERSION is not configured", () => {
      mockEnvConfig.CURRENT_KEY_VERSION = "v3"; // v3 key doesn't exist

      expect(() => loadEncryptionKeys(true)).toThrow(
        "ENCRYPTION_KEY_V3 is not configured",
      );
    });

    it("should load legacy ENCRYPTION_KEY as v1 fallback", () => {
      mockEnvConfig.ENCRYPTION_KEY_V1 = undefined;
      mockEnvConfig.ENCRYPTION_KEY = "c".repeat(64);
      mockEnvConfig.CURRENT_KEY_VERSION = "v1";

      loadEncryptionKeys(true);
      const metadata = FieldEncryption.getMetadata();

      expect(metadata.availableVersions).toContain("v1");
    });

    it("should validate configuration correctly", () => {
      const config = FieldEncryption.validateConfiguration();

      expect(config.valid).toBe(true);
      expect(config.errors).toHaveLength(0);
    });
  });

  describe("Deterministic Encryption", () => {
    it("should produce same output for same input", () => {
      const plaintext = "A123456789B";
      const encrypted1 = FieldEncryption.encryptDeterministic(plaintext);
      const encrypted2 = FieldEncryption.encryptDeterministic(plaintext);

      expect(encrypted1).toBe(encrypted2);
    });

    it("should include version prefix in output", () => {
      const encrypted = FieldEncryption.encryptDeterministic("test");

      expect(encrypted).toMatch(/^v1:/);
    });

    it("should have correct format: version:iv:authTag:encrypted", () => {
      const encrypted = FieldEncryption.encryptDeterministic("test");
      const parts = encrypted.split(":");

      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe("v1");
      expect(parts[1]).toHaveLength(24); // IV is 12 bytes = 24 hex chars
      expect(parts[2]).toHaveLength(32); // AuthTag is 16 bytes = 32 hex chars
      expect(parts[3]).toBeDefined();
      expect(parts[3]!.length).toBeGreaterThan(0);
    });

    it("should return empty string for empty input", () => {
      expect(FieldEncryption.encryptDeterministic("")).toBe("");
      expect(FieldEncryption.encryptDeterministic(null as any)).toBeFalsy();
    });
  });

  describe("Randomized Encryption", () => {
    it("should produce different output for same input", () => {
      const plaintext = "+254712345678";
      const encrypted1 = FieldEncryption.encryptRandomized(plaintext);
      const encrypted2 = FieldEncryption.encryptRandomized(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it("should include version prefix in output", () => {
      const encrypted = FieldEncryption.encryptRandomized("test");

      expect(encrypted).toMatch(/^v1:/);
    });

    it("should return empty string for empty input", () => {
      expect(FieldEncryption.encryptRandomized("")).toBe("");
    });
  });

  describe("Decryption", () => {
    it("should decrypt deterministically encrypted data", () => {
      const plaintext = "A123456789B";
      const encrypted = FieldEncryption.encryptDeterministic(plaintext);
      const decrypted = FieldEncryption.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should decrypt randomized encrypted data", () => {
      const plaintext = "+254712345678";
      const encrypted = FieldEncryption.encryptRandomized(plaintext);
      const decrypted = FieldEncryption.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should return original text for non-encrypted input", () => {
      const plaintext = "notencrypted";
      const result = FieldEncryption.decrypt(plaintext);

      expect(result).toBe(plaintext);
    });

    it("should handle empty input", () => {
      expect(FieldEncryption.decrypt("")).toBe("");
      expect(FieldEncryption.decrypt(null as any)).toBeFalsy();
    });

    it("should handle text without colons", () => {
      const text = "plaintext-no-colons";
      expect(FieldEncryption.decrypt(text)).toBe(text);
    });
  });

  describe("Legacy Format Support", () => {
    it("should detect legacy format correctly", () => {
      // Legacy format: iv(24):authTag(32):encrypted
      const legacyFormat =
        "a".repeat(24) + ":" + "b".repeat(32) + ":" + "c".repeat(20);
      const versionedFormat =
        "v1:" + "a".repeat(24) + ":" + "b".repeat(32) + ":" + "c".repeat(20);

      expect(FieldEncryption.isLegacyFormat(legacyFormat)).toBe(true);
      expect(FieldEncryption.isLegacyFormat(versionedFormat)).toBe(false);
    });

    it("should get key version from encrypted text", () => {
      const encrypted = FieldEncryption.encryptDeterministic("test");
      const version = FieldEncryption.getKeyVersion(encrypted);

      expect(version).toBe("v1");
    });

    it("should return v1 for legacy format", () => {
      const legacyFormat =
        "a".repeat(24) + ":" + "b".repeat(32) + ":" + "c".repeat(20);
      const version = FieldEncryption.getKeyVersion(legacyFormat);

      expect(version).toBe("v1");
    });
  });

  describe("isEncrypted Detection", () => {
    it("should detect versioned encrypted format", () => {
      const encrypted = FieldEncryption.encryptDeterministic("test");

      expect(FieldEncryption.isEncrypted(encrypted)).toBe(true);
    });

    it("should detect legacy encrypted format", () => {
      const legacyFormat =
        "a".repeat(24) + ":" + "b".repeat(32) + ":" + "c".repeat(20);

      expect(FieldEncryption.isEncrypted(legacyFormat)).toBe(true);
    });

    it("should return false for plain text", () => {
      expect(FieldEncryption.isEncrypted("plaintext")).toBe(false);
      expect(FieldEncryption.isEncrypted("has:colons:but:invalid")).toBe(false);
      expect(FieldEncryption.isEncrypted("")).toBe(false);
      expect(FieldEncryption.isEncrypted(null as any)).toBe(false);
    });
  });

  describe("Re-encryption for Key Rotation", () => {
    it("should re-encrypt data to current version", () => {
      const plaintext = "sensitive-data";
      const encrypted = FieldEncryption.encryptDeterministic(plaintext);

      // Re-encrypt (should return same since already on current version)
      const reEncrypted = FieldEncryption.reEncrypt(encrypted, "deterministic");

      expect(reEncrypted).toBe(encrypted); // Already on v1, no change
    });

    it("should skip re-encryption if already on current version", () => {
      const encrypted = FieldEncryption.encryptDeterministic("test");
      const reEncrypted = FieldEncryption.reEncrypt(encrypted, "deterministic");

      expect(reEncrypted).toBe(encrypted);
    });

    it("should handle empty input", () => {
      expect(FieldEncryption.reEncrypt("", "deterministic")).toBe("");
    });
  });

  describe("Error Handling", () => {
    it("should throw DecryptionError in production mode on failure", () => {
      mockEnvConfig.ENCRYPTION_MIGRATION_MODE = false;
      loadEncryptionKeys(true);

      // Create corrupted encrypted data
      const corrupted =
        "v1:" + "a".repeat(24) + ":" + "b".repeat(32) + ":corrupted";

      expect(() => FieldEncryption.decrypt(corrupted)).toThrow(DecryptionError);
    });

    it("should return original in migration mode on failure", () => {
      mockEnvConfig.ENCRYPTION_MIGRATION_MODE = true;
      loadEncryptionKeys(true);

      // Create corrupted encrypted data
      const corrupted =
        "v1:" + "a".repeat(24) + ":" + "b".repeat(32) + ":corrupted";

      // Should not throw, should return original
      const result = FieldEncryption.decrypt(corrupted);
      expect(result).toBe(corrupted);
    });
  });

  describe("Metadata", () => {
    it("should return correct metadata", () => {
      const metadata = FieldEncryption.getMetadata();

      expect(metadata.currentVersion).toBe("v1");
      expect(metadata.availableVersions).toContain("v1");
      expect(metadata.availableVersions).toContain("v2");
      expect(metadata.migrationMode).toBe(false);
      expect(metadata.legacyDeadline).toBeDefined();
    });
  });

  describe("Round-trip Tests", () => {
    it("should round-trip various data types correctly", () => {
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
