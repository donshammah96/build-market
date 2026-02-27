-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentCategory" ADD VALUE 'KRA_TAX_COMPLIANCE';
ALTER TYPE "DocumentCategory" ADD VALUE 'PORTFOLIO_DOC';
ALTER TYPE "DocumentCategory" ADD VALUE 'NCA_LICENSE';
ALTER TYPE "DocumentCategory" ADD VALUE 'NCA_ACCREDITATION';
ALTER TYPE "DocumentCategory" ADD VALUE 'EBK_LICENSE';
ALTER TYPE "DocumentCategory" ADD VALUE 'BORAQS_LICENSE';
ALTER TYPE "DocumentCategory" ADD VALUE 'EPRA_LICENSE';
ALTER TYPE "DocumentCategory" ADD VALUE 'VRB_LICENSE';
ALTER TYPE "DocumentCategory" ADD VALUE 'ISK_LICENSE';
ALTER TYPE "DocumentCategory" ADD VALUE 'BUSINESS_REGISTRATION';
ALTER TYPE "DocumentCategory" ADD VALUE 'PROFESSIONAL_CERT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PropertyDocumentType" ADD VALUE 'LAND_RATES_COMPLIANCE';
ALTER TYPE "PropertyDocumentType" ADD VALUE 'ID_OR_PASSPORT';
ALTER TYPE "PropertyDocumentType" ADD VALUE 'SALE_AGREEMENT';
ALTER TYPE "PropertyDocumentType" ADD VALUE 'MUTATION_FORM';
ALTER TYPE "PropertyDocumentType" ADD VALUE 'SECTIONAL_PROPERTIES_ACT_DOC';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StoreDocumentType" ADD VALUE 'BUSINESS_REGISTRATION';
ALTER TYPE "StoreDocumentType" ADD VALUE 'KRA_PIN_CERTIFICATE';
ALTER TYPE "StoreDocumentType" ADD VALUE 'ID_OR_PASSPORT';
ALTER TYPE "StoreDocumentType" ADD VALUE 'LEASE_OR_OWNERSHIP';
ALTER TYPE "StoreDocumentType" ADD VALUE 'TRADING_LICENSE';
