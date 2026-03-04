"use client";

import Link from "next/link";
import { Clock, Phone, ChevronRight, Users } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { LeadData } from "@/lib/dashboard";
import { WidgetEmptyState } from "../shared";

// ============================================================================
// TYPES
// ============================================================================

export interface LeadsWidgetProps {
  /** Leads data */
  leads?: LeadData[];
  /** Loading state */
  isLoading?: boolean;
  /** Count of new leads for badge */
  newLeadsCount?: number;
  /** Optional className */
  className?: string;
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface LeadItemProps {
  lead: LeadData;
}

function LeadItem({ lead }: LeadItemProps) {
  return (
    <div className="p-6 hover:bg-zinc-50/50 transition-colors group flex flex-col sm:flex-row gap-5 items-start sm:items-center">
      <Avatar className="h-12 w-12 border border-zinc-100 shadow-sm">
        <AvatarImage src={lead.avatar} />
        <AvatarFallback className="bg-zinc-100 text-zinc-500 font-medium">
          {lead.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-zinc-900">{lead.name}</h4>
          <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium flex items-center gap-1">
            <Clock className="h-3 w-3" /> {lead.receivedAt}
          </span>
        </div>
        <p className="text-sm text-zinc-600">
          {lead.project} <span className="text-zinc-300 mx-1">•</span>{" "}
          {lead.location}
        </p>
        <div className="flex items-center gap-3 pt-1">
          <span className="text-xs font-medium text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
            {lead.budget}
          </span>
          {lead.status === "new" && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 w-full sm:w-auto pt-2 sm:pt-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200">
        <Button
          size="sm"
          className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white h-9 shadow-sm"
        >
          Reply
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="border-zinc-200 text-zinc-600 hover:text-zinc-900 h-9 w-9"
        >
          <Phone className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// LOADING STATE
// ============================================================================

function LeadsWidgetSkeleton() {
  return (
    <Card className="border border-zinc-200 shadow-sm overflow-hidden bg-white">
      <CardHeader className="border-b border-zinc-100 py-5 px-6">
        <div className="flex items-center gap-2">
          <div className="h-5 w-32 bg-zinc-200 rounded animate-pulse" />
          <div className="h-5 w-12 bg-zinc-200 rounded-full animate-pulse" />
        </div>
      </CardHeader>
      <div className="divide-y divide-zinc-100">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-6 flex gap-5 items-center animate-pulse">
            <div className="h-12 w-12 bg-zinc-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-zinc-200 rounded" />
              <div className="h-3 w-48 bg-zinc-200 rounded" />
              <div className="h-5 w-20 bg-zinc-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function LeadsWidget({
  leads = [],
  isLoading = false,
  newLeadsCount,
  className,
}: LeadsWidgetProps) {
  if (isLoading) {
    return <LeadsWidgetSkeleton />;
  }

  const displayNewCount =
    newLeadsCount ?? leads.filter((l) => l.status === "new").length;

  return (
    <Card
      className={cn(
        "border border-zinc-200 shadow-sm overflow-hidden bg-white",
        className,
      )}
    >
      <CardHeader className="border-b border-zinc-100 py-5 px-6 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-bold text-zinc-900">
            Recent Inquiries
          </CardTitle>
          {displayNewCount > 0 && (
            <div className="h-5 px-2 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center">
              {displayNewCount} NEW
            </div>
          )}
        </div>
        <Link
          href="/professional-portal/leads"
          className="text-xs font-medium text-zinc-500 hover:text-zinc-900 flex items-center gap-1 group"
        >
          View Pipeline{" "}
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </CardHeader>

      {leads.length === 0 ? (
        <WidgetEmptyState
          icon={Users}
          title="No leads yet"
          description="New inquiries will appear here"
        />
      ) : (
        <div className="divide-y divide-zinc-100">
          {leads.slice(0, 5).map((lead) => (
            <LeadItem key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </Card>
  );
}

export default LeadsWidget;
