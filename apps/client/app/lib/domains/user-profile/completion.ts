import { prisma } from "@build/db";
import { Prisma } from "@prisma/client";
import {
  err,
  ok,
  type DomainError,
  type Result,
} from "@/app/lib/errors/result";
import {
  calculateProfileCompletion,
  getMissingFieldLabels,
} from "@/app/lib/utils/profile-completion";

type CompletionClient = Prisma.TransactionClient | typeof prisma;

export type UserProfileCompletionErrorCode = "not_found" | "internal";
export type UserProfileCompletionResult<T> = Result<
  T,
  DomainError<UserProfileCompletionErrorCode>
>;

export type UserProfileCompletionSyncData = {
  isProfileComplete: boolean;
  completion: UserProfileCompletionSummary;
};

export type UserProfileCompletionSummary = {
  percentage: number;
  isComplete: boolean;
  missingRequired: string[];
  missingRequiredLabels: string[];
  missingOptional: string[];
  filledFields: string[];
  requiredPercentage: number;
  optionalPercentage: number;
};

function buildCompletionSummary(
  completion: ReturnType<typeof calculateProfileCompletion>,
): UserProfileCompletionSummary {
  return {
    percentage: completion.percentage,
    isComplete: completion.isComplete,
    missingRequired: completion.missingRequired,
    missingRequiredLabels: getMissingFieldLabels(completion.missingRequired),
    missingOptional: completion.missingOptional,
    filledFields: completion.filledFields,
    requiredPercentage: completion.requiredPercentage,
    optionalPercentage: completion.optionalPercentage,
  };
}

export async function syncUserProfileCompletionStatus(
  userId: string,
  client: CompletionClient = prisma,
): Promise<UserProfileCompletionResult<UserProfileCompletionSyncData>> {
  try {
    const user = await client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        isProfileComplete: true,
        clientProfile: {
          select: {
            address: true,
            city: true,
            county: true,
            zipCode: true,
            interests: true,
          },
        },
        professionalProfile: {
          select: {
            companyName: true,
            profession: true,
            bio: true,
            city: true,
            county: true,
            yearsExperience: true,
            website: true,
            portfolioUrl: true,
            offeredServices: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return err({
        error: "not_found",
        message: "User not found",
        status: 404,
      });
    }

    const profile =
      user.role === "CLIENT"
        ? user.clientProfile
        : user.professionalProfile
          ? {
              ...user.professionalProfile,
              offeredServices: user.professionalProfile.offeredServices.map(
                (service) => service.id,
              ),
            }
          : null;
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

    if (user.isProfileComplete !== completion.isComplete) {
      await client.user.update({
        where: { id: userId },
        data: { isProfileComplete: completion.isComplete },
      });
    }

    return ok({
      isProfileComplete: completion.isComplete,
      completion: buildCompletionSummary(completion),
    });
  } catch {
    return err({
      error: "internal",
      message: "Failed to synchronize profile completion",
      status: 500,
    });
  }
}

export function buildUserProfileCompletionSummary(
  completion: ReturnType<typeof calculateProfileCompletion>,
): UserProfileCompletionSummary {
  return buildCompletionSummary(completion);
}
