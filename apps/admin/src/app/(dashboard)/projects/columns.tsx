"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Copy, ArrowUpDown, Calendar } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Matches the Prisma return type structure from getProjects
export type ProjectData = {
  id: string;
  title: string;
  status: string;
  budget: number | null;
  createdAt: Date;
  client: {
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatar?: string | null; // Optional based on your query
  } | null;
  professional: {
    companyName: string;
    user: {
      avatar?: string | null;
    };
  } | null;
};

export const columns: ColumnDef<ProjectData>[] = [
  {
    accessorKey: "title",
    header: "Project Details",
    cell: ({ row }) => {
      return (
        <div className="flex flex-col py-1">
          <span className="font-semibold text-zinc-900 truncate max-w-50">
            {row.getValue("title")}
          </span>
          <span className="text-[10px] text-zinc-400 font-mono">
            ID: {row.original.id.slice(0, 8)}...
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "client",
    header: "Client",
    cell: ({ row }) => {
      const client = row.original.client;
      if (!client)
        return (
          <span className="text-zinc-400 italic text-xs">Deleted User</span>
        );

      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 border border-zinc-200">
            <AvatarImage src={client.avatar || ""} />
            <AvatarFallback className="bg-zinc-100 text-zinc-500 text-xs">
              {client.firstName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-zinc-700">
              {client.firstName} {client.lastName}
            </span>
            <span className="text-[10px] text-zinc-500">{client.email}</span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "professional",
    header: "Professional",
    cell: ({ row }) => {
      const pro = row.original.professional;
      if (!pro)
        return (
          <Badge
            variant="outline"
            className="border-dashed text-zinc-400 font-normal"
          >
            Unassigned
          </Badge>
        );

      return (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 border border-zinc-200">
            <AvatarImage src={pro.user?.avatar || ""} />
            <AvatarFallback className="bg-emerald-50 text-emerald-600 text-xs">
              {pro.companyName[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-zinc-700 max-w-35 truncate">
              {pro.companyName}
            </span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;

      const styles: Record<string, string> = {
        planning: "bg-blue-50 text-blue-700 border-blue-200",
        in_progress:
          "bg-amber-50 text-amber-700 border-amber-200 animate-pulse",
        completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
        cancelled: "bg-zinc-100 text-zinc-500 border-zinc-200",
      };

      return (
        <Badge
          variant="secondary"
          className={cn(
            "capitalize border px-2.5 py-0.5 shadow-none",
            styles[status] || styles.cancelled,
          )}
        >
          {status.replace("_", " ")}
        </Badge>
      );
    },
  },
  {
    accessorKey: "budget",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="-ml-4 h-8 data-[state=open]:bg-accent"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          <span>Budget</span>
          <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const budget = parseFloat(row.getValue("budget") as string);
      if (!budget) return <span className="text-zinc-300">-</span>;

      return (
        <div className="font-mono text-sm font-medium text-zinc-700">
          {new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency: "KES",
            maximumFractionDigits: 0,
          }).format(budget)}
        </div>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => {
      return (
        <div className="flex items-center text-zinc-500 text-xs">
          <Calendar className="mr-2 h-3 w-3" />
          {new Date(row.original.createdAt).toLocaleDateString()}
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const project = row.original;
      return (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-zinc-100">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4 text-zinc-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(project.id)}
              >
                <Copy className="mr-2 h-3.5 w-3.5 text-zinc-400" />
                Copy ID
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center cursor-pointer font-medium"
                >
                  <Eye className="mr-2 h-3.5 w-3.5 text-emerald-600" /> View
                  Details
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];
