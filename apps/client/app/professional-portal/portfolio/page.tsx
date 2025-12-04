"use client";

import { useState } from "react";
import { 
  Plus, 
  MoreVertical, 
  Image as ImageIcon, 
  Eye, 
  Edit, 
  Trash2,
  ExternalLink
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

// --- Mock Data ---
const PORTFOLIO_ITEMS = [
  {
    id: "1",
    title: "Modern Minimalist Kitchen",
    category: "Kitchen",
    image: "/images/portfolio/kitchen-1.jpg",
    views: 1240,
    likes: 45,
    status: "Published"
  },
  {
    id: "2",
    title: "Luxury Master Bathroom",
    category: "Bathroom",
    image: "/images/portfolio/bath-1.jpg",
    views: 850,
    likes: 32,
    status: "Published"
  },
  {
    id: "3",
    title: "Urban Garden Landscape",
    category: "Landscape",
    image: "/images/portfolio/garden-1.jpg",
    views: 2100,
    likes: 120,
    status: "Featured"
  },
  {
    id: "4",
    title: "Open Plan Living Room",
    category: "Living Room",
    image: "/images/portfolio/living-1.jpg",
    views: 560,
    likes: 18,
    status: "Draft"
  },
  {
    id: "5",
    title: "Compact Studio Apartment",
    category: "Apartment",
    image: "/images/portfolio/studio-1.jpg",
    views: 980,
    likes: 55,
    status: "Published"
  }
];

export default function PortfolioPage() {
  const { data: apiPortfolioItems, isLoading } = useQuery({
    queryKey: ["professional-portfolio"],
    queryFn: async () => {
      const response = await fetch("/api/professional-portal/portfolio");
      if (!response.ok) throw new Error("Failed to fetch portfolio");
      const result = await response.json();
      return result.data;
    },
  });

  // Use API data if available and not empty, otherwise fallback to mock data
  const portfolioItems = (apiPortfolioItems && apiPortfolioItems.length > 0) ? apiPortfolioItems : PORTFOLIO_ITEMS;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
      
      {/* --- Header --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Portfolio</h1>
          <p className="text-zinc-500 mt-1 text-sm">
            Showcase your best work to attract more clients.
          </p>
        </div>
        <Button className="bg-zinc-900 hover:bg-zinc-800 text-white shadow-md">
          <Plus className="mr-2 h-4 w-4" /> Add Project
        </Button>
      </div>

      {/* --- Portfolio Grid --- */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[300px] bg-zinc-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          
          {/* Upload Placeholder */}
          <Card className="border-2 border-dashed border-zinc-200 bg-zinc-50/50 hover:bg-zinc-50 hover:border-zinc-300 transition-all cursor-pointer group flex flex-col items-center justify-center h-full min-h-[300px]">
            <div className="h-12 w-12 rounded-full bg-white border border-zinc-200 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
              <Plus className="h-6 w-6 text-zinc-400 group-hover:text-zinc-900" />
            </div>
            <h3 className="font-semibold text-zinc-900">Create New Project</h3>
            <p className="text-sm text-zinc-500 mt-1">Upload photos & details</p>
          </Card>

          {portfolioItems.map((item: any) => (
            <PortfolioItemCard key={item.id} item={item} />
          ))}
        </div>
      )}

    </div>
  );
}

function PortfolioItemCard({ item }: { item: any }) {
  return (
    <Card className="border border-zinc-200 shadow-sm hover:shadow-md transition-all duration-300 bg-white group overflow-hidden">
      <div className="relative">
        <AspectRatio ratio={4/3} className="bg-zinc-100">
          {/* Placeholder for image */}
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 text-zinc-300">
            <ImageIcon className="h-10 w-10" />
          </div>
          {/* Overlay Actions */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-start justify-end p-2 opacity-0 group-hover:opacity-100">
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="secondary" className="h-8 w-8 bg-white/90 hover:bg-white shadow-sm backdrop-blur-sm">
                  <MoreVertical className="h-4 w-4 text-zinc-700" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Eye className="mr-2 h-4 w-4" /> View
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem className="text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {/* Status Badge */}
          <div className="absolute top-2 left-2">
            <Badge className={`
              ${item.status === 'Featured' ? 'bg-amber-400 text-amber-900 hover:bg-amber-500' : 
                item.status === 'Draft' ? 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300' : 
                'bg-emerald-500 text-white hover:bg-emerald-600'} border-0 shadow-sm
            `}>
              {item.status}
            </Badge>
          </div>
        </AspectRatio>
      </div>
      
      <CardContent className="p-4">
        <h3 className="font-bold text-zinc-900 truncate">{item.title}</h3>
        <p className="text-xs text-zinc-500 mt-1">{item.category}</p>
        
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-50">
          <div className="flex gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" /> {item.views}
            </span>
            <span className="flex items-center gap-1">
              <ImageIcon className="h-3.5 w-3.5" /> {item.likes}
            </span>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-zinc-900 hover:bg-zinc-100 -mr-2">
            View <ExternalLink className="ml-1.5 h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
