import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// =============================================================================
// Route Matchers
// =============================================================================

/**
 * Protected routes require authentication.
 * Unauthenticated users will be redirected to sign-in.
 */
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/professional-portal(.*)',
  '/messages(.*)',
  '/profile(.*)',
  '/client(.*)',
]);

/**
 * Professional routes - subset of protected routes for professional users
 */
const isProfessionalRoute = createRouteMatcher([
  '/professional-portal(.*)',
]);

/**
 * Public routes - accessible to everyone, authenticated or not.
 * These bypass all authentication checks.
 */
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/verify(.*)',            // Clerk email verification
  '/sso-callback(.*)',      // Clerk SSO callbacks  
  '/auth-callback',         // Post-authentication redirect handler
  '/onboarding(.*)',        // Onboarding flows (including /onboarding/professional)
  '/api(.*)',               // API routes handle their own auth
  '/professionals(.*)',     // Public professional listings
  '/professional',           // Public professional landing page (exact)
  '/professional/sign-up(.*)', // Professional sign-up flow
  '/idea-books(.*)',        // Public idea books
  '/speak-with-an-advisor(.*)',
]);

// =============================================================================
// Middleware
// =============================================================================

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { pathname } = req.nextUrl;

  // 1. Public routes - allow access without any checks
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // 2. Protected routes - require authentication
  if (isProtectedRoute(req)) {
    const authObject = await auth();
    const { userId, sessionClaims } = authObject;

    // Redirect unauthenticated users to sign-in with return URL
    if (!userId) {
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', pathname);
      return NextResponse.redirect(signInUrl);
    }

    // Get user role and onboarding status from Clerk's publicMetadata
    // This is set during onboarding via Clerk's backend API
    const metadata = sessionClaims?.metadata as { 
      role?: string; 
      isOnboarded?: boolean;
    } | undefined;
    
    const userRole = metadata?.role;
    const isOnboarded = metadata?.isOnboarded;

    // If user hasn't completed onboarding yet, redirect to onboarding
    // Skip this check if they're already headed to a public/onboarding route
    if (!isOnboarded && pathname !== '/onboarding') {
      const onboardingUrl = new URL('/onboarding', req.url);
      return NextResponse.redirect(onboardingUrl);
    }

    // If user is on onboarding but already onboarded, redirect to their dashboard
    if (isOnboarded && pathname === '/onboarding') {
      const dashboardPath = userRole === 'professional' 
        ? '/professional-portal/dashboard' 
        : '/dashboard';
      return NextResponse.redirect(new URL(dashboardPath, req.url));
    }

    // Optional: Check role-based access for professional routes
    if (isProfessionalRoute(req) && userRole !== 'professional') {
      // Non-professionals trying to access professional routes
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  // 3. All other routes - allow access
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
