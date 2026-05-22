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

export function PropertiesFilter() {
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
      params.delete("page"); // Reset to page 1 on filter change
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
        value={searchParams?.get("type") || "all"}
        onValueChange={(value) => handleFilterChange("type", value)}
      >
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="SALE">Sale</SelectItem>
          <SelectItem value="RENT">Rent</SelectItem>
          <SelectItem value="LEASE">Lease</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={searchParams?.get("category") || "all"}
        onValueChange={(value) => handleFilterChange("category", value)}
      >
        <SelectTrigger className="w-[150px] h-9">
          <SelectValue placeholder="All Categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          <SelectItem value="RESIDENTIAL">Residential</SelectItem>
          <SelectItem value="COMMERCIAL">Commercial</SelectItem>
          <SelectItem value="LAND">Land</SelectItem>
          <SelectItem value="INDUSTRIAL">Industrial</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={searchParams?.get("status") || "all"}
        onValueChange={(value) => handleFilterChange("status", value)}
      >
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="AVAILABLE">Available</SelectItem>
          <SelectItem value="SOLD">Sold</SelectItem>
          <SelectItem value="RENTED">Rented</SelectItem>
          <SelectItem value="UNDER_OFFER">Under Offer</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={searchParams?.get("verified") || "all"}
        onValueChange={(value) => handleFilterChange("verified", value)}
      >
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Verification" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Verifications</SelectItem>
          <SelectItem value="true">Verified</SelectItem>
          <SelectItem value="false">Unverified</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
