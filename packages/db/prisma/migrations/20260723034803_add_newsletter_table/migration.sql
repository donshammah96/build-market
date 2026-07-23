/*
  Warnings:

  - The `status` column on the `failed_notifications` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "FailedNotificationStatus" AS ENUM ('PENDING', 'COMPLETED', 'DEAD_LETTER');

-- DropIndex
DROP INDEX "failed_notifications_nextRetryAt_idx";

-- DropIndex
DROP INDEX "failed_notifications_status_idx";

-- AlterTable
ALTER TABLE "failed_notifications" DROP COLUMN "status",
ADD COLUMN     "status" "FailedNotificationStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "failed_notifications_status_nextRetryAt_idx" ON "failed_notifications"("status", "nextRetryAt");
