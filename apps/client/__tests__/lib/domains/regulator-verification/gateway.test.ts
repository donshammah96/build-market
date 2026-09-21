import { describe, expect, it } from "vitest";
import { LicenseAuthority } from "@prisma/client";
import {
  RegulatorVerificationGateway,
  buildRegulatorVerificationJobId,
  type RegulatorAdapter,
} from "@/app/lib/domains/regulator-verification";

const now = () => new Date("2026-08-01T00:00:00.000Z");

function adapter(
  record: Awaited<ReturnType<RegulatorAdapter["verify"]>>,
): RegulatorAdapter {
  return {
    authority: LicenseAuthority.NCA,
    verify: async () => record,
  };
}

describe("RegulatorVerificationGateway", () => {
  it("auto-verifies high-confidence active regulator records", async () => {
    const gateway = new RegulatorVerificationGateway({
      now,
      adapters: {
        [LicenseAuthority.NCA]: adapter({
          supported: true,
          available: true,
          record: {
            licenseNumber: "NCA-123",
            holderName: "Amina Builder",
            status: "ACTIVE",
          },
        }),
      },
    });

    const result = await gateway.verify({
      professionalId: "pro_1",
      licenseId: "lic_1",
      authority: LicenseAuthority.NCA,
      licenseNumber: "NCA-123",
      submittedName: "Amina Builder",
      correlationId: "corr_1",
    });

    expect(result.status).toBe("AUTO_VERIFIED");
    expect(result.confidence).toBe(1);
    expect(result.confidenceReasons).toEqual([
      "license_number_exact_match",
      "holder_name_exact_match",
      "regulator_status_active",
      "no_expiry_reported",
    ]);
    expect(result.evidence.capturedAt).toBe("2026-08-01T00:00:00.000Z");
    expect(result.manualFallbackReason).toBeUndefined();
  });

  it("routes unsupported authorities to manual review", async () => {
    const gateway = new RegulatorVerificationGateway({ now, adapters: {} });

    const result = await gateway.verify({
      professionalId: "pro_1",
      authority: LicenseAuthority.EBK,
      licenseNumber: "EBK-1",
    });

    expect(result.status).toBe("NEEDS_MANUAL_REVIEW");
    expect(result.retryable).toBe(false);
    expect(result.manualFallbackReason).toBe("unsupported_authority");
    expect(result.evidence.source).toBe("unsupported_authority");
  });

  it("routes regulator outages to retryable manual fallback", async () => {
    const gateway = new RegulatorVerificationGateway({
      now,
      adapters: {
        [LicenseAuthority.NCA]: adapter({
          supported: true,
          available: false,
          retryable: true,
          retryAfterSeconds: 300,
        }),
      },
    });

    const result = await gateway.verify({
      professionalId: "pro_1",
      authority: LicenseAuthority.NCA,
      licenseNumber: "NCA-123",
    });

    expect(result.status).toBe("REGULATOR_UNAVAILABLE");
    expect(result.retryable).toBe(true);
    expect(result.retryAfterSeconds).toBe(300);
    expect(result.manualFallbackReason).toBe("regulator_unavailable");
  });

  it("routes low-confidence matches to manual fallback", async () => {
    const gateway = new RegulatorVerificationGateway({
      now,
      adapters: {
        [LicenseAuthority.NCA]: adapter({
          supported: true,
          available: true,
          record: {
            licenseNumber: "NCA-123",
            holderName: "Different Name",
            status: "ACTIVE",
          },
        }),
      },
    });

    const result = await gateway.verify({
      professionalId: "pro_1",
      authority: LicenseAuthority.NCA,
      licenseNumber: "NCA-123",
      submittedName: "Amina Builder",
    });

    expect(result.status).toBe("LOW_CONFIDENCE");
    expect(result.confidence).toBe(0.7);
    expect(result.manualFallbackReason).toBe("manual_review_required");
  });

  it("builds replay-safe dedupe job ids", () => {
    expect(
      buildRegulatorVerificationJobId({
        professionalId: "pro_1",
        authority: LicenseAuthority.NCA,
        licenseNumber: "nca 123/2026",
      }),
    ).toBe("NCA:NCA-123-2026:PRO_1");
  });
});
