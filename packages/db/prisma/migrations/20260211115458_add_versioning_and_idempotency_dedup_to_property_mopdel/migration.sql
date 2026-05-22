-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AttachmentType" ADD VALUE 'BUILDING_PERMIT';
ALTER TYPE "AttachmentType" ADD VALUE 'OTHER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PropertyDocumentType" ADD VALUE 'MANDATE_LETTER';
ALTER TYPE "PropertyDocumentType" ADD VALUE 'OTHER';

-- AlterTable
ALTER TABLE "IdempotencyKey" ADD COLUMN     "propertyId" TEXT;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
