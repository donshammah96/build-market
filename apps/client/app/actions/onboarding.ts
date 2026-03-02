"use server";

import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@build/db";
import {
  County,
  Profession,
  LicenseAuthority,
  StoreCategory,
} from "@prisma/client";
import { OnboardingSchema } from "@build/types";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";
import {
  getResilientExecutor,
  getClientLogger,
} from "@/app/lib/api/resilient-api";
import { createStore } from "@/lib/services/stores";
import { CreateStoreInput } from "@/lib/services/stores";
import {
  createProperty,
  type CreatePropertyInput,
} from "@/lib/services/properties";

const logger = getClientLogger();

type ActionResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
};

/**
 * Sync Clerk user data to local database.
 * Handles both new user creation and updates to existing users.
 */
async function syncUserFromClerk(
  clerkId: string,
  role: "CLIENT" | "PROFESSIONAL",
  tx: any, // Prisma transaction client
) {
  const clerkUserData = await currentUser();
  if (!clerkUserData) throw new Error("User not found in Clerk");

  const email = clerkUserData.emailAddresses[0]?.emailAddress || "";
  const firstName = clerkUserData.firstName || null;
  const lastName = clerkUserData.lastName || null;
  const phone = clerkUserData.phoneNumbers?.[0]?.phoneNumber || null;

  return await tx.user.upsert({
    where: { clerkId },
    create: {
      clerkId,
      email,
      firstName,
      lastName,
      phone,
      role,
      isProfileComplete: true, // We assume if we are calling this, we are completing the profile
    },
    update: {
      role,
      isProfileComplete: true,
      // Sync latest details
      email,
      firstName,
      lastName,
      phone,
    },
  });
}

