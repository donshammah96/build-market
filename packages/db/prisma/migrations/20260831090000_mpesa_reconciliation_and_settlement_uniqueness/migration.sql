-- M-Pesa Reconciliation Leases, Phone Search Index, and Settlement Uniqueness
ALTER TABLE "MpesaTransaction"
  ADD COLUMN "phoneSearchHash" TEXT,
  ADD COLUMN "reconciliationAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reconciliationNextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "reconciliationClaimedAt" TIMESTAMP(3),
  ADD COLUMN "reconciliationClaimId" TEXT,
  ADD COLUMN "lastProviderQueryAt" TIMESTAMP(3),
  ADD COLUMN "lastProviderQueryCode" TEXT;

CREATE INDEX "MpesaTransaction_status_checkoutRequestId_reconciliationNextAttemptAt_idx"
  ON "MpesaTransaction"("status", "checkoutRequestId", "reconciliationNextAttemptAt");
CREATE INDEX "MpesaTransaction_reconciliationClaimedAt_idx"
  ON "MpesaTransaction"("reconciliationClaimedAt");
CREATE INDEX "MpesaTransaction_phoneSearchHash_idx"
  ON "MpesaTransaction"("phoneSearchHash");

-- Unique Settlement Keys for Replay-Safe Financial Ledger Writes
ALTER TABLE "LeadCreditLedgerEntry"
  ADD COLUMN "settlementKey" TEXT;

CREATE UNIQUE INDEX "LeadCreditLedgerEntry_settlementKey_key"
  ON "LeadCreditLedgerEntry"("settlementKey");

ALTER TABLE "EscrowTransaction"
  ADD COLUMN "settlementKey" TEXT;

CREATE UNIQUE INDEX "EscrowTransaction_settlementKey_key"
  ON "EscrowTransaction"("settlementKey");
