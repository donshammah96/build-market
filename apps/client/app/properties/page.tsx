"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  MapPin,
  Home,
  Building2,
  Warehouse,
  ArrowRight,
  LandPlot,
} from "lucide-react";

import { Navbar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PropertyCard from "@/components/real-estate/PropertyCard";
import {
  PropertyCardData,
  PROPERTY_TYPE_LABELS,
  PROPERTY_CATEGORY_LABELS,
  PROPERTY_STATUS_LABELS,
} from "@/types/property";
import { COUNTY_LABELS } from "@/types/store";
import { ROUTES } from "@/lib/links";

// --- Mock Data ---
const FEATURED_PROPERTIES: PropertyCardData[] = [
  {
    id: "1",
    title: "Luxury 4-Bed Villa in Karen",
    price: 85000000,
    currency: "KES",
    location: "Karen, Nairobi",
    county: "NAIROBI",
    countyLabel: COUNTY_LABELS.NAIROBI,
    type: "SALE",
    typeLabel: PROPERTY_TYPE_LABELS.SALE,
    category: "RESIDENTIAL",
    categoryLabel: PROPERTY_CATEGORY_LABELS.RESIDENTIAL,
    status: "AVAILABLE",
    statusLabel: PROPERTY_STATUS_LABELS.AVAILABLE,
    beds: 4,
    baths: 5,
    area: 4500,
    lotSize: 10000,
    yearBuilt: 2020,
    parkingSpaces: 2,
    image:
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80",
    featured: true,
    verified: true,
    agent: {
      id: "agent-1",
      name: "Pam Golding",
      image: "https://i.pravatar.cc/150?u=pg",
      companyName: "Pam Golding Properties",
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "2",
    title: "Modern Apartment in Kilimani",
    price: 120000,
    currency: "KES",
    location: "Kilimani, Nairobi",
    type: "RENT",
    county: "NAIROBI",
    countyLabel: COUNTY_LABELS.NAIROBI,
    typeLabel: PROPERTY_TYPE_LABELS.RENT,
    category: "RESIDENTIAL",
    categoryLabel: PROPERTY_CATEGORY_LABELS.RESIDENTIAL,
    status: "AVAILABLE",
    statusLabel: PROPERTY_STATUS_LABELS.AVAILABLE,
    beds: 2,
    baths: 2,
    area: 1200,
    lotSize: 1200,
    yearBuilt: 2021,
    parkingSpaces: 1,
    image:
      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80",
    featured: false,
    verified: true,
    agent: {
      id: "agent-2",
      name: "Hass Consult",
      image: "https://i.pravatar.cc/150?u=hc",
      companyName: "Hass Consult",
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "3",
    title: "Prime Commercial Space",
    price: 250000,
    currency: "KES",
    location: "Westlands, Nairobi",
    county: "NAIROBI",
    countyLabel: COUNTY_LABELS.NAIROBI,
    type: "LEASE",
    typeLabel: PROPERTY_TYPE_LABELS.LEASE,
    category: "COMMERCIAL",
    categoryLabel: PROPERTY_CATEGORY_LABELS.COMMERCIAL,
    status: "UNDER_OFFER",
    statusLabel: PROPERTY_STATUS_LABELS.UNDER_OFFER,
    area: 2000,
    lotSize: 2000,
    yearBuilt: 2022,
    parkingSpaces: 1,
    image:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
    featured: true,
    verified: true,
    agent: {
      id: "agent-3",
      name: "Shammah Realtors",
      image: "https://i.pravatar.cc/150?u=hc",
      companyName: "Shammah Realtors",
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "4",
    title: "Half Acre Land",
    price: 15000000,
    currency: "KES",
    location: "Ruaka, Kiambu",
    county: "KIAMBU",
    countyLabel: COUNTY_LABELS.KIAMBU,
    type: "SALE",
    typeLabel: PROPERTY_TYPE_LABELS.SALE,
    category: "LAND",
    categoryLabel: PROPERTY_CATEGORY_LABELS.LAND,
    status: "AVAILABLE",
    statusLabel: PROPERTY_STATUS_LABELS.AVAILABLE,
    area: 21780, // sqft approx for 0.5 acre
    lotSize: 21780,
    yearBuilt: 2023,
    parkingSpaces: 4,
    image:
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80",
    featured: false,
    verified: true,
    agent: {
      id: "agent-1",
      name: "Hass Consult",
      image: "https://i.pravatar.cc/150?u=hc",
      companyName: "Hass Consult",
    },
    createdAt: new Date().toISOString(),
  },
];

export default function RealEstatePage() {
  const [, setActiveTab] = useState("buy");

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1">
        {/* --- Hero Section --- */}
        <section className="relative h-[600px] flex flex-col justify-center items-center text-center px-4">
          <div className="absolute inset-0 z-0">
            <Image
              src="/hero-realestate.jpg"
              alt="Modern Home"
              fill
              className="object-cover brightness-50"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/60" />
          </div>

          <div className="relative z-10 w-full max-w-4xl mx-auto space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-4">
                Find your perfect place.
              </h1>
              <p className="text-lg md:text-xl text-zinc-200 max-w-2xl mx-auto font-light">
                Discover homes for sale, apartments for rent, and prime land
                across Kenya.
              </p>
            </motion.div>

            {/* Search Box */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="bg-white p-2 rounded-2xl shadow-2xl max-w-3xl mx-auto"
            >
              <Tabs
                defaultValue="buy"
                onValueChange={setActiveTab}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-3 mb-2 bg-zinc-100/50 p-1">
                  <TabsTrigger value="buy">Buy</TabsTrigger>
                  <TabsTrigger value="rent">Rent</TabsTrigger>
                  <TabsTrigger value="commercial">Commercial</TabsTrigger>
                </TabsList>

                <div className="flex flex-col md:flex-row gap-2 p-2">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3 top-3 h-5 w-5 text-zinc-400" />
                    <Input
                      placeholder="City, Neighborhood, or Address"
                      className="pl-10 h-12 border-zinc-200 bg-zinc-50 focus:bg-white transition-colors"
                    />
                  </div>
                  <div className="w-full md:w-48">
                    <Select>
                      <SelectTrigger className="h-12 border-zinc-200 bg-zinc-50">
                        <SelectValue placeholder="Property Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="house">House</SelectItem>
                        <SelectItem value="apartment">Apartment</SelectItem>
                        <SelectItem value="land">Land</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="lg"
                    className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    Search
                  </Button>
                </div>
              </Tabs>
            </motion.div>
          </div>
        </section>

        {/* --- Browse Categories --- */}
        <section className="py-12 bg-white border-b border-zinc-100">
          <div className="container mx-auto px-4">
            <div className="flex justify-center gap-8 overflow-x-auto pb-4 no-scrollbar">
              <CategoryIcon icon={Home} label="Houses" />
              <CategoryIcon icon={Building2} label="Apartments" />
              <CategoryIcon icon={LandPlot} label="Land" />
              <CategoryIcon icon={Warehouse} label="Commercial" />
            </div>
          </div>
        </section>

        {/* --- Featured Listings --- */}
        <section className="py-20 container mx-auto px-4 md:px-8 max-w-7xl">
          <div className="flex justify-between items-end mb-10">
            <div>
              <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">
                Featured Listings
              </h2>
              <p className="text-zinc-500 mt-2">
                Curated properties selected for you.
              </p>
            </div>
            <Button
              variant="outline"
              className="hidden sm:flex border-zinc-200 text-zinc-600 hover:text-emerald-600 group"
            >
              View All Listings{" "}
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {FEATURED_PROPERTIES.map((property) => (
              <div key={property.id} className="h-full">
                <PropertyCard property={property} />
              </div>
            ))}
          </div>

          <div className="mt-12 text-center sm:hidden">
            <Button variant="outline" className="w-full">
              View All Listings
            </Button>
          </div>
        </section>

        {/* --- Agent CTA --- */}
        <section className="py-20 bg-zinc-900 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-emerald-900/20 to-transparent" />
          <div className="container mx-auto px-4 relative z-10 flex flex-col md:flex-row items-center justify-between gap-12 max-w-6xl">
            <div className="max-w-xl">
              <h2 className="text-3xl md:text-4xl font-bold mb-6 tracking-tight">
                Are you a Realtor or Developer?
              </h2>
              <p className="text-zinc-300 text-lg mb-8 leading-relaxed">
                List your properties on Build Market and connect with serious
                buyers and tenants. Get verified to boost your visibility.
              </p>
              <div className="flex gap-4">
                <Button
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  asChild
                >
                  <a href={ROUTES.joinAsPro}>List with Us</a>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-zinc-700 text-white hover:bg-white/10 hover:text-white hover:border-white"
                >
                  Learn More
                </Button>
              </div>
            </div>
            {/* Visual element */}
            <div className="relative w-full md:w-[400px] aspect-square bg-zinc-800 rounded-2xl border border-zinc-700 p-6 rotate-3 hover:rotate-0 transition-transform duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl" />
              <div className="h-full flex flex-col justify-center items-center text-center">
                <Home className="h-16 w-16 text-emerald-500 mb-4" />
                <h3 className="text-xl font-bold">Build Market Realty</h3>
                <p className="text-zinc-400 mt-2">
                  The trusted platform for Kenyan Real Estate.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function CategoryIcon({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 group cursor-pointer min-w-[80px]">
      <div className="h-14 w-14 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-500 group-hover:bg-emerald-50 group-hover:text-emerald-600 group-hover:border-emerald-200 transition-all duration-300">
        <Icon className="h-6 w-6" />
      </div>
      <span className="text-sm font-medium text-zinc-600 group-hover:text-zinc-900">
        {label}
      </span>
    </div>
  );
}
