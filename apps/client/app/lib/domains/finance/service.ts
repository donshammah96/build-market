import { prisma } from "@build/db";
import { getFinancialSettings } from "@/app/lib/domains/settings";
import { ok, err } from "@/app/lib/errors/result";
import { toFinanceDto } from "./mappers";
import { normalizeRole } from "@/app/lib/security/roles";
import {
  serializeTransactionDecimals,
  transactionDetailSelect,
  transactionListSelect,
} from "@/app/lib/validation/finance-validation";
import { enforceClientMutationPolicy } from "@/app/lib/domains/user-profile";
import type {
  FinanceActor,
  FinanceDeleteResult,
  ProjectFinanceStats,
  FinanceResult,
  FinanceStats,
  FinanceTransactionDetail,
  FinanceTransactionsResult,
  TransactionQueryInput,
  UpdateTransactionInput,
  WithdrawInput,
} from "@/app/lib/domains/finance/contracts";

const FINANCE_ALLOWED_ROLES = new Set(["PROFESSIONAL", "ADMIN"]);

function toIsoDateString(value: Date | string): string {
  return value instanceof Date
    ? (toFinanceDto(value) as unknown as string)
    : value;
}

function toIsoDateStringNullable(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }

  return value instanceof Date
    ? (toFinanceDto(value) as unknown as string)
    : value;
}

function normalizeListTransactionDates<
  T extends {
    date: Date | string;
    createdAt: Date | string;
    completedAt: Date | string | null;
  },
>(
  transaction: T,
): Omit<T, "date" | "createdAt" | "completedAt"> & {
  date: string;
  createdAt: string;
  completedAt: string | null;
} {
  return {
    ...transaction,
    date: toIsoDateString(transaction.date),
    createdAt: toIsoDateString(transaction.createdAt),
    completedAt: toIsoDateStringNullable(transaction.completedAt),
  };
}

function normalizeDetailTransactionDates(
  transaction: Omit<
    FinanceTransactionDetail,
    "date" | "createdAt" | "completedAt" | "updatedAt"
  > & {
    date: Date | string;
    createdAt: Date | string;
    completedAt: Date | string | null;
    updatedAt: Date | string;
  },
): FinanceTransactionDetail {
  const { updatedAt, ...listTransaction } = transaction;

  return {
    ...normalizeListTransactionDates(listTransaction),
    updatedAt: toIsoDateString(updatedAt),
  };
}

function requireFinanceActor(
  actor: FinanceActor,
): FinanceResult<{ userId: string }> {
  const role = normalizeRole(actor.role);
  if (!role || !FINANCE_ALLOWED_ROLES.has(role)) {
    return err({ error: "forbidden", message: "Forbidden", status: 403 });
  }

  return ok({ userId: actor.userId });
}

async function getOwnedTransaction(
  actor: FinanceActor,
  transactionId: string,
): Promise<FinanceResult<FinanceTransactionDetail>> {
  const actorResult = requireFinanceActor(actor);
  if (!actorResult.ok) {
    return actorResult;
  }

  const transaction = await prisma.professionalTransaction.findUnique({
    where: {
      id: transactionId,
      professionalId: actorResult.data.userId,
    },
    select: transactionDetailSelect,
  });

  if (!transaction) {
    return err({
      error: "not_found",
      message: "Transaction not found",
      status: 404,
    });
  }

  return ok(
    normalizeDetailTransactionDates(serializeTransactionDecimals(transaction)),
  );
}

async function getOwnedProject(
  actor: FinanceActor,
  projectId: string,
): Promise<FinanceResult<{ id: string; title: string }>> {
  const actorResult = requireFinanceActor(actor);
  if (!actorResult.ok) {
    return actorResult;
  }

  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
      professionalId: actorResult.data.userId,
      deletedAt: null,
    },
    select: { id: true, title: true },
  });

  if (!project) {
    return err({
      error: "not_found",
      message: "Project not found",
      status: 404,
    });
  }

  return ok(project);
}

