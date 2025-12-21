"use client";

import { useState } from "react";
import { 
  Plus, 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  MoreHorizontal,
  ChevronRight
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Event type for calendar items
interface CalendarEvent {
  id: string;
  title: string;
  type: string;
  date: Date;
  time: string;
  location: string;
  client: string;
  clientAvatar: string;
  status: string;
  startDate?: Date;
  endDate?: Date;
}

// --- Mock Data ---
const EVENTS = [
  {
    id: "1",
    title: "Site Visit: Karen Villa",
    type: "Site Visit",
    date: new Date(2024, 9, 24), // Oct 24, 2024
    time: "09:00 AM - 11:00 AM",
    location: "Karen, Nairobi",
    client: "Michael Kamau",
    clientAvatar: "https://i.pravatar.cc/150?u=1",
    status: "Confirmed"
  },
  {
    id: "2",
    title: "Client Meeting: Tech Solutions",
    type: "Meeting",
    date: new Date(2024, 9, 24), // Oct 24, 2024
    time: "02:00 PM - 03:30 PM",
    location: "Westlands, Nairobi",
    client: "Sarah Jenkins",
    clientAvatar: "https://i.pravatar.cc/150?u=2",
    status: "Pending"
  },
  {
    id: "3",
    title: "Project Deadline: Apartment Design",
    type: "Deadline",
    date: new Date(2024, 9, 25), // Oct 25, 2024
    time: "05:00 PM",
    location: "Remote",
    client: "John Doe",
    clientAvatar: "https://i.pravatar.cc/150?u=3",
    status: "Upcoming"
  },
  {
    id: "4",
    title: "Material Selection",
    type: "Task",
    date: new Date(2024, 9, 26), // Oct 26, 2024
    time: "10:00 AM",
    location: "Showroom",
    client: "Jane Smith",
    clientAvatar: "https://i.pravatar.cc/150?u=4",
    status: "Confirmed"
  }
];

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  const { data: apiEvents, isLoading } = useQuery({
    queryKey: ["professional-calendar"],
    queryFn: async () => {
      // In a real app, we would pass start/end dates based on the current view
      const response = await fetch("/api/professional-portal/calendar");
      if (!response.ok) throw new Error("Failed to fetch events");
      const result = await response.json();
      // Convert string dates back to Date objects
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return result.data.map((event: any) => ({
        ...event,
        date: new Date(event.startDate), // Map startDate to date for frontend compatibility
        startDate: new Date(event.startDate),
        endDate: new Date(event.endDate)
      })) as CalendarEvent[];
    },
  });

  // Use API data if available and not empty, otherwise fallback to mock data
  const events = (apiEvents && apiEvents.length > 0) ? apiEvents : EVENTS;

  // Filter events based on selected date
  const selectedDateEvents = events.filter((event: CalendarEvent) => 
    date && 
    event.date.getDate() === date.getDate() && 
    event.date.getMonth() === date.getMonth() && 
    event.date.getFullYear() === date.getFullYear()
  );

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
      
      {/* --- Header --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Calendar</h1>
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
          <Card className="border border-zinc-200 shadow-sm bg-white">
            <CardContent className="p-4">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                className="rounded-md border-0 w-full"
                classNames={{
                  day_selected: "bg-zinc-900 text-white hover:bg-zinc-800 focus:bg-zinc-900",
                  day_today: "bg-zinc-100 text-zinc-900 font-bold",
                }}
              />
            </CardContent>
          </Card>

          {/* Upcoming Summary */}
          <Card className="border border-zinc-200 shadow-sm bg-white mt-6">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Upcoming</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-6 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600">Site Visits</span>
                <Badge variant="secondary" className="bg-zinc-100 text-zinc-900">
                  {events.filter((e: CalendarEvent) => e.type === 'Site Visit').length}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600">Deadlines</span>
                <Badge variant="secondary" className="bg-amber-50 text-amber-700">
                  {events.filter((e: CalendarEvent) => e.type === 'Deadline').length}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600">Meetings</span>
                <Badge variant="secondary" className="bg-zinc-100 text-zinc-900">
                  {events.filter((e: CalendarEvent) => e.type === 'Meeting').length}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --- Events List --- */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900">
              {date ? date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Select a date'}
            </h2>
            <span className="text-sm text-zinc-500">
              {selectedDateEvents.length} events scheduled
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-zinc-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : selectedDateEvents.length > 0 ? (
            <div className="space-y-4">
              {selectedDateEvents.map((event: CalendarEvent) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 bg-zinc-50/50 rounded-xl border border-dashed border-zinc-200">
              <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
                <CalendarIcon className="h-6 w-6 text-zinc-400" />
              </div>
              <h3 className="font-semibold text-zinc-900">No events scheduled</h3>
              <p className="text-sm text-zinc-500 mt-1">You&apos;re free for the day!</p>
              <Button variant="outline" className="mt-4 border-zinc-200 text-zinc-900">
                Schedule Event
              </Button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function EventCard({ event }: { event: CalendarEvent }) {
  return (
    <Card className="border border-zinc-200 shadow-sm hover:shadow-md transition-all duration-300 bg-white group">
      <CardContent className="p-5 flex flex-col md:flex-row gap-6 items-start md:items-center">
        
        {/* Time & Status */}
        <div className="flex flex-col gap-2 min-w-[140px]">
          <div className="flex items-center text-zinc-900 font-medium">
            <Clock className="h-4 w-4 mr-2 text-zinc-400" />
            {event.time}
          </div>
          <Badge className={`w-fit
            ${event.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 
              event.status === 'Pending' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 
              'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'} border-0
          `}>
            {event.status}
          </Badge>
        </div>

        {/* Event Details */}
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-zinc-900 text-lg">{event.title}</h3>
            <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="h-4 w-4 text-zinc-400" />
            </Button>
          </div>
          <div className="flex items-center text-sm text-zinc-500">
            <MapPin className="h-3.5 w-3.5 mr-1.5" />
            {event.location}
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Avatar className="h-6 w-6 border border-zinc-200">
              <AvatarImage src={event.clientAvatar} />
              <AvatarFallback>{event.client.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-zinc-600">with <span className="font-medium text-zinc-900">{event.client}</span></span>
          </div>
        </div>

        {/* Action */}
        <div className="hidden md:flex">
          <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-900">
            Details <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}
