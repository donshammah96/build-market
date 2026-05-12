import Image from "next/image";
import Link from "next/link";
import { Home, Building2, Warehouse, ArrowRight, LandPlot } from "lucide-react";
import { Metadata } from "next";

import { Navbar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import PropertyCard from "@/components/real-estate/PropertyCard";
import { ROUTES } from "@/lib/links";
import { propertiesClient } from "@/lib/facades/properties-client";
import PropertySearchHero from "./_components/property-search-hero";

export const metadata: Metadata = {
  title: "Properties | Build Market",
  description:
    "Browse homes for sale, apartments for rent, and prime land across Kenya. Find your perfect place with Build Market.",
};

// Revalidate at most every 60s so the page stays reasonably fresh
export const revalidate = 60;

async function getFeaturedProperties() {
  try {
    const res = await propertiesClient.getProperties({
      featured: "true",
      limit: "4",
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    if (res.success && res.data) {
      return res.data.properties ?? [];
    }
  } catch {
    // Fallback gracefully — the page still renders without listings
  }
  return [];
}

export default async function PropertiesPage() {
  const properties = await getFeaturedProperties();

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1">
        {/* ── Hero Section ────────────────────────────────────── */}
        <section className="relative h-150 flex flex-col justify-center items-center text-center px-4">
          <div className="absolute inset-0 z-0">
            <Image
              src="/hero-realestate.jpg"
              alt="Modern home"
              fill
              className="object-cover brightness-50"
              priority
            />
            <div className="absolute inset-0 bg-linear-to-b from-black/30 to-black/60" />
          </div>

          <div className="relative z-10 w-full max-w-4xl mx-auto space-y-8">
            <div>
              <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-4">
                Find your perfect place.
              </h1>
              <p className="text-lg md:text-xl text-zinc-200 max-w-2xl mx-auto font-light">
                Discover homes for sale, apartments for rent, and prime land
                across Kenya.
              </p>
            </div>

            {/* Interactive filter — client component */}
            <PropertySearchHero />
          </div>
        </section>

        {/* ── Browse Categories ───────────────────────────────── */}
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

        {/* ── Featured Listings ───────────────────────────────── */}
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
              asChild
            >
              <Link href="/properties?featured=true">
                View All Listings{" "}
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>

          {properties.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {properties.map((property) => (
                <div key={property.id} className="h-full">
                  <PropertyCard property={property as never} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <Home className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
              <p className="text-zinc-500">
                No featured listings available right now. Check back soon!
              </p>
            </div>
          )}

          <div className="mt-12 text-center sm:hidden">
            <Button variant="outline" className="w-full" asChild>
              <Link href="/properties?featured=true">View All Listings</Link>
            </Button>
          </div>
        </section>

        {/* ── Agent CTA ───────────────────────────────────────── */}
        <section className="py-20 bg-zinc-900 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-linear-to-l from-emerald-900/20 to-transparent" />
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
            <div className="relative w-full md:w-100 aspect-square bg-zinc-800 rounded-2xl border border-zinc-700 p-6 rotate-3 hover:rotate-0 transition-transform duration-500">
              <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent rounded-2xl" />
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
    <div className="flex flex-col items-center gap-2 group cursor-pointer min-w-20">
      <div className="h-14 w-14 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-500 group-hover:bg-emerald-50 group-hover:text-emerald-600 group-hover:border-emerald-200 transition-all duration-300">
        <Icon className="h-6 w-6" />
      </div>
      <span className="text-sm font-medium text-zinc-600 group-hover:text-zinc-900">
        {label}
      </span>
    </div>
  );
}
