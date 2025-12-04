"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  ArrowLeft, 
  Calendar, 
  DollarSign, 
  MapPin, 
  User, 
  Save, 
  Trash2,
  Loader2
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/text-area";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { ROUTES } from "@/lib/links";

const projectSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  budget: z.union([z.string(), z.number()])
    .optional()
    .transform((val) => (val === "" || val === undefined ? undefined : Number(val)))
    .refine((val) => val === undefined || val > 0, { message: "Budget must be positive" }),
  status: z.enum(["planning", "in_progress", "completed", "archived"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const projectId = params.id as string;
  const [isEditing, setIsEditing] = useState(false);

  const { data: project, isLoading, error } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const response = await fetch(`/api/professional-portal/projects/${projectId}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error("Project not found");
        throw new Error("Failed to fetch project");
      }
      const result = await response.json();
      return result.data;
    },
  });

  const form = useForm({
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

  // Reset form when project data is loaded
  useEffect(() => {
    if (project) {
      form.reset({
        title: project.title,
        description: project.description || "",
        budget: project.budget,
        status: project.status,
        startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : "",
        endDate: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : "",
      });
    }
  }, [project, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: ProjectFormValues) => {
      const response = await fetch(`/api/professional-portal/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          startDate: data.startDate ? new Date(data.startDate).toISOString() : undefined,
          endDate: data.endDate ? new Date(data.endDate).toISOString() : undefined,
        }),
      });
      
      if (!response.ok) throw new Error("Failed to update project");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["professional-projects"] });
      setIsEditing(false);
      toast.success("Project updated successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/professional-portal/projects/${projectId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to delete project");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["professional-projects"] });
      toast.success("Project deleted successfully");
      router.push(ROUTES.professionalProjects);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const onSubmit: SubmitHandler<ProjectFormValues> = (data) => {
    updateMutation.mutate(data);
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
        <h2 className="text-xl font-semibold text-zinc-900">Project not found</h2>
        <Button variant="outline" onClick={() => router.push(ROUTES.professionalProjects)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-8">
      
      {/* --- Header --- */}
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
              <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={() => {
                if (confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
                  deleteMutation.mutate();
                }
              }}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
              <Button onClick={() => setIsEditing(true)}>
                Manage Project
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button onClick={form.handleSubmit(onSubmit)} disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </>
          )}
        </div>
      </div>

      {/* --- Main Content --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column: Project Details */}
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
                    {form.formState.errors.title && <p className="text-xs text-red-500">{form.formState.errors.title.message}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea {...form.register("description")} className="min-h-[100px]" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Budget</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input type="number" {...form.register("budget")} className="pl-9" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Status</label>
                      <Select 
                        onValueChange={(value) => form.setValue("status", value as any)} 
                        defaultValue={project.status}
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
                </form>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-900">{project.title}</h2>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={`
                        ${project.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 
                          project.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                          'bg-zinc-100 text-zinc-700'} border-0
                      `}>
                        {project.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>

                  <div className="prose prose-sm max-w-none text-zinc-600">
                    <p>{project.description || "No description provided."}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-100">
                    <div>
                      <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Budget</span>
                      <p className="text-lg font-medium text-zinc-900 mt-1">
                        {project.budget ? `$${project.budget.toLocaleString()}` : "Not set"}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Timeline</span>
                      <p className="text-sm text-zinc-900 mt-1">
                        {project.startDate ? new Date(project.startDate).toLocaleDateString() : "TBD"} 
                        {' - '} 
                        {project.endDate ? new Date(project.endDate).toLocaleDateString() : "TBD"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Client Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={project.client?.avatar} />
                  <AvatarFallback>{project.client?.firstName?.charAt(0) || "C"}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-zinc-900">
                    {project.client?.firstName} {project.client?.lastName}
                  </p>
                  <p className="text-xs text-zinc-500">{project.client?.email}</p>
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
