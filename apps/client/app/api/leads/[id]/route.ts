import { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { apiError, HttpStatus } from "@/app/lib/api-response";
import { initializeCorrelationId, executeResilient, getClientLogger } from "@/app/lib/resilient-api";
import { checkRateLimit, RateLimits, getRateLimitIdentifier } from "@/app/lib/rate-limit";

const logger = getClientLogger();

/**
 * GET /api/leads/[id]
 * Public endpoint to get lead status by ID
 * Used by clients to check their inquiry status
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = initializeCorrelationId(req);
  const { id } = await params;

  const identifier = getRateLimitIdentifier(req);
  const { success } = await checkRateLimit(identifier, RateLimits.READ.limit, RateLimits.READ.window);

  if (!success) {
    return apiError("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Fetching lead status', { correlationId, leadId: id });

  return executeResilient(
    async () => {
      const lead = await prisma.lead.findUnique({
        where: { id },
        select: {
          id: true,
          projectType: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          professional: {
            select: {
              companyName: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });

      if (!lead) {
        logger.warn('Lead not found', { correlationId, leadId: id });
        return apiError("Lead not found", HttpStatus.NOT_FOUND);
      }

      // Return sanitized info for public access
      const response = {
        id: lead.id,
        projectType: lead.projectType,
        status: lead.status,
        professionalName: lead.professional.companyName || 
          `${lead.professional.user.firstName} ${lead.professional.user.lastName}`.trim(),
        submittedAt: lead.createdAt,
        lastUpdated: lead.updatedAt,
      };

      logger.info('Lead status fetched successfully', { correlationId, leadId: id, status: lead.status });
      return response;
    },
    {
      operationName: "get_public_lead_status",
      successStatus: HttpStatus.OK,
    }
  );
}
