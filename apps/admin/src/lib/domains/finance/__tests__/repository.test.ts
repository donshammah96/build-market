import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  payment: {
    aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
  },
  order: {
    aggregate: vi.fn().mockResolvedValue({ _avg: { totalAmount: 0 } }),
    count: vi.fn(),
  },
  professionalTransaction: {
    aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
  },
}));

const dbMock = vi.hoisted(() => ({
  OrderStatus: {
    DELIVERED: "DELIVERED",
    PAID: "PAID",
  },
  PaymentStatus: {
    SUCCESS: "SUCCESS",
  },
  TransactionStatus: {
    PENDING: "PENDING",
  },
  TransactionType: {
    WITHDRAWAL: "WITHDRAWAL",
  },
}));

vi.mock("@build/db", () => ({
  prisma: prismaMock,
  OrderStatus: dbMock.OrderStatus,
  PaymentStatus: dbMock.PaymentStatus,
  TransactionStatus: dbMock.TransactionStatus,
  TransactionType: dbMock.TransactionType,
}));

import {
  averagePaidOrderValue,
  countPaidOrders,
  sumAllSuccessfulPaymentAmount,
  sumPendingPayoutAmount,
  sumSuccessfulPaymentAmount,
} from "../repository";

describe("finance repository contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sums successful payments with an optional period range", async () => {
    await sumSuccessfulPaymentAmount({
      period: "7d",
      range: {
        start: new Date("2026-05-11T00:00:00.000Z"),
        end: new Date("2026-05-18T00:00:00.000Z"),
      },
    });
    await sumAllSuccessfulPaymentAmount();

    expect(prismaMock.payment.aggregate).toHaveBeenNthCalledWith(1, {
      where: {
        status: "SUCCESS",
        createdAt: {
          gte: new Date("2026-05-11T00:00:00.000Z"),
          lte: new Date("2026-05-18T00:00:00.000Z"),
        },
      },
      _sum: { amount: true },
    });
    expect(prismaMock.payment.aggregate).toHaveBeenNthCalledWith(2, {
      where: { status: "SUCCESS" },
      _sum: { amount: true },
    });
  });

  it("uses paid and delivered orders for order value metrics", async () => {
    await averagePaidOrderValue();
    await countPaidOrders();

    const where = { status: { in: ["DELIVERED", "PAID"] } };
    expect(prismaMock.order.aggregate).toHaveBeenCalledWith({
      where,
      _avg: { totalAmount: true },
    });
    expect(prismaMock.order.count).toHaveBeenCalledWith({ where });
  });

  it("sums pending withdrawal payouts", async () => {
    await sumPendingPayoutAmount();

    expect(prismaMock.professionalTransaction.aggregate).toHaveBeenCalledWith({
      where: {
        status: "PENDING",
        type: "WITHDRAWAL",
      },
      _sum: { amount: true },
    });
  });
});
