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
  '/api(.*)',               // API routes handle their own auth
  '/professionals(.*)',     // Public professional listings
  '/professional',           // Public professional landing page (exact)
  '/professional/sign-up(.*)', // Professional sign-up flow
  '/idea-books(.*)',        // Public idea books
  '/speak-with-an-advisor(.*)',
]);

/**
 * Onboarding routes - require authentication but have special onboarding logic
 * Separated from public routes so middleware can redirect already-onboarded users
 */
const isOnboardingRoute = createRouteMatcher([
  '/onboarding(.*)',
]);

// =============================================================================
// DB Fallback Helper
// =============================================================================

/**
 * Check user onboarding status from database when Clerk metadata is stale.
 * This is called when sessionClaims.metadata.isOnboarded is undefined.
 */
async function checkOnboardingFromDB(
  clerkId: string,
  baseUrl: string
): Promise<{ isOnboarded: boolean; role: string | null }> {
  try {
    const internalSecret = process.env.INTERNAL_API_SECRET || '';
    const url = new URL('/api/internal/user-status', baseUrl);
    url.searchParams.set('clerkId', clerkId);

    const response = await fetch(url.toString(), {
      headers: {
        'x-internal-secret': internalSecret,
      },
      // Short timeout to avoid blocking requests
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      console.warn('[Middleware] DB fallback failed:', response.status);
      return { isOnboarded: false, role: null };
    }

    const data = await response.json();
    return {
      isOnboarded: data.isOnboarded ?? false,
      role: data.role ?? null,
    };
  } catch (error) {
    console.warn('[Middleware] DB fallback error:', error);
    // If fallback fails, assume not onboarded (safer default)
    return { isOnboarded: false, role: null };
  }
}

// =============================================================================
// Middleware
// =============================================================================

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { pathname } = req.nextUrl;
  const baseUrl = req.nextUrl.origin;

  // 1. Public routes - allow access without any checks
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // 2. Onboarding routes - require auth but have special logic
  if (isOnboardingRoute(req)) {
    const authObject = await auth();
    const { userId, sessionClaims } = authObject;

    // Unauthenticated users trying to access onboarding should sign in first
    if (!userId) {
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', pathname);
      return NextResponse.redirect(signInUrl);
    }

    // Check if user is already onboarded (from Clerk metadata)
    const metadata = sessionClaims?.metadata as { 
      role?: string; 
      isOnboarded?: boolean;
    } | undefined;

    let isOnboarded = metadata?.isOnboarded;
    let userRole = metadata?.role;

    // If Clerk metadata is undefined, fall back to DB check
    // This handles the case where Clerk metadata hasn't propagated yet
    if (isOnboarded === undefined) {
      console.log('[Middleware] Clerk metadata undefined, checking DB for:', userId);
      const dbResult = await checkOnboardingFromDB(userId, baseUrl);
      isOnboarded = dbResult.isOnboarded;
      userRole = dbResult.role ?? userRole;
    }

    // If already onboarded, redirect to their dashboard (prevent accessing onboarding again)
    if (isOnboarded) {
      const dashboardPath = userRole === 'professional' 
        ? '/professional-portal/dashboard' 
        : '/dashboard';
      return NextResponse.redirect(new URL(dashboardPath, req.url));
    }

    // Not onboarded - allow access to onboarding
    return NextResponse.next();
  }

  // 3. Protected routes - require authentication AND completed onboarding
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
    const metadata = sessionClaims?.metadata as { 
      role?: string; 
      isOnboarded?: boolean;
    } | undefined;
    
    let userRole = metadata?.role;
    let isOnboarded = metadata?.isOnboarded;

    // If Clerk metadata is undefined, fall back to DB check
    if (isOnboarded === undefined) {
      console.log('[Middleware] Clerk metadata undefined for protected route, checking DB for:', userId);
      const dbResult = await checkOnboardingFromDB(userId, baseUrl);
      isOnboarded = dbResult.isOnboarded;
      userRole = dbResult.role ?? userRole;
    }

    // If user hasn't completed onboarding yet, redirect to onboarding
    if (!isOnboarded) {
      const onboardingUrl = new URL('/onboarding', req.url);
      return NextResponse.redirect(onboardingUrl);
    }

    // Check role-based access for professional routes
    if (isProfessionalRoute(req) && userRole !== 'professional') {
      // Non-professionals trying to access professional routes
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  // 4. All other routes - allow access
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

