import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma, UserRole, UserStatus, AdminRole } from "@build/db";
import { apiError, HttpStatus } from "./api-response";
import { initializeCorrelationId, getClientLogger } from "./resilient-api";
import { withTimeout, CorrelationIdManager } from "@build/resilience";
import { env } from "@/app/lib/infrastructure/env";
import {
  applyPrivateNoStoreHeaders,
  type CsrfExemption,
  mutationOriginFailureMessage,
  validateTrustedMutationOriginForRequest,
} from "@/app/lib/api/http-security";

/**
 * Onboarding-adjacent statuses that are allowed to access authenticated APIs.
 * Block-only semantics are enforced through BLOCKED_STATUSES below.
 */
const ALLOWED_STATUSES = new Set<string>([
  UserStatus.ACTIVE,
  "ONBOARDING",
  "PENDING_VERIFICATION",
]);

/**
 * Blocked user statuses mapped to safe client messages.
 */
const BLOCKED_STATUSES: Record<string, { message: string; status: number }> = {
  [UserStatus.SUSPENDED]: {
    message:
      "Your account has been temporarily suspended. Please contact support.",
    status: HttpStatus.FORBIDDEN,
  },
  [UserStatus.BANNED]: {
    message:
      "Your account has been permanently banned. Please contact support.",
    status: HttpStatus.FORBIDDEN,
  },
  [UserStatus.DEACTIVATED]: {
    message:
      "Your account is being deactivated. Please contact support to reactivate.",
    status: HttpStatus.FORBIDDEN,
  },
  [UserStatus.ARCHIVED]: {
    message: "Your account has been archived. Please contact support.",
    status: HttpStatus.FORBIDDEN,
  },
};

const DEFAULT_RECENT_AUTH_MAX_AGE_SECONDS = 300;

type RecentAuthValidationResult =
  | { ok: true }
  | { ok: false; reason: "missing_claim" | "stale_claim" };

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

/**
 * Context provided to authenticated route handlers
 */
export interface AuthContext {
  clerkId: string;
  dbUserId: string;
  userRole: UserRole;
  /** Granular admin role — only populated when userRole is ADMIN */
  adminRole?: AdminRole;
}

/**
 * Handler function with authentication context
 */
type AuthenticatedHandler<T = any> = (
  req: NextRequest,
  context: AuthContext,
  params?: T,
) => Promise<NextResponse>;

export interface WithAuthOptions {
  csrf?: {
    exempt?: CsrfExemption;
    extraTrustedOrigins?: string[];
  };
  cachePolicy?: "private-no-store" | "passthrough";
  recentAuth?: {
    maxAgeSeconds?: number;
  };
}

/**
 * Middleware that ensures the request is authenticated via Clerk
 * and provides the database user ID in the context.
 *
 * Rejects blocked users (SUSPENDED, BANNED, DEACTIVATED, ARCHIVED)
 * and soft-deleted users.
 */
