import { prisma } from "@build/db";
import { toProfessionalSettingsDto } from "./mappers";
import { type z } from "zod";
import type { AppRole } from "@/app/lib/security/roles";
import {
  err,
  ok,
  type DomainError,
  type Result,
} from "@/app/lib/errors/result";
import { storesService, type CreateStoreInput } from "@/app/lib/domains/stores";
import {
  propertiesService,
  type CreatePropertyInput,
} from "@/app/lib/domains/properties";
import {
  completeProfileSchema,
  type UpdateProfileInput,
} from "@/app/lib/validation/profile-validation";
import { generateUniqueSlug } from "@/app/lib/utils/server-utils";
import {
  DocumentCategory,
  County,
  Profession,
  type Prisma,
} from "@prisma/client";

export type ProfessionalSettingsActor = {
  userId: string;
  clerkId: string;
  role?: AppRole | null;
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

export type ServiceCategorySortField =
  | "createdAt"
  | "name"
  | "sortOrder"
  | "updatedAt";

export type ServiceCategorySortDirection = "asc" | "desc";

export type ServiceCategoryListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  imageUrl: string | null;
  professionType: Profession | null;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number | null;
  metaTitle: string | null;
  metaDescription: string | null;
  keywords: string[] | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ServiceCategoryListResult = {
  services: ServiceCategoryListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ServiceCategoryQuery = {
  page: number;
  limit: number;
  sortField: ServiceCategorySortField;
  sortDirection: ServiceCategorySortDirection;
  search?: string;
  professionType?: Profession | null;
};

export type CreateServiceCategoryInput = {
  name: string;
  description?: string | null;
  icon?: string | null;
  imageUrl?: string | null;
  professionType?: Profession | null;
  sortOrder?: number | null;
  isFeatured?: boolean;
  metaTitle?: string | null;
  metaDescription?: string | null;
  keywords?: string[] | null;
};

export type SettingsProfileData = {
  id: string;
  userId: string;
  companyName: string;
  profession: string | null;
  bio: string | null;
  city: string | null;
  county: County | null;
  website: string | null;
  portfolioUrl: string | null;
  yearsExperience: number | null;
  licenseNumber: string | null;
  verified: boolean;
  verificationStatus?: string | null;
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
  createdAt: string;
  updatedAt: string;
};

type SettingsProfileRecord = Omit<
  SettingsProfileData,
  "createdAt" | "updatedAt"
> & {
  createdAt: Date;
  updatedAt: Date;
};

type CompleteProfessionalProfileInput = z.infer<typeof completeProfileSchema>;

export type ProfessionalSettingsErrorCode =
  | "not_found"
  | "invalid_input"
  | "conflict"
  | "internal";

type ProfessionalSettingsResult<T> = Result<
  T,
  DomainError<ProfessionalSettingsErrorCode>
>;

const serviceCategoryListSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  icon: true,
  imageUrl: true,
  professionType: true,
  isActive: true,
  isFeatured: true,
  sortOrder: true,
  metaTitle: true,
  metaDescription: true,
  keywords: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      services: true,
    },
  },
} as const;

async function ensureProfessionalProfile(
  actor: ProfessionalSettingsActor,
): Promise<ProfessionalSettingsResult<true>> {
  if (actor.role && actor.role !== "PROFESSIONAL" && actor.role !== "ADMIN") {
    return err({
      error: "invalid_input",
      message: "Professional profile access is only available to professionals",
      status: 403,
    });
  }

  const profile = await prisma.professionalProfile.findUnique({
    where: { userId: actor.userId },
    select: { userId: true },
  });

  if (!profile) {
    return err({
      error: "not_found",
      message: "Profile not found",
      status: 404,
    });
  }

  return ok(true);
}

function mapSettingsProfileData(
  profile: SettingsProfileRecord,
): SettingsProfileData {
  return {
    ...profile,
    createdAt: toProfessionalSettingsDto(
      profile.createdAt,
    ) as unknown as string,
    updatedAt: toProfessionalSettingsDto(
      profile.updatedAt,
    ) as unknown as string,
  };
}

