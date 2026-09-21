import { describe, expect, it } from "vitest";
import { OnboardingSchema } from "@build/types";

describe("Onboarding API contract", () => {
  it("accepts professional license-pending submissions without a fake license number", () => {
    const parsed = OnboardingSchema.safeParse({
      role: "professional",
      profession: "ARCHITECT",
      companyName: "Contract Architects Ltd",
      county: "NAIROBI",
      licensePending: true,
      licensePendingReason: "License renewal is pending with the regulator.",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toMatchObject({
        role: "professional",
        licensePending: true,
        licensePendingReason: "License renewal is pending with the regulator.",
      });
      expect(
        "license" in parsed.data ? parsed.data.license : undefined,
      ).toBeUndefined();
    }
  });

  it("requires a meaningful license-pending reason when one is provided", () => {
    const parsed = OnboardingSchema.safeParse({
      role: "professional",
      profession: "ARCHITECT",
      companyName: "Contract Architects Ltd",
      county: "NAIROBI",
      licensePending: true,
      licensePendingReason: "soon",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.map((issue) => issue.path.join(".")),
      ).toContain("licensePendingReason");
    }
  });
});
