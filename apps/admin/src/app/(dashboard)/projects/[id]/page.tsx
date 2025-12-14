
import { getProjectDetails } from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Calendar, DollarSign, User, Building2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default async function ProjectDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { success, data: project } = await getProjectDetails(id);

  if (!success || !project) return notFound();

  const statusColors: Record<string, string> = {
      planning: "bg-blue-100 text-blue-700",
      in_progress: "bg-amber-100 text-amber-700",
      completed: "bg-green-100 text-green-700",
      cancelled: "bg-red-100 text-red-700"
  };

  return (
    <div className="space-y-6">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
                <Link href="/projects">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
            </Button>
            <div>
                 <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight">{project.title}</h1>
                    <Badge variant="secondary" className={`capitalize ${statusColors[project.status] || ""}`}>
                        {project.status.replace("_", " ")}
                    </Badge>
                 </div>
                 <p className="text-sm text-muted-foreground">ID: {project.id}</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <h3 className="font-semibold mb-2">Description</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {project.description || "No description provided."}
                            </p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 pt-4">
                            <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                                <Calendar className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Start Date</p>
                                    <p className="text-sm font-semibold">
                                        {project.startDate ? new Date(project.startDate).toLocaleDateString() : "Not set"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                                <Calendar className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">End Date</p>
                                    <p className="text-sm font-semibold">
                                        {project.endDate ? new Date(project.endDate).toLocaleDateString() : "Not set"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                                <DollarSign className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground">Budget</p>
                                    <p className="text-sm font-semibold">
                                        {project.budget ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(project.budget)) : "Not set"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                
                {/* Could add Tasks or Milestones here later if available in schema */}
            </div>

            <div className="space-y-6">
                {/* Client Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <User className="h-4 w-4" /> Client
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                         {project.client ? (
                             <div className="flex items-center gap-3">
                                <Avatar>
                                    <AvatarImage src={project.client.avatar || ""} />
                                    <AvatarFallback>{project.client.firstName?.[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <Link href={`/users/${project.clientId}`} className="font-medium hover:underline">
                                        {project.client.firstName} {project.client.lastName}
                                    </Link>
                                    <p className="text-xs text-muted-foreground">{project.client.email}</p>
                                </div>
                             </div>
                         ) : (
                             <p className="text-sm text-muted-foreground">No client associated.</p>
                         )}
                    </CardContent>
                </Card>

                {/* Professional Card */}
                 <Card>
                    <CardHeader>
                         <CardTitle className="text-base flex items-center gap-2">
                            <Building2 className="h-4 w-4" /> Professional
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {project.professional ? (
                             <div className="flex items-center gap-3">
                                <Avatar>
                                    <AvatarImage src={project.professional.user.avatar || ""} />
                                    <AvatarFallback>{project.professional.user.firstName?.[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <Link href={`/professionals/${project.professional}`} className="font-medium hover:underline">
                                        {project.professional.user.firstName} {project.professional.user.lastName}
                                    </Link>
                                    <p className="text-xs text-muted-foreground">{project.professional.user.email}</p>
                                </div>
                             </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">Not assigned yet.</p>
                        )}
                    </CardContent>
                </Card>

                {/* Metadata */}
                 <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Metadata</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Created</span>
                            <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                        </div>
                         <div className="flex justify-between">
                            <span className="text-muted-foreground">Last Updated</span>
                            <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
