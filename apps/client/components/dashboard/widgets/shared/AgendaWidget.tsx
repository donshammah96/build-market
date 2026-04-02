"use client";

import Link from "next/link";
import { CheckCircle2, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { dashboardKeys } from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";
import { calendarClient } from "@/lib/calendar-client";

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
    <div className="flex items-center gap-3 p-3 hover:bg-accent rounded-lg transition-colors cursor-pointer group">
      {checked ? (
        <div className="h-4 w-4 rounded-full bg-success/20 text-success flex items-center justify-center border border-success/40">
          <CheckCircle2 className="h-3 w-3" />
        </div>
      ) : (
        <div className="h-4 w-4 rounded-full border-2 border-border group-hover:border-muted-foreground" />
      )}
      <div className="flex-1">
        <p
          className={cn(
            "text-xs font-semibold",
            checked ? "text-muted-foreground line-through" : "text-foreground",
          )}
        >
          {title}
        </p>
        <p className="text-[10px] text-muted-foreground">{time}</p>
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

      const res = await calendarClient.getEvents({
        start: start.toISOString(),
        end: end.toISOString(),
      });

      if (!res.success) {
        throw new Error(res.error);
      }

      return (res.data ?? []).map((event) => ({
        id: event.id,
        title: event.title,
        startDate: event.startDate,
        status: event.status,
      }));
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
      <Card className={cn("border border-border shadow-sm bg-card", className)}>
        <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Agenda
          </CardTitle>
          <span className="text-xs font-medium text-muted-foreground">
            Today
          </span>
        </CardHeader>
        <CardContent className="px-2 pb-2">
          <div className="space-y-2 p-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 motion-safe:animate-pulse"
              >
                <div className="h-4 w-4 bg-muted rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-32 bg-muted rounded" />
                  <div className="h-2 w-16 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border border-border shadow-sm bg-card", className)}>
      <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Agenda
        </CardTitle>
        <span className="text-xs font-medium text-muted-foreground">Today</span>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <div className="space-y-1">
          {events.length === 0 ? (
            <div className="p-6 text-center">
              <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                No events scheduled for today.
              </p>
            </div>
          ) : (
            events.map((event: AgendaEvent) => (
              <AgendaItem
                key={event.id}
                time={new Date(event.startDate).toLocaleTimeString("en-KE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                title={event.title}
                checked={event.status === "COMPLETED"}
              />
            ))
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link href="/professional-portal/calendar">View Calendar</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default AgendaWidget;
