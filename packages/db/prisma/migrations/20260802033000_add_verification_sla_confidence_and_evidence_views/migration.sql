-- AlterTable
ALTER TABLE "RegulatorVerificationCase" ADD COLUMN     "confidenceAlgorithmVersion" TEXT,
ADD COLUMN     "confidenceBreakdown" JSONB;

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "verificationSlaHours" INTEGER NOT NULL DEFAULT 48;

-- CreateTable
CREATE TABLE "regulator_verification_evidence_views" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "viewerRole" TEXT NOT NULL,
    "unredacted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regulator_verification_evidence_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "regulator_verification_evidence_views_caseId_createdAt_idx" ON "regulator_verification_evidence_views"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "regulator_verification_evidence_views_viewerId_createdAt_idx" ON "regulator_verification_evidence_views"("viewerId", "createdAt");

-- AddForeignKey
ALTER TABLE "regulator_verification_evidence_views" ADD CONSTRAINT "regulator_verification_evidence_views_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RegulatorVerificationCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regulator_verification_evidence_views" ADD CONSTRAINT "regulator_verification_evidence_views_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
