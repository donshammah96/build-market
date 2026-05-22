"use client";

import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "@/lib/links";
import { ArrowLeft } from "lucide-react";

/**
 * Sign-In Page
 *
 * Uses Clerk's SignIn component for authentication.
 * After successful sign-in, redirects to /auth-callback which handles:
 * - Checking onboarding status
 * - Routing to the appropriate dashboard based on user role
 *
 * This ensures consistent behavior whether the user is new or returning.
 */
export default function SignInPage() {
  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* Left Panel (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-zinc-900 items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="/hero-signin.jpg"
            alt="Modern Architecture"
            fill
            className="object-cover opacity-30 grayscale"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-zinc-950 via-zinc-900/50 to-transparent" />
        </div>

        <div className="relative z-10 text-center px-10">
          <h1 className="text-4xl font-bold text-white mb-4">Welcome Back</h1>
          <p className="text-zinc-400 max-w-sm mx-auto">
            Continue building your legacy with Kenya&apos;s premier construction
            marketplace.
          </p>
        </div>
      </div>

      {/* Right Panel (Form) */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 bg-zinc-50 lg:bg-white">
        <div className="w-full max-w-[440px] space-y-8">
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-6">
              <span className="text-2xl font-bold text-zinc-900">
                Build<span className="text-emerald-600">Market</span>
              </span>
            </Link>
          </div>

          <div className="bg-white p-1 rounded-2xl shadow-xl shadow-zinc-200/50 border border-zinc-100">
            <SignIn
              routing="hash"
              forceRedirectUrl={ROUTES.authCallback}
              signUpUrl={ROUTES.signUp}
              appearance={{
                layout: { socialButtonsPlacement: "bottom" },
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none p-6 sm:p-8 w-full border-0",
                  headerTitle:
                    "text-2xl font-bold text-zinc-900 tracking-tight",
                  headerSubtitle: "text-zinc-500 font-normal",
                  socialButtonsBlockButton:
                    "bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-600 font-medium rounded-lg h-11 transition-colors",
                  formButtonPrimary:
                    "bg-zinc-900 hover:bg-zinc-800 text-white shadow-lg rounded-lg h-11 font-semibold transition-all",
                  formFieldInput:
                    "h-11 border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg bg-zinc-50/50 transition-all",
                  footerActionLink:
                    "text-emerald-600 hover:text-emerald-700 font-medium hover:underline",
                },
              }}
            />
          </div>

          {/* Layer 1: Clickwrap Agreement */}
          <p className="text-center text-xs text-zinc-400 leading-relaxed">
            By signing in, you agree to Build Market&apos;s{" "}
            <Link
              href="/legal/professional-terms"
              target="_blank"
              className="text-emerald-600 hover:underline"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/legal/privacy"
              target="_blank"
              className="text-emerald-600 hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </p>

          <div className="text-center">
            <Link
              href="/"
              className="inline-flex items-center text-sm text-zinc-400 hover:text-zinc-900 transition-colors group"
            >
              <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
