-- AlterTable
ALTER TABLE "ProfessionalDocument" ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PropertyDocument" ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StoreDocument" ADD COLUMN     "verifiedAt" TIMESTAMP(3);
