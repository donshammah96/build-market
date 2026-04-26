"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ArrowLeft,
  DollarSign,
  Calendar,
  FileText,
  Loader2,
  Edit,
  XCircle,
  AlertCircle,
  CheckCircle,
  Clock,
  Building2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/text-area";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { financeClient, type FinanceTransaction } from "@/lib/finance-client";

// Schema for updating a transaction
const updateTransactionSchema = z.object({
  description: z.string().min(1, "Description is required"),
});

type UpdateTransactionFormValues = z.infer<typeof updateTransactionSchema>;

const statusConfig: Record<
  string,
  { color: string; icon: React.ReactNode; label: string }
> = {
  PENDING: {
    color: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <Clock className="h-4 w-4" />,
    label: "Pending",
  },
  COMPLETED: {
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <CheckCircle className="h-4 w-4" />,
    label: "Completed",
  },
  FAILED: {
    color: "bg-red-50 text-red-700 border-red-200",
    icon: <XCircle className="h-4 w-4" />,
    label: "Failed",
  },
  CANCELLED: {
    color: "bg-zinc-100 text-zinc-500 border-zinc-200",
    icon: <XCircle className="h-4 w-4" />,
    label: "Cancelled",
  },
};

const typeConfig: Record<
  string,
  { color: string; label: string; prefix: string }
> = {
  INCOME: {
    color: "text-emerald-600",
    label: "Income",
    prefix: "+",
  },
  WITHDRAWAL: {
    color: "text-red-600",
    label: "Withdrawal",
    prefix: "-",
  },
  EXPENSE: {
    color: "text-amber-600",
    label: "Expense",
    prefix: "-",
  },
};

