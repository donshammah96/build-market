"use client";

import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ColumnDef } from "@tanstack/react-table";
import {
  ArrowUpDown,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { verifyProfessional, rejectProfessional } from "@/actions/admin";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Define shape based on getProfessionals return (ProfessionalProfile & { user: User })
export type ProfessionalData = {
  userId: string;
  companyName: string;
  verified: boolean;
  licenseNumber: string | null;
  yearsExperience: number | null;
  createdAt: Date;
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatar: string | null;
  };
};

export const columns: ColumnDef<ProfessionalData>[] = [
  {
    accessorKey: "companyName",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4 hover:bg-transparent"
        >
          Company
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const pro = row.original;
      return (
        <div className="flex items-center gap-2">
          <Avatar className="h-9 w-9">
            <AvatarImage src={pro.user.avatar || ""} />
            <AvatarFallback>{pro.companyName[0]}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium text-sm">{pro.companyName}</span>
            <span className="text-xs text-muted-foreground">
              {pro.user.firstName} {pro.user.lastName}
            </span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "licenseNumber",
    header: "License",
    cell: ({ row }) => row.original.licenseNumber || "-",
  },
  {
    accessorKey: "verified",
    header: "Status",
    cell: ({ row }) => {
      const isVerified = row.original.verified;
      return (
        <div
          className={cn(
            "flex items-center gap-1 text-xs px-2 py-1 rounded-full w-fit",
            isVerified
              ? "bg-green-100 text-green-700"
              : "bg-yellow-100 text-yellow-700",
          )}
        >
          {isVerified ? (
            <ShieldCheck className="h-3 w-3" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          {isVerified ? "Verified" : "Unverified"}
        </div>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Joined
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
  },
  {
    id: "actions",
    cell: ({ row }) => <ProfessionalActionsCell pro={row.original} />,
  },
];

function ProfessionalActionsCell({ pro }: { pro: ProfessionalData }) {
  const router = useRouter();

  const handleVerify = async () => {
    const res = await verifyProfessional(pro.userId);
    if (res.success) {
      toast.success("Professional verified");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  const handleReject = async () => {
    const res = await rejectProfessional(pro.userId);
    if (res.success) {
      toast.success("Professional unverified");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

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
        <DropdownMenuItem
          onClick={() => navigator.clipboard.writeText(pro.userId)}
        >
          Copy User ID
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/professionals/${pro.userId}`}>View Details</Link>
        </DropdownMenuItem>

        {!pro.verified ? (
          <DropdownMenuItem onClick={handleVerify} className="text-green-600">
            <CheckCircle className="mr-2 h-4 w-4" /> Verify
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={handleReject} className="text-red-600">
            <XCircle className="mr-2 h-4 w-4" /> Unverify
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
