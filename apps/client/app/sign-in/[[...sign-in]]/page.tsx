import { SignIn } from '@clerk/nextjs'
import { ROUTES } from '../../lib/links'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In - Build Market',
  description: 'Sign in to your Build Market account',
}

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <SignIn path="/sign-in" fallbackRedirectUrl={ROUTES.onboarding} />
    </div>
  );
}