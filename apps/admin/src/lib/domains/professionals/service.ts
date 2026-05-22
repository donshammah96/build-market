import { err, ok, type Result } from "@/lib/errors/result";
import {
  AdminCapability,
  requireAdminCapability,
} from "@/lib/security/authorization-policy";
import type {
  ProfessionalDetails,
  ProfessionalPageResult,
  ProfessionalUpdateInput,
  ProfessionalsActor,
  ProfessionalsDomainError,
} from "./contracts";
import { professionalsRepository } from "./repository";
import { County, Prisma, VerificationStatus } from "@build/db";

function requireViewContent(
  actor: ProfessionalsActor,
): Result<true, ProfessionalsDomainError> {
  const policy = requireAdminCapability(actor, AdminCapability.VIEW_CONTENT);
  if (!policy.success) {
    return err({
      code: "PROFESSIONALS_POLICY_DENIED",
      message: "Admin capability denied",
    });
  }
  return ok(true);
}

function requireManageContent(
  actor: ProfessionalsActor,
): Result<true, ProfessionalsDomainError> {
  const policy = requireAdminCapability(actor, AdminCapability.MANAGE_CONTENT);
  if (!policy.success) {
    return err({
      code: "PROFESSIONALS_POLICY_DENIED",
      message: "Admin capability denied",
    });
  }
  return ok(true);
}

function requireManageVerification(
  actor: ProfessionalsActor,
): Result<true, ProfessionalsDomainError> {
  const policy = requireAdminCapability(
    actor,
    AdminCapability.MANAGE_VERIFICATION,
  );
  if (!policy.success) {
    return err({
      code: "PROFESSIONALS_POLICY_DENIED",
      message: "Admin capability denied",
    });
  }
  return ok(true);
}

export async function listProfessionals(
  actor: ProfessionalsActor,
  page = 1,
  limit = 10,
  search = "",
  verified?: boolean,
  sortBy: "createdAt" | "companyName" = "createdAt",
  sortOrder: "asc" | "desc" = "desc",
): Promise<Result<ProfessionalPageResult, ProfessionalsDomainError>> {
  const cap = requireViewContent(actor);
  if (!cap.ok) return cap;

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
    professionalsRepository.listProfessionals(where, skip, limit, orderBy),
    professionalsRepository.countProfessionals(where),
  ]);

  return ok({
    professionals,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function getProfessionalDetails(
  actor: ProfessionalsActor,
  userId: string,
): Promise<Result<ProfessionalDetails, ProfessionalsDomainError>> {
  const cap = requireViewContent(actor);
  if (!cap.ok) return cap;

  const professional =
    await professionalsRepository.findDetailsByUserId(userId);
  if (!professional) {
    return err({
      code: "PROFESSIONALS_NOT_FOUND",
      message: "Professional profile not found",
    });
  }

  return ok(professional);
}

export async function verifyProfessional(
  actor: ProfessionalsActor,
  userId: string,
): Promise<
  Result<
    {
      userId: string;
      verified: boolean;
      companyName: string;
      user: {
        email: string;
        firstName: string | null;
        lastName: string | null;
      };
    },
    ProfessionalsDomainError
  >
> {
  const cap = requireManageVerification(actor);
  if (!cap.ok) return cap;

  const professional =
    await professionalsRepository.findDetailsByUserId(userId);
  if (!professional) {
    return err({
      code: "PROFESSIONALS_NOT_FOUND",
      message: "Professional profile not found",
    });
  }

  const updated = await professionalsRepository.updateVerification(userId, {
    verified: true,
    verificationStatus: "VERIFIED" as VerificationStatus,
    verifiedAt: new Date(),
    verifiedById: actor.dbUserId,
  });

  return ok(updated);
}

export async function rejectProfessional(
  actor: ProfessionalsActor,
  userId: string,
  reason?: string,
): Promise<
  Result<
    {
      userId: string;
      verified: boolean;
      companyName: string;
      user: {
        email: string;
        firstName: string | null;
        lastName: string | null;
      };
    },
    ProfessionalsDomainError
  >
> {
  const cap = requireManageVerification(actor);
  if (!cap.ok) return cap;

  const professional =
    await professionalsRepository.findDetailsByUserId(userId);
  if (!professional) {
    return err({
      code: "PROFESSIONALS_NOT_FOUND",
      message: "Professional profile not found",
    });
  }

  const updated = await professionalsRepository.updateVerification(userId, {
    verified: false,
    verificationStatus: "REJECTED" as VerificationStatus,
    verificationNotes: reason || null,
  });

  return ok(updated);
}

export async function updateProfessionalProfile(
  actor: ProfessionalsActor,
  userId: string,
  data: ProfessionalUpdateInput,
): Promise<
  Result<
    {
      updated: boolean;
      professional: {
        userId: string;
        companyName: string;
        yearsExperience: number | null;
        bio: string | null;
        website: string | null;
        city: string | null;
        county: County | null;
        country: string | null;
        verified: boolean;
      };
    },
    ProfessionalsDomainError
  >
> {
  const cap = requireManageContent(actor);
  if (!cap.ok) return cap;

  const professional =
    await professionalsRepository.findDetailsByUserId(userId);
  if (!professional) {
    return err({
      code: "PROFESSIONALS_NOT_FOUND",
      message: "Professional profile not found",
    });
  }

  const updated = await professionalsRepository.updateProfile(userId, data);
  return ok({ updated: true, professional: updated });
}

export async function deleteCertificate(
  actor: ProfessionalsActor,
  certificateId: string,
): Promise<
  Result<
    { deleted: boolean; certificateId: string; certificateName: string },
    ProfessionalsDomainError
  >
> {
  const cap = requireManageContent(actor);
  if (!cap.ok) return cap;

  const deleted = await professionalsRepository.deleteDocument(certificateId);
  return ok({
    deleted: true,
    certificateId: deleted.id,
    certificateName: deleted.title,
  });
}

export const professionalsService = {
  listProfessionals,
  getProfessionalDetails,
  verifyProfessional,
  rejectProfessional,
  updateProfessionalProfile,
  deleteCertificate,
};
