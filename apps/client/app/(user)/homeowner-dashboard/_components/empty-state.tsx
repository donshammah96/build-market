"use client";

import Link from "next/link";
import { LayoutTemplate } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

export function EmptyState() {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-zinc-200 p-8 flex flex-col items-center justify-center text-center">
      <div className="h-12 w-12 rounded-full bg-zinc-50 flex items-center justify-center mb-4">
        <LayoutTemplate className="h-6 w-6 text-zinc-300" />
      </div>
      <h3 className="text-lg font-semibold text-zinc-900">
        No active projects
      </h3>
      <p className="text-zinc-500 max-w-sm mt-1 mb-6">
        Ready to start building? Find a verified professional to kickstart your
        dream home.
      </p>
      <Button asChild>
        <Link href={ROUTES.findProfessional}>Find a Pro</Link>
      </Button>
    </div>
  );
}
