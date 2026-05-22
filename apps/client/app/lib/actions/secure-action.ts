import { auth } from "@clerk/nextjs/server";
import { prisma, type AdminRole, type UserRole } from "@build/db";
import { z } from "zod";
import { randomUUID } from "crypto";
import { normalizeRole, type AppRole } from "@/app/lib/security/roles";
import type { Result } from "@/app/lib/errors/result";
import { getClientLogger } from "@/app/lib/api/resilient-api";
import { checkRateLimit } from "@/app/lib/api/rate-limit";
import {
  type CsrfExemption,
  mutationOriginFailureMessage,
  validateTrustedMutationOriginForServerAction,
} from "@/app/lib/api/http-security";

const DEFAULT_RECENT_AUTH_MAX_AGE_SECONDS = 300;

export type ActionErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "conflict"
  | "invalid_input"
  | "invalid_state"
  | "limit_exceeded"
  | "internal";

export type ActionFailure = {
  code: ActionErrorCode;
  message: string;
  status: number;
  details?: unknown;
};

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: ActionFailure };

export type ActionActor = {
  clerkId: string;
  dbUserId: string;
  email: string;
  userRole: UserRole;
  role: AppRole | null;
  adminRole?: AdminRole;
  source: "clerk";
};

type PolicyResult = void | boolean | ActionFailure;

type RecentAuthValidationResult =
  | { ok: true }
  | { ok: false; reason: "missing_claim" | "stale_claim" };

type ActionRateLimitConfig<TParsed> = {
  key:
    | string
    | ((params: {
        actor: ActionActor | null;
        input: TParsed;
        authUserId: string | null;
      }) => string);
  limit: number;
  windowMs: number;
  code?: ActionErrorCode;
  message?: string;
  status?: number;
};

type SecureActionOptions<TInput, TParsed, TOutput> = {
  operationName?: string;
  input?: TInput;
  schema?: z.ZodType<TParsed>;
  requireActor?: boolean;
  recentAuth?: {
    maxAgeSeconds?: number;
  };
  rateLimit?: ActionRateLimitConfig<TParsed>;
  csrf?: {
    exempt?: CsrfExemption;
    extraTrustedOrigins?: string[];
  };
  policy?: (params: {
    actor: ActionActor | null;
    input: TParsed;
  }) => Promise<PolicyResult> | PolicyResult;
  handler: (params: {
    actor: ActionActor | null;
    input: TParsed;
  }) => Promise<TOutput>;
  mapError?: (error: unknown) => ActionFailure | undefined;
};

export class SecureActionError extends Error {
  constructor(public readonly failure: ActionFailure) {
    super(failure.message);
    this.name = "SecureActionError";
  }
}

export function createActionFailure(
  code: ActionErrorCode,
  message: string,
  status = statusForActionError(code),
  details?: unknown,
): ActionFailure {
  return {
    code,
    message,
    status,
    ...(details !== undefined ? { details } : {}),
  };
}

export function throwActionFailure(failure: ActionFailure): never {
  throw new SecureActionError(failure);
}

export function statusForActionError(code: string): number {
  switch (code) {
    case "unauthorized":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "conflict":
    case "invalid_state":
      return 409;
    case "limit_exceeded":
      return 422;
    case "validation_error":
    case "invalid_input":
      return 400;
    default:
      return 500;
  }
}

type ClerkAuthResult = Awaited<ReturnType<typeof auth>>;

