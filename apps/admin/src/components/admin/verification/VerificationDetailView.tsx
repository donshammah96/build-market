"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  User,
  Mail,
  Phone,
  ExternalLink,
  Loader2,
  History,
  Eye,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "react-toastify";
import {
  verifyEntity,
  verifyDocument,
  type EntityType,
  type VerificationDetails,
} from "@/actions/admin";
import { createAdminIdempotencyKey } from "@/lib/security/idempotency-key";
import { RejectionReasonDialog } from "./RejectionReasonDialog";
import { DocumentViewer } from "./DocumentViewer";

interface VerificationDetailViewProps {
  entityType: EntityType;
  entityId: string;
  details: VerificationDetails;
  canVerify?: boolean;
}

const statusConfig = {
  UNVERIFIED: {
    label: "Unverified",
    variant: "secondary" as const,
    color: "bg-zinc-500",
  },
  PENDING: {
    label: "Pending Review",
    variant: "default" as const,
    color: "bg-amber-500",
  },
  VERIFIED: {
    label: "Verified",
    variant: "default" as const,
    color: "bg-emerald-500",
  },
  REJECTED: {
    label: "Rejected",
    variant: "destructive" as const,
    color: "bg-red-500",
  },
  NEEDS_CORRECTION: {
    label: "Needs Correction",
    variant: "default" as const,
    color: "bg-orange-500",
  },
};

