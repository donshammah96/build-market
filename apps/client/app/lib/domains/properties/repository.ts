import { prisma } from "@build/db";
import { ConsentType, Prisma } from "@prisma/client";

export const propertyRepository = {
  async findUserIdByClerkId(clerkId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    return user?.id ?? null;
  },

  async createReadConsentRecord(input: {
    userId: string;
    propertyId: string;
    propertyTitle: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await prisma.consentRecord.create({
      data: {
        userId: input.userId,
        type: ConsentType.PRIVACY_POLICY,
        granted: true,
        grantedAt: new Date(),
        documentVersion: "v1.0",
        metadata: {
          propertyId: input.propertyId,
          propertyName: input.propertyTitle,
          action: "read",
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        } as Prisma.InputJsonValue,
      },
    });
  },

  async incrementViewCount(propertyId: string): Promise<void> {
    await prisma.property.update({
      where: { id: propertyId },
      data: { viewCount: { increment: 1 } },
    });
  },
};