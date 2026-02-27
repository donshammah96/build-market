import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  valueClassName?: string;
  iconClassName?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  valueClassName = "text-zinc-900",
  iconClassName = "text-zinc-400",
}: StatCardProps) {
  return (
    <Card className="border border-zinc-200 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${valueClassName}`}>{value}</p>
          </div>
          <Icon className={`h-8 w-8 ${iconClassName}`} />
        </div>
      </CardContent>
    </Card>
  );
}
