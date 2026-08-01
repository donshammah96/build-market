"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Filter, MapPin, MoreHorizontal, Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePortalProjects } from "@/hooks/useProjects";
import { useProfileStatus } from "@/hooks/useProfileStatus";
import { CapabilityRestrictedBanner } from "@/components/shared/CapabilityRestrictedBanner";
import { getProfessionalProjectUrl } from "@/lib/links";

interface Project {
  id: string;
  title: string | null;
  client?:
    | string
    | {
        firstName?: string | null;
        lastName?: string | null;
        avatar?: string | null;
      }
    | null;
  clientAvatar?: string | null;
  location?: string | null;
  budget?: string | number | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  agreedPrice?: number | null;
  spent?: string | null;
  status: string;
  progress?: number;
  dueDate?: string | null;
  endDate?: string | null;
  image?: string | null;
  tags?: string[];
}

function statusColor(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "completed") return "bg-emerald-500 hover:bg-emerald-600";
  if (normalized === "in_progress" || normalized === "in progress") {
    return "bg-blue-500 hover:bg-blue-600";
  }
  return "bg-zinc-500 hover:bg-zinc-600";
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function ProjectCard({ project }: { project: Project }) {
  const clientLabel =
    typeof project.client === "string"
      ? project.client
      : project.client
        ? `${project.client.firstName ?? ""} ${project.client.lastName ?? ""}`.trim()
        : "";

  const clientAvatar =
    project.clientAvatar ??
    (typeof project.client === "object" && project.client
      ? (project.client.avatar ?? undefined)
      : undefined);

  const dueDate = project.dueDate ?? project.endDate;
  const budget =
    project.budget ??
    project.agreedPrice ??
    project.budgetMin ??
    project.budgetMax;

  return (
    <Card className="flex h-full flex-col border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
      <CardHeader className="p-0">
        <div className="relative h-40 w-full overflow-hidden rounded-t-xl bg-zinc-100">
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-200 text-zinc-400">
            <MapPin className="h-8 w-8 opacity-20" />
          </div>
          <div className="absolute right-4 top-4">
            <Badge
              className={`${statusColor(project.status)} border-0 text-white shadow-sm`}
            >
              {statusLabel(project.status)}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="line-clamp-1 text-lg font-bold text-zinc-900">
              {project.title}
            </h3>
            {project.location && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                <MapPin className="h-3.5 w-3.5" />
                {project.location}
              </div>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-zinc-400 hover:text-zinc-900"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>View Details</DropdownMenuItem>
              <DropdownMenuItem>Edit Project</DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mb-6 flex-1 space-y-4">
          {clientLabel && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6 border border-zinc-100">
                  <AvatarImage src={clientAvatar} />
                  <AvatarFallback>CL</AvatarFallback>
                </Avatar>
                <span className="text-zinc-600">{clientLabel}</span>
              </div>
            </div>
          )}

          {typeof project.progress === "number" && project.progress > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Progress</span>
                <span className="font-medium text-zinc-900">
                  {project.progress}%
                </span>
              </div>
              <Progress
                value={project.progress}
                className="h-2 bg-zinc-100"
                indicatorClassName="bg-zinc-900"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 border-y border-zinc-50 py-4">
            {budget != null && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                  Budget
                </p>
                <p className="mt-0.5 text-sm font-semibold text-zinc-900">
                  {project.budget}
                </p>
              </div>
            )}
            {dueDate && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                  Due Date
                </p>
                <p className="mt-0.5 text-sm font-semibold text-zinc-900">
                  {dueDate}
                </p>
              </div>
            )}
          </div>
        </div>

        <Link href={getProfessionalProjectUrl(project.id)} className="w-full">
          <Button
            variant="outline"
            className="w-full border-zinc-200 text-zinc-900 hover:bg-zinc-50"
          >
            Manage Project
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function ProjectsPageClient() {
  const { profile } = useProfileStatus();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const isUnverified =
    profile &&
    (profile as unknown as { verified?: boolean }).verified === false;

  const { data: listPayload, isLoading, error, refetch } = usePortalProjects();

  const projects = useMemo(() => {
    const list =
      (listPayload as { items?: Project[] } | undefined)?.items ?? [];

    return list.filter((project) => {
      const matchesSearch =
        !searchQuery ||
        (project.title ?? "").toLowerCase().includes(searchQuery.toLowerCase());

      const status = project.status.toLowerCase();
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "active" &&
          !["completed", "archived"].includes(status)) ||
        (activeTab === "completed" && status === "completed");

      return matchesSearch && matchesTab;
    });
  }, [listPayload, searchQuery, activeTab]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 pb-10">
      {isUnverified && (
        <CapabilityRestrictedBanner
          featureName="Projects & Quotes"
          verificationStatus={
            (profile as unknown as { verificationStatus?: string })
              .verificationStatus
          }
        />
      )}

      <div className="flex flex-col justify-between gap-4 border-b border-zinc-100 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            Projects
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage your ongoing work, track progress, and view project history.
          </p>
        </div>
        <Button className="bg-zinc-900 text-white shadow-md hover:bg-zinc-800">
          <Plus className="mr-2 h-4 w-4" /> New Project
        </Button>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search projects..."
            className="border-zinc-200 pl-10 focus:ring-zinc-900"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>

        <div className="flex w-full gap-2 md:w-auto">
          <Button variant="outline" className="border-zinc-200 text-zinc-600">
            <Filter className="mr-2 h-4 w-4" /> Filter
          </Button>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-auto"
          >
            <TabsList className="bg-zinc-100">
              <TabsTrigger
                value="all"
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                All
              </TabsTrigger>
              <TabsTrigger
                value="active"
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Active
              </TabsTrigger>
              <TabsTrigger
                value="completed"
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Completed
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="border border-zinc-200">
              <div className="h-40 animate-pulse rounded-t-xl bg-zinc-100" />
              <CardContent className="space-y-4 p-6">
                <div className="h-5 w-2/3 animate-pulse rounded bg-zinc-100" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-100" />
                <div className="h-2 w-full animate-pulse rounded bg-zinc-100" />
                <div className="h-10 w-full animate-pulse rounded bg-zinc-100" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
          <p className="text-zinc-700">
            Failed to load projects. Please try again.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : projects.length === 0 ? (
        <div className="space-y-3 py-16 text-center">
          <p className="text-lg text-zinc-400">No projects found.</p>
          <Button className="bg-zinc-900 text-white hover:bg-zinc-800">
            <Plus className="mr-2 h-4 w-4" /> Create Your First Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
