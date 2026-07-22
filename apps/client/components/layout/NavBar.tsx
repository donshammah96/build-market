"use client";

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  memo,
  useMemo,
} from "react";
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
import { ROUTES, dashboardForRole } from "@/lib/routes";
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
  tabIndex,
}: {
  href: string;
  label: string;
  onClick: () => void;
  index: number;
  shouldAnimate: boolean;
  isActive: boolean;
  tabIndex: number;
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
        tabIndex={tabIndex}
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
  const { user, isLoaded } = useUser();
  const pathname = usePathname();
  const isSignedIn = Boolean(user);
  const shouldAnimate = useShouldAnimate();

  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);

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

  // Focus trap + Escape-to-close + focus restoration for the mobile
  // overlay, matching the pattern already proven in MobileNav.tsx instead
  // of leaving the drawer with no keyboard handling at all.
  useEffect(() => {
    if (isMobileMenuOpen && mobileMenuRef.current) {
      const focusableElements = mobileMenuRef.current.querySelectorAll(
        'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])',
      ) as NodeListOf<HTMLElement>;
      const firstElement = focusableElements.item(0);
      const lastElement = focusableElements.item(focusableElements.length - 1);

      // Lock body scroll while the overlay is open.
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          closeMobileMenu();
          return;
        }
        if (e.key === "Tab" && firstElement && lastElement) {
          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement.focus();
            }
          } else {
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement.focus();
            }
          }
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      firstElement?.focus();

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = previousOverflow;
      };
    }

    if (!isMobileMenuOpen) {
      mobileToggleRef.current?.focus();
    }
  }, [isMobileMenuOpen, closeMobileMenu]);

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
            {!isLoaded ? (
              <div
                className="h-9 w-40 rounded-full bg-current/10 animate-pulse"
                aria-hidden="true"
              />
            ) : !isSignedIn ? (
              <>
                {/*
                  SignInButton/SignUpButton clone their child and attach a
                  click handler that opens the Clerk modal. Previously this
                  child was a Button wrapping a next/link <Link>, which
                  meant two competing handlers (navigate vs. open-modal) sat
                  on the same element. The child is now a plain button with
                  no href/navigation — Clerk owns the click entirely.
                */}
                <SignInButton
                  mode="modal"
                  forceRedirectUrl={ROUTES.authCallback}
                >
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center justify-center rounded-md px-4 h-9 text-sm font-medium transition-colors",
                      textColorClass,
                      hoverClass,
                    )}
                  >
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal" forceRedirectUrl={ROUTES.onboarding}>
                  <button
                    type="button"
                    className="rounded-full px-6 h-9 shadow-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors"
                  >
                    Join as a Pro
                  </button>
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
              ref={mobileToggleRef}
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
        ref={mobileMenuRef}
        className={cn(
          "fixed inset-0 bg-background z-40 md:hidden pt-24 px-6 flex flex-col gap-6",
          "transition-all duration-300 ease-out",
          isMobileMenuOpen
            ? "opacity-100 translate-x-0 pointer-events-auto"
            : "opacity-0 translate-x-full pointer-events-none",
        )}
        aria-hidden={!isMobileMenuOpen}
        // Prevent keyboard focus from landing on offscreen links while closed.
        inert={!isMobileMenuOpen}
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
            tabIndex={isMobileMenuOpen ? 0 : -1}
          />
        ))}

        <div className="mt-4 flex flex-col gap-3">
          {!isLoaded ? null : !isSignedIn ? (
            <>
              <SignInButton mode="modal" forceRedirectUrl={ROUTES.authCallback}>
                <button
                  type="button"
                  className="w-full justify-center inline-flex items-center rounded-md border border-input h-11 text-base font-medium"
                >
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal" forceRedirectUrl={ROUTES.onboarding}>
                <button
                  type="button"
                  className="w-full justify-center inline-flex items-center rounded-md h-11 text-base font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Join as a Pro
                </button>
              </SignUpButton>
            </>
          ) : (
            <>
              {dashboardHref && (
                <Link href={dashboardHref} tabIndex={isMobileMenuOpen ? 0 : -1}>
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
