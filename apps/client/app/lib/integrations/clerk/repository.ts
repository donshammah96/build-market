import {
  prisma,
  VerificationStatus,
  type Prisma,
  type UserRole,
  type UserStatus,
} from "@build/db";
import {
  professionalProfileSelect,
  userWebhookSelect,
} from "@/app/lib/validation/clerk-webhook-validation";

export type ClerkWebhookUserRecord = Prisma.UserGetPayload<{
  select: typeof userWebhookSelect;
}>;

export type ClerkWebhookProfessionalProfile =
  Prisma.ProfessionalProfileGetPayload<{
    select: typeof professionalProfileSelect;
  }>;

export type CreateOrUpdateUserPayload = {
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  phone: string | null;
  avatar: string | null;
  role?: UserRole;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  emailVerifiedAt?: Date;
  phoneVerifiedAt?: Date;
};

export type UpdateClerkUserPayload = {
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  phone?: string | null;
  avatar?: string | null;
  role?: UserRole;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  emailVerifiedAt?: Date;
  phoneVerifiedAt?: Date;
};

export const clerkIntegrationRepository = {
  async upsertUser(
    payload: CreateOrUpdateUserPayload,
  ): Promise<ClerkWebhookUserRecord> {
    const {
      clerkId,
      email,
      firstName,
      lastName,
      displayName,
      phone,
      avatar,
      role,
      isEmailVerified,
      isPhoneVerified,
      emailVerifiedAt,
      phoneVerifiedAt,
    } = payload;

    return prisma.user.upsert({
      where: { clerkId },
      create: {
        clerkId,
        email,
        firstName,
        lastName,
        displayName,
        phone,
        avatar,
        role,
        isEmailVerified,
        isPhoneVerified,
        ...(emailVerifiedAt ? { emailVerifiedAt } : {}),
        ...(phoneVerifiedAt ? { phoneVerifiedAt } : {}),
      },
      update: {
        email,
        firstName,
        lastName,
        displayName,
        phone,
        avatar,
        isEmailVerified,
        isPhoneVerified,
        ...(emailVerifiedAt ? { emailVerifiedAt } : {}),
        ...(phoneVerifiedAt ? { phoneVerifiedAt } : {}),
      },
      select: userWebhookSelect,
    });
  },

  async findUserForSync(clerkId: string) {
    return prisma.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        clerkId: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        firstName: true,
        lastName: true,
      },
    });
  },

  async updateUser(
    clerkId: string,
    data: UpdateClerkUserPayload,
  ): Promise<ClerkWebhookUserRecord> {
    return prisma.user.update({
      where: { clerkId },
      data,
      select: userWebhookSelect,
    });
  },

  async softDeleteUser(
    clerkId: string,
    data: {
      status: UserStatus;
      deletedAt: Date;
      deletionRequestedAt: Date;
      deletionReason: string;
      scheduledDeletionAt: Date;
    },
  ): Promise<ClerkWebhookUserRecord> {
    return prisma.user.update({
      where: { clerkId },
      data,
      select: userWebhookSelect,
    });
  },

  async updateSessionActivity(clerkId: string): Promise<{ count: number }> {
    return prisma.user.updateMany({
      where: { clerkId },
      data: {
        lastLoginAt: new Date(),
        lastActiveAt: new Date(),
        loginCount: { increment: 1 },
        failedLoginCount: 0,
      },
    });
  },

  async findUserIdByClerkId(clerkId: string): Promise<{ id: string } | null> {
    return prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
  },

  async findProfessionalProfileByUserId(
    userId: string,
  ): Promise<ClerkWebhookProfessionalProfile | null> {
    return prisma.professionalProfile.findUnique({
      where: { userId },
      select: professionalProfileSelect,
    });
  },

  async updateProfessionalVerification(
    userId: string,
    isVerified: boolean,
  ): Promise<void> {
    await prisma.professionalProfile.update({
      where: { userId },
      data: {
        verified: isVerified,
        verificationStatus: isVerified
          ? VerificationStatus.VERIFIED
          : VerificationStatus.PENDING,
        ...(isVerified ? { verifiedAt: new Date() } : {}),
      },
    });
  },
};
