/*
  Warnings:

  - You are about to drop the column `serviceId` on the `ProfessionalProfile` table. All the data in the column will be lost.
  - You are about to drop the column `specializations` on the `ProfessionalProfile` table. All the data in the column will be lost.
  - You are about to drop the `_ProfessionalProfileToServiceCategory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProfessionalProfile" DROP CONSTRAINT "ProfessionalProfile_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "_ProfessionalProfileToServiceCategory" DROP CONSTRAINT "_ProfessionalProfileToServiceCategory_A_fkey";

-- DropForeignKey
ALTER TABLE "_ProfessionalProfileToServiceCategory" DROP CONSTRAINT "_ProfessionalProfileToServiceCategory_B_fkey";

-- AlterTable
ALTER TABLE "ProfessionalProfile" DROP COLUMN "serviceId",
DROP COLUMN "specializations";

-- DropTable
DROP TABLE "_ProfessionalProfileToServiceCategory";

-- CreateTable
CREATE TABLE "ProfessionalService" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "price" DECIMAL(12,2),
    "pricingUnit" TEXT,
    "yearsExperience" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfessionalService_serviceId_idx" ON "ProfessionalService"("serviceId");

-- CreateIndex
CREATE INDEX "ProfessionalService_professionalId_idx" ON "ProfessionalService"("professionalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalService_professionalId_serviceId_key" ON "ProfessionalService"("professionalId", "serviceId");

-- AddForeignKey
ALTER TABLE "ProfessionalService" ADD CONSTRAINT "ProfessionalService_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalService" ADD CONSTRAINT "ProfessionalService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
