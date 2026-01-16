"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import type { ServiceCategoryListItem } from "@/actions/admin";

export const columns: ColumnDef<ServiceCategoryListItem>[] = [
  {
    accessorKey: "name",
    header: "Service Name",
    cell: ({ row }) => {
      const service = row.original;
      return (
        <div className="flex flex-col">
          <span className="font-medium text-zinc-900">{service.name}</span>
          {service.slug && (
            <span className="text-xs text-zinc-500">{service.slug}</span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "professionType",
    header: "Profession Type",
    cell: ({ row }) => {
      const professionType = row.getValue("professionType") as string | null;
      return professionType ? (
        <Badge variant="outline" className="capitalize">
          {professionType.toLowerCase().replace(/_/g, " ")}
        </Badge>
      ) : (
        <span className="text-zinc-400">—</span>
      );
    },
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => {
      const description = row.getValue("description") as string | null;
      return description ? (
        <span className="text-zinc-600 text-sm line-clamp-2 max-w-xs">
          {description}
        </span>
      ) : (
        <span className="text-zinc-400">No description</span>
      );
    },
  },
  {
    accessorKey: "_count",
    header: "Professionals",
    cell: ({ row }) => {
      const service = row.original;
      const count = service._count.professionals;
      return (
        <Badge variant="secondary" className="font-mono">
          {count}
        </Badge>
      );
    },
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) => {
      const isActive = row.getValue("isActive") as boolean;
      return (
        <Badge variant={isActive ? "default" : "secondary"}>
          {isActive ? "Active" : "Inactive"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => {
      const date = row.getValue("createdAt") as Date;
      return (
        <span className="text-sm text-zinc-600">
          {new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const service = row.original;
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
              <Link href={`/services/${service.id}`}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/services/${service.id}/edit`}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit Service
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Service
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
