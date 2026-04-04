import { prisma } from "@build/db";
import {
  County,
  DocumentCategory,
  LicenseAuthority,
  Profession,
  PropertyType,
  PropertyCategory,
  PropertyStatus,
} from "@prisma/client";
import { OnboardingSchema } from "@build/types";
import { z } from "zod";
import {
  err,
  ok,
  type DomainError,
  type Result,
} from "@/app/lib/errors/result";
import { uploadService } from "@/app/lib/domains/uploads";
import { syncUserProfileCompletionStatus } from "./completion";
import {
  calculateProfileCompletion,
  getMissingFieldLabels,
} from "@/app/lib/utils/profile-completion";
import { isSupplierProfession } from "@/lib/constants/professionOptions";
import { normalizeRole, type AppRole } from "@/app/lib/security/roles";
import {
  buildClientOnboardingPreferences,
  buildClientTypeComplianceRouting,
  resolveClientType,
  type ClientTypeComplianceRouting,
} from "./client-type-compliance";

export type ClerkUserProfile = {
  emailAddresses?: Array<{ emailAddress?: string | null }>;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumbers?: Array<{ phoneNumber?: string | null }>;
};

type ProfessionalDocumentInput = {
  uploadId?: string;
  category: string;
  title?: string;
  previewUrl?: string;
};

type OnboardingInput = z.infer<typeof OnboardingSchema>;

export type UserProfileOnboardingActor = {
  clerkId: string;
  correlationId?: string;
  role?: AppRole | null;
};

export type AuthenticatedUserProfileOnboardingActor =
  UserProfileOnboardingActor & {
    userId: string;
  };

export type UserProfileOnboardingErrorCode =
  | "invalid_input"
  | "invalid_state"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "internal";

export type UserProfileOnboardingResult<T> = Result<
  T,
  DomainError<UserProfileOnboardingErrorCode>
>;

export type UserProfileOnboardingData = {
  userId: string;
  role: string;
  isProfileComplete: boolean;
  clientTypeCompliance?: ClientTypeComplianceRouting;
};

export type SkipOnboardingData = UserProfileOnboardingData & {
  skipped: true;
  redirectTo: string;
  message: string;
};

type ProfessionalOnboardingStoreInput = {
  name: string;
  description?: string;
  address?: string;
  city?: string;
  county?: County;
  categories?: string[];
  images?: string[];
};

type ProfessionalOnboardingPropertyInput = {
  title: string;
  description?: string;
  price: number;
  currency?: string;
  location?: string;
  address?: string;
  county?: County;
  type?: PropertyType;
  category?: PropertyCategory;
  status?: PropertyStatus;
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaSqm?: number | null;
  parkingSpaces?: number | null;
  yearBuilt?: number | null;
  buildingSize?: number | null;
  plotSize?: number | null;
  images?: string[];
  features?: string[];
};

export type ProfessionalOnboardingCompleteInput = {
  profession: Profession;
  companyName: string;
  yearsExperience?: number | null;
  website?: string | null;
  bio?: string | null;
  licenseNumber?: string | null;
  licenseAuthority?: LicenseAuthority | null;
  earbNumber?: string | null;
  emailMarketingConsent?: boolean;
  smsMarketingConsent?: boolean;
  analyticsConsent?: boolean;
  stores?: ProfessionalOnboardingStoreInput[];
  properties?: ProfessionalOnboardingPropertyInput[];
  documents?: ProfessionalDocumentInput[];
};

export type ProfessionalOnboardingCompletionData = {
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    avatar: string | null;
    role: string;
    isProfileComplete: boolean;
  };
  profile: {
    userId: string;
    profession: Profession | null;
    companyName: string;
    yearsExperience: number | null;
    website: string | null;
    bio: string | null;
    county?: County | null;
    city?: string | null;
    serviceRadiusKm?: number | null;
    verified?: boolean;
  };
  completion: {
    percentage: number;
    isComplete: boolean;
    missingRequired: string[];
    missingRequiredLabels: string[];
    missingOptional: string[];
    filledFields: string[];
  };
};

type OnboardingRequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

const USER_STATUS_ONBOARDING = "ONBOARDING";
const USER_STATUS_PENDING_VERIFICATION = "PENDING_VERIFICATION";
const USER_STATUS_ACTIVE = "ACTIVE";

function buildUniqueSlug(value: string) {
  const baseSlug = value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 50);

  return `${baseSlug}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const userProfileOnboardingService = {
  async completeOnboarding(params: {
    actor: UserProfileOnboardingActor;
    clerkUser: ClerkUserProfile;
    data: OnboardingInput;
  }): Promise<UserProfileOnboardingResult<UserProfileOnboardingData>> {
    const { actor, clerkUser, data } = params;
    const userRole = normalizeRole(data.role);
    let clientTypeCompliance: ClientTypeComplianceRouting | undefined;

    if (!userRole || (userRole !== "CLIENT" && userRole !== "PROFESSIONAL")) {
      return err({
        error: "invalid_input",
        message: "Invalid onboarding role",
        status: 400,
      });
    }

    if (data.role === "client") {
      const clientData = data as Extract<OnboardingInput, { role: "client" }>;
      const clientType = resolveClientType(clientData.type);

      if (!clientType) {
        return err({
          error: "invalid_input",
          message: "Invalid client type",
          status: 400,
        });
      }

      clientTypeCompliance = buildClientTypeComplianceRouting({
        clientType,
        companyName: clientData.companyName,
        companyRegistration: clientData.companyRegistration,
        kraPin: clientData.kraPin,
      });
    }

    // Guard: prevent re-onboarding an already-complete user.
    // skipClientOnboarding already does this; completeOnboarding must too.
    // Without this, a race condition or browser retry can create duplicate
    // licenses, stores, and document records.
    try {
      const existingUser = await prisma.user.findUnique({
        where: { clerkId: actor.clerkId },
        select: { id: true, isProfileComplete: true },
      });
      if (existingUser?.isProfileComplete) {
        return err({
          error: "conflict",
          message: "Onboarding already completed",
          status: 409,
        });
      }
    } catch {
      return err({
        error: "internal",
        message: "Failed to verify onboarding state",
        status: 500,
      });
    }

    try {
      // PRE-MATERIALIZE DOCUMENTS BEFORE THE TRANSACTION OPENS.
      // uploadService.materializeOnboardingUpload is an external service call
      // (involves S3/storage operations). Running it inside prisma.$transaction
      // would hold open DB locks for the duration of each network call and
      // roll back all writes — profile, licenses, stores, properties — if any
      // single materialization fails or times out.
      //
      // Strategy: resolve all uploadId → assetId mappings here, then pass the
      // map into the transaction. If a document cannot be materialized, fail
      // fast before any DB writes are attempted.
      const preMaterializedAssets = new Map<string, string>(); // uploadId → assetId

      if (data.role === "professional") {
        const proData = data as Extract<
          OnboardingInput,
          { role: "professional" }
        >;
        if ("documents" in proData && Array.isArray(proData.documents)) {
          const existingForMaterialization = await prisma.user.findUnique({
            where: { clerkId: actor.clerkId },
            select: { id: true },
          });

          const docs = proData.documents as ProfessionalDocumentInput[];
          for (const docData of docs) {
            if (!docData?.uploadId) continue;

            const materialized =
              await uploadService.materializeOnboardingUpload({
                actor: {
                  userId: existingForMaterialization?.id ?? "",
                  correlationId: actor.correlationId,
                },
                clerkId: actor.clerkId,
                uploadId: docData.uploadId,
              });

            if (!materialized.ok) {
              if (materialized.error === "invalid_input") {
                return err({
                  error: "invalid_input",
                  message: "Invalid or expired document uploads",
                  status: 400,
                });
              }
              return err({
                error: "internal",
                message:
                  materialized.message || "Failed to process document upload",
                status: 500,
              });
            }

            preMaterializedAssets.set(
              docData.uploadId,
              materialized.data.assetId,
            );
          }
        }
      }

      // Materialization must not run inside this transaction — it is an
      // external call (S3/storage). All uploadId → assetId resolution happens
      // above via preMaterializedAssets.
      const user = await prisma.$transaction(
        async (tx) => {
          const dbUser = await tx.user.upsert({
            where: { clerkId: actor.clerkId },
            create: {
              clerkId: actor.clerkId,
              email: clerkUser.emailAddresses?.[0]?.emailAddress || "",
              firstName: clerkUser.firstName || null,
              lastName: clerkUser.lastName || null,
              phone: clerkUser.phoneNumbers?.[0]?.phoneNumber || null,
              role: userRole,
              status:
                userRole === "PROFESSIONAL"
                  ? USER_STATUS_PENDING_VERIFICATION
                  : USER_STATUS_ACTIVE,
            },
            update: {
              role: userRole,
              status:
                userRole === "PROFESSIONAL"
                  ? USER_STATUS_PENDING_VERIFICATION
                  : USER_STATUS_ACTIVE,
            },
            select: {
              id: true,
              role: true,
              isProfileComplete: true,
            },
          });

          if (data.role === "client") {
            const clientData = data as Extract<
              OnboardingInput,
              { role: "client" }
            >;
            if (!clientTypeCompliance) {
              throw new Error("CLIENT_TYPE_ROUTING_MISSING");
            }

            const existingClientProfile = await tx.clientProfile.findUnique({
              where: { userId: dbUser.id },
              select: {
                preferences: true,
              },
            });

            const preferences = buildClientOnboardingPreferences({
              existingPreferences: existingClientProfile?.preferences,
              routing: clientTypeCompliance,
            });

            await tx.clientProfile.upsert({
              where: { userId: dbUser.id },
              update: {
                county: clientData.county as County,
                city: clientData.city || null,
                address: clientData.address || null,
                zipCode: clientData.zipCode || null,
                companyName: clientData.companyName || null,
                companyRegistration: clientData.companyRegistration || null,
                kraPin: clientData.kraPin || null,
                budgetRangeMin: clientData.budgetRangeMin ?? null,
                budgetRangeMax: clientData.budgetRangeMax ?? null,
                interests: clientData.interests || [],
                type: clientTypeCompliance.clientType,
                preferences,
              },
              create: {
                userId: dbUser.id,
                county: clientData.county as County,
                city: clientData.city || null,
                address: clientData.address || null,
                zipCode: clientData.zipCode || null,
                companyName: clientData.companyName || null,
                companyRegistration: clientData.companyRegistration || null,
                kraPin: clientData.kraPin || null,
                budgetRangeMin: clientData.budgetRangeMin ?? null,
                budgetRangeMax: clientData.budgetRangeMax ?? null,
                interests: clientData.interests || [],
                type: clientTypeCompliance.clientType,
                preferences,
              },
            });
          } else if (data.role === "professional") {
            const proData = data as Extract<
              OnboardingInput,
              { role: "professional" }
            >;

            const profession =
              "profession" in proData
                ? (proData.profession as Profession)
                : ("OTHER" as Profession);
            const companyName =
              "companyName" in proData ? (proData.companyName as string) : "";

            const professionalProfile = await tx.professionalProfile.upsert({
              where: { userId: dbUser.id },
              update: {
                profession,
                companyName,
                yearsExperience:
                  "yearsExperience" in proData
                    ? ((proData.yearsExperience as number | undefined) ?? null)
                    : null,
                website:
                  "website" in proData
                    ? (proData.website as string) || null
                    : null,
                bio: "bio" in proData ? (proData.bio as string) || null : null,
                portfolioUrl:
                  "portfolioUrl" in proData
                    ? (proData.portfolioUrl as string) || null
                    : null,
                county:
                  "county" in proData ? (proData.county as County) : undefined,
                city:
                  "city" in proData ? (proData.city as string) || null : null,
                serviceRadiusKm:
                  "serviceRadiusKm" in proData
                    ? ((proData.serviceRadiusKm as number | undefined) ?? null)
                    : null,
                verified: false,
              },
              create: {
                userId: dbUser.id,
                profession,
                companyName: companyName || "",
                yearsExperience:
                  "yearsExperience" in proData
                    ? ((proData.yearsExperience as number | undefined) ?? null)
                    : null,
                website:
                  "website" in proData
                    ? (proData.website as string) || null
                    : null,
                bio: "bio" in proData ? (proData.bio as string) || null : null,
                portfolioUrl:
                  "portfolioUrl" in proData
                    ? (proData.portfolioUrl as string) || null
                    : null,
                county:
                  "county" in proData ? (proData.county as County) : undefined,
                city:
                  "city" in proData ? (proData.city as string) || null : null,
                serviceRadiusKm:
                  "serviceRadiusKm" in proData
                    ? ((proData.serviceRadiusKm as number | undefined) ?? null)
                    : null,
                verified: false,
              },
            });

            if ("license" in proData && proData.license) {
              const license = proData.license as {
                authority?: string;
                licenseNumber?: string;
              };

              if (license.authority && license.licenseNumber) {
                await tx.professionalLicense.upsert({
                  where: {
                    professionalId_authority_licenseNumber: {
                      professionalId: dbUser.id,
                      authority: license.authority as LicenseAuthority,
                      licenseNumber: license.licenseNumber,
                    },
                  },
                  update: { validFrom: new Date(), status: "PENDING" },
                  create: {
                    professionalId: dbUser.id,
                    authority: license.authority as LicenseAuthority,
                    licenseNumber: license.licenseNumber,
                    validFrom: new Date(),
                    status: "PENDING",
                  },
                });
              }
            }

            if ("documents" in proData && Array.isArray(proData.documents)) {
              const docs = proData.documents as ProfessionalDocumentInput[];

              // Pass pre-resolved assetIds into the transaction.
              // Materialization is an external call (S3/storage) and must NOT
              // run inside a DB transaction — it would hold locks for the
              // duration of a network round-trip and roll back all writes on
              // failure. Resolution happens before the transaction opens (see
              // the pre-materialization block below). Here we only write.
              for (let index = 0; index < docs.length; index++) {
                const docData = docs[index];
                if (!docData) continue;

                // assetId was resolved before the transaction; look it up by
                // uploadId from the pre-resolved map.
                const assetId = docData.uploadId
                  ? preMaterializedAssets.get(docData.uploadId)
                  : undefined;

                await tx.professionalDocument.create({
                  data: {
                    professionalId: professionalProfile.userId,
                    category: docData.category as DocumentCategory,
                    title: docData.title || `Document ${index + 1}`,
                    issuer:
                      docData.category === "ID_OR_PASSPORT"
                        ? "Government/Official"
                        : "Self-reported",
                    assetId,
                    status: "PENDING",
                  },
                });
              }
            }
          }

          return dbUser;
        },
        { maxWait: 10000, timeout: 30000 },
      );

      const completionResult = await syncUserProfileCompletionStatus(user.id);
      if (!completionResult.ok) {
        return err({
          error: completionResult.error,
          message: completionResult.message,
          status: completionResult.status,
        });
      }

      return ok({
        userId: user.id,
        role: user.role,
        isProfileComplete: completionResult.data.isProfileComplete,
        ...(clientTypeCompliance ? { clientTypeCompliance } : {}),
      });
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
        message: "Onboarding failed",
        status: 500,
      });
    }
  },

  async skipClientOnboarding(params: {
    actor: UserProfileOnboardingActor;
    clerkUser: ClerkUserProfile;
  }): Promise<UserProfileOnboardingResult<SkipOnboardingData>> {
    const { actor, clerkUser } = params;

    if (actor.role && actor.role !== "CLIENT" && actor.role !== "ADMIN") {
      return err({
        error: "forbidden",
        message: "This endpoint is only for client users",
        status: 403,
      });
    }

    try {
      const existingUser = await prisma.user.findUnique({
        where: { clerkId: actor.clerkId },
        select: {
          id: true,
          isProfileComplete: true,
          professionalProfile: { select: { userId: true } },
        },
      });

      if (existingUser?.professionalProfile) {
        return err({
          error: "invalid_state",
          message:
            "Professionals cannot skip onboarding. Please complete the full form.",
          status: 400,
        });
      }

      if (existingUser?.isProfileComplete) {
        return err({
          error: "conflict",
          message: "Onboarding already completed",
          status: 409,
        });
      }

      const user = await prisma.$transaction(
        async (tx) => {
          const dbUser = await tx.user.upsert({
            where: { clerkId: actor.clerkId },
            create: {
              clerkId: actor.clerkId,
              email: clerkUser.emailAddresses?.[0]?.emailAddress || "",
              firstName: clerkUser.firstName || null,
              lastName: clerkUser.lastName || null,
              phone: clerkUser.phoneNumbers?.[0]?.phoneNumber || null,
              role: "CLIENT",
              isProfileComplete: false,
              status: USER_STATUS_ACTIVE,
            },
            update: {
              role: "CLIENT",
              status: USER_STATUS_ACTIVE,
            },
            select: { id: true, role: true, isProfileComplete: true },
          });

          const existingClientProfile = await tx.clientProfile.findUnique({
            where: { userId: dbUser.id },
            select: {
              type: true,
              companyName: true,
              companyRegistration: true,
              kraPin: true,
              preferences: true,
            },
          });

          const clientTypeCompliance = buildClientTypeComplianceRouting({
            clientType: existingClientProfile?.type,
            companyName: existingClientProfile?.companyName,
            companyRegistration: existingClientProfile?.companyRegistration,
            kraPin: existingClientProfile?.kraPin,
          });

          const preferences = buildClientOnboardingPreferences({
            existingPreferences: existingClientProfile?.preferences,
            routing: clientTypeCompliance,
          });

          await tx.clientProfile.upsert({
            where: { userId: dbUser.id },
            update: {
              type: clientTypeCompliance.clientType,
              preferences,
            },
            create: {
              userId: dbUser.id,
              type: clientTypeCompliance.clientType,
              // Do NOT set a synthetic county — null is honest and
              // will be surfaced correctly in the profile completion check.
              // Previously hardcoded "NAIROBI" was wrong for all non-Nairobi users.
              preferences,
            },
          });

          return {
            user: dbUser,
            clientTypeCompliance,
          };
        },
        { maxWait: 10000, timeout: 30000 },
      );

      return ok({
        userId: user.user.id,
        role: user.user.role,
        isProfileComplete: user.user.isProfileComplete,
        clientTypeCompliance: user.clientTypeCompliance,
        skipped: true,
        redirectTo: "/dashboard",
        message:
          "Onboarding skipped. You can complete your profile from the dashboard.",
      });
    } catch {
      return err({
        error: "internal",
        message: "Skip onboarding failed",
        status: 500,
      });
    }
  },

  async skipProfessionalOnboarding(params: {
    actor: UserProfileOnboardingActor;
    clerkUser: ClerkUserProfile;
  }): Promise<UserProfileOnboardingResult<SkipOnboardingData>> {
    const { actor, clerkUser } = params;

    if (
      actor.role &&
      actor.role !== "PROFESSIONAL" &&
      actor.role !== "ADMIN"
    ) {
      return err({
        error: "forbidden",
        message: "This endpoint is only for professional users",
        status: 403,
      });
    }

    try {
      const existingUser = await prisma.user.findUnique({
        where: { clerkId: actor.clerkId },
        select: {
          id: true,
          isProfileComplete: true,
          professionalProfile: { select: { userId: true } },
        },
      });

      if (existingUser?.isProfileComplete && existingUser.professionalProfile) {
        return err({
          error: "conflict",
          message: "Onboarding already completed",
          status: 409,
        });
      }

      const user = await prisma.$transaction(
        async (tx) => {
          const dbUser = await tx.user.upsert({
            where: { clerkId: actor.clerkId },
            create: {
              clerkId: actor.clerkId,
              email: clerkUser.emailAddresses?.[0]?.emailAddress || "",
              firstName: clerkUser.firstName || null,
              lastName: clerkUser.lastName || null,
              phone: clerkUser.phoneNumbers?.[0]?.phoneNumber || null,
              role: "PROFESSIONAL",
              isProfileComplete: false,
              status: USER_STATUS_PENDING_VERIFICATION,
            },
            update: {
              role: "PROFESSIONAL",
              isProfileComplete: false,
              status: USER_STATUS_PENDING_VERIFICATION,
            },
            select: { id: true, role: true, isProfileComplete: true },
          });

          await tx.professionalProfile.upsert({
            where: { userId: dbUser.id },
            update: {},
            create: {
              userId: dbUser.id,
              profession: "OTHER",
              // Do NOT synthesise a company name — it appears on the public
              // profile immediately and is incorrect. Require real data on
              // completion. The empty string satisfies the non-null DB constraint.
              companyName: "",
              yearsExperience: 0,
              verified: false,
            },
          });

          return dbUser;
        },
        { maxWait: 10000, timeout: 30000 },
      );

      return ok({
        userId: user.id,
        role: user.role,
        isProfileComplete: user.isProfileComplete,
        skipped: true,
        redirectTo: "/professional-portal/dashboard",
        message:
          "Professional onboarding skipped. Complete your verification from the dashboard.",
      });
    } catch {
      return err({
        error: "internal",
        message: "Skip onboarding failed",
        status: 500,
      });
    }
  },

  async completeProfessionalOnboarding(params: {
    actor: AuthenticatedUserProfileOnboardingActor;
    data: ProfessionalOnboardingCompleteInput;
    requestMetadata?: OnboardingRequestMetadata;
  }): Promise<
    UserProfileOnboardingResult<ProfessionalOnboardingCompletionData>
  > {
    const { actor, data, requestMetadata } = params;

    if (actor.role && actor.role !== "PROFESSIONAL" && actor.role !== "ADMIN") {
      return err({
        error: "forbidden",
        message: "This endpoint is only for professional users",
        status: 403,
      });
    }

    try {
      const currentUserRecord = await prisma.user.findUnique({
        where: { id: actor.userId },
        select: {
          id: true,
          role: true,
          status: true,
          emailMarketingConsent: true,
          smsMarketingConsent: true,
          analyticsConsent: true,
        },
      });

      if (!currentUserRecord) {
        return err({
          error: "not_found",
          message: "User not found",
          status: 404,
        });
      }

      if (currentUserRecord.role !== "PROFESSIONAL") {
        return err({
          error: "forbidden",
          message: "This endpoint is only for professional users",
          status: 403,
        });
      }

      if (
        currentUserRecord.status === "SUSPENDED" ||
        currentUserRecord.status === "BANNED"
      ) {
        return err({
          error: "forbidden",
          message:
            "Profile updates are not allowed for suspended or banned accounts",
          status: 403,
        });
      }

      const now = new Date();
      const currentStatus = String(currentUserRecord.status);
      const consentWithdrawn =
        (currentUserRecord.emailMarketingConsent &&
          data.emailMarketingConsent === false) ||
        (currentUserRecord.smsMarketingConsent &&
          data.smsMarketingConsent === false);

      // PRE-MATERIALIZE DOCUMENTS BEFORE THE TRANSACTION OPENS.
      // Same rationale as completeOnboarding: external storage calls must not
      // hold open DB transaction locks. Resolve all uploadId → assetId mappings
      // here and pass the resolved map into the transaction.
      const preMaterializedAssets = new Map<string, string>(); // uploadId → assetId
      if (data.documents && data.documents.length > 0) {
        for (const document of data.documents) {
          if (!document?.uploadId) continue;

          const materialized = await uploadService.materializeOnboardingUpload({
            actor: {
              userId: actor.userId,
              correlationId: actor.correlationId,
            },
            clerkId: actor.clerkId,
            uploadId: document.uploadId,
          });

          if (!materialized.ok) {
            if (materialized.error === "invalid_input") {
              return err({
                error: "invalid_input",
                message: "Invalid or expired document uploads",
                status: 400,
              });
            }
            return err({
              error: "internal",
              message:
                materialized.message || "Failed to process document upload",
              status: 500,
            });
          }

          preMaterializedAssets.set(
            document.uploadId,
            materialized.data.assetId,
          );
        }
      }

      // Materialization must not run inside this transaction — external
      // storage calls would hold DB locks. Resolution done above.
      const transactionResult = await prisma.$transaction(
        async (tx) => {
          const professionalProfile = await tx.professionalProfile.upsert({
            where: { userId: actor.userId },
            update: {
              profession: data.profession,
              companyName: data.companyName,
              yearsExperience: data.yearsExperience ?? null,
              website: data.website || null,
              bio: data.bio || null,
            },
            create: {
              userId: actor.userId,
              profession: data.profession,
              companyName: data.companyName,
              yearsExperience: data.yearsExperience ?? null,
              website: data.website || null,
              bio: data.bio || null,
            },
          });

          if (data.licenseNumber && data.licenseAuthority) {
            await tx.professionalLicense.upsert({
              where: {
                professionalId_authority_licenseNumber: {
                  professionalId: actor.userId,
                  authority: data.licenseAuthority,
                  licenseNumber: data.licenseNumber,
                },
              },
              update: {
                validFrom: now,
                status: "PENDING",
              },
              create: {
                professionalId: actor.userId,
                authority: data.licenseAuthority,
                licenseNumber: data.licenseNumber,
                validFrom: now,
                status: "PENDING",
              },
            });
          }

          if (data.earbNumber) {
            await tx.professionalLicense.upsert({
              where: {
                professionalId_authority_licenseNumber: {
                  professionalId: actor.userId,
                  authority: "EARB",
                  licenseNumber: data.earbNumber,
                },
              },
              update: {
                validFrom: now,
                status: "PENDING",
              },
              create: {
                professionalId: actor.userId,
                authority: "EARB",
                licenseNumber: data.earbNumber,
                category: "REAL_ESTATE",
                validFrom: now,
                status: "PENDING",
              },
            });
          }

          if (
            data.stores &&
            data.stores.length > 0 &&
            isSupplierProfession(data.profession)
          ) {
            await Promise.all(
              data.stores.map((store) =>
                tx.store.create({
                  data: {
                    name: store.name,
                    slug: buildUniqueSlug(store.name),
                    description: store.description || null,
                    address: store.address || "",
                    city: store.city || "",
                    county: store.county || null,
                    professionalId: actor.userId,
                  },
                }),
              ),
            );
          }

          if (
            data.properties &&
            data.properties.length > 0 &&
            data.profession === "REAL_ESTATE_AGENT"
          ) {
            await Promise.all(
              data.properties.map((property) =>
                tx.property.create({
                  data: {
                    title: property.title,
                    slug: buildUniqueSlug(property.title),
                    description: property.description || "",
                    price: property.price,
                    currency: property.currency || "KES",
                    location: property.location || "",
                    address: property.address || "",
                    county: property.county ?? null,
                    type: property.type ?? "SALE",
                    category: property.category ?? "RESIDENTIAL",
                    status: property.status ?? "AVAILABLE",
                    agentId: actor.userId,
                    bedrooms: property.bedrooms,
                    bathrooms: property.bathrooms,
                    parkingSpaces: property.parkingSpaces,
                    yearBuilt: property.yearBuilt,
                    buildingSize: property.buildingSize,
                    plotSize: property.plotSize,
                    ...(property.images && property.images.length > 0
                      ? {
                          images: {
                            create: property.images.map((imageUrl, index) => ({
                              url: imageUrl,
                              category: "EXTERIOR" as const,
                              tags: [],
                              isMain: index === 0,
                              sortOrder: index,
                              uploadedBy: {
                                connect: { id: actor.userId },
                              },
                            })),
                          },
                        }
                      : {}),
                    features: property.features || [],
                  },
                }),
              ),
            );
          }

          if (data.documents && data.documents.length > 0) {
            for (let index = 0; index < data.documents.length; index++) {
              const document = data.documents[index];
              if (!document) continue;

              // assetId was resolved before the transaction via preMaterializedAssets.
              const assetId = document.uploadId
                ? preMaterializedAssets.get(document.uploadId)
                : undefined;

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

          const user = await tx.user.update({
            where: { id: actor.userId },
            data: {
              isProfileComplete: true,
              ...(currentStatus === USER_STATUS_ONBOARDING && {
                status: USER_STATUS_PENDING_VERIFICATION,
              }),
              ...(data.emailMarketingConsent !== undefined && {
                emailMarketingConsent: data.emailMarketingConsent,
              }),
              ...(data.smsMarketingConsent !== undefined && {
                smsMarketingConsent: data.smsMarketingConsent,
              }),
              ...(data.analyticsConsent !== undefined && {
                analyticsConsent: data.analyticsConsent,
              }),
              ...(consentWithdrawn && { marketingConsentWithdrawnAt: now }),
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              avatar: true,
              role: true,
              isProfileComplete: true,
            },
          });

          const consentRecords: Array<{
            type: "MARKETING_EMAIL" | "MARKETING_SMS" | "ANALYTICS_COOKIES";
            granted: boolean;
          }> = [];

          if (data.emailMarketingConsent !== undefined) {
            consentRecords.push({
              type: "MARKETING_EMAIL",
              granted: data.emailMarketingConsent,
            });
          }

          if (data.smsMarketingConsent !== undefined) {
            consentRecords.push({
              type: "MARKETING_SMS",
              granted: data.smsMarketingConsent,
            });
          }

          if (data.analyticsConsent !== undefined) {
            consentRecords.push({
              type: "ANALYTICS_COOKIES",
              granted: data.analyticsConsent,
            });
          }

          if (consentRecords.length > 0) {
            await Promise.all(
              consentRecords.map((consent) =>
                tx.consentRecord.create({
                  data: {
                    userId: actor.userId,
                    type: consent.type,
                    granted: consent.granted,
                    grantedAt: now,
                    documentVersion: "v1.0",
                    ipAddress: requestMetadata?.ipAddress,
                    metadata: {
                      source: "professional_onboarding_wizard",
                      correlationId: actor.correlationId,
                      userAgent: requestMetadata?.userAgent,
                    },
                  },
                }),
              ),
            );
          }

          return { user, profile: professionalProfile };
        },
        { maxWait: 10000, timeout: 30000 },
      );

      const completion = calculateProfileCompletion(
        {
          firstName: transactionResult.user.firstName,
          lastName: transactionResult.user.lastName,
          phone: transactionResult.user.phone,
          avatar: transactionResult.user.avatar,
          role: transactionResult.user.role.toLowerCase() as
            | "client"
            | "professional",
        },
        transactionResult.profile,
      );

      return ok({
        user: transactionResult.user,
        profile: transactionResult.profile,
        completion: {
          percentage: completion.percentage,
          isComplete: completion.isComplete,
          missingRequired: completion.missingRequired,
          missingRequiredLabels: getMissingFieldLabels(
            completion.missingRequired,
          ),
          missingOptional: completion.missingOptional,
          filledFields: completion.filledFields,
        },
      });
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
        message: "Failed to complete onboarding",
        status: 500,
      });
    }
  },
};
