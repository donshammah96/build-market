import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import {
  ArrowLeft,
  Bed,
  Bath,
  Maximize,
  Car,
  Calendar,
  MapPin,
  Shield,
  Check,
  User,
  Phone,
  Mail,
  MessageSquare,
  Play,
} from "lucide-react";

import { Navbar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PropertyCard from "@/components/real-estate/PropertyCard";
import { propertiesClient } from "@/lib/properties-client";
import PropertyGallery from "./_components/property-gallery";

export const revalidate = 60;

type PropertyDetailParams = {
  params: Promise<{ id: string }>;
};

function formatPrice(
  price: number | { toNumber?: () => number },
  currency = "KES",
) {
  const num =
    typeof price === "number"
      ? price
      : ((price as { toNumber: () => number }).toNumber?.() ?? Number(price));
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

async function getPropertyData(id: string) {
  const res = await propertiesClient.getProperty(id);
  if (!res.success || !res.data) return null;
  return res.data;
}

export async function generateMetadata({
  params,
}: PropertyDetailParams): Promise<Metadata> {
  const { id } = await params;
  const data = await getPropertyData(id);
  if (!data) {
    return { title: "Property Not Found | Build Market" };
  }
  const p = data.property;
  return {
    title: `${p.title} | Build Market`,
    description:
      p.description?.slice(0, 160) ??
      `${p.title} — ${p.location} — ${formatPrice(p.price, p.currency)}`,
  };
}

export default async function PropertyDetailPage({
  params,
}: PropertyDetailParams) {
  const { id } = await params;
  const data = await getPropertyData(id);

  if (!data) {
    return notFound();
  }

  const property = data.property;
  const similarProperties = data.similarProperties ?? [];

  const agentName = property.agent?.user
    ? `${property.agent.user.firstName ?? ""} ${property.agent.user.lastName ?? ""}`.trim() ||
      property.agent.companyName ||
      "Agent"
    : (property.agent?.companyName ?? "Agent");

  const stats = [
    property.bedrooms != null && {
      icon: Bed,
      value: property.bedrooms,
      label: "Bedrooms",
    },
    property.bathrooms != null && {
      icon: Bath,
      value: property.bathrooms,
      label: "Bathrooms",
    },
    property.buildingSize != null && {
      icon: Maximize,
      value: `${property.buildingSize.toLocaleString()} ${property.areaUnit?.toLowerCase()?.replace("_", " ") ?? "sq m"}`,
      label: "Area",
    },
    property.parkingSpaces != null && {
      icon: Car,
      value: property.parkingSpaces,
      label: "Parking",
    },
  ].filter(Boolean) as Array<{
    icon: React.ElementType;
    value: string | number;
    label: string;
  }>;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Navbar />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        {/* Back navigation */}
        <Link
          href="/properties"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Properties
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column — Gallery + Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Gallery — interactive, hence a client component */}
            <PropertyGallery
              images={(property.images ?? []).map((img) => ({
                url: img.url,
                caption: img.caption,
                asset: img.asset,
              }))}
              title={property.title}
            />

            {/* Property Info Card */}
            <Card className="border-zinc-200">
              <CardContent className="p-6 space-y-6">
                {/* Title & Price */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-700 border-emerald-200"
                      >
                        For {property.type}
                      </Badge>
                      <Badge variant="outline" className="text-zinc-600">
                        {property.category}
                      </Badge>
                      {property.verified && (
                        <Badge
                          variant="outline"
                          className="bg-blue-50 text-blue-600 border-blue-200"
                        >
                          <Shield className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <h1 className="text-2xl font-bold text-zinc-900">
                      {property.title}
                    </h1>
                    <div className="flex items-center gap-1 text-zinc-500 mt-1">
                      <MapPin className="h-4 w-4" />
                      <span className="text-sm">
                        {property.location}
                        {property.county && `, ${property.county}`}
                      </span>
                    </div>
                  </div>
                  <div className="text-right hidden lg:block">
                    <p className="text-3xl font-bold text-emerald-600">
                      {formatPrice(property.price, property.currency)}
                    </p>
                    {property.type === "RENT" && (
                      <span className="text-sm text-zinc-500">/month</span>
                    )}
                  </div>
                </div>

                {/* Key Stats */}
                {stats.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-y border-zinc-100">
                    {stats.map(({ icon: Icon, value, label }) => (
                      <div key={label} className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center">
                          <Icon className="h-5 w-5 text-zinc-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-900">{value}</p>
                          <p className="text-xs text-zinc-500">{label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Description */}
                {property.description && (
                  <div className="py-6 border-b border-zinc-100">
                    <h2 className="text-lg font-bold text-zinc-900 mb-3">
                      Description
                    </h2>
                    <p className="text-zinc-600 leading-relaxed whitespace-pre-line">
                      {property.description}
                    </p>
                  </div>
                )}

                {/* Features */}
                {property.features.length > 0 && (
                  <div className="py-6">
                    <h2 className="text-lg font-bold text-zinc-900 mb-4">
                      Features & Amenities
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {property.features.map((feature, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-zinc-700"
                        >
                          <Check className="h-4 w-4 text-emerald-600" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column — Agent & Actions */}
          <div className="space-y-6">
            {/* Price card (mobile) */}
            <Card className="lg:hidden border-emerald-200 bg-emerald-50">
              <CardContent className="p-6 text-center">
                <p className="text-3xl font-bold text-emerald-700">
                  {formatPrice(property.price, property.currency)}
                </p>
                {property.type === "RENT" && (
                  <span className="text-sm text-emerald-600">/month</span>
                )}
              </CardContent>
            </Card>

            {/* Agent Card */}
            <Card className="border-zinc-200 sticky top-24">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-zinc-900 mb-4">
                  Contact Agent
                </h3>

                {/* Agent info */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative h-16 w-16 rounded-full bg-zinc-200 overflow-hidden">
                    {property.agent?.user?.avatar ? (
                      <Image
                        src={property.agent.user.avatar}
                        alt={agentName}
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
                      <p className="font-bold text-zinc-900">{agentName}</p>
                      {property.agent?.verified && (
                        <Shield className="h-4 w-4 text-emerald-600" />
                      )}
                    </div>
                    <p className="text-sm text-zinc-600">
                      {property.agent?.companyName}
                    </p>
                    {(property.agent?.city || property.agent?.county) && (
                      <p className="text-xs text-zinc-500">
                        {[property.agent.city, property.agent.county]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Contact buttons */}
                <div className="space-y-3">
                  {property.agent?.user?.phone && (
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      asChild
                    >
                      <a href={`tel:${property.agent.user.phone}`}>
                        <Phone className="mr-2 h-4 w-4" />
                        Call Agent
                      </a>
                    </Button>
                  )}
                  {property.agent?.user?.email && (
                    <Button
                      variant="outline"
                      className="w-full border-zinc-200"
                      asChild
                    >
                      <a
                        href={`mailto:${property.agent.user.email}?subject=Inquiry about ${property.title}`}
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        Send Email
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full border-zinc-200"
                    asChild
                  >
                    <Link href={`/messages?to=${property.agent?.userId}`}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Send Message
                    </Link>
                  </Button>
                </div>

                {/* Posted date */}
                <div className="mt-6 pt-4 border-t border-zinc-100">
                  <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Posted {new Date(property.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Video tour */}
            {property.videoUrl && (
              <Card className="border-zinc-200">
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold text-zinc-900 mb-4">
                    Video Tour
                  </h3>
                  <Button variant="outline" className="w-full" asChild>
                    <a
                      href={property.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Watch Video Tour
                    </a>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Similar Properties */}
        {similarProperties.length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl font-bold text-zinc-900 mb-6">
              Similar Properties
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {similarProperties.map((prop) => (
                <PropertyCard key={prop.id} property={prop as never} />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
