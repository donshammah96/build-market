/**
 * @file roles.ts
 * @module app/lib/security/roles
 *
 * Runtime role normalization, assertion, and type guards for apps/client.
 *
 * ─── Source-of-truth chain ────────────────────────────────────────────────────
 *
 *   packages/db/prisma/schema.prisma   ← canonical role registry
 *         ↓  (imported as UserRole, AdminRole)
 *   APP_ROLES / ADMIN_ROLES            ← mirror schema; satisfies enforces parity
 *         ↓
 *   normalizeRole / requireRole        ← normalization at trust boundaries
 *
 * The `satisfies` constraint on APP_ROLES means: adding a UserRole variant to
 * the Prisma schema without updating this array is a compile-time error, not a
 * silent runtime gap. Treat that compiler error as a mandatory cross-file
 * checklist, not noise.
 *
 * ─── Choosing the right export ───────────────────────────────────────────────
 *
 * | Context                                          | Export          |
 * |--------------------------------------------------|-----------------|
 * | Untrusted input: Clerk claims, webhooks, headers | normalizeRole   |
 * | Post-withAuth adapter layer (session verified)   | requireRole     |
 * | Conditional branching on a typed role value      | isAppRole       |
 * | Admin-gated domain policy checks                 | isAdminRole     |
 *
 * ─── Normalization direction ──────────────────────────────────────────────────
 * Prisma enum members are SCREAMING_SNAKE_CASE ("CLIENT", "PROFESSIONAL", …).
 * Clerk publicMetadata may store the value in either casing depending on what
 * the app wrote at role-assignment time. normalizeRole accepts both forms and
 * always returns the canonical SCREAMING_SNAKE_CASE form to match the Prisma
 * enum. Do NOT normalize to lowercase — that was a prior convention that
 * predates the schema and will break the satisfies constraint.
 *
 * ─── ADR-007 alignment ────────────────────────────────────────────────────────
 * UserRole.SUPPORT is removed from the canonical runtime model. Legacy SUPPORT
 * claims are normalized to ADMIN so internal operators flow through
 * UserRole.ADMIN + AdminRole.SUPPORT_AGENT.
 */

import type { AdminRole, UserRole } from "@build/db";

// ─── UserRole registry ────────────────────────────────────────────────────────

/**
 * Canonical set of application roles at runtime.
 *
 * Mirrors the UserRole Prisma enum. The `satisfies` constraint enforces
 * compile-time alignment: a new schema variant that is not added here is
 * a type error.
 *
 */
export const APP_ROLES = [
  "CLIENT",
  "PROFESSIONAL",
  "ADMIN",
] as const satisfies ReadonlyArray<UserRole>;

export type AppRole = (typeof APP_ROLES)[number];

/**
 * O(1) membership set. Avoids the `as readonly string[]` cast that
 * Array.prototype.includes requires on const tuples — that cast compiles
 * but silently discards the type narrowing that follows it.
 */
const APP_ROLE_SET = new Set<string>(APP_ROLES);

// ─── AdminRole registry ───────────────────────────────────────────────────────

/**
 * Canonical set of admin sub-roles.
 *
 * AdminRole is always resolved from the database (via the User record or a
 * future AdminProfile model), never from Clerk session claims directly.
 * It does not need a normalizeAdminRole function — values arrive
 * already-typed from Prisma queries.
 *
 * Used in domain service actor contracts for elevated-access operations:
 * financial mutations, content moderation, audit reads.
 *
 */
export const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "CONTENT_MODERATOR",
  "SUPPORT_AGENT",
  "FINANCE_MANAGER",
  "AUDITOR",
] as const satisfies ReadonlyArray<AdminRole>;

export type AppAdminRole = (typeof ADMIN_ROLES)[number];

const ADMIN_ROLE_SET = new Set<string>(ADMIN_ROLES);

// ─── Type guards ──────────────────────────────────────────────────────────────

/**
 * Narrows `value` to AppRole when it is a recognized SCREAMING_SNAKE_CASE
 * role string.
 *
 * This is a strict check on the canonical form only. It does NOT accept
 * lowercase variants ("client", "professional"). For case-insensitive
 * acceptance, use normalizeRole, which converts to the canonical form first.
 *
 * @example
 * if (isAppRole(resolvedRole)) {
 *   // resolvedRole is AppRole here
 * }
 */
export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLE_SET.has(value);
}

/**
 * Narrows `value` to AppAdminRole when it is a recognized admin sub-role.
 *
 * AdminRole values are always DB-resolved and already SCREAMING_SNAKE_CASE,
 * so no normalization is applied. Use this for domain service actor checks
 * that require elevated admin capability.
 *
 * @example
 * if (!isAdminRole(actor.adminRole) || actor.adminRole !== "FINANCE_MANAGER") {
 *   return err("forbidden");
 * }
 */
export function isAdminRole(value: unknown): value is AppAdminRole {
  return typeof value === "string" && ADMIN_ROLE_SET.has(value);
}

// ─── Untrusted-boundary normalization ─────────────────────────────────────────

