import {
  prisma,
  TrustTier,
  BadgeType,
  LicenseAuthority,
  VerificationStatus,
  type ProfessionalProfile,
  type ProfessionalBadge,
  type ProfessionalLicense,
  type ProfessionalCpdRecord,
  type Portfolio,
  type User,
} from "@build/db";
import { StructuredLogger, CorrelationIdManager } from "@build/resilience";

const logger = new StructuredLogger("badge-recompute-processor");

type ProfileWithRelations = ProfessionalProfile & {
  licenses: ProfessionalLicense[];
  cpdRecords: ProfessionalCpdRecord[];
  badges: ProfessionalBadge[];
  portfolios: Portfolio[];
  user: User;
};

export interface BadgeRecomputeResult {
  evaluatedCount: number;
  badgesAwarded: number;
  badgesRevoked: number;
  trustTierDemotions: number;
}

export async function processBadgeRecomputeJob(job: {
  id?: string;
  data: { professionalId?: string };
}): Promise<BadgeRecomputeResult> {
  const correlationId = CorrelationIdManager.generate();
  const startTime = Date.now();

  logger.info(
    "[BadgeRecompute] Starting badge & trust-tier recomputation sweep",
    {
      correlationId,
      jobId: job.id,
      targetProfessionalId: job.data.professionalId,
    },
  );

  const where = job.data.professionalId
    ? { userId: job.data.professionalId }
    : { user: { status: "ACTIVE" as const } };

  const profiles = (await prisma.professionalProfile.findMany({
    where,
    include: {
      licenses: true,
      cpdRecords: true,
      badges: true,
      portfolios: true,
      user: true,
    },
  })) as ProfileWithRelations[];

  let badgesAwarded = 0;
  let badgesRevoked = 0;
  let trustTierDemotions = 0;

  for (const profile of profiles) {
    const now = new Date();
    const activeBadgesMap = new Map<BadgeType, ProfessionalBadge>();
    for (const b of profile.badges) {
      if (!b.revokedAt) {
        activeBadgesMap.set(b.type, b);
      }
    }

    // --- TRUST-TIER DEMOTION CHECKS ---
    let shouldDemoteTrustTier = false;
    let targetTrustTier: TrustTier = profile.trustTier;

    // Check License Expiry for LICENSE_VERIFIED & ELITE
    if (
      profile.trustTier === TrustTier.LICENSE_VERIFIED ||
      profile.trustTier === TrustTier.ELITE
    ) {
      const activeRegulatedLicense = profile.licenses.find(
        (lic: ProfessionalLicense) =>
          lic.status === VerificationStatus.VERIFIED,
      );

      const hasExpiredLicense = profile.licenses.some(
        (lic: ProfessionalLicense) =>
          lic.validUntil !== null && new Date(lic.validUntil) < now,
      );

      // Check CPD points threshold if NCA license is within 60 days of renewal or expired
      const ncaLicense = profile.licenses.find(
        (lic: ProfessionalLicense) => lic.authority === LicenseAuthority.NCA,
      );

      let cpdCompliant = true;
      if (ncaLicense && ncaLicense.validUntil) {
        const daysUntilRenewal =
          (new Date(ncaLicense.validUntil).getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24);

        if (daysUntilRenewal <= 60) {
          const currentYearStart = new Date(
            Date.UTC(now.getUTCFullYear(), 0, 1),
          );
          const annualCpdPoints = profile.cpdRecords
            .filter(
              (record: ProfessionalCpdRecord) =>
                new Date(record.completedAt) >= currentYearStart,
            )
            .reduce(
              (sum: number, record: ProfessionalCpdRecord) =>
                sum + record.pointsEarned,
              0,
            );

          if (annualCpdPoints < 10) {
            cpdCompliant = false;
          }
        }
      }

      if (!activeRegulatedLicense || hasExpiredLicense || !cpdCompliant) {
        shouldDemoteTrustTier = true;
        // Gracefully demote down
        if (profile.trustTier === TrustTier.ELITE) {
          targetTrustTier = TrustTier.LICENSE_VERIFIED;
        } else if (profile.trustTier === TrustTier.LICENSE_VERIFIED) {
          // If they have portfolio/reviews, downgrade to SKILLS_VERIFIED, else ID_VERIFIED
          targetTrustTier =
            profile.portfolios.length >= 3 || profile.reviewCount >= 2
              ? TrustTier.SKILLS_VERIFIED
              : TrustTier.ID_VERIFIED;
        }
      }
    }

    if (shouldDemoteTrustTier && targetTrustTier !== profile.trustTier) {
      await prisma.professionalProfile.update({
        where: { userId: profile.userId },
        data: {
          trustTier: targetTrustTier,
          trustTierUpdatedAt: now,
        },
      });
      trustTierDemotions++;
      logger.warn(
        "[BadgeRecompute] Professional trust tier demoted due to lapse",
        {
          correlationId,
          professionalId: profile.userId,
          previousTier: profile.trustTier,
          newTier: targetTrustTier,
        },
      );
    }

    // --- BADGE EVALUATIONS ---
    // 1. FAST_RESPONDER: Response time < 60 mins & response rate >= 90%
    const isFastResponder =
      profile.responseTime > 0 &&
      profile.responseTime <= 60 &&
      profile.responseRate >= 90;
    const fastResponderBadge = activeBadgesMap.get(BadgeType.FAST_RESPONDER);

    if (isFastResponder && !fastResponderBadge) {
      await awardBadge(profile.userId, BadgeType.FAST_RESPONDER);
      badgesAwarded++;
    } else if (!isFastResponder && fastResponderBadge) {
      await revokeBadge(fastResponderBadge.id);
      badgesRevoked++;
    }

    // 2. RISING_TALENT: Joined < 90 days, >= 3 projects, rating >= 4.8
    const accountAgeDays =
      (now.getTime() - new Date(profile.user.createdAt).getTime()) /
      (1000 * 60 * 60 * 24);
    const isRisingTalent =
      accountAgeDays <= 90 &&
      profile.completedProjects >= 3 &&
      Number(profile.rating) >= 4.8;
    const risingTalentBadge = activeBadgesMap.get(BadgeType.RISING_TALENT);

    if (isRisingTalent && !risingTalentBadge) {
      await awardBadge(profile.userId, BadgeType.RISING_TALENT);
      badgesAwarded++;
    } else if (!isRisingTalent && risingTalentBadge) {
      await revokeBadge(risingTalentBadge.id);
      badgesRevoked++;
    }

    // 3. TOP_RATED: >= 10 reviews, rating >= 4.85, 0 unresolved disputes
    const unresolvedDisputes = await prisma.project.count({
      where: {
        professionalId: profile.userId,
        isDisputed: true,
        disputeResolvedAt: null,
      },
    });

    const isTopRated =
      profile.reviewCount >= 10 &&
      Number(profile.rating) >= 4.85 &&
      unresolvedDisputes === 0;
    const topRatedBadge = activeBadgesMap.get(BadgeType.TOP_RATED);

    if (isTopRated && !topRatedBadge) {
      await awardBadge(profile.userId, BadgeType.TOP_RATED);
      badgesAwarded++;
    } else if (!isTopRated && topRatedBadge) {
      await revokeBadge(topRatedBadge.id);
      badgesRevoked++;
    }

    // 4. ELITE_PRO: TrustTier == ELITE, rating >= 4.7, >= 10 completed projects, insured
    const isElitePro =
      profile.trustTier === TrustTier.ELITE &&
      Number(profile.rating) >= 4.7 &&
      profile.completedProjects >= 10 &&
      profile.isInsured;
    const eliteBadge = activeBadgesMap.get(BadgeType.ELITE_PRO);

    if (isElitePro && !eliteBadge) {
      await awardBadge(profile.userId, BadgeType.ELITE_PRO);
      badgesAwarded++;
    } else if (!isElitePro && eliteBadge) {
      await revokeBadge(eliteBadge.id);
      badgesRevoked++;
    }
  }

  logger.info("[BadgeRecompute] Finished badge & trust recomputation sweep", {
    correlationId,
    durationMs: Date.now() - startTime,
    evaluatedCount: profiles.length,
    badgesAwarded,
    badgesRevoked,
    trustTierDemotions,
  });

  return {
    evaluatedCount: profiles.length,
    badgesAwarded,
    badgesRevoked,
    trustTierDemotions,
  };
}

async function awardBadge(professionalId: string, badgeType: BadgeType) {
  return prisma.professionalBadge.upsert({
    where: {
      professionalId_type: {
        professionalId,
        type: badgeType,
      },
    },
    create: {
      professionalId,
      type: badgeType,
      awardedAt: new Date(),
    },
    update: {
      revokedAt: null,
      awardedAt: new Date(),
    },
  });
}

async function revokeBadge(badgeId: string) {
  return prisma.professionalBadge.update({
    where: { id: badgeId },
    data: { revokedAt: new Date() },
  });
}
