"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  assignUserRole,
  inviteUser,
  resetUserCredentials,
} from "@/actions/admin";
import {
  ASSIGNABLE_USER_ROLES,
  getAssignableUserRolesPromptText,
} from "@/lib/users/user-roles";
import { createAdminIdempotencyKey } from "@/lib/security/idempotency-key";

type UserActionControlsProps = {
  canManageUsers: boolean;
  mode: "buttons" | "menu";
  userId?: string;
  currentRole?: string;
  showInvite?: boolean;
  showRoleActions?: boolean;
  className?: string;
};

export function UserActionControls({
  canManageUsers,
  mode,
  userId,
  currentRole,
  showInvite = true,
  showRoleActions = true,
  className,
}: UserActionControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!canManageUsers) return null;

  const canShowRoleActions = showRoleActions && Boolean(userId);

  const handleInvite = () => {
    const email = prompt("Enter user email to invite:");
    if (!email) return;

    const role = prompt(
      `Enter role (${getAssignableUserRolesPromptText()}):`,
      ASSIGNABLE_USER_ROLES[0],
    );
    if (!role) return;

    startTransition(async () => {
      const response = await inviteUser(
        { email, role },
        createAdminIdempotencyKey("inviteUser", email.trim().toLowerCase()),
      );
      if (response.success && response.data) {
        toast.success(`Invitation sent to ${response.data.email}`);
        router.refresh();
      } else {
        toast.error(response.error || "Failed to send invitation");
      }
    });
  };

  const handleAssignRole = () => {
    if (!userId) return;

    const nextRole = prompt(
      `Assign role (${getAssignableUserRolesPromptText()}):`,
      currentRole?.toUpperCase?.() || ASSIGNABLE_USER_ROLES[0],
    );
    if (!nextRole) return;

    startTransition(async () => {
      const response = await assignUserRole(
        userId,
        nextRole,
        createAdminIdempotencyKey("assignUserRole", userId),
      );
      if (response.success) {
        toast.success("User role updated");
        router.refresh();
      } else {
        toast.error(response.error || "Failed to update role");
      }
    });
  };

  const handleReset = () => {
    if (!userId) return;
    if (!confirm("Force this user to reset credentials on next login?")) {
      return;
    }

    startTransition(async () => {
      const response = await resetUserCredentials(
        userId,
        createAdminIdempotencyKey("resetUserCredentials", userId),
      );
      if (response.success) {
        toast.success("Credential reset enforced");
        router.refresh();
      } else {
        toast.error(response.error || "Failed to reset credentials");
      }
    });
  };

  if (mode === "menu") {
    return (
      <>
        {showInvite && (
          <DropdownMenuItem disabled={isPending} onClick={handleInvite}>
            Invite User
          </DropdownMenuItem>
        )}
        {canShowRoleActions && (
          <>
            <DropdownMenuItem disabled={isPending} onClick={handleAssignRole}>
              Assign Role
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isPending} onClick={handleReset}>
              Force Credential Reset
            </DropdownMenuItem>
          </>
        )}
      </>
    );
  }

  return (
    <div
      className={cn("flex flex-wrap items-center justify-end gap-2", className)}
    >
      {showInvite && (
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={handleInvite}
        >
          Invite User
        </Button>
      )}
      {canShowRoleActions && (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={handleAssignRole}
          >
            Assign Role
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={handleReset}
          >
            Force Credential Reset
          </Button>
        </>
      )}
    </div>
  );
}
