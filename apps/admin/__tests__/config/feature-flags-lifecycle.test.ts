import { describe, it, expect } from "vitest";
import {
  AdminFeatureFlag,
  FEATURE_FLAG_LIFECYCLE_METADATA,
} from "@/lib/config/feature-flags";

describe("Feature Flag Lifecycle Governance", () => {
  it("every AdminFeatureFlag must have complete lifecycle metadata", () => {
    const flags = Object.values(AdminFeatureFlag);
    expect(flags.length).toBeGreaterThan(0);

    for (const flag of flags) {
      const metadata = FEATURE_FLAG_LIFECYCLE_METADATA[flag];
      expect(
        metadata,
        `Flag ${flag} is missing lifecycle metadata entry in FEATURE_FLAG_LIFECYCLE_METADATA`,
      ).toBeDefined();

      expect(
        metadata.owner,
        `Flag ${flag} must have an owner assigned`,
      ).toBeTruthy();
      expect(
        metadata.description,
        `Flag ${flag} must have a description`,
      ).toBeTruthy();
      expect(
        metadata.maxLifetimeDays,
        `Flag ${flag} must have maxLifetimeDays > 0`,
      ).toBeGreaterThan(0);

      const createdAt = new Date(metadata.createdAt);
      expect(
        isNaN(createdAt.getTime()),
        `Flag ${flag} has invalid createdAt date string: ${metadata.createdAt}`,
      ).toBe(false);

      const targetRetirement = new Date(metadata.targetRetirementDate);
      expect(
        isNaN(targetRetirement.getTime()),
        `Flag ${flag} has invalid targetRetirementDate string: ${metadata.targetRetirementDate}`,
      ).toBe(false);
    }
  });

  it("no active feature flag may exceed its approved maximum lifetime or target retirement date", () => {
    const now = new Date();
    const flags = Object.values(AdminFeatureFlag);

    for (const flag of flags) {
      const metadata = FEATURE_FLAG_LIFECYCLE_METADATA[flag];
      if (!metadata) continue;

      const createdAt = new Date(metadata.createdAt);
      const targetRetirement = new Date(metadata.targetRetirementDate);
      const daysSinceCreation = Math.floor(
        (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
      );

      expect(
        daysSinceCreation,
        `Flag '${flag}' owned by '${metadata.owner}' has exceeded its maximum allowable lifetime of ${metadata.maxLifetimeDays} days (actual age: ${daysSinceCreation} days). Retire or renew flag in src/lib/config/feature-flags.ts per RETIREMENT.md.`,
      ).toBeLessThanOrEqual(metadata.maxLifetimeDays);

      expect(
        now.getTime(),
        `Flag '${flag}' owned by '${metadata.owner}' has passed its target retirement date of ${metadata.targetRetirementDate}. Execute flag retirement per RETIREMENT.md.`,
      ).toBeLessThanOrEqual(targetRetirement.getTime() + 86400000); // 1-day grace buffer for timezone bounds
    }
  });

  it("detects expired flags when evaluated against mock future dates", () => {
    const mockFarFuture = new Date("2027-01-01T00:00:00Z");
    const flagKey = AdminFeatureFlag.ADMIN_V2_USER_MANAGEMENT;
    const metadata = FEATURE_FLAG_LIFECYCLE_METADATA[flagKey];

    const createdAt = new Date(metadata.createdAt);
    const daysSinceCreation = Math.floor(
      (mockFarFuture.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    const isExpired =
      daysSinceCreation > metadata.maxLifetimeDays ||
      mockFarFuture.getTime() >
        new Date(metadata.targetRetirementDate).getTime();

    expect(isExpired).toBe(true);
  });
});
