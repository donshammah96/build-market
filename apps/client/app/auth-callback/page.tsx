"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import { ROUTES, dashboardForRole } from "@/lib/links";
import { env } from "@/app/lib/infrastructure/env";
import { isBlockedUserStatus } from "@build/enums";
import { isClaimFresh } from "@build/security-clerk";
import {
  CLERK_CLAIM_REFRESH_FAILURE_MESSAGE,
  hasExpectedOnboardingClaims,
  hasRoutableAuthClaims,
  type ClaimRefreshRole,
  type ClerkPublicMetadataLike,
  waitForClerkClaimRefresh,
} from "@/app/lib/auth/clerk-claim-refresh";
import { getSafeRedirectUrl } from "@/app/lib/security/redirect-url";

/**
 * AuthCallbackPage handles post-authentication redirect logic.
 *
 * This page acts as a central routing hub after authentication.
 * It reads the user's onboarding status from Clerk's publicMetadata
 * and redirects accordingly.
 *
 * Flow:
 * 1. Not signed in → /sign-in
 * 2. Signed in + onboarded + professional → /professional-portal/dashboard
 * 3. Signed in + onboarded + client → /homeowner-dashboard
 * 4. Signed in + NOT onboarded → /onboarding
 *
 * Session freshness:
 * - Uses Clerk refresh primitives before any role-gated redirect
 * - Reuses the shared claim-refresh helper from onboarding flows
 * - Fails closed for onboarding transition callbacks if refreshed claims
 *   cannot be confirmed
 * - Tier 1 (180s, `isClaimFresh` from `@build/security-clerk`): before
 *   trusting a refreshed `role === "ADMIN"` claim and redirecting off-app to
 *   `env.adminAppUrl`, the session claim's `iat` must be within 180s. If it
 *   isn't, one `getToken({ skipCache: true })` cycle is forced first —
 *   otherwise a stale JWT could carry a role that's since been revoked in
 *   the DB but hasn't propagated to the token yet.
 */

interface UserMetadata {
  role?: unknown;
  isOnboarded?: boolean;
  status?: unknown;
}

const MAX_RETRIES = 5;
const RETRY_DELAY = 300;
const ADMIN_CLAIM_FRESHNESS_SECONDS = 180; // Tier 1

function parseExpectedRole(value: string | null): ClaimRefreshRole | undefined {
  if (!value) return undefined;
  const lower = value.trim().toLowerCase();
  if (lower === "client" || lower === "professional" || lower === "admin") {
    return lower as ClaimRefreshRole;
  }
  return undefined;
}

