"use client";

import { getUserColumns, UserData } from "./columns";
import { DataTable } from "@/components/ui/data-table";

interface UsersTableClientProps {
  users: UserData[];
  totalPages: number;
  canDeleteUsers: boolean;
  canManageUsers: boolean;
}

export function UsersTableClient({
  users,
  totalPages,
  canDeleteUsers,
  canManageUsers,
}: UsersTableClientProps) {
  const columns = getUserColumns({
    canDeleteUsers,
    canBulkDeleteUsers: canDeleteUsers,
    canManageUsers,
  });

  return <DataTable columns={columns} data={users} pageCount={totalPages} />;
}
