-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'PROFESSIONAL', 'ADMIN', 'SUPPORT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('HOMEOWNER', 'CORPORATE_DEVELOPER', 'INTERIOR_DESIGN_FIRM', 'GOVERNMENT_ENTITY', 'OTHER');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'CONTENT_MODERATOR', 'SUPPORT_AGENT', 'FINANCE_MANAGER', 'AUDITOR', 'SYSTEM_ADMIN');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('SUCCESS', 'FAILURE', 'DENIED');

-- CreateEnum
CREATE TYPE "Profession" AS ENUM ('ARCHITECT', 'INTERIOR_DESIGNER', 'LANDSCAPE_ARCHITECT', 'URBAN_PLANNER', 'STRUCTURAL_ENGINEER', 'CIVIL_ENGINEER', 'MECHANICAL_ENGINEER', 'ELECTRICAL_ENGINEER', 'QUANTITY_SURVEYOR', 'LAND_SURVEYOR', 'REAL_ESTATE_VALUER', 'GENERAL_CONTRACTOR', 'MASON', 'ELECTRICIAN', 'PLUMBER', 'CARPENTER', 'JOINER', 'PAINTER', 'WELDER', 'GLAZIER', 'ROOFER', 'STEEL_FIXER', 'FLOORING_SPECIALIST', 'PLASTERER', 'HVAC_TECHNICIAN', 'SOLAR_ENERGY_TECHNICIAN', 'BOREHOLE_DRILLER', 'CCTV_AND_SECURITY_PRO', 'INTERNET_AND_NETWORK_PRO', 'PROJECT_MANAGER', 'CLERK_OF_WORKS', 'OTHER');

-- CreateEnum
CREATE TYPE "LicenseAuthority" AS ENUM ('NCA', 'EBK', 'BORAQS', 'EARB', 'ERC', 'ISK', 'NEMA', 'KEBS', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('ID_OR_PASSPORT', 'EDUCATION_CERT', 'AWARD_OR_RECOGNITION', 'TAX_COMPLIANCE', 'INSURANCE_POLICY', 'CV_OR_RESUME', 'OTHER');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'BUSY', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'VERIFIED', 'NEEDS_CORRECTION', 'REJECTED', 'EXPIRED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'RENOVATION', 'INTERIOR_DESIGN', 'LANDSCAPING', 'INFRASTRUCTURE', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'ARCHIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('LABOR_ONLY', 'FULL_CONTRACT', 'DESIGN_ONLY', 'CONSULTANCY');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'DELAYED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REQUESTED_CHANGE');

-- CreateEnum
CREATE TYPE "ProjectDocumentType" AS ENUM ('CONTRACT_AGREEMENT', 'BOQ', 'INVOICE', 'RECEIPT', 'BLUEPRINT_ARCHITECTURAL', 'BLUEPRINT_STRUCTURAL', 'NCA_PERMIT', 'SITE_INSTRUCTION', 'HANDOVER_CERTIFICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectImageCategory" AS ENUM ('SITE_PREPARATION', 'FOUNDATION', 'WALLING', 'ROOFING', 'FINISHING', 'SNAG_LIST', 'MATERIAL_DELIVERY', 'OTHER');

-- CreateEnum
CREATE TYPE "StoreCategory" AS ENUM ('HARDWARE', 'BUILDING_MATERIALS', 'TILES_AND_CERAMICS', 'ELECTRICAL', 'PLUMBING', 'PAINTS_AND_FINISHES', 'ROOFING', 'TIMBER_AND_WOOD', 'GLASS_AND_ALUMINUM', 'KITCHEN_AND_BATH', 'LANDSCAPING', 'STEEL_AND_METALS', 'SAFETY_AND_TOOLS', 'HVAC', 'SOLAR_AND_ENERGY', 'WATER_STORAGE', 'SECURITY_SYSTEMS', 'DECOR_AND_LIGHTING', 'HEAVY_MACHINERY', 'WINDOWS_AND_DOORS', 'AUTOMOTIVE');

-- CreateEnum
CREATE TYPE "StoreType" AS ENUM ('RETAIL', 'WHOLESALE', 'MANUFACTURER', 'DISTRIBUTOR', 'ONLINE_ONLY');

-- CreateEnum
CREATE TYPE "DeliveryOption" AS ENUM ('PICKUP_ONLY', 'DELIVERY_AVAILABLE', 'THIRD_PARTY_LOGISTICS', 'DIGITAL_DELIVERY');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "StoreDocumentType" AS ENUM ('BUSINESS_PERMIT', 'KRA_TAX_COMPLIANCE', 'CR12', 'DISTRIBUTOR_LICENSE', 'KEBS_CERTIFICATE');

-- CreateEnum
CREATE TYPE "StoreImageCategory" AS ENUM ('LOGO', 'STOREFRONT', 'INTERIOR', 'WAREHOUSE', 'TEAM');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('SALE', 'RENT', 'LEASE');

-- CreateEnum
CREATE TYPE "PropertyCategory" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'LAND', 'INDUSTRIAL');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('AVAILABLE', 'SOLD', 'RENTED', 'UNDER_OFFER', 'OFF_MARKET');

-- CreateEnum
CREATE TYPE "PropertyTenure" AS ENUM ('FREEHOLD', 'LEASEHOLD', 'SECTIONAL_TITLE', 'SUB_LEASE');

-- CreateEnum
CREATE TYPE "FurnishingStatus" AS ENUM ('UNFURNISHED', 'SEMI_FURNISHED', 'FURNISHED', 'SERVICED');

-- CreateEnum
CREATE TYPE "CompletionStatus" AS ENUM ('READY_TO_MOVE', 'UNDER_CONSTRUCTION', 'OFF_PLAN');

-- CreateEnum
CREATE TYPE "AreaUnit" AS ENUM ('SQ_METERS', 'SQ_FEET', 'ACRES', 'HECTARES');

-- CreateEnum
CREATE TYPE "PropertyDocumentType" AS ENUM ('TITLE_DEED', 'OFFICIAL_SEARCH', 'LAND_RATES_CLEARANCE', 'LAND_RENT_CLEARANCE', 'ID_COPY', 'KRA_PIN', 'AUTHORITY_TO_SELL');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('FLOOR_PLAN', 'BROCHURE', 'ENERGY_CERTIFICATE', 'SITE_MAP', 'SALE_AGREEMENT_DRAFT');

