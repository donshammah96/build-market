/**
 * Shared Idempotency Service for API mutation deduplication.
 *
 * Provides SHA-256 key generation, check-or-create semantics, and
 * completion/failure tracking via the prisma IdempotencyKey model.
 *
 * Replay persistence is scope-governed. Each idempotent route/action scope
 * must register the public replay contract it is allowed to persist. Unknown
 * scopes fail closed.
 */
import crypto from "crypto";
import { prisma } from "@build/db";
import { Prisma, IdempotencyStatus } from "@prisma/client";
import { STORE_CONFIG } from "@/app/lib/config/store.config";

const IDEMPOTENCY_REPLAY_MAX_DEPTH = 10;
const IDEMPOTENCY_REPLAY_CLASS_A_KEY_FRAGMENTS = [
  "password",
  "secret",
  "token",
  "authorization",
  "cookie",
  "session",
  "accountnumber",
  "bankaccount",
  "iban",
  "cvv",
  "otp",
  "ssn",
] as const;

const IDEMPOTENCY_REPLAY_CLASS_B_KEY_FRAGMENTS = [
  "email",
  "phone",
  "mobile",
  "address",
  "nationalid",
  "idnumber",
  "licensenumber",
  "krapin",
  "mpesa",
  "paybill",
  "tillnumber",
] as const;

const CLASS_C_AND_D_ONLY = ["Class C", "Class D"] as const;
const CLASS_B_C_AND_D = ["Class B", "Class C", "Class D"] as const;

export type IdempotencyCheckResult<T = unknown> = {
  status: "new" | "pending" | "completed";
  response?: T;
};

export type IdempotencyReplayDataClass =
  "Class A" | "Class B" | "Class C" | "Class D";

export type IdempotencyReplayScope =
  | "calendar_event"
  | "certificate"
  | "complete-profile"
  | "escrow"
  | "idea-books"
  | "lead"
  | "messaging"
  | "onboarding"
  | "portfolio"
  | "professional_document"
  | "professional_license"
  | "profile"
  | "project"
  | "project_milestone"
  | "property"
  | "property_inquiry"
  | "service"
  | "store"
  | "transaction"
  | "withdrawal";

type IdempotencyReplayPolicy = {
  description: string;
  allowedDataClasses: readonly IdempotencyReplayDataClass[];
};

// Explicit scope registry. The defaults are Class C/D only. Scopes that already
// expose minimum-necessary Class B fields in their public contract must opt in
// explicitly so replay storage stays reviewable.
export const IDEMPOTENCY_REPLAY_SCOPE_POLICIES: Record<
  IdempotencyReplayScope,
  IdempotencyReplayPolicy
> = {
  calendar_event: {
    description: "Calendar event mutation DTOs and envelopes",
    allowedDataClasses: CLASS_C_AND_D_ONLY,
  },
  certificate: {
    description: "Professional certificate DTOs and delete envelopes",
    allowedDataClasses: CLASS_C_AND_D_ONLY,
  },
  "complete-profile": {
    description: "Profile completion success envelope",
    allowedDataClasses: CLASS_C_AND_D_ONLY,
  },
  escrow: {
    description: "Escrow mutation DTOs and status envelopes",
    allowedDataClasses: CLASS_C_AND_D_ONLY,
  },
  "idea-books": {
    description: "Idea book create/delete DTOs",
    allowedDataClasses: CLASS_C_AND_D_ONLY,
  },
  lead: {
    description: "Lead DTOs with reviewed minimum-necessary contact fields",
    allowedDataClasses: CLASS_B_C_AND_D,
  },
  messaging: {
    description: "Messaging thread and message DTOs",
    allowedDataClasses: CLASS_C_AND_D_ONLY,
  },
  onboarding: {
    description: "Onboarding success and completion envelopes",
    allowedDataClasses: CLASS_C_AND_D_ONLY,
  },
  portfolio: {
    description: "Portfolio DTOs and delete envelopes",
    allowedDataClasses: CLASS_C_AND_D_ONLY,
  },
  professional_document: {
    description: "Professional document DTOs and delete envelopes",
    allowedDataClasses: CLASS_C_AND_D_ONLY,
  },
  professional_license: {
    description:
      "Professional license DTOs with reviewed minimum-necessary license identifiers",
    allowedDataClasses: CLASS_B_C_AND_D,
  },
  profile: {
    description:
      "Professional profile DTOs with reviewed minimum-necessary identity/contact fields",
    allowedDataClasses: CLASS_B_C_AND_D,
  },
  project: {
    description:
      "Project DTOs with reviewed minimum-necessary participant/contact fields",
    allowedDataClasses: CLASS_B_C_AND_D,
  },
  project_milestone: {
    description: "Project milestone DTOs and approval envelopes",
    allowedDataClasses: CLASS_C_AND_D_ONLY,
  },
  property: {
    description:
      "Property DTOs with reviewed minimum-necessary address/contact fields",
    allowedDataClasses: CLASS_B_C_AND_D,
  },
  property_inquiry: {
    description: "Inquiry DTOs with reviewed minimum-necessary contact fields",
    allowedDataClasses: CLASS_B_C_AND_D,
  },
  service: {
    description: "Service catalog mutation DTOs",
    allowedDataClasses: CLASS_C_AND_D_ONLY,
  },
  store: {
    description:
      "Store DTOs with reviewed minimum-necessary business contact fields",
    allowedDataClasses: CLASS_B_C_AND_D,
  },
  transaction: {
    description:
      "Finance transaction DTOs with reviewed minimum-necessary payment metadata",
    allowedDataClasses: CLASS_B_C_AND_D,
  },
  withdrawal: {
    description:
      "Withdrawal DTOs with reviewed minimum-necessary payment metadata",
    allowedDataClasses: CLASS_B_C_AND_D,
  },
};

