"use client";

import { memo } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";
import {
  useIntersectionObserver,
  useShouldAnimate,
} from "@/lib/hooks/usePerformance";
import { cn } from "@/lib/utils";

export interface FAQItem {
  question: string;
  answer: string;
}

export const FAQ_DATA: FAQItem[] = [
  {
    question: "How does Build Market verify building professionals?",
    answer:
      "Every architect, engineer, and contractor undergoes verification against statutory registration boards in Kenya, including the Engineers Board of Kenya (EBK), the Board of Registration of Architects and Quantity Surveyors (BORAQS), and the National Construction Authority (NCA). We validate practicing certificates, registration numbers, and identity before granting a Verified Pro badge.",
  },
  {
    question: "How do structured milestone payments work?",
    answer:
      "Projects are broken down into agreed stage deliverables (for example: Architectural Drawings, Structural Engineering Sign-off, Foundation, or Superstructure). Payment terms are confirmed up front per stage, and disbursements occur only after you inspect and sign off on completed work. You never pay for unverified work.",
  },
  {
    question: "What types of professionals can I hire on Build Market?",
    answer:
      "You can find licensed architects, structural and civil engineers, electrical engineers, quantity surveyors, interior designers, general building contractors, and specialized trade artisans across all 47 counties in Kenya.",
  },
  {
    question: "Can I source building materials directly through the platform?",
    answer:
      "Yes. Build Market features a vetted marketplace directory of verified hardware stores, timber yards, tile suppliers, and building material distributors across Nairobi and regional counties, with transparent pricing and direct ordering options.",
  },
  {
    question: "How are project disputes or delays handled?",
    answer:
      "In the event of a scope disagreement, delay, or defective workmanship, Build Market provides a structured dispute mediation process. Stage disbursements can be held while independent technical assessors review deliverables against the contracted specifications.",
  },
  {
    question: "How do I register as a licensed professional or vendor?",
    answer:
      "Click 'Join as a Pro' or 'For Professionals' in the navigation. Complete the onboarding wizard by uploading your statutory registration certificate, national identification, business permit, and portfolio of completed Kenyan projects. Our compliance team verifies documents within 2 business days before your profile goes live.",
  },
];

export const FAQSection = memo(function FAQSection() {
  const [ref, isInView] = useIntersectionObserver();
  const shouldAnimate = useShouldAnimate();

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_DATA.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="py-24 bg-background border-t border-border/60"
      aria-labelledby="faq-heading"
    >
      {/* FAQPage Structured Data (SEO / Rich Snippets) */}
      <script
        type="application/ld+json"
        // SECURITY_XSS_ALLOWLIST: Static FAQ schema metadata, safe JSON-LD without user input
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd),
        }}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Header */}
        <div
          className={cn(
            "text-center max-w-2xl mx-auto mb-14 space-y-3",
            isInView && shouldAnimate && "motion-safe:animate-fade-in-up",
          )}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <HelpCircle className="h-3.5 w-3.5" />
            Frequently Asked Questions
          </div>
          <h2
            id="faq-heading"
            className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-foreground tracking-tight"
          >
            Everything you need to know.
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
            Clear answers on professional verification, milestone stage
            approvals, and building securely in Kenya.
          </p>
        </div>

        {/* Accordion */}
        <div
          className={cn(
            "rounded-2xl border border-border bg-card p-6 md:p-8 shadow-xs",
            isInView && shouldAnimate && "motion-safe:animate-fade-in-up",
          )}
          style={{ animationDelay: "150ms" }}
        >
          <Accordion type="single" collapsible className="w-full">
            {FAQ_DATA.map((item, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border-border/60 py-1"
              >
                <AccordionTrigger className="text-base sm:text-lg font-semibold text-foreground hover:text-emerald-600 dark:hover:text-emerald-400 text-left transition-colors">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm sm:text-base text-muted-foreground leading-relaxed pt-2 pb-4">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
});

export default FAQSection;
