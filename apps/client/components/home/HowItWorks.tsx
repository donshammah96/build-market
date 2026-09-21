"use client";

import { memo, useState } from "react";
import Link from "next/link";
import {
  Search,
  FileCheck2,
  ShieldCheck,
  UserPlus,
  Handshake,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "../ui/button";
import { ROUTES } from "@/lib/routes";
import {
  useIntersectionObserver,
  useShouldAnimate,
} from "@/lib/hooks/usePerformance";
import { cn } from "@/lib/utils";

type Audience = "clients" | "professionals";

interface Step {
  icon: LucideIcon;
  title: string;
  description: string;
}

const steps: Record<Audience, Step[]> = {
  clients: [
    {
      icon: Search,
      title: "Describe your project",
      description:
        "Tell us what you're building or renovating and where — we match you with vetted professionals in your county.",
    },
    {
      icon: FileCheck2,
      title: "Compare vetted profiles",
      description:
        "Review portfolios, ratings, and past projects side by side, then message the professionals who fit your budget and style.",
    },
    {
      icon: ShieldCheck,
      title: "Structured stage sign-offs",
      description:
        "Agree on project stages up front and record approvals between both parties as each milestone is completed to keep deliverables clear.",
    },
  ],
  professionals: [
    {
      icon: UserPlus,
      title: "Create a verified profile",
      description:
        "Showcase your licenses, portfolio, and specialties. Our team verifies credentials before you go live.",
    },
    {
      icon: Handshake,
      title: "Get matched with clients",
      description:
        "Receive project briefs that fit your services and location — no cold outreach, no unpaid pitching.",
    },
    {
      icon: Wallet,
      title: "Direct stage agreements",
      description:
        "Agree on clear deliverables per project stage and record client approvals as work is completed, keeping expectations aligned from kickoff to handover.",
    },
  ],
};

/**
 * "How It Works" — a standard two-sided-marketplace trust/conversion
 * section. Landing pages for platforms with structured stage
 * agreements convert better when the mechanics are explained up front,
 * before the user is asked to sign up. Mirrors the animation/intersection-observer
 * pattern used by the other home sections so it drops in without visual drift.
 */
export const HowItWorks = memo(function HowItWorks() {
  const [audience, setAudience] = useState<Audience>("clients");
  const [ref, isInView] = useIntersectionObserver();
  const shouldAnimate = useShouldAnimate();

  return (
    <section
      className="py-24 bg-background"
      ref={ref as React.RefObject<HTMLElement>}
      aria-labelledby="how-it-works-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-20">
        <div
          className={cn(
            "mb-10 max-w-2xl mx-auto text-center",
            isInView && shouldAnimate && "motion-safe:animate-fade-in-up",
          )}
        >
          <h2
            id="how-it-works-heading"
            className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight"
          >
            How <span className="text-primary">Build Market</span> works
          </h2>
          <p className="text-muted-foreground text-lg">
            A transparent process for homeowners and a fair one for
            professionals.
          </p>
        </div>

        {/* Audience Toggle */}
        <div
          role="group"
          aria-label="View how it works for"
          className="flex justify-center gap-2 mb-12"
        >
          {(["clients", "professionals"] as Audience[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={audience === key}
              onClick={() => setAudience(key)}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
                audience === key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-accent",
              )}
            >
              {key === "clients" ? "For Clients" : "For Professionals"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps[audience].map((step, index) => (
            <div
              key={step.title}
              className={cn(
                "relative p-6 rounded-2xl border border-border bg-card",
                isInView && shouldAnimate && "motion-safe:animate-fade-in-up",
              )}
              style={{
                animationDelay:
                  isInView && shouldAnimate ? `${index * 100}ms` : "0ms",
              }}
            >
              <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <step.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <span
                className="absolute top-6 right-6 font-display text-3xl font-bold text-muted-foreground/20"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <h3 className="text-lg font-bold text-foreground mb-2">
                {step.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        <div
          className={cn(
            "mt-12 flex flex-col sm:flex-row gap-4 justify-center",
            isInView && shouldAnimate && "motion-safe:animate-fade-in-up",
          )}
        >
          <Button size="lg" className="rounded-full h-12 px-8" asChild>
            <Link href={ROUTES.findProfessional}>Find a Professional</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-full h-12 px-8"
            asChild
          >
            <Link href={ROUTES.professional}>Join as a Pro</Link>
          </Button>
        </div>
      </div>
    </section>
  );
});

export default HowItWorks;
