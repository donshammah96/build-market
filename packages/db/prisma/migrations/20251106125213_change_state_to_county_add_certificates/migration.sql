-- AlterTable
ALTER TABLE "ProfessionalProfile" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "county" TEXT;

-- CreateIndex
CREATE INDEX "ProfessionalProfile_city_idx" ON "ProfessionalProfile"("city");

-- CreateIndex
CREATE INDEX "ProfessionalProfile_county_idx" ON "ProfessionalProfile"("county");
