"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { VerificationStatus } from "@build/db";
import { safeAction, safeVerificationAction } from "./shared";
import { AdminOperationName } from "@/lib/observability/operation-names";
import { propertiesService } from "@/lib/domains/properties/service";
import type {
  PropertyStatusValue,
  PropertyFilterInput as DomainPropertyFilterInput,
  PropertyUpdateInput as DomainPropertyUpdateInput,
} from "@/lib/domains/properties/contracts";
import { omitUndefined } from "@/lib/utils";

const PropertyFilterSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(10),
  search: z.string().optional(),
  type: z.enum(["SALE", "RENT", "LEASE"]).optional(),
  category: z
    .enum(["RESIDENTIAL", "COMMERCIAL", "LAND", "INDUSTRIAL"])
    .optional(),
  verificationStatus: z
    .enum([
      VerificationStatus.PENDING,
      VerificationStatus.VERIFIED,
      VerificationStatus.REJECTED,
    ])
    .optional(),
  verified: z.boolean().optional(),
  featured: z.boolean().optional(),
  county: z.string().optional(),
  status: z.enum(["AVAILABLE", "SOLD", "RENTED", "UNDER_OFFER"]).optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  sortBy: z
    .enum(["createdAt", "price", "title", "updatedAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

const UpdatePropertySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  price: z.number().positive().optional(),
  type: z.enum(["SALE", "RENT", "LEASE"]).optional(),
  category: z
    .enum(["RESIDENTIAL", "COMMERCIAL", "LAND", "INDUSTRIAL"])
    .optional(),
  status: z.enum(["AVAILABLE", "SOLD", "RENTED", "UNDER_OFFER"]).optional(),
  location: z.string().optional(),
  address: z.string().optional(),
  county: z.string().optional(),
  featured: z.boolean().optional(),
});

type PropertyFilterInput = z.infer<typeof PropertyFilterSchema>;
type UpdatePropertyInput = z.infer<typeof UpdatePropertySchema>;

// ============================================================================
// Actions
// ============================================================================

/**
 * Fetches a paginated list of properties with filtering and sorting.
 * Requires VIEW_CONTENT capability.
 */
export async function getProperties(
  filters: Partial<PropertyFilterInput> = {},
) {
  return safeAction(AdminOperationName.LIST_PROPERTIES, async ({ actor }) => {
    const parsed = PropertyFilterSchema.safeParse(filters);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid filter");
    }

    const result = await propertiesService.listPropertyPage(
      actor,
      omitUndefined(parsed.data) as unknown as DomainPropertyFilterInput,
    );
    if (!result.ok) throw new Error(result.message ?? result.code);
    return result.data;
  });
}

/**
 * Fetches complete property details.
 * Requires VIEW_CONTENT capability.
 */
export async function getPropertyDetails(propertyId: string) {
  return safeAction(
    AdminOperationName.GET_PROPERTY_DETAIL,
    async ({ actor }) => {
      const result = await propertiesService.getPropertyDetail(
        actor,
        propertyId,
      );
      if (!result.ok) throw new Error(result.message ?? result.code);
      return result.data;
    },
  );
}

/**
 * Gets property statistics for the dashboard.
 * Requires VIEW_CONTENT capability.
 */
export async function getPropertyStats() {
  return safeAction(
    AdminOperationName.GET_PROPERTY_STATS,
    async ({ actor }) => {
      const result = await propertiesService.getPropertyStats(actor);
      if (!result.ok) throw new Error(result.message ?? result.code);
      return result.data;
    },
  );
}

/**
 * Updates property information.
 * Requires MANAGE_CONTENT capability.
 */
export async function updateProperty(
  propertyId: string,
  data: UpdatePropertyInput,
) {
  return safeAction(AdminOperationName.UPDATE_PROPERTY, async ({ actor }) => {
    const parsed = UpdatePropertySchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Invalid update data");
    }

    const result = await propertiesService.updateProperty(
      actor,
      propertyId,
      omitUndefined(parsed.data) as unknown as DomainPropertyUpdateInput,
    );
    if (!result.ok) throw new Error(result.message ?? result.code);

    revalidatePath("/properties");
    revalidatePath(`/properties/${propertyId}`);

    return result.data;
  });
}

/**
 * Toggles property featured status.
 * Requires MANAGE_CONTENT capability (uses safeVerificationAction for freshness).
 */
