import { UserButton } from "@clerk/nextjs";
import type { AdminRole } from "@build/enums";

export interface AdminUserMenuProps {
  adminRole?: AdminRole | string | null | undefined;
  displayName?: string | null | undefined;
}

function formatAdminRole(role: AdminRole | string | null | undefined): string {
  return (role ?? "Admin").replace(/_/g, " ").toLowerCase();
}

export function AdminUserMenu({ adminRole, displayName }: AdminUserMenuProps) {
  const label = displayName || formatAdminRole(adminRole);

  return (
    <div className="flex items-center gap-3 px-2 py-1">
      <UserButton
        appearance={{
          elements: {
            avatarBox: "h-8 w-8 ring-2 ring-zinc-700",
          },
        }}
      />
      <div className="flex flex-col">
        <span className="text-xs font-medium text-white capitalize">
          {label}
        </span>
        <span className="text-[10px] text-zinc-500 capitalize">
          {formatAdminRole(adminRole)}
        </span>
      </div>
    </div>
  );
}
