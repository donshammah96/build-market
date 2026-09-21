/**
 * Upload Lifecycle State Machine
 *
 * Defines the canonical lifecycle states for onboarding uploads and
 * provides type guards and transition helpers.
 *
 * State flow:
 *   STAGED → ATTACHED → (terminal)
 *   STAGED → EXPIRED → DELETED (cleanup)
 *   STAGED → QUARANTINED (scan failed)
 *   STAGED → SCAN_PENDING → SCAN_FAILED → QUARANTINED
 *
 * FIX (C1): the previous version of this file included a `SCAN_COMPLETED`
 * state that was never added to the Prisma `OnboardingUploadStatus` enum.
 * It was, nonetheless, actually written by `processAsyncScanResult` in
 * service.ts, which meant that code path was a guaranteed runtime crash
 * (Prisma rejects an unrecognized enum value) the moment it ran. Removed
 * entirely — nothing in the live, correctly-guarded scan paths
 * (`stageOnboardingUpload`, `rescanStagedUpload`) needs an intermediate
 * "scan finished, not yet promoted" state; both go straight from
 * SCAN_PENDING to a final status in one step. If a real need for such an
 * intermediate state ever arises, it must be added to BOTH this file AND
 * a Prisma migration in the same change — never one without the other.
 */

// ============================================================================
// LIFECYCLE STATES
// ============================================================================

/**
 * The canonical upload lifecycle states. Must always match
 * `OnboardingUploadStatus` in schema.prisma exactly — every member here
 * must be a real database enum value, and vice versa. If these two ever
 * need to diverge (e.g., the DB has a state the domain layer folds into a
 * coarser state, like CONSUMED → ATTACHED), that folding must happen
 * explicitly in `mapDbStatusToLifecycleState`, not by inventing a state
 * here that the database doesn't have.
 *
 * - STAGED: Upload received, stored temporarily, not yet associated with
 *   a domain entity. Expires after TTL. Also the state a clean scan
 *   resolves to.
 * - ATTACHED: Upload has been materialized and linked to a domain entity
 *   (e.g., ProfessionalDocument.assetId). No longer eligible for cleanup.
 *   Terminal.
 * - EXPIRED: Staged upload exceeded its TTL without being attached.
 *   Eligible for storage deletion.
 * - DELETED: Storage has been reclaimed. Terminal.
 * - QUARANTINED: Upload failed a virus/malware scan, or a scan could not
 *   be completed safely. Isolated from the main storage. Requires manual
 *   review before deletion.
 * - SCAN_PENDING: Upload is queued for virus/malware scanning.
 * - SCAN_FAILED: Scan process encountered an error (not necessarily
 *   malware — could be a scanner outage). Retryable via rescan.
 */
export type UploadLifecycleState =
  | "STAGED"
  | "ATTACHED"
  | "EXPIRED"
  | "DELETED"
  | "QUARANTINED"
  | "SCAN_PENDING"
  | "SCAN_FAILED";

// ============================================================================
// VALID TRANSITIONS
// ============================================================================

/**
 * Map of valid state transitions. Each key is a source state, and the
 * value is the set of states it can transition to.
 */
const VALID_TRANSITIONS: Record<
  UploadLifecycleState,
  ReadonlySet<UploadLifecycleState>
> = {
  STAGED: new Set(["ATTACHED", "EXPIRED", "QUARANTINED", "SCAN_PENDING"]),
  SCAN_PENDING: new Set(["STAGED", "SCAN_FAILED", "QUARANTINED"]),
  SCAN_FAILED: new Set(["SCAN_PENDING", "QUARANTINED", "EXPIRED"]),
  ATTACHED: new Set([]), // Terminal
  EXPIRED: new Set(["DELETED"]),
  DELETED: new Set([]), // Terminal
  QUARANTINED: new Set(["DELETED"]), // Can only be deleted after review
};

// ============================================================================
// TYPE GUARDS
// ============================================================================

// FIX (C1): kept in a single spot, derived FROM the transition map's keys,
// so this can never again silently drift out of sync with
// UploadLifecycleState the way the old hardcoded set did (it was missing
// SCAN_COMPLETED even while the type included it).
const ALL_STATES: ReadonlySet<string> = new Set(Object.keys(VALID_TRANSITIONS));

/** Check if a string is a valid UploadLifecycleState */
export function isUploadLifecycleState(
  value: string,
): value is UploadLifecycleState {
  return ALL_STATES.has(value);
}

/** Check if a transition from one state to another is valid */
export function isValidTransition(
  from: UploadLifecycleState,
  to: UploadLifecycleState,
): boolean {
  return VALID_TRANSITIONS[from]?.has(to) ?? false;
}

/** Check if an upload is in a terminal state (no further transitions) */
export function isTerminalState(state: UploadLifecycleState): boolean {
  return state === "ATTACHED" || state === "DELETED";
}

/** Check if an upload is eligible for cleanup (storage reclamation) */
export function isCleanupEligible(state: UploadLifecycleState): boolean {
  return state === "EXPIRED" || state === "QUARANTINED";
}

/** Check if an upload is still active (not terminal, not cleanup-eligible) */
export function isActiveUpload(state: UploadLifecycleState): boolean {
  return (
    state === "STAGED" || state === "SCAN_PENDING" || state === "SCAN_FAILED"
  );
}

// ============================================================================
// CLEANUP HELPERS
// ============================================================================

/** Default TTL for staged uploads (1 hour) */
export const STAGED_UPLOAD_TTL_MS = 60 * 60 * 1000;

/**
 * Build a Prisma-compatible where clause for finding expired staged uploads.
 * Intended for use in cleanup jobs/cron tasks.
 */
export function buildExpiredStagedUploadFilter(now = new Date()): {
  status: { in: string[] };
  createdAt: { lt: Date };
} {
  return {
    status: { in: ["STAGED", "SCAN_FAILED"] },
    createdAt: {
      lt: new Date(now.getTime() - STAGED_UPLOAD_TTL_MS),
    },
  };
}

/**
 * Map Prisma OnboardingUploadStatus enum or raw database string to
 * UploadLifecycleState.
 *
 * NOTE (H2, flagged not fixed here): `CONSUMED` is a real Prisma enum
 * value folded into `ATTACHED` here, but nothing in the current codebase
 * actually writes `CONSUMED` — `markStagedUploadConsumed` writes
 * `ATTACHED` directly. This mapping is currently unreachable dead code as
 * a result. Left in place rather than removed, since removing it doesn't
 * fix the underlying naming/dead-enum-value question — see
 * AUDIT_4_full_subsystem.md finding H2 for the actual decision needed
 * (clean up the enum, or document the planned distinction).
 */
export function mapDbStatusToLifecycleState(
  dbStatus: string,
): UploadLifecycleState {
  if (dbStatus === "CONSUMED") {
    return "ATTACHED";
  }
  if (isUploadLifecycleState(dbStatus)) {
    return dbStatus;
  }
  return "STAGED";
}
