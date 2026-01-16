"use client";

import { useState } from "react";
import { Download, Wallet, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const withdrawSchema = z.object({
  amount: z.coerce.number().min(1, "Amount must be at least 1"),
});

type WithdrawFormValues = z.infer<typeof withdrawSchema>;

export default function FinancePage() {
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch Stats
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ["finance-stats"],
    queryFn: async () => {
      const res = await fetch("/api/professional-portal/finance/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  // Fetch Transactions
  const { data: transactionsData, isLoading: isLoadingTransactions } = useQuery(
    {
      queryKey: ["transactions"],
      queryFn: async () => {
        const res = await fetch(
          "/api/professional-portal/finance/transactions"
        );
        if (!res.ok) throw new Error("Failed to fetch transactions");
        return res.json();
      },
    }
  );

  const transactions = Array.isArray(transactionsData?.data)
    ? transactionsData.data
    : [];

  // Withdraw Form
  const form = useForm<WithdrawFormValues>({
    resolver: zodResolver(withdrawSchema) as Resolver<WithdrawFormValues>,
    defaultValues: {
      amount: 0,
    },
  });

  // Withdraw Mutation
  const withdrawMutation = useMutation({
    mutationFn: async (data: WithdrawFormValues) => {
      const res = await fetch("/api/professional-portal/finance/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to withdraw funds");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-stats"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setIsWithdrawOpen(false);
      toast.success("Withdrawal request submitted");
      form.reset();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function onSubmit(data: WithdrawFormValues) {
    withdrawMutation.mutate(data);
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-end border-b border-zinc-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
            Financial Overview
          </h1>
          <p className="text-zinc-500 mt-1">
            Track earnings, invoices, and payouts.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="bg-white">
            <Download className="mr-2 h-4 w-4" /> Export Report
          </Button>

          <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
            <DialogTrigger asChild>
              <Button className="bg-zinc-900 text-white hover:bg-zinc-800">
                <Wallet className="mr-2 h-4 w-4" /> Withdraw Funds
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Withdraw Funds</DialogTitle>
                <DialogDescription>
                  Request a payout to your connected account.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount (KSh)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="text-sm text-zinc-500">
                    <p>
                      Available Balance: KSh{" "}
                      {stats?.totalEarnings
                        ? (
                            stats.totalEarnings - (stats.pendingPayouts || 0)
                          ).toLocaleString()
                        : "..."}
                    </p>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={withdrawMutation.isPending}>
                      {withdrawMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Request Withdrawal
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FinanceCard
          title="Total Earnings"
          value={
            isLoadingStats
              ? "..."
              : `KSh ${stats?.totalEarnings?.toLocaleString() || "0"}`
          }
          sub="All time"
          active
        />
        <FinanceCard
          title="Pending Payouts"
          value={
            isLoadingStats
              ? "..."
              : `KSh ${stats?.pendingPayouts?.toLocaleString() || "0"}`
          }
          sub="Available for withdrawal"
        />
        <FinanceCard
          title="Outstanding Invoices"
          value={
            isLoadingStats
              ? "..."
              : `KSh ${stats?.outstandingInvoices?.toLocaleString() || "0"}`
          }
          sub="Total pending payments"
          alert={stats?.outstandingInvoices > 0}
        />
      </div>

      {/* Transactions Table */}
      <Card className="border border-zinc-200 shadow-sm bg-white">
        <CardHeader className="border-b border-zinc-100 py-4 px-6">
          <CardTitle className="text-base font-bold text-zinc-900">
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 text-zinc-500 font-medium">
              <tr>
                <th className="px-6 py-3">Transaction ID</th>
                <th className="px-6 py-3">Description</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoadingTransactions ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-zinc-500"
                  >
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading transactions...
                  </td>
                </tr>
              ) : transactions?.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-zinc-500"
                  >
                    No transactions found.
                  </td>
                </tr>
              ) : (
                transactions?.map(
                  (txn: {
                    id: string;
                    description: string;
                    date: string | number | Date;
                    amount: number;
                    status: "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";
                    type: "INCOME" | "WITHDRAWAL" | "EXPENSE";
                  }) => (
                    <TransactionRow
                      key={txn.id}
                      transactionId={txn.id}
                      id={txn.id.substring(0, 8).toUpperCase()}
                      desc={txn.description}
                      date={new Date(txn.date).toLocaleDateString()}
                      amount={`KSh ${Number(txn.amount).toLocaleString()}`}
                      status={txn.status}
                      type={txn.type}
                    />
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

interface FinanceCardProps {
  title: string;
  value: string;
  sub: string;
  active?: boolean;
  alert?: boolean;
}

function FinanceCard({ title, value, sub, active, alert }: FinanceCardProps) {
  return (
    <Card
      className={`border shadow-sm ${active ? "border-emerald-200 bg-emerald-50/30" : "border-zinc-200 bg-white"}`}
    >
      <CardContent className="p-6">
        <p className="text-sm font-medium text-zinc-500 mb-1">{title}</p>
        <h3
          className={`text-2xl font-bold ${alert ? "text-amber-600" : "text-zinc-900"}`}
        >
          {value}
        </h3>
        <p className="text-xs text-zinc-400 mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

interface TransactionRowProps {
  transactionId: string;
  id: string;
  desc: string;
  date: string;
  amount: string;
  status: string;
  type: string;
}

function TransactionRow({
  transactionId,
  id,
  desc,
  date,
  amount,
  status,
  type,
}: TransactionRowProps) {
  const isIncome = type === "INCOME";
  const isWithdrawal = type === "WITHDRAWAL";

  return (
    <tr className="hover:bg-zinc-50/50 transition-colors cursor-pointer">
      <td className="px-6 py-4 font-mono text-xs text-zinc-500">
        <Link
          href={`/professional-portal/finance/${transactionId}`}
          className="hover:text-zinc-900 hover:underline"
        >
          {id}
        </Link>
      </td>
      <td className="px-6 py-4 font-medium text-zinc-900">
        <Link
          href={`/professional-portal/finance/${transactionId}`}
          className="hover:underline"
        >
          {desc}
        </Link>
      </td>
      <td className="px-6 py-4 text-zinc-500">
        <Link
          href={`/professional-portal/finance/${transactionId}`}
          className="block"
        >
          {date}
        </Link>
      </td>
      <td
        className={`px-6 py-4 font-medium ${isIncome ? "text-emerald-600" : "text-zinc-900"}`}
      >
        <Link
          href={`/professional-portal/finance/${transactionId}`}
          className="block"
        >
          {isIncome ? "+" : isWithdrawal ? "-" : ""} {amount}
        </Link>
      </td>
      <td className="px-6 py-4">
        <Link
          href={`/professional-portal/finance/${transactionId}`}
          className="block"
        >
          <Badge
            variant="outline"
            className={
              status === "COMPLETED"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : status === "PENDING"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : status === "FAILED"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-zinc-100 text-zinc-500 border-zinc-200"
            }
          >
            {status}
          </Badge>
        </Link>
      </td>
    </tr>
  );
}
