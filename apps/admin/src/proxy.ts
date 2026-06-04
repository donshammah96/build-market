import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
  ADMIN_ROUTE_POLICY_MAP,
  type AdminAccessRole,
} from "@/lib/security/authorization-policy";
import {
  normalizeAdminAccessRole,
  parseSessionMetadata,
} from "@/lib/security/claims";
import { adminEnvConfig } from "@/lib/infrastructure/env";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/unauthorized(.*)"]);
// Dashboard routes that require admin access
const isDashboardRoute = createRouteMatcher([
  "/",
  "/professionals(.*)",
  "/projects(.*)",
  "/users(.*)",
  "/settings(.*)",
]);
// Verification routes that require verification_admin or admin role
const isVerificationRoute = createRouteMatcher(["/verifications(.*)"]);

type MiddlewareAuthObject = {
  userId: string | null;
  sessionClaims: unknown;
  has: (args: { role: string }) => boolean;
  redirectToSignIn: (args: { returnBackUrl: string }) => Response;
};

function hasAllowedRole(
  authObj: MiddlewareAuthObject,
  allowedRoles: readonly AdminAccessRole[],
): boolean {
  for (const role of allowedRoles) {
    if (authObj.has({ role })) {
      return true;
    }
  }

  const metadata = parseSessionMetadata(authObj.sessionClaims);
  const normalizedRole = normalizeAdminAccessRole(metadata?.role);
  return normalizedRole ? allowedRoles.includes(normalizedRole) : false;
}

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) {
    return; // Allow public routes
  }

  const isDev = adminEnvConfig.NODE_ENV === "development";
  const devBypass = adminEnvConfig.DEV_ADMIN_BYPASS;

  if (isDev && devBypass) {
    return; // Allow access to all pages under dev bypass
  }

  const authObj = await auth();

  if (!authObj.userId) {
    return authObj.redirectToSignIn({ returnBackUrl: req.url });
  }

  // Check verification routes - requires admin or verification_admin
  if (isVerificationRoute(req)) {
    const isAuthorized = hasAllowedRole(
      authObj as MiddlewareAuthObject,
      ADMIN_ROUTE_POLICY_MAP.verification,
    );

    if (!isAuthorized) {
      return Response.redirect(new URL("/unauthorized", req.url));
    }
    return; // Allow access to verification routes
  }

  // Check dashboard routes - requires admin role
  if (isDashboardRoute(req)) {
    const isAuthorized = hasAllowedRole(
      authObj as MiddlewareAuthObject,
      ADMIN_ROUTE_POLICY_MAP.dashboard,
    );

    if (!isAuthorized) {
      return Response.redirect(new URL("/unauthorized", req.url));
    }
    return; // Allow access to dashboard routes
  }

  // For any other protected route, require at least admin role
  const isAuthorized = hasAllowedRole(
    authObj as MiddlewareAuthObject,
    ADMIN_ROUTE_POLICY_MAP.defaultProtected,
  );
  if (!isAuthorized) {
    return Response.redirect(new URL("/unauthorized", req.url));
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
