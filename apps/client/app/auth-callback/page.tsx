"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { ROUTES } from "@/lib/links";

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
 * 3. Signed in + onboarded + client → /dashboard
 * 4. Signed in + NOT onboarded → /onboarding
 *
 * Performance optimizations:
 * - Uses Clerk's session directly (no API calls)
 * - Implements retry with user.reload() for stale metadata
 * - Has timeout protection to prevent infinite loading
 */

interface UserMetadata {
  role?: "client" | "professional";
  isOnboarded?: boolean;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 500; // 500ms between retries
const TOTAL_TIMEOUT = 10000; // 10 seconds max

export default function AuthCallbackPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [status, setStatus] = useState<"checking" | "redirecting" | "error">(
    "checking",
  );
  const [message, setMessage] = useState("Verifying your session...");
  const retryCount = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef(Date.now());

  /**
   * Get the appropriate redirect path based on user metadata
   */
  const getRedirectPath = useCallback(
    (metadata: UserMetadata | undefined): string => {
      if (!metadata?.isOnboarded) {
        return ROUTES.onboarding;
      }
      return metadata.role === "professional"
        ? ROUTES.professionalDashboard
        : ROUTES.userDashboard;
    },
    [],
  );

  /**
   * Perform redirect with router.replace for SPA navigation
   */
  const performRedirect = useCallback(
    (path: string) => {
      setStatus("redirecting");
      setMessage("Redirecting to your dashboard...");

      // Clear any pending timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Use router.replace for smooth SPA navigation
      router.replace(path);
    },
    [router],
  );

  /**
   * Check metadata and redirect, with retry support for stale metadata
   */
  const checkAndRedirect = useCallback(async () => {
    if (!user) return;

    const metadata = user.publicMetadata as UserMetadata | undefined;

    // If metadata exists and shows onboarded, redirect immediately
    if (metadata?.isOnboarded !== undefined) {
      performRedirect(getRedirectPath(metadata));
      return;
    }

    // Metadata is undefined - could be stale. Try to reload user session
    if (retryCount.current < MAX_RETRIES) {
      retryCount.current++;
      setMessage(
        `Refreshing session (attempt ${retryCount.current}/${MAX_RETRIES})...`,
      );

      try {
        // Reload user to get fresh metadata from Clerk
        await user.reload();

        // Check again after reload
        const freshMetadata = user.publicMetadata as UserMetadata | undefined;

        if (freshMetadata?.isOnboarded !== undefined) {
          performRedirect(getRedirectPath(freshMetadata));
          return;
        }

        // Still undefined, wait and retry
        if (retryCount.current < MAX_RETRIES) {
          timeoutRef.current = setTimeout(checkAndRedirect, RETRY_DELAY);
        } else {
          // Max retries reached, assume not onboarded (safe default)
          performRedirect(ROUTES.onboarding);
        }
      } catch (error) {
        console.error("Failed to reload user session:", error);
        // On error, redirect to onboarding as safe default
        performRedirect(ROUTES.onboarding);
      }
    } else {
      // Max retries reached without valid metadata
      performRedirect(ROUTES.onboarding);
    }
  }, [user, performRedirect, getRedirectPath]);

  useEffect(() => {
    // Wait for Clerk to load
    if (!isLoaded) return;

    // If not signed in, redirect to sign-in
    if (!isSignedIn || !user) {
      router.replace(ROUTES.signIn);
      return;
    }

    // Set up global timeout to prevent infinite loading
    const globalTimeout = setTimeout(() => {
      if (status === "checking") {
        console.warn("Auth callback timeout - redirecting to onboarding");
        performRedirect(ROUTES.onboarding);
      }
    }, TOTAL_TIMEOUT);

    // Start checking metadata
    checkAndRedirect();

    return () => {
      clearTimeout(globalTimeout);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [
    isLoaded,
    isSignedIn,
    user,
    router,
    status,
    checkAndRedirect,
    performRedirect,
  ]);

  // Handle error state with retry option
  const handleRetry = () => {
    retryCount.current = 0;
    startTime.current = Date.now();
    setStatus("checking");
    setMessage("Retrying...");
    checkAndRedirect();
  };

  // Handle sign out if stuck
  const handleSignOut = async () => {
    await signOut({ redirectUrl: "/" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100">
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
