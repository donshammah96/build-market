import { prisma } from "@build/db";
import { Prisma, type UserRole, type UserStatus } from "@prisma/client";
import {
  err,
  ok,
  type DomainError,
  type Result,
} from "@/app/lib/errors/result";
import {
  syncUserProfileCompletionStatus,
  type UserProfileCompletionSummary,
} from "./completion";
import { mapProfileCompleteResponse, type Serialized } from "./mappers";
import type {
  ClientProfileCompleteInput,
  ProfessionalProfileCompleteInput,
} from "./profile-complete-contracts";

type CompletionClient = Prisma.TransactionClient | typeof prisma;

export type ProfileCompleteActor = {
  userId: string;
  correlationId?: string;
};

export type ProfileCompleteRequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

export type ProfileCompleteTarget = "client" | "professional";

export type ProfileCompleteErrorCode =
  | "not_found"
  | "forbidden"
  | "unsupported_role"
  | "internal";

export type ProfileCompleteDomainResult<T> = Result<
  T,
  DomainError<ProfileCompleteErrorCode>
>;

export type ProfileCompleteResponseData = {
  success: true;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    avatar: string | null;
    bio: string | null;
    role: UserRole;
    isProfileComplete: boolean;
  };
  profile: unknown;
  completion: UserProfileCompletionSummary;
  message: string;
};

type SerializedProfileCompleteResponseData =
  Serialized<ProfileCompleteResponseData>;

function isRestrictedStatus(status: UserStatus): boolean {
  return status === "SUSPENDED" || status === "BANNED";
}

function restrictedAccountError(): DomainError<"forbidden"> {
  return {
    error: "forbidden",
    message: "Profile updates are not allowed for suspended or banned accounts",
    status: 403,
  };
}

export async function resolveProfileCompleteTarget(
  actor: ProfileCompleteActor,
  client: CompletionClient = prisma,
): Promise<
  ProfileCompleteDomainResult<{ target: ProfileCompleteTarget; role: UserRole }>
> {
  const user = await client.user.findUnique({
    where: { id: actor.userId },
    select: {
      role: true,
      status: true,
    },
  });

  if (!user) {
    return err({
      error: "not_found",
      message: "User not found",
      status: 404,
    });
  }

  if (isRestrictedStatus(user.status)) {
    return err(restrictedAccountError());
  }

  if (user.role === "CLIENT") {
    return ok({ target: "client", role: user.role });
  }

  if (user.role === "PROFESSIONAL") {
    return ok({ target: "professional", role: user.role });
  }

  return err({
    error: "unsupported_role",
    message: `Profile completion not supported for role: ${user.role}`,
    status: 400,
  });
}

