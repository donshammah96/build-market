-- CreateEnum
CREATE TYPE "OnboardingUploadStatus" AS ENUM ('STAGED', 'CONSUMED', 'EXPIRED');

-- CreateTable
CREATE TABLE "OnboardingUpload" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "tempUrl" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "OnboardingUploadStatus" NOT NULL DEFAULT 'STAGED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "consumedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingUpload_storageKey_key" ON "OnboardingUpload"("storageKey");

-- CreateIndex
CREATE INDEX "OnboardingUpload_clerkId_idx" ON "OnboardingUpload"("clerkId");

-- CreateIndex
CREATE INDEX "OnboardingUpload_expiresAt_idx" ON "OnboardingUpload"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingUpload_id_clerkId_key" ON "OnboardingUpload"("id", "clerkId");
