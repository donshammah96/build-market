import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ApprovalStatus, EscrowStatus } from "@prisma/client";

let projectsService: typeof import("@/app/lib/domains/projects/service").projectsService;
let projectsRepository: typeof import("@/app/lib/domains/projects/repository").projectsRepository;

const userProfileDomainMock = vi.hoisted(() => ({
  enforceClientMutationPolicy: vi.fn(),
}));

const dbMock = vi.hoisted(() => ({
  consentRecord: {
    create: vi.fn(),
  },
}));

vi.mock("@build/db", () => ({
  prisma: dbMock,
}));

vi.mock("@build/redis", () => ({}));

vi.mock("@/app/lib/domains/projects/repository", () => ({
  projectsRepository: {
    verifyParticipant: vi.fn(),
    createProfessionalProject: vi.fn(),
    verifyMilestone: vi.fn(),
    getEscrowForProject: vi.fn(),
    getMilestoneApprovalStatus: vi.fn(),
    updateMilestoneApproval: vi.fn(),
    fundEscrow: vi.fn(),
    releaseEscrowAndRecordFinance: vi.fn(),
  },
}));

vi.mock("@/app/lib/domains/user-profile", () => ({
  enforceClientMutationPolicy:
    userProfileDomainMock.enforceClientMutationPolicy,
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  getClientLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/app/lib/gdpr/services/compliance.service", () => ({
  ComplianceService: {
    logAdminAction: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("projectsService", () => {
  beforeAll(async () => {
    ({ projectsService } = await import("@/app/lib/domains/projects/service"));
    ({ projectsRepository } =
      await import("@/app/lib/domains/projects/repository"));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    userProfileDomainMock.enforceClientMutationPolicy.mockResolvedValue({
      ok: true,
      routing: null,
    });
  });

  it("blocks project creation when government procurement compliance is incomplete", async () => {
    userProfileDomainMock.enforceClientMutationPolicy.mockResolvedValue({
      ok: false,
      message:
        "Government entity procurement compliance is incomplete. Missing required fields: companyRegistration, kraPin.",
      routing: {
        clientType: "GOVERNMENT_ENTITY",
        onboardingBranch: "government_entity",
        requiresDedicatedProcurementCheck: true,
        projectCreationPolicy: "government_entity_procurement_check",
        paymentInitiationPolicy: "government_entity_procurement_check",
        status: "pending_information",
        missingRequirements: ["companyRegistration", "kraPin"],
      },
    });

    const result = await projectsService.createProject({
      userId: "pro-1",
      role: "PROFESSIONAL",
      data: {
        clientId: "client-1",
        title: "County Housing Retrofit",
        type: "RESIDENTIAL",
        contractType: "FULL_CONTRACT",
        status: "PLANNING",
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("forbidden");
      expect(result.message).toContain("Missing required fields");
    }
    expect(projectsRepository.createProfessionalProject).not.toHaveBeenCalled();
  });

  it("rejects milestone approval when participant is not client", async () => {
    vi.mocked(projectsRepository.verifyParticipant).mockResolvedValue({
      success: true,
      data: {
        id: "project-1",
        professionalId: "pro-1",
        clientId: "client-1",
        title: "House",
        role: "professional",
      },
    } as never);

    const result = await projectsService.approveMilestone({
      projectId: "project-1",
      milestoneId: "mile-1",
      userId: "pro-1",
      approvalStatus: ApprovalStatus.APPROVED,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("forbidden");
    }
  });

  it("funds escrow only from pending_funding status", async () => {
    vi.mocked(projectsRepository.verifyParticipant).mockResolvedValue({
      success: true,
      data: {
        id: "project-1",
        professionalId: "pro-1",
        clientId: "client-1",
        title: "House",
        role: "professional",
      },
    } as never);
    vi.mocked(projectsRepository.getEscrowForProject).mockResolvedValue({
      id: "esc-1",
      status: EscrowStatus.RELEASED,
      amount: 1000,
      platformFee: 0,
      vatAmount: 0,
      withholdingTax: 0,
      milestoneId: null,
    } as never);

    const result = await projectsService.fundEscrow({
      projectId: "project-1",
      escrowId: "esc-1",
      userId: "client-1",
      referenceCode: "REF-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("invalid_transition");
    }
    expect(projectsRepository.fundEscrow).not.toHaveBeenCalled();
  });

  it("blocks escrow funding when client payment procurement compliance is incomplete", async () => {
    vi.mocked(projectsRepository.verifyParticipant).mockResolvedValue({
      success: true,
      data: {
        id: "project-1",
        professionalId: "pro-1",
        clientId: "client-1",
        title: "House",
        role: "client",
      },
    } as never);
    userProfileDomainMock.enforceClientMutationPolicy.mockResolvedValue({
      ok: false,
      message:
        "Government entity procurement compliance is incomplete. Missing required fields: companyRegistration.",
      routing: {
        clientType: "GOVERNMENT_ENTITY",
        onboardingBranch: "government_entity",
        requiresDedicatedProcurementCheck: true,
        projectCreationPolicy: "government_entity_procurement_check",
        paymentInitiationPolicy: "government_entity_procurement_check",
        status: "pending_information",
        missingRequirements: ["companyRegistration"],
      },
    });

    const result = await projectsService.fundEscrow({
      projectId: "project-1",
      escrowId: "esc-1",
      userId: "client-1",
      referenceCode: "REF-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("forbidden");
      expect(result.message).toContain("procurement compliance");
    }
    expect(projectsRepository.getEscrowForProject).not.toHaveBeenCalled();
  });

  it("records finance transaction when escrow release succeeds", async () => {
    vi.mocked(projectsRepository.verifyParticipant).mockResolvedValue({
      success: true,
      data: {
        id: "project-1",
        professionalId: "pro-1",
        clientId: "client-1",
        title: "House",
        role: "client",
      },
    } as never);
    vi.mocked(projectsRepository.getEscrowForProject).mockResolvedValue({
      id: "esc-1",
      status: EscrowStatus.FUNDS_HELD,
      amount: 1000,
      platformFee: 100,
      vatAmount: 16,
      withholdingTax: 50,
      milestoneId: "mile-1",
    } as never);
    vi.mocked(projectsRepository.getMilestoneApprovalStatus).mockResolvedValue({
      approvalStatus: ApprovalStatus.APPROVED,
    } as never);
    vi.mocked(
      projectsRepository.releaseEscrowAndRecordFinance,
    ).mockResolvedValue({
      id: "esc-1",
      status: EscrowStatus.RELEASED,
    } as never);

    const result = await projectsService.releaseEscrow({
      projectId: "project-1",
      escrowId: "esc-1",
      userId: "client-1",
    });

    expect(result.ok).toBe(true);
    expect(
      projectsRepository.releaseEscrowAndRecordFinance,
    ).toHaveBeenCalledTimes(1);
  });
});
