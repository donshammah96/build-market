ALTER TABLE "MpesaTransaction"
  ADD COLUMN "callbackEventCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "metadata" JSONB;

ALTER TABLE "MpesaB2C"
  ADD COLUMN "idempotencyKey" TEXT;
UPDATE "MpesaB2C"
  SET "idempotencyKey" = 'legacy:b2c:' || "id"
  WHERE "idempotencyKey" IS NULL;
ALTER TABLE "MpesaB2C"
  ALTER COLUMN "idempotencyKey" SET NOT NULL;
ALTER TABLE "MpesaB2C"
  ADD COLUMN "callbackReceivedAt" TIMESTAMP(3),
  ADD COLUMN "callbackPayload" JSONB,
  ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextRetryAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "MpesaB2C_idempotencyKey_key"
  ON "MpesaB2C"("idempotencyKey");
CREATE INDEX "MpesaB2C_status_createdAt_idx"
  ON "MpesaB2C"("status", "createdAt");
CREATE INDEX "MpesaB2C_professionalId_status_idx"
  ON "MpesaB2C"("professionalId", "status");

CREATE TABLE "MpesaCallbackEvent" (
  "id" TEXT NOT NULL,
  "providerEventKey" TEXT NOT NULL,
  "callbackType" TEXT NOT NULL,
  "transactionId" TEXT,
  "payoutId" TEXT,
  "checkoutRequestId" TEXT,
  "conversationId" TEXT,
  "payloadHash" TEXT NOT NULL,
  "redactedPayload" JSONB,
  "processingStatus" TEXT NOT NULL DEFAULT 'RECEIVED',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MpesaCallbackEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MpesaCallbackEvent_providerEventKey_key"
  ON "MpesaCallbackEvent"("providerEventKey");
CREATE INDEX "MpesaCallbackEvent_callbackType_receivedAt_idx"
  ON "MpesaCallbackEvent"("callbackType", "receivedAt");
CREATE INDEX "MpesaCallbackEvent_transactionId_processingStatus_idx"
  ON "MpesaCallbackEvent"("transactionId", "processingStatus");
CREATE INDEX "MpesaCallbackEvent_payoutId_processingStatus_idx"
  ON "MpesaCallbackEvent"("payoutId", "processingStatus");
