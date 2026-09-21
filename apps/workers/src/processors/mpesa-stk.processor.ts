import { TransactionStatus, prisma } from "@build/db";
import { createMpesaClient, type MpesaClient } from "@build/mpesa";
import type {
  MpesaStkCallbackJobData,
  MpesaStkInitiateJobData,
} from "@build/queue-server";
import type { Job } from "bullmq";
import { validateWorkerEnv, type WorkerEnv } from "../env.js";
import { executeMpesaStkSettlement } from "../domains/mpesa/settlement.js";
import { shouldProcessCapabilityWork } from "../capabilities/guard.js";
import { checkSimulatedFailure } from "../interceptors/staging-test-control.js";

export function mapStkResultCode(resultCode: number): "SUCCESS" | "FAILED" {
  return resultCode === 0 ? "SUCCESS" : "FAILED";
}

export function resolveStkCallbackStatus(
  currentStatus: string,
  resultCode: number,
): "SUCCESS" | "FAILED" {
  if (
    ["SUCCESS", "COMPLETED", "REVERSED", "REFUNDED"].includes(currentStatus)
  ) {
    return "SUCCESS";
  }
  return mapStkResultCode(resultCode);
}

export function createWorkerMpesaClient(workerEnv: WorkerEnv): MpesaClient {
  if (
    !workerEnv.MPESA_ENABLED ||
    !workerEnv.MPESA_BASE_URL ||
    !workerEnv.MPESA_CONSUMER_KEY ||
    !workerEnv.MPESA_CONSUMER_SECRET ||
    !workerEnv.MPESA_SHORTCODE ||
    !workerEnv.MPESA_PASSKEY ||
    !workerEnv.MPESA_CALLBACK_URL
  ) {
    throw new Error("M-Pesa is not fully configured for the worker");
  }

  return createMpesaClient({
    baseUrl: workerEnv.MPESA_BASE_URL,
    consumerKey: workerEnv.MPESA_CONSUMER_KEY,
    consumerSecret: workerEnv.MPESA_CONSUMER_SECRET,
    shortcode: workerEnv.MPESA_SHORTCODE,
    passkey: workerEnv.MPESA_PASSKEY,
    callbackUrl: workerEnv.MPESA_CALLBACK_URL,
  });
}

export function createWorkerMpesaB2cClient(workerEnv: WorkerEnv): MpesaClient {
  if (
    !workerEnv.MPESA_B2C_ENABLED ||
    !workerEnv.MPESA_BASE_URL ||
    !workerEnv.MPESA_CONSUMER_KEY ||
    !workerEnv.MPESA_CONSUMER_SECRET ||
    !workerEnv.MPESA_SHORTCODE ||
    !workerEnv.MPESA_PASSKEY ||
    !workerEnv.MPESA_CALLBACK_URL ||
    !workerEnv.MPESA_B2C_INITIATOR_NAME ||
    !workerEnv.MPESA_B2C_INITIATOR_PASSWORD ||
    !workerEnv.MPESA_B2C_CERTIFICATE_PEM ||
    !workerEnv.MPESA_B2C_RESULT_URL ||
    !workerEnv.MPESA_B2C_TIMEOUT_URL
  ) {
    throw new Error("M-Pesa B2C is not fully configured for the worker");
  }
  return createMpesaClient({
    baseUrl: workerEnv.MPESA_BASE_URL,
    consumerKey: workerEnv.MPESA_CONSUMER_KEY,
    consumerSecret: workerEnv.MPESA_CONSUMER_SECRET,
    shortcode: workerEnv.MPESA_SHORTCODE,
    passkey: workerEnv.MPESA_PASSKEY,
    callbackUrl: workerEnv.MPESA_CALLBACK_URL,
    b2c: {
      initiatorName: workerEnv.MPESA_B2C_INITIATOR_NAME,
      initiatorPassword: workerEnv.MPESA_B2C_INITIATOR_PASSWORD,
      certificatePem: workerEnv.MPESA_B2C_CERTIFICATE_PEM,
      resultUrl: workerEnv.MPESA_B2C_RESULT_URL,
      timeoutUrl: workerEnv.MPESA_B2C_TIMEOUT_URL,
    },
  });
}

