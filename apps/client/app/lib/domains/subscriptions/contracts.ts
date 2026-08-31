import type { SubscriptionTierKey, BillingInterval } from "@build/db";

export type SubscriptionsDomainErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "PLAN_NOT_FOUND"
  | "SUBSCRIPTION_NOT_FOUND"
  | "INVALID_PHONE_NUMBER"
  | "PAYMENT_FAILED"
  | "DATABASE_ERROR";

export interface SubscriptionsDomainError {
  code: SubscriptionsDomainErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface ClientActor {
  userId: string;
  role: string;
}

export interface InitiateSubscriptionCheckoutInput {
  planKey: SubscriptionTierKey;
  billingInterval: BillingInterval;
  phoneNumber: string; // e.g. 254712345678
  idempotencyKey: string;
}

export interface SubscriptionCheckoutResult {
  transactionId: string;
  checkoutRequestId: string | null;
  merchantRequestId: string | null;
  amount: number;
  phoneNumber: string;
  planName: string;
  billingInterval: BillingInterval;
  discountAppliedPct: number;
  status: "QUEUED";
}

export interface PublicSubscriptionPlan {
  id: string;
  key: SubscriptionTierKey;
  name: string;
  description: string | null;
  priceMonthlyKES: number;
  priceAnnualKES: number | null;
  maxPortfolioProjects: number | null;
  maxPortfolioImagesPerProject: number | null;
  maxTeamMembers: number | null;
  monthlyLeadCredits: number;
  leadCreditDiscountPct: number;
  boostsIncludedPerMonth: number;
  platformFeePct: number;
  featureFlags: Record<string, unknown>;
}
