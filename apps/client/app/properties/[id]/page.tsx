"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Bed,
  Bath,
  Square,
  Heart,
  Share2,
  Phone,
  Mail,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Home,
  Building2,
  LandPlot,
  Calendar,
  User,
  Shield,
  Play,
  Maximize2,
  ArrowLeft,
} from "lucide-react";

import { Navbar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import PropertyCard, { PropertyCardData } from "@/components/real-estate/PropertyCard";
import { ROUTES } from "@/lib/links";

// Type definitions
interface PropertyAgent {
  userId: string;
  companyName: string;
  name: string;
  verified: boolean;
  bio?: string | null;
  city?: string | null;
  county?: string | null;
  profileUrl: string;
  user: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    phone?: string | null;
    avatar?: string | null;
  };
}

interface PropertyDetail {
  id: string;
  title: string;
  description?: string | null;
  price: number;
  currency: string;
  type: "SALE" | "RENT" | "LEASE";
  category: "RESIDENTIAL" | "COMMERCIAL" | "LAND" | "INDUSTRIAL";
  status: "AVAILABLE" | "SOLD" | "RENTED" | "UNDER_OFFER";
  location: string;
  address?: string | null;
  coordinates?: { lat: number; lng: number } | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaSqFt?: number | null;
  lotSize?: number | null;
  images: string[];
  floorPlan?: string | null;
  videoUrl?: string | null;
  features: string[];
  featured: boolean;
  agent: PropertyAgent;
  createdAt: string;
  updatedAt: string;
  propertyUrl: string;
}

interface ApiResponse {
  success: boolean;
  data: {
    property: PropertyDetail;
    similarProperties: PropertyCardData[];
  };
}

// Format price
const formatPrice = (price: number, currency: string) => {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);
};

// Category icons
const categoryIcons = {
  RESIDENTIAL: Home,
  COMMERCIAL: Building2,
  LAND: LandPlot,
  INDUSTRIAL: Building2,
};

// Status badge colors
const statusColors = {
  AVAILABLE: "bg-emerald-100 text-emerald-700",
  SOLD: "bg-red-100 text-red-700",
  RENTED: "bg-blue-100 text-blue-700",
  UNDER_OFFER: "bg-amber-100 text-amber-700",
};

// Type badge colors
const typeLabels = {
  SALE: "For Sale",
  RENT: "For Rent",
  LEASE: "For Lease",
};