export async function processMpesaStkInitiateJob(
  job: Job<MpesaStkInitiateJobData>,
  workerEnv: WorkerEnv = validateWorkerEnv(),
) {
  const transaction = await prisma.mpesaTransaction.findUnique({
    where: { id: job.data.transactionId },
  });
  if (!transaction) throw new Error("M-Pesa transaction not found");

  if (transaction.escrowId) {
    const capability = shouldProcessCapabilityWork("wallets_escrow", {
      FEATURE_MVP_WALLETS_ESCROW: workerEnv.FEATURE_MVP_WALLETS_ESCROW,
    });
    if (!capability.process) {
      return { suppressed: true, reason: capability.reason };
    }
  }

  if (transaction.status !== TransactionStatus.PENDING) {
    return { transactionId: transaction.id, status: transaction.status };
  }

  if (transaction.stagingTestRunId) {
    checkSimulatedFailure((job.data as any).testControl, workerEnv);
    if ((job.data as any).testControl?.mockResponse) {
      const mock = (job.data as any).testControl.mockResponse;
      const status =
        mock.ResponseCode === "0"
          ? TransactionStatus.PROCESSING
          : TransactionStatus.FAILED;
      await prisma.mpesaTransaction.update({
        where: { id: transaction.id },
        data: {
          merchantRequestId:
            mock.MerchantRequestID ?? transaction.merchantRequestId,
          checkoutRequestId:
            mock.CheckoutRequestID ?? transaction.checkoutRequestId,
          status,
          resultDesc:
            mock.ResponseDescription ?? "Simulated sandbox STK response",
        },
      });
      return {
        transactionId: transaction.id,
        status,
        checkoutRequestId:
          mock.CheckoutRequestID ?? transaction.checkoutRequestId,
      };
    }
  }

  const client = createWorkerMpesaClient(workerEnv);
  const providerResponse = await client.initiateStkPush({
    amount: Number(transaction.amount),
    phoneNumber: transaction.phoneNumber,
    accountReference: transaction.id.slice(0, 12),
    transactionDescription: transaction.purpose,
  });
  const status =
    providerResponse.ResponseCode === "0"
      ? TransactionStatus.PROCESSING
      : TransactionStatus.FAILED;

  await prisma.mpesaTransaction.update({
    where: { id: transaction.id },
    data: {
      merchantRequestId: providerResponse.MerchantRequestID,
      checkoutRequestId: providerResponse.CheckoutRequestID,
      status,
      resultDesc: providerResponse.ResponseDescription,
    },
  });

  return {
    transactionId: transaction.id,
    status,
    checkoutRequestId: providerResponse.CheckoutRequestID,
  };
}

function getCallbackMetadata(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};
  const metadata = (payload as { CallbackMetadata?: { Item?: unknown[] } })
    .CallbackMetadata?.Item;
  if (!Array.isArray(metadata)) return {};
  return Object.fromEntries(
    metadata.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const value = item as { Name?: unknown; Value?: unknown };
      return typeof value.Name === "string" ? [[value.Name, value.Value]] : [];
    }),
  );
}

export async function processMpesaStkCallbackJob(
  job: Job<MpesaStkCallbackJobData>,
) {
  const event = await prisma.mpesaCallbackEvent.findUnique({
    where: { id: job.data.callbackEventId },
  });
  if (!event) throw new Error("M-Pesa callback event not found");
  if (event.processedAt) return { eventId: event.id, status: "PROCESSED" };

  const payload = (event.redactedPayload ?? {}) as {
    ResultCode?: number;
    ResultDesc?: string;
  };
  const resultCode = Number(payload.ResultCode);
  const metadata = getCallbackMetadata(event.redactedPayload);
  const receipt =
    typeof metadata.MpesaReceiptNumber === "string"
      ? metadata.MpesaReceiptNumber
      : undefined;

  return prisma.$transaction(async (tx) => {
    const result = await executeMpesaStkSettlement(tx, {
      transactionId: job.data.transactionId,
      resultCode,
      resultDesc: payload.ResultDesc,
      receiptNumber: receipt,
      providerPayload: (event.redactedPayload as Record<string, unknown>) ?? {},
      callbackEventId: event.id,
    });
    return { eventId: event.id, status: result.status };
  });
}