export const professionalSettingsService = {
  async getProfile(
    actor: ProfessionalSettingsActor,
  ): Promise<ProfessionalSettingsResult<SettingsProfileData>> {
    try {
      const profileCheck = await ensureProfessionalProfile(actor);
      if (!profileCheck.ok) {
        return profileCheck;
      }

      const user = await prisma.user.findUnique({
        where: { id: actor.userId },
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
        return err({
          error: "not_found",
          message: "Profile not found",
          status: 404,
        });
      }

      const profile = user.professionalProfile;
      const profileData: SettingsProfileRecord = {
        id: profile.userId,
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
        verified: profile.verified,
        verificationStatus: profile.verificationStatus,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        services: profile.offeredServices.map((serviceLink) => ({
          id: serviceLink.serviceId,
          name: serviceLink.service.name,
          slug: serviceLink.service.slug,
        })),
        user: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          avatar: user.avatar,
        },
      };

      return ok(mapSettingsProfileData(profileData));
    } catch {
      return err({
        error: "internal",
        message: "Failed to fetch profile",
        status: 500,
      });
    }
  },

  async updateProfile(
    actor: ProfessionalSettingsActor,
    input: UpdateProfileInput,
  ): Promise<ProfessionalSettingsResult<void>> {
    try {
      const profileCheck = await ensureProfessionalProfile(actor);
      if (!profileCheck.ok) {
        return profileCheck;
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
      } = input;

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: actor.userId },
          data: { firstName, lastName },
        });

        await tx.professionalProfile.update({
          where: { userId: actor.userId },
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

        if (serviceIds) {
          await tx.professionalService.deleteMany({
            where: { professionalId: actor.userId },
          });

          if (serviceIds.length > 0) {
            await tx.professionalService.createMany({
              data: serviceIds.map((serviceId) => ({
                professionalId: actor.userId,
                serviceId,
              })),
            });
          }
        }
      });

      return ok(undefined);
    } catch {
      return err({
        error: "internal",
        message: "Failed to update profile",
        status: 500,
      });
    }
  },

  async listGroupedServices(): Promise<
    ProfessionalSettingsResult<ServiceGroup[]>
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

      return ok(
        categories.map((category) => ({
          id: category.id,
          name: category.name,
          services: category.services,
        })),
      );
    } catch {
      return err({
        error: "internal",
        message: "Failed to fetch services",
        status: 500,
      });
    }
  },

  async listServiceCategoriesPage(
    input: ServiceCategoryQuery,
  ): Promise<ProfessionalSettingsResult<ServiceCategoryListResult>> {
    try {
      const limit = Math.min(input.limit, 50);
      const skip = (input.page - 1) * limit;
      const where: Prisma.ServiceCategoryWhereInput = {
        deletedAt: null,
        isActive: true,
        ...(input.search && {
          OR: [
            { name: { contains: input.search, mode: "insensitive" as const } },
            {
              description: {
                contains: input.search,
                mode: "insensitive" as const,
              },
            },
          ],
        }),
        ...(input.professionType && {
          professionType: input.professionType,
        }),
      };

      const [services, total] = await Promise.all([
        prisma.serviceCategory.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [input.sortField]: input.sortDirection },
          select: serviceCategoryListSelect,
        }),
        prisma.serviceCategory.count({ where }),
      ]);

      return ok({
        services,
        pagination: {
          page: input.page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch {
      return err({
        error: "internal",
        message: "Failed to fetch services",
        status: 500,
      });
    }
  },

  async createServiceCategory(
    input: CreateServiceCategoryInput,
  ): Promise<ProfessionalSettingsResult<ServiceCategoryListItem>> {
    try {
      const existing = await prisma.serviceCategory.findFirst({
        where: { name: input.name, deletedAt: null },
        select: { id: true },
      });

      if (existing) {
        return err({
          error: "conflict",
          message: "A service with this name already exists",
          status: 409,
        });
      }

      const slug = await generateUniqueSlug("serviceCategory", input.name);

      const service = await prisma.serviceCategory.create({
        data: {
          name: input.name,
          slug,
          description: input.description ?? undefined,
          icon: input.icon ?? undefined,
          imageUrl: input.imageUrl ?? undefined,
          professionType: input.professionType ?? undefined,
          sortOrder: input.sortOrder ?? undefined,
          isFeatured: input.isFeatured ?? false,
          metaTitle: input.metaTitle ?? undefined,
          metaDescription: input.metaDescription ?? undefined,
          keywords: input.keywords ?? undefined,
        },
        select: serviceCategoryListSelect,
      });

      return ok(service);
    } catch {
      return err({
        error: "internal",
        message: "Failed to create service category",
        status: 500,
      });
    }
  },

  async completeProfile(
    actor: ProfessionalSettingsActor,
    input: CompleteProfessionalProfileInput,
  ): Promise<ProfessionalSettingsResult<void>> {
    const {
      profession,
      companyName,
      yearsExperience,
      website,
      bio,
      documents,
      storeData,
      propertyData,
      license,
    } = input;

    try {
      const profileCheck = await ensureProfessionalProfile(actor);
      if (!profileCheck.ok) {
        return profileCheck;
      }

      await prisma.$transaction(async (tx) => {
        await tx.professionalProfile.update({
          where: { userId: actor.userId },
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

        if (license && license.licenseNumber) {
          await tx.professionalLicense.upsert({
            where: {
              professionalId_authority_licenseNumber: {
                professionalId: actor.userId,
                authority: license.authority,
                licenseNumber: license.licenseNumber,
              },
            },
            update: { validFrom: new Date(), status: "PENDING" },
            create: {
              professionalId: actor.userId,
              authority: license.authority,
              licenseNumber: license.licenseNumber,
              validFrom: new Date(),
              status: "PENDING",
            },
          });
        }

        if (documents && documents.length > 0) {
          const uploadIds = documents
            .map((document) => document.uploadId)
            .filter(Boolean);
          const stagedUploads = await tx.onboardingUpload.findMany({
            where: {
              id: { in: uploadIds },
              clerkId: actor.clerkId,
              status: "STAGED",
            },
          });

          if (
            uploadIds.length > 0 &&
            stagedUploads.length !== uploadIds.length
          ) {
            throw new Error("INVALID_OR_EXPIRED_DOCUMENT_UPLOADS");
          }

          for (const [index, document] of documents.entries()) {
            const staged = stagedUploads.find(
              (upload) => upload.id === document.uploadId,
            );
            let assetId: string | undefined;

            if (staged) {
              let asset = await tx.asset.findFirst({
                where: {
                  checksum: staged.checksum,
                  uploaderId: actor.userId,
                  visibility: "PUBLIC",
                  deletedAt: null,
                },
              });

              if (!asset) {
                asset = await tx.asset.create({
                  data: {
                    uploaderId: actor.userId,
                    originalName: staged.originalName,
                    mimeType: staged.mimeType,
                    size: staged.size,
                    checksum: staged.checksum,
                    bucket: staged.storageBucket,
                    key: staged.storageKey,
                    cdnUrl: staged.tempUrl,
                    visibility: "PUBLIC",
                  },
                });
              }

              assetId = asset.id;

              await tx.onboardingUpload.update({
                where: { id: staged.id },
                data: {
                  status: "CONSUMED",
                  consumedAt: new Date(),
                  consumedByUserId: actor.userId,
                },
              });
            }

            await tx.professionalDocument.create({
              data: {
                professionalId: actor.userId,
                category: document.category as DocumentCategory,
                title: document.title || `Document ${index + 1}`,
                issuer:
                  document.category === "ID_OR_PASSPORT"
                    ? "Government/Official"
                    : "Self-reported",
                assetId,
                status: "PENDING",
              },
            });
          }
        }
      });

      if (storeData && storeData.length > 0) {
        const storesResult = await storesService.createStoresBatch(
          {
            userId: actor.userId,
            role: actor.role,
          },
          storeData as CreateStoreInput[],
        );
        if (!storesResult.ok) {
          return err({
            error: "internal",
            message: storesResult.message ?? "Failed to create stores",
            status: storesResult.status ?? 500,
          });
        }
      }

      if (propertyData && propertyData.length > 0) {
        const propertiesResult = await propertiesService.createPropertiesBatch(
          { userId: actor.userId, role: actor.role ?? "PROFESSIONAL" },
          propertyData as CreatePropertyInput[],
        );
        if (!propertiesResult.ok) {
          return err({
            error: "internal",
            message: propertiesResult.message ?? "Failed to create properties",
            status: propertiesResult.status ?? 500,
          });
        }
      }

      return ok(undefined);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "INVALID_OR_EXPIRED_DOCUMENT_UPLOADS"
      ) {
        return err({
          error: "invalid_input",
          message: "Invalid or expired document uploads",
          status: 400,
        });
      }

      return err({
        error: "internal",
        message: "Failed to complete profile",
        status: 500,
      });
    }
  },

  async listServiceCategories(): Promise<
    ProfessionalSettingsResult<{ id: string; name: string }[]>
  > {
    try {
      const categories = await prisma.serviceCategory.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });

      return ok(categories);
    } catch {
      return err({
        error: "internal",
        message: "Failed to fetch services",
        status: 500,
      });
    }
  },
};
