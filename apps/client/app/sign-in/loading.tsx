import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { AuthPageSkeleton } from "@/components/auth/AuthPageSkeleton";

export default function SignInLoading() {
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

      {/* Right Panel (Form Skeleton) */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 bg-zinc-50 lg:bg-white">
        <div className="w-full max-w-110 space-y-8">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-6">
              <span className="text-2xl font-bold text-zinc-900">
                Build<span className="text-emerald-600">Market</span>
              </span>
            </div>
          </div>

          <div className="bg-white p-1 rounded-2xl shadow-xl shadow-zinc-200/50 border border-zinc-100">
            <AuthPageSkeleton variant="sign-in" />
          </div>

          {/* Layer 1: Clickwrap Agreement */}
          <p className="text-center text-xs text-zinc-400 leading-relaxed">
            By signing in, you agree to Build Market&apos;s{" "}
            <span className="text-emerald-600 hover:underline cursor-pointer">
              Terms of Service
            </span>{" "}
            and{" "}
            <span className="text-emerald-600 hover:underline cursor-pointer">
              Privacy Policy
            </span>
            .
          </p>

          <div className="text-center">
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
