import { describe, it, expect, vi } from "vitest";
import { CpdActivityType, LicenseAuthority, prisma } from "@build/db";
import { clientCpdService } from "../../../app/lib/domains/professionals/cpd";

vi.mock("@build/db", () => ({
  CpdActivityType: {
    NCA_SEMINAR: "NCA_SEMINAR",
    BORAQS_WORKSHOP: "BORAQS_WORKSHOP",
  },
  LicenseAuthority: {
    NCA: "NCA",
  },
  prisma: {
    professionalCpdRecord: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    professionalLicense: {
      findMany: vi.fn(),
    },
  },
}));

describe("Professional CPD Compliance Service", () => {
  it("records a valid CPD activity with earned points", async () => {
    (prisma.professionalCpdRecord.create as any).mockResolvedValue({
      id: "cpd-1",
      pointsEarned: 3,
    });

    const result = await clientCpdService.logCpdActivity({
      professionalId: "pro-123",
      activityType: CpdActivityType.NCA_SEMINAR,
      providerName: "National Construction Authority",
      activityTitle: "Site Safety & Structural Standards",
      pointsEarned: 3,
      completedAt: new Date("2026-03-15"),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.pointsEarned).toBe(3);
    }
  });

  it("calculates annual compliance status against target 10 points for NCA contractor", async () => {
    (prisma.professionalLicense.findMany as any).mockResolvedValue([
      { authority: LicenseAuthority.NCA },
    ]);

    (prisma.professionalCpdRecord.findMany as any).mockResolvedValue([
      {
        id: "cpd-1",
        activityType: CpdActivityType.NCA_SEMINAR,
        providerName: "NCA",
        activityTitle: "Workshop A",
        pointsEarned: 6,
        completedAt: new Date("2026-02-10"),
        verified: true,
        evidenceAssetId: null,
      },
      {
        id: "cpd-2",
        activityType: CpdActivityType.BORAQS_WORKSHOP,
        providerName: "BORAQS",
        activityTitle: "Workshop B",
        pointsEarned: 4,
        completedAt: new Date("2026-05-12"),
        verified: true,
        evidenceAssetId: null,
      },
    ]);

    const result = await clientCpdService.getComplianceSummary("pro-123", 2026);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totalPointsEarned).toBe(10);
      expect(result.data.targetPoints).toBe(10);
      expect(result.data.isCompliant).toBe(true);
      expect(result.data.pointsRemaining).toBe(0);
    }
  });

  it("identifies non-compliant status when CPD points are below 10", async () => {
    (prisma.professionalLicense.findMany as any).mockResolvedValue([
      { authority: LicenseAuthority.NCA },
    ]);

    (prisma.professionalCpdRecord.findMany as any).mockResolvedValue([
      {
        id: "cpd-1",
        activityType: CpdActivityType.NCA_SEMINAR,
        providerName: "NCA",
        activityTitle: "Workshop A",
        pointsEarned: 4,
        completedAt: new Date("2026-02-10"),
        verified: true,
        evidenceAssetId: null,
      },
    ]);

    const result = await clientCpdService.getComplianceSummary("pro-123", 2026);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totalPointsEarned).toBe(4);
      expect(result.data.isCompliant).toBe(false);
      expect(result.data.pointsRemaining).toBe(6);
    }
  });
});
