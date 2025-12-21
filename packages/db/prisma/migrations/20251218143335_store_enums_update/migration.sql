/*
  Warnings:

  - The `categories` column on the `Store` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `professionalId` to the `Store` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StoreCategory" AS ENUM ('hardware', 'building_materials', 'tiles_and_ceramics', 'electrical', 'plumbing', 'paints_and_finishes', 'roofing', 'timber_and_wood', 'glass_and_aluminum', 'kitchen_and_bath', 'landscaping', 'steel_and_metals', 'safety_and_tools', 'hvac');

-- CreateEnum
CREATE TYPE "StoreType" AS ENUM ('retail', 'wholesale', 'manufacturer', 'distributor', 'online_only');

-- AlterTable
ALTER TABLE "ProfessionalProfile" ADD COLUMN     "images" TEXT[];

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "images" TEXT[],
ADD COLUMN     "professionalId" TEXT NOT NULL,
ADD COLUMN     "storeType" "StoreType" NOT NULL DEFAULT 'retail',
DROP COLUMN "categories",
ADD COLUMN     "categories" "StoreCategory"[];

-- CreateIndex
CREATE INDEX "Store_professionalId_idx" ON "Store"("professionalId");

-- CreateIndex
CREATE INDEX "Store_verified_idx" ON "Store"("verified");

-- CreateIndex
CREATE INDEX "Store_storeType_idx" ON "Store"("storeType");

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
