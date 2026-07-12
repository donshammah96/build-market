"use client";

import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "@/lib/links";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";

export default function ProfessionalSignUpPage() {
  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* --- Left Panel: Brand & Value Prop (Desktop Only) --- */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-zinc-900 items-center justify-center overflow-hidden">
        {/* Background Image with Architectural Overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/engineers.png" // Ensure this asset exists
            alt="Engineers"
            fill
            className="object-cover opacity-30 grayscale"
            priority
          />
          <div className="absolute inset-0 bg-linear-to-t from-zinc-900 via-zinc-900/80 to-zinc-900/40" />
          {/* Grid Pattern for Technical Feel */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px]" />
        </div>

        {/* Logo - positioned relative to full panel */}
        <Link
          href="/professional"
          className="absolute top-12 left-12 z-20 flex items-center gap-2 group"
        >
          <div className="bg-emerald-600 p-1.5 rounded-lg group-hover:bg-emerald-500 transition-colors">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Build<span className="text-emerald-500">Market</span> Pro
          </span>
        </Link>

        {/* Content Layer */}
        <div className="relative z-10 px-16 max-w-2xl text-white">
          <div className="space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.1]">
              Your next big project <br />
              <span className="text-emerald-500">starts here.</span>
            </h1>
            <p className="text-lg text-zinc-400 font-light leading-relaxed max-w-lg">
              Join Kenya&apos;s vetted network of Architects, Engineers, and
              Contractors. Access high-intent leads and manage your reputation.
            </p>
          </div>

          <div className="mt-12 space-y-4">
            <FeatureItem text="Verified Professional Badge" />
            <FeatureItem text="Direct Client Messaging" />
            <FeatureItem text="Digital Portfolio & Reviews" />
          </div>

          <div className="mt-12 pt-8 border-t border-zinc-800">
            <p className="text-sm text-zinc-500">
              &quot;Build Market helped us secure 3 major building contracts in
              our first month.&quot;
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="h-8 w-8 rounded-full bg-emerald-900/50 border border-emerald-500/30 flex items-center justify-center text-emerald-500 font-bold text-xs">
                EN
              </div>
              <div>
                <p className="text-xs font-bold text-white">Evans Ndegwa</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
                  Lead Structural Engineer, Nairobi
                </p>
              </div>
            </div>
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
              Professional Registration
            </h2>
          </div>

          {/* Clerk Component Wrapper */}
          <div className="bg-white p-1 rounded-2xl shadow-xl shadow-zinc-200/50 border border-zinc-100">
            <SignUp
              routing="path"
              path="/professional/sign-up"
              fallbackRedirectUrl={ROUTES.professionalOnboarding}
              appearance={
                {
                  layout: {
                    socialButtonsPlacement: "bottom",
                    showOptionalFields: false,
                  },
                  elements: {
                    rootBox: "w-full",
                    card: "shadow-none p-6 sm:p-8 w-full border-0",
                    headerTitle:
                      "text-2xl font-bold text-zinc-900 tracking-tight",
                    headerSubtitle: "text-zinc-500 font-normal",
                    socialButtonsBlockButton:
                      "bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-600 font-medium rounded-lg h-11 transition-colors",
                    socialButtonsBlockButtonText: "font-medium",
                    dividerLine: "bg-zinc-100",
                    dividerText:
                      "text-zinc-400 bg-white px-3 text-xs uppercase tracking-widest font-medium",
                    formButtonPrimary:
                      "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/10 rounded-lg h-11 font-semibold transition-all hover:shadow-emerald-900/20",
                    formFieldLabel: "text-zinc-700 font-medium text-sm mb-1.5",
                    formFieldInput:
                      "h-11 border-zinc-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg bg-zinc-50/50 transition-all",
                    footerActionLink:
                      "text-emerald-600 hover:text-emerald-700 font-medium hover:underline decoration-2 underline-offset-4",
                    identityPreviewText: "text-zinc-600 font-medium",
                    formFieldSuccessText: "text-emerald-600 text-xs",
                    formFieldErrorText: "text-red-600 text-xs",
                    alertText: "text-red-600 text-sm",
                  },
                } as any
              }
            />
          </div>

          {/* Footer Action */}
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

function FeatureItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-5 w-5 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
      </div>
      <span className="text-zinc-300 font-medium text-sm">{text}</span>
    </div>
  );
}
