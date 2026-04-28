"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { VerificationQueue } from "@/components/admin/verification/VerificationQueue";
import { UserCheck, Store, Building2, Layers } from "lucide-react";
import type {
  VerificationQueueItem,
  VerificationFilterInput,
  PaginationMeta,
} from "@/actions/admin";

interface VerificationQueueWrapperProps {
  activeTab: "all" | "professional" | "store" | "property";
  status: string;
  canVerify: boolean;
  queueData: {
    items: VerificationQueueItem[];
    pagination: PaginationMeta;
    filters: VerificationFilterInput;
  };
}

const triagePresets = [
  {
    label: "Pending Professionals",
    tab: "professional",
    status: "PENDING",
  },
  {
    label: "Needs Correction",
    tab: "all",
    status: "NEEDS_CORRECTION",
  },
  {
    label: "Rejected Follow-ups",
    tab: "all",
    status: "REJECTED",
  },
] as const;

const tabs = [
  { value: "all", label: "All", icon: Layers },
  { value: "professional", label: "Professionals", icon: UserCheck },
  { value: "store", label: "Stores", icon: Store },
  { value: "property", label: "Properties", icon: Building2 },
] as const;

const statusOptions = [
  { value: "PENDING", label: "Pending Review" },
  { value: "UNVERIFIED", label: "Unverified" },
  { value: "NEEDS_CORRECTION", label: "Needs Correction" },
  { value: "VERIFIED", label: "Verified" },
  { value: "REJECTED", label: "Rejected" },
];

export function VerificationQueueWrapper({
  activeTab,
  status,
  canVerify,
  queueData,
}: VerificationQueueWrapperProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    params.delete("page"); // Reset to first page on tab change
    router.push(`/verifications?${params.toString()}`);
  };

  const handleStatusChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", value);
    params.delete("page"); // Reset to first page on status change
    router.push(`/verifications?${params.toString()}`);
  };

  const handlePreset = (preset: {
    tab: "all" | "professional" | "store" | "property";
    status: string;
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", preset.tab);
    params.set("status", preset.status);
    params.delete("page");
    router.push(`/verifications?${params.toString()}`);
  };

  // Count items by type for badges
  const countByType = queueData.items.reduce<Record<string, number>>(
    (acc, item) => {
      acc[item.entityType] = (acc[item.entityType] ?? 0) + 1;
      acc["all"] = (acc["all"] ?? 0) + 1;
      return acc;
    },
    { all: 0, professional: 0, store: 0, property: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {triagePresets.map((preset) => {
          const isActive = activeTab === preset.tab && status === preset.status;
          return (
            <button
              key={`${preset.tab}-${preset.status}`}
              type="button"
              onClick={() => handlePreset(preset)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
        {!canVerify && (
          <Badge
            variant="outline"
            className="ml-auto text-amber-700 border-amber-300"
          >
            Read-only mode
          </Badge>
        )}
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid grid-cols-4 w-full sm:w-auto">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-2"
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                {(countByType[tab.value as keyof typeof countByType] ?? 0) >
                  0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {tab.value === "all"
                      ? queueData.pagination.total
                      : (countByType[tab.value as keyof typeof countByType] ??
                        0)}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-45">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Queue Content - Using VerificationQueue directly */}
      <VerificationQueue
        items={queueData.items}
        pagination={queueData.pagination}
        filters={queueData.filters}
        canVerify={canVerify}
      />
    </div>
  );
}
