-- DropForeignKey
ALTER TABLE "RegulatorVerificationCase" DROP CONSTRAINT IF EXISTS "RegulatorVerificationCase_licenseId_fkey";

-- DropForeignKey
ALTER TABLE "RegulatorVerificationDecision" DROP CONSTRAINT IF EXISTS "RegulatorVerificationDecision_caseId_fkey";

-- AlterTable
ALTER TABLE "RegulatorVerificationCase" ALTER COLUMN "licenseId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "RegulatorVerificationCase" ADD CONSTRAINT "RegulatorVerificationCase_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "ProfessionalLicense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatorVerificationDecision" ADD CONSTRAINT "RegulatorVerificationDecision_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RegulatorVerificationCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
