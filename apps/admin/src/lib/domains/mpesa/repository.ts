import { TransactionStatus, prisma, type Prisma } from "@build/db";
import type { SearchMpesaTransactionsInput } from "./contracts";

export async function createPayout(input: {
  professionalId: string;
  amount: number;
  phoneNumber: string;
  idempotencyKey: string;
}) {
  return prisma.mpesaB2C.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      professionalId: input.professionalId,
      amount: input.amount,
      phoneNumber: input.phoneNumber,
      idempotencyKey: input.idempotencyKey,
      status: TransactionStatus.PENDING,
    },
    update: {},
  });
}

export async function searchTransactions(input: SearchMpesaTransactionsInput) {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(Math.max(1, input.pageSize ?? 25), 100);
  const skip = (page - 1) * pageSize;

  const where: Prisma.MpesaTransactionWhereInput = {};

  if (input.status) {
    where.status = input.status as TransactionStatus;
  }
  if (input.userId) {
    where.userId = input.userId;
  }
  if (input.checkoutRequestId) {
    where.checkoutRequestId = input.checkoutRequestId;
  }
  if (input.mpesaReceiptNumber) {
    where.mpesaReceiptNumber = input.mpesaReceiptNumber;
  }
  if (input.phoneSearchHash) {
    where.phoneSearchHash = input.phoneSearchHash;
  }
  if (input.startDate || input.endDate) {
    where.createdAt = {};
    if (input.startDate) {
      where.createdAt.gte = new Date(input.startDate);
    }
    if (input.endDate) {
      where.createdAt.lte = new Date(input.endDate);
    }
  }

  const [total, items] = await Promise.all([
    prisma.mpesaTransaction.count({ where }),
    prisma.mpesaTransaction.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { total, items, page, pageSize };
}

export async function findTransactionById(id: string) {
  return prisma.mpesaTransaction.findUnique({
    where: { id },
  });
}

export async function findTransactionWithDetails(id: string) {
  const transaction = await prisma.mpesaTransaction.findUnique({
    where: { id },
  });
  if (!transaction) return null;

  const callbackEvents = await prisma.mpesaCallbackEvent.findMany({
    where: { transactionId: id },
    orderBy: { receivedAt: "desc" },
    take: 10,
  });

  return { transaction, callbackEvents };
}
