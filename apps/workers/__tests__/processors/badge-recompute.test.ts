import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  TrustTier,
  BadgeType,
  LicenseAuthority,
  VerificationStatus,
  prisma,
} from "@build/db";
import { processBadgeRecomputeJob } from "../../src/processors/badge-recompute.processor";

vi.mock("@build/db", () => ({
  TrustTier: {
    UNVERIFIED: "UNVERIFIED",
    ID_VERIFIED: "ID_VERIFIED",
    SKILLS_VERIFIED: "SKILLS_VERIFIED",
    LICENSE_VERIFIED: "LICENSE_VERIFIED",
    ELITE: "ELITE",
  },
  BadgeType: {
    FOUNDING_PRO: "FOUNDING_PRO",
    FAST_RESPONDER: "FAST_RESPONDER",
    RISING_TALENT: "RISING_TALENT",
    TOP_RATED: "TOP_RATED",
    ELITE_PRO: "ELITE_PRO",
  },
  LicenseAuthority: {
    NCA: "NCA",
    BORAQS: "BORAQS",
  },
  VerificationStatus: {
    PENDING: "PENDING",
    AUTO_VERIFIED: "AUTO_VERIFIED",
    MANUALLY_VERIFIED: "MANUALLY_VERIFIED",
    REJECTED: "REJECTED",
  },
  prisma: {
    professionalProfile: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    professionalBadge: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
    project: {
      count: vi.fn(),
    },
  },
}));

describe("Badge Recompute & Trust-Tier Demotion Processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("awards ELITE_PRO and retains ELITE trust tier when all quality and license criteria are met", async () => {
    const validFutureDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

    vi.mocked(prisma.professionalProfile.findMany).mockResolvedValue([
      {
        userId: "pro-elite-1",
        trustTier: TrustTier.ELITE,
        rating: 4.9,
        reviewCount: 20,
        completedProjects: 15,
        responseRate: 95,
        responseTime: 45,
        isInsured: true,
        licenses: [
          {
            status: VerificationStatus.VERIFIED,
            authority: LicenseAuthority.NCA,
            validUntil: validFutureDate,
          },
        ],
        cpdRecords: [{ pointsEarned: 12, completedAt: new Date() }],
        badges: [],
        portfolios: [{ id: "p1" }, { id: "p2" }, { id: "p3" }],
        user: {
          id: "u1",
          createdAt: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000),
          status: "ACTIVE",
        },
      },
    ] as never);

    vi.mocked(prisma.project.count).mockResolvedValue(0);

    const result = await processBadgeRecomputeJob({
      id: "job-1",
      data: {},
    });

    expect(result.evaluatedCount).toBe(1);
    expect(result.badgesAwarded).toBeGreaterThanOrEqual(1);
    expect(result.trustTierDemotions).toBe(0);
    expect(prisma.professionalProfile.update).not.toHaveBeenCalled();
  });

  it("demotes LICENSE_VERIFIED professional to SKILLS_VERIFIED when their license has expired", async () => {
    const expiredPastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    vi.mocked(prisma.professionalProfile.findMany).mockResolvedValue([
      {
        userId: "pro-lapsed-1",
        trustTier: TrustTier.LICENSE_VERIFIED,
        rating: 4.5,
        reviewCount: 5,
        completedProjects: 4,
        responseRate: 80,
        responseTime: 180,
        isInsured: false,
        licenses: [
          {
            status: VerificationStatus.VERIFIED,
            authority: LicenseAuthority.NCA,
            validUntil: expiredPastDate,
          },
        ],
        cpdRecords: [],
        badges: [],
        portfolios: [{ id: "p1" }, { id: "p2" }, { id: "p3" }],
        user: {
          id: "u2",
          createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
          status: "ACTIVE",
        },
      },
    ] as never);

    vi.mocked(prisma.project.count).mockResolvedValue(0);

    const result = await processBadgeRecomputeJob({
      id: "job-2",
      data: {},
    });

    expect(result.evaluatedCount).toBe(1);
    expect(result.trustTierDemotions).toBe(1);
    expect(prisma.professionalProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "pro-lapsed-1" },
        data: expect.objectContaining({
          trustTier: TrustTier.SKILLS_VERIFIED,
        }),
      }),
    );
  });

  it("revokes existing ELITE_PRO badge when performance rating drops below 4.7", async () => {
    const validFutureDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);

    vi.mocked(prisma.professionalProfile.findMany).mockResolvedValue([
      {
        userId: "pro-dropped-rating",
        trustTier: TrustTier.LICENSE_VERIFIED,
        rating: 4.2, // Below 4.7
        reviewCount: 20,
        completedProjects: 15,
        responseRate: 95,
        responseTime: 45,
        isInsured: true,
        licenses: [
          {
            status: VerificationStatus.VERIFIED,
            authority: LicenseAuthority.NCA,
            validUntil: validFutureDate,
          },
        ],
        cpdRecords: [{ pointsEarned: 10, completedAt: new Date() }],
        badges: [
          {
            id: "badge-elite-1",
            type: BadgeType.ELITE_PRO,
            revokedAt: null,
          },
        ],
        portfolios: [{ id: "p1" }, { id: "p2" }, { id: "p3" }],
        user: {
          id: "u3",
          createdAt: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000),
          status: "ACTIVE",
        },
      },
    ] as never);

    vi.mocked(prisma.project.count).mockResolvedValue(0);

    const result = await processBadgeRecomputeJob({
      id: "job-3",
      data: {},
    });

    expect(result.badgesRevoked).toBeGreaterThanOrEqual(1);
    expect(prisma.professionalBadge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "badge-elite-1" },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
        }),
      }),
    );
  });
});
