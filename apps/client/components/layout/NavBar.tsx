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
import {
  Menu,
  X,
  LayoutDashboard,
  Accessibility,
  ArrowRight,
  ShieldCheck,
  Compass,
  Building2,
  BookOpen,
} from "lucide-react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { normalizeRole } from "@/app/lib/security/roles";
import { ROUTES, dashboardForRole } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  useThrottledScroll,
  useShouldAnimate,
} from "@/lib/hooks/usePerformance";
import { AccessibilitySettingsPanel } from "@/components/accessibility";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

// Discovery nav items for clients & consumers (Industry-standard separation)
const discoveryNavItems = [
  {
    label: "Idea Books",
    href: ROUTES.ideaBooks,
    icon: BookOpen,
    featureFlag: "enableIdeaBooks" as const,
  },
  {
    label: "Find Professionals",
    href: ROUTES.findProfessional,
    icon: Compass,
  },
  {
    label: "Properties",
    href: ROUTES.properties,
    icon: Building2,
  },
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
          "text-sm font-medium transition-all duration-200 rounded-full px-3.5 py-1.5",
          textColorClass,
          hoverClass,
          isActive && "bg-foreground/10 text-primary font-semibold shadow-2xs",
        )}
      >
        {label}
      </Button>
    </Link>
  );
});

// Memoized mobile accessibility trigger
const MobileAccessibilityTrigger = React.memo(
  function MobileAccessibilityTrigger() {
    return (
      <Button
        variant="outline"
        size="lg"
        className="w-full justify-start text-muted-foreground rounded-xl"
      >
        <Accessibility className="mr-2 h-4 w-4" />
        Accessibility Settings
      </Button>
    );
  },
);

