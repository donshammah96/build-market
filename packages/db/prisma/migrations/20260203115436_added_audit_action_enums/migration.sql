-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'DATA_RETENTION_ENFORCED';
ALTER TYPE "AuditAction" ADD VALUE 'DATA_RETENTION_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'ASSET_CLEANUP_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'ASSET_CLEANUP_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'ANONYMIZATION_BATCH_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'ANONYMIZATION_BATCH_FAILED';
