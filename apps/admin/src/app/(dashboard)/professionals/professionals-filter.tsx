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

export function ProfessionalsFilter() {
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
        value={searchParams?.get("verified") || "all"}
        onValueChange={(value) => handleFilterChange("verified", value)}
      >
        <SelectTrigger className="w-[150px] h-9">
          <SelectValue placeholder="Verification" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="true">Verified Pros</SelectItem>
          <SelectItem value="false">Unverified Pros</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
