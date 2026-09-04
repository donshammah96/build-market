import { describe, expect, it } from "vitest";
import {
  canLeaseIdentity,
  canResetIdentity,
  releaseIdentityLease,
  parseStagingIdentitySlots,
  findAvailableSlotForRole,
  isAllowedScenarioForIdentityLease,
  type StagingIdentityLease,
} from "../identity-contracts.js";

const now = new Date("2026-09-03T10:00:00.000Z");
const activeExpiresAt = new Date("2026-09-03T10:05:00.000Z");
const pastExpiresAt = new Date("2026-09-03T09:55:00.000Z");

const activeLease: StagingIdentityLease = {
  id: "lease_1",
  stagingTestRunId: "run_1",
  slot: "pro-1",
  role: "PROFESSIONAL",
  userId: "user_pro_1",
  clerkId: "clerk_pro_1",
  state: "LEASED",
  leaseExpiresAt: activeExpiresAt,
};

describe("staging identity lease contracts", () => {
  describe("active-lease exclusivity", () => {
    it("allows leasing when slot has no existing lease", () => {
      expect(canLeaseIdentity(undefined, now)).toBe(true);
    });

    it("blocks leasing for active states: LEASED, RESETTING, READY", () => {
      expect(canLeaseIdentity(activeLease, now)).toBe(false);
      expect(
        canLeaseIdentity({ ...activeLease, state: "RESETTING" }, now),
      ).toBe(false);
      expect(canLeaseIdentity({ ...activeLease, state: "READY" }, now)).toBe(
        false,
      );
    });

    it("permits leasing when prior lease is RELEASED or FAILED", () => {
      expect(canLeaseIdentity({ ...activeLease, state: "RELEASED" }, now)).toBe(
        true,
      );
      expect(canLeaseIdentity({ ...activeLease, state: "FAILED" }, now)).toBe(
        true,
      );
    });

    it("permits leasing when prior lease has expired even if in an active state", () => {
      expect(
        canLeaseIdentity(
          { ...activeLease, leaseExpiresAt: pastExpiresAt },
          now,
        ),
      ).toBe(true);
    });
  });

  describe("scenario and role validation", () => {
    it("allows only onboarding and verification scenarios for identity lease and reset", () => {
      expect(isAllowedScenarioForIdentityLease("onboarding")).toBe(true);
      expect(isAllowedScenarioForIdentityLease("verification")).toBe(true);
      expect(isAllowedScenarioForIdentityLease("messaging")).toBe(false);
      expect(isAllowedScenarioForIdentityLease("lead-routing")).toBe(false);
      expect(isAllowedScenarioForIdentityLease("mpesa-replay")).toBe(false);
    });

    it("allows reset only for a live lease belonging to the caller run and allowed scenario", () => {
      expect(canResetIdentity(activeLease, "run_1", "onboarding", now)).toBe(
        true,
      );
      expect(canResetIdentity(activeLease, "run_1", "verification", now)).toBe(
        true,
      );
      expect(canResetIdentity(activeLease, "run_1", "messaging", now)).toBe(
        false,
      );
      expect(
        canResetIdentity(activeLease, "other-run", "onboarding", now),
      ).toBe(false);
    });
  });

  describe("stale lease rejection", () => {
    it("rejects reset for an expired lease", () => {
      expect(
        canResetIdentity(
          { ...activeLease, leaseExpiresAt: pastExpiresAt },
          "run_1",
          "onboarding",
          now,
        ),
      ).toBe(false);
    });

    it("rejects reset for RELEASED or FAILED leases", () => {
      expect(
        canResetIdentity(
          { ...activeLease, state: "RELEASED" },
          "run_1",
          "onboarding",
          now,
        ),
      ).toBe(false);
      expect(
        canResetIdentity(
          { ...activeLease, state: "FAILED" },
          "run_1",
          "onboarding",
          now,
        ),
      ).toBe(false);
    });
  });

  describe("release idempotency", () => {
    it("transitions active lease to RELEASED with releasedAt timestamp", () => {
      const released = releaseIdentityLease(activeLease, now);
      expect(released.state).toBe("RELEASED");
      expect(released.releasedAt).toEqual(now);
    });

    it("is idempotent when lease is already RELEASED", () => {
      const alreadyReleased: StagingIdentityLease = {
        ...activeLease,
        state: "RELEASED",
        releasedAt: new Date("2026-09-03T09:50:00.000Z"),
      };
      const result = releaseIdentityLease(alreadyReleased, now);
      expect(result.state).toBe("RELEASED");
      expect(result.releasedAt).toEqual(new Date("2026-09-03T09:50:00.000Z"));
    });

    it("does not revive a FAILED lease back to active", () => {
      const failedLease: StagingIdentityLease = {
        ...activeLease,
        state: "FAILED",
      };
      const result = releaseIdentityLease(failedLease, now);
      expect(result.state).toBe("RELEASED");
    });
  });

  describe("server-owned slot allowlist configuration", () => {
    const validConfigJson = JSON.stringify([
      {
        slot: "client-1",
        role: "CLIENT",
        email: "e2e_client_1@staging.buildmarket.app",
      },
      {
        slot: "client-2",
        role: "CLIENT",
        email: "e2e_client_2@staging.buildmarket.app",
      },
      {
        slot: "pro-1",
        role: "PROFESSIONAL",
        email: "e2e_pro_1@staging.buildmarket.app",
      },
      {
        slot: "pro-2",
        role: "PROFESSIONAL",
        email: "e2e_pro_2@staging.buildmarket.app",
      },
    ]);

    it("parses valid slot configuration in staging/test environment", () => {
      const slots = parseStagingIdentitySlots(validConfigJson, {
        isProduction: false,
      });
      expect(slots).toHaveLength(4);
      expect(slots[0]).toEqual({
        slot: "client-1",
        role: "CLIENT",
        email: "e2e_client_1@staging.buildmarket.app",
      });
    });

    it("rejects slot configuration in production environment", () => {
      expect(() =>
        parseStagingIdentitySlots(validConfigJson, { isProduction: true }),
      ).toThrow(/production/i);
    });

    it("rejects invalid JSON or non-array slot payload", () => {
      expect(() =>
        parseStagingIdentitySlots("invalid-json", { isProduction: false }),
      ).toThrow();
      expect(() =>
        parseStagingIdentitySlots("{}", { isProduction: false }),
      ).toThrow();
    });

    it("rejects duplicate slots or duplicate emails", () => {
      const duplicateSlots = JSON.stringify([
        {
          slot: "pro-1",
          role: "PROFESSIONAL",
          email: "e2e_pro_1@staging.buildmarket.app",
        },
        {
          slot: "pro-1",
          role: "PROFESSIONAL",
          email: "e2e_pro_2@staging.buildmarket.app",
        },
      ]);
      expect(() =>
        parseStagingIdentitySlots(duplicateSlots, { isProduction: false }),
      ).toThrow(/duplicate slot/i);

      const duplicateEmails = JSON.stringify([
        {
          slot: "pro-1",
          role: "PROFESSIONAL",
          email: "e2e_pro_1@staging.buildmarket.app",
        },
        {
          slot: "pro-2",
          role: "PROFESSIONAL",
          email: "e2e_pro_1@staging.buildmarket.app",
        },
      ]);
      expect(() =>
        parseStagingIdentitySlots(duplicateEmails, { isProduction: false }),
      ).toThrow(/duplicate email/i);
    });

    it("rejects invalid emails or invalid roles", () => {
      const invalidEmail = JSON.stringify([
        { slot: "pro-1", role: "PROFESSIONAL", email: "not-an-email" },
      ]);
      expect(() =>
        parseStagingIdentitySlots(invalidEmail, { isProduction: false }),
      ).toThrow();

      const invalidRole = JSON.stringify([
        {
          slot: "pro-1",
          role: "ADMIN",
          email: "e2e_admin_1@staging.buildmarket.app",
        },
      ]);
      expect(() =>
        parseStagingIdentitySlots(invalidRole, { isProduction: false }),
      ).toThrow();
    });

    it("finds first available slot for role not in active slots set", () => {
      const slots = parseStagingIdentitySlots(validConfigJson, {
        isProduction: false,
      });
      const activeSlots = new Set(["pro-1"]);
      const chosen = findAvailableSlotForRole(
        slots,
        "PROFESSIONAL",
        activeSlots,
      );
      expect(chosen?.slot).toBe("pro-2");

      const noClientActive = findAvailableSlotForRole(
        slots,
        "CLIENT",
        new Set(),
      );
      expect(noClientActive?.slot).toBe("client-1");

      const allProActive = findAvailableSlotForRole(
        slots,
        "PROFESSIONAL",
        new Set(["pro-1", "pro-2"]),
      );
      expect(allProActive).toBeNull();
    });
  });
});
