"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Calendar, 
  MapPin, 
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { getProfessionalProjectUrl } from "@/lib/links";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

// --- Mock Data ---
const PROJECTS = [
  {
    id: "1",
    title: "Karen Villa Renovation",
    client: "Michael Kamau",
    clientAvatar: "https://i.pravatar.cc/150?u=1",
    location: "Karen, Nairobi",
    budget: "KSh 4.2M",
    spent: "KSh 3.1M",
    status: "In Progress",
    progress: 75,
    dueDate: "Oct 24, 2024",
    image: "/images/projects/karen-villa.jpg", // Placeholder
    tags: ["Renovation", "Interior"]
  },
  {
    id: "2",
    title: "Westlands Office Fitout",
    client: "Tech Solutions Ltd",
    clientAvatar: "https://i.pravatar.cc/150?u=2",
    location: "Westlands, Nairobi",
    budget: "KSh 1.8M",
    spent: "KSh 600k",
    status: "Planning",
    progress: 30,
    dueDate: "Nov 15, 2024",
    image: "/images/projects/office.jpg", // Placeholder
    tags: ["Commercial", "Fitout"]
  },
  {
    id: "3",
    title: "Lavington Apartment Design",
    client: "Sarah Jenkins",
    clientAvatar: "https://i.pravatar.cc/150?u=3",
    location: "Lavington, Nairobi",
    budget: "KSh 850k",
    spent: "KSh 850k",
    status: "Completed",
    progress: 100,
    dueDate: "Sep 30, 2024",
    image: "/images/projects/apartment.jpg", // Placeholder
    tags: ["Design", "Residential"]
  }
];

export default function ProjectsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: apiProjects, isLoading } = useQuery({
    queryKey: ["professional-projects"],
    queryFn: async () => {
      const response = await fetch("/api/professional-portal/projects");
      if (!response.ok) throw new Error("Failed to fetch projects");
      const result = await response.json();
      return result.data;
    },
  });

  // Use API data if available and not empty, otherwise fallback to mock data
  const projects = (apiProjects && apiProjects.length > 0) ? apiProjects : PROJECTS;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
      
      {/* --- Header --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Projects</h1>
          <p className="text-zinc-500 mt-1 text-sm">
            Manage your ongoing work, track progress, and view project history.
          </p>
        </div>
        <Button className="bg-zinc-900 hover:bg-zinc-800 text-white shadow-md">
          <Plus className="mr-2 h-4 w-4" /> New Project
        </Button>
      </div>

      {/* --- Filters & Controls --- */}
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
          <Tabs defaultValue="all" className="w-auto">
            <TabsList className="bg-zinc-100">
              <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">All</TabsTrigger>
              <TabsTrigger value="active" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Active</TabsTrigger>
              <TabsTrigger value="completed" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Completed</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* --- Projects Grid --- */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[400px] bg-zinc-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {projects.map((project: any) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

    </div>
  );
}

function ProjectCard({ project }: { project: any }) {
  return (
    <Card className="border border-zinc-200 shadow-sm hover:shadow-md transition-all duration-300 bg-white group flex flex-col h-full">
      <CardHeader className="p-0">
        <div className="h-40 w-full bg-zinc-100 relative overflow-hidden rounded-t-xl">
          {/* Placeholder for project image */}
          <div className="absolute inset-0 bg-zinc-200 flex items-center justify-center text-zinc-400">
            <MapPin className="h-8 w-8 opacity-20" />
          </div>
          <div className="absolute top-4 right-4">
            <Badge className={`
              ${project.status === 'Completed' ? 'bg-emerald-500 hover:bg-emerald-600' : 
                project.status === 'In Progress' ? 'bg-blue-500 hover:bg-blue-600' : 
                'bg-zinc-500 hover:bg-zinc-600'} text-white border-0 shadow-sm
            `}>
              {project.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-zinc-900 text-lg line-clamp-1">{project.title}</h3>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-1">
              <MapPin className="h-3.5 w-3.5" />
              {project.location}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-900">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>View Details</DropdownMenuItem>
              <DropdownMenuItem>Edit Project</DropdownMenuItem>
              <DropdownMenuItem className="text-red-600">Archive</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-4 mb-6 flex-1">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6 border border-zinc-100">
                <AvatarImage src={project.clientAvatar} />
                <AvatarFallback>CL</AvatarFallback>
              </Avatar>
              <span className="text-zinc-600">{project.client}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Progress</span>
              <span className="font-medium text-zinc-900">{project.progress}%</span>
            </div>
            <Progress value={project.progress} className="h-2 bg-zinc-100" indicatorClassName="bg-zinc-900" />
          </div>

          <div className="grid grid-cols-2 gap-4 py-4 border-t border-b border-zinc-50">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">Budget</p>
              <p className="text-sm font-semibold text-zinc-900 mt-0.5">{project.budget}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">Due Date</p>
              <p className="text-sm font-semibold text-zinc-900 mt-0.5">{project.dueDate}</p>
            </div>
          </div>
        </div>

        <Link href={getProfessionalProjectUrl(project.id)} className="w-full">
          <Button variant="outline" className="w-full border-zinc-200 text-zinc-900 hover:bg-zinc-50">
            Manage Project
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
