"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Loader2,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle,
  XCircle,
  User,
  Building2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogClose } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/text-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Calendar Event interface matching API response
interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  startDate: string | Date;
  endDate: string | Date;
  location?: string | null;
  type: string;
  status: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  clientId?: string | null;
  projectId?: string | null;
  client?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
  project?: {
    id: string;
    title: string;
    status?: string | null;
  } | null;
}

// Schema for updating calendar event
const updateEventSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  location: z.string().optional(),
  type: z.string().min(1, "Event type is required"),
  status: z.enum(["scheduled", "completed", "cancelled"]),
});

type UpdateEventFormValues = z.infer<typeof updateEventSchema>;

const statusConfig: Record<
  string,
  { color: string; icon: React.ReactNode; label: string }
> = {
  scheduled: {
    color: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <Clock className="h-4 w-4" />,
    label: "Scheduled",
  },
  completed: {
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <CheckCircle className="h-4 w-4" />,
    label: "Completed",
  },
  cancelled: {
    color: "bg-red-50 text-red-700 border-red-200",
    icon: <XCircle className="h-4 w-4" />,
    label: "Cancelled",
  },
};

const typeConfig: Record<string, { color: string; label: string }> = {
  meeting: {
    color: "bg-purple-50 text-purple-700 border-purple-200",
    label: "Meeting",
  },
  site_visit: {
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    label: "Site Visit",
  },
  deadline: {
    color: "bg-amber-50 text-amber-700 border-amber-200",
    label: "Deadline",
  },
  task: {
    color: "bg-blue-50 text-blue-700 border-blue-200",
    label: "Task",
  },
};