export async function submitOnboarding(data: unknown): Promise<ActionResponse> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { success: false, error: "Unauthorized" };

  const validation = OnboardingSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: "Validation failed" };
  }

  const validatedData = validation.data;
  const { role } = validatedData;
  const userRole = role.toUpperCase() as "CLIENT" | "PROFESSIONAL";

  // Idempotency
  const idempotencyKey = IdempotencyService.generateKey(clerkId, "POST", {
    domain: "onboarding",
    role: userRole,
    // Include hash of store data if present to distinguish attempts
  });

  const check = await IdempotencyService.checkOrCreate(
    idempotencyKey,
    "onboarding",
    clerkId,
    "POST",
  );

  if (check && check.status === "completed") {
    return { success: true, data: check.response };
  }
  if (check && check.status === "pending") {
    return { success: false, error: "Request is being processed" };
  }

  const executor = getResilientExecutor();
  const result = await executor.execute(async () => {
    // 1. Create/Update User & Profile
    const dbUser = await prisma.$transaction(async (tx) => {
      const user = await syncUserFromClerk(clerkId, userRole, tx);

      // Create Profile
      if (role === "client") {
        const clientData = validatedData as Extract<
          typeof validatedData,
          { role: "client" }
        >;
        await tx.clientProfile.upsert({
          where: { userId: user.id },
          update: {
            county: clientData.county as County,
            city: clientData.city || null,
            address: clientData.address || clientData.projectLocation || null,
            zipCode: clientData.zipCode || null,
            budgetRangeMin: clientData.budgetRangeMin ?? null, // TODO: Parse estimatedBudget string if budgetRangeMin not set
            budgetRangeMax: clientData.budgetRangeMax ?? null,
            interests: clientData.interests || [],
            type: (clientData.type as any) || "HOMEOWNER",
            preferences: {
              ...((clientData as any).preferences || {}),
              projectType: clientData.projectType,
              projectLocation: clientData.projectLocation,
              estimatedBudget: clientData.estimatedBudget,
              description: clientData.description,
            },
          },
          create: {
            userId: user.id,
            county: clientData.county as County,
            city: clientData.city || null,
            address: clientData.address || clientData.projectLocation || null,
            zipCode: clientData.zipCode || null,
            budgetRangeMin: clientData.budgetRangeMin ?? null,
            budgetRangeMax: clientData.budgetRangeMax ?? null,
            interests: clientData.interests || [],
            type: (clientData.type as any) || "HOMEOWNER",
            preferences: {
              ...((clientData as any).preferences || {}),
              projectType: clientData.projectType,
              projectLocation: clientData.projectLocation,
              estimatedBudget: clientData.estimatedBudget,
              description: clientData.description,
            },
          },
        });
      } else if (role === "professional") {
        const proData = validatedData as Extract<
          typeof validatedData,
          { role: "professional" }
        >;
        const profession =
          "profession" in proData
            ? (proData.profession as Profession)
            : ("OTHER" as Profession);
        const companyName =
          "companyName" in proData ? (proData.companyName as string) : "";

        const professionalProfile = await tx.professionalProfile.upsert({
          where: { userId: user.id },
          update: {
            profession,
            companyName,
            yearsExperience:
              "yearsExperience" in proData
                ? ((proData.yearsExperience as number | undefined) ?? null)
                : null,
            website:
              "website" in proData ? (proData.website as string) || null : null,
            bio: "bio" in proData ? (proData.bio as string) || null : null,
            portfolioUrl:
              "portfolioUrl" in proData
                ? (proData.portfolioUrl as string) || null
                : null,
            county:
              "county" in proData ? (proData.county as County) : undefined,
            city: "city" in proData ? (proData.city as string) || null : null,
            serviceRadiusKm:
              "serviceRadiusKm" in proData
                ? ((proData.serviceRadiusKm as number | undefined) ?? null)
                : null,
            verified: false,
          },
          create: {
            userId: user.id,
            profession,
            companyName: companyName || "",
            yearsExperience:
              "yearsExperience" in proData
                ? ((proData.yearsExperience as number | undefined) ?? null)
                : null,
            website:
              "website" in proData ? (proData.website as string) || null : null,
            bio: "bio" in proData ? (proData.bio as string) || null : null,
            portfolioUrl:
              "portfolioUrl" in proData
                ? (proData.portfolioUrl as string) || null
                : null,
            county:
              "county" in proData ? (proData.county as County) : undefined,
            city: "city" in proData ? (proData.city as string) || null : null,
            serviceRadiusKm:
              "serviceRadiusKm" in proData
                ? ((proData.serviceRadiusKm as number | undefined) ?? null)
                : null,
            verified: false,
          },
        });

        // License
        if ("license" in proData && proData.license) {
          const license = proData.license as {
            authority?: string;
            licenseNumber?: string;
          };
          if (license.authority && license.licenseNumber) {
            await tx.professionalLicense.upsert({
              where: {
                professionalId_authority_licenseNumber: {
                  professionalId: user.id,
                  authority: license.authority as LicenseAuthority,
                  licenseNumber: license.licenseNumber,
                },
              },
              update: { validFrom: new Date(), status: "PENDING" },
              create: {
                professionalId: user.id,
                authority: license.authority as LicenseAuthority,
                licenseNumber: license.licenseNumber,
                validFrom: new Date(),
                status: "PENDING",
              },
            });
          }
        }

        // Documents
        if ("certificatesUrls" in proData) {
          const certUrls = (proData.certificatesUrls as string[]) || [];
          for (let i = 0; i < certUrls.length; i++) {
            await tx.professionalDocument.create({
              data: {
                professionalId: professionalProfile.userId,
                category: "EDUCATION_CERT",
                title: `Professional Certificate ${i + 1}`,
                issuer: "Self-reported",
                fileUrl: certUrls[i],
                status: "PENDING",
              },
            });
          }
        }

        if ("idDocumentsUrls" in proData) {
          const idUrls = (proData.idDocumentsUrls as string[]) || [];
          for (let i = 0; i < idUrls.length; i++) {
            await tx.professionalDocument.create({
              data: {
                professionalId: professionalProfile.userId,
                category: "ID_OR_PASSPORT",
                title: `ID Document ${i + 1}`,
                issuer: "Government/Official",
                fileUrl: idUrls[i],
                status: "PENDING",
              },
            });
          }
        }
      }

      return user;
    });

    const warnings: string[] = [];

    // 2. Create Store if applicable (Sequential, but part of the same "success" flow)
    // We do this outside the main transaction because `createStore` has its own internal error handling/retry logic
    // and might involve complex ops. If it fails, the user is still stuck with a profile but no store.
    if (
      role === "professional" &&
      "stores" in validatedData &&
      validatedData.stores &&
      validatedData.stores.length > 0
    ) {
      for (const store of validatedData.stores) {
        try {
          // Transform store to CreateStoreInput
          const {
            images,
            categories,
            role: _role,
            logoUrl: _logoUrl,
            bannerUrl: _bannerUrl,
            ...restStoreData
          } = store as any;
          const storeInput: CreateStoreInput = {
            ...restStoreData,
            categories: (categories || []) as StoreCategory[],
            images: images
              ? images.map((img: any) => ({
                  ...img,
                  category: img.category || "INTERIOR",
                  isMain: img.isMain || false,
                }))
              : [],
          };
          await createStore(dbUser.id, storeInput);
        } catch (err) {
          logger.error(
            "Failed to create store during onboarding",
            err as Error,
          );
          warnings.push(
            `Profile created successfully, but we couldn't create your store "${store.name}". Please visit your dashboard to try again.`,
          );
        }
      }
    }

    // 3. Create Property if applicable
    if (
      role === "professional" &&
      "properties" in validatedData &&
      validatedData.properties &&
      validatedData.properties.length > 0
    ) {
      for (const property of validatedData.properties) {
        try {
          // Transform property to CreatePropertyInput
          const { images, role: _role, ...restPropertyData } = property as any;

          const propertyInput: CreatePropertyInput = {
            ...restPropertyData,
            images: images
              ? images.map((img: any) => ({
                  ...img,
                  category: img.category || "EXTERIOR",
                  isMain: img.isMain || false,
                }))
              : [],
          };
          await createProperty(dbUser.id, propertyInput);
        } catch (err) {
          logger.error(
            "Failed to create property during onboarding",
            err as Error,
          );
          warnings.push(
            `Profile created successfully, but we couldn't create your property "${(property as any).title || "Untitled"}". Please visit your dashboard to try again.`,
          );
        }
      }
    }

    return { dbUser, warnings };
  });

  if (!result.success || !result.data) {
    await IdempotencyService.fail(idempotencyKey);
    return {
      success: false,
      error: result.error?.message || "Onboarding failed",
    };
  }

  const { dbUser, warnings } = result.data;

  // Update Clerk Metadata
  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(clerkId, {
      publicMetadata: {
        role: dbUser.role,
        isOnboarded: true,
      },
    });
  } catch (err) {
    logger.error("Failed to update clerk metadata", err as Error);
  }

  await IdempotencyService.complete(idempotencyKey, dbUser);
  return {
    success: true,
    data: dbUser,
    ...(warnings && warnings.length > 0 ? { warnings } : {}),
  };
}

