-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "publicSignup" BOOLEAN NOT NULL DEFAULT true,
    "autoVerifyNCA" BOOLEAN NOT NULL DEFAULT false,
    "commissionRate" DECIMAL(5,2) NOT NULL DEFAULT 10.0,
    "supportEmail" TEXT NOT NULL DEFAULT 'support@buildmarket.co.ke',
    "adminEmailAlerts" BOOLEAN NOT NULL DEFAULT true,
    "securityMFA" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);
