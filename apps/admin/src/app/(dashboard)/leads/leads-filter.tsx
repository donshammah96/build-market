"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LeadsFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      if (value === "all") {
        params.delete(name);
      } else {
        params.set(name, value);
      }
      params.delete("page"); // Reset page
      return params.toString();
    },
    [searchParams],
  );

  const handleFilterChange = (key: string, value: string) => {
    router.push(`${pathname}?${createQueryString(key, value)}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={searchParams?.get("status") || "all"}
        onValueChange={(value) => handleFilterChange("status", value)}
      >
        <SelectTrigger className="w-[150px] h-9">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="NEW">New</SelectItem>
          <SelectItem value="CONTACTED">Contacted</SelectItem>
          <SelectItem value="PROPOSAL">Proposal</SelectItem>
          <SelectItem value="NEGOTIATION">Negotiation</SelectItem>
          <SelectItem value="WON">Won</SelectItem>
          <SelectItem value="LOST">Lost</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={searchParams?.get("projectType") || "all"}
        onValueChange={(value) => handleFilterChange("projectType", value)}
      >
        <SelectTrigger className="w-[160px] h-9">
          <SelectValue placeholder="All Project Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Project Types</SelectItem>
          <SelectItem value="NEW_CONSTRUCTION">New Construction</SelectItem>
          <SelectItem value="RENOVATION">Renovation</SelectItem>
          <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
          <SelectItem value="INTERIOR_DESIGN">Interior Design</SelectItem>
          <SelectItem value="CONSULTATION">Consultation</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={searchParams?.get("source") || "all"}
        onValueChange={(value) => handleFilterChange("source", value)}
      >
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="All Sources" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Sources</SelectItem>
          <SelectItem value="WEBSITE">Website</SelectItem>
          <SelectItem value="REFERRAL">Referral</SelectItem>
          <SelectItem value="PARTNER">Partner</SelectItem>
          <SelectItem value="DIRECT">Direct</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
