-- AlterTable
ALTER TABLE "Store" ADD COLUMN "verifiedById" TEXT;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN "verifiedById" TEXT;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
