import { TransactionStatus, prisma } from "@build/db";

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
