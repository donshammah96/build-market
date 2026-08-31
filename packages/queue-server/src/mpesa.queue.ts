import { Queue, type JobsOptions } from "bullmq";
import { createRedisConnection } from "@build/redis/tcp";
import {
  getMpesaJobId,
  MPESA_JOB_NAMES,
  MPESA_QUEUE_NAMES,
  type MpesaB2cInitiateJobData,
  type MpesaB2cResultJobData,
  type MpesaReconcileJobData,
  type MpesaStkCallbackJobData,
  type MpesaStkInitiateJobData,
} from "./mpesa-queue-contracts.js";

let paymentsQueue: Queue | null = null;
let reconciliationQueue: Queue | null = null;

function getPaymentsQueue(): Queue {
  return (paymentsQueue ??= new Queue(MPESA_QUEUE_NAMES.PAYMENTS, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { age: 86_400, count: 1_000 },
      removeOnFail: false,
    },
  }));
}

function getReconciliationQueue(): Queue {
  return (reconciliationQueue ??= new Queue(MPESA_QUEUE_NAMES.RECONCILIATION, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 10_000 },
      removeOnComplete: { age: 86_400, count: 500 },
      removeOnFail: false,
    },
  }));
}

export function addMpesaStkInitiateJob(
  data: MpesaStkInitiateJobData,
  opts?: JobsOptions,
) {
  return getPaymentsQueue().add(MPESA_JOB_NAMES.INITIATE_STK, data, {
    jobId: getMpesaJobId(MPESA_JOB_NAMES.INITIATE_STK, data.transactionId),
    ...opts,
  });
}

export function addMpesaStkCallbackJob(
  data: MpesaStkCallbackJobData,
  opts?: JobsOptions,
) {
  return getPaymentsQueue().add(MPESA_JOB_NAMES.PROCESS_STK_CALLBACK, data, {
    jobId: getMpesaJobId(
      MPESA_JOB_NAMES.PROCESS_STK_CALLBACK,
      data.callbackEventId,
    ),
    ...opts,
  });
}

export function addMpesaB2cInitiateJob(
  data: MpesaB2cInitiateJobData,
  opts?: JobsOptions,
) {
  return getPaymentsQueue().add(MPESA_JOB_NAMES.INITIATE_B2C, data, {
    jobId: getMpesaJobId(MPESA_JOB_NAMES.INITIATE_B2C, data.payoutId),
    ...opts,
  });
}

export function addMpesaB2cResultJob(
  data: MpesaB2cResultJobData,
  opts?: JobsOptions,
) {
  return getPaymentsQueue().add(MPESA_JOB_NAMES.PROCESS_B2C_RESULT, data, {
    jobId: getMpesaJobId(
      MPESA_JOB_NAMES.PROCESS_B2C_RESULT,
      data.callbackEventId,
    ),
    ...opts,
  });
}

export function addMpesaReconcileJob(
  data: MpesaReconcileJobData,
  opts?: JobsOptions,
) {
  return getReconciliationQueue().add(MPESA_JOB_NAMES.RECONCILE_PENDING, data, {
    jobId: getMpesaJobId(MPESA_JOB_NAMES.RECONCILE_PENDING, data.correlationId),
    ...opts,
  });
}
