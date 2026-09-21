-- These are the roots for the routing/masking and messaging E2E fixtures.
-- Child routing events, participants, and messages are deleted by existing cascades.
ALTER TABLE "MarketplaceLead" ADD COLUMN "stagingTestRunId" TEXT;
ALTER TABLE "MessageThread" ADD COLUMN "stagingTestRunId" TEXT;

ALTER TABLE "MarketplaceLead"
  ADD CONSTRAINT "MarketplaceLead_stagingTestRunId_fkey"
  FOREIGN KEY ("stagingTestRunId") REFERENCES "staging_test_runs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MessageThread"
  ADD CONSTRAINT "MessageThread_stagingTestRunId_fkey"
  FOREIGN KEY ("stagingTestRunId") REFERENCES "staging_test_runs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MarketplaceLead_stagingTestRunId_idx" ON "MarketplaceLead"("stagingTestRunId");
CREATE INDEX "MessageThread_stagingTestRunId_idx" ON "MessageThread"("stagingTestRunId");
