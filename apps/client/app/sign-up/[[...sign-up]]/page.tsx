import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "@/lib/links";
import { ArrowLeft, Search, BookOpen, ShieldCheck } from "lucide-react";
import { Suspense } from "react";
import { AuthPageSkeleton } from "@/components/auth/AuthPageSkeleton";
import type { Metadata } from "next";
import ClerkSignUpWidget from "@/components/auth/ClerkSignUpWidget";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create an Account",
  description:
    "Join Build Market to find verified professionals, save design ideas, and manage construction projects in Kenya.",
};

export default function ClientSignUpPage() {
  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* --- Left Panel: Aspirational Imagery (Desktop) --- */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-zinc-900 items-center justify-center overflow-hidden">
        {/* Background Image - Warm Interior */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/hero-homeowner.jpg"
            alt="Modern Living Room"
            fill
            className="object-cover opacity-40"
            priority
            sizes="50vw"
            quality={60}
          />
          <div className="absolute inset-0 bg-linear-to-t from-zinc-900 via-zinc-900/60 to-transparent" />
        </div>

        {/* Logo - positioned relative to the entire panel */}
        <Link
          href="/"
          className="absolute top-8 left-8 z-20 text-xl font-bold tracking-tight text-white"
        >
          Build<span className="text-emerald-500">Market</span>
        </Link>

        {/* Content Layer */}
        <div className="relative z-10 px-16 max-w-2xl text-white">
          <div className="space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.1]">
              Build your dream <br />
              <span className="text-emerald-500">with confidence.</span>
            </h1>
            <p className="text-lg text-zinc-300 font-light leading-relaxed max-w-lg">
              Join Kenya&apos;s most trusted community for home improvement.
              Find verified artisans, browse local ideas, and manage your
              project safely.
            </p>
          </div>

          <div className="mt-12 space-y-5">
            <FeatureItem icon={Search} text="Find Verified Pros & Artisans" />
            <FeatureItem icon={BookOpen} text="Save Ideas to Your Ideabook" />
            <FeatureItem
              icon={ShieldCheck}
              text="Get Project Guidance & Support"
            />
          </div>
        </div>
      </div>

      {/* --- Right Panel: Sign Up Form --- */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 bg-zinc-50 lg:bg-white">
        <div className="w-full max-w-110 space-y-8">
          {/* Mobile Header */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-6">
              <span className="text-2xl font-bold text-zinc-900">
                Build<span className="text-emerald-600">Market</span>
              </span>
            </Link>
            <h2 className="text-xl font-semibold text-zinc-900">
              Create your account
            </h2>
          </div>

          {/* Clerk Component Wrapper */}
          <div className="bg-white p-1 rounded-2xl shadow-xl shadow-zinc-200/50 border border-zinc-100 min-h-125 flex items-center justify-center">
            <Suspense fallback={<AuthPageSkeleton variant="sign-up" />}>
              <ClerkSignUpWidget />
            </Suspense>
          </div>

          {/* Layer 1: Clickwrap Agreement */}
          <p className="text-center text-xs text-zinc-400 leading-relaxed">
            By creating an account, you agree to Build Market&apos;s{" "}
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

          {/* Footer Action */}
          <div className="text-center space-y-4">
            <p className="text-sm text-zinc-500">
              Are you a Pro?{" "}
              <Link
                href={ROUTES.joinAsPro}
                className="text-emerald-600 font-semibold hover:underline"
              >
                Join here
              </Link>
            </p>
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

function FeatureItem({
  icon: Icon,
  text,
}: {
  icon: React.ElementType;
  text: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 shrink-0">
        <Icon className="h-5 w-5 text-emerald-500" />
      </div>
      <span className="text-zinc-200 font-medium">{text}</span>
    </div>
  );
}
