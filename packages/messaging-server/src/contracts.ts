/**
 * Shared messaging contracts for @build/messaging-server.
 *
 * SCOPE RULE: This file must contain only pure TypeScript types and
 * interfaces. No imports from apps/*, no Zod schemas, no Prisma types,
 * no Next.js dependencies.
 *
 * The Zod validation schemas, Prisma select objects, and MESSAGING_CONFIG
 * live in apps/client/app/lib/validation/messaging-validation.ts and
 * apps/client/app/lib/domains/messaging/contracts.ts. Those are app-owned
 * and are not re-exported from this package.
 *
 * Consumers in apps/admin that need messaging types import from here.
 * apps/client imports from here for the shared actor/error types, and from
 * its own local validation module for schemas.
 */

// ---------------------------------------------------------------------------
// Actor context
// ---------------------------------------------------------------------------

/**
 * Actor shape for messaging domain operations.
 * clerkId is optional — absent for internal service-to-service calls
 * that have no Clerk session.
 */
export type MessagingActor = {
  clerkId?: string;
  userId: string;
  role: string | null;
};

// ---------------------------------------------------------------------------
// Domain error codes
// ---------------------------------------------------------------------------

export type MessagingDomainErrorCode =
  "forbidden" | "not_found" | "invalid_input" | "conflict" | "internal";

// ---------------------------------------------------------------------------
// Result wrapper
// ---------------------------------------------------------------------------

/**
 * Canonical Result type for messaging domain outcomes.
 *
 * Inlined here rather than imported from apps/client so this package has
 * zero app dependencies. Must stay structurally identical to the canonical
 * Result<T, E> in apps/client/app/lib/errors/result.ts.
 *
 * If the canonical Result shape ever changes, update this in the same commit.
 */
/**
 * Canonical Result type for messaging domain outcomes.
 *
 * This must match the canonical Result<T, E> shape in
 * apps/client/app/lib/errors/result.ts exactly.
 *
 * ok: true  => { ok: true; data: T }
 * ok: false => { ok: false; error?: string; message?: string; status?: number; details?: unknown }
 */
export type MessagingResult<T> =
  | { ok: true; data: T }
  | ({ ok: false } & {
      error?: string;
      message?: string;
      status?: number;
      details?: unknown;
    });

// ---------------------------------------------------------------------------
// Shared DTO types (add as needed when apps/admin consumes them)
// ---------------------------------------------------------------------------

export type MessagingParticipantRole = "owner" | "member" | "observer";

export type MessageStatus = "sent" | "delivered" | "read";

export type ThreadStatus = "active" | "archived" | "deleted";