/**
 * Normalizes an arbitrary input to a known AppRole.
 * Returns `undefined` for unrecognized or non-string inputs.
 *
 * Use this at **untrusted boundaries** where the role value may be absent,
 * malformed, or attacker-controlled:
 *  - raw Clerk session claims (`auth.sessionClaims?.publicMetadata?.role`)
 *  - external webhook payloads
 *  - middleware before the DB user record is resolved
 *
 * Accepts both the SCREAMING_SNAKE_CASE Prisma form ("PROFESSIONAL") and the
 * lowercase Clerk convention form ("professional") that may be present in
 * sessions created before the schema was standardized. Always returns the
 * canonical SCREAMING_SNAKE_CASE form.
 *
 * Does NOT accept "super_admin" or other AdminRole values — those are
 * sub-roles on the admin record and are not valid UserRole claims.
 *
 * @example
 * // In middleware — role claim may or may not be present or valid
 * const role = normalizeRole(auth?.sessionClaims?.publicMetadata?.role);
 * if (!role) return NextResponse.redirect(new URL("/sign-in", req.url));
 */
export function normalizeRole(input: unknown): AppRole | undefined {
  if (typeof input !== "string") return undefined;
  // Normalize to SCREAMING_SNAKE_CASE to match Prisma enum members.
  // Handles legacy lowercase Clerk metadata ("professional" → "PROFESSIONAL")
  // and pass-through for already-canonical values ("PROFESSIONAL" → "PROFESSIONAL").
  const normalized = input.trim().toUpperCase();
  if (normalized === "SUPPORT") {
    return "ADMIN";
  }
  return isAppRole(normalized) ? normalized : undefined;
}

// ─── Post-auth trusted-path assertion ─────────────────────────────────────────

/**
 * Normalizes to AppRole and **throws** if the value is not recognized.
 *
 * Use this in **adapter layer code that runs after `withAuth` or
 * `secureAction` has successfully resolved a valid session**. At that point,
 * an unrecognizable role is a runtime invariant violation — misconfigured
 * Clerk metadata, schema/code drift (a new UserRole not yet added to
 * APP_ROLES), or a compromised session claim — not an expected control-flow
 * case.
 *
 * Throwing loudly surfaces the violation immediately. Route handlers must
 * catch `RoleNormalizationError` specifically and return a structured 403.
 * Letting it propagate uncaught produces a 500, which is wrong for an auth
 * boundary failure.
 *
 * Do NOT use at untrusted boundaries. Use `normalizeRole` there.
 *
 * @throws {RoleNormalizationError} when input does not map to a known AppRole
 *
 * @example
 * // Recommended pattern in withAuth route handlers:
 * let actorRole: AppRole;
 * try {
 *   actorRole = requireRole(userRole);
 * } catch (err) {
 *   if (err instanceof RoleNormalizationError) {
 *     logger.warn("role_normalization_failed", {
 *       correlationId,
 *       operationName,
 *       httpMethod: req.method,
 *       routePattern: ROUTE_PATTERN,
 *       // Do NOT log err.rawValue — untrusted; may contain PII (ADR-005, ADR-006)
 *       outcome: "forbidden",
 *       httpStatus: HttpStatus.FORBIDDEN,
 *       durationMs: Date.now() - start,
 *     });
 *   }
 *   return apiError("Forbidden", HttpStatus.FORBIDDEN);
 * }
 * // actorRole is AppRole beyond this point — no further undefined guard needed
 */
export function requireRole(input: unknown): AppRole {
  const role = normalizeRole(input);
  if (role === undefined) {
    throw new RoleNormalizationError(input);
  }
  return role;
}

// ─── Convenience predicates ───────────────────────────────────────────────────

/**
 * Returns true if the actor has elevated admin capabilities.
 *
 * Use this at the adapter layer for coarse route-level gating. Fine-grained
 * capability checks (e.g., "can this admin process refunds?") must use
 * isAdminRole on the actor.adminRole field in the domain service — not here.
 *
 * @example
 * if (!isAdminActor(actor.role)) {
 *   return apiError("Forbidden", HttpStatus.FORBIDDEN);
 * }
 */
export function isAdminActor(role: AppRole): boolean {
  return role === "ADMIN";
}

/**
 * Returns true if the actor is a marketplace participant (not internal staff).
 *
 * Useful for domain services that apply different business rules to CLIENT
 * and PROFESSIONAL actors vs internal ADMIN/SUPPORT operators.
 */
export function isMarketplaceParticipant(role: AppRole): boolean {
  return role === "CLIENT" || role === "PROFESSIONAL";
}

// ─── Error type ───────────────────────────────────────────────────────────────

/**
 * Thrown by `requireRole` when a post-auth session carries an unrecognized
 * role value.
 *
 * Route handlers should catch this type specifically to return a structured
 * 403. The `rawValue` property is available for internal diagnosis but must
 * NOT be logged — it is untrusted user-controlled input that may contain PII
 * or injection payloads (ADR-005 PII exclusion, ADR-006 Class A/B handling).
 *
 * Object.setPrototypeOf preserves instanceof checks across TypeScript targets
 * that downlevel class syntax to ES5 constructor functions.
 */
export class RoleNormalizationError extends Error {
  /**
   * Raw input that failed normalization, coerced to string.
   * For diagnostic use only. Do NOT include in structured log events.
   */
  readonly rawValue: string;

  constructor(input: unknown) {
    const raw = String(input);
    super(
      `requireRole: unrecognized role "${raw}". ` +
        `Expected one of: ${APP_ROLES.join(", ")}.`,
    );
    this.name = "RoleNormalizationError";
    this.rawValue = raw;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