export function VerificationDetailView({
  entityType,
  entityId,
  details,
  canVerify = false,
}: VerificationDetailViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRejectionDialogOpen, setIsRejectionDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "REJECT" | "REQUEST_CORRECTION"
  >("REJECT");
  const [selectedDocument, setSelectedDocument] = useState<{
    id: string;
    type: string;
    fileUrl: string;
  } | null>(null);

  const status = statusConfig[details.status as keyof typeof statusConfig];

  const handleVerify = async () => {
    startTransition(async () => {
      const response = await verifyEntity(
        {
          entityType,
          entityId,
          action: "VERIFY",
        },
        createAdminIdempotencyKey(
          "verifyEntity",
          `${entityType}:${entityId}:VERIFY`,
        ),
      );

      if (response.success) {
        toast.success(response.data?.message || "Successfully verified");
        router.refresh();
      } else {
        toast.error(response.error || "Failed to verify");
      }
    });
  };

  const handleReject = () => {
    setPendingAction("REJECT");
    setIsRejectionDialogOpen(true);
  };

  const handleRequestCorrection = () => {
    setPendingAction("REQUEST_CORRECTION");
    setIsRejectionDialogOpen(true);
  };

  const handleRejectionSubmit = async (reason: string) => {
    startTransition(async () => {
      const response = await verifyEntity(
        {
          entityType,
          entityId,
          action: pendingAction,
          reason,
        },
        createAdminIdempotencyKey(
          "verifyEntity",
          `${entityType}:${entityId}:${pendingAction}`,
        ),
      );

      if (response.success) {
        toast.success(response.data?.message || "Action completed");
        setIsRejectionDialogOpen(false);
        router.refresh();
      } else {
        toast.error(response.error || "Action failed");
      }
    });
  };

  const handleDocumentVerify = async (
    documentId: string,
    action: "APPROVE" | "REJECT",
  ) => {
    startTransition(async () => {
      // Determine document type based on entity type
      let documentType:
        | "professional_document"
        | "property_attachment"
        | "certificate" = "professional_document";
      if (entityType === "property") {
        documentType = "property_attachment";
      }

      const response = await verifyDocument(
        {
          documentType,
          documentId,
          action,
        },
        createAdminIdempotencyKey(
          "verifyDocument",
          `${documentType}:${documentId}:${action}`,
        ),
      );

      if (response.success) {
        toast.success(
          response.data?.message || `Document ${action.toLowerCase()}d`,
        );
        router.refresh();
      } else {
        toast.error(response.error || "Failed to update document");
      }
    });
  };

  // Extract entity-specific display info
  const getEntityInfo = () => {
    const entity = details.entity;
    switch (entityType) {
      case "professional":
        return {
          title: entity.companyName || "Professional Profile",
          subtitle: entity.profession,
          fields: [
            { label: "License Number", value: entity.licenseNumber },
            { label: "Years Experience", value: entity.yearsExperience },
            { label: "City", value: entity.city },
            { label: "County", value: entity.county },
            { label: "Website", value: entity.website, isLink: true },
          ],
        };
      case "store":
        return {
          title: entity.name || "Store",
          subtitle: entity.storeType,
          fields: [
            { label: "Store Type", value: entity.storeType },
            { label: "City", value: entity.city },
            { label: "County", value: entity.county },
            { label: "Address", value: entity.address },
            { label: "Products", value: entity._count?.products },
          ],
        };
      case "property":
        return {
          title: entity.title || "Property",
          subtitle: `${entity.type} - ${entity.category}`,
          fields: [
            {
              label: "Price",
              value: entity.price
                ? `KES ${Number(entity.price).toLocaleString()}`
                : null,
            },
            { label: "Location", value: entity.location },
            { label: "County", value: entity.county },
            { label: "Bedrooms", value: entity.bedrooms },
            { label: "Bathrooms", value: entity.bathrooms },
            {
              label: "Size",
              value: entity.size ? `${entity.size} sqft` : null,
            },
          ],
        };
      default:
        return { title: "Unknown", subtitle: "", fields: [] };
    }
  };

  const entityInfo = getEntityInfo();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/verifications">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{entityInfo.title}</h1>
            <p className="text-muted-foreground">{entityInfo.subtitle}</p>
          </div>
        </div>
        <Badge variant={status.variant} className="text-sm px-3 py-1">
          {status.label}
        </Badge>
      </div>

      {/* Action Buttons */}
      {details.status !== "VERIFIED" && canVerify && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="text-sm text-muted-foreground">
              Review the information and documents below, then take action.
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleRequestCorrection}
                disabled={isPending}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Request Correction
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isPending}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button onClick={handleVerify} disabled={isPending}>
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Verify
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Entity Details */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="documents">
                Documents
                {details.documents && details.documents.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {details.documents.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Entity Information</CardTitle>
                  <CardDescription>
                    Details submitted for verification
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {entityInfo.fields
                      .filter((f) => f.value)
                      .map((field) => (
                        <div key={field.label} className="space-y-1">
                          <dt className="text-sm font-medium text-muted-foreground">
                            {field.label}
                          </dt>
                          <dd className="text-sm">
                            {field.isLink ? (
                              <a
                                href={field.value}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline flex items-center gap-1"
                              >
                                {field.value}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              field.value
                            )}
                          </dd>
                        </div>
                      ))}
                  </dl>

                  {details.entity.bio && (
                    <>
                      <Separator className="my-4" />
                      <div className="space-y-1">
                        <dt className="text-sm font-medium text-muted-foreground">
                          Bio / Description
                        </dt>
                        <dd className="text-sm whitespace-pre-wrap">
                          {details.entity.bio || details.entity.description}
                        </dd>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Uploaded Documents</CardTitle>
                  <CardDescription>
                    Review and verify each document
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {details.documents && details.documents.length > 0 ? (
                    <div className="space-y-4">
                      {details.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted rounded-lg">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{doc.type}</p>
                              <p className="text-xs text-muted-foreground">
                                {doc.isVerified ? (
                                  <span className="text-emerald-500">
                                    Verified{" "}
                                    {doc.verifiedAt &&
                                      format(new Date(doc.verifiedAt), "PPp")}
                                  </span>
                                ) : (
                                  "Pending review"
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedDocument(doc)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            {!doc.isVerified && canVerify && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleDocumentVerify(doc.id, "APPROVE")
                                  }
                                  disabled={isPending}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1 text-emerald-500" />
                                  Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleDocumentVerify(doc.id, "REJECT")
                                  }
                                  disabled={isPending}
                                >
                                  <XCircle className="h-4 w-4 mr-1 text-red-500" />
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No documents uploaded</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Audit History</CardTitle>
                  <CardDescription>
                    Verification actions taken on this entity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {details.auditHistory && details.auditHistory.length > 0 ? (
                    <ScrollArea className="h-100">
                      <div className="space-y-4">
                        {details.auditHistory.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex gap-4 pb-4 border-b last:border-0"
                          >
                            <div className="shrink-0">
                              <div className="p-2 bg-muted rounded-full">
                                <History className="h-4 w-4" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">
                                {entry.action.replace(/_/g, " ")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {entry.oldStatus} → {entry.newStatus}
                              </p>
                              {entry.reason && (
                                <p className="text-sm mt-1 text-muted-foreground">
                                  {entry.reason}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2">
                                By {entry.admin.firstName}{" "}
                                {entry.admin.lastName} •{" "}
                                {formatDistanceToNow(
                                  new Date(entry.createdAt),
                                  {
                                    addSuffix: true,
                                  },
                                )}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No history available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Owner Info & Meta */}
        <div className="space-y-6">
          {/* Owner/Agent Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {entityType === "property" ? "Agent" : "Owner"} Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-medium">
                    {details.entity.user?.firstName ||
                      details.entity.owner?.firstName}{" "}
                    {details.entity.user?.lastName ||
                      details.entity.owner?.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Account holder
                  </p>
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {details.entity.user?.email || details.entity.owner?.email}
                  </span>
                </div>
                {(details.entity.user?.phone ||
                  details.entity.owner?.phone) && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {details.entity.user?.phone ||
                        details.entity.owner?.phone}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Verification Meta Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Verification Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                {details.submittedAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Submitted</span>
                    <span>{format(new Date(details.submittedAt), "PPp")}</span>
                  </div>
                )}
                {details.verifiedAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Verified</span>
                    <span>{format(new Date(details.verifiedAt), "PPp")}</span>
                  </div>
                )}
                {details.verifiedBy && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Verified By</span>
                    <span>
                      {details.verifiedBy.firstName}{" "}
                      {details.verifiedBy.lastName}
                    </span>
                  </div>
                )}
              </div>
              {details.rejectionReason && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-red-500">
                      Rejection Reason
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {details.rejectionReason}
                    </p>
                  </div>
                </>
              )}
              {details.verificationNotes && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Notes</p>
                    <p className="text-sm text-muted-foreground">
                      {details.verificationNotes}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <RejectionReasonDialog
        open={isRejectionDialogOpen}
        onOpenChange={setIsRejectionDialogOpen}
        onSubmit={handleRejectionSubmit}
        action={pendingAction}
        isLoading={isPending}
      />

      {selectedDocument && (
        <DocumentViewer
          document={selectedDocument}
          open={!!selectedDocument}
          onOpenChange={(open) => !open && setSelectedDocument(null)}
        />
      )}
    </div>
  );
}
