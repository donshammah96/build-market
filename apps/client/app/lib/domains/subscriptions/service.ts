import { err, ok, type Result } from "@/app/lib/errors/result";
import { SubscriptionTierKey } from "@build/db";
import { addMpesaStkInitiateJob } from "@build/queue-server";
import { randomUUID } from "node:crypto";
import { clientSubscriptionsRepository } from "./repository";
import {
  buildSubscriptionIdempotencyKey,
  calculateSubscriptionAmount,
} from "./checkout";
import type {
  ClientActor,
  InitiateSubscriptionCheckoutInput,
  SubscriptionCheckoutResult,
  PublicSubscriptionPlan,
  SubscriptionsDomainError,
} from "./contracts";

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

      const finalAmount = calculateSubscriptionAmount({
        monthlyPriceKES: Number(plan.priceMonthlyKES),
        annualPriceKES: plan.priceAnnualKES
          ? Number(plan.priceAnnualKES)
          : null,
        billingInterval: input.billingInterval,
        discountPct,
      });
      const idempotencyKey = buildSubscriptionIdempotencyKey({
        userId: actor.userId,
        planKey: input.planKey,
        billingInterval: input.billingInterval,
        clientKey: input.idempotencyKey,
      });

      const transaction =
        await clientSubscriptionsRepository.createPendingMpesaCheckout({
          userId: actor.userId,
          subscriptionId: existingSub?.id,
          amount: finalAmount,
          phoneNumber: formattedPhone,
          idempotencyKey,
          metadata: {
            planKey: String(input.planKey),
            billingInterval: String(input.billingInterval),
          },
        });
      await addMpesaStkInitiateJob({
        transactionId: transaction.id,
        correlationId: randomUUID(),
      });

      return ok({
        transactionId: transaction.id,
        checkoutRequestId: transaction.checkoutRequestId ?? null,
        merchantRequestId: null,
        amount: finalAmount,
        phoneNumber: formattedPhone,
        planName: plan.name,
        billingInterval: input.billingInterval,
        discountAppliedPct: discountPct,
        status: "QUEUED",
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
