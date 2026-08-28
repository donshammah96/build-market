-- CreateEnum
CREATE TYPE "OnboardingWorkflowState" AS ENUM ('NOT_STARTED', 'ROLE_SELECTED', 'PROFILE_SUBMITTED', 'COMPLETED', 'PENDING_VERIFICATION', 'FAILED_RETRYABLE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdminRole" ADD VALUE 'OPS_ADMIN';
ALTER TYPE "AdminRole" ADD VALUE 'VERIFICATION_ADMIN';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'DOCUMENT_VIEWED';
ALTER TYPE "AuditAction" ADD VALUE 'DOCUMENT_DOWNLOADED';
ALTER TYPE "AuditAction" ADD VALUE 'EVIDENCE_VIEWED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OnboardingUploadStatus" ADD VALUE 'ATTACHED';
ALTER TYPE "OnboardingUploadStatus" ADD VALUE 'DELETED';
ALTER TYPE "OnboardingUploadStatus" ADD VALUE 'QUARANTINED';
ALTER TYPE "OnboardingUploadStatus" ADD VALUE 'SCAN_PENDING';
ALTER TYPE "OnboardingUploadStatus" ADD VALUE 'SCAN_FAILED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RegulatorVerificationCaseStatus" ADD VALUE 'EXPIRED';
ALTER TYPE "RegulatorVerificationCaseStatus" ADD VALUE 'APPROVED';
ALTER TYPE "RegulatorVerificationCaseStatus" ADD VALUE 'REJECTED';
ALTER TYPE "RegulatorVerificationCaseStatus" ADD VALUE 'PENDING';

-- AlterEnum
ALTER TYPE "TransactionStatus" ADD VALUE 'COMPLETED';

-- DropIndex
DROP INDEX "AuditLog_legalBasis_createdAt_idx";

-- AlterTable
ALTER TABLE "IdempotencyKey" ADD COLUMN     "actorClerkId" TEXT,
ADD COLUMN     "appUserId" TEXT;

-- CreateTable
CREATE TABLE "OnboardingState" (
    "userId" TEXT NOT NULL,
    "state" "OnboardingWorkflowState" NOT NULL DEFAULT 'NOT_STARTED',
    "role" "UserRole",
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingState_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "OnboardingTransition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "fromState" "OnboardingWorkflowState" NOT NULL,
    "toState" "OnboardingWorkflowState" NOT NULL,
    "actorClerkId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthOutboxEvent" (
    "id" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthOutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_scan_events" (
    "id" TEXT NOT NULL,
    "scanRequestId" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "virusName" TEXT,
    "engineVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_scan_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnboardingState_state_role_idx" ON "OnboardingState"("state", "role");

-- CreateIndex
CREATE INDEX "OnboardingState_updatedAt_idx" ON "OnboardingState"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingTransition_idempotencyKey_key" ON "OnboardingTransition"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OnboardingTransition_userId_createdAt_idx" ON "OnboardingTransition"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "OnboardingTransition_actorClerkId_createdAt_idx" ON "OnboardingTransition"("actorClerkId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthOutboxEvent_status_nextAttemptAt_idx" ON "AuthOutboxEvent"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "AuthOutboxEvent_aggregateType_aggregateId_idx" ON "AuthOutboxEvent"("aggregateType", "aggregateId");

-- CreateIndex
CREATE UNIQUE INDEX "upload_scan_events_scanRequestId_key" ON "upload_scan_events"("scanRequestId");

-- CreateIndex
CREATE INDEX "upload_scan_events_uploadId_idx" ON "upload_scan_events"("uploadId");

-- CreateIndex
CREATE INDEX "upload_scan_events_status_idx" ON "upload_scan_events"("status");

-- CreateIndex
CREATE INDEX "upload_scan_events_createdAt_idx" ON "upload_scan_events"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_legalBasis_idx" ON "AuditLog"("legalBasis");

-- CreateIndex
CREATE INDEX "IdempotencyKey_scope_actorClerkId_status_idx" ON "IdempotencyKey"("scope", "actorClerkId", "status");

-- CreateIndex
CREATE INDEX "IdempotencyKey_appUserId_idx" ON "IdempotencyKey"("appUserId");

-- AddForeignKey
ALTER TABLE "OnboardingState" ADD CONSTRAINT "OnboardingState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTransition" ADD CONSTRAINT "OnboardingTransition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "OnboardingState"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "RegulatorVerificationCaseArchive_authority_licenseNumber_idx" RENAME TO "RegulatorVerificationCaseArchive_authority_licenseNumber_ar_idx";

-- RenameIndex
ALTER INDEX "RegulatorVerificationCaseArchive_professionalId_idx" RENAME TO "RegulatorVerificationCaseArchive_professionalId_archivedAt_idx";
