"use client";

import Link from "next/link";
import { CheckCircle2, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { API_ROUTES } from "@/lib/links";
import { dashboardKeys } from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface AgendaEvent {
  id: string;
  title: string;
  startDate: string;
  status: string;
}

export interface AgendaWidgetProps {
  /** Pre-loaded events data (optional - will fetch if not provided) */
  events?: AgendaEvent[];
  /** Loading state override */
  isLoading?: boolean;
  /** Optional className */
  className?: string;
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface AgendaItemProps {
  time: string;
  title: string;
  checked?: boolean;
}

function AgendaItem({ time, title, checked }: AgendaItemProps) {
  return (
    <div className="flex items-center gap-3 p-3 hover:bg-zinc-50 rounded-lg transition-colors cursor-pointer group">
      {checked ? (
        <div className="h-4 w-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center border border-emerald-200">
          <CheckCircle2 className="h-3 w-3" />
        </div>
      ) : (
        <div className="h-4 w-4 rounded-full border-2 border-zinc-300 group-hover:border-zinc-400" />
      )}
      <div className="flex-1">
        <p
          className={cn(
            "text-xs font-semibold",
            checked ? "text-zinc-400 line-through" : "text-zinc-900"
          )}
        >
          {title}
        </p>
        <p className="text-[10px] text-zinc-400">{time}</p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AgendaWidget({
  events: propEvents,
  isLoading: propIsLoading,
  className,
}: AgendaWidgetProps) {
  // Fetch events if not provided via props
  const { data: fetchedEvents, isLoading: fetchLoading } = useQuery({
    queryKey: dashboardKeys.agenda(),
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      const res = await fetch(
        API_ROUTES.professionalPortalCalendar +
          `?start=${start.toISOString()}&end=${end.toISOString()}`
      );
      if (!res.ok) throw new Error("Failed to fetch agenda");
      const json = await res.json();
      // API returns { success: true, data: { data: events[], pagination: {...} } }
      const eventsArray = Array.isArray(json.data?.data)
        ? json.data.data
        : Array.isArray(json.data)
          ? json.data
          : [];
      return eventsArray;
    },
    enabled: !propEvents, // Only fetch if events not provided
  });

  // Ensure events is always an array
  const events = Array.isArray(propEvents)
    ? propEvents
    : Array.isArray(fetchedEvents)
      ? fetchedEvents
      : [];
  const isLoading = propIsLoading !== undefined ? propIsLoading : fetchLoading;

  if (isLoading) {
    return (
      <Card
        className={cn("border border-zinc-200 shadow-sm bg-white", className)}
      >
        <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
            Agenda
          </CardTitle>
          <span className="text-xs font-medium text-zinc-500">Today</span>
        </CardHeader>
        <CardContent className="px-2 pb-2">
          <div className="space-y-2 p-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-4 w-4 bg-zinc-200 rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-32 bg-zinc-200 rounded" />
                  <div className="h-2 w-16 bg-zinc-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn("border border-zinc-200 shadow-sm bg-white", className)}
    >
      <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
          Agenda
        </CardTitle>
        <span className="text-xs font-medium text-zinc-500">Today</span>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <div className="space-y-1">
          {events.length === 0 ? (
            <div className="p-6 text-center">
              <Calendar className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">
                No events scheduled for today.
              </p>
            </div>
          ) : (
            events.map((event: AgendaEvent) => (
              <AgendaItem
                key={event.id}
                time={new Date(event.startDate).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                title={event.title}
                checked={event.status === "completed"}
              />
            ))
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-xs text-zinc-500 hover:text-zinc-900"
          asChild
        >
          <Link href="/professional-portal/calendar">View Calendar</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default AgendaWidget;
