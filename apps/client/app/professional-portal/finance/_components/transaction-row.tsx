import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { FinanceTransaction } from "@/lib/facades/finance-client";

export interface TransactionRowProps {
  transaction: FinanceTransaction;
}

export function TransactionRow({ transaction }: TransactionRowProps) {
  const { id, description, date, amount, status, type } = transaction;
  const isIncome = type === "INCOME";
  const isWithdrawal = type === "WITHDRAWAL";
  const displayId = id.substring(0, 8).toUpperCase();

  const badgeClassName =
    status === "COMPLETED"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "PENDING"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : status === "FAILED"
          ? "bg-red-50 text-red-700 border-red-200"
          : "bg-zinc-100 text-zinc-500 border-zinc-200";

  return (
    <tr className="hover:bg-zinc-50/50 transition-colors cursor-pointer">
      <td className="px-6 py-4 font-mono text-xs text-zinc-500">
        <Link
          href={`/professional-portal/finance/${id}`}
          className="hover:text-zinc-900 hover:underline"
        >
          {displayId}
        </Link>
      </td>
      <td className="px-6 py-4 font-medium text-zinc-900">
        <Link
          href={`/professional-portal/finance/${id}`}
          className="hover:underline"
        >
          {description}
        </Link>
      </td>
      <td className="px-6 py-4 text-zinc-500">
        <Link href={`/professional-portal/finance/${id}`} className="block">
          {new Date(date).toLocaleDateString("en-KE")}
        </Link>
      </td>
      <td
        className={`px-6 py-4 font-medium ${
          isIncome ? "text-emerald-600" : "text-zinc-900"
        }`}
      >
        <Link href={`/professional-portal/finance/${id}`} className="block">
          {isIncome ? "+" : isWithdrawal ? "-" : ""} KSh{" "}
          {Number(amount).toLocaleString("en-KE")}
        </Link>
      </td>
      <td className="px-6 py-4">
        <Link href={`/professional-portal/finance/${id}`} className="block">
          <Badge variant="outline" className={badgeClassName}>
            {status}
          </Badge>
        </Link>
      </td>
    </tr>
  );
}
