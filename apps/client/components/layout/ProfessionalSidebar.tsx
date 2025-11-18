"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/app/lib/utils";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Calendar,
  Star,
  MessageSquare,
  Award,
  Settings,
  Home,
} from "lucide-react";

const navigationItems = [
  {
    title: "Dashboard",
    href: "/professional-portal/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Leads",
    href: "/leads",
    icon: Users,
  },
  {
    title: "Projects",
    href: "/projects",
    icon: Briefcase,
  },
  {
    title: "Calendar",
    href: "/calendar",
    icon: Calendar,
  },
  {
    title: "Portfolio",
    href: "/portfolio",
    icon: Award,
  },
  {
    title: "Reviews",
    href: "/reviews",
    icon: Star,
  },
  {
    title: "Messages",
    href: "/messages",
    icon: MessageSquare,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
  {
    title: "Back to Marketplace",
    href: "/",
    icon: Home,
    divider: true,
  },
];

export function ProfessionalSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:z-50 lg:border-r lg:bg-white lg:shadow-sm">
      <div className="flex flex-col flex-1 pt-24 pb-4 overflow-y-auto">
        <div className="px-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Professional Portal</h2>
          <p className="text-sm text-gray-500 mt-1">Manage your business</p>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <div key={item.href}>
                {item.divider && <div className="my-4 border-t" />}
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-blue-50 text-blue-700 shadow-sm"
                      : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <item.icon
                    className={cn(
                      "mr-3 h-5 w-5 flex-shrink-0 transition-colors",
                      isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
                    )}
                  />
                  {item.title}
                </Link>
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

