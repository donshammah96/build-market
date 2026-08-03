/**
 * Verification Ops Authorization & Permission Engine
 *
 * Implements verification-specific permissions (§2 of Phase 8 Guideline):
 * - VERIFICATION_READ_ONLY
 * - VERIFICATION_REVIEWER
 * - VERIFICATION_SENIOR_REVIEWER
 * - VERIFICATION_COMPLIANCE_OFFICER
 *
 * Scoped independently of standard AdminRole permissions.
 */

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@build/db";
import { type VerificationRolePermission } from "@build/verification-domain";

export type VerificationUserContext = {
  userId: string;
  clerkId: string;
  email: string;
  fullName: string;
  verificationRole: VerificationRolePermission;
  canRecordDecisions: boolean;
  canSeniorApprove: boolean;
  canViewUnredactedEvidence: boolean;
  canExportPackets: boolean;
};

/**
 * Resolve verification permission context from Clerk session and DB profile.
 */
export async function getVerificationUserContext(): Promise<VerificationUserContext | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      adminProfile: { select: { role: true, isActive: true } },
    },
  });

  // Strict default-deny: user must exist, must have an AdminProfile, and profile must be active
  if (!user || !user.adminProfile || !user.adminProfile.isActive) {
    return null;
  }

  const adminRole = user.adminProfile.role;

  // Explicit role map allow-list. Unmapped roles (CONTENT_MODERATOR, SUPPORT_AGENT, FINANCE_MANAGER) return null (deny).
  const ROLE_MAP: Partial<Record<string, VerificationRolePermission>> = {
    SUPER_ADMIN: "VERIFICATION_COMPLIANCE_OFFICER",
    OPS_ADMIN: "VERIFICATION_SENIOR_REVIEWER",
    VERIFICATION_ADMIN: "VERIFICATION_REVIEWER",
    AUDITOR: "VERIFICATION_AUDITOR",
  };

  const verificationRole = ROLE_MAP[adminRole];
  if (!verificationRole) {
    return null;
  }

  // AUDITOR can view unredacted evidence and export packets for compliance audits,
  // but CANNOT record decisions or act as a four-eyes senior approver.
  const canRecordDecisions =
    verificationRole === "VERIFICATION_REVIEWER" ||
    verificationRole === "VERIFICATION_SENIOR_REVIEWER" ||
    verificationRole === "VERIFICATION_COMPLIANCE_OFFICER";

  const canSeniorApprove =
    verificationRole === "VERIFICATION_SENIOR_REVIEWER" ||
    verificationRole === "VERIFICATION_COMPLIANCE_OFFICER";

  const canViewUnredactedEvidence =
    verificationRole === "VERIFICATION_COMPLIANCE_OFFICER" ||
    verificationRole === "VERIFICATION_AUDITOR";

  const canExportPackets =
    verificationRole === "VERIFICATION_SENIOR_REVIEWER" ||
    verificationRole === "VERIFICATION_COMPLIANCE_OFFICER" ||
    verificationRole === "VERIFICATION_AUDITOR";

  return {
    userId: user.id,
    clerkId,
    email: user.email,
    fullName:
      `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email,
    verificationRole,
    canRecordDecisions,
    canSeniorApprove,
    canViewUnredactedEvidence,
    canExportPackets,
  };
}
