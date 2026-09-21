import {
  PrismaClient,
  SubscriptionTierKey,
  SubscriptionStatus,
  BillingInterval,
  TrustTier,
} from "@prisma/client";

const prisma = new PrismaClient();

export async function backfillProfessionalTiers() {
  console.log("--- Starting Professional Tiers & Subscriptions Backfill ---");

  // 1. Seed Subscription Plans
  const plans = [
    {
      key: SubscriptionTierKey.FREE,
      name: "Msingi (Free)",
      description: "Essential toolkit for starting out on Build Market",
      priceMonthlyKES: 0,
      priceAnnualKES: 0,
      maxPortfolioProjects: 3,
      maxPortfolioImagesPerProject: 5,
      maxTeamMembers: 1,
      monthlyLeadCredits: 0,
      leadCreditDiscountPct: 0,
      boostsIncludedPerMonth: 0,
      platformFeePct: 10.0,
      sortOrder: 1,
      featureFlags: {
        canReceiveMarketplaceLeads: false,
        crmPipelineLevel: "BASIC",
        analyticsDepthDays: 7,
        priorityVerificationSla: false,
        whatsappLeadAlerts: false,
      },
    },
    {
      key: SubscriptionTierKey.GROWTH,
      name: "Kuza (Growth)",
      description: "For growing trade professionals and active contractors",
      priceMonthlyKES: 1500,
      priceAnnualKES: 15000,
      maxPortfolioProjects: 15,
      maxPortfolioImagesPerProject: 15,
      maxTeamMembers: 3,
      monthlyLeadCredits: 3,
      leadCreditDiscountPct: 20,
      boostsIncludedPerMonth: 1,
      platformFeePct: 7.5,
      sortOrder: 2,
      featureFlags: {
        canReceiveMarketplaceLeads: true,
        crmPipelineLevel: "FULL",
        analyticsDepthDays: 90,
        priorityVerificationSla: true,
        whatsappLeadAlerts: true,
      },
    },
    {
      key: SubscriptionTierKey.BUSINESS,
      name: "Bora (Business)",
      description:
        "Complete management, maximum reach and priority lead distribution",
      priceMonthlyKES: 6000,
      priceAnnualKES: 60000,
      maxPortfolioProjects: null, // Unlimited
      maxPortfolioImagesPerProject: null, // Unlimited
      maxTeamMembers: null, // Unlimited
      monthlyLeadCredits: 15,
      leadCreditDiscountPct: 35,
      boostsIncludedPerMonth: 2,
      platformFeePct: 5.0,
      sortOrder: 3,
      featureFlags: {
        canReceiveMarketplaceLeads: true,
        crmPipelineLevel: "TEAM",
        analyticsDepthDays: 365,
        priorityVerificationSla: true,
        whatsappLeadAlerts: true,
      },
    },
  ];

  const planMap: Record<SubscriptionTierKey, string> = {} as any;

  for (const planData of plans) {
    const plan = await prisma.subscriptionPlan.upsert({
      where: { key: planData.key },
      create: planData,
      update: {
        name: planData.name,
        description: planData.description,
        priceMonthlyKES: planData.priceMonthlyKES,
        priceAnnualKES: planData.priceAnnualKES,
        maxPortfolioProjects: planData.maxPortfolioProjects,
        maxPortfolioImagesPerProject: planData.maxPortfolioImagesPerProject,
        maxTeamMembers: planData.maxTeamMembers,
        monthlyLeadCredits: planData.monthlyLeadCredits,
        leadCreditDiscountPct: planData.leadCreditDiscountPct,
        boostsIncludedPerMonth: planData.boostsIncludedPerMonth,
        platformFeePct: planData.platformFeePct,
        sortOrder: planData.sortOrder,
        featureFlags: planData.featureFlags,
      },
    });
    planMap[plan.key] = plan.id;
    console.log(`Plan synchronized: ${plan.name} (${plan.id})`);
  }

  const freePlanId = planMap[SubscriptionTierKey.FREE];

  // 2. Fetch all professionals
  const professionals = await prisma.professionalProfile.findMany({
    select: {
      userId: true,
      verified: true,
      verificationStatus: true,
      subscription: { select: { id: true } },
      leadWallet: { select: { professionalId: true } },
    },
  });

  console.log(
    `Found ${professionals.length} professional profiles to evaluate.`,
  );

  let subCreated = 0;
  let walletCreated = 0;
  let tierUpdated = 0;

  for (const pro of professionals) {
    // 2a. Backfill LeadCreditWallet
    if (!pro.leadWallet) {
      await prisma.leadCreditWallet.create({
        data: {
          professionalId: pro.userId,
          balance: 0,
        },
      });
      walletCreated++;
    }

    // 2b. Backfill ProfessionalSubscription (FREE)
    if (!pro.subscription) {
      await prisma.professionalSubscription.create({
        data: {
          professionalId: pro.userId,
          planId: freePlanId,
          status: SubscriptionStatus.ACTIVE,
          billingInterval: BillingInterval.MONTHLY,
          currentPeriodStart: new Date(),
          currentPeriodEnd: null, // Free never lapses
        },
      });
      subCreated++;
    }

    // 2c. Compute TrustTier
    let trustTier: TrustTier = TrustTier.UNVERIFIED;

    if (pro.verified) {
      // Check for verified license case
      const verifiedCase = await prisma.regulatorVerificationCase.findFirst({
        where: {
          professionalId: pro.userId,
          status: { in: ["AUTO_VERIFIED", "MANUALLY_VERIFIED"] as any },
        },
      });

      if (verifiedCase) {
        trustTier = TrustTier.LICENSE_VERIFIED;
      } else {
        trustTier = TrustTier.SKILLS_VERIFIED;
      }
    }

    await prisma.professionalProfile.update({
      where: { userId: pro.userId },
      data: {
        trustTier,
        trustTierUpdatedAt: new Date(),
      },
    });
    tierUpdated++;
  }

  console.log(`--- Backfill complete ---`);
  console.log(`Subscriptions created: ${subCreated}`);
  console.log(`Wallets created: ${walletCreated}`);
  console.log(`Trust tiers updated: ${tierUpdated}`);
}

if (require.main === module) {
  backfillProfessionalTiers()
    .catch((err) => {
      console.error("Backfill failed:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
