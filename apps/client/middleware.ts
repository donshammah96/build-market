import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// =============================================================================
// Route Matchers
// =============================================================================

/**
 * Protected routes require authentication.
 * Unauthenticated users will be redirected to sign-in.
 */
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/professional-portal(.*)",
  "/messages(.*)",
  "/profile(.*)",
  "/client(.*)",
]);

/**
 * Professional routes - subset of protected routes for professional users
 */
const isProfessionalRoute = createRouteMatcher(["/professional-portal(.*)"]);

/**
 * Public routes - accessible to everyone, authenticated or not.
 * These bypass all authentication checks.
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/maintenance",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/verify(.*)", // Clerk email verification
  "/sso-callback(.*)", // Clerk SSO callbacks
  "/auth-callback", // Post-authentication redirect handler
  "/api(.*)", // API routes handle their own auth
  "/professionals(.*)", // Public professional listings
  "/professional", // Public professional landing page (exact)
  "/professional/sign-up(.*)", // Professional sign-up flow
  "/idea-books(.*)", // Public idea books
  "/speak-with-an-advisor(.*)",
]);

/**
 * Onboarding routes - require authentication but have special onboarding logic
 * Separated from public routes so middleware can redirect already-onboarded users
 */
const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);

/**
 * Sign-up routes - may be blocked by system settings
 */
const isSignUpRoute = createRouteMatcher([
  "/sign-up(.*)",
  "/professional/sign-up(.*)",
]);

/**
 * Routes that skip maintenance/settings checks (internal APIs, health)
 */
const isSettingsExemptRoute = createRouteMatcher([
  "/api/health(.*)",
  "/api/internal(.*)",
  "/maintenance",
]);

// =============================================================================
// System Settings Cache (for maintenance mode and signup blocking)
// =============================================================================

interface SystemSettingsCacheEntry {
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  publicSignup: boolean;
  allowProfessionalSignup: boolean;
  allowedIPs: string[];
  timestamp: number;
}

let systemSettingsCache: SystemSettingsCacheEntry | null = null;
const SETTINGS_CACHE_TTL = 60_000; // 60 seconds

async function getSystemSettingsForMiddleware(
  baseUrl: string,
): Promise<SystemSettingsCacheEntry> {
  if (
    systemSettingsCache &&
    Date.now() - systemSettingsCache.timestamp < SETTINGS_CACHE_TTL
  ) {
    return systemSettingsCache;
  }

  try {
    const internalSecret = process.env.INTERNAL_API_SECRET || "";
    const url = new URL("/api/internal/system-settings", baseUrl);
    const response = await fetch(url.toString(), {
      headers: { "x-internal-secret": internalSecret },
      signal: AbortSignal.timeout(2000),
    });

    if (!response.ok) {
      return {
        maintenanceMode: false,
        maintenanceMessage: null,
        publicSignup: true,
        allowProfessionalSignup: true,
        allowedIPs: [],
        timestamp: Date.now(),
      };
    }

    const data = await response.json();
    const entry: SystemSettingsCacheEntry = {
      maintenanceMode: data.maintenanceMode ?? false,
      maintenanceMessage: data.maintenanceMessage ?? null,
      publicSignup: data.publicSignup ?? true,
      allowProfessionalSignup: data.allowProfessionalSignup ?? true,
      allowedIPs: Array.isArray(data.allowedIPs) ? data.allowedIPs : [],
      timestamp: Date.now(),
    };
    systemSettingsCache = entry;
    return entry;
  } catch {
    return {
      maintenanceMode: false,
      maintenanceMessage: null,
      publicSignup: true,
      allowProfessionalSignup: true,
      allowedIPs: [],
      timestamp: Date.now(),
    };
  }
}

// =============================================================================
// In-Memory Cache for DB Fallback (Edge-compatible)
// =============================================================================

