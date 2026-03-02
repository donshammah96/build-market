/**
 * Financial and Payment domain enums for build-market.
 *
 * Values MUST exactly match the Prisma enums (UPPERCASE).
 * Zero runtime dependencies — safe for browser and server.
 *
 * SINGLE SOURCE OF TRUTH — do not duplicate these values elsewhere.
 */

// -------------------------------------------------------------------------
// PaymentProvider
// -------------------------------------------------------------------------

export const PAYMENT_PROVIDERS = [
  "MPESA_STK_PUSH",
  "MPESA_PAYBILL",
  "MPESA_B2C",
  "BANK_TRANSFER",
  "CARD",
  "WALLET",
] as const;

export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProvider, string> = {
  MPESA_STK_PUSH: "M-PESA STK Push",
  MPESA_PAYBILL: "M-PESA Paybill",
  MPESA_B2C: "M-PESA B2C (Payout)",
  BANK_TRANSFER: "Bank Transfer",
  CARD: "Credit/Debit Card",
  WALLET: "Internal Wallet",
};

export function isPaymentProvider(value: unknown): value is PaymentProvider {
  return (
    typeof value === "string" &&
    (PAYMENT_PROVIDERS as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// MpesaTransactionType
// -------------------------------------------------------------------------

export const MPESA_TRANSACTION_TYPES = [
  "CUSTOMER_PAY_BILL_ONLINE",
  "CUSTOMER_BUY_GOODS_ONLINE",
  "BUSINESS_PAYMENT",
  "SALARY_PAYMENT",
] as const;

export type MpesaTransactionType = (typeof MPESA_TRANSACTION_TYPES)[number];

export const MPESA_TRANSACTION_TYPE_LABELS: Record<
  MpesaTransactionType,
  string
> = {
  CUSTOMER_PAY_BILL_ONLINE: "Customer Pay Bill Online (C2B)",
  CUSTOMER_BUY_GOODS_ONLINE: "Customer Buy Goods Online (Till)",
  BUSINESS_PAYMENT: "Business Payment (B2C)",
  SALARY_PAYMENT: "Salary Payment (B2C)",
};

export function isMpesaTransactionType(
  value: unknown,
): value is MpesaTransactionType {
  return (
    typeof value === "string" &&
    (MPESA_TRANSACTION_TYPES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// TransactionType
// -------------------------------------------------------------------------

export const TRANSACTION_TYPES = ["INCOME", "WITHDRAWAL", "EXPENSE"] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  INCOME: "Income",
  WITHDRAWAL: "Withdrawal",
  EXPENSE: "Expense",
};

export function isTransactionType(value: unknown): value is TransactionType {
  return (
    typeof value === "string" &&
    (TRANSACTION_TYPES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// TransactionCategory
// -------------------------------------------------------------------------

export const TRANSACTION_CATEGORIES = [
  "PROJECT_PAYMENT",
  "SUBSCRIPTION_FEE",
  "LEAD_PURCHASE",
  "VERIFICATION_FEE",
  "WITHDRAWAL",
  "REFUND",
  "PENALTY",
] as const;

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

export const TRANSACTION_CATEGORY_LABELS: Record<TransactionCategory, string> =
  {
    PROJECT_PAYMENT: "Project Payment",
    SUBSCRIPTION_FEE: "Subscription Fee",
    LEAD_PURCHASE: "Lead Purchase",
    VERIFICATION_FEE: "Verification Fee",
    WITHDRAWAL: "Withdrawal",
    REFUND: "Refund",
    PENALTY: "Penalty",
  };

export function isTransactionCategory(
  value: unknown,
): value is TransactionCategory {
  return (
    typeof value === "string" &&
    (TRANSACTION_CATEGORIES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// TransactionStatus
// -------------------------------------------------------------------------

export const TRANSACTION_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "REVERSED",
  "REFUNDED",
  "CANCELLED",
] as const;

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  SUCCESS: "Success",
  FAILED: "Failed",
  REVERSED: "Reversed",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};

export function isTransactionStatus(
  value: unknown,
): value is TransactionStatus {
  return (
    typeof value === "string" &&
    (TRANSACTION_STATUSES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// EscrowStatus
// -------------------------------------------------------------------------

export const ESCROW_STATUSES = [
  "PENDING_FUNDING",
  "FUNDS_HELD",
  "RELEASED",
  "DISPUTED",
  "REFUNDED",
] as const;

export type EscrowStatus = (typeof ESCROW_STATUSES)[number];

export const ESCROW_STATUS_LABELS: Record<EscrowStatus, string> = {
  PENDING_FUNDING: "Pending Funding",
  FUNDS_HELD: "Funds Held in Escrow",
  RELEASED: "Released",
  DISPUTED: "Disputed",
  REFUNDED: "Refunded",
};

export function isEscrowStatus(value: unknown): value is EscrowStatus {
  return (
    typeof value === "string" &&
    (ESCROW_STATUSES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// PaymentMethod
// -------------------------------------------------------------------------

export const PAYMENT_METHODS = [
  "MPESA",
  "BANK_TRANSFER",
  "CARD",
  "WALLET",
  "CASH",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  MPESA: "M-PESA",
  BANK_TRANSFER: "Bank Transfer",
  CARD: "Card",
  WALLET: "Wallet",
  CASH: "Cash",
};

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return (
    typeof value === "string" &&
    (PAYMENT_METHODS as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// PaymentStatus
// -------------------------------------------------------------------------

export const PAYMENT_STATUSES = [
  "SUCCESS",
  "FAILED",
  "REFUNDED",
  "PENDING",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  SUCCESS: "Success",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  PENDING: "Pending",
};

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return (
    typeof value === "string" &&
    (PAYMENT_STATUSES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// QuoteStatus
// -------------------------------------------------------------------------

export const QUOTE_STATUSES = [
  "DRAFT",
  "SENT",
  "VIEWED",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "REVISED",
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  REVISED: "Revised",
};

export function isQuoteStatus(value: unknown): value is QuoteStatus {
  return (
    typeof value === "string" &&
    (QUOTE_STATUSES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// IdempotencyStatus
// -------------------------------------------------------------------------

export const IDEMPOTENCY_STATUSES = ["PENDING", "COMPLETED", "FAILED"] as const;

export type IdempotencyStatus = (typeof IDEMPOTENCY_STATUSES)[number];

export const IDEMPOTENCY_STATUS_LABELS: Record<IdempotencyStatus, string> = {
  PENDING: "Pending",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

export function isIdempotencyStatus(
  value: unknown,
): value is IdempotencyStatus {
  return (
    typeof value === "string" &&
    (IDEMPOTENCY_STATUSES as readonly string[]).includes(value)
  );
}
