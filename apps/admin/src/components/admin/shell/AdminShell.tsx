import { UserButton } from "@clerk/nextjs";
import { ShieldCheck } from "lucide-react";
import type { AdminRole } from "@build/db";
import { NavigationSidebar } from "@/components/admin/navigation-sidebar";
import { AdminUserMenu } from "./AdminUserMenu";

export interface AdminShellProps {
  adminRole?: AdminRole | string | null | undefined;
  displayName?: string | null | undefined;
  children: React.ReactNode;
}

export function AdminShell({
  adminRole,
  displayName,
  children,
}: AdminShellProps) {
  const resolvedRole = (adminRole ?? null) as AdminRole | null;

  return (
    <div className="flex min-h-screen bg-zinc-50 font-sans">
      <NavigationSidebar
        adminRole={resolvedRole}
        footer={
          <AdminUserMenu adminRole={adminRole} displayName={displayName} />
        }
      />

      {/* --- Main Content --- */}
      <main className="flex-1 md:pl-64 flex flex-col min-h-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="h-16 border-b border-zinc-200 flex items-center justify-between px-4 bg-white sticky top-0 z-30 md:hidden">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
            <span className="font-bold text-lg text-zinc-900">AdminPanel</span>
          </div>
          <UserButton />
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
