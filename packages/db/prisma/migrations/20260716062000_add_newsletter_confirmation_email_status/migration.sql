-- AlterTable
ALTER TABLE "newsletter_subscribers" ADD COLUMN "confirmationEmailStatus" TEXT DEFAULT 'PENDING';
ALTER TABLE "newsletter_subscribers" ADD COLUMN "confirmationEmailLastError" TEXT;
