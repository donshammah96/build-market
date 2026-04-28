"use server";

// ADR-006 classification: Class B - onboarding flows process profile, business, and compliance onboarding fields.
// Reviewed: 2026-04-09 by @copilot

import { auth, currentUser } from "@clerk/nextjs/server";
import { OnboardingSchema } from "@build/types";
import { randomUUID } from "crypto";
import {
  createActionFailure,
  secureAction,
  throwActionFailure,
  type ActionErrorCode,
  type ActionResult,
} from "@/app/lib/actions/secure-action";
import { HttpStatus } from "@/app/lib/api/api-response";
import { getResilientExecutor } from "@/app/lib/api/resilient-api";
import { type ClerkUserProfile } from "@/app/lib/domains/user-profile";
import {
  executeOnboardingOrchestration,
  type OnboardingIntent,
  type OnboardingOrchestrationErrorCode,
  type OnboardingOrchestrationResult,
  type OnboardingRole,
} from "@/app/lib/domains/shared/onboarding-orchestration";
import { CLERK_ONBOARDING_FINALIZATION_RETRY_MESSAGE } from "@/app/lib/domains/user-profile/clerk-metadata";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { normalizeRole } from "@/app/lib/security/roles";

const ONBOARDING_RECENT_AUTH_MAX_AGE_SECONDS = 300;
const ONBOARDING_TRANSITION_RATE_LIMIT = {
  limit: 8,
  windowMs: 15 * 60 * 1000,
} as const;

const ONBOARDING_ACTION_ERROR_MAP: Record<
  OnboardingOrchestrationErrorCode,
  {
    code: ActionErrorCode;
    message: string;
    status: number;
  }
> = {
  conflict: {
    code: "conflict",
    message: "Onboarding already completed",
    status: HttpStatus.CONFLICT,
  },
  forbidden: {
    code: "forbidden",
    message: "Forbidden",
    status: HttpStatus.FORBIDDEN,
  },
  not_found: {
    code: "not_found",
    message: "User not found",
    status: HttpStatus.NOT_FOUND,
  },
  invalid_input: {
    code: "invalid_input",
    message: "Invalid onboarding input",
    status: HttpStatus.BAD_REQUEST,
  },
  invalid_state: {
    code: "invalid_state",
    message: "Invalid onboarding state",
    status: HttpStatus.CONFLICT,
  },
  clerk_sync_failed: {
    code: "internal",
    message: CLERK_ONBOARDING_FINALIZATION_RETRY_MESSAGE,
    status: HttpStatus.SERVICE_UNAVAILABLE,
  },
  internal: {
    code: "internal",
    message: "Onboarding failed",
    status: HttpStatus.INTERNAL_SERVER_ERROR,
  },
};

async function getRequiredClerkContext() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    throwActionFailure(
      createActionFailure("unauthorized", "Unauthorized", 401),
    );
  }

  const clerkUser = (await currentUser()) as ClerkUserProfile | null;
  if (!clerkUser) {
    throwActionFailure(
      createActionFailure(
        "internal",
        "Could not retrieve user data from Clerk",
        500,
      ),
    );
  }

  return { clerkId, clerkUser };
}

function isOnboardingRole(role: string): role is OnboardingRole {
  return role === "CLIENT" || role === "PROFESSIONAL";
}

function mapOrchestrationErrorToActionFailure(
  errorCode: OnboardingOrchestrationErrorCode | undefined,
): {
  code: ActionErrorCode;
  message: string;
  status: number;
} {
  if (!errorCode) {
    return ONBOARDING_ACTION_ERROR_MAP.internal;
  }

  return ONBOARDING_ACTION_ERROR_MAP[errorCode];
}

async function checkOnboardingTransitionIdempotency(params: {
  idempotencyKey: string;
  clerkId: string;
}): Promise<OnboardingOrchestrationResult | null> {
  const check = await IdempotencyService.checkOrCreate(
    params.idempotencyKey,
    "onboarding",
    params.clerkId,
    "POST",
  );

  if (check?.status === "completed") {
    return check.response as OnboardingOrchestrationResult;
  }

  if (check?.status === "pending") {
    throwActionFailure(
      createActionFailure("conflict", "Request is being processed", 409),
    );
  }

  return null;
}

async function executeOnboardingTransition(params: {
  operationName: string;
  clerkId: string;
  clerkUser: ClerkUserProfile;
  intent: OnboardingIntent;
  idempotencyKey: string;
}): Promise<OnboardingOrchestrationResult> {
  const executor = getResilientExecutor();
  const executionResult = await executor.execute(
    () =>
      executeOnboardingOrchestration(
        {
          clerkId: params.clerkId,
          correlationId: randomUUID(),
        },
        params.clerkUser,
        params.intent,
        {
          key: params.idempotencyKey,
          scope: "onboarding",
          actorId: params.clerkId,
          method: "POST",
        },
      ),
    { operationName: params.operationName },
  );

  if (!executionResult.success || !executionResult.data) {
    await IdempotencyService.fail(params.idempotencyKey);
    throwActionFailure(
      createActionFailure(
        "internal",
        "Onboarding failed",
        HttpStatus.INTERNAL_SERVER_ERROR,
      ),
    );
  }

  if (!executionResult.data.ok) {
    const mappedFailure = mapOrchestrationErrorToActionFailure(
      executionResult.data.error,
    );
    throwActionFailure(
      createActionFailure(
        mappedFailure.code,
        mappedFailure.message,
        mappedFailure.status,
      ),
    );
  }

  return executionResult.data.data;
}

