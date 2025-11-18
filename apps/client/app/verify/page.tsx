'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { ROUTES } from '../lib/links';

export default function VerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, userId } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    // Get redirect URLs from query params
    const signUpForceRedirectUrl = searchParams.get('sign_up_force_redirect_url');
    const signInFallbackRedirectUrl = searchParams.get('sign_in_fallback_redirect_url');
    const clerkStatus = searchParams.get('__clerk_status');

    // If verification is complete and user is authenticated
    if (userId && clerkStatus === 'verified') {
      // Redirect to onboarding or the specified redirect URL
      const redirectUrl = signUpForceRedirectUrl || signInFallbackRedirectUrl || ROUTES.onboarding;
      
      // Decode URL if it's encoded
      try {
        const decodedUrl = decodeURIComponent(redirectUrl);
        // Use window.location for external redirects, router.push for internal
        if (decodedUrl.startsWith('http://') || decodedUrl.startsWith('https://')) {
          window.location.href = decodedUrl;
        } else {
          router.push(decodedUrl);
        }
      } catch {
        router.push(redirectUrl);
      }
    } else if (isLoaded && !userId) {
      // If not authenticated, redirect to sign-in
      router.push(ROUTES.signIn);
    }
  }, [isLoaded, userId, searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-blue-50">
      <div className="text-center space-y-4">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-600"></div>
        <h2 className="text-xl font-semibold text-gray-900">Verifying your email...</h2>
        <p className="text-gray-600">Please wait while we complete your registration.</p>
      </div>
    </div>
  );
}

