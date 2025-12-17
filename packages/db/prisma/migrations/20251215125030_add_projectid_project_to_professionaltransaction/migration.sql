-- AlterTable
ALTER TABLE "ProfessionalTransaction" ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "ProfessionalTransaction_projectId_idx" ON "ProfessionalTransaction"("projectId");

-- AddForeignKey
ALTER TABLE "ProfessionalTransaction" ADD CONSTRAINT "ProfessionalTransaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
