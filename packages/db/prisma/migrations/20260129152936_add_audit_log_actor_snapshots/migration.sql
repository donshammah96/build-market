-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "actorFirstName" TEXT,
ADD COLUMN     "actorLastName" TEXT;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
