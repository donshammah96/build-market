import { BillingInterval, SubscriptionTierKey } from "@build/db";
import { z } from "zod";
import { NextRequest } from "next/server";
import { withAuth } from "@/app/lib/api/api-middleware";
import { apiError, apiSuccess, HttpStatus } from "@/app/lib/api/api-response";
import {
  initializeCorrelationId,
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import {
  checkRateLimit,
  getActorRateLimitIdentifier,
  RateLimits,
} from "@/app/lib/api/rate-limit";
import { applyPrivateNoStoreHeaders } from "@/app/lib/api/http-security";
import { clientSubscriptionsService } from "@/app/lib/domains/subscriptions";
import { isBillingEnabled } from "@/app/lib/capabilities/registry";

const CheckoutSchema = z.object({
  planKey: z.nativeEnum(SubscriptionTierKey),
  billingInterval: z.nativeEnum(BillingInterval),
  phoneNumber: z.string().min(9).max(20),
  idempotencyKey: z.string().min(8).max(128),
});

export const POST = withAuth(
  async (req: NextRequest, { dbUserId, userRole }) => {
    if (!isBillingEnabled()) {
      return applyPrivateNoStoreHeaders(
        apiError(
          "Paid subscription checkout is currently paused.",
          HttpStatus.SERVICE_UNAVAILABLE,
        ),
      );
    }

    const logger = getClientLogger();
    const correlationId = initializeCorrelationId(req);

    const rateLimitIdentifier = getActorRateLimitIdentifier(
      dbUserId,
      "subscription-mpesa-checkout",
    );
    const rateLimitResult = await checkRateLimit(
      rateLimitIdentifier,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      return applyPrivateNoStoreHeaders(
        apiError(
          "Too many requests. Please try again later.",
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return applyPrivateNoStoreHeaders(
        apiError("Invalid JSON body", HttpStatus.BAD_REQUEST),
      );
    }

    const validation = CheckoutSchema.safeParse(body);
    if (!validation.success) {
      return applyPrivateNoStoreHeaders(
        apiError(
          "Invalid input",
          HttpStatus.BAD_REQUEST,
          validation.error.issues,
        ),
      );
    }

    const resilientExecutor = getResilientExecutor();
    const result = await resilientExecutor.execute(
      () =>
        clientSubscriptionsService.initiateSubscriptionCheckout(
          { userId: dbUserId, role: userRole },
          validation.data,
        ),
      { operationName: "initiate_subscription_mpesa_checkout" },
    );

    if (!result.success || !result.data) {
      logger.error("Subscription checkout execution failed", result.error, {
        correlationId,
        actorRole: userRole,
      });
      return applyPrivateNoStoreHeaders(
        apiError(
          "Unable to start M-Pesa checkout",
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    }

    const domainResult = result.data;
    if (!domainResult.ok) {
      const domainError = domainResult;
      const status =
        domainError.code === "INVALID_PHONE_NUMBER"
          ? HttpStatus.BAD_REQUEST
          : domainError.code === "PLAN_NOT_FOUND"
            ? domainError.message.includes("Free plan")
              ? HttpStatus.BAD_REQUEST
              : HttpStatus.NOT_FOUND
            : domainError.code === "FORBIDDEN" ||
                domainError.code === "UNAUTHENTICATED"
              ? HttpStatus.FORBIDDEN
              : domainError.code === "PAYMENT_FAILED"
                ? HttpStatus.BAD_REQUEST
                : HttpStatus.INTERNAL_SERVER_ERROR;

      const clientMessage =
        domainError.code === "INVALID_PHONE_NUMBER"
          ? domainError.message || "Invalid phone number provided."
          : domainError.code === "PLAN_NOT_FOUND"
            ? domainError.message || "Subscription plan not found."
            : domainError.code === "FORBIDDEN"
              ? "You are not authorized to initiate checkout."
              : domainError.code === "UNAUTHENTICATED"
                ? "Authentication required."
                : domainError.code === "PAYMENT_FAILED"
                  ? domainError.message || "Payment initiation failed."
                  : "Unable to process subscription checkout.";

      return applyPrivateNoStoreHeaders(
        apiError(clientMessage, status, { code: domainError.code }),
      );
    }

    return applyPrivateNoStoreHeaders(
      apiSuccess(domainResult.data, HttpStatus.CREATED),
    );
  },
  {
    recentAuth: {
      maxAgeSeconds: 180,
    },
  },
);
