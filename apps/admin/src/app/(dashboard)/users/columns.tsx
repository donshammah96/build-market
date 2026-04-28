"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ColumnDef, Table as ReactTable } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Shield, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { deleteUser, deleteUsersBulk } from "@/actions/admin";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { UserActionControls } from "./user-action-controls";
import { createAdminIdempotencyKey } from "@/lib/security/idempotency-key";

// Define the shape of our data based on getUsers return type
export type UserData = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  avatar: string | null;
  professionalProfile: {
    companyName: string;
    verified: boolean;
  } | null;
};

interface UserTablePermissions {
  canDeleteUsers: boolean;
  canBulkDeleteUsers: boolean;
  canManageUsers: boolean;
}

function BulkDeleteUsersButton({ table }: { table: ReactTable<UserData> }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedIds = selectedRows.map((row) => row.original.id);

  if (selectedIds.length === 0) return null;

  const onBulkDelete = () => {
    if (
      !confirm(
        `Delete ${selectedIds.length} selected user${selectedIds.length > 1 ? "s" : ""}? This action is permanent.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      const response = await deleteUsersBulk(
        selectedIds,
        createAdminIdempotencyKey(
          "deleteUsersBulk",
          selectedIds.slice().sort().join(","),
        ),
      );
      if (response.success && response.data) {
        toast.success(
          `Bulk delete complete: ${response.data.summary.successful} successful, ${response.data.summary.failed} failed`,
        );
        table.toggleAllRowsSelected(false);
        router.refresh();
      } else {
        toast.error(response.error || "Bulk delete failed");
      }
    });
  };

  return (
    <Button
      size="sm"
      variant="destructive"
      className="h-7 px-2"
      disabled={isPending}
      onClick={onBulkDelete}
    >
      Delete ({selectedIds.length})
    </Button>
  );
}

export function getUserColumns(
  permissions: UserTablePermissions,
): ColumnDef<UserData>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center gap-2">
          <Checkbox
            disabled={!permissions.canBulkDeleteUsers}
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
          />
          {permissions.canBulkDeleteUsers && (
            <BulkDeleteUsersButton table={table} />
          )}
        </div>
      ),
      cell: ({ row }) => (
        <Checkbox
          disabled={!permissions.canBulkDeleteUsers}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          checked={row.getIsSelected()}
        />
      ),
    },
    {
      accessorKey: "user",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="-ml-4 hover:bg-transparent"
          >
            User
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user.avatar || ""} />
              <AvatarFallback>{(user.firstName || "U")[0]}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-medium text-sm">
                {user.firstName} {user.lastName}
              </span>
              <span className="text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center gap-2">
            <span className="capitalize">{user.role}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const user = row.original;
        const isVerified = user.professionalProfile?.verified;

        if (user.role === "client")
          return <span className="text-muted-foreground">-</span>;

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
              <Shield className="h-3 w-3" />
            )}
            {isVerified ? "Verified" : "Pending"}
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
      cell: ({ row }) => {
        return (
          <div className="">
            {new Date(row.original.createdAt).toLocaleDateString()}
          </div>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <UserActionsCell
          user={row.original}
          canDeleteUsers={permissions.canDeleteUsers}
          canManageUsers={permissions.canManageUsers}
        />
      ),
    },
  ];
}

function UserActionsCell({
  user,
  canDeleteUsers,
  canManageUsers,
}: {
  user: UserData;
  canDeleteUsers: boolean;
  canManageUsers: boolean;
}) {
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    const res = await deleteUser(
      user.id,
      createAdminIdempotencyKey("deleteUser", user.id),
    );
    if (res.success) {
      toast.success("User deleted");
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
          onClick={() => navigator.clipboard.writeText(user.id)}
        >
          Copy user ID
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/users/${user.id}`}>View Details</Link>
        </DropdownMenuItem>
        <UserActionControls
          canManageUsers={canManageUsers}
          mode="menu"
          userId={user.id}
          currentRole={user.role}
          showInvite={false}
          showRoleActions={true}
        />
        {canDeleteUsers && (
          <DropdownMenuItem
            onClick={handleDelete}
            className="text-red-600 focus:text-red-600"
          >
            Delete User
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
