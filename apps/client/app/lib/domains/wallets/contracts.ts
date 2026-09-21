export type WalletsDomainErrorCode =
  | "INSUFFICIENT_CREDITS"
  | "WALLET_NOT_FOUND"
  | "DATABASE_ERROR"
  | "INVALID_AMOUNT";

export interface WalletsDomainError {
  code: WalletsDomainErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface DeductCreditsInput {
  professionalId: string;
  amount: number;
  relatedLeadId?: string;
  note?: string;
}

export interface DeductCreditsResult {
  previousBalance: number;
  balanceAfter: number;
  amountDeducted: number;
  ledgerEntryId: string;
}

export interface PurchaseCreditsInput {
  professionalId: string;
  credits: number;
  costKES: number;
  relatedTransactionId: string;
}
