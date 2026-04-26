"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useDeletePortalProject,
  usePortalProject,
  useUpdatePortalProject,
} from "@/hooks/useProjects";
import { ROUTES } from "@/lib/links";

import { ClientDate } from "./client-date";
import { ClientNumber } from "./client-number";
import type { ProjectFormValues } from "./project-edit-form";

const ProjectEditForm = dynamic(() => import("./project-edit-form"), {
  loading: () => (
    <div className="space-y-4">
      <div className="h-10 animate-pulse rounded bg-zinc-100" />
      <div className="h-24 animate-pulse rounded bg-zinc-100" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-10 animate-pulse rounded bg-zinc-100" />
        <div className="h-10 animate-pulse rounded bg-zinc-100" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-10 animate-pulse rounded bg-zinc-100" />
        <div className="h-10 animate-pulse rounded bg-zinc-100" />
      </div>
    </div>
  ),
});

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function statusBadgeClass(status: string) {
  if (status === "in_progress") return "bg-blue-100 text-blue-700";
  if (status === "completed") return "bg-emerald-100 text-emerald-700";
  return "bg-zinc-100 text-zinc-700";
}

function toDateInputValue(value: unknown): string {
  if (!value || typeof value !== "string") {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().split("T")[0] ?? "";
}

export default function ProjectDetailsPageClient() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const [isEditing, setIsEditing] = useState(false);

  const { data: project, isLoading, error } = usePortalProject(projectId);

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

  const projectItem = useMemo<Record<string, unknown> | null>(() => {
    const raw = project as { item?: unknown } | undefined;
    if (!raw) return null;
    const item = "item" in raw && raw.item ? raw.item : raw;
    return typeof item === "object" && !Array.isArray(item)
      ? (item as Record<string, unknown>)
      : null;
  }, [project]);

  const initialValues = useMemo<ProjectFormValues>(() => {
    const status = (projectItem?.status as string | undefined) ?? "planning";
    const budget =
      typeof projectItem?.budget === "number"
        ? projectItem.budget
        : typeof projectItem?.agreedPrice === "number"
          ? projectItem.agreedPrice
          : typeof projectItem?.budgetMin === "number"
            ? projectItem.budgetMin
            : typeof projectItem?.budgetMax === "number"
              ? projectItem.budgetMax
              : undefined;

    return {
      title: (projectItem?.title as string) ?? "",
      description: (projectItem?.description as string) ?? "",
      budget,
      status:
        status === "planning" ||
        status === "in_progress" ||
        status === "completed" ||
        status === "archived"
          ? status
          : "planning",
      startDate: toDateInputValue(projectItem?.startDate),
      endDate: toDateInputValue(projectItem?.endDate),
    };
  }, [projectItem]);

  const onSubmit = (values: ProjectFormValues) => {
    updateMutation.mutate({
      projectId,
      data: {
        ...values,
        startDate: values.startDate
          ? new Date(values.startDate).toISOString()
          : undefined,
        endDate: values.endDate
          ? new Date(values.endDate).toISOString()
          : undefined,
      } as Record<string, unknown>,
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error || !projectItem) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
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

  const client = projectItem.client as
    | Record<string, string | null | undefined>
    | undefined;

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          className="-ml-2 text-zinc-500 hover:text-zinc-900"
          onClick={() => router.push(ROUTES.professionalProjects)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
        </Button>

        {!isEditing && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
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
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <ProjectEditForm
                  initialValues={initialValues}
                  isSubmitting={updateMutation.isPending}
                  onCancel={() => setIsEditing(false)}
                  onSubmit={onSubmit}
                />
              ) : (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-900">
                      {(projectItem.title as string) ?? "Untitled"}
                    </h2>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge
                        className={`${statusBadgeClass(projectItem.status as string)} border-0`}
                      >
                        {statusLabel(projectItem.status as string)}
                      </Badge>
                    </div>
                  </div>

                  <div className="prose prose-sm max-w-none text-zinc-600">
                    <p>
                      {(projectItem.description as string | null | undefined) ||
                        "No description provided."}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-zinc-100 pt-4">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Budget
                      </span>
                      <p className="mt-1 text-lg font-medium text-zinc-900">
                        <ClientNumber
                          value={
                            (projectItem.budget as number | undefined) ??
                            (projectItem.agreedPrice as number | undefined) ??
                            (projectItem.budgetMin as number | undefined) ??
                            (projectItem.budgetMax as number | undefined)
                          }
                          prefix="$"
                          fallback="Not set"
                        />
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Timeline
                      </span>
                      <p className="mt-1 text-sm text-zinc-900">
                        <ClientDate
                          isoDate={projectItem.startDate as string | null}
                          fallback="TBD"
                        />{" "}
                        -{" "}
                        <ClientDate
                          isoDate={projectItem.endDate as string | null}
                          fallback="TBD"
                        />
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-3">
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
              <Button variant="outline" className="h-8 w-full text-xs">
                View Client Profile
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
