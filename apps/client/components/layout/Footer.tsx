"use client";

import React, { memo, useMemo, useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Instagram,
  Linkedin,
  Twitter,
  Facebook,
  Mail,
  Phone,
  ArrowRight,
  Accessibility,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/routes";
import { AccessibilitySettingsPanel } from "@/components/accessibility";

// Memoized footer link component
const FooterLink = memo(function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="inline-block text-sm text-muted-foreground hover:text-primary motion-safe:hover:translate-x-1 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 rounded-sm"
      >
        {children}
      </Link>
    </li>
  );
});

// Memoized social icon component
const SocialIcon = memo(function SocialIcon({
  icon,
  href,
  label,
}: {
  icon: React.ReactNode;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="h-11 w-11 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
    >
      {icon}
    </Link>
  );
});

type SubscribeStatus = "idle" | "loading" | "success" | "error";

// Distinct success copy per backend status, rather than one generic
// "You're in" message — "already_subscribed" and "resubscribe_pending"
// are not failures, but they're also not the same event as a brand-new
// signup, and telling a returning subscriber "check your inbox to
// confirm" when they're already confirmed reads as broken, not helpful.
const SUCCESS_COPY = {
  pending_confirmation: "You're in — check your inbox to confirm.",
  resubscribe_pending: "Almost there — check your inbox to confirm.",
  already_subscribed: "You're already subscribed — nothing to do here.",
} as const;