export async function togglePropertyFeatured(propertyId: string) {
  return safeVerificationAction(
    AdminOperationName.TOGGLE_PROPERTY_FEATURED,
    async ({ actor }) => {
      const result = await propertiesService.togglePropertyFeatured(
        actor,
        propertyId,
      );
      if (!result.ok) throw new Error(result.message ?? result.code);

      revalidatePath("/properties");
      revalidatePath(`/properties/${propertyId}`);

      return result.data;
    },
    {
      auditLog: {
        operation: "TOGGLE_PROPERTY_FEATURED",
        resourceType: "property",
        getTargetId: () => propertyId,
        getDetails: ({ data }) => {
          const result = data as
            | { property?: { featured?: boolean } }
            | undefined;
          return { propertyId, featured: result?.property?.featured };
        },
      },
    },
  );
}

/**
 * Verifies a property.
 * Requires MANAGE_VERIFICATION capability. Enforces 300s session freshness.
 */
export async function verifyProperty(propertyId: string, notes?: string) {
  return safeVerificationAction(
    AdminOperationName.VERIFY_PROPERTY,
    async ({ actor }) => {
      const result = await propertiesService.verifyProperty(
        actor,
        propertyId,
        notes,
      );
      if (!result.ok) throw new Error(result.message ?? result.code);

      revalidatePath("/properties");
      revalidatePath("/verifications");

      return result.data;
    },
    {
      auditLog: {
        operation: "VERIFY_PROPERTY",
        resourceType: "property",
        getTargetId: () => propertyId,
        getDetails: ({ data }) => {
          const result = data as { notes?: string | null } | undefined;
          return { propertyId, newStatus: "VERIFIED", notes: result?.notes };
        },
      },
    },
  );
}

/**
 * Rejects property verification.
 * Requires MANAGE_VERIFICATION capability. Enforces 300s session freshness.
 */
export async function rejectProperty(propertyId: string, reason: string) {
  return safeVerificationAction(
    AdminOperationName.REJECT_PROPERTY,
    async ({ actor }) => {
      const result = await propertiesService.rejectProperty(
        actor,
        propertyId,
        reason,
      );
      if (!result.ok) throw new Error(result.message ?? result.code);

      revalidatePath("/properties");
      revalidatePath("/verifications");

      return result.data;
    },
    {
      auditLog: {
        operation: "REJECT_PROPERTY",
        resourceType: "property",
        getTargetId: () => propertyId,
        getDetails: () => ({ propertyId, newStatus: "REJECTED" }),
        getReason: () => reason,
      },
    },
  );
}

/**
 * Changes property listing status (AVAILABLE/SOLD/RENTED/UNDER_OFFER).
 * Requires MANAGE_VERIFICATION capability. Enforces 300s session freshness.
 */
export async function changePropertyStatus(
  propertyId: string,
  status: PropertyStatusValue,
) {
  return safeVerificationAction(
    AdminOperationName.CHANGE_PROPERTY_STATUS,
    async ({ actor }) => {
      const result = await propertiesService.changePropertyStatus(
        actor,
        propertyId,
        status,
      );
      if (!result.ok) throw new Error(result.message ?? result.code);

      revalidatePath("/properties");
      revalidatePath(`/properties/${propertyId}`);

      return result.data;
    },
    {
      auditLog: {
        operation: "CHANGE_PROPERTY_STATUS",
        resourceType: "property",
        getTargetId: () => propertyId,
        getDetails: () => ({ propertyId, newStatus: status }),
      },
    },
  );
}

/**
 * Deletes a property.
 * Requires MANAGE_CONTENT capability.
 */
export async function deleteProperty(propertyId: string) {
  return safeAction(
    AdminOperationName.DELETE_PROPERTY,
    async ({ actor }) => {
      const result = await propertiesService.deleteProperty(actor, propertyId);
      if (!result.ok) throw new Error(result.message ?? result.code);

      revalidatePath("/properties");

      return result.data;
    },
    {
      auditLog: {
        operation: "DELETE_PROPERTY",
        resourceType: "property",
        getTargetId: () => propertyId,
        getDetails: ({ data }) => {
          const result = data as { propertyTitle?: string } | undefined;
          return { propertyId, propertyTitle: result?.propertyTitle };
        },
      },
    },
  );
}
