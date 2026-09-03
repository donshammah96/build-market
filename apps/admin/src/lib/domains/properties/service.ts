import { err, ok, type Result } from "@/lib/result";
import {
  AdminCapability,
  requireAdminCapability,
} from "@/lib/security/authorization-policy";
import type {
  PropertiesActor,
  PropertiesDomainError,
  PropertyDetailResult,
  PropertyFilterInput,
  PropertyListQuery,
  PropertyPageResult,
  PropertyStatsResult,
  PropertyStatusValue,
  PropertyUpdateInput,
} from "./contracts";
import { propertiesRepository } from "./repository";
import { requireLiveAdminMvpCapability } from "@/lib/capabilities/mvp-capabilities";

// ============================================================================
// Capability helpers
// ============================================================================

function requireViewContent(
  actor: PropertiesActor,
): Result<true, PropertiesDomainError> {
  const policy = requireAdminCapability(actor, AdminCapability.VIEW_CONTENT);
  if (!policy.ok) {
    return err({
      code: "PROPERTIES_POLICY_DENIED",
      message: "Admin capability denied",
    });
  }
  return ok(true);
}

function requireManageContent(
  actor: PropertiesActor,
): Result<true, PropertiesDomainError> {
  const policy = requireAdminCapability(actor, AdminCapability.MANAGE_CONTENT);
  if (!policy.ok) {
    return err({
      code: "PROPERTIES_POLICY_DENIED",
      message: "Admin capability denied",
    });
  }
  return ok(true);
}

function requireLivePropertiesCapability(): Result<true, PropertiesDomainError> {
  const capability = requireLiveAdminMvpCapability("property_transactions");
  return capability.ok
    ? ok(true)
    : err({
        code: "PROPERTIES_POLICY_DENIED",
        message: "Property transactions are dormant for this MVP release",
      });
}

function requireVerifyContent(
  actor: PropertiesActor,
): Result<true, PropertiesDomainError> {
  const policy = requireAdminCapability(
    actor,
    AdminCapability.MANAGE_VERIFICATION,
  );
  if (!policy.ok) {
    return err({
      code: "PROPERTIES_POLICY_DENIED",
      message: "Admin capability denied",
    });
  }
  return ok(true);
}

// ============================================================================
// Query builder
// ============================================================================

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 10;

export function buildPropertyListQuery(
  input: PropertyFilterInput = {},
): Result<PropertyListQuery, PropertiesDomainError> {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, input.limit ?? DEFAULT_LIMIT));

  return ok({
    page,
    limit,
    skip: (page - 1) * limit,
    search: input.search?.trim() || undefined,
    type: input.type,
    category: input.category,
    verificationStatus: input.verificationStatus,
    verified: input.verified,
    featured: input.featured,
    county: input.county,
    status: input.status,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
    sortBy: input.sortBy ?? "createdAt",
    sortOrder: input.sortOrder ?? "desc",
  } as PropertyListQuery);
}

// ============================================================================
// Service methods
// ============================================================================

export async function listPropertyPage(
  actor: PropertiesActor,
  input: PropertyFilterInput = {},
): Promise<Result<PropertyPageResult, PropertiesDomainError>> {
  const cap = requireViewContent(actor);
  if (!cap.ok) return cap;

  const queryResult = buildPropertyListQuery(input);
  if (!queryResult.ok) return queryResult;

  const query = queryResult.data;
  const [properties, total] = await Promise.all([
    propertiesRepository.listProperties(query),
    propertiesRepository.countProperties(query),
  ]);

  return ok({
    properties,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    },
    filters: query,
  });
}

export async function getPropertyDetail(
  actor: PropertiesActor,
  propertyId: string,
): Promise<Result<PropertyDetailResult, PropertiesDomainError>> {
  const cap = requireViewContent(actor);
  if (!cap.ok) return cap;

  const property = await propertiesRepository.findPropertyById(propertyId);
  if (!property)
    return err({ code: "PROPERTIES_NOT_FOUND", message: "Property not found" });

  return ok(property);
}

export async function getPropertyStats(
  actor: PropertiesActor,
): Promise<Result<PropertyStatsResult, PropertiesDomainError>> {
  const cap = requireViewContent(actor);
  if (!cap.ok) return cap;

  const stats = await propertiesRepository.getPropertyStats();
  return ok(stats);
}