export default function CalendarEventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Fetch Calendar Event
  const {
    data: event,
    isLoading,
    error,
  } = useQuery<CalendarEvent>({
    queryKey: ["calendar-event", id],
    queryFn: async () => {
      const res = await fetch(`/api/professional-portal/calendar/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Event not found");
        }
        throw new Error("Failed to fetch event");
      }
      return res.json();
    },
    enabled: !!id,
    retry: 2,
    staleTime: 30000,
  });

  // Update Event Mutation
  const updateEventMutation = useMutation({
    mutationFn: async (data: UpdateEventFormValues) => {
      const res = await fetch(`/api/professional-portal/calendar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          startDate: new Date(data.startDate).toISOString(),
          endDate: new Date(data.endDate).toISOString(),
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update event");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-event", id] });
      queryClient.invalidateQueries({ queryKey: ["professional-calendar"] });
      setIsEditOpen(false);
      toast.success("Event updated successfully");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update event"
      );
    },
  });

  // Delete Event Mutation
  const deleteEventMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/professional-portal/calendar/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete event");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professional-calendar"] });
      toast.success("Event deleted successfully");
      router.push("/professional-portal/calendar");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete event"
      );
    },
  });

  const form = useForm<UpdateEventFormValues>({
    resolver: zodResolver(updateEventSchema),
    defaultValues: {
      title: event?.title || "",
      description: event?.description || "",
      startDate: event?.startDate
        ? new Date(event.startDate).toISOString().slice(0, 16)
        : "",
      endDate: event?.endDate
        ? new Date(event.endDate).toISOString().slice(0, 16)
        : "",
      location: event?.location || "",
      type: event?.type || "meeting",
      status:
        (event?.status as "scheduled" | "completed" | "cancelled") ||
        "scheduled",
    },
  });

  // Update form when event data loads
  if (event && form.getValues().title === "") {
    form.reset({
      title: event.title,
      description: event.description || "",
      startDate: new Date(event.startDate).toISOString().slice(0, 16),
      endDate: new Date(event.endDate).toISOString().slice(0, 16),
      location: event.location || "",
      type: event.type,
      status:
        (event.status as "scheduled" | "completed" | "cancelled") ||
        "scheduled",
    });
  }

  function onSubmit(data: UpdateEventFormValues) {
    updateEventMutation.mutate(data);
  }

  const handleDelete = () => {
    deleteEventMutation.mutate();
  };

  // Calculate duration
  const duration = useMemo(() => {
    if (!event?.startDate || !event?.endDate) return null;
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes > 0 ? `${diffMinutes}m` : ""}`.trim();
    }
    return `${diffMinutes}m`;
  }, [event?.startDate, event?.endDate]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-zinc-200 animate-pulse rounded" />
          <div className="space-y-2">
            <div className="h-8 w-64 bg-zinc-200 animate-pulse rounded" />
            <div className="h-4 w-32 bg-zinc-200 animate-pulse rounded" />
          </div>
        </div>
        <Card className="p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            <span className="ml-3 text-zinc-500">Loading event...</span>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <Button variant="ghost" asChild>
          <Link href="/professional-portal/calendar">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Calendar
          </Link>
        </Button>
        <Card className="p-8">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">
              Event Not Found
            </h2>
            <p className="text-zinc-500 mb-4">
              {error instanceof Error
                ? error.message
                : "The event you're looking for doesn't exist."}
            </p>
            <Button asChild>
              <Link href="/professional-portal/calendar">Back to Calendar</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const status = (statusConfig[event.status] ?? statusConfig.scheduled) as {
    color: string;
    icon: React.ReactNode;
    label: string;
  };

  const type = (typeConfig[event.type] ?? typeConfig.meeting) as {
    color: string;
    label: string;
  };

  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);
  const clientName = event.client
    ? `${event.client.firstName || ""} ${event.client.lastName || ""}`.trim() ||
      "Unknown Client"
    : null;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start border-b border-zinc-100 pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/professional-portal/calendar">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
                {event.title}
              </h1>
              <Badge
                variant="outline"
                className={`${status.color} flex items-center gap-1`}
              >
                {status.icon}
                {status.label}
              </Badge>
              <Badge variant="outline" className={`${type.color}`}>
                {type.label}
              </Badge>
            </div>
            <p className="text-zinc-500 mt-1">
              Event #{event.id.substring(0, 8).toUpperCase()} • Created{" "}
              {new Date(event.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsEditOpen(true)}
            className="border-zinc-200"
          >
            <Edit className="mr-2 h-4 w-4" /> Edit Event
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsDeleteOpen(true)}
            disabled={deleteEventMutation.isPending}
            className="border-red-200 text-red-600 hover:bg-red-50"
          >
            {deleteEventMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Event Details */}
          <Card className="border border-zinc-200 shadow-sm bg-white">
            <div className="p-6 border-b border-zinc-100">
              <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Event Information
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-zinc-500 mb-2 block flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Start Date & Time
                  </label>
                  <p className="text-zinc-900 font-medium">
                    {startDate.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {startDate.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-500 mb-2 block flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    End Date & Time
                  </label>
                  <p className="text-zinc-900 font-medium">
                    {endDate.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {endDate.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              {duration && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-zinc-500 mb-2 block">
                      Duration
                    </label>
                    <p className="text-zinc-900 font-medium">{duration}</p>
                  </div>
                </>
              )}

              {event.location && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-zinc-500 mb-2 block flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Location
                    </label>
                    <p className="text-zinc-900">{event.location}</p>
                  </div>
                </>
              )}

              {event.description && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-zinc-500 mb-2 block">
                      Description
                    </label>
                    <p className="text-zinc-900 whitespace-pre-wrap">
                      {event.description}
                    </p>
                  </div>
                </>
              )}

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-zinc-500 mb-2 block flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    Created
                  </label>
                  <p className="text-zinc-900">
                    {new Date(event.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-500 mb-2 block flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    Last Updated
                  </label>
                  <p className="text-zinc-900">
                    {new Date(event.updatedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Client Information */}
          {event.client && (
            <Card className="border border-zinc-200 shadow-sm bg-white">
              <div className="p-6 border-b border-zinc-100">
                <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Client
                </h2>
              </div>
              <div className="p-6 space-y-3">
                <p className="font-semibold text-zinc-900">{clientName}</p>
                {event.client.email && (
                  <a
                    href={`mailto:${event.client.email}`}
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {event.client.email}
                  </a>
                )}
              </div>
            </Card>
          )}

          {/* Related Project */}
          {event.project && (
            <Card className="border border-zinc-200 shadow-sm bg-white">
              <div className="p-6 border-b border-zinc-100">
                <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Related Project
                </h2>
              </div>
              <div className="p-6">
                <p className="font-semibold text-zinc-900 mb-2">
                  {event.project.title}
                </p>
                {event.project.status && (
                  <Badge variant="outline" className="mb-3">
                    {event.project.status}
                  </Badge>
                )}
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link
                    href={`/professional-portal/projects/${event.project.id}`}
                  >
                    View Project
                    <ExternalLink className="ml-2 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </Card>
          )}

          {/* Status Timeline */}
          <Card className="border border-zinc-200 shadow-sm bg-white">
            <div className="p-6 border-b border-zinc-100">
              <h2 className="text-lg font-semibold text-zinc-900">Status</h2>
            </div>
            <div className="p-6">
              <div className="space-y-2">
                {Object.entries(statusConfig).map(([key, config]) => (
                  <div
                    key={key}
                    className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                      event.status === key
                        ? "bg-zinc-100 ring-2 ring-zinc-300"
                        : "opacity-50"
                    }`}
                  >
                    {config.icon}
                    <span
                      className={
                        event.status === key ? "font-medium text-zinc-900" : ""
                      }
                    >
                      {config.label}
                    </span>
                    {event.status === key && (
                      <CheckCircle className="h-4 w-4 text-emerald-500 ml-auto" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>
              Update the event details. All changes will be saved immediately.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Site Visit: Karen Villa"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="meeting">Meeting</SelectItem>
                          <SelectItem value="site_visit">Site Visit</SelectItem>
                          <SelectItem value="deadline">Deadline</SelectItem>
                          <SelectItem value="task">Task</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date & Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date & Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Karen, Nairobi" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add event details..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={updateEventMutation.isPending}>
                  {updateEventMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{event.title}&rdquo;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteEventMutation.isPending}
            >
              {deleteEventMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
