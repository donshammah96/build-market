"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import {
  OnboardingSchema,
  type PropertyOnboardingData,
  type StoreOnboardingData,
} from "@build/types";
import { County } from "@prisma/client";
import {
  createActionFailure,
  secureAction,
  throwActionFailure,
  type ActionResult,
} from "@/app/lib/actions/secure-action";
import { getResilientExecutor } from "@/app/lib/api/resilient-api";
import {
  userProfileOnboardingService,
  type ClerkUserProfile,
} from "@/app/lib/domains/user-profile";
import { storesService, type CreateStoreInput } from "@/app/lib/domains/stores";
import {
  propertiesService,
  type CreatePropertyInput,
} from "@/app/lib/domains/properties";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import { updateClerkOnboardingMetadata } from "@/app/lib/domains/user-profile/clerk-metadata";
import { normalizeRole } from "@/app/lib/security/roles";

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
    images: (store.images ?? []).map((image) => ({
      assetId: image.assetId,
      category: image.category ?? "INTERIOR",
      caption: image.caption,
      isMain: image.isMain ?? false,
      sortOrder: image.sortOrder,
    })),
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

async function getRequiredClerkContext() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    throwActionFailure(
      createActionFailure("unauthorized", "Unauthorized", 401),
    );
  }

  const clerkUser = (await currentUser()) as ClerkUserProfile | null;
  if (!clerkUser) {
    throwActionFailure(
      createActionFailure(
        "internal",
        "Could not retrieve user data from Clerk",
        500,
      ),
    );
  }

  return { clerkId, clerkUser };
}

export async function submitOnboarding(
  data: unknown,
): Promise<ActionResult<unknown>> {
  return secureAction({
    requireActor: false,
    input: data,
    schema: OnboardingSchema,
    handler: async ({ input }) => {
      const { clerkId, clerkUser } = await getRequiredClerkContext();

      const normalizedInputRole = normalizeRole(input.role);
      if (!normalizedInputRole) {
        throwActionFailure(
          createActionFailure("invalid_input", "Invalid onboarding role", 400),
        );
      }

      const idempotencyKey = IdempotencyService.generateKey(clerkId, "POST", {
        domain: "onboarding",
        role: normalizedInputRole,
      });

      const check = await IdempotencyService.checkOrCreate(
        idempotencyKey,
        "onboarding",
        clerkId,
        "POST",
      );

      if (check?.status === "completed") {
        return check.response;
      }

      if (check?.status === "pending") {
        throwActionFailure(
          createActionFailure("conflict", "Request is being processed", 409),
        );
      }

      const executor = getResilientExecutor();
      const result = await executor.execute(
        async () =>
          userProfileOnboardingService.completeOnboarding({
            actor: { clerkId },
            clerkUser,
            data: input,
          }),
        { operationName: "complete_onboarding_action" },
      );

      if (!result.success || !result.data) {
        await IdempotencyService.fail(idempotencyKey);
        throwActionFailure(
          createActionFailure(
            "internal",
            result.error?.message ?? "Onboarding failed",
            500,
          ),
        );
      }

      if (!result.data.ok) {
        await IdempotencyService.fail(idempotencyKey);
        throwActionFailure(
          createActionFailure(
            result.data.error === "conflict"
              ? "conflict"
              : result.data.error === "forbidden"
                ? "forbidden"
                : result.data.error === "not_found"
                  ? "not_found"
                  : result.data.error === "invalid_input"
                    ? "invalid_input"
                    : result.data.error === "invalid_state"
                      ? "invalid_state"
                      : "internal",
            result.data.message ?? "Onboarding failed",
            result.data.status ?? 500,
          ),
        );
      }

      const warnings: string[] = [];
      if (input.role === "professional") {
        for (const store of input.stores ?? []) {
          const storeResult = await storesService.createStore(
            { userId: result.data.data.userId, role: "PROFESSIONAL" },
            toCreateStoreInput(store),
          );
          if (!storeResult.ok) {
            warnings.push(
              `Profile created successfully, but we couldn't create your store "${store.name}". Please visit your dashboard to try again.`,
            );
          }
        }

        for (const property of input.properties ?? []) {
          const propertyResult = await propertiesService.createProperty(
            { userId: result.data.data.userId, role: "PROFESSIONAL" },
            toCreatePropertyInput(property),
          );
          if (!propertyResult.ok) {
            warnings.push(
              `Profile created successfully, but we couldn't create your property "${property.title || "Untitled"}". Please visit your dashboard to try again.`,
            );
          }
        }
      }

      await updateClerkOnboardingMetadata(
        clerkId,
        {
          role: result.data.data.role,
          isOnboarded: true,
          status:
            result.data.data.role === "PROFESSIONAL"
              ? "PENDING_VERIFICATION"
              : "ACTIVE",
        },
        { operation: "submit_onboarding" },
      );

      const response = {
        ...result.data.data,
        ...(warnings.length > 0 ? { warnings } : {}),
      };
      await IdempotencyService.complete(idempotencyKey, response);
      return response;
    },
  });
}

