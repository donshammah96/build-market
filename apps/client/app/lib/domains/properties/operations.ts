import { ATTACHMENT_TYPE_LABELS } from "@build/enums";
import {
  DocumentStatus,
  ImageCategory,
  Prisma,
  VerificationStatus,
} from "@prisma/client";
import type {
  PropertyOperationContext,
  UpdatePropertyInput,
} from "@/domains/properties/contracts";

export type UpdatePropertyData = UpdatePropertyInput;
export type { PropertyOperationContext };

function getDefaultAttachmentTitle(type: string): string {
  return (
    ATTACHMENT_TYPE_LABELS[type as keyof typeof ATTACHMENT_TYPE_LABELS] ?? type
  );
}

export function buildPropertyUpdatePayload(
  data: UpdatePropertyData,
  userId: string,
): Prisma.PropertyUpdateInput {
  const payload: Prisma.PropertyUpdateInput = {};

  const fieldMappings: [keyof typeof data, keyof Prisma.PropertyUpdateInput][] =
    [
      ["title", "title"],
      ["slug", "slug"],
      ["description", "description"],
      ["type", "type"],
      ["category", "category"],
      ["price", "price"],
      ["currency", "currency"],
      ["priceNegotiable", "priceNegotiable"],
      ["serviceCharge", "serviceCharge"],
      ["depositRequired", "depositRequired"],
      ["paymentTerms", "paymentTerms"],
      ["tenure", "tenure"],
      ["leaseYearsRemaining", "leaseYearsRemaining"],
      ["titleDeedNumber", "titleDeedNumber"],
      ["titleDeedReady", "titleDeedReady"],
      ["bedrooms", "bedrooms"],
      ["bathrooms", "bathrooms"],
      ["parkingSpaces", "parkingSpaces"],
      ["buildingSize", "buildingSize"],
      ["plotSize", "plotSize"],
      ["areaUnit", "areaUnit"],
      ["yearBuilt", "yearBuilt"],
      ["furnishing", "furnishing"],
      ["completionStatus", "completionStatus"],
      ["location", "location"],
      ["address", "address"],
      ["county", "county"],
      ["constituency", "constituency"],
      ["neighbourhood", "neighbourhood"],
      ["latitude", "latitude"],
      ["longitude", "longitude"],
      ["hasBorehole", "hasBorehole"],
      ["hasBackupGenerator", "hasBackupGenerator"],
      ["hasElevator", "hasElevator"],
      ["hasCCTV", "hasCCTV"],
      ["isGatedCommunity", "isGatedCommunity"],
      ["features", "features"],
      ["status", "status"],
      ["featured", "featured"],
      ["floorPlanUrl", "floorPlanUrl"],
      ["videoUrl", "videoUrl"],
      ["virtualTourUrl", "virtualTourUrl"],
    ];

  for (const [source, target] of fieldMappings) {
    if (data[source] !== undefined) {
      (payload as Record<string, unknown>)[target] = data[source];
    }
  }

  if (data.coordinates !== undefined) {
    payload.coordinates = data.coordinates as Prisma.InputJsonValue;
  }

  if (data.nearbyLandmarks !== undefined) {
    payload.nearbyLandmarks = data.nearbyLandmarks as Prisma.InputJsonValue;
  }

  if (data.images) {
    payload.images = {
      deleteMany: {},
      create: data.images.map((img) => ({
        assetId: img.assetId,
        category: (img.category ?? ImageCategory.EXTERIOR) as ImageCategory,
        caption: img.caption,
        isMain: img.isMain,
        sortOrder: img.sortOrder ?? 0,
        tags: img.tags ?? [],
        uploadedBy: { connect: { id: userId } },
      })),
    };
  }

  if (data.attachments !== undefined) {
    payload.attachments = {
      deleteMany: {},
      create: data.attachments.map((attachment) => ({
        title:
          attachment.title?.trim() ||
          getDefaultAttachmentTitle(attachment.type),
        type: attachment.type,
        fileKey: attachment.fileKey,
        fileUrl: attachment.fileUrl,
        mimeType: attachment.mimeType,
        size: attachment.size,
        assetId: attachment.assetId,
        notes: attachment.notes,
        uploadedBy: { connect: { id: userId } },
      })),
    };
  }

  if (data.documents !== undefined) {
    payload.documents = {
      deleteMany: {},
      create: data.documents.map((document) => ({
        type: document.type,
        assetId: document.assetId,
        fileKey: document.fileKey,
        fileUrl: document.fileUrl,
        mimeType: document.mimeType,
        size: document.size,
        notes: document.notes,
        status: document.status ?? DocumentStatus.PENDING,
        rejectionReason: document.rejectionReason,
        issueDate: document.issueDate
          ? new Date(document.issueDate)
          : undefined,
        expiryDate: document.expiryDate
          ? new Date(document.expiryDate)
          : undefined,
        isPrivate: document.isPrivate ?? true,
        uploadedBy: { connect: { id: userId } },
      })),
    };
  }

  if (data.attachments !== undefined || data.documents !== undefined) {
    payload.verificationStatus = VerificationStatus.PENDING;
    payload.submittedAt = new Date();
  }

  return payload;
}
