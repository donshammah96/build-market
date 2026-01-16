"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
  CheckCircle,
  XCircle,
  AlertCircle,
  UserCheck,
} from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

// Lead interface matching API response
interface Lead {
  id: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  projectType: string;
  location?: string | null;
  budget?: string | null;
  status: "NEW" | "CONTACTED" | "PROPOSAL" | "WON" | "LOST";
  notes?: string | null;
  followUpDate?: string | null;
  source?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Schema for updating a lead
const updateLeadSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email().optional().or(z.literal("")),
  clientPhone: z.string().optional(),
  projectType: z.string().min(1, "Project type is required"),
  location: z.string().optional(),
  budget: z.string().optional(),
  status: z.enum(["NEW", "CONTACTED", "PROPOSAL", "WON", "LOST"]),
  notes: z.string().optional(),
  followUpDate: z.string().optional().or(z.literal("")),
});

type UpdateLeadFormValues = z.infer<typeof updateLeadSchema>;

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
  PROPOSAL: {
    color: "bg-purple-50 text-purple-700 border-purple-200",
    icon: <UserCheck className="h-4 w-4" />,
    label: "Proposal Sent",
  },
  WON: {
    color: "bg-zinc-900 text-white border-zinc-900",
    icon: <CheckCircle className="h-4 w-4" />,
    label: "Won",
  },
  LOST: {
    color: "bg-zinc-100 text-zinc-500 border-zinc-200",
    icon: <XCircle className="h-4 w-4" />,
    label: "Lost",
  },
};

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Fetch Lead
  const {
    data: lead,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const res = await fetch(`/api/professional-portal/leads/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Lead not found");
        }
        throw new Error("Failed to fetch lead");
      }
      return res.json() as Promise<Lead>;
    },
    enabled: !!id,
  });

  // Update Lead Mutation
  const updateLeadMutation = useMutation({
    mutationFn: async (data: UpdateLeadFormValues) => {
      const res = await fetch(`/api/professional-portal/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update lead");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setIsEditOpen(false);
      toast.success("Lead updated successfully");
    },
    onError: () => {
      toast.error("Failed to update lead");
    },
  });

  // Delete Lead Mutation
  const deleteLeadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/professional-portal/leads/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete lead");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead deleted successfully");
      router.push("/professional-portal/leads");
    },
    onError: () => {
      toast.error("Failed to delete lead");
    },
  });

  const form = useForm<UpdateLeadFormValues>({
    resolver: zodResolver(updateLeadSchema),
    defaultValues: {
      clientName: lead?.clientName || "",
      clientEmail: lead?.clientEmail || "",
      clientPhone: lead?.clientPhone || "",
      projectType: lead?.projectType || "",
      location: lead?.location || "",
      budget: lead?.budget || "",
      status: lead?.status || "NEW",
      notes: lead?.notes || "",
      followUpDate: lead?.followUpDate
        ? new Date(lead.followUpDate).toISOString().split("T")[0]
        : "",
    },
  });

  // Update form when lead data loads
  if (lead && form.getValues().clientName === "") {
    form.reset({
      clientName: lead.clientName,
      clientEmail: lead.clientEmail || "",
      clientPhone: lead.clientPhone || "",
      projectType: lead.projectType,
      location: lead.location || "",
      budget: lead.budget || "",
      status: lead.status,
      notes: lead.notes || "",
      followUpDate: lead.followUpDate
        ? new Date(lead.followUpDate).toISOString().split("T")[0]
        : "",
    });
  }

  function onSubmit(data: UpdateLeadFormValues) {
    updateLeadMutation.mutate(data);
  }

  const handleDelete = () => {
    if (
      confirm(
        "Are you sure you want to delete this lead? This action cannot be undone."
      )
    ) {
      deleteLeadMutation.mutate();
    }
  };

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
            <span className="ml-3 text-zinc-500">Loading lead...</span>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <Button variant="ghost" asChild>
          <Link href="/professional-portal/leads">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Leads
          </Link>
        </Button>
        <Card className="p-8">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">
              Lead Not Found
            </h2>
            <p className="text-zinc-500 mb-4">
              {error instanceof Error
                ? error.message
                : "The lead you're looking for doesn't exist."}
            </p>
            <Button asChild>
              <Link href="/professional-portal/leads">Back to Leads</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const status = (statusConfig[lead.status] ?? statusConfig.NEW) as {
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
            <Link href="/professional-portal/leads">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
                {lead.clientName}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1 ${status.color}`}
              >
                {status.icon}
                {status.label}
              </span>
            </div>
            <p className="text-zinc-500 mt-1">
              Lead #{lead.id.slice(0, 8)} • Created{" "}
              {new Date(lead.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsEditOpen(true)}
            className="border-zinc-200"
          >
            <Edit className="mr-2 h-4 w-4" /> Edit Lead
          </Button>
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={deleteLeadMutation.isPending}
            className="border-red-200 text-red-600 hover:bg-red-50"
          >
            {deleteLeadMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="mr-2 h-4 w-4" />
            )}
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lead Details */}
          <Card className="border border-zinc-200 shadow-sm bg-white">
            <div className="p-6 border-b border-zinc-100">
              <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Lead Details
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-zinc-500 mb-2 block">
                    Project Type
                  </label>
                  <p className="text-zinc-900 font-medium">
                    {lead.projectType}
                  </p>
                </div>
                {lead.budget && (
                  <div>
                    <label className="text-sm font-medium text-zinc-500 mb-2 block flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Budget
                    </label>
                    <p className="text-zinc-900 font-medium">{lead.budget}</p>
                  </div>
                )}
              </div>

              {lead.location && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-zinc-500 mb-2 block flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Location
                    </label>
                    <p className="text-zinc-900">{lead.location}</p>
                  </div>
                </>
              )}

              {lead.notes && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-zinc-500 mb-2 block">
                      Notes
                    </label>
                    <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200">
                      <p className="text-zinc-900 whitespace-pre-wrap">
                        {lead.notes}
                      </p>
                    </div>
                  </div>
                </>
              )}

              {lead.followUpDate && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-zinc-500 mb-2 block flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Follow-up Date
                    </label>
                    <p className="text-zinc-900">
                      {new Date(lead.followUpDate).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </>
              )}

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-zinc-500 mb-2 block flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Created
                  </label>
                  <p className="text-zinc-900">
                    {new Date(lead.createdAt).toLocaleDateString("en-US", {
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
                    <Calendar className="h-3 w-3" />
                    Last Updated
                  </label>
                  <p className="text-zinc-900">
                    {new Date(lead.updatedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              {lead.source && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-zinc-500 mb-2 block">
                      Source
                    </label>
                    <p className="text-zinc-900 capitalize">{lead.source}</p>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Client Info */}
          <Card className="border border-zinc-200 shadow-sm bg-white">
            <div className="p-6 border-b border-zinc-100">
              <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Client Information
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 pb-4">
                <Avatar className="h-12 w-12 border border-zinc-200">
                  <AvatarFallback>
                    {lead.clientName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-zinc-900">
                    {lead.clientName}
                  </p>
                </div>
              </div>

              {lead.clientEmail && (
                <div>
                  <label className="text-sm font-medium text-zinc-500 mb-1 block">
                    Email
                  </label>
                  <a
                    href={`mailto:${lead.clientEmail}`}
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Mail className="h-3 w-3" />
                    {lead.clientEmail}
                  </a>
                </div>
              )}

              {lead.clientPhone && (
                <div>
                  <label className="text-sm font-medium text-zinc-500 mb-1 block">
                    Phone
                  </label>
                  <a
                    href={`tel:${lead.clientPhone}`}
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Phone className="h-3 w-3" />
                    {lead.clientPhone}
                  </a>
                </div>
              )}

              {!lead.clientEmail && !lead.clientPhone && (
                <p className="text-sm text-zinc-500 text-center py-4">
                  No contact information available
                </p>
              )}
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="border border-zinc-200 shadow-sm bg-white">
            <div className="p-6 border-b border-zinc-100">
              <h2 className="text-lg font-semibold text-zinc-900">
                Quick Actions
              </h2>
            </div>
            <div className="p-6 space-y-2">
              {lead.clientPhone && (
                <Button
                  variant="outline"
                  className="w-full justify-start text-emerald-600 border-emerald-100 hover:bg-emerald-50"
                  onClick={() => {
                    window.location.href = `tel:${lead.clientPhone}`;
                  }}
                >
                  <Phone className="mr-2 h-4 w-4" />
                  Call Client
                </Button>
              )}
              {lead.clientEmail && (
                <Button
                  variant="outline"
                  className="w-full justify-start text-blue-600 border-blue-100 hover:bg-blue-50"
                  onClick={() => {
                    const subject = encodeURIComponent(
                      `Regarding your ${lead.projectType} project`
                    );
                    const body = encodeURIComponent(
                      `Hello ${lead.clientName},\n\nThank you for your interest in our services. I'll be in touch soon.\n\nBest regards,`
                    );
                    window.location.href = `mailto:${lead.clientEmail}?subject=${subject}&body=${body}`;
                  }}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Email Client
                </Button>
              )}
            </div>
          </Card>

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
                      lead.status === key
                        ? "bg-zinc-100 ring-2 ring-zinc-300"
                        : "opacity-50"
                    }`}
                  >
                    {config.icon}
                    <span
                      className={
                        lead.status === key ? "font-medium text-zinc-900" : ""
                      }
                    >
                      {config.label}
                    </span>
                    {lead.status === key && (
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
            <DialogTitle>Edit Lead</DialogTitle>
            <DialogDescription>
              Update the details of this lead.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="clientEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="john@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clientPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+254..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="projectType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Type</FormLabel>
                      <FormControl>
                        <Input placeholder="Kitchen Reno" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget</FormLabel>
                      <FormControl>
                        <Input placeholder="KSh 500,000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Nairobi, Kenya" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                        <SelectItem value="PROPOSAL">Proposal Sent</SelectItem>
                        <SelectItem value="WON">Won</SelectItem>
                        <SelectItem value="LOST">Lost</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="followUpDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Follow-up Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add any additional notes..."
                        rows={4}
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
                <Button type="submit" disabled={updateLeadMutation.isPending}>
                  {updateLeadMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
