import { describe, expect, it } from "vitest";
import {
  scoreVerification,
  DEFAULT_CONFIDENCE_RULES,
} from "@/app/lib/domains/regulator-verification";
import type {
  RegulatorVerificationRequest,
  RegulatorAdapterResult,
} from "@/app/lib/domains/regulator-verification";

type Record_ = NonNullable<RegulatorAdapterResult["record"]>;

const baseRequest: RegulatorVerificationRequest = {
  professionalId: "prof_1",
  licenseId: "lic_1",
  authority: "NCA",
  licenseNumber: "NCA-12345",
  submittedName: "Jane Wanjiru Doe",
  companyName: "Doe Construction Ltd",
};

const baseRecord: Record_ = {
  licenseNumber: "NCA-12345",
  holderName: "Jane Wanjiru Doe",
  companyName: "Doe Construction Ltd",
  status: "ACTIVE",
  expiresAt: "2099-01-01T00:00:00.000Z",
};

describe("scoreVerification", () => {
  it("scores a full exact match at 1.0 and does not disqualify", () => {
    const result = scoreVerification({
      request: baseRequest,
      record: baseRecord,
    });
    expect(result.confidence).toBe(1);
    expect(result.disqualified).toBe(false);
  });

  it("license number is a hard gate - no combination of other signals reaches threshold without it", () => {
    const result = scoreVerification({
      request: baseRequest,
      record: { ...baseRecord, licenseNumber: "SOMETHING-ELSE" },
    });
    // identity (0.30) + status (0.20) + not_expired (0.05) = 0.55 max
    expect(result.confidence).toBeLessThan(0.82);
  });

  it("grants partial credit for a fuzzy name match but not full credit", () => {
    const result = scoreVerification({
      request: baseRequest,
      record: { ...baseRecord, holderName: "Jane W Doe" }, // near miss
    });
    const identityEntry = result.breakdown.find(
      (b) => b.ruleId === "identity_match",
    );
    expect(identityEntry?.fraction).toBeGreaterThan(0);
    expect(identityEntry?.fraction).toBeLessThan(1);
  });

  it("distinguishes missing identity data from a genuine mismatch", () => {
    const result = scoreVerification({
      request: { ...baseRequest, submittedName: null, companyName: null },
      record: { ...baseRecord, holderName: null, companyName: null },
    });
    const identityEntry = result.breakdown.find(
      (b) => b.ruleId === "identity_match",
    );
    expect(identityEntry?.reason).toBe("identity_data_not_submitted");
  });

  it("disqualifies (AUTO_REJECTED-eligible) on an explicit invalid status regardless of other signals", () => {
    const result = scoreVerification({
      request: baseRequest,
      record: { ...baseRecord, status: "SUSPENDED" },
    });
    expect(result.disqualified).toBe(true);
    expect(result.disqualifyReason).toBe("regulator_status_suspended");
  });

  it("does NOT disqualify on an unrecognized (unmapped) status string", () => {
    const result = scoreVerification({
      request: baseRequest,
      record: { ...baseRecord, status: "SOME_UNMAPPED_STATUS" },
    });
    expect(result.disqualified).toBe(false);
    expect(result.confidence).toBeLessThan(0.82); // falls to LOW_CONFIDENCE via score, not disqualification
  });

  it("disqualifies on a passed expiry date even when status still reads ACTIVE", () => {
    const result = scoreVerification({
      request: baseRequest,
      record: {
        ...baseRecord,
        status: "ACTIVE",
        expiresAt: "2020-01-01T00:00:00.000Z",
      },
      now: new Date("2026-08-01T00:00:00.000Z"),
    });
    expect(result.disqualified).toBe(true);
    expect(result.disqualifyReason).toBe("license_expired");
  });

  it("does not penalize a record with no reported expiry date", () => {
    const result = scoreVerification({
      request: baseRequest,
      record: { ...baseRecord, expiresAt: null },
    });
    expect(result.confidence).toBe(1);
  });

  it("rejects a custom rule set whose weights don't sum to 1.0", () => {
    expect(() =>
      scoreVerification({ request: baseRequest, record: baseRecord }, [
        ...DEFAULT_CONFIDENCE_RULES,
        {
          id: "extra",
          weight: 0.1,
          evaluate: () => ({ fraction: 1, reason: "x" }),
        },
      ]),
    ).toThrow(/must sum to 1.0/);
  });
});
