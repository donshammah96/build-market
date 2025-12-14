import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { 
  LayoutDashboard, 
  Users, 
  UserCheck, 
  Settings, 
  ShieldCheck, 
  Menu 
} from "lucide-react";
import { syncUserRole } from "@/lib/auth-sync";
import { currentUser } from "@clerk/nextjs/server";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await syncUserRole();
  const user = await currentUser();

  return (
    <div className="flex min-h-screen bg-zinc-50 font-sans">
      
      {/* --- Sidebar (Desktop) --- */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-zinc-900 text-white hidden md:flex flex-col border-r border-zinc-800 shadow-xl">
        
        {/* Brand */}
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
        
        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1">
          <p className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Overview</p>
          
          <Link 
            href="/" 
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all group"
          >
            <LayoutDashboard className="h-4 w-4 group-hover:text-emerald-400 transition-colors" />
            Dashboard
          </Link>
          
          <p className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 mt-6">Management</p>

          <Link 
            href="/users" 
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all group"
          >
            <Users className="h-4 w-4 group-hover:text-blue-400 transition-colors" />
            All Users
          </Link>
          <Link 
            href="/professionals" 
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all group"
          >
            <UserCheck className="h-4 w-4 group-hover:text-amber-400 transition-colors" />
            Professionals
          </Link>
          <Link 
            href="/projects" 
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all group"
          >
            <UserCheck className="h-4 w-4 group-hover:text-amber-400 transition-colors" />
            Projects
          </Link>
          <Link 
            href="/settings" 
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all group"
          >
            <Settings className="h-4 w-4 group-hover:text-zinc-300 transition-colors" />
            Settings
          </Link>
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950">
          <div className="flex items-center gap-3 px-2 py-1">
            <UserButton 
              afterSignOutUrl="/sign-in"
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8 ring-2 ring-zinc-700"
                }
              }}
            />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-white">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="text-[10px] text-zinc-500 capitalize">{user?.publicMetadata?.role as string || "Admin"}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* --- Main Content --- */}
      <main className="flex-1 md:pl-64 flex flex-col min-h-0 overflow-hidden">
        
        {/* Mobile Header */}
        <header className="h-16 border-b border-zinc-200 flex items-center justify-between px-4 bg-white sticky top-0 z-30 md:hidden">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-emerald-600" />
              <span className="font-bold text-lg text-zinc-900">AdminPanel</span>
            </div>
            <UserButton afterSignOutUrl="/sign-in" />
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            {children}
        </div>
      </main>
    </div>
  );
}