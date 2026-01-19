-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "followUpDate" TIMESTAMP(3),
ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "ProfessionalProfile" ADD COLUMN     "profession" TEXT;
