-- CreateEnum
CREATE TYPE "MarketplaceLandOwnershipStatus" AS ENUM ('OWNED_TITLED', 'OWNED_ALLOTMENT_LETTER', 'FAMILY_LAND', 'LEASED', 'PURCHASING_IN_PROGRESS', 'NONE');

-- CreateEnum
CREATE TYPE "MarketplaceArchitecturalStage" AS ENUM ('NO_PLANS', 'CONCEPT_ONLY', 'APPROVED_DRAWINGS', 'COUNTY_APPROVED', 'UNDER_CONSTRUCTION');

-- CreateEnum
CREATE TYPE "MarketplaceBudgetReadiness" AS ENUM ('UNVERIFIED_ESTIMATE', 'SELF_DECLARED_WITH_RANGE', 'PROOF_OF_FUNDS', 'FINANCING_APPROVED', 'FINANCING_PENDING');

-- CreateEnum
CREATE TYPE "MarketplaceLeadStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFO', 'QUALIFIED', 'DISQUALIFIED', 'ROUTED', 'CLOSED_WON', 'CLOSED_LOST');

-- CreateEnum
CREATE TYPE "MarketplaceLeadDocumentType" AS ENUM ('TITLE_DEED', 'ALLOTMENT_LETTER', 'PROOF_OF_FUNDS', 'APPROVED_DRAWINGS', 'COUNTY_APPROVAL');

-- CreateTable
CREATE TABLE "MarketplaceLead" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "MarketplaceLeadStatus" NOT NULL DEFAULT 'DRAFT',
    "projectCounty" TEXT NOT NULL,
    "projectType" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceLeadQualification" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "landOwnershipStatus" "MarketplaceLandOwnershipStatus",
    "architecturalStage" "MarketplaceArchitecturalStage",
    "budgetReadiness" "MarketplaceBudgetReadiness",
    "budgetRangeMin" INTEGER,
    "budgetRangeMax" INTEGER,
    "confidenceScore" DOUBLE PRECISION,
    "confidenceLabel" TEXT,
    "scoringRuleVersion" TEXT,
    "breakdownJson" JSONB,
    "scoredAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceLeadQualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceLeadDocument" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" "MarketplaceLeadDocumentType" NOT NULL,
    "fileKey" TEXT NOT NULL,
    "scanStatus" TEXT NOT NULL DEFAULT 'pending',
    "scannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceLeadDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceLeadRoutingEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "confidenceLabel" TEXT NOT NULL,
    "routedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" TEXT,
    "outcomeAt" TIMESTAMP(3),
    "contactDisclosedAt" TIMESTAMP(3),

    CONSTRAINT "MarketplaceLeadRoutingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceLeadQualification_leadId_key" ON "MarketplaceLeadQualification"("leadId");

-- CreateIndex
CREATE INDEX "MarketplaceLead_clientId_idx" ON "MarketplaceLead"("clientId");

-- CreateIndex
CREATE INDEX "MarketplaceLead_status_projectCounty_idx" ON "MarketplaceLead"("status", "projectCounty");

-- CreateIndex
CREATE INDEX "MarketplaceLead_createdAt_idx" ON "MarketplaceLead"("createdAt");

-- CreateIndex
CREATE INDEX "MarketplaceLeadDocument_leadId_idx" ON "MarketplaceLeadDocument"("leadId");

-- CreateIndex
CREATE INDEX "MarketplaceLeadDocument_scanStatus_idx" ON "MarketplaceLeadDocument"("scanStatus");

-- CreateIndex
CREATE INDEX "MarketplaceLeadRoutingEvent_professionalId_routedAt_idx" ON "MarketplaceLeadRoutingEvent"("professionalId", "routedAt");

-- CreateIndex
CREATE INDEX "MarketplaceLeadRoutingEvent_leadId_idx" ON "MarketplaceLeadRoutingEvent"("leadId");

-- AddForeignKey
ALTER TABLE "MarketplaceLead" ADD CONSTRAINT "MarketplaceLead_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceLeadQualification" ADD CONSTRAINT "MarketplaceLeadQualification_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "MarketplaceLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceLeadDocument" ADD CONSTRAINT "MarketplaceLeadDocument_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "MarketplaceLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceLeadRoutingEvent" ADD CONSTRAINT "MarketplaceLeadRoutingEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "MarketplaceLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceLeadRoutingEvent" ADD CONSTRAINT "MarketplaceLeadRoutingEvent_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
