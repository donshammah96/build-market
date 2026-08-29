import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "@/lib/routes";
import {
  ArrowLeft,
  BookOpen,
  ShieldCheck,
  Lock,
  Star,
  Sparkles,
} from "lucide-react";
import { Suspense } from "react";
import { AuthPageSkeleton } from "@/components/auth/AuthPageSkeleton";
import type { Metadata } from "next";
import ClerkSignUpWidget from "@/components/auth/ClerkSignUpWidget";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create an Account | BuildMarket",
  description:
    "Join Kenya's most trusted platform for home construction and renovation. Connect with verified architects, engineers, and contractors.",
};

export default function ClientSignUpPage() {
  return (
    <div className="flex min-h-screen w-full bg-zinc-50 font-sans antialiased selection:bg-emerald-100 selection:text-emerald-900">
      {/* --- Left Panel: Aspirational Brand & Social Proof (Desktop Only) --- */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-zinc-950 items-center justify-center overflow-hidden">
        {/* Background Imagery with Warm Dark Gradient */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <Image
            src="/hero-homeowner.jpg"
            alt="Modern Kenyan Home Architecture"
            fill
            className="object-cover opacity-25 scale-105"
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            quality={75}
          />
          <div className="absolute inset-0 bg-radial-[circle_at_center,var(--tw-gradient-stops)] from-emerald-950/30 via-zinc-950/85 to-zinc-950" />
          {/* Technical Grid Pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)] bg-size-[28px_28px]" />
        </div>

        {/* Top Header / Logo */}
        <Link
          href="/"
          className="absolute top-8 left-8 sm:top-10 sm:left-10 z-20 flex items-center gap-2.5 group"
        >
          <span className="font-display text-2xl font-bold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
            Build<span className="text-emerald-500">Market</span>
          </span>
        </Link>

        {/* Content Container */}
        <div className="relative z-10 px-12 xl:px-16 max-w-xl text-white py-16">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="h-3.5 w-3.5" />
              Trusted by 15,000+ Kenyan Homeowners
            </div>

            <h1 className="font-display text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.1]">
              Build your dream <br />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-emerald-400 to-teal-200">
                with absolute confidence.
              </span>
            </h1>

            <p className="text-base text-zinc-300 font-light leading-relaxed">
              Connect with verified architects, structural engineers, and
              contractors. Protect your milestone funds with bank-grade escrow,
              and track every stage of your build.
            </p>
          </div>

          {/* Value Pillars */}
          <div className="mt-8 space-y-3.5">
            <FeatureCard
              icon={ShieldCheck}
              title="Vetted & Licensed Professionals"
              desc="Work exclusively with NCA, BORAQS, and IEK credential-verified practitioners."
            />
            <FeatureCard
              icon={Lock}
              title="Protected Milestone Escrow"
              desc="Your deposits remain protected and are only released when you approve completed milestones."
            />
            <FeatureCard
              icon={BookOpen}
              title="Curated Idea Books & Estimates"
              desc="Explore hundreds of architectural plans, interior designs, and construction budget guides."
            />
          </div>

          {/* Homeowner Testimonial */}
          <div className="mt-8 pt-5 bg-zinc-900/50 p-5 rounded-2xl border border-zinc-800/80 backdrop-blur-xs">
            <div className="flex gap-1 text-amber-400 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                />
              ))}
            </div>
            <p className="text-xs sm:text-sm text-zinc-300 italic leading-relaxed">
              &quot;BuildMarket made finding a licensed structural engineer for
              our Karen bungalow build transparent and stress-free. The
              milestone payments gave us complete peace of mind.&quot;
            </p>
            <div className="flex items-center gap-3 mt-3.5">
              <div className="h-8 w-8 rounded-full bg-linear-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white font-bold text-xs shadow-xs">
                AI
              </div>
              <div>
                <p className="text-xs font-bold text-white">Amanda Ireri</p>
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider">
                  Homeowner, Karen Nairobi
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- Right Panel: Sign Up Form --- */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 lg:p-12 bg-zinc-50 lg:bg-zinc-100/50">
        <div className="w-full max-w-md space-y-6 sm:space-y-8">
          {/* Top Return Link (Desktop) */}
          <div className="hidden lg:flex justify-between items-center">
            <Link
              href="/"
              className="inline-flex items-center text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors group"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5 group-hover:-translate-x-1 transition-transform" />
              Back to Marketplace
            </Link>

            <Link
              href={ROUTES.professional}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
            >
              Are you a Pro? Join here &rarr;
            </Link>
          </div>

          {/* Mobile Header */}
          <div className="lg:hidden text-center">
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <span className="font-display text-2xl font-bold text-zinc-900">
                Build<span className="text-emerald-600">Market</span>
              </span>
            </Link>
            <h2 className="text-xl font-bold text-zinc-900">
              Create your account
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Join thousands of Kenyan homeowners building with confidence
            </p>
          </div>

          {/* Clerk Component Wrapper */}
          <div className="bg-white p-1 sm:p-2 rounded-2xl shadow-xl shadow-zinc-200/60 border border-zinc-200/80 min-h-120 flex items-center justify-center">
            <Suspense fallback={<AuthPageSkeleton variant="sign-up" />}>
              <ClerkSignUpWidget />
            </Suspense>
          </div>

          {/* Layer 1: Clickwrap Agreement */}
          <p className="text-center text-[11px] text-zinc-400 leading-relaxed max-w-xs mx-auto">
            By creating an account, you agree to BuildMarket&apos;s{" "}
            <Link
              href="/legal/terms"
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

          {/* Pro Switcher Callout (Mobile / Bottom) */}
          <div className="text-center pt-2 border-t border-zinc-200/80">
            <div className="p-3.5 rounded-xl bg-white border border-zinc-200/80 shadow-2xs flex items-center justify-between">
              <div className="text-left">
                <p className="text-xs font-semibold text-zinc-900">
                  Building Professional?
                </p>
                <p className="text-[11px] text-zinc-500">
                  Join our verified practitioner network
                </p>
              </div>
              <Link
                href={ROUTES.professional}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors"
              >
                Join as Pro &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-3.5 p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/60 backdrop-blur-2xs hover:bg-zinc-900/60 transition-colors">
      <div className="h-9 w-9 rounded-lg bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 mt-0.5">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs sm:text-sm font-semibold text-zinc-100">
          {title}
        </p>
        <p className="text-[11px] sm:text-xs text-zinc-400 leading-snug mt-0.5">
          {desc}
        </p>
      </div>
    </div>
  );
}
