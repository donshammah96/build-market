"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronRight, Image as ImageIcon, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface PortfolioItem {
  id: string;
  title: string;
  imageUrl: string;
  category?: string;
}

export interface PortfolioWidgetProps {
  /** Portfolio items */
  items?: PortfolioItem[];
  /** Loading state */
  isLoading?: boolean;
  /** Optional className */
  className?: string;
}

// ============================================================================
// LOADING STATE
// ============================================================================

function PortfolioWidgetSkeleton() {
  return (
    <Card className="border border-border shadow-sm bg-card">
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="h-3 w-32 bg-muted rounded motion-safe:animate-pulse" />
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="aspect-square bg-muted rounded-lg motion-safe:animate-pulse"
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PortfolioWidget({
  items = [],
  isLoading = false,
  className,
}: PortfolioWidgetProps) {
  const router = useRouter();
  const [isAddWorkPending, startAddWorkTransition] = useTransition();
  const [isViewMorePending, startViewMoreTransition] = useTransition();

  if (isLoading) {
    return <PortfolioWidgetSkeleton />;
  }

  // Ensure items is always an array
  const safeItems = Array.isArray(items) ? items : [];

  const handleAddWork = () => {
    startAddWorkTransition(() => {
      router.push("/professional-portal/portfolio/new");
    });
  };

  const handleViewMore = () => {
    startViewMoreTransition(() => {
      router.push("/professional-portal/portfolio");
    });
  };

  return (
    <Card className={cn("border border-border shadow-sm bg-card", className)}>
      <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Portfolio
        </CardTitle>
        <Link
          href="/professional-portal/portfolio"
          className="text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-sm min-h-11 px-2 py-1.5 inline-flex items-center gap-1 group motion-safe:transition-colors motion-safe:active:scale-[0.98]"
        >
          View All{" "}
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 motion-safe:transition-transform" />
        </Link>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {safeItems.length === 0 ? (
          <div className="text-center py-6">
            <ImageIcon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground mb-3">
              No portfolio items yet
            </p>
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 motion-safe:active:scale-[0.98]"
              isLoading={isAddWorkPending}
              loadingText="Opening..."
              onClick={handleAddWork}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Work
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {safeItems.slice(0, 4).map((item) => (
                <Link
                  key={item.id}
                  href={`/professional-portal/portfolio/${item.id}`}
                  className="group relative aspect-square rounded-lg overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-safe:active:scale-[0.98]"
                >
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    className="object-cover motion-safe:transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card/95 via-card/20 to-transparent opacity-0 group-hover:opacity-100 motion-safe:transition-opacity" />
                  <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 motion-safe:transition-opacity">
                    <p className="text-[10px] font-medium text-card-foreground truncate">
                      {item.title}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            {safeItems.length > 4 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground min-h-11 motion-safe:active:scale-[0.98]"
                isLoading={isViewMorePending}
                loadingText="Opening..."
                onClick={handleViewMore}
              >
                +{safeItems.length - 4} more items
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default PortfolioWidget;
