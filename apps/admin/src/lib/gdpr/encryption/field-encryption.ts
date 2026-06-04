import crypto from "crypto";
import { adminEnvConfig } from "@/lib/infrastructure/env";
import { StructuredLogger } from "@build/resilience";

const logger = new StructuredLogger("gdpr-field-encryption");

// ============================================
// GDPR Field-Level Encryption with Key Rotation Support
// ============================================

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard IV size

// Key versioning for rotation support
// Format: v{version}:iv:authTag:encrypted (new) or iv:authTag:encrypted (legacy)
const CURRENT_KEY_VERSION = adminEnvConfig.CURRENT_KEY_VERSION || "v1";
const LEGACY_FORMAT_DEADLINE = adminEnvConfig.LEGACY_FORMAT_DEADLINE
  ? new Date(adminEnvConfig.LEGACY_FORMAT_DEADLINE)
  : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days from now

// Migration mode allows decryption to return original on failure (for data migration)
const ENCRYPTION_MIGRATION_MODE =
  adminEnvConfig.ENCRYPTION_MIGRATION_MODE === true;

/**
 * Encryption key registry supporting multiple versions for rotation
 */
interface KeyRegistry {
  [version: string]: Buffer;
}

const ENCRYPTION_KEYS: KeyRegistry = {};

/**
 * Validates and loads encryption keys from environment variables
 * Throws if no valid keys are configured (prevents silent security failures)
 */
function loadEncryptionKeys(): void {
  // Load versioned keys (v1, v2, etc.)
  const keyVersions = ["v1", "v2", "v3", "v4", "v5"];

  for (const version of keyVersions) {
    const envVar = `ENCRYPTION_KEY_${version.toUpperCase()}`;
    const keyHex = adminEnvConfig[envVar as keyof typeof adminEnvConfig] as
      | string
      | undefined;

    if (keyHex) {
      if (keyHex.length !== 64) {
        throw new Error(
          `FATAL: ${envVar} must be exactly 64 hex characters (32 bytes). ` +
            `Got ${keyHex.length} characters. Generate with: openssl rand -hex 32`,
        );
      }

      try {
        ENCRYPTION_KEYS[version] = Buffer.from(keyHex, "hex");
      } catch (error) {
        throw new Error(`FATAL: ${envVar} is not valid hexadecimal`);
      }
    }
  }

  // Fallback: Check legacy ENCRYPTION_KEY for backwards compatibility
  const legacyKey = adminEnvConfig.ENCRYPTION_KEY;
  if (legacyKey && !ENCRYPTION_KEYS["v1"]) {
    if (legacyKey.length !== 64) {
      throw new Error(
        `FATAL: ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). ` +
          `Got ${legacyKey.length} characters. Generate with: openssl rand -hex 32`,
      );
    }
    ENCRYPTION_KEYS["v1"] = Buffer.from(legacyKey, "hex");
    logger.warn(
      "Using legacy ENCRYPTION_KEY. Please migrate to ENCRYPTION_KEY_V1 for key rotation support.",
    );
  }

  // Ensure at least one key is configured
  if (Object.keys(ENCRYPTION_KEYS).length === 0) {
    throw new Error(
      "FATAL: No encryption keys configured. " +
        "Set ENCRYPTION_KEY_V1 (64 hex chars) in environment variables. " +
        "Generate with: openssl rand -hex 32",
    );
  }

  // Ensure current key version exists
  if (!ENCRYPTION_KEYS[CURRENT_KEY_VERSION]) {
    throw new Error(
      `FATAL: CURRENT_KEY_VERSION is set to "${CURRENT_KEY_VERSION}" ` +
        `but ENCRYPTION_KEY_${CURRENT_KEY_VERSION.toUpperCase()} is not configured.`,
    );
  }
}

// Load keys on module initialization
loadEncryptionKeys();

/**
 * Get the current encryption key for new encryptions
 */
function getCurrentKey(): Buffer {
  return ENCRYPTION_KEYS[CURRENT_KEY_VERSION]!;
}

/**
 * Get a key by version, or throw if not found
 */
function getKeyByVersion(version: string): Buffer {
  const key = ENCRYPTION_KEYS[version];
  if (!key) {
    throw new Error(
      `Encryption key version "${version}" not found in registry`,
    );
  }
  return key;
}

/**
 * Custom error class for decryption failures
 */
export class DecryptionError extends Error {
  constructor(
    message: string,
    public readonly isLegacyFormat: boolean = false,
  ) {
    super(message);
    this.name = "DecryptionError";
  }
}