-- CreateEnum
CREATE TYPE "ImageCategory" AS ENUM ('EXTERIOR', 'LIVING_ROOM', 'KITCHEN', 'BEDROOM', 'BATHROOM', 'AERIAL_VIEW', 'AMENITIES', 'PLAN');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'PROPOSAL', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('PLATFORM_SEARCH', 'PROFILE_VIEW', 'DIRECT_MESSAGE', 'PHONE_REVEAL', 'REFERRAL', 'EXTERNAL_IMPORT');

-- CreateEnum
CREATE TYPE "LeadPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "LostReason" AS ENUM ('PRICE_TOO_HIGH', 'GHOSTED', 'COMPETITOR_WON', 'TIMELINE_MISMATCH', 'OUT_OF_SCOPE', 'OTHER');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('MEETING', 'SITE_VISIT', 'DEADLINE', 'PAYMENT_DUE', 'MATERIAL_DELIVERY', 'INSPECTION_NCA', 'INSPECTION_INTERNAL');

-- CreateEnum
CREATE TYPE "CalendarEventStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MPESA_STK_PUSH', 'MPESA_PAYBILL', 'MPESA_B2C', 'BANK_TRANSFER', 'CARD', 'WALLET');

-- CreateEnum
CREATE TYPE "MpesaTransactionType" AS ENUM ('CUSTOMER_PAY_BILL_ONLINE', 'CUSTOMER_BUY_GOODS_ONLINE', 'BUSINESS_PAYMENT', 'SALARY_PAYMENT');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'WITHDRAWAL', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('PROJECT_PAYMENT', 'SUBSCRIPTION_FEE', 'LEAD_PURCHASE', 'VERIFICATION_FEE', 'WITHDRAWAL', 'REFUND', 'PENALTY');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REVERSED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('PENDING_FUNDING', 'FUNDS_HELD', 'RELEASED', 'DISPUTED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MPESA', 'BANK_TRANSFER', 'CARD', 'WALLET', 'CASH');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SUCCESS', 'FAILED', 'REFUNDED', 'PENDING');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'REVISED');

-- CreateEnum
CREATE TYPE "ReviewType" AS ENUM ('PROFESSIONAL', 'STORE');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED', 'DISPUTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'PDF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ThreadType" AS ENUM ('DIRECT', 'GROUP', 'PROJECT', 'SUPPORT');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR', 'PAYMENT', 'MESSAGE', 'PROJECT', 'LEAD', 'SECURITY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "IdeaBookCategory" AS ENUM ('LIVING_ROOM', 'KITCHEN', 'BATHROOM', 'BEDROOM', 'OUTDOOR_LANDSCAPING', 'COMMERCIAL_OFFICE', 'RETAIL_SHOP', 'WHOLE_HOUSE');

-- CreateEnum
CREATE TYPE "IdeaBookPrivacy" AS ENUM ('PUBLIC', 'SHARED_LINK', 'PRIVATE');

-- CreateEnum
CREATE TYPE "PortfolioImageCategory" AS ENUM ('FINISHED_WORK', 'BEFORE_STATE', 'WORK_IN_PROGRESS', 'BLUEPRINT_OR_PLAN', 'MATERIAL_BOARD');

-- CreateEnum
CREATE TYPE "ProjectDurationUnit" AS ENUM ('DAYS', 'WEEKS', 'MONTHS', 'YEARS');

-- CreateEnum
CREATE TYPE "AnalyticsPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "AnalyticsEntityType" AS ENUM ('PROFILE', 'STORE', 'PROJECT', 'PRODUCT', 'PROPERTY');

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('VIEW', 'CONTACT_CLICK', 'SEARCH_IMPRESSION', 'BOOKMARK', 'SHARE');

