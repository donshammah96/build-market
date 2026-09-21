-- CreateEnum
CREATE TYPE "AssetVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "DirectUploadStatus" AS ENUM ('PRESIGNED', 'CONFIRMED', 'EXPIRED', 'FAILED');

-- AlterTable
DROP INDEX IF EXISTS "Asset_checksum_key";
ALTER TABLE "Asset"
  ALTER COLUMN "cdnUrl" DROP NOT NULL,
  ADD COLUMN "visibility" "AssetVisibility" NOT NULL DEFAULT 'PUBLIC';

-- CreateTable
CREATE TABLE "DirectUpload" (
    "id" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "assetId" TEXT,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "visibility" "AssetVisibility" NOT NULL DEFAULT 'PRIVATE',
    "status" "DirectUploadStatus" NOT NULL DEFAULT 'PRESIGNED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "temporary" BOOLEAN NOT NULL DEFAULT false,
    "deleteAfter" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_uploaderId_checksum_visibility_key" ON "Asset"("uploaderId", "checksum", "visibility");

-- CreateIndex
CREATE INDEX "DirectUpload_assetId_idx" ON "DirectUpload"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "DirectUpload_key_key" ON "DirectUpload"("key");

-- CreateIndex
CREATE INDEX "DirectUpload_uploaderId_status_idx" ON "DirectUpload"("uploaderId", "status");

-- CreateIndex
CREATE INDEX "DirectUpload_expiresAt_idx" ON "DirectUpload"("expiresAt");

-- CreateIndex
CREATE INDEX "DirectUpload_checksum_idx" ON "DirectUpload"("checksum");

-- AddForeignKey
ALTER TABLE "DirectUpload" ADD CONSTRAINT "DirectUpload_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectUpload" ADD CONSTRAINT "DirectUpload_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
