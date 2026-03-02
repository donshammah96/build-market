"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  Star,
  Search,
  Filter,
  ThumbsUp,
  MessageSquare,
  Store as StoreIcon,
  HardHat,
  BadgeCheck,
  Quote,
} from "lucide-react";

import { ClientNavbar } from "@/components/layout/ClientNavbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useReviews } from "@/hooks/useReviews";
import { getProfessionalUrl, getStoreUrl } from "@/lib/links";
import type { ReviewListItem } from "@/lib/reviews-client";

type TabValue = "all" | "PROFESSIONAL" | "STORE";

export default function ReviewsPage() {
  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const typeFilter = activeTab === "all" ? undefined : activeTab;
  const { data, isLoading } = useReviews({
    type: typeFilter,
    search: searchQuery.trim() || undefined,
    limit: 24,
  });

  const reviews = data?.reviews ?? [];

  return (
    <div className="min-h-screen bg-zinc-50/50 flex flex-col">
      <ClientNavbar />

      <main className="flex-1">
        
        {/* --- Hero Header --- */}
        <section className="bg-zinc-900 text-white py-20 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/hero-bg.jpg')] opacity-10 bg-cover bg-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-900/90" />
          
          <div className="container mx-auto px-4 md:px-6 relative z-10 text-center max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-4 py-1.5 rounded-full mb-6 text-sm font-medium text-emerald-300">
                <Star className="h-4 w-4 fill-emerald-300" />
                <span>Trusted by 10,000+ Kenyan Homeowners</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                Real Stories. <span className="text-emerald-500">Real Homes.</span>
              </h1>
              <p className="text-lg text-zinc-300 leading-relaxed">
                See what your neighbors in Nairobi, Mombasa, and beyond are saying about the architects, artisans, and suppliers on Build Market.
              </p>
            </motion.div>
          </div>
        </section>

        {/* --- Controls Section --- */}
        <section className="container mx-auto px-4 md:px-6 -mt-8 relative z-20 mb-12">
          <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-xl">
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                
                {/* Search */}
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input 
                    placeholder="Search reviews or companies..." 
                    className="pl-9 bg-white border-zinc-200"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                  />
                </div>

                {/* Tabs */}
                <Tabs defaultValue="all" className="w-full md:w-auto" onValueChange={(v) => setActiveTab(v as TabValue)}>
                  <TabsList className="grid w-full grid-cols-3 md:w-[400px]">
                    <TabsTrigger value="all">All Reviews</TabsTrigger>
                    <TabsTrigger value="PROFESSIONAL">Pros</TabsTrigger>
                    <TabsTrigger value="STORE">Stores</TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Filter Button (Visual Only for now) */}
                <Button variant="outline" className="hidden md:flex gap-2">
                  <Filter className="h-4 w-4" /> Filter
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* --- Reviews Grid --- */}
        <section className="container mx-auto px-4 md:px-6 pb-20">
          {isLoading ? (
             <ReviewsSkeleton />
          ) : reviews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {reviews.map((review, index) => (
                  <ReviewListCard key={review.id} review={review} index={index} />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="h-16 w-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-8 w-8 text-zinc-300" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900">No reviews found</h3>
              <p className="text-zinc-500">Try adjusting your search filters.</p>
            </div>
          )}
        </section>

      </main>
      <Footer />
    </div>
  );
}

// --- Sub-Components ---

