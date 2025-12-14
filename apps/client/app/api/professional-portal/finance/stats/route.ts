import { prisma } from "@repo/db";
import { withAuth } from "@/app/lib/api-middleware";
import { apiSuccess, apiError, executeResilient } from "@/app/lib/resilient-api";
import { checkRateLimit, RateLimits, getRateLimitIdentifier } from "@/app/lib/rate-limit";

export const GET = withAuth(async (req, context) => {
  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.READ.limit, RateLimits.READ.window);

  if (!success) {
    return apiError("Too many requests", 429);
  }

  return executeResilient(
    async () => {
      // Calculate total earnings (INCOME - COMPLETED)
      const income = await prisma.professionalTransaction.aggregate({
        where: {
          professional: { userId: context.dbUserId },
          type: "INCOME",
          status: "COMPLETED",
        },
        _sum: {
          amount: true,
        },
      });

      // Calculate pending payouts (WITHDRAWAL - PENDING)
      const pendingPayouts = await prisma.professionalTransaction.aggregate({
        where: {
          professional: { userId: context.dbUserId },
          type: "WITHDRAWAL",
          status: "PENDING",
        },
        _sum: {
          amount: true,
        },
      });

      // Calculate outstanding invoices (INCOME - PENDING)
      const outstandingInvoices = await prisma.professionalTransaction.aggregate({
        where: {
          professional: { userId: context.dbUserId },
          type: "INCOME",
          status: "PENDING",
        },
        _sum: {
          amount: true,
        },
      });

      return {
        totalEarnings: income._sum.amount || 0,
        pendingPayouts: pendingPayouts._sum.amount || 0,
        outstandingInvoices: outstandingInvoices._sum.amount || 0,
      };
    },
    {
      operationName: "get_finance_stats",
      successStatus: 200,
    }
  );
});
