import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  getPropertyDetails,
  verifyProperty,
  togglePropertyFeatured,
} from "@/actions/admin";
import { getAdminPermissions } from "@/actions/admin/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  CheckCircle,
  Star,
  MapPin,
  Bed,
  Bath,
  Square,
  Car,
  Calendar,
  User,
  FileText,
  Image as ImageIcon,
  ExternalLink,
} from "lucide-react";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import { ChangePropertyStatus } from "@/components/admin/properties/ChangePropertyStatus";

export const dynamic = "force-dynamic";

interface PropertyDetailPageProps {
  params: Promise<{ id: string }>;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  PENDING: "bg-amber-100 text-amber-700",
  SOLD: "bg-blue-100 text-blue-700",
  RENTED: "bg-purple-100 text-purple-700",
  WITHDRAWN: "bg-red-100 text-red-700",
};

export default async function PropertyDetailPage({
  params,
}: PropertyDetailPageProps) {
  const { id } = await params;
  const response = await getPropertyDetails(id);
  const { granularRole } = await getAdminPermissions();

  if (!response.success || !response.data) {
    notFound();
  }

  const property = response.data;

  // Role checks
  const canModifyStatus = ["SUPER_ADMIN", "CONTENT_MODERATOR"].includes(
    granularRole || "",
  );
  const canVerify = ["SUPER_ADMIN", "VERIFICATION_SPECIALIST"].includes(
    granularRole || "",
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: "Properties", href: "/properties" },
          { label: property.title },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/properties">
            <Button variant="outline" size="icon" className="h-10 w-10">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">
                {property.title}
              </h1>
              <Badge className={statusColors[property.status]}>
                {property.status}
              </Badge>
              {property.verified && (
                <Badge className="bg-emerald-100 text-emerald-700">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Verified
                </Badge>
              )}
              {property.featured && (
                <Badge className="bg-purple-100 text-purple-700">
                  <Star className="mr-1 h-3 w-3" />
                  Featured
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1 flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {property.location}, {property.county}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canModifyStatus && (
            <ChangePropertyStatus
              propertyId={id}
              currentStatus={property.status}
            />
          )}
          {canVerify && !property.verified && (
            <form
              action={async () => {
                "use server";
                await verifyProperty(id);
              }}
            >
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle className="mr-2 h-4 w-4" />
                Verify Property
              </Button>
            </form>
          )}
          {canModifyStatus && (
            <form
              action={async () => {
                "use server";
                await togglePropertyFeatured(id);
              }}
            >
              <Button variant="outline">
                <Star className="mr-2 h-4 w-4" />
                {property.featured ? "Unfeature" : "Feature"}
              </Button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Images Gallery */}
          {property.images && property.images.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Property Images ({property._count.images})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {property.images.map(
                    (image: {
                      id: string;
                      url: string;
                      caption: string | null;
                      isMain: boolean;
                    }) => (
                      <div
                        key={image.id}
                        className="relative aspect-video rounded-lg overflow-hidden bg-zinc-100"
                      >
                        <Image
                          src={image.url}
                          alt={image.caption || "Property image"}
                          fill
                          className="object-cover w-full h-full"
                        />
                        {image.isMain && (
                          <Badge className="absolute top-2 left-2 text-xs">
                            Main
                          </Badge>
                        )}
                      </div>
                    ),
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Property Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {property.description && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Description
                  </h4>
                  <p className="text-sm whitespace-pre-wrap">
                    {property.description}
                  </p>
                </div>
              )}
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Type
                  </h4>
                  <Badge variant="secondary">{property.type}</Badge>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Category
                  </h4>
                  <Badge variant="outline" className="capitalize">
                    {property.category.toLowerCase()}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <Card>
            <CardHeader>
              <CardTitle>Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {property.bedrooms !== null && (
                  <div className="flex items-center gap-2 p-3 bg-zinc-50 rounded-lg">
                    <Bed className="h-5 w-5 text-zinc-500" />
                    <div>
                      <p className="text-sm font-medium">{property.bedrooms}</p>
                      <p className="text-xs text-muted-foreground">Bedrooms</p>
                    </div>
                  </div>
                )}
                {property.bathrooms !== null && (
                  <div className="flex items-center gap-2 p-3 bg-zinc-50 rounded-lg">
                    <Bath className="h-5 w-5 text-zinc-500" />
                    <div>
                      <p className="text-sm font-medium">
                        {property.bathrooms}
                      </p>
                      <p className="text-xs text-muted-foreground">Bathrooms</p>
                    </div>
                  </div>
                )}
                {property.areaSqFt !== null && (
                  <div className="flex items-center gap-2 p-3 bg-zinc-50 rounded-lg">
                    <Square className="h-5 w-5 text-zinc-500" />
                    <div>
                      <p className="text-sm font-medium">
                        {property.areaSqFt.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">Sq. Ft.</p>
                    </div>
                  </div>
                )}
                {property.parkingSpaces !== null && (
                  <div className="flex items-center gap-2 p-3 bg-zinc-50 rounded-lg">
                    <Car className="h-5 w-5 text-zinc-500" />
                    <div>
                      <p className="text-sm font-medium">
                        {property.parkingSpaces}
                      </p>
                      <p className="text-xs text-muted-foreground">Parking</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {property.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-sm font-medium">Address</p>
                    <p className="text-sm text-muted-foreground">
                      {property.address}
                    </p>
                  </div>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">County</p>
                  <p className="text-sm font-medium">{property.county}</p>
                </div>
                {property.constituency && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Constituency
                    </p>
                    <p className="text-sm font-medium">
                      {property.constituency}
                    </p>
                  </div>
                )}
                {property.neighbourhood && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Neighbourhood
                    </p>
                    <p className="text-sm font-medium">
                      {property.neighbourhood}
                    </p>
                  </div>
                )}
              </div>
              {property.latitude && property.longitude && (
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground">
                    Coordinates: {property.latitude}, {property.longitude}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attachments */}
          {property.attachments && property.attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Documents ({property._count.attachments})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {property.attachments.map(
                    (attachment: {
                      id: string;
                      fileUrl: string;
                      type: string;
                      isVerified: boolean;
                    }) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-zinc-500" />
                          <div>
                            <p className="text-sm font-medium">
                              {attachment.fileUrl}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {attachment.type}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {attachment.isVerified ? (
                            <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Pending
                            </Badge>
                          )}
                          <a
                            href={attachment.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Price Card */}
          <Card className="bg-zinc-900 text-white">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-zinc-400">Asking Price</p>
                <p className="text-3xl font-bold mt-1">
                  {property.currency} {property.price.toLocaleString()}
                </p>
                <Badge className="mt-2" variant="secondary">
                  For {property.type}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Agent */}
          {property.agent && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Listing Agent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  {property.agent.user.avatar ? (
                    <Image
                      src={property.agent.user.avatar}
                      alt={property.agent.companyName}
                      className="rounded-full object-cover"
                      width={48}
                      height={48}
                      fill
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-zinc-200 flex items-center justify-center">
                      <User className="h-6 w-6 text-zinc-500" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{property.agent.companyName}</p>
                    <p className="text-sm text-muted-foreground">
                      {property.agent.user.firstName}{" "}
                      {property.agent.user.lastName}
                    </p>
                  </div>
                </div>
                <Link href={`/professionals/${property.agent.userId}`}>
                  <Button variant="outline" className="w-full" size="sm">
                    View Agent Profile
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Verification Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Verification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={property.verified ? "default" : "secondary"}>
                  {property.verificationStatus}
                </Badge>
              </div>
              {property.verifiedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Verified At
                  </span>
                  <span className="text-sm">
                    {new Date(property.verifiedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              {property.rejectionReason && (
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-sm font-medium text-red-700">
                    Rejection Reason
                  </p>
                  <p className="text-sm text-red-600 mt-1">
                    {property.rejectionReason}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timestamps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Listed
                </span>
                <span className="text-sm">
                  {new Date(property.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Updated
                </span>
                <span className="text-sm">
                  {new Date(property.updatedAt).toLocaleDateString()}
                </span>
              </div>
              {property.yearBuilt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Year Built
                  </span>
                  <span className="text-sm">{property.yearBuilt}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
