import { prisma, LeadCreditTxnType } from "@build/db";

export class ClientWalletsRepository {
  async getWallet(professionalId: string) {
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
   * Deducts lead credits within a serializable transaction with immutable ledger audit entry.
   */
  async deductCredits(
    professionalId: string,
    amount: number,
    relatedLeadId?: string,
    note?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      let wallet = await tx.leadCreditWallet.findUnique({
        where: { professionalId },
      });

      if (!wallet) {
        wallet = await tx.leadCreditWallet.create({
          data: { professionalId, balance: 0 },
        });
      }

      if (wallet.balance < amount) {
        throw new Error("INSUFFICIENT_CREDITS");
      }

      const balanceAfter = wallet.balance - amount;

      await tx.leadCreditWallet.update({
        where: { professionalId },
        data: { balance: balanceAfter },
      });

      const entry = await tx.leadCreditLedgerEntry.create({
        data: {
          professionalId,
          type: LeadCreditTxnType.CONSUME,
          amount: -amount,
          balanceAfter,
          relatedLeadId,
          note: note ?? "Marketplace lead contact unlocked",
        },
      });

      return {
        previousBalance: wallet.balance,
        balanceAfter,
        amountDeducted: amount,
        ledgerEntryId: entry.id,
      };
    });
  }

  /**
   * Credits lead wallet upon top-up purchase or monthly grant.
   */
  async grantCredits(
    professionalId: string,
    amount: number,
    type: LeadCreditTxnType,
    relatedTxId?: string,
    note?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      let wallet = await tx.leadCreditWallet.findUnique({
        where: { professionalId },
      });

      if (!wallet) {
        wallet = await tx.leadCreditWallet.create({
          data: { professionalId, balance: 0 },
        });
      }

      const balanceAfter = wallet.balance + amount;

      await tx.leadCreditWallet.update({
        where: { professionalId },
        data: { balance: balanceAfter },
      });

      const entry = await tx.leadCreditLedgerEntry.create({
        data: {
          professionalId,
          type,
          amount,
          balanceAfter,
          relatedTransactionId: relatedTxId,
          note: note ?? "Lead credits grant",
        },
      });

      return { wallet, entry };
    });
  }
}

export const clientWalletsRepository = new ClientWalletsRepository();
