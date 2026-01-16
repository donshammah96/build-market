import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { CustomJwtSessionClaims } from "@repo/types";

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

// Helper to check if user has required role
function hasRole(
  authObj: any,
  allowedRoles: string[]
): boolean {
  const sessionClaims = authObj.sessionClaims as CustomJwtSessionClaims;
  const userRole = sessionClaims?.metadata?.role;
  
  // Check Clerk's built-in role check first
  for (const role of allowedRoles) {
    if (authObj.has({ role })) {
      return true;
    }
  }
  
  // Fallback to metadata role
  if (userRole && allowedRoles.includes(userRole)) {
    return true;
  }
  
  return false;
}

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) {
    return; // Allow public routes
  }

  const authObj = await auth();
  
  if (!authObj.userId) {
    return authObj.redirectToSignIn({ returnBackUrl: req.url });
  }

  // Check verification routes - requires admin or verification_admin
  if (isVerificationRoute(req)) {
    const isAuthorized = hasRole(authObj, ["admin", "verification_admin"]);
    
    if (!isAuthorized) {
      return Response.redirect(new URL("/unauthorized", req.url));
    }
    return; // Allow access to verification routes
  }

  // Check dashboard routes - requires admin role
  if (isDashboardRoute(req)) {
    const isAuthorized = hasRole(authObj, ["admin"]);
    
    if (!isAuthorized) {
      return Response.redirect(new URL("/unauthorized", req.url));
    }
    return; // Allow access to dashboard routes
  }

  // For any other protected route, require at least admin role
  const isAuthorized = hasRole(authObj, ["admin", "verification_admin"]);
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