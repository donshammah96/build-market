import Image from "next/image";
import { ArrowLeft, Search, BookOpen, ShieldCheck } from "lucide-react";
import { AuthPageSkeleton } from "@/components/auth/AuthPageSkeleton";

export default function SignUpLoading() {
  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* Left Panel: Aspirational Imagery (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-zinc-900 items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="/hero-homeowner.jpg"
            alt="Modern Living Room"
            fill
            className="object-cover opacity-40"
            priority
            sizes="50vw"
          />
          <div className="absolute inset-0 bg-linear-to-t from-zinc-900 via-zinc-900/60 to-transparent" />
        </div>

        <div className="absolute top-8 left-8 z-20 text-xl font-bold tracking-tight text-white">
          Build<span className="text-emerald-500">Market</span>
        </div>

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
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 shrink-0">
                <Search className="h-5 w-5 text-emerald-500" />
              </div>
              <span className="text-zinc-200 font-medium">
                Find Verified Pros & Artisans
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 shrink-0">
                <BookOpen className="h-5 w-5 text-emerald-500" />
              </div>
              <span className="text-zinc-200 font-medium">
                Save Ideas to Your Ideabook
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 shrink-0">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
              </div>
              <span className="text-zinc-200 font-medium">
                Get Project Guidance & Support
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel: Sign Up Form Skeleton */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 bg-zinc-50 lg:bg-white">
        <div className="w-full max-w-110 space-y-8">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-6">
              <span className="text-2xl font-bold text-zinc-900">
                Build<span className="text-emerald-600">Market</span>
              </span>
            </div>
            <h2 className="text-xl font-semibold text-zinc-900">
              Create your account
            </h2>
          </div>

          <div className="bg-white p-1 rounded-2xl shadow-xl shadow-zinc-200/50 border border-zinc-100">
            <AuthPageSkeleton variant="sign-up" />
          </div>

          <p className="text-center text-xs text-zinc-400 leading-relaxed">
            By creating an account, you agree to Build Market&apos;s{" "}
            <span className="text-emerald-600 hover:underline cursor-pointer">
              Terms of Service
            </span>{" "}
            and{" "}
            <span className="text-emerald-600 hover:underline cursor-pointer">
              Privacy Policy
            </span>
            .
          </p>

          <div className="text-center space-y-4">
            <p className="text-sm text-zinc-500">
              Are you a Pro?{" "}
              <span className="text-emerald-600 font-semibold hover:underline cursor-pointer">
                Join here
              </span>
            </p>
            <div className="inline-flex items-center text-sm text-zinc-400">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to Home
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
