/*
  Warnings:

  - You are about to drop the column `verifiedBy` on the `Certificate` table. All the data in the column will be lost.
  - You are about to drop the column `sharedWith` on the `IdeaBook` table. All the data in the column will be lost.
  - You are about to drop the column `participants` on the `MessageThread` table. All the data in the column will be lost.
  - You are about to drop the column `items` on the `Order` table. All the data in the column will be lost.
  - You are about to alter the column `totalAmount` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `amount` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `price` on the `Product` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `budget` on the `Project` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.

*/
-- DropIndex
DROP INDEX "Certificate_verifiedBy_idx";

-- AlterTable
ALTER TABLE "Certificate" DROP COLUMN "verifiedBy",
ADD COLUMN     "verifiedById" TEXT;

-- AlterTable
ALTER TABLE "IdeaBook" DROP COLUMN "sharedWith";

-- AlterTable
ALTER TABLE "MessageThread" DROP COLUMN "participants";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "items",
ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "price" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Project" ALTER COLUMN "budget" SET DATA TYPE DECIMAL(10,2);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_IdeaBookShares" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_IdeaBookShares_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "_IdeaBookShares_B_index" ON "_IdeaBookShares"("B");

-- CreateIndex
CREATE INDEX "Certificate_verifiedById_idx" ON "Certificate"("verifiedById");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IdeaBookShares" ADD CONSTRAINT "_IdeaBookShares_A_fkey" FOREIGN KEY ("A") REFERENCES "IdeaBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IdeaBookShares" ADD CONSTRAINT "_IdeaBookShares_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