export async function submitOnboarding(
  data: unknown,
): Promise<ActionResult<OnboardingOrchestrationResult>> {
  return secureAction({
    operationName: "submit_onboarding_server_action",
    requireActor: false,
    input: data,
    schema: OnboardingSchema,
    recentAuth: {
      maxAgeSeconds: ONBOARDING_RECENT_AUTH_MAX_AGE_SECONDS,
    },
    rateLimit: {
      key: ({ authUserId }) =>
        `high-value-onboarding-transition:submit:${authUserId ?? "anonymous"}`,
      limit: ONBOARDING_TRANSITION_RATE_LIMIT.limit,
      windowMs: ONBOARDING_TRANSITION_RATE_LIMIT.windowMs,
      message:
        "Too many onboarding transition attempts. Please try again shortly.",
      status: 429,
    },
    handler: async ({ input }) => {
      const { clerkId, clerkUser } = await getRequiredClerkContext();

      const normalizedInputRole = normalizeRole(input.role);
      if (!normalizedInputRole || !isOnboardingRole(normalizedInputRole)) {
        throwActionFailure(
          createActionFailure("invalid_input", "Invalid onboarding role", 400),
        );
      }

      const idempotencyKey = IdempotencyService.generateKey(clerkId, "POST", {
        domain: "onboarding",
        role: normalizedInputRole,
      });

      const replayResult = await checkOnboardingTransitionIdempotency({
        idempotencyKey,
        clerkId,
      });
      if (replayResult) {
        return replayResult;
      }

      const orchestrationResult = await executeOnboardingTransition({
        operationName: "complete_onboarding_action",
        clerkId,
        clerkUser,
        intent: {
          kind: "submit",
          role: normalizedInputRole,
          data: input,
        },
        idempotencyKey,
      });

      return orchestrationResult;
    },
  });
}

export async function skipOnboarding(): Promise<
  ActionResult<OnboardingOrchestrationResult>
> {
  return secureAction({
    operationName: "skip_client_onboarding_server_action",
    requireActor: false,
    recentAuth: {
      maxAgeSeconds: ONBOARDING_RECENT_AUTH_MAX_AGE_SECONDS,
    },
    rateLimit: {
      key: ({ authUserId }) =>
        `high-value-onboarding-transition:skip-client:${authUserId ?? "anonymous"}`,
      limit: ONBOARDING_TRANSITION_RATE_LIMIT.limit,
      windowMs: ONBOARDING_TRANSITION_RATE_LIMIT.windowMs,
      message:
        "Too many onboarding transition attempts. Please try again shortly.",
      status: 429,
    },
    handler: async () => {
      const { clerkId, clerkUser } = await getRequiredClerkContext();

      const idempotencyKey = IdempotencyService.generateKey(clerkId, "POST", {
        domain: "onboarding-skip-client",
        role: "CLIENT",
      });

      const replayResult = await checkOnboardingTransitionIdempotency({
        idempotencyKey,
        clerkId,
      });
      if (replayResult) {
        return replayResult;
      }

      return executeOnboardingTransition({
        operationName: "skip_client_onboarding_action",
        clerkId,
        clerkUser,
        intent: { kind: "skip_client" },
        idempotencyKey,
      });
    },
  });
}

export async function skipProfessionalOnboarding(): Promise<
  ActionResult<OnboardingOrchestrationResult>
> {
  return secureAction({
    operationName: "skip_professional_onboarding_server_action",
    requireActor: false,
    recentAuth: {
      maxAgeSeconds: ONBOARDING_RECENT_AUTH_MAX_AGE_SECONDS,
    },
    rateLimit: {
      key: ({ authUserId }) =>
        `high-value-onboarding-transition:skip-professional:${authUserId ?? "anonymous"}`,
      limit: ONBOARDING_TRANSITION_RATE_LIMIT.limit,
      windowMs: ONBOARDING_TRANSITION_RATE_LIMIT.windowMs,
      message:
        "Too many onboarding transition attempts. Please try again shortly.",
      status: 429,
    },
    handler: async () => {
      const { clerkId, clerkUser } = await getRequiredClerkContext();

      const idempotencyKey = IdempotencyService.generateKey(clerkId, "POST", {
        domain: "onboarding-skip-professional",
        role: "PROFESSIONAL",
      });

      const replayResult = await checkOnboardingTransitionIdempotency({
        idempotencyKey,
        clerkId,
      });
      if (replayResult) {
        return replayResult;
      }

      return executeOnboardingTransition({
        operationName: "skip_professional_onboarding_action",
        clerkId,
        clerkUser,
        intent: { kind: "skip_professional" },
        idempotencyKey,
      });
    },
  });
}
