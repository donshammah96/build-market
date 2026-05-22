/*
  Warnings:

  - Added the required column `operation` to the `IdempotencyKey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `IdempotencyKey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `IdempotencyKey` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "StoreEventType" AS ENUM ('STORE_CREATED', 'STORE_UPDATED', 'STORE_DELETED', 'STORE_RESTORED', 'IMAGES_UPDATED', 'OWNERSHIP_TRANSFERRED');

-- DropIndex
DROP INDEX "Store_professionalId_idx";

-- AlterTable
ALTER TABLE "IdempotencyKey" ADD COLUMN     "operation" TEXT NOT NULL,
ADD COLUMN     "response" JSONB,
ADD COLUMN     "status" "IdempotencyStatus" NOT NULL,
ADD COLUMN     "storeId" TEXT,
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "version" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "StoreEvent" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "type" "StoreEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "metadata" JSONB,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "StoreEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreEvent_storeId_version_idx" ON "StoreEvent"("storeId", "version");

-- CreateIndex
CREATE INDEX "StoreEvent_createdAt_idx" ON "StoreEvent"("createdAt");

-- CreateIndex
CREATE INDEX "Store_professionalId_deletedAt_idx" ON "Store"("professionalId", "deletedAt");

-- CreateIndex
CREATE INDEX "Store_version_idx" ON "Store"("version");

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreEvent" ADD CONSTRAINT "StoreEvent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
