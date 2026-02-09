import { NextRequest } from "next/server";
import { prisma } from "@build/db";
import { withAuth } from "@/app/lib/api-middleware";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import {
  initializeCorrelationId,
  executeResilient,
  getClientLogger,
} from "@/app/lib/resilient-api";
import {
  checkRateLimit,
  RateLimits,
  getRateLimitIdentifier,
} from "@/app/lib/rate-limit";

const logger = getClientLogger();

/**
 * GET /api/professional-portal/pipeline
 * Get sales pipeline data for property professionals
 * Returns pipeline stages formatted for dashboard widget
 */
export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(
    identifier,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info("Fetching sales pipeline", { correlationId, userId: dbUserId });

  return executeResilient(
    async () => {
      // Get property IDs owned by this user
      const properties = await prisma.property.findMany({
        where: { agentId: dbUserId },
        select: { id: true, price: true },
      });

      const propertyIds = properties.map((p) => p.id);
      const propertyPriceMap = new Map(
        properties.map((p) => [p.id, Number(p.price)])
      );

      if (propertyIds.length === 0) {
        return {
          data: {
            stages: [
              {
                id: "viewing",
                label: "Viewings Scheduled",
                count: 0,
                value: 0,
              },
              { id: "offer", label: "Offers Pending", count: 0, value: 0 },
              { id: "closing", label: "Ready to Close", count: 0, value: 0 },
            ],
            totalValue: 0,
          },
        };
      }

      // Get pipeline counts by inquiry status
      const pipelineCounts = await prisma.propertyInquiry.groupBy({
        by: ["status", "propertyId"],
        where: {
          propertyId: { in: propertyIds },
        },
        _count: { id: true },
      });

      // Aggregate by status
      const statusCounts: {
        VIEWING_SCHEDULED: { count: number; value: number };
        OFFER_MADE: { count: number; value: number };
        CLOSED: { count: number; value: number };
      } = {
        VIEWING_SCHEDULED: { count: 0, value: 0 },
        OFFER_MADE: { count: 0, value: 0 },
        CLOSED: { count: 0, value: 0 },
      };

      for (const item of pipelineCounts) {
        if (
          item.status === "VIEWING_SCHEDULED" ||
          item.status === "OFFER_MADE" ||
          item.status === "CLOSED"
        ) {
          const statusEntry = statusCounts[item.status];
          statusEntry.count += item._count.id;
          // Add property value for this inquiry
          const propertyPrice = propertyPriceMap.get(item.propertyId) || 0;
          statusEntry.value += propertyPrice * item._count.id;
        }
      }

      // Format stages for widget
      const stages = [
        {
          id: "viewing",
          label: "Viewings Scheduled",
          count: statusCounts.VIEWING_SCHEDULED.count,
          value: statusCounts.VIEWING_SCHEDULED.value,
        },
        {
          id: "offer",
          label: "Offers Pending",
          count: statusCounts.OFFER_MADE.count,
          value: statusCounts.OFFER_MADE.value,
        },
        {
          id: "closing",
          label: "Ready to Close",
          count: statusCounts.CLOSED.count,
          value: statusCounts.CLOSED.value,
        },
      ];

      const totalValue = stages.reduce((sum, s) => sum + s.value, 0);

      logger.info("Sales pipeline fetched successfully", {
        correlationId,
        userId: dbUserId,
        totalValue,
        stages: stages.map((s) => ({ id: s.id, count: s.count })),
      });

      return {
        data: {
          stages,
          totalValue,
        },
      };
    },
    {
      operationName: "get_sales_pipeline",
      successStatus: HttpStatus.OK,
    }
  );
});
