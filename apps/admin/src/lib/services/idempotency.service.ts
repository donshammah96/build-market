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
import { STORE_CONFIG } from "@/lib/config/store.config";

export type IdempotencyCheckResult = {
  status: "new" | "pending" | "completed";
  response?: unknown;
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
  static async checkOrCreate(
    key: string,
    scope: string,
    userId: string,
    operation: string,
    entityId?: string,
    ttlHours: number = STORE_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
  ): Promise<IdempotencyCheckResult | null> {
    const existing = await prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (existing) {
      if (
        existing.status === IdempotencyStatus.COMPLETED &&
        existing.response
      ) {
        return { status: "completed", response: existing.response };
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
    await prisma.idempotencyKey.update({
      where: { key },
      data: {
        status: IdempotencyStatus.COMPLETED,
        response: response as Prisma.InputJsonValue,
      },
    });
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
