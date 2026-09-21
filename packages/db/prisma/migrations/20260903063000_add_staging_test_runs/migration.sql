-- CreateTable: staging_test_runs
CREATE TABLE "staging_test_runs" (
    "id" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "gitSha" TEXT NOT NULL,
    "workflowRunId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "cleanedAt" TIMESTAMP(3),

    CONSTRAINT "staging_test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: staging_test_outbound_deliveries
CREATE TABLE "staging_test_outbound_deliveries" (
    "id" TEXT NOT NULL,
    "stagingTestRunId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipientHash" TEXT NOT NULL,
    "templateId" TEXT,
    "subject" TEXT,
    "redactedMetadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staging_test_outbound_deliveries_pkey" PRIMARY KEY ("id")
);

-- Add stagingTestRunId columns to owned fixture entities
ALTER TABLE "users" ADD COLUMN "stagingTestRunId" TEXT;
ALTER TABLE "ProfessionalProfile" ADD COLUMN "stagingTestRunId" TEXT;
ALTER TABLE "Project" ADD COLUMN "stagingTestRunId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "stagingTestRunId" TEXT;
ALTER TABLE "Review" ADD COLUMN "stagingTestRunId" TEXT;
ALTER TABLE "MpesaTransaction" ADD COLUMN "stagingTestRunId" TEXT;
ALTER TABLE "MpesaCallbackEvent" ADD COLUMN "stagingTestRunId" TEXT;

-- Create Indexes
CREATE INDEX "staging_test_runs_state_expiresAt_idx" ON "staging_test_runs"("state", "expiresAt");
CREATE INDEX "staging_test_runs_scenario_createdAt_idx" ON "staging_test_runs"("scenario", "createdAt");

CREATE INDEX "staging_test_outbound_deliveries_stagingTestRunId_channel_idx" ON "staging_test_outbound_deliveries"("stagingTestRunId", "channel");

CREATE INDEX "users_stagingTestRunId_idx" ON "users"("stagingTestRunId");
CREATE INDEX "ProfessionalProfile_stagingTestRunId_idx" ON "ProfessionalProfile"("stagingTestRunId");
CREATE INDEX "Project_stagingTestRunId_idx" ON "Project"("stagingTestRunId");
CREATE INDEX "Lead_stagingTestRunId_idx" ON "Lead"("stagingTestRunId");
CREATE INDEX "Review_stagingTestRunId_idx" ON "Review"("stagingTestRunId");
CREATE INDEX "MpesaTransaction_stagingTestRunId_idx" ON "MpesaTransaction"("stagingTestRunId");
CREATE INDEX "MpesaCallbackEvent_stagingTestRunId_idx" ON "MpesaCallbackEvent"("stagingTestRunId");

-- Add Foreign Keys
ALTER TABLE "staging_test_outbound_deliveries" ADD CONSTRAINT "staging_test_outbound_deliveries_stagingTestRunId_fkey" FOREIGN KEY ("stagingTestRunId") REFERENCES "staging_test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users" ADD CONSTRAINT "users_stagingTestRunId_fkey" FOREIGN KEY ("stagingTestRunId") REFERENCES "staging_test_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProfessionalProfile" ADD CONSTRAINT "ProfessionalProfile_stagingTestRunId_fkey" FOREIGN KEY ("stagingTestRunId") REFERENCES "staging_test_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Project" ADD CONSTRAINT "Project_stagingTestRunId_fkey" FOREIGN KEY ("stagingTestRunId") REFERENCES "staging_test_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_stagingTestRunId_fkey" FOREIGN KEY ("stagingTestRunId") REFERENCES "staging_test_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Review" ADD CONSTRAINT "Review_stagingTestRunId_fkey" FOREIGN KEY ("stagingTestRunId") REFERENCES "staging_test_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MpesaTransaction" ADD CONSTRAINT "MpesaTransaction_stagingTestRunId_fkey" FOREIGN KEY ("stagingTestRunId") REFERENCES "staging_test_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MpesaCallbackEvent" ADD CONSTRAINT "MpesaCallbackEvent_stagingTestRunId_fkey" FOREIGN KEY ("stagingTestRunId") REFERENCES "staging_test_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
