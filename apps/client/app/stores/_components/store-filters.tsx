"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { StoreCategory, County } from "@prisma/client";
import { fromEnumKey } from "@/lib/links";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

export function StoreFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      params.set("page", "1"); // Reset pagination on filter change
      return params.toString();
    },
    [searchParams],
  );

  const updateSearchParam = (name: string, value: string) => {
    router.push(pathname + "?" + createQueryString(name, value));
  };

  const currentSearch = searchParams.get("search") || "";
  const currentCategory = searchParams.get("category") || "all";
  const currentCity = searchParams.get("city") || "";

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const searchQuery = formData.get("search") as string;
    updateSearchParam("search", searchQuery);
  };

  const hasActiveFilters =
    currentSearch || currentCategory !== "all" || currentCity;

  const clearFilters = () => {
    router.push(pathname);
  };

  return (
    <div className="space-y-6 lg:sticky lg:top-24">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Filters</h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-8 px-2 text-xs text-muted-foreground"
          >
            Clear all
          </Button>
        )}
      </div>

      <form onSubmit={handleSearch} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="search" className="text-sm font-medium">
            Search Stores
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              name="search"
              placeholder="e.g. Acme Hardware"
              className="pl-9"
              defaultValue={currentSearch}
            />
            {currentSearch && (
              <button
                type="button"
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                onClick={() => updateSearchParam("search", "")}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Clear search</span>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category" className="text-sm font-medium">
            Category
          </Label>
          <Select
            value={currentCategory}
            onValueChange={(val) =>
              updateSearchParam("category", val === "all" ? "" : val)
            }
          >
            <SelectTrigger id="category">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <ScrollArea className="h-48">
                <SelectItem value="all">All Categories</SelectItem>
                {Object.values(StoreCategory).map((category) => (
                  <SelectItem key={category} value={category}>
                    {fromEnumKey(category)}
                  </SelectItem>
                ))}
              </ScrollArea>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="city" className="text-sm font-medium">
            City / Location
          </Label>
          <div className="relative">
            <Input
              id="city"
              value={currentCity}
              onChange={(e) => updateSearchParam("city", e.target.value)}
              placeholder="e.g. Nairobi"
            />
            {currentCity && (
              <button
                type="button"
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                onClick={() => updateSearchParam("city", "")}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Clear location</span>
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