export const Navbar: React.FC<NavbarProps> = memo(function Navbar({
  onLogoClick,
  variant = "default",
}) {
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

  const visibleNavItems = discoveryNavItems.filter(
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

  // Focus trap + Escape-to-close + body scroll lock
  useEffect(() => {
    if (isMobileMenuOpen && mobileMenuRef.current) {
      const focusableElements = mobileMenuRef.current.querySelectorAll(
        'a[href], button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])',
      ) as NodeListOf<HTMLElement>;
      const firstElement = focusableElements.item(0);
      const lastElement = focusableElements.item(focusableElements.length - 1);

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
          "rounded-full transition-colors h-9 w-9",
          textColorClass,
          hoverClass,
        )}
        aria-label="Accessibility settings"
      >
        <Accessibility size={17} />
      </Button>
    ),
    [textColorClass, hoverClass],
  );

  const mobileHeaderAccessibilityTrigger = useMemo(
    () => (
      <Button
        variant="ghost"
        size="icon"
        className={cn("rounded-full h-9 w-9", textColorClass, hoverClass)}
        aria-label="Accessibility settings"
      >
        <Accessibility size={17} />
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
          "transition-all duration-300 ease-out",
          shouldAnimate && "motion-safe:animate-slide-down",
          useScrolledStyles
            ? "bg-background/85 backdrop-blur-xl border-border/60 shadow-xs py-3.5"
            : "bg-transparent border-transparent py-5",
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 flex items-center justify-between">
          {/* Logo & Main Discovery Navigation */}
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="z-50 group flex items-center gap-2"
              onClick={onLogoClick}
            >
              <span
                className={cn(
                  "font-display text-2xl font-bold tracking-tight transition-colors",
                  textColorClass,
                )}
              >
                Build<span className="text-primary">Market</span>
              </span>
            </Link>

            {/* Desktop Discovery Links */}
            <div className="hidden lg:flex items-center gap-1">
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
            </div>
          </div>

          {/* Right Actions Cluster: Partner Link + Auth Controls */}
          <div className="hidden md:flex items-center gap-2.5">
            {!isLoaded ? (
              <div
                className="h-9 w-32 rounded-full bg-current/10 animate-pulse"
                aria-hidden="true"
              />
            ) : !isSignedIn ? (
              <>
                {/* Secondary Partner Link (Industry benchmark: "For Professionals") */}
                <Link
                  href={ROUTES.professional}
                  className={cn(
                    "text-sm font-medium transition-colors px-3 py-1.5 rounded-full hover:text-primary",
                    textColorClass,
                    hoverClass,
                    pathname === ROUTES.professional &&
                      "text-primary font-semibold",
                  )}
                >
                  For Professionals
                </Link>

                <div
                  className="h-4 w-px bg-border/60 mx-1"
                  aria-hidden="true"
                />

                {/* Sign In Trigger */}
                <SignInButton
                  mode="modal"
                  forceRedirectUrl={ROUTES.authCallback}
                >
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center justify-center rounded-full px-4 h-9 text-sm font-medium transition-colors cursor-pointer",
                      textColorClass,
                      hoverClass,
                    )}
                  >
                    Sign In
                  </button>
                </SignInButton>

                {/* Primary Action Button */}
                <Link
                  href={ROUTES.signUp}
                  className="rounded-full px-5 h-9 shadow-sm bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold transition-all inline-flex items-center justify-center active:scale-[0.98]"
                >
                  Get Started
                </Link>

                <AccessibilitySettingsPanel
                  trigger={desktopAccessibilityTrigger}
                />
              </>
            ) : (
              <>
                {dashboardHref && (
                  <Link href={dashboardHref}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "rounded-full text-sm font-medium px-3.5",
                        textColorClass,
                        hoverClass,
                      )}
                    >
                      <LayoutDashboard className="mr-1.5 h-4 w-4" />
                      Dashboard
                    </Button>
                  </Link>
                )}
                <AccessibilitySettingsPanel
                  trigger={desktopAccessibilityTrigger}
                />
                <div className="ml-1">
                  <UserButton />
                </div>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex items-center gap-2 md:hidden">
            <AccessibilitySettingsPanel
              trigger={mobileHeaderAccessibilityTrigger}
            />

            <Button
              ref={mobileToggleRef}
              variant="ghost"
              size="icon"
              className={cn("rounded-full h-9 w-9", textColorClass, hoverClass)}
              onClick={toggleMobileMenu}
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer Overlay */}
      <div
        ref={mobileMenuRef}
        className={cn(
          "fixed inset-0 bg-background z-40 md:hidden pt-20 px-6 pb-8 flex flex-col justify-between overflow-y-auto",
          "transition-all duration-300 ease-out",
          isMobileMenuOpen
            ? "opacity-100 translate-x-0 pointer-events-auto"
            : "opacity-0 translate-x-full pointer-events-none",
        )}
        aria-hidden={!isMobileMenuOpen}
        inert={!isMobileMenuOpen}
      >
        <div className="space-y-6 pt-4">
          {/* Section 1: Marketplace Discovery */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Explore Marketplace
            </p>
            <div className="space-y-1">
              {visibleNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between py-2.5 px-3 rounded-xl text-base font-semibold transition-colors",
                    pathname === item.href
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    {item.label}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/60" />
                </Link>
              ))}
            </div>
          </div>

          {/* Section 2: Building Professionals */}
          <div className="pt-4 border-t border-border">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              For Building Professionals
            </p>
            <div className="space-y-1">
              <Link
                href={ROUTES.professional}
                onClick={closeMobileMenu}
                className={cn(
                  "flex items-center justify-between py-2.5 px-3 rounded-xl text-base font-semibold transition-colors",
                  pathname === ROUTES.professional
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <span className="flex items-center gap-3">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Partner Portal & Overview
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground/60" />
              </Link>
            </div>
          </div>
        </div>

        {/* Section 3: Auth & Account Actions */}
        <div className="pt-6 border-t border-border space-y-3">
          {!isLoaded ? null : !isSignedIn ? (
            <>
              <Link
                href={ROUTES.signUp}
                onClick={closeMobileMenu}
                className="w-full justify-center inline-flex items-center rounded-xl h-11 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
              >
                Get Started
              </Link>
              <SignInButton mode="modal" forceRedirectUrl={ROUTES.authCallback}>
                <button
                  type="button"
                  className="w-full justify-center inline-flex items-center rounded-xl border border-input h-11 text-sm font-medium hover:bg-muted transition-colors cursor-pointer"
                >
                  Sign In
                </button>
              </SignInButton>
            </>
          ) : (
            <>
              {dashboardHref && (
                <Link href={dashboardHref} onClick={closeMobileMenu}>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full justify-start rounded-xl font-medium"
                  >
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    My Dashboard
                  </Button>
                </Link>
              )}
              <div className="flex items-center gap-3 pt-2">
                <UserButton />
                <span className="text-sm font-medium text-muted-foreground">
                  Manage Account
                </span>
              </div>
            </>
          )}

          <div className="pt-2">
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
