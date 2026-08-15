"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  BarChart3,
  ShieldCheck,
  Users,
  Briefcase,
  TrendingUp,
} from "lucide-react";

import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ROUTES } from "@/lib/links";
import { MockDashboard } from "@/components/professional/MockDashboardUi";
import { JoinAsProIntentLink } from "./_components/JoinAsProIntentLink";

export default function ProfessionalLandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <main>
        <HeroSection />
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

// --- 1. Cinematic Hero Section ---
function HeroSection() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <section
      ref={ref}
      className="relative h-[90vh] flex items-center justify-center overflow-hidden bg-zinc-900"
    >
      {/* Parallax Background */}
      <motion.div style={{ y, opacity }} className="absolute inset-0 z-0">
        <Image
          src="/engineers.png"
          alt="Engineers discussing a project"
          fill
          sizes="100vw"
          className="object-cover opacity-40"
          priority
        />
        <div className="absolute inset-0 bg-linear-to-t from-zinc-900 via-zinc-900/50 to-transparent" />
      </motion.div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 text-center max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <Badge
            variant="outline"
            className="mb-6 border-white/20 text-emerald-400 px-4 py-1 text-xs uppercase tracking-widest bg-white/5 backdrop-blur-sm"
          >
            For Architects, Engineers & Contractors
          </Badge>

          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-[1.1] mb-8">
            Build your legacy on <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-emerald-400 to-teal-200">
              solid ground.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-zinc-300 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            Stop chasing low-quality leads. Join Kenya&apos;s premier
            marketplace connecting verified professionals with homeowners ready
            to build.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="h-14 px-8 text-lg bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg shadow-emerald-900/20 w-full sm:w-auto"
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
              className="h-14 px-8 text-lg border-white/20 text-white hover:bg-white/10 hover:text-white rounded-full bg-transparent w-full sm:w-auto"
              asChild
            >
              <Link href="#how-it-works">How it Works</Link>
            </Button>
          </div>

          <p className="mt-6 text-sm text-zinc-500">
            No credit card required for trial • NCA Verification Recommended
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// --- 2. Social Proof / Logo Cloud ---
function LogoCloud() {
  return (
    <div className="border-b border-zinc-100 bg-white py-12">
      <div className="container mx-auto px-4 text-center">
        <p className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-8">
          Trusted by top firms across East Africa
        </p>
        <div className="flex flex-wrap justify-center gap-12 md:gap-20 opacity-60 grayscale transition-all duration-500 hover:grayscale-0 hover:opacity-100">
          {/* Replace with actual partner logos or generic architecture firm names */}
          {["NCA", "BORAQS", "EPRA", "IEK"].map((logo) => (
            <div
              key={logo}
              className="flex items-center gap-2 text-xl font-bold text-zinc-800"
            >
              <ShieldCheck className="h-6 w-6 text-emerald-600" />
              {logo}
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
      title: "High-Intent Leads",
      description:
        "We filter out the window shoppers. Get connected with homeowners who have approved budgets and land ready for development.",
    },
    {
      icon: ShieldCheck,
      title: "Built on Trust",
      description:
        "Stand out from the 'quack' artisans. Our verification badge signals competence and safety to wary clients.",
    },
    {
      icon: BarChart3,
      title: "Professional Tools",
      description:
        "Send quotes, manage project milestones, and receive payments directly through our secure platform.",
    },
  ];

  return (
    <section className="py-24 bg-zinc-50">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-4 tracking-tight">
            More than just a directory. <br />
            <span className="text-emerald-600">A growth engine.</span>
          </h2>
          <p className="text-zinc-500 text-lg">
            The construction industry in Kenya is fragmented. We bring the
            pieces together to help your business scale efficiently.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
            >
              <Card className="border-zinc-200 shadow-sm hover:shadow-xl transition-shadow duration-300 h-full">
                <CardContent className="p-8">
                  <div className="h-12 w-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-6">
                    <f.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900 mb-3">
                    {f.title}
                  </h3>
                  <p className="text-zinc-600 leading-relaxed">
                    {f.description}
                  </p>
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
    <section className="py-24 overflow-hidden">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Feature 1 */}
        <div className="flex flex-col lg:flex-row items-center gap-16 mb-24">
          <div className="lg:w-1/2">
            <div className="relative">
              <div className="absolute -inset-4 bg-emerald-100 rounded-2xl transform -rotate-2" />
              <div className="relative bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border border-zinc-800 aspect-4/3">
                <MockDashboard />
              </div>
            </div>
          </div>
          <div className="lg:w-1/2 space-y-6">
            <h3 className="text-3xl font-bold text-zinc-900">
              Your Digital Command Center
            </h3>
            <p className="text-lg text-zinc-600 leading-relaxed">
              Managing a construction business is hard. Paper receipts, lost
              WhatsApp messages, and delayed payments slow you down.
            </p>
            <ul className="space-y-4">
              {[
                "Centralized project messaging",
                "Automated invoicing & payment tracking",
                "Digital portfolio hosting",
              ].map((item, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 text-zinc-700 font-medium"
                >
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  {item}
                </li>
              ))}
            </ul>
            <Button
              variant="link"
              className="text-emerald-600 p-0 h-auto font-semibold text-lg hover:text-emerald-700"
            >
              <Link href={ROUTES.professionalDashboard}>
                Explore the Dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Feature 2 (Reversed) */}
        <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
          <div className="lg:w-1/2">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl aspect-square bg-zinc-100">
              <Image
                src="/villa.jpg" // Placeholder
                alt="Portfolio Showcase"
                fill
                className="object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-8">
                <div className="flex items-center gap-3 text-white mb-2">
                  <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <span className="font-semibold">Featured Project</span>
                </div>
                <p className="text-white/90 text-sm">
                  Karen Villa Renovation • Budget: KSh 12M
                </p>
              </div>
            </div>
          </div>
          <div className="lg:w-1/2 space-y-6">
            <h3 className="text-3xl font-bold text-zinc-900">
              Showcase your expertise
            </h3>
            <p className="text-lg text-zinc-600 leading-relaxed">
              Don&apos;t let your best work get lost in a phone gallery. Create
              stunning Idea Books and Project Portfolios that inspire clients to
              hire you.
            </p>
            <div className="grid grid-cols-2 gap-6 mt-4">
              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                <TrendingUp className="h-6 w-6 text-emerald-600 mb-2" />
                <div className="font-bold text-2xl text-zinc-900">3x</div>
                <div className="text-sm text-zinc-500">
                  More inquiries for completed profiles
                </div>
              </div>
              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                <Users className="h-6 w-6 text-emerald-600 mb-2" />
                <div className="font-bold text-2xl text-zinc-900">24/7</div>
                <div className="text-sm text-zinc-500">
                  Visibility to clients
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
  return (
    <section className="py-24 bg-zinc-900 text-white">
      <div className="container mx-auto px-4 max-w-5xl text-center">
        <h2 className="text-3xl font-bold mb-16">
          Built for Kenyan Professionals
        </h2>

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="bg-zinc-800 border-zinc-700 text-left">
            <CardContent className="p-8">
              <div className="flex gap-1 text-emerald-400 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i}>★</span>
                ))}
              </div>
              <p className="text-lg text-zinc-300 mb-6 italic leading-relaxed">
                &quot;Since joining Build Market, I&apos;ve stopped relying on
                word-of-mouth alone. The leads are serious, and the messaging
                tool keeps everything organized.&quot;
              </p>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-zinc-700 flex items-center justify-center font-bold text-emerald-500">
                  DK
                </div>
                <div>
                  <div className="font-bold text-white">David Kamau</div>
                  <div className="text-sm text-zinc-400">
                    Lead Architect, Nairobi
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-800 border-zinc-700 text-left">
            <CardContent className="p-8">
              <div className="flex gap-1 text-emerald-400 mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i}>★</span>
                ))}
              </div>
              <p className="text-lg text-zinc-300 mb-6 italic leading-relaxed">
                &quot;The ability to showcase my previous projects in high
                quality has changed how clients perceive my business. I can
                finally charge what I&apos;m worth.&quot;
              </p>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-zinc-700 flex items-center justify-center font-bold text-emerald-500">
                  SW
                </div>
                <div>
                  <div className="font-bold text-white">Sarah Wanjiku</div>
                  <div className="text-sm text-zinc-400">
                    Interior Designer, Mombasa
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

// --- 6. CTA Section ---
function CTASection() {
  return (
    <section className="py-24 bg-emerald-600 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
      <div className="container mx-auto px-4 text-center relative z-10">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
          Ready to scale your business?
        </h2>
        <p className="text-emerald-100 text-xl max-w-2xl mx-auto mb-10">
          Join thousands of professionals building the future of Kenya&apos;s
          construction industry.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Button
            size="lg"
            className="bg-white text-emerald-700 hover:bg-emerald-50 h-16 px-10 text-lg rounded-full font-bold shadow-2xl"
            asChild
          >
            <JoinAsProIntentLink>Get Started for Free</JoinAsProIntentLink>
          </Button>
        </div>
        <p className="mt-6 text-sm text-emerald-200/80">
          Basic plan is free forever. Premium features available.
        </p>
      </div>
    </section>
  );
}