export function withAuth<T = any>(
  handler: AuthenticatedHandler<T>,
  options: WithAuthOptions = {},
) {
  const finalizeResponse = (response: NextResponse) =>
    options.cachePolicy === "passthrough"
      ? response
      : applyPrivateNoStoreHeaders(response);

  // Using rest parameters to handle both static and dynamic routes
  const routeHandler = async (
    req: NextRequest,
    ...args: any[]
  ): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const logger = getClientLogger();

    // --- DEV AUTH BYPASS ---
    // Short-circuit auth for local offline development
    if (env.auth.bypassEnabled) {
      const requestHost = req.nextUrl.hostname.toLowerCase();
      const appUrl = env.appUrl;
      let appHost = "";

      if (appUrl) {
        try {
          appHost = new URL(appUrl).hostname.toLowerCase();
        } catch {
          appHost = "";
        }
      }

      const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
      const isDevelopment = env.isDev;
      const isCI = env.isCI;
      const isLocalRequest = localHosts.has(requestHost);
      const isLocalAppUrl = appHost ? localHosts.has(appHost) : true;

      if (!isDevelopment || isCI || !isLocalRequest || !isLocalAppUrl) {
        logger.error(
          "Blocked unsafe BYPASS_AUTH configuration",
          new Error("BYPASS_AUTH is only allowed on local development hosts"),
          {
            correlationId,
            nodeEnv: env.nodeEnv,
            ci: env.isCI,
            requestHost,
            appHost,
            outcome: "blocked",
          },
        );

        return finalizeResponse(
          apiError(
            "Unsafe BYPASS_AUTH configuration. Disable BYPASS_AUTH outside local development.",
            HttpStatus.FORBIDDEN,
          ),
        );
      }

      logger.warn("BYPASS_AUTH enabled for local development", {
        correlationId,
        requestHost,
        appHost,
        actorRole: env.auth.devActor.userRole,
        outcome: "bypassed",
      });

      const devContext: AuthContext = {
        clerkId: env.auth.devActor.clerkId,
        dbUserId: env.auth.devActor.dbUserId,
        userRole:
          (env.auth.devActor.userRole as UserRole) || UserRole.PROFESSIONAL,
      };

      const routeContext = args[0] as { params?: Promise<T> } | undefined;
      const params = routeContext?.params
        ? await routeContext.params
        : undefined;

      const csrfCheck = validateTrustedMutationOriginForRequest(
        req,
        options.csrf,
      );
      const csrfFailureReason =
        "reason" in csrfCheck ? csrfCheck.reason : undefined;

      if (csrfFailureReason) {
        logger.warn("Blocked untrusted authenticated mutation", {
          correlationId,
          actorRole: devContext.userRole,
          method: req.method,
          outcome: "blocked",
          reason: csrfFailureReason,
        });

        return finalizeResponse(
          apiError(
            mutationOriginFailureMessage(csrfFailureReason),
            HttpStatus.FORBIDDEN,
          ),
        );
      }

      return finalizeResponse(await handler(req, devContext, params));
    }
    // --- END DEV AUTH BYPASS ---

    try {
      // Get Clerk user ID
      const authResult = await auth();
      const clerkId = authResult.userId;

      if (!clerkId) {
        logger.warn("Unauthorized access attempt", { correlationId });
        return finalizeResponse(
          apiError("Unauthorized. Please sign in.", HttpStatus.UNAUTHORIZED),
        );
      }

      if (options.recentAuth) {
        const maxAgeSeconds =
          options.recentAuth.maxAgeSeconds ??
          DEFAULT_RECENT_AUTH_MAX_AGE_SECONDS;
        const freshness = validateRecentAuth(
          authResult.sessionClaims,
          maxAgeSeconds,
        );

        if (!freshness.ok) {
          logger.warn("Blocked request requiring recent authentication", {
            correlationId,
            outcome: "blocked",
            reason: freshness.reason,
            maxAgeSeconds,
          });

          return finalizeResponse(
            apiError(recentAuthFailureMessage(), HttpStatus.UNAUTHORIZED),
          );
        }
      }

      // Get database user with timeout protection against long-running queries
      const user = await withTimeout(
        async () => {
          return await prisma.user.findUnique({
            where: { clerkId, deletedAt: null },
            select: {
              id: true,
              role: true,
              status: true,
            },
          });
        },
        5000, // 5 second timeout
        "fetch-user-in-middleware",
      );

      if (!user) {
        logger.warn("User not found in database", {
          correlationId,
          outcome: "not_found",
        });
        return finalizeResponse(
          apiError("User account not found", HttpStatus.NOT_FOUND),
        );
      }

      // Reject blocked users while allowing onboarding lifecycle statuses.
      const userStatus = (user as { status?: string }).status;
      if (userStatus && !ALLOWED_STATUSES.has(userStatus)) {
        const statusError = BLOCKED_STATUSES[userStatus];
        logger.warn("Non-active user attempted access", {
          status: userStatus,
          actorRole: user.role,
          correlationId,
          outcome: "blocked",
        });
        return finalizeResponse(
          apiError(
            statusError?.message ?? "Account is not active",
            statusError?.status ?? HttpStatus.FORBIDDEN,
          ),
        );
      }

      // For admin users, fetch the granular AdminRole from AdminProfile
      let adminRole: AdminRole | undefined;
      if (user.role === UserRole.ADMIN) {
        const adminProfile = await prisma.adminProfile.findUnique({
          where: { userId: user.id },
          select: { role: true, isActive: true },
        });

        if (adminProfile && !adminProfile.isActive) {
          logger.warn("Inactive admin attempted access", {
            correlationId,
            actorRole: user.role,
            outcome: "blocked",
          });
          return finalizeResponse(
            apiError(
              "Your admin account has been deactivated.",
              HttpStatus.FORBIDDEN,
            ),
          );
        }

        adminRole = adminProfile?.role;
      }

      const context: AuthContext = {
        clerkId,
        dbUserId: user.id,
        userRole: user.role,
        adminRole,
      };

      logger.debug("Request authenticated", {
        actorRole: user.role,
        ...(adminRole && { actorAdminRole: adminRole }),
        correlationId,
        outcome: "authenticated",
      });

      // Resolve params if provided (for dynamic routes)
      const routeContext = args[0] as { params?: Promise<T> } | undefined;
      const params = routeContext?.params
        ? await routeContext.params
        : undefined;
      const csrfCheck = validateTrustedMutationOriginForRequest(
        req,
        options.csrf,
      );
      const csrfFailureReason =
        "reason" in csrfCheck ? csrfCheck.reason : undefined;

      if (csrfFailureReason) {
        logger.warn("Blocked untrusted authenticated mutation", {
          correlationId,
          actorRole: user.role,
          method: req.method,
          outcome: "blocked",
          reason: csrfFailureReason,
        });

        return finalizeResponse(
          apiError(
            mutationOriginFailureMessage(csrfFailureReason),
            HttpStatus.FORBIDDEN,
          ),
        );
      }

      return finalizeResponse(await handler(req, context, params));
    } catch (error) {
      const logger = getClientLogger();
      logger.error(
        "Authentication middleware error",
        error instanceof Error ? error : new Error(String(error)),
        { correlationId },
      );
      return finalizeResponse(
        apiError("Authentication failed", HttpStatus.UNAUTHORIZED),
      );
    }
  };

  return routeHandler;
}

