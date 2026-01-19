/*
  Warnings:

  - You are about to drop the `_ProfessionalProfileToService` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "Profession" AS ENUM ('GENERAL_CONTRACTOR', 'ELECTRICIAN', 'PLUMBER', 'CARPENTER', 'MASON', 'INTERIOR_DESIGNER', 'ARCHITECT', 'LANDSCAPER', 'PAINTER', 'HVAC_TECHNICIAN', 'ROOFER', 'GLAZIER', 'WELDER', 'OTHER');

-- DropForeignKey
ALTER TABLE "_ProfessionalProfileToService" DROP CONSTRAINT "_ProfessionalProfileToService_A_fkey";

-- DropForeignKey
ALTER TABLE "_ProfessionalProfileToService" DROP CONSTRAINT "_ProfessionalProfileToService_B_fkey";

-- AlterTable
ALTER TABLE "ProfessionalProfile" ADD COLUMN     "serviceId" TEXT;

-- DropTable
DROP TABLE "_ProfessionalProfileToService";

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "professionType" "Profession",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProfessionalProfileToServiceCategory" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProfessionalProfileToServiceCategory_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_slug_key" ON "ServiceCategory"("slug");

-- CreateIndex
CREATE INDEX "_ProfessionalProfileToServiceCategory_B_index" ON "_ProfessionalProfileToServiceCategory"("B");

-- AddForeignKey
ALTER TABLE "ProfessionalProfile" ADD CONSTRAINT "ProfessionalProfile_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProfessionalProfileToServiceCategory" ADD CONSTRAINT "_ProfessionalProfileToServiceCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "ProfessionalProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProfessionalProfileToServiceCategory" ADD CONSTRAINT "_ProfessionalProfileToServiceCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
