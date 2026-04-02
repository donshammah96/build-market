// @ts-nocheck
import { notFound } from "next/navigation";
import Link from "next/link";
import { getServiceCategoryDetails } from "@/actions/admin";
import { getAdminPermissions } from "@/actions/admin/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Wrench,
  Users,
  Calendar,
  Tag,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface ServiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ServiceDetailPage({
  params,
}: ServiceDetailPageProps) {
  const { id } = await params;
  const response = await getServiceCategoryDetails(id);

  if (!response.success || !response.data) {
    notFound();
  }

  const service = response.data;

  const { granularRole } = await getAdminPermissions();
  const canManageServices = [
    "SUPER_ADMIN",
    "CONTENT_MODERATOR",
  ].includes(granularRole || "");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/services">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-zinc-900">
                {service.name}
              </h1>
              <Badge variant={service.isActive ? "default" : "secondary"}>
                {service.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-zinc-500 mt-1">
              {service.slug && `/${service.slug}`}
            </p>
          </div>
        </div>
        {canManageServices && (
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href={`/services/${id}/edit`}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit Service
              </Link>
            </Button>
            <Button variant="destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Service Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="text-sm font-medium text-zinc-500 mb-2">
                  Description
                </h4>
                <p className="text-zinc-900">
                  {service.description || "No description provided"}
                </p>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-zinc-500 mb-2">
                    Profession Type
                  </h4>
                  {service.professionType ? (
                    <Badge variant="outline" className="capitalize">
                      <Tag className="h-3 w-3 mr-1" />
                      {service.professionType.toLowerCase().replace(/_/g, " ")}
                    </Badge>
                  ) : (
                    <span className="text-zinc-400">Not specified</span>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-medium text-zinc-500 mb-2">
                    Status
                  </h4>
                  <div className="flex items-center gap-2">
                    {service.isActive ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <span className="text-emerald-700">Active</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-zinc-400" />
                        <span className="text-zinc-500">Inactive</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-zinc-500 mb-2 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Created
                  </h4>
                  <p className="text-zinc-900">
                    {new Date(service.createdAt).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-zinc-500 mb-2 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Last Updated
                  </h4>
                  <p className="text-zinc-900">
                    {new Date(service.updatedAt).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Professionals Using This Service */}
          {service.professionals && service.professionals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Professionals Offering This Service
                </CardTitle>
                <CardDescription>
                  {service.professionals.length} professional(s) offering this
                  service
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {service.professionals.map((prof) => (
                    <div
                      key={prof.userId}
                      className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                          <Users className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900">
                            {prof.companyName}
                          </p>
                          {prof.verified && (
                            <Badge variant="outline" className="text-xs mt-1">
                              Verified
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/professionals/${prof.userId}`}>
                          View Profile
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-zinc-600">Professionals</span>
                <Badge variant="secondary">
                  {service.professionals?.length || 0}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-zinc-600">Status</span>
                <Badge variant={service.isActive ? "default" : "outline"}>
                  {service.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          {canManageServices && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  asChild
                >
                  <Link href={`/services/${id}/edit`}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Service Details
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  {service.isActive ? (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Deactivate Service
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Activate Service
                    </>
                  )}
                </Button>
                <Separator className="my-2" />
                <Button variant="destructive" className="w-full justify-start">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Service
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
