import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/professional-portal(.*)',
  '/messages(.*)',
  '/profile(.*)',
  '/client(.*)',
  '/professional(.*)',
]);

// Define routes that should be accessible even without profile completion
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/verify(.*)',        // Clerk email verification
  '/sso-callback(.*)',  // Clerk SSO callbacks
  '/onboarding',
  '/api(.*)',
  '/professionals(.*)',
  '/idea-books(.*)',
  '/speak-with-an-advisor(.*)',
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId } = await auth();
  const { pathname } = req.nextUrl;

  // Allow access to public routes
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // If user is accessing a protected route
  if (isProtectedRoute(req) && userId) {
    // Check if user exists in database
    try {
      const baseUrl = req.nextUrl.origin;
      const response = await fetch(`${baseUrl}/api/user/profile`, {
        headers: {
          'Cookie': req.headers.get('cookie') || '',
        },
      });

      if (response.status === 404) {
        // User doesn't exist in DB -> redirect to onboarding
        // This only happens for new users who haven't completed initial onboarding
        if (pathname !== '/onboarding') {
          const onboardingUrl = new URL('/onboarding', req.url);
          return NextResponse.redirect(onboardingUrl);
        }
      } else if (response.ok) {
        const data = await response.json();
        const userRole = data?.data?.user?.role;
        const isProfileComplete = data?.data?.user?.isProfileComplete;

        // If user is on onboarding but already exists in DB, redirect to dashboard
        // (They've completed initial onboarding, even if profile is incomplete)
        if (pathname === '/onboarding') {
          const dashboardPath = userRole === 'professional' 
            ? '/professional-portal/dashboard' 
            : '/dashboard';
          const dashboardUrl = new URL(dashboardPath, req.url);
          return NextResponse.redirect(dashboardUrl);
        }
        
        // Note: We no longer redirect incomplete profiles to onboarding.
        // Instead, the dashboard will show a ProfileCompletionBanner.
      }
    } catch (error) {
      console.error('Profile check error in middleware:', error);
      // Continue on error to avoid blocking access
    }
  }

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
