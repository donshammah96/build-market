import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare } from "lucide-react";

export default function ProfessionalMessagesLoading() {
  return (
    <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6">
      {/* Left: Conversation list skeleton */}
      <div className="w-full md:w-1/3 lg:w-1/4 h-full">
        <Card className="h-full border-zinc-200 overflow-hidden">
          <div className="p-4 border-b border-zinc-100">
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <div className="divide-y divide-zinc-100">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Right: Empty chat state skeleton */}
      <div className="w-full md:w-2/3 lg:w-3/4 h-full hidden md:flex">
        <Card className="h-full flex-1 flex items-center justify-center bg-zinc-50 border-dashed">
          <div className="text-center p-8">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 text-zinc-300" />
            <Skeleton className="h-6 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </div>
        </Card>
      </div>
    </div>
  );
}
