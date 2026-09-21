-- ============================================================================
-- Migration: 20260816060000_create_settled_records_archive
-- Purpose: Create cold storage archive tables for settled MpesaTransaction and
--          RegulatorVerificationCase records older than 180 days.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. MpesaTransactionArchive
-- ----------------------------------------------------------------------------

CREATE TABLE "MpesaTransactionArchive" (
    "id" TEXT NOT NULL,
    "merchantRequestId" TEXT,
    "checkoutRequestId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "escrowId" TEXT,
    "transactionType" "MpesaTransactionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL,
    "resultCode" TEXT,
    "resultDesc" TEXT,
    "mpesaReceiptNumber" TEXT,
    "transactionDate" TIMESTAMP(3),
    "callbackReceivedAt" TIMESTAMP(3),
    "callbackPayload" JSONB,
    "reversalTransactionId" TEXT,
    "isReversed" BOOLEAN NOT NULL DEFAULT false,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MpesaTransactionArchive_pkey" PRIMARY KEY ("id", "archivedAt")
) PARTITION BY RANGE ("archivedAt");

CREATE TABLE "MpesaTransactionArchive_y2026m08" PARTITION OF "MpesaTransactionArchive"
    FOR VALUES FROM ('2026-08-01 00:00:00') TO ('2026-09-01 00:00:00');

CREATE TABLE "MpesaTransactionArchive_default" PARTITION OF "MpesaTransactionArchive" DEFAULT;

CREATE INDEX "MpesaTransactionArchive_userId_status_archivedAt_idx" ON "MpesaTransactionArchive" ("userId", "status", "archivedAt");
CREATE INDEX "MpesaTransactionArchive_checkoutRequestId_archivedAt_idx" ON "MpesaTransactionArchive" ("checkoutRequestId", "archivedAt");
CREATE INDEX "MpesaTransactionArchive_mpesaReceiptNumber_archivedAt_idx" ON "MpesaTransactionArchive" ("mpesaReceiptNumber", "archivedAt");
CREATE INDEX "MpesaTransactionArchive_archivedAt_idx" ON "MpesaTransactionArchive" ("archivedAt");

-- ----------------------------------------------------------------------------
-- 2. RegulatorVerificationCaseArchive
-- ----------------------------------------------------------------------------

CREATE TABLE "RegulatorVerificationCaseArchive" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "licenseId" TEXT,
    "authority" "LicenseAuthority" NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" "RegulatorVerificationCaseStatus" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL,
    "deadLetteredAt" TIMESTAMP(3),
    "deadLetterReason" TEXT,
    "confidence" DOUBLE PRECISION,
    "confidenceReasons" JSONB,
    "confidenceAlgorithmVersion" TEXT,
    "confidenceBreakdown" JSONB,
    "evidence" JSONB,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "retryAfterSeconds" INTEGER,
    "manualFallbackReason" TEXT,
    "correlationId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegulatorVerificationCaseArchive_pkey" PRIMARY KEY ("id", "archivedAt")
) PARTITION BY RANGE ("archivedAt");

CREATE TABLE "RegulatorVerificationCaseArchive_y2026m08" PARTITION OF "RegulatorVerificationCaseArchive"
    FOR VALUES FROM ('2026-08-01 00:00:00') TO ('2026-09-01 00:00:00');

CREATE TABLE "RegulatorVerificationCaseArchive_default" PARTITION OF "RegulatorVerificationCaseArchive" DEFAULT;

CREATE INDEX "RegulatorVerificationCaseArchive_authority_licenseNumber_idx" ON "RegulatorVerificationCaseArchive" ("authority", "licenseNumber", "archivedAt");
CREATE INDEX "RegulatorVerificationCaseArchive_professionalId_idx" ON "RegulatorVerificationCaseArchive" ("professionalId", "archivedAt");
CREATE INDEX "RegulatorVerificationCaseArchive_archivedAt_idx" ON "RegulatorVerificationCaseArchive" ("archivedAt");
