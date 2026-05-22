import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type DetailItem = {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
};

type StatItem = {
  label: string;
  value: ReactNode;
};

type DetailsCardProps = {
  title: string;
  titleIcon?: LucideIcon;
  items: DetailItem[];
};

type StatsCardProps = {
  title?: string;
  items: StatItem[];
};

type HeroStatItem = {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
};

type ProfileHeroCardProps = {
  fullName?: string;
  initials: string;
  avatarUrl?: string | null;
  verified?: boolean;
  companyName: string;
  licenseNumber?: string | null;
  highlight?: ReactNode;
  stats: HeroStatItem[];
};

export function ProfileHeroCard({
  fullName,
  initials,
  avatarUrl,
  verified = false,
  companyName,
  licenseNumber,
  highlight,
  stats,
}: ProfileHeroCardProps) {
  return (
    <Card className="border border-zinc-200 shadow-sm bg-white">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="shrink-0">
            <Avatar className="h-32 w-32 rounded-lg border-2 border-zinc-100">
              <AvatarImage
                src={avatarUrl || ""}
                alt={fullName || companyName}
              />
              <AvatarFallback className="rounded-lg text-3xl bg-zinc-100">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
              <div>
                {fullName ? (
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold text-zinc-900">
                      {fullName}
                    </h2>
                    {verified ? (
                      <Badge className="bg-emerald-600 text-white">
                        Verified
                      </Badge>
                    ) : null}
                  </div>
                ) : null}
                <p className="text-xl text-zinc-600 font-medium mb-2">
                  {companyName}
                </p>
                {licenseNumber ? (
                  <p className="text-sm text-zinc-500">
                    License: {licenseNumber}
                  </p>
                ) : null}
              </div>

              {highlight}
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {stats.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={`${item.label}`}
                    className="flex items-center gap-2"
                  >
                    <Icon className="h-5 w-5 text-zinc-400" />
                    <div>
                      <p className="text-sm text-zinc-600">{item.label}</p>
                      <p className="font-semibold">{item.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProfileDetailsCard({
  title,
  titleIcon: TitleIcon,
  items,
}: DetailsCardProps) {
  return (
    <Card className="border border-zinc-200 shadow-sm bg-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {TitleIcon ? <TitleIcon className="h-5 w-5" /> : null}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item, index) => {
          const ItemIcon = item.icon;

          return (
            <div key={`${title}-${item.label}`}>
              {index > 0 ? <Separator className="mb-4" /> : null}
              <label
                className={
                  ItemIcon
                    ? "text-sm font-medium text-zinc-500 mb-1 flex items-center gap-1"
                    : "text-sm font-medium text-zinc-500 mb-1 block"
                }
              >
                {ItemIcon ? <ItemIcon className="h-3 w-3" /> : null}
                {item.label}
              </label>
              {item.value}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function ProfileStatsCard({
  title = "Statistics",
  items,
}: StatsCardProps) {
  return (
    <Card className="border border-zinc-200 shadow-sm bg-white">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item, index) => (
          <div key={`${title}-${item.label}`}>
            {index > 0 ? <Separator className="mb-4" /> : null}
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">{item.label}</span>
              <span className="font-semibold text-zinc-900">{item.value}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
