"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@build/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createStoresBatch, CreateStoreInput } from "@/lib/services/stores";
import {
  createPropertiesBatch,
  CreatePropertyInput,
} from "@/lib/services/properties";
import {
  UpdateProfileSchema,
  completeProfileSchema,
} from "@/app/lib/validation/profile-validation";

// --- Types ---
export type ActionResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type ServiceGroup = {
  id: string;
  name: string;
  services: {
    id: string;
    name: string;
    slug: string;
  }[];
};

export type SettingsProfileData = {
  id: string;
  userId: string;
  companyName: string;
  profession: string | null;
  bio: string | null;
  city: string | null;
  county: string | null;
  website: string | null;
  portfolioUrl: string | null;
  yearsExperience: number | null;
  licenseNumber: string | null;
  services: {
    id: string;
    name: string;
    slug: string;
  }[];
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatar: string | null;
  };
};

type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

// --- Actions ---

export async function getProfessionalProfileAction(): Promise<
  ActionResponse<SettingsProfileData>
> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { success: false, error: "Unauthorized" };

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId },
      include: {
        professionalProfile: {
          include: {
            offeredServices: {
              include: {
                service: true,
              },
            },
            licenses: true,
          },
        },
      },
    });

    if (!user || !user.professionalProfile) {
      return { success: false, error: "Profile not found" };
    }

    const profile = user.professionalProfile;

    // Transform to expected shape
    const data: SettingsProfileData = {
      id: profile.userId, // ProfessionalProfile uses userId as PK
      userId: profile.userId,
      companyName: profile.companyName,
      profession: profile.profession,
      bio: profile.bio,
      city: profile.city,
      county: profile.county,
      website: profile.website,
      portfolioUrl: profile.portfolioUrl,
      yearsExperience: profile.yearsExperience,
      licenseNumber: profile.licenses[0]?.licenseNumber || null,
      services: profile.offeredServices.map((s) => ({
        id: s.serviceId,
        name: s.service.name,
        slug: s.service.slug,
      })),
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatar: user.avatar,
      },
    };

    return { success: true, data };
  } catch (error) {
    console.error("Failed to fetch profile", error);
    return { success: false, error: "Failed to fetch profile" };
  }
}

export async function updateProfessionalProfileAction(
  input: UpdateProfileInput,
): Promise<ActionResponse> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { success: false, error: "Unauthorized" };

  const validation = UpdateProfileSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: "Validation failed" };
  }

  const {
    firstName,
    lastName,
    companyName,
    bio,
    city,
    county,
    website,
    portfolioUrl,
    yearsExperience,
    serviceIds,
  } = validation.data;

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) return { success: false, error: "User not found" };

    await prisma.$transaction(async (tx) => {
      // Update User details
      await tx.user.update({
        where: { id: user.id },
        data: { firstName, lastName },
      });

      // Update Professional Profile
      await tx.professionalProfile.update({
        where: { userId: user.id },
        data: {
          companyName,
          bio,
          city,
          county: county ?? null,
          website,
          portfolioUrl,
          yearsExperience,
        },
      });

      // Update Services
      if (serviceIds) {
        await tx.professionalService.deleteMany({
          where: { professionalId: user.id },
        });

        if (serviceIds.length > 0) {
          await tx.professionalService.createMany({
            data: serviceIds.map((serviceId) => ({
              professionalId: user.id,
              serviceId,
            })),
          });
        }
      }
    });

    revalidatePath("/professional-portal/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to update profile", error);
    return { success: false, error: "Failed to update profile" };
  }
}

export async function getServicesGroupedByCategoryAction(): Promise<
  ActionResponse<ServiceGroup[]>
> {
  try {
    const categories = await prisma.serviceCategory.findMany({
      where: { isActive: true, deletedAt: null },
      include: {
        services: {
          select: { id: true, name: true, slug: true },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    const data: ServiceGroup[] = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      services: cat.services,
    }));

    return { success: true, data };
  } catch (error) {
    console.error("Failed to fetch services", error);
    return { success: false, error: "Failed to fetch services" };
  }
}

export async function completeProfessionalProfileAction(
  data: z.infer<typeof completeProfileSchema>,
): Promise<ActionResponse> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { success: false, error: "Unauthorized" };

  const validation = completeProfileSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: "Validation failed" };
  }

  const {
    profession,
    companyName,
    yearsExperience,
    website,
    bio,
    certificatesUrls,
    idDocumentsUrls,
    storeData,
    propertyData,
    license,
  } = validation.data;

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) return { success: false, error: "User not found" };

    await prisma.$transaction(async (tx) => {
      // Update Professional Profile
      await tx.professionalProfile.update({
        where: { userId: user.id },
        data: {
          companyName,
          bio,
          website,
          yearsExperience,
          profession: profession ?? "OTHER",
          verified: false,
          verificationStatus: "PENDING",
        },
      });

      // Handle License
      if (license && license.licenseNumber) {
        await tx.professionalLicense.upsert({
          where: {
            professionalId_authority_licenseNumber: {
              professionalId: user.id,
              authority: license.authority,
              licenseNumber: license.licenseNumber,
            },
          },
          update: { validFrom: new Date(), status: "PENDING" },
          create: {
            professionalId: user.id,
            authority: license.authority,
            licenseNumber: license.licenseNumber,
            validFrom: new Date(),
            status: "PENDING",
          },
        });
      }

      // Handle Documents - Certificates
      if (certificatesUrls && certificatesUrls.length > 0) {
        for (let i = 0; i < certificatesUrls.length; i++) {
          await tx.professionalDocument.create({
            data: {
              professionalId: user.id,
              category: "EDUCATION_CERT",
              title: `Professional Certificate ${i + 1}`,
              issuer: "Self-reported",
              fileUrl: certificatesUrls[i],
              status: "PENDING",
            },
          });
        }
      }

      // Handle Documents - ID
      if (idDocumentsUrls && idDocumentsUrls.length > 0) {
        for (let i = 0; i < idDocumentsUrls.length; i++) {
          await tx.professionalDocument.create({
            data: {
              professionalId: user.id,
              category: "ID_OR_PASSPORT",
              title: `ID Document ${i + 1}`,
              issuer: "Government/Official",
              fileUrl: idDocumentsUrls[i],
              status: "PENDING",
            },
          });
        }
      }
    });

    // Create store outside transaction — createStore manages its own DB connection
    if (storeData && storeData.length > 0) {
      await createStoresBatch(user.id, storeData as CreateStoreInput[]);
    }

    // TODO: Create properties if propertyData is present
    if (propertyData && propertyData.length > 0) {
      await createPropertiesBatch(
        user.id,
        propertyData as CreatePropertyInput[],
      );
    }

    revalidatePath("/professional-portal");
    return { success: true };
  } catch (error) {
    console.error("Failed to complete profile", error);
    return { success: false, error: "Failed to complete profile" };
  }
}

export async function getServiceCategoriesAction(): Promise<
  ActionResponse<{ id: string; name: string }[]>
> {
  try {
    const services = await prisma.serviceCategory.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return { success: true, data: services };
  } catch (error) {
    console.error("Failed to fetch services", error);
    return { success: false, error: "Failed to fetch services" };
  }
}
