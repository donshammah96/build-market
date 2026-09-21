import { NextRequest, NextResponse } from "next/server";
import { HttpStatus } from "@/app/lib/api/api-response";
import {
  checkRateLimit,
  getRateLimitIdentifier,
} from "@/app/lib/api/rate-limit";
import {
  getClientLogger,
  initializeCorrelationId,
} from "@/app/lib/api/resilient-api";
import {
  onboardingRemediationService,
  type OnboardingRemediationActor,
} from "@/app/lib/domains/user-profile/remediation";
import { ensureValidInternalSecret } from "@/app/lib/security/internal-secret";
import { isAdminRole } from "@/app/lib/security/roles";

const ROUTE_PATTERN = "/api/internal/onboarding-remediation/reconcile";
const OPERATION_NAME = "reconcile_onboarding_state";
const INTERNAL_RATE_LIMIT = {
  limit: 60,
  windowMs: 60_000,
} as const;

type RequestBody = {
  userId?: unknown;
  actor?: {
    userId?: unknown;
    adminRole?: unknown;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toRemediationActor(
  rawActor: RequestBody["actor"],
  correlationId: string,
): OnboardingRemediationActor | null {
  const actorUserId =
    typeof rawActor?.userId === "string" ? rawActor.userId.trim() : "";
  const actorAdminRole =
    typeof rawActor?.adminRole === "string"
      ? rawActor.adminRole.trim().toUpperCase()
      : "";

  if (!actorUserId || !isAdminRole(actorAdminRole)) {
    return null;
  }

  return {
    userId: actorUserId,
    role: "ADMIN",
    adminRole: actorAdminRole,
    correlationId,
  };
}

function mapErrorStatus(error: string): number {
  switch (error) {
    case "forbidden":
      return HttpStatus.FORBIDDEN;
    case "not_found":
      return HttpStatus.NOT_FOUND;
    case "invalid_input":
      return HttpStatus.BAD_REQUEST;
    case "invalid_state":
    case "conflict":
      return HttpStatus.CONFLICT;
    case "clerk_sync_failed":
      return HttpStatus.SERVICE_UNAVAILABLE;
    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

function mapErrorMessage(error: string): string {
  switch (error) {
    case "forbidden":
      return "Forbidden";
    case "not_found":
      return "User not found";
    case "invalid_input":
      return "Invalid remediation request";
    case "invalid_state":
      return "Invalid onboarding state";
    case "conflict":
      return "Onboarding state conflict";
    default:
      return "Unable to reconcile onboarding state";
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const startedAt = Date.now();
  const correlationId = initializeCorrelationId(req);

  const logOutcome = (
    outcome: string,
    httpStatus: number,
    actorAdminRole?: string,
  ) => {
    getClientLogger().info("Internal onboarding remediation outcome", {
      correlationId,
      operationName: OPERATION_NAME,
      httpMethod: req.method,
      routePattern: ROUTE_PATTERN,
      actorRole: "ADMIN",
      ...(actorAdminRole ? { actorAdminRole } : {}),
      outcome,
      httpStatus,
      durationMs: Date.now() - startedAt,
    });
  };

  const secretError = ensureValidInternalSecret(
    req.headers.get("x-internal-secret"),
  );
  if (secretError) {
    logOutcome("forbidden", secretError.status);
    return secretError;
  }

  const identifier = getRateLimitIdentifier(req);
  const rateLimitResult = await checkRateLimit(
    `internal-onboarding-remediation:${identifier}`,
    INTERNAL_RATE_LIMIT.limit,
    INTERNAL_RATE_LIMIT.windowMs,
  );

  if (!rateLimitResult.success) {
    logOutcome("rate_limited", HttpStatus.TOO_MANY_REQUESTS);
    return NextResponse.json(
      { success: false, error: "Too many requests" },
      { status: HttpStatus.TOO_MANY_REQUESTS },
    );
  }

  let requestBody: RequestBody;
  try {
    const parsed = await req.json();
    requestBody = isRecord(parsed) ? (parsed as RequestBody) : {};
  } catch {
    logOutcome("bad_request", HttpStatus.BAD_REQUEST);
    return NextResponse.json(
      { success: false, error: "Invalid remediation request" },
      { status: HttpStatus.BAD_REQUEST },
    );
  }

  const userId =
    typeof requestBody.userId === "string" ? requestBody.userId.trim() : "";
  const actor = toRemediationActor(requestBody.actor, correlationId);

  if (!userId || !actor) {
    logOutcome(
      "bad_request",
      HttpStatus.BAD_REQUEST,
      actor?.adminRole ?? undefined,
    );
    return NextResponse.json(
      { success: false, error: "Invalid remediation request" },
      { status: HttpStatus.BAD_REQUEST },
    );
  }

  const result = await onboardingRemediationService.reconcileOnboardingState(
    actor,
    userId,
  );

  if (!result.ok) {
    const status = result.status ?? mapErrorStatus(result.error);
    logOutcome("failed", status, actor.adminRole);

    return NextResponse.json(
      {
        success: false,
        error: mapErrorMessage(result.error),
      },
      { status },
    );
  }

  logOutcome("succeeded", HttpStatus.OK, actor.adminRole);
  return NextResponse.json(
    {
      success: true,
      data: result.data,
    },
    { status: HttpStatus.OK },
  );
}

export const dynamic = "force-dynamic";
