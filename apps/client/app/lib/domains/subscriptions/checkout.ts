import type { BillingInterval, SubscriptionTierKey } from "@build/db";

export function calculateSubscriptionAmount(params: {
  monthlyPriceKES: number;
  annualPriceKES: number | null;
  billingInterval: BillingInterval | "MONTHLY" | "ANNUAL";
  discountPct: number;
}): number {
  const basePrice =
    params.billingInterval === "ANNUAL"
      ? (params.annualPriceKES ?? params.monthlyPriceKES * 10)
      : params.monthlyPriceKES;
  return Math.max(1, Math.round(basePrice * (1 - params.discountPct / 100)));
}

export function buildSubscriptionIdempotencyKey(params: {
  userId: string;
  planKey: SubscriptionTierKey | string;
  billingInterval: BillingInterval | string;
  clientKey: string;
}): string {
  return `sub_stk:${params.userId}:${params.planKey}:${params.billingInterval}:${params.clientKey}`;
}
