"use client";

import { useRouter } from "next/navigation";
import {
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
} from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageWithFallback } from "@/app/lib/media/ImageWithFallback";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ProfilePageHeader } from "./shared-header";
import { ProfileDetailsCard, ProfileHeroCard } from "./shared-panels";
import { ProfileErrorState, ProfileLoadingState } from "./shared-states";

import { useOwnProfile } from "@/hooks/useProfile";
import {
  formatProfileDate,
  getProfileDisplayName,
  getProfileInitials,
  getProfileLocation,
} from "./view-helpers";

export default function ProfilePage() {
  const router = useRouter();

  const { data: profile, isLoading, error } = useOwnProfile();

  if (isLoading) {
    return <ProfileLoadingState />;
  }

  if (error || !profile) {
    return (
      <ProfileErrorState
        message={
          error instanceof Error
            ? error.message
            : "Unable to load your profile. Please try again."
        }
        actionLabel="Retry"
        onAction={() => router.refresh()}
      />
    );
  }

  const fullName = getProfileDisplayName(profile);
  const initials = getProfileInitials(profile);
  const location = getProfileLocation(profile);
  const detailItems = [
    {
      label: "Company Name",
      value: <p className="text-zinc-900 font-medium">{profile.companyName}</p>,
    },
    ...(profile.licenseNumber
      ? [
          {
            label: "License Number",
            value: <p className="text-zinc-900">{profile.licenseNumber}</p>,
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
    ...(profile.yearsExperience
      ? [
          {
            label: "Years of Experience",
            icon: Briefcase,
            value: (
              <p className="text-zinc-900">{profile.yearsExperience} years</p>
            ),
          },
        ]
      : []),
    {
      label: "Member Since",
      icon: Calendar,
      value: (
        <p className="text-zinc-900">{formatProfileDate(profile.createdAt)}</p>
      ),
    },
  ];
  const heroStats = [
    ...(profile.yearsExperience
      ? [
          {
            label: "Experience",
            icon: Briefcase,
            value: `${profile.yearsExperience}+ years`,
          },
        ]
      : []),
    ...(location
      ? [
          {
            label: "Location",
            icon: MapPin,
            value: location,
          },
        ]
      : []),
    ...(profile.website
      ? [
          {
            label: "Website",
            icon: Globe,
            value: (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:underline flex items-center gap-1"
              >
                Visit <ExternalLink className="h-3 w-3" />
              </a>
            ),
          },
        ]
      : []),
  ];
  const mainImage =
    profile.images?.find((img) => img.isMain) || profile.images?.[0];

  return (
    <div className="space-y-6 max-w-400 mx-auto">
      <ProfilePageHeader
        title={
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
            My Profile
          </h1>
        }
        subtitle="View your public profile as clients see it"
        trailing={
          <Button asChild variant="outline">
            <Link href="/professional-portal/settings">
              <Edit className="mr-2 h-4 w-4" />
              Edit Profile
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Header Card */}
          <ProfileHeroCard
            fullName={fullName}
            initials={initials}
            avatarUrl={mainImage?.url || profile.user.avatar || ""}
            verified={profile.verified}
            companyName={profile.companyName}
            licenseNumber={profile.licenseNumber}
            stats={heroStats}
          />

          {/* Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-zinc-100 p-1">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="services">Services</TabsTrigger>
              <TabsTrigger value="images">Images</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-6">
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
              <ProfileDetailsCard
                title="Profile Details"
                titleIcon={Building2}
                items={detailItems}
              />
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
