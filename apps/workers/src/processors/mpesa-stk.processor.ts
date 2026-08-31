import {
  BillingInterval,
  PaymentMethod,
  SubscriptionStatus,
  TransactionCategory,
  TransactionStatus,
  TransactionType,
  prisma,
} from "@build/db";
import { createMpesaClient, type MpesaClient } from "@build/mpesa";
import type {
  MpesaStkCallbackJobData,
  MpesaStkInitiateJobData,
} from "@build/queue-server";
import type { Job } from "bullmq";
import { validateWorkerEnv, type WorkerEnv } from "../env.js";

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

  if (transaction.status !== TransactionStatus.PENDING) {
    return { transactionId: transaction.id, status: transaction.status };
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
    const transaction = await tx.mpesaTransaction.findUnique({
      where: { id: job.data.transactionId },
    });
    if (!transaction) throw new Error("M-Pesa transaction not found");

    const nextStatus = resolveStkCallbackStatus(transaction.status, resultCode);
    const isSuccess = nextStatus === "SUCCESS";
    const currentStatusIsTerminal = [
      TransactionStatus.SUCCESS,
      TransactionStatus.REVERSED,
      TransactionStatus.REFUNDED,
      TransactionStatus.CANCELLED,
      TransactionStatus.COMPLETED,
    ].includes(transaction.status);
    await tx.mpesaTransaction.update({
      where: { id: transaction.id },
      data: {
        status: currentStatusIsTerminal
          ? transaction.status
          : isSuccess
            ? TransactionStatus.SUCCESS
            : TransactionStatus.FAILED,
        resultCode: String(resultCode),
        resultDesc: payload.ResultDesc,
        mpesaReceiptNumber: receipt,
        callbackReceivedAt: event.receivedAt,
        callbackPayload: event.redactedPayload ?? undefined,
        callbackEventCount: { increment: 1 },
      },
    });

    if (
      isSuccess &&
      transaction.purpose === "SUBSCRIPTION_RENEWAL" &&
      transaction.subscriptionId
    ) {
      const subscription = await tx.professionalSubscription.findUnique({
        where: { id: transaction.subscriptionId },
      });
      if (subscription) {
        const checkoutMetadata = (transaction.metadata ?? {}) as {
          planKey?: string;
          billingInterval?: string;
        };
        const plan = checkoutMetadata.planKey
          ? await tx.subscriptionPlan.findUnique({
              where: { key: checkoutMetadata.planKey as never },
            })
          : null;
        const interval =
          checkoutMetadata.billingInterval === "ANNUAL"
            ? BillingInterval.ANNUAL
            : BillingInterval.MONTHLY;
        const start =
          subscription.currentPeriodEnd &&
          subscription.currentPeriodEnd > new Date()
            ? subscription.currentPeriodEnd
            : new Date();
        const end = new Date(start);
        if (interval === BillingInterval.ANNUAL)
          end.setFullYear(end.getFullYear() + 1);
        else end.setMonth(end.getMonth() + 1);
        await tx.professionalSubscription.update({
          where: { id: subscription.id },
          data: {
            planId: plan?.id ?? subscription.planId,
            status: SubscriptionStatus.ACTIVE,
            billingInterval: interval,
            currentPeriodStart: start,
            currentPeriodEnd: end,
            graceEndsAt: null,
            lastPaymentAttemptAt: new Date(),
            lastPaymentFailReason: null,
          },
        });
        if (receipt) {
          await tx.professionalTransaction.create({
            data: {
              professionalId: subscription.professionalId,
              subscriptionId: subscription.id,
              description: `Subscription renewal (${interval.toLowerCase()})`,
              type: TransactionType.EXPENSE,
              category: TransactionCategory.SUBSCRIPTION_FEE,
              method: PaymentMethod.MPESA,
              amount: transaction.amount,
              referenceCode: receipt,
              status: TransactionStatus.SUCCESS,
              completedAt: new Date(),
            },
          });
        }
      }
    }

    await tx.mpesaCallbackEvent.update({
      where: { id: event.id },
      data: { processingStatus: "PROCESSED", processedAt: new Date() },
    });
    return { eventId: event.id, status: nextStatus };
  });
}
