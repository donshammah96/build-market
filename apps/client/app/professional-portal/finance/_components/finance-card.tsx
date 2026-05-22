import { Card, CardContent } from "@/components/ui/card";

export interface FinanceCardProps {
  title: string;
  value: string;
  sub: string;
  active?: boolean;
  alert?: boolean;
}

export function FinanceCard({
  title,
  value,
  sub,
  active,
  alert,
}: FinanceCardProps) {
  return (
    <Card
      className={`border shadow-sm ${
        active
          ? "border-emerald-200 bg-emerald-50/30"
          : "border-zinc-200 bg-white"
      }`}
    >
      <CardContent className="p-6">
        <p className="text-sm font-medium text-zinc-500 mb-1">{title}</p>
        <h3
          className={`text-2xl font-bold ${
            alert ? "text-amber-600" : "text-zinc-900"
          }`}
        >
          {value}
        </h3>
        <p className="text-xs text-zinc-400 mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}
