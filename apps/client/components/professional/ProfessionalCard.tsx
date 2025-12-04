import React from 'react';
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  Star, 
  MapPin, 
  BadgeCheck, 
  Briefcase,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { ImageWithFallback } from "@/app/lib/ImageWithFallback";
import { getProfessionalUrl } from "@/lib/links";
import { ProfessionalCardData } from "@/types/professional";

interface ProfessionalCardProps {
  professional: ProfessionalCardData;
}

const ProfessionalCard: React.FC<ProfessionalCardProps> = ({ professional }) => {
  // 1. Generate the centralized Profile URL
  const profileUrl = getProfessionalUrl(professional.id);
  
  const fullName = professional.name || professional.companyName;
  const displayTitle = professional.title || professional.servicesOffered[0] || 'Professional';
  
  const projectCount = professional.projectCount || 0;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="h-full p-1"
    >
      <Card className="h-full flex flex-col border border-zinc-200 bg-white overflow-hidden rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 group">
        
        {/* --- 1. Hero Image (Portfolio Preview) --- */}
        <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100 border-b border-zinc-100">
          <Link href={profileUrl} className="block h-full w-full">
            <motion.div
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="h-full w-full"
            >
              <ImageWithFallback 
                src={professional.portfolioImage || '/professional-placeholder.jpg'}
                alt={`${fullName} Portfolio`}
                className="w-full h-full object-cover"
              />
            </motion.div>
          </Link>
          
          {/* Floating Rating Badge */}
          {professional.rating && (
            <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm border border-black/5">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span className="text-xs font-bold text-zinc-900">{professional.rating.toFixed(1)}</span>
              {professional.reviewCount && (
                <span className="text-xs text-zinc-500 font-medium">({professional.reviewCount})</span>
              )}
            </div>
          )}

          {/* "Verified" Badge (Houzz Style) */}
          {professional.verified && (
             <div className="absolute top-3 right-3 bg-emerald-600 text-white p-1 rounded-full shadow-md" title="Verified Pro">
                <BadgeCheck className="h-4 w-4" />
             </div>
          )}
        </div>
        
        {/* --- 2. Content Section --- */}
        <CardContent className="flex flex-col flex-grow p-5">
          
          {/* Header Info */}
          <div className="flex items-start justify-between gap-4 mb-3">
             <div className="flex-1 min-w-0">
                <Link href={profileUrl} className="group/title">
                   <h3 className="font-bold text-zinc-900 text-lg truncate group-hover/title:text-emerald-700 transition-colors">
                      {fullName}
                   </h3>
                </Link>
                <p className="text-sm text-zinc-500 font-medium truncate">{displayTitle}</p>
             </div>
             {/* Avatar Overlay */}
             <Link href={profileUrl}>
                <Avatar className="h-10 w-10 border-2 border-white shadow-sm -mt-2">
                   <AvatarImage src={professional.profileImage} />
                   <AvatarFallback className="bg-zinc-100 text-zinc-500 font-bold">
                      {fullName.charAt(0)}
                   </AvatarFallback>
                </Avatar>
             </Link>
          </div>

          {/* Location & Exp */}
          <div className="flex items-center gap-3 text-xs text-zinc-500 mb-5">
            {professional.location && (
              <div className="flex items-center gap-1 min-w-0">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{professional.location}</span>
              </div>
            )}
            <div className="h-3 w-px bg-zinc-200" />
            <span className="whitespace-nowrap">{professional.yearsExperience}+ Years Exp.</span>
          </div>

          {/* Services Tags */}
          <div className="flex flex-wrap gap-1.5 mb-6">
            {professional.servicesOffered.slice(0, 3).map((service, i) => (
              <Badge 
                key={i} 
                variant="secondary" 
                className="text-[10px] bg-zinc-50 text-zinc-600 border border-zinc-100 font-medium hover:bg-zinc-100"
              >
                {service}
              </Badge>
            ))}
            {professional.servicesOffered.length > 3 && (
              <span className="text-[10px] text-zinc-400 self-center pl-1">
                +{professional.servicesOffered.length - 3} more
              </span>
            )}
          </div>
          
          {/* --- 3. Footer Actions (Projects & Profile) --- */}
          <div className="mt-auto pt-4 border-t border-zinc-100 flex items-center gap-3">
            
            {/* Primary Action: View Projects */}
            <Button 
               variant="default" 
               className="flex-1 bg-zinc-900 hover:bg-emerald-600 text-white h-9 text-xs font-medium transition-colors"
               asChild
            >
              <Link href={profileUrl}>
                 View Profile
              </Link>
            </Button>

            {/* Secondary Action: Project Count / Link */}
            <Button 
               variant="outline" 
               className="flex-1 border-zinc-200 hover:bg-zinc-50 hover:text-emerald-600 h-9 text-xs font-medium group/btn"
               asChild
            >
               {/* This links to the same profile but implies viewing their work context */}
               <Link href={`${profileUrl}?tab=projects`}>
                  <Briefcase className="mr-2 h-3.5 w-3.5 text-zinc-400 group-hover/btn:text-emerald-500" />
                  {projectCount} Projects
               </Link>
            </Button>

          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ProfessionalCard;