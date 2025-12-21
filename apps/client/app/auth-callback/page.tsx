'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { ROUTES } from '@/lib/links';

/**
 * AuthCallbackPage handles post-authentication redirect logic.
 * 
 * Instead of making an API call to check user status (which was slow - 2-3s),
 * we now read directly from Clerk's publicMetadata which is already loaded
 * in the client session.
 * 
 * Flow:
 * 1. Not signed in → /sign-in
 * 2. Signed in + onboarded + professional → /professional-portal/dashboard
 * 3. Signed in + onboarded + client → /dashboard
 * 4. Signed in + NOT onboarded → /onboarding
 * 5. Error/Unknown → /onboarding (safe default)
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();
  const [status, setStatus] = useState<'checking' | 'redirecting' | 'error'>('checking');

  useEffect(() => {
    function handleRedirect() {
      // Wait for Clerk to load
      if (!isLoaded) return;

      // If not signed in, redirect to sign-in
      if (!isSignedIn || !user) {
        router.replace(ROUTES.signIn);
        return;
      }

      try {
        setStatus('checking');
        
        // Read onboarding status directly from Clerk metadata (fast, no API call)
        const metadata = user.publicMetadata as { 
          role?: string; 
          isOnboarded?: boolean;
        } | undefined;

        const isOnboarded = metadata?.isOnboarded;
        const userRole = metadata?.role;

        setStatus('redirecting');

        // If not onboarded, redirect to onboarding
        if (!isOnboarded) {
          router.replace(ROUTES.onboarding);
          return;
        }

        // Redirect based on role
        if (userRole === 'professional') {
          router.replace(ROUTES.professionalDashboard);
        } else {
          // Default to user dashboard for clients and unknown roles
          router.replace(ROUTES.userDashboard);
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('error');
        // Safe fallback: send to onboarding
        router.replace(ROUTES.onboarding);
      }
    }

    handleRedirect();
  }, [isLoaded, isSignedIn, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
        <p className="text-gray-600 text-lg">
          {status === 'checking' && 'Checking your account...'}
          {status === 'redirecting' && 'Redirecting to your dashboard...'}
          {status === 'error' && 'Something went wrong. Redirecting...'}
        </p>
      </div>
    </div>
  );
}

