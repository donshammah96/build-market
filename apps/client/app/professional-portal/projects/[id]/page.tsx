"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, DollarSign, Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/text-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { ROUTES } from "@/lib/links";

import {
  usePortalProject,
  useUpdatePortalProject,
  useDeletePortalProject,
} from "@/hooks/useProjects";

// ─── Local form schema (no Prisma, no server imports) ────────────────────────

const projectSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  budget: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) =>
      val === "" || val === undefined ? undefined : Number(val),
    )
    .refine((val) => val === undefined || val > 0, {
      message: "Budget must be positive",
    }),
  status: z.enum(["planning", "in_progress", "completed", "archived"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;
type ProjectFormInput = z.input<typeof projectSchema>;
// ─── Status badge helper ─────────────────────────────────────────────────────

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function statusBadgeClass(status: string) {
  if (status === "in_progress") return "bg-blue-100 text-blue-700";
  if (status === "completed") return "bg-emerald-100 text-emerald-700";
  return "bg-zinc-100 text-zinc-700";
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const [isEditing, setIsEditing] = useState(false);

  const { data: project, isLoading, error } = usePortalProject(projectId);
  const form = useForm<ProjectFormInput, unknown, ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      title: "",
      description: "",
      budget: undefined,
      status: "planning",
      startDate: "",
      endDate: "",
    },
  });

  // Sync form when project data arrives
  useEffect(() => {
    if (project) {
      const p = project as Record<string, unknown>;
      form.reset({
        title: (p.title as string) ?? "",
        description: (p.description as string) ?? "",
        budget: (p.budget as number | undefined) ?? undefined,
        status: (p.status as ProjectFormValues["status"]) ?? "planning",
        startDate: p.startDate
          ? new Date(p.startDate as string).toISOString().split("T")[0]
          : "",
        endDate: p.endDate
          ? new Date(p.endDate as string).toISOString().split("T")[0]
          : "",
      });
    }
  }, [project, form]);

  const updateMutation = useUpdatePortalProject({
    onSuccess: () => {
      setIsEditing(false);
      toast.success("Project updated successfully");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useDeletePortalProject({
    onSuccess: () => {
      toast.success("Project deleted successfully");
      router.push(ROUTES.professionalProjects);
    },
    onError: (err) => toast.error(err.message),
  });

  const onSubmit = (data: ProjectFormValues) => {
    updateMutation.mutate({
      projectId,
      data: {
        ...data,
        startDate: data.startDate
          ? new Date(data.startDate).toISOString()
          : undefined,
        endDate: data.endDate
          ? new Date(data.endDate).toISOString()
          : undefined,
      } as Record<string, unknown>,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <h2 className="text-xl font-semibold text-zinc-900">
          Project not found
        </h2>
        <Button
          variant="outline"
          onClick={() => router.push(ROUTES.professionalProjects)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
        </Button>
      </div>
    );
  }

  const p = project as Record<string, unknown>;
  const client = p.client as
    | Record<string, string | null | undefined>
    | undefined;

  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          className="text-zinc-500 hover:text-zinc-900 -ml-2"
          onClick={() => router.push(ROUTES.professionalProjects)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
        </Button>

        <div className="flex gap-2">
          {!isEditing ? (
            <>
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                onClick={() => {
                  if (
                    confirm(
                      "Are you sure you want to delete this project? This action cannot be undone.",
                    )
                  ) {
                    deleteMutation.mutate({ projectId });
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Delete
              </Button>
              <Button onClick={() => setIsEditing(true)}>Manage Project</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button
                onClick={form.handleSubmit(onSubmit)}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left: Project Details */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <form className="space-y-4">
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
                    <Textarea
                      {...form.register("description")}
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Budget</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                          type="number"
                          {...form.register("budget")}
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Status</label>
                      <Select
                        onValueChange={(value) =>
                          form.setValue(
                            "status",
                            value as ProjectFormValues["status"],
                          )
                        }
                        defaultValue={p.status as string}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planning">Planning</SelectItem>
                          <SelectItem value="in_progress">
                            In Progress
                          </SelectItem>
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
                </form>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-900">
                      {p.title as string}
                    </h2>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        className={`${statusBadgeClass(p.status as string)} border-0`}
                      >
                        {statusLabel(p.status as string)}
                      </Badge>
                    </div>
                  </div>

                  <div className="prose prose-sm max-w-none text-zinc-600">
                    <p>
                      {(p.description as string | null | undefined) ||
                        "No description provided."}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-100">
                    <div>
                      <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                        Budget
                      </span>
                      <p className="text-lg font-medium text-zinc-900 mt-1">
                        {p.budget
                          ? `$${(p.budget as number).toLocaleString()}`
                          : "Not set"}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                        Timeline
                      </span>
                      <p className="text-sm text-zinc-900 mt-1">
                        {p.startDate
                          ? new Date(p.startDate as string).toLocaleDateString()
                          : "TBD"}{" "}
                        &mdash;{" "}
                        {p.endDate
                          ? new Date(p.endDate as string).toLocaleDateString()
                          : "TBD"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Client Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={client?.avatar ?? undefined} />
                  <AvatarFallback>
                    {client?.firstName?.charAt(0) ?? "C"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-zinc-900">
                    {client?.firstName} {client?.lastName}
                  </p>
                  <p className="text-xs text-zinc-500">{client?.email}</p>
                </div>
              </div>
              <Button variant="outline" className="w-full text-xs h-8">
                View Client Profile
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
