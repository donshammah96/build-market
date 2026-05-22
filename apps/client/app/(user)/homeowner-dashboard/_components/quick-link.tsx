"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export function QuickLink({
  icon,
  label,
  href,
  count,
  badgeColor = "bg-zinc-100 text-zinc-600",
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  count?: string;
  badgeColor?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between p-3 rounded-lg hover:bg-zinc-50 transition-colors group"
    >
      <div className="flex items-center gap-3 text-zinc-600 group-hover:text-emerald-700">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      {count && (
        <span
          className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full",
            badgeColor,
          )}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
