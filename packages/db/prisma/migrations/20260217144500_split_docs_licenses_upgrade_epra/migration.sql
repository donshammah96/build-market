-- 1. Data Migration: Remap deprecated DocumentCategory values to 'OTHER' to avoid casting errors
UPDATE "ProfessionalDocument"
SET "category" = 'OTHER'
WHERE "category"::text IN ('NCA_LICENSE', 'EBK_LICENSE', 'BORAQS_LICENSE', 'EPRA_LICENSE', 'VRB_LICENSE', 'ISK_LICENSE');

-- 2. AlterEnum: DocumentCategory (Drop values via Type Replacement)
BEGIN;
CREATE TYPE "DocumentCategory_new" AS ENUM ('ID_OR_PASSPORT', 'EDUCATION_CERT', 'AWARD_OR_RECOGNITION', 'TAX_COMPLIANCE', 'KRA_TAX_COMPLIANCE', 'INSURANCE_POLICY', 'CV_OR_RESUME', 'PORTFOLIO_DOC', 'NCA_ACCREDITATION', 'BUSINESS_REGISTRATION', 'PROFESSIONAL_CERT', 'OTHER');
ALTER TABLE "public"."ProfessionalDocument" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "ProfessionalDocument" ALTER COLUMN "category" TYPE "DocumentCategory_new" USING ("category"::text::"DocumentCategory_new");
ALTER TYPE "DocumentCategory" RENAME TO "DocumentCategory_old";
ALTER TYPE "DocumentCategory_new" RENAME TO "DocumentCategory";
DROP TYPE "public"."DocumentCategory_old";
ALTER TABLE "ProfessionalDocument" ALTER COLUMN "category" SET DEFAULT 'OTHER';
COMMIT;

-- 3. AlterEnum: LicenseAuthority (Add values)
-- Adding values to enum is safe in transactions
ALTER TYPE "LicenseAuthority" ADD VALUE 'EPRA';
ALTER TYPE "LicenseAuthority" ADD VALUE 'VRB';

-- 4. AlterTable: SystemSettings
-- Rename enableAutoVerifyERC -> enableAutoVerifyEPRA (Preserve value if possible, else default false)
-- Since we are dropping and adding, we lose the value unless we migrate it.
-- Let's migrate the value from old column if it exists, otherwise default false.
-- But standard ALTER TABLE DROP COLUMN loses data.
-- Improved approach: Rename column if postgres supports it (it does), OR Add/Update/Drop.
-- The generated SQL did DROP/ADD. Updating to RENAME for safety.
ALTER TABLE "SystemSettings" RENAME COLUMN "enableAutoVerifyERC" TO "enableAutoVerifyEPRA";
