"use client";

import { useEffect } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type {
  CalendarEventClientDetail,
  UpdateCalendarEventInput,
} from "@/app/lib/domains/calendar/contracts";
import {
  CalendarEventStatusSchema,
  CalendarEventTypeSchema,
} from "@/app/lib/validation/calendar-validation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/text-area";
import { Loader2 } from "lucide-react";

const updateEventSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  location: z.string().optional(),
  type: CalendarEventTypeSchema,
  status: CalendarEventStatusSchema,
});

type UpdateEventFormValues = z.infer<typeof updateEventSchema>;

const EVENT_TYPE_OPTIONS: UpdateEventFormValues["type"][] = [
  "MEETING",
  "SITE_VISIT",
  "DEADLINE",
  "PAYMENT_DUE",
  "MATERIAL_DELIVERY",
  "INSPECTION_NCA",
  "INSPECTION_INTERNAL",
];

const EVENT_STATUS_OPTIONS: UpdateEventFormValues["status"][] = [
  "SCHEDULED",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "RESCHEDULED",
  "NO_SHOW",
];

type CalendarEventEditDialogProps = {
  event: CalendarEventClientDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onSubmit: (payload: UpdateCalendarEventInput) => void;
};

function toDateTimeLocal(value: string) {
  return new Date(value).toISOString().slice(0, 16);
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export default function CalendarEventEditDialog({
  event,
  open,
  onOpenChange,
  isPending,
  onSubmit,
}: CalendarEventEditDialogProps) {
  const form = useForm<UpdateEventFormValues>({
    resolver: zodResolver(updateEventSchema) as Resolver<UpdateEventFormValues>,
    defaultValues: {
      title: event.title,
      description: event.description ?? "",
      startDate: toDateTimeLocal(event.startDate),
      endDate: toDateTimeLocal(event.endDate),
      location: event.location ?? "",
      type: event.type,
      status: event.status,
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      title: event.title,
      description: event.description ?? "",
      startDate: toDateTimeLocal(event.startDate),
      endDate: toDateTimeLocal(event.endDate),
      location: event.location ?? "",
      type: event.type,
      status: event.status,
    });
  }, [event, form, open]);

  function handleSubmit(data: UpdateEventFormValues) {
    onSubmit({
      title: data.title,
      description: data.description,
      startDate: new Date(data.startDate).toISOString(),
      endDate: new Date(data.endDate).toISOString(),
      location: data.location,
      type: data.type,
      status: data.status,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
          <DialogDescription>
            Update the event details. All changes will be saved immediately.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
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
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EVENT_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {formatEnumLabel(option)}
                          </SelectItem>
                        ))}
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
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EVENT_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {formatEnumLabel(option)}
                          </SelectItem>
                        ))}
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
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
