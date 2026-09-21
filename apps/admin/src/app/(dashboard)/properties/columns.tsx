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
  CheckCircle,
  XCircle,
  Star,
  Trash2,
  Home,
  ArrowUpDown,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { PropertyListItem } from "@/actions/admin";

export type PropertyData = PropertyListItem;

const statusColors: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  PENDING: "bg-amber-100 text-amber-700",
  SOLD: "bg-blue-100 text-blue-700",
  RENTED: "bg-purple-100 text-purple-700",
  WITHDRAWN: "bg-red-100 text-red-700",
};

const typeColors: Record<string, string> = {
  SALE: "bg-green-100 text-green-700",
  RENT: "bg-blue-100 text-blue-700",
  LEASE: "bg-purple-100 text-purple-700",
};

export const columns: ColumnDef<PropertyData>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4 hover:bg-transparent"
        >
          Property
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const property = row.original;
      return (
        <div className="flex items-center gap-3">
          {property.mainImage ? (
            <Image
              src={property.mainImage}
              alt={property.title}
              className="h-10 w-10 rounded-md object-cover"
            />
          ) : (
            <div className="h-10 w-10 rounded-md bg-zinc-200 flex items-center justify-center">
              <Home className="h-5 w-5 text-zinc-400" />
            </div>
          )}
          <div className="flex flex-col">
            <Link
              href={`/properties/${property.id}`}
              className="font-medium text-zinc-900 hover:text-blue-600 transition-colors line-clamp-1"
            >
              {property.title}
            </Link>
            <span className="text-xs text-zinc-500">
              {property.location}, {property.county}
            </span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "price",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4 hover:bg-transparent"
        >
          Price
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const property = row.original;
      return (
        <div className="flex flex-col">
          <span className="font-semibold">
            {property.currency} {property.price.toLocaleString()}
          </span>
          <Badge
            variant="secondary"
            className={`w-fit text-xs ${typeColors[property.type] || ""}`}
          >
            {property.type}
          </Badge>
        </div>
      );
    },
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.category.toLowerCase()}
      </Badge>
    ),
  },
  {
    accessorKey: "features",
    header: "Features",
    cell: ({ row }) => {
      const property = row.original;
      return (
        <div className="flex items-center gap-3 text-sm text-zinc-600">
          {property.bedrooms !== null && <span>{property.bedrooms} bed</span>}
          {property.bathrooms !== null && (
            <span>{property.bathrooms} bath</span>
          )}
          {property.areaSqFt !== null && (
            <span>{property.areaSqFt.toLocaleString()} sqft</span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const property = row.original;
      return (
        <div className="flex flex-col gap-1">
          <Badge className={statusColors[property.status] || "bg-zinc-100"}>
            {property.status}
          </Badge>
          <div className="flex items-center gap-1">
            {property.verificationStatus === "VERIFIED" && (
              <Badge
                variant="outline"
                className="text-xs bg-emerald-50 text-emerald-600 border-emerald-200"
              >
                <CheckCircle className="mr-1 h-3 w-3" />
                Verified
              </Badge>
            )}
            {property.featured && (
              <Badge
                variant="outline"
                className="text-xs bg-purple-50 text-purple-600 border-purple-200"
              >
                <Star className="mr-1 h-3 w-3" />
              </Badge>
            )}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "agent",
    header: "Agent",
    cell: ({ row }) => {
      const agent = row.original.agent;
      if (!agent) return <span className="text-zinc-400">No agent</span>;
      return (
        <div className="flex flex-col">
          <span className="font-medium text-sm">{agent.companyName}</span>
          <span className="text-xs text-zinc-500">{agent.email}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Listed",
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
      const property = row.original;
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
              <Link href={`/properties/${property.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </Link>
            </DropdownMenuItem>
            {property.verificationStatus !== "VERIFIED" && (
              <DropdownMenuItem className="text-emerald-600">
                <CheckCircle className="mr-2 h-4 w-4" />
                Verify Property
              </DropdownMenuItem>
            )}
            {property.verificationStatus === "VERIFIED" && (
              <DropdownMenuItem className="text-amber-600">
                <XCircle className="mr-2 h-4 w-4" />
                Revoke Verification
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className={
                property.featured ? "text-zinc-600" : "text-purple-600"
              }
            >
              <Star className="mr-2 h-4 w-4" />
              {property.featured ? "Remove Featured" : "Mark Featured"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Property
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