export async function resolveRequiredActionActor(
  authResult?: ClerkAuthResult,
): Promise<ActionActor> {
  const { userId: clerkId } = authResult ?? (await auth());

  if (!clerkId) {
    throwActionFailure(
      createActionFailure("unauthorized", "Unauthorized", 401),
    );
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  if (!user) {
    throwActionFailure(
      createActionFailure("unauthorized", "User not found", 401),
    );
  }

  const role: AppRole | null = normalizeRole(String(user.role)) ?? null;

  let adminRole: AdminRole | undefined;
  if (role === "ADMIN") {
    const adminProfile = await prisma.adminProfile.findUnique({
      where: { userId: user.id },
      select: { role: true },
    });
    adminRole = adminProfile?.role;
  }

  return {
    clerkId,
    dbUserId: user.id,
    email: user.email,
    userRole: user.role,
    role,
    ...(adminRole ? { adminRole } : {}),
    source: "clerk",
  };
}

export async function secureAction<TInput, TParsed = TInput, TOutput = void>(
  options: SecureActionOptions<TInput, TParsed, TOutput>,
): Promise<ActionResult<TOutput>> {
  const startedAt = Date.now();
  const correlationId = randomUUID();
  let actor: ActionActor | null = null;
  let authResult: ClerkAuthResult | null = null;

  try {
    const input = parseInput(options.schema, options.input) as TParsed;
    if (options.requireActor === false) {
      actor = null;

      if (options.recentAuth || options.rateLimit) {
        authResult = await auth();
      }

      if (options.recentAuth) {
        if (!authResult?.userId) {
          throwActionFailure(
            createActionFailure("unauthorized", "Unauthorized", 401),
          );
        }

        const maxAgeSeconds =
          options.recentAuth.maxAgeSeconds ??
          DEFAULT_RECENT_AUTH_MAX_AGE_SECONDS;
        const freshness = validateRecentAuth(
          authResult.sessionClaims,
          maxAgeSeconds,
        );

        if (!freshness.ok) {
          throwActionFailure(
            createActionFailure(
              "unauthorized",
              recentAuthFailureMessage(),
              401,
              {
                reason: freshness.reason,
                maxAgeSeconds,
              },
            ),
          );
        }
      }
    } else {
      const csrfCheck = await validateTrustedMutationOriginForServerAction(
        options.csrf,
      );

      if (!csrfCheck.ok) {
        throwActionFailure(
          createActionFailure(
            "forbidden",
            mutationOriginFailureMessage(csrfCheck.reason),
            403,
          ),
        );
      }

      authResult = await auth();

      if (options.recentAuth && authResult.userId) {
        const maxAgeSeconds =
          options.recentAuth.maxAgeSeconds ??
          DEFAULT_RECENT_AUTH_MAX_AGE_SECONDS;
        const freshness = validateRecentAuth(
          authResult.sessionClaims,
          maxAgeSeconds,
        );

        if (!freshness.ok) {
          throwActionFailure(
            createActionFailure(
              "unauthorized",
              recentAuthFailureMessage(),
              401,
              {
                reason: freshness.reason,
                maxAgeSeconds,
              },
            ),
          );
        }
      }

      actor = await resolveRequiredActionActor(authResult);
    }

    if (options.policy) {
      const policyResult = await options.policy({ actor, input });
      if (policyResult === false) {
        throwActionFailure(createActionFailure("forbidden", "Forbidden", 403));
      }
      if (
        policyResult &&
        typeof policyResult === "object" &&
        "code" in policyResult
      ) {
        throwActionFailure(policyResult);
      }
    }

    if (options.rateLimit) {
      const rateLimitIdentifier =
        typeof options.rateLimit.key === "function"
          ? options.rateLimit.key({
              actor,
              input,
              authUserId: authResult?.userId ?? null,
            })
          : options.rateLimit.key;

      if (!rateLimitIdentifier.trim()) {
        throwActionFailure(
          createActionFailure(
            "internal",
            "Rate limit key resolution failed",
            500,
          ),
        );
      }

      const rateLimitResult = await checkRateLimit(
        rateLimitIdentifier,
        options.rateLimit.limit,
        options.rateLimit.windowMs,
      );

      if (!rateLimitResult.success) {
        const retryAfterSeconds = Math.max(
          0,
          Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
        );

        throwActionFailure(
          createActionFailure(
            options.rateLimit.code ?? "limit_exceeded",
            options.rateLimit.message ??
              "Too many requests. Please try again later.",
            options.rateLimit.status ?? 429,
            {
              limit: rateLimitResult.limit,
              remaining: rateLimitResult.remaining,
              resetAtEpochMs: rateLimitResult.reset,
              retryAfterSeconds,
            },
          ),
        );
      }
    }

    const data = await options.handler({ actor, input });

    logActionOutcome(options.operationName, {
      correlationId,
      actorRole: actor?.role ?? "anonymous",
      outcome: "success",
      httpStatus: 200,
      durationMs: Date.now() - startedAt,
    });

    return { success: true, data };
  } catch (error) {
    const mapped =
      options.mapError?.(error) ??
      (error instanceof SecureActionError
        ? error.failure
        : error instanceof z.ZodError
          ? createActionFailure(
              "validation_error",
              error.issues[0]?.message ?? "Validation failed",
              400,
              error.issues,
            )
          : createActionFailure(
              "internal",
              error instanceof Error
                ? error.message || "Unexpected server action error"
                : "Unexpected server action error",
              500,
            ));

    logActionOutcome(options.operationName, {
      correlationId,
      actorRole: actor?.role ?? "anonymous",
      outcome: actionFailureToOutcome(mapped.code),
      httpStatus: mapped.status,
      durationMs: Date.now() - startedAt,
      errorCode: mapped.code,
    });

    return { success: false, error: mapped };
  }
}

type ActionObservabilityOutcome =
  | "success"
  | "domain_error"
  | "validation_error"
  | "rate_limited"
  | "internal_error";

function actionFailureToOutcome(
  code: ActionErrorCode,
): ActionObservabilityOutcome {
  switch (code) {
    case "validation_error":
    case "invalid_input":
      return "validation_error";
    case "limit_exceeded":
      return "rate_limited";
    case "internal":
      return "internal_error";
    default:
      return "domain_error";
  }
}

function logActionOutcome(
  operationName: string | undefined,
  input: {
    correlationId: string;
    actorRole: string;
    outcome: ActionObservabilityOutcome;
    httpStatus: number;
    durationMs: number;
    errorCode?: ActionErrorCode;
  },
): void {
  if (!operationName) {
    return;
  }

  const logger = getClientLogger();
  const payload = {
    correlationId: input.correlationId,
    operationName,
    actorRole: input.actorRole,
    outcome: input.outcome,
    httpStatus: input.httpStatus,
    durationMs: input.durationMs,
    ...(input.errorCode ? { errorCode: input.errorCode } : {}),
  };

  if (input.outcome === "success") {
    logger.info("Secure action outcome", payload);
    return;
  }

  if (input.outcome === "internal_error" || input.httpStatus >= 500) {
    logger.error("Secure action outcome", undefined, payload);
    return;
  }

  logger.warn("Secure action outcome", payload);
}

export async function executeThrowingSecureAction<
  TInput,
  TParsed = TInput,
  TOutput = void,
>(options: SecureActionOptions<TInput, TParsed, TOutput>): Promise<TOutput> {
  const result = await secureAction(options);
  return unwrapActionResult(result);
}

export function unwrapActionResult<T>(result: ActionResult<T>): T {
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
}

export function unwrapResultOrThrow<
  T,
  E extends {
    error?: string;
    message?: string;
    status?: number;
    details?: unknown;
  },
>(result: Result<T, E>, fallbackMessage = "Request failed"): T {
  if (result.ok) {
    return result.data;
  }

  const code = normalizeActionErrorCode(result.error);
  throwActionFailure(
    createActionFailure(
      code,
      result.message ?? fallbackMessage,
      result.status ?? statusForActionError(code),
      result.details,
    ),
  );
}

function parseInput<TInput, TParsed>(
  schema: z.ZodType<TParsed> | undefined,
  input: TInput | undefined,
): TParsed | TInput | undefined {
  if (!schema) {
    return input;
  }
  const result = schema.safeParse(input);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

function normalizeActionErrorCode(code?: string): ActionErrorCode {
  switch (code) {
    case "unauthorized":
    case "forbidden":
    case "not_found":
    case "validation_error":
    case "conflict":
    case "invalid_input":
    case "invalid_state":
    case "limit_exceeded":
    case "internal":
      return code;
    case "invalid_transition":
      return "invalid_state";
    case "milestone_not_approved":
      return "conflict";
    case "professional_missing":
      return "not_found";
    default:
      return "internal";
  }
}

function parseNumericClaim(claim: unknown): number | null {
  if (typeof claim === "number" && Number.isFinite(claim)) {
    return claim;
  }

  if (typeof claim === "string") {
    const parsed = Number.parseInt(claim, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function validateRecentAuth(
  sessionClaims: unknown,
  maxAgeSeconds: number,
): RecentAuthValidationResult {
  if (!sessionClaims || typeof sessionClaims !== "object") {
    return { ok: false, reason: "missing_claim" };
  }

  const claims = sessionClaims as Record<string, unknown>;
  const authTime = parseNumericClaim(claims.auth_time);
  const issuedAt = parseNumericClaim(claims.iat);
  const authEpochSeconds = authTime ?? issuedAt;

  if (authEpochSeconds === null) {
    return { ok: false, reason: "missing_claim" };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const ageSeconds = Math.max(0, nowSeconds - authEpochSeconds);

  if (ageSeconds > maxAgeSeconds) {
    return { ok: false, reason: "stale_claim" };
  }

  return { ok: true };
}

function recentAuthFailureMessage(): string {
  return "Recent authentication required. Please sign in again and retry.";
}
