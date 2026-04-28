"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Eye,
  Trash2,
  Mail,
  Phone,
  ArrowUpDown,
} from "lucide-react";
import Link from "next/link";
import type { LeadListItem } from "@/actions/admin/leads";

export type LeadData = LeadListItem;

const statusColors: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  CONTACTED: "bg-cyan-100 text-cyan-700",
  PROPOSAL: "bg-purple-100 text-purple-700",
  NEGOTIATION: "bg-amber-100 text-amber-700",
  WON: "bg-emerald-100 text-emerald-700",
  LOST: "bg-red-100 text-red-700",
};

export const columns: ColumnDef<LeadData>[] = [
  {
    accessorKey: "clientName",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4 hover:bg-transparent"
        >
          Client
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const lead = row.original;
      return (
        <div className="flex flex-col">
          <Link
            href={`/leads/${lead.id}`}
            className="font-medium text-zinc-900 hover:text-blue-600 transition-colors"
          >
            {lead.clientName}
          </Link>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Mail className="h-3 w-3" />
            {lead.clientEmail}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "projectType",
    header: "Project Type",
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.projectType.replace(/_/g, " ")}
      </Badge>
    ),
  },
  {
    accessorKey: "professional",
    header: "Professional",
    cell: ({ row }) => {
      const professional = row.original.professional;
      return (
        <div className="flex flex-col">
          <span className="font-medium text-sm">
            {professional.companyName}
          </span>
          <span className="text-xs text-zinc-500">{professional.email}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge className={statusColors[row.original.status] || "bg-zinc-100"}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "source",
    header: "Source",
    cell: ({ row }) => (
      <span className="text-sm text-zinc-600 capitalize">
        {row.original.source?.replace(/_/g, " ") || "Website"}
      </span>
    ),
  },
  {
    accessorKey: "location",
    header: "Location",
    cell: ({ row }) => (
      <span className="text-sm text-zinc-500">
        {row.original.location || "-"}
      </span>
    ),
  },
  {
    accessorKey: "budget",
    header: "Budget",
    cell: ({ row }) => (
      <span className="text-sm font-medium">{row.original.budget || "-"}</span>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Received",
    cell: ({ row }) => (
      <span className="text-sm text-zinc-500">
        {new Date(row.original.createdAt).toLocaleDateString()}
      </span>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => {
      const lead = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/leads/${lead.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={`mailto:${lead.clientEmail}`}>
                <Mail className="mr-2 h-4 w-4" />
                Email Client
              </a>
            </DropdownMenuItem>
            {lead.clientPhone && (
              <DropdownMenuItem asChild>
                <a href={`tel:${lead.clientPhone}`}>
                  <Phone className="mr-2 h-4 w-4" />
                  Call Client
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Lead
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
