"use client";

import { useEffect, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { ROUTES } from "@/lib/routes";

/**
 * Email Verification Page
 *
 * Handles Clerk email verification callback.
 * After successful verification, redirects to auth-callback which
 * determines the appropriate destination based on onboarding status.
 *
 * Query Parameters handled:
 * - __clerk_status: Verification status from Clerk
 * - sign_up_force_redirect_url: Redirect URL for new users
 * - sign_in_fallback_redirect_url: Redirect URL for existing users
 */

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, userId } = useAuth();
  const { user } = useUser();
  const [status, setStatus] = useState<"verifying" | "success" | "error">(
    "verifying",
  );
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    if (!isLoaded) return;

    const clerkStatus = searchParams.get("__clerk_status");

    // If verification is complete and user is authenticated
    if (userId && clerkStatus === "verified") {
      setStatus("success");
      setMessage("Email verified! Redirecting...");

      // Always redirect to auth-callback for consistent routing
      // It will determine if user needs onboarding or can go to dashboard
      const timer = setTimeout(() => {
        router.push(ROUTES.authCallback);
      }, 500); // Brief delay to show success message

      return () => clearTimeout(timer);
    } else if (isLoaded && !userId) {
      // If not authenticated after verification, something went wrong
      setStatus("error");
      setMessage("Verification failed. Please try signing in.");

      const timer = setTimeout(() => {
        router.push(ROUTES.signIn);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isLoaded, userId, user, searchParams, router]);

  return (
    <div className="text-center space-y-4">
      {status === "verifying" && (
        <>
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-emerald-600 border-t-transparent"></div>
          <h2 className="text-xl font-semibold text-gray-900">
            Verifying your email...
          </h2>
          <p className="text-gray-600">
            Please wait while we complete your registration.
          </p>
        </>
      )}

      {status === "success" && (
        <>
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100">
            <svg
              className="h-8 w-8 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            Email Verified!
          </h2>
          <p className="text-gray-600">{message}</p>
        </>
      )}

      {status === "error" && (
        <>
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
            <svg
              className="h-8 w-8 text-red-600"
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
          <h2 className="text-xl font-semibold text-gray-900">
            Verification Issue
          </h2>
          <p className="text-gray-600">{message}</p>
        </>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-blue-50">
      <Suspense
        fallback={
          <div className="text-center space-y-4">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-emerald-600 border-t-transparent"></div>
            <h2 className="text-xl font-semibold text-gray-900">Loading...</h2>
          </div>
        }
      >
        <VerifyContent />
      </Suspense>
    </div>
  );
}
