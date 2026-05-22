import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/lib/api/api-middleware", () => ({
  withAuth: (handler: (...args: unknown[]) => Promise<Response>) => handler,
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  initializeCorrelationId: vi.fn().mockReturnValue("corr-1"),
  getResilientExecutor: vi.fn().mockReturnValue({
    execute: vi.fn(async (fn: () => Promise<unknown>) => ({
      success: true,
      data: await fn(),
    })),
  }),
  getClientLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue("ip-test"),
  RateLimits: {
    READ: { limit: 100, window: 60_000 },
    WRITE: { limit: 10, window: 60_000 },
  },
}));

vi.mock("@/app/lib/api/api-guards", () => ({
  isValidId: vi.fn().mockReturnValue(true),
  checkBodySize: vi.fn().mockReturnValue(null),
}));

vi.mock("@/app/lib/services/idempotency.service", () => ({
  IdempotencyService: {
    generateKey: vi.fn().mockReturnValue("idem-key"),
    checkOrCreate: vi.fn().mockResolvedValue({ status: "new" }),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/app/lib/domains/projects/service", () => ({
  projectsService: {
    listMilestones: vi.fn(),
    createMilestone: vi.fn(),
    getMilestoneDetail: vi.fn(),
    listProjectDocuments: vi.fn(),
    addProjectDocument: vi.fn(),
    getProjectDocument: vi.fn(),
    removeProjectDocument: vi.fn(),
    listProjectImages: vi.fn(),
    addProjectImages: vi.fn(),
    getProjectImage: vi.fn(),
    removeProjectImage: vi.fn(),
    approveMilestone: vi.fn(),
    listEscrows: vi.fn(),
    getEscrowDetail: vi.fn(),
    fundEscrow: vi.fn(),
    releaseEscrow: vi.fn(),
    disputeEscrow: vi.fn(),
  },
}));

describe("Project route alias parity", () => {
  it("keeps milestones alias handlers identical to canonical shared handlers", async () => {
    const [
      sharedMilestones,
      aliasMilestones,
      sharedMilestoneItem,
      aliasMilestoneItem,
      sharedMilestoneApprove,
      aliasMilestoneApprove,
    ] = await Promise.all([
      import("@/app/api/projects/[id]/milestones/route"),
      import("@/app/api/professional-portal/projects/[id]/milestones/route"),
      import("@/app/api/projects/[id]/milestones/[milestoneId]/route"),
      import("@/app/api/professional-portal/projects/[id]/milestones/[milestoneId]/route"),
      import("@/app/api/projects/[id]/milestones/[milestoneId]/approve/route"),
      import("@/app/api/professional-portal/projects/[id]/milestones/[milestoneId]/approve/route"),
    ]);

    expect(aliasMilestones.GET).toBe(sharedMilestones.GET);
    expect(aliasMilestones.POST).toBe(sharedMilestones.POST);
    expect(aliasMilestoneItem.GET).toBe(sharedMilestoneItem.GET);
    expect(aliasMilestoneItem.PATCH).toBe(sharedMilestoneItem.PATCH);
    expect(aliasMilestoneItem.DELETE).toBe(sharedMilestoneItem.DELETE);
    expect(aliasMilestoneApprove.POST).toBe(sharedMilestoneApprove.POST);
  }, 30_000);

  it("keeps document and image aliases identical to canonical shared handlers", async () => {
    const [
      sharedDocuments,
      aliasDocuments,
      sharedDocumentItem,
      aliasDocumentItem,
      sharedImages,
      aliasImages,
      sharedImageItem,
      aliasImageItem,
    ] = await Promise.all([
      import("@/app/api/projects/[id]/documents/route"),
      import("@/app/api/professional-portal/projects/[id]/documents/route"),
      import("@/app/api/projects/[id]/documents/[documentId]/route"),
      import("@/app/api/professional-portal/projects/[id]/documents/[documentId]/route"),
      import("@/app/api/projects/[id]/images/route"),
      import("@/app/api/professional-portal/projects/[id]/images/route"),
      import("@/app/api/projects/[id]/images/[imageId]/route"),
      import("@/app/api/professional-portal/projects/[id]/images/[imageId]/route"),
    ]);

    expect(aliasDocuments.GET).toBe(sharedDocuments.GET);
    expect(aliasDocuments.POST).toBe(sharedDocuments.POST);
    expect(aliasDocumentItem.GET).toBe(sharedDocumentItem.GET);
    expect(aliasDocumentItem.DELETE).toBe(sharedDocumentItem.DELETE);

    expect(aliasImages.GET).toBe(sharedImages.GET);
    expect(aliasImages.POST).toBe(sharedImages.POST);
    expect(aliasImageItem.GET).toBe(sharedImageItem.GET);
    expect(aliasImageItem.DELETE).toBe(sharedImageItem.DELETE);
  });

  it("keeps escrow aliases identical to canonical shared handlers", async () => {
    const [
      sharedEscrow,
      aliasEscrow,
      sharedEscrowItem,
      aliasEscrowItem,
      sharedEscrowFund,
      aliasEscrowFund,
      sharedEscrowRelease,
      aliasEscrowRelease,
      sharedEscrowDispute,
      aliasEscrowDispute,
    ] = await Promise.all([
      import("@/app/api/projects/[id]/escrow/route"),
      import("@/app/api/professional-portal/projects/[id]/escrow/route"),
      import("@/app/api/projects/[id]/escrow/[escrowId]/route"),
      import("@/app/api/professional-portal/projects/[id]/escrow/[escrowId]/route"),
      import("@/app/api/projects/[id]/escrow/[escrowId]/fund/route"),
      import("@/app/api/professional-portal/projects/[id]/escrow/[escrowId]/fund/route"),
      import("@/app/api/projects/[id]/escrow/[escrowId]/release/route"),
      import("@/app/api/professional-portal/projects/[id]/escrow/[escrowId]/release/route"),
      import("@/app/api/projects/[id]/escrow/[escrowId]/dispute/route"),
      import("@/app/api/professional-portal/projects/[id]/escrow/[escrowId]/dispute/route"),
    ]);

    expect(aliasEscrow.GET).toBe(sharedEscrow.GET);
    expect(aliasEscrowItem.GET).toBe(sharedEscrowItem.GET);
    expect(aliasEscrowFund.POST).toBe(sharedEscrowFund.POST);
    expect(aliasEscrowRelease.POST).toBe(sharedEscrowRelease.POST);
    expect(aliasEscrowDispute.POST).toBe(sharedEscrowDispute.POST);
  });
});
