import { err, ok, type Result } from "@/app/lib/errors/result";
import { LeadCreditTxnType } from "@build/db";
import { clientWalletsRepository } from "./repository";
import type {
  DeductCreditsInput,
  DeductCreditsResult,
  WalletsDomainError,
} from "./contracts";

export class ClientWalletsService {
  async getWalletBalance(
    professionalId: string,
  ): Promise<Result<{ balance: number; ledger: any[] }, WalletsDomainError>> {
    try {
      const wallet = await clientWalletsRepository.getWallet(professionalId);
      return ok({
        balance: wallet?.balance ?? 0,
        ledger: wallet?.ledger ?? [],
      });
    } catch (error) {
      return err({
        code: "DATABASE_ERROR",
        message: "Failed to retrieve wallet balance",
        details: { error: String(error) },
      });
    }
  }

  /**
   * Deducts lead credits when a professional accepts a pre-qualified lead.
   * Atomic, ledger-backed, fail-safe.
   */
  async deductLeadCredits(
    input: DeductCreditsInput,
  ): Promise<Result<DeductCreditsResult, WalletsDomainError>> {
    if (input.amount <= 0) {
      return err({
        code: "INVALID_AMOUNT",
        message: "Deduction amount must be greater than zero",
      });
    }

    try {
      const result = await clientWalletsRepository.deductCredits(
        input.professionalId,
        input.amount,
        input.relatedLeadId,
        input.note,
      );
      return ok(result);
    } catch (error: any) {
      if (error?.message === "INSUFFICIENT_CREDITS") {
        return err({
          code: "INSUFFICIENT_CREDITS",
          message:
            "Insufficient lead credits. Please purchase credits to unlock this lead.",
        });
      }
      return err({
        code: "DATABASE_ERROR",
        message: "Failed to deduct lead credits",
        details: { error: String(error) },
      });
    }
  }

  async creditLeadWallet(
    professionalId: string,
    amount: number,
    type: LeadCreditTxnType = LeadCreditTxnType.PURCHASE,
    relatedTxId?: string,
    note?: string,
  ): Promise<Result<any, WalletsDomainError>> {
    if (amount <= 0) {
      return err({
        code: "INVALID_AMOUNT",
        message: "Credit amount must be greater than zero",
      });
    }

    try {
      const result = await clientWalletsRepository.grantCredits(
        professionalId,
        amount,
        type,
        relatedTxId,
        note,
      );
      return ok(result);
    } catch (error) {
      return err({
        code: "DATABASE_ERROR",
        message: "Failed to credit lead wallet",
        details: { error: String(error) },
      });
    }
  }
}

export const clientWalletsService = new ClientWalletsService();
