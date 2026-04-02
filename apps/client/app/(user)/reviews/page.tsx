"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Search, Filter, MessageSquare } from "lucide-react";

import { ClientNavbar } from "@/components/layout/ClientNavbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useReviews } from "@/hooks/useReviews";
import { ReviewListCard } from "./_components/review-list-card";
import { ReviewsSkeleton } from "./_components/reviews-skeleton";

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
                Real Stories.{" "}
                <span className="text-emerald-500">Real Homes.</span>
              </h1>
              <p className="text-lg text-zinc-300 leading-relaxed">
                See what your neighbors in Nairobi, Mombasa, and beyond are
                saying about the architects, artisans, and suppliers on Build
                Market.
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
                <Tabs
                  defaultValue="all"
                  className="w-full md:w-auto"
                  onValueChange={(v) => setActiveTab(v as TabValue)}
                >
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
                  <ReviewListCard
                    key={review.id}
                    review={review}
                    index={index}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="h-16 w-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="h-8 w-8 text-zinc-300" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900">
                No reviews found
              </h3>
              <p className="text-zinc-500">
                Try adjusting your search filters.
              </p>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
