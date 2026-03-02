#!/usr/bin/env tsx
/**
 * GDPR Encryption Key Rotation Script
 *
 * This script re-encrypts all encrypted fields from one key version to another.
 * It is idempotent and supports checkpointing for resumable execution.
 *
 * Usage:
 *   pnpm tsx scripts/rotate-encryption-keys.ts
 *   pnpm tsx scripts/rotate-encryption-keys.ts --dry-run
 *   pnpm tsx scripts/rotate-encryption-keys.ts --target-version v2
 *   pnpm tsx scripts/rotate-encryption-keys.ts --resume
 *
 * Environment variables required:
 *   - ENCRYPTION_KEY_V1 (source key)
 *   - ENCRYPTION_KEY_V2 (target key, or whichever version you're rotating to)
 *   - CURRENT_KEY_VERSION (set to target version after running)
 *   - DATABASE_URL
 */

import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// Load environment variables from apps/client/.env
const envPath = path.resolve(process.cwd(), "apps", "client", ".env");
if (fs.existsSync(envPath)) {
  config({ path: envPath });
  console.log(`[Config] Loaded environment from ${envPath}`);
} else {
  // Fallback to current directory .env
  config();
}

// ============================================
// Type-Safe Environment Configuration
// ============================================

const encryptionConfig = {
  currentVersion: process.env.CURRENT_KEY_VERSION || "v1",
  migrationMode: process.env.ENCRYPTION_MIGRATION_MODE === "true",
  keys: {
    v1: process.env.ENCRYPTION_KEY_V1 || "",
    v2: process.env.ENCRYPTION_KEY_V2 || "",
    v3: process.env.ENCRYPTION_KEY_V3 || "",
    v4: process.env.ENCRYPTION_KEY_V4 || "",
    v5: process.env.ENCRYPTION_KEY_V5 || "",
  },
  batchSize: parseInt(process.env.ROTATION_BATCH_SIZE || "100", 10),
  databaseUrl: process.env.DATABASE_URL || "",
} as const;

const s3Config = {
  localDir: process.env.EXPORT_LOCAL_DIR || "./temp-exports",
} as const;

const ALGORITHM = "aes-256-gcm";

interface Checkpoint {
  startedAt: string;
  lastUpdatedAt: string;
  targetVersion: string;
  currentModel: string;
  currentField: string;
  lastProcessedId: string | null;
  processedCount: number;
  skippedCount: number;
  errorCount: number;
  completedModels: string[];
  errors: Array<{ model: string; field: string; id: string; error: string }>;
}

interface EncryptedFieldConfig {
  model: string;
  field: string;
  mode: "deterministic" | "randomized";
  primaryKey?: string; // Primary key field name (defaults to 'id')
}

// Encrypted fields configuration - must match prisma-extension.ts
// Note: Some models use non-standard primary keys (e.g., userId)
const ENCRYPTED_FIELDS: EncryptedFieldConfig[] = [
  { model: "User", field: "phone", mode: "deterministic", primaryKey: "id" },
  {
    model: "ClientProfile",
    field: "kraPin",
    mode: "deterministic",
    primaryKey: "userId",
  },
  {
    model: "ProfessionalProfile",
    field: "kraPin",
    mode: "deterministic",
    primaryKey: "userId",
  },
  {
    model: "Store",
    field: "mpesaTillNumber",
    mode: "randomized",
    primaryKey: "id",
  },
  {
    model: "Store",
    field: "mpesaPaybill",
    mode: "randomized",
    primaryKey: "id",
  },
  {
    model: "Store",
    field: "mpesaPasskey",
    mode: "randomized",
    primaryKey: "id",
  },
  {
    model: "ProfessionalLicense",
    field: "licenseNumber",
    mode: "deterministic",
    primaryKey: "id",
  },
  {
    model: "Property",
    field: "titleDeedNumber",
    mode: "randomized",
    primaryKey: "id",
  },
];

const BATCH_SIZE = encryptionConfig.batchSize;
const CHECKPOINT_FILE = path.resolve(
  process.cwd(),
  "exports",
  "key-rotation-checkpoint.json",
);

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const RESUME = args.includes("--resume");
const TARGET_VERSION_ARG = args
  .find((a) => a.startsWith("--target-version="))
  ?.split("=")[1];
