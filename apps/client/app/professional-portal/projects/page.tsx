"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  MapPin,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { getProfessionalProjectUrl } from "@/lib/links";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { usePortalProjects } from "@/hooks/useProjects";

// ─── Project shape as returned by /api/professional-portal/projects ──────────

interface Project {
  id: string;
  title: string;
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
  spent?: string | null;
  status: string;
  progress?: number;
  dueDate?: string | null;
  endDate?: string | null;
  image?: string | null;
  tags?: string[];
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function statusColor(status: string) {
  const s = status.toLowerCase();
  if (s === "completed") return "bg-emerald-500 hover:bg-emerald-600";
  if (s === "in_progress" || s === "in progress")
    return "bg-blue-500 hover:bg-blue-600";
  return "bg-zinc-500 hover:bg-zinc-600";
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

// ─── ProjectCard ──────────────────────────────────────────────────────────────

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

  return (
    <Card className="border border-zinc-200 shadow-sm hover:shadow-md transition-all duration-300 bg-white group flex flex-col h-full">
      <CardHeader className="p-0">
        <div className="h-40 w-full bg-zinc-100 relative overflow-hidden rounded-t-xl">
          <div className="absolute inset-0 bg-zinc-200 flex items-center justify-center text-zinc-400">
            <MapPin className="h-8 w-8 opacity-20" />
          </div>
          <div className="absolute top-4 right-4">
            <Badge
              className={`${statusColor(project.status)} text-white border-0 shadow-sm`}
            >
              {statusLabel(project.status)}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-zinc-900 text-lg line-clamp-1">
              {project.title}
            </h3>
            {project.location && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-1">
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

        <div className="space-y-4 mb-6 flex-1">
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

          {typeof project.progress === "number" && (
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

          <div className="grid grid-cols-2 gap-4 py-4 border-t border-b border-zinc-50">
            {project.budget && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
                  Budget
                </p>
                <p className="text-sm font-semibold text-zinc-900 mt-0.5">
                  {project.budget}
                </p>
              </div>
            )}
            {dueDate && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
                  Due Date
                </p>
                <p className="text-sm font-semibold text-zinc-900 mt-0.5">
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const { data: rawProjects, isLoading, error } = usePortalProjects();

  const projects = useMemo(() => {
    const list = (rawProjects as Project[] | undefined) ?? [];
    return list.filter((p) => {
      const matchesSearch =
        !searchQuery ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab =
        activeTab === "all" ||
        (activeTab === "active" &&
          !["completed", "archived"].includes(p.status.toLowerCase())) ||
        (activeTab === "completed" && p.status.toLowerCase() === "completed");
      return matchesSearch && matchesTab;
    });
  }, [rawProjects, searchQuery, activeTab]);

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
            Projects
          </h1>
          <p className="text-zinc-500 mt-1 text-sm">
            Manage your ongoing work, track progress, and view project history.
          </p>
        </div>
        <Button className="bg-zinc-900 hover:bg-zinc-800 text-white shadow-md">
          <Plus className="mr-2 h-4 w-4" /> New Project
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Search projects..."
            className="pl-10 border-zinc-200 focus:ring-zinc-900"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
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

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-zinc-500">
          <p>Failed to load projects. Please refresh and try again.</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-zinc-400 text-lg">No projects found.</p>
          <Button className="bg-zinc-900 hover:bg-zinc-800 text-white">
            <Plus className="mr-2 h-4 w-4" /> Create Your First Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
