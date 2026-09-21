-- AlterTable
ALTER TABLE "MpesaTransaction" ADD COLUMN "subscriptionId" TEXT;

-- CreateIndex
CREATE INDEX "MpesaTransaction_subscriptionId_idx" ON "MpesaTransaction"("subscriptionId");
