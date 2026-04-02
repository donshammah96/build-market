"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
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
    <Card className="border border-border shadow-sm bg-card">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h4 className="font-bold text-foreground text-sm">
              {project.title}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {project.client}
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "font-medium border-0 px-2 py-0.5 capitalize",
              isAlert
                ? "bg-muted text-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            {project.status.replace("_", " ")}
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span className="font-medium text-foreground">
              {project.progress}%
            </span>
          </div>
          <Progress
            value={project.progress}
            className="h-1.5 bg-muted"
            indicatorClassName={isAlert ? "bg-primary/70" : "bg-primary"}
          />
        </div>

        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            Due {project.dueDate}
          </span>
          <Link
            href={`/professional-portal/projects/${project.id}`}
            className="text-foreground font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-sm min-h-11 px-2 inline-flex items-center motion-safe:active:scale-[0.98]"
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
        <div className="h-5 w-32 bg-muted rounded motion-safe:animate-pulse" />
        <div className="h-4 w-24 bg-muted rounded motion-safe:animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <Card key={i} className="border border-border shadow-sm bg-card">
            <CardContent className="p-6 motion-safe:animate-pulse">
              <div className="flex justify-between mb-4">
                <div className="space-y-2">
                  <div className="h-4 w-40 bg-muted rounded" />
                  <div className="h-3 w-24 bg-muted rounded" />
                </div>
                <div className="h-5 w-16 bg-muted rounded" />
              </div>
              <div className="space-y-2">
                <div className="h-2 w-full bg-muted rounded" />
              </div>
              <div className="mt-4 pt-4 border-t border-border flex justify-between">
                <div className="h-3 w-20 bg-muted rounded" />
                <div className="h-3 w-16 bg-muted rounded" />
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
  const router = useRouter();
  const [isCreateProjectPending, startCreateProjectTransition] = useTransition();

  if (isLoading) {
    return <ProjectsWidgetSkeleton />;
  }

  const handleCreateProject = () => {
    startCreateProjectTransition(() => {
      router.push("/professional-portal/projects/new");
    });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground">Active Projects</h3>
        <Link
          href="/professional-portal/projects"
          className="text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-sm min-h-11 px-2 py-1.5 inline-flex items-center gap-1 group motion-safe:transition-colors motion-safe:active:scale-[0.98]"
        >
          View All{" "}
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 motion-safe:transition-transform" />
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card className="border border-border shadow-sm bg-card">
          <CardContent className="p-12 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No active projects</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your ongoing projects will appear here
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 min-h-11 motion-safe:active:scale-[0.98]"
              isLoading={isCreateProjectPending}
              loadingText="Opening..."
              onClick={handleCreateProject}
            >
              Create Project
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
