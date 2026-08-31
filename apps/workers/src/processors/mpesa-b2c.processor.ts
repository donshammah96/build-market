import {
  PaymentMethod,
  TransactionCategory,
  TransactionStatus,
  TransactionType,
  prisma,
} from "@build/db";
import type {
  MpesaB2cInitiateJobData,
  MpesaB2cResultJobData,
} from "@build/queue-server";
import type { Job } from "bullmq";
import { createWorkerMpesaB2cClient } from "./mpesa-stk.processor.js";
import { validateWorkerEnv, type WorkerEnv } from "../env.js";

export function resolveB2cResultStatus(
  resultCode: number,
): "SUCCESS" | "FAILED" {
  return resultCode === 0 ? "SUCCESS" : "FAILED";
}

export async function processMpesaB2cInitiateJob(
  job: Job<MpesaB2cInitiateJobData>,
  workerEnv: WorkerEnv = validateWorkerEnv(),
) {
  const payout = await prisma.mpesaB2C.findUnique({
    where: { id: job.data.payoutId },
  });
  if (!payout) throw new Error("M-Pesa payout not found");
  if (payout.status !== TransactionStatus.PENDING) {
    return { payoutId: payout.id, status: payout.status };
  }

  const response = await createWorkerMpesaB2cClient(workerEnv).initiateB2c({
    amount: Number(payout.amount),
    phoneNumber: payout.phoneNumber,
    remarks: `BuildMarket payout ${payout.id.slice(0, 8)}`,
  });
  const status =
    response.ResponseCode === "0"
      ? TransactionStatus.PROCESSING
      : TransactionStatus.FAILED;
  await prisma.mpesaB2C.update({
    where: { id: payout.id },
    data: {
      conversationId: response.ConversationID,
      originatorConvId: response.OriginatorConversationID,
      resultDesc: response.ResponseDescription,
      status,
    },
  });
  return {
    payoutId: payout.id,
    status,
    conversationId: response.ConversationID,
  };
}

export async function processMpesaB2cResultJob(
  job: Job<MpesaB2cResultJobData>,
) {
  const event = await prisma.mpesaCallbackEvent.findUnique({
    where: { id: job.data.callbackEventId },
  });
  if (!event) throw new Error("M-Pesa B2C callback event not found");
  if (event.processedAt) return { eventId: event.id, status: "PROCESSED" };

  const payload = (event.redactedPayload ?? {}) as {
    ResultCode?: number;
    ResultDesc?: string;
    ConversationID?: string;
    TransactionID?: string;
  };
  const status = resolveB2cResultStatus(Number(payload.ResultCode));

  return prisma.$transaction(async (tx) => {
    const payout = await tx.mpesaB2C.findUnique({
      where: { id: job.data.payoutId },
    });
    if (!payout) throw new Error("M-Pesa payout not found");
    const transactionId = payload.TransactionID;
    await tx.mpesaB2C.update({
      where: { id: payout.id },
      data: {
        status:
          status === "SUCCESS"
            ? TransactionStatus.SUCCESS
            : TransactionStatus.FAILED,
        resultCode: String(payload.ResultCode),
        resultDesc: payload.ResultDesc,
        transactionId,
        completedAt: status === "SUCCESS" ? new Date() : undefined,
        callbackReceivedAt: event.receivedAt,
        callbackPayload: event.redactedPayload ?? undefined,
      },
    });
    if (status === "SUCCESS" && transactionId) {
      await tx.professionalTransaction.create({
        data: {
          professionalId: payout.professionalId,
          description: "M-Pesa professional payout",
          type: TransactionType.WITHDRAWAL,
          category: TransactionCategory.WITHDRAWAL,
          method: PaymentMethod.MPESA,
          amount: payout.amount,
          netAmount: payout.amount,
          referenceCode: transactionId,
          status: TransactionStatus.SUCCESS,
          completedAt: new Date(),
        },
      });
    }
    await tx.mpesaCallbackEvent.update({
      where: { id: event.id },
      data: { processingStatus: "PROCESSED", processedAt: new Date() },
    });
    return { eventId: event.id, status };
  });
}
