"use client";

import Link from "next/link";
import {
  Clock,
  Phone,
  ChevronRight,
  MessageSquare,
  Eye,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { PropertyInquiryData } from "@/lib/dashboard";

// ============================================================================
// TYPES
// ============================================================================

export interface InquiriesWidgetProps {
  /** Property inquiries data */
  inquiries?: PropertyInquiryData[];
  /** Loading state */
  isLoading?: boolean;
  /** Number of new inquiries for badge */
  newCount?: number;
  /** Optional className */
  className?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const STATUS_CONFIG = {
  new: {
    label: "New",
    icon: MessageSquare,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  contacted: {
    label: "Contacted",
    icon: Phone,
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  viewing_scheduled: {
    label: "Viewing",
    icon: Eye,
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
  offer_made: {
    label: "Offer",
    icon: FileText,
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  closed: {
    label: "Closed",
    icon: CheckCircle2,
    color: "bg-zinc-100 text-zinc-600 border-zinc-200",
  },
} as const;

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface InquiryItemProps {
  inquiry: PropertyInquiryData;
}

function InquiryItem({ inquiry }: InquiryItemProps) {
  const statusConfig = STATUS_CONFIG[inquiry.status];

  // Format relative time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHrs / 24);

    if (diffHrs < 1) return "Just now";
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays}d ago`;
  };

  return (
    <div className="p-5 hover:bg-zinc-50/50 transition-colors group">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <Avatar className="h-10 w-10 border border-zinc-100 shrink-0">
          <AvatarFallback className="bg-zinc-100 text-zinc-500 font-medium text-sm">
            {inquiry.clientName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <h4 className="text-sm font-semibold text-zinc-900">
                {inquiry.clientName}
              </h4>
              <p className="text-xs text-zinc-500 truncate">
                {inquiry.propertyTitle}
              </p>
            </div>
            <span className="text-[10px] text-zinc-400 shrink-0 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(inquiry.createdAt)}
            </span>
          </div>

          {/* Message Preview */}
          <p className="text-xs text-zinc-600 line-clamp-2 mt-2 mb-3">
            &quot;{inquiry.message}&quot;
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-medium border",
                statusConfig.color,
              )}
            >
              {statusConfig.label}
            </Badge>

            <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                asChild
              >
                <Link href={`tel:${inquiry.clientPhone}`}>
                  <Phone className="h-3 w-3 mr-1" />
                  Call
                </Link>
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs bg-zinc-900 hover:bg-zinc-800"
              >
                Reply
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// LOADING STATE
// ============================================================================

function InquiriesWidgetSkeleton() {
  return (
    <Card className="border border-zinc-200 shadow-sm overflow-hidden bg-white">
      <CardHeader className="border-b border-zinc-100 py-5 px-6">
        <div className="flex items-center gap-2 animate-pulse">
          <div className="h-5 w-36 bg-zinc-200 rounded" />
          <div className="h-5 w-14 bg-zinc-200 rounded-full" />
        </div>
      </CardHeader>
      <div className="divide-y divide-zinc-100">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-5 flex gap-4 animate-pulse">
            <div className="h-10 w-10 bg-zinc-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-zinc-200 rounded" />
              <div className="h-3 w-48 bg-zinc-200 rounded" />
              <div className="h-10 w-full bg-zinc-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function InquiriesWidget({
  inquiries = [],
  isLoading = false,
  newCount,
  className,
}: InquiriesWidgetProps) {
  if (isLoading) {
    return <InquiriesWidgetSkeleton />;
  }

  const displayNewCount =
    newCount ?? inquiries.filter((i) => i.status === "new").length;

  return (
    <Card
      className={cn(
        "border border-zinc-200 shadow-sm overflow-hidden bg-white",
        className,
      )}
    >
      <CardHeader className="border-b border-zinc-100 py-5 px-6 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-bold text-zinc-900">
            Property Inquiries
          </CardTitle>
          {displayNewCount > 0 && (
            <div className="h-5 px-2 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center">
              {displayNewCount} NEW
            </div>
          )}
        </div>
        <Link
          href="/professional-portal/inquiries"
          className="text-xs font-medium text-zinc-500 hover:text-zinc-900 flex items-center gap-1 group"
        >
          View All{" "}
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </CardHeader>

      {inquiries.length === 0 ? (
        <div className="p-12 text-center">
          <MessageSquare className="h-12 w-12 text-zinc-200 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No inquiries yet</p>
          <p className="text-xs text-zinc-400 mt-1">
            Client inquiries will appear here
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {inquiries.slice(0, 4).map((inquiry) => (
            <InquiryItem key={inquiry.id} inquiry={inquiry} />
          ))}
        </div>
      )}
    </Card>
  );
}

export default InquiriesWidget;
