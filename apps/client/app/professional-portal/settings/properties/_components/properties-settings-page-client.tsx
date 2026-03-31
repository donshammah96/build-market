"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Loader2,
  AlertCircle,
  Eye,
  Home,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PropertyFormSubmitData } from "@/components/forms/PropertyForm";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { StatCard } from "@/components/ui/StatCard";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import {
  useMyProperties,
  useDeleteProperty,
  usePropertyDocuments,
  useAddPropertyDocument,
  useReplacePropertyDocument,
  useRemovePropertyDocument,
  useCreateProperty,
} from "@/hooks/useProperties";
import { PropertyListCard } from "./property-list-card";
import { PropertyDocumentsSection } from "./property-documents-section";
import type {
  MyPropertyListing,
  PropertyDocumentDto,
  CreatePropertyClientInput,
  MyPropertiesPayload,
} from "@/lib/properties-client";

const PropertyForm = dynamic(() => import("@/components/forms/PropertyForm"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-60 items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
    </div>
  ),
});

export default function PropertiesSettingsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] =
    useState<MyPropertyListing | null>(null);
  const [selectedPropertyForDocs, setSelectedPropertyForDocs] = useState<
    string | null
  >(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "pending" | "sold"
  >("all");
  const [activeTab, setActiveTab] = useState<"properties" | "verification">(
    "properties",
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

  // Fetch all properties via hook
  const {
    data: myPropertiesData,
    isLoading,
    error,
    refetch: refetchProperties,
  } = useMyProperties({ status: "all", limit: 50 });

  // Delete property via server action hook
  const deletePropertyMutation = useDeleteProperty({
    onSuccess: () => {
      toast.success("Property deleted successfully");
      setIsDeleteOpen(false);
      setSelectedProperty(null);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete property",
      );
    },
  });

  const allProperties =
    (myPropertiesData as MyPropertiesPayload | undefined)?.properties ?? [];
  const properties =
    statusFilter === "all"
      ? allProperties
      : allProperties.filter((p) => p.status === statusFilter);
  const propertyDetails = allProperties;

  // Fetch attachments for selected property via hook
  const { data: attachmentsRaw } = usePropertyDocuments(
    selectedPropertyForDocs,
    !!selectedPropertyForDocs,
  );
  const attachments: PropertyDocumentDto[] = attachmentsRaw ?? [];

  // Document mutations via server action hooks
  const addDocMutation = useAddPropertyDocument(selectedPropertyForDocs ?? "");
  const replaceDocMutation = useReplacePropertyDocument(
    selectedPropertyForDocs ?? "",
  );
  const removeDocMutation = useRemovePropertyDocument(
    selectedPropertyForDocs ?? "",
  );

  const createPropertyMutation = useCreateProperty({
    onSuccess: () => {
      setIsCreateOpen(false);
      toast.success("Property created successfully");
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to create property",
      );
    },
  });

  const handleCreateProperty = async (data: PropertyFormSubmitData) => {
    const { images: imageUrls = [], imageAssets = [], ...rest } = data;

    if (imageUrls.length !== imageAssets.length) {
      throw new Error(
        "Upload property images from your device in this form. Pasted image URLs cannot be published from settings because the API requires asset-backed media.",
      );
    }

    const payload: CreatePropertyClientInput = {
      ...rest,
      priceNegotiable: rest.priceNegotiable ?? false,
      titleDeedReady: false,
      areaUnit: rest.areaUnit ?? "SQ_METERS",
      furnishing: "UNFURNISHED",
      completionStatus: "READY_TO_MOVE",
      hasBorehole: rest.hasBorehole ?? false,
      hasBackupGenerator: rest.hasBackupGenerator ?? false,
      hasElevator: rest.hasElevator ?? false,
      hasCCTV: rest.hasCCTV ?? false,
      isGatedCommunity: rest.isGatedCommunity ?? false,
      features: rest.features ?? [],
      featured: false,
      attachments: [],
      images: imageAssets.map((image, index) => ({
        assetId: image.assetId,
        category: "EXTERIOR",
        isMain: index === 0,
        tags: [],
      })),
      documents: (data.documents ?? []).map((document) => ({
        ...document,
        status: "PENDING",
        isPrivate: true,
      })),
    };

    await createPropertyMutation.mutateAsync(payload);
  };

  const handleDelete = (property: MyPropertyListing) => {
    setSelectedProperty(property);
    setIsDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (selectedProperty) {
      deletePropertyMutation.mutate({
        id: selectedProperty.id,
        version: selectedProperty.version,
      });
    }
  };

  // Check for properties with pending/rejected verification
  const hasPendingIssues =
    propertyDetails?.some(
      (p) =>
        p.verificationStatus === "REJECTED" ||
        p.verificationStatus === "NEEDS_CORRECTION" ||
        p.verificationStatus === "PENDING",
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
      <div className="space-y-6 max-w-400 mx-auto">
        <div className="flex items-center justify-center min-h-100">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 max-w-400 mx-auto">
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
            <Button onClick={() => refetchProperties()}>Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-400 mx-auto">
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
            <StatCard
              label="Total Properties"
              value={allProperties.length}
              icon={Home}
            />
            <StatCard
              label="Active"
              value={allProperties.filter((p) => p.status === "active").length}
              icon={CheckCircle}
              valueClassName="text-emerald-600"
              iconClassName="text-emerald-400"
            />
            <StatCard
              label="Pending"
              value={allProperties.filter((p) => p.status === "pending").length}
              icon={Clock}
              valueClassName="text-amber-600"
              iconClassName="text-amber-400"
            />
            <StatCard
              label="Total Inquiries"
              value={allProperties.reduce((sum, p) => sum + p.inquiries, 0)}
              icon={Eye}
            />
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
                    <PropertyListCard
                      key={property.id}
                      property={property}
                      statusBadge={getStatusBadge(property.status)}
                      onEdit={(p) => router.push(`/properties/${p.id}/edit`)}
                      onDelete={handleDelete}
                    />
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
                              <VerificationBadge
                                status={
                                  verificationStatus as
                                    | "UNVERIFIED"
                                    | "PENDING"
                                    | "VERIFIED"
                                    | "REJECTED"
                                    | "NEEDS_CORRECTION"
                                }
                              />
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
                                  : property.id,
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
                          <PropertyDocumentsSection
                            documents={attachments}
                            onUpload={async (docType, assetId) => {
                              await addDocMutation.mutateAsync({
                                type: docType,
                                assetId,
                              });
                            }}
                            onReplace={async (documentId, assetId, docType) => {
                              await replaceDocMutation.mutateAsync({
                                documentId,
                                assetId,
                                type: docType,
                              });
                            }}
                            onDelete={async (documentId) => {
                              await removeDocMutation.mutateAsync({
                                documentId,
                              });
                            }}
                          />
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
            onSubmit={handleCreateProperty}
            hideSubmitButton={false}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          setIsDeleteOpen(open);
          if (!open) setSelectedProperty(null);
        }}
        title="Delete Property"
        entityName={selectedProperty?.title ?? ""}
        description={`Are you sure you want to delete \u201c${selectedProperty?.title}\u201d? This action cannot be undone. All associated data will be permanently removed.`}
        onConfirm={confirmDelete}
        isPending={deletePropertyMutation.isPending}
      />
    </div>
  );
}
