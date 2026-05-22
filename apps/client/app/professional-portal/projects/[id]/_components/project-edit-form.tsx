"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DollarSign, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/text-area";

const projectSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  budget: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) =>
      value === "" || value === undefined ? undefined : Number(value),
    )
    .refine((value) => value === undefined || value > 0, {
      message: "Budget must be positive",
    }),
  status: z.enum(["planning", "in_progress", "completed", "archived"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type ProjectFormValues = z.infer<typeof projectSchema>;
type ProjectFormInput = z.input<typeof projectSchema>;

interface ProjectEditFormProps {
  initialValues: ProjectFormValues;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (values: ProjectFormValues) => void;
}

export default function ProjectEditForm({
  initialValues,
  isSubmitting,
  onCancel,
  onSubmit,
}: ProjectEditFormProps) {
  const form = useForm<ProjectFormInput, unknown, ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    form.reset(initialValues);
  }, [initialValues, form]);

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <label className="text-sm font-medium">Title</label>
        <Input {...form.register("title")} />
        {form.formState.errors.title && (
          <p className="text-xs text-red-500">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <Textarea {...form.register("description")} className="min-h-[100px]" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Budget</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              type="number"
              {...form.register("budget")}
              className="pl-9"
            />
          </div>
          {form.formState.errors.budget && (
            <p className="text-xs text-red-500">
              {form.formState.errors.budget.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <Select
            onValueChange={(value) =>
              form.setValue("status", value as ProjectFormValues["status"])
            }
            defaultValue={initialValues.status}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="planning">Planning</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Start Date</label>
          <Input type="date" {...form.register("startDate")} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">End Date</label>
          <Input type="date" {...form.register("endDate")} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
}
