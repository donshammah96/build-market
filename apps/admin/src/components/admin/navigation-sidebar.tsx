import Link from "next/link";
import { Suspense } from "react";
import {
  BarChart3,
  Building2,
  ClipboardCheck,
  FileText,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  Settings,
  ShieldCheck,
  Store,
  UserCheck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { AdminRole } from "@build/db";
import { getPendingVerifications } from "@/actions/admin";
import { AdminFeatureFlag, getAdminV2Route } from "@/lib/config/feature-flags";
import {
  ADMIN_CAPABILITY_ROLE_MAP,
  AdminCapability,
} from "@/lib/security/authorization-policy";

type NavigationSidebarProps = {
  adminRole: AdminRole | null;
  footer: React.ReactNode;
};

type NavigationItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  hoverClassName: string;
  capability?: AdminCapability;
};

function canSeeItem(adminRole: AdminRole | null, capability?: AdminCapability) {
  if (!capability) {
    return true;
  }

  return Boolean(
    adminRole && ADMIN_CAPABILITY_ROLE_MAP[capability].includes(adminRole),
  );
}

async function VerificationBadgeCount() {
  const pendingResponse = await getPendingVerifications({
    status: "PENDING",
    limit: 1,
  });
  const pendingCount = pendingResponse.success
    ? pendingResponse.data?.pagination.total || 0
    : 0;

  if (pendingCount <= 0) {
    return null;
  }

  return (
    <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
      {pendingCount > 99 ? "99+" : pendingCount}
    </span>
  );
}

function NavigationLink({ item }: { item: NavigationItem }) {
  return (
    <Link
      href={item.href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all group"
    >
      <item.Icon
        className={`h-4 w-4 transition-colors ${item.hoverClassName}`}
      />
      {item.label}
    </Link>
  );
}

function NavigationGroup({
  adminRole,
  items,
  title,
}: {
  adminRole: AdminRole | null;
  items: NavigationItem[];
  title: string;
}) {
  const visibleItems = items.filter((item) =>
    canSeeItem(adminRole, item.capability),
  );

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <>
      <p className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 mt-6">
        {title}
      </p>
      {visibleItems.map((item) => (
        <NavigationLink item={item} key={item.href} />
      ))}
    </>
  );
}

export function NavigationSidebar({
  adminRole,
  footer,
}: NavigationSidebarProps) {
  const usersHref = getAdminV2Route(
    AdminFeatureFlag.ADMIN_V2_USER_MANAGEMENT,
    "/users",
    "/users-v2",
  );
  const verificationsHref = getAdminV2Route(
    AdminFeatureFlag.ADMIN_V2_VERIFICATION_QUEUE,
    "/verifications",
    "/verifications-v2",
  );
  const analyticsHref = getAdminV2Route(
    AdminFeatureFlag.ADMIN_V2_FINANCE_DASHBOARD,
    "/analytics",
    "/analytics-v2",
  );
  const auditHref = getAdminV2Route(
    AdminFeatureFlag.ADMIN_V2_AUDIT_LOG_UI,
    "/audit",
    "/audit-v2",
  );

  const managementItems: NavigationItem[] = [
    {
      href: usersHref,
      label: "All Users",
      Icon: Users,
      hoverClassName: "group-hover:text-blue-400",
      capability: AdminCapability.MANAGE_USERS,
    },
    {
      href: "/professionals",
      label: "Professionals",
      Icon: UserCheck,
      hoverClassName: "group-hover:text-purple-400",
      capability: AdminCapability.VIEW_CONTENT,
    },
    {
      href: "/projects",
      label: "Projects",
      Icon: FolderKanban,
      hoverClassName: "group-hover:text-cyan-400",
      capability: AdminCapability.VIEW_CONTENT,
    },
    {
      href: "/stores",
      label: "Stores",
      Icon: Store,
      hoverClassName: "group-hover:text-orange-400",
      capability: AdminCapability.VIEW_CONTENT,
    },
    {
      href: "/properties",
      label: "Properties",
      Icon: Building2,
      hoverClassName: "group-hover:text-teal-400",
      capability: AdminCapability.VIEW_CONTENT,
    },
    {
      href: "/leads",
      label: "Leads",
      Icon: MessageSquare,
      hoverClassName: "group-hover:text-pink-400",
      capability: AdminCapability.VIEW_CONTENT,
    },
    {
      href: "/services",
      label: "Services",
      Icon: Wrench,
      hoverClassName: "group-hover:text-indigo-400",
      capability: AdminCapability.VIEW_CONTENT,
    },
  ];

  const systemItems: NavigationItem[] = [
    {
      href: analyticsHref,
      label: "Analytics",
      Icon: BarChart3,
      hoverClassName: "group-hover:text-emerald-400",
      capability: AdminCapability.VIEW_FINANCIALS,
    },
    {
      href: auditHref,
      label: "Audit Logs",
      Icon: FileText,
      hoverClassName: "group-hover:text-yellow-400",
      capability: AdminCapability.EXPORT_DATA,
    },
    {
      href: "/settings",
      label: "Settings",
      Icon: Settings,
      hoverClassName: "group-hover:text-zinc-300",
      capability: AdminCapability.SYSTEM_ADMIN_ONLY,
    },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-zinc-900 text-white hidden md:flex flex-col border-r border-zinc-800 shadow-xl">
      <div className="h-16 flex items-center px-6 border-b border-zinc-800 bg-zinc-950">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="bg-emerald-600 p-1.5 rounded-lg shadow-lg shadow-emerald-900/20 group-hover:bg-emerald-500 transition-colors">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">
            Admin<span className="text-emerald-500">Panel</span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1">
        <p className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
          Overview
        </p>
        <NavigationLink
          item={{
            href: "/",
            label: "Dashboard",
            Icon: LayoutDashboard,
            hoverClassName: "group-hover:text-emerald-400",
          }}
        />

        {canSeeItem(adminRole, AdminCapability.MANAGE_VERIFICATION) && (
          <>
            <p className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 mt-6">
              Verification
            </p>
            <Link
              href={verificationsHref}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all group"
            >
              <span className="flex items-center gap-3">
                <ClipboardCheck className="h-4 w-4 group-hover:text-amber-400 transition-colors" />
                Verifications
              </span>
              <Suspense fallback={null}>
                <VerificationBadgeCount />
              </Suspense>
            </Link>
          </>
        )}

        <NavigationGroup
          adminRole={adminRole}
          items={managementItems}
          title="Management"
        />
        <NavigationGroup
          adminRole={adminRole}
          items={systemItems}
          title="Analytics & System"
        />
      </nav>

      <div className="p-4 border-t border-zinc-800 bg-zinc-950">{footer}</div>
    </aside>
  );
}
