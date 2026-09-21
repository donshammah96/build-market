-- ============================================================================
-- Migration: 20260816050000_partition_high_velocity_logs
-- Purpose: Convert append-only high-write tables (AdminAuditLog, AuditLog, AnalyticsEvent)
--          to PostgreSQL declarative monthly range partitioned tables.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AdminAuditLog
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'AdminAuditLog') THEN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'AdminAuditLog' AND constraint_name = 'AdminAuditLog_pkey') THEN
            ALTER TABLE "AdminAuditLog" RENAME CONSTRAINT "AdminAuditLog_pkey" TO "AdminAuditLog_old_pkey";
        END IF;
        ALTER TABLE "AdminAuditLog" RENAME TO "AdminAuditLog_old";
    END IF;
END $$;

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
    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id", "createdAt")
) PARTITION BY RANGE ("createdAt");

CREATE TABLE "AdminAuditLog_y2026m08" PARTITION OF "AdminAuditLog"
    FOR VALUES FROM ('2026-08-01 00:00:00') TO ('2026-09-01 00:00:00');

CREATE TABLE "AdminAuditLog_y2026m09" PARTITION OF "AdminAuditLog"
    FOR VALUES FROM ('2026-09-01 00:00:00') TO ('2026-10-01 00:00:00');

CREATE TABLE "AdminAuditLog_y2026m10" PARTITION OF "AdminAuditLog"
    FOR VALUES FROM ('2026-10-01 00:00:00') TO ('2026-11-01 00:00:00');

CREATE TABLE "AdminAuditLog_default" PARTITION OF "AdminAuditLog" DEFAULT;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'AdminAuditLog_old') THEN
        INSERT INTO "AdminAuditLog" (
            "id", "adminId", "adminName", "adminEmail", "adminRole",
            "action", "severity", "status", "targetId", "targetType",
            "details", "reason", "ipAddress", "userAgent", "requestId", "createdAt"
        )
        SELECT
            "id", "adminId", "adminName", "adminEmail", "adminRole",
            "action", "severity", "status", "targetId", "targetType",
            "details", "reason", "ipAddress", "userAgent", "requestId", "createdAt"
        FROM "AdminAuditLog_old";
        DROP TABLE "AdminAuditLog_old";
    END IF;
END $$;

CREATE INDEX "AdminAuditLog_adminId_createdAt_idx" ON "AdminAuditLog" ("adminId", "createdAt");
CREATE INDEX "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog" ("action", "createdAt");
CREATE INDEX "AdminAuditLog_targetType_targetId_createdAt_idx" ON "AdminAuditLog" ("targetType", "targetId", "createdAt");
CREATE INDEX "AdminAuditLog_severity_createdAt_idx" ON "AdminAuditLog" ("severity", "createdAt");

-- ----------------------------------------------------------------------------
-- 2. AuditLog
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'AuditLog') THEN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'AuditLog' AND constraint_name = 'AuditLog_pkey') THEN
            ALTER TABLE "AuditLog" RENAME CONSTRAINT "AuditLog_pkey" TO "AuditLog_old_pkey";
        END IF;
        ALTER TABLE "AuditLog" RENAME TO "AuditLog_old";
    END IF;
END $$;

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" "ActorType" NOT NULL,
    "actorEmail" TEXT,
    "actorFirstName" TEXT,
    "actorLastName" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB,
    "metadata" JSONB,
    "legalBasis" "LegalBasis",
    "consentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id", "createdAt")
) PARTITION BY RANGE ("createdAt");

CREATE TABLE "AuditLog_y2026m08" PARTITION OF "AuditLog"
    FOR VALUES FROM ('2026-08-01 00:00:00') TO ('2026-09-01 00:00:00');

CREATE TABLE "AuditLog_y2026m09" PARTITION OF "AuditLog"
    FOR VALUES FROM ('2026-09-01 00:00:00') TO ('2026-10-01 00:00:00');

CREATE TABLE "AuditLog_y2026m10" PARTITION OF "AuditLog"
    FOR VALUES FROM ('2026-10-01 00:00:00') TO ('2026-11-01 00:00:00');

CREATE TABLE "AuditLog_default" PARTITION OF "AuditLog" DEFAULT;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'AuditLog_old') THEN
        INSERT INTO "AuditLog" (
            "id", "actorId", "actorType", "actorEmail", "actorFirstName", "actorLastName",
            "action", "entityType", "entityId", "changes", "metadata", "legalBasis", "consentId", "createdAt"
        )
        SELECT
            "id", "actorId", "actorType", "actorEmail", "actorFirstName", "actorLastName",
            "action", "entityType", "entityId", "changes", "metadata", "legalBasis", "consentId", "createdAt"
        FROM "AuditLog_old";
        DROP TABLE "AuditLog_old";
    END IF;
END $$;

CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog" ("actorId", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog" ("entityType", "entityId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog" ("action", "createdAt");
CREATE INDEX "AuditLog_legalBasis_createdAt_idx" ON "AuditLog" ("legalBasis", "createdAt");

-- ----------------------------------------------------------------------------
-- 3. AnalyticsEvent
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'AnalyticsEvent') THEN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'AnalyticsEvent' AND constraint_name = 'AnalyticsEvent_pkey') THEN
            ALTER TABLE "AnalyticsEvent" RENAME CONSTRAINT "AnalyticsEvent_pkey" TO "AnalyticsEvent_old_pkey";
        END IF;
        ALTER TABLE "AnalyticsEvent" RENAME TO "AnalyticsEvent_old";
    END IF;
END $$;

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
    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id", "createdAt")
) PARTITION BY RANGE ("createdAt");

CREATE TABLE "AnalyticsEvent_y2026m08" PARTITION OF "AnalyticsEvent"
    FOR VALUES FROM ('2026-08-01 00:00:00') TO ('2026-09-01 00:00:00');

CREATE TABLE "AnalyticsEvent_y2026m09" PARTITION OF "AnalyticsEvent"
    FOR VALUES FROM ('2026-09-01 00:00:00') TO ('2026-10-01 00:00:00');

CREATE TABLE "AnalyticsEvent_y2026m10" PARTITION OF "AnalyticsEvent"
    FOR VALUES FROM ('2026-10-01 00:00:00') TO ('2026-11-01 00:00:00');

CREATE TABLE "AnalyticsEvent_default" PARTITION OF "AnalyticsEvent" DEFAULT;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'AnalyticsEvent_old') THEN
        INSERT INTO "AnalyticsEvent" (
            "id", "ownerId", "entityType", "entityId", "eventType",
            "viewerId", "sessionId", "ipAddress", "userAgent", "source", "metadata", "createdAt"
        )
        SELECT
            "id", "ownerId", "entityType", "entityId", "eventType",
            "viewerId", "sessionId", "ipAddress", "userAgent", "source", "metadata", "createdAt"
        FROM "AnalyticsEvent_old";
        DROP TABLE "AnalyticsEvent_old";
    END IF;
END $$;

CREATE INDEX "AnalyticsEvent_ownerId_createdAt_idx" ON "AnalyticsEvent" ("ownerId", "createdAt");
