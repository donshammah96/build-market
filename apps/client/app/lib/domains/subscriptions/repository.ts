import {
  prisma,
  type SubscriptionTierKey,
  BillingInterval,
  SubscriptionStatus,
  TransactionCategory,
  TransactionType,
  PaymentMethod,
  MpesaTransactionPurpose,
  MpesaTransactionType,
} from "@build/db";

export class ClientSubscriptionsRepository {
  async listActivePlans() {
    return prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  async findPlanByKey(key: SubscriptionTierKey) {
    return prisma.subscriptionPlan.findUnique({
      where: { key },
    });
  }

  async findProfessionalSubscription(professionalId: string) {
    return prisma.professionalSubscription.findUnique({
      where: { professionalId },
      include: { plan: true },
    });
  }

  async createPendingMpesaCheckout(params: {
    userId: string;
    subscriptionId?: string;
    amount: number;
    phoneNumber: string;
    checkoutRequestId?: string | null;
    merchantRequestId?: string | null;
    idempotencyKey: string;
    metadata?: Record<string, string>;
  }) {
    return prisma.mpesaTransaction.upsert({
      where: { idempotencyKey: params.idempotencyKey },
      create: {
        userId: params.userId,
        subscriptionId: params.subscriptionId,
        purpose: MpesaTransactionPurpose.SUBSCRIPTION_RENEWAL,
        transactionType: MpesaTransactionType.CUSTOMER_PAY_BILL_ONLINE,
        amount: params.amount,
        phoneNumber: params.phoneNumber,
        checkoutRequestId: params.checkoutRequestId,
        merchantRequestId: params.merchantRequestId,
        idempotencyKey: params.idempotencyKey,
        metadata: params.metadata,
      },
      update: {},
    });
  }

  /**
   * Settles subscription renewal upon successful M-Pesa STK callback:
   * 1. Extends current period by 1 month or 1 year.
   * 2. Sets status to ACTIVE, clears grace period.
   * 3. Records immutable ProfessionalTransaction for reporting.
   */
  async settleSubscriptionRenewal(params: {
    professionalId: string;
    planId: string;
    billingInterval: BillingInterval;
    amountPaidKES: number;
    mpesaReceiptNumber: string;
  }) {
    const now = new Date();
    const periodEnd = new Date(now);
    if (params.billingInterval === BillingInterval.ANNUAL) {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    return prisma.$transaction(async (tx) => {
      const sub = await tx.professionalSubscription.upsert({
        where: { professionalId: params.professionalId },
        create: {
          professionalId: params.professionalId,
          planId: params.planId,
          status: SubscriptionStatus.ACTIVE,
          billingInterval: params.billingInterval,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          graceEndsAt: null,
        },
        update: {
          planId: params.planId,
          status: SubscriptionStatus.ACTIVE,
          billingInterval: params.billingInterval,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          graceEndsAt: null,
          lastPaymentAttemptAt: now,
          lastPaymentFailReason: null,
        },
      });

      const proTx = await tx.professionalTransaction.create({
        data: {
          professionalId: params.professionalId,
          subscriptionId: sub.id,
          description: `Subscription renewal (${params.billingInterval.toLowerCase()})`,
          type: TransactionType.EXPENSE,
          category: TransactionCategory.SUBSCRIPTION_FEE,
          method: PaymentMethod.MPESA,
          amount: params.amountPaidKES,
          referenceCode: params.mpesaReceiptNumber,
          status: "SUCCESS" as any,
          completedAt: now,
        },
      });

      return { subscription: sub, transaction: proTx };
    });
  }
}

export const clientSubscriptionsRepository =
  new ClientSubscriptionsRepository();
