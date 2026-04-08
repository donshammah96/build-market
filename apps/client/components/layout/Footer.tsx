"use client";

import React, { memo, useMemo } from "react";
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
import { ROUTES } from "@/lib/links";
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

export const Footer = memo(function Footer() {
  // Memoize current year to prevent recalculation
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="w-full bg-background border-t border-border pt-16 pb-8">
      <div className="container mx-auto px-4 md:px-10 max-w-[1280px]">
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
            <form
              className="flex gap-2 max-w-md"
              onSubmit={(e) => {
                e.preventDefault();
                // Handle newsletter signup
              }}
            >
              <Input
                type="email"
                placeholder="Enter your email"
                className="bg-muted/60 border-border focus:border-focus-ring focus:ring-focus-ring transition-all"
                aria-label="Email address for newsletter"
                required
              />
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shrink-0"
                aria-label="Subscribe to newsletter"
              >
                <ArrowRight size={18} />
              </Button>
            </form>

            {/* Contact Info */}
            <div className="pt-6 mt-6 border-t border-border space-y-3">
              <a
                href="mailto:hello@buildmarket.co.ke"
                className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 rounded-sm"
              >
                <Mail size={16} className="text-primary" aria-hidden="true" />
                <span>hello@buildmarket.co.ke</span>
              </a>
              <a
                href="tel:+254791938881"
                className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 rounded-sm"
              >
                <Phone size={16} className="text-primary" aria-hidden="true" />
                <span>+254 791 938 881</span>
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
            <AccessibilitySettingsPanel
              trigger={
                <button
                  className="flex items-center gap-1.5 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 rounded-sm"
                  aria-label="Accessibility settings"
                >
                  <Accessibility size={14} />
                  Accessibility
                </button>
              }
            />
          </nav>
        </div>
      </div>
    </footer>
  );
});

export default Footer;
