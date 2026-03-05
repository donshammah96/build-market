/**
 * Finance Service Layer
 *
 * Core business logic for professional-portal finance operations.
 */
import { prisma } from "../db";
import { PaymentMethod } from "@build/db";
import { getFinancialSettings } from "@build/db/system-settings";
import {
  transactionListSelect,
  transactionDetailSelect,
  serializeTransactionDecimals,
} from "@/lib/validation/finance-validation";
import type { TransactionQueryInput } from "@/lib/validation/finance-validation";

export type { TransactionQueryInput };

export type FinanceStats = {
  totalEarnings: number;
  totalNetEarnings: number;
  pendingPayouts: number;
  outstandingInvoices: number;
  availableBalance: number;
};

export async function getFinanceStats(dbUserId: string): Promise<FinanceStats> {
  const [income, pendingPayouts, outstandingInvoices, completedWithdrawals] =
    await Promise.all([
      prisma.professionalTransaction.aggregate({
        where: {
          professionalId: dbUserId,
          type: "INCOME",
          status: "SUCCESS",
        },
        _sum: { amount: true, netAmount: true },
      }),
      prisma.professionalTransaction.aggregate({
        where: {
          professionalId: dbUserId,
          type: "WITHDRAWAL",
          status: { in: ["PENDING", "PROCESSING"] },
        },
        _sum: { amount: true },
      }),
      prisma.professionalTransaction.aggregate({
        where: {
          professionalId: dbUserId,
          type: "INCOME",
          status: { in: ["PENDING", "PROCESSING"] },
        },
        _sum: { amount: true },
      }),
      prisma.professionalTransaction.aggregate({
        where: {
          professionalId: dbUserId,
          type: "WITHDRAWAL",
          status: "SUCCESS",
        },
        _sum: { amount: true },
      }),
    ]);

  const totalEarnings = Number(income._sum.amount ?? 0);
  const totalNetEarnings = Number(income._sum.netAmount ?? 0);
  const totalPendingPayouts = Number(pendingPayouts._sum.amount ?? 0);
  const totalOutstandingInvoices = Number(outstandingInvoices._sum.amount ?? 0);
  const totalCompletedWithdrawals = Number(
    completedWithdrawals._sum.amount ?? 0,
  );

  return {
    totalEarnings,
    totalNetEarnings,
    pendingPayouts: totalPendingPayouts,
    outstandingInvoices: totalOutstandingInvoices,
    availableBalance:
      totalNetEarnings - totalCompletedWithdrawals - totalPendingPayouts,
  };
}

export type TransactionsResult = {
  data: unknown[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function getProfessionalTransactions(
  dbUserId: string,
  query: TransactionQueryInput,
): Promise<TransactionsResult> {
  const { page, limit, type, status, category } = query;
  const skip = (page - 1) * limit;

  const where = {
    professionalId: dbUserId,
    ...(type && { type }),
    ...(status && { status }),
    ...(category && { category }),
  };

  const [transactions, total] = await Promise.all([
    prisma.professionalTransaction.findMany({
      where,
      select: transactionListSelect,
      orderBy: { date: "desc" },
      skip,
      take: limit,
    }),
    prisma.professionalTransaction.count({ where }),
  ]);

  return {
    data: transactions.map(serializeTransactionDecimals),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export type CreateWithdrawalInput = {
  amount: number;
  method: PaymentMethod;
  description?: string;
};

export type CreateWithdrawalResult =
  | { data: unknown }
  | { error: "insufficient_funds"; availableBalance: number }
  | { error: "below_minimum"; min: number }
  | { error: "above_maximum"; max: number };

export async function createWithdrawal(
  dbUserId: string,
  input: CreateWithdrawalInput,
): Promise<CreateWithdrawalResult> {
  const { amount, method, description } = input;

  const financialSettings = await getFinancialSettings();
  if (amount < financialSettings.minWithdrawalKes) {
    return { error: "below_minimum", min: financialSettings.minWithdrawalKes };
  }
  if (amount > financialSettings.maxWithdrawalKes) {
    return { error: "above_maximum", max: financialSettings.maxWithdrawalKes };
  }

  const [income, withdrawals] = await Promise.all([
    prisma.professionalTransaction.aggregate({
      where: {
        professionalId: dbUserId,
        type: "INCOME",
        status: "SUCCESS",
      },
      _sum: { netAmount: true },
    }),
    prisma.professionalTransaction.aggregate({
      where: {
        professionalId: dbUserId,
        type: "WITHDRAWAL",
        status: { in: ["SUCCESS", "PENDING", "PROCESSING"] },
      },
      _sum: { amount: true },
    }),
  ]);

  const totalNetIncome = Number(income._sum.netAmount ?? 0);
  const totalWithdrawals = Number(withdrawals._sum.amount ?? 0);
  const availableBalance = totalNetIncome - totalWithdrawals;

  if (amount > availableBalance) {
    return { error: "insufficient_funds", availableBalance };
  }

  const transaction = await prisma.professionalTransaction.create({
    data: {
      professionalId: dbUserId,
      description: description || "Withdrawal Request",
      type: "WITHDRAWAL",
      category: "WITHDRAWAL",
      method,
      amount,
      netAmount: amount,
      status: "PENDING",
      date: new Date(),
    },
    select: transactionDetailSelect,
  });

  return { data: serializeTransactionDecimals(transaction) };
}
