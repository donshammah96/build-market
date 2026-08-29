"use client";

import {
  Users,
  Briefcase,
  Sparkles,
  ShieldCheck,
  MapPin,
  Clock,
  ArrowUpRight,
  Bell,
} from "lucide-react";

export function MockDashboard() {
  return (
    <div className="w-full h-full bg-zinc-950 p-4 sm:p-6 flex flex-col font-sans select-none overflow-hidden text-zinc-100">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-zinc-800/70">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-linear-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-bold text-white text-xs shadow-md shadow-emerald-950/40 shrink-0">
            KP
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs sm:text-sm text-zinc-100 truncate">
                Ndegwa & Partners
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                <ShieldCheck className="h-3 w-3" />
                NCA 1
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 truncate">
              Architecture & Structural Engineering
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/40 text-[11px] text-emerald-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Accepting Leads
          </div>
          <div className="relative p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400">
            <Bell className="h-3.5 w-3.5" />
            <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-4">
        <MetricCard
          icon={Briefcase}
          label="Pipeline Value"
          value="KES 34.2M"
          trend="+14.8%"
          trendType="positive"
          color="emerald"
        />
        <MetricCard
          icon={Users}
          label="Active Leads"
          value="18"
          trend="+5 new"
          trendType="positive"
          color="blue"
        />
        <MetricCard
          icon={Sparkles}
          label="Match Rating"
          value="99.2%"
          trend="Top 1%"
          trendType="neutral"
          color="purple"
        />
      </div>

      {/* Main List Area: Live Project Opportunities */}
      <div className="flex-1 min-h-0 bg-zinc-900/60 rounded-xl border border-zinc-800/80 p-3 sm:p-4 flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Live Client Opportunities
            </span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              High Intent
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 hidden sm:inline">
            Updated in real-time
          </span>
        </div>

        <div className="space-y-2.5 overflow-hidden">
          <LeadItem
            title="Karen Luxury Villa Renovation"
            category="Architectural Design & Supervision"
            budget="KES 18.5M"
            location="Karen, Nairobi"
            status="New Match"
            time="12m ago"
            color="emerald"
          />
          <LeadItem
            title="Westlands Commercial Fitout"
            category="Interior Architecture & MEP"
            budget="KES 8.2M"
            location="Westlands, Nairobi"
            status="Proposal Sent"
            time="2h ago"
            color="blue"
          />
          <LeadItem
            title="Kilimani Residential Structural Audit"
            category="Civil & Structural Certification"
            budget="KES 5.4M"
            location="Kilimani, Nairobi"
            status="Milestone Escrow"
            time="5h ago"
            color="amber"
          />
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  trend: string;
  trendType?: "positive" | "neutral";
  color: "emerald" | "blue" | "purple";
}

function MetricCard({
  icon: Icon,
  label,
  value,
  trend,
  trendType = "positive",
  color,
}: MetricCardProps) {
  const colorStyles = {
    emerald: {
      iconBg: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
      border: "border-zinc-800/80 hover:border-emerald-500/40",
      accent: "text-emerald-400",
    },
    blue: {
      iconBg: "bg-teal-500/15 text-teal-400 border border-teal-500/25",
      border: "border-zinc-800/80 hover:border-teal-500/40",
      accent: "text-teal-400",
    },
    purple: {
      iconBg: "bg-indigo-500/15 text-indigo-400 border border-indigo-500/25",
      border: "border-zinc-800/80 hover:border-indigo-500/40",
      accent: "text-indigo-400",
    },
  };

  const style = colorStyles[color];

  return (
    <div
      className={`bg-zinc-900/90 rounded-xl p-2.5 sm:p-3.5 border ${style.border} transition-colors flex flex-col justify-between`}
    >
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <div className={`p-1.5 rounded-lg ${style.iconBg} shrink-0`}>
          <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        </div>
        {trend && (
          <span
            className={`text-[10px] font-semibold flex items-center gap-0.5 ${
              trendType === "positive" ? "text-emerald-400" : "text-zinc-400"
            }`}
          >
            {trendType === "positive" && (
              <ArrowUpRight className="h-2.5 w-2.5" />
            )}
            {trend}
          </span>
        )}
      </div>
      <div>
        <div className="text-zinc-400 text-[10px] sm:text-[11px] font-medium tracking-tight truncate mb-0.5">
          {label}
        </div>
        <div className="text-zinc-100 font-bold text-xs sm:text-base tracking-tight truncate">
          {value}
        </div>
      </div>
    </div>
  );
}

interface LeadItemProps {
  title: string;
  category: string;
  budget: string;
  location: string;
  status: string;
  time: string;
  color: "emerald" | "blue" | "amber";
}

function LeadItem({
  title,
  category,
  budget,
  location,
  status,
  time,
  color,
}: LeadItemProps) {
  const statusStyles = {
    emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    blue: "bg-teal-500/15 text-teal-400 border-teal-500/30",
    amber: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  };

  return (
    <div className="p-2 sm:p-2.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800/80 border border-zinc-800/60 transition-colors flex items-center justify-between gap-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-xs text-zinc-100 truncate">
            {title}
          </span>
          <span className="text-[10px] font-bold text-emerald-400 shrink-0 hidden sm:inline">
            {budget}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-400 truncate">
          <span className="truncate">{category}</span>
          <span className="text-zinc-600">•</span>
          <span className="flex items-center gap-0.5 shrink-0">
            <MapPin className="h-2.5 w-2.5 text-zinc-500" />
            {location}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusStyles[color]}`}
        >
          {status}
        </span>
        <span className="text-[9px] text-zinc-500 flex items-center gap-0.5">
          <Clock className="h-2.5 w-2.5" />
          {time}
        </span>
      </div>
    </div>
  );
}
