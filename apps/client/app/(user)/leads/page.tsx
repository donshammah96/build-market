"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Building2,
  MapPin,
  Sparkles,
  FileCheck,
  Users,
  Clock,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { ClientNavbar } from "@/components/layout/ClientNavbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useClientMarketplaceLeads } from "@/hooks/useMarketplaceLeads";

export default function HomeownerLeadsDashboardPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: leads, isLoading } = useClientMarketplaceLeads();

  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    return leads.filter((lead) => {
      const matchSearch =
        (lead.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.projectCounty.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.projectType.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [leads, searchQuery]);

  const stats = useMemo(() => {
    if (!leads) return { total: 0, qualified: 0, routed: 0, verifiedDocs: 0 };
    return {
      total: leads.length,
      qualified: leads.filter(
        (l) => l.status === "QUALIFIED" || l.status === "ROUTED",
      ).length,
      routed: leads.reduce((acc, l) => acc + l.routingCount, 0),
      verifiedDocs: leads.reduce((acc, l) => acc + l.documentCount, 0),
    };
  }, [leads]);

  return (
    <div className="min-h-screen bg-zinc-50/50 flex flex-col justify-between">
      <div>
        <ClientNavbar />
        <main className="container mx-auto px-4 md:px-8 py-8 pt-24 max-w-7xl">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
                My Construction Projects
              </h1>
              <p className="text-zinc-600 mt-1">
                Track your qualified project inquiries, AI confidence scores,
                and matched professionals.
              </p>
            </div>
            <Button
              asChild
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm"
            >
              <Link href="/leads/new">
                <Plus className="w-4 h-4" /> Start New Project Intake
              </Link>
            </Button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="border border-zinc-200 shadow-sm bg-white">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Total Intakes
                  </div>
                  <div className="text-2xl font-bold text-zinc-900 mt-1">
                    {stats.total}
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
                    Qualified Readiness
                  </div>
                  <div className="text-2xl font-bold text-emerald-600 mt-1">
                    {stats.qualified}
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
                    Professional Matches
                  </div>
                  <div className="text-2xl font-bold text-blue-600 mt-1">
                    {stats.routed}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-zinc-200 shadow-sm bg-white">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Attached Documents
                  </div>
                  <div className="text-2xl font-bold text-amber-600 mt-1">
                    {stats.verifiedDocs}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <FileCheck className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search by project title, county..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
          </div>

          {/* Leads Listing */}
          {isLoading ? (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
              <p className="text-sm text-zinc-500">
                Loading your project intakes...
              </p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <Card className="border border-dashed border-zinc-300 bg-white p-12 text-center">
              <Building2 className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-zinc-900 mb-1">
                No construction projects found
              </h3>
              <p className="text-sm text-zinc-500 max-w-md mx-auto mb-6">
                Start your first project intake to get your land, drawings, and
                budget evaluated for instant matching with verified
                professionals.
              </p>
              <Button
                asChild
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                <Link href="/leads/new">
                  <Plus className="w-4 h-4" /> Start Project Intake
                </Link>
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredLeads.map((lead) => {
                const scorePercent = lead.qualification?.confidenceScore
                  ? Math.round(lead.qualification.confidenceScore * 100)
                  : null;

                return (
                  <Card
                    key={lead.leadId}
                    className="border border-zinc-200 hover:border-emerald-500/50 hover:shadow-md transition-all bg-white overflow-hidden"
                  >
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-bold text-lg text-zinc-900 hover:text-emerald-600 transition-colors">
                              {lead.title}
                            </span>
                            <Badge
                              variant={
                                lead.status === "QUALIFIED"
                                  ? "default"
                                  : lead.status === "ROUTED"
                                    ? "secondary"
                                    : "outline"
                              }
                              className="text-xs font-semibold"
                            >
                              {lead.status}
                            </Badge>
                            {lead.qualification?.confidenceLabel && (
                              <Badge
                                variant="outline"
                                className="border-emerald-300 text-emerald-800 bg-emerald-50 text-xs gap-1"
                              >
                                <Sparkles className="w-3 h-3 text-emerald-600" />
                                {lead.qualification.confidenceLabel.toUpperCase()}{" "}
                                READINESS
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-xs text-zinc-500 flex-wrap">
                            <span className="flex items-center gap-1 font-medium text-zinc-700">
                              <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                              {lead.projectCounty} County
                            </span>
                            <span className="capitalize font-medium text-zinc-700">
                              {lead.projectType.replace(/_/g, " ")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-zinc-400" />
                              Created{" "}
                              {new Date(lead.createdAt).toLocaleDateString()}
                            </span>
                          </div>

                          {/* Quick Factor Indicators */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-xs">
                            <div className="bg-zinc-50 p-2 rounded-md border border-zinc-100">
                              <div className="text-zinc-400 text-[10px] uppercase font-semibold">
                                Land Status
                              </div>
                              <div className="text-zinc-800 font-medium truncate">
                                {lead.qualification?.landOwnershipStatus
                                  ? lead.qualification.landOwnershipStatus.replace(
                                      /_/g,
                                      " ",
                                    )
                                  : "Not specified"}
                              </div>
                            </div>
                            <div className="bg-zinc-50 p-2 rounded-md border border-zinc-100">
                              <div className="text-zinc-400 text-[10px] uppercase font-semibold">
                                Architectural Stage
                              </div>
                              <div className="text-zinc-800 font-medium truncate">
                                {lead.qualification?.architecturalStage
                                  ? lead.qualification.architecturalStage.replace(
                                      /_/g,
                                      " ",
                                    )
                                  : "Not specified"}
                              </div>
                            </div>
                            <div className="bg-zinc-50 p-2 rounded-md border border-zinc-100">
                              <div className="text-zinc-400 text-[10px] uppercase font-semibold">
                                Budget Range
                              </div>
                              <div className="text-zinc-800 font-medium truncate">
                                {lead.qualification?.budgetRangeMin &&
                                lead.qualification?.budgetRangeMax
                                  ? `KES ${(lead.qualification.budgetRangeMin / 1000000).toFixed(1)}M - ${(lead.qualification.budgetRangeMax / 1000000).toFixed(1)}M`
                                  : "Declared"}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right: Score & Actions */}
                        <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-4 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-zinc-100">
                          {scorePercent !== null && (
                            <div className="text-right">
                              <div className="text-xs text-zinc-500 font-medium">
                                Confidence Score
                              </div>
                              <div className="text-2xl font-black text-emerald-600">
                                {scorePercent}%
                              </div>
                            </div>
                          )}

                          <Button
                            asChild
                            variant="outline"
                            className="hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 gap-1 text-xs"
                          >
                            <Link href={`/leads/${lead.leadId}`}>
                              View Details <ChevronRight className="w-4 h-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>
      <Footer />
    </div>
  );
}
