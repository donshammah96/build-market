"use client";

import { Bell, Search, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserButton } from "@clerk/nextjs";

export function ProfessionalNavbar() {
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
          <Button variant="outline" className="hidden sm:flex text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300">
            Premium Plan
          </Button>

          <div className="h-6 w-px bg-zinc-200 hidden sm:block" />

          <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-zinc-900 relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2.5 right-2.5 h-2 w-2 bg-red-500 rounded-full border border-white" />
          </Button>

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