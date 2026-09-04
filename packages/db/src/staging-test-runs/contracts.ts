/**
 * Staging Test Run Contracts & Invariants
 * ============================================================================
 * Defines the durable ownership contract for all test-seeded entities in staging.
 * Enforces explicit run binding, active-window validation, and dependency-ordered cleanup.
 */

export const STAGING_SCENARIOS = [
  "onboarding",
  "verification",
  "lead-routing",
  "messaging",
  "review-eligibility",
  "queue-recovery",
  "mpesa-replay",
  "capability-rollback",
] as const;

export type StagingScenario = (typeof STAGING_SCENARIOS)[number];

export const STAGING_TEST_RUN_STATES = [
  "ACTIVE",
  "CLEANING",
  "CLEANED",
  "EXPIRED",
] as const;

export type StagingTestRunState = (typeof STAGING_TEST_RUN_STATES)[number];

/**
 * Validates whether a provided scenario identifier belongs to the approved staging allowlist.
 */
export function validateStagingScenario(
  scenario: string,
): scenario is StagingScenario {
  return (STAGING_SCENARIOS as readonly string[]).includes(scenario);
}

/**
 * Generates an idempotent compound seed key for staging fixtures.
 * Format: `<runId>:<fixtureKind>:<externalKey>`
 */
export function createStagingRunSeedKey(
  runId: string,
  fixtureKind: string,
  externalKey: string,
): string {
  if (!runId || !runId.trim()) {
    throw new Error("createStagingRunSeedKey: runId must not be empty");
  }
  if (!fixtureKind || !fixtureKind.trim()) {
    throw new Error("createStagingRunSeedKey: fixtureKind must not be empty");
  }
  if (!externalKey || !externalKey.trim()) {
    throw new Error("createStagingRunSeedKey: externalKey must not be empty");
  }
  return `${runId.trim()}:${fixtureKind.trim()}:${externalKey.trim()}`;
}

export interface StagingTestRunSnapshot {
  id: string;
  scenario: string;
  state: StagingTestRunState;
  gitSha?: string;
  actorLabel?: string;
  createdAt: Date;
  expiresAt: Date;
  cleanedAt?: Date | null;
}

/**
 * Checks if a staging test run is in the ACTIVE state and has not passed its expiration window.
 */
export function isStagingRunActive(
  run: { state: StagingTestRunState; expiresAt: Date },
  now = new Date(),
): boolean {
  if (run.state !== "ACTIVE") {
    return false;
  }
  return now.getTime() < new Date(run.expiresAt).getTime();
}

/**
 * Checks if a staging test run has expired based on current time or state.
 */
export function isStagingRunExpired(
  run: { state: StagingTestRunState; expiresAt: Date },
  now = new Date(),
): boolean {
  return now.getTime() >= new Date(run.expiresAt).getTime();
}

/**
 * Ownership predicate: Verifies whether an entity is explicitly owned by the specified staging test run.
 * Unowned entities (stagingTestRunId === null | undefined) or cross-run entities evaluate to false.
 */
export function isStagingOwnedEntity(
  entity: { stagingTestRunId?: string | null },
  runId: string,
): boolean {
  if (!entity || !entity.stagingTestRunId || !runId) {
    return false;
  }
  return entity.stagingTestRunId === runId;
}

/**
 * Canonical leaf-to-root cleanup dependency order.
 * Deleting parents before children causes FK constraint failures or violates auditability.
 */
export const STAGING_CLEANUP_DEPENDENCY_ORDER: readonly string[] = [
  "StagingTestIdentityLease",
  "MessageThread",
  "MarketplaceLead",
  "staging_test_outbound_deliveries",
  "MpesaCallbackEvent",
  "MpesaTransaction",
  "Review",
  "Lead",
  "Project",
  "ProfessionalProfile",
  "User",
  "StagingTestRun",
] as const;

/**
 * Validates that an executed cleanup sequence strictly respects the leaf-to-root dependency order.
 */
export function assertStagingCleanupOrder(entities: string[]): boolean {
  let lastObservedIndex = -1;

  for (const entity of entities) {
    const canonicalIndex = STAGING_CLEANUP_DEPENDENCY_ORDER.indexOf(entity);
    if (canonicalIndex === -1) {
      throw new Error(
        `Dependency order violation: entity "${entity}" is not in the recognized cleanup inventory`,
      );
    }
    if (canonicalIndex < lastObservedIndex) {
      throw new Error(
        `Dependency order violation: "${entity}" (rank ${canonicalIndex}) cannot be cleaned up after rank ${lastObservedIndex}`,
      );
    }
    lastObservedIndex = canonicalIndex;
  }

  return true;
}

export * from "./identity-contracts.js";
