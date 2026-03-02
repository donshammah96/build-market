-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'MARKETING_EMAIL', 'MARKETING_SMS', 'ANALYTICS_COOKIES', 'LOCATION_TRACKING', 'KRA_DATA_SHARING');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'ADMIN', 'SYSTEM', 'API_KEY');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('PROFILE_UPDATED', 'DATA_EXPORT_REQUESTED', 'DATA_EXPORT_DOWNLOADED', 'ACCOUNT_DEACTIVATED', 'ACCOUNT_ANONYMIZED', 'CONSENT_GRANTED', 'CONSENT_WITHDRAWN', 'DATA_ACCESS_BY_ADMIN', 'SUSPENSION_APPLIED', 'DELETION_OVERRIDE', 'RETENTION_POLICY_ENFORCED', 'AUTO_ANONYMIZATION_EXECUTED', 'BREACH_NOTIFICATION_SENT');

-- CreateEnum
CREATE TYPE "LegalBasis" AS ENUM ('CONSENT', 'CONTRACT', 'LEGAL_OBLIGATION', 'VITAL_INTERESTS', 'PUBLIC_INTEREST', 'LEGITIMATE_INTEREST');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'EXPIRED', 'DOWNLOADED', 'FAILED');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('DATA_LEAK', 'UNAUTHORIZED_ACCESS', 'RANSOMWARE', 'PHISHING', 'INTERNAL_THREAT', 'OTHER');

-- CreateEnum
CREATE TYPE "DataClass" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED', 'PII', 'FINANCIAL');

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'DEACTIVATED';

-- AlterTable
ALTER TABLE "ProfessionalDocument" ADD COLUMN     "accessLog" JSONB;

-- AlterTable
ALTER TABLE "ProfessionalLicense" ADD COLUMN     "accessLog" JSONB;

-- AlterTable
ALTER TABLE "PropertyAttachment" ADD COLUMN     "accessLog" JSONB;

-- AlterTable
ALTER TABLE "PropertyDocument" ADD COLUMN     "accessLog" JSONB;

-- AlterTable
ALTER TABLE "PropertyImage" ADD COLUMN     "accessLog" JSONB;

-- AlterTable
ALTER TABLE "StoreDocument" ADD COLUMN     "accessLog" JSONB;

-- AlterTable
ALTER TABLE "StoreImage" ADD COLUMN     "accessLog" JSONB;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "analyticsConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "anonymizationBatchId" TEXT,
ADD COLUMN     "anonymizedAt" TIMESTAMP(3),
ADD COLUMN     "deletionReason" TEXT,
ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "emailMarketingConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marketingConsentWithdrawnAt" TIMESTAMP(3),
ADD COLUMN     "scheduledDeletionAt" TIMESTAMP(3),
ADD COLUMN     "smsMarketingConsent" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL,
    "withdrawnAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "documentVersion" TEXT NOT NULL,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" "ActorType" NOT NULL,
    "actorEmail" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB,
    "metadata" JSONB,
    "legalBasis" "LegalBasis",
    "consentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityIncident" (
    "id" TEXT NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "classification" "IncidentType" NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "containedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "affectedUserCount" INTEGER NOT NULL,
    "affectedDataTypes" TEXT[],
    "dataClasses" "DataClass"[],
    "odpcNotified" BOOLEAN NOT NULL DEFAULT false,
    "usersNotified" BOOLEAN NOT NULL DEFAULT false,
    "notificationEmail" TEXT,
    "description" TEXT NOT NULL,
    "rootCause" TEXT,
    "remediationSteps" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataExport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ExportStatus" NOT NULL,
    "fileSize" INTEGER,
    "fileUrl" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "downloadedAt" TIMESTAMP(3),
    "checksum" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,

    CONSTRAINT "DataExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_grantedAt_idx" ON "ConsentRecord"("userId", "grantedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRecord_userId_type_key" ON "ConsentRecord"("userId", "type");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_legalBasis_idx" ON "AuditLog"("legalBasis");

-- CreateIndex
CREATE INDEX "users_status_scheduledDeletionAt_idx" ON "users"("status", "scheduledDeletionAt");

-- CreateIndex
CREATE INDEX "users_anonymizedAt_idx" ON "users"("anonymizedAt");

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
