import crypto from "crypto";

// Encryption algorithm
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;

/**
 * Derives an encryption key from the secret
 */
function deriveKey(secret: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(secret, salt, 100000, KEY_LENGTH, "sha512");
}

/**
 * Get encryption secret from environment
 */
function getEncryptionSecret(): string {
  const secret = process.env.MESSAGE_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error(
      "MESSAGE_ENCRYPTION_SECRET environment variable is required for message encryption"
    );
  }
  return secret;
}

/**
 * Encrypts a message using AES-256-GCM
 * Returns: base64-encoded string with format: salt:iv:authTag:encryptedData
 */
export function encryptMessage(plaintext: string): string {
  try {
    const secret = getEncryptionSecret();

    // Generate random salt for key derivation
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Derive key from secret and salt
    const key = deriveKey(secret, salt);

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the message
    let encrypted = cipher.update(plaintext, "utf8", "base64");
    encrypted += cipher.final("base64");

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine salt, iv, authTag, and encrypted data
    // Format: salt:iv:authTag:encryptedData
    const result = [
      salt.toString("base64"),
      iv.toString("base64"),
      authTag.toString("base64"),
      encrypted,
    ].join(":");

    return result;
  } catch (error: any) {
    console.error("Encryption error:", error);
    // Preserve the original error message if it's from getEncryptionSecret
    if (error.message && error.message.includes("MESSAGE_ENCRYPTION_SECRET")) {
      throw error;
    }
    throw new Error("Failed to encrypt message");
  }
}

/**
 * Decrypts a message encrypted with encryptMessage
 * Expects: base64-encoded string with format: salt:iv:authTag:encryptedData
 */
export function decryptMessage(encrypted: string): string {
  try {
    const secret = getEncryptionSecret();

    // Split the encrypted string
    const parts = encrypted.split(":");
    if (parts.length !== 4) {
      throw new Error("Invalid encrypted message format");
    }

    const [saltB64, ivB64, authTagB64, encryptedData] = parts;

    // Note: encryptedData can be empty string for empty plaintexts, so we only check for undefined
    if (saltB64 === undefined || ivB64 === undefined || authTagB64 === undefined || encryptedData === undefined) {
      throw new Error("Missing encrypted message components");
    }

    // Convert from base64
    const salt = Buffer.from(saltB64, "base64");
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");

    // Derive key from secret and salt
    const key = deriveKey(secret, salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt the message
    const decrypted = decipher.update(encryptedData, "base64", "utf8") +
      decipher.final("utf8");

    return decrypted;
  } catch (error: any) {
    console.error("Decryption error:", error);
    // Preserve the original error message if it's one of ours
    if (error.message === "Invalid encrypted message format" || 
        error.message === "Missing encrypted message components") {
      throw error;
    }
    throw new Error("Failed to decrypt message");
  }
}

/**
 * Encrypts file attachment metadata
 */
export function encryptAttachment(attachment: {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}): {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  encrypted: boolean;
} {
  return {
    ...attachment,
    url: encryptMessage(attachment.url),
    filename: encryptMessage(attachment.filename),
    encrypted: true,
  };
}

/**
 * Decrypts file attachment metadata
 */
export function decryptAttachment(attachment: {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  encrypted?: boolean;
}): {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  encrypted?: boolean;
} {
  if (!attachment.encrypted) {
    return { ...attachment, encrypted: false };
  }

  return {
    url: decryptMessage(attachment.url),
    filename: decryptMessage(attachment.filename),
    size: attachment.size,
    mimeType: attachment.mimeType,
    encrypted: true,
  };
}

/**
 * Hash a user ID for conversation lookup
 * This ensures conversation IDs are deterministic for the same participants
 */
export function hashParticipants(participants: string[]): string {
  const sorted = [...participants].sort();
  return crypto
    .createHash("sha256")
    .update(sorted.join(":"))
    .digest("hex");
}