export function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken, sessionClaims } = useAuth();
  const { signOut } = useClerk();
  const [status, setStatus] = useState<"checking" | "redirecting" | "error">(
    "checking",
  );
  const [message, setMessage] = useState("Verifying your session...");
  const retryCount = useRef(0);

  const transitionSource = searchParams.get("transition");
  const expectedRole = parseExpectedRole(searchParams.get("expectedRole"));
  const isOnboardingTransition =
    transitionSource === "onboarding" && Boolean(expectedRole);
  const rawRedirectUrl = searchParams.get("redirect_url");
  const safeRedirectUrl = getSafeRedirectUrl(rawRedirectUrl);

  /**
   * Get the appropriate redirect path based on user metadata
   */
  const getRedirectPath = useCallback(
    (metadata: UserMetadata | undefined): string => {
      const normalizedRole =
        typeof metadata?.role === "string"
          ? metadata.role.trim().toUpperCase()
          : undefined;

      if (normalizedRole === "ADMIN") {
        return env.adminAppUrl;
      }

      if (metadata?.isOnboarded !== true) {
        return ROUTES.onboarding;
      }
      return dashboardForRole(
        typeof metadata?.role === "string" ? metadata.role : undefined,
      );
    },
    [],
  );

  /**
   * Perform redirect with router.replace for SPA navigation
   */
  const performRedirect = useCallback(
    (path: string, redirectMessage = "Redirecting...") => {
      setStatus("redirecting");
      setMessage(redirectMessage);
      router.replace(path);
    },
    [router],
  );

  /**
   * Tier 1 (180s) session freshness gate. Must pass before any redirect that
   * trusts a `role === "ADMIN"` claim, since that redirect sends the user
   * off-app to `env.adminAppUrl` — a stale claim here is a stale privilege
   * grant, not just a stale dashboard link. Forces one hard token refresh if
   * the current claim is older than `ADMIN_CLAIM_FRESHNESS_SECONDS`.
   */
  const ensureAdminClaimFresh = useCallback(async (): Promise<boolean> => {
    if (isClaimFresh(sessionClaims, ADMIN_CLAIM_FRESHNESS_SECONDS)) {
      return true;
    }
    try {
      await getToken({ skipCache: true });
      // A forced skipCache fetch mints a token with a fresh `iat`; treat the
      // claim as fresh immediately after rather than waiting on the
      // client-side session object to propagate the new claims payload.
      return true;
    } catch {
      return false;
    }
  }, [getToken, sessionClaims]);

  /**
   * Check metadata and redirect after forcing a Clerk claim refresh.
   */
  const checkAndRedirect = useCallback(async () => {
    if (!user) return;

    // Block suspended/banned/deactivated/archived users before any routing.
    // publicMetadata is the authoritative source at this point because the JWT
    // claim may not yet reflect an admin status update.
    const rawStatus = (user.publicMetadata as UserMetadata | undefined)?.status;
    if (isBlockedUserStatus(rawStatus)) {
      router.replace(`/unauthorized-sign-in?reason=${rawStatus}`);
      return;
    }

    const refreshResult = await waitForClerkClaimRefresh({
      user,
      getToken,
      maxAttempts: MAX_RETRIES,
      retryDelayMs: RETRY_DELAY,
      isReady: (metadata: ClerkPublicMetadataLike) =>
        isOnboardingTransition && expectedRole
          ? hasExpectedOnboardingClaims(metadata, expectedRole)
          : hasRoutableAuthClaims(metadata),
      onAttempt: (attempt, maxAttempts) => {
        retryCount.current = attempt;
        setMessage(`Refreshing session (attempt ${attempt}/${maxAttempts})...`);
      },
    });

    if (refreshResult.ok) {
      const metadata = refreshResult.metadata as UserMetadata | undefined;
      const normalizedRole =
        typeof metadata?.role === "string"
          ? metadata.role.trim().toUpperCase()
          : undefined;
      const isOnboarded = metadata?.isOnboarded === true;
      const isAdminRedirect = normalizedRole === "ADMIN";

      if (isAdminRedirect) {
        setMessage("Confirming session...");
        const isFresh = await ensureAdminClaimFresh();
        if (!isFresh) {
          setStatus("error");
          setMessage(CLERK_CLAIM_REFRESH_FAILURE_MESSAGE);
          return;
        }
      }

      if (safeRedirectUrl && (isOnboarded || isAdminRedirect)) {
        performRedirect(safeRedirectUrl);
        return;
      }

      performRedirect(getRedirectPath(refreshResult.metadata));
      return;
    }

    if (isOnboardingTransition) {
      setStatus("error");
      setMessage(CLERK_CLAIM_REFRESH_FAILURE_MESSAGE);
      return;
    }

    const currentMetadata = user.publicMetadata as UserMetadata | undefined;
    if (currentMetadata?.isOnboarded === true) {
      setStatus("error");
      setMessage(CLERK_CLAIM_REFRESH_FAILURE_MESSAGE);
      return;
    }

    retryCount.current = 0;
    performRedirect(ROUTES.onboarding, "Taking you to onboarding...");
  }, [
    ensureAdminClaimFresh,
    expectedRole,
    getRedirectPath,
    getToken,
    isOnboardingTransition,
    performRedirect,
    router,
    safeRedirectUrl,
    user,
  ]);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn || !user) {
      router.replace(ROUTES.signIn);
      return;
    }

    retryCount.current = 0;
    setStatus("checking");
    setMessage("Verifying your session...");
    void checkAndRedirect();
  }, [checkAndRedirect, isLoaded, isSignedIn, router, user]);

  // Handle error state with retry option
  const handleRetry = () => {
    retryCount.current = 0;
    setStatus("checking");
    setMessage("Verifying your session...");
    void checkAndRedirect();
  };

  // Handle sign out if stuck
  const handleSignOut = async () => {
    await signOut({ redirectUrl: "/" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-zinc-50 to-zinc-100">
      <div className="text-center max-w-md mx-auto px-4">
        {/* Loading Spinner */}
        <div className="relative mb-6">
          <div className="w-16 h-16 mx-auto">
            {status === "error" ? (
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
            ) : (
              <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        </div>

        {/* Status Message */}
        <h2 className="text-xl font-semibold text-zinc-800 mb-2">
          {status === "checking" && "Checking your account..."}
          {status === "redirecting" && "Taking you to your dashboard..."}
          {status === "error" && "Something went wrong"}
        </h2>

        <p className="text-zinc-500 text-sm mb-6">{message}</p>

        {/* Error Actions */}
        {status === "error" && (
          <div className="flex flex-col gap-3">
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-zinc-600 hover:text-zinc-800 transition-colors text-sm"
            >
              Sign out and start over
            </button>
          </div>
        )}

        {/* Progress indicator for multiple retries */}
        {status === "checking" && retryCount.current > 0 && (
          <div className="mt-4">
            <div className="flex justify-center gap-1">
              {[...Array(MAX_RETRIES)].map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i < retryCount.current ? "bg-emerald-500" : "bg-zinc-300"
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-zinc-50 to-zinc-100">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="relative mb-6">
              <div className="w-16 h-16 mx-auto border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-zinc-800 mb-2">
              Loading your session...
            </h2>
            <p className="text-zinc-500 text-sm mb-6">
              Verifying your session...
            </p>
          </div>
        </div>
      }
    >
      <AuthCallbackPage />
    </Suspense>
  );
}
