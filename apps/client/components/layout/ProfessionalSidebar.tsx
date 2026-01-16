"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  MessageSquare,
  Image as ImageIcon,
  DollarSign,
  Settings,
  LogOut,
  BadgeCheck,
  Store,
  UserCircle,
  AlertCircle,
} from "lucide-react";
import { useProfileCompletion } from "@/hooks/useProfileStatus";

const navItems = [
  {
    label: "Overview",
    href: "/professional-portal/dashboard",
    icon: LayoutDashboard,
  },
  { label: "Leads", href: "/professional-portal/leads", icon: Users, badge: 3 },
  { label: "Projects", href: "/professional-portal/projects", icon: Briefcase },
  {
    label: "Messages",
    href: "/professional-portal/messages",
    icon: MessageSquare,
  },
  {
    label: "Portfolio",
    href: "/professional-portal/portfolio",
    icon: ImageIcon,
  },
  { label: "Finance", href: "/professional-portal/finance", icon: DollarSign },
];

interface ProfessionalSidebarProps {
  verified?: boolean;
}

export function ProfessionalSidebar({
  verified = false,
}: ProfessionalSidebarProps) {
  const pathname = usePathname();
  const { user } = useUser();
  const { percentage, isComplete, isLoading } = useProfileCompletion();

  // Show completion prompt in sidebar
  const showCompletionPrompt = !isLoading && !isComplete && percentage < 100;

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-zinc-900 text-white hidden lg:flex flex-col border-r border-zinc-800">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-zinc-800">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="bg-emerald-600 p-1.5 rounded-lg">
            <Store className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white group-hover:text-emerald-400 transition-colors">
            Build<span className="text-emerald-500">Market</span> Pro
          </span>
        </Link>
      </div>

      {/* User Quick Info */}
      <div className="px-6 py-6">
        <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
          <div className="h-10 w-10 rounded-full bg-emerald-900/50 border border-emerald-500/30 flex items-center justify-center text-emerald-500 font-bold">
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
                <BadgeCheck className="h-3 w-3 text-emerald-500" />
                <p className="text-xs text-zinc-400">Verified Pro</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        <p className="px-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
          Management
        </p>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                  isActive
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4",
                    isActive
                      ? "text-white"
                      : "text-zinc-500 group-hover:text-white"
                  )}
                />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="absolute right-2 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                    {item.badge}
                  </span>
                )}
              </div>
            </Link>
          );
        })}

        <div className="pt-8">
          <p className="px-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Account
          </p>

          {/* Complete Profile CTA - shown when profile is incomplete */}
          {showCompletionPrompt && (
            <Link href="/professional-portal/settings/complete-profile">
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-1",
                  pathname === "/professional-portal/settings/complete-profile"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "text-amber-400 hover:bg-amber-500/10 border border-transparent"
                )}
              >
                <div className="relative">
                  <UserCircle className="h-4 w-4" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                </div>
                <span className="flex-1">Complete Profile</span>
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                    percentage < 50
                      ? "bg-orange-500/20 text-orange-400"
                      : "bg-amber-500/20 text-amber-400"
                  )}
                >
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
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
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
      <div className="p-4 border-t border-zinc-800">
        <button className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-400 hover:text-red-400 transition-colors">
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
