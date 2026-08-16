"use client";

import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";
import {
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Award,
  Sparkles,
  Lock,
  Star,
} from "lucide-react";
import { AuthPageSkeleton } from "@/components/auth/AuthPageSkeleton";

export default function ProfessionalSignUpPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex min-h-screen w-full bg-zinc-50 font-sans antialiased selection:bg-emerald-100 selection:text-emerald-900">
      {/* --- Left Panel: Brand & Value Prop (Desktop Only) --- */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-zinc-950 items-center justify-center overflow-hidden">
        {/* Background Image with Architectural Overlay */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <Image
            src="/engineers.png"
            alt="Engineers and architects collaborating"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover opacity-20 scale-105"
            priority
          />
          <div className="absolute inset-0 bg-radial-[circle_at_center,var(--tw-gradient-stops)] from-emerald-950/30 via-zinc-950/80 to-zinc-950" />
          {/* Grid Pattern for Technical Engineering Feel */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)] bg-size-[28px_28px]" />
        </div>

        {/* Logo - Positioned top left */}
        <Link
          href="/professional"
          className="absolute top-8 left-8 sm:top-10 sm:left-10 z-20 flex items-center gap-2.5 group"
        >
          <div className="bg-emerald-600 p-2 rounded-xl group-hover:bg-emerald-500 shadow-md shadow-emerald-950/40 transition-colors">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-white">
            Build<span className="text-emerald-400">Market</span>{" "}
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 ml-1">
              PRO
            </span>
          </span>
        </Link>

        {/* Content Layer */}
        <div className="relative z-10 px-12 xl:px-16 max-w-xl text-white py-16">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="h-3.5 w-3.5" />
              Accredited Partner Portal
            </div>
            <h1 className="font-display text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.1]">
              Your next major <br />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-emerald-400 to-teal-200">
                project starts here.
              </span>
            </h1>
            <p className="text-base text-zinc-300 font-light leading-relaxed">
              Join Kenya&apos;s vetted network of Architects, Engineers,
              Quantity Surveyors, and General Contractors. Gain direct access to
              high-intent clients and verified milestone escrows.
            </p>
          </div>

          <div className="mt-10 space-y-3.5">
            <FeatureItem
              title="Verified Accreditation Badge"
              desc="Official NCA / BORAQS credentials displayed prominently to prospective clients."
            />
            <FeatureItem
              title="Protected Milestone Escrow"
              desc="Work with confidence knowing milestone funds are secured before site mobilization."
            />
            <FeatureItem
              title="SEO-Indexed Digital Portfolio"
              desc="Showcase completed villas, commercial fitouts, and infrastructure projects."
            />
          </div>

          {/* Mini Testimonial Quote */}
          <div className="mt-10 pt-6 border-t bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/60 backdrop-blur-xs">
            <div className="flex gap-1 text-amber-400 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                />
              ))}
            </div>
            <p className="text-xs sm:text-sm text-zinc-300 italic leading-relaxed">
              &quot;Build Market connected us with vetted property developers in
              Karen and Runda within weeks of verification.&quot;
            </p>
            <div className="flex items-center gap-3 mt-3.5">
              <div className="h-8 w-8 rounded-full bg-linear-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white font-bold text-xs shadow-xs">
                EN
              </div>
              <div>
                <p className="text-xs font-bold text-white">
                  Eng. Evans Ndegwa
                </p>
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider">
                  Lead Structural Engineer, Nairobi
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- Right Panel: Sign Up Form --- */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 lg:p-12 bg-zinc-50 lg:bg-zinc-100/50">
        <div className="w-full max-w-md space-y-6 sm:space-y-8">
          {/* Mobile Header */}
          <div className="lg:hidden text-center">
            <Link
              href="/professional"
              className="inline-flex items-center gap-2 mb-4"
            >
              <div className="bg-emerald-600 p-1.5 rounded-lg text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <span className="font-display text-2xl font-bold text-zinc-900">
                Build<span className="text-emerald-600">Market</span>{" "}
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 ml-1">
                  PRO
                </span>
              </span>
            </Link>
            <h2 className="text-lg sm:text-xl font-bold text-zinc-900">
              Professional Registration
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 mt-1">
              Create your account to start receiving client inquiries
            </p>
          </div>

          {/* Clerk Component Container */}
          <div className="bg-white p-1 sm:p-2 rounded-2xl shadow-xl shadow-zinc-200/60 border border-zinc-200/80 min-h-115 flex items-center justify-center">
            {!mounted ? (
              <AuthPageSkeleton variant="sign-up" />
            ) : (
              <SignUp
                routing="path"
                path="/professional/sign-up"
                signInUrl="/sign-in"
                fallbackRedirectUrl={ROUTES.professionalOnboarding}
                forceRedirectUrl={ROUTES.professionalOnboarding}
                appearance={
                  {
                    layout: {
                      socialButtonsPlacement: "bottom",
                      showOptionalFields: false,
                    },
                    elements: {
                      rootBox: "w-full",
                      card: "shadow-none p-5 sm:p-7 w-full border-0 bg-transparent",
                      headerTitle:
                        "text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight font-display",
                      headerSubtitle:
                        "text-zinc-500 font-normal text-xs sm:text-sm",
                      socialButtonsBlockButton:
                        "bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-700 font-medium rounded-xl h-11 transition-colors shadow-xs",
                      socialButtonsBlockButtonText:
                        "font-medium text-xs sm:text-sm",
                      dividerLine: "bg-zinc-200",
                      dividerText:
                        "text-zinc-400 bg-white px-3 text-[10px] uppercase tracking-widest font-semibold",
                      formButtonPrimary:
                        "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white shadow-lg shadow-emerald-900/15 rounded-xl h-11 font-semibold text-sm transition-all",
                      formFieldLabel:
                        "text-zinc-700 font-semibold text-xs sm:text-sm mb-1.5",
                      formFieldInput:
                        "h-11 border-zinc-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl bg-zinc-50/60 transition-all text-sm",
                      footerActionLink:
                        "text-emerald-600 hover:text-emerald-700 font-semibold hover:underline decoration-2 underline-offset-4",
                      identityPreviewText: "text-zinc-700 font-medium",
                      formFieldSuccessText: "text-emerald-600 text-xs",
                      formFieldErrorText: "text-red-600 text-xs font-medium",
                      alertText: "text-red-600 text-xs sm:text-sm font-medium",
                    },
                  } as any
                }
              />
            )}
          </div>

          {/* Footer Action */}
          <div className="flex items-center justify-between text-xs sm:text-sm px-2">
            <Link
              href="/professional"
              className="inline-flex items-center text-zinc-500 hover:text-zinc-900 font-medium transition-colors group"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              Back to Overview
            </Link>

            <Link
              href="/"
              className="text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              Main Marketplace
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-400/30 shrink-0 mt-0.5">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
      </div>
      <div>
        <div className="text-zinc-100 font-semibold text-xs sm:text-sm">
          {title}
        </div>
        <p className="text-zinc-400 text-xs leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
