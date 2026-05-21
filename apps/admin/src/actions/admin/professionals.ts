"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { safeAction, safeVerificationAction } from "./shared";
import { omitUndefined } from "@/lib/utils";
import { UpdateProfileSchema } from "./types";
import { professionalsService } from "@/lib/domains/professionals/service";
import type {
  ProfessionalDetails,
  ProfessionalListItem as ProfessionalWithUser,
} from "@/lib/domains/professionals/contracts";

export type { ProfessionalDetails, ProfessionalWithUser };

function parseActionInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
  fallbackMessage: string,
): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? fallbackMessage);
  }

  return result.data;
}

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
  return safeAction("getProfessionals", async ({ actor }) => {
    const result = await professionalsService.listProfessionals(
      actor,
      page,
      limit,
      search,
      verified,
      sortBy,
      sortOrder,
    );
    if (!result.ok) {
      throw new Error(result.message);
    }
    return result.data;
  });
}

/**
 * Fetches complete professional profile with all related data.
 */
export async function getProfessionalDetails(userId: string) {
  return safeAction("getProfessionalDetails", async ({ actor }) => {
    const parsedUserId = parseActionInput(
      z.string().min(1),
      userId,
      "User ID is required",
    );
    const result = await professionalsService.getProfessionalDetails(
      actor,
      parsedUserId,
    );
    if (!result.ok) {
      throw new Error(result.message);
    }
    return result.data;
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
    async ({ actor }) => {
      const parsedUserId = parseActionInput(
        z.string().min(1),
        userId,
        "User ID is required",
      );
      const result = await professionalsService.verifyProfessional(
        actor,
        parsedUserId,
      );
      if (!result.ok) {
        throw new Error(result.message);
      }

      revalidatePath("/professionals");

      return result.data;
    },
    {
      auditLog: {
        operation: "VERIFY_PROFESSIONAL",
        resourceType: "professional",
        getTargetId: () => userId,
        getDetails: () => ({ newStatus: "VERIFIED" }),
      },
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
    async ({ actor }) => {
      const parsedUserId = parseActionInput(
        z.string().min(1),
        userId,
        "User ID is required",
      );
      const parsedReason = reason
        ? parseActionInput(z.string().max(500), reason, "Invalid reason")
        : undefined;
      const result = await professionalsService.rejectProfessional(
        actor,
        parsedUserId,
        parsedReason,
      );
      if (!result.ok) {
        throw new Error(result.message);
      }

      revalidatePath("/professionals");

      return result.data;
    },
    {
      auditLog: {
        operation: "REJECT_PROFESSIONAL",
        resourceType: "professional",
        getTargetId: () => userId,
        getDetails: () => ({ newStatus: "REJECTED" }),
        getReason: () => reason,
      },
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
  return safeAction("updateProfessionalProfile", async ({ actor }) => {
    const parsedUserId = parseActionInput(
      z.string().min(1),
      userId,
      "User ID is required",
    );
    const data = parseActionInput(
      UpdateProfileSchema,
      formData,
      "Invalid profile update data",
    );

    const result = await professionalsService.updateProfessionalProfile(
      actor,
      parsedUserId,
      omitUndefined(data) as any,
    );
    if (!result.ok) {
      throw new Error(result.message);
    }

    revalidatePath(`/professionals/${parsedUserId}`);

    return result.data;
  });
}

/**
 * Deletes a professional's certificate.
 * Returns the deleted certificate ID for optimistic UI updates.
 */
export async function deleteCertificate(certificateId: string) {
  return safeAction("deleteCertificate", async ({ actor }) => {
    const parsedCertificateId = parseActionInput(
      z.string().min(1),
      certificateId,
      "Certificate ID is required",
    );
    const result = await professionalsService.deleteCertificate(
      actor,
      parsedCertificateId,
    );
    if (!result.ok) {
      throw new Error(result.message);
    }

    revalidatePath("/professionals");

    return result.data;
  });
}
