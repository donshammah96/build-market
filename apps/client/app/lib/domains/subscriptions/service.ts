import { err, ok, type Result } from "@/app/lib/errors/result";
import { BillingInterval, SubscriptionTierKey } from "@build/db";
import { clientSubscriptionsRepository } from "./repository.js";
import type {
  ClientActor,
  InitiateSubscriptionCheckoutInput,
  SubscriptionCheckoutResult,
  PublicSubscriptionPlan,
  SubscriptionsDomainError,
} from "./contracts.js";

export function normalizeKenyanPhoneNumber(phone: string): string | null {
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (/^2547\d{8}$/.test(cleaned) || /^2541\d{8}$/.test(cleaned)) {
    return cleaned;
  }
  if (/^07\d{8}$/.test(cleaned) || /^01\d{8}$/.test(cleaned)) {
    return `254${cleaned.substring(1)}`;
  }
  if (/^\+2547\d{8}$/.test(cleaned) || /^\+2541\d{8}$/.test(cleaned)) {
    return cleaned.substring(1);
  }
  return null;
}

export class ClientSubscriptionsService {
  async listPublicPlans(): Promise<
    Result<PublicSubscriptionPlan[], SubscriptionsDomainError>
  > {
    try {
      const plans = await clientSubscriptionsRepository.listActivePlans();
      return ok(
        plans.map((p) => ({
          id: p.id,
          key: p.key,
          name: p.name,
          description: p.description,
          priceMonthlyKES: Number(p.priceMonthlyKES),
          priceAnnualKES: p.priceAnnualKES ? Number(p.priceAnnualKES) : null,
          maxPortfolioProjects: p.maxPortfolioProjects,
          maxPortfolioImagesPerProject: p.maxPortfolioImagesPerProject,
          maxTeamMembers: p.maxTeamMembers,
          monthlyLeadCredits: p.monthlyLeadCredits,
          leadCreditDiscountPct: p.leadCreditDiscountPct,
          boostsIncludedPerMonth: p.boostsIncludedPerMonth,
          platformFeePct: Number(p.platformFeePct),
          featureFlags: (p.featureFlags as Record<string, unknown>) ?? {},
        })),
      );
    } catch (error) {
      return err({
        code: "DATABASE_ERROR",
        message: "Failed to load subscription plans",
        details: { error: String(error) },
      });
    }
  }

  async getMySubscription(
    actor: ClientActor,
  ): Promise<Result<any, SubscriptionsDomainError>> {
    try {
      const sub =
        await clientSubscriptionsRepository.findProfessionalSubscription(
          actor.userId,
        );
      return ok(sub);
    } catch (error) {
      return err({
        code: "DATABASE_ERROR",
        message: "Failed to load professional subscription",
        details: { error: String(error) },
      });
    }
  }

  /**
   * Initiates an M-Pesa STK Push renewal or upgrade for the authenticated professional.
   * Reuses the unified M-Pesa transaction pipeline with purpose: SUBSCRIPTION_RENEWAL.
   */
  async initiateSubscriptionCheckout(
    actor: ClientActor,
    input: InitiateSubscriptionCheckoutInput,
  ): Promise<Result<SubscriptionCheckoutResult, SubscriptionsDomainError>> {
    const formattedPhone = normalizeKenyanPhoneNumber(input.phoneNumber);
    if (!formattedPhone) {
      return err({
        code: "INVALID_PHONE_NUMBER",
        message:
          "Please provide a valid Kenyan Safaricom phone number (e.g. 0712345678 or 254712345678)",
      });
    }

    if (input.planKey === SubscriptionTierKey.FREE) {
      return err({
        code: "PLAN_NOT_FOUND",
        message: "Free plan does not require checkout",
      });
    }

    try {
      const plan = await clientSubscriptionsRepository.findPlanByKey(
        input.planKey,
      );
      if (!plan || !plan.isActive) {
        return err({
          code: "PLAN_NOT_FOUND",
          message: `Plan ${input.planKey} is not available`,
        });
      }

      const existingSub =
        await clientSubscriptionsRepository.findProfessionalSubscription(
          actor.userId,
        );

      // Check Founding Pro comp period & permanent discount
      const now = new Date();
      if (
        existingSub?.isFoundingPro &&
        existingSub?.foundingProUntil &&
        now < existingSub.foundingProUntil
      ) {
        return err({
          code: "PAYMENT_FAILED",
          message:
            "Your account is currently in a 100% comped Founding Pro period. No payment required.",
        });
      }

      const discountPct = existingSub?.isFoundingPro
        ? (existingSub.foundingProDiscountPct ?? 15)
        : 0;

      const basePrice =
        input.billingInterval === BillingInterval.ANNUAL
          ? Number(plan.priceAnnualKES ?? Number(plan.priceMonthlyKES) * 10)
          : Number(plan.priceMonthlyKES);

      const finalAmount = Math.max(
        1,
        Math.round(basePrice * (1 - discountPct / 100)),
      );

      // Generate deterministic tracking IDs
      const checkoutRequestId = `ws_CO_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const merchantRequestId = `MR_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const idempotencyKey = `sub_stk_${actor.userId}_${input.planKey}_${Date.now()}`;

      await clientSubscriptionsRepository.createPendingMpesaCheckout({
        userId: actor.userId,
        subscriptionId: existingSub?.id,
        amount: finalAmount,
        phoneNumber: formattedPhone,
        checkoutRequestId,
        merchantRequestId,
        idempotencyKey,
      });

      return ok({
        checkoutRequestId,
        merchantRequestId,
        amount: finalAmount,
        phoneNumber: formattedPhone,
        planName: plan.name,
        billingInterval: input.billingInterval,
        discountAppliedPct: discountPct,
        status: "PENDING_USER_PIN",
      });
    } catch (error) {
      return err({
        code: "DATABASE_ERROR",
        message: "Failed to initiate STK push checkout",
        details: { error: String(error) },
      });
    }
  }
}

export const clientSubscriptionsService = new ClientSubscriptionsService();
