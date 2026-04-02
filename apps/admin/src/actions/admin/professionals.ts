// @ts-nocheck
"use server";

import { revalidatePath } from "next/cache";
import { Prisma, prisma } from "@build/db";
import { safeAction, safeVerificationAction, logAdminAction } from "./shared";
import { UpdateProfileSchema } from "./types";

// ============================================================================
// Types
// ============================================================================

export type ProfessionalWithUser = Prisma.ProfessionalProfileGetPayload<{
  include: { user: true };
}>;

export type ProfessionalDetails = Prisma.ProfessionalProfileGetPayload<{
  include: {
    user: true;
    certificates: true;
    portfolios: true;
    reviews: true;
    orders: {
      include: { payments: true };
    };
  };
}>;

// ============================================================================
// List & Details Actions
// ============================================================================

/**
 * Fetches a paginated list of professional profiles.
 * Searchable by company name or user email.
 * Filterable by verified status.
 * Sortable by createdAt or companyName.
 */
export async function getProfessionals(
  page = 1,
  limit = 10,
  search = "",
  verified?: boolean,
  sortBy: "createdAt" | "companyName" = "createdAt",
  sortOrder: "asc" | "desc" = "desc",
) {
  return safeAction("getProfessionals", async () => {
    const skip = (page - 1) * limit;

    const where: Prisma.ProfessionalProfileWhereInput = {
      ...(search && {
        OR: [
          { companyName: { contains: search, mode: "insensitive" } },
          { user: { email: { contains: search, mode: "insensitive" } } },
          { user: { firstName: { contains: search, mode: "insensitive" } } },
          { user: { lastName: { contains: search, mode: "insensitive" } } },
        ],
      }),
      ...(verified !== undefined && { verified }),
    };

    const orderBy: Prisma.ProfessionalProfileOrderByWithRelationInput = {
      [sortBy === "companyName" ? "companyName" : "createdAt"]: sortOrder,
    };

    const [professionals, total] = await Promise.all([
      prisma.professionalProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: { user: true },
      }),
      prisma.professionalProfile.count({ where }),
    ]);

    return {
      professionals,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  });
}

/**
 * Fetches complete professional profile with all related data.
 */
export async function getProfessionalDetails(userId: string) {
  return safeAction("getProfessionalDetails", async () => {
    const professional = await prisma.professionalProfile.findUnique({
      where: { userId },
      include: {
        user: true,
        certificates: true,
        portfolios: true,
        reviews: true,
        services: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
          },
        },
        projects: {
          take: 10,
          orderBy: { createdAt: "desc" },
          include: { client: true },
        },
      },
    });

    if (!professional) throw new Error("Professional profile not found");
    return professional;
  });
}

// ============================================================================
// Verification Actions (with Optimistic Update Support)
// ============================================================================

/**
 * Marks a professional as verified.
 * Returns the updated profile for optimistic UI updates.
 */
export async function verifyProfessional(userId: string) {
  return safeVerificationAction(
    "verifyProfessional",
    async ({ adminUserId }) => {
      const professional = await prisma.professionalProfile.update({
        where: { userId },
        data: {
          verified: true,
          verificationStatus: "VERIFIED",
          verifiedAt: new Date(),
          verifiedById: adminUserId,
        },
        include: {
          user: {
            select: { email: true, firstName: true, lastName: true },
          },
        },
      });

      // Log audit event
      await logAdminAction({
        userId: adminUserId,
        action: "VERIFY_PROFESSIONAL",
        targetType: "professional",
        targetId: userId,
        details: { newStatus: "VERIFIED" },
      });

      revalidatePath("/professionals");

      // Return full entity for optimistic updates
      return {
        userId: professional.userId,
        verified: true,
        companyName: professional.companyName,
        user: professional.user,
      };
    },
  );
}

/**
 * Marks a professional as unverified/rejected.
 * Returns the updated profile for optimistic UI updates.
 */
export async function rejectProfessional(userId: string, reason?: string) {
  return safeVerificationAction(
    "rejectProfessional",
    async ({ adminUserId }) => {
      const professional = await prisma.professionalProfile.update({
        where: { userId },
        data: {
          verified: false,
          verificationStatus: "REJECTED",
          verificationNotes: reason,
        },
        include: {
          user: {
            select: { email: true, firstName: true, lastName: true },
          },
        },
      });

      // Log audit event
      await logAdminAction({
        userId: adminUserId,
        action: "REJECT_PROFESSIONAL",
        targetType: "professional",
        targetId: userId,
        reason,
        details: { newStatus: "REJECTED" },
      });

      revalidatePath("/professionals");

      // Return full entity for optimistic updates
      return {
        userId: professional.userId,
        verified: false,
        companyName: professional.companyName,
        user: professional.user,
      };
    },
  );
}

// ============================================================================
// Profile Update Actions
// ============================================================================

/**
 * Updates professional profile fields.
 * Returns the updated profile for optimistic UI updates.
 */
export async function updateProfessionalProfile(
  userId: string,
  formData: unknown,
) {
  return safeAction("updateProfessionalProfile", async () => {
    const data = UpdateProfileSchema.parse(formData);

    const professional = await prisma.professionalProfile.update({
      where: { userId },
      data,
      select: {
        userId: true,
        companyName: true,
        licenseNumber: true,
        yearsExperience: true,
        bio: true,
        website: true,
        services: true,
        city: true,
        county: true,
        country: true,
        verified: true,
      },
    });

    revalidatePath(`/professionals/${userId}`);

    // Return updated entity for optimistic updates
    return {
      updated: true,
      professional,
    };
  });
}

/**
 * Deletes a professional's certificate.
 * Returns the deleted certificate ID for optimistic UI updates.
 */
export async function deleteCertificate(certificateId: string) {
  return safeAction("deleteCertificate", async () => {
    const certificate = await prisma.certificate.delete({
      where: { id: certificateId },
      select: {
        id: true,
        name: true,
        professionalId: true,
      },
    });

    revalidatePath(`/professionals/${certificate.professionalId}`);

    // Return deleted certificate info for optimistic updates
    return {
      deleted: true,
      certificateId: certificate.id,
      certificateName: certificate.name,
    };
  });
}
