"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  useInquiry,
  useUpdateInquiry,
  useDeleteInquiry,
} from "@/hooks/useInquiries";
import type { UpdateInquiryInput } from "@/lib/inquiries-client";
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  Mail,
  MapPin,
  DollarSign,
  Calendar,
  Clock,
  FileText,
  Loader2,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  Building2,
  ExternalLink,
  User,
} from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/text-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

// We use the validation schemas directly now

const statusConfig: Record<
  string,
  { color: string; icon: React.ReactNode; label: string }
> = {
  NEW: {
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: <AlertCircle className="h-4 w-4" />,
    label: "New",
  },
  CONTACTED: {
    color: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <MessageSquare className="h-4 w-4" />,
    label: "Contacted",
  },
  VIEWING_SCHEDULED: {
    color: "bg-purple-50 text-purple-700 border-purple-200",
    icon: <Calendar className="h-4 w-4" />,
    label: "Viewing Scheduled",
  },
  OFFER_MADE: {
    color: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <DollarSign className="h-4 w-4" />,
    label: "Offer Made",
  },
  CLOSED: {
    color: "bg-zinc-100 text-zinc-700 border-zinc-200",
    icon: <CheckCircle className="h-4 w-4" />,
    label: "Closed",
  },
};

export default function InquiryDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Fetch Inquiry
  const { data: inquiry, isLoading, error } = useInquiry(id);

  // Update Inquiry Mutation
  const updateInquiryMutation = useUpdateInquiry({
    onSuccess: () => {
      setIsEditOpen(false);
      toast.success("Inquiry updated successfully");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update inquiry",
      );
    },
  });

  // Delete Inquiry Mutation
  const deleteInquiryMutation = useDeleteInquiry({
    onSuccess: () => {
      toast.success("Inquiry deleted successfully");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete inquiry",
      );
    },
  });

  const form = useForm<UpdateInquiryInput>({
    defaultValues: {
      status: (inquiry?.status || "NEW") as Extract<
        UpdateInquiryInput["status"],
        "NEW"
      >,
      notes: inquiry?.notes || "",
      preferredViewingDate: inquiry?.preferredViewingDate
        ? new Date(inquiry.preferredViewingDate).toISOString().slice(0, 16)
        : "",
    },
  });

  // Update form when inquiry data loads
  if (
    inquiry &&
    form.getValues().status === "NEW" &&
    inquiry.status !== "NEW"
  ) {
    form.reset({
      status: inquiry.status as UpdateInquiryInput["status"],
      notes: inquiry.notes || "",
      preferredViewingDate: inquiry.preferredViewingDate
        ? new Date(inquiry.preferredViewingDate).toISOString().slice(0, 16)
        : "",
    });
  }

  function onSubmit(data: UpdateInquiryInput) {
    updateInquiryMutation.mutate({
      inquiryId: id,
      data: {
        ...data,
        preferredViewingDate: data.preferredViewingDate
          ? new Date(data.preferredViewingDate).toISOString()
          : null,
      } as UpdateInquiryInput,
    });
  }

  const handleDelete = () => {
    deleteInquiryMutation.mutate({ inquiryId: id });
  };

  // Format price
  const formattedPrice = useMemo(() => {
    if (!inquiry?.property?.price) return "N/A";
    const price =
      typeof inquiry.property.price === "string"
        ? parseFloat(inquiry.property.price)
        : inquiry.property.price;
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: inquiry.property.currency || "KES",
      minimumFractionDigits: 0,
    }).format(price);
  }, [inquiry?.property?.price, inquiry?.property?.currency]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto">
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
            <span className="ml-3 text-zinc-500">Loading inquiry...</span>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !inquiry) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <Button variant="ghost" asChild>
          <Link href="/professional-portal/inquiries">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Inquiries
          </Link>
        </Button>
        <Card className="p-8">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">
              Inquiry Not Found
            </h2>
            <p className="text-zinc-500 mb-4">
              {error instanceof Error
                ? error.message
                : "The inquiry you're looking for doesn't exist."}
            </p>
            <Button asChild>
              <Link href="/professional-portal/inquiries">
                Back to Inquiries
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const status = (statusConfig[inquiry.status] ?? statusConfig.NEW) as {
    color: string;
    icon: React.ReactNode;
    label: string;
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start border-b border-zinc-100 pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/professional-portal/inquiries">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
                Property Inquiry
              </h1>
              <Badge
                variant="outline"
                className={`${status.color} flex items-center gap-1`}
              >
                {status.icon}
                {status.label}
              </Badge>
            </div>
            <p className="text-zinc-500 mt-1">
              Inquiry #{inquiry.id.substring(0, 8).toUpperCase()} • Created{" "}
              {new Date(inquiry.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsEditOpen(true)}
            className="border-zinc-200"
          >
            <Edit className="mr-2 h-4 w-4" /> Edit Inquiry
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsDeleteOpen(true)}
            disabled={deleteInquiryMutation.isPending}
            className="border-red-200 text-red-600 hover:bg-red-50"
          >
            {deleteInquiryMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client Information */}
          <Card className="border border-zinc-200 shadow-sm bg-white">
            <div className="p-6 border-b border-zinc-100">
              <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                <User className="h-5 w-5" />
                Client Information
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-zinc-500 mb-2 block">
                  Client Name
                </label>
                <p className="text-zinc-900 font-medium">
                  {inquiry.clientName}
                </p>
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inquiry.clientEmail && (
                  <div>
                    <label className="text-sm font-medium text-zinc-500 mb-2 block flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      Email
                    </label>
                    <a
                      href={`mailto:${inquiry.clientEmail}`}
                      className="text-blue-600 hover:underline"
                    >
                      {inquiry.clientEmail}
                    </a>
                  </div>
                )}
                {inquiry.clientPhone && (
                  <div>
                    <label className="text-sm font-medium text-zinc-500 mb-2 block flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      Phone
                    </label>
                    <a
                      href={`tel:${inquiry.clientPhone}`}
                      className="text-blue-600 hover:underline"
                    >
                      {inquiry.clientPhone}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Inquiry Details */}
          <Card className="border border-zinc-200 shadow-sm bg-white">
            <div className="p-6 border-b border-zinc-100">
              <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Inquiry Details
              </h2>
            </div>
            <div className="p-6 space-y-6">
              {inquiry.message && (
                <>
                  <div>
                    <label className="text-sm font-medium text-zinc-500 mb-2 block">
                      Message
                    </label>
                    <p className="text-zinc-900 whitespace-pre-wrap">
                      {inquiry.message}
                    </p>
                  </div>
                  <Separator />
                </>
              )}

              {inquiry.preferredViewingDate && (
                <>
                  <div>
                    <label className="text-sm font-medium text-zinc-500 mb-2 block flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Preferred Viewing Date
                    </label>
                    <p className="text-zinc-900">
                      {new Date(
                        inquiry.preferredViewingDate,
                      ).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Separator />
                </>
              )}

              {inquiry.notes && (
                <>
                  <div>
                    <label className="text-sm font-medium text-zinc-500 mb-2 block flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Notes
                    </label>
                    <p className="text-zinc-900 whitespace-pre-wrap">
                      {inquiry.notes}
                    </p>
                  </div>
                  <Separator />
                </>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-zinc-500 mb-2 block flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Created
                  </label>
                  <p className="text-zinc-900">
                    {new Date(inquiry.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-500 mb-2 block flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last Updated
                  </label>
                  <p className="text-zinc-900">
                    {new Date(inquiry.updatedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Related Property */}
          <Card className="border border-zinc-200 shadow-sm bg-white">
            <div className="p-6 border-b border-zinc-100">
              <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Property
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-zinc-900 mb-2">
                  {inquiry.property.title}
                </h3>
                <Badge variant="outline" className="mb-3">
                  {inquiry.property.type}
                </Badge>
              </div>
              <Separator />
              <div>
                <label className="text-sm font-medium text-zinc-500 mb-2 block flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Location
                </label>
                <p className="text-zinc-900">{inquiry.property.location}</p>
              </div>
              <Separator />
              <div>
                <label className="text-sm font-medium text-zinc-500 mb-2 block flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Price
                </label>
                <p className="text-zinc-900 font-semibold text-lg">
                  {formattedPrice}
                </p>
              </div>
              <Button variant="outline" size="sm" asChild className="w-full">
                <Link href={`/properties/${inquiry.property.id}`}>
                  View Property
                  <ExternalLink className="ml-2 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </Card>

          {/* Status Timeline */}
          <Card className="border border-zinc-200 shadow-sm bg-white">
            <div className="p-6 border-b border-zinc-100">
              <h2 className="text-lg font-semibold text-zinc-900">Status</h2>
            </div>
            <div className="p-6">
              <div className="space-y-2">
                {Object.entries(statusConfig).map(([key, config]) => (
                  <div
                    key={key}
                    className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                      inquiry.status === key
                        ? "bg-zinc-100 ring-2 ring-zinc-300"
                        : "opacity-50"
                    }`}
                  >
                    {config.icon}
                    <span
                      className={
                        inquiry.status === key
                          ? "font-medium text-zinc-900"
                          : ""
                      }
                    >
                      {config.label}
                    </span>
                    {inquiry.status === key && (
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
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Inquiry</DialogTitle>
            <DialogDescription>
              Update the inquiry status and add notes. All changes will be saved
              immediately.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="NEW">New</SelectItem>
                        <SelectItem value="CONTACTED">Contacted</SelectItem>
                        <SelectItem value="VIEWING_SCHEDULED">
                          Viewing Scheduled
                        </SelectItem>
                        <SelectItem value="OFFER_MADE">Offer Made</SelectItem>
                        <SelectItem value="CLOSED">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="preferredViewingDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Viewing Date (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add internal notes about this inquiry..."
                        rows={6}
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
                  disabled={updateInquiryMutation.isPending}
                >
                  {updateInquiryMutation.isPending && (
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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Inquiry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this inquiry? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteInquiryMutation.isPending}
            >
              {deleteInquiryMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete Inquiry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