/**
 * Simple in-memory cache for user status lookups.
 * This reduces database calls when Clerk metadata hasn't propagated yet.
 *
 * Note: In serverless/edge environments, this cache is per-instance.
 * For production, consider using Clerk's metadata or a distributed cache.
 */
interface CacheEntry {
  isOnboarded: boolean;
  role: string | null;
  timestamp: number;
}

const userStatusCache = new Map<string, CacheEntry>();
const CACHE_TTL = 30000; // 30 seconds cache TTL

/**
 * Get cached user status if available and not expired
 */
function getCachedStatus(clerkId: string): CacheEntry | null {
  const cached = userStatusCache.get(clerkId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached;
  }
  if (cached) {
    userStatusCache.delete(clerkId);
  }
  return null;
}

/**
 * Cache user status
 */
function cacheStatus(clerkId: string, status: Omit<CacheEntry, "timestamp">) {
  userStatusCache.set(clerkId, { ...status, timestamp: Date.now() });

  // Cleanup old entries periodically (simple approach)
  if (userStatusCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of userStatusCache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        userStatusCache.delete(key);
      }
    }
  }
}

// =============================================================================
// DB Fallback Helper
// =============================================================================

/**
 * Check user onboarding status from database when Clerk metadata is stale.
 * This is called when sessionClaims.metadata.isOnboarded is undefined.
 *
 * Uses caching to minimize database calls.
 */
