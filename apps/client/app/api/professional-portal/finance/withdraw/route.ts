
import { z } from "zod";
import { prisma } from "@repo/db";
import { withAuth } from "@/app/lib/api-middleware";
import { apiSuccess, apiError, executeResilient } from "@/app/lib/resilient-api";
import { checkRateLimit, RateLimits, getRateLimitIdentifier } from "@/app/lib/rate-limit";

const withdrawSchema = z.object({
  amount: z.number().min(1, "Amount must be at least 1"),
});

export const POST = withAuth(async (req, context) => {
  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.WRITE.limit, RateLimits.WRITE.window);

  if (!success) {
    return apiError("Too many requests", 429);
  }

  const body = await req.json();
  const validation = withdrawSchema.safeParse(body);

  if (!validation.success) {
    return apiError("Invalid input data", 400, validation.error.issues);
  }

  const { amount } = validation.data;

  return executeResilient(
    async () => {
      // Calculate available balance (INCOME - WITHDRAWAL)
      // Note: This is a simplified balance check. In a real app, we'd have a more robust ledger.
      
      const income = await prisma.professionalTransaction.aggregate({
        where: {
          professional: { userId: context.dbUserId },
          type: "INCOME",
          status: "COMPLETED",
        },
        _sum: { amount: true },
      });

      const withdrawals = await prisma.professionalTransaction.aggregate({
        where: {
          professional: { userId: context.dbUserId },
          type: "WITHDRAWAL",
          status: { in: ["COMPLETED", "PENDING"] }, // Count pending withdrawals against balance
        },
        _sum: { amount: true },
      });

      const totalIncome = Number(income._sum.amount || 0);
      const totalWithdrawals = Number(withdrawals._sum.amount || 0);
      const availableBalance = totalIncome - totalWithdrawals;

      if (amount > availableBalance) {
        throw new Error("Insufficient funds");
      }

      const transaction = await prisma.professionalTransaction.create({
        data: {
          professional: {
            connect: { userId: context.dbUserId },
          },
          description: "Withdrawal Request",
          amount: amount,
          type: "WITHDRAWAL",
          status: "PENDING",
          date: new Date(),
        },
      });

      return transaction;
    },
    {
      operationName: "withdraw_funds",
      successStatus: 201,
      errorStatus: 500, // Default
    }
  );
});