const TARGET_VERSION =
  TARGET_VERSION_ARG || encryptionConfig.currentVersion || "v2";

// ============================================
// Encryption Key Registry
// ============================================

interface KeyRegistry {
  [version: string]: Buffer;
}

function loadEncryptionKeys(): KeyRegistry {
  const keys: KeyRegistry = {};
  const keyConfig = encryptionConfig.keys;

  // Load keys from type-safe config
  const keyEntries: [string, string][] = [
    ["v1", keyConfig.v1],
    ["v2", keyConfig.v2],
    ["v3", keyConfig.v3],
    ["v4", keyConfig.v4],
    ["v5", keyConfig.v5],
  ];

  for (const [version, keyHex] of keyEntries) {
    if (keyHex && keyHex.length > 0) {
      if (keyHex.length !== 64) {
        throw new Error(
          `ENCRYPTION_KEY_${version.toUpperCase()} must be 64 hex characters (got ${keyHex.length})`,
        );
      }
      keys[version] = Buffer.from(keyHex, "hex");
    }
  }

  // Fallback for legacy ENCRYPTION_KEY (not versioned)
  const legacyKey = process.env.ENCRYPTION_KEY;
  if (legacyKey && !keys["v1"]) {
    if (legacyKey.length !== 64) {
      throw new Error("ENCRYPTION_KEY must be 64 hex characters");
    }
    keys["v1"] = Buffer.from(legacyKey, "hex");
  }

  return keys;
}

const ENCRYPTION_KEYS = loadEncryptionKeys();

/**
 * Decrypt with specific key version
 */
