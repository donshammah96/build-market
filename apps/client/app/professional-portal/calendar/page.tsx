"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Plus,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  MoreHorizontal,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { useCalendarEvents } from "@/hooks/useCalendar";
import type { CalendarEventClientSummary } from "@/hooks/useCalendar";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CalendarSidebar = dynamic(() => import("./_components/CalendarSidebar"), {
  ssr: false,
  loading: () => <CalendarSidebarSkeleton />,
});

/**
 * CalendarPage Component
 *
 * Enterprise-level calendar interface with:
 * - Date selection and filtering
 * - Event management
 * - Responsive layout
 * - Error handling
 */
export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>();

  // Fetch calendar events
  const {
    data: apiEvents,
    isLoading,
    error: fetchError,
    refetch,
  } = useCalendarEvents();

  useEffect(() => {
    setDate(new Date());
  }, []);

  // Ensure events is always an array with Date objects
  const events = useMemo(() => {
    if (!apiEvents) return [];
    return apiEvents.map((evt) => ({
      ...evt,
      startDate: new Date(evt.startDate),
      endDate: new Date(evt.endDate),
    }));
  }, [apiEvents]);

  // Filter events based on selected date
  const selectedDateEvents = useMemo(() => {
    if (!date || events.length === 0) return [];
    return events.filter((event) => {
      const eventDate = new Date(event.startDate);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  }, [date, events]);

  // Calculate event statistics
  const eventStats = useMemo(() => {
    return {
      siteVisits: events.filter((e) => e.type === "SITE_VISIT").length,
      deadlines: events.filter((e) => e.type === "DEADLINE").length,
      meetings: events.filter((e) => e.type === "MEETING").length,
    };
  }, [events]);

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
      {/* --- Header --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
            Calendar
          </h1>
          <p className="text-zinc-500 mt-1 text-sm">
            Manage your schedule, appointments, and project deadlines.
          </p>
        </div>
        <Button className="bg-zinc-900 hover:bg-zinc-800 text-white shadow-md">
          <Plus className="mr-2 h-4 w-4" /> New Event
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* --- Calendar Widget --- */}
        <div className="lg:col-span-4 xl:col-span-3">
          <CalendarSidebar
            selectedDate={date}
            onSelectDate={setDate}
            eventStats={eventStats}
          />
        </div>

        {/* --- Events List --- */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900">
              {date
                ? date.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })
                : "Select a date"}
            </h2>
            <span className="text-sm text-zinc-500">
              {selectedDateEvents.length} events scheduled
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-32 bg-zinc-100 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : fetchError ? (
            <Card className="p-8">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-500 mb-4">
                  {fetchError instanceof Error
                    ? fetchError.message
                    : "Failed to load calendar events"}
                </p>
                <Button onClick={() => void refetch()}>Retry</Button>
              </div>
            </Card>
          ) : selectedDateEvents.length > 0 ? (
            <div className="space-y-4">
              {selectedDateEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 bg-zinc-50/50 rounded-xl border border-dashed border-zinc-200">
              <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
                <CalendarIcon className="h-6 w-6 text-zinc-400" />
              </div>
              <h3 className="font-semibold text-zinc-900">
                No events scheduled
              </h3>
              <p className="text-sm text-zinc-500 mt-1">
                You&apos;re free for the day!
              </p>
              <Button
                variant="outline"
                className="mt-4 border-zinc-200 text-zinc-900"
              >
                Schedule Event
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarSidebarSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="h-[320px] rounded-lg bg-zinc-100 animate-pulse" />
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="h-4 w-20 rounded bg-zinc-200 animate-pulse" />
        <div className="mt-4 space-y-3">
          <div className="h-4 rounded bg-zinc-100 animate-pulse" />
          <div className="h-4 rounded bg-zinc-100 animate-pulse" />
          <div className="h-4 rounded bg-zinc-100 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

type CalendarPageEvent = Omit<
  CalendarEventClientSummary,
  "startDate" | "endDate"
> & {
  startDate: Date;
  endDate: Date;
};

function EventCard({ event }: { event: CalendarPageEvent }) {
  // Format time range
  const formatTimeRange = useCallback(() => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    const startTime = start.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const endTime = end.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${startTime} - ${endTime}`;
  }, [event.startDate, event.endDate]);

  // Get client name
  const clientName = useMemo(() => {
    if (event.client) {
      return (
        `${event.client.firstName || ""} ${event.client.lastName || ""}`.trim() ||
        "Client"
      );
    }
    return null;
  }, [event.client]);

  // Get status badge color
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-emerald-100 text-emerald-700 hover:bg-emerald-200";
      case "CANCELLED":
        return "bg-red-100 text-red-700 hover:bg-red-200";
      case "SCHEDULED":
      default:
        return "bg-blue-100 text-blue-700 hover:bg-blue-200";
    }
  }, []);

  return (
    <Card className="border border-zinc-200 shadow-sm hover:shadow-md transition-all duration-300 bg-white group cursor-pointer">
      <Link href={`/professional-portal/calendar/${event.id}`}>
        <CardContent className="p-5 flex flex-col md:flex-row gap-6 items-start md:items-center">
          {/* Time & Status */}
          <div className="flex flex-col gap-2 min-w-[140px]">
            <div className="flex items-center text-zinc-900 font-medium">
              <Clock className="h-4 w-4 mr-2 text-zinc-400" />
              {formatTimeRange()}
            </div>
            <Badge className={`w-fit ${getStatusColor(event.status)} border-0`}>
              {event.status.replaceAll("_", " ")}
            </Badge>
          </div>

          {/* Event Details */}
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-zinc-900 text-lg">{event.title}</h3>
              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  onClick={(e) => e.preventDefault()}
                >
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="h-4 w-4 text-zinc-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/professional-portal/calendar/${event.id}`}>
                      View Details
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {event.location && (
              <div className="flex items-center text-sm text-zinc-500">
                <MapPin className="h-3.5 w-3.5 mr-1.5" />
                {event.location}
              </div>
            )}
            {clientName && (
              <div className="flex items-center gap-2 pt-2">
                <Avatar className="h-6 w-6 border border-zinc-200">
                  <AvatarFallback className="text-xs">
                    {clientName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-zinc-600">
                  with{" "}
                  <span className="font-medium text-zinc-900">
                    {clientName}
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* Action */}
          <div className="hidden md:flex">
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-zinc-900"
              asChild
            >
              <Link href={`/professional-portal/calendar/${event.id}`}>
                Details <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
