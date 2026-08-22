"use client";

import { useState, useMemo } from "react";
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
  Sparkles,
  Building2,
  MapPin,
  Coins,
  CheckCircle2,
  Lock,
  TrendingUp,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  useProfessionalMarketplaceLeads,
  useAcceptMarketplaceLead,
  useDeclineMarketplaceLead,
} from "@/hooks/useMarketplaceLeads";
import { useProfileStatus } from "@/hooks/useProfileStatus";
import { CapabilityRestrictedBanner } from "@/components/shared/CapabilityRestrictedBanner";
import type { LeadListItem } from "@/app/lib/domains/leads/contracts";
import type { MaskedMarketplaceLeadDTO } from "@/app/lib/domains/marketplace-leads";
import {
  CreateLeadSchema,
  type CreateLeadInput,
} from "@/app/lib/validation/leads-validation";

type LeadFormValues = z.input<typeof CreateLeadSchema>;

export default function ProfessionalLeadsPage() {
  const { profile } = useProfileStatus();
  const [activeTab, setActiveTab] = useState<"crm" | "marketplace">(
    "marketplace",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isUpdateStatusOpen, setIsUpdateStatusOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadListItem | null>(null);

  // Acceptance Modal State
  const [acceptModalLead, setAcceptModalLead] =
    useState<MaskedMarketplaceLeadDTO | null>(null);

  const isUnverified =
    profile &&
    (profile as unknown as { verified?: boolean }).verified === false;

  // CRM Leads
  const { data: leadsData, isLoading: isCrmLoading } = useLeads();
  const crmLeads: LeadListItem[] = useMemo(() => leadsData ?? [], [leadsData]);

  // Marketplace Routed Leads
  const { data: marketplaceData, isLoading: isMarketplaceLoading } =
    useProfessionalMarketplaceLeads();
  const marketplaceLeads: MaskedMarketplaceLeadDTO[] = useMemo(
    () => marketplaceData ?? [],
    [marketplaceData],
  );

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

  const acceptMutation = useAcceptMarketplaceLead({
    onSuccess: (disclosedLead) => {
      setAcceptModalLead(null);
      toast.success(
        `Lead accepted! Client contact disclosed: ${disclosedLead.client.phone || disclosedLead.client.email}. Added to CRM pipeline.`,
      );
    },
    onError: (err) => {
      toast.error(err.message || "Failed to accept lead");
    },
  });

  const declineMutation = useDeclineMarketplaceLead({
    onSuccess: () => {
      toast.success("Lead dismissed from inbox");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to decline lead");
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

  const filteredCrmLeads = useMemo(() => {
    return crmLeads.filter(
      (l) =>
        (l.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.clientName &&
          l.clientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (l.location &&
          l.location.toLowerCase().includes(searchQuery.toLowerCase())),
    );
  }, [crmLeads, searchQuery]);

  const filteredMarketplaceLeads = useMemo(() => {
    return marketplaceLeads.filter(
      (l) =>
        (l.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.projectCounty.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.projectType.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [marketplaceLeads, searchQuery]);

  // Overall Stats
  const stats = useMemo(() => {
    const totalCrm = crmLeads.length;
    const wonCount = crmLeads.filter((l) => l.status === "WON").length;
    const totalPipelineValue = crmLeads.reduce(
      (acc, l) => acc + (typeof l.budget === "number" ? l.budget : 0),
      0,
    );
    const marketplaceCount = marketplaceLeads.length;
    return { totalCrm, wonCount, totalPipelineValue, marketplaceCount };
  }, [crmLeads, marketplaceLeads]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-4 sm:p-6">
      {isUnverified && (
        <CapabilityRestrictedBanner
          featureName="Leads Pipeline"
          verificationStatus={
            (profile as unknown as { verificationStatus?: string })
              .verificationStatus
          }
        />
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-end border-b border-zinc-100 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight">
            Leads & Opportunities Pipeline
          </h1>
          <p className="text-zinc-500 mt-1">
            Manage your private CRM clients and respond to AI-qualified
            marketplace opportunities.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white border-zinc-200 focus:ring-emerald-500/20"
            />
          </div>
          <Dialog open={isAddLeadOpen} onOpenChange={setIsAddLeadOpen}>
            <DialogTrigger asChild>
              <Button className="bg-zinc-900 text-white hover:bg-zinc-800 gap-1.5">
                <Plus className="h-4 w-4" /> Add Private Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-125">
              <DialogHeader>
                <DialogTitle>Add New Private Lead</DialogTitle>
                <DialogDescription>
                  Enter client and project details manually into your CRM
                  pipeline.
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
                          <Input placeholder="e.g. John Kamau" {...field} />
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
                            <Input
                              placeholder="client@example.com"
                              {...field}
                            />
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
                            <Input placeholder="+254 700 000000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={formControl}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Title</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. 4-Bedroom House in Kiambu"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={formControl}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <FormControl>
                            <Input placeholder="Nairobi / Kiambu" {...field} />
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
                          <FormLabel>Budget (KES)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="10000000"
                              {...field}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value
                                    ? Number(e.target.value)
                                    : undefined,
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={createLeadMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {createLeadMutation.isPending && (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-zinc-200 shadow-sm bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Marketplace Matches
              </div>
              <div className="text-2xl font-black text-emerald-600 mt-1 flex items-center gap-1.5">
                {stats.marketplaceCount}
                <Badge className="bg-emerald-100 text-emerald-800 text-[10px] uppercase font-bold border-0">
                  AI Scored
                </Badge>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-zinc-200 shadow-sm bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Active CRM Leads
              </div>
              <div className="text-2xl font-bold text-zinc-900 mt-1">
                {stats.totalCrm}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-700 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-zinc-200 shadow-sm bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Pipeline Value
              </div>
              <div className="text-2xl font-bold text-blue-600 mt-1">
                KES {(stats.totalPipelineValue / 1000000).toFixed(1)}M
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-zinc-200 shadow-sm bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Deals Won
              </div>
              <div className="text-2xl font-bold text-amber-600 mt-1">
                {stats.wonCount}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabbed Interface */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as any)}
        className="space-y-6"
      >
        <TabsList className="bg-zinc-100 p-1 rounded-xl">
          <TabsTrigger
            value="marketplace"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6 py-2.5 font-semibold text-sm gap-2"
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            Marketplace Opportunities
            {stats.marketplaceCount > 0 && (
              <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {stats.marketplaceCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="crm"
            className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm px-6 py-2.5 font-semibold text-sm gap-2"
          >
            <Building2 className="w-4 h-4 text-zinc-600" />
            My CRM Pipeline
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0.5 rounded-full"
            >
              {stats.totalCrm}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Marketplace Opportunities (AI Scored) */}
        <TabsContent value="marketplace" className="space-y-4">
          {isMarketplaceLoading ? (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
              <p className="text-sm text-zinc-500">
                Loading marketplace opportunities...
              </p>
            </div>
          ) : filteredMarketplaceLeads.length === 0 ? (
            <Card className="border border-dashed border-zinc-300 bg-white p-12 text-center">
              <Sparkles className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-zinc-900 mb-1">
                No active marketplace leads right now
              </h3>
              <p className="text-sm text-zinc-500 max-w-md mx-auto">
                When homeowners submit projects matching your specialties and
                counties, they will appear here with AI confidence scorecards.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredMarketplaceLeads.map((mLead) => {
                const matchScorePercent = mLead.matchScore
                  ? Math.round(mLead.matchScore * 100)
                  : 85;

                return (
                  <Card
                    key={mLead.routingEventId}
                    className="border border-zinc-200 hover:border-emerald-500/60 shadow-sm hover:shadow-md transition-all bg-white overflow-hidden"
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="space-y-3 flex-1">
                          {/* Title & Badges */}
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-extrabold text-lg text-zinc-900">
                              {mLead.title}
                            </span>
                            <Badge
                              className={`text-xs font-bold gap-1 ${
                                mLead.confidenceLabel === "high"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : "bg-blue-100 text-blue-800 border-blue-300"
                              }`}
                            >
                              <Sparkles className="w-3 h-3 text-emerald-600" />
                              {mLead.confidenceLabel?.toUpperCase()} CONFIDENCE
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {matchScorePercent}% Match
                            </Badge>
                          </div>

                          {/* Location & Meta */}
                          <div className="flex items-center gap-4 text-xs text-zinc-500 flex-wrap">
                            <span className="flex items-center gap-1 font-semibold text-zinc-800">
                              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                              {mLead.projectCounty} County
                            </span>
                            <span className="capitalize font-medium text-zinc-700">
                              {mLead.projectType.replace(/_/g, " ")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-zinc-400" />
                              Routed{" "}
                              {new Date(mLead.routedAt).toLocaleDateString()}
                            </span>
                          </div>

                          {/* Masked Contact Box */}
                          <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 text-zinc-600">
                              <Lock className="w-4 h-4 text-zinc-400" />
                              <span>Homeowner Contact: </span>
                              <span className="font-mono text-zinc-500">
                                +254 7XX XXX XXX • h***@gmail.com
                              </span>
                            </div>
                            <span className="text-[11px] text-zinc-400 italic">
                              Disclosed upon acceptance
                            </span>
                          </div>

                          {/* Factor Indicators */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                            <div className="p-2 bg-zinc-50/80 rounded-lg border border-zinc-100">
                              <span className="text-[10px] text-zinc-400 uppercase font-semibold">
                                Land Title
                              </span>
                              <div className="font-medium text-zinc-800 truncate">
                                {mLead.landOwnershipStatus?.replace(
                                  /_/g,
                                  " ",
                                ) ?? "Declared"}
                              </div>
                            </div>
                            <div className="p-2 bg-zinc-50/80 rounded-lg border border-zinc-100">
                              <span className="text-[10px] text-zinc-400 uppercase font-semibold">
                                Architectural Stage
                              </span>
                              <div className="font-medium text-zinc-800 truncate">
                                {mLead.architecturalStage?.replace(/_/g, " ") ??
                                  "In Progress"}
                              </div>
                            </div>
                            <div className="p-2 bg-zinc-50/80 rounded-lg border border-zinc-100">
                              <span className="text-[10px] text-zinc-400 uppercase font-semibold">
                                Budget Readiness
                              </span>
                              <div className="font-medium text-zinc-800 truncate">
                                {mLead.budgetRangeMin && mLead.budgetRangeMax
                                  ? `KES ${(mLead.budgetRangeMin / 1000000).toFixed(1)}M - ${(mLead.budgetRangeMax / 1000000).toFixed(1)}M`
                                  : "Funds Available"}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-3 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-zinc-100">
                          <Button
                            onClick={() => setAcceptModalLead(mLead)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm gap-1.5 text-xs px-5"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Accept &
                            Disclose
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              declineMutation.mutate({
                                routingEventId: mLead.routingEventId,
                              })
                            }
                            disabled={declineMutation.isPending}
                            className="text-zinc-500 hover:text-rose-600 text-xs"
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: My CRM Pipeline */}
        <TabsContent value="crm" className="space-y-4">
          <Card className="border-zinc-200 shadow-sm bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-500 font-medium border-b border-zinc-200 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Client</th>
                    <th className="px-6 py-4">Project</th>
                    <th className="px-6 py-4">Budget</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Created</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {isCrmLoading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-zinc-500"
                      >
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-zinc-400" />
                        Loading CRM leads...
                      </td>
                    </tr>
                  ) : filteredCrmLeads.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-zinc-500"
                      >
                        No private CRM leads found. Add a lead manually or
                        accept marketplace opportunities.
                      </td>
                    </tr>
                  ) : (
                    filteredCrmLeads.map((lead) => (
                      <tr
                        key={lead.id}
                        className="hover:bg-zinc-50/50 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-zinc-200">
                              <AvatarFallback className="bg-zinc-100 text-zinc-700 font-semibold text-xs">
                                {lead.clientName
                                  ? lead.clientName
                                      .substring(0, 2)
                                      .toUpperCase()
                                  : "CL"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-semibold text-zinc-900">
                                {lead.clientName || "Unnamed Client"}
                              </div>
                              <div className="text-xs text-zinc-500 font-mono">
                                {lead.clientPhone ||
                                  lead.clientEmail ||
                                  "No contact info"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-zinc-800">
                            {lead.title}
                          </div>
                          <div className="text-xs text-zinc-400">
                            {lead.location || "Kenya"}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-zinc-900">
                          {typeof lead.budget === "number"
                            ? `KES ${lead.budget.toLocaleString()}`
                            : "—"}
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={
                              lead.status === "WON"
                                ? "default"
                                : lead.status === "LOST"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className="text-xs font-semibold"
                          >
                            {lead.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-zinc-500 text-xs flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {new Date(lead.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {lead.clientPhone && (
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 text-emerald-600 border-emerald-100 hover:bg-emerald-50"
                                onClick={() =>
                                  (window.location.href = `tel:${lead.clientPhone}`)
                                }
                              >
                                <Phone className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {lead.clientEmail && (
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 text-blue-600 border-blue-100 hover:bg-blue-50"
                                onClick={() =>
                                  (window.location.href = `mailto:${lead.clientEmail}`)
                                }
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </Button>
                            )}
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
                                  Update Status
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
        </TabsContent>
      </Tabs>

      {/* Accept Marketplace Lead Modal */}
      {acceptModalLead && (
        <Dialog
          open={Boolean(acceptModalLead)}
          onOpenChange={(open) => !open && setAcceptModalLead(null)}
        >
          <DialogContent className="sm:max-w-130">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                Accept Marketplace Opportunity
              </DialogTitle>
              <DialogDescription>
                Accepting this assignment discloses the homeowner&apos;s direct
                phone number, email address, and adds this project to your
                active CRM pipeline.
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-2 text-emerald-950">
              <div className="font-bold text-sm text-emerald-900">
                {acceptModalLead.title}
              </div>
              <div className="text-zinc-600">
                Location:{" "}
                <span className="font-semibold text-zinc-800">
                  {acceptModalLead.projectCounty} County
                </span>
              </div>
              <div className="text-zinc-600">
                Match Score:{" "}
                <span className="font-semibold text-emerald-700">
                  {Math.round((acceptModalLead.matchScore || 0.85) * 100)}%
                </span>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setAcceptModalLead(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  acceptMutation.mutate({
                    routingEventId: acceptModalLead.routingEventId,
                  })
                }
                disabled={acceptMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
              >
                {acceptMutation.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Confirm & Unlock Contact
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Update CRM Lead Status Modal */}
      {selectedLead && (
        <Dialog open={isUpdateStatusOpen} onOpenChange={setIsUpdateStatusOpen}>
          <DialogContent className="sm:max-w-106.5">
            <DialogHeader>
              <DialogTitle>Update Lead Status</DialogTitle>
              <DialogDescription>
                Change status for {selectedLead.title}.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select
                defaultValue={selectedLead.status}
                onValueChange={(val) => {
                  updateStatusMutation.mutate({
                    leadId: selectedLead.id,
                    data: { status: val as any },
                  });
                  setIsUpdateStatusOpen(false);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="CONTACTED">Contacted</SelectItem>
                  <SelectItem value="QUALIFIED">Qualified</SelectItem>
                  <SelectItem value="PROPOSAL_SENT">Proposal Sent</SelectItem>
                  <SelectItem value="NEGOTIATION">Negotiation</SelectItem>
                  <SelectItem value="WON">Won</SelectItem>
                  <SelectItem value="LOST">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Close</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
