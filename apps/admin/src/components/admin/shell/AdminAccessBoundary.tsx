import type { AdminRole } from "@build/db";
import { AdminShell } from "./AdminShell";
import { AdminSystemErrorCard } from "./AdminSystemErrorCard";

export interface AdminAccessBoundaryProps {
  canAccess: boolean;
  hasLoadError: boolean;
  correlationId?: string | null | undefined;
  adminRole?: AdminRole | string | null | undefined;
  displayName?: string | null | undefined;
  children: React.ReactNode;
}

export function AdminAccessBoundary({
  canAccess,
  hasLoadError,
  correlationId,
  adminRole,
  displayName,
  children,
}: AdminAccessBoundaryProps) {
  if (hasLoadError || !canAccess) {
    const title = hasLoadError
      ? "Database Connection Failure"
      : "Access Denied";
    const description = hasLoadError
      ? "The admin system failed to establish a secure connection to the database. This may be due to network timeout or incorrect configuration."
      : "You do not have the required administrative role to access the dashboard. If you believe this is an error, contact your administrator.";

    return (
      <AdminSystemErrorCard
        title={title}
        description={description}
        correlationId={correlationId}
      />
    );
  }

  return (
    <AdminShell adminRole={adminRole} displayName={displayName}>
      {children}
    </AdminShell>
  );
}
