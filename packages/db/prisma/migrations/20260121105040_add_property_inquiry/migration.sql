/*
  Warnings:

  - A unique constraint covering the columns `[fileKey]` on the table `Certificate` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[fileKey]` on the table `ProfessionalDocument` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[fileKey]` on the table `PropertyAttachment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[fileKey]` on the table `PropertyDocument` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[key]` on the table `PropertyImage` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[fileKey]` on the table `StoreDocument` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[key]` on the table `StoreImage` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `fileKey` to the `Certificate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileKey` to the `ProfessionalDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileKey` to the `PropertyAttachment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileKey` to the `PropertyDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `key` to the `PropertyImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileKey` to the `StoreDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `key` to the `StoreImage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "fileKey" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ProfessionalDocument" ADD COLUMN     "fileKey" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PropertyAttachment" ADD COLUMN     "fileKey" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PropertyDocument" ADD COLUMN     "fileKey" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PropertyImage" ADD COLUMN     "key" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "StoreDocument" ADD COLUMN     "fileKey" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "StoreImage" ADD COLUMN     "key" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "PropertyInquiry" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "senderId" TEXT,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropertyInquiry_propertyId_idx" ON "PropertyInquiry"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyInquiry_senderId_idx" ON "PropertyInquiry"("senderId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_fileKey_key" ON "Certificate"("fileKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalDocument_fileKey_key" ON "ProfessionalDocument"("fileKey");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyAttachment_fileKey_key" ON "PropertyAttachment"("fileKey");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyDocument_fileKey_key" ON "PropertyDocument"("fileKey");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyImage_key_key" ON "PropertyImage"("key");

-- CreateIndex
CREATE UNIQUE INDEX "StoreDocument_fileKey_key" ON "StoreDocument"("fileKey");

-- CreateIndex
CREATE UNIQUE INDEX "StoreImage_key_key" ON "StoreImage"("key");

-- AddForeignKey
ALTER TABLE "PropertyInquiry" ADD CONSTRAINT "PropertyInquiry_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyInquiry" ADD CONSTRAINT "PropertyInquiry_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