export const financeService = {
  async getFinanceStats(
    actor: FinanceActor,
  ): Promise<FinanceResult<FinanceStats>> {
    const actorResult = requireFinanceActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }

    const userId = actorResult.data.userId;
    const [income, pendingPayouts, outstandingInvoices, completedWithdrawals] =
      await Promise.all([
        prisma.professionalTransaction.aggregate({
          where: {
            professionalId: userId,
            type: "INCOME",
            status: "SUCCESS",
          },
          _sum: { amount: true, netAmount: true },
        }),
        prisma.professionalTransaction.aggregate({
          where: {
            professionalId: userId,
            type: "WITHDRAWAL",
            status: { in: ["PENDING", "PROCESSING"] },
          },
          _sum: { amount: true },
        }),
        prisma.professionalTransaction.aggregate({
          where: {
            professionalId: userId,
            type: "INCOME",
            status: { in: ["PENDING", "PROCESSING"] },
          },
          _sum: { amount: true },
        }),
        prisma.professionalTransaction.aggregate({
          where: {
            professionalId: userId,
            type: "WITHDRAWAL",
            status: "SUCCESS",
          },
          _sum: { amount: true },
        }),
      ]);

    const totalEarnings = Number(income._sum.amount ?? 0);
    const totalNetEarnings = Number(income._sum.netAmount ?? 0);
    const totalPendingPayouts = Number(pendingPayouts._sum.amount ?? 0);
    const totalOutstandingInvoices = Number(
      outstandingInvoices._sum.amount ?? 0,
    );
    const totalCompletedWithdrawals = Number(
      completedWithdrawals._sum.amount ?? 0,
    );

    return ok({
      totalEarnings,
      totalNetEarnings,
      pendingPayouts: totalPendingPayouts,
      outstandingInvoices: totalOutstandingInvoices,
      availableBalance:
        totalNetEarnings - totalCompletedWithdrawals - totalPendingPayouts,
    });
  },

  async listTransactions(
    actor: FinanceActor,
    query: TransactionQueryInput,
  ): Promise<FinanceResult<FinanceTransactionsResult>> {
    const actorResult = requireFinanceActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }

    const { page, limit, type, status, category } = query;
    const skip = (page - 1) * limit;
    const where = {
      professionalId: actorResult.data.userId,
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

    return ok({
      data: transactions.map((transaction) =>
        normalizeListTransactionDates(
          serializeTransactionDecimals(transaction),
        ),
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  },

  async getProjectStats(
    actor: FinanceActor,
    projectId: string,
  ): Promise<FinanceResult<ProjectFinanceStats>> {
    const projectResult = await getOwnedProject(actor, projectId);
    if (!projectResult.ok) {
      return projectResult;
    }

    const actorResult = requireFinanceActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }

    const userId = actorResult.data.userId;
    const [income, pendingIncome, transactionCount] = await Promise.all([
      prisma.professionalTransaction.aggregate({
        where: {
          professionalId: userId,
          projectId,
          type: "INCOME",
          status: "SUCCESS",
        },
        _sum: {
          amount: true,
          netAmount: true,
          platformFee: true,
          taxAmount: true,
        },
      }),
      prisma.professionalTransaction.aggregate({
        where: {
          professionalId: userId,
          projectId,
          type: "INCOME",
          status: { in: ["PENDING", "PROCESSING"] },
        },
        _sum: { amount: true },
      }),
      prisma.professionalTransaction.count({
        where: { professionalId: userId, projectId },
      }),
    ]);

    return ok({
      projectId,
      projectTitle: projectResult.data.title,
      totalEarnings: Number(income._sum.amount ?? 0),
      totalNetEarnings: Number(income._sum.netAmount ?? 0),
      totalPlatformFees: Number(income._sum.platformFee ?? 0),
      totalTax: Number(income._sum.taxAmount ?? 0),
      pendingIncome: Number(pendingIncome._sum.amount ?? 0),
      transactionCount,
    });
  },

  async getTransactionDetail(
    actor: FinanceActor,
    transactionId: string,
  ): Promise<FinanceResult<FinanceTransactionDetail>> {
    return getOwnedTransaction(actor, transactionId);
  },

  async updateTransaction(
    actor: FinanceActor,
    transactionId: string,
    updateData: UpdateTransactionInput,
  ): Promise<FinanceResult<FinanceTransactionDetail>> {
    const existing = await getOwnedTransaction(actor, transactionId);
    if (!existing.ok) {
      return existing;
    }

    const updated = await prisma.professionalTransaction.update({
      where: { id: transactionId },
      data: updateData,
      select: transactionDetailSelect,
    });

    return ok(
      normalizeDetailTransactionDates(serializeTransactionDecimals(updated)),
    );
  },

  async deleteTransaction(
    actor: FinanceActor,
    transactionId: string,
  ): Promise<FinanceResult<FinanceDeleteResult>> {
    const existing = await getOwnedTransaction(actor, transactionId);
    if (!existing.ok) {
      return existing;
    }

    if (!["PENDING", "CANCELLED"].includes(existing.data.status)) {
      return err({
        error: "not_deletable",
        message: "Only PENDING or CANCELLED transactions can be deleted",
        status: 400,
      });
    }

    await prisma.professionalTransaction.delete({
      where: { id: transactionId },
    });

    return ok({ message: "Transaction deleted successfully" });
  },

  async createWithdrawal(
    actor: FinanceActor,
    input: WithdrawInput,
  ): Promise<FinanceResult<FinanceTransactionDetail>> {
    const actorResult = requireFinanceActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }

    const paymentInitiationPolicy = await enforceClientMutationPolicy({
      clientUserId: actorResult.data.userId,
      policy: "paymentInitiationPolicy",
    });
    if (!paymentInitiationPolicy.ok) {
      return err({
        error: "forbidden",
        message: paymentInitiationPolicy.message,
        status: 403,
      });
    }

    const { amount, method, description } = input;
    const financialSettings = await getFinancialSettings();

    if (amount < financialSettings.minWithdrawalKes) {
      return err({
        error: "below_minimum",
        message: `Withdrawal amount is below the minimum of ${financialSettings.minWithdrawalKes} KES`,
        min: financialSettings.minWithdrawalKes,
        status: 400,
      });
    }

    if (amount > financialSettings.maxWithdrawalKes) {
      return err({
        error: "above_maximum",
        message: `Withdrawal amount exceeds the maximum of ${financialSettings.maxWithdrawalKes} KES`,
        max: financialSettings.maxWithdrawalKes,
        status: 400,
      });
    }

    const userId = actorResult.data.userId;
    const [income, withdrawals] = await Promise.all([
      prisma.professionalTransaction.aggregate({
        where: {
          professionalId: userId,
          type: "INCOME",
          status: "SUCCESS",
        },
        _sum: { netAmount: true },
      }),
      prisma.professionalTransaction.aggregate({
        where: {
          professionalId: userId,
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
      return err({
        error: "insufficient_funds",
        message: `Insufficient funds. Available balance: ${availableBalance}`,
        availableBalance,
        status: 400,
      });
    }

    const transaction = await prisma.professionalTransaction.create({
      data: {
        professionalId: userId,
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

    return ok(
      normalizeDetailTransactionDates(
        serializeTransactionDecimals(transaction),
      ),
    );
  },

  async getWithdrawal(
    actor: FinanceActor,
    transactionId: string,
  ): Promise<FinanceResult<FinanceTransactionDetail>> {
    const detail = await getOwnedTransaction(actor, transactionId);
    if (!detail.ok) {
      return detail;
    }

    if (detail.data.type !== "WITHDRAWAL") {
      return err({
        error: "not_found",
        message: "Withdrawal not found",
        status: 404,
      });
    }

    return ok(detail.data);
  },

  async cancelWithdrawal(
    actor: FinanceActor,
    transactionId: string,
  ): Promise<FinanceResult<FinanceTransactionDetail>> {
    const detail = await getOwnedTransaction(actor, transactionId);
    if (!detail.ok) {
      return detail;
    }

    if (detail.data.type !== "WITHDRAWAL") {
      return err({
        error: "not_found",
        message: "Withdrawal not found",
        status: 404,
      });
    }

    if (detail.data.status !== "PENDING") {
      return err({
        error: "not_deletable",
        message: "Only PENDING withdrawals can be cancelled",
        status: 400,
      });
    }

    const cancelled = await prisma.professionalTransaction.update({
      where: { id: transactionId },
      data: { status: "CANCELLED" },
      select: transactionDetailSelect,
    });

    return ok(
      normalizeDetailTransactionDates(serializeTransactionDecimals(cancelled)),
    );
  },
};
