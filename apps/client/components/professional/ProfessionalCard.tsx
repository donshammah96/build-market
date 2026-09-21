"use client";

import React, { memo } from "react";
import Link from "next/link";
import { Star, MapPin, BadgeCheck, Briefcase } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { ImageWithFallback } from "@/app/lib/media/ImageWithFallback";
import { getProfessionalUrl } from "@/lib/routes";
import { ProfessionalCardData } from "@/types/professional";
import { getProfessionLabel } from "@/lib/constants/professionalCategories";
import { cn } from "@/lib/utils";
import { SponsoredLabel } from "@build/ui/sponsored-label";
import type { TrustTierType } from "@build/ui/trust-seal-badge";

interface ProfessionalCardProps {
  professional: ProfessionalCardData & {
    isSponsored?: boolean;
    trustTier?: TrustTierType;
    authority?: string;
  };
}

const ProfessionalCard: React.FC<ProfessionalCardProps> = memo(
  function ProfessionalCard({ professional }) {
    const profileUrl = getProfessionalUrl(professional.id);
    const services = professional.services ?? [];
    const serviceCount = services.length;

    const fullName = professional.name || professional.companyName;
    const primaryService = services[0]?.name || "Professional";
    const displayTitle =
      professional.title || getProfessionLabel(primaryService);
    const projectCount = professional.projectCount || 0;
    const isSponsored = Boolean(professional.isSponsored);

    return (
      <div className="h-full p-1 hover-lift">
        <Card
          className={cn(
            "h-full flex flex-col border overflow-hidden rounded-xl shadow-xs transition-all duration-300 hover:shadow-lg group",
            isSponsored
              ? "border-[#F2D18B] bg-[#FFFCF5] ring-1 ring-[#F2D18B]/50"
              : "border-zinc-200 bg-white",
          )}
        >
          {/* Top Banner for Boosted / Sponsored placements */}
          {isSponsored && (
            <div className="px-3 py-1.5 bg-[#FFF8E6] border-b border-[#F2D18B] flex items-center justify-between">
              <SponsoredLabel size="sm" />
              <span className="text-[10px] font-mono text-neutral-500">
                Featured Partner
              </span>
            </div>
          )}
          {/* Hero Image (Portfolio Preview) */}
          <div className="relative aspect-4/3 overflow-hidden bg-zinc-100 border-b border-zinc-100">
            <Link href={profileUrl} className="block h-full w-full">
              <div className="h-full w-full overflow-hidden">
                <ImageWithFallback
                  src={
                    professional.portfolioImage ||
                    "/professional-placeholder.jpg"
                  }
                  alt={`${fullName} Portfolio`}
                  className="w-full h-full object-cover img-zoom"
                />
              </div>
            </Link>

            {/* Floating Rating Badge */}
            {professional.rating && (
              <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm border border-black/5">
                <Star
                  className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                  aria-hidden="true"
                />
                <span className="text-xs font-bold text-zinc-900">
                  {professional.rating.toFixed(1)}
                </span>
                {professional.reviewCount && (
                  <span className="text-xs text-zinc-500 font-medium">
                    ({professional.reviewCount})
                  </span>
                )}
              </div>
            )}

            {/* Verified Badge */}
            {professional.verified && (
              <div
                className="absolute top-3 right-3 bg-emerald-600 text-white p-1 rounded-full shadow-md"
                title="Verified Pro"
                aria-label="Verified Professional"
              >
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
              </div>
            )}
          </div>

          {/* Content Section */}
          <CardContent className="flex flex-col grow p-5">
            {/* Header Info */}
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <Link href={profileUrl} className="group/title">
                  <h3 className="font-bold text-zinc-900 text-lg truncate group-hover/title:text-emerald-700 transition-colors">
                    {fullName}
                  </h3>
                </Link>
                <p className="text-sm text-zinc-500 font-medium truncate">
                  {displayTitle}
                </p>
              </div>
              <Link href={profileUrl}>
                <Avatar className="h-10 w-10 border-2 border-white shadow-sm -mt-2">
                  <AvatarImage src={professional.profileImage} alt="" />
                  <AvatarFallback className="bg-zinc-100 text-zinc-500 font-bold">
                    {fullName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </Link>
            </div>

            {/* Location & Experience */}
            <div className="flex items-center gap-3 text-xs text-zinc-500 mb-5">
              {professional.location && (
                <div className="flex items-center gap-1 min-w-0">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{professional.location}</span>
                </div>
              )}
              <div className="h-3 w-px bg-zinc-200" aria-hidden="true" />
              <span className="whitespace-nowrap">
                {professional.yearsExperience}+ Years Exp.
              </span>
            </div>

            {/* Services Tags */}
            <div
              className="flex flex-wrap gap-1.5 mb-6"
              role="list"
              aria-label="Services offered"
            >
              {services.slice(0, 3).map((service, i) => (
                <Badge
                  key={service.id || i}
                  variant="secondary"
                  className="text-[10px] bg-zinc-50 text-zinc-600 border border-zinc-100 font-medium hover:bg-zinc-100"
                >
                  {service.name}
                </Badge>
              ))}
              {serviceCount > 3 && (
                <span className="text-[10px] text-zinc-400 self-center pl-1">
                  +{serviceCount - 3} more
                </span>
              )}
            </div>

            {/* Footer Actions */}
            <div className="mt-auto pt-4 border-t border-zinc-100 flex items-center gap-3">
              <Button
                variant="default"
                className="flex-1 bg-zinc-900 hover:bg-emerald-600 text-white h-9 text-xs font-medium transition-colors"
                asChild
              >
                <Link href={profileUrl}>View Profile</Link>
              </Button>

              <Button
                variant="outline"
                className="flex-1 border-zinc-200 hover:bg-zinc-50 hover:text-emerald-600 h-9 text-xs font-medium group/btn"
                asChild
              >
                <Link href={`${profileUrl}?tab=projects`}>
                  <Briefcase
                    className="mr-2 h-3.5 w-3.5 text-zinc-400 group-hover/btn:text-emerald-500"
                    aria-hidden="true"
                  />
                  {projectCount} Projects
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  },
);

export default ProfessionalCard;