async function checkOnboardingFromDB(
  clerkId: string,
  baseUrl: string,
): Promise<{ isOnboarded: boolean; role: string | null }> {
  // Check cache first
  const cached = getCachedStatus(clerkId);
  if (cached) {
    return { isOnboarded: cached.isOnboarded, role: cached.role };
  }

  try {
    const internalSecret = process.env.INTERNAL_API_SECRET || "";
    const url = new URL("/api/internal/user-status", baseUrl);
    url.searchParams.set("clerkId", clerkId);

    const response = await fetch(url.toString(), {
      headers: {
        "x-internal-secret": internalSecret,
      },
      // Short timeout to avoid blocking requests
      signal: AbortSignal.timeout(2000),
    });

    if (!response.ok) {
      console.warn("[Middleware] DB fallback failed:", response.status);
      return { isOnboarded: false, role: null };
    }

    const data = await response.json();
    const result = {
      isOnboarded: data.isOnboarded ?? false,
      role: data.role ?? null,
    };

    // Log for debugging - especially important for skipped professionals
    if (result.isOnboarded && result.role === "professional") {
      console.log(
        "[Middleware] DB fallback: Professional user found as onboarded",
        {
          clerkId,
          role: result.role,
        },
      );
    }

    // Cache the result
    cacheStatus(clerkId, result);

    return result;
  } catch (error) {
    console.warn("[Middleware] DB fallback error:", error);
    // Log additional context for debugging
    console.warn("[Middleware] DB fallback failed for user:", clerkId);
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

  // --- DEV AUTH BYPASS ---
  // Allow all routes during local offline development without triggering Clerk checks
  if (
    process.env.BYPASS_AUTH === "true" &&
    process.env.NODE_ENV === "development"
  ) {
    return NextResponse.next();
  }
  // --- END DEV AUTH BYPASS ---

  // 0. Maintenance mode and signup blocking (skip for exempt routes)
  if (!isSettingsExemptRoute(req)) {
    const settings = await getSystemSettingsForMiddleware(baseUrl);

    // Maintenance mode: block non-admins and non-whitelisted IPs
    if (settings.maintenanceMode) {
      const authObject = await auth();
      const metadata = authObject.sessionClaims?.metadata as
        | { role?: string }
        | undefined;
      const isAdmin = metadata?.role === "admin";

      const forwarded = req.headers.get("x-forwarded-for");
      const clientIp =
        forwarded?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "";
      const isAllowedIp = settings.allowedIPs.includes(clientIp);

      if (!isAdmin && !isAllowedIp) {
        return NextResponse.redirect(new URL("/maintenance", req.url));
      }
    }

    // Signup blocking: redirect if registration is disabled
    if (isSignUpRoute(req)) {
      if (!settings.publicSignup) {
        return NextResponse.redirect(new URL("/?registration=closed", req.url));
      }
      if (
        pathname.startsWith("/professional/sign-up") &&
        !settings.allowProfessionalSignup
      ) {
        return NextResponse.redirect(new URL("/sign-up?pro=closed", req.url));
      }
    }
  }

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
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", pathname);
      return NextResponse.redirect(signInUrl);
    }

    // Check if user is already onboarded (from Clerk metadata)
    const metadata = sessionClaims?.metadata as
      | {
          role?: string;
          isOnboarded?: boolean;
        }
      | undefined;

    let isOnboarded = metadata?.isOnboarded;
    let userRole = metadata?.role;

    // If Clerk metadata is undefined, fall back to DB check (with caching)
    // This handles the case where Clerk metadata hasn't propagated yet
    // This is especially important for skipped professionals
    if (isOnboarded === undefined) {
      console.log(
        "[Middleware] Onboarding route: Clerk metadata undefined, checking DB",
        {
          userId,
        },
      );
      const dbResult = await checkOnboardingFromDB(userId, baseUrl);
      isOnboarded = dbResult.isOnboarded;
      userRole = dbResult.role ?? userRole;

      // Log if we found a professional via DB fallback
      if (isOnboarded && userRole === "professional") {
        console.log(
          "[Middleware] Onboarding route: Professional found via DB fallback",
          {
            userId,
          },
        );
      }
    }

    // If already onboarded, redirect to their dashboard (prevent accessing onboarding again)
    if (isOnboarded) {
      const dashboardPath =
        userRole === "professional"
          ? "/professional-portal/dashboard"
          : "/dashboard";
      console.log(
        "[Middleware] Onboarding route: User already onboarded, redirecting",
        {
          userId,
          role: userRole,
          dashboardPath,
        },
      );
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
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", pathname);
      return NextResponse.redirect(signInUrl);
    }

    // Get user role and onboarding status from Clerk's publicMetadata
    const metadata = sessionClaims?.metadata as
      | {
          role?: string;
          isOnboarded?: boolean;
        }
      | undefined;

    let userRole = metadata?.role;
    let isOnboarded = metadata?.isOnboarded;

    // If Clerk metadata is undefined, fall back to DB check (with caching)
    // This is critical for skipped professionals whose Clerk metadata may not be propagated yet
    if (isOnboarded === undefined) {
      console.log(
        "[Middleware] Clerk metadata undefined, checking DB fallback",
        {
          userId,
          pathname,
          hasRole: !!userRole,
        },
      );
      const dbResult = await checkOnboardingFromDB(userId, baseUrl);
      isOnboarded = dbResult.isOnboarded;
      userRole = dbResult.role ?? userRole;

      // Log if we found a professional via DB fallback
      if (isOnboarded && userRole === "professional") {
        console.log(
          "[Middleware] Professional user identified via DB fallback",
          {
            userId,
            pathname,
          },
        );
      }
    }

    // If user hasn't completed onboarding yet, redirect to onboarding
    if (!isOnboarded) {
      // Log for debugging - helps identify if skipped professionals are being incorrectly redirected
      if (userRole === "professional") {
        console.warn(
          "[Middleware] Professional user redirected to onboarding",
          {
            userId,
            pathname,
            metadataOnboarded: metadata?.isOnboarded,
          },
        );
      }
      const onboardingUrl = new URL("/onboarding", req.url);
      return NextResponse.redirect(onboardingUrl);
    }

    // Check role-based access for professional routes
    if (isProfessionalRoute(req) && userRole !== "professional") {
      // Non-professionals trying to access professional routes
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // 4. All other routes - allow access
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
