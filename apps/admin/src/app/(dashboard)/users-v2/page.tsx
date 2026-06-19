// v2 route — feature flag: ADMIN_V2_USER_MANAGEMENT
// This page is an independent implementation of the users list.
// It does NOT re-export from ../users/page — it owns its own data fetch.
// Enable NEXT_PUBLIC_ADMIN_FF_V2_USER_MANAGEMENT to serve this route.
import { getUsers } from "@/actions/admin";
import { getAdminPermissions } from "@/actions/admin/_core/permissions";
import { UserData } from "../users/columns";
import { UsersTableClient } from "../users/users-table-client";
import { UserActionControls } from "../users/user-action-controls";
import { UsersFilter } from "../users/users-filter";

export default async function UsersV2Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const search =
    typeof resolvedSearchParams.search === "string"
      ? resolvedSearchParams.search
      : "";
  const role =
    typeof resolvedSearchParams.role === "string"
      ? resolvedSearchParams.role
      : undefined;
  const verified =
    resolvedSearchParams.verified === "true"
      ? true
      : resolvedSearchParams.verified === "false"
        ? false
        : undefined;
  const sortBy =
    (resolvedSearchParams.sortBy as "createdAt" | "firstName") || "createdAt";
  const sortOrder =
    (resolvedSearchParams.sortOrder as "asc" | "desc") || "desc";

  const response = await getUsers(
    page,
    10,
    search,
    role,
    verified,
    sortBy,
    sortOrder,
  );

  if (!response.success || !response.data) {
    throw new Error(response.error || "Failed to load users");
  }

  const { granularRole } = await getAdminPermissions();
  const canManageUsers = ["SUPER_ADMIN"].includes(granularRole || "");
  const canDeleteUsers = canManageUsers;

  const { users, meta } = response.data;

  return (
    <div className="space-y-6" data-v2-route="users">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          </div>
          <div className="flex items-center gap-2">
            <UserActionControls
              canManageUsers={canManageUsers}
              mode="buttons"
              showInvite={true}
              showRoleActions={false}
            />
            <span className="font-semibold px-4 py-2 bg-secondary rounded-md">
              Total Count: {meta.total}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between border-b pb-4">
          <UsersFilter />
        </div>
      </div>
      <UsersTableClient
        users={users as unknown as UserData[]}
        totalPages={meta.totalPages}
        canDeleteUsers={canDeleteUsers}
        canManageUsers={canManageUsers}
      />
    </div>
  );
}
