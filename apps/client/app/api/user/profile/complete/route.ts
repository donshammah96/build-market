import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@build/db";
import { withAuth } from "@/app/lib/api/api-middleware";
import { HttpStatus } from "@/app/lib/api/api-response";
import {
  apiError,
  initializeCorrelationId,
  getClientLogger,
} from "@/app/lib/api/resilient-api";

const logger = getClientLogger();

/**
 * PATCH /api/user/profile/complete
 *
 * Router endpoint that delegates to role-specific endpoints:
 * - /api/user/profile/complete/client for CLIENT role
 * - /api/user/profile/complete/professional for PROFESSIONAL role
 *
 * This approach provides better type safety and clearer validation logic
 * by separating concerns based on user role.
 *
 * /deprecated Consider using role-specific endpoints directly:
 * - PATCH /api/user/profile/complete/client
 * - PATCH /api/user/profile/complete/professional
 */
export const PATCH = withAuth(async (req: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(req);

  try {
    logger.info("Profile complete request received - routing by role", {
      userId: dbUserId,
      correlationId,
    });

    // Fetch user to determine role
    const user = await prisma.user.findUnique({
      where: { id: dbUserId },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      logger.warn("User not found for profile completion", {
        userId: dbUserId,
        correlationId,
      });
      return apiError("User not found", HttpStatus.NOT_FOUND);
    }

    // Security check
    if (user.status === "SUSPENDED" || user.status === "BANNED") {
      logger.warn("Profile update blocked for restricted account", {
        userId: dbUserId,
        status: user.status,
        correlationId,
      });
      return apiError(
        "Profile updates are not allowed for suspended or banned accounts",
        HttpStatus.FORBIDDEN,
      );
    }

    // Route to appropriate endpoint based on role
    const baseUrl = new URL(req.url).origin;
    const targetPath =
      user.role === "CLIENT"
        ? "/api/user/profile/complete/client"
        : user.role === "PROFESSIONAL"
          ? "/api/user/profile/complete/professional"
          : null;

    if (!targetPath) {
      logger.warn("Invalid role for profile completion", {
        userId: dbUserId,
        role: user.role,
        correlationId,
      });
      return apiError(
        `Profile completion not supported for role: ${user.role}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    logger.info("Routing profile complete request", {
      userId: dbUserId,
      role: user.role,
      targetEndpoint: targetPath,
      correlationId,
    });

    // Get the request body to forward
    const body = await req.json();

    // Create a new request to the role-specific endpoint
    const targetUrl = `${baseUrl}${targetPath}`;
    const response = await fetch(targetUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        // Forward authentication headers
        ...(req.headers.get("authorization") && {
          authorization: req.headers.get("authorization")!,
        }),
        ...(req.headers.get("cookie") && {
          cookie: req.headers.get("cookie")!,
        }),
        // Forward correlation ID for tracing
        "x-correlation-id": correlationId,
      },
      body: JSON.stringify(body),
    });

    // Forward the response from the role-specific endpoint
    const responseData = await response.json();

    logger.info("Profile complete request routed successfully", {
      userId: dbUserId,
      role: user.role,
      targetEndpoint: targetPath,
      statusCode: response.status,
      correlationId,
    });

    return NextResponse.json(responseData, {
      status: response.status,
    });
  } catch (err) {
    logger.error(
      "Profile complete routing error",
      err instanceof Error ? err : new Error(String(err)),
      {
        userId: dbUserId,
        correlationId,
      },
    );

    return apiError(
      "Failed to process profile update request",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
});
