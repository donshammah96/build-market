"use client";

import React, { useState, useCallback, memo } from "react";
import Link from "next/link";
import { Button } from "../ui/button";
import { Menu, X, LayoutDashboard, Accessibility } from "lucide-react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { ROUTES } from "@/lib/links";
import { cn } from "@/lib/utils";
import {
  useThrottledScroll,
  useShouldAnimate,
} from "@/lib/hooks/usePerformance";
import { AccessibilitySettingsPanel } from "@/components/accessibility";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

const navItems = [
  { label: "Home", href: ROUTES.home },
  {
    label: "Idea Books",
    href: ROUTES.ideaBooks,
    featureFlag: "enableIdeaBooks" as const,
  },
  { label: "Professionals", href: ROUTES.findProfessional },
  { label: "Properties", href: ROUTES.properties },
] as const;

interface NavbarProps {
  onSignUpClick?: () => void;
  onLogoClick?: () => void;
  variant?: "default" | "light";
}

// Memoized nav item to prevent re-renders
const NavItem = memo(function NavItem({
  href,
  label,
  textColorClass,
  hoverClass,
}: {
  href: string;
  label: string;
  textColorClass: string;
  hoverClass: string;
}) {
  return (
    <Link href={href}>
      <Button
        variant="ghost"
        className={cn(
          "text-sm font-medium transition-colors duration-200",
          textColorClass,
          hoverClass,
        )}
      >
        {label}
      </Button>
    </Link>
  );
});

// Memoized mobile nav item
const MobileNavItem = memo(function MobileNavItem({
  href,
  label,
  onClick,
  index,
  shouldAnimate,
}: {
  href: string;
  label: string;
  onClick: () => void;
  index: number;
  shouldAnimate: boolean;
}) {
  return (
    <div
      className={cn(
        "transform transition-all duration-300",
        shouldAnimate && "animate-fade-in-up",
      )}
      style={{ animationDelay: shouldAnimate ? `${index * 50}ms` : "0ms" }}
    >
      <Link
        href={href}
        onClick={onClick}
        className="block text-2xl font-semibold text-zinc-900 py-2 border-b border-zinc-100 hover:text-emerald-600 transition-colors"
      >
        {label}
      </Link>
    </div>
  );
});

export const Navbar: React.FC<NavbarProps> = memo(function Navbar({
  onLogoClick,
  variant = "default",
}) {
  // Use throttled scroll for better performance
  const isScrolled = useThrottledScroll(20);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useUser();
  const shouldAnimate = useShouldAnimate();

  const userRole = user?.publicMetadata?.role as string | undefined;
  const enableIdeaBooks = useFeatureFlag("enableIdeaBooks");
  const useScrolledStyles = variant === "light" || isScrolled;

  const visibleNavItems = navItems.filter(
    (item) =>
      !("featureFlag" in item) ||
      enableIdeaBooks === true ||
      enableIdeaBooks === undefined,
  );
  const textColorClass = useScrolledStyles ? "text-zinc-900" : "text-white";
  const hoverClass = useScrolledStyles
    ? "hover:bg-zinc-100"
    : "hover:bg-white/10";

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  return (
    <>
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 border-b",
          // Use CSS transitions instead of framer-motion for simple state changes
          "transition-all duration-300 ease-out",
          shouldAnimate && "animate-slide-down",
          useScrolledStyles
            ? "bg-white/90 backdrop-blur-md border-zinc-200/50 shadow-sm py-3"
            : "bg-transparent border-transparent py-5",
        )}
      >
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="z-50" onClick={onLogoClick}>
            <span
              className={cn(
                "text-2xl font-bold tracking-tight transition-colors",
                textColorClass,
              )}
            >
              Build<span className="text-emerald-500">Market</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {visibleNavItems.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                textColorClass={textColorClass}
                hoverClass={hoverClass}
              />
            ))}

            <div className="h-6 w-px bg-zinc-300/30 mx-2" aria-hidden="true" />

            {/* Accessibility Settings Button */}
            <AccessibilitySettingsPanel
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "rounded-full transition-colors",
                    textColorClass,
                    hoverClass,
                  )}
                  aria-label="Accessibility settings"
                >
                  <Accessibility size={18} />
                </Button>
              }
            />

            {/* Auth Buttons */}
            <SignedOut>
              <SignInButton mode="modal" forceRedirectUrl={ROUTES.authCallback}>
                <Button
                  variant="ghost"
                  className={cn("font-medium", textColorClass, hoverClass)}
                >
                  Sign In
                </Button>
              </SignInButton>
              <SignUpButton mode="modal" forceRedirectUrl={ROUTES.onboarding}>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md rounded-full px-6">
                  <Link href={ROUTES.professional}>Join as a Pro</Link>
                </Button>
              </SignUpButton>
            </SignedOut>

            <SignedIn>
              {userRole === "client" && (
                <Link href={ROUTES.client}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(textColorClass)}
                  >
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>
              )}
              <div className="ml-2">
                <UserButton afterSignOutUrl="/" />
              </div>
            </SignedIn>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex items-center gap-2 md:hidden">
            {/* Mobile Accessibility Button */}
            <AccessibilitySettingsPanel
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("rounded-full", textColorClass, hoverClass)}
                  aria-label="Accessibility settings"
                >
                  <Accessibility size={18} />
                </Button>
              }
            />

            <Button
              variant="ghost"
              size="icon"
              className={cn(textColorClass, hoverClass)}
              onClick={toggleMobileMenu}
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay - CSS-based animation instead of framer-motion */}
      <div
        className={cn(
          "fixed inset-0 bg-white z-40 md:hidden pt-24 px-6 flex flex-col gap-6",
          "transition-all duration-300 ease-out",
          isMobileMenuOpen
            ? "opacity-100 translate-x-0 pointer-events-auto"
            : "opacity-0 translate-x-full pointer-events-none",
        )}
        aria-hidden={!isMobileMenuOpen}
      >
        {visibleNavItems.map((item, index) => (
          <MobileNavItem
            key={item.href}
            href={item.href}
            label={item.label}
            onClick={closeMobileMenu}
            index={index}
            shouldAnimate={shouldAnimate && isMobileMenuOpen}
          />
        ))}

        <div className="mt-4 flex flex-col gap-3">
          <SignedOut>
            <SignInButton mode="modal">
              <Button
                variant="outline"
                size="lg"
                className="w-full justify-center"
              >
                Sign In
              </Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button
                size="lg"
                className="w-full justify-center bg-emerald-600"
              >
                Join as a Pro
              </Button>
            </SignUpButton>
          </SignedOut>

          <SignedIn>
            <Link
              href={
                userRole === "professional"
                  ? "/professional-portal/dashboard"
                  : "/dashboard"
              }
            >
              <Button
                variant="secondary"
                size="lg"
                className="w-full justify-start"
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                My Dashboard
              </Button>
            </Link>
            <div className="flex items-center gap-2 mt-4">
              <UserButton afterSignOutUrl="/" />
              <span className="text-zinc-500">Manage Account</span>
            </div>
          </SignedIn>

          {/* Mobile Accessibility Settings Link */}
          <div className="mt-4 pt-4 border-t border-zinc-100">
            <AccessibilitySettingsPanel
              trigger={
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full justify-start text-zinc-600"
                >
                  <Accessibility className="mr-2 h-4 w-4" />
                  Accessibility Settings
                </Button>
              }
            />
          </div>
        </div>
      </div>
    </>
  );
});

export default Navbar;
