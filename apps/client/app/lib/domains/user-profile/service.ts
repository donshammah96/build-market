import { prisma } from "@build/db";
import {
  AvailabilityStatus,
  ClientType,
  County,
  Prisma,
  Profession,
  type ProfessionalDocument,
  type ProfessionalLicense,
} from "@prisma/client";
import {
  calculateProfileCompletion,
  getMissingFieldLabels,
} from "@/app/lib/utils/profile-completion";
import {
  err,
  ok,
  type DomainError,
  type Result,
} from "@/app/lib/errors/result";
import { syncUserProfileCompletionStatus } from "./completion";
import {
  mapUserProfileReadResponse,
  mapUserProfileUpdateResponse,
  type Serialized,
} from "./mappers";

type VerificationProfile = {
  verified: boolean | null;
  verificationStatus: string | null;
  verifiedAt: Date | null;
  verificationNotes: string | null;
  licenses?: Array<Pick<ProfessionalLicense, "status" | "validUntil">>;
  documents?: Array<Pick<ProfessionalDocument, "status">>;
};

export type UserProfileActor = {
  userId: string;
  correlationId?: string;
};

export type UserProfileErrorCode = "not_found" | "forbidden" | "internal";

export type UserProfileDomainResult<T> = Result<
  T,
  DomainError<UserProfileErrorCode>
>;

export type UserProfileUpdateInput = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string | null;
  bio?: string | null;
  emailMarketingConsent?: boolean;
  smsMarketingConsent?: boolean;
  analyticsConsent?: boolean;
  profileData?: {
    type?: ClientType;
    companyName?: string;
    website?: string | null;
    address?: string | null;
    city?: string | null;
    county?: County | null;
    zipCode?: string | null;
    budgetRangeMin?: number | null;
    budgetRangeMax?: number | null;
    interests?: string[];
    preferences?: unknown;
    bio?: string | null;
    profession?: Profession | null;
    businessEmail?: string | null;
    businessPhone?: string | null;
    socials?: unknown;
    serviceRadiusKm?: number | null;
    availability?: AvailabilityStatus;
    operatingHours?: unknown;
    yearsExperience?: number | null;
    minProjectBudget?: number | null;
    hourlyRate?: number | null;
    acceptedPayments?: string[];
  };
};

