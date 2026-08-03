import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@build/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@build/db";
import { getVerificationUserContext } from "../lib/auth";

describe("getVerificationUserContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when session has no clerkId (unauthenticated)", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as any);

    const context = await getVerificationUserContext();
    expect(context).toBeNull();
  });

  it("returns null when user is not found in database", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_123" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const context = await getVerificationUserContext();
    expect(context).toBeNull();
  });

  it("returns null when user has no adminProfile (client/professional)", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_client" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "usr_1",
      email: "client@example.com",
      firstName: "John",
      lastName: "Doe",
      adminProfile: null,
    } as any);

    const context = await getVerificationUserContext();
    expect(context).toBeNull();
  });

  it("returns null when adminProfile.isActive is false (deactivated admin)", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_offboarded" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "usr_2",
      email: "ex-admin@example.com",
      firstName: "Ex",
      lastName: "Admin",
      adminProfile: { role: "SUPER_ADMIN", isActive: false },
    } as any);

    const context = await getVerificationUserContext();
    expect(context).toBeNull();
  });

  it("returns null for unmapped admin roles (default deny for non-verification roles)", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_finance" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "usr_3",
      email: "finance@example.com",
      firstName: "Finance",
      lastName: "User",
      adminProfile: { role: "FINANCE_MANAGER", isActive: true },
    } as any);

    const context = await getVerificationUserContext();
    expect(context).toBeNull();
  });

  it("maps SUPER_ADMIN correctly with full capabilities", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_super" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "usr_super",
      email: "super@example.com",
      firstName: "Super",
      lastName: "Admin",
      adminProfile: { role: "SUPER_ADMIN", isActive: true },
    } as any);

    const context = await getVerificationUserContext();
    expect(context).toEqual({
      userId: "usr_super",
      clerkId: "clerk_super",
      email: "super@example.com",
      fullName: "Super Admin",
      verificationRole: "VERIFICATION_COMPLIANCE_OFFICER",
      canRecordDecisions: true,
      canSeniorApprove: true,
      canViewUnredactedEvidence: true,
      canExportPackets: true,
    });
  });

  it("maps OPS_ADMIN correctly to VERIFICATION_SENIOR_REVIEWER", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_ops" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "usr_ops",
      email: "ops@example.com",
      firstName: "Ops",
      lastName: "Lead",
      adminProfile: { role: "OPS_ADMIN", isActive: true },
    } as any);

    const context = await getVerificationUserContext();
    expect(context).toEqual({
      userId: "usr_ops",
      clerkId: "clerk_ops",
      email: "ops@example.com",
      fullName: "Ops Lead",
      verificationRole: "VERIFICATION_SENIOR_REVIEWER",
      canRecordDecisions: true,
      canSeniorApprove: true,
      canViewUnredactedEvidence: false,
      canExportPackets: true,
    });
  });

  it("maps VERIFICATION_ADMIN correctly to VERIFICATION_REVIEWER", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_verifier" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "usr_verifier",
      email: "verifier@example.com",
      firstName: "Jane",
      lastName: "Reviewer",
      adminProfile: { role: "VERIFICATION_ADMIN", isActive: true },
    } as any);

    const context = await getVerificationUserContext();
    expect(context).toEqual({
      userId: "usr_verifier",
      clerkId: "clerk_verifier",
      email: "verifier@example.com",
      fullName: "Jane Reviewer",
      verificationRole: "VERIFICATION_REVIEWER",
      canRecordDecisions: true,
      canSeniorApprove: false,
      canViewUnredactedEvidence: false,
      canExportPackets: false,
    });
  });

  it("maps AUDITOR correctly to VERIFICATION_AUDITOR with read/export rights", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_auditor" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "usr_auditor",
      email: "auditor@kra.go.ke",
      firstName: "Audit",
      lastName: "Officer",
      adminProfile: { role: "AUDITOR", isActive: true },
    } as any);

    const context = await getVerificationUserContext();
    expect(context).toEqual({
      userId: "usr_auditor",
      clerkId: "clerk_auditor",
      email: "auditor@kra.go.ke",
      fullName: "Audit Officer",
      verificationRole: "VERIFICATION_AUDITOR",
      canRecordDecisions: false,
      canSeniorApprove: false,
      canViewUnredactedEvidence: true,
      canExportPackets: true,
    });
  });

  it("falls back to email for fullName when firstName and lastName are missing", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_noname" } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "usr_noname",
      email: "no-name@example.com",
      firstName: null,
      lastName: null,
      adminProfile: { role: "SUPER_ADMIN", isActive: true },
    } as any);

    const context = await getVerificationUserContext();
    expect(context?.fullName).toBe("no-name@example.com");
  });
});