// Mock property data for fallback when database is empty
const MOCK_PROPERTIES: Record<string, PropertyDetail> = {
  "1": {
    id: "1",
    title: "Luxury 4-Bed Villa in Karen",
    description: "Experience luxury living in this stunning 4-bedroom villa nestled in the serene Karen neighborhood. This exquisite property features spacious living areas with high ceilings, a modern open-plan kitchen, and panoramic garden views. The master suite includes a walk-in closet and en-suite bathroom. Perfect for families seeking comfort and elegance.",
    price: 85000000,
    currency: "KES",
    location: "Karen, Nairobi",
    address: "123 Karen Road, Karen",
    type: "SALE",
    category: "RESIDENTIAL",
    status: "AVAILABLE",
    bedrooms: 4,
    bathrooms: 5,
    areaSqFt: 4500,
    lotSize: 10000,
    images: [
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80",
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80"
    ],
    features: ["Swimming Pool", "Garden", "Security", "Parking", "Staff Quarters", "Gym"],
    featured: true,
    agent: {
      userId: "mock-agent-1",
      companyName: "Pam Golding Properties",
      name: "Pam Golding",
      verified: true,
      bio: "Leading real estate agency with over 20 years of experience in premium properties.",
      city: "Nairobi",
      county: "Nairobi",
      profileUrl: "/professionals/mock-agent-1",
      user: {
        id: "mock-user-1",
        firstName: "Pam",
        lastName: "Golding",
        email: "pam@example.com",
        phone: "+254700000001",
        avatar: "https://i.pravatar.cc/150?u=pg"
      }
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    propertyUrl: "/properties/1"
  },
  "2": {
    id: "2",
    title: "Modern Apartment in Kilimani",
    description: "Contemporary 2-bedroom apartment in the heart of Kilimani. Features include modern finishes, spacious balcony with city views, fully fitted kitchen, and access to building amenities including a rooftop pool and gym. Walking distance to shopping centers and restaurants.",
    price: 120000,
    currency: "KES",
    location: "Kilimani, Nairobi",
    address: "456 Argwings Kodhek Road",
    type: "RENT",
    category: "RESIDENTIAL",
    status: "AVAILABLE",
    bedrooms: 2,
    bathrooms: 2,
    areaSqFt: 1200,
    images: [
      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80",
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80"
    ],
    features: ["Rooftop Pool", "Gym", "Parking", "24/7 Security", "Balcony", "Modern Kitchen"],
    featured: true,
    agent: {
      userId: "mock-agent-2",
      companyName: "Hass Consult",
      name: "Hass Consult",
      verified: true,
      bio: "Kenya's leading property specialists.",
      city: "Nairobi",
      county: "Nairobi",
      profileUrl: "/professionals/mock-agent-2",
      user: {
        id: "mock-user-2",
        firstName: "John",
        lastName: "Hass",
        email: "john@hassconsult.co.ke",
        phone: "+254700000002",
        avatar: "https://i.pravatar.cc/150?u=hc"
      }
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    propertyUrl: "/properties/2"
  },
  "3": {
    id: "3",
    title: "Prime Commercial Space",
    description: "Premium commercial office space in the bustling Westlands business district. This open-plan space offers flexibility for various business setups. Features include fiber optic internet connectivity, backup power, modern lifts, and ample parking. Ideal for corporates and startups.",
    price: 250000,
    currency: "KES",
    location: "Westlands, Nairobi",
    address: "789 Waiyaki Way, Westlands",
    type: "LEASE",
    category: "COMMERCIAL",
    status: "UNDER_OFFER",
    areaSqFt: 2000,
    images: [
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
      "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80"
    ],
    features: ["Fiber Internet", "Backup Power", "Parking", "24/7 Security", "Modern Lifts", "Air Conditioning"],
    featured: true,
    agent: {
      userId: "mock-agent-3",
      companyName: "Knight Frank",
      name: "Knight Frank Kenya",
      verified: true,
      bio: "Global property consultancy.",
      city: "Nairobi",
      county: "Nairobi",
      profileUrl: "/professionals/mock-agent-3",
      user: {
        id: "mock-user-3",
        firstName: "Sarah",
        lastName: "Knight",
        email: "sarah@knightfrank.co.ke",
        phone: "+254700000003",
        avatar: "https://i.pravatar.cc/150?u=kf"
      }
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    propertyUrl: "/properties/3"
  },
  "4": {
    id: "4",
    title: "Half Acre Land",
    description: "Prime half-acre plot in the rapidly developing Ruaka area. Perfect for residential development or investment. The land has a clean title deed, is within a gated community, and has access to utilities including water and electricity. Great potential for appreciation.",
    price: 15000000,
    currency: "KES",
    location: "Ruaka, Kiambu",
    address: "Near Ruaka Town Centre",
    type: "SALE",
    category: "LAND",
    status: "AVAILABLE",
    areaSqFt: 21780,
    lotSize: 21780,
    images: [
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80"
    ],
    features: ["Clean Title", "Gated Community", "Water Access", "Electricity Access", "Near Town Centre", "Ready for Development"],
    featured: true,
    agent: {
      userId: "mock-agent-4",
      companyName: "Optiven Limited",
      name: "Optiven Limited",
      verified: true,
      bio: "Leading land selling company in Kenya.",
      city: "Ruaka",
      county: "Kiambu",
      profileUrl: "/professionals/mock-agent-4",
      user: {
        id: "mock-user-4",
        firstName: "George",
        lastName: "Wachiuri",
        email: "info@optiven.co.ke",
        phone: "+254700000004",
        avatar: "https://i.pravatar.cc/150?u=op"
      }
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    propertyUrl: "/properties/4"
  }
};

// Get mock similar properties (excluding the current property)
const getMockSimilarProperties = (currentId: string): PropertyCardData[] => {
  return Object.values(MOCK_PROPERTIES)
    .filter(p => p.id !== currentId)
    .slice(0, 3)
    .map(p => ({
      id: p.id,
      title: p.title,
      price: p.price,
      currency: p.currency,
      location: p.location,
      type: p.type,
      category: p.category,
      status: p.status,
      beds: p.bedrooms ?? undefined,
      baths: p.bathrooms ?? undefined,
      area: p.areaSqFt ?? undefined,
      image: p.images[0] || "/hero-realestate.jpg",
      featured: p.featured,
      agent: p.agent.user.avatar ? { name: p.agent.name, image: p.agent.user.avatar } : { name: p.agent.name }
    }));
};

export default function PropertyDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [similarProperties, setSimilarProperties] = useState<PropertyCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  // Fetch property data
  useEffect(() => {
    const fetchProperty = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`http://localhost:3500/api/properties/${id}`);
        const data: ApiResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.success === false ? "Property not found" : "Failed to fetch property");
        }

        setProperty(data.data.property);
        setSimilarProperties(data.data.similarProperties || []);
      } catch (err) {
        // Use mock data as fallback
        const mockProperty = MOCK_PROPERTIES[id];
        if (mockProperty) {
          setProperty(mockProperty);
          setSimilarProperties(getMockSimilarProperties(id));
          setError(null); // Clear error since we have mock data
        } else {
          // If no mock data for this ID, show the first mock property
          const firstMockId = Object.keys(MOCK_PROPERTIES)[0];
          const firstMockProperty = firstMockId ? MOCK_PROPERTIES[firstMockId] : undefined;
          if (firstMockProperty) {
            setProperty(firstMockProperty);
            setSimilarProperties(getMockSimilarProperties(firstMockId || ""));
            setError(null);
          } else {
            setError(err instanceof Error ? err.message : "An error occurred");
          }
        }
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProperty();
    }
  }, [id]);

  // Image navigation
  const nextImage = () => {
    if (property) {
      setCurrentImageIndex((prev) => (prev + 1) % property.images.length);
    }
  };

  const prevImage = () => {
    if (property) {
      setCurrentImageIndex((prev) => (prev - 1 + property.images.length) % property.images.length);
    }
  };

  // Share functionality
  const handleShare = async () => {
    if (navigator.share && property) {
      try {
        await navigator.share({
          title: property.title,
          text: `Check out this property: ${property.title}`,
          url: window.location.href,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard!");
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-20 w-20 rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Error state
  if (error || !property) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-20 text-center">
          <div className="max-w-md mx-auto">
            <div className="h-24 w-24 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
              <Home className="h-12 w-12 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 mb-4">Property Not Found</h1>
            <p className="text-zinc-600 mb-8">{error || "The property you're looking for doesn't exist or has been removed."}</p>
            <Button asChild>
              <Link href={ROUTES.properties}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Properties
              </Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const CategoryIcon = categoryIcons[property.category];

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans">
      <Navbar variant="light" />

      <main className="flex-1 pt-24">
        {/* Back Button */}
        <div className="container mx-auto px-4 pt-6 max-w-7xl">
          <Button variant="ghost" size="sm" asChild className="text-zinc-600 hover:text-zinc-900">
            <Link href={ROUTES.properties}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Properties
            </Link>
          </Button>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Images & Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Image Gallery */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative"
              >
                {/* Main Image */}
                <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-zinc-200">
                  <Image
                    src={property.images[currentImageIndex] || "/placeholder-property.jpg"}
                    alt={property.title}
                    fill
                    className="object-cover"
                    priority
                  />

                  {/* Badges */}
                  <div className="absolute top-4 left-4 flex gap-2">
                    <Badge className="bg-white/90 backdrop-blur-md text-zinc-900 font-semibold border-0 shadow-sm">
                      {typeLabels[property.type]}
                    </Badge>
                    {property.featured && (
                      <Badge className="bg-emerald-600 text-white border-0 shadow-sm">Featured</Badge>
                    )}
                    <Badge className={`${statusColors[property.status]} border-0 shadow-sm`}>
                      {property.status.replace("_", " ")}
                    </Badge>
                  </div>

                  {/* Action Buttons */}
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button
                      onClick={() => setIsFavorite(!isFavorite)}
                      className={`p-2 rounded-full backdrop-blur-sm transition-colors ${
                        isFavorite ? "bg-red-500 text-white" : "bg-black/20 text-white hover:bg-black/40"
                      }`}
                    >
                      <Heart className={`h-5 w-5 ${isFavorite ? "fill-current" : ""}`} />
                    </button>
                    <button
                      onClick={handleShare}
                      className="p-2 rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-sm transition-colors"
                    >
                      <Share2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setLightboxOpen(true)}
                      className="p-2 rounded-full bg-black/20 text-white hover:bg-black/40 backdrop-blur-sm transition-colors"
                    >
                      <Maximize2 className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Navigation Arrows */}
                  {property.images.length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 text-zinc-900 hover:bg-white shadow-lg transition-all"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        onClick={nextImage}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 text-zinc-900 hover:bg-white shadow-lg transition-all"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}

                  {/* Image Counter */}
                  {property.images.length > 1 && (
                    <div className="absolute bottom-4 right-4 px-3 py-1 rounded-full bg-black/60 text-white text-sm font-medium">
                      {currentImageIndex + 1} / {property.images.length}
                    </div>
                  )}
                </div>

                {/* Thumbnail Strip */}
                {property.images.length > 1 && (
                  <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                    {property.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                          idx === currentImageIndex ? "border-emerald-600 ring-2 ring-emerald-200" : "border-transparent opacity-60 hover:opacity-100"
                        }`}
                      >
                        <Image src={img} alt={`View ${idx + 1}`} fill className="object-cover" />
                      </button>
                    ))}
                    {property.floorPlan && (
                      <button className="relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden border-2 border-dashed border-zinc-300 flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 transition-colors">
                        <span className="text-xs text-zinc-600 font-medium">Floor Plan</span>
                      </button>
                    )}
                  </div>
                )}
              </motion.div>

              {/* Property Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="border-zinc-200">
                  <CardContent className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h1 className="text-2xl font-bold text-zinc-900 mb-2">{property.title}</h1>
                        <div className="flex items-center text-zinc-600">
                          <MapPin className="h-4 w-4 mr-1" />
                          <span>{property.location}</span>
                          {property.address && (
                            <span className="ml-2 text-zinc-400">• {property.address}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-emerald-600">
                          {formatPrice(property.price, property.currency)}
                        </p>
                        {property.type === "RENT" && (
                          <span className="text-sm text-zinc-500">/month</span>
                        )}
                      </div>
                    </div>

                    {/* Key Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-y border-zinc-100">
                      {property.bedrooms && (
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
                            <Bed className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-zinc-900">{property.bedrooms}</p>
                            <p className="text-xs text-zinc-500">Bedrooms</p>
                          </div>
                        </div>
                      )}
                      {property.bathrooms && (
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
                            <Bath className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-zinc-900">{property.bathrooms}</p>
                            <p className="text-xs text-zinc-500">Bathrooms</p>
                          </div>
                        </div>
                      )}
                      {property.areaSqFt && (
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
                            <Square className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-zinc-900">{property.areaSqFt.toLocaleString()}</p>
                            <p className="text-xs text-zinc-500">Sq Ft</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
                          <CategoryIcon className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-zinc-900 capitalize">{property.category.toLowerCase()}</p>
                          <p className="text-xs text-zinc-500">Category</p>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {property.description && (
                      <div className="py-6 border-b border-zinc-100">
                        <h2 className="text-lg font-bold text-zinc-900 mb-3">Description</h2>
                        <p className="text-zinc-600 leading-relaxed whitespace-pre-line">{property.description}</p>
                      </div>
                    )}

                    {/* Features */}
                    {property.features.length > 0 && (
                      <div className="py-6">
                        <h2 className="text-lg font-bold text-zinc-900 mb-4">Features & Amenities</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {property.features.map((feature, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-zinc-700">
                              <Check className="h-4 w-4 text-emerald-600" />
                              <span className="text-sm">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Right Column - Agent & Actions */}
            <div className="space-y-6">
              {/* Price Card (Mobile) */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="lg:hidden"
              >
                <Card className="border-emerald-200 bg-emerald-50">
                  <CardContent className="p-6 text-center">
                    <p className="text-3xl font-bold text-emerald-700">
                      {formatPrice(property.price, property.currency)}
                    </p>
                    {property.type === "RENT" && (
                      <span className="text-sm text-emerald-600">/month</span>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Agent Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="border-zinc-200 sticky top-24">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-bold text-zinc-900 mb-4">Contact Agent</h3>
                    
                    {/* Agent Info */}
                    <Link href={property.agent.profileUrl} className="flex items-center gap-4 mb-6 group">
                      <div className="relative h-16 w-16 rounded-full bg-zinc-200 overflow-hidden">
                        {property.agent.user.avatar ? (
                          <Image
                            src={property.agent.user.avatar}
                            alt={property.agent.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-emerald-100">
                            <User className="h-8 w-8 text-emerald-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-zinc-900 group-hover:text-emerald-600 transition-colors">
                            {property.agent.name}
                          </p>
                          {property.agent.verified && (
                            <Shield className="h-4 w-4 text-emerald-600" />
                          )}
                        </div>
                        <p className="text-sm text-zinc-600">{property.agent.companyName}</p>
                        {(property.agent.city || property.agent.county) && (
                          <p className="text-xs text-zinc-500">
                            {[property.agent.city, property.agent.county].filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                    </Link>

                    {/* Contact Buttons */}
                    <div className="space-y-3">
                      {property.agent.user.phone && (
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" asChild>
                          <a href={`tel:${property.agent.user.phone}`}>
                            <Phone className="mr-2 h-4 w-4" />
                            Call Agent
                          </a>
                        </Button>
                      )}
                      <Button variant="outline" className="w-full border-zinc-200" asChild>
                        <a href={`mailto:${property.agent.user.email}?subject=Inquiry about ${property.title}`}>
                          <Mail className="mr-2 h-4 w-4" />
                          Send Email
                        </a>
                      </Button>
                      <Button variant="outline" className="w-full border-zinc-200" asChild>
                        <Link href={`/messages?to=${property.agent.userId}`}>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Send Message
                        </Link>
                      </Button>
                    </div>

                    {/* Property Posted */}
                    <div className="mt-6 pt-4 border-t border-zinc-100">
                      <div className="flex items-center gap-2 text-sm text-zinc-500">
                        <Calendar className="h-4 w-4" />
                        <span>Posted {new Date(property.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Video Tour */}
              {property.videoUrl && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Card className="border-zinc-200">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-zinc-900 mb-4">Video Tour</h3>
                      <Button variant="outline" className="w-full" asChild>
                        <a href={property.videoUrl} target="_blank" rel="noopener noreferrer">
                          <Play className="mr-2 h-4 w-4" />
                          Watch Video Tour
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>
          </div>

          {/* Similar Properties */}
          {similarProperties.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-16"
            >
              <h2 className="text-2xl font-bold text-zinc-900 mb-6">Similar Properties</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {similarProperties.map((prop) => (
                  <PropertyCard key={prop.id} property={prop} />
                ))}
              </div>
            </motion.section>
          )}
        </div>
      </main>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          >
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>

            <button
              onClick={prevImage}
              className="absolute left-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>

            <div className="relative w-full h-full max-w-5xl max-h-[80vh] mx-4">
              <Image
                src={property.images[currentImageIndex] || "/placeholder-property.jpg"}
                alt={property.title}
                fill
                className="object-contain"
              />
            </div>

            <button
              onClick={nextImage}
              className="absolute right-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <ChevronRight className="h-8 w-8" />
            </button>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/20 text-white text-sm font-medium">
              {currentImageIndex + 1} / {property.images.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}