/**
 * Middleware for checking if user has a specific role.
 * Uses the typed UserRole enum from Prisma for compile-time safety.
 * Note: This uses the role from AuthContext to avoid an extra database query.
 */
export function withRole(allowedRoles: UserRole[]) {
  return (handler: AuthenticatedHandler) => {
    return withAuth(async (req, context, params) => {
      const correlationId = CorrelationIdManager.get();
      const logger = getClientLogger();

      if (!allowedRoles.includes(context.userRole)) {
        logger.warn("Access denied - insufficient permissions", {
          actorRole: context.userRole,
          requiredRoles: allowedRoles,
          correlationId,
          outcome: "forbidden",
        });
        return apiError(
          "Forbidden. Insufficient permissions.",
          HttpStatus.FORBIDDEN,
        );
      }

      logger.debug("Role check passed", {
        actorRole: context.userRole,
        correlationId,
        outcome: "authorized",
      });

      return handler(req, context, params);
    });
  };
}

/**
 * Middleware for checking if an admin user has a specific AdminRole.
 * Composes on top of withAuth — first verifies userRole is ADMIN,
 * then checks the granular AdminRole from AdminProfile.
 *
 * SUPER_ADMIN always passes.
 *
 * Usage:
 *   export const POST = withAdminRole(["CONTENT_MODERATOR", "FINANCE_MANAGER"])(handler);
 */
const ADMIN_SUPER_ROLES = new Set<AdminRole>([AdminRole.SUPER_ADMIN]);

export function withAdminRole(allowedAdminRoles: AdminRole[]) {
  return (handler: AuthenticatedHandler) => {
    return withAuth(async (req, context, params) => {
      const correlationId = CorrelationIdManager.get();
      const logger = getClientLogger();

      // Must be an ADMIN user
      if (context.userRole !== UserRole.ADMIN) {
        logger.warn("Non-admin attempted admin-role-gated action", {
          actorRole: context.userRole,
          requiredAdminRoles: allowedAdminRoles,
          correlationId,
          outcome: "forbidden",
        });
        return apiError(
          "Forbidden. Admin access required.",
          HttpStatus.FORBIDDEN,
        );
      }

      // Must have an AdminProfile with a role
      if (!context.adminRole) {
        logger.warn("Admin user missing AdminProfile", {
          correlationId,
          actorRole: context.userRole,
          outcome: "misconfigured",
        });
        return apiError(
          "Admin profile not configured. Contact a system administrator.",
          HttpStatus.FORBIDDEN,
        );
      }

      // SUPER_ADMIN always passes.
      const hasAccess =
        ADMIN_SUPER_ROLES.has(context.adminRole) ||
        allowedAdminRoles.includes(context.adminRole);

      if (!hasAccess) {
        logger.warn("Admin role insufficient", {
          actorAdminRole: context.adminRole,
          requiredAdminRoles: allowedAdminRoles,
          correlationId,
          outcome: "forbidden",
        });
        return apiError(
          "Forbidden. You do not have the required admin permissions.",
          HttpStatus.FORBIDDEN,
        );
      }

      logger.debug("Admin role check passed", {
        actorAdminRole: context.adminRole,
        correlationId,
        outcome: "authorized",
      });

      return handler(req, context, params);
    });
  };
}
