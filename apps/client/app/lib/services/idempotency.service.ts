/**
 * Shared Idempotency Service for API mutation deduplication.
 *
 * Provides SHA-256 key generation, check-or-create semantics, and
 * completion/failure tracking via the prisma IdempotencyKey model.
 *
 * Used by store routes (POST, PATCH, DELETE) and property routes
 * for mutation deduplication. Supports multiple scopes.
 */
import crypto from "crypto";
import { prisma } from "@build/db";
import { Prisma, IdempotencyStatus } from "@prisma/client";
import { STORE_CONFIG } from "@/app/lib/config/store.config";

const IDEMPOTENCY_REPLAY_REDACTED_VALUE = "[REDACTED]";
const IDEMPOTENCY_REPLAY_MAX_DEPTH = 10;
const IDEMPOTENCY_REPLAY_SENSITIVE_KEY_FRAGMENTS = [
  "email",
  "phone",
  "nationalid",
  "idnumber",
  "password",
  "secret",
  "token",
  "authorization",
  "cookie",
  "session",
  "clerkid",
  "accountnumber",
  "iban",
  "cvv",
  "otp",
  "pin",
  "mpesa",
];

export type IdempotencyCheckResult<T = unknown> = {
  status: "new" | "pending" | "completed";
  response?: T;
};

export class IdempotencyService {
  /**
   * Generate a deterministic idempotency key from user, operation, and payload.
   * Uses SHA-256 for collision resistance.
   */
  static generateKey(
    userId: string,
    operation: string,
    payload: unknown,
  ): string {
    const hash = crypto.createHash("sha256");
    hash.update(`${userId}:${operation}:${JSON.stringify(payload)}`);
    return hash.digest("hex");
  }

  /**
   * Check if a key already exists and return its status.
   * If new, creates a PENDING record. If failed, deletes and recreates.
   *
   * /param key - The idempotency key
   * /param scope - Logical scope (e.g. "store")
   * /param userId - The user performing the operation
   * /param operation - HTTP method or operation name
   * /param entityId - Optional entity ID to link (e.g. storeId)
   * /param ttlHours - Key TTL in hours (defaults to STORE_CONFIG value)
   */
  static async checkOrCreate<T = unknown>(
    key: string,
    scope: string,
    userId: string,
    operation: string,
    entityId?: string,
    ttlHours: number = STORE_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
  ): Promise<IdempotencyCheckResult<T> | null> {
    let existing = await prisma.idempotencyKey.findUnique({
      where: { key },
    });

    const existingExpiresAtEpochMs =
      existing?.expiresAt instanceof Date
        ? existing.expiresAt.getTime()
        : Number.POSITIVE_INFINITY;

    if (existing && existingExpiresAtEpochMs <= Date.now()) {
      await prisma.idempotencyKey.delete({ where: { key } });
      existing = null;
    }

    if (existing) {
      if (
        existing.status === IdempotencyStatus.COMPLETED &&
        existing.response
      ) {
        return { status: "completed", response: existing.response as T };
      }
      if (existing.status === IdempotencyStatus.PENDING) {
        return { status: "pending" };
      }
      // Failed — allow retry by deleting and recreating
      await prisma.idempotencyKey.delete({ where: { key } });
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);

    await prisma.idempotencyKey.create({
      data: {
        key,
        userId,
        scope,
        operation,
        ...(entityId &&
          scope === "store" && { store: { connect: { id: entityId } } }),
        ...(entityId &&
          scope === "property" && { property: { connect: { id: entityId } } }),
        status: IdempotencyStatus.PENDING,
        expiresAt,
      },
    });

    return { status: "new" };
  }

  /**
   * Mark an idempotency key as completed with its cached response.
   */
  static async complete(key: string, response: unknown): Promise<void> {
    const sanitizedResponse =
      IdempotencyService.sanitizeReplayResponse(response);
    const responseForPersistence =
      sanitizedResponse === null
        ? Prisma.JsonNull
        : (sanitizedResponse as Prisma.InputJsonValue);

    await prisma.idempotencyKey.update({
      where: { key },
      data: {
        status: IdempotencyStatus.COMPLETED,
        response: responseForPersistence,
      },
    });
  }

  private static sanitizeReplayResponse(response: unknown): Prisma.JsonValue {
    return IdempotencyService.sanitizeReplayValue(response, 0);
  }

  private static sanitizeReplayValue(
    value: unknown,
    depth: number,
  ): Prisma.JsonValue {
    if (depth > IDEMPOTENCY_REPLAY_MAX_DEPTH) {
      return null;
    }

    if (value === null) {
      return null;
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    }

    if (typeof value === "bigint") {
      return value.toString();
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.map((entry) =>
        IdempotencyService.sanitizeReplayValue(entry, depth + 1),
      );
    }

    if (typeof value === "object") {
      const recordValue = value as Record<string, unknown>;
      const sanitized: Prisma.JsonObject = {};

      for (const [key, nestedValue] of Object.entries(recordValue)) {
        if (IdempotencyService.isSensitiveReplayKey(key)) {
          sanitized[key] = IDEMPOTENCY_REPLAY_REDACTED_VALUE;
          continue;
        }

        sanitized[key] = IdempotencyService.sanitizeReplayValue(
          nestedValue,
          depth + 1,
        );
      }

      return sanitized;
    }

    return null;
  }

  private static isSensitiveReplayKey(key: string): boolean {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    return IDEMPOTENCY_REPLAY_SENSITIVE_KEY_FRAGMENTS.some((fragment) =>
      normalizedKey.includes(fragment),
    );
  }

  /**
   * Mark an idempotency key as failed, allowing future retries.
   */
  static async fail(key: string): Promise<void> {
    await prisma.idempotencyKey.update({
      where: { key },
      data: { status: IdempotencyStatus.FAILED },
    });
  }
}
