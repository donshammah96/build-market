"use client";

import Link from "next/link";
import { Search, Menu, UserCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserButton } from "@clerk/nextjs";
import { NotificationsPopover } from "@/components/notifications/NotificationsPopover";
import { MessagesPopover } from "@/components/chat/MessagesPopover";
import { useProfileCompletion } from "@/hooks/useProfileStatus";

export function ProfessionalNavbar() {
  const { percentage, isComplete, isLoading } = useProfileCompletion();

  // Show completion prompt when profile is incomplete
  const showCompletionPrompt = !isLoading && !isComplete && percentage < 100;

  return (
    <header className="sticky top-0 z-40 w-full bg-background border-b border-border h-16">
      <div className="h-full px-4 md:px-8 flex items-center justify-between">
        {/* Mobile Toggle (Hidden on LG) */}
        <div className="flex items-center gap-4 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 text-muted-foreground"
          >
            <Menu className="h-6 w-6" />
          </Button>
          <span className="font-semibold text-foreground">BuildMarket Pro</span>
        </div>

        {/* Search Bar */}
        <div className="hidden lg:flex flex-1 max-w-xl relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects, clients, or invoices..."
            className="pl-9 bg-muted/70 border-border focus:bg-background transition-all w-full"
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
                className="hidden sm:flex items-center gap-2 text-warning border-warning/40 bg-warning/10 hover:bg-warning/20 hover:border-warning/50"
              >
                <UserCircle className="h-4 w-4" />
                <span>Complete Profile</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-warning/30 text-warning">
                  {percentage}%
                </span>
                <ChevronRight className="h-3 w-3 opacity-50" />
              </Button>
            </Link>
          )}

          {!showCompletionPrompt && (
            <Button
              variant="outline"
              className="hidden sm:flex text-primary border-primary/40 bg-primary/10 hover:bg-primary/15 hover:border-primary/50"
            >
              Premium Plan
            </Button>
          )}

          <div className="h-6 w-px bg-border hidden sm:block" />

          <NotificationsPopover />

          <MessagesPopover />

          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-9 w-9",
              },
            }}
          />
        </div>
      </div>
    </header>
  );
}
