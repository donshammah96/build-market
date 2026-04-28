"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Star,
  Award,
  Briefcase,
  Mail,
  ExternalLink,
  Calendar,
  CheckCircle,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageWithFallback } from "@/app/lib/media/ImageWithFallback";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ProfilePageHeader } from "../shared-header";
import {
  ProfileDetailsCard,
  ProfileHeroCard,
  ProfileStatsCard,
} from "../shared-panels";
import { ProfileErrorState, ProfileLoadingState } from "../shared-states";

import { usePublicProfile } from "@/hooks/useProfile";
import {
  formatProfileDate,
  formatProfileRating,
  getProfileDisplayName,
  getProfileInitials,
  getProfileLocation,
} from "../view-helpers";

export default function ProfessionalProfileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: professional, isLoading, error } = usePublicProfile(id);

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
    return <ProfileLoadingState variant="detail" />;
  }

  if (error || !professional) {
    return (
      <ProfileErrorState
        message={
          error instanceof Error
            ? error.message
            : "The professional profile you're looking for doesn't exist."
        }
        actionLabel="Go Back"
        onAction={() => router.back()}
        leading={
          <Button variant="ghost" asChild>
            <Link href="/professional-portal/profile">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Profile
            </Link>
          </Button>
        }
      />
    );
  }

  const fullName = getProfileDisplayName(professional);
  const initials = getProfileInitials(professional);
  const location = getProfileLocation(professional);
  const averageRating = formatProfileRating(professional.avgRating);
  const detailItems = [
    {
      label: "Company Name",
      value: (
        <p className="text-zinc-900 font-medium">{professional.companyName}</p>
      ),
    },
    ...(professional.licenseNumber
      ? [
          {
            label: "License Number",
            value: (
              <p className="text-zinc-900">{professional.licenseNumber}</p>
            ),
          },
        ]
      : []),
    ...(location
      ? [
          {
            label: "Location",
            icon: MapPin,
            value: <p className="text-zinc-900">{location}</p>,
          },
        ]
      : []),
    ...(professional.yearsExperience
      ? [
          {
            label: "Years of Experience",
            icon: Briefcase,
            value: (
              <p className="text-zinc-900">
                {professional.yearsExperience} years
              </p>
            ),
          },
        ]
      : []),
    {
      label: "Member Since",
      icon: Calendar,
      value: (
        <p className="text-zinc-900">
          {formatProfileDate(professional.createdAt)}
        </p>
      ),
    },
  ];
  const statItems = [
    {
      label: "Projects Completed",
      value: professional._count?.projects || 0,
    },
    {
      label: "Portfolio Items",
      value: professional._count?.portfolios || 0,
    },
    {
      label: "Reviews",
      value: professional._count?.reviews || 0,
    },
  ];
  const heroStats = [
    ...(professional.yearsExperience
      ? [
          {
            label: "Experience",
            icon: Briefcase,
            value: `${professional.yearsExperience}+ years`,
          },
        ]
      : []),
    {
      label: "Projects",
      icon: CheckCircle,
      value: `${professional._count?.projects || 0} completed`,
    },
    ...(averageRating
      ? [
          {
            label: "Rating",
            icon: Star,
            value: `${averageRating} / 5.0`,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6 max-w-400 mx-auto">
      <ProfilePageHeader
        leading={
          <Button variant="ghost" size="icon" asChild>
            <Link href="/professional-portal/profile">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        }
        title={
          <>
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
              {fullName}
            </h1>
            {professional.verified ? (
              <Badge className="bg-emerald-600 text-white">Verified</Badge>
            ) : null}
          </>
        }
        subtitle={`${professional.companyName} • Profile #${professional.id.substring(0, 8).toUpperCase()}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Header Card */}
          <ProfileHeroCard
            initials={initials}
            avatarUrl={mainImage?.url || professional.user.avatar || ""}
            companyName={professional.companyName}
            licenseNumber={professional.licenseNumber}
            highlight={
              averageRating ? (
                <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-lg">
                  <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                  <span className="text-lg font-bold">{averageRating}</span>
                  <span className="text-sm text-zinc-600">
                    ({professional._count?.reviews || 0} reviews)
                  </span>
                </div>
              ) : null
            }
            stats={heroStats}
          />

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
                  {location && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-zinc-400" />
                      <span className="text-zinc-600">{location}</span>
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
                              {formatProfileDate(portfolio.completedAt, {
                                year: "numeric",
                                month: "numeric",
                                day: "numeric",
                              })}
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
                                  {formatProfileDate(review.createdAt, {
                                    year: "numeric",
                                    month: "numeric",
                                    day: "numeric",
                                  })}
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
                                {formatProfileDate(cert.issueDate, {
                                  year: "numeric",
                                  month: "numeric",
                                  day: "numeric",
                                })}
                              </span>
                            )}
                            {cert.expiryDate && (
                              <span>
                                Expires:{" "}
                                {formatProfileDate(cert.expiryDate, {
                                  year: "numeric",
                                  month: "numeric",
                                  day: "numeric",
                                })}
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
          <ProfileDetailsCard
            title="Professional Details"
            titleIcon={Building2}
            items={detailItems}
          />

          {/* Stats */}
          <ProfileStatsCard items={statItems} />
        </div>
      </div>
    </div>
  );
}