export async function updateProperty(
  actor: PropertiesActor,
  propertyId: string,
  data: PropertyUpdateInput,
): Promise<
  Result<
    {
      updated: boolean;
      property: {
        id: string;
        title: string;
        featured: boolean;
        status: string;
        updatedAt: Date;
      };
    },
    PropertiesDomainError
  >
> {
  const cap = requireManageContent(actor);
  if (!cap.ok) return cap;
  const capability = requireLivePropertiesCapability();
  if (!capability.ok) return capability;

  const property = await propertiesRepository.updatePropertyById(
    propertyId,
    data,
  );
  return ok({ updated: true, property });
}

export async function togglePropertyFeatured(
  actor: PropertiesActor,
  propertyId: string,
): Promise<
  Result<
    {
      toggled: boolean;
      property: { id: string; title: string; featured: boolean };
    },
    PropertiesDomainError
  >
> {
  const cap = requireManageContent(actor);
  if (!cap.ok) return cap;
  const capability = requireLivePropertiesCapability();
  if (!capability.ok) return capability;

  const current =
    await propertiesRepository.getPropertyFeaturedStatus(propertyId);
  if (!current)
    return err({ code: "PROPERTIES_NOT_FOUND", message: "Property not found" });

  const property = await propertiesRepository.updatePropertyFeatured(
    propertyId,
    !current.featured,
  );
  return ok({ toggled: true, property });
}

export async function verifyProperty(
  actor: PropertiesActor,
  propertyId: string,
  notes?: string,
): Promise<
  Result<
    {
      verified: boolean;
      property: { id: string; title: string; verificationStatus: string };
      notes: string | null;
    },
    PropertiesDomainError
  >
> {
  const cap = requireVerifyContent(actor);
  if (!cap.ok) return cap;
  const capability = requireLivePropertiesCapability();
  if (!capability.ok) return capability;

  const property = await propertiesRepository.updatePropertyVerification(
    propertyId,
    {
      verificationStatus: "VERIFIED",
      verifiedAt: new Date(),
      rejectionReason: null,
    },
  );

  return ok({ verified: true, property, notes: notes ?? null });
}

export async function rejectProperty(
  actor: PropertiesActor,
  propertyId: string,
  reason: string,
): Promise<
  Result<
    {
      rejected: boolean;
      property: { id: string; title: string; verificationStatus: string };
    },
    PropertiesDomainError
  >
> {
  const cap = requireVerifyContent(actor);
  if (!cap.ok) return cap;
  const capability = requireLivePropertiesCapability();
  if (!capability.ok) return capability;

  if (!reason.trim()) {
    return err({
      code: "PROPERTIES_INVALID_FILTER",
      message: "Rejection reason is required",
    });
  }

  const property = await propertiesRepository.updatePropertyVerification(
    propertyId,
    {
      verificationStatus: "REJECTED",
      verifiedAt: null,
      rejectionReason: reason,
    },
  );

  return ok({ rejected: true, property });
}

export async function changePropertyStatus(
  actor: PropertiesActor,
  propertyId: string,
  status: PropertyStatusValue,
): Promise<
  Result<
    {
      updated: boolean;
      property: { id: string; title: string; status: string };
    },
    PropertiesDomainError
  >
> {
  const cap = requireVerifyContent(actor);
  if (!cap.ok) return cap;

  const property = await propertiesRepository.updatePropertyStatus(
    propertyId,
    status,
  );
  return ok({ updated: true, property });
}

export async function deleteProperty(
  actor: PropertiesActor,
  propertyId: string,
): Promise<
  Result<
    { deleted: boolean; propertyId: string; propertyTitle: string },
    PropertiesDomainError
  >
> {
  const cap = requireManageContent(actor);
  if (!cap.ok) return cap;

  const property = await propertiesRepository.deletePropertyById(propertyId);
  return ok({
    deleted: true,
    propertyId: property.id,
    propertyTitle: property.title,
  });
}

export const propertiesService = {
  buildPropertyListQuery,
  listPropertyPage,
  getPropertyDetail,
  getPropertyStats,
  updateProperty,
  togglePropertyFeatured,
  verifyProperty,
  rejectProperty,
  changePropertyStatus,
  deleteProperty,
};
