"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Star,
  Award,
  Briefcase,
  Mail,
  ExternalLink,
  Calendar,
  CheckCircle,
  Loader2,
  AlertCircle,
  MapPin,
  Globe,
  FileText,
  Image as ImageIcon,
  Building2,
} from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageWithFallback } from "@/app/lib/ImageWithFallback";
import { AspectRatio } from "@/components/ui/aspect-ratio";

interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
}

interface ProfileImage {
  id: string;
  url: string;
  caption?: string | null;
  isMain: boolean;
}

interface PortfolioImage {
  id: string;
  url: string;
  caption?: string | null;
  isMain: boolean;
  isBefore: boolean;
  isAfter: boolean;
}

interface Portfolio {
  id: string;
  title: string;
  description?: string | null;
  projectType: string;
  completedAt?: Date | string | null;
  images?: PortfolioImage[];
}

interface Review {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: Date | string;
  reviewer: {
    firstName: string;
    lastName: string;
    avatar?: string | null;
  };
}

interface Certificate {
  id: string;
  name: string;
  issuer: string;
  issueDate?: Date | string | null;
  expiryDate?: Date | string | null;
}

interface ProfessionalProfile {
  id: string;
  userId: string;
  companyName: string;
  licenseNumber: string;
  bio?: string | null;
  city?: string | null;
  county?: string | null;
  website?: string | null;
  portfolioUrl?: string | null;
  yearsExperience?: number | null;
  verified: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  avgRating?: number | null;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string | null;
  };
  services?: ServiceCategory[];
  images?: ProfileImage[];
  portfolios?: Portfolio[];
  reviews?: Review[];
  certificates?: Certificate[];
  _count?: {
    reviews: number;
    projects: number;
    portfolios: number;
  };
}

