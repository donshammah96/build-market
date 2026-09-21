"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  Menu,
  X,
  UserCircle,
  ChevronRight,
  LogOut,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserButton, useClerk } from "@clerk/nextjs";
import { NotificationsPopover } from "@/components/notifications/NotificationsPopover";
import { MessagesPopover } from "@/components/chat/MessagesPopover";
import { useProfileCompletion } from "@/hooks/useProfileStatus";
import { cn } from "@/lib/utils";
import { professionalNavItems } from "@/app/lib/config/nav-config";

export function ProfessionalNavbar() {
  const { percentage, isComplete, isLoading } = useProfileCompletion();
  const { signOut } = useClerk();
  const pathname = usePathname();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);

  // Show completion prompt when profile is incomplete
  const showCompletionPrompt = !isLoading && !isComplete && percentage < 100;

  // Focus trap + Escape-to-close + body scroll lock, same pattern used
  // across MobileNav.tsx / NavBar.tsx / ClientNavbar.tsx.
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
    <header className="sticky top-0 z-40 w-full bg-background border-b border-border h-16">
      <div className="h-full px-4 md:px-8 flex items-center justify-between">
        {/* Mobile Toggle (Hidden on LG) */}
        <div className="flex items-center gap-4 lg:hidden">
          <Button
            ref={toggleRef}
            variant="ghost"
            size="icon"
            className="-ml-2 text-muted-foreground"
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
          <span className="font-semibold text-foreground">BuildMarket Pro</span>
        </div>

        {/* Search Bar */}
        <div className="hidden lg:flex flex-1 max-w-xl relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects, clients, or invoices..."
            className="pl-9 bg-muted/70 border-border focus:bg-background transition-all w-full"
          />
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Profile Completion Button - shown when incomplete */}
          {showCompletionPrompt && (
            <Link href="/professional-portal/settings/complete-profile">
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:flex items-center gap-2 text-warning border-warning/40 bg-warning/10 hover:bg-warning/20 hover:border-warning/50"
              >
                <UserCircle className="h-4 w-4" />
                <span>Complete Profile</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-warning/30 text-warning">
                  {percentage}%
                </span>
                <ChevronRight className="h-3 w-3 opacity-50" />
              </Button>
            </Link>
          )}

          {!showCompletionPrompt && (
            <Button
              variant="outline"
              className="hidden sm:flex text-primary border-primary/40 bg-primary/10 hover:bg-primary/15 hover:border-primary/50"
            >
              Premium Plan
            </Button>
          )}

          <div className="h-6 w-px bg-border hidden sm:block" />

          <NotificationsPopover />

          <MessagesPopover />

          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-9 w-9",
              },
            }}
          />
        </div>
      </div>

      {/* Mobile Nav Drawer — previously the toggle above had no onClick and
          the sidebar (ProfessionalSidebar) is desktop-only (`hidden lg:flex`),
          so professionals on mobile had no way to reach Leads, Projects,
          Messages, Portfolio, Finance, or Settings at all. */}
      <div
        className={cn(
          "fixed inset-0 bg-black/20 z-40 lg:hidden top-16 transition-opacity duration-200",
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
          "fixed inset-x-0 top-16 bg-background border-b border-border z-50 lg:hidden shadow-xl rounded-b-2xl overflow-hidden",
          "transition-all duration-300 ease-out",
          isMobileMenuOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-2 pointer-events-none",
        )}
        aria-hidden={!isMobileMenuOpen}
        inert={!isMobileMenuOpen}
      >
        <div className="p-4 flex flex-col gap-1">
          <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Management
          </p>
          {professionalNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.key} href={item.href} onClick={closeMobileMenu}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {Icon && <Icon className="h-5 w-5" />}
                  <span>{item.label}</span>
                  {typeof item.badge === "number" && item.badge > 0 && (
                    <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}

          <div className="h-px bg-border my-2 mx-4" />

          <Link href="/professional-portal/settings" onClick={closeMobileMenu}>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-accent transition-all">
              <Settings className="h-5 w-5" />
              <span className="font-medium">Settings</span>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => signOut()}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:text-destructive hover:bg-accent transition-all text-left"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
