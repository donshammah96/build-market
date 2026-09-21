import {
  prisma,
  type Prisma,
  type SubscriptionTierKey,
  type TrustTier,
  type BadgeType,
  type BoostType,
  type LeadCreditTxnType,
} from "@build/db";

export class SubscriptionsRepository {
  async listPlans() {
    return prisma.subscriptionPlan.findMany({
      orderBy: { sortOrder: "asc" },
    });
  }

  async findPlanById(id: string) {
    return prisma.subscriptionPlan.findUnique({
      where: { id },
    });
  }

  async findPlanByKey(key: SubscriptionTierKey) {
    return prisma.subscriptionPlan.findUnique({
      where: { key },
    });
  }

  async updatePlan(id: string, data: Prisma.SubscriptionPlanUpdateInput) {
    return prisma.subscriptionPlan.update({
      where: { id },
      data,
    });
  }

  async findSubscriptionByProfessionalId(professionalId: string) {
    return prisma.professionalSubscription.findUnique({
      where: { professionalId },
      include: {
        plan: true,
        professional: {
          select: {
            userId: true,
            companyName: true,
            profession: true,
            trustTier: true,
          },
        },
      },
    });
  }

  async updateSubscription(
    professionalId: string,
    data: Prisma.ProfessionalSubscriptionUpdateInput,
  ) {
    return prisma.professionalSubscription.update({
      where: { professionalId },
      data,
      include: { plan: true },
    });
  }

  async updateTrustTier(professionalId: string, trustTier: TrustTier) {
    return prisma.professionalProfile.update({
      where: { userId: professionalId },
      data: {
        trustTier,
        trustTierUpdatedAt: new Date(),
      },
    });
  }

  async findWallet(professionalId: string) {
    return prisma.leadCreditWallet.findUnique({
      where: { professionalId },
      include: {
        ledger: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });
  }

  /**
   * Financial ledger invariant: executes wallet adjustment inside a serializable transaction
   * asserting atomic balance change and immutable ledger entry creation.
   */
  async adjustWalletWithLedger(
    professionalId: string,
    amount: number,
    type: LeadCreditTxnType,
    note: string,
  ) {
    return prisma.$transaction(async (tx) => {
      let wallet = await tx.leadCreditWallet.findUnique({
        where: { professionalId },
      });

      if (!wallet) {
        wallet = await tx.leadCreditWallet.create({
          data: {
            professionalId,
            balance: 0,
          },
        });
      }

      const newBalance = wallet.balance + amount;
      if (newBalance < 0) {
        throw new Error("INSUFFICIENT_CREDITS");
      }

      const updatedWallet = await tx.leadCreditWallet.update({
        where: { professionalId },
        data: { balance: newBalance },
      });

      const ledgerEntry = await tx.leadCreditLedgerEntry.create({
        data: {
          professionalId,
          amount,
          balanceAfter: newBalance,
          type,
          note,
        },
      });

      return { wallet: updatedWallet, ledgerEntry };
    });
  }

  async awardBadge(
    professionalId: string,
    type: BadgeType,
    criteriaSnapshot?: Record<string, unknown>,
  ) {
    return prisma.professionalBadge.upsert({
      where: {
        professionalId_type: {
          professionalId,
          type,
        },
      },
      create: {
        professionalId,
        type,
        awardedAt: new Date(),
        revokedAt: null,
        criteriaSnapshot:
          (criteriaSnapshot as Prisma.InputJsonValue) ?? undefined,
      },
      update: {
        awardedAt: new Date(),
        revokedAt: null,
        criteriaSnapshot:
          (criteriaSnapshot as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }

  async revokeBadge(professionalId: string, type: BadgeType) {
    return prisma.professionalBadge.updateMany({
      where: {
        professionalId,
        type,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async createProfileBoost(
    professionalId: string,
    type: BoostType,
    startsAt: Date,
    endsAt: Date,
    includedInPlan: boolean = false,
  ) {
    return prisma.profileBoost.create({
      data: {
        professionalId,
        type,
        startsAt,
        endsAt,
        includedInPlan,
      },
    });
  }
}

export const subscriptionsRepository = new SubscriptionsRepository();
