"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  Suspense,
  memo,
} from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  Search,
  Star,
  SlidersHorizontal,
  Briefcase,
  Award,
  Users,
  X,
  Loader2,
} from "lucide-react";

import { Navbar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import ProfessionalCard from "@/components/professional/ProfessionalCard";
import { ProfessionalCardData } from "@/types/professional";
import { CATEGORIES } from "@/lib/constants/professionalCategories";
import {
  useShouldAnimate,
  useIntersectionObserver,
} from "@/lib/hooks/usePerformance";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  { value: "rating", label: "Top Rated", icon: Star },
  { value: "experience", label: "Most Experienced", icon: Award },
  { value: "reviews", label: "Most Reviewed", icon: Users },
] as const;

// =============================================================================
// Sub-components (Memoized for performance)
// =============================================================================

const ProfessionalsSkeleton = memo(function ProfessionalsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="aspect-[4/3] w-full" />
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="flex gap-3 pt-4 border-t">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 flex-1" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
});

const EmptyState = memo(function EmptyState({
  search,
  category,
  onClear,
}: {
  search: string;
  category: string;
  onClear: () => void;
}) {
  const shouldAnimate = useShouldAnimate();

  return (
    <div
      className={cn(
        "text-center py-20 px-4",
        shouldAnimate && "animate-scale-in"
      )}
    >
      <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <Search className="w-10 h-10 text-zinc-400" />
      </div>
      <h3 className="text-xl font-semibold text-zinc-900 mb-2">
        No professionals found
      </h3>
      <p className="text-zinc-500 max-w-md mx-auto mb-6">
        {search
          ? `We couldn't find any professionals matching "${search}"`
          : `We couldn't find any professionals in the "${category}" category`}
        . Try adjusting your search or filters.
      </p>
      <Button onClick={onClear} variant="outline" className="gap-2">
        <X className="h-4 w-4" />
        Clear Filters
      </Button>
    </div>
  );
});

