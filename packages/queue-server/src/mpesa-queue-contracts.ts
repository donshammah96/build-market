export const MPESA_QUEUE_NAMES = {
  PAYMENTS: "mpesa-payments",
  RECONCILIATION: "mpesa-reconciliation",
} as const;

export const MPESA_JOB_NAMES = {
  INITIATE_STK: "initiate-stk",
  PROCESS_STK_CALLBACK: "process-stk-callback",
  INITIATE_B2C: "initiate-b2c",
  PROCESS_B2C_RESULT: "process-b2c-result",
  RECONCILE_PENDING: "reconcile-pending",
} as const;

export interface MpesaStkInitiateJobData {
  transactionId: string;
  correlationId: string;
}

export interface MpesaStkCallbackJobData {
  callbackEventId: string;
  transactionId: string;
  correlationId: string;
}

export interface MpesaB2cInitiateJobData {
  payoutId: string;
  correlationId: string;
}

export interface MpesaB2cResultJobData {
  payoutId: string;
  callbackEventId: string;
  correlationId: string;
}

export interface MpesaReconcileJobData {
  olderThanMinutes: number;
  correlationId: string;
}

export function getMpesaJobId(jobName: string, resourceId: string): string {
  return `mpesa:${jobName}:${resourceId}`;
}
