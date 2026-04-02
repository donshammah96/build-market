"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Clock, Phone, ChevronRight, Users } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { LeadData } from "@/lib/dashboard";
import { WidgetEmptyState } from "../shared";

// ============================================================================
// TYPES
// ============================================================================

export interface LeadsWidgetProps {
  /** Leads data */
  leads?: LeadData[];
  /** Loading state */
  isLoading?: boolean;
  /** Count of new leads for badge */
  newLeadsCount?: number;
  /** Optional className */
  className?: string;
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface LeadItemProps {
  lead: LeadData;
}

function LeadItem({ lead }: LeadItemProps) {
  const router = useRouter();
  const [isReplyPending, startReplyTransition] = useTransition();
  const isClosedLead = lead.status === "won" || lead.status === "lost";
  const isLeadAtRisk = lead.status === "lost";
  const isLeadHealthy = lead.status === "proposal" || lead.status === "contacted";

  const handleReply = () => {
    startReplyTransition(() => {
      router.push("/professional-portal/leads");
    });
  };

  return (
    <div className="p-6 hover:bg-muted/50 motion-safe:transition-colors group flex flex-col sm:flex-row gap-5 items-start sm:items-center">
      <Avatar className="h-12 w-12 border border-border shadow-sm">
        <AvatarImage src={lead.avatar} />
        <AvatarFallback className="bg-muted text-muted-foreground font-medium">
          {lead.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-foreground">{lead.name}</h4>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
            <Clock className="h-3 w-3" /> {lead.receivedAt}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {lead.project} <span className="text-border mx-1">•</span>{" "}
          {lead.location}
        </p>
        <div className="flex items-center gap-3 pt-1">
          <span className="text-xs font-medium text-foreground bg-muted px-2 py-0.5 rounded border border-border">
            {lead.budget}
          </span>
          {lead.status === "new" && (
            <span className="flex h-2 w-2 relative">
              <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 w-full sm:w-auto pt-2 sm:pt-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 motion-safe:transition-opacity duration-200">
        <Button
          size="sm"
          className="flex-1 min-h-11 shadow-sm motion-safe:active:scale-[0.98]"
          isLoading={isReplyPending}
          loadingText="Opening..."
          isError={isLeadAtRisk}
          isSuccess={isLeadHealthy}
          disabled={isClosedLead}
          onClick={handleReply}
        >
          Reply
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="border-border text-muted-foreground hover:text-foreground h-11 w-11 motion-safe:active:scale-[0.98] focus-visible:ring-focus-ring"
          isError={isLeadAtRisk}
          isSuccess={isLeadHealthy}
          disabled={isClosedLead}
        >
          <Phone className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// LOADING STATE
// ============================================================================

function LeadsWidgetSkeleton() {
  return (
    <Card className="border border-border shadow-sm overflow-hidden bg-card">
      <CardHeader className="border-b border-border py-5 px-6">
        <div className="flex items-center gap-2">
          <div className="h-5 w-32 bg-muted rounded motion-safe:animate-pulse" />
          <div className="h-5 w-12 bg-muted rounded-full motion-safe:animate-pulse" />
        </div>
      </CardHeader>
      <div className="divide-y divide-border">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-6 flex gap-5 items-center motion-safe:animate-pulse"
          >
            <div className="h-12 w-12 bg-muted rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-3 w-48 bg-muted rounded" />
              <div className="h-5 w-20 bg-muted rounded" />
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

export function LeadsWidget({
  leads = [],
  isLoading = false,
  newLeadsCount,
  className,
}: LeadsWidgetProps) {
  if (isLoading) {
    return <LeadsWidgetSkeleton />;
  }

  const displayNewCount =
    newLeadsCount ?? leads.filter((l) => l.status === "new").length;

  return (
    <Card
      className={cn(
        "border border-border shadow-sm overflow-hidden bg-card",
        className,
      )}
    >
      <CardHeader className="border-b border-border py-5 px-6 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-bold text-foreground">
            Recent Inquiries
          </CardTitle>
          {displayNewCount > 0 && (
            <div className="h-5 px-2 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center">
              {displayNewCount} NEW
            </div>
          )}
        </div>
        <Link
          href="/professional-portal/leads"
          className="text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-sm min-h-11 px-2 py-1.5 inline-flex items-center gap-1 group motion-safe:transition-colors motion-safe:active:scale-[0.98]"
        >
          View Pipeline{" "}
          <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 motion-safe:transition-transform" />
        </Link>
      </CardHeader>

      {leads.length === 0 ? (
        <WidgetEmptyState
          icon={Users}
          title="No leads yet"
          description="New inquiries will appear here"
        />
      ) : (
        <div className="divide-y divide-border">
          {leads.slice(0, 5).map((lead) => (
            <LeadItem key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </Card>
  );
}

export default LeadsWidget;