const CategoryTabs = memo(function CategoryTabs({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (slug: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {CATEGORIES.map((category) => {
          const Icon = category.icon;
          const isSelected = selected === category.slug;

          return (
            <button
              key={category.slug}
              onClick={() => onChange(category.slug)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap",
                "transition-all duration-200 snap-start shrink-0",
                isSelected
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                  : "bg-white text-zinc-600 border border-zinc-200 hover:border-emerald-300 hover:text-emerald-600"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm font-medium">{category.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

const StatsBar = memo(function StatsBar({
  count,
  category,
}: {
  count: number;
  category: string;
}) {
  const categoryName =
    CATEGORIES.find((c) => c.slug === category)?.name || "All Professionals";

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="bg-emerald-50 text-emerald-700 border-emerald-200"
        >
          {count} {count === 1 ? "Professional" : "Professionals"}
        </Badge>
        {category !== "all" && (
          <span className="text-sm text-zinc-500">in {categoryName}</span>
        )}
      </div>
    </div>
  );
});

// Memoized professional card wrapper
const ProfessionalCardItem = memo(function ProfessionalCardItem({
  professional,
  index,
  shouldAnimate,
  isInView,
}: {
  professional: ProfessionalCardData;
  index: number;
  shouldAnimate: boolean;
  isInView: boolean;
}) {
  return (
    <div
      className={cn(isInView && shouldAnimate && "animate-fade-in-up")}
      style={{
        animationDelay:
          isInView && shouldAnimate ? `${(index % 8) * 50}ms` : "0ms",
      }}
    >
      <ProfessionalCard professional={professional} />
    </div>
  );
});

// Category section component
const CategorySection = memo(function CategorySection({
  category,
  professionals,
  onViewAll,
}: {
  category: string;
  professionals: ProfessionalCardData[];
  onViewAll: (category: string) => void;
}) {
  const [ref, isInView] = useIntersectionObserver();
  const shouldAnimate = useShouldAnimate();

  if (professionals.length === 0) return null;

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className={cn(isInView && shouldAnimate && "animate-fade-in-up")}
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-zinc-900">{category}</h2>
        <Badge variant="secondary" className="text-zinc-600">
          {professionals.length}{" "}
          {professionals.length === 1 ? "Professional" : "Professionals"}
        </Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {professionals.slice(0, 4).map((professional, index) => (
          <ProfessionalCardItem
            key={professional.id}
            professional={professional}
            index={index}
            shouldAnimate={shouldAnimate}
            isInView={isInView}
          />
        ))}
      </div>
      {professionals.length > 4 && (
        <div className="mt-6 text-center">
          <Button
            variant="outline"
            onClick={() =>
              onViewAll(category.toLowerCase().replace(/\s+/g, "-"))
            }
          >
            View All {category} ({professionals.length})
          </Button>
        </div>
      )}
    </section>
  );
});

// =============================================================================
// Main Component
// =============================================================================

function ProfessionalsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shouldAnimate = useShouldAnimate();
  const [heroRef, heroInView] = useIntersectionObserver();

  // URL state
  const urlSearch = searchParams.get("search") || "";
  const urlCategory = searchParams.get("category") || "all";
  const urlSort =
    (searchParams.get("sortBy") as "rating" | "experience" | "reviews") ||
    "rating";

  // Local state
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [professionals, setProfessionals] = useState<ProfessionalCardData[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce search
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update URL params
  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (
          value === null ||
          value === "" ||
          (key === "category" && value === "all")
        ) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      const queryString = params.toString();
      router.push(`${pathname}${queryString ? `?${queryString}` : ""}`, {
        scroll: false,
      });
    },
    [pathname, router, searchParams]
  );

  // Fetch professionals
  const fetchProfessionals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (urlSearch) params.set("search", urlSearch);
      if (urlCategory && urlCategory !== "all")
        params.set("category", urlCategory);
      if (urlSort) params.set("sortBy", urlSort);

      const response = await fetch(`/api/professionals?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch professionals");
      }

      const result = await response.json();
      setProfessionals(Array.isArray(result) ? result : result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [urlSearch, urlCategory, urlSort]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchProfessionals();
  }, [fetchProfessionals]);

  // Handle search input with debounce
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        updateParams({ search: value || null });
      }, 300);
    },
    [updateParams]
  );

  // Handle category change
  const handleCategoryChange = useCallback(
    (slug: string) => {
      updateParams({ category: slug === "all" ? null : slug });
    },
    [updateParams]
  );

  // Handle sort change
  const handleSortChange = useCallback(
    (value: string) => {
      updateParams({ sortBy: value });
    },
    [updateParams]
  );

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSearchInput("");
    updateParams({ search: null, category: null, sortBy: null });
  }, [updateParams]);

  // Group professionals by primary service for category sections
  const groupedProfessionals = professionals.reduce(
    (acc, prof) => {
      const primaryService = prof.services?.[0]?.name || "Other";
      if (!acc[primaryService]) {
        acc[primaryService] = [];
      }
      acc[primaryService].push(prof);
      return acc;
    },
    {} as Record<string, ProfessionalCardData[]>
  );

  return (
    <div className="min-h-screen bg-zinc-50">
      <Navbar variant="default" />

      {/* Hero Section */}
      <section
        ref={heroRef as React.RefObject<HTMLElement>}
        className="relative bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 pt-32 pb-16 overflow-hidden"
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10" aria-hidden="true">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        <div className="relative container mx-auto px-4 md:px-8 max-w-7xl">
          <div
            className={cn(
              "text-center max-w-3xl mx-auto",
              heroInView && shouldAnimate && "animate-fade-in-up"
            )}
          >
            <Badge className="mb-4 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              <Briefcase className="h-3 w-3 mr-1" />
              Verified Professionals
            </Badge>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
              Find Your Trusted{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                Professional
              </span>
            </h1>

            <p className="text-lg text-zinc-400 mb-10 max-w-xl mx-auto">
              Connect with Kenya&apos;s top verified architects, engineers, and
              contractors for your next project.
            </p>

            {/* Search Bar */}
            <div className="relative max-w-2xl mx-auto">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-zinc-400" />
              </div>
              <Input
                type="text"
                placeholder="Search by name, service, or location..."
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full h-14 pl-14 pr-6 text-lg bg-white border-0 rounded-full shadow-xl focus-visible:ring-2 focus-visible:ring-emerald-500"
                aria-label="Search professionals"
              />
              {searchInput && (
                <button
                  onClick={() => handleSearchChange("")}
                  className="absolute inset-y-0 right-4 flex items-center"
                  aria-label="Clear search"
                >
                  <X className="h-5 w-5 text-zinc-400 hover:text-zinc-600 transition-colors" />
                </button>
              )}
            </div>

            {/* Quick Stats */}
            <div className="flex items-center justify-center gap-8 mt-10 text-sm flex-wrap">
              <div className="flex items-center gap-2 text-zinc-400">
                <Award className="h-4 w-4 text-emerald-400" />
                <span>100+ Verified Pros</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-400">
                <Star className="h-4 w-4 text-amber-400" />
                <span>4.8 Average Rating</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-400">
                <Users className="h-4 w-4 text-blue-400" />
                <span>1000+ Happy Clients</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main
        className="container mx-auto px-4 md:px-8 max-w-7xl py-10"
        id="results"
      >
        {/* Filters Bar */}
        <div className="mb-8">
          {/* Category Tabs */}
          <CategoryTabs
            selected={urlCategory}
            onChange={handleCategoryChange}
          />

          {/* Sort & Filters Row */}
          <div className="flex items-center justify-between mt-6 gap-4 flex-wrap">
            <StatsBar count={professionals.length} category={urlCategory} />

            <div className="flex items-center gap-3">
              <Select value={urlSort} onValueChange={handleSortChange}>
                <SelectTrigger className="w-[180px] bg-white">
                  <SlidersHorizontal className="h-4 w-4 mr-2 text-zinc-400" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Results */}
        {error ? (
          <div
            className={cn(
              "text-center py-20",
              shouldAnimate && "animate-fade-in"
            )}
          >
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 mb-2">
              Something went wrong
            </h3>
            <p className="text-zinc-500 mb-4">{error}</p>
            <Button onClick={fetchProfessionals} variant="outline">
              Try Again
            </Button>
          </div>
        ) : loading ? (
          <ProfessionalsSkeleton />
        ) : professionals.length === 0 ? (
          <EmptyState
            search={urlSearch}
            category={urlCategory}
            onClear={handleClearFilters}
          />
        ) : urlCategory === "all" && !urlSearch ? (
          // Grouped by category view
          <div className="space-y-12">
            {Object.entries(groupedProfessionals).map(([category, profs]) => (
              <CategorySection
                key={category}
                category={category}
                professionals={profs}
                onViewAll={handleCategoryChange}
              />
            ))}
          </div>
        ) : (
          // Flat grid view (when filtered)
          <ProfessionalsGrid
            professionals={professionals}
            shouldAnimate={shouldAnimate}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}

// Separate grid component for filtered view
const ProfessionalsGrid = memo(function ProfessionalsGrid({
  professionals,
  shouldAnimate,
}: {
  professionals: ProfessionalCardData[];
  shouldAnimate: boolean;
}) {
  const [ref, isInView] = useIntersectionObserver();

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
    >
      {professionals.map((professional, index) => (
        <ProfessionalCardItem
          key={professional.id}
          professional={professional}
          index={index}
          shouldAnimate={shouldAnimate}
          isInView={isInView}
        />
      ))}
    </div>
  );
});

// Wrap with Suspense for useSearchParams
export default function ProfessionalsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <ProfessionalsPageContent />
    </Suspense>
  );
}
