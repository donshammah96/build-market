"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "../ui/button";
import { Menu, X, Bell, Settings, LayoutDashboard } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  useThrottledScroll,
  useShouldAnimate,
} from "@/lib/hooks/usePerformance";
import { clientNavItems } from "@/app/lib/config/nav-config";

interface ClientNavbarProps {
  /**
   * Unread notification count. Omit (rather than passing 0) to hide the
   * badge entirely. Previously hardcoded to a literal "3 New" — wire this
   * up to the real notifications source before shipping.
   */
  unreadNotifications?: number;
}

export const ClientNavbar = ({ unreadNotifications }: ClientNavbarProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Shared throttled scroll + reduced-motion-aware animation hooks, same
  // as NavBar.tsx, instead of a bespoke unthrottled scroll listener.
  const scrolled = useThrottledScroll(10);
  const shouldAnimate = useShouldAnimate();
  const pathname = usePathname();

  const drawerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);

  // Focus trap + Escape-to-close + body scroll lock + focus restoration,
  // matching the pattern in MobileNav.tsx / NavBar.tsx.
  useEffect(() => {
    if (isMobileMenuOpen && drawerRef.current) {
      const focusableElements = drawerRef.current.querySelectorAll(
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
          } else if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
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
      toggleRef.current?.focus();
    }
  }, [isMobileMenuOpen, closeMobileMenu]);

  return (
    <>
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 h-16 border-b",
          "transition-all duration-300 ease-out",
          shouldAnimate && "motion-safe:animate-slide-down",
          scrolled
            ? "bg-background/90 backdrop-blur-md border-border shadow-sm"
            : "bg-background border-border",
        )}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-full flex items-center justify-between">
          {/* Logo Section */}
          <Link
            href={ROUTES.userDashboard}
            className="flex items-center gap-2 group"
          >
            <div className="h-8 w-8 bg-primary/15 rounded-lg flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <LayoutDashboard size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-foreground leading-none">
                Build<span className="text-primary">Market</span>
              </span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider leading-none mt-0.5">
                Client Portal
              </span>
            </div>
          </Link>

          {/* Desktop Navigation - Centered */}
          <div className="hidden md:flex items-center gap-1 bg-muted/60 p-1 rounded-full border border-border/70">
            {clientNavItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link key={item.key} href={item.href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "text-sm font-medium transition-all duration-200 gap-2 rounded-full px-4 h-9",
                      isActive
                        ? "bg-card text-primary shadow-sm border border-border/70"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {Icon && (
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          isActive ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                    )}
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notifications */}
            <Link href="/notifications">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-primary hover:bg-primary/10 relative hidden sm:flex rounded-full"
                aria-label={
                  unreadNotifications
                    ? `Notifications, ${unreadNotifications} unread`
                    : "Notifications"
                }
              >
                <Bell className="h-5 w-5" />
                {Boolean(unreadNotifications) && (
                  <span className="absolute top-2 right-2.5 h-2 w-2 bg-red-500 rounded-full border-2 border-white" />
                )}
              </Button>
            </Link>

            <div className="h-6 w-px bg-border hidden sm:block mx-1" />

            {/* User Profile */}
            <div className="flex items-center gap-3">
              <div className="hidden lg:block text-right">
                <p className="text-sm font-semibold text-foreground leading-none">
                  My Account
                </p>
                <Link
                  href="/profile"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Manage Profile
                </Link>
              </div>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-9 w-9 ring-2 ring-white shadow-sm",
                  },
                }}
              />
            </div>

            {/* Mobile Menu Toggle */}
            <Button
              ref={toggleRef}
              variant="ghost"
              size="icon"
              className="md:hidden text-muted-foreground hover:bg-accent ml-1"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay - CSS transitions instead of framer-motion,
          consistent with NavBar.tsx. aria-hidden + inert keep the closed
          drawer out of the keyboard tab order. */}
      <div
        className={cn(
          "fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden top-16 transition-opacity duration-200",
          isMobileMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        )}
        onClick={closeMobileMenu}
        aria-hidden="true"
      />
      <div
        ref={drawerRef}
        className={cn(
          "fixed inset-x-0 top-16 bg-background border-b border-border z-50 md:hidden shadow-xl rounded-b-2xl overflow-hidden",
          "transition-all duration-300 ease-out",
          shouldAnimate && "motion-safe:transform",
          isMobileMenuOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-2 pointer-events-none",
        )}
        aria-hidden={!isMobileMenuOpen}
        inert={!isMobileMenuOpen}
      >
        <div className="p-4 flex flex-col gap-1">
          <div className="px-4 py-2 mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Navigation
            </p>
          </div>

          {clientNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link key={item.key} href={item.href} onClick={closeMobileMenu}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent hover:pl-6",
                  )}
                >
                  {Icon && (
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        isActive ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                  )}
                  <span>{item.label}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </div>
              </Link>
            );
          })}

          <div className="h-px bg-border my-3 mx-4" />

          <div className="px-4 py-2 mb-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Account
            </p>
          </div>

          <Link href="/profile" onClick={closeMobileMenu}>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-accent hover:pl-6 transition-all">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">Settings</span>
            </div>
          </Link>

          <Link href="/notifications" onClick={closeMobileMenu}>
            <div className="flex items-center justify-between px-4 py-3 rounded-xl text-muted-foreground hover:bg-accent hover:pl-6 transition-all">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Notifications</span>
              </div>
              {Boolean(unreadNotifications) && (
                <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unreadNotifications} New
                </span>
              )}
            </div>
          </Link>
        </div>
      </div>
    </>
  );
};

export default ClientNavbar;
