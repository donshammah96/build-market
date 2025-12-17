'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { ROUTES } from '@/lib/links';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [status, setStatus] = useState<'checking' | 'redirecting' | 'error'>('checking');

  useEffect(() => {
    async function handleRedirect() {
      // Wait for Clerk to load
      if (!isLoaded) return;

      // If not signed in, redirect to sign-in
      if (!isSignedIn) {
        router.replace(ROUTES.signIn);
        return;
      }

      try {
        setStatus('checking');
        
        // Check user's profile to determine role and completion status
        const response = await fetch('/api/user/profile');
        
        if (response.status === 404) {
          // User doesn't exist in DB - redirect to homepage (NOT onboarding)
          // Let them browse the site and choose to sign up when ready
          setStatus('redirecting');
          router.replace(ROUTES.home);
          return;
        }

        if (!response.ok) {
          // API error - redirect to homepage as fallback
          console.error('Failed to fetch profile:', response.statusText);
          setStatus('redirecting');
          router.replace(ROUTES.home);
          return;
        }

        const data = await response.json();
        const userRole = data?.data?.user?.role;
        const isProfileComplete = data?.data?.user?.isProfileComplete;

        setStatus('redirecting');

        // Redirect based on role
        if (userRole === 'professional') {
          router.replace(ROUTES.professionalDashboard);
        } else if (userRole === 'client') {
          router.replace(ROUTES.userDashboard);
        } else {
          // Unknown role or new user - redirect to homepage (NOT onboarding)
          router.replace(ROUTES.home);
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('error');
        // Fallback to homepage on error
        router.replace(ROUTES.home);
      }
    }

    handleRedirect();
  }, [isLoaded, isSignedIn, router]);

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