export async function skipOnboarding(): Promise<ActionResponse> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { success: false, error: "Unauthorized" };

  const executor = getResilientExecutor();
  const result = await executor.execute(async () => {
    return await prisma.$transaction(async (tx) => {
      const dbUser = await syncUserFromClerk(clerkId, "CLIENT", tx);

      await tx.user.update({
        where: { id: dbUser.id },
        data: { isProfileComplete: false }, // Reset to false since they skipped
      });

      await tx.clientProfile.upsert({
        where: { userId: dbUser.id },
        update: {},
        create: {
          userId: dbUser.id,
          county: "NAIROBI" as County,
          preferences: {},
        },
      });
      return dbUser;
    });
  });

  if (!result.success || !result.data)
    return { success: false, error: "Failed to skip" };

  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(clerkId, {
      publicMetadata: {
        role: "CLIENT",
        isOnboarded: true,
      },
    });
  } catch (err) {
    logger.error("Failed to update clerk metadata", err as Error);
  }

  return { success: true, data: result.data };
}

export async function skipProfessionalOnboarding(): Promise<ActionResponse> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { success: false, error: "Unauthorized" };

  const executor = getResilientExecutor();
  const result = await executor.execute(async () => {
    return await prisma.$transaction(async (tx) => {
      const user = await syncUserFromClerk(clerkId, "PROFESSIONAL", tx);

      await tx.user.update({
        where: { id: user.id },
        data: { isProfileComplete: false }, // Reset to false since they skipped
      });

      await tx.professionalProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          profession: "OTHER",
          companyName: "My Company", // Default
          yearsExperience: 0,
          verified: false,
        },
      });
      return user;
    });
  });

  if (!result.success || !result.data)
    return { success: false, error: "Failed to skip" };

  try {
    const client = await clerkClient();
    await client.users.updateUserMetadata(clerkId, {
      publicMetadata: {
        role: "PROFESSIONAL",
        isOnboarded: true,
      },
    });
  } catch (err) {
    logger.error("Failed to update clerk metadata", err as Error);
  }

  return { success: true, data: result.data };
}