function ReviewListCard({ review, index }: { review: ReviewListItem; index: number }) {
  const targetName = review.type === "PROFESSIONAL" ? review.professional?.companyName : review.store?.name;
  const targetImage = review.type === "PROFESSIONAL" ? review.professional?.imageUrl : review.store?.imageUrl;
  const isVerified = review.type === "PROFESSIONAL" ? review.professional?.verified : review.store?.verified;
  const targetUrl =
    review.type === "PROFESSIONAL" && review.professional
      ? getProfessionalUrl(review.professional.id)
      : review.store
        ? getStoreUrl(review.store.id)
        : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className="h-full border-zinc-200 hover:shadow-lg transition-all duration-300 flex flex-col group">
        <CardContent className="p-6 flex flex-col h-full">
          
          {/* Header: Reviewer Info */}
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-10 w-10 border border-zinc-100">
              <AvatarImage src={review.reviewer.avatar ?? undefined} />
              <AvatarFallback className="bg-emerald-50 text-emerald-700 font-bold">
                {review.reviewer.firstName[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                {review.reviewer.firstName} {review.reviewer.lastName}
              </p>
              <p className="text-xs text-zinc-500">
                {review.reviewer.city ?? "Kenya"} • {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
              </p>
            </div>
            <div className="ml-auto flex">
              {[...Array(5)].map((_, i) => (
                <Star 
                  key={i} 
                  className={cn(
                    "h-3.5 w-3.5", 
                    i < review.rating ? "fill-amber-400 text-amber-400" : "fill-zinc-200 text-zinc-200"
                  )} 
                />
              ))}
            </div>
          </div>

          {/* Body: Quote */}
          <div className="relative mb-6 flex-1">
            <Quote className="absolute -top-1 -left-1 h-6 w-6 text-zinc-100 fill-zinc-100 transform -scale-x-100" />
            <p className="relative z-10 text-zinc-600 leading-relaxed pt-2">
              &quot;{review.comment ?? ""}&quot;
            </p>
          </div>

          {/* Footer: Reviewed Entity (The Hook) */}
          <div className="mt-auto pt-4 border-t border-zinc-100">
             <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                {review.type === "PROFESSIONAL" ? <HardHat className="h-3 w-3" /> : <StoreIcon className="h-3 w-3" />}
                Reviewed
             </div>
             
             {targetUrl ? (
             <Link href={targetUrl} className="flex items-center gap-3 bg-zinc-50 p-3 rounded-lg group-hover:bg-emerald-50/50 transition-colors cursor-pointer">
                <div className="h-10 w-10 relative rounded overflow-hidden bg-white border border-zinc-200 shrink-0">
                   {/* Fallback visual if no image */}
                   {targetImage ? (
                      <Image src={targetImage} alt={targetName || ''} fill className="object-cover" />
                   ) : (
                      <div className="h-full w-full flex items-center justify-center bg-zinc-100 text-zinc-400">
                         {review.type === "PROFESSIONAL" ? <HardHat className="h-5 w-5" /> : <StoreIcon className="h-5 w-5" />}
                      </div>
                   )}
                </div>
                
                <div className="flex-1 min-w-0">
                   <h4 className="text-sm font-bold text-zinc-900 truncate flex items-center gap-1">
                      {targetName}
                      {isVerified && <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />}
                   </h4>
                   <p className="text-xs text-zinc-500 truncate">
                      {review.type === "PROFESSIONAL" ? "Verified Professional" : "Verified Merchant"}
                   </p>
                </div>
                
                <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 group-hover:text-emerald-600">
                   <ThumbsUp className="h-4 w-4" />
                </Button>
             </Link>
             ) : (
             <div className="flex items-center gap-3 bg-zinc-50 p-3 rounded-lg">
                <div className="h-10 w-10 relative rounded overflow-hidden bg-white border border-zinc-200 shrink-0">
                   {targetImage ? (
                      <Image src={targetImage} alt={targetName ?? ""} fill className="object-cover" />
                   ) : (
                      <div className="h-full w-full flex items-center justify-center bg-zinc-100 text-zinc-400">
                         {review.type === "PROFESSIONAL" ? <HardHat className="h-5 w-5" /> : <StoreIcon className="h-5 w-5" />}
                      </div>
                   )}
                </div>
                <div className="flex-1 min-w-0">
                   <h4 className="text-sm font-bold text-zinc-900 truncate flex items-center gap-1">
                      {targetName}
                      {isVerified && <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />}
                   </h4>
                   <p className="text-xs text-zinc-500 truncate">
                      {review.type === "PROFESSIONAL" ? "Verified Professional" : "Verified Merchant"}
                   </p>
                </div>
             </div>
             )}
          </div>

        </CardContent>
      </Card>
    </motion.div>
  );
}

function ReviewsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-80 bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
           <div className="flex gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                 <Skeleton className="h-4 w-32" />
                 <Skeleton className="h-3 w-20" />
              </div>
           </div>
           <Skeleton className="h-24 w-full" />
           <Skeleton className="h-20 w-full mt-auto" />
        </div>
      ))}
    </div>
  )
}