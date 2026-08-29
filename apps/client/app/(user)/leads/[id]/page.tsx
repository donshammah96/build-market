"use client";

import { use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Clock,
  ShieldCheck,
  Compass,
  Coins,
  CheckCircle2,
  Users,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { ClientNavbar } from "@/components/layout/ClientNavbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useClientMarketplaceLead } from "@/hooks/useMarketplaceLeads";

export default function HomeownerLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const leadId = resolvedParams.id;
  const { data: lead, isLoading, isError } = useClientMarketplaceLead(leadId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50/50 flex flex-col justify-between">
        <ClientNavbar />
        <main className="container mx-auto px-4 md:px-8 py-20 text-center flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
          <p className="text-sm text-zinc-500">
            Loading project qualification details...
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  if (isError || !lead) {
    return (
      <div className="min-h-screen bg-zinc-50/50 flex flex-col justify-between">
        <ClientNavbar />
        <main className="container mx-auto px-4 md:px-8 py-20 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-zinc-900 mb-2">
            Project Not Found
          </h2>
          <p className="text-sm text-zinc-500 mb-6">
            We could not retrieve the qualification details for this project.
          </p>
          <Button asChild variant="outline">
            <Link href="/leads">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to My Projects
            </Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const score = lead.qualification?.confidenceScore
    ? Math.round(lead.qualification.confidenceScore * 100)
    : null;

  return (
    <div className="min-h-screen bg-zinc-50/50 flex flex-col justify-between">
      <div>
        <ClientNavbar />
        <main className="container mx-auto px-4 md:px-8 py-8 pt-24 max-w-5xl">
          {/* Back link */}
          <Link
            href="/leads"
            className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to My Projects
          </Link>

          {/* Header Card */}
          <Card className="border border-zinc-200 shadow-sm bg-white overflow-hidden mb-8">
            <div className="bg-linear-to-r from-emerald-600 to-teal-700 p-6 sm:p-8 text-white">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge className="bg-white/20 hover:bg-white/30 text-white border-0">
                      {lead.status}
                    </Badge>
                    <span className="text-emerald-100 text-xs flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Created {new Date(lead.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    {lead.title}
                  </h1>
                  <div className="flex items-center gap-4 text-emerald-100 text-sm mt-2 flex-wrap">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" /> {lead.projectCounty} County
                    </span>
                    <span className="capitalize">
                      {lead.projectType.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                {score !== null && (
                  <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-4 rounded-xl text-center shrink-0">
                    <div className="text-xs uppercase font-semibold tracking-wider text-emerald-100">
                      AI Readiness Score
                    </div>
                    <div className="text-3xl font-black mt-0.5">{score}%</div>
                    <Badge className="bg-emerald-400/20 text-emerald-100 border-0 capitalize text-xs mt-1">
                      {lead.qualification?.confidenceLabel} Confidence
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            <CardContent className="p-6">
              {/* Stepper Status Progression */}
              <div className="py-4 border-b border-zinc-100 mb-6">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                  Intake Progression
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                    1. Draft Intake
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                    2. AI Scored
                  </div>
                  <div
                    className={`p-2.5 rounded-lg border ${
                      lead.status === "ROUTED" || lead.status === "QUALIFIED"
                        ? "bg-emerald-50 text-emerald-700 font-semibold border-emerald-200"
                        : "bg-zinc-50 text-zinc-400 border-zinc-200"
                    }`}
                  >
                    3. Professional Routing
                  </div>
                  <div
                    className={`p-2.5 rounded-lg border ${
                      lead.routingCount > 0
                        ? "bg-emerald-50 text-emerald-700 font-semibold border-emerald-200"
                        : "bg-zinc-50 text-zinc-400 border-zinc-200"
                    }`}
                  >
                    4. Professional Engaged
                  </div>
                </div>
              </div>

              {/* Factor Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50">
                  <div className="flex items-center gap-2 mb-2 text-emerald-700 font-semibold text-sm">
                    <ShieldCheck className="w-4 h-4" />
                    Land Ownership (40%)
                  </div>
                  <div className="text-xs text-zinc-800 font-medium capitalize mb-1">
                    {lead.qualification?.landOwnershipStatus?.replace(
                      /_/g,
                      " ",
                    ) ?? "Not declared"}
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Verified registered property title deed in Kenya
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50">
                  <div className="flex items-center gap-2 mb-2 text-blue-700 font-semibold text-sm">
                    <Compass className="w-4 h-4" />
                    Architecture (25%)
                  </div>
                  <div className="text-xs text-zinc-800 font-medium capitalize mb-1">
                    {lead.qualification?.architecturalStage?.replace(
                      /_/g,
                      " ",
                    ) ?? "Not declared"}
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Engineering, county approvals and stamped permits
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50">
                  <div className="flex items-center gap-2 mb-2 text-amber-700 font-semibold text-sm">
                    <Coins className="w-4 h-4" />
                    Budget Readiness (35%)
                  </div>
                  <div className="text-xs text-zinc-800 font-medium capitalize mb-1">
                    {lead.qualification?.budgetReadiness?.replace(/_/g, " ") ??
                      "Not declared"}
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Funding source & construction disbursement capability
                  </p>
                </div>
              </div>

              {/* Matched Professionals Info */}
              <div className="mt-8 pt-6 border-t border-zinc-100">
                <h3 className="text-sm font-bold text-zinc-900 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  Matched Verified Professionals ({lead.routingCount})
                </h3>
                {lead.routingCount > 0 ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      Your project has been matched and routed to{" "}
                      {lead.routingCount} top-tier verified professionals in{" "}
                      {lead.projectCounty} County. Once they accept the
                      assignment, they will contact you directly.
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-600">
                    Routing in progress. Our system is matching your project
                    requirements with verified architects and contractors in
                    your county.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
      <Footer />
    </div>
  );
}
