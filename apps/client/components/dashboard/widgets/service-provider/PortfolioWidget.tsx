"use client";

import Link from "next/link";
import Image from "next/image";
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
    <Card className="border border-zinc-200 shadow-sm bg-white">
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="h-3 w-32 bg-zinc-200 rounded animate-pulse" />
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="aspect-square bg-zinc-200 rounded-lg animate-pulse"
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
  if (isLoading) {
    return <PortfolioWidgetSkeleton />;
  }

  // Ensure items is always an array
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <Card
      className={cn("border border-zinc-200 shadow-sm bg-white", className)}
    >
      <CardHeader className="pb-3 pt-5 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
          Portfolio
        </CardTitle>
        <Link
          href="/professional-portal/portfolio"
          className="text-xs font-medium text-zinc-500 hover:text-zinc-900 flex items-center gap-1 group"
        >
          View All{" "}
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {safeItems.length === 0 ? (
          <div className="text-center py-6">
            <ImageIcon className="h-10 w-10 text-zinc-200 mx-auto mb-2" />
            <p className="text-xs text-zinc-500 mb-3">No portfolio items yet</p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/professional-portal/portfolio/new">
                <Plus className="h-3 w-3 mr-1" />
                Add Work
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {safeItems.slice(0, 4).map((item) => (
                <Link
                  key={item.id}
                  href={`/professional-portal/portfolio/${item.id}`}
                  className="group relative aspect-square rounded-lg overflow-hidden bg-zinc-100"
                >
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] font-medium text-white truncate">
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
                className="w-full mt-3 text-xs text-zinc-500 hover:text-zinc-900"
                asChild
              >
                <Link href="/professional-portal/portfolio">
                  +{safeItems.length - 4} more items
                </Link>
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default PortfolioWidget;
