import {
  BillingInterval,
  EscrowStatus,
  LeadCreditTxnType,
  PaymentMethod,
  SubscriptionStatus,
  TransactionCategory,
  TransactionStatus,
  TransactionType,
  type Prisma,
} from "@build/db";

export interface SettlementInput {
  transactionId: string;
  resultCode: number;
  resultDesc?: string;
  receiptNumber?: string;
  providerPayload?: Record<string, unknown>;
  callbackEventId?: string;
}

export interface SettlementResult {
  transactionId: string;
  status: TransactionStatus;
  isTerminal: boolean;
  settled: boolean;
}

const TERMINAL_STATUSES: readonly TransactionStatus[] = [
  TransactionStatus.SUCCESS,
  TransactionStatus.REVERSED,
  TransactionStatus.REFUNDED,
  TransactionStatus.CANCELLED,
  TransactionStatus.COMPLETED,
];

export async function executeMpesaStkSettlement(
  tx: Prisma.TransactionClient,
  input: SettlementInput,
): Promise<SettlementResult> {
  const transaction = await tx.mpesaTransaction.findUnique({
    where: { id: input.transactionId },
  });
  if (!transaction) {
    throw new Error(`M-Pesa transaction not found: ${input.transactionId}`);
  }

  const isTerminal = TERMINAL_STATUSES.includes(transaction.status);
  if (isTerminal) {
    if (input.callbackEventId) {
      await tx.mpesaCallbackEvent.update({
        where: { id: input.callbackEventId },
        data: { processingStatus: "PROCESSED", processedAt: new Date() },
      });
    }
    return {
      transactionId: transaction.id,
      status: transaction.status,
      isTerminal: true,
      settled: false,
    };
  }

  const isSuccess = input.resultCode === 0;
  const nextStatus = isSuccess
    ? TransactionStatus.SUCCESS
    : TransactionStatus.FAILED;

  await tx.mpesaTransaction.update({
    where: { id: transaction.id },
    data: {
      status: nextStatus,
      resultCode: String(input.resultCode),
      resultDesc: input.resultDesc,
      mpesaReceiptNumber: input.receiptNumber ?? transaction.mpesaReceiptNumber,
      callbackReceivedAt: new Date(),
      callbackPayload:
        (input.providerPayload as Prisma.InputJsonValue) ?? undefined,
      callbackEventCount: { increment: 1 },
    },
  });

  let settled = false;

  if (isSuccess) {
    const receipt = input.receiptNumber || transaction.id;
    const metadata = (transaction.metadata ?? {}) as Record<string, unknown>;

    // 1. Subscription renewal settlement
    if (
      transaction.purpose === "SUBSCRIPTION_RENEWAL" &&
      transaction.subscriptionId
    ) {
      const subscription = await tx.professionalSubscription.findUnique({
        where: { id: transaction.subscriptionId },
      });
      if (subscription) {
        const planKey = metadata.planKey as string | undefined;
        const plan = planKey
          ? await tx.subscriptionPlan.findUnique({
              where: { key: planKey as never },
            })
          : null;
        const interval =
          metadata.billingInterval === "ANNUAL"
            ? BillingInterval.ANNUAL
            : BillingInterval.MONTHLY;
        const start =
          subscription.currentPeriodEnd &&
          subscription.currentPeriodEnd > new Date()
            ? subscription.currentPeriodEnd
            : new Date();
        const end = new Date(start);
        if (interval === BillingInterval.ANNUAL) {
          end.setFullYear(end.getFullYear() + 1);
        } else {
          end.setMonth(end.getMonth() + 1);
        }

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
        settled = true;
      }
    }

    // 2. Lead credit purchase settlement
    if (transaction.purpose === "LEAD_CREDIT_PURCHASE") {
      const credits =
        typeof metadata.credits === "number" && metadata.credits > 0
          ? metadata.credits
          : 0;
      const professionalId = transaction.userId;
      const settlementKey = `mpesa:${transaction.id}:lead-credit`;

      let wallet = await tx.leadCreditWallet.findUnique({
        where: { professionalId },
      });
      if (!wallet) {
        wallet = await tx.leadCreditWallet.create({
          data: { professionalId, balance: 0 },
        });
      }

      const balanceAfter = wallet.balance + credits;
      await tx.leadCreditWallet.update({
        where: { professionalId },
        data: { balance: balanceAfter },
      });

      await tx.leadCreditLedgerEntry.create({
        data: {
          professionalId,
          type: LeadCreditTxnType.PURCHASE,
          amount: credits,
          balanceAfter,
          settlementKey,
          note: `M-Pesa Lead Credits Top-up (Ref: ${receipt})`,
        },
      });

      await tx.professionalTransaction.create({
        data: {
          professionalId,
          description: `Purchased ${credits} lead credits`,
          type: TransactionType.EXPENSE,
          category: TransactionCategory.LEAD_PURCHASE,
          method: PaymentMethod.MPESA,
          amount: transaction.amount,
          referenceCode: receipt,
          status: TransactionStatus.SUCCESS,
          completedAt: new Date(),
        },
      });
      settled = true;
    }

    // 3. Escrow milestone funding settlement
    if (transaction.purpose === "ESCROW_FUNDING") {
      const milestoneId =
        (metadata.milestoneId as string | undefined) || transaction.escrowId;
      const settlementKey = `mpesa:${transaction.id}:escrow`;

      if (milestoneId) {
        const escrow = await tx.escrowTransaction.findFirst({
          where: {
            OR: [{ milestoneId }, { id: milestoneId }],
          },
        });

        if (escrow && escrow.status === EscrowStatus.PENDING_FUNDING) {
          await tx.escrowTransaction.update({
            where: { id: escrow.id },
            data: {
              status: EscrowStatus.FUNDS_HELD,
              fundedAt: new Date(),
              fundingRef: receipt,
              settlementKey,
            },
          });

          if (escrow.milestoneId) {
            await tx.projectMilestone.update({
              where: { id: escrow.milestoneId },
              data: {
                isPaid: true,
              },
            });
          }
          settled = true;
        }
      }
    }
  }

  if (input.callbackEventId) {
    await tx.mpesaCallbackEvent.update({
      where: { id: input.callbackEventId },
      data: { processingStatus: "PROCESSED", processedAt: new Date() },
    });
  }

  return {
    transactionId: transaction.id,
    status: nextStatus,
    isTerminal: false,
    settled,
  };
}
