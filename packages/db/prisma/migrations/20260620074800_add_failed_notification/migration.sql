-- DropIndex
DROP INDEX "DirectUpload_assetId_idx";

-- CreateTable
CREATE TABLE "FailedNotification" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3) NOT NULL,
    "lastError" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "FailedNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FailedNotification_status_idx" ON "FailedNotification"("status");

-- CreateIndex
CREATE INDEX "FailedNotification_nextRetryAt_idx" ON "FailedNotification"("nextRetryAt");

-- CreateIndex
CREATE INDEX "FailedNotification_entityType_entityId_idx" ON "FailedNotification"("entityType", "entityId");
