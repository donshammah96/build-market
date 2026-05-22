"use client";

import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type CalendarSidebarProps = {
  selectedDate?: Date;
  onSelectDate: (date: Date | undefined) => void;
  eventStats: {
    siteVisits: number;
    deadlines: number;
    meetings: number;
  };
};

export default function CalendarSidebar({
  selectedDate,
  onSelectDate,
  eventStats,
}: CalendarSidebarProps) {
  return (
    <>
      <Card className="border border-zinc-200 shadow-sm bg-white">
        <CardContent className="p-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={onSelectDate}
            className="rounded-md border-0 w-full"
            classNames={{
              day_selected:
                "bg-zinc-900 text-white hover:bg-zinc-800 focus:bg-zinc-900",
              day_today: "bg-zinc-100 text-zinc-900 font-bold",
            }}
          />
        </CardContent>
      </Card>

      <Card className="border border-zinc-200 shadow-sm bg-white mt-6">
        <CardHeader className="pb-3 pt-5 px-5">
          <CardTitle className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
            Upcoming
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-6 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-600">Site Visits</span>
            <Badge variant="secondary" className="bg-zinc-100 text-zinc-900">
              {eventStats.siteVisits}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-600">Deadlines</span>
            <Badge variant="secondary" className="bg-amber-50 text-amber-700">
              {eventStats.deadlines}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-600">Meetings</span>
            <Badge variant="secondary" className="bg-zinc-100 text-zinc-900">
              {eventStats.meetings}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
