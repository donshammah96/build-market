/*
  Warnings:

  - The `verificationStatus` column on the `Certificate` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `type` column on the `Message` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Payment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[transactionId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `type` on the `Review` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('professional', 'store');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('success', 'failed', 'refunded', 'pending');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('text', 'image', 'file');

-- CreateEnum
CREATE TYPE "CertificateVerificationStatus" AS ENUM ('pending', 'verified', 'rejected');

-- AlterTable
ALTER TABLE "Certificate" DROP COLUMN "verificationStatus",
ADD COLUMN     "verificationStatus" "CertificateVerificationStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "type",
ADD COLUMN     "type" "MessageType" NOT NULL DEFAULT 'text';

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "status",
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "type",
ADD COLUMN     "type" "ReviewType" NOT NULL;

-- CreateIndex
CREATE INDEX "Certificate_verificationStatus_idx" ON "Certificate"("verificationStatus");

-- CreateIndex
CREATE INDEX "Certificate_verifiedBy_idx" ON "Certificate"("verifiedBy");

-- CreateIndex
CREATE INDEX "Message_threadId_idx" ON "Message"("threadId");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transactionId_key" ON "Payment"("transactionId");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_transactionId_idx" ON "Payment"("transactionId");

-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- CreateIndex
CREATE INDEX "Project_professionalId_idx" ON "Project"("professionalId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE INDEX "Review_type_idx" ON "Review"("type");

-- CreateIndex
CREATE INDEX "Review_rating_idx" ON "Review"("rating");

-- CreateIndex
CREATE INDEX "Review_approved_idx" ON "Review"("approved");

-- CreateIndex
CREATE INDEX "Review_professionalId_idx" ON "Review"("professionalId");

-- CreateIndex
CREATE INDEX "Review_storeId_idx" ON "Review"("storeId");
