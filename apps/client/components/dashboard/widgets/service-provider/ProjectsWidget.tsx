"use client";

import Link from "next/link";
import { Clock, ChevronRight, Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProjectData } from "@/lib/dashboard";

// ============================================================================
// TYPES
// ============================================================================

export interface ProjectsWidgetProps {
  /** Projects data */
  projects?: ProjectData[];
  /** Loading state */
  isLoading?: boolean;
  /** Optional className */
  className?: string;
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface ProjectCardProps {
  project: ProjectData;
}

function ProjectCard({ project }: ProjectCardProps) {
  const isAlert =
    project.status === "attention" || project.status === "delayed";

  return (
    <Card className="border border-zinc-200 shadow-sm bg-white">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h4 className="font-bold text-zinc-900 text-sm">{project.title}</h4>
            <p className="text-xs text-zinc-500 mt-0.5">{project.client}</p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "font-medium border-0 px-2 py-0.5 capitalize",
              isAlert
                ? "bg-amber-50 text-amber-700"
                : "bg-zinc-100 text-zinc-600",
            )}
          >
            {project.status.replace("_", " ")}
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Progress</span>
            <span className="font-medium text-zinc-900">
              {project.progress}%
            </span>
          </div>
          <Progress
            value={project.progress}
            className="h-1.5 bg-zinc-100"
            indicatorClassName={isAlert ? "bg-amber-500" : "bg-zinc-900"}
          />
        </div>

        <div className="mt-4 pt-4 border-t border-zinc-50 flex items-center justify-between text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-zinc-400" />
            Due {project.dueDate}
          </span>
          <Link
            href={`/professional-portal/projects/${project.id}`}
            className="text-zinc-900 font-medium hover:underline"
          >
            Manage
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// LOADING STATE
// ============================================================================

function ProjectsWidgetSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-5 w-32 bg-zinc-200 rounded animate-pulse" />
        <div className="h-4 w-24 bg-zinc-200 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <Card key={i} className="border border-zinc-200 shadow-sm bg-white">
            <CardContent className="p-6 animate-pulse">
              <div className="flex justify-between mb-4">
                <div className="space-y-2">
                  <div className="h-4 w-40 bg-zinc-200 rounded" />
                  <div className="h-3 w-24 bg-zinc-200 rounded" />
                </div>
                <div className="h-5 w-16 bg-zinc-200 rounded" />
              </div>
              <div className="space-y-2">
                <div className="h-2 w-full bg-zinc-200 rounded" />
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-50 flex justify-between">
                <div className="h-3 w-20 bg-zinc-200 rounded" />
                <div className="h-3 w-16 bg-zinc-200 rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ProjectsWidget({
  projects = [],
  isLoading = false,
  className,
}: ProjectsWidgetProps) {
  if (isLoading) {
    return <ProjectsWidgetSkeleton />;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-zinc-900">Active Projects</h3>
        <Link
          href="/professional-portal/projects"
          className="text-xs font-medium text-zinc-500 hover:text-zinc-900 flex items-center gap-1 group"
        >
          View All{" "}
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card className="border border-zinc-200 shadow-sm bg-white">
          <CardContent className="p-12 text-center">
            <Briefcase className="h-12 w-12 text-zinc-200 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">No active projects</p>
            <p className="text-xs text-zinc-400 mt-1">
              Your ongoing projects will appear here
            </p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/professional-portal/projects/new">
                Create Project
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.slice(0, 4).map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectsWidget;
