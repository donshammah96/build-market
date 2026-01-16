"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Loader2,
  AlertCircle,
  Edit,
  Eye,
  Trash2,
  Home,
  MapPin,
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageWithFallback } from "@/app/lib/ImageWithFallback";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import PropertyForm from "@/components/forms/PropertyForm";
import { DocumentUploader } from "@/components/admin/verification/DocumentUploader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";

interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  type: string;
  status: "active" | "pending" | "sold" | "rented";
  views: number;
  inquiries: number;
  images: string[];
  verificationStatus?:
    | "UNVERIFIED"
    | "PENDING"
    | "VERIFIED"
    | "REJECTED"
    | "NEEDS_CORRECTION";
  rejectionReason?: string | null;
}

interface PropertyAttachment {
  id: string;
  fileUrl: string;
  fileKey?: string | null;
  type: string;
  isVerified: boolean;
  verifiedAt?: Date | string | null;
  notes?: string | null;
  createdAt: Date | string;
}

export default function PropertiesSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null
  );
  const [selectedPropertyForDocs, setSelectedPropertyForDocs] = useState<
    string | null
  >(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "pending" | "sold"
  >("all");
  const [activeTab, setActiveTab] = useState<"properties" | "verification">(
    "properties"
  );

  // Check URL params for status and redirect to verification tab if needed
  useEffect(() => {
    const status = searchParams.get("status");
    const tab = searchParams.get("tab");
    if (
      tab === "verification" ||
      status === "rejected" ||
      status === "needs_correction"
    ) {
      setActiveTab("verification");
    }
  }, [searchParams]);

  // Fetch properties
  const { data, isLoading, error } = useQuery<{ data: Property[] }>({
    queryKey: ["my-properties", statusFilter],
    queryFn: async () => {
      const res = await fetch(
        `/api/properties/my-listings?status=${statusFilter}&limit=50`
      );
      if (!res.ok) throw new Error("Failed to fetch properties");
      return res.json();
    },
  });

  // Delete property mutation
  const deletePropertyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/properties/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete property");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-properties"] });
      toast.success("Property deleted successfully");
      setIsDeleteOpen(false);
      setSelectedProperty(null);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete property"
      );
    },
  });

  const properties = data?.data || [];

  // Fetch property details with verification status (for verification tab)
  const { data: propertyDetailsData } = useQuery<{ data: Property[] }>({
    queryKey: ["property-details"],
    queryFn: async () => {
      const res = await fetch(
        "/api/properties/my-listings?status=all&limit=50"
      );
      if (!res.ok) return { data: [] };
      return res.json();
    },
  });

  const propertyDetails = propertyDetailsData?.data || [];

  // Fetch attachments for selected property
  const { data: attachmentsData } = useQuery<{ data: PropertyAttachment[] }>({
    queryKey: ["property-attachments", selectedPropertyForDocs],
    queryFn: async () => {
      if (!selectedPropertyForDocs) return { data: [] };
      const res = await fetch(
        `/api/properties/${selectedPropertyForDocs}/documents`
      );
      if (!res.ok) return { data: [] };
      return res.json();
    },
    enabled: !!selectedPropertyForDocs,
  });

  const attachments = attachmentsData?.data || [];

  // Upload document mutation
  const uploadDocumentMutation = useMutation({
    mutationFn: async ({
      propertyId,
      fileUrl,
      fileKey,
      type,
    }: {
      propertyId: string;
      fileUrl: string;
      fileKey?: string;
      type: string;
    }) => {
      const res = await fetch(`/api/properties/${propertyId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl, fileKey, type }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to upload document");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["property-attachments", selectedPropertyForDocs],
      });
      queryClient.invalidateQueries({ queryKey: ["property-details"] });
    },
  });

  // Replace document mutation
  const replaceDocumentMutation = useMutation({
    mutationFn: async ({
      propertyId,
      attachmentId,
      fileUrl,
      fileKey,
    }: {
      propertyId: string;
      attachmentId: string;
      fileUrl: string;
      fileKey?: string;
    }) => {
      const res = await fetch(`/api/properties/${propertyId}/documents`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentId, fileUrl, fileKey }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to replace document");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["property-attachments", selectedPropertyForDocs],
      });
      queryClient.invalidateQueries({ queryKey: ["property-details"] });
    },
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async ({
      propertyId,
      attachmentId,
    }: {
      propertyId: string;
      attachmentId: string;
    }) => {
      const res = await fetch(
        `/api/properties/${propertyId}/documents?attachmentId=${attachmentId}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete document");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["property-attachments", selectedPropertyForDocs],
      });
    },
  });

  const handleDelete = (property: Property) => {
    setSelectedProperty(property);
    setIsDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (selectedProperty) {
      deletePropertyMutation.mutate(selectedProperty.id);
    }
  };

  // Check for properties with pending/rejected verification
  const hasPendingIssues =
    propertyDetails?.some(
      (p) =>
        p.verificationStatus === "REJECTED" ||
        p.verificationStatus === "NEEDS_CORRECTION" ||
        p.verificationStatus === "PENDING"
    ) || false;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
            <CheckCircle className="mr-1 h-3 w-3" />
            Active
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      case "sold":
      case "rented":
        return (
          <Badge className="bg-zinc-100 text-zinc-700 border-zinc-200">
            <XCircle className="mr-1 h-3 w-3" />
            {status === "sold" ? "Sold" : "Rented"}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto">
        <Card className="p-8">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">
              Error Loading Properties
            </h2>
            <p className="text-zinc-500 mb-4">
              {error instanceof Error
                ? error.message
                : "Unable to load your properties. Please try again."}
            </p>
            <Button
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ["my-properties"] })
              }
            >
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start border-b border-zinc-100 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
            Property Listings
          </h1>
          <p className="text-zinc-500 mt-1">
            Manage your property listings, documents, and verification status
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Property
        </Button>
      </div>

      {/* Alert for pending/rejected items */}
      {hasPendingIssues && activeTab === "properties" && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Verification Issues</AlertTitle>
          <AlertDescription>
            Some properties have pending verification or have been rejected.{" "}
            <Button
              variant="link"
              className="p-0 h-auto text-amber-700 underline"
              onClick={() => setActiveTab("verification")}
            >
              Review verification status
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as typeof activeTab)}
      >
        <TabsList className="bg-zinc-100">
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="verification">
            Verification
            {hasPendingIssues && (
              <Badge className="ml-2 bg-amber-500 text-white">!</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Properties Tab */}
        <TabsContent value="properties" className="space-y-6 mt-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border border-zinc-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-500 mb-1">
                      Total Properties
                    </p>
                    <p className="text-2xl font-bold text-zinc-900">
                      {properties.length}
                    </p>
                  </div>
                  <Home className="h-8 w-8 text-zinc-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="border border-zinc-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-500 mb-1">Active</p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {properties.filter((p) => p.status === "active").length}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-emerald-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="border border-zinc-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-500 mb-1">Pending</p>
                    <p className="text-2xl font-bold text-amber-600">
                      {properties.filter((p) => p.status === "pending").length}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-amber-400" />
                </div>
              </CardContent>
            </Card>
            <Card className="border border-zinc-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-500 mb-1">
                      Total Inquiries
                    </p>
                    <p className="text-2xl font-bold text-zinc-900">
                      {properties.reduce((sum, p) => sum + p.inquiries, 0)}
                    </p>
                  </div>
                  <Eye className="h-8 w-8 text-zinc-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Properties List */}
          <Card className="border border-zinc-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>My Properties</CardTitle>
                <Tabs
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter(value as typeof statusFilter)
                  }
                >
                  <TabsList className="bg-zinc-100">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="active">Active</TabsTrigger>
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="sold">Sold</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {properties.length === 0 ? (
                <div className="text-center py-12">
                  <Home className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                    No Properties Found
                  </h3>
                  <p className="text-zinc-500 mb-4">
                    Get started by adding your first property listing.
                  </p>
                  <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Property
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {properties.map((property) => (
                    <div
                      key={property.id}
                      className="flex flex-col md:flex-row gap-4 p-4 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                    >
                      {/* Property Image */}
                      <div className="w-full md:w-48 flex-shrink-0">
                        <AspectRatio
                          ratio={16 / 9}
                          className="bg-zinc-100 rounded-lg overflow-hidden"
                        >
                          <ImageWithFallback
                            src={property.images?.[0] || ""}
                            alt={property.title}
                            className="object-cover w-full h-full"
                          />
                        </AspectRatio>
                      </div>

                      {/* Property Details */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-semibold text-zinc-900">
                              {property.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <MapPin className="h-4 w-4 text-zinc-400" />
                              <span className="text-sm text-zinc-600">
                                {property.location}
                              </span>
                            </div>
                          </div>
                          {getStatusBadge(property.status)}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-zinc-600">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            <span className="font-semibold">
                              {new Intl.NumberFormat("en-KE", {
                                style: "currency",
                                currency: "KES",
                                minimumFractionDigits: 0,
                              }).format(property.price)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Home className="h-4 w-4" />
                            <span>{property.type}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Eye className="h-4 w-4" />
                            <span>{property.views} views</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>{property.inquiries} inquiries</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/properties/${property.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(`/properties/${property.id}/edit`)
                          }
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(property)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Verification Tab */}
        <TabsContent value="verification" className="space-y-6 mt-6">
          <Card className="border border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle>Property Verification</CardTitle>
            </CardHeader>
            <CardContent>
              {propertyDetails && propertyDetails.length > 0 ? (
                <div className="space-y-6">
                  {propertyDetails.map((property) => {
                    const verificationStatus =
                      property.verificationStatus || "UNVERIFIED";
                    const isRejected =
                      verificationStatus === "REJECTED" ||
                      verificationStatus === "NEEDS_CORRECTION";
                    const isPending = verificationStatus === "PENDING";
                    const isVerified = verificationStatus === "VERIFIED";

                    return (
                      <div
                        key={property.id}
                        className="border border-zinc-200 rounded-lg p-4 space-y-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold text-zinc-900">
                                {property.title}
                              </h3>
                              {isVerified && (
                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  Verified
                                </Badge>
                              )}
                              {isPending && (
                                <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                                  <Clock className="mr-1 h-3 w-3" />
                                  Pending Review
                                </Badge>
                              )}
                              {isRejected && (
                                <Badge className="bg-red-100 text-red-700 border-red-200">
                                  <XCircle className="mr-1 h-3 w-3" />
                                  {verificationStatus === "REJECTED"
                                    ? "Rejected"
                                    : "Needs Correction"}
                                </Badge>
                              )}
                              {verificationStatus === "UNVERIFIED" && (
                                <Badge variant="outline">Unverified</Badge>
                              )}
                            </div>
                            <p className="text-sm text-zinc-600">
                              {property.location}
                            </p>
                            {property.rejectionReason && (
                              <Alert className="mt-3 border-red-200 bg-red-50">
                                <AlertCircle className="h-4 w-4 text-red-600" />
                                <AlertTitle className="text-red-900">
                                  Rejection Reason
                                </AlertTitle>
                                <AlertDescription className="text-red-700">
                                  {property.rejectionReason}
                                </AlertDescription>
                              </Alert>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedPropertyForDocs(
                                selectedPropertyForDocs === property.id
                                  ? null
                                  : property.id
                              );
                            }}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            {selectedPropertyForDocs === property.id
                              ? "Hide"
                              : "Manage"}{" "}
                            Documents
                          </Button>
                        </div>

                        {selectedPropertyForDocs === property.id && (
                          <div className="border-t border-zinc-200 pt-4">
                            <div className="space-y-6">
                              {[
                                "TITLE_DEED",
                                "OFFICIAL_SEARCH",
                                "MANDATE_LETTER",
                              ].map((docType) => {
                                const typeAttachments = attachments.filter(
                                  (a) => a.type === docType
                                );
                                return (
                                  <div key={docType} className="space-y-2">
                                    <Label className="text-sm font-semibold text-zinc-900">
                                      {docType.replace(/_/g, " ")}
                                    </Label>
                                    <DocumentUploader
                                      documents={typeAttachments}
                                      documentType={docType}
                                      documentTypeLabel={docType.replace(
                                        /_/g,
                                        " "
                                      )}
                                      onUpload={async (fileUrl, fileKey) => {
                                        await uploadDocumentMutation.mutateAsync(
                                          {
                                            propertyId: property.id,
                                            fileUrl,
                                            fileKey,
                                            type: docType,
                                          }
                                        );
                                      }}
                                      onReplace={async (
                                        attachmentId,
                                        fileUrl,
                                        fileKey
                                      ) => {
                                        await replaceDocumentMutation.mutateAsync(
                                          {
                                            propertyId: property.id,
                                            attachmentId,
                                            fileUrl,
                                            fileKey,
                                          }
                                        );
                                      }}
                                      onDelete={async (attachmentId) => {
                                        await deleteDocumentMutation.mutateAsync(
                                          {
                                            propertyId: property.id,
                                            attachmentId,
                                          }
                                        );
                                      }}
                                      allowedTypes={[
                                        "application/pdf",
                                        "image/jpeg",
                                        "image/png",
                                      ]}
                                      maxSizeMB={10}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
                  <p className="text-zinc-500">No properties found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Property Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Property</DialogTitle>
            <DialogDescription>
              Create a new property listing to attract potential buyers or
              renters.
            </DialogDescription>
          </DialogHeader>
          <PropertyForm
            onSubmit={async (data) => {
              try {
                const res = await fetch("/api/properties", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(data),
                });
                if (!res.ok) {
                  const error = await res.json();
                  throw new Error(error.error || "Failed to create property");
                }
                setIsCreateOpen(false);
                queryClient.invalidateQueries({ queryKey: ["my-properties"] });
                toast.success("Property created successfully");
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Failed to create property"
                );
                throw error;
              }
            }}
            hideSubmitButton={false}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Property</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedProperty?.title}"? This
              action cannot be undone. All associated data will be permanently
              removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteOpen(false);
                setSelectedProperty(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deletePropertyMutation.isPending}
            >
              {deletePropertyMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete Property
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
