import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getClientLogger,
  getResilientExecutor,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { InquiriesQuerySchema } from "@/app/lib/validation/inquiries-validation";
import { inquiriesService } from "@/app/lib/domains/inquiries";
import { normalizeRole } from "@/app/lib/security/roles";

export const GET = withAuth(
  async (req: NextRequest, { dbUserId, userRole }) => {
    const correlationId = initializeCorrelationId(req);
    const validation = InquiriesQuerySchema.safeParse(
      Object.fromEntries(new URL(req.url).searchParams.entries()),
    );

    if (!validation.success) {
      return apiError(
        "Invalid query parameters",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
      );
    }

    const identifier = getRateLimitIdentifier(req);
    const rateLimitResult = await checkRateLimit(
      `inquiries-read:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window,
    );
    if (!rateLimitResult.success) {
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      async () =>
        inquiriesService.listProfessionalInquiries(
          {
            userId: dbUserId,
            role: normalizeRole(String(userRole)),
          },
          validation.data,
        ),
      { operationName: "get_professional_inquiries" },
    );

    if (!result.success || !result.data) {
      getClientLogger().error("Failed to fetch inquiries", result.error, {
        correlationId,
        actorRole: normalizeRole(String(userRole)),
      });
      return apiError(
        "Failed to fetch inquiries",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!result.data.ok) {
      if (result.data.error === "forbidden") {
        return apiError(
          result.data.message ?? "Forbidden",
          HttpStatus.FORBIDDEN,
        );
      }

      return apiError(
        result.data.message ?? "Failed to fetch inquiries",
        result.data.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return apiSuccess(result.data.data, HttpStatus.OK);
  },
);
