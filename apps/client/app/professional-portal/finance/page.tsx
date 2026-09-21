"use client";

import { useState } from "react";
import { Download, Wallet, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useWithdraw, financeKeys } from "@/hooks/useWithdraw";
import { useProfileStatus } from "@/hooks/useProfileStatus";
import { CapabilityRestrictedBanner } from "@/components/shared/CapabilityRestrictedBanner";
import {
  financeClient,
  type FinanceTransaction,
} from "@/lib/facades/finance-client";
import { WithdrawSchema } from "@/app/lib/validation/finance-validation";
import { FinanceCard } from "./_components/finance-card";
import { TransactionRow } from "./_components/transaction-row";

type WithdrawFormValues = z.infer<typeof WithdrawSchema>;

export default function FinancePage() {
  const { profile } = useProfileStatus();
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);

  const isUnverified =
    profile &&
    (profile as unknown as { verified?: boolean }).verified === false;

  // Fetch Stats
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: financeKeys.stats(),
    queryFn: async () => {
      const res = await financeClient.getStats();
      if (!res.success || res.data === undefined) {
        throw new Error(res.error || "Failed to fetch stats");
      }
      return res.data;
    },
  });

  // Fetch Transactions
  const { data: transactionsData, isLoading: isLoadingTransactions } = useQuery(
    {
      queryKey: financeKeys.transactions(),
      queryFn: async () => {
        const res = await financeClient.getTransactions();
        if (!res.success || res.data === undefined) {
          throw new Error(res.error || "Failed to fetch transactions");
        }
        return res.data;
      },
    },
  );

  const transactions: FinanceTransaction[] = transactionsData?.items ?? [];

  // Withdraw Form — uses domain WithdrawSchema, no local copy
  const form = useForm<WithdrawFormValues>({
    resolver: zodResolver(WithdrawSchema) as Resolver<WithdrawFormValues>,
    defaultValues: {
      amount: 0,
      method: "MPESA",
    },
  });

  // Withdraw Mutation
  const withdrawMutation = useWithdraw({
    onSuccess: () => {
      setIsWithdrawOpen(false);
      toast.success("Withdrawal request submitted");
      form.reset();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  function onSubmit(data: WithdrawFormValues) {
    withdrawMutation.mutate({
      amount: data.amount,
      method: data.method,
    });
  }

  const availableBalance = stats
    ? stats.totalEarnings - (stats.pendingPayouts || 0)
    : null;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {isUnverified && (
        <CapabilityRestrictedBanner
          featureName="Financial Withdrawals"
          verificationStatus={
            (profile as unknown as { verificationStatus?: string })
              .verificationStatus
          }
        />
      )}

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
                    name="method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Withdrawal Method</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="MPESA">M-Pesa</SelectItem>
                            <SelectItem value="BANK_TRANSFER">
                              Bank Transfer
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                      {availableBalance !== null
                        ? availableBalance.toLocaleString("en-KE")
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
              : `KSh ${(stats?.totalEarnings ?? 0).toLocaleString("en-KE")}`
          }
          sub="All time"
          active
        />
        <FinanceCard
          title="Pending Payouts"
          value={
            isLoadingStats
              ? "..."
              : `KSh ${(stats?.pendingPayouts ?? 0).toLocaleString("en-KE")}`
          }
          sub="Available for withdrawal"
        />
        <FinanceCard
          title="Outstanding Invoices"
          value={
            isLoadingStats
              ? "..."
              : `KSh ${(stats?.outstandingInvoices ?? 0).toLocaleString("en-KE")}`
          }
          sub="Total pending payments"
          alert={(stats?.outstandingInvoices ?? 0) > 0}
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
              ) : transactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-zinc-500"
                  >
                    No transactions found.
                  </td>
                </tr>
              ) : (
                transactions.map((txn) => (
                  <TransactionRow key={txn.id} transaction={txn} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
