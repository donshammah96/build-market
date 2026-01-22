/*
  Warnings:

  - The values [pending,verified,rejected] on the enum `CertificateVerificationStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [text,image,file,pdf,system] on the enum `MessageType` will be removed. If these variants are still used in the database, this will fail.
  - The values [pending,paid,shipped,delivered,cancelled] on the enum `OrderStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [success,failed,refunded,pending] on the enum `PaymentStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [LANDSCAPER] on the enum `Profession` will be removed. If these variants are still used in the database, this will fail.
  - The values [planning,in_progress,completed,archived] on the enum `ProjectStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [professional,store] on the enum `ReviewType` will be removed. If these variants are still used in the database, this will fail.
  - The values [hardware,building_materials,tiles_and_ceramics,electrical,plumbing,paints_and_finishes,roofing,timber_and_wood,glass_and_aluminum,kitchen_and_bath,landscaping,steel_and_metals,safety_and_tools,hvac] on the enum `StoreCategory` will be removed. If these variants are still used in the database, this will fail.
  - The values [retail,wholesale,manufacturer,distributor,online_only] on the enum `StoreType` will be removed. If these variants are still used in the database, this will fail.
  - The values [client,professional,admin] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `entityId` on the `AdminAuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `entityType` on the `AdminAuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `Attachment` table. All the data in the column will be lost.
  - The `type` column on the `CalendarEvent` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `CalendarEvent` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `county` column on the `ClientProfile` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `items` on the `IdeaBook` table. All the data in the column will be lost.
  - You are about to drop the column `filename` on the `IdeaBookAttachment` table. All the data in the column will be lost.
  - You are about to drop the column `key` on the `IdeaBookAttachment` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `IdeaBookAttachment` table. All the data in the column will be lost.
  - The `projectType` column on the `Lead` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `budget` column on the `Lead` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `source` column on the `Lead` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `readBy` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `unreadCount` on the `MessageThread` table. All the data in the column will be lost.
  - You are about to drop the column `read` on the `Notification` table. All the data in the column will be lost.
  - The `type` column on the `Notification` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `images` on the `Portfolio` table. All the data in the column will be lost.
  - The `projectType` column on the `Portfolio` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `images` on the `ProfessionalProfile` table. All the data in the column will be lost.
  - You are about to drop the column `servicesOffered` on the `ProfessionalProfile` table. All the data in the column will be lost.
  - The `county` column on the `ProfessionalProfile` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `profession` column on the `ProfessionalProfile` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `completed` on the `ProjectMilestone` table. All the data in the column will be lost.
  - You are about to drop the column `areaSqFt` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `floorPlan` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `lotSize` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `isVerified` on the `PropertyAttachment` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `PropertyDocument` table. All the data in the column will be lost.
  - You are about to drop the column `verified` on the `PropertyDocument` table. All the data in the column will be lost.
  - You are about to drop the column `key` on the `PropertyImage` table. All the data in the column will be lost.
  - You are about to drop the column `amount` on the `Quote` table. All the data in the column will be lost.
  - The `status` column on the `Quote` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `approved` on the `Review` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `StoreDocument` table. All the data in the column will be lost.
  - You are about to drop the column `key` on the `StoreImage` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `StoreImage` table. All the data in the column will be lost.
  - You are about to drop the column `autoVerifyNCA` on the `SystemSettings` table. All the data in the column will be lost.
  - You are about to drop the column `fromDate` on the `UserAnalytics` table. All the data in the column will be lost.
  - You are about to drop the column `metrics` on the `UserAnalytics` table. All the data in the column will be lost.
  - You are about to drop the column `toDate` on the `UserAnalytics` table. All the data in the column will be lost.
  - You are about to drop the `_IdeaBookShares` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_MessageThreadUsers` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[fileKey]` on the table `Attachment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[externalEventId]` on the table `CalendarEvent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[fileKey]` on the table `IdeaBookAttachment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `Portfolio` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[linkedProjectId]` on the table `Portfolio` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[referenceCode]` on the table `ProfessionalTransaction` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[portfolioId]` on the table `Project` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[fileKey]` on the table `PropertyImage` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[fileKey]` on the table `StoreImage` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,entityType,entityId,period,startDate]` on the table `UserAnalytics` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `adminEmail` to the `AdminAuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `adminName` to the `AdminAuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `adminRole` to the `AdminAuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetId` to the `AdminAuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetType` to the `AdminAuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `AdminProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileUrl` to the `Attachment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileKey` to the `IdeaBookAttachment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileUrl` to the `IdeaBookAttachment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Lead` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `Portfolio` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimeType` to the `ProfessionalDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size` to the `ProfessionalDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimeType` to the `PropertyAttachment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size` to the `PropertyAttachment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `PropertyAttachment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PropertyAttachment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `uploadedById` to the `PropertyAttachment` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `PropertyAttachment` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `mimeType` to the `PropertyDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size` to the `PropertyDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `uploadedById` to the `PropertyDocument` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `PropertyDocument` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `fileKey` to the `PropertyImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimeType` to the `PropertyImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size` to the `PropertyImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `uploadedById` to the `PropertyImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Quote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalAmount` to the `Quote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `validUntil` to the `Quote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `categoryId` to the `Service` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileUrl` to the `StoreDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimeType` to the `StoreDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size` to the `StoreDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `uploadedById` to the `StoreDocument` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `StoreDocument` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `fileKey` to the `StoreImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileUrl` to the `StoreImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimeType` to the `StoreImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size` to the `StoreImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `uploadedById` to the `StoreImage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endDate` to the `UserAnalytics` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `UserAnalytics` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `UserAnalytics` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('HOMEOWNER', 'CORPORATE_DEVELOPER', 'INTERIOR_DESIGN_FIRM', 'GOVERNMENT_ENTITY', 'OTHER');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'CONTENT_MODERATOR', 'SUPPORT_AGENT', 'FINANCE_MANAGER', 'SYSTEM_ADMIN');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('SUCCESS', 'FAILURE', 'DENIED');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'BUSY', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'RENOVATION', 'INTERIOR_DESIGN', 'LANDSCAPING', 'INFRASTRUCTURE', 'OTHER');

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
CREATE TYPE "DeliveryOption" AS ENUM ('PICKUP_ONLY', 'DELIVERY_AVAILABLE', 'THIRD_PARTY_LOGISTICS', 'DIGITAL_DELIVERY');

-- CreateEnum
CREATE TYPE "StoreDocumentType" AS ENUM ('BUSINESS_PERMIT', 'KRA_TAX_COMPLIANCE', 'CR12', 'DISTRIBUTOR_LICENSE', 'KEBS_CERTIFICATE');

-- CreateEnum
CREATE TYPE "StoreImageCategory" AS ENUM ('LOGO', 'STOREFRONT', 'INTERIOR', 'WAREHOUSE', 'TEAM');

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
CREATE TYPE "TransactionCategory" AS ENUM ('PROJECT_PAYMENT', 'SUBSCRIPTION_FEE', 'LEAD_PURCHASE', 'VERIFICATION_FEE', 'WITHDRAWAL', 'REFUND', 'PENALTY');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MPESA', 'BANK_TRANSFER', 'CARD', 'WALLET', 'CASH');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'REVISED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED', 'DISPUTED', 'ARCHIVED');

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

-- AlterEnum
BEGIN;
CREATE TYPE "CertificateVerificationStatus_new" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
ALTER TABLE "public"."Certificate" ALTER COLUMN "verificationStatus" DROP DEFAULT;
ALTER TABLE "Certificate" ALTER COLUMN "verificationStatus" TYPE "CertificateVerificationStatus_new" USING ("verificationStatus"::text::"CertificateVerificationStatus_new");
ALTER TYPE "CertificateVerificationStatus" RENAME TO "CertificateVerificationStatus_old";
ALTER TYPE "CertificateVerificationStatus_new" RENAME TO "CertificateVerificationStatus";
DROP TYPE "public"."CertificateVerificationStatus_old";
ALTER TABLE "Certificate" ALTER COLUMN "verificationStatus" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "MessageType_new" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'PDF', 'SYSTEM');
ALTER TABLE "public"."Message" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Message" ALTER COLUMN "type" TYPE "MessageType_new" USING ("type"::text::"MessageType_new");
ALTER TYPE "MessageType" RENAME TO "MessageType_old";
ALTER TYPE "MessageType_new" RENAME TO "MessageType";
DROP TYPE "public"."MessageType_old";
ALTER TABLE "Message" ALTER COLUMN "type" SET DEFAULT 'TEXT';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED');
ALTER TABLE "public"."Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING ("status"::text::"OrderStatus_new");
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "public"."OrderStatus_old";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('SUCCESS', 'FAILED', 'REFUNDED', 'PENDING');
ALTER TABLE "public"."Payment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "status" TYPE "PaymentStatus_new" USING ("status"::text::"PaymentStatus_new");
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "public"."PaymentStatus_old";
ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "Profession_new" AS ENUM ('ARCHITECT', 'INTERIOR_DESIGNER', 'LANDSCAPE_ARCHITECT', 'URBAN_PLANNER', 'STRUCTURAL_ENGINEER', 'CIVIL_ENGINEER', 'MECHANICAL_ENGINEER', 'ELECTRICAL_ENGINEER', 'QUANTITY_SURVEYOR', 'LAND_SURVEYOR', 'REAL_ESTATE_VALUER', 'GENERAL_CONTRACTOR', 'MASON', 'ELECTRICIAN', 'PLUMBER', 'CARPENTER', 'JOINER', 'PAINTER', 'WELDER', 'GLAZIER', 'ROOFER', 'STEEL_FIXER', 'FLOORING_SPECIALIST', 'PLASTERER', 'HVAC_TECHNICIAN', 'SOLAR_ENERGY_TECHNICIAN', 'BOREHOLE_DRILLER', 'CCTV_AND_SECURITY_PRO', 'INTERNET_AND_NETWORK_PRO', 'PROJECT_MANAGER', 'CLERK_OF_WORKS', 'OTHER');
ALTER TABLE "ProfessionalProfile" ALTER COLUMN "profession" TYPE "Profession_new" USING ("profession"::text::"Profession_new");
ALTER TABLE "ServiceCategory" ALTER COLUMN "professionType" TYPE "Profession_new" USING ("professionType"::text::"Profession_new");
ALTER TYPE "Profession" RENAME TO "Profession_old";
ALTER TYPE "Profession_new" RENAME TO "Profession";
DROP TYPE "public"."Profession_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ProjectStatus_new" AS ENUM ('PLANNING', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'ARCHIVED', 'CANCELLED');
ALTER TABLE "public"."Project" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Project" ALTER COLUMN "status" TYPE "ProjectStatus_new" USING ("status"::text::"ProjectStatus_new");
ALTER TYPE "ProjectStatus" RENAME TO "ProjectStatus_old";
ALTER TYPE "ProjectStatus_new" RENAME TO "ProjectStatus";
DROP TYPE "public"."ProjectStatus_old";
ALTER TABLE "Project" ALTER COLUMN "status" SET DEFAULT 'PLANNING';
COMMIT;

-- AlterEnum
ALTER TYPE "PropertyStatus" ADD VALUE 'OFF_MARKET';

-- AlterEnum
BEGIN;
CREATE TYPE "ReviewType_new" AS ENUM ('PROFESSIONAL', 'STORE');
ALTER TABLE "Review" ALTER COLUMN "type" TYPE "ReviewType_new" USING ("type"::text::"ReviewType_new");
ALTER TYPE "ReviewType" RENAME TO "ReviewType_old";
ALTER TYPE "ReviewType_new" RENAME TO "ReviewType";
DROP TYPE "public"."ReviewType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "StoreCategory_new" AS ENUM ('HARDWARE', 'BUILDING_MATERIALS', 'TILES_AND_CERAMICS', 'ELECTRICAL', 'PLUMBING', 'PAINTS_AND_FINISHES', 'ROOFING', 'TIMBER_AND_WOOD', 'GLASS_AND_ALUMINUM', 'KITCHEN_AND_BATH', 'LANDSCAPING', 'STEEL_AND_METALS', 'SAFETY_AND_TOOLS', 'HVAC', 'SOLAR_AND_ENERGY', 'WATER_STORAGE', 'SECURITY_SYSTEMS', 'DECOR_AND_LIGHTING', 'HEAVY_MACHINERY', 'WINDOWS_AND_DOORS', 'AUTOMOTIVE');
ALTER TABLE "Store" ALTER COLUMN "categories" TYPE "StoreCategory_new"[] USING ("categories"::text::"StoreCategory_new"[]);
ALTER TYPE "StoreCategory" RENAME TO "StoreCategory_old";
ALTER TYPE "StoreCategory_new" RENAME TO "StoreCategory";
DROP TYPE "public"."StoreCategory_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "StoreType_new" AS ENUM ('RETAIL', 'WHOLESALE', 'MANUFACTURER', 'DISTRIBUTOR', 'ONLINE_ONLY');
ALTER TABLE "public"."Store" ALTER COLUMN "storeType" DROP DEFAULT;
ALTER TABLE "Store" ALTER COLUMN "storeType" TYPE "StoreType_new" USING ("storeType"::text::"StoreType_new");
ALTER TYPE "StoreType" RENAME TO "StoreType_old";
ALTER TYPE "StoreType_new" RENAME TO "StoreType";
DROP TYPE "public"."StoreType_old";
ALTER TABLE "Store" ALTER COLUMN "storeType" SET DEFAULT 'RETAIL';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('CLIENT', 'PROFESSIONAL', 'ADMIN');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CLIENT';
COMMIT;

-- DropForeignKey
ALTER TABLE "AdminAuditLog" DROP CONSTRAINT "AdminAuditLog_adminId_fkey";

-- DropForeignKey
ALTER TABLE "AdminProfile" DROP CONSTRAINT "AdminProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_clientId_fkey";

-- DropForeignKey
ALTER TABLE "Property" DROP CONSTRAINT "Property_agentId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_projectId_fkey";

-- DropForeignKey
ALTER TABLE "_IdeaBookShares" DROP CONSTRAINT "_IdeaBookShares_A_fkey";

-- DropForeignKey
ALTER TABLE "_IdeaBookShares" DROP CONSTRAINT "_IdeaBookShares_B_fkey";

-- DropForeignKey
ALTER TABLE "_MessageThreadUsers" DROP CONSTRAINT "_MessageThreadUsers_A_fkey";

-- DropForeignKey
ALTER TABLE "_MessageThreadUsers" DROP CONSTRAINT "_MessageThreadUsers_B_fkey";

-- DropIndex
DROP INDEX "AdminAuditLog_createdAt_idx";

-- DropIndex
DROP INDEX "AdminAuditLog_entityType_idx";

-- DropIndex
DROP INDEX "Certificate_createdAt_idx";

-- DropIndex
DROP INDEX "Certificate_updatedAt_idx";

-- DropIndex
DROP INDEX "Certificate_verificationStatus_idx";

-- DropIndex
DROP INDEX "Certificate_verifiedById_idx";

-- DropIndex
DROP INDEX "IdeaBook_createdAt_idx";

-- DropIndex
DROP INDEX "IdeaBookAttachment_createdAt_idx";

-- DropIndex
DROP INDEX "IdeaBookAttachment_key_key";

-- DropIndex
DROP INDEX "Message_createdAt_idx";

-- DropIndex
DROP INDEX "Message_senderId_idx";

-- DropIndex
DROP INDEX "Notification_createdAt_idx";

-- DropIndex
DROP INDEX "Notification_read_idx";

-- DropIndex
DROP INDEX "Notification_userId_idx";

-- DropIndex
DROP INDEX "Payment_status_idx";

-- DropIndex
DROP INDEX "ProfessionalProfile_city_idx";

-- DropIndex
DROP INDEX "ProfessionalProfile_companyName_idx";

-- DropIndex
DROP INDEX "ProfessionalTransaction_date_idx";

-- DropIndex
DROP INDEX "ProfessionalTransaction_projectId_idx";

-- DropIndex
DROP INDEX "Project_createdAt_idx";

-- DropIndex
DROP INDEX "Property_agentId_idx";

-- DropIndex
DROP INDEX "Property_verified_idx";

-- DropIndex
DROP INDEX "PropertyImage_key_key";

-- DropIndex
DROP INDEX "PropertyInquiry_senderId_idx";

-- DropIndex
DROP INDEX "Quote_clientId_idx";

-- DropIndex
DROP INDEX "Quote_professionalId_idx";

-- DropIndex
DROP INDEX "Review_approved_idx";

-- DropIndex
DROP INDEX "Review_projectId_idx";

-- DropIndex
DROP INDEX "Review_rating_idx";

-- DropIndex
DROP INDEX "Review_type_idx";

-- DropIndex
DROP INDEX "StoreImage_key_key";

-- AlterTable
ALTER TABLE "AdminAuditLog" DROP COLUMN "entityId",
DROP COLUMN "entityType",
ADD COLUMN     "adminEmail" TEXT NOT NULL,
ADD COLUMN     "adminName" TEXT NOT NULL,
ADD COLUMN     "adminRole" TEXT NOT NULL,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "requestId" TEXT,
ADD COLUMN     "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO',
ADD COLUMN     "status" "AuditStatus" NOT NULL DEFAULT 'SUCCESS',
ADD COLUMN     "targetId" TEXT NOT NULL,
ADD COLUMN     "targetType" TEXT NOT NULL,
ALTER COLUMN "adminId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "AdminProfile" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastActiveAt" TIMESTAMP(3),
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "role" "AdminRole" NOT NULL DEFAULT 'SUPPORT_AGENT',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Attachment" DROP COLUMN "url",
ADD COLUMN     "fileKey" TEXT,
ADD COLUMN     "fileUrl" TEXT NOT NULL,
ALTER COLUMN "size" DROP NOT NULL,
ALTER COLUMN "mimeType" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "color" TEXT,
ADD COLUMN     "externalEventId" TEXT,
ADD COLUMN     "guestEmails" TEXT[],
ADD COLUMN     "isAllDay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "meetingUrl" TEXT,
ADD COLUMN     "recurrenceRule" TEXT,
ADD COLUMN     "reminders" INTEGER[] DEFAULT ARRAY[30]::INTEGER[],
ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'Africa/Nairobi',
DROP COLUMN "type",
ADD COLUMN     "type" "CalendarEventType" NOT NULL DEFAULT 'MEETING',
DROP COLUMN "status",
ADD COLUMN     "status" "CalendarEventStatus" NOT NULL DEFAULT 'SCHEDULED';

-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "size" INTEGER,
ALTER COLUMN "verificationStatus" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "ClientProfile" ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "interests" TEXT[],
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kraPin" TEXT,
ADD COLUMN     "landmark" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "membershipTier" TEXT NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "neighborhood" TEXT,
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "type" "ClientType" NOT NULL DEFAULT 'HOMEOWNER',
ADD COLUMN     "typicalBudget" DECIMAL(12,2),
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "website" TEXT,
DROP COLUMN "county",
ADD COLUMN     "county" "County";

-- AlterTable
ALTER TABLE "IdeaBook" DROP COLUMN "items",
ADD COLUMN     "category" "IdeaBookCategory" NOT NULL DEFAULT 'WHOLE_HOUSE',
ADD COLUMN     "likes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "privacy" "IdeaBookPrivacy" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "IdeaBookAttachment" DROP COLUMN "filename",
DROP COLUMN "key",
DROP COLUMN "url",
ADD COLUMN     "blurDataUrl" TEXT,
ADD COLUMN     "fileKey" TEXT NOT NULL,
ADD COLUMN     "fileUrl" TEXT NOT NULL,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "uploadedById" TEXT,
ADD COLUMN     "width" INTEGER;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "budgetMax" DECIMAL(12,2),
ADD COLUMN     "budgetMin" DECIMAL(12,2),
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "county" "County",
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'KES',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "lastContactedAt" TIMESTAMP(3),
ADD COLUMN     "lostReason" "LostReason",
ADD COLUMN     "priority" "LeadPriority" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "reminderSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "wonAt" TIMESTAMP(3),
DROP COLUMN "projectType",
ADD COLUMN     "projectType" "ProjectType" NOT NULL DEFAULT 'RESIDENTIAL',
DROP COLUMN "budget",
ADD COLUMN     "budget" DECIMAL(12,2),
DROP COLUMN "source",
ADD COLUMN     "source" "LeadSource" NOT NULL DEFAULT 'PLATFORM_SEARCH';

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "readBy",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "replyToId" TEXT,
ALTER COLUMN "type" SET DEFAULT 'TEXT';

-- AlterTable
ALTER TABLE "MessageThread" DROP COLUMN "unreadCount",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "type" "ThreadType" NOT NULL DEFAULT 'DIRECT';

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "read",
ADD COLUMN     "channels" "NotificationChannel"[] DEFAULT ARRAY['IN_APP']::"NotificationChannel"[],
ADD COLUMN     "deliveryStatus" "NotificationDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
ADD COLUMN     "error" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "priority" "NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "readAt" TIMESTAMP(3),
DROP COLUMN "type",
ADD COLUMN     "type" "NotificationType" NOT NULL DEFAULT 'INFO';

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "snapshotImageUrl" TEXT,
ALTER COLUMN "price" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Portfolio" DROP COLUMN "images",
ADD COLUMN     "budget" DECIMAL(12,2),
ADD COLUMN     "clientName" TEXT,
ADD COLUMN     "completionDate" TIMESTAMP(3),
ADD COLUMN     "county" "County",
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'KES',
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "durationUnit" "ProjectDurationUnit" NOT NULL DEFAULT 'WEEKS',
ADD COLUMN     "durationValue" INTEGER,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "linkedProjectId" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "tags" TEXT[],
DROP COLUMN "projectType",
ADD COLUMN     "projectType" "ProjectType" NOT NULL DEFAULT 'RESIDENTIAL';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ALTER COLUMN "price" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "ProfessionalDocument" ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "size" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "ProfessionalProfile" DROP COLUMN "images",
DROP COLUMN "servicesOffered",
ADD COLUMN     "acceptedPayments" TEXT[] DEFAULT ARRAY['MPESA', 'BANK', 'CASH']::TEXT[],
ADD COLUMN     "availability" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "completedProjects" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hourlyRate" DECIMAL(10,2),
ADD COLUMN     "insuranceDetails" JSONB,
ADD COLUMN     "isInsured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kraPin" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "minProjectBudget" DECIMAL(12,2),
ADD COLUMN     "operatingHours" JSONB,
ADD COLUMN     "rating" DECIMAL(3,2) NOT NULL DEFAULT 0.0,
ADD COLUMN     "responseRate" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "reviewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "serviceRadiusKm" INTEGER DEFAULT 20,
ADD COLUMN     "socials" JSONB,
ADD COLUMN     "specializations" TEXT[],
ADD COLUMN     "verifiedById" TEXT,
DROP COLUMN "county",
ADD COLUMN     "county" "County",
ALTER COLUMN "country" SET DEFAULT 'Kenya',
DROP COLUMN "profession",
ADD COLUMN     "profession" "Profession";

-- AlterTable
ALTER TABLE "ProfessionalTransaction" ADD COLUMN     "category" "TransactionCategory" NOT NULL DEFAULT 'PROJECT_PAYMENT',
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'KES',
ADD COLUMN     "failedReason" TEXT,
ADD COLUMN     "leadId" TEXT,
ADD COLUMN     "method" "PaymentMethod" NOT NULL DEFAULT 'MPESA',
ADD COLUMN     "netAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "platformFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "providerMetadata" JSONB,
ADD COLUMN     "referenceCode" TEXT,
ADD COLUMN     "subscriptionId" TEXT,
ADD COLUMN     "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "actualCompletionDate" TIMESTAMP(3),
ADD COLUMN     "contractType" "ContractType" NOT NULL DEFAULT 'FULL_CONTRACT',
ADD COLUMN     "coordinates" JSONB,
ADD COLUMN     "county" "County",
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'KES',
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDisputed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "portfolioId" TEXT,
ADD COLUMN     "retentionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "retentionPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "retentionReleaseDate" TIMESTAMP(3),
ADD COLUMN     "siteAddress" TEXT,
ADD COLUMN     "totalInvoiced" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "type" "ProjectType" NOT NULL DEFAULT 'RESIDENTIAL',
ALTER COLUMN "status" SET DEFAULT 'PLANNING',
ALTER COLUMN "budget" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "ProjectMilestone" DROP COLUMN "completed",
ADD COLUMN     "amount" DECIMAL(12,2),
ADD COLUMN     "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "fundsInEscrow" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Property" DROP COLUMN "areaSqFt",
DROP COLUMN "floorPlan",
DROP COLUMN "lotSize",
ADD COLUMN     "areaUnit" "AreaUnit" NOT NULL DEFAULT 'SQ_METERS',
ADD COLUMN     "buildingSize" DOUBLE PRECISION,
ADD COLUMN     "completionStatus" "CompletionStatus" NOT NULL DEFAULT 'READY_TO_MOVE',
ADD COLUMN     "depositRequired" TEXT,
ADD COLUMN     "floorPlanUrl" TEXT,
ADD COLUMN     "furnishing" "FurnishingStatus" NOT NULL DEFAULT 'UNFURNISHED',
ADD COLUMN     "hasBackupGenerator" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasBorehole" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasCCTV" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasElevator" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inquiryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isGatedCommunity" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leaseYearsRemaining" INTEGER,
ADD COLUMN     "nearbyLandmarks" JSONB,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "plotSize" DOUBLE PRECISION,
ADD COLUMN     "priceNegotiable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serviceCharge" DECIMAL(10,2) DEFAULT 0,
ADD COLUMN     "tenure" "PropertyTenure" DEFAULT 'FREEHOLD',
ADD COLUMN     "titleDeedReady" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "virtualTourUrl" TEXT;

-- AlterTable
ALTER TABLE "PropertyAttachment" DROP COLUMN "isVerified",
ADD COLUMN     "downloadCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "size" INTEGER NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "uploadedById" TEXT NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" "AttachmentType" NOT NULL;

-- AlterTable
ALTER TABLE "PropertyDocument" DROP COLUMN "notes",
DROP COLUMN "verified",
ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "issueDate" TIMESTAMP(3),
ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "size" INTEGER NOT NULL,
ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "uploadedById" TEXT NOT NULL,
ADD COLUMN     "verifiedById" TEXT,
DROP COLUMN "type",
ADD COLUMN     "type" "PropertyDocumentType" NOT NULL;

-- AlterTable
ALTER TABLE "PropertyImage" DROP COLUMN "key",
ADD COLUMN     "blurDataUrl" TEXT,
ADD COLUMN     "category" "ImageCategory" NOT NULL DEFAULT 'EXTERIOR',
ADD COLUMN     "fileKey" TEXT NOT NULL,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "size" INTEGER NOT NULL,
ADD COLUMN     "tags" TEXT[],
ADD COLUMN     "uploadedById" TEXT NOT NULL,
ADD COLUMN     "width" INTEGER;

-- AlterTable
ALTER TABLE "Quote" DROP COLUMN "amount",
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'KES',
ADD COLUMN     "estimatedDuration" INTEGER,
ADD COLUMN     "isLatest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "laborTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "logisticsTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "materialsTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "previousQuoteId" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "totalAmount" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "validUntil" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "viewedAt" TIMESTAMP(3),
DROP COLUMN "status",
ADD COLUMN     "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "approved",
ADD COLUMN     "helpfulCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "productId" TEXT,
ADD COLUMN     "replyAt" TIMESTAMP(3),
ADD COLUMN     "replyComment" TEXT,
ADD COLUMN     "reportedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "subRatings" JSONB,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "avgPriceMax" DECIMAL(10,2),
ADD COLUMN     "avgPriceMin" DECIMAL(10,2),
ADD COLUMN     "categoryId" TEXT NOT NULL,
ADD COLUMN     "defaultUnit" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "popularityScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "searchKeywords" TEXT[];

-- AlterTable
ALTER TABLE "ServiceCategory" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "keywords" TEXT[],
ADD COLUMN     "metaDescription" TEXT,
ADD COLUMN     "metaTitle" TEXT;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "acceptsCard" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "acceptsCash" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bannerUrl" TEXT,
ADD COLUMN     "baseDeliveryFee" DECIMAL(10,2) DEFAULT 0,
ADD COLUMN     "businessRegNo" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "coordinates" JSONB,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deliveryOption" "DeliveryOption" NOT NULL DEFAULT 'PICKUP_ONLY',
ADD COLUMN     "deliveryRadiusKm" INTEGER,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "isOpen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "kraPin" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "minOrderValue" DECIMAL(10,2) DEFAULT 0,
ADD COLUMN     "mpesaPaybill" TEXT,
ADD COLUMN     "mpesaTillNumber" TEXT,
ADD COLUMN     "neighborhood" TEXT,
ADD COLUMN     "operatingHours" JSONB,
ADD COLUMN     "rating" DECIMAL(3,2) NOT NULL DEFAULT 0.0,
ADD COLUMN     "reviewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "website" TEXT,
ADD COLUMN     "whatsappNumber" TEXT,
ALTER COLUMN "storeType" SET DEFAULT 'RETAIL';

-- AlterTable
ALTER TABLE "StoreDocument" DROP COLUMN "url",
ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "fileUrl" TEXT NOT NULL,
ADD COLUMN     "issueDate" TIMESTAMP(3),
ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "size" INTEGER NOT NULL,
ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "uploadedById" TEXT NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" "StoreDocumentType" NOT NULL;

-- AlterTable
ALTER TABLE "StoreImage" DROP COLUMN "key",
DROP COLUMN "url",
ADD COLUMN     "blurDataUrl" TEXT,
ADD COLUMN     "category" "StoreImageCategory" NOT NULL DEFAULT 'INTERIOR',
ADD COLUMN     "fileKey" TEXT NOT NULL,
ADD COLUMN     "fileUrl" TEXT NOT NULL,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "size" INTEGER NOT NULL,
ADD COLUMN     "uploadedById" TEXT NOT NULL,
ADD COLUMN     "width" INTEGER;

-- AlterTable
ALTER TABLE "SystemSettings" DROP COLUMN "autoVerifyNCA",
ADD COLUMN     "allowProfessionalSignup" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowedFileTypes" TEXT[] DEFAULT ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::TEXT[],
ADD COLUMN     "allowedIPs" TEXT[],
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'KES',
ADD COLUMN     "emailVerificationRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "enableAutoVerifyBORAQS" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enableAutoVerifyERC" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enableAutoVerifyNCA" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enableLandRegistryCheck" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enforceProfessionalLicenses" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "enforcePropertyDocuments" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "enforceStorePermits" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "enforceStrictVerification" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "featureFlags" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "maintenanceMessage" TEXT,
ADD COLUMN     "maxUploadSizeMB" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "minAppVersion" TEXT NOT NULL DEFAULT '1.0.0',
ADD COLUMN     "minWithdrawalAmount" DECIMAL(12,2) NOT NULL DEFAULT 1000.00,
ADD COLUMN     "privacyPolicyVersion" TEXT NOT NULL DEFAULT '1.0',
ADD COLUMN     "requireTaxCompliance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sessionTimeoutMins" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "supportPhone" TEXT,
ADD COLUMN     "termsVersion" TEXT NOT NULL DEFAULT '1.0',
ADD COLUMN     "vatPercentage" DECIMAL(5,2) NOT NULL DEFAULT 16.00,
ADD COLUMN     "verificationRules" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "whatsappNumber" TEXT,
ADD COLUMN     "withholdingTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 5.00;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastActiveAt" TIMESTAMP(3),
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT,
ALTER COLUMN "role" SET DEFAULT 'CLIENT';

-- AlterTable
ALTER TABLE "UserAnalytics" DROP COLUMN "fromDate",
DROP COLUMN "metrics",
DROP COLUMN "toDate",
ADD COLUMN     "clicks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "endDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entityType" "AnalyticsEntityType" NOT NULL DEFAULT 'PROFILE',
ADD COLUMN     "impressions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "period" "AnalyticsPeriod" NOT NULL DEFAULT 'DAILY',
ADD COLUMN     "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "uniqueViews" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "_IdeaBookShares";

-- DropTable
DROP TABLE "_MessageThreadUsers";

-- CreateTable
CREATE TABLE "ProjectDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ProjectDocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
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
    "fileUrl" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "caption" TEXT,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "blurDataUrl" TEXT,
    "category" "ProjectImageCategory",
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioImage" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "blurDataUrl" TEXT,
    "caption" TEXT,
    "category" "PortfolioImageCategory" NOT NULL DEFAULT 'FINISHED_WORK',
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioImage_pkey" PRIMARY KEY ("id")
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
    "fileKey" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteAttachment_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "ReadReceipt" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewImage" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "blurDataUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewImage_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDocument_fileKey_key" ON "ProjectDocument"("fileKey");

-- CreateIndex
CREATE INDEX "ProjectDocument_projectId_idx" ON "ProjectDocument"("projectId");

-- CreateIndex
CREATE INDEX "ProjectDocument_milestoneId_idx" ON "ProjectDocument"("milestoneId");

-- CreateIndex
CREATE INDEX "ProjectDocument_type_idx" ON "ProjectDocument"("type");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectImage_fileKey_key" ON "ProjectImage"("fileKey");

-- CreateIndex
CREATE INDEX "ProjectImage_projectId_idx" ON "ProjectImage"("projectId");

-- CreateIndex
CREATE INDEX "ProjectImage_milestoneId_idx" ON "ProjectImage"("milestoneId");

-- CreateIndex
CREATE INDEX "ProjectImage_category_idx" ON "ProjectImage"("category");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioImage_fileKey_key" ON "PortfolioImage"("fileKey");

-- CreateIndex
CREATE INDEX "PortfolioImage_portfolioId_idx" ON "PortfolioImage"("portfolioId");

-- CreateIndex
CREATE INDEX "PortfolioImage_category_idx" ON "PortfolioImage"("category");

-- CreateIndex
CREATE INDEX "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteAttachment_fileKey_key" ON "QuoteAttachment"("fileKey");

-- CreateIndex
CREATE INDEX "QuoteAttachment_quoteId_idx" ON "QuoteAttachment"("quoteId");

-- CreateIndex
CREATE INDEX "ThreadParticipant_userId_unreadCount_idx" ON "ThreadParticipant"("userId", "unreadCount");

-- CreateIndex
CREATE UNIQUE INDEX "ThreadParticipant_threadId_userId_key" ON "ThreadParticipant"("threadId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReadReceipt_messageId_userId_key" ON "ReadReceipt"("messageId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewImage_fileKey_key" ON "ReviewImage"("fileKey");

-- CreateIndex
CREATE INDEX "ReviewImage_reviewId_idx" ON "ReviewImage"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "IdeaBookCollaborator_ideaBookId_userId_key" ON "IdeaBookCollaborator"("ideaBookId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedProduct_ideaBookId_productId_key" ON "SavedProduct"("ideaBookId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedProject_ideaBookId_projectId_key" ON "SavedProject"("ideaBookId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedImage_ideaBookId_portfolioImageId_key" ON "SavedImage"("ideaBookId", "portfolioImageId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_ownerId_createdAt_idx" ON "AnalyticsEvent"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_severity_idx" ON "AdminAuditLog"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_fileKey_key" ON "Attachment"("fileKey");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_externalEventId_key" ON "CalendarEvent"("externalEventId");

-- CreateIndex
CREATE INDEX "IdeaBook_category_idx" ON "IdeaBook"("category");

-- CreateIndex
CREATE UNIQUE INDEX "IdeaBookAttachment_fileKey_key" ON "IdeaBookAttachment"("fileKey");

-- CreateIndex
CREATE INDEX "Lead_county_idx" ON "Lead"("county");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_slug_key" ON "Portfolio"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_linkedProjectId_key" ON "Portfolio"("linkedProjectId");

-- CreateIndex
CREATE INDEX "Portfolio_professionalId_idx" ON "Portfolio"("professionalId");

-- CreateIndex
CREATE INDEX "Portfolio_projectType_idx" ON "Portfolio"("projectType");

-- CreateIndex
CREATE INDEX "ProfessionalProfile_profession_idx" ON "ProfessionalProfile"("profession");

-- CreateIndex
CREATE INDEX "ProfessionalProfile_county_idx" ON "ProfessionalProfile"("county");

-- CreateIndex
CREATE INDEX "ProfessionalProfile_rating_idx" ON "ProfessionalProfile"("rating");

-- CreateIndex
CREATE INDEX "ProfessionalProfile_availability_idx" ON "ProfessionalProfile"("availability");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalTransaction_referenceCode_key" ON "ProfessionalTransaction"("referenceCode");

-- CreateIndex
CREATE INDEX "ProfessionalTransaction_referenceCode_idx" ON "ProfessionalTransaction"("referenceCode");

-- CreateIndex
CREATE UNIQUE INDEX "Project_portfolioId_key" ON "Project"("portfolioId");

-- CreateIndex
CREATE INDEX "Project_county_idx" ON "Project"("county");

-- CreateIndex
CREATE INDEX "Property_status_idx" ON "Property"("status");

-- CreateIndex
CREATE INDEX "Property_completionStatus_idx" ON "Property"("completionStatus");

-- CreateIndex
CREATE INDEX "PropertyDocument_status_idx" ON "PropertyDocument"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyImage_fileKey_key" ON "PropertyImage"("fileKey");

-- CreateIndex
CREATE INDEX "PropertyImage_category_idx" ON "PropertyImage"("category");

-- CreateIndex
CREATE INDEX "Quote_status_idx" ON "Quote"("status");

-- CreateIndex
CREATE INDEX "Review_status_idx" ON "Review"("status");

-- CreateIndex
CREATE INDEX "Service_categoryId_idx" ON "Service"("categoryId");

-- CreateIndex
CREATE INDEX "Service_slug_idx" ON "Service"("slug");

-- CreateIndex
CREATE INDEX "StoreDocument_status_idx" ON "StoreDocument"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StoreImage_fileKey_key" ON "StoreImage"("fileKey");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE INDEX "UserAnalytics_userId_startDate_idx" ON "UserAnalytics"("userId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "UserAnalytics_userId_entityType_entityId_period_startDate_key" ON "UserAnalytics"("userId", "entityType", "entityId", "period", "startDate");

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ProjectMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectImage" ADD CONSTRAINT "ProjectImage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectImage" ADD CONSTRAINT "ProjectImage_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ProjectMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectImage" ADD CONSTRAINT "ProjectImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioImage" ADD CONSTRAINT "PortfolioImage_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioImage" ADD CONSTRAINT "PortfolioImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreDocument" ADD CONSTRAINT "StoreDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreImage" ADD CONSTRAINT "StoreImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ProfessionalProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyImage" ADD CONSTRAINT "PropertyImage_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAttachment" ADD CONSTRAINT "PropertyAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAttachment" ADD CONSTRAINT "QuoteAttachment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadParticipant" ADD CONSTRAINT "ThreadParticipant_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadParticipant" ADD CONSTRAINT "ThreadParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadReceipt" ADD CONSTRAINT "ReadReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadReceipt" ADD CONSTRAINT "ReadReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewImage" ADD CONSTRAINT "ReviewImage_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaBookCollaborator" ADD CONSTRAINT "IdeaBookCollaborator_ideaBookId_fkey" FOREIGN KEY ("ideaBookId") REFERENCES "IdeaBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaBookCollaborator" ADD CONSTRAINT "IdeaBookCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "IdeaBookAttachment" ADD CONSTRAINT "IdeaBookAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
