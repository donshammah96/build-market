import { County } from "@prisma/client";
import type { PropertyOnboardingData, StoreOnboardingData } from "@build/types";
import {
  propertiesService,
  type CreatePropertyInput,
} from "@/app/lib/domains/properties";
import { storesService, type CreateStoreInput } from "@/app/lib/domains/stores";
import {
  type SkipOnboardingData,
  userProfileOnboardingService,
} from "@/app/lib/domains/user-profile";
import {
  CLERK_ONBOARDING_FINALIZATION_RETRY_MESSAGE,
  finalizeClerkOnboardingTransition,
} from "@/app/lib/domains/user-profile/clerk-metadata";
import { err, ok } from "@/app/lib/errors/result";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { dashboardForRole } from "@/lib/links";
import type {
  OnboardingIdempotencyContext,
  OnboardingIntent,
  OnboardingOrchestrationErrorCode,
  OnboardingOrchestrationRequest,
  OnboardingOrchestrationResult,
  OnboardingOrchestrationResultEnvelope,
  OnboardingRole,
  OnboardingWarning,
  ValidatedOnboardingData,
} from "./contracts";

type OnboardingDomainSuccess = {
  userId: string;
  role: string;
  isProfileComplete: boolean;
  redirectTo?: string;
};

function toCreateStoreInput(store: StoreOnboardingData): CreateStoreInput {
  return {
    name: store.name,
    slug: store.slug,
    description: store.description,
    contactPhone: store.contactPhone,
    whatsappNumber: store.whatsappNumber,
    email: store.email,
    website: store.website,
    address: store.address,
    city: store.city,
    county: store.county as County,
    neighborhood: store.neighborhood,
    zipCode: store.zipCode,
    categories: store.categories,
    storeType: store.storeType,
    deliveryRadiusKm: store.deliveryRadiusKm,
    baseDeliveryFee: store.baseDeliveryFee,
    minOrderValue: store.minOrderValue,
    businessRegNo: store.businessRegNo,
    kraPin: store.kraPin,
    acceptsCard: store.acceptsCard,
    acceptsCash: store.acceptsCash,
    images: (store.images ?? []).map(
      (image: NonNullable<StoreOnboardingData["images"]>[number]) => ({
        assetId: image.assetId,
        category: image.category ?? "INTERIOR",
        caption: image.caption,
        isMain: image.isMain ?? false,
        sortOrder: image.sortOrder,
      }),
    ),
  };
}

function toCreatePropertyInput(
  property: PropertyOnboardingData,
): CreatePropertyInput {
  return {
    title: property.title,
    price: property.price,
    currency: property.currency,
    priceNegotiable: property.priceNegotiable,
    type: property.type,
    category: property.category,
    location: property.location,
    county: property.county,
    address: property.address,
    constituency: property.constituency,
    neighbourhood: property.neighbourhood,
    latitude: property.latitude,
    longitude: property.longitude,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    parkingSpaces: property.parkingSpaces,
    buildingSize: property.buildingSize,
    plotSize: property.plotSize,
    areaUnit: property.areaUnit,
    yearBuilt: property.yearBuilt,
    tenure: property.tenure ?? "FREEHOLD",
    titleDeedReady: false,
    furnishing: property.furnishing ?? "UNFURNISHED",
    completionStatus: property.completionStatus ?? "READY_TO_MOVE",
    floorPlanUrl: property.floorPlanUrl,
    videoUrl: property.videoUrl,
    virtualTourUrl: property.virtualTourUrl,
    description: property.description,
    hasBorehole: property.hasBorehole,
    hasBackupGenerator: property.hasBackupGenerator,
    hasElevator: property.hasElevator,
    hasCCTV: property.hasCCTV,
    isGatedCommunity: property.isGatedCommunity,
    features: property.features ?? [],
    featured: false,
    images: [],
    attachments: [],
    documents: [],
  };
}

function toOrchestrationRole(role: string): OnboardingRole {
  return role === "PROFESSIONAL" ? "PROFESSIONAL" : "CLIENT";
}

function toOrchestrationErrorCode(
  error?: string,
): OnboardingOrchestrationErrorCode {
  switch (error) {
    case "conflict":
      return "conflict";
    case "forbidden":
      return "forbidden";
    case "not_found":
      return "not_found";
    case "invalid_input":
      return "invalid_input";
    case "invalid_state":
      return "invalid_state";
    default:
      return "internal";
  }
}

function resolveRedirect(role: OnboardingRole, redirectTo?: string): string {
  if (redirectTo) {
    return redirectTo;
  }

  return dashboardForRole(role);
}

function resolveStatus(
  role: OnboardingRole,
): "ACTIVE" | "PENDING_VERIFICATION" {
  return role === "PROFESSIONAL" ? "PENDING_VERIFICATION" : "ACTIVE";
}

async function markReplayFailed(idempotencyKey: string): Promise<void> {
  await IdempotencyService.fail(idempotencyKey).catch(() => undefined);
}

