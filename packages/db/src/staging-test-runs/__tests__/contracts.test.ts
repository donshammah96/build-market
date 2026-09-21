import { describe, expect, it } from "vitest";
import {
  STAGING_SCENARIOS,
  assertStagingCleanupOrder,
  createStagingRunSeedKey,
  isStagingOwnedEntity,
  isStagingRunActive,
  isStagingRunExpired,
  validateStagingScenario,
  type StagingScenario,
  type StagingTestRunState,
} from "../contracts.js";

describe("StagingTestRun Contracts & Ownership Invariants", () => {
  describe("Scenario Validation", () => {
    it("accepts all allowlisted scenarios", () => {
      const allowed: StagingScenario[] = [
        "onboarding",
        "verification",
        "lead-routing",
        "messaging",
        "review-eligibility",
        "queue-recovery",
        "mpesa-replay",
        "capability-rollback",
      ];

      expect(STAGING_SCENARIOS).toEqual(expect.arrayContaining(allowed));
      for (const scenario of allowed) {
        expect(validateStagingScenario(scenario)).toBe(true);
      }
    });

    it("rejects unauthorized or arbitrary scenario strings", () => {
      expect(validateStagingScenario("arbitrary-scenario")).toBe(false);
      expect(validateStagingScenario("production-wipe")).toBe(false);
      expect(validateStagingScenario("")).toBe(false);
    });
  });

  describe("Seed Key Idempotency", () => {
    it("constructs deterministic compound seed keys", () => {
      const key1 = createStagingRunSeedKey("run-123", "User", "pro-user-key");
      const key2 = createStagingRunSeedKey("run-123", "User", "pro-user-key");
      const key3 = createStagingRunSeedKey("run-456", "User", "pro-user-key");

      expect(key1).toBe("run-123:User:pro-user-key");
      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });

    it("throws if runId, fixtureKind, or externalKey are missing", () => {
      expect(() => createStagingRunSeedKey("", "User", "key")).toThrow();
      expect(() => createStagingRunSeedKey("run-1", "", "key")).toThrow();
      expect(() => createStagingRunSeedKey("run-1", "User", "")).toThrow();
    });
  });

  describe("Run Expiry & Active Predicates", () => {
    const baseRun = {
      id: "run-uuid-1",
      scenario: "onboarding" as StagingScenario,
      state: "ACTIVE" as StagingTestRunState,
      gitSha: "abc1234",
      actorLabel: "cypress-ci",
      createdAt: new Date("2026-09-03T06:00:00Z"),
      expiresAt: new Date("2026-09-03T06:10:00Z"),
      cleanedAt: null,
    };

    it("identifies active runs before expiration", () => {
      const now = new Date("2026-09-03T06:05:00Z");
      expect(isStagingRunActive(baseRun, now)).toBe(true);
      expect(isStagingRunExpired(baseRun, now)).toBe(false);
    });

    it("identifies expired runs when current time exceeds expiresAt", () => {
      const now = new Date("2026-09-03T06:15:00Z");
      expect(isStagingRunActive(baseRun, now)).toBe(false);
      expect(isStagingRunExpired(baseRun, now)).toBe(true);
    });

    it("identifies non-active states as inactive", () => {
      const now = new Date("2026-09-03T06:05:00Z");
      expect(isStagingRunActive({ ...baseRun, state: "CLEANED" }, now)).toBe(
        false,
      );
      expect(isStagingRunActive({ ...baseRun, state: "CLEANING" }, now)).toBe(
        false,
      );
    });
  });

  describe("Ownership Predicate & Protection against Cross-Run/Unowned Mutation", () => {
    it("returns true only when entity explicitly matches runId", () => {
      expect(
        isStagingOwnedEntity({ stagingTestRunId: "run-abc" }, "run-abc"),
      ).toBe(true);
    });

    it("rejects unowned entities (null or undefined stagingTestRunId)", () => {
      expect(isStagingOwnedEntity({ stagingTestRunId: null }, "run-abc")).toBe(
        false,
      );
      expect(
        isStagingOwnedEntity({ stagingTestRunId: undefined }, "run-abc"),
      ).toBe(false);
      expect(isStagingOwnedEntity({}, "run-abc")).toBe(false);
    });

    it("rejects entities belonging to a different test run", () => {
      expect(
        isStagingOwnedEntity({ stagingTestRunId: "run-other" }, "run-abc"),
      ).toBe(false);
    });
  });

  describe("Dependency-Ordered Cleanup Enforcement", () => {
    it("validates that cleanup execution follows leaf-to-root order", () => {
      const validOrder = [
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
      ];

      expect(assertStagingCleanupOrder(validOrder)).toBe(true);
    });

    it("fails if cleanup order deletes parents before children", () => {
      const invalidOrder = [
        "User", // Deleting user before profile/lead would violate foreign keys or bypass cascade review
        "ProfessionalProfile",
        "StagingTestRun",
      ];

      expect(() => assertStagingCleanupOrder(invalidOrder)).toThrow(
        /dependency order violation/i,
      );
    });
  });
});
