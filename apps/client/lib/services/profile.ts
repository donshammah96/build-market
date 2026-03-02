/**
 * Profile Service Layer
 *
 * Core business logic for professional-portal profile operations.
 */
import { prisma } from "../db";
import type { UpdateProfileInput } from "@/app/lib/validation/profile-validation";

export type GetProfileResult =
  | { success: true; data: unknown }
  | { success: false; error: "not_found" };

export async function getProfessionalProfile(
  dbUserId: string,
): Promise<GetProfileResult> {
  const professional = await prisma.professionalProfile.findUnique({
    where: { userId: dbUserId },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
        },
      },
      offeredServices: {
        include: {
          service: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  });

  if (!professional) {
    return { success: false, error: "not_found" };
  }

  return { success: true, data: professional };
}

export async function updateProfessionalProfile(
  dbUserId: string,
  data: UpdateProfileInput,
): Promise<unknown> {
  const {
    firstName,
    lastName,
    companyName,
    profession,
    bio,
    city,
    county,
    website,
    portfolioUrl,
    businessEmail,
    businessPhone,
    yearsExperience,
    availability,
    minProjectBudget,
    hourlyRate,
    serviceIds,
  } = data;

  return prisma.$transaction(async (tx) => {
    if (firstName !== undefined || lastName !== undefined) {
      await tx.user.update({
        where: { id: dbUserId },
        data: {
          ...(firstName !== undefined && { firstName }),
          ...(lastName !== undefined && { lastName }),
        },
      });
    }

    const profileData: Record<string, unknown> = {};
    if (companyName !== undefined) profileData.companyName = companyName;
    if (profession !== undefined) profileData.profession = profession;
    if (bio !== undefined) profileData.bio = bio;
    if (city !== undefined) profileData.city = city;
    if (county !== undefined) profileData.county = county;
    if (website !== undefined) profileData.website = website || null;
    if (portfolioUrl !== undefined)
      profileData.portfolioUrl = portfolioUrl || null;
    if (businessEmail !== undefined)
      profileData.businessEmail = businessEmail || null;
    if (businessPhone !== undefined)
      profileData.businessPhone = businessPhone || null;
    if (yearsExperience !== undefined)
      profileData.yearsExperience = yearsExperience;
    if (availability !== undefined) profileData.availability = availability;
    if (minProjectBudget !== undefined)
      profileData.minProjectBudget = minProjectBudget;
    if (hourlyRate !== undefined) profileData.hourlyRate = hourlyRate;

    if (serviceIds !== undefined) {
      await tx.professionalService.deleteMany({
        where: { professionalId: dbUserId },
      });

      if (serviceIds.length > 0) {
        await tx.professionalService.createMany({
          data: serviceIds.map((serviceId) => ({
            professionalId: dbUserId,
            serviceId,
          })),
        });
      }
    }

    return tx.professionalProfile.update({
      where: { userId: dbUserId },
      data: profileData,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
        offeredServices: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });
  });
}
