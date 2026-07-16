/*
  Warnings:

  - You are about to drop the `FailedNotification` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateSchemas
CREATE SCHEMA IF NOT EXISTS "extensions";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "sslinfo" WITH SCHEMA "extensions";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

-- CreateEnum
CREATE TYPE "NewsletterSubscriberStatus" AS ENUM ('PENDING_CONFIRMATION', 'SUBSCRIBED', 'UNSUBSCRIBED', 'BOUNCED', 'COMPLAINED');

-- CreateEnum
CREATE TYPE "NewsletterEspSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'DEAD_LETTER');

-- DropTable
DROP TABLE "FailedNotification";

-- CreateTable
CREATE TABLE "failed_notifications" (
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

    CONSTRAINT "failed_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "id" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "userId" TEXT,
    "status" "NewsletterSubscriberStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "source" TEXT NOT NULL DEFAULT 'footer',
    "consentIpAddress" TEXT,
    "consentUserAgent" TEXT,
    "confirmationTokenHash" TEXT,
    "confirmationTokenExpiresAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "lastConfirmationSentAt" TIMESTAMP(3),
    "unsubscribeTokenHash" TEXT,
    "unsubscribedAt" TIMESTAMP(3),
    "unsubscribeReason" TEXT,
    "espProvider" TEXT,
    "espContactId" TEXT,
    "espSyncStatus" "NewsletterEspSyncStatus" NOT NULL DEFAULT 'PENDING',
    "espSyncAttempts" INTEGER NOT NULL DEFAULT 0,
    "espLastSyncError" TEXT,
    "espLastSyncAt" TIMESTAMP(3),
    "espNextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "failed_notifications_status_idx" ON "failed_notifications"("status");

-- CreateIndex
CREATE INDEX "failed_notifications_nextRetryAt_idx" ON "failed_notifications"("nextRetryAt");

-- CreateIndex
CREATE INDEX "failed_notifications_entityType_entityId_idx" ON "failed_notifications"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_confirmationTokenHash_key" ON "newsletter_subscribers"("confirmationTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_unsubscribeTokenHash_key" ON "newsletter_subscribers"("unsubscribeTokenHash");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_status_idx" ON "newsletter_subscribers"("status");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_espSyncStatus_espNextRetryAt_idx" ON "newsletter_subscribers"("espSyncStatus", "espNextRetryAt");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_userId_idx" ON "newsletter_subscribers"("userId");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_createdAt_idx" ON "newsletter_subscribers"("createdAt");

-- AddForeignKey
ALTER TABLE "newsletter_subscribers" ADD CONSTRAINT "newsletter_subscribers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
