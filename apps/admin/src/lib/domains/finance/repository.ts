import {
  OrderStatus,
  PaymentStatus,
  prisma,
  TransactionStatus,
  TransactionType,
  type Prisma,
} from "@build/db";
import type { FinanceOverviewQuery } from "./contracts";

function createdAtWhere(
  query: FinanceOverviewQuery,
): Prisma.DateTimeFilter | undefined {
  if (!query.range) return undefined;
  return { gte: query.range.start, lte: query.range.end };
}

function amountToNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value ?? 0);
}

export async function sumSuccessfulPaymentAmount(
  query: FinanceOverviewQuery,
): Promise<number> {
  const createdAt = createdAtWhere(query);
  const result = await prisma.payment.aggregate({
    where: {
      status: PaymentStatus.SUCCESS,
      ...(createdAt ? { createdAt } : {}),
    },
    _sum: { amount: true },
  });

  return amountToNumber(result._sum.amount);
}

export async function sumAllSuccessfulPaymentAmount(): Promise<number> {
  const result = await prisma.payment.aggregate({
    where: { status: PaymentStatus.SUCCESS },
    _sum: { amount: true },
  });

  return amountToNumber(result._sum.amount);
}

export async function averagePaidOrderValue(): Promise<number> {
  const result = await prisma.order.aggregate({
    where: { status: { in: [OrderStatus.DELIVERED, OrderStatus.PAID] } },
    _avg: { totalAmount: true },
  });

  return amountToNumber(result._avg.totalAmount);
}

export async function countPaidOrders(): Promise<number> {
  return prisma.order.count({
    where: { status: { in: [OrderStatus.DELIVERED, OrderStatus.PAID] } },
  });
}

export async function sumPendingPayoutAmount(): Promise<number> {
  const result = await prisma.professionalTransaction.aggregate({
    where: {
      status: TransactionStatus.PENDING,
      type: TransactionType.WITHDRAWAL,
    },
    _sum: { amount: true },
  });

  return amountToNumber(result._sum.amount);
}

export const financeRepository = {
  sumSuccessfulPaymentAmount,
  sumAllSuccessfulPaymentAmount,
  averagePaidOrderValue,
  countPaidOrders,
  sumPendingPayoutAmount,
};
