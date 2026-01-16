"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Star, 
  Search, 
  Filter, 
  ThumbsUp, 
  MessageSquare, 
  Store as StoreIcon, 
  HardHat,
  BadgeCheck,
  Quote
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

// --- Types based on Prisma Schema (Mocking the joined data) ---
type ReviewType = 'professional' | 'store';

interface ReviewWithRelations {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  type: ReviewType;
  reviewer: {
    firstName: string;
    lastName: string;
    imageUrl?: string;
    clientProfile?: {
      city: string;
    };
  };
  // Relations (Only one is populated based on type)
  professional?: {
    id: string; // userId
    companyName: string;
    imageUrl?: string;
    verified: boolean;
  };
  store?: {
    id: string;
    name: string;
    imageUrl?: string;
    verified: boolean;
  };
}

export default function ReviewsPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ReviewType | 'all'>('all');
  const [reviews, setReviews] = useState<ReviewWithRelations[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Simulate Prisma Fetch: 
    // await prisma.review.findMany({ include: { reviewer: true, professional: true, store: true } })
    const timer = setTimeout(() => {
      setReviews(MOCK_REVIEWS);
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Filter Logic
  const filteredReviews = reviews.filter((review) => {
    const matchesTab = activeTab === 'all' || review.type === activeTab;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      review.comment?.toLowerCase().includes(searchLower) ||
      review.professional?.companyName.toLowerCase().includes(searchLower) ||
      review.store?.name.toLowerCase().includes(searchLower);
      
    return matchesTab && matchesSearch;
  });

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
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Tabs */}
                <Tabs defaultValue="all" className="w-full md:w-auto" onValueChange={(v) => setActiveTab(v as ReviewType | 'all')}>
                  <TabsList className="grid w-full grid-cols-3 md:w-[400px]">
                    <TabsTrigger value="all">All Reviews</TabsTrigger>
                    <TabsTrigger value="professional">Pros</TabsTrigger>
                    <TabsTrigger value="store">Stores</TabsTrigger>
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
          {loading ? (
             <ReviewsSkeleton />
          ) : filteredReviews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredReviews.map((review, index) => (
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

function ReviewListCard({ review, index }: { review: ReviewWithRelations; index: number }) {
  // Determine target (Professional or Store) based on type
  const targetName = review.type === 'professional' ? review.professional?.companyName : review.store?.name;
  const targetImage = review.type === 'professional' ? review.professional?.imageUrl : review.store?.imageUrl;
  const isVerified = review.type === 'professional' ? review.professional?.verified : review.store?.verified;
  
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
              <AvatarImage src={review.reviewer.imageUrl} />
              <AvatarFallback className="bg-emerald-50 text-emerald-700 font-bold">
                {review.reviewer.firstName[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                {review.reviewer.firstName} {review.reviewer.lastName}
              </p>
              <p className="text-xs text-zinc-500">
                {review.reviewer.clientProfile?.city || "Kenya"} • {review.createdAt}
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
              &quot;{review.comment}&quot;
            </p>
          </div>

          {/* Footer: Reviewed Entity (The Hook) */}
          <div className="mt-auto pt-4 border-t border-zinc-100">
             <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                {review.type === 'professional' ? <HardHat className="h-3 w-3" /> : <StoreIcon className="h-3 w-3" />}
                Reviewed
             </div>
             
             <div className="flex items-center gap-3 bg-zinc-50 p-3 rounded-lg group-hover:bg-emerald-50/50 transition-colors cursor-pointer">
                <div className="h-10 w-10 relative rounded overflow-hidden bg-white border border-zinc-200 shrink-0">
                   {/* Fallback visual if no image */}
                   {targetImage ? (
                      <Image src={targetImage} alt={targetName || ''} fill className="object-cover" />
                   ) : (
                      <div className="h-full w-full flex items-center justify-center bg-zinc-100 text-zinc-400">
                         {review.type === 'professional' ? <HardHat className="h-5 w-5" /> : <StoreIcon className="h-5 w-5" />}
                      </div>
                   )}
                </div>
                
                <div className="flex-1 min-w-0">
                   <h4 className="text-sm font-bold text-zinc-900 truncate flex items-center gap-1">
                      {targetName}
                      {isVerified && <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />}
                   </h4>
                   <p className="text-xs text-zinc-500 truncate">
                      {review.type === 'professional' ? 'Verified Professional' : 'Verified Merchant'}
                   </p>
                </div>
                
                <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 group-hover:text-emerald-600">
                   <ThumbsUp className="h-4 w-4" />
                </Button>
             </div>
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

// --- Mock Data ---
const MOCK_REVIEWS: ReviewWithRelations[] = [
  {
    id: "1",
    rating: 5,
    comment: "Evans and his team completely transformed our kitchen. They finished two weeks ahead of schedule and the finishing is top-notch. Highly recommend for anyone in Nairobi.",
    type: "professional",
    createdAt: "2 days ago",
    reviewer: { firstName: "Sarah", lastName: "Kamau", imageUrl: "https://i.pravatar.cc/150?u=sarah", clientProfile: { city: "Nairobi" } },
    professional: { id: "p1", companyName: "Evannas Structural Engineering", verified: true, imageUrl: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800" }
  },
  {
    id: "2",
    rating: 5,
    comment: "The tiles we ordered arrived safely in Kisumu without a single crack. The packaging was excellent and delivery was prompt.",
    type: "store",
    createdAt: "1 week ago",
    reviewer: { firstName: "David", lastName: "Ochieng", imageUrl: "https://i.pravatar.cc/150?u=david", clientProfile: { city: "Kisumu" } },
    store: { id: "s1", name: "Ceramics Plaza", verified: true, imageUrl: "/tiles.png" }
  },
  {
    id: "3",
    rating: 4,
    comment: "Great architectural insights. Don helped us maximize the small plot we had in Ruaka. Just wish the 3D renders came a bit faster.",
    type: "professional",
    createdAt: "2 weeks ago",
    reviewer: { firstName: "Amina", lastName: "Zain", imageUrl: "https://i.pravatar.cc/150?u=amina", clientProfile: { city: "Ruaka" } },
    professional: { id: "p2", companyName: "Shammah Architecture", verified: true, imageUrl: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800" }
  },
  {
    id: "4",
    rating: 5,
    comment: "Best hardware store in Thika. They have authentic Crown Paints and shipping is free for bulk orders.",
    type: "store",
    createdAt: "3 weeks ago",
    reviewer: { firstName: "John", lastName: "Mwangi", clientProfile: { city: "Thika" } },
    store: { id: "s2", name: "Thika Hardware Solutions", verified: false, imageUrl: "/hardware.png" }
  },
  {
    id: "5",
    rating: 5,
    comment: "We hired Build Market pros for our entire office renovation. Seamless coordination between the electricians and the dry-wall team.",
    type: "professional",
    createdAt: "1 month ago",
    reviewer: { firstName: "Tech", lastName: "Solutions Ltd", imageUrl: "https://i.pravatar.cc/150?u=tech", clientProfile: { city: "Westlands" } },
    professional: { id: "p3", companyName: "Prime Contractors", verified: true, imageUrl: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800" }
  }
];