const userProfileSelect = {
  id: true,
  clerkId: true,
  email: true,
  firstName: true,
  lastName: true,
  displayName: true,
  phone: true,
  avatar: true,
  bio: true,
  role: true,
  status: true,
  isProfileComplete: true,
  isEmailVerified: true,
  isPhoneVerified: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  lockedUntil: true,
  passwordResetRequired: true,
  lastLoginAt: true,
  lastActiveAt: true,
  loginCount: true,
  termsAcceptedAt: true,
  termsVersion: true,
  privacyAcceptedAt: true,
  emailMarketingConsent: true,
  smsMarketingConsent: true,
  analyticsConsent: true,
  marketingConsentWithdrawnAt: true,
  dataRetentionDays: true,
  scheduledDeletionAt: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  clientProfile: {
    select: {
      userId: true,
      type: true,
      companyName: true,
      companyRegistration: true,
      kraPin: true,
      vatRegistered: true,
      website: true,
      address: true,
      city: true,
      county: true,
      neighborhood: true,
      landmark: true,
      zipCode: true,
      latitude: true,
      longitude: true,
      budgetRangeMin: true,
      budgetRangeMax: true,
      interests: true,
      preferences: true,
      isVerified: true,
      verifiedAt: true,
      loyaltyPoints: true,
      membershipTier: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  professionalProfile: {
    select: {
      userId: true,
      companyName: true,
      profession: true,
      slug: true,
      bio: true,
      portfolioUrl: true,
      businessEmail: true,
      businessPhone: true,
      website: true,
      socials: true,
      city: true,
      county: true,
      country: true,
      latitude: true,
      longitude: true,
      serviceRadiusKm: true,
      availability: true,
      operatingHours: true,
      kraPin: true,
      isInsured: true,
      insuranceExpiry: true,
      insuranceProvider: true,
      insurancePolicyNumber: true,
      yearsExperience: true,
      verified: true,
      verificationStatus: true,
      verificationNotes: true,
      verifiedAt: true,
      rating: true,
      reviewCount: true,
      completedProjects: true,
      projectCount: true,
      responseRate: true,
      responseTime: true,
      minProjectBudget: true,
      hourlyRate: true,
      acceptedPayments: true,
      licenses: {
        select: {
          id: true,
          authority: true,
          licenseNumber: true,
          category: true,
          status: true,
          validFrom: true,
          validUntil: true,
          isAnnualRenewal: true,
          verifiedAt: true,
          notes: true,
        },
        orderBy: {
          validFrom: "desc" as const,
        },
      },
      documents: {
        select: {
          id: true,
          category: true,
          title: true,
          issuer: true,
          issueDate: true,
          expiryDate: true,
          status: true,
          verifiedAt: true,
          rejectionReason: true,
        },
        where: {
          deletedAt: null,
        },
        orderBy: {
          createdAt: "desc" as const,
        },
      },
      offeredServices: {
        select: {
          id: true,
          serviceId: true,
          price: true,
          pricingUnit: true,
          yearsExperience: true,
          isPrimary: true,
          service: {
            select: {
              id: true,
              name: true,
              categoryId: true,
            },
          },
        },
        where: {
          deletedAt: null,
        },
      },
      createdAt: true,
      updatedAt: true,
    },
  },
  consents: {
    select: {
      id: true,
      type: true,
      granted: true,
      grantedAt: true,
      withdrawnAt: true,
    },
    orderBy: {
      grantedAt: "desc" as const,
    },
  },
} satisfies Prisma.UserSelect;

type UserProfileRecord = Prisma.UserGetPayload<{
  select: typeof userProfileSelect;
}>;

function getRoleProfile(user: UserProfileRecord) {
  return user.role === "CLIENT" ? user.clientProfile : user.professionalProfile;
}

function buildVerificationSummary(profile: VerificationProfile | null) {
  if (!profile) {
    return null;
  }

  const activeLicenses =
    profile.licenses?.filter(
      (license) =>
        license.status === "VERIFIED" &&
        (!license.validUntil || new Date(license.validUntil) > new Date()),
    ) || [];
  const pendingDocuments =
    profile.documents?.filter((document) => document.status === "PENDING") ||
    [];
  const rejectedDocuments =
    profile.documents?.filter((document) => document.status === "REJECTED") ||
    [];

  return {
    isVerified: profile.verified,
    verificationStatus: profile.verificationStatus,
    verifiedAt: profile.verifiedAt,
    activeLicensesCount: activeLicenses.length,
    pendingDocumentsCount: pendingDocuments.length,
    rejectedDocumentsCount: rejectedDocuments.length,
    requiresAction:
      profile.verificationStatus === "NEEDS_CORRECTION" ||
      rejectedDocuments.length > 0,
    notes: profile.verificationNotes,
  };
}

function buildProfileResponse(user: UserProfileRecord) {
  const profile = getRoleProfile(user);
  const completion = calculateProfileCompletion(
    {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatar: user.avatar,
      role:
        user.role === "CLIENT"
          ? "client"
          : user.role === "PROFESSIONAL"
            ? "professional"
            : "admin",
    },
    profile,
  );

  const isAccountLocked =
    user.lockedUntil && new Date(user.lockedUntil) > new Date();
  const requiresPasswordReset = user.passwordResetRequired;
  const hasScheduledDeletion = user.scheduledDeletionAt !== null;
  const hasActiveMarketingConsent =
    user.emailMarketingConsent || user.smsMarketingConsent;
  const verificationSummary =
    user.role === "PROFESSIONAL"
      ? buildVerificationSummary(
          user.professionalProfile as VerificationProfile | null,
        )
      : null;

  return {
    user: {
      id: user.id,
      clerkId: user.clerkId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      phone: user.phone,
      avatar: user.avatar,
      bio: user.bio,
      role: user.role,
      status: user.status,
      isProfileComplete: user.isProfileComplete,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      phoneVerifiedAt: user.phoneVerifiedAt,
      isAccountLocked,
      lockedUntil: user.lockedUntil,
      requiresPasswordReset,
      lastLoginAt: user.lastLoginAt,
      lastActiveAt: user.lastActiveAt,
      loginCount: user.loginCount,
      termsAcceptedAt: user.termsAcceptedAt,
      termsVersion: user.termsVersion,
      privacyAcceptedAt: user.privacyAcceptedAt,
      emailMarketingConsent: user.emailMarketingConsent,
      smsMarketingConsent: user.smsMarketingConsent,
      analyticsConsent: user.analyticsConsent,
      hasActiveMarketingConsent,
      marketingConsentWithdrawnAt: user.marketingConsentWithdrawnAt,
      dataRetentionDays: user.dataRetentionDays,
      hasScheduledDeletion,
      scheduledDeletionAt: user.scheduledDeletionAt,
      metadata: user.metadata,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    profile,
    verification: verificationSummary,
    completion: {
      percentage: completion.percentage,
      isComplete: completion.isComplete,
      missingRequired: completion.missingRequired,
      missingRequiredLabels: getMissingFieldLabels(completion.missingRequired),
      missingOptional: completion.missingOptional,
      filledFields: completion.filledFields,
      requiredPercentage: completion.requiredPercentage,
      optionalPercentage: completion.optionalPercentage,
    },
    consents: user.consents,
    alerts: {
      accountLocked: isAccountLocked,
      passwordResetRequired: requiresPasswordReset,
      scheduledForDeletion: hasScheduledDeletion,
      verificationRequired:
        user.role === "PROFESSIONAL" &&
        verificationSummary?.verificationStatus !== "VERIFIED",
      documentsNeedingAction: verificationSummary?.requiresAction || false,
    },
  };
}

function buildClientProfileUpdateData(
  profileData: NonNullable<UserProfileUpdateInput["profileData"]>,
): Prisma.ClientProfileUpdateInput {
  return {
    ...(profileData.companyName !== undefined && {
      companyName: profileData.companyName,
    }),
    ...(profileData.type !== undefined && {
      type: profileData.type,
    }),
    ...(profileData.website !== undefined && {
      website: profileData.website,
    }),
    ...(profileData.address !== undefined && {
      address: profileData.address,
    }),
    ...(profileData.city !== undefined && {
      city: profileData.city,
    }),
    ...(profileData.county !== undefined && {
      county: profileData.county,
    }),
    ...(profileData.zipCode !== undefined && {
      zipCode: profileData.zipCode,
    }),
    ...(profileData.budgetRangeMin !== undefined && {
      budgetRangeMin: profileData.budgetRangeMin,
    }),
    ...(profileData.budgetRangeMax !== undefined && {
      budgetRangeMax: profileData.budgetRangeMax,
    }),
    ...(profileData.interests !== undefined && {
      interests: profileData.interests,
    }),
    ...(profileData.preferences !== undefined && {
      preferences:
        profileData.preferences === null
          ? Prisma.JsonNull
          : (profileData.preferences as Prisma.InputJsonValue),
    }),
  };
}

function buildProfessionalProfileUpdateData(
  profileData: NonNullable<UserProfileUpdateInput["profileData"]>,
): Prisma.ProfessionalProfileUpdateInput {
  return {
    ...(profileData.companyName !== undefined && {
      companyName: profileData.companyName,
    }),
    ...(profileData.profession !== undefined && {
      profession: profileData.profession,
    }),
    ...(profileData.bio !== undefined && {
      bio: profileData.bio,
    }),
    ...(profileData.businessEmail !== undefined && {
      businessEmail: profileData.businessEmail,
    }),
    ...(profileData.businessPhone !== undefined && {
      businessPhone: profileData.businessPhone,
    }),
    ...(profileData.website !== undefined && {
      website: profileData.website,
    }),
    ...(profileData.socials !== undefined && {
      socials:
        profileData.socials === null
          ? Prisma.JsonNull
          : (profileData.socials as Prisma.InputJsonValue),
    }),
    ...(profileData.city !== undefined && {
      city: profileData.city,
    }),
    ...(profileData.county !== undefined && {
      county: profileData.county,
    }),
    ...(profileData.serviceRadiusKm !== undefined && {
      serviceRadiusKm: profileData.serviceRadiusKm,
    }),
    ...(profileData.availability !== undefined && {
      availability: profileData.availability,
    }),
    ...(profileData.operatingHours !== undefined && {
      operatingHours:
        profileData.operatingHours === null
          ? Prisma.JsonNull
          : (profileData.operatingHours as Prisma.InputJsonValue),
    }),
    ...(profileData.yearsExperience !== undefined && {
      yearsExperience: profileData.yearsExperience,
    }),
    ...(profileData.minProjectBudget !== undefined && {
      minProjectBudget: profileData.minProjectBudget,
    }),
    ...(profileData.hourlyRate !== undefined && {
      hourlyRate: profileData.hourlyRate,
    }),
    ...(profileData.acceptedPayments !== undefined && {
      acceptedPayments: profileData.acceptedPayments,
    }),
  };
}

export const userProfileService = {
  async getProfile(
    actor: UserProfileActor,
  ): Promise<
    UserProfileDomainResult<Serialized<ReturnType<typeof buildProfileResponse>>>
  > {
    const user = await prisma.user.findUnique({
      where: { id: actor.userId },
      select: userProfileSelect,
    });

    if (!user) {
      return err({ error: "not_found", message: "User not found" });
    }

    return ok(mapUserProfileReadResponse(buildProfileResponse(user)));
  },

  async updateProfile(input: {
    actor: UserProfileActor;
    data: UserProfileUpdateInput;
  }): Promise<
    UserProfileDomainResult<{
      success: true;
      user: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        phone: string | null;
        avatar: string | null;
        bio: string | null;
        role: string;
        emailMarketingConsent: boolean;
        smsMarketingConsent: boolean;
        analyticsConsent: boolean;
        updatedAt: string;
      };
      message: string;
    }>
  > {
    const currentUser = await prisma.user.findUnique({
      where: { id: input.actor.userId },
      select: {
        role: true,
        status: true,
        emailMarketingConsent: true,
        smsMarketingConsent: true,
        clientProfile: { select: { userId: true } },
        professionalProfile: { select: { userId: true } },
      },
    });

    if (!currentUser) {
      return err({ error: "not_found", message: "User not found" });
    }

    if (currentUser.status === "SUSPENDED" || currentUser.status === "BANNED") {
      return err({
        error: "forbidden",
        message:
          "Profile updates are not allowed for suspended or banned accounts",
      });
    }

    const now = new Date();
    const consentWithdrawn =
      (currentUser.emailMarketingConsent &&
        input.data.emailMarketingConsent === false) ||
      (currentUser.smsMarketingConsent &&
        input.data.smsMarketingConsent === false);

    const userUpdateData: Prisma.UserUpdateInput = {
      ...(input.data.firstName !== undefined && {
        firstName: input.data.firstName,
      }),
      ...(input.data.lastName !== undefined && {
        lastName: input.data.lastName,
      }),
      ...(input.data.phone !== undefined && { phone: input.data.phone }),
      ...(input.data.avatar !== undefined && { avatar: input.data.avatar }),
      ...(input.data.bio !== undefined && { bio: input.data.bio }),
      ...(input.data.emailMarketingConsent !== undefined && {
        emailMarketingConsent: input.data.emailMarketingConsent,
      }),
      ...(input.data.smsMarketingConsent !== undefined && {
        smsMarketingConsent: input.data.smsMarketingConsent,
      }),
      ...(input.data.analyticsConsent !== undefined && {
        analyticsConsent: input.data.analyticsConsent,
      }),
      ...(consentWithdrawn && { marketingConsentWithdrawnAt: now }),
    };

    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: input.actor.userId },
        data: userUpdateData,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatar: true,
          bio: true,
          role: true,
          emailMarketingConsent: true,
          smsMarketingConsent: true,
          analyticsConsent: true,
          updatedAt: true,
        },
      });

      if (
        input.data.profileData &&
        Object.keys(input.data.profileData).length > 0
      ) {
        if (currentUser.role === "CLIENT" && currentUser.clientProfile) {
          await tx.clientProfile.update({
            where: { userId: input.actor.userId },
            data: buildClientProfileUpdateData(input.data.profileData),
          });
        } else if (
          currentUser.role === "PROFESSIONAL" &&
          currentUser.professionalProfile
        ) {
          await tx.professionalProfile.update({
            where: { userId: input.actor.userId },
            data: buildProfessionalProfileUpdateData(input.data.profileData),
          });
        }
      }

      // GDPR Article 7(1): each consent event must be individually documented.
      // Previously this created ONE record regardless of how many consent types
      // were updated in a single call, silently dropping the others.
      // Now we create one ConsentRecord per changed type.
      if (
        input.data.emailMarketingConsent !== undefined ||
        input.data.smsMarketingConsent !== undefined ||
        input.data.analyticsConsent !== undefined
      ) {
        type ConsentRow = {
          type: "MARKETING_EMAIL" | "MARKETING_SMS" | "ANALYTICS_COOKIES";
          granted: boolean;
        };
        const consentRows: ConsentRow[] = [];
        if (input.data.emailMarketingConsent !== undefined) {
          consentRows.push({
            type: "MARKETING_EMAIL",
            granted: input.data.emailMarketingConsent,
          });
        }
        if (input.data.smsMarketingConsent !== undefined) {
          consentRows.push({
            type: "MARKETING_SMS",
            granted: input.data.smsMarketingConsent,
          });
        }
        if (input.data.analyticsConsent !== undefined) {
          consentRows.push({
            type: "ANALYTICS_COOKIES",
            granted: input.data.analyticsConsent,
          });
        }
        await Promise.all(
          consentRows.map((row) =>
            tx.consentRecord.create({
              data: {
                userId: input.actor.userId,
                type: row.type,
                granted: row.granted,
                grantedAt: now,
                documentVersion: "v1.0",
                metadata: {
                  source: "profile_update",
                  correlationId: input.actor.correlationId,
                },
              },
            }),
          ),
        );
      }

      return user;
    });

    const completionSyncResult = await syncUserProfileCompletionStatus(
      input.actor.userId,
    );
    if (!completionSyncResult.ok) {
      return err({
        error:
          completionSyncResult.error === "not_found" ? "not_found" : "internal",
        message: completionSyncResult.message,
        status: completionSyncResult.status,
      });
    }

    return ok(
      mapUserProfileUpdateResponse({
        success: true,
        user: updatedUser,
        message: "Profile updated successfully",
      }),
    );
  },
};
