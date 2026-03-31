import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma, UserRole, UserStatus, AdminRole } from "@build/db";
import { apiError, HttpStatus } from "./api-response";
import { initializeCorrelationId, getClientLogger } from "./resilient-api";
import { withTimeout, CorrelationIdManager } from "@build/resilience";

/**
 * Blocked user statuses. Defined as string constants for forward-compatibility
 * until `prisma generate` is run against the updated schema which adds
 * the UserStatus enum. Once regenerated, replace with:
 *   import { UserStatus } from "@build/db";
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

/**
 * Context provided to authenticated route handlers
 */
export interface AuthContext {
  clerkId: string;
  dbUserId: string;
  userEmail: string;
  userRole: UserRole;
  /** Granular admin role — only populated when userRole is ADMIN */
  adminRole?: AdminRole;
}

/**
 * Handler function with authentication context
 */
type AuthenticatedHandler<T = unknown> = (
  req: NextRequest,
  context: AuthContext,
  params?: T,
) => Promise<NextResponse>;

/**
 * Middleware that ensures the request is authenticated via Clerk
 * and provides the database user ID in the context.
 *
 * Rejects non-active users (SUSPENDED, BANNED, DEACTIVATED, ARCHIVED)
 * and soft-deleted users.
 */
export function withAuth<T = unknown>(handler: AuthenticatedHandler<T>) {
  // Using rest parameters to handle both static and dynamic routes
  const routeHandler = async (
    req: NextRequest,
    ...args: unknown[]
  ): Promise<NextResponse> => {
    const correlationId = initializeCorrelationId(req);
    const logger = getClientLogger();

    try {
      // Get Clerk user ID
      const { userId: clerkId } = await auth();

      if (!clerkId) {
        logger.warn("Unauthorized access attempt", { correlationId });
        return apiError(
          "Unauthorized. Please sign in.",
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Get database user with timeout protection against long-running queries
      const user = await withTimeout(
        async () => {
          return await prisma.user.findUnique({
            where: { clerkId, deletedAt: null },
            select: {
              id: true,
              email: true,
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
          clerkId,
          correlationId,
        });
        return apiError("User account not found", HttpStatus.NOT_FOUND);
      }

      // Reject non-active users (status field may not exist on older schema)
      const userStatus = (user as { status?: string }).status;
      if (userStatus && userStatus !== "ACTIVE") {
        const statusError = BLOCKED_STATUSES[userStatus];
        logger.warn("Non-active user attempted access", {
          userId: user.id,
          status: userStatus,
          correlationId,
        });
        return apiError(
          statusError?.message ?? "Account is not active",
          statusError?.status ?? HttpStatus.FORBIDDEN,
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
            userId: user.id,
            correlationId,
          });
          return apiError(
            "Your admin account has been deactivated.",
            HttpStatus.FORBIDDEN,
          );
        }

        adminRole = adminProfile?.role;
      }

      const context: AuthContext = {
        clerkId,
        dbUserId: user.id,
        userEmail: user.email,
        userRole: user.role,
        adminRole,
      };

      logger.debug("Request authenticated", {
        userId: user.id,
        role: user.role,
        ...(adminRole && { adminRole }),
        correlationId,
      });

      // Resolve params if provided (for dynamic routes)
      const routeContext = args[0] as { params?: Promise<T> } | undefined;
      const params = routeContext?.params
        ? await routeContext.params
        : undefined;

      return handler(req, context, params);
    } catch (error) {
      const logger = getClientLogger();
      logger.error(
        "Authentication middleware error",
        error instanceof Error ? error : new Error(String(error)),
        { correlationId },
      );
      return apiError("Authentication failed", HttpStatus.UNAUTHORIZED);
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
          userId: context.dbUserId,
          userRole: context.userRole,
          requiredRoles: allowedRoles,
          correlationId,
        });
        return apiError(
          "Forbidden. Insufficient permissions.",
          HttpStatus.FORBIDDEN,
        );
      }

      logger.debug("Role check passed", {
        userId: context.dbUserId,
        userRole: context.userRole,
        correlationId,
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
 * SUPER_ADMIN and SYSTEM_ADMIN always pass (full system access).
 *
 * Usage:
 *   export const POST = withAdminRole(["CONTENT_MODERATOR", "FINANCE_MANAGER"])(handler);
 */
const ADMIN_SUPER_ROLES: AdminRole[] = [
  AdminRole.SUPER_ADMIN,
  AdminRole.SYSTEM_ADMIN,
];

export function withAdminRole(allowedAdminRoles: AdminRole[]) {
  return (handler: AuthenticatedHandler) => {
    return withAuth(async (req, context, params) => {
      const correlationId = CorrelationIdManager.get();
      const logger = getClientLogger();

      // Must be an ADMIN user
      if (context.userRole !== UserRole.ADMIN) {
        logger.warn("Non-admin attempted admin-role-gated action", {
          userId: context.dbUserId,
          userRole: context.userRole,
          requiredAdminRoles: allowedAdminRoles,
          correlationId,
        });
        return apiError(
          "Forbidden. Admin access required.",
          HttpStatus.FORBIDDEN,
        );
      }

      // Must have an AdminProfile with a role
      if (!context.adminRole) {
        logger.warn("Admin user missing AdminProfile", {
          userId: context.dbUserId,
          correlationId,
        });
        return apiError(
          "Admin profile not configured. Contact a system administrator.",
          HttpStatus.FORBIDDEN,
        );
      }

      // SUPER_ADMIN and SYSTEM_ADMIN always pass
      const hasAccess =
        ADMIN_SUPER_ROLES.includes(context.adminRole) ||
        allowedAdminRoles.includes(context.adminRole);

      if (!hasAccess) {
        logger.warn("Admin role insufficient", {
          userId: context.dbUserId,
          adminRole: context.adminRole,
          requiredAdminRoles: allowedAdminRoles,
          correlationId,
        });
        return apiError(
          "Forbidden. You do not have the required admin permissions.",
          HttpStatus.FORBIDDEN,
        );
      }

      logger.debug("Admin role check passed", {
        userId: context.dbUserId,
        adminRole: context.adminRole,
        correlationId,
      });

      return handler(req, context, params);
    });
  };
}