export default function ProfessionalProfileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const {
    data: professional,
    isLoading,
    error,
  } = useQuery<ProfessionalProfile>({
    queryKey: ["professional-profile", id],
    queryFn: async () => {
      const res = await fetch(`/api/professional-portal/profile/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Professional not found");
        }
        throw new Error("Failed to fetch professional profile");
      }
      return res.json();
    },
    enabled: !!id,
    retry: 2,
    staleTime: 30000,
  });

  const images = useMemo(() => {
    if (!professional?.images) return [];
    return [...professional.images].sort((a, b) => {
      if (a.isMain && !b.isMain) return -1;
      if (!a.isMain && b.isMain) return 1;
      return 0;
    });
  }, [professional?.images]);

  const mainImage = images.find((img) => img.isMain) || images[0];

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-zinc-200 animate-pulse rounded" />
          <div className="space-y-2">
            <div className="h-8 w-64 bg-zinc-200 animate-pulse rounded" />
            <div className="h-4 w-32 bg-zinc-200 animate-pulse rounded" />
          </div>
        </div>
        <Card className="p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            <span className="ml-3 text-zinc-500">Loading profile...</span>
          </div>
        </Card>
      </div>
    );
  }

  if (error || !professional) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <Button variant="ghost" asChild>
          <Link href="/professional-portal/profile">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Profile
          </Link>
        </Button>
        <Card className="p-8">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">
              Profile Not Found
            </h2>
            <p className="text-zinc-500 mb-4">
              {error instanceof Error
                ? error.message
                : "The professional profile you're looking for doesn't exist."}
            </p>
            <Button asChild>
              <Link href="/professional-portal/profile">Back to Profile</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const fullName = `${professional.user.firstName} ${professional.user.lastName}`;
  const averageRating = professional.avgRating
    ? professional.avgRating.toFixed(1)
    : null;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start border-b border-zinc-100 pb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/professional-portal/profile">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
                {fullName}
              </h1>
              {professional.verified && (
                <Badge className="bg-emerald-600 text-white">
                  <Award className="mr-1 h-3 w-3" />
                  Verified
                </Badge>
              )}
            </div>
            <p className="text-zinc-500 mt-1">
              {professional.companyName} • Profile #
              {professional.id.substring(0, 8).toUpperCase()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Header Card */}
          <Card className="border border-zinc-200 shadow-sm bg-white">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Profile Image */}
                <div className="flex-shrink-0">
                  <Avatar className="h-32 w-32 rounded-lg border-2 border-zinc-100">
                    <AvatarImage
                      src={mainImage?.url || professional.user.avatar || ""}
                      alt={fullName}
                    />
                    <AvatarFallback className="rounded-lg text-3xl bg-zinc-100">
                      {professional.user.firstName?.[0]}
                      {professional.user.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                </div>

                {/* Profile Info */}
                <div className="flex-1">
                  <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
                    <div>
                      <p className="text-xl text-zinc-600 font-medium mb-2">
                        {professional.companyName}
                      </p>
                      {professional.licenseNumber && (
                        <p className="text-sm text-zinc-500">
                          License: {professional.licenseNumber}
                        </p>
                      )}
                    </div>

                    {averageRating && (
                      <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-lg">
                        <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                        <span className="text-lg font-bold">
                          {averageRating}
                        </span>
                        <span className="text-sm text-zinc-600">
                          ({professional._count?.reviews || 0} reviews)
                        </span>
                      </div>
                    )}
                  </div>

                  <Separator className="my-4" />

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {professional.yearsExperience && (
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-5 w-5 text-zinc-400" />
                        <div>
                          <p className="text-sm text-zinc-600">Experience</p>
                          <p className="font-semibold">
                            {professional.yearsExperience}+ years
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-zinc-400" />
                      <div>
                        <p className="text-sm text-zinc-600">Projects</p>
                        <p className="font-semibold">
                          {professional._count?.projects || 0} completed
                        </p>
                      </div>
                    </div>
                    {averageRating && (
                      <div className="flex items-center gap-2">
                        <Star className="h-5 w-5 text-zinc-400" />
                        <div>
                          <p className="text-sm text-zinc-600">Rating</p>
                          <p className="font-semibold">{averageRating} / 5.0</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-zinc-100 p-1">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
              <TabsTrigger value="certificates">Certificates</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              {/* Bio */}
              {professional.bio && (
                <Card className="border border-zinc-200 shadow-sm bg-white">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      About
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-zinc-900 whitespace-pre-wrap">
                      {professional.bio}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Services */}
              {professional.services && professional.services.length > 0 && (
                <Card className="border border-zinc-200 shadow-sm bg-white">
                  <CardHeader>
                    <CardTitle>Services Offered</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {professional.services.map((service) => (
                        <Badge
                          key={service.id}
                          variant="outline"
                          className="bg-zinc-50 text-zinc-700 border-zinc-200"
                        >
                          {service.name}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Contact Information */}
              <Card className="border border-zinc-200 shadow-sm bg-white">
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {professional.user.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-zinc-400" />
                      <span className="text-zinc-600">
                        {professional.user.email}
                      </span>
                    </div>
                  )}
                  {(professional.city || professional.county) && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-zinc-400" />
                      <span className="text-zinc-600">
                        {[professional.city, professional.county]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                  {professional.website && (
                    <div className="flex items-center gap-3">
                      <Globe className="h-5 w-5 text-zinc-400" />
                      <a
                        href={professional.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-600 hover:underline flex items-center gap-1"
                      >
                        {professional.website}
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  )}
                  {professional.portfolioUrl && (
                    <div className="flex items-center gap-3">
                      <ExternalLink className="h-5 w-5 text-zinc-400" />
                      <a
                        href={professional.portfolioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-600 hover:underline flex items-center gap-1"
                      >
                        External Portfolio
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Profile Images */}
              {images.length > 0 && (
                <Card className="border border-zinc-200 shadow-sm bg-white">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ImageIcon className="h-5 w-5" />
                      Profile Images ({images.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {images.map((image) => (
                        <div key={image.id} className="relative group">
                          <AspectRatio
                            ratio={1}
                            className="bg-zinc-100 rounded-lg overflow-hidden"
                          >
                            <ImageWithFallback
                              src={image.url}
                              alt={image.caption || "Profile image"}
                              className="object-cover w-full h-full"
                            />
                          </AspectRatio>
                          {image.isMain && (
                            <Badge className="absolute top-2 left-2 text-xs">
                              Main
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Portfolio Tab */}
            <TabsContent value="portfolio" className="space-y-6 mt-6">
              {professional.portfolios && professional.portfolios.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-6">
                  {professional.portfolios.map((portfolio) => {
                    const portfolioMainImage =
                      portfolio.images?.find((img) => img.isMain) ||
                      portfolio.images?.[0];
                    return (
                      <Card
                        key={portfolio.id}
                        className="overflow-hidden border border-zinc-200 shadow-sm bg-white hover:shadow-md transition-shadow"
                      >
                        {portfolioMainImage && (
                          <div className="aspect-video overflow-hidden bg-zinc-200">
                            <ImageWithFallback
                              src={portfolioMainImage.url}
                              alt={portfolio.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <CardHeader>
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-xl">
                              {portfolio.title}
                            </CardTitle>
                            <Badge variant="outline">
                              {portfolio.projectType}
                            </Badge>
                          </div>
                          {portfolio.description && (
                            <p className="text-zinc-600 text-sm mt-2">
                              {portfolio.description}
                            </p>
                          )}
                        </CardHeader>
                        {portfolio.completedAt && (
                          <CardContent>
                            <div className="flex items-center gap-2 text-sm text-zinc-500">
                              <Calendar className="h-4 w-4" />
                              Completed{" "}
                              {new Date(
                                portfolio.completedAt
                              ).toLocaleDateString()}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="border border-zinc-200 shadow-sm bg-white">
                  <CardContent className="p-8 text-center">
                    <p className="text-zinc-500">
                      No portfolio items available yet.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Reviews Tab */}
            <TabsContent value="reviews" className="space-y-6 mt-6">
              {professional.reviews && professional.reviews.length > 0 ? (
                <Card className="border border-zinc-200 shadow-sm bg-white">
                  <CardHeader>
                    <CardTitle>
                      Client Reviews ({professional.reviews.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {professional.reviews.map((review, index) => (
                      <div key={review.id}>
                        <div className="flex gap-4">
                          <Avatar>
                            <AvatarFallback>
                              {review.reviewer.firstName?.[0]}
                              {review.reviewer.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="font-semibold">
                                  {review.reviewer.firstName}{" "}
                                  {review.reviewer.lastName}
                                </p>
                                <p className="text-sm text-zinc-500">
                                  {new Date(
                                    review.createdAt
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-4 w-4 ${
                                      i < review.rating
                                        ? "fill-amber-400 text-amber-400"
                                        : "text-zinc-300"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            {review.comment && (
                              <p className="text-zinc-600">{review.comment}</p>
                            )}
                          </div>
                        </div>
                        {index < professional.reviews!.length - 1 && (
                          <Separator className="mt-6" />
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <Card className="border border-zinc-200 shadow-sm bg-white">
                  <CardContent className="p-8 text-center">
                    <p className="text-zinc-500">No reviews yet.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Certificates Tab */}
            <TabsContent value="certificates" className="space-y-6 mt-6">
              {professional.certificates &&
              professional.certificates.length > 0 ? (
                <Card className="border border-zinc-200 shadow-sm bg-white">
                  <CardHeader>
                    <CardTitle>
                      Certifications ({professional.certificates.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {professional.certificates.map((cert) => (
                      <div
                        key={cert.id}
                        className="flex items-start gap-4 p-4 border border-zinc-200 rounded-lg"
                      >
                        <Award className="h-5 w-5 text-emerald-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold text-zinc-900">
                            {cert.name}
                          </p>
                          <p className="text-sm text-zinc-600">{cert.issuer}</p>
                          <div className="flex gap-4 mt-2 text-xs text-zinc-500">
                            {cert.issueDate && (
                              <span>
                                Issued:{" "}
                                {new Date(cert.issueDate).toLocaleDateString()}
                              </span>
                            )}
                            {cert.expiryDate && (
                              <span>
                                Expires:{" "}
                                {new Date(cert.expiryDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <Card className="border border-zinc-200 shadow-sm bg-white">
                  <CardContent className="p-8 text-center">
                    <p className="text-zinc-500">No certificates available.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Professional Info */}
          <Card className="border border-zinc-200 shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Professional Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-zinc-500 mb-1 block">
                  Company Name
                </label>
                <p className="text-zinc-900 font-medium">
                  {professional.companyName}
                </p>
              </div>
              {professional.licenseNumber && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-zinc-500 mb-1 block">
                      License Number
                    </label>
                    <p className="text-zinc-900">
                      {professional.licenseNumber}
                    </p>
                  </div>
                </>
              )}
              {(professional.city || professional.county) && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-zinc-500 mb-1 block flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Location
                    </label>
                    <p className="text-zinc-900">
                      {[professional.city, professional.county]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                </>
              )}
              {professional.yearsExperience && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-zinc-500 mb-1 block flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      Years of Experience
                    </label>
                    <p className="text-zinc-900">
                      {professional.yearsExperience} years
                    </p>
                  </div>
                </>
              )}
              <Separator />
              <div>
                <label className="text-sm font-medium text-zinc-500 mb-1 block flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Member Since
                </label>
                <p className="text-zinc-900">
                  {new Date(professional.createdAt).toLocaleDateString(
                    "en-US",
                    {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <Card className="border border-zinc-200 shadow-sm bg-white">
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600">
                  Projects Completed
                </span>
                <span className="font-semibold text-zinc-900">
                  {professional._count?.projects || 0}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600">Portfolio Items</span>
                <span className="font-semibold text-zinc-900">
                  {professional._count?.portfolios || 0}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600">Reviews</span>
                <span className="font-semibold text-zinc-900">
                  {professional._count?.reviews || 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
