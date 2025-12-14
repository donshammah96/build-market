
import { withAuth } from "@/app/lib/api-middleware";
import { apiSuccess, apiError, executeResilient } from "@/app/lib/resilient-api";
import { prisma } from "@repo/db";
import { checkRateLimit, RateLimits, getRateLimitIdentifier } from "@/app/lib/rate-limit";

export const GET = withAuth(async (req, context) => {
  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.READ.limit, RateLimits.READ.window);

  if (!success) {
    return apiError("Too many requests", 429);
  }

  return executeResilient(
    async () => {
      const transactions = await prisma.professionalTransaction.findMany({
        where: {
          professional: {
            userId: context.dbUserId,
          },
        },
        orderBy: {
          date: "desc",
        },
      });
      return transactions;
    },
    {
      operationName: "get_transactions",
      successStatus: 200,
    }
  );
});