const idempotencyScopeCache = new Map<string, IdempotencyReplayScope>();

function getReplayPolicy(scope: string): {
  scope: IdempotencyReplayScope;
  policy: IdempotencyReplayPolicy;
} {
  const resolvedScope = scope as IdempotencyReplayScope;
  const policy = IDEMPOTENCY_REPLAY_SCOPE_POLICIES[resolvedScope];

  if (!policy) {
    throw new Error(
      `No idempotency replay policy is registered for scope "${scope}".`,
    );
  }

  return { scope: resolvedScope, policy };
}

function classifyReplayKey(key: string): IdempotencyReplayDataClass | null {
  const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();

  if (
    IDEMPOTENCY_REPLAY_CLASS_A_KEY_FRAGMENTS.some((fragment) =>
      normalizedKey.includes(fragment),
    )
  ) {
    return "Class A";
  }

  if (
    IDEMPOTENCY_REPLAY_CLASS_B_KEY_FRAGMENTS.some((fragment) =>
      normalizedKey.includes(fragment),
    )
  ) {
    return "Class B";
  }

  return null;
}

function assertReplayKeyAllowed(
  policy: IdempotencyReplayPolicy,
  key: string,
): void {
  const classifiedDataClass = classifyReplayKey(key);

  if (
    classifiedDataClass &&
    !policy.allowedDataClasses.includes(classifiedDataClass)
  ) {
    throw new Error(
      `Replay payload field "${key}" is classified as ${classifiedDataClass} and is not allowed by the registered replay policy.`,
    );
  }
}

function serializeReplayValue(
  value: unknown,
  policy: IdempotencyReplayPolicy,
  depth: number,
): Prisma.JsonValue {
  if (depth > IDEMPOTENCY_REPLAY_MAX_DEPTH) {
    return null;
  }

  if (value === null || value === undefined) {
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
    return value.map((entry) => serializeReplayValue(entry, policy, depth + 1));
  }

  if (typeof value === "object") {
    const recordValue = value as Record<string, unknown>;
    const serialized: Prisma.JsonObject = {};

    for (const [key, nestedValue] of Object.entries(recordValue)) {
      assertReplayKeyAllowed(policy, key);
      serialized[key] = serializeReplayValue(nestedValue, policy, depth + 1);
    }

    return serialized;
  }

  return null;
}

export function serializeReplayPayloadForScope(
  scope: IdempotencyReplayScope,
  response: unknown,
): Prisma.JsonValue {
  const { policy } = getReplayPolicy(scope);
  return serializeReplayValue(response, policy, 0);
}

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
   * /param options - Optional configuration
   * /param options.entityConnect - Prisma relation connect payload (e.g. { store: { connect: { id } } })
   * /param options.ttlHours - Key TTL in hours (defaults to STORE_CONFIG value)
   */
  static async checkOrCreate<T = unknown>(
    key: string,
    scope: string,
    userId: string,
    operation: string,
    options?: {
      entityConnect?: Record<string, { connect: { id: string } }>;
      ttlHours?: number;
    },
  ): Promise<IdempotencyCheckResult<T>> {
    const ttlHours =
      options?.ttlHours ?? STORE_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS;
    const entityConnect = options?.entityConnect;
    const { scope: resolvedScope } = getReplayPolicy(scope);
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
        typeof existing.scope === "string" &&
        existing.scope !== resolvedScope
      ) {
        throw new Error(
          `Idempotency key "${key}" is already bound to scope "${existing.scope}" and cannot be reused for "${resolvedScope}".`,
        );
      }

      if (
        existing.status === IdempotencyStatus.COMPLETED &&
        existing.response
      ) {
        return { status: "completed", response: existing.response as T };
      }
      if (existing.status === IdempotencyStatus.PENDING) {
        return { status: "pending" };
      }
      await prisma.idempotencyKey.delete({ where: { key } });
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);

    await prisma.idempotencyKey.create({
      data: {
        key,
        userId,
        scope: resolvedScope,
        operation,
        ...(entityConnect ?? {}),
        status: IdempotencyStatus.PENDING,
        expiresAt,
      },
    });

    idempotencyScopeCache.set(key, resolvedScope);

    return { status: "new" };
  }

  /**
   * Mark an idempotency key as completed with its cached response.
   */
  static async complete(key: string, response: unknown): Promise<void> {
    const scope = await IdempotencyService.resolveScopeForKey(key);
    const serializedResponse = serializeReplayPayloadForScope(scope, response);
    const responseForPersistence =
      serializedResponse === null
        ? Prisma.JsonNull
        : (serializedResponse as Prisma.InputJsonValue);

    await prisma.idempotencyKey.update({
      where: { key },
      data: {
        status: IdempotencyStatus.COMPLETED,
        response: responseForPersistence,
      },
    });

    idempotencyScopeCache.delete(key);
  }

  private static async resolveScopeForKey(
    key: string,
  ): Promise<IdempotencyReplayScope> {
    const cachedScope = idempotencyScopeCache.get(key);
    if (cachedScope) {
      return cachedScope;
    }

    const existing = await prisma.idempotencyKey.findUnique({
      where: { key },
      select: { scope: true },
    });

    if (!existing) {
      throw new Error(
        `Idempotency completion failed because key "${key}" was not found.`,
      );
    }

    return getReplayPolicy(existing.scope).scope;
  }

  /**
   * Mark an idempotency key as failed, allowing future retries.
   */
  static async fail(key: string): Promise<void> {
    idempotencyScopeCache.delete(key);
    await prisma.idempotencyKey.update({
      where: { key },
      data: { status: IdempotencyStatus.FAILED },
    });
  }
}
