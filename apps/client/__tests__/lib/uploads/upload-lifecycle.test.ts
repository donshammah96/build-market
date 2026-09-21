import { describe, expect, it } from "vitest";
import {
  isUploadLifecycleState,
  isValidTransition,
  type UploadLifecycleState,
} from "@/app/lib/domains/uploads/upload-lifecycle";
import { OnboardingUploadStatus } from "@build/db";

describe("UploadLifecycleState Machine & Prisma Enum Parity", () => {
  it("derived ALL_STATES members match Prisma OnboardingUploadStatus enum exactly (C1 regression check)", () => {
    const prismaEnumValues = Object.values(OnboardingUploadStatus) as string[];

    // Domain state machine states that must map 1:1 to database enum values
    const testedDomainStates: UploadLifecycleState[] = [
      "STAGED",
      "ATTACHED",
      "EXPIRED",
      "DELETED",
      "QUARANTINED",
      "SCAN_PENDING",
      "SCAN_FAILED",
    ];

    for (const state of testedDomainStates) {
      expect(isUploadLifecycleState(state)).toBe(true);
      expect(prismaEnumValues).toContain(state);
    }

    // Verify invalid/removed states like SCAN_COMPLETED return false
    expect(isUploadLifecycleState("SCAN_COMPLETED")).toBe(false);
    expect(isUploadLifecycleState("UNKNOWN_STATE")).toBe(false);
  });

  it("enforces allowed state transitions correctly", () => {
    // Valid transitions
    expect(isValidTransition("STAGED", "ATTACHED")).toBe(true);
    expect(isValidTransition("STAGED", "SCAN_PENDING")).toBe(true);
    expect(isValidTransition("SCAN_PENDING", "STAGED")).toBe(true);
    expect(isValidTransition("SCAN_PENDING", "QUARANTINED")).toBe(true);
    expect(isValidTransition("SCAN_PENDING", "SCAN_FAILED")).toBe(true);
    expect(isValidTransition("SCAN_FAILED", "SCAN_PENDING")).toBe(true);
    expect(isValidTransition("SCAN_FAILED", "QUARANTINED")).toBe(true);
    expect(isValidTransition("EXPIRED", "DELETED")).toBe(true);
    expect(isValidTransition("QUARANTINED", "DELETED")).toBe(true);

    // Invalid transitions
    expect(isValidTransition("ATTACHED", "STAGED")).toBe(false); // Terminal
    expect(isValidTransition("DELETED", "STAGED")).toBe(false); // Terminal
    expect(isValidTransition("STAGED", "DELETED")).toBe(false); // Must go through EXPIRED or QUARANTINED
    expect(isValidTransition("SCAN_FAILED", "ATTACHED")).toBe(false); // Cannot attach un-scanned/failed upload
  });
});
