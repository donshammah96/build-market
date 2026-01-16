"use client";

import Link from "next/link";
import { Search, Menu, UserCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserButton } from "@clerk/nextjs";
import { NotificationsPopover } from "@/components/notifications/NotificationsPopover";
import { MessagesPopover } from "@/components/chat/MessagesPopover";
import { useProfileCompletion } from "@/hooks/useProfileStatus";
import { cn } from "@/lib/utils";

export function ProfessionalNavbar() {
  const { percentage, isComplete, isLoading } = useProfileCompletion();

  // Show completion prompt when profile is incomplete
  const showCompletionPrompt = !isLoading && !isComplete && percentage < 100;

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-zinc-200 h-16">
      <div className="h-full px-4 md:px-8 flex items-center justify-between">
        
        {/* Mobile Toggle (Hidden on LG) */}
        <div className="flex items-center gap-4 lg:hidden">
          <Button variant="ghost" size="icon" className="-ml-2 text-zinc-500">
            <Menu className="h-6 w-6" />
          </Button>
          <span className="font-semibold text-zinc-900">BuildMarket Pro</span>
        </div>

        {/* Search Bar */}
        <div className="hidden lg:flex flex-1 max-w-xl relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input 
            placeholder="Search projects, clients, or invoices..." 
            className="pl-9 bg-zinc-50 border-zinc-200 focus:bg-white transition-all w-full"
          />
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Profile Completion Button - shown when incomplete */}
          {showCompletionPrompt && (
            <Link href="/professional-portal/settings/complete-profile">
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "hidden sm:flex items-center gap-2",
                  percentage < 50
                    ? "text-orange-600 border-orange-200 bg-orange-50 hover:bg-orange-100 hover:border-orange-300"
                    : "text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100 hover:border-amber-300"
                )}
              >
                <UserCircle className="h-4 w-4" />
                <span>Complete Profile</span>
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                  percentage < 50 ? "bg-orange-200 text-orange-700" : "bg-amber-200 text-amber-700"
                )}>
                  {percentage}%
                </span>
                <ChevronRight className="h-3 w-3 opacity-50" />
              </Button>
            </Link>
          )}

          {!showCompletionPrompt && (
            <Button variant="outline" className="hidden sm:flex text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300">
              Premium Plan
            </Button>
          )}

          <div className="h-6 w-px bg-zinc-200 hidden sm:block" />

          <NotificationsPopover />

          <MessagesPopover />

          <UserButton 
             appearance={{
                elements: {
                  avatarBox: "h-9 w-9"
                }
             }}
          />
        </div>
      </div>
    </header>
  );
}