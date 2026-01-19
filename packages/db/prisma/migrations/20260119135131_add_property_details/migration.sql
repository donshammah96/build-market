/*
  Warnings:

  - You are about to drop the column `images` on the `Property` table. All the data in the column will be lost.
  - The `county` column on the `Store` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "County" AS ENUM ('BARINGO', 'BOMET', 'BUNGOMA', 'BUSIA', 'ELGEYO_MARAKWET', 'EMBU', 'GARISSA', 'HOMA_BAY', 'ISIOLO', 'KAJIADO', 'KAKAMEGA', 'KERICHO', 'KIAMBU', 'KILIFI', 'KIRINYAGA', 'KISII', 'KISUMU', 'KITUI', 'KWALE', 'LAIKIPIA', 'LAMU', 'MACHAKOS', 'MAKUENI', 'MANDERA', 'MARSABIT', 'MERU', 'MIGORI', 'MOMBASA', 'MURANGA', 'NAIROBI', 'NAKURU', 'NANDI', 'NAROK', 'NYAMIRA', 'NYANDARUA', 'NYERI', 'SAMBURU', 'SIAYA', 'TAITA_TAVETA', 'TANA_RIVER', 'THARAKA_NITHI', 'TRANS_NZOIA', 'TURKANA', 'UASIN_GISHU', 'VIHIGA', 'WAJIR', 'WEST_POKOT');

-- AlterTable
ALTER TABLE "Property" DROP COLUMN "images",
ADD COLUMN     "constituency" TEXT,
ADD COLUMN     "county" "County",
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "neighbourhood" TEXT,
ADD COLUMN     "parkingSpaces" INTEGER,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "yearBuilt" INTEGER;

-- AlterTable
ALTER TABLE "Store" DROP COLUMN "county",
ADD COLUMN     "county" "County";

-- CreateTable
CREATE TABLE "PropertyImage" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyAttachment" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropertyImage_propertyId_idx" ON "PropertyImage"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyAttachment_propertyId_idx" ON "PropertyAttachment"("propertyId");

-- CreateIndex
CREATE INDEX "Property_county_idx" ON "Property"("county");

-- AddForeignKey
ALTER TABLE "PropertyImage" ADD CONSTRAINT "PropertyImage_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAttachment" ADD CONSTRAINT "PropertyAttachment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
