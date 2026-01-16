-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER');

-- CreateTable
CREATE TABLE "FailedNotification" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "newStatus" TEXT,
    "metadata" JSONB,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextRetryAt" TIMESTAMP(3) NOT NULL,
    "lastError" TEXT,
    "status" "QueueStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FailedNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FailedNotification_status_idx" ON "FailedNotification"("status");

-- CreateIndex
CREATE INDEX "FailedNotification_nextRetryAt_idx" ON "FailedNotification"("nextRetryAt");

-- CreateIndex
CREATE INDEX "FailedNotification_recipientUserId_idx" ON "FailedNotification"("recipientUserId");
