-- CreateTable: staging_test_identity_leases
CREATE TABLE "staging_test_identity_leases" (
    "id" TEXT NOT NULL,
    "stagingTestRunId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'LEASED',
    "leaseExpiresAt" TIMESTAMP(3) NOT NULL,
    "resetAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staging_test_identity_leases_pkey" PRIMARY KEY ("id")
);

-- Unique relation to run and slot
CREATE UNIQUE INDEX "staging_test_identity_leases_stagingTestRunId_slot_key"
ON "staging_test_identity_leases"("stagingTestRunId", "slot");

-- Active lease partial unique index (only one active lease per slot across LEASED, RESETTING, READY)
CREATE UNIQUE INDEX "staging_test_identity_leases_active_slot_idx"
ON "staging_test_identity_leases"("slot")
WHERE "state" IN ('LEASED', 'RESETTING', 'READY');

-- Indexes
CREATE INDEX "staging_test_identity_leases_stagingTestRunId_idx"
ON "staging_test_identity_leases"("stagingTestRunId");

CREATE INDEX "staging_test_identity_leases_slot_state_idx"
ON "staging_test_identity_leases"("slot", "state");

-- Foreign Keys
ALTER TABLE "staging_test_identity_leases"
ADD CONSTRAINT "staging_test_identity_leases_stagingTestRunId_fkey"
FOREIGN KEY ("stagingTestRunId") REFERENCES "staging_test_runs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
