-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "RegulatorVerificationCaseStatus" AS ENUM ('QUEUED', 'PROCESSING', 'AUTO_VERIFIED', 'AUTO_REJECTED', 'NEEDS_MANUAL_REVIEW', 'REGULATOR_UNAVAILABLE', 'LOW_CONFIDENCE', 'MANUALLY_VERIFIED', 'MANUALLY_REJECTED', 'DEAD_LETTER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "RegulatorVerificationDecisionOutcome" AS ENUM ('APPROVE', 'REJECT', 'REQUEST_MORE_INFO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "RegulatorVerificationCase" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "authority" "LicenseAuthority" NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" "RegulatorVerificationCaseStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadLetteredAt" TIMESTAMP(3),
    "deadLetterReason" TEXT,
    "confidence" DOUBLE PRECISION,
    "confidenceReasons" JSONB,
    "evidence" JSONB,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "retryAfterSeconds" INTEGER,
    "manualFallbackReason" TEXT,
    "correlationId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegulatorVerificationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RegulatorVerificationDecision" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "adminName" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "outcome" "RegulatorVerificationDecisionOutcome" NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "reasonNotes" TEXT,
    "highRiskReview" BOOLEAN NOT NULL DEFAULT false,
    "isSecondApprover" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegulatorVerificationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RegulatorVerificationCase_dedupeKey_key" ON "RegulatorVerificationCase"("dedupeKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RegulatorVerificationCase_status_nextAttemptAt_idx" ON "RegulatorVerificationCase"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RegulatorVerificationCase_authority_licenseNumber_idx" ON "RegulatorVerificationCase"("authority", "licenseNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RegulatorVerificationCase_professionalId_idx" ON "RegulatorVerificationCase"("professionalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RegulatorVerificationCase_status_deadLetteredAt_idx" ON "RegulatorVerificationCase"("status", "deadLetteredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RegulatorVerificationDecision_caseId_createdAt_idx" ON "RegulatorVerificationDecision"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RegulatorVerificationDecision_adminId_createdAt_idx" ON "RegulatorVerificationDecision"("adminId", "createdAt");

-- AddForeignKey
ALTER TABLE "RegulatorVerificationCase" DROP CONSTRAINT IF EXISTS "RegulatorVerificationCase_licenseId_fkey";
ALTER TABLE "RegulatorVerificationCase" ADD CONSTRAINT "RegulatorVerificationCase_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "ProfessionalLicense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatorVerificationDecision" DROP CONSTRAINT IF EXISTS "RegulatorVerificationDecision_caseId_fkey";
ALTER TABLE "RegulatorVerificationDecision" ADD CONSTRAINT "RegulatorVerificationDecision_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RegulatorVerificationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatorVerificationDecision" DROP CONSTRAINT IF EXISTS "RegulatorVerificationDecision_adminId_fkey";
ALTER TABLE "RegulatorVerificationDecision" ADD CONSTRAINT "RegulatorVerificationDecision_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