export async function completeClientProfile(
  actor: ProfileCompleteActor,
  data: ClientProfileCompleteInput,
): Promise<ProfileCompleteDomainResult<SerializedProfileCompleteResponseData>> {
  const currentUser = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: {
      role: true,
      status: true,
      emailMarketingConsent: true,
      smsMarketingConsent: true,
    },
  });

  if (!currentUser) {
    return err({
      error: "not_found",
      message: "User not found",
      status: 404,
    });
  }

  if (currentUser.role !== "CLIENT") {
    return err({
      error: "forbidden",
      message: "This endpoint is for client profiles only",
      status: 403,
    });
  }

  if (isRestrictedStatus(currentUser.status)) {
    return err(restrictedAccountError());
  }

  const now = new Date();
  const consentWithdrawn =
    (currentUser.emailMarketingConsent &&
      data.emailMarketingConsent === false) ||
    (currentUser.smsMarketingConsent && data.smsMarketingConsent === false);

  const result = await prisma.$transaction(async (tx) => {
    const userUpdateData: Prisma.UserUpdateInput = {
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.avatar !== undefined && { avatar: data.avatar }),
      ...(data.bio !== undefined && { bio: data.bio }),
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
    };

    const updatedUser = await tx.user.update({
      where: { id: actor.userId },
      data: userUpdateData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        bio: true,
        role: true,
        isProfileComplete: true,
      },
    });

    const profileUpdateData: Prisma.ClientProfileUpdateInput = {
      ...(data.type !== undefined && { type: data.type }),
      ...(data.companyName !== undefined && { companyName: data.companyName }),
      ...(data.companyRegistration !== undefined && {
        companyRegistration: data.companyRegistration,
      }),
      ...(data.kraPin !== undefined && { kraPin: data.kraPin }),
      ...(data.vatRegistered !== undefined && {
        vatRegistered: data.vatRegistered,
      }),
      ...(data.website !== undefined && { website: data.website }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.county !== undefined && { county: data.county }),
      ...(data.neighborhood !== undefined && {
        neighborhood: data.neighborhood,
      }),
      ...(data.landmark !== undefined && { landmark: data.landmark }),
      ...(data.zipCode !== undefined && { zipCode: data.zipCode }),
      ...(data.latitude !== undefined && { latitude: data.latitude }),
      ...(data.longitude !== undefined && { longitude: data.longitude }),
      ...(data.budgetRangeMin !== undefined && {
        budgetRangeMin: data.budgetRangeMin,
      }),
      ...(data.budgetRangeMax !== undefined && {
        budgetRangeMax: data.budgetRangeMax,
      }),
      ...(data.interests !== undefined && {
        interests:
          data.interests === null ? { set: [] } : { set: data.interests },
      }),
      ...(data.preferences !== undefined && {
        preferences: data.preferences as Prisma.InputJsonValue,
      }),
    };

    const profileCreateData: Prisma.ClientProfileCreateInput = {
      user: { connect: { id: actor.userId } },
      ...(data.type !== undefined && { type: data.type }),
      ...(data.companyName !== undefined && { companyName: data.companyName }),
      ...(data.companyRegistration !== undefined && {
        companyRegistration: data.companyRegistration,
      }),
      ...(data.kraPin !== undefined && { kraPin: data.kraPin }),
      ...(data.vatRegistered !== undefined && {
        vatRegistered: data.vatRegistered,
      }),
      ...(data.website !== undefined && { website: data.website }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.county !== undefined && { county: data.county }),
      ...(data.neighborhood !== undefined && {
        neighborhood: data.neighborhood,
      }),
      ...(data.landmark !== undefined && { landmark: data.landmark }),
      ...(data.zipCode !== undefined && { zipCode: data.zipCode }),
      ...(data.latitude !== undefined && { latitude: data.latitude }),
      ...(data.longitude !== undefined && { longitude: data.longitude }),
      ...(data.budgetRangeMin !== undefined && {
        budgetRangeMin: data.budgetRangeMin,
      }),
      ...(data.budgetRangeMax !== undefined && {
        budgetRangeMax: data.budgetRangeMax,
      }),
      ...(data.interests !== undefined && { interests: data.interests ?? [] }),
      ...(data.preferences !== undefined && {
        preferences: data.preferences as Prisma.InputJsonValue,
      }),
    };

    const updatedProfile = await tx.clientProfile.upsert({
      where: { userId: actor.userId },
      update: profileUpdateData,
      create: profileCreateData,
    });

    // GDPR Article 7(1): create one ConsentRecord per changed type.
    // Previously one record was created regardless of how many types changed.
    if (
      data.emailMarketingConsent !== undefined ||
      data.smsMarketingConsent !== undefined ||
      data.analyticsConsent !== undefined
    ) {
      type ConsentRow = {
        type: "MARKETING_EMAIL" | "MARKETING_SMS" | "ANALYTICS_COOKIES";
        granted: boolean;
      };
      const consentRows: ConsentRow[] = [];
      if (data.emailMarketingConsent !== undefined) {
        consentRows.push({
          type: "MARKETING_EMAIL",
          granted: data.emailMarketingConsent,
        });
      }
      if (data.smsMarketingConsent !== undefined) {
        consentRows.push({
          type: "MARKETING_SMS",
          granted: data.smsMarketingConsent,
        });
      }
      if (data.analyticsConsent !== undefined) {
        consentRows.push({
          type: "ANALYTICS_COOKIES",
          granted: data.analyticsConsent,
        });
      }
      await Promise.all(
        consentRows.map((row) =>
          tx.consentRecord.create({
            data: {
              userId: actor.userId,
              type: row.type,
              granted: row.granted,
              grantedAt: now,
              documentVersion: "v1.0",
            },
          }),
        ),
      );
    }

    return {
      success: true as const,
      user: updatedUser,
      profile: updatedProfile,
    };
  });

  // Sync runs after commit; failure must not roll back the profile update.
  // syncUserProfileCompletionStatus is a derived read-model concern.
  const completionResult = await syncUserProfileCompletionStatus(actor.userId);
  if (!completionResult.ok) {
    return err({
      error: completionResult.error === "not_found" ? "not_found" : "internal",
      message: completionResult.message,
      status: completionResult.status,
    });
  }
  const completion = completionResult.data;

  return ok(
    mapProfileCompleteResponse({
      success: true,
      user: {
        ...result.user,
        isProfileComplete: completion.isProfileComplete,
      },
      profile: result.profile,
      completion: completion.completion,
      message: completion.completion.isComplete
        ? "Client profile completed successfully!"
        : "Client profile updated successfully",
    }),
  );
}

