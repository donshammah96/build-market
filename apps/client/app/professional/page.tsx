"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  BarChart3,
  ShieldCheck,
  Users,
  Briefcase,
  TrendingUp,
  Award,
  Sparkles,
  Lock,
  ArrowUpRight,
  Star,
} from "lucide-react";

import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MockDashboard } from "@/components/professional/MockDashboardUi";
import { JoinAsProIntentLink } from "./_components/JoinAsProIntentLink";

export default function ProfessionalLandingPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-emerald-100 selection:text-emerald-900 antialiased">
      <ProfessionalNav />
      <main>
        <HeroSection />
        <TrustMetricsBanner />
        <LogoCloud />
        <ValueProposition />
        <FeatureShowcase />
        <Testimonials />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
}

// --- Top Navigation Header with Link to Homepage ---
function ProfessionalNav() {
  return (
    <header className="absolute top-0 left-0 right-0 z-30 border-b border-white/10 bg-zinc-950/60 backdrop-blur-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
        {/* Left: Brand & Home Link */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 group text-white hover:text-emerald-400 transition-colors"
          >
            <div className="bg-emerald-600 p-1.5 rounded-lg group-hover:bg-emerald-500 transition-colors shadow-xs">
              <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <span className="font-display font-bold text-lg sm:text-xl tracking-tight">
              Build<span className="text-emerald-400">Market</span>
              <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 ml-1.5 align-middle">
                PRO
              </span>
            </span>
          </Link>

          <Link
            href="/"
            className="hidden md:inline-flex items-center gap-1.5 text-xs sm:text-sm text-zinc-400 hover:text-zinc-100 transition-colors font-medium border-l border-zinc-800 pl-6"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Marketplace
          </Link>
        </div>

        {/* Right: Quick actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/"
            className="md:hidden inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-100 transition-colors font-medium"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Home
          </Link>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold rounded-full h-9 sm:h-10 px-4 sm:px-5 text-xs sm:text-sm shadow-md shadow-emerald-950/50 transition-all"
            asChild
          >
            <JoinAsProIntentLink>Join as a Pro</JoinAsProIntentLink>
          </Button>
        </div>
      </div>
    </header>
  );
}

// --- 1. Cinematic Hero Section ---
function HeroSection() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section
      ref={ref}
      className="relative min-h-[85vh] lg:min-h-[90vh] flex items-center justify-center overflow-hidden bg-zinc-950 text-white pt-28 sm:pt-32 pb-16"
    >
      {/* Parallax Background with Mesh Glow */}
      <motion.div
        style={{ y, opacity }}
        className="absolute inset-0 z-0 pointer-events-none"
      >
        <Image
          src="/engineers.png"
          alt="Engineers discussing a project"
          fill
          sizes="100vw"
          className="object-cover opacity-25 scale-105"
          priority
        />
        <div className="absolute inset-0 bg-radial-[circle_at_top,var(--tw-gradient-stops)] from-emerald-950/40 via-zinc-950/80 to-zinc-950" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)] bg-size-[32px_32px]" />
      </motion.div>

      {/* Hero Content */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="space-y-6 sm:space-y-8"
        >
          {/* Status / Category Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 backdrop-blur-md text-emerald-400 text-xs sm:text-sm font-medium tracking-wide">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              Kenya&apos;s Verified Network for Architects, Engineers &
              Contractors
            </span>
          </div>

          {/* Display Headline */}
          <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.08] text-white">
            Build your legacy on <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-emerald-400 via-teal-300 to-emerald-200">
              solid ground.
            </span>
          </h1>

          {/* Subtext */}
          <p className="text-base sm:text-lg md:text-xl text-zinc-300 max-w-2xl mx-auto leading-relaxed font-normal">
            Stop wasting time on unverified leads. Connect with vetted
            homeowners and commercial clients with approved budgets, ready to
            build across Kenya.
          </p>

          {/* Call to Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Button
              size="lg"
              className="h-13 sm:h-14 px-8 text-base sm:text-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold rounded-full shadow-xl shadow-emerald-950/50 w-full sm:w-auto transition-all"
              asChild
            >
              <JoinAsProIntentLink>
                Join as a Pro
                <ArrowRight className="ml-2 h-5 w-5" />
              </JoinAsProIntentLink>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-13 sm:h-14 px-8 text-base sm:text-lg border-zinc-700 hover:border-zinc-500 text-zinc-200 hover:bg-zinc-900/80 hover:text-white rounded-full bg-zinc-900/40 backdrop-blur-sm w-full sm:w-auto transition-all"
              asChild
            >
              <Link href="#how-it-works">How it Works</Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-zinc-400 pt-2">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Free basic membership
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              NCA & BORAQS verification support
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-emerald-400" />
              Escrow milestone protection
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// --- 1.5. Trust Metrics Bar ---
function TrustMetricsBanner() {
  const metrics = [
    { label: "Verified Professionals", value: "850+", icon: Award },
    { label: "Projects Facilitated", value: "KES 420M+", icon: TrendingUp },
    { label: "Client Match Rate", value: "94%", icon: Users },
    { label: "Average Project Rating", value: "4.9 / 5.0", icon: Star },
  ];

  return (
    <div className="bg-zinc-900 border-y border-zinc-800 text-white py-6">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {metrics.map((m, i) => (
            <div key={i} className="flex flex-col items-center justify-center">
              <div className="font-display font-bold text-2xl sm:text-3xl text-emerald-400 mb-1">
                {m.value}
              </div>
              <div className="text-xs sm:text-sm text-zinc-400 font-medium">
                {m.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- 2. Social Proof / Logo Cloud ---
function LogoCloud() {
  return (
    <div className="border-b border-zinc-100 bg-white py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-xs sm:text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-8">
          Recognized by Professionals Registered With
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 md:gap-20">
          {[
            { name: "NCA", title: "National Construction Authority" },
            { name: "BORAQS", title: "Board of Reg. Architects & Q.S." },
            { name: "IEK", title: "Institution of Engineers of Kenya" },
            { name: "EPRA", title: "Energy & Petroleum Regulatory Authority" },
            { name: "AAK", title: "Architectural Association of Kenya" },
          ].map((org) => (
            <div
              key={org.name}
              className="flex items-center gap-2 group cursor-default transition-all duration-300"
            >
              <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="font-display font-bold text-sm sm:text-base text-zinc-800 tracking-tight">
                  {org.name}
                </div>
                <div className="text-[10px] text-zinc-400 hidden sm:block">
                  {org.title}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- 3. Value Proposition ---
function ValueProposition() {
  const features = [
    {
      icon: Users,
      title: "Pre-Qualified Leads",
      description:
        "No more tire-kickers. We verify client land ownership status, architectural requirements, and budget readiness before routing opportunities.",
    },
    {
      icon: ShieldCheck,
      title: "Verified Trust Signals",
      description:
        "Differentiate your practice with an official Build Market badge that showcases your NCA category, past portfolio, and verified client testimonials.",
    },
    {
      icon: BarChart3,
      title: "Built-In Project Tools",
      description:
        "Manage stage-by-stage proposals, milestone contracts, progress photo documentation, and escrow payments inside one centralized platform.",
    },
  ];

  return (
    <section id="how-it-works" className="py-20 sm:py-28 bg-zinc-50/80">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <Badge
            variant="outline"
            className="mb-4 border-emerald-300 text-emerald-700 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider"
          >
            Why Top Firms Join
          </Badge>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-zinc-900 mb-5 tracking-tight">
            More than just a directory. <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-emerald-600 to-teal-600">
              A scalable growth engine.
            </span>
          </h2>
          <p className="text-zinc-600 text-base sm:text-lg leading-relaxed">
            The East African construction sector is modernizing. Build Market
            delivers the technological infrastructure for forward-thinking
            professionals to win premium contracts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
            >
              <Card className="border-zinc-200/80 bg-white shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full rounded-2xl">
                <CardContent className="p-6 sm:p-8 flex flex-col justify-between h-full">
                  <div>
                    <div className="h-12 w-12 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mb-6 shadow-xs">
                      <f.icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-display text-xl font-bold text-zinc-900 mb-3 tracking-tight">
                      {f.title}
                    </h3>
                    <p className="text-zinc-600 text-sm sm:text-base leading-relaxed">
                      {f.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- 4. Feature Showcase (Split Layout) ---
function FeatureShowcase() {
  return (
    <section className="py-20 sm:py-28 overflow-hidden bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        {/* Feature 1: Digital Command Center */}
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16 mb-24 sm:mb-32">
          <div className="w-full lg:w-1/2">
            <div className="relative">
              <div className="absolute -inset-3 bg-linear-to-tr from-emerald-200 to-teal-100 rounded-3xl transform -rotate-1 blur-xs opacity-70" />
              <div className="relative bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 min-h-95 sm:min-h-105">
                <MockDashboard />
              </div>
            </div>
          </div>
          <div className="w-full lg:w-1/2 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Sparkles className="h-3.5 w-3.5" />
              Professional Workspace
            </div>
            <h3 className="font-display text-3xl sm:text-4xl font-bold text-zinc-900 tracking-tight leading-tight">
              Your Complete Digital <br className="hidden sm:inline" />
              Command Center
            </h3>
            <p className="text-base sm:text-lg text-zinc-600 leading-relaxed">
              Managing a construction practice shouldn&apos;t mean losing
              receipts, tracking WhatsApp threads, or chasing milestone payments
              across multiple channels.
            </p>
            <ul className="space-y-3.5">
              {[
                "Centralized project inquiry & messaging inbox",
                "Automated proposal generation & milestone escrow tracking",
                "Verified portfolio showcases indexed by search engines",
              ].map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-zinc-700 text-sm sm:text-base font-medium"
                >
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="pt-2">
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl h-12 px-6 shadow-md shadow-emerald-900/10"
                asChild
              >
                <JoinAsProIntentLink>
                  Get Started to Access Tools
                  <ArrowRight className="ml-2 h-4 w-4" />
                </JoinAsProIntentLink>
              </Button>
            </div>
          </div>
        </div>

        {/* Feature 2: Showcase your expertise (Reversed) */}
        <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-16">
          <div className="w-full lg:w-1/2">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl aspect-4/3 sm:aspect-16/10 bg-zinc-900 border border-zinc-100">
              <Image
                src="/villa.jpg"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 50vw"
                alt="Architectural Portfolio Project"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-t from-zinc-950/90 via-zinc-950/30 to-transparent p-6 sm:p-8 flex flex-col justify-end">
                <div className="flex items-center gap-3 text-white mb-2">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="font-display font-bold text-sm sm:text-base text-white">
                      Featured Project Portfolio
                    </span>
                    <p className="text-emerald-300 text-xs font-medium">
                      Verified Client Rating: 5.0 ★
                    </p>
                  </div>
                </div>
                <p className="text-zinc-300 text-xs sm:text-sm">
                  Karen Contemporary Villa • KES 28.5M • Full Architecture &
                  Interior
                </p>
              </div>
            </div>
          </div>
          <div className="w-full lg:w-1/2 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Award className="h-3.5 w-3.5" />
              Reputation & Portfolios
            </div>
            <h3 className="font-display text-3xl sm:text-4xl font-bold text-zinc-900 tracking-tight leading-tight">
              Showcase Your Expertise & <br className="hidden sm:inline" />
              Win High-Value Bids
            </h3>
            <p className="text-base sm:text-lg text-zinc-600 leading-relaxed">
              Never let high-calibre work stay hidden in phone storage. Publish
              high-resolution project portfolios, share client reviews, and
              establish undeniable authority in your discipline.
            </p>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 pt-2">
              <div className="p-4 sm:p-5 bg-zinc-50 rounded-2xl border border-zinc-200/70">
                <TrendingUp className="h-6 w-6 text-emerald-600 mb-2" />
                <div className="font-display font-bold text-2xl sm:text-3xl text-zinc-900">
                  3.4x
                </div>
                <div className="text-xs sm:text-sm text-zinc-500 font-medium">
                  More inquiries on verified profile pages
                </div>
              </div>
              <div className="p-4 sm:p-5 bg-zinc-50 rounded-2xl border border-zinc-200/70">
                <Users className="h-6 w-6 text-emerald-600 mb-2" />
                <div className="font-display font-bold text-2xl sm:text-3xl text-zinc-900">
                  100%
                </div>
                <div className="text-xs sm:text-sm text-zinc-500 font-medium">
                  Direct client ownership without middlemen
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// --- 5. Testimonials ---
function Testimonials() {
  const reviews = [
    {
      initials: "DK",
      name: "Arch. David Kamau",
      role: "Principal Architect, Nairobi",
      quote:
        "Since joining Build Market, we have completely stopped relying on unpredictable referrals. The clients connecting with us already have land titles, verified budgets, and realistic timelines.",
      rating: 5,
    },
    {
      initials: "SW",
      name: "Sarah Wanjiku",
      role: "Lead Interior Designer, Mombasa",
      quote:
        "Having our portfolio and verified credentials in one place elevated our brand perception instantly. We were able to quote with full confidence and secure larger commercial assignments.",
      rating: 5,
    },
  ];

  return (
    <section className="py-20 sm:py-28 bg-zinc-950 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-emerald-950/20 via-zinc-950 to-zinc-950" />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl relative z-10 text-center">
        <Badge
          variant="outline"
          className="mb-4 border-emerald-500/30 text-emerald-400 bg-emerald-950/40 px-3 py-1 text-xs font-semibold uppercase tracking-wider"
        >
          Community Voices
        </Badge>
        <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-16">
          Built for Kenyan Professionals
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {reviews.map((r, i) => (
            <Card
              key={i}
              className="bg-zinc-900/80 border-zinc-800 text-left rounded-2xl shadow-xl backdrop-blur-xs"
            >
              <CardContent className="p-6 sm:p-8 flex flex-col justify-between h-full">
                <div>
                  <div className="flex gap-1 text-amber-400 mb-4">
                    {[...Array(r.rating)].map((_, idx) => (
                      <Star
                        key={idx}
                        className="h-4 w-4 fill-amber-400 text-amber-400"
                      />
                    ))}
                  </div>
                  <p className="text-base sm:text-lg text-zinc-300 mb-6 italic leading-relaxed">
                    &quot;{r.quote}&quot;
                  </p>
                </div>
                <div className="flex items-center gap-4 pt-4 border-t border-zinc-800/80">
                  <div className="h-11 w-11 rounded-full bg-linear-to-br from-emerald-600 to-teal-800 flex items-center justify-center font-bold text-white text-sm shadow-md">
                    {r.initials}
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm sm:text-base">
                      {r.name}
                    </div>
                    <div className="text-xs text-zinc-400">{r.role}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- 6. CTA Section ---
function CTASection() {
  return (
    <section className="py-20 sm:py-28 bg-linear-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-white/10 to-transparent pointer-events-none" />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 max-w-4xl">
        <h2 className="font-display text-3xl sm:text-5xl md:text-6xl font-extrabold mb-6 tracking-tight leading-tight">
          Ready to elevate your <br className="hidden sm:inline" />
          construction practice?
        </h2>
        <p className="text-emerald-100 text-base sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed font-light">
          Join hundreds of accredited professionals building the future of
          Kenya&apos;s built environment.
        </p>
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <Button
            size="lg"
            className="bg-white text-emerald-800 hover:bg-emerald-50 active:scale-[0.98] h-14 sm:h-16 px-10 text-base sm:text-lg rounded-full font-bold shadow-2xl w-full sm:w-auto transition-all"
            asChild
          >
            <JoinAsProIntentLink>
              Get Started for Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </JoinAsProIntentLink>
          </Button>
        </div>
        <p className="mt-6 text-xs sm:text-sm text-emerald-200/90 font-medium">
          Free membership tier available • No setup fees • Verified profiles
          first
        </p>
      </div>
    </section>
  );
}
