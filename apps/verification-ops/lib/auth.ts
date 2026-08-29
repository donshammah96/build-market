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
import { isClaimFresh } from "@build/security-clerk";

/** Tier 2 session-freshness window (seconds) — see autopsy §6.3 / hardening doc §3. */
const DESTRUCTIVE_ACTION_CLAIM_FRESHNESS_SECONDS = 300;

export type VerificationUserContext = {
  userId: string;
  clerkId: string;
  email: string;
  fullName: string;
  verificationRole: VerificationRolePermission;
  /**
   * Whether the caller's session claim iat is within the Tier 2 (300s)
   * freshness window. Surfaced on the context so callers building custom
   * UI/error messages can distinguish "not permitted" from "permitted but
   * needs a session refresh first" without re-deriving this themselves.
   */
  sessionFresh: boolean;
  canRecordDecisions: boolean;
  canSeniorApprove: boolean;
  canViewUnredactedEvidence: boolean;
  canExportPackets: boolean;
};

/**
 * Resolve verification permission context from Clerk session and DB profile.
 *
 * Tier 2 session freshness (300s, `isClaimFresh` from `@build/security-clerk`):
 * decision recording, senior approval, unredacted evidence viewing, and
 * packet export are this app's most sensitive operations — recording a
 * verification decision or exporting unredacted evidence on a stale JWT is
 * exactly the class of risk the autopsy's §6.3 ADR requirement targets.
 * These four capability flags are gated on session freshness in addition
 * to the existing role map; a caller whose role would otherwise permit the
 * action but whose claim is stale gets `false` here and should prompt the
 * client to force one `getToken({ skipCache: true })` refresh and re-call
 * this function. Base identity resolution (userId/email/verificationRole)
 * is unaffected by staleness — only the destructive-capability flags are.
 */
export async function getVerificationUserContext(): Promise<VerificationUserContext | null> {
  const { userId: clerkId, sessionClaims } = await auth();
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

  const sessionFresh = isClaimFresh(
    sessionClaims,
    DESTRUCTIVE_ACTION_CLAIM_FRESHNESS_SECONDS,
  );

  // AUDITOR can view unredacted evidence and export packets for compliance audits,
  // but CANNOT record decisions or act as a four-eyes senior approver.
  const roleCanRecordDecisions =
    verificationRole === "VERIFICATION_REVIEWER" ||
    verificationRole === "VERIFICATION_SENIOR_REVIEWER" ||
    verificationRole === "VERIFICATION_COMPLIANCE_OFFICER";

  const roleCanSeniorApprove =
    verificationRole === "VERIFICATION_SENIOR_REVIEWER" ||
    verificationRole === "VERIFICATION_COMPLIANCE_OFFICER";

  const roleCanViewUnredactedEvidence =
    verificationRole === "VERIFICATION_COMPLIANCE_OFFICER" ||
    verificationRole === "VERIFICATION_AUDITOR";

  const roleCanExportPackets =
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
    sessionFresh,
    // Tier 2 gate: role permits AND the session claim is fresh. A stale
    // session degrades these to `false` rather than throwing, so read-only
    // context (userId, email, verificationRole) stays available for
    // display while the destructive actions themselves are blocked until
    // the client refreshes.
    canRecordDecisions: roleCanRecordDecisions && sessionFresh,
    canSeniorApprove: roleCanSeniorApprove && sessionFresh,
    canViewUnredactedEvidence: roleCanViewUnredactedEvidence && sessionFresh,
    canExportPackets: roleCanExportPackets && sessionFresh,
  };
}
