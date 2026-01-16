"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  UserCheck,
  Store,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import type { VerificationStats } from "@/actions/admin";

interface VerificationStatsCardsProps {
  stats: VerificationStats;
}

export function VerificationStatsCards({ stats }: VerificationStatsCardsProps) {
  const cards = [
    {
      title: "Pending Review",
      value: stats.pending.total,
      description: `${stats.pending.professionals} professionals, ${stats.pending.stores} stores, ${stats.pending.properties} properties`,
      icon: Clock,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      trend: null,
    },
    {
      title: "Verified",
      value: stats.verified.total,
      description: "Successfully verified this month",
      icon: CheckCircle2,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      trend: "up" as const,
    },
    {
      title: "Rejected",
      value: stats.rejected.total,
      description: "Rejected submissions",
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      trend: "down" as const,
    },
    {
      title: "Needs Correction",
      value: stats.needsCorrection.total,
      description: "Awaiting resubmission",
      icon: AlertTriangle,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      trend: null,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{card.value}</span>
              {card.trend && (
                <Badge
                  variant={card.trend === "up" ? "default" : "destructive"}
                  className="text-xs"
                >
                  {card.trend === "up" ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {card.trend === "up" ? "+12%" : "-5%"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Entity type breakdown mini cards
export function EntityBreakdown({
  stats,
  status,
}: {
  stats: VerificationStats;
  status: "pending" | "verified" | "rejected" | "needsCorrection";
}) {
  const data = stats[status];

  const entities = [
    {
      label: "Professionals",
      value: data.professionals,
      icon: UserCheck,
      color: "text-blue-500",
    },
    {
      label: "Stores",
      value: data.stores,
      icon: Store,
      color: "text-purple-500",
    },
    {
      label: "Properties",
      value: data.properties,
      icon: Building2,
      color: "text-emerald-500",
    },
  ];

  return (
    <div className="flex gap-4">
      {entities.map((entity) => (
        <div
          key={entity.label}
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <entity.icon className={`h-4 w-4 ${entity.color}`} />
          <span>
            {entity.value} {entity.label}
          </span>
        </div>
      ))}
    </div>
  );
}