-- CreateEnum
CREATE TYPE "CertificateVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "County" AS ENUM ('BARINGO', 'BOMET', 'BUNGOMA', 'BUSIA', 'ELGEYO_MARAKWET', 'EMBU', 'GARISSA', 'HOMA_BAY', 'ISIOLO', 'KAJIADO', 'KAKAMEGA', 'KERICHO', 'KIAMBU', 'KILIFI', 'KIRINYAGA', 'KISII', 'KISUMU', 'KITUI', 'KWALE', 'LAIKIPIA', 'LAMU', 'MACHAKOS', 'MAKUENI', 'MANDERA', 'MARSABIT', 'MERU', 'MIGORI', 'MOMBASA', 'MURANGA', 'NAIROBI', 'NAKURU', 'NANDI', 'NAROK', 'NYAMIRA', 'NYANDARUA', 'NYERI', 'SAMBURU', 'SIAYA', 'TAITA_TAVETA', 'TANA_RIVER', 'THARAKA_NITHI', 'TRANS_NZOIA', 'TURKANA', 'UASIN_GISHU', 'VIHIGA', 'WAJIR', 'WEST_POKOT');

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT,
    "allowedIPs" TEXT[],
    "publicSignup" BOOLEAN NOT NULL DEFAULT true,
    "allowProfessionalSignup" BOOLEAN NOT NULL DEFAULT true,
    "emailVerificationRequired" BOOLEAN NOT NULL DEFAULT true,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "minWithdrawalKes" DECIMAL(10,2) NOT NULL DEFAULT 1000.00,
    "maxWithdrawalKes" DECIMAL(10,2) NOT NULL DEFAULT 150000.00,
    "platformCommission" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 16.00,
    "withholdingTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "mpesaEnv" TEXT NOT NULL DEFAULT 'sandbox',
    "mpesaShortCode" TEXT,
    "mpesaPasskey" TEXT,
    "mpesaConsumerKey" TEXT,
    "mpesaConsumerSecret" TEXT,
    "mpesaInitiatorName" TEXT,
    "mpesaInitiatorPassword" TEXT,
    "kraApiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "kraTaxPinValidation" BOOLEAN NOT NULL DEFAULT false,
    "enforceStrictVerification" BOOLEAN NOT NULL DEFAULT true,
    "enforceProfessionalLicenses" BOOLEAN NOT NULL DEFAULT true,
    "enableAutoVerifyNCA" BOOLEAN NOT NULL DEFAULT false,
    "enableAutoVerifyERC" BOOLEAN NOT NULL DEFAULT false,
    "enableAutoVerifyBORAQS" BOOLEAN NOT NULL DEFAULT false,
    "enforcePropertyDocuments" BOOLEAN NOT NULL DEFAULT true,
    "enableLandRegistryCheck" BOOLEAN NOT NULL DEFAULT false,
    "enforceStorePermits" BOOLEAN NOT NULL DEFAULT true,
    "requireTaxCompliance" BOOLEAN NOT NULL DEFAULT false,
    "verificationRules" JSONB NOT NULL DEFAULT '{}',
    "featureFlags" JSONB NOT NULL DEFAULT '{}',
    "supportEmail" TEXT NOT NULL DEFAULT 'support@buildmarket.co.ke',
    "supportPhone" TEXT,
    "whatsappNumber" TEXT,
    "securityMFA" BOOLEAN NOT NULL DEFAULT true,
    "adminEmailAlerts" BOOLEAN NOT NULL DEFAULT true,
    "sessionTimeoutMins" INTEGER NOT NULL DEFAULT 60,
    "maxUploadSizeMB" INTEGER NOT NULL DEFAULT 10,
    "allowedFileTypes" TEXT[] DEFAULT ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::TEXT[],
    "termsVersion" TEXT NOT NULL DEFAULT '1.0',
    "privacyPolicyVersion" TEXT NOT NULL DEFAULT '1.0',
    "minAppVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "displayName" TEXT,
    "phone" TEXT,
    "avatar" TEXT,
    "bio" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "isProfileComplete" BOOLEAN NOT NULL DEFAULT false,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "termsAcceptedAt" TIMESTAMP(3),
    "termsVersion" TEXT,
    "privacyAcceptedAt" TIMESTAMP(3),
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "dataRetentionDays" INTEGER,
    "lastLoginAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3),
    "loginCount" INTEGER NOT NULL DEFAULT 0,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminProfile" (
    "userId" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'SUPPORT_AGENT',
    "permissions" TEXT[],
    "department" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3),
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "adminName" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "adminRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO',
    "status" "AuditStatus" NOT NULL DEFAULT 'SUCCESS',
    "targetId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "details" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "canAcceptJobs" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientProfile" (
    "userId" TEXT NOT NULL,
    "type" "ClientType" NOT NULL DEFAULT 'HOMEOWNER',
    "companyName" TEXT,
    "companyRegistration" TEXT,
    "kraPin" TEXT,
    "vatRegistered" BOOLEAN NOT NULL DEFAULT false,
    "website" TEXT,
    "address" TEXT,
    "city" TEXT,
    "county" "County",
    "neighborhood" TEXT,
    "landmark" TEXT,
    "zipCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "location" JSONB,
    "budgetRangeMin" DECIMAL(12,2),
    "budgetRangeMax" DECIMAL(12,2),
    "interests" TEXT[],
    "preferences" JSONB,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "membershipTier" TEXT NOT NULL DEFAULT 'STANDARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ProfessionalProfile" (
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "profession" "Profession",
    "slug" TEXT,
    "bio" TEXT,
    "portfolioUrl" TEXT,
    "businessEmail" TEXT,
    "businessPhone" TEXT,
    "website" TEXT,
    "socials" JSONB,
    "city" TEXT,
    "county" "County",
    "country" TEXT DEFAULT 'Kenya',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "location" JSONB,
    "serviceRadiusKm" INTEGER DEFAULT 20,
    "availability" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "operatingHours" JSONB,
    "kraPin" TEXT,
    "isInsured" BOOLEAN NOT NULL DEFAULT false,
    "insuranceExpiry" TIMESTAMP(3),
    "insuranceProvider" TEXT,
    "insurancePolicyNumber" TEXT,
    "yearsExperience" INTEGER,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationNotes" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0.0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "completedProjects" INTEGER NOT NULL DEFAULT 0,
    "projectCount" INTEGER NOT NULL DEFAULT 0,
    "responseRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "responseTime" INTEGER NOT NULL DEFAULT 0,
    "minProjectBudget" DECIMAL(12,2),
    "hourlyRate" DECIMAL(10,2),
    "acceptedPayments" TEXT[] DEFAULT ARRAY['MPESA', 'BANK', 'CASH']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ProfessionalLicense" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "authority" "LicenseAuthority" NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "category" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "isAnnualRenewal" BOOLEAN NOT NULL DEFAULT true,
    "fileKey" TEXT,
    "fileUrl" TEXT,
    "size" INTEGER,
    "mimeType" TEXT,
    "assetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "verificationMethod" TEXT,
    "notes" TEXT,

    CONSTRAINT "ProfessionalLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalDocument" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "issuer" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "fileKey" TEXT,
    "fileUrl" TEXT,
    "size" INTEGER,
    "mimeType" TEXT,
    "assetId" TEXT,
    "verifiedById" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProfessionalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalService" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "price" DECIMAL(12,2),
    "pricingUnit" TEXT,
    "yearsExperience" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProfessionalService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyProfessionalStats" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "inquiries" INTEGER NOT NULL DEFAULT 0,
    "projectsWon" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "DailyProfessionalStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "imageUrl" TEXT,
    "professionType" "Profession",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "keywords" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "defaultUnit" TEXT,
    "avgPriceMin" DECIMAL(10,2),
    "avgPriceMax" DECIMAL(10,2),
    "searchKeywords" TEXT[],
    "popularityScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "professionalId" TEXT,
    "portfolioId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ProjectType" NOT NULL DEFAULT 'RESIDENTIAL',
    "contractType" "ContractType" NOT NULL DEFAULT 'FULL_CONTRACT',
    "contractSignedAt" TIMESTAMP(3),
    "contractDocumentId" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "isDisputed" BOOLEAN NOT NULL DEFAULT false,
    "disputeReason" TEXT,
    "disputeResolvedAt" TIMESTAMP(3),
    "disputeResolution" TEXT,
    "disputeDocumentId" TEXT,
    "location" TEXT,
    "siteAddress" TEXT,
    "county" "County",
    "coordinates" JSONB,
    "budgetMin" DECIMAL(12,2),
    "budgetMax" DECIMAL(12,2),
    "agreedPrice" DECIMAL(12,2),
    "totalPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalInvoiced" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "retentionPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "retentionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "retentionReleaseDate" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "actualCompletionDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMilestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2),
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "escrowId" TEXT,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "contractProjectId" TEXT,
    "disputeProjectId" TEXT,
    "title" TEXT NOT NULL,
    "type" "ProjectDocumentType" NOT NULL,
    "fileUrl" TEXT,
    "fileKey" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "assetId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "milestoneId" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectImage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "fileKey" TEXT,
    "fileUrl" TEXT,
    "caption" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "blurDataUrl" TEXT,
    "assetId" TEXT,
    "category" "ProjectImageCategory",
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowTransaction" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "platformFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "withholdingTax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "EscrowStatus" NOT NULL DEFAULT 'PENDING_FUNDING',
    "fundedAt" TIMESTAMP(3),
    "fundingRef" TEXT,
    "releasedAt" TIMESTAMP(3),
    "releasedToId" TEXT,
    "releaseRef" TEXT,
    "disputedAt" TIMESTAMP(3),
    "disputeReason" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscrowTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "escrowId" TEXT,
    "accountType" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "transactionRef" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "cdnUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "blurHash" TEXT,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessed" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deleteAfter" TIMESTAMP(3),

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "projectType" "ProjectType" NOT NULL DEFAULT 'RESIDENTIAL',
    "tags" TEXT[],
    "location" TEXT,
    "county" "County",
    "budget" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "durationValue" INTEGER,
    "durationUnit" "ProjectDurationUnit" NOT NULL DEFAULT 'WEEKS',
    "completionDate" TIMESTAMP(3),
    "linkedProjectId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "clientTestimonial" TEXT,
    "clientName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioImage" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "fileKey" TEXT,
    "fileUrl" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "blurDataUrl" TEXT,
    "assetId" TEXT,
    "caption" TEXT,
    "category" "PortfolioImageCategory" NOT NULL DEFAULT 'FINISHED_WORK',
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "contactPhone" TEXT,
    "whatsappNumber" TEXT,
    "email" TEXT,
    "website" TEXT,
    "mpesaTillNumber" TEXT,
    "mpesaPaybill" TEXT,
    "mpesaPasskey" TEXT,
    "acceptsCard" BOOLEAN NOT NULL DEFAULT false,
    "acceptsCash" BOOLEAN NOT NULL DEFAULT true,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "county" "County",
    "neighborhood" TEXT,
    "zipCode" TEXT,
    "coordinates" JSONB,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "storeType" "StoreType" NOT NULL DEFAULT 'RETAIL',
    "categories" "StoreCategory"[],
    "deliveryOption" "DeliveryOption" NOT NULL DEFAULT 'PICKUP_ONLY',
    "deliveryRadiusKm" INTEGER,
    "baseDeliveryFee" DECIMAL(10,2) DEFAULT 0,
    "minOrderValue" DECIMAL(10,2) DEFAULT 0,
    "operatingHours" JSONB,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "businessRegNo" TEXT,
    "kraPin" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationNotes" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0.0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreDocument" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "type" "StoreDocumentType" NOT NULL,
    "fileKey" TEXT,
    "fileUrl" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "assetId" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "uploadedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreImage" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "fileKey" TEXT,
    "fileUrl" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "blurDataUrl" TEXT,
    "assetId" TEXT,
    "category" "StoreImageCategory" NOT NULL DEFAULT 'INTERIOR',
    "caption" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "compareAt" DECIMAL(12,2),
    "costPrice" DECIMAL(12,2),
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "lowStockAlert" INTEGER NOT NULL DEFAULT 5,
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "category" "StoreCategory" NOT NULL,
    "tags" TEXT[],
    "attributes" JSONB,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "storeId" TEXT,
    "professionalId" TEXT,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "snapshotImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "transactionId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" "PropertyType" NOT NULL,
    "category" "PropertyCategory" NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "priceNegotiable" BOOLEAN NOT NULL DEFAULT false,
    "serviceCharge" DECIMAL(10,2) DEFAULT 0,
    "depositRequired" TEXT,
    "paymentTerms" TEXT,
    "tenure" "PropertyTenure" DEFAULT 'FREEHOLD',
    "leaseYearsRemaining" INTEGER,
    "titleDeedNumber" TEXT,
    "titleDeedReady" BOOLEAN NOT NULL DEFAULT false,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "parkingSpaces" INTEGER,
    "buildingSize" DOUBLE PRECISION,
    "plotSize" DOUBLE PRECISION,
    "areaUnit" "AreaUnit" NOT NULL DEFAULT 'SQ_METERS',
    "yearBuilt" INTEGER,
    "furnishing" "FurnishingStatus" NOT NULL DEFAULT 'UNFURNISHED',
    "completionStatus" "CompletionStatus" NOT NULL DEFAULT 'READY_TO_MOVE',
    "location" TEXT NOT NULL,
    "address" TEXT,
    "county" "County",
    "constituency" TEXT,
    "neighbourhood" TEXT,
    "coordinates" JSONB,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "nearbyLandmarks" JSONB,
    "hasBorehole" BOOLEAN NOT NULL DEFAULT false,
    "hasBackupGenerator" BOOLEAN NOT NULL DEFAULT false,
    "hasElevator" BOOLEAN NOT NULL DEFAULT false,
    "hasCCTV" BOOLEAN NOT NULL DEFAULT false,
    "isGatedCommunity" BOOLEAN NOT NULL DEFAULT false,
    "features" TEXT[],
    "status" "PropertyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationNotes" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "inquiryCount" INTEGER NOT NULL DEFAULT 0,
    "agentId" TEXT NOT NULL,
    "floorPlanUrl" TEXT,
    "videoUrl" TEXT,
    "virtualTourUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyDocument" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "type" "PropertyDocumentType" NOT NULL,
    "fileKey" TEXT,
    "url" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "assetId" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyImage" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "fileKey" TEXT,
    "url" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "blurDataUrl" TEXT,
    "assetId" TEXT,
    "caption" TEXT,
    "category" "ImageCategory" NOT NULL DEFAULT 'EXTERIOR',
    "tags" TEXT[],
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyAttachment" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "AttachmentType" NOT NULL,
    "fileKey" TEXT,
    "fileUrl" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "assetId" TEXT,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyInquiry" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "senderId" TEXT,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isLatest" BOOLEAN NOT NULL DEFAULT true,
    "previousQuoteId" TEXT,
    "materialsTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "laborTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "logisticsTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "paymentTerms" TEXT,
    "estimatedDuration" INTEGER,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "viewedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "category" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteAttachment" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileKey" TEXT,
    "fileUrl" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "assetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalTransaction" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "projectId" TEXT,
    "leadId" TEXT,
    "subscriptionId" TEXT,
    "description" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "category" "TransactionCategory" NOT NULL DEFAULT 'PROJECT_PAYMENT',
    "method" "PaymentMethod" NOT NULL DEFAULT 'MPESA',
    "amount" DECIMAL(12,2) NOT NULL,
    "platformFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "referenceCode" TEXT,
    "providerMetadata" JSONB,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "failedReason" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "clientId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT,
    "clientPhone" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "projectType" "ProjectType" NOT NULL DEFAULT 'RESIDENTIAL',
    "location" TEXT,
    "county" "County",
    "budget" DECIMAL(12,2),
    "budgetMin" DECIMAL(12,2),
    "budgetMax" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "priority" "LeadPriority" NOT NULL DEFAULT 'MEDIUM',
    "source" "LeadSource" NOT NULL DEFAULT 'PLATFORM_SEARCH',
    "lostReason" "LostReason",
    "wonAt" TIMESTAMP(3),
    "notes" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "followUpDate" TIMESTAMP(3),
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "clientId" TEXT,
    "guestEmails" TEXT[],
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "CalendarEventType" NOT NULL DEFAULT 'MEETING',
    "status" "CalendarEventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "timeZone" TEXT NOT NULL DEFAULT 'Africa/Nairobi',
    "recurrenceRule" TEXT,
    "location" TEXT,
    "meetingUrl" TEXT,
    "reminders" INTEGER[] DEFAULT ARRAY[30]::INTEGER[],
    "externalEventId" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageThread" (
    "id" TEXT NOT NULL,
    "type" "ThreadType" NOT NULL DEFAULT 'DIRECT',
    "subject" TEXT,
    "projectId" TEXT,
    "lastMessage" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MessageThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreadParticipant" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nickname" TEXT,
    "role" "ParticipantRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastReadAt" TIMESTAMP(3),
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ThreadParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "replyToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadReceipt" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "priority" "NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
    "channels" "NotificationChannel"[] DEFAULT ARRAY['IN_APP']::"NotificationChannel"[],
    "metadata" JSONB,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "deliveryStatus" "NotificationDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "professionalId" TEXT,
    "storeId" TEXT,
    "productId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT,
    "orderId" TEXT,
    "type" "ReviewType" NOT NULL,
    "rating" INTEGER NOT NULL,
    "subRatings" JSONB,
    "title" TEXT,
    "comment" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "replyComment" TEXT,
    "replyAt" TIMESTAMP(3),
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "reportedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewImage" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "fileKey" TEXT,
    "fileUrl" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "blurDataUrl" TEXT,
    "assetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdeaBook" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" "IdeaBookCategory" NOT NULL DEFAULT 'WHOLE_HOUSE',
    "privacy" "IdeaBookPrivacy" NOT NULL DEFAULT 'PUBLIC',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdeaBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdeaBookCollaborator" (
    "id" TEXT NOT NULL,
    "ideaBookId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdeaBookCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedProduct" (
    "id" TEXT NOT NULL,
    "ideaBookId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "note" TEXT,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedProject" (
    "id" TEXT NOT NULL,
    "ideaBookId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "note" TEXT,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedImage" (
    "id" TEXT NOT NULL,
    "ideaBookId" TEXT NOT NULL,
    "portfolioImageId" TEXT NOT NULL,
    "note" TEXT,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdeaBookAttachment" (
    "id" TEXT NOT NULL,
    "ideaBookId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "caption" TEXT,
    "fileKey" TEXT,
    "fileUrl" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "blurDataUrl" TEXT,
    "assetId" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdeaBookAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAnalytics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" "AnalyticsEntityType" NOT NULL DEFAULT 'PROFILE',
    "entityId" TEXT,
    "period" "AnalyticsPeriod" NOT NULL DEFAULT 'DAILY',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "uniqueViews" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "entityType" "AnalyticsEntityType" NOT NULL,
    "entityId" TEXT,
    "eventType" "AnalyticsEventType" NOT NULL,
    "viewerId" TEXT,
    "sessionId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "source" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MpesaTransaction" (
    "id" TEXT NOT NULL,
    "merchantRequestId" TEXT,
    "checkoutRequestId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "escrowId" TEXT,
    "transactionType" "MpesaTransactionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "resultCode" TEXT,
    "resultDesc" TEXT,
    "mpesaReceiptNumber" TEXT,
    "transactionDate" TIMESTAMP(3),
    "callbackReceivedAt" TIMESTAMP(3),
    "callbackPayload" JSONB,
    "reversalTransactionId" TEXT,
    "isReversed" BOOLEAN NOT NULL DEFAULT false,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MpesaTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MpesaB2C" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "conversationId" TEXT,
    "originatorConvId" TEXT,
    "resultCode" TEXT,
    "resultDesc" TEXT,
    "transactionId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MpesaB2C_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProductImages" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProductImages_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_key_key" ON "IdempotencyKey"("key");

-- CreateIndex
CREATE INDEX "IdempotencyKey_key_scope_idx" ON "IdempotencyKey"("key", "scope");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkId_key" ON "users"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_clerkId_idx" ON "users"("clerkId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_deletedAt_idx" ON "users"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "RefreshToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminId_idx" ON "AdminAuditLog"("adminId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_action_idx" ON "AdminAuditLog"("action");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_severity_idx" ON "AdminAuditLog"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_userId_key" ON "TeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientProfile_kraPin_key" ON "ClientProfile"("kraPin");

-- CreateIndex
CREATE INDEX "ClientProfile_county_idx" ON "ClientProfile"("county");

-- CreateIndex
CREATE INDEX "ClientProfile_kraPin_idx" ON "ClientProfile"("kraPin");

-- CreateIndex
CREATE INDEX "ClientProfile_userId_isVerified_idx" ON "ClientProfile"("userId", "isVerified");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalProfile_slug_key" ON "ProfessionalProfile"("slug");

-- CreateIndex
CREATE INDEX "ProfessionalProfile_slug_idx" ON "ProfessionalProfile"("slug");

-- CreateIndex
CREATE INDEX "ProfessionalProfile_profession_county_verificationStatus_idx" ON "ProfessionalProfile"("profession", "county", "verificationStatus");

-- CreateIndex
CREATE INDEX "ProfessionalProfile_kraPin_idx" ON "ProfessionalProfile"("kraPin");

-- CreateIndex
CREATE INDEX "ProfessionalProfile_rating_reviewCount_idx" ON "ProfessionalProfile"("rating", "reviewCount");

-- CreateIndex
CREATE INDEX "ProfessionalProfile_availability_idx" ON "ProfessionalProfile"("availability");

-- CreateIndex
CREATE INDEX "ProfessionalProfile_location_idx" ON "ProfessionalProfile"("location");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalLicense_fileKey_key" ON "ProfessionalLicense"("fileKey");

-- CreateIndex
CREATE INDEX "ProfessionalLicense_authority_licenseNumber_idx" ON "ProfessionalLicense"("authority", "licenseNumber");

-- CreateIndex
CREATE INDEX "ProfessionalLicense_validUntil_idx" ON "ProfessionalLicense"("validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalLicense_professionalId_authority_licenseNumber_key" ON "ProfessionalLicense"("professionalId", "authority", "licenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalDocument_fileKey_key" ON "ProfessionalDocument"("fileKey");

-- CreateIndex
CREATE INDEX "ProfessionalDocument_professionalId_category_idx" ON "ProfessionalDocument"("professionalId", "category");

-- CreateIndex
CREATE INDEX "ProfessionalDocument_status_idx" ON "ProfessionalDocument"("status");

-- CreateIndex
CREATE INDEX "ProfessionalService_serviceId_idx" ON "ProfessionalService"("serviceId");

-- CreateIndex
CREATE INDEX "ProfessionalService_professionalId_idx" ON "ProfessionalService"("professionalId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalService_professionalId_serviceId_key" ON "ProfessionalService"("professionalId", "serviceId");

-- CreateIndex
CREATE INDEX "DailyProfessionalStats_professionalId_date_idx" ON "DailyProfessionalStats"("professionalId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyProfessionalStats_professionalId_date_key" ON "DailyProfessionalStats"("professionalId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_slug_key" ON "ServiceCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");

-- CreateIndex
CREATE INDEX "Service_categoryId_idx" ON "Service"("categoryId");

-- CreateIndex
CREATE INDEX "Service_slug_idx" ON "Service"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Project_portfolioId_key" ON "Project"("portfolioId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_contractDocumentId_key" ON "Project"("contractDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_disputeDocumentId_key" ON "Project"("disputeDocumentId");

-- CreateIndex
CREATE INDEX "Project_clientId_status_idx" ON "Project"("clientId", "status");

-- CreateIndex
CREATE INDEX "Project_professionalId_status_idx" ON "Project"("professionalId", "status");

-- CreateIndex
CREATE INDEX "Project_county_idx" ON "Project"("county");

-- CreateIndex
CREATE INDEX "Project_title_description_idx" ON "Project"("title", "description");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMilestone_escrowId_key" ON "ProjectMilestone"("escrowId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDocument_contractProjectId_key" ON "ProjectDocument"("contractProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDocument_disputeProjectId_key" ON "ProjectDocument"("disputeProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDocument_fileKey_key" ON "ProjectDocument"("fileKey");

-- CreateIndex
CREATE INDEX "ProjectDocument_projectId_idx" ON "ProjectDocument"("projectId");

-- CreateIndex
CREATE INDEX "ProjectDocument_milestoneId_idx" ON "ProjectDocument"("milestoneId");

-- CreateIndex
CREATE INDEX "ProjectDocument_type_idx" ON "ProjectDocument"("type");

-- CreateIndex
CREATE INDEX "ProjectImage_projectId_idx" ON "ProjectImage"("projectId");

-- CreateIndex
CREATE INDEX "ProjectImage_milestoneId_idx" ON "ProjectImage"("milestoneId");

-- CreateIndex
CREATE INDEX "ProjectImage_category_idx" ON "ProjectImage"("category");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowTransaction_milestoneId_key" ON "EscrowTransaction"("milestoneId");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowTransaction_fundingRef_key" ON "EscrowTransaction"("fundingRef");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowTransaction_releaseRef_key" ON "EscrowTransaction"("releaseRef");

-- CreateIndex
CREATE INDEX "EscrowTransaction_projectId_status_idx" ON "EscrowTransaction"("projectId", "status");

-- CreateIndex
CREATE INDEX "EscrowTransaction_status_createdAt_idx" ON "EscrowTransaction"("status", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_escrowId_accountType_idx" ON "LedgerEntry"("escrowId", "accountType");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_checksum_key" ON "Asset"("checksum");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_key_key" ON "Asset"("key");

-- CreateIndex
CREATE INDEX "Asset_uploaderId_idx" ON "Asset"("uploaderId");

-- CreateIndex
CREATE INDEX "Asset_checksum_idx" ON "Asset"("checksum");

-- CreateIndex
CREATE INDEX "Asset_createdAt_idx" ON "Asset"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_slug_key" ON "Portfolio"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_linkedProjectId_key" ON "Portfolio"("linkedProjectId");

-- CreateIndex
CREATE INDEX "Portfolio_professionalId_idx" ON "Portfolio"("professionalId");

-- CreateIndex
CREATE INDEX "Portfolio_projectType_idx" ON "Portfolio"("projectType");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioImage_fileKey_key" ON "PortfolioImage"("fileKey");

-- CreateIndex
CREATE INDEX "PortfolioImage_portfolioId_idx" ON "PortfolioImage"("portfolioId");

-- CreateIndex
CREATE INDEX "PortfolioImage_category_idx" ON "PortfolioImage"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Store_slug_key" ON "Store"("slug");

-- CreateIndex
CREATE INDEX "Store_professionalId_idx" ON "Store"("professionalId");

-- CreateIndex
CREATE INDEX "Store_verified_idx" ON "Store"("verified");

-- CreateIndex
CREATE INDEX "Store_storeType_idx" ON "Store"("storeType");

-- CreateIndex
CREATE INDEX "Store_county_idx" ON "Store"("county");

-- CreateIndex
CREATE UNIQUE INDEX "StoreDocument_fileKey_key" ON "StoreDocument"("fileKey");

-- CreateIndex
CREATE INDEX "StoreDocument_storeId_idx" ON "StoreDocument"("storeId");

-- CreateIndex
CREATE INDEX "StoreDocument_status_idx" ON "StoreDocument"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StoreImage_fileKey_key" ON "StoreImage"("fileKey");

-- CreateIndex
CREATE INDEX "StoreImage_storeId_idx" ON "StoreImage"("storeId");

-- CreateIndex
CREATE INDEX "Product_storeId_category_idx" ON "Product"("storeId", "category");

-- CreateIndex
CREATE INDEX "Product_isActive_isFeatured_idx" ON "Product"("isActive", "isFeatured");

-- CreateIndex
CREATE INDEX "Product_name_description_idx" ON "Product"("name", "description");

-- CreateIndex
CREATE UNIQUE INDEX "Product_storeId_slug_key" ON "Product"("storeId", "slug");

-- CreateIndex
CREATE INDEX "Order_clientId_status_createdAt_idx" ON "Order"("clientId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_storeId_status_idx" ON "Order"("storeId", "status");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transactionId_key" ON "Payment"("transactionId");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_transactionId_idx" ON "Payment"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Property_slug_key" ON "Property"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Property_titleDeedNumber_key" ON "Property"("titleDeedNumber");

-- CreateIndex
CREATE INDEX "Property_title_description_idx" ON "Property"("title", "description");

-- CreateIndex
CREATE INDEX "Property_agentId_status_idx" ON "Property"("agentId", "status");

-- CreateIndex
CREATE INDEX "Property_county_status_price_idx" ON "Property"("county", "status", "price");

-- CreateIndex
CREATE INDEX "Property_featured_createdAt_idx" ON "Property"("featured", "createdAt");

-- CreateIndex
CREATE INDEX "Property_type_category_county_status_idx" ON "Property"("type", "category", "county", "status");

-- CreateIndex
CREATE INDEX "Property_category_status_featured_idx" ON "Property"("category", "status", "featured");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyDocument_fileKey_key" ON "PropertyDocument"("fileKey");

-- CreateIndex
CREATE INDEX "PropertyDocument_propertyId_idx" ON "PropertyDocument"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyDocument_status_idx" ON "PropertyDocument"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyImage_fileKey_key" ON "PropertyImage"("fileKey");

-- CreateIndex
CREATE INDEX "PropertyImage_propertyId_idx" ON "PropertyImage"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyImage_category_idx" ON "PropertyImage"("category");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyAttachment_fileKey_key" ON "PropertyAttachment"("fileKey");

-- CreateIndex
CREATE INDEX "PropertyAttachment_propertyId_idx" ON "PropertyAttachment"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyInquiry_propertyId_idx" ON "PropertyInquiry"("propertyId");

-- CreateIndex
CREATE INDEX "Quote_projectId_idx" ON "Quote"("projectId");

-- CreateIndex
CREATE INDEX "Quote_status_idx" ON "Quote"("status");

-- CreateIndex
CREATE INDEX "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteAttachment_fileKey_key" ON "QuoteAttachment"("fileKey");

-- CreateIndex
CREATE INDEX "QuoteAttachment_quoteId_idx" ON "QuoteAttachment"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalTransaction_referenceCode_key" ON "ProfessionalTransaction"("referenceCode");

-- CreateIndex
CREATE INDEX "ProfessionalTransaction_professionalId_idx" ON "ProfessionalTransaction"("professionalId");

-- CreateIndex
CREATE INDEX "ProfessionalTransaction_referenceCode_idx" ON "ProfessionalTransaction"("referenceCode");

-- CreateIndex
CREATE INDEX "Lead_professionalId_idx" ON "Lead"("professionalId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_county_idx" ON "Lead"("county");

-- CreateIndex
CREATE INDEX "Lead_professionalId_status_priority_idx" ON "Lead"("professionalId", "status", "priority");

-- CreateIndex
CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_externalEventId_key" ON "CalendarEvent"("externalEventId");

-- CreateIndex
CREATE INDEX "CalendarEvent_professionalId_idx" ON "CalendarEvent"("professionalId");

-- CreateIndex
CREATE INDEX "CalendarEvent_startDate_idx" ON "CalendarEvent"("startDate");

-- CreateIndex
CREATE INDEX "MessageThread_lastMessageAt_idx" ON "MessageThread"("lastMessageAt");

-- CreateIndex
CREATE INDEX "ThreadParticipant_userId_unreadCount_idx" ON "ThreadParticipant"("userId", "unreadCount");

-- CreateIndex
CREATE UNIQUE INDEX "ThreadParticipant_threadId_userId_key" ON "ThreadParticipant"("threadId", "userId");

-- CreateIndex
CREATE INDEX "Message_threadId_createdAt_idx" ON "Message"("threadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReaction_messageId_userId_emoji_key" ON "MessageReaction"("messageId", "userId", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "ReadReceipt_messageId_userId_key" ON "ReadReceipt"("messageId", "userId");

-- CreateIndex
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Review_status_idx" ON "Review"("status");

-- CreateIndex
CREATE INDEX "Review_professionalId_idx" ON "Review"("professionalId");

-- CreateIndex
CREATE INDEX "Review_storeId_idx" ON "Review"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewImage_fileKey_key" ON "ReviewImage"("fileKey");

-- CreateIndex
CREATE INDEX "ReviewImage_reviewId_idx" ON "ReviewImage"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "IdeaBook_slug_key" ON "IdeaBook"("slug");

-- CreateIndex
CREATE INDEX "IdeaBook_clientId_idx" ON "IdeaBook"("clientId");

-- CreateIndex
CREATE INDEX "IdeaBook_category_idx" ON "IdeaBook"("category");

-- CreateIndex
CREATE UNIQUE INDEX "IdeaBookCollaborator_ideaBookId_userId_key" ON "IdeaBookCollaborator"("ideaBookId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedProduct_ideaBookId_productId_key" ON "SavedProduct"("ideaBookId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedProject_ideaBookId_projectId_key" ON "SavedProject"("ideaBookId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedImage_ideaBookId_portfolioImageId_key" ON "SavedImage"("ideaBookId", "portfolioImageId");

-- CreateIndex
CREATE UNIQUE INDEX "IdeaBookAttachment_fileKey_key" ON "IdeaBookAttachment"("fileKey");

-- CreateIndex
CREATE INDEX "IdeaBookAttachment_ideaBookId_idx" ON "IdeaBookAttachment"("ideaBookId");

-- CreateIndex
CREATE INDEX "UserAnalytics_userId_startDate_idx" ON "UserAnalytics"("userId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "UserAnalytics_userId_entityType_entityId_period_startDate_key" ON "UserAnalytics"("userId", "entityType", "entityId", "period", "startDate");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_ownerId_createdAt_idx" ON "AnalyticsEvent"("ownerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MpesaTransaction_merchantRequestId_key" ON "MpesaTransaction"("merchantRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "MpesaTransaction_checkoutRequestId_key" ON "MpesaTransaction"("checkoutRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "MpesaTransaction_idempotencyKey_key" ON "MpesaTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MpesaTransaction_userId_status_idx" ON "MpesaTransaction"("userId", "status");

-- CreateIndex
CREATE INDEX "MpesaTransaction_checkoutRequestId_idx" ON "MpesaTransaction"("checkoutRequestId");

-- CreateIndex
CREATE INDEX "MpesaTransaction_mpesaReceiptNumber_idx" ON "MpesaTransaction"("mpesaReceiptNumber");

-- CreateIndex
CREATE INDEX "MpesaTransaction_status_createdAt_idx" ON "MpesaTransaction"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MpesaTransaction_nextRetryAt_idx" ON "MpesaTransaction"("nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "MpesaB2C_conversationId_key" ON "MpesaB2C"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "MpesaB2C_transactionId_key" ON "MpesaB2C"("transactionId");

-- CreateIndex
CREATE INDEX "_ProductImages_B_index" ON "_ProductImages"("B");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalProfile" ADD CONSTRAINT "ProfessionalProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalLicense" ADD CONSTRAINT "ProfessionalLicense_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalLicense" ADD CONSTRAINT "ProfessionalLicense_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalLicense" ADD CONSTRAINT "ProfessionalLicense_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalDocument" ADD CONSTRAINT "ProfessionalDocument_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalDocument" ADD CONSTRAINT "ProfessionalDocument_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalDocument" ADD CONSTRAINT "ProfessionalDocument_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalService" ADD CONSTRAINT "ProfessionalService_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalService" ADD CONSTRAINT "ProfessionalService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "EscrowTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_contractProjectId_fkey" FOREIGN KEY ("contractProjectId") REFERENCES "Project"("contractDocumentId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_disputeProjectId_fkey" FOREIGN KEY ("disputeProjectId") REFERENCES "Project"("disputeDocumentId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ProjectMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectImage" ADD CONSTRAINT "ProjectImage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectImage" ADD CONSTRAINT "ProjectImage_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ProjectMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectImage" ADD CONSTRAINT "ProjectImage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectImage" ADD CONSTRAINT "ProjectImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowTransaction" ADD CONSTRAINT "EscrowTransaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "EscrowTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioImage" ADD CONSTRAINT "PortfolioImage_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioImage" ADD CONSTRAINT "PortfolioImage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioImage" ADD CONSTRAINT "PortfolioImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreDocument" ADD CONSTRAINT "StoreDocument_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreDocument" ADD CONSTRAINT "StoreDocument_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreDocument" ADD CONSTRAINT "StoreDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreImage" ADD CONSTRAINT "StoreImage_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreImage" ADD CONSTRAINT "StoreImage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreImage" ADD CONSTRAINT "StoreImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ProfessionalProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyImage" ADD CONSTRAINT "PropertyImage_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyImage" ADD CONSTRAINT "PropertyImage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyImage" ADD CONSTRAINT "PropertyImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAttachment" ADD CONSTRAINT "PropertyAttachment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAttachment" ADD CONSTRAINT "PropertyAttachment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAttachment" ADD CONSTRAINT "PropertyAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyInquiry" ADD CONSTRAINT "PropertyInquiry_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyInquiry" ADD CONSTRAINT "PropertyInquiry_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAttachment" ADD CONSTRAINT "QuoteAttachment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAttachment" ADD CONSTRAINT "QuoteAttachment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalTransaction" ADD CONSTRAINT "ProfessionalTransaction_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalTransaction" ADD CONSTRAINT "ProfessionalTransaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadParticipant" ADD CONSTRAINT "ThreadParticipant_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadReceipt" ADD CONSTRAINT "ReadReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewImage" ADD CONSTRAINT "ReviewImage_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewImage" ADD CONSTRAINT "ReviewImage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaBook" ADD CONSTRAINT "IdeaBook_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaBookCollaborator" ADD CONSTRAINT "IdeaBookCollaborator_ideaBookId_fkey" FOREIGN KEY ("ideaBookId") REFERENCES "IdeaBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaBookCollaborator" ADD CONSTRAINT "IdeaBookCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedProduct" ADD CONSTRAINT "SavedProduct_ideaBookId_fkey" FOREIGN KEY ("ideaBookId") REFERENCES "IdeaBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedProduct" ADD CONSTRAINT "SavedProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedProject" ADD CONSTRAINT "SavedProject_ideaBookId_fkey" FOREIGN KEY ("ideaBookId") REFERENCES "IdeaBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedProject" ADD CONSTRAINT "SavedProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedImage" ADD CONSTRAINT "SavedImage_ideaBookId_fkey" FOREIGN KEY ("ideaBookId") REFERENCES "IdeaBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedImage" ADD CONSTRAINT "SavedImage_portfolioImageId_fkey" FOREIGN KEY ("portfolioImageId") REFERENCES "PortfolioImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaBookAttachment" ADD CONSTRAINT "IdeaBookAttachment_ideaBookId_fkey" FOREIGN KEY ("ideaBookId") REFERENCES "IdeaBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaBookAttachment" ADD CONSTRAINT "IdeaBookAttachment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaBookAttachment" ADD CONSTRAINT "IdeaBookAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAnalytics" ADD CONSTRAINT "UserAnalytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductImages" ADD CONSTRAINT "_ProductImages_A_fkey" FOREIGN KEY ("A") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductImages" ADD CONSTRAINT "_ProductImages_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