export async function skipOnboarding(): Promise<ActionResult<unknown>> {
  return secureAction({
    requireActor: false,
    handler: async () => {
      const { clerkId, clerkUser } = await getRequiredClerkContext();
      const executor = getResilientExecutor();
      const result = await executor.execute(
        async () =>
          userProfileOnboardingService.skipClientOnboarding({
            actor: { clerkId },
            clerkUser,
          }),
        { operationName: "skip_client_onboarding_action" },
      );

      if (!result.success || !result.data) {
        throwActionFailure(
          createActionFailure("internal", "Failed to skip", 500),
        );
      }

      if (!result.data.ok) {
        throwActionFailure(
          createActionFailure(
            result.data.error === "conflict"
              ? "conflict"
              : result.data.error === "forbidden"
                ? "forbidden"
                : result.data.error === "not_found"
                  ? "not_found"
                  : result.data.error === "invalid_state"
                    ? "invalid_state"
                    : "internal",
            result.data.message ?? "Failed to skip",
            result.data.status ?? 500,
          ),
        );
      }

      await updateClerkOnboardingMetadata(
        clerkId,
        { role: "CLIENT", isOnboarded: true, status: "ACTIVE" },
        { operation: "skip_client_onboarding" },
      );

      return result.data.data;
    },
  });
}

export async function skipProfessionalOnboarding(): Promise<
  ActionResult<unknown>
> {
  return secureAction({
    requireActor: false,
    handler: async () => {
      const { clerkId, clerkUser } = await getRequiredClerkContext();
      const executor = getResilientExecutor();
      const result = await executor.execute(
        async () =>
          userProfileOnboardingService.skipProfessionalOnboarding({
            actor: { clerkId },
            clerkUser,
          }),
        { operationName: "skip_professional_onboarding_action" },
      );

      if (!result.success || !result.data) {
        throwActionFailure(
          createActionFailure("internal", "Failed to skip", 500),
        );
      }

      if (!result.data.ok) {
        throwActionFailure(
          createActionFailure(
            result.data.error === "conflict"
              ? "conflict"
              : result.data.error === "forbidden"
                ? "forbidden"
                : result.data.error === "not_found"
                  ? "not_found"
                  : result.data.error === "invalid_state"
                    ? "invalid_state"
                    : "internal",
            result.data.message ?? "Failed to skip",
            result.data.status ?? 500,
          ),
        );
      }

      await updateClerkOnboardingMetadata(
        clerkId,
        {
          role: "PROFESSIONAL",
          isOnboarded: true,
          status: "PENDING_VERIFICATION",
        },
        { operation: "skip_professional_onboarding" },
      );

      return result.data.data;
    },
  });
}
