"use client";

import React, { useState, useCallback, memo, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "../ui/button";
import { Menu, X, LayoutDashboard, Accessibility } from "lucide-react";
// Memoized mobile accessibility trigger to avoid new object on each render
const MobileAccessibilityTrigger = React.memo(
  function MobileAccessibilityTrigger() {
    return (
      <Button
        variant="outline"
        size="lg"
        className="w-full justify-start text-muted-foreground"
      >
        <Accessibility className="mr-2 h-4 w-4" />
        Accessibility Settings
      </Button>
    );
  },
);
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { normalizeRole } from "@/app/lib/security/roles";
import { ROUTES, dashboardForRole } from "@/lib/links";
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
  isActive,
}: {
  href: string;
  label: string;
  textColorClass: string;
  hoverClass: string;
  isActive: boolean;
}) {
  return (
    <Link href={href}>
      <Button
        variant="ghost"
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "text-sm font-medium transition-colors duration-200 rounded-full",
          textColorClass,
          hoverClass,
          isActive && "underline underline-offset-4",
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
  isActive,
}: {
  href: string;
  label: string;
  onClick: () => void;
  index: number;
  shouldAnimate: boolean;
  isActive: boolean;
}) {
  return (
    <div
      className={cn(
        "transform transition-all duration-300",
        shouldAnimate && "motion-safe:animate-fade-in-up",
      )}
      style={{ animationDelay: shouldAnimate ? `${index * 50}ms` : "0ms" }}
    >
      <Link
        href={href}
        onClick={onClick}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "block min-h-11 py-2 border-b border-border transition-colors text-2xl font-semibold",
          "text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm",
          isActive && "text-primary",
        )}
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
  const pathname = usePathname();
  const isSignedIn = Boolean(user);
  const shouldAnimate = useShouldAnimate();

  const userRole = user?.publicMetadata?.role as string | undefined;
  const normalizedUserRole = normalizeRole(userRole);
  const dashboardHref =
    normalizedUserRole && normalizedUserRole !== "ADMIN"
      ? dashboardForRole(normalizedUserRole)
      : null;
  const enableIdeaBooks = useFeatureFlag("enableIdeaBooks");
  const useScrolledStyles = variant === "light" || isScrolled;

  const visibleNavItems = navItems.filter(
    (item) =>
      !("featureFlag" in item) ||
      enableIdeaBooks === true ||
      enableIdeaBooks === undefined,
  );
  const textColorClass = useScrolledStyles ? "text-foreground" : "text-white";
  const hoverClass = useScrolledStyles ? "hover:bg-muted" : "hover:bg-white/10";

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  const desktopAccessibilityTrigger = useMemo(
    () => (
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
    ),
    [textColorClass, hoverClass],
  );

  const mobileHeaderAccessibilityTrigger = useMemo(
    () => (
      <Button
        variant="ghost"
        size="icon"
        className={cn("rounded-full", textColorClass, hoverClass)}
        aria-label="Accessibility settings"
      >
        <Accessibility size={18} />
      </Button>
    ),
    [textColorClass, hoverClass],
  );

  const mobileMenuAccessibilityTrigger = useMemo(
    () => <MobileAccessibilityTrigger />,
    [],
  );

  return (
    <>
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 border-b",
          // Use CSS transitions instead of framer-motion for simple state changes
          "transition-all duration-300 ease-out",
          shouldAnimate && "motion-safe:animate-slide-down",
          useScrolledStyles
            ? "bg-background/90 backdrop-blur-md border-border/60 shadow-sm py-3"
            : "bg-transparent border-transparent py-5",
        )}
      >
        <div className="max-w-360 mx-auto px-4 md:px-8 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="z-50" onClick={onLogoClick}>
            <span
              className={cn(
                "text-2xl font-bold tracking-tight transition-colors",
                textColorClass,
              )}
            >
              Build<span className="text-primary">Market</span>
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
                isActive={pathname === item.href}
              />
            ))}

            <div className="h-6 w-px bg-border/70 mx-2" aria-hidden="true" />

            {/* Accessibility Settings Button */}
            <AccessibilitySettingsPanel trigger={desktopAccessibilityTrigger} />

            {/* Auth Buttons */}
            {!isSignedIn ? (
              <>
                <SignInButton
                  mode="modal"
                  forceRedirectUrl={ROUTES.authCallback}
                >
                  <Button
                    variant="ghost"
                    className={cn("font-medium", textColorClass, hoverClass)}
                  >
                    Sign In
                  </Button>
                </SignInButton>
                <SignUpButton mode="modal" forceRedirectUrl={ROUTES.onboarding}>
                  <Button className="rounded-full px-6 shadow-md bg-primary text-primary-foreground hover:bg-primary/90">
                    <Link href={ROUTES.professional}>Join as a Pro</Link>
                  </Button>
                </SignUpButton>
              </>
            ) : (
              <>
                {dashboardHref && (
                  <Link href={dashboardHref}>
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
                  <UserButton />
                </div>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex items-center gap-2 md:hidden">
            {/* Mobile Accessibility Button */}
            <AccessibilitySettingsPanel
              trigger={mobileHeaderAccessibilityTrigger}
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
          "fixed inset-0 bg-background z-40 md:hidden pt-24 px-6 flex flex-col gap-6",
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
            isActive={pathname === item.href}
          />
        ))}

        <div className="mt-4 flex flex-col gap-3">
          {!isSignedIn ? (
            <>
              <SignInButton mode="modal" forceRedirectUrl={ROUTES.authCallback}>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full justify-center"
                >
                  Sign In
                </Button>
              </SignInButton>
              <SignUpButton mode="modal" forceRedirectUrl={ROUTES.onboarding}>
                <Button
                  size="lg"
                  className="w-full justify-center bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Join as a Pro
                </Button>
              </SignUpButton>
            </>
          ) : (
            <>
              {dashboardHref && (
                <Link href={dashboardHref}>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full justify-start"
                  >
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    My Dashboard
                  </Button>
                </Link>
              )}
              <div className="flex items-center gap-2 mt-4">
                <UserButton />
                <span className="text-muted-foreground">Manage Account</span>
              </div>
            </>
          )}

          {/* Mobile Accessibility Settings Link */}
          <div className="mt-4 pt-4 border-t border-border">
            <AccessibilitySettingsPanel
              trigger={mobileMenuAccessibilityTrigger}
            />
          </div>
        </div>
      </div>
    </>
  );
});

export default Navbar;
