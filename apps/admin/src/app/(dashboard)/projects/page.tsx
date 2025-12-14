import { columns } from "./columns";
import { DataTable } from "@/components/ui/data-table";
import { getProjects } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Download, Plus } from "lucide-react";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const page = Number(resolvedParams.page) || 1;
  const search = (resolvedParams.search as string) || "";
  
  // Use the safeAction response structure
  const { success, data, error } = await getProjects(page, 10, search);

  if (!success || !data) {
      return (
        <div className="flex h-[50vh] flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
             <div className="text-red-500 font-bold text-2xl">!</div>
          </div>
          <h3 className="text-lg font-semibold text-zinc-900">Unable to load projects</h3>
          <p className="text-sm text-zinc-500 max-w-sm mx-auto">{error || "An unexpected error occurred while communicating with the database."}</p>
          <Button variant="outline" className="mt-4">Try Again</Button>
        </div>
      );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Projects</h2>
          <p className="text-sm text-zinc-500">
            Manage, monitor, and track all platform projects in real-time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button size="sm" className="h-9 bg-zinc-900 text-white hover:bg-zinc-800">
            <Plus className="mr-2 h-4 w-4" />
            Create Project
          </Button>
        </div>
      </div>

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/projects" className="font-semibold text-zinc-900">Projects</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>      
      
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <DataTable 
          columns={columns} 
          data={data.projects} 
          // Fix: Use data.meta.totalPages based on your admin.ts response structure
          pageCount={data.meta?.totalPages || 1}
          searchPlaceholder="Search by title or description..." 
        />
      </div>
    </div>
  );
}