"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { Textarea } from "@/components/ui/text-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// Lead interface for type safety
interface Lead {
  id: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  projectType: string;
  location?: string;
  budget?: string;
  status: string;
  notes?: string;
  followUpDate?: string | null;
  createdAt: string;
}

// Schema for creating a lead
const leadSchema = z.object({
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

type LeadFormValues = z.infer<typeof leadSchema>;

export default function LeadsPage() {
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isUpdateStatusOpen, setIsUpdateStatusOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const queryClient = useQueryClient();

  // Fetch Leads
  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const res = await fetch("/api/professional-portal/leads");
      if (!res.ok) throw new Error("Failed to fetch leads");
      const json = await res.json();
      // Ensure we always return an array
      const leadsData = json.data ?? json;
      return Array.isArray(leadsData) ? leadsData : [];
    },
  });

  // Create Lead Mutation
  const createLeadMutation = useMutation({
    mutationFn: async (data: LeadFormValues) => {
      const res = await fetch("/api/professional-portal/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create lead");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setIsAddLeadOpen(false);
      toast.success("Lead created successfully");
    },
    onError: () => {
      toast.error("Failed to create lead");
    },
  });

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
      followUpDate,
    }: {
      id: string;
      status: string;
      notes?: string;
      followUpDate?: string;
    }) => {
      const res = await fetch(`/api/professional-portal/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          notes,
          followUpDate: followUpDate || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Status updated");
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      projectType: "",
      location: "",
      budget: "",
      status: "NEW",
      notes: "",
      followUpDate: "",
    },
  });

  function onSubmit(data: LeadFormValues) {
    createLeadMutation.mutate(data);
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
                leads.map((lead: Lead) => (
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
                      {lead.followUpDate && (
                        <p className="text-xs text-zinc-500 mt-1">
                          Follow-up:{" "}
                          {new Date(lead.followUpDate).toLocaleDateString()}
                        </p>
                      )}
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
                                "No phone number available for this client"
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
                                "No email address available for this client"
                              );
                              return;
                            }
                            const subject = encodeURIComponent(
                              "Regarding your project inquiry"
                            );
                            const body = encodeURIComponent(
                              "Hello,\n\nThank you for your interest. I'll be in touch soon.\n\nBest regards,"
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
                                  id: lead.id,
                                  status: "WON",
                                })
                              }
                            >
                              Mark as Won
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: lead.id,
                                  status: "LOST",
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
                      status: value,
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

              <div className="space-y-2">
                <FormLabel>Follow-up Date</FormLabel>
                <Input
                  type="date"
                  value={
                    selectedLead.followUpDate
                      ? new Date(selectedLead.followUpDate)
                          .toISOString()
                          .split("T")[0]
                      : ""
                  }
                  onChange={(e) =>
                    setSelectedLead({
                      ...selectedLead,
                      followUpDate: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <FormLabel>Notes</FormLabel>
                <Textarea
                  value={selectedLead.notes || ""}
                  onChange={(e) =>
                    setSelectedLead({
                      ...selectedLead,
                      notes: e.target.value,
                    })
                  }
                  rows={4}
                />
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
                    id: selectedLead.id,
                    status: selectedLead.status,
                    notes: selectedLead.notes,
                    followUpDate: selectedLead.followUpDate || undefined,
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
