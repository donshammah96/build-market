import { getProfessionalDetails } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  XCircle,
  FileText,
  Globe,
  MapPin,
  User as UserIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfessionalProfileEditor } from "@/components/admin/professional-profile-editor";
import { CertificateManager } from "@/components/admin/certificate-manager";
import { getAdminPermissions } from "@/actions/admin/_core/permissions";

type ProfessionalDetailView = {
  userId: string;
  companyName: string;
  verified: boolean;
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatar: string | null;
  };
  licenseNumber?: string | null;
  yearsExperience?: number | null;
  bio?: string | null;
  website?: string | null;
  city?: string | null;
  county?: string | null;
  country?: string | null;
  services: Array<{
    id: string;
    name: string;
  }>;
  certificates: Array<{
    id: string;
    name: string;
    fileUrl: string;
    issuer: string | null;
    expiryDate: string | Date | null;
  }>;
  createdAt: string | Date;
  reviews: Array<unknown>;
};
export default async function ProfessionalDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const response = await getProfessionalDetails(id);
  const { granularRole } = await getAdminPermissions();

  if (!response.success || !response.data) return notFound();

  const pro = response.data as unknown as ProfessionalDetailView;

  // Role Checks
  const canEditProfile = [
    "SUPER_ADMIN",
    "CONTENT_MODERATOR",
    "VERIFICATION_SPECIALIST",
  ].includes(granularRole || "");
  const canManageCertificates = [
    "SUPER_ADMIN",
    "VERIFICATION_SPECIALIST",
  ].includes(granularRole || "");

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={pro.user.avatar || ""} />
            <AvatarFallback>{pro.companyName[0]}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {pro.companyName}
            </h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <UserIcon className="h-4 w-4" /> {pro.user.firstName}{" "}
              {pro.user.lastName} | {pro.user.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${pro.verified ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
          >
            {pro.verified ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {pro.verified ? "Verified" : "Unverified"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Company Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Editor Component */}
              <ProfessionalProfileEditor
                userId={pro.userId}
                canEdit={canEditProfile}
                initialData={{
                  companyName: pro.companyName,
                  licenseNumber: pro.licenseNumber,
                  yearsExperience: pro.yearsExperience,
                  bio: pro.bio,
                  website: pro.website,
                  city: pro.city,
                  county: pro.county,
                }}
              />

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    License Number
                  </p>
                  <p>{pro.licenseNumber || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Years Experience
                  </p>
                  <p>{pro.yearsExperience || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Location
                  </p>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <p>
                      {pro.city}, {pro.county}, {pro.country}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Website
                  </p>
                  {pro.website ? (
                    <Link
                      href={pro.website}
                      target="_blank"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Globe className="h-4 w-4" /> {pro.website}
                    </Link>
                  ) : (
                    "N/A"
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Bio
                </p>
                <p className="text-sm text-muted-foreground">
                  {pro.bio || "No bio provided."}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Services
                </p>
                <div className="flex flex-wrap gap-2">
                  {pro.services.map((s) => (
                    <span
                      key={s.id}
                      className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs"
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Certificates</CardTitle>
              <CardDescription>
                Submitted documents for verification
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pro.certificates.length > 0 ? (
                <div className="space-y-4">
                  {pro.certificates.map((cert) => (
                    <div
                      key={cert.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="font-medium">{cert.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {cert.issuer} - Exp:{" "}
                            {cert.expiryDate
                              ? new Date(cert.expiryDate).toLocaleDateString()
                              : "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={cert.fileUrl} target="_blank">
                            View
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}

                  <Separator className="my-4" />
                  <h4 className="text-sm font-medium mb-2">
                    Manage Certificates
                  </h4>
                  <CertificateManager
                    canManage={canManageCertificates}
                    certificates={pro.certificates.map((c) => ({
                      id: c.id,
                      name: c.name,
                      fileUrl: c.fileUrl,
                    }))}
                  />
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No certificates uploaded.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Joined</span>
                <span>{new Date(pro.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Reviews</span>
                <span>{pro.reviews.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