export const Footer = memo(function Footer() {
  // Memoize current year to prevent recalculation
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  const accessibilityTrigger = useMemo(
    () => (
      <button
        className="flex items-center gap-1.5 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 rounded-sm"
        aria-label="Accessibility settings"
      >
        <Accessibility size={14} />
        Accessibility
      </button>
    ),
    [],
  );

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const [subscribeStatus, setSubscribeStatus] =
    useState<SubscribeStatus>("idle");
  const [subscribeMessage, setSubscribeMessage] = useState<string>("");

  async function handleNewsletterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (subscribeStatus === "loading" || subscribeStatus === "success") return;

    const form = e.currentTarget;
    const formData = new FormData(form);
    const email = (formData.get("email") as string | null) ?? "";
    const company = (formData.get("company") as string | null) ?? "";

    // Honeypot check: if filled, silently treat as success without calling API
    if (company.trim().length > 0) {
      setSubscribeStatus("success");
      setSubscribeMessage(SUCCESS_COPY.pending_confirmation);
      return;
    }

    setSubscribeStatus("loading");

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, company }),
      });

      // Previously: `if (!res.ok) throw new Error("subscribe_failed")`
      // followed by a single generic "Something went wrong" message for
      // every failure — a rate-limited user, a suppressed address, and
      // an actual outage all looked identical, and a *successful* call
      // always showed the same "check your inbox" copy even for someone
      // who was already subscribed. Both the error and success paths now
      // read the server's actual message so the form can be a source of
      // truth rather than a rubber stamp.
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setSubscribeStatus("error");
        setSubscribeMessage(
          body?.message ?? "Something went wrong — try again in a moment.",
        );
        return;
      }

      setSubscribeStatus("success");
      const status = body?.status;
      const msg =
        typeof status === "string" && status in SUCCESS_COPY
          ? SUCCESS_COPY[status as keyof typeof SUCCESS_COPY]
          : SUCCESS_COPY.pending_confirmation;
      setSubscribeMessage(msg);
    } catch {
      setSubscribeStatus("error");
      setSubscribeMessage("Something went wrong — try again in a moment.");
    }
  }

  return (
    <footer className="w-full bg-background border-t border-border pt-16 pb-8">
      <div className="container mx-auto px-4 md:px-10 max-w-7xl">
        {/* Top Section: Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 mb-16">
          {/* Brand Column */}
          <div className="lg:col-span-4 space-y-6">
            <button
              onClick={scrollToTop}
              className="cursor-pointer inline-flex items-center gap-2 motion-safe:hover:scale-[1.02] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 rounded-sm"
              aria-label="Scroll to top"
            >
              <span className="text-2xl font-bold text-foreground tracking-tight">
                Build<span className="text-primary">Market</span>
              </span>
            </button>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
              The definitive platform connecting Kenyan homeowners with top-tier
              architects, engineers, and trusted artisans.
            </p>

            {/* Social Links */}
            <nav
              className="flex items-center gap-4 pt-2"
              aria-label="Social media links"
            >
              <SocialIcon
                icon={<Instagram size={18} />}
                href="#"
                label="Follow us on Instagram"
              />
              <SocialIcon
                icon={<Linkedin size={18} />}
                href="#"
                label="Connect on LinkedIn"
              />
              <SocialIcon
                icon={<Twitter size={18} />}
                href="#"
                label="Follow us on Twitter"
              />
              <SocialIcon
                icon={<Facebook size={18} />}
                href="#"
                label="Like us on Facebook"
              />
            </nav>
          </div>

          {/* Links Column 1: Company */}
          <nav className="lg:col-span-2 space-y-6" aria-label="Company links">
            <h3 className="font-semibold text-foreground text-sm tracking-wide">
              Company
            </h3>
            <ul className="space-y-3">
              <FooterLink href={ROUTES.home}>About Us</FooterLink>
              <FooterLink href={ROUTES.home}>Careers</FooterLink>
              <FooterLink href={ROUTES.reviews}>Success Stories</FooterLink>
              <FooterLink href={ROUTES.home}>Press</FooterLink>
            </ul>
          </nav>

          {/* Links Column 2: Resources */}
          <nav className="lg:col-span-2 space-y-6" aria-label="Resources">
            <h3 className="font-semibold text-foreground text-sm tracking-wide">
              Resources
            </h3>
            <ul className="space-y-3">
              <FooterLink href={ROUTES.joinAsPro}>Join as a Pro</FooterLink>
              <FooterLink href={ROUTES.ideaBooks}>Idea Books</FooterLink>
              <FooterLink href={ROUTES.findProfessional}>
                Find Professionals
              </FooterLink>
              <FooterLink href={ROUTES.home}>Help Center</FooterLink>
            </ul>
          </nav>

          {/* Newsletter / Contact Column */}
          <div className="lg:col-span-4 space-y-6">
            <h3 className="font-semibold text-foreground text-sm tracking-wide">
              Stay Connected
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get the latest design trends and market insights delivered to your
              inbox.
            </p>
            {/* Newsletter signup */}
            <form
              className="flex flex-col gap-3 max-w-md"
              onSubmit={handleNewsletterSubmit}
            >
              {/*
               * Honeypot — visually off-screen so real users never see it.
               * We use absolute positioning rather than display:none because
               * some bots skip display:none fields; off-screen fools them while
               * remaining accessible-hidden via aria-hidden + tabIndex=-1.
               */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "-9999px",
                  width: "1px",
                  height: "1px",
                  overflow: "hidden",
                }}
              >
                <label htmlFor="footer-newsletter-company">
                  Company (leave blank)
                </label>
                <input
                  id="footer-newsletter-company"
                  name="company"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <div className="flex gap-2">
                <Input
                  id="footer-newsletter-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="Enter your email"
                  className="bg-muted/60 border-border focus:border-focus-ring focus:ring-focus-ring transition-all"
                  aria-label="Email address for newsletter"
                  required
                  disabled={
                    subscribeStatus === "loading" ||
                    subscribeStatus === "success"
                  }
                />
                <Button
                  type="submit"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shrink-0"
                  aria-label={
                    subscribeStatus === "loading"
                      ? "Subscribing…"
                      : "Subscribe to newsletter"
                  }
                  disabled={
                    subscribeStatus === "loading" ||
                    subscribeStatus === "success"
                  }
                >
                  <ArrowRight size={18} />
                </Button>
              </div>

              {/* Status message — announced to screen readers via aria-live */}
              <div
                aria-live="polite"
                aria-atomic="true"
                className="min-h-5 text-xs"
              >
                {subscribeStatus === "success" && (
                  <span className="text-primary font-medium">
                    {subscribeMessage}
                  </span>
                )}
                {subscribeStatus === "error" && (
                  <span className="text-destructive">{subscribeMessage}</span>
                )}
              </div>
            </form>

            {/* Contact Info */}
            <div className="pt-6 mt-6 border-t border-border space-y-3">
              <a
                href="mailto:mail@buildmarket.app"
                className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 rounded-sm"
              >
                <Mail size={16} className="text-primary" aria-hidden="true" />
                <span>mail@buildmarket.app</span>
              </a>
              <a
                href="tel:+254798798770"
                className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 rounded-sm"
              >
                <Phone size={16} className="text-primary" aria-hidden="true" />
                <span>+254 798 798 770</span>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <MapPin size={14} className="text-primary" aria-hidden="true" />
            <span className="font-medium">Nairobi, Kenya</span>
            <span className="mx-2 text-border" aria-hidden="true">
              |
            </span>
            <span>&copy; {currentYear} Build Market Ltd.</span>
          </div>
          <nav
            className="flex items-center gap-6 font-medium"
            aria-label="Legal links"
          >
            <Link
              href="/legal/privacy"
              className="hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 rounded-sm"
            >
              Privacy Policy
            </Link>
            <Link
              href="/legal/professional-terms"
              className="hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 rounded-sm"
            >
              Terms of Service
            </Link>
            <Link
              href="/legal/cookie-settings"
              className="hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 rounded-sm"
            >
              Cookie Settings
            </Link>
            <span className="text-border" aria-hidden="true">
              |
            </span>
            <AccessibilitySettingsPanel trigger={accessibilityTrigger} />
          </nav>
        </div>
      </div>
    </footer>
  );
});

export default Footer;
