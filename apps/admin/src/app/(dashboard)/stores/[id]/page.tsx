import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  getStoreDetails,
  verifyStore,
  toggleStoreFeatured,
} from "@/actions/admin";
import { getAdminPermissions } from "@/actions/admin/shared";
import { createAdminIdempotencyKey } from "@/lib/security/idempotency-key";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  CheckCircle,
  Star,
  MapPin,
  Phone,
  Mail,
  Globe,
  Package,
  ShoppingCart,
  MessageSquare,
  Calendar,
  User,
  ExternalLink,
} from "lucide-react";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";

export const dynamic = "force-dynamic";

interface StoreDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function StoreDetailPage({
  params,
}: StoreDetailPageProps) {
  const { id } = await params;
  const response = await getStoreDetails(id);

  if (!response.success || !response.data) {
    return notFound();
  }

  const store = response.data;

  const { granularRole } = await getAdminPermissions();
  const canVerify = ["SUPER_ADMIN", "VERIFICATION_SPECIALIST"].includes(
    granularRole || "",
  );
  const canManageStores = ["SUPER_ADMIN", "CONTENT_MODERATOR"].includes(
    granularRole || "",
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[{ label: "Stores", href: "/stores" }, { label: store.name }]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/stores">
            <Button variant="outline" size="icon" className="h-10 w-10">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {store.name}
              </h1>
              {store.verified && (
                <Badge className="bg-emerald-100 text-emerald-700">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Verified
                </Badge>
              )}
              {store.featured && (
                <Badge className="bg-purple-100 text-purple-700">
                  <Star className="mr-1 h-3 w-3" />
                  Featured
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              {store.city}, {store.county}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!store.verified && canVerify && (
            <form
              action={async (formData) => {
                "use server";
                const idempotencyKey = String(
                  formData.get("idempotencyKey") || "",
                );
                await verifyStore(id, idempotencyKey);
              }}
            >
              <input
                type="hidden"
                name="idempotencyKey"
                value={createAdminIdempotencyKey("verifyStore", id)}
              />
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle className="mr-2 h-4 w-4" />
                Verify Store
              </Button>
            </form>
          )}
          {canManageStores && (
            <form
              action={async (formData) => {
                "use server";
                const idempotencyKey = String(
                  formData.get("idempotencyKey") || "",
                );
                await toggleStoreFeatured(id, idempotencyKey);
              }}
            >
              <input
                type="hidden"
                name="idempotencyKey"
                value={createAdminIdempotencyKey("toggleStoreFeatured", id)}
              />
              <Button variant="outline">
                <Star className="mr-2 h-4 w-4" />
                {store.featured ? "Remove Featured" : "Mark Featured"}
              </Button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Info */}
        <div className="md:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Store Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {store.description && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Description
                  </h4>
                  <p className="text-sm">{store.description}</p>
                </div>
              )}
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Store Type
                  </h4>
                  <Badge variant="secondary" className="capitalize">
                    {store.storeType.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Categories
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {store.categories.map((cat: string) => (
                      <Badge
                        key={cat}
                        variant="outline"
                        className="capitalize text-xs"
                      >
                        {cat.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact & Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {store.address}, {store.city}, {store.county}
                  {store.zipCode && `, ${store.zipCode}`}
                </span>
              </div>
              {store.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{store.phone}</span>
                </div>
              )}
              {store.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`mailto:${store.email}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {store.email}
                  </a>
                </div>
              )}
              {store.website && (
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={store.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {store.website}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Products */}
          {store.products && store.products.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Recent Products ({store._count.products})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {store.products.map(
                    (product: (typeof store.products)[number]) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-sm">{product.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {product.status}
                          </p>
                        </div>
                        <span className="font-semibold text-sm">
                          KES {product.price.toLocaleString()}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Images */}
          {store.images && store.images.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Store Images</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {store.images.map((image: (typeof store.images)[number]) => (
                    <div
                      key={image.id}
                      className="relative aspect-square rounded-lg overflow-hidden bg-zinc-100"
                    >
                      <Image
                        src={image.url}
                        alt={image.caption || "Store image"}
                        fill
                        className="object-cover"
                      />
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
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Store Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Products
                </span>
                <span className="font-semibold">{store._count.products}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Orders
                </span>
                <span className="font-semibold">{store._count.orders}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Reviews
                </span>
                <span className="font-semibold">{store._count.reviews}</span>
              </div>
            </CardContent>
          </Card>

          {/* Owner */}
          {store.owner && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Store Owner</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  {store.owner.user.avatar ? (
                    <Image
                      src={store.owner.user.avatar}
                      alt={store.owner.companyName}
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-zinc-200 flex items-center justify-center">
                      <User className="h-6 w-6 text-zinc-500" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{store.owner.companyName}</p>
                    <p className="text-sm text-muted-foreground">
                      {store.owner.user.firstName} {store.owner.user.lastName}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`mailto:${store.owner.user.email}`}
                      className="text-blue-600 hover:underline"
                    >
                      {store.owner.user.email}
                    </a>
                  </div>
                </div>
                <Link href={`/professionals/${store.owner.userId}`}>
                  <Button variant="outline" className="w-full" size="sm">
                    View Professional Profile
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
                <Badge variant={store.verified ? "default" : "secondary"}>
                  {store.verificationStatus}
                </Badge>
              </div>
              {store.verifiedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Verified At
                  </span>
                  <span className="text-sm">
                    {new Date(store.verifiedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
              {store.rejectionReason && (
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-sm font-medium text-red-700">
                    Rejection Reason
                  </p>
                  <p className="text-sm text-red-600 mt-1">
                    {store.rejectionReason}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timestamps */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Created
                </span>
                <span className="text-sm">
                  {new Date(store.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Updated
                </span>
                <span className="text-sm">
                  {new Date(store.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
