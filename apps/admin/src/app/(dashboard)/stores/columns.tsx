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
import { MoreHorizontal, Eye, CheckCircle, XCircle, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import type { StoreListItem } from "@/actions/admin/stores";

export type StoreData = StoreListItem;

export const columns: ColumnDef<StoreData>[] = [
  {
    accessorKey: "name",
    header: "Store Name",
    cell: ({ row }) => {
      const store = row.original;
      return (
        <div className="flex flex-col">
          <Link 
            href={`/stores/${store.id}`}
            className="font-medium text-zinc-900 hover:text-blue-600 transition-colors"
          >
            {store.name}
          </Link>
          <span className="text-xs text-zinc-500">{store.city}, {store.county}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "owner",
    header: "Owner",
    cell: ({ row }) => {
      const owner = row.original.owner;
      if (!owner) return <span className="text-zinc-400">No owner</span>;
      return (
        <div className="flex flex-col">
          <span className="font-medium text-sm">{owner.companyName}</span>
          <span className="text-xs text-zinc-500">{owner.email}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "categories",
    header: "Categories",
    cell: ({ row }) => {
      const categories = row.original.categories;
      const displayCategories = categories.slice(0, 2);
      const remaining = categories.length - 2;
      return (
        <div className="flex flex-wrap gap-1">
          {displayCategories.map((cat) => (
            <Badge key={cat} variant="outline" className="text-xs capitalize">
              {cat.replace(/_/g, " ")}
            </Badge>
          ))}
          {remaining > 0 && (
            <Badge variant="secondary" className="text-xs">
              +{remaining}
            </Badge>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "storeType",
    header: "Type",
    cell: ({ row }) => (
      <Badge variant="secondary" className="capitalize text-xs">
        {row.original.storeType.replace(/_/g, " ")}
      </Badge>
    ),
  },
  {
    accessorKey: "verified",
    header: "Status",
    cell: ({ row }) => {
      const verified = row.original.verified;
      const featured = row.original.featured;
      return (
        <div className="flex items-center gap-2">
          {verified ? (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              <CheckCircle className="mr-1 h-3 w-3" />
              Verified
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700">
              Pending
            </Badge>
          )}
          {featured && (
            <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">
              <Star className="mr-1 h-3 w-3" />
              Featured
            </Badge>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "_count",
    header: "Products",
    cell: ({ row }) => (
      <span className="text-sm font-medium">{row.original._count.products}</span>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Created",
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
      const store = row.original;
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
              <Link href={`/stores/${store.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </Link>
            </DropdownMenuItem>
            {!store.verified && (
              <DropdownMenuItem className="text-emerald-600">
                <CheckCircle className="mr-2 h-4 w-4" />
                Verify Store
              </DropdownMenuItem>
            )}
            {store.verified && (
              <DropdownMenuItem className="text-amber-600">
                <XCircle className="mr-2 h-4 w-4" />
                Revoke Verification
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className={store.featured ? "text-zinc-600" : "text-purple-600"}>
              <Star className="mr-2 h-4 w-4" />
              {store.featured ? "Remove Featured" : "Mark Featured"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Store
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