function decrypt(
  encryptedText: string,
  keys: KeyRegistry,
): { plaintext: string; version: string } | null {
  if (!encryptedText || !encryptedText.includes(":")) {
    return null; // Not encrypted
  }

  const parts = encryptedText.split(":");
  let version: string;
  let ivHex: string;
  let authTagHex: string;
  let encryptedHex: string;

  if (parts.length === 4 && parts[0].startsWith("v")) {
    [version, ivHex, authTagHex, encryptedHex] = parts;
  } else if (parts.length === 3) {
    version = "v1";
    [ivHex, authTagHex, encryptedHex] = parts;
  } else {
    return null;
  }

  const key = keys[version];
  if (!key) {
    throw new Error(`Key version ${version} not found`);
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return { plaintext: decrypted, version };
}

/**
 * Encrypt with specific key version
 */
function encrypt(
  text: string,
  version: string,
  mode: "deterministic" | "randomized",
  keys: KeyRegistry,
): string {
  const key = keys[version];
  if (!key) {
    throw new Error(`Key version ${version} not found`);
  }

  let iv: Buffer;
  if (mode === "deterministic") {
    iv = crypto.createHmac("sha256", key).update(text).digest().subarray(0, 12);
  } else {
    iv = crypto.randomBytes(12);
  }

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${version}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Check if already encrypted with target version
 */
function isAlreadyTargetVersion(
  encryptedText: string,
  targetVersion: string,
): boolean {
  if (!encryptedText) return true;
  return encryptedText.startsWith(`${targetVersion}:`);
}

/**
 * Load checkpoint from file
 */
function loadCheckpoint(): Checkpoint | null {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = fs.readFileSync(CHECKPOINT_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn("[Rotation] Failed to load checkpoint:", error);
  }
  return null;
}

/**
 * Save checkpoint to file
 */
function saveCheckpoint(checkpoint: Checkpoint): void {
  const dir = path.dirname(CHECKPOINT_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  checkpoint.lastUpdatedAt = new Date().toISOString();
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

/**
 * Create initial checkpoint
 */
function createCheckpoint(): Checkpoint {
  return {
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    targetVersion: TARGET_VERSION,
    currentModel: "",
    currentField: "",
    lastProcessedId: null,
    processedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    completedModels: [],
    errors: [],
  };
}

/**
 * Clear checkpoint file after successful completion
 */
function clearCheckpoint(): void {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    const completedPath = CHECKPOINT_FILE.replace(
      ".json",
      `-completed-${Date.now()}.json`,
    );
    fs.renameSync(CHECKPOINT_FILE, completedPath);
    console.log(`[Rotation] Checkpoint archived to ${completedPath}`);
  }
}

/**
 * Main rotation logic
 */
async function rotateEncryptionKeys(): Promise<void> {
  console.log("=".repeat(60));
  console.log("GDPR Encryption Key Rotation Script");
  console.log("=".repeat(60));
  console.log(`Target Version: ${TARGET_VERSION}`);
  console.log(`Batch Size: ${BATCH_SIZE}`);
  console.log(`Dry Run: ${DRY_RUN}`);
  console.log(`Resume: ${RESUME}`);
  console.log(`Migration Mode: ${encryptionConfig.migrationMode}`);
  console.log("");

  // Validate database URL
  if (!encryptionConfig.databaseUrl) {
    throw new Error("DATABASE_URL is required. Check your .env file.");
  }

  // Validate keys
  if (!ENCRYPTION_KEYS[TARGET_VERSION]) {
    throw new Error(
      `Target key version ${TARGET_VERSION} not configured. Set ENCRYPTION_KEY_${TARGET_VERSION.toUpperCase()}`,
    );
  }

  const availableVersions = Object.keys(ENCRYPTION_KEYS);
  if (availableVersions.length === 0) {
    throw new Error(
      "No encryption keys configured. Set ENCRYPTION_KEY_V1 and ENCRYPTION_KEY_V2 in your .env file.",
    );
  }
  console.log(`Available key versions: ${availableVersions.join(", ")}`);

  // Initialize Prisma
  const prisma = new PrismaClient();

  try {
    // Load or create checkpoint
    let checkpoint: Checkpoint;
    if (RESUME) {
      const existing = loadCheckpoint();
      if (existing) {
        console.log(
          `[Rotation] Resuming from checkpoint (started: ${existing.startedAt})`,
        );
        console.log(
          `[Rotation] Progress: ${existing.processedCount} processed, ${existing.skippedCount} skipped, ${existing.errorCount} errors`,
        );
        checkpoint = existing;

        // Validate target version matches
        if (existing.targetVersion !== TARGET_VERSION) {
          throw new Error(
            `Checkpoint target version (${existing.targetVersion}) doesn't match ` +
              `current target (${TARGET_VERSION}). Clear checkpoint or use matching version.`,
          );
        }
      } else {
        console.log("[Rotation] No checkpoint found, starting fresh");
        checkpoint = createCheckpoint();
      }
    } else {
      if (loadCheckpoint()) {
        console.warn(
          "[Rotation] Existing checkpoint found. Use --resume to continue or delete the checkpoint file.",
        );
        throw new Error(
          "Checkpoint exists. Use --resume or delete checkpoint file.",
        );
      }
      checkpoint = createCheckpoint();
    }

    // Process each model/field
    for (const config of ENCRYPTED_FIELDS) {
      const modelKey = `${config.model}.${config.field}`;

      // Skip already completed models
      if (checkpoint.completedModels.includes(modelKey)) {
        console.log(`[Rotation] Skipping ${modelKey} (already completed)`);
        continue;
      }

      // If resuming, check if we're at this model
      if (
        RESUME &&
        checkpoint.currentModel &&
        checkpoint.currentModel !== config.model
      ) {
        continue;
      }
      if (
        RESUME &&
        checkpoint.currentField &&
        checkpoint.currentField !== config.field
      ) {
        continue;
      }

      checkpoint.currentModel = config.model;
      checkpoint.currentField = config.field;
      saveCheckpoint(checkpoint);

      console.log(`\n[Rotation] Processing ${modelKey} (${config.mode})`);

      await processModelField(prisma, config, checkpoint);

      checkpoint.completedModels.push(modelKey);
      checkpoint.lastProcessedId = null;
      saveCheckpoint(checkpoint);
    }

    // Complete
    console.log("\n" + "=".repeat(60));
    console.log("Rotation Complete!");
    console.log("=".repeat(60));
    console.log(`Total Processed: ${checkpoint.processedCount}`);
    console.log(`Total Skipped: ${checkpoint.skippedCount}`);
    console.log(`Total Errors: ${checkpoint.errorCount}`);

    if (checkpoint.errors.length > 0) {
      console.log("\nErrors:");
      checkpoint.errors.forEach((e) => {
        console.log(`  - ${e.model}.${e.field} [${e.id}]: ${e.error}`);
      });
    }

    if (!DRY_RUN && checkpoint.errorCount === 0) {
      clearCheckpoint();
      console.log("\n✅ All records migrated successfully!");
      console.log(`\nNext steps:`);
      console.log(`  1. Verify data integrity in the application`);
      console.log(
        `  2. Update CURRENT_KEY_VERSION to ${TARGET_VERSION} in environment`,
      );
      console.log(`  3. Restart application to use new key version`);
    } else if (DRY_RUN) {
      console.log("\n⚠️  Dry run complete. No changes were made.");
    } else {
      console.log(
        "\n⚠️  Completed with errors. Review and re-run with --resume",
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Process a single model/field combination
 */
async function processModelField(
  prisma: PrismaClient,
  config: EncryptedFieldConfig,
  checkpoint: Checkpoint,
): Promise<void> {
  const { model, field, mode, primaryKey = "id" } = config;

  // Get Prisma model delegate
  const delegate = (prisma as any)[
    model.charAt(0).toLowerCase() + model.slice(1)
  ];
  if (!delegate) {
    console.warn(
      `[Rotation] Model ${model} not found in Prisma client, skipping`,
    );
    return;
  }

  let hasMore = true;
  let cursor = checkpoint.lastProcessedId;

  while (hasMore) {
    // Build simple query - we filter in code for better compatibility
    const findArgs: any = {
      take: BATCH_SIZE,
      orderBy: { [primaryKey]: "asc" },
      select: { [primaryKey]: true, [field]: true },
    };

    if (cursor) {
      findArgs.skip = 1;
      findArgs.cursor = { [primaryKey]: cursor };
    }

    let records: any[];
    try {
      records = await delegate.findMany(findArgs);
    } catch (error: any) {
      console.error(`[Rotation] Failed to query ${model}: ${error.message}`);
      throw error;
    }

    if (records.length === 0) {
      hasMore = false;
      continue;
    }

    console.log(`[Rotation] Processing batch of ${records.length} records...`);

    for (const record of records) {
      const recordId = record[primaryKey];
      const encryptedValue = record[field];

      // Skip if already on target version
      if (isAlreadyTargetVersion(encryptedValue, TARGET_VERSION)) {
        checkpoint.skippedCount++;
        cursor = recordId;
        continue;
      }

      // Skip if not encrypted
      if (!encryptedValue || !encryptedValue.includes(":")) {
        checkpoint.skippedCount++;
        cursor = recordId;
        continue;
      }

      try {
        // Decrypt with old key
        const decrypted = decrypt(encryptedValue, ENCRYPTION_KEYS);
        if (!decrypted) {
          checkpoint.skippedCount++;
          cursor = recordId;
          continue;
        }

        // Re-encrypt with new key
        const newEncrypted = encrypt(
          decrypted.plaintext,
          TARGET_VERSION,
          mode,
          ENCRYPTION_KEYS,
        );

        if (!DRY_RUN) {
          await delegate.update({
            where: { [primaryKey]: recordId },
            data: { [field]: newEncrypted },
          });
        }

        checkpoint.processedCount++;

        if (checkpoint.processedCount % 100 === 0) {
          console.log(
            `[Rotation] Progress: ${checkpoint.processedCount} processed`,
          );
        }
      } catch (error: any) {
        console.error(
          `[Rotation] Error processing ${model}.${field} [${recordId}]:`,
          error.message,
        );
        checkpoint.errorCount++;
        checkpoint.errors.push({
          model,
          field,
          id: recordId,
          error: error.message,
        });

        // Continue with next record
      }

      cursor = recordId;
    }

    // Save checkpoint after each batch
    checkpoint.lastProcessedId = cursor;
    saveCheckpoint(checkpoint);

    // Check if we got a full batch
    hasMore = records.length === BATCH_SIZE;
  }
}

// Run the script
rotateEncryptionKeys()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n[Rotation] FATAL ERROR:", error.message);
    console.error(error.stack);
    process.exit(1);
  });
