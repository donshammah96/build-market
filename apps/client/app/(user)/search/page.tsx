"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, HardHat, BadgeCheck } from "lucide-react";

import { ClientNavbar } from "@/components/layout/ClientNavbar";
import { Footer } from "@/components/layout/Footer";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchProfessionals } from "@/hooks/useSearchProfessionals";
import { getProfessionalUrl } from "@/lib/links";
import type { SearchProfessionalResultDto } from "@/app/lib/domains/search/contracts";

export default function SearchPage() {
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isError, error } = useSearchProfessionals(
    searchQuery.trim(),
    true,
  );

  const results = data ?? [];
  const hasSearched = searchQuery.trim().length > 0;
  const showEmpty = hasSearched && !isLoading && results.length === 0;
  const showResults = hasSearched && !isLoading && results.length > 0;

  return (
    <div className="min-h-screen bg-zinc-50/50 flex flex-col">
      <ClientNavbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-zinc-900 text-white py-16 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/hero-bg.jpg')] opacity-10 bg-cover bg-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-900/90" />

          <div className="container mx-auto px-4 md:px-6 relative z-10 text-center max-w-2xl">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Find Verified Professionals
            </h1>
            <p className="text-zinc-300 mb-8">
              Search by company name, specialty, or service.
            </p>

            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
              <Input
                placeholder="e.g. plumber, electrician, architect..."
                className="pl-12 h-12 bg-white/10 border-white/20 text-white placeholder:text-zinc-400 focus-visible:ring-white/30"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                autoFocus
              />
            </div>
          </div>
        </section>

        {/* Results */}
        <section className="container mx-auto px-4 md:px-6 py-12 pb-20">
          {!hasSearched && (
            <div className="text-center py-20">
              <div className="h-16 w-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-zinc-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900">
                Start typing to search
              </h3>
              <p className="text-zinc-500 max-w-md mx-auto">
                Enter a company name, trade, or service to find verified
                professionals.
              </p>
            </div>
          )}

          {isLoading && hasSearched && <SearchResultsSkeleton />}

          {isError && (
            <div className="text-center py-20">
              <div className="h-16 w-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900">
                Search failed
              </h3>
              <p className="text-zinc-500 max-w-md mx-auto mb-4">
                {error?.message ?? "Something went wrong. Please try again."}
              </p>
            </div>
          )}

          {showEmpty && (
            <div className="text-center py-20">
              <div className="h-16 w-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-zinc-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900">
                No professionals found
              </h3>
              <p className="text-zinc-500 max-w-md mx-auto">
                No verified professionals match &quot;{searchQuery}&quot;. Try a
                different search term.
              </p>
            </div>
          )}

          {showResults && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map((pro) => (
                <SearchProfessionalCard key={pro.userId} professional={pro} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}

function SearchProfessionalCard({
  professional,
}: {
  professional: SearchProfessionalResultDto;
}) {
  const nameFromUser = [professional.user.firstName, professional.user.lastName]
    .filter(Boolean)
    .join(" ");
  const displayName =
    (professional.companyName ?? nameFromUser) || "Professional";

  return (
    <Link href={getProfessionalUrl(professional.userId)}>
      <Card className="h-full border-zinc-200 hover:shadow-lg transition-all duration-300 group">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-50 transition-colors">
              <HardHat className="h-7 w-7 text-zinc-500 group-hover:text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-zinc-900 truncate flex items-center gap-1.5">
                {displayName}
                {professional.verified && (
                  <BadgeCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                )}
              </h3>
              {professional.user.firstName && (
                <p className="text-sm text-zinc-500 truncate">
                  {[professional.user.firstName, professional.user.lastName]
                    .filter(Boolean)
                    .join(" ")}
                </p>
              )}
              {professional.bio && (
                <p className="text-sm text-zinc-600 mt-2 line-clamp-2">
                  {professional.bio}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function SearchResultsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Skeleton className="h-14 w-14 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
