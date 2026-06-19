import { UserButton } from "@clerk/nextjs";
import { ShieldCheck } from "lucide-react";
import { currentUser } from "@clerk/nextjs/server";
import { getAdminPermissions } from "@/actions/admin/_core/permissions";
import { NavigationSidebar } from "@/components/admin/navigation-sidebar";

function formatAdminRole(role: string | null | undefined) {
  return (role ?? "Admin").replace(/_/g, " ").toLowerCase();
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, permissions] = await Promise.all([
    currentUser(),
    getAdminPermissions(),
  ]);

  return (
    <div className="flex min-h-screen bg-zinc-50 font-sans">
      <NavigationSidebar
        adminRole={permissions.granularRole}
        footer={
          <div className="flex items-center gap-3 px-2 py-1">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8 ring-2 ring-zinc-700",
                },
              }}
            />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-white">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="text-[10px] text-zinc-500 capitalize">
                {formatAdminRole(permissions.granularRole)}
              </span>
            </div>
          </div>
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