async function collectSubmitWarnings(params: {
  userId: string;
  role: OnboardingRole;
  data: ValidatedOnboardingData;
}): Promise<OnboardingWarning[]> {
  const { userId, role, data } = params;
  if (role !== "PROFESSIONAL" || data.role !== "professional") {
    return [];
  }

  const warnings: OnboardingWarning[] = [];

  for (const store of data.stores ?? []) {
    const storeResult = await storesService.createStore(
      { userId, role: "PROFESSIONAL" },
      toCreateStoreInput(store),
    );

    if (!storeResult.ok) {
      warnings.push({
        resourceType: "store",
        resourceName: store.name,
        reason: storeResult.message ?? "Store creation failed",
      });
    }
  }

  for (const property of data.properties ?? []) {
    const propertyResult = await propertiesService.createProperty(
      { userId, role: "PROFESSIONAL" },
      toCreatePropertyInput(property),
    );

    if (!propertyResult.ok) {
      warnings.push({
        resourceType: "property",
        resourceName: property.title || "Untitled",
        reason: propertyResult.message ?? "Property creation failed",
      });
    }
  }

  return warnings;
}

async function executeDomainIntent(params: {
  actor: OnboardingOrchestrationRequest["actor"];
  clerkUser: OnboardingOrchestrationRequest["clerkUser"];
  intent: OnboardingIntent;
}): Promise<
  | {
      ok: true;
      data: OnboardingDomainSuccess;
      warnings: OnboardingWarning[];
    }
  | {
      ok: false;
      error: OnboardingOrchestrationErrorCode;
      message?: string;
      status?: number;
    }
> {
  const { actor, clerkUser, intent } = params;

  if (intent.kind === "submit") {
    const submitResult = await userProfileOnboardingService.completeOnboarding({
      actor: {
        clerkId: actor.clerkId,
        correlationId: actor.correlationId,
        role: intent.role,
      },
      clerkUser,
      data: intent.data,
    });

    if (!submitResult.ok) {
      return {
        ok: false,
        error: toOrchestrationErrorCode(submitResult.error),
        message: submitResult.message,
        status: submitResult.status,
      };
    }

    const role = toOrchestrationRole(submitResult.data.role);
    const warnings = await collectSubmitWarnings({
      userId: submitResult.data.userId,
      role,
      data: intent.data,
    });

    return {
      ok: true,
      data: submitResult.data,
      warnings,
    };
  }

  const skipResult =
    intent.kind === "skip_client"
      ? await userProfileOnboardingService.skipClientOnboarding({
          actor: {
            clerkId: actor.clerkId,
            correlationId: actor.correlationId,
            role: "CLIENT",
          },
          clerkUser,
        })
      : await userProfileOnboardingService.skipProfessionalOnboarding({
          actor: {
            clerkId: actor.clerkId,
            correlationId: actor.correlationId,
            role: "PROFESSIONAL",
          },
          clerkUser,
        });

  if (!skipResult.ok) {
    return {
      ok: false,
      error: toOrchestrationErrorCode(skipResult.error),
      message: skipResult.message,
      status: skipResult.status,
    };
  }

  return {
    ok: true,
    data: skipResult.data as SkipOnboardingData,
    warnings: [],
  };
}

function toOrchestrationResult(params: {
  data: OnboardingDomainSuccess;
  warnings: OnboardingWarning[];
}): OnboardingOrchestrationResult {
  const role = toOrchestrationRole(params.data.role);
  const redirectTo = resolveRedirect(role, params.data.redirectTo);
  const status = resolveStatus(role);

  return {
    userId: params.data.userId,
    role,
    isProfileComplete: params.data.isProfileComplete,
    status,
    redirectTo,
    ...(params.warnings.length > 0 ? { warnings: params.warnings } : {}),
  };
}

function isValidIdempotencyContext(
  actorClerkId: string,
  idempotency: OnboardingIdempotencyContext,
): boolean {
  return (
    idempotency.scope === "onboarding" && idempotency.actorId === actorClerkId
  );
}

export async function executeOnboardingOrchestration(
  actor: OnboardingOrchestrationRequest["actor"],
  clerkUser: OnboardingOrchestrationRequest["clerkUser"],
  intent: OnboardingOrchestrationRequest["intent"],
  idempotency: OnboardingOrchestrationRequest["idempotency"],
): Promise<OnboardingOrchestrationResultEnvelope> {
  if (!isValidIdempotencyContext(actor.clerkId, idempotency)) {
    await markReplayFailed(idempotency.key);
    return err({
      error: "invalid_state",
      message: "Invalid idempotency context",
      status: 400,
    });
  }

  const domainResult = await executeDomainIntent({ actor, clerkUser, intent });

  if (!domainResult.ok) {
    await markReplayFailed(idempotency.key);
    return err({
      error: domainResult.error,
      message: domainResult.message,
      status: domainResult.status,
    });
  }

  const result = toOrchestrationResult({
    data: domainResult.data,
    warnings: domainResult.warnings,
  });

  try {
    await finalizeClerkOnboardingTransition({
      clerkId: actor.clerkId,
      metadata: {
        role: result.role,
        isOnboarded: true,
        status: result.status,
      },
      context: {
        correlationId: actor.correlationId,
        operation: `onboarding_orchestration_${intent.kind}`,
      },
      onFailure: () => markReplayFailed(idempotency.key),
    });
  } catch {
    await markReplayFailed(idempotency.key);
    return err({
      error: "clerk_sync_failed",
      message: CLERK_ONBOARDING_FINALIZATION_RETRY_MESSAGE,
      status: 503,
    });
  }

  try {
    await IdempotencyService.complete(idempotency.key, result);
  } catch {
    // Preserve success response semantics for post-success replay persistence failures.
    await markReplayFailed(idempotency.key);
  }

  return ok(result);
}