export default function TransactionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Fetch Transaction
  const {
    data: transaction,
    isLoading,
    error,
  } = useQuery<FinanceTransaction>({
    queryKey: ["transaction", id],
    queryFn: async () => {
      const res = await financeClient.getTransaction(id);
      if (!res.success || res.data === undefined) {
        throw new Error(res.error || "Failed to fetch transaction");
      }
      return res.data;
    },
    enabled: !!id,
  });

  // Update Transaction Mutation
  const updateTransactionMutation = useMutation({
    mutationFn: async (data: UpdateTransactionFormValues) => {
      const res = await financeClient.updateTransaction({
        transactionId: id,
        data: {
          description: data.description,
        },
      });
      if (!res.success) {
        throw new Error(res.error || "Failed to update transaction");
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction", id] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["finance-stats"] });
      setIsEditOpen(false);
      toast.success("Transaction updated successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update transaction");
    },
  });

  // Delete Transaction Mutation
  const deleteTransactionMutation = useMutation({
    mutationFn: async () => {
      const res = await financeClient.deleteTransaction({
        transactionId: id,
      });
      if (!res.success) {
        throw new Error(res.error || "Failed to delete transaction");
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["finance-stats"] });
      toast.success("Transaction deleted successfully");
      router.push("/professional-portal/finance");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete transaction");
    },
  });

  const form = useForm<UpdateTransactionFormValues>({
    resolver: zodResolver(updateTransactionSchema),
    defaultValues: {
      description: transaction?.description || "",
    },
  });

  // Update form when transaction data loads
  if (transaction && form.getValues().description === "") {
    form.reset({
      description: transaction.description,
    });
  }

  function onSubmit(data: UpdateTransactionFormValues) {
    updateTransactionMutation.mutate(data);
  }

  const handleDelete = () => {
    deleteTransactionMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-400 mx-auto">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-zinc-200 animate-pulse rounded" />
          <div className="space-y-2">
            <div className="h-8 w-64 bg-zinc-200 animate-pulse rounded" />
            <div className="h-4 w-32 bg-zinc-200 animate-pulse rounded" />
          </div>
        </div>
        <Card className="p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            <span className="ml-3 text-zinc-500">Loading transaction...</span>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="space-y-6 max-w-400 mx-auto">
        <Button variant="ghost" asChild>
          <Link href="/professional-portal/finance">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Finance
          </Link>
        </Button>
        <Card className="p-8">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">
              Transaction Not Found
            </h2>
            <p className="text-zinc-500 mb-4">
              {error instanceof Error
                ? error.message
                : "The transaction you're looking for doesn't exist."}
            </p>
            <Button asChild>
              <Link href="/professional-portal/finance">Back to Finance</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const status = (statusConfig[transaction.status] ?? statusConfig.PENDING) as {
    color: string;
    icon: React.ReactNode;
    label: string;
  };

  const type = (typeConfig[transaction.type] ?? typeConfig.INCOME) as {
    color: string;
    label: string;
    prefix: string;
  };

  const canEdit = ["PENDING", "CANCELLED"].includes(transaction.status);
  const canDelete = ["PENDING", "CANCELLED"].includes(transaction.status);

  return (
    <div className="space-y-6 max-w-400 mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start border-b border-zinc-100 pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/professional-portal/finance">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
                Transaction Details
              </h1>
              <Badge
                variant="outline"
                className={`${status.color} flex items-center gap-1`}
              >
                {status.icon}
                {status.label}
              </Badge>
              <Badge
                variant="outline"
                className="bg-zinc-100 text-zinc-700 border-zinc-200"
              >
                {type.label}
              </Badge>
            </div>
            <p className="text-zinc-500 mt-1">
              Transaction #{transaction.id.substring(0, 8).toUpperCase()} •
              Created {new Date(transaction.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => setIsEditOpen(true)}
              className="border-zinc-200"
            >
              <Edit className="mr-2 h-4 w-4" /> Edit Transaction
            </Button>
          )}
          {canDelete && (
            <Button
              variant="outline"
              onClick={() => setIsDeleteOpen(true)}
              disabled={deleteTransactionMutation.isPending}
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              {deleteTransactionMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transaction Details */}
          <Card className="border border-zinc-200 shadow-sm bg-white">
            <div className="p-6 border-b border-zinc-100">
              <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Transaction Information
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-zinc-500 mb-2 flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Amount
                  </label>
                  <p className={`text-2xl font-bold ${type.color}`}>
                    {type.prefix}KSh{" "}
                    {Number(transaction.amount).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-500 mb-2 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Transaction Date
                  </label>
                  <p className="text-zinc-900 font-medium">
                    {new Date(transaction.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <label className="text-sm font-medium text-zinc-500 mb-2 block">
                  Description
                </label>
                <p className="text-zinc-900">{transaction.description}</p>
              </div>

              {transaction.reference && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-zinc-500 mb-2 block">
                      Reference Number
                    </label>
                    <p className="text-zinc-900 font-mono text-sm">
                      {transaction.reference}
                    </p>
                  </div>
                </>
              )}

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-zinc-500 mb-2 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Created
                  </label>
                  <p className="text-zinc-900">
                    {new Date(transaction.createdAt).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-500 mb-2 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Last Updated
                  </label>
                  <p className="text-zinc-900">
                    {new Date(transaction.updatedAt).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Related Project */}
          {transaction.project && (
            <Card className="border border-zinc-200 shadow-sm bg-white">
              <div className="p-6 border-b border-zinc-100">
                <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Related Project
                </h2>
              </div>
              <div className="p-6">
                <p className="font-semibold text-zinc-900 mb-2">
                  {transaction.project.title}
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={`/professional-portal/projects/${transaction.project.id}`}
                  >
                    View Project
                    <ExternalLink className="ml-2 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            </Card>
          )}

          {/* Status Timeline */}
          <Card className="border border-zinc-200 shadow-sm bg-white">
            <div className="p-6 border-b border-zinc-100">
              <h2 className="text-lg font-semibold text-zinc-900">
                Status Timeline
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-2">
                {Object.entries(statusConfig).map(([key, config]) => (
                  <div
                    key={key}
                    className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                      transaction.status === key
                        ? "bg-zinc-100 ring-2 ring-zinc-300"
                        : "opacity-50"
                    }`}
                  >
                    {config.icon}
                    <span
                      className={
                        transaction.status === key
                          ? "font-medium text-zinc-900"
                          : ""
                      }
                    >
                      {config.label}
                    </span>
                    {transaction.status === key && (
                      <CheckCircle className="h-4 w-4 text-emerald-500 ml-auto" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-125">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>
              Update the transaction details. Note: Amount and type cannot be
              changed.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Transaction description"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  type="submit"
                  disabled={updateTransactionMutation.isPending}
                >
                  {updateTransactionMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-106.25">
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this transaction? This action
              cannot be undone. Only pending or cancelled transactions can be
              deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteTransactionMutation.isPending}
            >
              {deleteTransactionMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
