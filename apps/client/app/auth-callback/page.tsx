"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import { ROUTES, dashboardForRole } from "@/lib/links";
import {
  CLERK_CLAIM_REFRESH_FAILURE_MESSAGE,
  hasExpectedOnboardingClaims,
  hasRoutableAuthClaims,
  type ClaimRefreshRole,
  type ClerkPublicMetadataLike,
  waitForClerkClaimRefresh,
} from "@/app/lib/auth/clerk-claim-refresh";

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
 */

interface UserMetadata {
  role?: unknown;
  isOnboarded?: boolean;
}

const MAX_RETRIES = 5;
const RETRY_DELAY = 300;

function parseExpectedRole(value: string | null): ClaimRefreshRole | undefined {
  if (value === "client" || value === "professional") {
    return value;
  }

  return undefined;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
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

  /**
   * Get the appropriate redirect path based on user metadata
   */
  const getRedirectPath = useCallback(
    (metadata: UserMetadata | undefined): string => {
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
   * Check metadata and redirect after forcing a Clerk claim refresh.
   */
  const checkAndRedirect = useCallback(async () => {
    if (!user) return;

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
    expectedRole,
    getRedirectPath,
    getToken,
    isOnboardingTransition,
    performRedirect,
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
