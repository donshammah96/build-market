"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Edit,
  Building2,
  MapPin,
  Globe,
  Briefcase,
  Award,
  Calendar,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  AlertCircle,
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
  user: {
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string | null;
  };
  services?: ServiceCategory[];
  images?: ProfileImage[];
}

export default function ProfilePage() {
  const router = useRouter();

  const {
    data: profile,
    isLoading,
    error,
  } = useQuery<ProfessionalProfile>({
    queryKey: ["professional-profile"],
    queryFn: async () => {
      const res = await fetch("/api/professional-portal/profile");
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Profile not found");
        }
        throw new Error("Failed to fetch profile");
      }
      return res.json();
    },
    retry: 2,
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <Card className="p-8">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">
              Profile Not Found
            </h2>
            <p className="text-zinc-500 mb-4">
              {error instanceof Error
                ? error.message
                : "Unable to load your profile. Please try again."}
            </p>
            <Button onClick={() => router.refresh()}>Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  const fullName = `${profile.user.firstName} ${profile.user.lastName}`;
  const mainImage =
    profile.images?.find((img) => img.isMain) || profile.images?.[0];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start border-b border-zinc-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
            My Profile
          </h1>
          <p className="text-zinc-500 mt-1">
            View your public profile as clients see it
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/professional-portal/settings">
            <Edit className="mr-2 h-4 w-4" />
            Edit Profile
          </Link>
        </Button>
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
                      src={mainImage?.url || profile.user.avatar || ""}
                      alt={fullName}
                    />
                    <AvatarFallback className="rounded-lg text-3xl bg-zinc-100">
                      {profile.user.firstName?.[0]}
                      {profile.user.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                </div>

                {/* Profile Info */}
                <div className="flex-1">
                  <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl font-bold text-zinc-900">
                          {fullName}
                        </h2>
                        {profile.verified && (
                          <Badge className="bg-emerald-600 text-white">
                            <Award className="mr-1 h-3 w-3" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      <p className="text-xl text-zinc-600 font-medium mb-2">
                        {profile.companyName}
                      </p>
                      {profile.licenseNumber && (
                        <p className="text-sm text-zinc-500">
                          License: {profile.licenseNumber}
                        </p>
                      )}
                    </div>
                  </div>

                  <Separator className="my-4" />

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {profile.yearsExperience && (
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-5 w-5 text-zinc-400" />
                        <div>
                          <p className="text-sm text-zinc-600">Experience</p>
                          <p className="font-semibold">
                            {profile.yearsExperience}+ years
                          </p>
                        </div>
                      </div>
                    )}
                    {(profile.city || profile.county) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-zinc-400" />
                        <div>
                          <p className="text-sm text-zinc-600">Location</p>
                          <p className="font-semibold">
                            {[profile.city, profile.county]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        </div>
                      </div>
                    )}
                    {profile.website && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-zinc-400" />
                        <div>
                          <p className="text-sm text-zinc-600">Website</p>
                          <a
                            href={profile.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-emerald-600 hover:underline flex items-center gap-1"
                          >
                            Visit <ExternalLink className="h-3 w-3" />
                          </a>
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
              <TabsTrigger value="services">Services</TabsTrigger>
              <TabsTrigger value="images">Images</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              {/* Bio */}
              {profile.bio && (
                <Card className="border border-zinc-200 shadow-sm bg-white">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      About
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-zinc-900 whitespace-pre-wrap">
                      {profile.bio}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Portfolio URL */}
              {profile.portfolioUrl && (
                <Card className="border border-zinc-200 shadow-sm bg-white">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ExternalLink className="h-5 w-5" />
                      External Portfolio
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <a
                      href={profile.portfolioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 hover:underline flex items-center gap-2"
                    >
                      {profile.portfolioUrl}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </CardContent>
                </Card>
              )}

              {/* Profile Details */}
              <Card className="border border-zinc-200 shadow-sm bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Profile Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-zinc-500 mb-1 block">
                      Company Name
                    </label>
                    <p className="text-zinc-900 font-medium">
                      {profile.companyName}
                    </p>
                  </div>
                  {profile.licenseNumber && (
                    <>
                      <Separator />
                      <div>
                        <label className="text-sm font-medium text-zinc-500 mb-1 block">
                          License Number
                        </label>
                        <p className="text-zinc-900">{profile.licenseNumber}</p>
                      </div>
                    </>
                  )}
                  {(profile.city || profile.county) && (
                    <>
                      <Separator />
                      <div>
                        <label className="text-sm font-medium text-zinc-500 mb-1 block flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Location
                        </label>
                        <p className="text-zinc-900">
                          {[profile.city, profile.county]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      </div>
                    </>
                  )}
                  {profile.yearsExperience && (
                    <>
                      <Separator />
                      <div>
                        <label className="text-sm font-medium text-zinc-500 mb-1 block flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          Years of Experience
                        </label>
                        <p className="text-zinc-900">
                          {profile.yearsExperience} years
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
                      {new Date(profile.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Services Tab */}
            <TabsContent value="services" className="space-y-6 mt-6">
              <Card className="border border-zinc-200 shadow-sm bg-white">
                <CardHeader>
                  <CardTitle>Services Offered</CardTitle>
                </CardHeader>
                <CardContent>
                  {profile.services && profile.services.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {profile.services.map((service) => (
                        <Badge
                          key={service.id}
                          variant="outline"
                          className="bg-zinc-50 text-zinc-700 border-zinc-200"
                        >
                          {service.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-center py-8">
                      No services added yet.{" "}
                      <Link
                        href="/professional-portal/settings"
                        className="text-emerald-600 hover:underline"
                      >
                        Add services
                      </Link>
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Images Tab */}
            <TabsContent value="images" className="space-y-6 mt-6">
              <Card className="border border-zinc-200 shadow-sm bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Profile Images
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {profile.images && profile.images.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {profile.images.map((image) => (
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
                  ) : (
                    <p className="text-zinc-500 text-center py-8">
                      No images uploaded yet.{" "}
                      <Link
                        href="/professional-portal/settings"
                        className="text-emerald-600 hover:underline"
                      >
                        Upload images
                      </Link>
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card className="border border-zinc-200 shadow-sm bg-white">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                asChild
                variant="outline"
                className="w-full justify-start"
              >
                <Link href="/professional-portal/settings">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Profile
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full justify-start"
              >
                <Link href="/professional-portal/portfolio">
                  <FileText className="mr-2 h-4 w-4" />
                  Manage Portfolio
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Verification Status */}
          <Card className="border border-zinc-200 shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Verification Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profile.verified ? (
                <div className="flex items-center gap-2 text-emerald-600">
                  <Award className="h-5 w-5" />
                  <span className="font-medium">Verified Professional</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-zinc-600">
                    Your profile is pending verification.
                  </p>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Link href="/professional-portal/settings">
                      Complete Verification
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
