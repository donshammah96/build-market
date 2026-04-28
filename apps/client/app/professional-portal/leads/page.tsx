"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Search,
  MoreHorizontal,
  Phone,
  MessageSquare,
  Clock,
  Plus,
  Loader2,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { DialogClose } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { z } from "zod";

import { useLeads, useCreateLead, useUpdateLead } from "@/hooks/useLeads";
import type { LeadListItem } from "@/app/lib/domains/leads/contracts";
import {
  CreateLeadSchema,
  type CreateLeadInput,
} from "@/app/lib/validation/leads-validation";
// Schema for creating a lead is available via forms.
type LeadFormValues = z.input<typeof CreateLeadSchema>;

export default function LeadsPage() {
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isUpdateStatusOpen, setIsUpdateStatusOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadListItem | null>(null);

  const { data: leadsData, isLoading } = useLeads();
  const leads: LeadListItem[] = useMemo(() => leadsData ?? [], [leadsData]);

  const createLeadMutation = useCreateLead({
    onSuccess: () => {
      setIsAddLeadOpen(false);
      toast.success("Lead created successfully");
    },
    onError: () => {
      toast.error("Failed to create lead");
    },
  });

  const updateStatusMutation = useUpdateLead({
    onSuccess: () => {
      toast.success("Status updated");
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(CreateLeadSchema),
    defaultValues: {
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      title: "",
      projectType: "RESIDENTIAL",
      location: "",
      budget: undefined,
      status: "NEW",
      notes: "",
      followUpDate: undefined,
    },
  });

  const formControl = form.control as Control<LeadFormValues>;

  function onSubmit(data: LeadFormValues) {
    createLeadMutation.mutate(data as CreateLeadInput);
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-end border-b border-zinc-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
            Leads Pipeline
          </h1>
          <p className="text-zinc-500 mt-1">
            Manage incoming inquiries and track conversion.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Search leads..."
              className="pl-9 bg-white border-zinc-200 focus:ring-emerald-500/20"
            />
          </div>
          <Dialog open={isAddLeadOpen} onOpenChange={setIsAddLeadOpen}>
            <DialogTrigger asChild>
              <Button className="bg-zinc-900 text-white hover:bg-zinc-800">
                <Plus className="mr-2 h-4 w-4" /> Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Lead</DialogTitle>
                <DialogDescription>
                  Enter the details of the new lead manually.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={formControl}
                    name="clientName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Don Shammah" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={formControl}
                      name="clientEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="don@gmail.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={formControl}
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
                      control={formControl}
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
                      control={formControl}
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
                    control={formControl}
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
                    control={formControl}
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
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={createLeadMutation.isPending}
                    >
                      {createLeadMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Save Lead
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Leads Table Card */}
      <Card className="border border-zinc-200 shadow-sm bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 border-b border-zinc-100 text-zinc-500 font-medium">
              <tr>
                <th className="px-6 py-4 w-[300px]">Client</th>
                <th className="px-6 py-4">Project Details</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Received</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-zinc-500"
                  >
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Loading leads...
                  </td>
                </tr>
              ) : !leads || leads.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-zinc-500"
                  >
                    No leads found. Add one to get started.
                  </td>
                </tr>
              ) : (
                leads.map((lead: LeadListItem) => (
                  <tr
                    key={lead.id}
                    className="group hover:bg-zinc-50/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-zinc-200">
                          <AvatarFallback>
                            {lead.clientName.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <Link
                            href={`/professional-portal/leads/${lead.id}`}
                            className="font-semibold text-zinc-900 hover:text-emerald-600 transition-colors"
                          >
                            {lead.clientName}
                          </Link>
                          <p className="text-zinc-500 text-xs">
                            {lead.location || "No location"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-zinc-900">
                        {lead.projectType}
                      </p>
                      <p className="text-zinc-500 text-xs mt-0.5">
                        Budget: {lead.budget || "N/A"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="px-6 py-4 text-zinc-500 flex items-center gap-2">
                      <Clock className="h-3 w-3" />{" "}
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 text-emerald-600 border-emerald-100 hover:bg-emerald-50"
                          onClick={() => {
                            if (!lead.clientPhone) {
                              toast.error(
                                "No phone number available for this client",
                              );
                              return;
                            }
                            window.location.href = `tel:${lead.clientPhone}`;
                          }}
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 text-blue-600 border-blue-100 hover:bg-blue-50"
                          onClick={() => {
                            if (!lead.clientEmail) {
                              toast.error(
                                "No email address available for this client",
                              );
                              return;
                            }
                            const subject = encodeURIComponent(
                              "Regarding your project inquiry",
                            );
                            const body = encodeURIComponent(
                              "Hello,\n\nThank you for your interest. I'll be in touch soon.\n\nBest regards,",
                            );
                            window.location.href = `mailto:${lead.clientEmail}?subject=${subject}&body=${body}`;
                          }}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-zinc-400"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedLead(lead);
                                setIsUpdateStatusOpen(true);
                              }}
                            >
                              Update status & follow-up
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  leadId: lead.id,
                                  data: { status: "WON" },
                                })
                              }
                            >
                              Mark as Won
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  leadId: lead.id,
                                  data: { status: "LOST" },
                                })
                              }
                            >
                              Mark as Lost
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600">
                              Archive Lead
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selectedLead && (
        <Dialog
          open={isUpdateStatusOpen}
          onOpenChange={(open) => {
            setIsUpdateStatusOpen(open);
            if (!open) setSelectedLead(null);
          }}
        >
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Update Lead Status</DialogTitle>
              <DialogDescription>
                Update the status, notes, and follow-up date for this lead.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <FormLabel>Status</FormLabel>
                <Select
                  defaultValue={selectedLead.status}
                  onValueChange={(value) =>
                    setSelectedLead({
                      ...selectedLead,
                      status: value as LeadListItem["status"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">New</SelectItem>
                    <SelectItem value="CONTACTED">Contacted</SelectItem>
                    <SelectItem value="PROPOSAL">Proposal Sent</SelectItem>
                    <SelectItem value="WON">Won</SelectItem>
                    <SelectItem value="LOST">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <FormLabel>Notes</FormLabel>
              <div className="text-sm text-zinc-500 py-3">
                Notes and follow-up adjustments are done in the details view.
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                onClick={() => {
                  if (!selectedLead) return;
                  updateStatusMutation.mutate({
                    leadId: selectedLead.id,
                    data: {
                      status: selectedLead.status as
                        | "NEW"
                        | "CONTACTED"
                        | "PROPOSAL"
                        | "WON"
                        | "LOST",
                    },
                  });
                  setIsUpdateStatusOpen(false);
                  setSelectedLead(null);
                }}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    NEW: "bg-emerald-100 text-emerald-700 border-emerald-200",
    CONTACTED: "bg-blue-50 text-blue-700 border-blue-200",
    PROPOSAL: "bg-purple-50 text-purple-700 border-purple-200",
    WON: "bg-zinc-900 text-white border-zinc-900",
    LOST: "bg-zinc-100 text-zinc-500 border-zinc-200",
  };

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.LOST}`}
    >
      {status}
    </span>
  );
}
