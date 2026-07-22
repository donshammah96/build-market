"use client";

import Link from "next/link";
import { useUser, useClerk } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BadgeCheck, Store, UserCircle, Settings, LogOut } from "lucide-react";
import { useProfileCompletion } from "@/hooks/useProfileStatus";
import { professionalNavItems } from "@/app/lib/config/nav-config";

interface ProfessionalSidebarProps {
  verified?: boolean;
}

export function ProfessionalSidebar({
  verified = false,
}: ProfessionalSidebarProps) {
  const pathname = usePathname();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { percentage, isComplete, isLoading } = useProfileCompletion();

  // Show completion prompt in sidebar
  const showCompletionPrompt = !isLoading && !isComplete && percentage < 100;

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-foreground text-background hidden lg:flex flex-col border-r border-white/10">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="bg-primary p-1.5 rounded-lg">
            <Store className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white group-hover:text-primary transition-colors">
            Build<span className="text-primary">Market</span> Pro
          </span>
        </Link>
      </div>

      {/* User Quick Info */}
      <div className="px-6 py-6">
        <div className="flex items-center gap-3 p-3 bg-white/10 rounded-xl border border-white/15">
          <div className="h-10 w-10 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-bold">
            {user?.firstName?.[0] ||
              user?.emailAddresses[0]?.emailAddress?.[0]?.toUpperCase() ||
              "P"}
            {user?.lastName?.[0] || ""}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium text-white truncate">
              {user?.fullName || user?.firstName || "Professional"}
            </p>
            {verified && (
              <div className="flex items-center gap-1">
                <BadgeCheck className="h-3 w-3 text-primary" />
                <p className="text-xs text-white/70">Verified Pro</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        <p className="px-2 text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
          Management
        </p>
        {professionalNavItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link key={item.key} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "text-white/70 hover:bg-white/10 hover:text-white",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {Icon && (
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      isActive
                        ? "text-white"
                        : "text-white/60 group-hover:text-white",
                    )}
                  />
                )}
                <span>{item.label}</span>
                {/*
                  Was `{item.badge && (...)}` — if badge is ever 0, React
                  renders the literal text "0" into the sidebar because 0
                  is falsy-but-renderable. Explicit numeric + >0 check
                  avoids that class of bug for any future zero-count badge.
                */}
                {typeof item.badge === "number" && item.badge > 0 && (
                  <span className="absolute right-2 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                    {item.badge}
                  </span>
                )}
              </div>
            </Link>
          );
        })}

        <div className="pt-8">
          <p className="px-2 text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
            Account
          </p>

          {/* Complete Profile CTA - shown when profile is incomplete */}
          {showCompletionPrompt && (
            <Link href="/professional-portal/settings/complete-profile">
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-1",
                  pathname === "/professional-portal/settings/complete-profile"
                    ? "bg-warning/20 text-warning border border-warning/30"
                    : "text-warning hover:bg-warning/10 border border-transparent",
                )}
              >
                <div className="relative">
                  <UserCircle className="h-4 w-4" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                </div>
                <span className="flex-1">Complete Profile</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-warning/20 text-warning">
                  {percentage}%
                </span>
              </div>
            </Link>
          )}

          <Link href="/professional-portal/settings">
            <div
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative",
                pathname === "/professional-portal/settings" ||
                  pathname.startsWith("/professional-portal/settings/")
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
              {/* Badge indicator if profile incomplete */}
              {showCompletionPrompt &&
                pathname !==
                  "/professional-portal/settings/complete-profile" && (
                  <span className="absolute right-2 w-2 h-2 bg-amber-500 rounded-full" />
                )}
            </div>
          </Link>
        </div>
      </nav>

      {/* Footer Actions */}
      <div className="p-4 border-t border-white/10">
        <button
          type="button"
          onClick={() => signOut()}
          className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-white/70 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