export class FieldEncryption {
  /**
   * Encrypts data deterministically (same input = same output)
   * Use for fields that need exact match searching (e.g. KRA PIN)
   * Strategy: IV is derived from HMAC-SHA256(key, plaintext)
   * Format: v{version}:iv:authTag:encrypted
   */
  static encryptDeterministic(text: string): string {
    if (!text) return text;
    try {
      const key = getCurrentKey();

      // Derive IV from content to make it deterministic
      const iv = crypto
        .createHmac("sha256", key)
        .update(text)
        .digest()
        .subarray(0, IV_LENGTH);

      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      let encrypted = cipher.update(text, "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag();

      // Format: version:iv:authTag:encrypted
      return `${CURRENT_KEY_VERSION}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
    } catch (error) {
      logger.error(
        "Encryption failed",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw new Error("Encryption failed");
    }
  }

  /**
   * Encrypts data with random IV (semantic security)
   * Use for fields that only need retrieval (e.g. Phone, Email if strict)
   * Format: v{version}:iv:authTag:encrypted
   */
  static encryptRandomized(text: string): string {
    if (!text) return text;
    try {
      const key = getCurrentKey();
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

      let encrypted = cipher.update(text, "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag();

      // Format: version:iv:authTag:encrypted
      return `${CURRENT_KEY_VERSION}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
    } catch (error) {
      logger.error(
        "Encryption failed",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw new Error("Encryption failed");
    }
  }

  /**
   * Decrypts data (works for both deterministic and randomized, and all key versions)
   * Handles both versioned format (v1:iv:authTag:encrypted) and legacy (iv:authTag:encrypted)
   */
  static decrypt(encryptedText: string): string {
    if (!encryptedText || !encryptedText.includes(":")) return encryptedText;

    try {
      const parts = encryptedText.split(":");
      let version: string;
      let ivHex: string;
      let authTagHex: string;
      let encryptedHex: string;

      // Detect format: versioned (4 parts) vs legacy (3 parts)
      if (parts.length === 4 && parts[0]?.startsWith("v")) {
        // Versioned format: v1:iv:authTag:encrypted
        [version, ivHex, authTagHex, encryptedHex] = parts as [
          string,
          string,
          string,
          string,
        ];
      } else if (parts.length === 3) {
        // Legacy format: iv:authTag:encrypted (uses v1 key)
        version = "v1";
        [ivHex, authTagHex, encryptedHex] = parts as [string, string, string];

        // Warn about legacy format usage
        if (new Date() > LEGACY_FORMAT_DEADLINE) {
          logger.error(
            "Legacy encryption format detected after deadline. Run key rotation migration script immediately.",
            new Error("Legacy encryption format deadline exceeded"),
          );
        } else {
          logger.warn(
            `Legacy encryption format detected. Support ends on ${LEGACY_FORMAT_DEADLINE.toISOString()}. Run key rotation migration script.`,
          );
        }
      } else {
        // Not encrypted or invalid format
        return encryptedText;
      }

      if (!ivHex || !authTagHex || !encryptedHex) {
        return encryptedText;
      }

      const key = getKeyByVersion(version!);
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      logger.error(
        "Decryption failed",
        error instanceof Error ? error : new Error(String(error)),
      );

      // In migration mode, return original to allow mixed data handling
      if (ENCRYPTION_MIGRATION_MODE) {
        logger.warn(
          "Migration mode: returning original value on decryption failure",
        );
        return encryptedText;
      }

      // In production, throw to prevent data corruption/exposure
      throw new DecryptionError(
        "Failed to decrypt sensitive field. Data may be corrupted or encrypted with unknown key.",
        false,
      );
    }
  }

  /**
   * Re-encrypts data from one key version to the current version
   * Used during key rotation migrations
   */
  static reEncrypt(
    encryptedText: string,
    mode: "deterministic" | "randomized",
  ): string {
    if (!encryptedText) return encryptedText;

    // Check if already on current version
    if (encryptedText.startsWith(`${CURRENT_KEY_VERSION}:`)) {
      return encryptedText; // Already on current version
    }

    // Decrypt with old key, re-encrypt with new
    const plaintext = this.decrypt(encryptedText);
    return mode === "deterministic"
      ? this.encryptDeterministic(plaintext)
      : this.encryptRandomized(plaintext);
  }

  /**
   * Checks if a string is encrypted (supports both legacy and versioned formats)
   */
  static isEncrypted(text: string): boolean {
    if (!text) return false;
    const parts = text.split(":");

    // Versioned format: v1:iv(24):authTag(32):encrypted
    if (parts.length === 4 && parts[0]?.startsWith("v")) {
      return parts[1]?.length === 24 && parts[2]?.length === 32;
    }

    // Legacy format: iv(24):authTag(32):encrypted
    if (parts.length === 3) {
      return parts[0]?.length === 24 && parts[1]?.length === 32;
    }

    return false;
  }

  /**
   * Checks if encrypted text uses legacy (non-versioned) format
   */
  static isLegacyFormat(text: string): boolean {
    if (!text) return false;
    const parts = text.split(":");
    return (
      parts.length === 3 && parts[0]?.length === 24 && parts[1]?.length === 32
    );
  }

  /**
   * Gets the key version used for a piece of encrypted text
   */
  static getKeyVersion(encryptedText: string): string | null {
    if (!encryptedText) return null;
    const parts = encryptedText.split(":");

    if (parts.length === 4 && parts[0]?.startsWith("v")) {
      return parts[0];
    }

    if (parts.length === 3 && parts[0]?.length === 24) {
      return "v1"; // Legacy uses v1
    }

    return null;
  }

  /**
   * Validates encryption key configuration (call at app startup)
   */
  static validateConfiguration(): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (Object.keys(ENCRYPTION_KEYS).length === 0) {
      errors.push("No encryption keys configured");
    }

    if (!ENCRYPTION_KEYS[CURRENT_KEY_VERSION]) {
      errors.push(`Current key version ${CURRENT_KEY_VERSION} not found`);
    }

    if (new Date() > LEGACY_FORMAT_DEADLINE) {
      warnings.push("Legacy format deadline has passed - run migration script");
    }

    if (ENCRYPTION_MIGRATION_MODE) {
      warnings.push(
        "Migration mode is enabled - decryption failures will not throw",
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Returns encryption metadata for monitoring/debugging (no sensitive data)
   */
  static getMetadata(): {
    currentVersion: string;
    availableVersions: string[];
    legacyDeadline: string;
    migrationMode: boolean;
  } {
    return {
      currentVersion: CURRENT_KEY_VERSION,
      availableVersions: Object.keys(ENCRYPTION_KEYS),
      legacyDeadline: LEGACY_FORMAT_DEADLINE.toISOString(),
      migrationMode: ENCRYPTION_MIGRATION_MODE,
    };
  }
}
