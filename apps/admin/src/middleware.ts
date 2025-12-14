import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { CustomJwtSessionClaims } from "@repo/types";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)","/unauthorized(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);


export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    const authObj = await auth();
    if (!authObj.userId) {
      return authObj.redirectToSignIn({ returnBackUrl: req.url });
    }

    const { userId, sessionClaims } = authObj;

    if (userId && sessionClaims) {
      const userRole = (sessionClaims as CustomJwtSessionClaims).metadata?.role;

      if (isAdminRoute(req)) {
        const isAuthorized = authObj.has({ role: "admin" }) || (authObj.sessionClaims as CustomJwtSessionClaims)?.metadata?.role === "admin";
        
        if (!isAuthorized) {
          return Response.redirect(new URL("/unauthorized", req.url));
        }
        return Response.redirect(new URL("/admin", req.url));
      }
    }
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