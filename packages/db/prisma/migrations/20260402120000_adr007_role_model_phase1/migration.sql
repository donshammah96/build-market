-- ADR-007 phase 1: role model normalization and onboarding status states
-- - Remove UserRole.SUPPORT (migrate to ADMIN + AdminProfile.SUPPORT_AGENT)
-- - Remove AdminRole.SYSTEM_ADMIN (migrate to SUPER_ADMIN)
-- - Add UserStatus.ONBOARDING and UserStatus.PENDING_VERIFICATION

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Add onboarding lifecycle statuses
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'UserStatus' AND e.enumlabel = 'ONBOARDING'
  ) THEN
    ALTER TYPE "UserStatus" ADD VALUE 'ONBOARDING';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'UserStatus' AND e.enumlabel = 'PENDING_VERIFICATION'
  ) THEN
    ALTER TYPE "UserStatus" ADD VALUE 'PENDING_VERIFICATION';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Capture SUPPORT users and provision AdminProfile rows before migration
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE tmp_support_users ON COMMIT DROP AS
SELECT id
FROM "users"
WHERE role = 'SUPPORT';

INSERT INTO "AdminProfile" ("userId", role, permissions, "isActive", "createdAt", "updatedAt")
SELECT s.id, 'SUPPORT_AGENT'::"AdminRole", '{}'::text[], true, NOW(), NOW()
FROM tmp_support_users s
LEFT JOIN "AdminProfile" ap ON ap."userId" = s.id
WHERE ap."userId" IS NULL;

-- Ensure all migrated support actors use SUPPORT_AGENT capability
UPDATE "AdminProfile" ap
SET role = 'SUPPORT_AGENT',
    "updatedAt" = NOW()
FROM tmp_support_users s
WHERE ap."userId" = s.id;

-- ---------------------------------------------------------------------------
-- 3) Normalize SYSTEM_ADMIN to SUPER_ADMIN before enum contraction
-- ---------------------------------------------------------------------------
UPDATE "AdminProfile"
SET role = 'SUPER_ADMIN',
    "updatedAt" = NOW()
WHERE role = 'SYSTEM_ADMIN';

-- ---------------------------------------------------------------------------
-- 4) Migrate UserRole.SUPPORT -> UserRole.ADMIN
-- ---------------------------------------------------------------------------
UPDATE "users" u
SET role = 'ADMIN'
FROM tmp_support_users s
WHERE u.id = s.id;

-- ---------------------------------------------------------------------------
-- 5) Contract UserRole enum (drop SUPPORT)
-- ---------------------------------------------------------------------------
ALTER TABLE "users" ALTER COLUMN role DROP DEFAULT;

ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'PROFESSIONAL', 'ADMIN');

ALTER TABLE "users"
  ALTER COLUMN role TYPE "UserRole"
  USING (role::text::"UserRole");

ALTER TABLE "users" ALTER COLUMN role SET DEFAULT 'CLIENT';

DROP TYPE "UserRole_old";

-- ---------------------------------------------------------------------------
-- 6) Contract AdminRole enum (drop SYSTEM_ADMIN)
-- ---------------------------------------------------------------------------
ALTER TABLE "AdminProfile" ALTER COLUMN role DROP DEFAULT;

ALTER TYPE "AdminRole" RENAME TO "AdminRole_old";
CREATE TYPE "AdminRole" AS ENUM (
  'SUPER_ADMIN',
  'CONTENT_MODERATOR',
  'SUPPORT_AGENT',
  'FINANCE_MANAGER',
  'AUDITOR'
);

ALTER TABLE "AdminProfile"
  ALTER COLUMN role TYPE "AdminRole"
  USING (role::text::"AdminRole");

ALTER TABLE "AdminProfile" ALTER COLUMN role SET DEFAULT 'SUPPORT_AGENT';

DROP TYPE "AdminRole_old";

COMMIT;
