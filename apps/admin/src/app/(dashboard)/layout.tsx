import { currentUser } from "@clerk/nextjs/server";
import {
  getAdminPermissions,
  type AdminPermissions,
} from "@/actions/admin/_core/permissions";
import { AdminAccessBoundary } from "@/components/admin/shell/AdminAccessBoundary";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user = null;
  let permissions: AdminPermissions = {
    role: undefined,
    granularRole: null,
    canAccess: false,
  };
  let hasLoadError = false;
  let correlationId: string | null = null;

  try {
    const [u, p] = await Promise.all([currentUser(), getAdminPermissions()]);
    user = u;
    permissions = p;
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      (err as { digest?: string }).digest === "DYNAMIC_SERVER_USAGE"
    ) {
      throw err;
    }
    hasLoadError = true;
    correlationId = `adm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    console.error(
      `[DashboardLayout] Critical auth or permissions load failure (correlationId=${correlationId}):`,
      err,
    );
  }

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || null
    : null;

  return (
    <AdminAccessBoundary
      canAccess={permissions.canAccess}
      hasLoadError={hasLoadError}
      correlationId={correlationId}
      adminRole={permissions.granularRole}
      displayName={displayName}
    >
      {children}
    </AdminAccessBoundary>
  );
}
