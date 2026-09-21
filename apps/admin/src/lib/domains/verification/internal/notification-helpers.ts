import { prisma } from "@build/db";
import { StructuredLogger } from "@build/resilience";
import type { EntityType } from "./types";

const logger = new StructuredLogger("verification-notification-helpers");

/**
 * Get entity name for notification context
 */
export async function getEntityName(
  entityType: EntityType,
  entityId: string,
): Promise<string> {
  try {
    switch (entityType) {
      case "professional": {
        const professional = await prisma.professionalProfile.findUnique({
          where: { userId: entityId },
          select: { companyName: true },
        });
        return professional?.companyName || "Professional Profile";
      }
      case "store": {
        const store = await prisma.store.findUnique({
          where: { id: entityId },
          select: { name: true },
        });
        return store?.name || "Store";
      }
      case "property": {
        const property = await prisma.property.findUnique({
          where: { id: entityId },
          select: { title: true },
        });
        return property?.title || "Property";
      }
      case "certificate": {
        // Certificates are documents, fetch certificate name
        const certificate = await prisma.professionalDocument.findUnique({
          where: { id: entityId },
          select: { title: true },
        });
        return certificate?.title || "Certificate";
      }
      case "license": {
        const license = await prisma.professionalLicense.findUnique({
          where: { id: entityId },
          select: { authority: true, licenseNumber: true },
        });
        return license
          ? `${license.authority} License (${license.licenseNumber})`
          : "Professional License";
      }
      default:
        return "Your submission";
    }
  } catch (error) {
    logger.warn("Failed to fetch entity name for notification", {
      error: error instanceof Error ? error.message : String(error),
      entityType,
      entityId,
    });
    return "Your submission";
  }
}
