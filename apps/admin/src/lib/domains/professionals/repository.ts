import { prisma, type Prisma, County, VerificationStatus } from "@build/db";
import type {
  ProfessionalDetails,
  ProfessionalListItem,
  ProfessionalUpdateInput,
} from "./contracts";

export async function listProfessionals(
  where: Prisma.ProfessionalProfileWhereInput,
  skip: number,
  take: number,
  orderBy: Prisma.ProfessionalProfileOrderByWithRelationInput,
): Promise<ProfessionalListItem[]> {
  const professionals = await prisma.professionalProfile.findMany({
    where,
    skip,
    take,
    orderBy,
    include: {
      user: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return professionals.map((p) => ({
    userId: p.userId,
    companyName: p.companyName,
    yearsExperience: p.yearsExperience,
    city: p.city,
    county: p.county,
    verified: p.verified,
    verificationStatus: p.verificationStatus,
    createdAt: p.createdAt,
    user: {
      email: p.user.email,
      firstName: p.user.firstName,
      lastName: p.user.lastName,
    },
  }));
}

export async function countProfessionals(
  where: Prisma.ProfessionalProfileWhereInput,
): Promise<number> {
  return prisma.professionalProfile.count({ where });
}

export async function findDetailsByUserId(
  userId: string,
): Promise<ProfessionalDetails | null> {
  const professional = await prisma.professionalProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatar: true,
          phone: true,
        },
      },
      documents: {
        select: {
          id: true,
          title: true,
          fileUrl: true,
          issuer: true,
          expiryDate: true,
        },
      },
      portfolios: true,
      reviews: true,
      offeredServices: {
        select: {
          service: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
            },
          },
        },
      },
      projects: {
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { client: true },
      },
    },
  });

  if (!professional) return null;

  return {
    userId: professional.userId,
    companyName: professional.companyName,
    yearsExperience: professional.yearsExperience,
    bio: professional.bio,
    website: professional.website,
    city: professional.city,
    county: professional.county,
    country: professional.country,
    verified: professional.verified,
    verificationStatus: professional.verificationStatus,
    verifiedAt: professional.verifiedAt,
    verifiedById: professional.verifiedById,
    verificationNotes: professional.verificationNotes,
    createdAt: professional.createdAt,
    updatedAt: professional.updatedAt,
    user: professional.user,
    services: professional.offeredServices.map((item) => item.service),
    certificates: professional.documents.map((doc) => ({
      id: doc.id,
      name: doc.title,
      fileUrl: doc.fileUrl || "",
      issuer: doc.issuer,
      expiryDate: doc.expiryDate,
    })),
    portfolios: professional.portfolios,
    reviews: professional.reviews,
    projects: professional.projects,
  };
}

export async function updateProfile(
  userId: string,
  data: ProfessionalUpdateInput,
): Promise<{
  userId: string;
  companyName: string;
  yearsExperience: number | null;
  bio: string | null;
  website: string | null;
  city: string | null;
  county: County | null;
  country: string | null;
  verified: boolean;
}> {
  const updateData: Prisma.ProfessionalProfileUpdateInput = {};
  if (data.companyName !== undefined) updateData.companyName = data.companyName;
  if (data.yearsExperience !== undefined)
    updateData.yearsExperience = data.yearsExperience;
  if (data.bio !== undefined) updateData.bio = data.bio;
  if (data.website !== undefined) updateData.website = data.website;
  if (data.city !== undefined) updateData.city = data.city;
  if (data.county !== undefined) updateData.county = data.county as County;
  if (data.country !== undefined) updateData.country = data.country;

  return prisma.professionalProfile.update({
    where: { userId },
    data: updateData,
    select: {
      userId: true,
      companyName: true,
      yearsExperience: true,
      bio: true,
      website: true,
      city: true,
      county: true,
      country: true,
      verified: true,
    },
  });
}

export async function updateVerification(
  userId: string,
  patch: {
    verified: boolean;
    verificationStatus: VerificationStatus;
    verifiedAt?: Date | null;
    verifiedById?: string | null;
    verificationNotes?: string | null;
  },
): Promise<{
  userId: string;
  verified: boolean;
  companyName: string;
  user: { email: string; firstName: string | null; lastName: string | null };
}> {
  const data: Prisma.ProfessionalProfileUpdateInput = {
    verified: patch.verified,
    verificationStatus: patch.verificationStatus,
  };

  if (patch.verifiedAt !== undefined) {
    data.verifiedAt = patch.verifiedAt;
  }
  if (patch.verifiedById !== undefined) {
    data.verifiedById = patch.verifiedById;
  }
  if (patch.verificationNotes !== undefined) {
    data.verificationNotes = patch.verificationNotes;
  }

  return prisma.professionalProfile.update({
    where: { userId },
    data,
    select: {
      userId: true,
      verified: true,
      companyName: true,
      user: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

export async function deleteDocument(
  documentId: string,
): Promise<{ id: string; title: string; professionalId: string }> {
  return prisma.professionalDocument.delete({
    where: { id: documentId },
    select: {
      id: true,
      title: true,
      professionalId: true,
    },
  });
}

export const professionalsRepository = {
  listProfessionals,
  countProfessionals,
  findDetailsByUserId,
  updateProfile,
  updateVerification,
  deleteDocument,
};
