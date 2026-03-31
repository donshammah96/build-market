import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApprovalStatus, EscrowStatus } from "@prisma/client";
import { projectsService } from "@/app/lib/domains/projects/service";
import { projectsRepository } from "@/app/lib/domains/projects/repository";

vi.mock("@/app/lib/domains/projects/repository", () => ({
  projectsRepository: {
    verifyParticipant: vi.fn(),
    verifyMilestone: vi.fn(),
    getEscrowForProject: vi.fn(),
    getMilestoneApprovalStatus: vi.fn(),
    updateMilestoneApproval: vi.fn(),
    fundEscrow: vi.fn(),
    releaseEscrowAndRecordFinance: vi.fn(),
  },
}));

vi.mock("@/app/lib/gdpr/services/compliance.service", () => ({
  ComplianceService: {
    logAdminAction: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("projectsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
