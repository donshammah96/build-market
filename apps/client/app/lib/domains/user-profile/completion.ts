import { prisma } from "@build/db";
import { Prisma } from "@prisma/client";
import {
  calculateProfileCompletion,
  getMissingFieldLabels,
} from "@/app/lib/utils/profile-completion";

type CompletionClient = Prisma.TransactionClient | typeof prisma;

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
): Promise<{
  isProfileComplete: boolean;
  completion: UserProfileCompletionSummary;
}> {
  const user = await client.user.findUnique({
    where: { id: userId },
    include: {
      clientProfile: true,
      professionalProfile: true,
    },
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const profile =
    user.role === "CLIENT" ? user.clientProfile : user.professionalProfile;
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

  return {
    isProfileComplete: completion.isComplete,
    completion: buildCompletionSummary(completion),
  };
}

export function buildUserProfileCompletionSummary(
  completion: ReturnType<typeof calculateProfileCompletion>,
): UserProfileCompletionSummary {
  return buildCompletionSummary(completion);
}
