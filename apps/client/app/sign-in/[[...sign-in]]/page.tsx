import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";
import { AuthPageSkeleton } from "@/components/auth/AuthPageSkeleton";
import type { Metadata } from "next";
import ClerkSignInWidget from "@/components/auth/ClerkSignInWidget";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getSafeRedirectUrl } from "@/app/lib/security/middleware/redirect-policy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to your Build Market account to manage your projects, find pros, and browse construction designs in Kenya.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const rawRedirectUrl =
    typeof resolvedParams?.redirect_url === "string"
      ? resolvedParams.redirect_url
      : Array.isArray(resolvedParams?.redirect_url)
        ? resolvedParams.redirect_url[0]
        : null;

  const safeRedirectUrl = getSafeRedirectUrl(rawRedirectUrl);

  const { userId } = await auth();
  if (userId) {
    redirect(safeRedirectUrl ?? "/auth-callback");
  }

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
            sizes="50vw"
            quality={60}
          />
          <div className="absolute inset-0 bg-linear-to-tr from-zinc-950 via-zinc-900/50 to-transparent" />
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
        <div className="w-full max-w-110 space-y-8">
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-6">
              <span className="text-2xl font-bold text-zinc-900">
                Build<span className="text-emerald-600">Market</span>
              </span>
            </Link>
          </div>

          <div className="bg-white p-1 rounded-2xl shadow-xl shadow-zinc-200/50 border border-zinc-100 min-h-100 flex items-center justify-center">
            <Suspense fallback={<AuthPageSkeleton variant="sign-in" />}>
              <ClerkSignInWidget redirectUrl={safeRedirectUrl ?? undefined} />
            </Suspense>
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