export async function completeProfessionalProfile(
  actor: ProfileCompleteActor,
  data: ProfessionalProfileCompleteInput,
  metadata: ProfileCompleteRequestMetadata = {},
): Promise<ProfileCompleteDomainResult<SerializedProfileCompleteResponseData>> {
  const currentUser = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: {
      role: true,
      status: true,
      emailMarketingConsent: true,
      smsMarketingConsent: true,
      professionalProfile: {
        select: {
          companyName: true,
        },
      },
    },
  });

  if (!currentUser) {
    return err({
      error: "not_found",
      message: "User not found",
      status: 404,
    });
  }

  if (currentUser.role !== "PROFESSIONAL") {
    return err({
      error: "forbidden",
      message: "This endpoint is for professional profiles only",
      status: 403,
    });
  }

  if (isRestrictedStatus(currentUser.status)) {
    return err(restrictedAccountError());
  }

  const now = new Date();
  const consentWithdrawn =
    (currentUser.emailMarketingConsent &&
      data.emailMarketingConsent === false) ||
    (currentUser.smsMarketingConsent && data.smsMarketingConsent === false);

  const result = await prisma.$transaction(async (tx) => {
    const userUpdateData: Prisma.UserUpdateInput = {
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.avatar !== undefined && { avatar: data.avatar }),
      ...(data.bio !== undefined && { bio: data.bio }),
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
    };

    const updatedUser = await tx.user.update({
      where: { id: actor.userId },
      data: userUpdateData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        bio: true,
        role: true,
        isProfileComplete: true,
      },
    });

    const profileUpdateData: Prisma.ProfessionalProfileUpdateInput = {
      ...(data.companyName !== undefined && { companyName: data.companyName }),
      ...(data.profession !== undefined && { profession: data.profession }),
      ...(data.portfolioUrl !== undefined && {
        portfolioUrl: data.portfolioUrl,
      }),
      ...(data.businessEmail !== undefined && {
        businessEmail: data.businessEmail,
      }),
      ...(data.businessPhone !== undefined && {
        businessPhone: data.businessPhone,
      }),
      ...(data.website !== undefined && { website: data.website }),
      ...(data.socials !== undefined && {
        socials: data.socials as Prisma.InputJsonValue,
      }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.county !== undefined && { county: data.county }),
      ...(data.country !== undefined && { country: data.country }),
      ...(data.latitude !== undefined && { latitude: data.latitude }),
      ...(data.longitude !== undefined && { longitude: data.longitude }),
      ...(data.serviceRadiusKm !== undefined && {
        serviceRadiusKm: data.serviceRadiusKm,
      }),
      ...(data.availability !== undefined && {
        availability: data.availability,
      }),
      ...(data.operatingHours !== undefined && {
        operatingHours: data.operatingHours as Prisma.InputJsonValue,
      }),
      ...(data.kraPin !== undefined && { kraPin: data.kraPin }),
      ...(data.isInsured !== undefined && { isInsured: data.isInsured }),
      ...(data.insuranceExpiry !== undefined && {
        insuranceExpiry: data.insuranceExpiry,
      }),
      ...(data.insuranceProvider !== undefined && {
        insuranceProvider: data.insuranceProvider,
      }),
      ...(data.insurancePolicyNumber !== undefined && {
        insurancePolicyNumber: data.insurancePolicyNumber,
      }),
      ...(data.yearsExperience !== undefined && {
        yearsExperience: data.yearsExperience,
      }),
      ...(data.minProjectBudget !== undefined && {
        minProjectBudget: data.minProjectBudget,
      }),
      ...(data.hourlyRate !== undefined && { hourlyRate: data.hourlyRate }),
      ...(data.acceptedPayments !== undefined && {
        acceptedPayments: data.acceptedPayments,
      }),
    };

    const profileCreateData: Prisma.ProfessionalProfileCreateInput = {
      user: { connect: { id: actor.userId } },
      companyName:
        data.companyName ||
        currentUser.professionalProfile?.companyName ||
        "Company Name Required",
      ...(data.profession !== undefined && { profession: data.profession }),
      ...(data.portfolioUrl !== undefined && {
        portfolioUrl: data.portfolioUrl,
      }),
      ...(data.businessEmail !== undefined && {
        businessEmail: data.businessEmail,
      }),
      ...(data.businessPhone !== undefined && {
        businessPhone: data.businessPhone,
      }),
      ...(data.website !== undefined && { website: data.website }),
      ...(data.socials !== undefined && {
        socials: data.socials as Prisma.InputJsonValue,
      }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.county !== undefined && { county: data.county }),
      ...(data.country !== undefined && { country: data.country }),
      ...(data.latitude !== undefined && { latitude: data.latitude }),
      ...(data.longitude !== undefined && { longitude: data.longitude }),
      ...(data.serviceRadiusKm !== undefined && {
        serviceRadiusKm: data.serviceRadiusKm,
      }),
      ...(data.availability !== undefined && {
        availability: data.availability,
      }),
      ...(data.operatingHours !== undefined && {
        operatingHours: data.operatingHours as Prisma.InputJsonValue,
      }),
      ...(data.kraPin !== undefined && { kraPin: data.kraPin }),
      ...(data.isInsured !== undefined && { isInsured: data.isInsured }),
      ...(data.insuranceExpiry !== undefined && {
        insuranceExpiry: data.insuranceExpiry,
      }),
      ...(data.insuranceProvider !== undefined && {
        insuranceProvider: data.insuranceProvider,
      }),
      ...(data.insurancePolicyNumber !== undefined && {
        insurancePolicyNumber: data.insurancePolicyNumber,
      }),
      ...(data.yearsExperience !== undefined && {
        yearsExperience: data.yearsExperience,
      }),
      ...(data.minProjectBudget !== undefined && {
        minProjectBudget: data.minProjectBudget,
      }),
      ...(data.hourlyRate !== undefined && { hourlyRate: data.hourlyRate }),
      ...(data.acceptedPayments !== undefined && {
        acceptedPayments: data.acceptedPayments,
      }),
    };

    const updatedProfile = await tx.professionalProfile.upsert({
      where: { userId: actor.userId },
      update: profileUpdateData,
      create: profileCreateData,
    });

    // GDPR Article 7(1): create one ConsentRecord per changed type.
    if (
      data.emailMarketingConsent !== undefined ||
      data.smsMarketingConsent !== undefined ||
      data.analyticsConsent !== undefined
    ) {
      type ConsentRow = {
        type: "MARKETING_EMAIL" | "MARKETING_SMS" | "ANALYTICS_COOKIES";
        granted: boolean;
      };
      const consentRows: ConsentRow[] = [];
      if (data.emailMarketingConsent !== undefined) {
        consentRows.push({
          type: "MARKETING_EMAIL",
          granted: data.emailMarketingConsent,
        });
      }
      if (data.smsMarketingConsent !== undefined) {
        consentRows.push({
          type: "MARKETING_SMS",
          granted: data.smsMarketingConsent,
        });
      }
      if (data.analyticsConsent !== undefined) {
        consentRows.push({
          type: "ANALYTICS_COOKIES",
          granted: data.analyticsConsent,
        });
      }
      await Promise.all(
        consentRows.map((row) =>
          tx.consentRecord.create({
            data: {
              userId: actor.userId,
              type: row.type,
              granted: row.granted,
              grantedAt: now,
              documentVersion: "v1.0",
              ipAddress: metadata.ipAddress,
              metadata: {
                source: "professional_profile_update",
                correlationId: actor.correlationId,
                userAgent: metadata.userAgent,
              },
            },
          }),
        ),
      );
    }

    if (data.deleteLicenseIds && data.deleteLicenseIds.length > 0) {
      await tx.professionalLicense.deleteMany({
        where: {
          id: { in: data.deleteLicenseIds },
          professionalId: actor.userId,
        },
      });
    }

    if (data.deleteDocumentIds && data.deleteDocumentIds.length > 0) {
      await tx.professionalDocument.deleteMany({
        where: {
          id: { in: data.deleteDocumentIds },
          professionalId: actor.userId,
        },
      });
    }

    if (data.licenses && data.licenses.length > 0) {
      await Promise.all(
        data.licenses.map((license) =>
          tx.professionalLicense.upsert({
            where: {
              professionalId_authority_licenseNumber: {
                professionalId: actor.userId,
                authority: license.authority,
                licenseNumber: license.licenseNumber,
              },
            },
            update: {
              category: license.category || null,
              validFrom: license.validFrom
                ? new Date(license.validFrom)
                : undefined,
              validUntil: license.validUntil
                ? new Date(license.validUntil)
                : null,
              fileUrl: license.fileUrl || null,
              status: "PENDING",
            },
            create: {
              professionalId: actor.userId,
              authority: license.authority,
              licenseNumber: license.licenseNumber,
              category: license.category || null,
              validFrom: license.validFrom ? new Date(license.validFrom) : now,
              validUntil: license.validUntil
                ? new Date(license.validUntil)
                : null,
              fileUrl: license.fileUrl || null,
              status: "PENDING",
            },
          }),
        ),
      );
    }

    if (data.documents && data.documents.length > 0) {
      for (const doc of data.documents) {
        if (doc.id) {
          await tx.professionalDocument.updateMany({
            where: {
              id: doc.id,
              professionalId: actor.userId,
            },
            data: {
              category: doc.category,
              title: doc.title,
              issuer: doc.issuer || null,
              issueDate: doc.issueDate ? new Date(doc.issueDate) : null,
              expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : null,
              fileUrl: doc.fileUrl,
              status: "PENDING",
            },
          });
        } else {
          await tx.professionalDocument.create({
            data: {
              professionalId: actor.userId,
              category: doc.category,
              title: doc.title,
              issuer: doc.issuer || "Self-reported",
              issueDate: doc.issueDate ? new Date(doc.issueDate) : null,
              expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : null,
              fileUrl: doc.fileUrl,
              status: "PENDING",
            },
          });
        }
      }
    }

    return {
      success: true as const,
      user: updatedUser,
      profile: updatedProfile,
    };
  });

  // Sync runs after commit; failure must not roll back the profile update.
  // The completion percentage is a derived read-model concern.
  const completionResult = await syncUserProfileCompletionStatus(actor.userId);
  if (!completionResult.ok) {
    return err({
      error: completionResult.error === "not_found" ? "not_found" : "internal",
      message: completionResult.message,
      status: completionResult.status,
    });
  }
  const completion = completionResult.data;

  return ok(
    mapProfileCompleteResponse({
      success: true,
      user: {
        ...result.user,
        isProfileComplete: completion.isProfileComplete,
      },
      profile: result.profile,
      completion: completion.completion,
      message: completion.completion.isComplete
        ? "Professional profile completed successfully!"
        : "Professional profile updated successfully",
    }),
  );
}
