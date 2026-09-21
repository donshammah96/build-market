import { randomUUID } from "node:crypto";
import { TransactionStatus, prisma } from "@build/db";
import type { MpesaReconcileJobData } from "@build/queue-server";
import type { Job } from "bullmq";
import { validateWorkerEnv, type WorkerEnv } from "../env.js";
import { createWorkerMpesaClient } from "./mpesa-stk.processor.js";
import { executeMpesaStkSettlement } from "../domains/mpesa/settlement.js";

const MAX_RECONCILIATION_ATTEMPTS = 10;

export async function processMpesaReconciliationJob(
  job: Job<MpesaReconcileJobData>,
  workerEnv: WorkerEnv = validateWorkerEnv(),
) {
  const olderThanMinutes = job.data?.olderThanMinutes ?? 2;
  const batchSize = Math.min(job.data?.batchSize ?? 25, 100);
  const leaseSeconds = job.data?.leaseSeconds ?? 120;

  const olderThanThreshold = new Date(
    Date.now() - olderThanMinutes * 60 * 1000,
  );
  const leaseThreshold = new Date(Date.now() - leaseSeconds * 1000);

  const candidates = await prisma.mpesaTransaction.findMany({
    where: {
      status: TransactionStatus.PROCESSING,
      checkoutRequestId: { not: null },
      createdAt: { lte: olderThanThreshold },
      reconciliationAttempts: { lt: MAX_RECONCILIATION_ATTEMPTS },
      OR: [
        { reconciliationNextAttemptAt: null },
        { reconciliationNextAttemptAt: { lte: new Date() } },
      ],
      AND: [
        {
          OR: [
            { reconciliationClaimedAt: null },
            { reconciliationClaimedAt: { lte: leaseThreshold } },
          ],
        },
      ],
    },
    take: batchSize,
    orderBy: { createdAt: "asc" },
  });

  const results = {
    totalEvaluated: candidates.length,
    claimed: 0,
    succeeded: 0,
    failed: 0,
    errored: 0,
  };

  const client = createWorkerMpesaClient(workerEnv);

  for (const candidate of candidates) {
    if (!candidate.checkoutRequestId) continue;

    const claimId = randomUUID();
    const claimUpdate = await prisma.mpesaTransaction.updateMany({
      where: {
        id: candidate.id,
        status: TransactionStatus.PROCESSING,
        OR: [
          { reconciliationClaimedAt: null },
          { reconciliationClaimedAt: { lte: leaseThreshold } },
        ],
      },
      data: {
        reconciliationClaimId: claimId,
        reconciliationClaimedAt: new Date(),
        reconciliationAttempts: { increment: 1 },
      },
    });

    if (claimUpdate.count === 0) {
      continue;
    }

    results.claimed++;

    try {
      const queryResponse = await client.queryStkPush({
        checkoutRequestId: candidate.checkoutRequestId,
      });

      const resultCode = Number(queryResponse.ResultCode);

      await prisma.$transaction(async (tx) => {
        await tx.mpesaTransaction.update({
          where: { id: candidate.id },
          data: {
            lastProviderQueryAt: new Date(),
            lastProviderQueryCode: queryResponse.ResultCode,
            reconciliationClaimedAt: null,
            reconciliationClaimId: null,
          },
        });

        await executeMpesaStkSettlement(tx, {
          transactionId: candidate.id,
          resultCode,
          resultDesc: queryResponse.ResultDesc,
          providerPayload: queryResponse as unknown as Record<string, unknown>,
        });
      });

      if (resultCode === 0) {
        results.succeeded++;
      } else {
        results.failed++;
      }
    } catch {
      results.errored++;
      const currentAttempts = candidate.reconciliationAttempts + 1;
      const isExhausted = currentAttempts >= MAX_RECONCILIATION_ATTEMPTS;

      if (isExhausted) {
        await prisma.mpesaTransaction.update({
          where: { id: candidate.id },
          data: {
            status: TransactionStatus.FAILED,
            resultDesc: "Reconciliation query attempts exhausted",
            reconciliationClaimedAt: null,
            reconciliationClaimId: null,
            lastProviderQueryAt: new Date(),
            lastProviderQueryCode: "EXHAUSTED",
          },
        });
      } else {
        const delaySeconds = Math.min(3600, Math.pow(2, currentAttempts) * 30);
        await prisma.mpesaTransaction.update({
          where: { id: candidate.id },
          data: {
            reconciliationNextAttemptAt: new Date(
              Date.now() + delaySeconds * 1000,
            ),
            reconciliationClaimedAt: null,
            reconciliationClaimId: null,
            lastProviderQueryAt: new Date(),
            lastProviderQueryCode: "ERROR",
          },
        });
      }
    }
  }

  return results;
}
