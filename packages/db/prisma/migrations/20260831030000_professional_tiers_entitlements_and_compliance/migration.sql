-- CreateEnum
CREATE TYPE "SubscriptionTierKey" AS ENUM ('FREE', 'GROWTH', 'BUSINESS');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "TrustTier" AS ENUM ('UNVERIFIED', 'ID_VERIFIED', 'SKILLS_VERIFIED', 'LICENSE_VERIFIED', 'ELITE');

-- CreateEnum
CREATE TYPE "BadgeType" AS ENUM ('FOUNDING_PRO', 'FAST_RESPONDER', 'RISING_TALENT', 'TOP_RATED', 'ELITE_PRO');

-- CreateEnum
CREATE TYPE "BoostType" AS ENUM ('CATEGORY_TOP', 'COUNTY_FEATURED', 'GLOBAL_SPOTLIGHT');

-- CreateEnum
CREATE TYPE "LeadCreditTxnType" AS ENUM ('MONTHLY_GRANT', 'TOP_UP_PURCHASE', 'LEAD_UNLOCK_SPEND', 'ADMIN_ADJUSTMENT', 'PROMOTIONAL_BONUS', 'EXPIRATION');

-- CreateEnum
CREATE TYPE "MpesaTransactionPurpose" AS ENUM ('PROJECT_PAYMENT', 'ESCROW_FUNDING', 'SUBSCRIPTION_RENEWAL', 'LEAD_CREDIT_PURCHASE', 'BOOST_PURCHASE');

-- CreateEnum
CREATE TYPE "CpdActivityType" AS ENUM ('NCA_SEMINAR', 'BORAQS_WORKSHOP', 'EBK_TRAINING', 'INSTITUTIONAL_COURSE', 'HEALTH_AND_SAFETY', 'OTHER');

-- AlterTable
ALTER TABLE "ProfessionalProfile" 
  ADD COLUMN "trustTier" "TrustTier" NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN "trustTierUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "eliteRecalculatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MpesaTransaction" 
  ADD COLUMN "purpose" "MpesaTransactionPurpose" NOT NULL DEFAULT 'PROJECT_PAYMENT';

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "key" "SubscriptionTierKey" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceMonthlyKES" DECIMAL(10,2) NOT NULL,
    "priceAnnualKES" DECIMAL(10,2),
    "maxPortfolioProjects" INTEGER,
    "maxPortfolioImagesPerProject" INTEGER,
    "maxTeamMembers" INTEGER,
    "monthlyLeadCredits" INTEGER NOT NULL DEFAULT 0,
    "leadCreditDiscountPct" INTEGER NOT NULL DEFAULT 0,
    "boostsIncludedPerMonth" INTEGER NOT NULL DEFAULT 0,
    "platformFeePct" DECIMAL(5,2) NOT NULL,
    "featureFlags" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalSubscription" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "billingInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3),
    "graceEndsAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "isFoundingPro" BOOLEAN NOT NULL DEFAULT false,
    "foundingProDiscountPct" INTEGER,
    "foundingProUntil" TIMESTAMP(3),
    "lastMpesaCheckoutRequestId" TEXT,
    "lastPaymentAttemptAt" TIMESTAMP(3),
    "lastPaymentFailReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCreditWallet" (
    "professionalId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadCreditWallet_pkey" PRIMARY KEY ("professionalId")
);

-- CreateTable
CREATE TABLE "LeadCreditLedgerEntry" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "type" "LeadCreditTxnType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "relatedLeadId" TEXT,
    "relatedTransactionId" TEXT,
    "settlementKey" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadCreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalBadge" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "type" "BadgeType" NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "criteriaSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileBoost" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "type" "BoostType" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "paidTransactionId" TEXT,
    "includedInPlan" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileBoost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalCpdRecord" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "activityType" "CpdActivityType" NOT NULL,
    "providerName" TEXT NOT NULL,
    "activityTitle" TEXT NOT NULL,
    "pointsEarned" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "evidenceAssetId" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalCpdRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalNotificationSettings" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "optedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalNotificationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnterpriseApiClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hashedApiKey" TEXT NOT NULL,
    "scopes" TEXT[],
    "rateLimitRpm" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "contactEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "EnterpriseApiClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_key_key" ON "SubscriptionPlan"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalSubscription_professionalId_key" ON "ProfessionalSubscription"("professionalId");
CREATE INDEX "ProfessionalSubscription_status_currentPeriodEnd_idx" ON "ProfessionalSubscription"("status", "currentPeriodEnd");
CREATE INDEX "ProfessionalSubscription_planId_idx" ON "ProfessionalSubscription"("planId");

-- CreateIndex
CREATE INDEX "LeadCreditLedgerEntry_professionalId_createdAt_idx" ON "LeadCreditLedgerEntry"("professionalId", "createdAt");
CREATE UNIQUE INDEX "LeadCreditLedgerEntry_settlementKey_key" ON "LeadCreditLedgerEntry"("settlementKey");

-- CreateIndex
CREATE INDEX "ProfessionalBadge_professionalId_idx" ON "ProfessionalBadge"("professionalId");
CREATE UNIQUE INDEX "ProfessionalBadge_professionalId_type_key" ON "ProfessionalBadge"("professionalId", "type");

-- CreateIndex
CREATE INDEX "ProfileBoost_professionalId_startsAt_endsAt_idx" ON "ProfileBoost"("professionalId", "startsAt", "endsAt");
CREATE INDEX "ProfileBoost_endsAt_idx" ON "ProfileBoost"("endsAt");

-- CreateIndex
CREATE INDEX "ProfessionalCpdRecord_professionalId_completedAt_idx" ON "ProfessionalCpdRecord"("professionalId", "completedAt");
CREATE INDEX "ProfessionalCpdRecord_verified_idx" ON "ProfessionalCpdRecord"("verified");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalNotificationSettings_professionalId_key" ON "ProfessionalNotificationSettings"("professionalId");

-- CreateIndex
CREATE UNIQUE INDEX "EnterpriseApiClient_hashedApiKey_key" ON "EnterpriseApiClient"("hashedApiKey");
CREATE INDEX "EnterpriseApiClient_isActive_idx" ON "EnterpriseApiClient"("isActive");

-- CreateIndex
CREATE INDEX "ProfessionalProfile_trustTier_idx" ON "ProfessionalProfile"("trustTier");
CREATE INDEX "MpesaTransaction_purpose_idx" ON "MpesaTransaction"("purpose");

-- AddForeignKey
ALTER TABLE "ProfessionalSubscription" ADD CONSTRAINT "ProfessionalSubscription_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalSubscription" ADD CONSTRAINT "ProfessionalSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCreditWallet" ADD CONSTRAINT "LeadCreditWallet_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCreditLedgerEntry" ADD CONSTRAINT "LeadCreditLedgerEntry_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "LeadCreditWallet"("professionalId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalBadge" ADD CONSTRAINT "ProfessionalBadge_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileBoost" ADD CONSTRAINT "ProfileBoost_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalCpdRecord" ADD CONSTRAINT "ProfessionalCpdRecord_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalCpdRecord" ADD CONSTRAINT "ProfessionalCpdRecord_evidenceAssetId_fkey" FOREIGN KEY ("evidenceAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalNotificationSettings" ADD CONSTRAINT "ProfessionalNotificationSettings_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
